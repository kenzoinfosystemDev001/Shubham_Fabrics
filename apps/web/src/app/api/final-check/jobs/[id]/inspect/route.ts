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

    if (!['IN_PROCESS', 'RECEIVED', 'COMPLETED'].includes(challan.status)) {
      return NextResponse.json(
        { error: `Job must be IN_PROCESS, RECEIVED, or COMPLETED to record inspection. Current: '${challan.status}'.` },
        { status: 400 }
      );
    }

    let actorId = body.actorId;
    if (!actorId) {
      const fcUser = await prisma.user.findFirst({
        where: { OR: [{ username: 'finalcheck' }, { username: 'final_check' }, { departmentCode: 'FINAL_CHECK' }] },
        select: { id: true },
      });
      actorId = fcUser?.id;
    }
    if (!actorId) {
      const fallback = await prisma.user.findFirst({ select: { id: true } });
      actorId = fallback?.id;
    }

    // Quantity accounting: Input = Accepted + Rework + Rejected + Pending/Balance
    const totalIssuedQty = challan.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
    const inputQuantity = Number(body.inputQuantity ?? challan.fabricIn ?? totalIssuedQty);
    const acceptedQuantity = Number(body.acceptedQuantity ?? body.goodQuantity ?? 0);
    const reworkQuantity = Number(body.reworkQuantity ?? 0);
    const rejectedQuantity = Number(body.rejectedQuantity ?? body.rejectQuantity ?? 0);
    const pendingQuantity = Number(body.pendingQuantity ?? body.balanceQuantity ?? 0);

    if (isNaN(inputQuantity) || inputQuantity <= 0) {
      return NextResponse.json({ error: 'Valid input quantity is required.' }, { status: 400 });
    }
    if (isNaN(acceptedQuantity) || acceptedQuantity < 0) {
      return NextResponse.json({ error: 'Valid accepted quantity is required.' }, { status: 400 });
    }

    // Strict reconciliation: Input = Accepted + Rework + Rejected + Pending
    const accountedTotal = acceptedQuantity + reworkQuantity + rejectedQuantity + pendingQuantity;
    if (accountedTotal !== inputQuantity) {
      return NextResponse.json(
        {
          error: `Quantity reconciliation mismatch: Accepted (${acceptedQuantity}) + Rework (${reworkQuantity}) + Rejected (${rejectedQuantity}) + Pending (${pendingQuantity}) = ${accountedTotal}, does not match Input (${inputQuantity}).`,
        },
        { status: 400 }
      );
    }

    // Inspection checkpoints
    const {
      stitchingQuality = 'PASS',
      measurementCheck = 'PASS',
      appearanceCheck = 'PASS',
      labelCheck = 'PASS',
      packagingReadiness = 'PASS',
      overallResult = 'PASS',
      notes = '',
    } = body;

    const isPassed =
      overallResult === 'PASS' &&
      stitchingQuality === 'PASS' &&
      measurementCheck === 'PASS' &&
      appearanceCheck === 'PASS' &&
      labelCheck === 'PASS';

    const autoInspect = Boolean(body.autoInspect);
    const nextStatus = isPassed && autoInspect
      ? 'READY_FOR_HANDOVER'
      : isPassed
      ? 'COMPLETED'
      : 'ON_HOLD';

    const uom = challan.items[0]?.uom || 'PCS';

    const result = await prisma.$transaction(async (tx) => {
      // A. Create ProductionTransaction for quantity accounting
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
          recordedAt: new Date(),
          notes: body.notes || `Final QC inspection: ${acceptedQuantity} accepted, ${reworkQuantity} rework, ${rejectedQuantity} rejected, ${pendingQuantity} pending.`,
        },
      });

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
          fabricOut: acceptedQuantity,
          remarks: `${challan.remarks ? challan.remarks + ' | ' : ''}Final QC: ${acceptedQuantity} Accepted, ${reworkQuantity} Rework, ${rejectedQuantity} Rejected. ${notes || 'Inspection complete.'}`,
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
          notes: `Final QC Inspection: In=${inputQuantity}, Accepted=${acceptedQuantity}, Rework=${reworkQuantity}, Rejected=${rejectedQuantity}, Pending=${pendingQuantity}. Checks: Stitching=${stitchingQuality}, Measurement=${measurementCheck}, Appearance=${appearanceCheck}, Label=${labelCheck}. ${notes}`,
        },
      });

      return { updatedChallan, transaction };
    });

    return NextResponse.json({
      success: true,
      message: `Final QC inspection recorded: ${acceptedQuantity} accepted. Status: ${result.updatedChallan.status}`,
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
