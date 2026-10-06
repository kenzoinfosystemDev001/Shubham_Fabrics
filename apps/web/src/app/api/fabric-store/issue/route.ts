import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

// GET /api/fabric-store/issue — list issued rolls
export async function GET() {
  try {
    const issuedRolls = await prisma.fabricStoreRoll.findMany({
      where: { status: 'ISSUED' },
      include: {
        batch: { select: { batchNumber: true, fabricType: true, fabricDescription: true, colorName: true } },
        location: { select: { locationCode: true } },
        programIssuedTo: { select: { programNumber: true, clientName: true } },
        ledgerEntries: {
          where: { transactionType: 'ISSUE' },
          orderBy: { transactedAt: 'desc' },
          take: 1,
          include: { transactedBy: { select: { fullName: true } } },
        },
      },
      orderBy: { issuedAt: 'desc' },
    });

    return NextResponse.json({ data: issuedRolls });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/fabric-store/issue — issue rolls to a program
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { rollIds, programId, remarks } = body;

    if (!Array.isArray(rollIds) || rollIds.length === 0) {
      return NextResponse.json({ error: 'At least one roll ID is required' }, { status: 400 });
    }
    if (!programId) {
      return NextResponse.json({ error: 'programId is required' }, { status: 400 });
    }

    // Resolve actor
    const actor = await prisma.user.findFirst({
      where: { OR: [{ username: 'admin' }, { username: 'store_mgr' }, { username: 'jitender' }] },
    });
    if (!actor) {
      return NextResponse.json({ error: 'No authorized user found' }, { status: 401 });
    }

    // Validate program exists
    const program = await prisma.program.findUnique({ where: { id: programId } });
    if (!program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    // Fetch all rolls
    const rolls = await prisma.fabricStoreRoll.findMany({
      where: { id: { in: rollIds } },
    });

    if (rolls.length !== rollIds.length) {
      return NextResponse.json({ error: 'One or more rolls not found' }, { status: 404 });
    }

    // Business rules 3 & 4: Rolls must be IN_STOCK with PASSED QC
    for (const roll of rolls) {
      if (roll.status !== 'IN_STOCK') {
        return NextResponse.json(
          { error: `Roll ${roll.rollNumber} is not IN_STOCK (status: ${roll.status})` },
          { status: 422 }
        );
      }
      if (roll.qcStatus !== 'PASSED') {
        return NextResponse.json(
          { error: `Roll ${roll.rollNumber} has not passed QC (qcStatus: ${roll.qcStatus})` },
          { status: 422 }
        );
      }
    }

    const year = new Date().getFullYear();
    const issuedAt = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const slePrefix = `SLE-${year}-`;
      const latestSLE = await tx.fabricStockLedger.findFirst({
        where: { entryNumber: { startsWith: slePrefix } },
        orderBy: { entryNumber: 'desc' },
      });
      let sleSeq = latestSLE
        ? parseInt(latestSLE.entryNumber.split('-').pop() || '0', 10) + 1
        : 1;

      const issuedRolls = [];
      for (const roll of rolls) {
        // Update roll
        const updated = await tx.fabricStoreRoll.update({
          where: { id: roll.id },
          data: {
            status: 'ISSUED',
            programIssuedToId: programId,
            issuedAt,
          },
        });

        // Stock ledger entry
        const entryNumber = `${slePrefix}${String(sleSeq).padStart(4, '0')}`;
        sleSeq++;
        await tx.fabricStockLedger.create({
          data: {
            entryNumber,
            rollId: roll.id,
            batchId: roll.batchId,
            transactionType: 'ISSUE',
            quantity: roll.length,
            referenceType: 'ISSUE_CHALLAN',
            referenceId: programId,
            fromLocationId: roll.locationId || null,
            transactedById: actor.id,
            transactedAt: issuedAt,
            remarks: remarks || `Issued to program ${program.programNumber}`,
          },
        });

        // Update batch status if all rolls issued
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

        issuedRolls.push(updated);
      }

      return issuedRolls;
    });

    return NextResponse.json({
      data: result,
      message: `${result.length} roll(s) issued to program ${program.programNumber}`,
    });
  } catch (error: any) {
    console.error('Material issue error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
