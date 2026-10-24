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
      return NextResponse.json({ error: 'Steam Press job not found' }, { status: 404 });
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
      const steamPressUser = await prisma.user.findFirst({
        where: { OR: [{ username: 'steampress' }, { username: 'steam_press' }, { departmentCode: 'STEAM_PRESS' }] },
        select: { id: true },
      });
      actorId = steamPressUser?.id;
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
      if (!String(body.defectReason || '').trim()) return NextResponse.json({ error: 'Reason for defect is required for rejected steam press pieces.' }, { status: 400 });
      const auth = await authorizeDefectReport(request, 'STEAM_PRESS');
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
          departmentCode: 'STEAM_PRESS',
          operationName: 'STEAM_PRESSING',
          operatorId: actorId,
          inputQuantity: inputQuantity,
          goodQuantity: goodQuantity,
          reworkQuantity: reworkQuantity,
          rejectQuantity: rejectQuantity,
          wasteQuantity: wasteQuantity,
          balanceQuantity: balanceQuantity,
          unitOfMeasure: uom,
          recordedAt: new Date(),
          notes: body.operatorNotes || `Steam pressing completed: ${goodQuantity} good pressed garments, ${reworkQuantity} re-press, ${rejectQuantity} reject/burn.`,
        },
      });

      // B. If rejected garments exist, record in DefectRecord for scrap traceability
      if (rejectQuantity > 0) {
        const savedDefect = await tx.defectRecord.create({
          data: {
            defectCode: `DEF-SP-${Date.now().toString().slice(-6)}`,
            programId: challan.programId,
            challanId: challan.id,
            departmentCode: 'STEAM_PRESS',
            productionSheetNumber: challan.program?.programSerialNo || challan.program?.programNumber,
            shelfCode: DEFECTIVE_SHELF_INFO.STEAM_PRESS.code,
            color: challan.items[0]?.colour || challan.program?.fabricColor || null,
            fabricType: challan.program?.fabricType || challan.program?.fabricName || challan.items[0]?.fabricCode || null,
            quantityUnit: uom,
            responsibleIncharge: defectReporter?.fullName || null,
            itemDescription: challan.items[0]?.itemDescription || `${challan.program?.styleCode || 'Pressed'} Garments`,
            severity: 'CRITICAL',
            status: 'OPEN',
            quantity: rejectQuantity,
            reason: String(body.defectReason).trim(),
            resolutionNotes: body.defectDescription || 'Quarantined for authorized disposition.',
            detectedById: actorId,
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

      // C. If rework garments exist, record in DefectRecord for rework tracking
      if (reworkQuantity > 0) {
        await tx.defectRecord.create({
          data: {
            defectCode: `DEF-SP-RW-${Date.now().toString().slice(-6)}`,
            programId: challan.programId,
            challanId: challan.id,
            departmentCode: 'STEAM_PRESS',
            itemDescription: challan.items[0]?.itemDescription || `${challan.program?.styleCode || 'Pressed'} Garments`,
            severity: 'MINOR',
            status: 'REWORK',
            quantity: reworkQuantity,
            reason: body.reworkReason || 'Wrinkle re-press / moisture drying required',
            resolutionNotes: body.reworkDescription || 'Returned for second pressing pass',
            detectedById: actorId,
          },
        });
      }

      // D. Update Challan status and fabricOut
      const updatedChallan = await tx.challan.update({
        where: { id: challan.id },
        data: {
          status: nextStatus,
          fabricOut: goodQuantity,
          defectivePieces: (Number(challan.defectivePieces) || 0) + rejectQuantity,
          defectiveShelfLocation: rejectQuantity > 0 ? DEFECTIVE_SHELF_INFO.STEAM_PRESS.code : challan.defectiveShelfLocation,
          defectReason: rejectQuantity > 0 ? String(body.defectReason).trim() : challan.defectReason,
          fabricUnit: uom,
          remarks: body.operatorNotes
            ? `${challan.remarks ? challan.remarks + ' | ' : ''}Steam Press: ${goodQuantity} Good, ${reworkQuantity} Rework, ${rejectQuantity} Reject. ${body.operatorNotes}`
            : challan.remarks,
        },
        include: {
          program: true,
          items: true,
        },
      });

      // E. Log Challan Audit Event
      await tx.challanEvent.create({
        data: {
          challanId: challan.id,
          action: 'PRODUCTION_COMPLETED',
          fromStatus: challan.status,
          toStatus: nextStatus,
          actorId: actorId,
          notes: `Steam pressing completed: In=${inputQuantity}, Good=${goodQuantity}, Rework=${reworkQuantity}, Reject=${rejectQuantity}, Bal=${balanceQuantity}. ${
            autoInspect ? 'Auto-passed appearance audit.' : 'Pending quality inspection release.'
          }`,
        },
      });

      return { updatedChallan, transaction };
    });

    return NextResponse.json({
      success: true,
      message: `Steam pressing recorded: ${goodQuantity} pressed garments ready. Status: ${result.updatedChallan.status}`,
      data: result,
    });
  } catch (error: any) {
    console.error('Error completing Steam Press job:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to complete Steam Press job' },
      { status: 500 }
    );
  }
}
