import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalRolls,
      rollsInStock,
      rollsOnHold,
      rollsIssued,
      pendingQC,
      todayReceipts,
      todayIssues,
      recentGRNs,
      recentIssues,
    ] = await Promise.all([
      prisma.fabricStoreRoll.count(),
      prisma.fabricStoreRoll.count({ where: { status: 'IN_STOCK' } }),
      prisma.fabricStoreRoll.count({ where: { status: 'QC_HOLD' } }),
      prisma.fabricStoreRoll.count({ where: { status: 'ISSUED' } }),
      prisma.fabricStoreRoll.count({ where: { qcStatus: 'PENDING' } }),
      prisma.materialReceipt.count({
        where: { receivedAt: { gte: today, lt: tomorrow } },
      }),
      prisma.fabricStockLedger.count({
        where: {
          transactionType: 'ISSUE',
          transactedAt: { gte: today, lt: tomorrow },
        },
      }),
      prisma.materialReceipt.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          batch: { select: { batchNumber: true, fabricType: true, fabricDescription: true } },
          receivedBy: { select: { fullName: true } },
        },
      }),
      prisma.fabricStockLedger.findMany({
        take: 5,
        where: { transactionType: 'ISSUE' },
        orderBy: { transactedAt: 'desc' },
        include: {
          roll: { select: { rollNumber: true } },
          batch: { select: { batchNumber: true, fabricDescription: true } },
          transactedBy: { select: { fullName: true } },
        },
      }),
    ]);

    return NextResponse.json({
      data: {
        kpis: {
          totalRolls,
          rollsInStock,
          rollsOnHold,
          rollsIssued,
          pendingQC,
          todayReceipts,
          todayIssues,
        },
        recentGRNs,
        recentIssues,
      },
    });
  } catch (error: any) {
    console.error('Fabric store dashboard error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
