import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import { requireUser } from '@/lib/auth/require-user';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { user: authUser, response: authResponse } = await requireUser(request, { admin: true });
  if (!authUser) return authResponse;
  try {
    const [rolls, batches, totalStockAggr, mtrStockAggr, pcsStockAggr] = await Promise.all([
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
        _sum: { length: true, weight: true },
        _count: { _all: true },
      }),
      // Each unit is summed on its own; meters are never derived from a mixed total.
      prisma.fabricStoreRoll.aggregate({
        where: { batch: { is: { unit: 'MTR' } } },
        _sum: { length: true },
      }),
      prisma.fabricStoreRoll.aggregate({
        where: { batch: { is: { unit: 'PCS' } } },
        _sum: { length: true },
      }),
    ]);
    const totalPcs = Number(pcsStockAggr._sum?.length || 0);
    const totalMeters = Number(mtrStockAggr._sum?.length || 0);

    const formattedRolls = rolls.map((r) => ({
      id: r.id,
      barcode: r.rollNumber,
      batchNumber: r.batch?.batchNumber || '—',
      fabricName: r.batch?.fabricDescription || 'Standard Knit',
      color: r.batch?.colorName || 'Natural',
      lengthMeters: Number(r.length || 0),
      unit: r.batch?.unit || null,
      netWeightKg: Number(r.weight || 0),
      status: r.status,
      qcStatus: r.qcStatus,
    }));

    return NextResponse.json({
      summary: {
        totalRolls: totalStockAggr._count?._all || 0,
        totalMeters: Number(totalMeters.toFixed(2)),
        totalPcs,
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
