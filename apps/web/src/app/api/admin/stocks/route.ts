import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireUser } from '@/lib/auth/require-user';
import { addToUnitTotals, unitTotals } from '@/lib/fabric-stock';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { user: authUser, response: authResponse } = await requireUser(request, { admin: true });
  if (!authUser) return authResponse;
  try {
    const [rolls, batches, totalStockAggr, quantityByUnit] = await Promise.all([
      prisma.fabricStoreRoll.findMany({
        take: 100,
        include: {
          batch: true,
          location: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.fabricBatch.findMany({
        take: 50,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.fabricStoreRoll.aggregate({
        _sum: { weight: true },
        _count: { _all: true },
      }),
      // Roll quantities per unit: meters and pieces are never added together.
      prisma.fabricStoreRoll.groupBy({ by: ['unit'], _sum: { length: true } }),
    ]);
    const totalsByUnit = unitTotals();
    for (const row of quantityByUnit) addToUnitTotals(totalsByUnit, row.unit, Number(row._sum.length || 0));

    const formattedRolls = rolls.map((r) => ({
      id: r.id,
      barcode: r.rollNumber,
      batchNumber: r.batch?.batchNumber || '—',
      fabricName: r.batch?.fabricDescription || 'Standard Knit',
      color: r.batch?.colorName || 'Natural',
      quantity: Number(r.length || 0),
      unit: r.unit,
      netWeightKg: Number(r.weight || 0),
      status: r.status,
      qcStatus: r.qcStatus,
    }));

    return NextResponse.json({
      summary: {
        totalRolls: totalStockAggr._count?._all || 0,
        totalsByUnit,
        totalWeightKg: Number(totalStockAggr._sum?.weight || 0),
      },
      rolls: formattedRolls,
      batches,
    });
  } catch (error: any) {
    console.error('Error fetching admin stock data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch stocks data' },
      { status: 500 }
    );
  }
}
