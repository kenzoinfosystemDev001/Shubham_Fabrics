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
      return NextResponse.json({ error: 'Stitching job not found' }, { status: 404 });
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
      const stitchUser = await prisma.user.findFirst({
        where: { OR: [{ username: 'stitching' }, { departmentCode: 'STITCHING' }] },
        select: { id: true },
      });
      actorId = stitchUser?.id;
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
      if (!String(body.defectReason || '').trim()) return NextResponse.json({ error: 'Reason for defect is required for rejected stitching pieces.' }, { status: 400 });
      const auth = await authorizeDefectReport(request, 'STITCHING');
      if (!auth.actor) return auth.response;
      defectReporter = { id: auth.actor.id, fullName: auth.actor.fullName };
      actorId = auth.actor.id;
    }

    // Validation Rules
    if (isNaN(inputQuantity) || inputQuantity <= 0) {
      return NextResponse.json({ error: 'Valid input quantity is required.' }, { status: 400 });
    }

    if (isNaN(goodQuantity) || goodQuantity < 0) {
      return NextResponse.json({ error: 'Valid completed good garment quantity is required.' }, { status: 400 });
    }

    // Strict Mathematical Quantity Accounting: Input = Good + Rework + Reject + Balance
    const accountedTotal = goodQuantity + reworkQuantity + rejectQuantity + balanceQuantity;
    if (accountedTotal !== inputQuantity) {
      return NextResponse.json(
        {
          error: `Quantity reconciliation mismatch: Good (${goodQuantity}) + Rework (${reworkQuantity}) + Reject (${rejectQuantity}) + Balance (${balanceQuantity}) = ${accountedTotal}, which does not match Input (${inputQuantity}).`,
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
    const autoInspect = Boolean(body.autoInspect);
    const nextStatus = autoInspect ? 'READY_FOR_HANDOVER' : 'COMPLETED';

    // 4. ATOMIC DATABASE TRANSACTION
    const result = await prisma.$transaction(async (tx) => {
      // A. Create ProductionTransaction entry
      const transaction = await tx.productionTransaction.create({
        data: {
          programId: challan.programId,
          challanId: challan.id,
          departmentCode: 'STITCHING',
          operationName: 'GARMENT_STITCHING',
          operatorId: actorId,
          inputQuantity: inputQuantity,
          goodQuantity: goodQuantity,
          reworkQuantity: reworkQuantity,
          rejectQuantity: rejectQuantity,
          wasteQuantity: wasteQuantity,
          balanceQuantity: balanceQuantity,
          unitOfMeasure: uom,
          recordedAt: new Date(),
          notes: body.operatorNotes || `Garment stitching completed: ${goodQuantity} finished garments, ${reworkQuantity} re-stitch, ${rejectQuantity} reject.`,
        },
      });

      // B. If rejected garments exist, record in DefectRecord for scrap traceability
      if (rejectQuantity > 0) {
        const savedDefect = await tx.defectRecord.create({
          data: {
            defectCode: `DEF-ST-${Date.now().toString().slice(-4)}`,
            programId: challan.programId,
            challanId: challan.id,
            departmentCode: 'STITCHING',
            productionSheetNumber: challan.program?.programSerialNo || challan.program?.programNumber,
            shelfCode: DEFECTIVE_SHELF_INFO.STITCHING.code,
            color: challan.items[0]?.colour || challan.program?.fabricColor || null,
            fabricType: challan.program?.fabricType || challan.program?.fabricName || challan.items[0]?.fabricCode || null,
            quantityUnit: uom,
            responsibleIncharge: defectReporter?.fullName || null,
            itemDescription: `Damaged / defective garments in Stitching Section`,
            severity: 'MAJOR',
            quantity: Math.round(rejectQuantity),
            reason: String(body.defectReason).trim(),
            detectedById: actorId,
            status: 'OPEN',
            resolutionNotes: 'Quarantined scrap garments. Logged during assembly.',
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
          defectiveShelfLocation: rejectQuantity > 0 ? DEFECTIVE_SHELF_INFO.STITCHING.code : challan.defectiveShelfLocation,
          defectReason: rejectQuantity > 0 ? String(body.defectReason).trim() : challan.defectReason,
          fabricUnit: uom,
          remarks: body.operatorNotes
            ? `${challan.remarks ? challan.remarks + ' | ' : ''}Stitching: ${body.operatorNotes}`
            : challan.remarks,
        },
        include: {
          program: true,
          items: true,
          productionLogs: {
            where: { departmentCode: 'STITCHING' },
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
          notes: `Stitching output logged: ${goodQuantity} good garments completed.`,
        },
      });

      return { updatedChallan, transaction };
    });

    return NextResponse.json({
      success: true,
      message: `Stitching completed successfully for job ${result.updatedChallan.challanNumber}`,
      data: result,
    });
  } catch (error: any) {
    console.error('Error completing Stitching job:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to complete stitching job' },
      { status: 500 }
    );
  }
}
