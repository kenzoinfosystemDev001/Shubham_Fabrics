import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

// GET /api/fabric-store/rolls
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const qcStatus = searchParams.get('qcStatus');
    const batchId = searchParams.get('batchId');
    const locationId = searchParams.get('locationId');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (qcStatus) where.qcStatus = qcStatus;
    if (batchId) where.batchId = batchId;
    if (locationId) where.locationId = locationId;

    const [rolls, total] = await Promise.all([
      prisma.fabricStoreRoll.findMany({
        where,
        include: {
          batch: { select: { batchNumber: true, fabricType: true, fabricDescription: true, colorName: true } },
          location: { select: { locationCode: true, locationName: true } },
          qcInspectedBy: { select: { fullName: true } },
          programIssuedTo: { select: { programNumber: true, clientName: true } },
        },
        orderBy: { rollNumber: 'asc' },
        skip,
        take: limit,
      }),
      prisma.fabricStoreRoll.count({ where }),
    ]);

    return NextResponse.json({
      data: rolls,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
