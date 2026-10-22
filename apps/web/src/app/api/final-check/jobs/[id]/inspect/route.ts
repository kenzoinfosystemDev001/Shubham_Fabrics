import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

const FINAL_CHECK_DEPTS = ['FINAL_CHECK', 'FINAL CHECK', 'FINAL_QC', 'FINAL-CHECK'];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const challan = await prisma.challan.findUnique({
      where: { id },
      include: { program: true, items: true },
    });

    if (!challan) {
      return NextResponse.json({ error: 'Final QC job not found' }, { status: 404 });
    }

    if (!FINAL_CHECK_DEPTS.includes(challan.toDepartment.toUpperCase())) {
      return NextResponse.json({ error: 'This challan is not routed to Final QC.' }, { status: 400 });
    }

    if (challan.status !== 'IN_PROCESS') {
      return NextResponse.json(
        { error: `Job must be IN_PROCESS to record inspection. Current: '${challan.status}'.` },
        { status: 400 }
      );
    }

    const actorUser = await prisma.user.findFirst({
      where: {
        OR: [
          { id: typeof body.actorId === 'string' ? body.actorId : '' },
          { username: 'finalcheck' },
          { username: 'final_check' },
          { departmentCode: 'FINAL_CHECK' },
          { username: 'admin' },
        ],
      },
      select: { id: true },
    }) ?? await prisma.user.findFirst({ select: { id: true } });
    const actorId = actorUser?.id;
    if (!actorId) {
      return NextResponse.json({ error: 'No user is available to record the Final QC inspection.' }, { status: 500 });
    }

    const totalIssuedQty = challan.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const [previousTransaction, previousTotals] = await Promise.all([
      prisma.productionTransaction.findFirst({
        where: { challanId: challan.id, departmentCode: { in: FINAL_CHECK_DEPTS } },
        orderBy: { recordedAt: 'desc' },
        select: { balanceQuantity: true },
      }),
      prisma.productionTransaction.aggregate({
        where: { challanId: challan.id, departmentCode: { in: FINAL_CHECK_DEPTS } },
        _sum: { goodQuantity: true, reworkQuantity: true, rejectQuantity: true },
      }),
    ]);
    const previouslyAccepted = Number(previousTotals._sum.goodQuantity || 0);
    const previouslyReworked = Number(previousTotals._sum.reworkQuantity || 0);
    const previouslyRejected = Number(previousTotals._sum.rejectQuantity || 0);
    const remainingQuantity = previousTransaction
      ? Number(previousTransaction.balanceQuantity)
      : Number(challan.fabricIn ?? totalIssuedQty);
    const inputQuantity = Number(body.inputQuantity ?? remainingQuantity);
    const acceptedQuantity = Number(body.acceptedQuantity ?? body.goodQuantity ?? 0);
    const reworkQuantity = Number(body.reworkQuantity ?? 0);
    const rejectedQuantity = Number(body.rejectedQuantity ?? body.rejectQuantity ?? 0);
    const pendingQuantity = Number(body.pendingQuantity ?? body.balanceQuantity ?? 0);

    if (![inputQuantity, acceptedQuantity, reworkQuantity, rejectedQuantity, pendingQuantity].every(
      (quantity) => Number.isInteger(quantity) && quantity >= 0,
    ) || inputQuantity <= 0) {
      return NextResponse.json(
        { error: 'Input, accepted, rework, rejected, and pending quantities must be whole, non-negative garment counts; input must be greater than zero.' },
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
      stitchingQuality = 'PASS',
      measurementCheck = 'PASS',
      appearanceCheck = 'PASS',
      labelCheck = 'PASS',
      packagingReadiness = 'PASS',
      overallResult = 'PASS',
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
      return NextResponse.json({ error: 'Inspection checkpoints must be PASS or FAIL.' }, { status: 400 });
    }

    const isPassed =
      overallResult === 'PASS' &&
      stitchingQuality === 'PASS' &&
      measurementCheck === 'PASS' &&
      appearanceCheck === 'PASS' &&
      labelCheck === 'PASS' &&
      packagingReadiness === 'PASS';

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
        data: { status: 'IN_PROCESS' },
      });
      if (claimed.count !== 1) return null;

      const inspectionRecord = await tx.qualityInspection.create({
        data: {
          challanId: challan.id,
          programId: challan.programId,
          departmentCode: 'FINAL_CHECK',
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
          expectedValue: 'Final QC standard',
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
          departmentCode: 'FINAL_CHECK',
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

      let reworkReturnChallan = null;
      if (reworkQuantity > 0) {
        const year = new Date().getFullYear();
        const prefix = `CH-RET-FQC-${year}-`;
        const count = await tx.challan.count({
          where: { challanNumber: { startsWith: prefix } },
        });
        const challanNumber = `${prefix}${String(count + 1).padStart(5, '0')}`;
        const reason = String(body.reworkReason).trim();

        reworkReturnChallan = await tx.challan.create({
          data: {
            challanNumber,
            challanType: 'REWORK_RETURN',
            programId: challan.programId,
            parentChallanId: challan.id,
            fromDepartment: 'FINAL_CHECK',
            toDepartment: 'STEAM_PRESS',
            status: 'ISSUED',
            priority: challan.priority || 'HIGH',
            createdById: actorId,
            issuedById: actorId,
            issuedDate: new Date(),
            fabricIn: reworkQuantity,
            fabricOut: 0,
            fabricUnit: uom,
            remarks: `Final QC rework return to Steam Press for ${challan.program?.programSerialNo || challan.program?.programNumber || challan.challanNumber}. Reason: ${reason}. Must return for Final QC re-inspection.`,
          },
        });

        await tx.challanItem.create({
          data: {
            challanId: reworkReturnChallan.id,
            itemDescription: `${challan.items[0]?.itemDescription || 'Garments'} - Final QC Rework Return`,
            fabricCode: challan.items[0]?.fabricCode || 'GARMENT',
            colour: challan.items[0]?.colour || challan.program?.fabricColor || 'Standard',
            unitType: 'PCS',
            quantity: reworkQuantity,
            uom,
            remarks: `Returned to Steam Press for rework. Reason: ${reason}`,
          },
        });

        await tx.challanEvent.create({
          data: {
            challanId: reworkReturnChallan.id,
            action: 'CHALLAN_ISSUED',
            fromStatus: 'DRAFT',
            toStatus: 'ISSUED',
            actorId,
            notes: `Final QC issued ${reworkQuantity} garments back to Steam Press for rework. Parent: ${challan.challanNumber}.`,
          },
        });
      }

      let rejectReturnChallan = null;
      if (rejectedQuantity > 0) {
        const year = new Date().getFullYear();
        const prefix = `CH-REJ-FQC-${year}-`;
        const count = await tx.challan.count({
          where: { challanNumber: { startsWith: prefix } },
        });
        const challanNumber = `${prefix}${String(count + 1).padStart(5, '0')}`;
        const reason = String(body.defectReason).trim();

        rejectReturnChallan = await tx.challan.create({
          data: {
            challanNumber,
            challanType: 'DEFECTIVE_RETURN',
            programId: challan.programId,
            parentChallanId: challan.id,
            fromDepartment: 'FINAL_CHECK',
            toDepartment: 'STORE',
            status: 'ISSUED',
            priority: 'URGENT',
            createdById: actorId,
            issuedById: actorId,
            issuedDate: new Date(),
            fabricIn: rejectedQuantity,
            fabricOut: 0,
            fabricUnit: uom,
            defectivePieces: rejectedQuantity,
            defectiveShelfLocation: 'DEF-SHELF-FINAL-CHECK',
            defectReason: reason,
            detectedFromDepartment: 'FINAL_CHECK',
            detectedFromChallanId: challan.id,
            remarks: `Final QC defective return directly to the Final QC defective shelf (DEF-SHELF-FINAL-CHECK). Reason: ${reason}.`,
          },
        });

        await tx.challanItem.create({
          data: {
            challanId: rejectReturnChallan.id,
            itemDescription: `${challan.items[0]?.itemDescription || 'Garments'} - Final QC Defective Shelf`,
            fabricCode: challan.items[0]?.fabricCode || 'GARMENT',
            colour: challan.items[0]?.colour || challan.program?.fabricColor || 'Standard',
            unitType: 'PCS',
            quantity: rejectedQuantity,
            uom,
            remarks: `QC_REJECTED: Quarantined at DEF-SHELF-FINAL-CHECK. Reason: ${reason}`,
          },
        });

        await tx.challanEvent.create({
          data: {
            challanId: rejectReturnChallan.id,
            action: 'CHALLAN_ISSUED',
            fromStatus: 'DRAFT',
            toStatus: 'ISSUED',
            actorId,
            notes: `Final QC quarantined ${rejectedQuantity} rejected garments at DEF-SHELF-FINAL-CHECK. Parent: ${challan.challanNumber}.`,
          },
        });
      }

      // B. Record rejected items in DefectRecord for full traceability
      if (rejectedQuantity > 0) {
        await tx.defectRecord.create({
          data: {
            defectCode: `DEF-FQC-${Date.now().toString().slice(-6)}`,
            programId: challan.programId,
            challanId: challan.id,
            departmentCode: 'FINAL_CHECK',
            itemDescription: challan.items[0]?.itemDescription || `${challan.program?.styleCode || 'Garment'} - Final QC Rejected`,
            severity: 'CRITICAL',
            status: 'SCRAP',
            quantity: rejectedQuantity,
            reason: body.defectReason || 'Failed final quality inspection - does not meet dispatch standards',
            resolutionNotes: body.defectDescription || 'Rejected at Final QC gate',
            detectedById: actorId,
          },
        });
      }

      // C. Record rework items
      if (reworkQuantity > 0) {
        await tx.defectRecord.create({
          data: {
            defectCode: `DEF-FQC-RW-${Date.now().toString().slice(-6)}`,
            programId: challan.programId,
            challanId: challan.id,
            departmentCode: 'FINAL_CHECK',
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
          remarks: `${challan.remarks ? challan.remarks + ' | ' : ''}Final QC: ${acceptedQuantity} Accepted, ${reworkQuantity} Rework${reworkReturnChallan ? ` (${reworkReturnChallan.challanNumber} to Steam Press)` : ''}, ${rejectedQuantity} Rejected${rejectReturnChallan ? ` (${rejectReturnChallan.challanNumber} to defective shelf)` : ''}. ${notes || 'Inspection complete.'}`,
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

      return { updatedChallan, transaction, inspection: inspectionRecord, reworkReturnChallan, rejectReturnChallan };
    });

    if (!result) {
      return NextResponse.json(
        { error: 'This job was changed by another inspection action. Refresh the queue before retrying.' },
        { status: 409 },
      );
    }

    return NextResponse.json({
      success: true,
      message: [
        `Final QC inspection recorded: ${acceptedQuantity} accepted. Status: ${result.updatedChallan.status}.`,
        result.reworkReturnChallan ? `Rework challan ${result.reworkReturnChallan.challanNumber} sent to Steam Press.` : '',
        result.rejectReturnChallan ? `Rejected garments sent to DEF-SHELF-FINAL-CHECK via ${result.rejectReturnChallan.challanNumber}.` : '',
      ].filter(Boolean).join(' '),
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
