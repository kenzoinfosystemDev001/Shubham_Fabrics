import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics() {
    const [
      totalPrograms,
      activePrograms,
      totalChallans,
      activeChallans,
      productionStats,
      inspections,
      recentAuditLogs,
    ] = await Promise.all([
      this.prisma.program.count(),
      this.prisma.program.count({
        where: { status: { in: ['APPROVED', 'IN_PRODUCTION'] } },
      }),
      this.prisma.challan.count(),
      this.prisma.challan.count({
        where: { status: { in: ['ISSUED', 'RECEIVED', 'IN_PROCESS', 'QC_PENDING', 'REWORK'] } },
      }),
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
      this.prisma.qualityInspection.findMany({
        take: 10,
        orderBy: { inspectedAt: 'desc' },
        include: { defects: true },
      }),
      this.prisma.auditLog.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: { select: { username: true, fullName: true, role: true } },
        },
      }),
    ]);

    const totalInput = productionStats._sum.inputQuantity || 0;
    const totalGood = productionStats._sum.goodQuantity || 0;
    const totalReject = productionStats._sum.rejectQuantity || 0;
    const totalRework = productionStats._sum.reworkQuantity || 0;
    const totalWaste = productionStats._sum.wasteQuantity || 0;

    const rejectionRate = totalInput > 0 ? ((totalReject / totalInput) * 100).toFixed(2) : '0.00';
    const reworkRate = totalInput > 0 ? ((totalRework / totalInput) * 100).toFixed(2) : '0.00';
    const overallYield = totalInput > 0 ? ((totalGood / totalInput) * 100).toFixed(2) : '100.00';

    return {
      kpi: {
        totalPrograms,
        activePrograms,
        totalChallans,
        activeChallans,
        totalInput,
        totalGood,
        totalReject,
        totalRework,
        totalWaste,
        overallYield: `${overallYield}%`,
        rejectionRate: `${rejectionRate}%`,
        reworkRate: `${reworkRate}%`,
      },
      recentInspections: inspections,
      recentActivity: recentAuditLogs,
    };
  }
}
