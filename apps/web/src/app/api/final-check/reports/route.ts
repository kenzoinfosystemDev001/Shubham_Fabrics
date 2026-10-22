import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

const FINAL_CHECK_DEPTS = ['FINAL_CHECK', 'FINAL CHECK', 'FINAL_QC', 'FINAL-CHECK'];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedDays = Number.parseInt(searchParams.get('days') || '30', 10);
    const days = Number.isFinite(requestedDays) ? Math.min(365, Math.max(1, requestedDays)) : 30;

    const since = new Date();
    since.setDate(since.getDate() - days);

    const transactionWhere = {
      departmentCode: { in: FINAL_CHECK_DEPTS },
      recordedAt: { gte: since },
    };
    const defectWhere = {
      departmentCode: { in: FINAL_CHECK_DEPTS },
      createdAt: { gte: since },
    };
    const challanWhere = {
      toDepartment: { in: FINAL_CHECK_DEPTS },
      createdAt: { gte: since },
    };

    const [transactions, defectRecords, transactionTotals, defectCount, challanCount, defectGroups] = await Promise.all([
      prisma.productionTransaction.findMany({
        where: transactionWhere,
        include: {
          program: {
            select: {
              programNumber: true,
              styleCode: true,
              clientName: true,
              designNumber: true,
              wilcomDesignNumber: true,
            },
          },
          operator: { select: { fullName: true, username: true } },
          challan: { select: { challanNumber: true } },
        },
        orderBy: { recordedAt: 'desc' },
        take: 200,
      }),
      prisma.defectRecord.findMany({
        where: defectWhere,
        include: {
          program: { select: { programNumber: true, styleCode: true } },
          detectedBy: { select: { fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.productionTransaction.aggregate({
        where: transactionWhere,
        _sum: {
          inputQuantity: true,
          goodQuantity: true,
          reworkQuantity: true,
          rejectQuantity: true,
        },
        _count: { id: true },
      }),
      prisma.defectRecord.count({ where: defectWhere }),
      prisma.challan.count({ where: challanWhere }),
      prisma.defectRecord.groupBy({
        by: ['reason'],
        where: defectWhere,
        _sum: { quantity: true },
        _count: { _all: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
      }),
    ]);

    // Aggregate quantity metrics
    const totalInput = Number(transactionTotals._sum.inputQuantity || 0);
    const totalAccepted = Number(transactionTotals._sum.goodQuantity || 0);
    const totalRework = Number(transactionTotals._sum.reworkQuantity || 0);
    const totalRejected = Number(transactionTotals._sum.rejectQuantity || 0);
    const firstPassYield =
      totalInput > 0 ? ((totalAccepted / totalInput) * 100).toFixed(1) : '100.0';

    const defectPareto = defectGroups.map((entry) => ({
      reason: entry.reason || 'Unknown Defect',
      count: Number(entry._sum.quantity || entry._count._all || 0),
    }));

    // Style-wise breakdown
    const styleMap: Record<string, { input: number; accepted: number; rework: number; rejected: number }> = {};
    transactions.forEach((tx) => {
      const style = tx.program?.styleCode || 'Unknown';
      if (!styleMap[style]) styleMap[style] = { input: 0, accepted: 0, rework: 0, rejected: 0 };
      styleMap[style].input += Number(tx.inputQuantity) || 0;
      styleMap[style].accepted += Number(tx.goodQuantity) || 0;
      styleMap[style].rework += Number(tx.reworkQuantity) || 0;
      styleMap[style].rejected += Number(tx.rejectQuantity) || 0;
    });

    const styleWiseMetrics = Object.entries(styleMap)
      .map(([style, metrics]) => ({
        style,
        ...metrics,
        yield:
          metrics.input > 0
            ? ((metrics.accepted / metrics.input) * 100).toFixed(1)
            : '100.0',
      }))
      .sort((a, b) => b.input - a.input)
      .slice(0, 15);

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalInput,
          totalAccepted,
          totalRework,
          totalRejected,
          firstPassYield,
          totalTransactions: transactionTotals._count.id,
          totalDefectRecords: defectCount,
          totalChallans: challanCount,
          periodDays: days,
        },
        defectPareto,
        styleWiseMetrics,
        transactions: transactions.slice(0, 50),
        defectRecords: defectRecords.slice(0, 30),
      },
    });
  } catch (error: any) {
    console.error('Error fetching Final QC reports:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch Final QC reports' },
      { status: 500 }
    );
  }
}
