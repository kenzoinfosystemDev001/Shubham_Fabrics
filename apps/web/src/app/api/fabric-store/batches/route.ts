import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

// Helper: generate next sequential number like "BATCH-2026-0001"
async function getNextBatchNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `BATCH-${year}-`;
  const latest = await prisma.fabricBatch.findFirst({
    where: { batchNumber: { startsWith: prefix } },
    orderBy: { batchNumber: 'desc' },
  });
  if (!latest) return `${prefix}0001`;
  const lastSeq = parseInt(latest.batchNumber.split('-').pop() || '0', 10);
  return `${prefix}${String(lastSeq + 1).padStart(4, '0')}`;
}

// GET /api/fabric-store/batches
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const programId = searchParams.get('programId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const where: any = {};
    if (status) where.status = status;
    if (programId) where.programId = programId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const batches = await prisma.fabricBatch.findMany({
      where,
      include: {
        createdBy: { select: { fullName: true, username: true } },
        program: { select: { programNumber: true, clientName: true } },
        _count: { select: { rolls: true, receipts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: batches });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/fabric-store/batches
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fabricType, fabricDescription, colorCode, colorName, programId, supplierId } = body;

    if (!fabricType || !fabricDescription) {
      return NextResponse.json({ error: 'fabricType and fabricDescription are required' }, { status: 400 });
    }

    // Resolve actor
    const actor = await prisma.user.findFirst({
      where: { OR: [{ username: 'admin' }, { username: 'store_mgr' }] },
    });
    if (!actor) {
      return NextResponse.json({ error: 'No authorized user found' }, { status: 401 });
    }

    const batchNumber = await getNextBatchNumber();

    const batch = await prisma.fabricBatch.create({
      data: {
        batchNumber,
        fabricType,
        fabricDescription,
        colorCode,
        colorName,
        programId: programId || null,
        supplierId: supplierId || null,
        createdById: actor.id,
      },
    });

    return NextResponse.json({ data: batch }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
