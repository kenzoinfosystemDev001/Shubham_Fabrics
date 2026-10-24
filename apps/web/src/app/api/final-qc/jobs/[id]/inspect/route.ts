import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { getFinalQCActor } from '@/lib/final-qc-auth';
import { validateInspectionQuantities, inspectionPassed } from '@/lib/final-qc-rules.mjs';

export const dynamic = 'force-dynamic';

const FINAL_QC_DEPTS = ['FINAL_QC'];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getFinalQCActor(request);
    if (!auth.actor) return auth.response;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const challan = await prisma.challan.findUnique({
      where: { id },
      include: { program: true, items: true },
    });

    if (!challan) {
      return NextResponse.json({ error: 'Final QC job not found' }, { status: 404 });
    }

    if (!FINAL_QC_DEPTS.includes(challan.toDepartment.toUpperCase())) {
      return NextResponse.json({ error: 'This challan is not routed to Final QC.' }, { status: 400 });
    }

    if (challan.status !== 'IN_PROCESS') {
      return NextResponse.json(
        { error: `Job must be IN_PROCESS to record inspection. Current: '${challan.status}'.` },
        { status: 400 }
      );
    }

    const actorId = auth.actor.id;

    const totalIssuedQty = challan.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const [previousTransaction, previousTotals] = await Promise.all([
      prisma.productionTransaction.findFirst({
        where: { challanId: challan.id, departmentCode: { in: FINAL_QC_DEPTS } },
        orderBy: { recordedAt: 'desc' },
        select: { balanceQuantity: true },
      }),
      prisma.productionTransaction.aggregate({
        where: { challanId: challan.id, departmentCode: { in: FINAL_QC_DEPTS } },
        _sum: { goodQuantity: true, reworkQuantity: true, rejectQuantity: true },
      }),
    ]);
    const previouslyAccepted = Number(previousTotals._sum.goodQuantity || 0);
    const previouslyReworked = Number(previousTotals._sum.reworkQuantity || 0);
    const previouslyRejected = Number(previousTotals._sum.rejectQuantity || 0);
    const remainingQuantity = previousTransaction
      ? Number(previousTransaction.balanceQuantity)
      : Number(challan.fabricIn ?? totalIssuedQty);
    let quantities;
    try {
      quantities = validateInspectionQuantities({
        inputQuantity: body.inputQuantity ?? remainingQuantity,
        acceptedQuantity: body.acceptedQuantity ?? body.goodQuantity ?? 0,
        reworkQuantity: body.reworkQuantity ?? 0,
        rejectedQuantity: body.rejectedQuantity ?? body.rejectQuantity ?? 0,
        pendingQuantity: body.pendingQuantity ?? body.balanceQuantity ?? 0,
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Inspection quantities are invalid.' },
        { status: 400 },
      );
    }
    const { input: inputQuantity, accepted: acceptedQuantity, rework: reworkQuantity, rejected: rejectedQuantity, pending: pendingQuantity } = quantities;

    if (!Number.isSafeInteger(remainingQuantity) || remainingQuantity < 0) {
      return NextResponse.json(
        { error: 'The recorded remaining quantity is invalid. Contact a supervisor before inspecting this batch.' },
        { status: 400 },
      );
    }

    if (inputQuantity !== remainingQuantity || inputQuantity > totalIssuedQty) {
      return NextResponse.json(
        { error: `Inspection input must match the remaining quantity (${remainingQuantity}) and cannot exceed the issued quantity (${totalIssuedQty}).` },
        { status: 400 },
      );
    }

    const accountedTotal = acceptedQuantity + reworkQuantity + rejectedQuantity + pendingQuantity;
    if (accountedTotal !== inputQuantity) {
      return NextResponse.json(
        {
          error: `Quantity reconciliation mismatch: Accepted (${acceptedQuantity}) + Rework (${reworkQuantity}) + Rejected (${rejectedQuantity}) + Pending (${pendingQuantity}) = ${accountedTotal}, does not match Input (${inputQuantity}).`,
        },
        { status: 400 }
      );
    }

    const {
      stitchingQuality,
      measurementCheck,
      appearanceCheck,
      labelCheck,
      packagingReadiness,
      overallResult,
      notes = '',
    } = body;

    const checks = [
      ['STITCHING_QUALITY', stitchingQuality],
      ['MEASUREMENT_CHECK', measurementCheck],
      ['APPEARANCE_CHECK', appearanceCheck],
      ['LABEL_CHECK', labelCheck],
      ['PACKAGING_READINESS', packagingReadiness],
    ] as const;
    if (checks.some(([, value]) => value !== 'PASS' && value !== 'FAIL')) {
      return NextResponse.json({ error: 'All inspection checkpoints are required and must be PASS or FAIL.' }, { status: 400 });
    }

    const isPassed = inspectionPassed(
      [stitchingQuality, measurementCheck, appearanceCheck, labelCheck, packagingReadiness],
      overallResult,
    );

    if (overallResult !== 'PASS' && overallResult !== 'FAIL') {
      return NextResponse.json({ error: 'Overall inspection result must be PASS or FAIL.' }, { status: 400 });
    }

    if (!isPassed && acceptedQuantity === inputQuantity && reworkQuantity === 0 && rejectedQuantity === 0 && pendingQuantity === 0) {
      return NextResponse.json(
        { error: 'A failed inspection checkpoint requires rejected, rework, or pending quantity to be recorded.' },
        { status: 400 },
      );
    }

    const totalAcceptedQuantity = previouslyAccepted + acceptedQuantity;
    const nextStatus = pendingQuantity > 0
      ? 'ON_HOLD'
      : isPassed && totalAcceptedQuantity > 0
        ? 'QC_APPROVED'
        : previouslyRejected + rejectedQuantity > 0
          ? 'QC_REJECTED'
          : previouslyReworked + reworkQuantity > 0
            ? 'REWORK_REQUESTED'
            : 'ON_HOLD';

    const uom = challan.items[0]?.uom || 'PCS';
    if (rejectedQuantity > 0 && !String(body.defectReason || '').trim()) {
      return NextResponse.json({ error: 'A defect reason is required for rejected garments.' }, { status: 400 });
    }
    if (reworkQuantity > 0 && !String(body.reworkReason || '').trim()) {
      return NextResponse.json({ error: 'A rework reason is required for garments sent for rework.' }, { status: 400 });
    }
    const inspectionStatus = pendingQuantity > 0
      ? 'HOLD'
      : rejectedQuantity > 0
        ? 'REJECT'
        : reworkQuantity > 0
          ? 'REWORK'
          : isPassed
            ? 'PASS'
            : 'HOLD';

    const result = await prisma.$transaction(async (tx) => {
      const claimed = await tx.challan.updateMany({
        where: { id: challan.id, status: 'IN_PROCESS' },
        data: { status: 'QC_DECISION_PENDING' },
      });
      if (claimed.count !== 1) return null;

      const inspectionRecord = await tx.qualityInspection.create({
        data: {
          challanId: challan.id,
          programId: challan.programId,
          departmentCode: 'FINAL_QC',
          inspectorId: actorId,
          sampleSize: inputQuantity,
          status: inspectionStatus,
          inspectedAt: new Date(),
          notes: [
            String(notes || '').trim(),
            body.defectReason ? `Defect: ${String(body.defectReason).trim()}` : null,
            body.reworkReason ? `Rework: ${String(body.reworkReason).trim()}` : null,
          ].filter(Boolean).join(' | ') || null,
        },
      });

      await tx.qualityInspectionParameter.createMany({
        data: checks.map(([parameterName, value]) => ({
          inspectionId: inspectionRecord.id,
          parameterName,
          expectedValue: 'PASS',
          measuredValue: value,
          status: value,
          uom,
          comments: String(notes || '').trim() || null,
        })),
      });

      if (rejectedQuantity > 0 || reworkQuantity > 0) {
        await tx.defectLog.createMany({
          data: [
            ...(rejectedQuantity > 0
              ? [{ inspectionId: inspectionRecord.id, defectType: String(body.defectReason).trim(), count: rejectedQuantity, severity: 'CRITICAL' }]
              : []),
            ...(reworkQuantity > 0
              ? [{ inspectionId: inspectionRecord.id, defectType: String(body.reworkReason).trim(), count: reworkQuantity, severity: 'MAJOR' }]
              : []),
          ],
        });
      }

      const transaction = await tx.productionTransaction.create({
        data: {
          programId: challan.programId,
          challanId: challan.id,
          departmentCode: 'FINAL_QC',
          operationName: 'FINAL_QUALITY_INSPECTION',
          operatorId: actorId,
          inputQuantity: inputQuantity,
          goodQuantity: acceptedQuantity,
          reworkQuantity: reworkQuantity,
          rejectQuantity: rejectedQuantity,
          balanceQuantity: pendingQuantity,
          unitOfMeasure: uom,
          reworkReason: String(body.reworkReason || '').trim() || null,
          rejectReason: String(body.defectReason || '').trim() || null,
          recordedAt: new Date(),
          notes: body.notes || `Final QC inspection: ${acceptedQuantity} accepted, ${reworkQuantity} rework, ${rejectedQuantity} rejected, ${pendingQuantity} pending.`,
        },
      });

      // Rejected garments remain on the Final QC departmental shelf.
      let rejectReturnChallan: any = null;

      // B. Record rejected items in DefectRecord for full traceability
      if (rejectedQuantity > 0) {
        const savedDefect = await tx.defectRecord.create({
          data: {
            defectCode: `DEF-FQC-${Date.now().toString().slice(-6)}-${crypto.randomUUID().slice(0, 6)}`,
            programId: challan.programId,
            productionSheetNumber: challan.program?.programSerialNo || challan.program?.programNumber,
            challanId: challan.id,
            departmentCode: 'FINAL_QC',
            shelfCode: 'DEF-SHELF-FINAL-QC',
            color: challan.items[0]?.colour || challan.program?.fabricColor || null,
            fabricType: challan.program?.fabricType || challan.program?.fabricName || challan.items[0]?.fabricCode || null,
            quantityUnit: uom,
            responsibleIncharge: auth.actor.fullName,
            itemDescription: challan.items[0]?.itemDescription || `${challan.program?.styleCode || 'Garment'} - Final QC Rejected`,
            severity: 'CRITICAL',
            status: 'OPEN',
            quantity: rejectedQuantity,
            reason: String(body.defectReason).trim(),
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

      // C. Record rework items
      if (reworkQuantity > 0) {
        const savedDefect = await tx.defectRecord.create({
          data: {
            defectCode: `DEF-FQC-RW-${Date.now().toString().slice(-6)}-${crypto.randomUUID().slice(0, 6)}`,
            programId: challan.programId,
            challanId: challan.id,
            departmentCode: 'FINAL_QC',
            itemDescription: challan.items[0]?.itemDescription || `${challan.program?.styleCode || 'Garment'} - Final QC Rework`,
            severity: 'MAJOR',
            status: 'REWORK',
            quantity: reworkQuantity,
            reason: body.reworkReason || 'Minor defect requiring rework before dispatch',
            resolutionNotes: body.reworkDescription || 'Returned for correction',
            detectedById: actorId,
          },
        });
      }

      // D. Update Challan status and fabricOut (accepted quantity)
      const updatedChallan = await tx.challan.update({
        where: { id: challan.id },
        data: {
          status: nextStatus,
          fabricOut: totalAcceptedQuantity,
          defectivePieces: (Number(challan.defectivePieces) || 0) + rejectedQuantity,
          defectiveShelfLocation: rejectedQuantity > 0 ? 'DEF-SHELF-FINAL-QC' : challan.defectiveShelfLocation,
          defectReason: rejectedQuantity > 0 ? String(body.defectReason).trim() : challan.defectReason,
          completedDate: pendingQuantity === 0 ? new Date() : null,
          remarks: `${challan.remarks ? challan.remarks + ' | ' : ''}Final QC: ${acceptedQuantity} Accepted, ${reworkQuantity} Rework (routing pending), ${rejectedQuantity} Rejected - quarantined on Final QC shelf. ${notes || 'Inspection complete.'}`,
        },
        include: { program: true, items: true },
      });

      // E. Audit event
      await tx.challanEvent.create({
        data: {
          challanId: challan.id,
          action: isPassed ? 'INSPECTION_PASSED' : 'INSPECTION_FAILED',
          fromStatus: challan.status,
          toStatus: nextStatus,
          actorId: actorId,
          notes: `Final QC Inspection: In=${inputQuantity}, Accepted=${acceptedQuantity}, Rework=${reworkQuantity}, Rejected=${rejectedQuantity}, Pending=${pendingQuantity}. Checks: Stitching=${stitchingQuality}, Measurement=${measurementCheck}, Appearance=${appearanceCheck}, Label=${labelCheck}, Packaging=${packagingReadiness}. ${notes}`,
        },
      });

      return { updatedChallan, transaction, inspection: inspectionRecord, rejectReturnChallan };
    });

    if (!result) {
      return NextResponse.json(
        { error: 'This job was changed by another inspection action. Refresh the queue before retrying.' },
        { status: 409 },
      );
    }

    return NextResponse.json({
      success: true,
      message: `Final QC inspection recorded: ${acceptedQuantity} accepted. Status: ${result.updatedChallan.status}.`,
      data: result,
    });
  } catch (error: any) {
    console.error('Error recording Final QC inspection:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to record Final QC inspection' },
      { status: 500 }
    );
  }
}
