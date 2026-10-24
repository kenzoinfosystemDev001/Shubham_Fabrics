import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { DepartmentCode } from '@subham/types';

@Injectable()
export class FinalQCService {
  constructor(private readonly prisma: PrismaService) {}

  private success(data: any, message?: string) {
    return {
      success: true,
      data,
      ...(message ? { message } : {}),
    };
  }

  private async getFinalQCUser() {
    return this.prisma.user.findFirst({
      where: {
        OR: [{ username: 'finalcheck' }, { departmentCode: DepartmentCode.FINAL_QC }],
      },
      select: { id: true, username: true, departmentCode: true },
    });
  }

  async getDashboardSummary() {
    const [awaitingReceiptCount, inQueueCount, readyForHandoverCount] = await Promise.all([
      this.prisma.challan.count({
        where: { toDepartment: DepartmentCode.FINAL_QC, status: 'ISSUED' },
      }),
      this.prisma.challan.count({
        where: {
          toDepartment: DepartmentCode.FINAL_QC,
          status: { in: ['RECEIVED', 'IN_PROCESS', 'QC_PENDING', 'ON_HOLD', 'REWORK'] },
        },
      }),
      this.prisma.challan.count({
        where: {
          toDepartment: DepartmentCode.FINAL_QC,
          status: { in: ['COMPLETED', 'QC_APPROVED', 'READY_FOR_HANDOVER'] },
        },
      }),
    ]);

    return this.success({
      summary: {
        awaitingReceiptCount,
        inQueueCount,
        readyForHandoverCount,
      },
    });
  }

  async getIncomingChallans() {
    const challans = await this.prisma.challan.findMany({
      where: {
        toDepartment: DepartmentCode.FINAL_QC,
        status: { in: ['ISSUED', 'RECEIVED'] },
      },
      include: {
        program: {
          select: {
            id: true,
            programNumber: true,
            styleCode: true,
            designName: true,
          },
        },
        items: true,
      },
      orderBy: { issuedDate: 'desc' },
    });

    return this.success(challans);
  }

  async getQueue() {
    const challans = await this.prisma.challan.findMany({
      where: {
        toDepartment: DepartmentCode.FINAL_QC,
        status: { in: ['RECEIVED', 'IN_PROCESS', 'QC_PENDING', 'REWORK', 'ON_HOLD', 'COMPLETED'] },
      },
      include: {
        program: {
          select: {
            id: true,
            programNumber: true,
            styleCode: true,
          },
        },
        items: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return this.success(challans);
  }

  async getJobById(id: string) {
    const challan = await this.prisma.challan.findUnique({
      where: { id },
      include: {
        program: {
          select: {
            id: true,
            programNumber: true,
            styleCode: true,
            designName: true,
            buyerName: true,
          },
        },
        items: true,
        events: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });

    if (!challan) {
      throw new NotFoundException(`Final QC job '${id}' not found`);
    }

    return this.success({
      id: challan.id,
      challanNumber: challan.challanNumber,
      status: challan.status,
      fromDepartment: challan.fromDepartment,
      toDepartment: challan.toDepartment,
      priority: challan.priority,
      programId: challan.programId,
      parentChallanId: challan.parentChallanId,
      remarks: challan.remarks,
      issuedDate: challan.issuedDate,
      receivedDate: challan.receivedDate,
      completedDate: challan.completedDate,
      fabricIn: challan.fabricIn,
      fabricOut: challan.fabricOut,
      program: challan.program,
      items: challan.items,
      events: challan.events,
    });
  }

  async receiveChallan(id: string, body: { receivedQuantity?: number }) {
    const challan = await this.prisma.challan.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!challan) {
      throw new NotFoundException(`Challan '${id}' not found`);
    }

    const issuedQty = challan.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const requestedQty = Number(body?.receivedQuantity ?? issuedQty);

    if (challan.status === 'RECEIVED') {
      throw new BadRequestException('Challan already received into Final QC');
    }

    if (requestedQty > issuedQty) {
      throw new BadRequestException('Received quantity exceeds the issued quantity for this challan');
    }

    const updated = await this.prisma.challan.update({
      where: { id },
      data: {
        status: 'RECEIVED',
        receivedDate: new Date(),
        fabricIn: requestedQty,
        remarks: `${challan.remarks || ''} | Final QC receipt confirmed: ${requestedQty} pcs received.`.trim(),
      },
    });

    await this.prisma.challanEvent.create({
      data: {
        challanId: id,
        fromStatus: challan.status,
        toStatus: 'RECEIVED',
        action: 'RECEIVED_BY_FINAL_QC',
        actorId: (await this.getFinalQCUser())?.id || 'system',
        notes: `Final QC received ${requestedQty} units against challan ${challan.challanNumber}.`,
      },
    });

    return this.success({
      challanId: updated.id,
      challanNumber: updated.challanNumber,
      status: updated.status,
      receivedQuantity: requestedQty,
    });
  }

  async inspectJob(id: string, payload: Record<string, any>) {
    const challan = await this.prisma.challan.findUnique({ where: { id } });
    if (!challan) {
      throw new NotFoundException(`Job '${id}' not found`);
    }

    const inputQuantity = Number(payload?.inputQuantity ?? 0);
    const acceptedQuantity = Number(payload?.acceptedQuantity ?? 0);
    const reworkQuantity = Number(payload?.reworkQuantity ?? 0);
    const rejectedQuantity = Number(payload?.rejectedQuantity ?? 0);
    const pendingQuantity = Number(payload?.pendingQuantity ?? 0);

    const total = acceptedQuantity + reworkQuantity + rejectedQuantity + pendingQuantity;
    if (inputQuantity !== total) {
      throw new BadRequestException(
        `Reconciliation mismatch: ${acceptedQuantity} + ${reworkQuantity} + ${rejectedQuantity} + ${pendingQuantity} = ${total} does not equal input ${inputQuantity}`,
      );
    }

    const nextStatus = pendingQuantity > 0 ? 'QC_PENDING' : 'COMPLETED';
    const updated = await this.prisma.challan.update({
      where: { id },
      data: {
        status: nextStatus,
        completedDate: nextStatus === 'COMPLETED' ? new Date() : null,
        fabricOut: acceptedQuantity,
        remarks: `${challan.remarks || ''} | Final QC result: accepted ${acceptedQuantity}, rework ${reworkQuantity}, rejected ${rejectedQuantity}, pending ${pendingQuantity}.`.trim(),
      },
    });

    await this.prisma.challanEvent.create({
      data: {
        challanId: id,
        fromStatus: challan.status,
        toStatus: nextStatus,
        action: 'FINAL_QC_INSPECTION',
        actorId: (await this.getFinalQCUser())?.id || 'system',
        notes: `Final QC inspection reconciled: accepted=${acceptedQuantity}, rework=${reworkQuantity}, rejected=${rejectedQuantity}, pending=${pendingQuantity}.`,
      },
    });

    return this.success({
      challanId: updated.id,
      challanNumber: updated.challanNumber,
      status: updated.status,
      acceptedQuantity,
      reworkQuantity,
      rejectedQuantity,
      pendingQuantity,
    });
  }

  async holdJob(id: string, body: { reason?: string }) {
    const challan = await this.prisma.challan.findUnique({ where: { id } });
    if (!challan) {
      throw new NotFoundException(`Job '${id}' not found`);
    }

    if (!['RECEIVED', 'IN_PROCESS', 'QC_PENDING', 'REWORK'].includes(challan.status)) {
      throw new BadRequestException(`Final QC job '${challan.challanNumber}' cannot be put on hold from status '${challan.status}'`);
    }

    const updated = await this.prisma.challan.update({
      where: { id },
      data: { status: 'ON_HOLD', remarks: `${challan.remarks || ''} | Hold placed: ${body?.reason || 'Supervisor hold'} `.trim() },
    });

    await this.prisma.challanEvent.create({
      data: {
        challanId: id,
        fromStatus: challan.status,
        toStatus: 'ON_HOLD',
        action: 'FINAL_QC_HOLD',
        actorId: (await this.getFinalQCUser())?.id || 'system',
        reason: body?.reason || 'Supervisor hold',
      },
    });

    return this.success({
      challanId: updated.id,
      challanNumber: updated.challanNumber,
      status: updated.status,
    });
  }

  async issueChallan(payload: any) {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Request body is required');
    }

    if (!payload.parentChallanId) {
      throw new BadRequestException('parentChallanId is required to issue a final QC handoff challan');
    }

    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      throw new BadRequestException('items array is required and must contain at least one item');
    }

    const parentChallan = await this.prisma.challan.findUnique({
      where: { id: payload.parentChallanId },
      include: { program: true },
    });

    if (!parentChallan) {
      throw new NotFoundException(`Parent challan '${payload.parentChallanId}' not found`);
    }

    const user = await this.getFinalQCUser();
    const totalQty = payload.items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
    // The challan number is entered manually by Final QC; never generate one.
    const challanNumber = String(payload.challanNumber || '').trim();
    if (!challanNumber) {
      throw new BadRequestException('Challan Number is required. Enter the challan number manually.');
    }
    const duplicate = await this.prisma.challan.findFirst({
      where: { challanNumber: { equals: challanNumber, mode: 'insensitive' } },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException(`Challan Number '${challanNumber}' already exists. Enter a different challan number.`);
    }

    const created = await this.prisma.challan.create({
      data: {
        challanNumber,
        challanType: 'INTER_DEPARTMENT',
        programId: parentChallan.programId,
        parentChallanId: parentChallan.id,
        fromDepartment: DepartmentCode.FINAL_QC,
        toDepartment: payload.toDepartment || 'PACKING',
        status: 'ISSUED',
        priority: payload.priority || 'NORMAL',
        issuedDate: new Date(),
        createdById: user?.id || 'system',
        issuedById: user?.id || 'system',
        fabricIn: totalQty,
        fabricOut: totalQty,
        remarks: payload.remarks || `Final QC issued goods to ${payload.toDepartment || 'PACKING'}`,
        items: {
          create: payload.items.map((item: any) => ({
            itemDescription: item.itemDescription || 'Final QC / Packed Output',
            fabricCode: item.fabricCode || 'GARMENT',
            colour: item.colour || 'STANDARD',
            quantity: Number(item.quantity || 0),
            uom: item.uom || 'PCS',
            unitType: item.unitType || 'PCS',
            barcode: item.barcode || `BC-FQC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            remarks: item.remarks || 'Issued after final QC approval',
          })),
        },
      },
      include: { items: true },
    });

    return this.success({
      id: created.id,
      challanNumber: created.challanNumber,
      status: created.status,
      items: created.items,
    });
  }

  async getFloorBoard() {
    const challans = await this.prisma.challan.findMany({
      where: { toDepartment: DepartmentCode.FINAL_QC },
      select: {
        id: true,
        challanNumber: true,
        status: true,
        fromDepartment: true,
        toDepartment: true,
        programId: true,
        remarks: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const lanes = {
      PENDING: challans.filter((c) => ['ISSUED', 'RECEIVED'].includes(c.status)),
      IN_INSPECTION: challans.filter((c) => ['IN_PROCESS', 'QC_PENDING', 'REWORK', 'ON_HOLD'].includes(c.status)),
      COMPLETED: challans.filter((c) => ['COMPLETED', 'QC_APPROVED'].includes(c.status)),
      HANDED_OVER: challans.filter((c) => ['HANDED_OVER', 'CLOSED'].includes(c.status)),
    };

    return this.success({ lanes });
  }

  async getReports(days = 30) {
    const periodDays = Number(days) || 30;
    const [totalInput, totalAccepted, totalDefectRecords, totalTransactions] = await Promise.all([
      this.prisma.productionTransaction.aggregate({
        where: { departmentCode: DepartmentCode.FINAL_QC },
        _sum: { inputQuantity: true },
      }),
      this.prisma.productionTransaction.aggregate({
        where: { departmentCode: DepartmentCode.FINAL_QC },
        _sum: { goodQuantity: true },
      }),
      this.prisma.defectRecord.count({
        where: { departmentCode: DepartmentCode.FINAL_QC },
      }),
      this.prisma.productionTransaction.count({
        where: { departmentCode: DepartmentCode.FINAL_QC },
      }),
    ]);

    const input = Number(totalInput._sum.inputQuantity || 0);
    const accepted = Number(totalAccepted._sum.goodQuantity || 0);
    const firstPassYield = input > 0 ? Number(((accepted / input) * 100).toFixed(2)) : 0;

    const defectPareto = await this.prisma.defectRecord.groupBy({
      by: ['reason'],
      where: { departmentCode: DepartmentCode.FINAL_QC },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    return this.success({
      summary: {
        periodDays,
        totalInput: input,
        totalAccepted: accepted,
        firstPassYield,
        totalDefectRecords: totalDefectRecords,
        totalTransactions,
      },
      defectPareto: defectPareto.map((entry) => ({
        category: entry.reason,
        count: entry._count.id,
      })),
    });
  }
}
