import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

// POST /api/fabric-store/return — accept roll returns from production
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { rollIds, returnReason } = body;

    if (!Array.isArray(rollIds) || rollIds.length === 0) {
      return NextResponse.json({ error: 'At least one roll ID is required' }, { status: 400 });
    }

    // Resolve actor
    const actor = await prisma.user.findFirst({
      where: { OR: [{ username: 'admin' }, { username: 'store_mgr' }, { username: 'jitender' }] },
    });
    if (!actor) {
      return NextResponse.json({ error: 'No authorized user found' }, { status: 401 });
    }

    const rolls = await prisma.fabricStoreRoll.findMany({
      where: { id: { in: rollIds } },
    });

    if (rolls.length !== rollIds.length) {
      return NextResponse.json({ error: 'One or more rolls not found' }, { status: 404 });
    }

    // Business rules: Rejected rolls cannot be returned — they must be written off
    for (const roll of rolls) {
      if (roll.status === 'QC_REJECTED') {
        return NextResponse.json(
          { error: `Roll ${roll.rollNumber} is QC_REJECTED and cannot be returned` },
          { status: 422 }
        );
      }
      if (roll.status !== 'ISSUED') {
        return NextResponse.json(
          { error: `Roll ${roll.rollNumber} is not in ISSUED status (status: ${roll.status})` },
          { status: 422 }
        );
      }
    }

    const year = new Date().getFullYear();
    const returnedAt = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const slePrefix = `SLE-${year}-`;
      const latestSLE = await tx.fabricStockLedger.findFirst({
        where: { entryNumber: { startsWith: slePrefix } },
        orderBy: { entryNumber: 'desc' },
      });
      let sleSeq = latestSLE
        ? parseInt(latestSLE.entryNumber.split('-').pop() || '0', 10) + 1
        : 1;

      const returnedRolls = [];
      for (const roll of rolls) {
        // Return roll → RETURNED status, qcStatus back to PENDING for return QC
        const updated = await tx.fabricStoreRoll.update({
          where: { id: roll.id },
          data: {
            status: 'RETURNED',
            qcStatus: 'PENDING',
            programIssuedToId: null,
            issuedAt: null,
            qcInspectedById: null,
            qcInspectedAt: null,
            qcRemarks: null,
          },
        });

        // Ledger entry
        const entryNumber = `${slePrefix}${String(sleSeq).padStart(4, '0')}`;
        sleSeq++;
        await tx.fabricStockLedger.create({
          data: {
            entryNumber,
            rollId: roll.id,
            batchId: roll.batchId,
            transactionType: 'RETURN',
            quantity: roll.length,
            referenceType: 'RETURN_CHALLAN',
            referenceId: roll.id,
            transactedById: actor.id,
            transactedAt: returnedAt,
            remarks: returnReason || 'Material returned from production',
          },
        });

        // Update batch
        const batchRolls = await tx.fabricStoreRoll.findMany({
          where: { batchId: roll.batchId },
          select: { status: true },
        });
        const allIssued = batchRolls.every((r) => r.status === 'ISSUED');
        const anyIssued = batchRolls.some((r) => r.status === 'ISSUED');
        await tx.fabricBatch.update({
          where: { id: roll.batchId },
          data: {
            status: allIssued ? 'FULLY_ISSUED' : anyIssued ? 'PARTIALLY_ISSUED' : 'IN_STOCK',
          },
        });

        returnedRolls.push(updated);
      }

      return returnedRolls;
    });

    return NextResponse.json({
      data: result,
      message: `${result.length} roll(s) returned — queued for return QC`,
    });
  } catch (error: any) {
    console.error('Material return error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/fabric-store/return — list currently issued rolls (eligible for return)
export async function GET() {
  try {
    const issuedRolls = await prisma.fabricStoreRoll.findMany({
      where: { status: 'ISSUED' },
      include: {
        batch: { select: { batchNumber: true, fabricType: true, fabricDescription: true } },
        programIssuedTo: { select: { programNumber: true, clientName: true } },
        location: { select: { locationCode: true } },
      },
      orderBy: { issuedAt: 'asc' },
    });

    return NextResponse.json({ data: issuedRolls });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
