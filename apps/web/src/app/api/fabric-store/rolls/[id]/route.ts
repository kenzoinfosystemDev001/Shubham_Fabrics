import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

// GET /api/fabric-store/rolls/[id]
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const roll = await prisma.fabricStoreRoll.findUnique({
      where: { id: params.id },
      include: {
        batch: true,
        location: true,
        qcInspectedBy: { select: { fullName: true } },
        programIssuedTo: { select: { programNumber: true, clientName: true, styleCode: true } },
        qcInspections: {
          include: { inspectedBy: { select: { fullName: true } } },
          orderBy: { createdAt: 'desc' },
        },
        ledgerEntries: {
          include: {
            fromLocation: { select: { locationCode: true } },
            toLocation: { select: { locationCode: true } },
            transactedBy: { select: { fullName: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        receiptItems: {
          include: { receipt: { select: { grnNumber: true, supplierName: true } } },
        },
      },
    });

    if (!roll) {
      return NextResponse.json({ error: 'Roll not found' }, { status: 404 });
    }

    return NextResponse.json({ data: roll });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/fabric-store/rolls/[id]/location → move to new location
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { locationId } = body;

    const roll = await prisma.fabricStoreRoll.findUnique({ where: { id: params.id } });
    if (!roll) {
      return NextResponse.json({ error: 'Roll not found' }, { status: 404 });
    }

    // Business rule: Can only move rolls that are IN_STOCK or QC_PASSED
    if (!['IN_STOCK', 'QC_PASSED', 'RECEIVED', 'QC_HOLD'].includes(roll.status)) {
      return NextResponse.json(
        { error: `Cannot move roll in status ${roll.status}` },
        { status: 422 }
      );
    }

    const actor = await prisma.user.findFirst({
      where: { OR: [{ username: 'admin' }, { username: 'store_mgr' }, { username: 'jitender' }] },
    });

    await prisma.$transaction(async (tx) => {
      await tx.fabricStoreRoll.update({
        where: { id: params.id },
        data: { locationId: locationId || null },
      });

      // Ledger entry for transfer
      if (actor) {
        const year = new Date().getFullYear();
        const slePrefix = `SLE-${year}-`;
        const latestSLE = await tx.fabricStockLedger.findFirst({
          where: { entryNumber: { startsWith: slePrefix } },
          orderBy: { entryNumber: 'desc' },
        });
        const sleSeq = latestSLE
          ? parseInt(latestSLE.entryNumber.split('-').pop() || '0', 10) + 1
          : 1;

        await tx.fabricStockLedger.create({
          data: {
            entryNumber: `${slePrefix}${String(sleSeq).padStart(4, '0')}`,
            rollId: roll.id,
            batchId: roll.batchId,
            transactionType: 'TRANSFER',
            quantity: roll.length,
            referenceType: 'LOCATION_TRANSFER',
            referenceId: roll.id,
            fromLocationId: roll.locationId || null,
            toLocationId: locationId || null,
            transactedById: actor.id,
            transactedAt: new Date(),
            remarks: `Roll transferred to new location`,
          },
        });
      }
    });

    const updated = await prisma.fabricStoreRoll.findUnique({
      where: { id: params.id },
      include: { location: { select: { locationCode: true, locationName: true } } },
    });

    return NextResponse.json({ data: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
