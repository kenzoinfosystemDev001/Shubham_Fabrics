import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateChallanInput } from '@subham/validation';
import { ChallanStatus, DepartmentCode } from '@subham/types';

@Injectable()
export class ChallansService {
  constructor(private readonly prisma: PrismaService) {}

  async generateNextChallanNumber(deptCode: DepartmentCode): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `CH-${deptCode}-${year}-`;
    const count = await this.prisma.challan.count({
      where: { challanNumber: { startsWith: prefix } },
    });
    const nextSeq = String(count + 1).padStart(6, '0');
    return `${prefix}${nextSeq}`;
  }

  async findAll(params?: {
    fromDepartment?: string;
    toDepartment?: string;
    department?: string;
    status?: string;
    programId?: string;
  }) {
    const where: any = {};
    if (params?.department) {
      where.OR = [
        { fromDepartment: params.department },
        { toDepartment: params.department },
      ];
    }
    if (params?.fromDepartment) where.fromDepartment = params.fromDepartment;
    if (params?.toDepartment) where.toDepartment = params.toDepartment;
    if (params?.status) where.status = params.status;
    if (params?.programId) where.programId = params.programId;

    return this.prisma.challan.findMany({
      where,
      include: {
        program: {
          select: {
            id: true,
            programNumber: true,
            buyer: true,
            styleCode: true,
            orderNumber: true,
            designName: true,
          },
        },
        fromDeptRel: true,
        toDeptRel: true,
        createdBy: { select: { id: true, username: true, fullName: true } },
        issuedBy: { select: { id: true, username: true, fullName: true } },
        receivedBy: { select: { id: true, username: true, fullName: true } },
        approvedBy: { select: { id: true, username: true, fullName: true } },
        items: true,
        _count: { select: { productionLogs: true, inspections: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const challan = await this.prisma.challan.findUnique({
      where: { id },
      include: {
        program: {
          include: {
            fabrics: true,
            routeSteps: { orderBy: { sequenceOrder: 'asc' } },
          },
        },
        fromDeptRel: true,
        toDeptRel: true,
        parentChallan: {
          include: {
            items: true,
            fromDeptRel: true,
            toDeptRel: true,
          },
        },
        childChallans: {
          include: {
            items: true,
            fromDeptRel: true,
            toDeptRel: true,
          },
        },
        items: true,
        createdBy: { select: { id: true, username: true, fullName: true } },
        issuedBy: { select: { id: true, username: true, fullName: true } },
        receivedBy: { select: { id: true, username: true, fullName: true } },
        approvedBy: { select: { id: true, username: true, fullName: true } },
        productionLogs: {
          include: {
            operator: { select: { username: true, fullName: true } },
          },
          orderBy: { recordedAt: 'desc' },
        },
        inspections: {
          include: {
            defects: true,
            inspector: { select: { username: true, fullName: true } },
          },
          orderBy: { inspectedAt: 'desc' },
        },
      },
    });

    if (!challan) {
      throw new NotFoundException(`Challan with ID '${id}' not found`);
    }

    return challan;
  }

  async create(data: CreateChallanInput, actorId: string) {
    const existing = await this.prisma.challan.findUnique({
      where: { challanNumber: data.challanNumber },
    });
    if (existing) {
      throw new BadRequestException(`Challan number '${data.challanNumber}' already exists`);
    }

    const program = await this.prisma.program.findUnique({
      where: { id: data.programId },
    });
    if (!program) {
      throw new NotFoundException(`Program '${data.programId}' not found`);
    }

    const challan = await this.prisma.$transaction(async (tx) => {
      const created = await tx.challan.create({
        data: {
          challanNumber: data.challanNumber,
          challanType: data.challanType,
          programId: data.programId,
          parentChallanId: data.parentChallanId || null,
          fromDepartment: data.fromDepartment,
          toDepartment: data.toDepartment,
          status: ChallanStatus.DRAFT,
          priority: data.priority,
          remarks: data.remarks || null,
          createdById: actorId,

          items: {
            create: data.items.map((it) => ({
              itemDescription: it.itemDescription,
              fabricCode: it.fabricCode || null,
              colour: it.colour || null,
              shade: it.shade || null,
              size: it.size || null,
              unitType: it.unitType,
              rollNumber: it.rollNumber || null,
              lotNumber: it.lotNumber || null,
              bundleNumber: it.bundleNumber || null,
              barcode: it.barcode || null,
              quantity: it.quantity,
              grossWeightKg: it.grossWeightKg || null,
              netWeightKg: it.netWeightKg || null,
              uom: it.uom,
              remarks: it.remarks || null,
              sourceLotId: it.sourceLotId || null,
              sourceRollId: it.sourceRollId || null,
              sourceBundleId: it.sourceBundleId || null,
            })),
          },
        },
        include: {
          items: true,
          fromDeptRel: true,
          toDeptRel: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'CHALLAN_CREATED',
          entity: 'Challan',
          entityId: created.id,
          afterState: JSON.stringify({
            challanNumber: created.challanNumber,
            from: created.fromDepartment,
            to: created.toDepartment,
            itemCount: data.items.length,
          }),
        },
      });

      return created;
    });

    return challan;
  }

  async transitionStatus(
    id: string,
    newStatus: ChallanStatus,
    actorId: string,
    notes?: string,
  ) {
    const challan = await this.findOne(id);

    // Validate legal transitions
    const validTransitions: Record<string, string[]> = {
      [ChallanStatus.DRAFT]: [ChallanStatus.SUBMITTED, ChallanStatus.CANCELLED],
      [ChallanStatus.SUBMITTED]: [ChallanStatus.ISSUED, ChallanStatus.CANCELLED, ChallanStatus.DRAFT],
      [ChallanStatus.ISSUED]: [ChallanStatus.RECEIVED, ChallanStatus.CANCELLED, ChallanStatus.ON_HOLD],
      [ChallanStatus.RECEIVED]: [ChallanStatus.IN_PROCESS, ChallanStatus.ON_HOLD, ChallanStatus.REJECTED],
      [ChallanStatus.IN_PROCESS]: [ChallanStatus.COMPLETED, ChallanStatus.QC_PENDING, ChallanStatus.REWORK, ChallanStatus.ON_HOLD],
      [ChallanStatus.COMPLETED]: [ChallanStatus.QC_PENDING, ChallanStatus.HANDED_OVER, ChallanStatus.CLOSED],
      [ChallanStatus.QC_PENDING]: [ChallanStatus.QC_APPROVED, ChallanStatus.REWORK, ChallanStatus.REJECTED],
      [ChallanStatus.QC_APPROVED]: [ChallanStatus.HANDED_OVER, ChallanStatus.CLOSED],
      [ChallanStatus.REWORK]: [ChallanStatus.IN_PROCESS, ChallanStatus.COMPLETED],
      [ChallanStatus.HANDED_OVER]: [ChallanStatus.CLOSED],
      [ChallanStatus.ON_HOLD]: [ChallanStatus.IN_PROCESS, ChallanStatus.RECEIVED, ChallanStatus.CANCELLED],
    };

    const allowed = validTransitions[challan.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Illegal transition from '${challan.status}' to '${newStatus}'. Allowed transitions: [${allowed.join(', ')}]`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updateData: any = { status: newStatus };
      if (notes) updateData.remarks = `${challan.remarks ? challan.remarks + ' | ' : ''}${notes}`;

      if (newStatus === ChallanStatus.ISSUED) {
        updateData.issuedById = actorId;
        updateData.issuedDate = new Date();
      } else if (newStatus === ChallanStatus.RECEIVED) {
        updateData.receivedById = actorId;
        updateData.receivedDate = new Date();
      } else if (newStatus === ChallanStatus.COMPLETED) {
        updateData.completedDate = new Date();
      } else if (newStatus === ChallanStatus.QC_APPROVED) {
        updateData.approvedById = actorId;
      }

      const res = await tx.challan.update({
        where: { id },
        data: updateData,
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: `CHALLAN_${newStatus}`,
          entity: 'Challan',
          entityId: id,
          beforeState: JSON.stringify({ status: challan.status }),
          afterState: JSON.stringify({ status: newStatus, notes }),
        },
      });

      return res;
    });

    return updated;
  }

  async getGenealogy(id: string) {
    const root = await this.findOne(id);
    const ancestors: any[] = [];
    let current = root;

    while (current.parentChallanId) {
      const parent = await this.prisma.challan.findUnique({
        where: { id: current.parentChallanId },
        include: {
          items: true,
          fromDeptRel: true,
          toDeptRel: true,
        },
      });
      if (!parent) break;
      ancestors.unshift(parent);
      current = parent as any;
    }

    const descendants = await this.prisma.challan.findMany({
      where: { parentChallanId: id },
      include: {
        items: true,
        fromDeptRel: true,
        toDeptRel: true,
      },
    });

    return {
      currentChallan: root,
      ancestors,
      descendants,
    };
  }
}
