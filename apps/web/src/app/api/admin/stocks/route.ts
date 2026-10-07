import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [rolls, batches, totalStockAggr] = await Promise.all([
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
    ]);

    const formattedRolls = rolls.map((r) => ({
      id: r.id,
      barcode: r.rollNumber,
      batchNumber: r.batch?.batchNumber || '—',
      fabricName: r.batch?.fabricDescription || 'Standard Knit',
      color: r.batch?.colorName || 'Natural',
      lengthMeters: Number(r.length || 0),
      netWeightKg: Number(r.weight || 0),
      status: r.status,
      qcStatus: r.qcStatus,
    }));

    return NextResponse.json({
      summary: {
        totalRolls: totalStockAggr._count?._all || 0,
        totalMeters: Number(totalStockAggr._sum?.length || 0),
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
