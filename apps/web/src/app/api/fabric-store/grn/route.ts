import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

// Helper: next sequential number generator
async function getNextNumber(prefix: string, model: 'materialReceipt'): Promise<string> {
  const year = new Date().getFullYear();
  const fullPrefix = `${prefix}-${year}-`;
  const latest = await (prisma as any)[model].findFirst({
    where: { grnNumber: { startsWith: fullPrefix } },
    orderBy: { grnNumber: 'desc' },
  });
  if (!latest) return `${fullPrefix}0001`;
  const last = parseInt(latest.grnNumber.split('-').pop() || '0', 10);
  return `${fullPrefix}${String(last + 1).padStart(4, '0')}`;
}

async function getNextRollNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ROLL-${year}-`;
  const latest = await prisma.fabricStoreRoll.findFirst({
    where: { rollNumber: { startsWith: prefix } },
    orderBy: { rollNumber: 'desc' },
  });
  if (!latest) return `${prefix}0001`;
  const last = parseInt(latest.rollNumber.split('-').pop() || '0', 10);
  return `${prefix}${String(last + 1).padStart(4, '0')}`;
}

async function getNextSLENumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SLE-${year}-`;
  const latest = await prisma.fabricStockLedger.findFirst({
    where: { entryNumber: { startsWith: prefix } },
    orderBy: { entryNumber: 'desc' },
  });
  if (!latest) return `${prefix}0001`;
  const last = parseInt(latest.entryNumber.split('-').pop() || '0', 10);
  return `${prefix}${String(last + 1).padStart(4, '0')}`;
}

// GET /api/fabric-store/grn
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const where: any = {};
    if (status) where.status = status;
    if (from || to) {
      where.receivedAt = {};
      if (from) where.receivedAt.gte = new Date(from);
      if (to) where.receivedAt.lte = new Date(to);
    }

    const grns = await prisma.materialReceipt.findMany({
      where,
      include: {
        batch: { select: { batchNumber: true, fabricType: true, fabricDescription: true, colorName: true } },
        receivedBy: { select: { fullName: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: grns });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/fabric-store/grn — atomic: create batch + GRN + rolls + ledger entries
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      supplierName,
      vehicleNumber,
      remarks,
      fabricType,
      fabricDescription,
      colorCode,
      colorName,
      programId,
      rolls: rollInputs,
    } = body;

    if (!supplierName || !fabricType || !fabricDescription) {
      return NextResponse.json(
        { error: 'supplierName, fabricType, and fabricDescription are required' },
        { status: 400 }
      );
    }
    if (!Array.isArray(rollInputs) || rollInputs.length === 0) {
      return NextResponse.json({ error: 'At least one roll entry is required' }, { status: 400 });
    }

    // Validate roll entries
    for (const r of rollInputs) {
      if (!r.length || isNaN(parseFloat(r.length)) || parseFloat(r.length) <= 0) {
        return NextResponse.json({ error: `Invalid roll length: ${r.length}` }, { status: 400 });
      }
    }

    // Resolve actor
    const actor = await prisma.user.findFirst({
      where: { OR: [{ username: 'admin' }, { username: 'store_mgr' }, { username: 'jitender' }] },
      orderBy: { username: 'asc' },
    });
    if (!actor) {
      return NextResponse.json({ error: 'No authorized user found' }, { status: 401 });
    }

    const year = new Date().getFullYear();
    const batchPrefix = `BATCH-${year}-`;
    const latestBatch = await prisma.fabricBatch.findFirst({
      where: { batchNumber: { startsWith: batchPrefix } },
      orderBy: { batchNumber: 'desc' },
    });
    const nextBatchSeq = latestBatch
      ? parseInt(latestBatch.batchNumber.split('-').pop() || '0', 10) + 1
      : 1;
    const batchNumber = `${batchPrefix}${String(nextBatchSeq).padStart(4, '0')}`;

    // Calculate totals
    const totalMeters = rollInputs.reduce(
      (sum: number, r: any) => sum + parseFloat(r.length),
      0
    );

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create FabricBatch
      const batch = await tx.fabricBatch.create({
        data: {
          batchNumber,
          fabricType,
          fabricDescription,
          colorCode: colorCode || null,
          colorName: colorName || null,
          programId: programId || null,
          totalRolls: rollInputs.length,
          totalMeters,
          status: 'PARTIALLY_RECEIVED',
          createdById: actor.id,
        },
      });

      // 2. Create GRN
      const grnNumber = await (async () => {
        const grnPrefix = `GRN-${year}-`;
        const latestGRN = await tx.materialReceipt.findFirst({
          where: { grnNumber: { startsWith: grnPrefix } },
          orderBy: { grnNumber: 'desc' },
        });
        const nextSeq = latestGRN
          ? parseInt(latestGRN.grnNumber.split('-').pop() || '0', 10) + 1
          : 1;
        return `${grnPrefix}${String(nextSeq).padStart(4, '0')}`;
      })();

      const grn = await tx.materialReceipt.create({
        data: {
          grnNumber,
          batchId: batch.id,
          supplierName,
          vehicleNumber: vehicleNumber || null,
          receivedById: actor.id,
          receivedAt: new Date(),
          totalRollsReceived: rollInputs.length,
          totalMetersReceived: totalMeters,
          status: 'DRAFT',
          remarks: remarks || null,
        },
      });

      // 3. Create rolls + receipt items + ledger entries
      const rollPrefix = `ROLL-${year}-`;
      const latestRoll = await tx.fabricStoreRoll.findFirst({
        where: { rollNumber: { startsWith: rollPrefix } },
        orderBy: { rollNumber: 'desc' },
      });
      let rollSeq = latestRoll
        ? parseInt(latestRoll.rollNumber.split('-').pop() || '0', 10) + 1
        : 1;

      const slePrefix = `SLE-${year}-`;
      const latestSLE = await tx.fabricStockLedger.findFirst({
        where: { entryNumber: { startsWith: slePrefix } },
        orderBy: { entryNumber: 'desc' },
      });
      let sleSeq = latestSLE
        ? parseInt(latestSLE.entryNumber.split('-').pop() || '0', 10) + 1
        : 1;

      const createdRolls = [];
      for (const rollInput of rollInputs) {
        const rollNumber = `${rollPrefix}${String(rollSeq).padStart(4, '0')}`;
        rollSeq++;

        const roll = await tx.fabricStoreRoll.create({
          data: {
            rollNumber,
            batchId: batch.id,
            length: parseFloat(rollInput.length),
            width: rollInput.width ? parseFloat(rollInput.width) : null,
            weight: rollInput.weight ? parseFloat(rollInput.weight) : null,
            status: 'RECEIVED',
            qcStatus: 'PENDING',
          },
        });

        // Receipt item
        await tx.materialReceiptItem.create({
          data: {
            receiptId: grn.id,
            rollId: roll.id,
            measuredLength: parseFloat(rollInput.length),
            measuredWeight: rollInput.weight ? parseFloat(rollInput.weight) : null,
            remarks: rollInput.remarks || null,
          },
        });

        // Stock Ledger Entry
        const entryNumber = `${slePrefix}${String(sleSeq).padStart(4, '0')}`;
        sleSeq++;
        await tx.fabricStockLedger.create({
          data: {
            entryNumber,
            rollId: roll.id,
            batchId: batch.id,
            transactionType: 'RECEIPT',
            quantity: parseFloat(rollInput.length),
            referenceType: 'GRN',
            referenceId: grn.id,
            transactedById: actor.id,
            transactedAt: new Date(),
            remarks: `GRN receipt: ${grnNumber}`,
          },
        });

        createdRolls.push(roll);
      }

      // Update batch status to RECEIVED after all rolls created
      await tx.fabricBatch.update({
        where: { id: batch.id },
        data: { status: 'RECEIVED', receivedAt: new Date() },
      });

      return { grn, batch, rolls: createdRolls };
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error: any) {
    console.error('GRN creation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
