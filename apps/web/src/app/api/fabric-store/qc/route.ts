import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

// GET /api/fabric-store/qc — list rolls pending QC
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');
    const result = searchParams.get('result'); // filter by inspection result

    if (result) {
      // Completed inspections
      const inspections = await prisma.fabricQCInspection.findMany({
        where: { result: result as any },
        include: {
          roll: {
            include: {
              batch: { select: { batchNumber: true, fabricType: true, fabricDescription: true } },
              location: { select: { locationCode: true } },
            },
          },
          inspectedBy: { select: { fullName: true } },
        },
        orderBy: { inspectedAt: 'desc' },
        take: 100,
      });
      return NextResponse.json({ data: inspections });
    }

    // QC queue — rolls with PENDING qcStatus
    const where: any = { qcStatus: 'PENDING', status: 'RECEIVED' };
    if (batchId) where.batchId = batchId;

    const rolls = await prisma.fabricStoreRoll.findMany({
      where,
      include: {
        batch: {
          select: {
            batchNumber: true,
            fabricType: true,
            fabricDescription: true,
            colorName: true,
            supplierId: true,
          },
        },
        receiptItems: {
          include: { receipt: { select: { grnNumber: true, receivedAt: true } } },
          take: 1,
        },
      },
      orderBy: { createdAt: 'asc' }, // oldest first for FIFO priority
    });

    return NextResponse.json({ data: rolls });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/fabric-store/qc — create QC inspection
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { rollId, inspectionType, result, defects, remarks } = body;

    if (!rollId || !result) {
      return NextResponse.json({ error: 'rollId and result are required' }, { status: 400 });
    }
    if (!['PASS', 'HOLD', 'REJECT'].includes(result)) {
      return NextResponse.json({ error: 'result must be PASS, HOLD, or REJECT' }, { status: 400 });
    }

    // Resolve actor (QC inspector)
    const actor = await prisma.user.findFirst({
      where: { OR: [{ username: 'admin' }, { username: 'qc_insp' }, { username: 'store_mgr' }] },
    });
    if (!actor) {
      return NextResponse.json({ error: 'No authorized QC user found' }, { status: 401 });
    }

    // Fetch roll
    const roll = await prisma.fabricStoreRoll.findUnique({ where: { id: rollId } });
    if (!roll) {
      return NextResponse.json({ error: 'Roll not found' }, { status: 404 });
    }

    // Business rule 2: QC can only be performed on rolls with status = RECEIVED (or QC_HOLD for re-inspection)
    if (!['RECEIVED', 'QC_HOLD'].includes(roll.status)) {
      return NextResponse.json(
        { error: `QC cannot be performed on roll with status ${roll.status}` },
        { status: 422 }
      );
    }

    // Map result to new statuses
    const qcStatusMap: Record<string, string> = {
      PASS: 'PASSED',
      HOLD: 'ON_HOLD',
      REJECT: 'FAILED',
    };
    const rollStatusMap: Record<string, string> = {
      PASS: 'IN_STOCK',
      HOLD: 'QC_HOLD',
      REJECT: 'QC_REJECTED',
    };

    const year = new Date().getFullYear();

    const inspection = await prisma.$transaction(async (tx) => {
      // 1. Generate QCI number
      const qciPrefix = `QCI-${year}-`;
      const latestQCI = await tx.fabricQCInspection.findFirst({
        where: { inspectionNumber: { startsWith: qciPrefix } },
        orderBy: { inspectionNumber: 'desc' },
      });
      const qciSeq = latestQCI
        ? parseInt(latestQCI.inspectionNumber.split('-').pop() || '0', 10) + 1
        : 1;
      const inspectionNumber = `${qciPrefix}${String(qciSeq).padStart(4, '0')}`;

      // 2. Create inspection record
      const qci = await tx.fabricQCInspection.create({
        data: {
          inspectionNumber,
          rollId,
          inspectedById: actor.id,
          inspectionType: inspectionType || 'RECEIPT_QC',
          result,
          defects: defects || null,
          remarks: remarks || null,
          inspectedAt: new Date(),
        },
      });

      // 3. Update roll status
      await tx.fabricStoreRoll.update({
        where: { id: rollId },
        data: {
          qcStatus: qcStatusMap[result] as any,
          status: rollStatusMap[result] as any,
          qcInspectedById: actor.id,
          qcInspectedAt: new Date(),
          qcRemarks: remarks || null,
        },
      });

      // 4. Create stock ledger entry (for HOLD → tracks holds; for PASS → already in ledger from receipt)
      const slePrefix = `SLE-${year}-`;
      const latestSLE = await tx.fabricStockLedger.findFirst({
        where: { entryNumber: { startsWith: slePrefix } },
        orderBy: { entryNumber: 'desc' },
      });
      const sleSeq = latestSLE
        ? parseInt(latestSLE.entryNumber.split('-').pop() || '0', 10) + 1
        : 1;

      const transactionTypeMap: Record<string, string> = {
        PASS: 'RECEIPT',
        HOLD: 'ADJUSTMENT',
        REJECT: 'WRITE_OFF',
      };

      await tx.fabricStockLedger.create({
        data: {
          entryNumber: `${slePrefix}${String(sleSeq).padStart(4, '0')}`,
          rollId,
          batchId: roll.batchId,
          transactionType: transactionTypeMap[result] as any,
          quantity: roll.length,
          referenceType: 'QC_INSPECTION',
          referenceId: qci.id,
          transactedById: actor.id,
          transactedAt: new Date(),
          remarks: `QC ${result}: ${inspectionNumber}${remarks ? ' — ' + remarks : ''}`,
        },
      });

      return qci;
    });

    return NextResponse.json({
      data: inspection,
      message: `QC inspection recorded — Roll is ${rollStatusMap[result]}`,
    });
  } catch (error: any) {
    console.error('QC inspection error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
