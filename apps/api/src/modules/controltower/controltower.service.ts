import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class ControlTowerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Executive Control Tower: High-level plant KPIs, stage progress, delivery risks
   */
  async getExecutiveControlTower() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalProgramsCount,
      activePrograms,
      todayProductions,
      allChallans,
      qcHolds,
      openDefects,
      reworkTx,
      fgCartons,
      dispatches,
      departments,
    ] = await Promise.all([
      this.prisma.program.count(),
      this.prisma.program.findMany({
        where: { status: { in: ['APPROVED', 'IN_PRODUCTION'] } },
      }),
      this.prisma.productionTransaction.findMany({
        where: { recordedAt: { gte: today } },
      }),
      this.prisma.challan.findMany({
        include: { items: true },
      }),
      this.prisma.qualityInspection.count({
        where: { status: { in: ['PENDING', 'ON_HOLD', 'FAILED'] } },
      }),
      this.prisma.defectRecord.count({
        where: { status: { in: ['OPEN', 'UNDER_REVIEW', 'REWORK'] } },
      }),
      this.prisma.reworkTransaction.count({
        where: { status: 'IN_PROGRESS' },
      }),
      this.prisma.carton.aggregate({
        where: { status: 'IN_FG_STORE' },
        _sum: { quantity: true },
      }),
      this.prisma.dispatchOrder.aggregate({
        where: { status: 'DISPATCHED' },
        _sum: { totalQuantity: true },
      }),
      this.prisma.department.findMany({ orderBy: { sequenceOrder: 'asc' } }),
    ]);

    const productionToday = todayProductions.reduce((sum, p) => sum + p.goodQuantity, 0);
    const rejectsToday = todayProductions.reduce((sum, p) => sum + p.rejectQuantity, 0);

    // Calculate Active WIP (Challans currently active)
    const activeChallans = allChallans.filter((c) =>
      ['SUBMITTED', 'ISSUED', 'RECEIVED', 'IN_PROGRESS'].includes(c.status),
    );
    const totalWipUnits = activeChallans.reduce(
      (sum, c) => sum + c.items.reduce((acc, i) => acc + i.quantity, 0),
      0,
    );

    let delayedProgramsCount = 0;
    const nowTime = Date.now();
    for (const prog of activePrograms) {
      if (prog.deliveryDate && new Date(prog.deliveryDate).getTime() < nowTime) {
        delayedProgramsCount += 1;
      }
    }

    const departmentLoad = departments.map((dept) => {
      const deptChallans = activeChallans.filter(
        (c) => c.toDepartment === dept.code || c.fromDepartment === dept.code,
      );
      const totalUnits = deptChallans.reduce(
        (sum, c) => sum + c.items.reduce((acc, i) => acc + i.quantity, 0),
        0,
      );
      return {
        departmentCode: dept.code,
        departmentName: dept.name,
        activeChallansCount: deptChallans.length,
        wipQuantity: totalUnits,
      };
    });

    return {
      kpis: {
        totalPrograms: totalProgramsCount,
        activePrograms: activePrograms.length,
        delayedPrograms: delayedProgramsCount,
        productionToday,
        rejectsToday,
        wipQuantity: totalWipUnits,
        qcHolds,
        activeReworks: reworkTx,
        openDefects,
        finishedGoodsQuantity: fgCartons._sum.quantity || 0,
        dispatchedQuantity: dispatches._sum.totalQuantity || 0,
      },
      departmentProgress: departmentLoad,
    };
  }

  /**
   * Smart Floor Board: Real-time cards with auto-anomaly detection
   */
  async getSmartFloorBoard() {
    const challans = await this.prisma.challan.findMany({
      where: {
        status: { in: ['SUBMITTED', 'ISSUED', 'RECEIVED', 'IN_PROGRESS', 'COMPLETED'] },
      },
      include: {
        program: { include: { customer: true } },
        items: true,
        events: { orderBy: { createdAt: 'desc' }, take: 1 },
        inspections: true,
        productionLogs: { include: { operator: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const now = Date.now();

    const cards = challans.map((c) => {
      const lastEvent = c.events[0];
      const startedAt = lastEvent ? lastEvent.createdAt : c.createdAt;
      const elapsedMinutes = Math.floor((now - new Date(startedAt).getTime()) / (1000 * 60));
      const challanQty = c.items.reduce((s, i) => s + i.quantity, 0);
      const expectedDurationMinutes = Math.max(30, Math.ceil(challanQty * 0.1));

      const anomalyFlags: string[] = [];

      if (['ISSUED', 'IN_PROGRESS'].includes(c.status) && elapsedMinutes > 120) {
        anomalyFlags.push('STALL');
      }

      if (c.status === 'IN_PROGRESS' && elapsedMinutes > expectedDurationMinutes) {
        anomalyFlags.push('DELAY');
      }

      const hasQcHold = c.inspections.some((i) => ['FAILED', 'ON_HOLD', 'PENDING'].includes(i.status));
      if (hasQcHold || c.status === 'QC_PENDING') {
        anomalyFlags.push('QC_HOLD');
      }

      if (c.status === 'COMPLETED' && elapsedMinutes > 60) {
        anomalyFlags.push('OVERDUE_HANDOFF');
      }

      let totalGood = 0;
      let totalRework = 0;
      let totalReject = 0;
      let totalWaste = 0;
      let totalBalance = 0;
      for (const pt of c.productionLogs) {
        totalGood += pt.goodQuantity;
        totalRework += pt.reworkQuantity;
        totalReject += pt.rejectQuantity;
        totalWaste += pt.wasteQuantity;
        totalBalance += pt.balanceQuantity;
      }
      if (
        c.productionLogs.length > 0 &&
        challanQty !== totalGood + totalRework + totalReject + totalWaste + totalBalance
      ) {
        anomalyFlags.push('UNACCOUNTED_QTY');
      }

      const operatorName = c.productionLogs[0]?.operator?.fullName || 'Assigned Team';

      return {
        id: c.id,
        challanNumber: c.challanNumber,
        programNumber: c.program.programNumber,
        designName: c.program.designName || c.program.styleCode || 'Standard Style',
        customerName: c.program.customer?.name || c.program.buyerName || 'Domestic Client',
        fromDepartment: c.fromDepartment,
        toDepartment: c.toDepartment,
        operation: c.challanType.replace(/_/g, ' '),
        quantity: challanQty,
        status: c.status,
        startedAt: startedAt.toISOString(),
        elapsedMinutes,
        expectedDurationMinutes,
        operator: operatorName,
        anomalyFlags,
      };
    });

    return cards;
  }
}
