import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics() {
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const [
      activePrograms,
      programsAwaitingApproval,
      activeProductionPrograms,
      wipChallans,
      qcHolds,
      openRework,
      upcomingDeliveries,
      recentActivity,
      productionStats,
    ] = await Promise.all([
      // Active Programs (Approved or in production)
      this.prisma.program.count({
        where: { status: { in: ['APPROVED', 'IN_PRODUCTION'] } },
      }),
      // Programs Awaiting Approval (Submitted)
      this.prisma.program.count({
        where: { status: 'SUBMITTED' },
      }),
      // Active Production
      this.prisma.program.count({
        where: { status: 'IN_PRODUCTION' },
      }),
      // WIP Challans
      this.prisma.challan.count({
        where: { status: { in: ['RECEIVED', 'IN_PROCESS'] } },
      }),
      // QC Holds
      this.prisma.challan.count({
        where: { status: { in: ['QC_PENDING', 'ON_HOLD'] } },
      }),
      // Open Rework
      this.prisma.challan.count({
        where: { status: 'REWORK' },
      }),
      // Upcoming Deliveries within next 30 days
      this.prisma.program.findMany({
        where: {
          deliveryDate: { gte: now, lte: thirtyDaysFromNow },
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
        select: {
          id: true,
          programNumber: true,
          designName: true,
          buyerName: true,
          styleCode: true,
          targetQuantity: true,
          deliveryDate: true,
          status: true,
          priority: true,
        },
        orderBy: { deliveryDate: 'asc' },
        take: 5,
      }),
      // Recent Audit Trail
      this.prisma.auditLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: { select: { username: true, fullName: true } },
        },
      }),
      // Aggregate Production stats
      this.prisma.productionTransaction.aggregate({
        _sum: {
          inputQuantity: true,
          goodQuantity: true,
          reworkQuantity: true,
          rejectQuantity: true,
          wasteQuantity: true,
        },
        _count: { id: true },
      }),
    ]);

    const totalInput = productionStats._sum.inputQuantity || 0;
    const totalGood = productionStats._sum.goodQuantity || 0;
    const totalReject = productionStats._sum.rejectQuantity || 0;
    const totalRework = productionStats._sum.reworkQuantity || 0;
    const totalWaste = productionStats._sum.wasteQuantity || 0;

    const yieldPct = totalInput > 0 ? ((totalGood / totalInput) * 100).toFixed(1) : '100.0';
    const rejectPct = totalInput > 0 ? ((totalReject / totalInput) * 100).toFixed(1) : '0.0';

    return {
      cards: {
        activePrograms,
        programsAwaitingApproval,
        activeProduction: activeProductionPrograms,
        wipChallans,
        qcHolds,
        openRework,
      },
      productionTotals: {
        totalInput,
        totalGood,
        totalReject,
        totalRework,
        totalWaste,
        yieldPercentage: `${yieldPct}%`,
        rejectionRate: `${rejectPct}%`,
      },
      upcomingDeliveries,
      recentActivity,
      needsAttention: [
        ...(qcHolds > 0 ? [{ type: 'QC_HOLD', message: `${qcHolds} Challan(s) currently awaiting Quality Inspection clearance` }] : []),
        ...(openRework > 0 ? [{ type: 'REWORK', message: `${openRework} Station Challan(s) flagged for rework resolution` }] : []),
        ...(programsAwaitingApproval > 0 ? [{ type: 'APPROVAL', message: `${programsAwaitingApproval} Program File(s) awaiting Production Manager authorization` }] : []),
      ],
    };
  }
}
