import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

// GET /api/fabric-store/rolls/[id]
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const roll = await prisma.fabricStoreRoll.findUnique({
      where: { id },
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

// PATCH /api/fabric-store/rolls/[id] → move location, update quarantine status, or write off
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { locationId, status, qcStatus, qcRemarks } = body;

    const roll = await prisma.fabricStoreRoll.findUnique({ where: { id } });
    if (!roll) {
      return NextResponse.json({ error: 'Roll not found' }, { status: 404 });
    }

    const actor = await prisma.user.findFirst({
      where: { OR: [{ username: 'admin' }, { username: 'store_mgr' }, { username: 'jitender' }] },
    });

    await prisma.$transaction(async (tx) => {
      const updateData: any = {};
      if (locationId !== undefined) updateData.locationId = locationId || null;
      if (status) updateData.status = status;
      if (qcStatus) updateData.qcStatus = qcStatus;
      if (qcRemarks) updateData.qcRemarks = qcRemarks;

      await tx.fabricStoreRoll.update({
        where: { id },
        data: updateData,
      });

      // Ledger entry for action if applicable
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

        const isWriteOff = status === 'QC_REJECTED' || qcStatus === 'FAILED';
        const isTransfer = locationId !== undefined && locationId !== roll.locationId;
        const isRelease = status === 'IN_STOCK' && roll.status === 'QC_HOLD';

        if (isWriteOff || isTransfer || isRelease) {
          await tx.fabricStockLedger.create({
            data: {
              entryNumber: `${slePrefix}${String(sleSeq).padStart(4, '0')}`,
              rollId: roll.id,
              batchId: roll.batchId,
              transactionType: isWriteOff ? 'WRITE_OFF' : isTransfer ? 'TRANSFER' : 'ADJUSTMENT',
              quantity: roll.length,
              referenceType: isWriteOff ? 'SCRAP_QUARANTINE' : isTransfer ? 'LOCATION_TRANSFER' : 'QC_RELEASE',
              referenceId: roll.id,
              fromLocationId: roll.locationId || null,
              toLocationId: locationId || roll.locationId || null,
              transactedById: actor.id,
              transactedAt: new Date(),
              remarks: qcRemarks || (isWriteOff ? 'Quarantine scrap/write-off' : isRelease ? 'Released from QC hold' : 'Location transfer'),
            },
          });
        }
      }
    });

    const updated = await prisma.fabricStoreRoll.findUnique({
      where: { id },
      include: {
        location: { select: { locationCode: true, locationName: true } },
        batch: true,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
