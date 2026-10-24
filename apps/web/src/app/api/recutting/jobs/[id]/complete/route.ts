import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { authorizeDefectReport, DEFECTIVE_SHELF_INFO } from '@/lib/defective-shelf';

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
    let defectReporter: { id: string; fullName: string } | null = null;
    if (rejectQuantity > 0) {
      if (!String(body.defectReason || '').trim()) return NextResponse.json({ error: 'Reason for defect is required for rejected recutting panels.' }, { status: 400 });
      const auth = await authorizeDefectReport(request, 'RECUTTING');
      if (!auth.actor) return auth.response;
      defectReporter = { id: auth.actor.id, fullName: auth.actor.fullName };
      actorId = auth.actor.id;
    }

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
        const savedDefect = await tx.defectRecord.create({
          data: {
            defectCode: `DEF-RC-${Date.now().toString().slice(-4)}`,
            programId: challan.programId,
            challanId: challan.id,
            departmentCode: 'RECUTTING',
            productionSheetNumber: challan.program?.programSerialNo || challan.program?.programNumber,
            shelfCode: DEFECTIVE_SHELF_INFO.RECUTTING.code,
            color: challan.items[0]?.colour || challan.program?.fabricColor || null,
            fabricType: challan.program?.fabricType || challan.program?.fabricName || challan.items[0]?.fabricCode || null,
            quantityUnit: uom,
            responsibleIncharge: defectReporter?.fullName || null,
            itemDescription: `Damaged / miss-cut embroidered panels in Recutting`,
            severity: 'MAJOR',
            quantity: rejectQuantity,
            reason: String(body.defectReason).trim(),
            detectedById: actorId,
            status: 'OPEN',
            resolutionNotes: 'Quarantined scrap panels. Logged during precision recutting.',
          },
        });
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'DEFECT_SHELF_ENTRY_CREATED',
            entity: 'DefectRecord',
            entityId: savedDefect.id,
            afterState: JSON.stringify({ departmentCode: savedDefect.departmentCode, shelfCode: savedDefect.shelfCode, quantity: savedDefect.quantity, quantityUnit: savedDefect.quantityUnit, reason: savedDefect.reason, challanId: savedDefect.challanId }),
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
          defectivePieces: (Number(challan.defectivePieces) || 0) + rejectQuantity,
          defectiveShelfLocation: rejectQuantity > 0 ? DEFECTIVE_SHELF_INFO.RECUTTING.code : challan.defectiveShelfLocation,
          defectReason: rejectQuantity > 0 ? String(body.defectReason).trim() : challan.defectReason,
          fabricUnit: uom,
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
