import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

// GET /api/fabric-store/batches/[id]
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const batch = await prisma.fabricBatch.findUnique({
      where: { id },
      include: {
        createdBy: { select: { fullName: true, username: true } },
        program: { select: { programNumber: true, clientName: true, styleCode: true } },
        rolls: {
          include: {
            location: { select: { locationCode: true, locationName: true } },
            qcInspections: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { result: true, inspectedAt: true, remarks: true },
            },
          },
          orderBy: { rollNumber: 'asc' },
        },
        receipts: {
          include: { receivedBy: { select: { fullName: true } } },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { rolls: true, receipts: true } },
      },
    });

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    return NextResponse.json({ data: batch });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/fabric-store/batches/[id]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { fabricType, fabricDescription, colorCode, colorName, status, supplierId } = body;

    const batch = await prisma.fabricBatch.update({
      where: { id },
      data: {
        ...(fabricType && { fabricType }),
        ...(fabricDescription && { fabricDescription }),
        ...(colorCode !== undefined && { colorCode }),
        ...(colorName !== undefined && { colorName }),
        ...(status && { status }),
        ...(supplierId !== undefined && { supplierId }),
      },
    });

    return NextResponse.json({ data: batch });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
