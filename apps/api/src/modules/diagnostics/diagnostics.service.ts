import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class DiagnosticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Run automated database consistency integrity checks across 6 manufacturing checkpoints
   */
  async runIntegrityCheck() {
    const issues: any[] = [];

    // 1. Check for Negative Stock in Ledger
    const negativeStockEntries = await this.prisma.stockLedgerEntry.findMany({
      where: { balanceAfter: { lt: 0 } },
    });
    if (negativeStockEntries.length > 0) {
      issues.push({
        check: 'NEGATIVE_STOCK',
        severity: 'CRITICAL',
        message: `Found ${negativeStockEntries.length} stock ledger entries with negative balance!`,
        items: negativeStockEntries.map((e) => ({
          id: e.id,
          itemCode: e.itemCode,
          department: e.departmentCode,
          balanceAfter: e.balanceAfter,
        })),
      });
    }

    // 2. Check for Production Conservation of Mass Identity (Input = Good + Rework + Reject + Waste + Balance)
    const productionTransactions = await this.prisma.productionTransaction.findMany();
    const mathematicallyInconsistent: any[] = [];
    for (const pt of productionTransactions) {
      const sum =
        pt.goodQuantity +
        pt.reworkQuantity +
        pt.rejectQuantity +
        pt.wasteQuantity +
        pt.balanceQuantity;
      if (pt.inputQuantity !== sum) {
        mathematicallyInconsistent.push({
          id: pt.id,
          input: pt.inputQuantity,
          sum,
          variance: pt.inputQuantity - sum,
        });
      }
    }
    if (mathematicallyInconsistent.length > 0) {
      issues.push({
        check: 'PRODUCTION_QUANTITY_MISMATCH',
        severity: 'CRITICAL',
        message: `Found ${mathematicallyInconsistent.length} production transactions violating the conservation of mass identity!`,
        items: mathematicallyInconsistent,
      });
    }

    // 3. Check for Orphan Challans (Missing Program relationship)
    const orphanChallans = await this.prisma.challan.findMany({
      where: {
        programId: { equals: '' },
      },
    });
    if (orphanChallans.length > 0) {
      issues.push({
        check: 'ORPHAN_CHALLANS',
        severity: 'MAJOR',
        message: `Found ${orphanChallans.length} challans missing valid program relationships.`,
        items: orphanChallans.map((c) => c.id),
      });
    }

    // 4. Check for Orphan Bundles
    const orphanBundles = await this.prisma.bundle.findMany({
      where: { programId: { equals: '' } },
    });
    if (orphanBundles.length > 0) {
      issues.push({
        check: 'ORPHAN_BUNDLES',
        severity: 'MAJOR',
        message: `Found ${orphanBundles.length} bundles not linked to any program.`,
        items: orphanBundles.map((b) => b.id),
      });
    }

    // 5. Check for Double Carton Allocation in Dispatches
    const duplicateCartonDispatches = await this.prisma.$queryRaw<any[]>`
      SELECT "cartonId", COUNT(*) as count 
      FROM "DispatchCarton" 
      GROUP BY "cartonId" 
      HAVING COUNT(*) > 1;
    `;
    if (duplicateCartonDispatches && duplicateCartonDispatches.length > 0) {
      issues.push({
        check: 'DUPLICATE_CARTON_DISPATCH',
        severity: 'CRITICAL',
        message: `Found ${duplicateCartonDispatches.length} cartons assigned to more than one dispatch order!`,
        items: duplicateCartonDispatches,
      });
    }

    // 6. Check for Carton Quantity Exceeding Bundle Quantities
    const cartonsWithBundles = await this.prisma.carton.findMany({
      include: { bundles: true },
    });
    const cartonDiscrepancies: any[] = [];
    for (const c of cartonsWithBundles) {
      const bundleSum = c.bundles.reduce((acc, b) => acc + b.quantity, 0);
      if (bundleSum !== c.quantity) {
        cartonDiscrepancies.push({
          cartonNumber: c.cartonNumber,
          cartonQty: c.quantity,
          bundlesTotal: bundleSum,
        });
      }
    }
    if (cartonDiscrepancies.length > 0) {
      issues.push({
        check: 'CARTON_BUNDLE_QUANTITY_MISMATCH',
        severity: 'MAJOR',
        message: `Found ${cartonDiscrepancies.length} cartons where carton quantity does not match the sum of its bundled contents.`,
        items: cartonDiscrepancies,
      });
    }

    const status = issues.length === 0 ? 'CLEAN' : 'ISSUES_DETECTED';

    const scanLog = await this.prisma.integrityScanResult.create({
      data: {
        scanType: 'FULL_AUDIT',
        issuesFound: issues.length,
        status,
        detailsJson: JSON.stringify(issues),
      },
    });

    return {
      scanId: scanLog.id,
      timestamp: scanLog.createdAt,
      status,
      totalIssuesFound: issues.length,
      checksPassed: 6 - issues.length,
      issues,
      summary:
        status === 'CLEAN'
          ? 'All 6 database consistency checks passed with 100% integrity. Factory accounting identity preserved.'
          : 'Integrity scan completed with anomalies. Review details above.',
    };
  }

  async getScanHistory() {
    return this.prisma.integrityScanResult.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }
}
