import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    // 1. Fetch Challan & Linked Production Sheet
    const challan = await prisma.challan.findUnique({
      where: { id },
      include: {
        program: true,
        items: true,
      },
    });

    if (!challan) {
      return NextResponse.json({ error: 'Recutting job not found' }, { status: 404 });
    }

    if (challan.status !== 'IN_PROCESS' && challan.status !== 'RECEIVED') {
      return NextResponse.json(
        { error: `Job must be in 'IN_PROCESS' or 'RECEIVED' status to complete. Current status: '${challan.status}'.` },
        { status: 400 }
      );
    }

    // 2. Identify actor
    let actorId = body.actorId;
    if (!actorId) {
      const recUser = await prisma.user.findFirst({
        where: { OR: [{ username: 'recutting' }, { departmentCode: 'RECUTTING' }] },
        select: { id: true },
      });
      actorId = recUser?.id;
    }
    if (!actorId) {
      const fallbackUser = await prisma.user.findFirst({ select: { id: true } });
      actorId = fallbackUser?.id;
    }

    // 3. Extract and parse quantities
    const totalIssuedQty = challan.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
    const inputQuantity = Number(body.inputQuantity ?? challan.fabricIn ?? totalIssuedQty);
    const goodQuantity = Number(body.goodQuantity ?? 0);
    const reworkQuantity = Number(body.reworkQuantity ?? 0);
    const rejectQuantity = Number(body.rejectQuantity ?? 0);
    const wasteQuantity = Number(body.wasteQuantity ?? 0);
    const balanceQuantity = Number(body.balanceQuantity ?? 0);

    // Validation Rules
    if (isNaN(inputQuantity) || inputQuantity <= 0) {
      return NextResponse.json({ error: 'Valid input quantity is required.' }, { status: 400 });
    }

    if (isNaN(goodQuantity) || goodQuantity < 0) {
      return NextResponse.json({ error: 'Valid completed good quantity is required.' }, { status: 400 });
    }

    // Strict Mathematical Quantity Accounting: Input = Good + Rework + Reject + Balance
    const accountedTotal = goodQuantity + reworkQuantity + rejectQuantity + balanceQuantity;
    if (accountedTotal !== inputQuantity) {
      return NextResponse.json(
        {
          error: `Quantity reconciliation mismatch: Good (${goodQuantity}) + Retrim (${reworkQuantity}) + Reject (${rejectQuantity}) + Balance (${balanceQuantity}) = ${accountedTotal}, which does not match Input (${inputQuantity}).`,
        },
        { status: 400 }
      );
    }

    if (goodQuantity > inputQuantity) {
      return NextResponse.json(
        { error: `Good output quantity (${goodQuantity}) cannot exceed input quantity (${inputQuantity}).` },
        { status: 400 }
      );
    }

    const uom = challan.items[0]?.uom || 'PCS';
    const autoApproveForStitching = Boolean(body.autoVerify);
    const nextStatus = autoApproveForStitching ? 'READY_FOR_STITCHING' : 'COMPLETED';

    // 4. ATOMIC DATABASE TRANSACTION
    const result = await prisma.$transaction(async (tx) => {
      // A. Create ProductionTransaction entry
      const transaction = await tx.productionTransaction.create({
        data: {
          programId: challan.programId,
          challanId: challan.id,
          departmentCode: 'RECUTTING',
          operationName: 'EMBROIDERY_RECUTTING',
          operatorId: actorId,
          inputQuantity: inputQuantity,
          goodQuantity: goodQuantity,
          reworkQuantity: reworkQuantity,
          rejectQuantity: rejectQuantity,
          wasteQuantity: wasteQuantity,
          balanceQuantity: balanceQuantity,
          unitOfMeasure: uom,
          recordedAt: new Date(),
          notes: body.operatorNotes || `Precision embroidery cutting completed: ${goodQuantity} good cut panels, ${reworkQuantity} re-trim, ${rejectQuantity} reject.`,
        },
      });

      // B. If rejected panels exist, record in DefectRecord for scrap traceability
      if (rejectQuantity > 0) {
        await tx.defectRecord.create({
          data: {
            defectCode: `DEF-RC-${Date.now().toString().slice(-4)}`,
            programId: challan.programId,
            challanId: challan.id,
            departmentCode: 'RECUTTING',
            itemDescription: `Damaged / miss-cut embroidered panels in Recutting`,
            severity: 'MAJOR',
            quantity: Math.round(rejectQuantity),
            reason: body.defectReason || 'Precision cutting blade deviation / fabric tear',
            detectedById: actorId,
            status: 'OPEN',
            resolutionNotes: 'Quarantined scrap panels. Logged during precision recutting.',
          },
        });
      }

      // C. Update Challan status and output counts
      const updatedChallan = await tx.challan.update({
        where: { id: challan.id },
        data: {
          status: nextStatus,
          completedDate: new Date(),
          fabricIn: inputQuantity,
          fabricOut: goodQuantity,
          defectivePieces: rejectQuantity,
          remarks: body.operatorNotes
            ? `${challan.remarks ? challan.remarks + ' | ' : ''}Recutting: ${body.operatorNotes}`
            : challan.remarks,
        },
        include: {
          program: true,
          items: true,
          productionLogs: {
            where: { departmentCode: 'RECUTTING' },
            orderBy: { recordedAt: 'desc' },
          },
        },
      });

      // D. Log audit event
      await tx.challanEvent.create({
        data: {
          challanId: challan.id,
          action: 'PRODUCTION_COMPLETED',
          fromStatus: challan.status,
          toStatus: nextStatus,
          actorId: actorId,
          notes: `Recutting output logged: ${goodQuantity} approved cut pieces ready for inspection/stitching.`,
        },
      });

      return { updatedChallan, transaction };
    });

    return NextResponse.json({
      success: true,
      message: `Recutting completed successfully for job ${result.updatedChallan.challanNumber}`,
      data: result,
    });
  } catch (error: any) {
    console.error('Error completing Recutting job:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to complete recutting job' },
      { status: 500 }
    );
  }
}
