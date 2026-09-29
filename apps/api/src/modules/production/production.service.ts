import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { RecordProductionAccountingInput } from '@subham/validation';
import { validateProductionBalance } from '@subham/types';

@Injectable()
export class ProductionService {
  constructor(private readonly prisma: PrismaService) {}

  async recordProduction(data: RecordProductionAccountingInput, actorId: string) {
    // 1. Strict mathematical balance verification
    const balanceCheck = validateProductionBalance({
      inputQuantity: data.inputQuantity,
      goodQuantity: data.goodQuantity,
      reworkQuantity: data.reworkQuantity,
      rejectQuantity: data.rejectQuantity,
      wasteQuantity: data.wasteQuantity,
      balanceQuantity: data.balanceQuantity,
    });

    if (!balanceCheck.isValid) {
      throw new BadRequestException(balanceCheck.error);
    }

    // 2. Validate that Challan and Program exist
    const challan = await this.prisma.challan.findUnique({
      where: { id: data.challanId },
    });
    if (!challan) {
      throw new NotFoundException(`Challan '${data.challanId}' not found`);
    }

    const program = await this.prisma.program.findUnique({
      where: { id: data.programId },
    });
    if (!program) {
      throw new NotFoundException(`Program '${data.programId}' not found`);
    }

    // 3. Save production record, update challan status, and record audit log inside an ACID transaction
    const record = await this.prisma.$transaction(async (tx) => {
      const created = await tx.productionTransaction.create({
        data: {
          programId: data.programId,
          challanId: data.challanId,
          departmentCode: data.departmentCode,
          operationName: data.operationName,
          operatorId: data.operatorId,
          machineId: data.machineId || null,
          shift: data.shift || null,

          inputQuantity: data.inputQuantity,
          goodQuantity: data.goodQuantity,
          reworkQuantity: data.reworkQuantity,
          rejectQuantity: data.rejectQuantity,
          wasteQuantity: data.wasteQuantity,
          balanceQuantity: data.balanceQuantity,
          unitOfMeasure: data.unitOfMeasure,

          reworkReason: data.reworkReason || null,
          rejectReason: data.rejectReason || null,
          wasteReason: data.wasteReason || null,
          notes: data.notes || null,
        },
        include: {
          operator: { select: { username: true, fullName: true } },
          challan: { select: { challanNumber: true } },
        },
      });

      // Advance Challan status if currently IN_PROCESS or RECEIVED
      if (challan.status === 'RECEIVED' || challan.status === 'IN_PROCESS') {
        const nextStatus = data.balanceQuantity > 0 ? 'IN_PROCESS' : 'COMPLETED';
        await tx.challan.update({
          where: { id: challan.id },
          data: { status: nextStatus },
        });
      }

      // Record Audit Event
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'PRODUCTION_RECORDED',
          entity: 'ProductionTransaction',
          entityId: created.id,
          afterState: JSON.stringify({
            department: data.departmentCode,
            input: data.inputQuantity,
            good: data.goodQuantity,
            rework: data.reworkQuantity,
            reject: data.rejectQuantity,
            waste: data.wasteQuantity,
            balance: data.balanceQuantity,
          }),
        },
      });

      return created;
    }, { maxWait: 15000, timeout: 60000 });

    return record;
  }

  async getHistory(params?: {
    programId?: string;
    departmentCode?: string;
    operatorId?: string;
  }) {
    const where: any = {};
    if (params?.programId) where.programId = params.programId;
    if (params?.departmentCode) where.departmentCode = params.departmentCode;
    if (params?.operatorId) where.operatorId = params.operatorId;

    const transactions = await this.prisma.productionTransaction.findMany({
      where,
      include: {
        operator: { select: { id: true, username: true, fullName: true } },
        program: { select: { programNumber: true, styleCode: true, buyerName: true } },
        challan: { select: { challanNumber: true, fromDepartment: true, toDepartment: true } },
      },
      orderBy: { recordedAt: 'desc' },
    });

    return transactions.map((t) => ({
      ...t,
      program: t.program ? { ...t.program, buyer: t.program.buyerName } : null,
    }));
  }
}
