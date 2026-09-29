import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { FloorBoardGateway } from './floorboard.gateway';
import { ProgramStatus, ChallanStatus } from '@subham/types';

@Injectable()
export class FloorBoardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: FloorBoardGateway,
  ) {}

  /**
   * Aggregates real-time state of the entire factory floor:
   * Active programs, active challans, department WIPs, QC, stalled items, overdue items, unaccounted quantities.
   */
  async getFloorBoardState() {
    // 1. Active Programs
    const activePrograms = await this.prisma.program.findMany({
      where: {
        status: { in: [ProgramStatus.APPROVED, ProgramStatus.IN_PRODUCTION] },
      },
      include: {
        customer: { select: { name: true } },
        routes: { include: { steps: true } },
        bundles: { select: { currentDepartment: true, status: true, quantity: true } },
      },
      orderBy: { deliveryDate: 'asc' },
    });

    // 2. Active Challans
    const activeChallans = await this.prisma.challan.findMany({
      where: {
        status: {
          in: [
            ChallanStatus.ISSUED,
            ChallanStatus.RECEIVED,
            ChallanStatus.IN_PROCESS,
            ChallanStatus.QC_PENDING,
            ChallanStatus.REWORK,
            ChallanStatus.ON_HOLD,
          ],
        },
      },
      include: {
        fromDeptRel: true,
        toDeptRel: true,
        program: { select: { programNumber: true, buyerName: true, styleCode: true } },
        items: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    // 3. Department WIP Aggregation
    const departments = await this.prisma.department.findMany({
      where: { isActive: true },
      orderBy: { sequenceOrder: 'asc' },
    });

    const departmentWip: Record<string, { code: string; name: string; activeChallans: number; activeBundles: number; totalWipPieces: number }> = {};
    for (const d of departments) {
      departmentWip[d.code] = {
        code: d.code,
        name: d.name,
        activeChallans: 0,
        activeBundles: 0,
        totalWipPieces: 0,
      };
    }

    for (const ch of activeChallans) {
      if (departmentWip[ch.toDepartment]) {
        departmentWip[ch.toDepartment].activeChallans += 1;
        const totalQty = ch.items.reduce((sum, it) => sum + it.quantity, 0);
        departmentWip[ch.toDepartment].totalWipPieces += totalQty;
      }
    }

    // 4. Stalled Items (Challans in ON_HOLD or inactive in IN_PROCESS for > 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const stalledChallans = await this.prisma.challan.findMany({
      where: {
        OR: [
          { status: ChallanStatus.ON_HOLD },
          {
            status: ChallanStatus.IN_PROCESS,
            updatedAt: { lt: twentyFourHoursAgo },
          },
        ],
      },
      include: {
        program: { select: { programNumber: true, buyerName: true } },
        fromDeptRel: true,
        toDeptRel: true,
      },
    });

    // 5. Overdue Programs (Delivery date is past or within 48 hours)
    const fortyEightHoursFromNow = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const overduePrograms = await this.prisma.program.findMany({
      where: {
        status: { in: [ProgramStatus.APPROVED, ProgramStatus.IN_PRODUCTION] },
        deliveryDate: { lte: fortyEightHoursFromNow },
      },
      include: {
        customer: { select: { name: true } },
      },
      orderBy: { deliveryDate: 'asc' },
    });

    // 6. QC Queue and Inspection Status
    const qcQueue = await this.prisma.challan.findMany({
      where: {
        status: { in: [ChallanStatus.QC_PENDING, ChallanStatus.REWORK] },
      },
      include: {
        program: { select: { programNumber: true, styleCode: true } },
        items: true,
        inspections: {
          include: { defects: true },
          take: 1,
          orderBy: { inspectedAt: 'desc' },
        },
      },
    });

    // 7. Quantity Accounting & Unaccounted Quantities across production transactions
    const productionTxs = await this.prisma.productionTransaction.findMany();
    let totalFactoryInput = 0;
    let totalFactoryGood = 0;
    let totalFactoryRework = 0;
    let totalFactoryReject = 0;
    let totalFactoryWaste = 0;
    let totalFactoryBalance = 0;

    for (const tx of productionTxs) {
      totalFactoryInput += tx.inputQuantity;
      totalFactoryGood += tx.goodQuantity;
      totalFactoryRework += tx.reworkQuantity;
      totalFactoryReject += tx.rejectQuantity;
      totalFactoryWaste += tx.wasteQuantity;
      totalFactoryBalance += tx.balanceQuantity;
    }

    const unaccountedTotal = totalFactoryInput - (totalFactoryGood + totalFactoryRework + totalFactoryReject + totalFactoryWaste + totalFactoryBalance);

    const state = {
      timestamp: new Date().toISOString(),
      activeProgramsCount: activePrograms.length,
      activePrograms,
      activeChallansCount: activeChallans.length,
      activeChallans,
      departmentWip: Object.values(departmentWip),
      stalledItems: {
        count: stalledChallans.length,
        items: stalledChallans,
      },
      overdueItems: {
        count: overduePrograms.length,
        items: overduePrograms,
      },
      qcQueue: {
        count: qcQueue.length,
        items: qcQueue,
      },
      accounting: {
        totalFactoryInput,
        totalFactoryGood,
        totalFactoryRework,
        totalFactoryReject,
        totalFactoryWaste,
        totalFactoryBalance,
        unaccountedTotal,
        isStrictlyReconciled: Math.abs(unaccountedTotal) < 0.001,
      },
    };

    // Broadcast to WebSocket clients
    this.gateway.broadcastFloorUpdate('floorboard:update', state);

    return state;
  }
}
