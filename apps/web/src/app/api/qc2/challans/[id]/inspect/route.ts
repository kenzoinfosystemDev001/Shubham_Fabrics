import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const {
      quantityInspected,
      quantityPassed,
      quantityFailed,
      quantityRework,
      quantityHold,
      result,
      defects,
      defectRemarks,
      reworkReason,
      holdReason,
      remarks,
      parameters,
      inspectorId,
    } = body;

    // 1. Fetch Challan & verify
    const challan = await prisma.challan.findUnique({
      where: { id },
      include: {
        program: true,
        items: true,
        inspections: true,
      },
    });

    if (!challan) {
      return NextResponse.json({ error: 'Challan not found.' }, { status: 404 });
    }

    if (challan.toDepartment !== 'QC2') {
      return NextResponse.json(
        { error: `Challan ${challan.challanNumber} is not routed to QC2.` },
        { status: 400 }
      );
    }

    // Duplicate inspection prevention
    if (['QC_APPROVED', 'QC_REJECTED', 'REWORK_REQUESTED'].includes(challan.status)) {
      return NextResponse.json(
        {
          error: `Inspection for Challan ${challan.challanNumber} has already been completed with status '${challan.status}'. Duplicate inspections are prevented.`,
        },
        { status: 400 }
      );
    }

    // Must be in valid processing state
    if (!['RECEIVED', 'UNDER_INSPECTION', 'ON_HOLD', 'ISSUED'].includes(challan.status)) {
      return NextResponse.json(
        {
          error: `Invalid status transition: cannot complete inspection from status '${challan.status}'.`,
        },
        { status: 400 }
      );
    }

    // 2. Strict Backend Validations on Quantities
    const totalReceivedQty = challan.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);

    const qInspected = Number(quantityInspected);
    const qPassed = Number(quantityPassed || 0);
    const qFailed = Number(quantityFailed || 0);
    const qRework = Number(quantityRework || 0);
    const qHold = Number(quantityHold || 0);

    if (isNaN(qInspected) || qInspected <= 0) {
      return NextResponse.json(
        { error: 'Quantity Inspected must be a positive number greater than 0.' },
        { status: 400 }
      );
    }

    if (isNaN(qPassed) || qPassed < 0) {
      return NextResponse.json(
        { error: 'Quantity Passed cannot be negative.' },
        { status: 400 }
      );
    }

    if (isNaN(qFailed) || qFailed < 0) {
      return NextResponse.json(
        { error: 'Quantity Failed cannot be negative.' },
        { status: 400 }
      );
    }

    if (isNaN(qRework) || qRework < 0) {
      return NextResponse.json(
        { error: 'Quantity Rework cannot be negative.' },
        { status: 400 }
      );
    }

    if (isNaN(qHold) || qHold < 0) {
      return NextResponse.json(
        { error: 'Quantity Hold cannot be negative.' },
        { status: 400 }
      );
    }

    if (qInspected > totalReceivedQty) {
      return NextResponse.json(
        {
          error: `Quantity Inspected (${qInspected}) cannot exceed Quantity Received from Thread Cutting (${totalReceivedQty}).`,
        },
        { status: 400 }
      );
    }

    const calculatedSum = qPassed + qFailed + qRework + qHold;
    if (Math.abs(calculatedSum - qInspected) > 0.01) {
      return NextResponse.json(
        {
          error: `Sum of Passed (${qPassed}) + Failed (${qFailed}) + Rework (${qRework}) + Hold (${qHold}) = ${calculatedSum} must equal Inspected Quantity (${qInspected}).`,
        },
        { status: 400 }
      );
    }

    // 3. Resolve Result Enum & Validations
    let normalizedResult = (result || '').toUpperCase();
    if (!['PASS', 'REJECT', 'REWORK', 'HOLD'].includes(normalizedResult)) {
      if (qFailed > 0 && qPassed === 0) normalizedResult = 'REJECT';
      else if (qRework > 0 && qPassed === 0) normalizedResult = 'REWORK';
      else if (qHold > 0 && qPassed === 0) normalizedResult = 'HOLD';
      else normalizedResult = 'PASS';
    }

    if (normalizedResult === 'REJECT' && qFailed <= 0) {
      return NextResponse.json(
        { error: 'A REJECT inspection must have Failed Quantity greater than 0.' },
        { status: 400 }
      );
    }

    if (normalizedResult === 'REJECT' && !defectRemarks?.trim() && !remarks?.trim()) {
      return NextResponse.json(
        { error: 'Defect remarks are mandatory when rejecting pieces at QC2.' },
        { status: 400 }
      );
    }

    if (normalizedResult === 'REWORK' && qRework <= 0) {
      return NextResponse.json(
        { error: 'A REWORK inspection must have Rework Quantity greater than 0.' },
        { status: 400 }
      );
    }

    if (normalizedResult === 'REWORK' && !reworkReason?.trim() && !remarks?.trim()) {
      return NextResponse.json(
        { error: 'Rework reason is mandatory when requesting alteration/re-cutting from Thread Cutting.' },
        { status: 400 }
      );
    }

    if (normalizedResult === 'HOLD' && qHold <= 0) {
      return NextResponse.json(
        { error: 'A HOLD inspection must have Hold Quantity greater than 0.' },
        { status: 400 }
      );
    }

    // 4. Resolve Actor
    let actorUser = await prisma.user.findFirst({
      where: {
        OR: [
          { id: inspectorId || '' },
          { username: 'qc2' },
          { username: 'qc2_insp' },
          { departmentCode: 'QC2' },
          { username: 'admin' },
        ],
      },
      select: { id: true, fullName: true, username: true },
    });
    if (!actorUser) {
      actorUser = await prisma.user.findFirst({ select: { id: true, fullName: true, username: true } });
    }
    const actorId = actorUser?.id || '';

    // Determine target challan status
    let targetChallanStatus: string;
    let challanEventType: string;

    if (normalizedResult === 'PASS') {
      targetChallanStatus = 'QC_APPROVED';
      challanEventType = 'QC_APPROVED';
    } else if (normalizedResult === 'REJECT') {
      targetChallanStatus = 'QC_REJECTED';
      challanEventType = 'QC_REJECTED';
    } else if (normalizedResult === 'REWORK') {
      targetChallanStatus = 'REWORK_REQUESTED';
      challanEventType = 'REWORK_REQUESTED';
    } else {
      targetChallanStatus = 'ON_HOLD';
      challanEventType = 'ON_HOLD';
    }

    const primaryItem = challan.items[0];
    const uom = primaryItem?.uom || 'PCS';
    const effectiveRemark =
      remarks?.trim() ||
      defectRemarks?.trim() ||
      reworkReason?.trim() ||
      holdReason?.trim() ||
      `QC2 inspection completed: ${normalizedResult}`;

    // 5. ATOMIC TRANSACTION
    const transactionResult = await prisma.$transaction(async (tx) => {
      // A. Create QualityInspection Record
      const inspection = await tx.qualityInspection.create({
        data: {
          challanId: challan.id,
          programId: challan.programId,
          departmentCode: 'QC2',
          inspectorId: actorId,
          sampleSize: Math.round(qInspected),
          status: normalizedResult,
          notes: [
            effectiveRemark,
            defectRemarks ? `Defects: ${defectRemarks}` : null,
            reworkReason ? `Rework: ${reworkReason}` : null,
          ]
            .filter(Boolean)
            .join(' | ') || null,
          inspectedAt: new Date(),
        },
      });

      // B. Save Parameters if provided
      if (Array.isArray(parameters) && parameters.length > 0) {
        for (const p of parameters) {
          if (p.parameterName) {
            await tx.qualityInspectionParameter.create({
              data: {
                inspectionId: inspection.id,
                parameterName: p.parameterName,
                expectedValue: String(p.standardValue || p.expectedValue || 'Standard'),
                measuredValue: String(p.observedValue || p.measuredValue || 'Checked'),
                status: p.passed !== false ? 'PASS' : 'FAIL',
                comments: p.remarks || p.comments || null,
                uom: p.uom || 'PCS',
              },
            });
          }
        }
      } else {
        await tx.qualityInspectionParameter.createMany({
          data: [
            {
              inspectionId: inspection.id,
              parameterName: 'PIECE_INTEGRITY_CHECK',
              expectedValue: `${totalReceivedQty} ${uom}`,
              measuredValue: `Pass: ${qPassed}, Reject: ${qFailed}, Rework: ${qRework}`,
              status: normalizedResult === 'PASS' ? 'PASS' : 'FAIL',
              comments: `Inspected ${qInspected} ${uom}`,
              uom,
            },
          ],
        });
      }

      // C. Save Defect Logs
      if (Array.isArray(defects) && defects.length > 0) {
        for (const d of defects) {
          if (d.defectType && Number(d.count) > 0) {
            await tx.defectLog.create({
              data: {
                inspectionId: inspection.id,
                defectType: d.defectType,
                count: Number(d.count),
                severity: d.severity || 'MAJOR',
              },
            });
          }
        }
      } else if (qFailed > 0 || qRework > 0) {
        await tx.defectLog.create({
          data: {
            inspectionId: inspection.id,
            defectType: normalizedResult === 'REWORK' ? (reworkReason || 'THREAD_ALTERATION') : (defectRemarks || 'DEFECTIVE_PIECE'),
            count: Math.round(qFailed + qRework),
            severity: normalizedResult === 'REJECT' ? 'CRITICAL' : 'MAJOR',
          },
        });
      }

      // D. Record Production Transaction for traceability
      const prodTx = await tx.productionTransaction.create({
        data: {
          programId: challan.programId,
          challanId: challan.id,
          departmentCode: 'QC2',
          operationName: 'QC2_GARMENT_INSPECTION',
          operatorId: actorId,
          inputQuantity: qInspected,
          goodQuantity: qPassed,
          rejectQuantity: qFailed,
          reworkQuantity: qRework,
          balanceQuantity: 0,
          unitOfMeasure: uom,
          reworkReason: reworkReason || null,
          rejectReason: defectRemarks || (normalizedResult === 'REJECT' ? effectiveRemark : null),
          notes: effectiveRemark || `QC2 Inspection complete: ${normalizedResult}. Passed: ${qPassed} ${uom}`,
          recordedAt: new Date(),
        },
      });

      // E. Return Rework pieces to Thread Cutting Department if rework quantity > 0
      let reworkReturnChallan = null;
      if (qRework > 0) {
        const year = new Date().getFullYear();
        const retPrefix = `CH-RET-QC2-${year}-`;
        const retCount = await tx.challan.count({
          where: { challanNumber: { startsWith: retPrefix } },
        });
        const returnChallanNumber = `${retPrefix}${String(retCount + 1).padStart(5, '0')}`;

        reworkReturnChallan = await tx.challan.create({
          data: {
            challanNumber: returnChallanNumber,
            challanType: 'REWORK_RETURN',
            programId: challan.programId,
            parentChallanId: challan.id,
            fromDepartment: 'QC2',
            toDepartment: 'THREAD_CUTTING',
            status: 'ISSUED',
            priority: challan.priority || 'HIGH',
            createdById: actorId,
            issuedById: actorId,
            issuedDate: new Date(),
            remarks: `QC2 Rework/Alteration Return to Thread Cutting for Sheet ${challan.program.programSerialNo || challan.program.programNumber}. Reason: ${reworkReason || effectiveRemark}. Must undergo QC2 inspection after trimming.`,
          },
        });

        await tx.challanItem.create({
          data: {
            challanId: reworkReturnChallan.id,
            itemDescription: `${primaryItem?.itemDescription || 'Garment Pieces'} - QC2 Rework Return to Thread Cutting`,
            fabricCode: primaryItem?.fabricCode || 'PIECE',
            colour: primaryItem?.colour || 'Dyed',
            unitType: 'PCS',
            quantity: qRework,
            uom: 'PCS',
            remarks: `Returned for rework/alteration. Reason: ${reworkReason || effectiveRemark}`,
          },
        });
      }

      // F. USER REQUIREMENT: IF THERE IS REJECTION IT WILL GO TO DEFECTED SHELF DIRECTLY
      let rejectReturnChallan = null;
      if (qFailed > 0) {
        const year = new Date().getFullYear();
        const rejPrefix = `CH-REJ-QC2-${year}-`;
        const rejCount = await tx.challan.count({
          where: { challanNumber: { startsWith: rejPrefix } },
        });
        const rejectChallanNumber = `${rejPrefix}${String(rejCount + 1).padStart(5, '0')}`;

        rejectReturnChallan = await tx.challan.create({
          data: {
            challanNumber: rejectChallanNumber,
            challanType: 'DEFECTIVE_RETURN',
            programId: challan.programId,
            parentChallanId: challan.id,
            fromDepartment: 'QC2',
            toDepartment: 'STORE',
            status: 'ISSUED',
            priority: 'URGENT',
            createdById: actorId,
            issuedById: actorId,
            issuedDate: new Date(),
            remarks: `QC2 Defective Return DIRECT TO DEFECTED SHELF (DEF-SHELF-01) for Sheet ${challan.program.programSerialNo || challan.program.programNumber}. Reason: ${defectRemarks || effectiveRemark}. Strictly quarantined and scrapped.`,
          },
        });

        await tx.challanItem.create({
          data: {
            challanId: rejectReturnChallan.id,
            itemDescription: `${primaryItem?.itemDescription || 'Garment Pieces'} - DIRECT TO DEFECTED SHELF (DEF-SHELF-01)`,
            fabricCode: primaryItem?.fabricCode || 'PIECE',
            colour: primaryItem?.colour || 'Dyed',
            unitType: 'PCS',
            quantity: qFailed,
            uom: 'PCS',
            remarks: `QC2_REJECTED: Allocated to Fabric Store Defective Shelf (DEF-SHELF-01). Reason: ${defectRemarks || effectiveRemark}`,
          },
        });
      }

      // G. Update Main Challan status
      const updatedMainChallan = await tx.challan.update({
        where: { id: challan.id },
        data: {
          status: targetChallanStatus,
          remarks: `${challan.remarks ? challan.remarks + ' | ' : ''}QC2 Inspection ${normalizedResult}: Inspected ${qInspected} ${uom}, Passed ${qPassed}, Failed to Defected Shelf ${qFailed}, Rework ${qRework}. ${effectiveRemark}`,
        },
        include: {
          program: true,
          items: true,
          issuedBy: { select: { fullName: true, username: true } },
          receivedBy: { select: { fullName: true, username: true } },
        },
      });

      // H. Record Audit Event
      await tx.challanEvent.create({
        data: {
          challanId: challan.id,
          action: challanEventType,
          fromStatus: challan.status,
          toStatus: targetChallanStatus,
          notes: `QC2 Inspection completed. Result: ${normalizedResult} (Passed: ${qPassed} ${uom}, Failed: ${qFailed}, Rework: ${qRework}). ${effectiveRemark}`,
          actorId: actorId,
        },
      });

      return {
        inspection,
        prodTx,
        reworkReturnChallan,
        rejectReturnChallan,
        updatedChallan: updatedMainChallan,
      };
    });

    return NextResponse.json({
      success: true,
      message: `QC2 inspection completed: ${normalizedResult}. Passed: ${qPassed} ${uom}, Rejected directly to Defected Shelf: ${qFailed} ${uom}, Rework: ${qRework} ${uom}.`,
      data: {
        inspectionId: transactionResult.inspection.id,
        result: normalizedResult,
        status: targetChallanStatus,
        quantityPassed: qPassed,
        quantityFailed: qFailed,
        quantityRework: qRework,
        defectiveReturnChallan: transactionResult.rejectReturnChallan?.challanNumber || null,
        reworkReturnChallan: transactionResult.reworkReturnChallan?.challanNumber || null,
        challan: transactionResult.updatedChallan,
      },
    });
  } catch (error: any) {
    console.error('Error submitting QC2 inspection:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to submit QC2 inspection' },
      { status: 500 }
    );
  }
}
