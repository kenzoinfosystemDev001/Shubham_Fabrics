import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { getPackingActor } from '@/lib/packing-auth';

export const dynamic = 'force-dynamic';

const PACKING_DEPTS = ['PACKING', 'PACK', 'FOLDING'];

export async function GET(request: Request) {
  try {
    const auth = await getPackingActor(request);
    if (!auth.actor) return auth.response;

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    const since = new Date();
    since.setDate(since.getDate() - days);

    const [transactions, cartons, stockBalances] = await Promise.all([
      prisma.productionTransaction.findMany({
        where: {
          departmentCode: { in: PACKING_DEPTS },
          recordedAt: { gte: since },
        },
        include: {
          program: {
            select: {
              programNumber: true,
              styleCode: true,
              clientName: true,
            },
          },
          operator: { select: { fullName: true, username: true } },
          challan: { select: { challanNumber: true } },
        },
        orderBy: { recordedAt: 'desc' },
        take: 200,
      }),
      prisma.carton.findMany({
        where: {
          createdAt: { gte: since },
        },
        include: {
          program: {
            select: {
              programNumber: true,
              styleCode: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.inventoryStock.findMany({
        where: {
          departmentCode: 'FINISHED_GOODS',
        },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const totalPackedPieces = transactions.reduce(
      (sum, t) => sum + (Number(t.goodQuantity) || 0),
      0
    );
    const totalCartonsCreated = cartons.length;

    // Style-wise breakdown
    const styleMap: Record<string, { totalPcs: number; cartonCount: number }> = {};
    cartons.forEach((c) => {
      const style = c.program?.styleCode || 'Standard';
      if (!styleMap[style]) styleMap[style] = { totalPcs: 0, cartonCount: 0 };
      styleMap[style].totalPcs += Number(c.quantity) || 0;
      styleMap[style].cartonCount += 1;
    });

    const styleBreakdown = Object.entries(styleMap)
      .map(([style, data]) => ({ style, ...data }))
      .sort((a, b) => b.totalPcs - a.totalPcs);

    // Size distribution
    const sizeMap: Record<string, number> = {};
    cartons.forEach((c) => {
      const s = c.size || 'Standard';
      sizeMap[s] = (sizeMap[s] || 0) + (Number(c.quantity) || 0);
    });

    const sizeDistribution = Object.entries(sizeMap)
      .map(([size, quantity]) => ({ size, quantity }))
      .sort((a, b) => b.quantity - a.quantity);

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          periodDays: days,
          totalPackedPieces,
          totalCartonsCreated,
          totalFgStock: stockBalances.reduce((sum, s) => sum + (Number(s.currentQuantity) || 0), 0),
          transactionCount: transactions.length,
        },
        styleBreakdown,
        sizeDistribution,
        recentTransactions: transactions.slice(0, 30),
        recentCartons: cartons.slice(0, 30),
      },
    });
  } catch (error: any) {
    console.error('Error fetching Packing reports:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load Packing reports' },
      { status: 500 }
    );
  }
}
