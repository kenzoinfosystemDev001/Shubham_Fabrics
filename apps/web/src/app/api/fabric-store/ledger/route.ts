import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

// GET /api/fabric-store/ledger
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rollId = searchParams.get('rollId');
    const batchId = searchParams.get('batchId');
    const transactionType = searchParams.get('transactionType');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (rollId) where.rollId = rollId;
    if (batchId) where.batchId = batchId;
    if (transactionType) where.transactionType = transactionType;
    if (from || to) {
      where.transactedAt = {};
      if (from) where.transactedAt.gte = new Date(from);
      if (to) where.transactedAt.lte = new Date(to);
    }

    const [entries, total] = await Promise.all([
      prisma.fabricStockLedger.findMany({
        where,
        include: {
          roll: { select: { rollNumber: true } },
          batch: { select: { batchNumber: true, fabricDescription: true } },
          fromLocation: { select: { locationCode: true } },
          toLocation: { select: { locationCode: true } },
          transactedBy: { select: { fullName: true } },
        },
        orderBy: { transactedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.fabricStockLedger.count({ where }),
    ]);

    return NextResponse.json({
      data: entries,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
