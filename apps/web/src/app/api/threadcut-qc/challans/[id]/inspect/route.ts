import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { inactiveDepartmentError } from '@/lib/departments';
import { challanNumberErrorResponse, duplicateChallanNumberResponse, isDuplicateChallanNumberError, validateManualChallanNumbers } from '@/lib/challan-number';
import { authorizeDefectReport } from '@/lib/defective-shelf';

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

    if (challan.toDepartment !== 'THREADCUT_QC') {
      return NextResponse.json(
        { error: `Challan ${challan.challanNumber} is not routed to Threadcut QC.` },
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

    if (qFailed > 0 && !String(defectRemarks || '').trim()) {
      return NextResponse.json(
        { error: 'A specific defect reason is required for rejected pieces at Threadcut QC.' },
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
          { departmentCode: 'THREADCUT_QC' },
          { username: 'admin' },
        ],
      },
      select: { id: true, fullName: true, username: true },
    });
    if (!actorUser) {
      actorUser = await prisma.user.findFirst({ select: { id: true, fullName: true, username: true } });
    }
    let actorId = actorUser?.id || '';
    if (qFailed > 0) {
      const auth = await authorizeDefectReport(request, 'THREADCUT_QC');
      if (!auth.actor) return auth.response;
      actorId = auth.actor.id;
      actorUser = { id: auth.actor.id, fullName: auth.actor.fullName, username: auth.actor.roles[0] || 'THREADCUT_QC' };
    }

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
      `Threadcut QC inspection completed: ${normalizedResult}`;

    // Numbers for the challans this decision issues are entered manually by the QC Incharge.
    const issuesPassChallan = normalizedResult === 'PASS' && qPassed > 0;
    const issuesReworkChallan = qRework > 0;
    const numberChecks = await validateManualChallanNumbers([
      ...(issuesPassChallan ? [{ value: body.passChallanNumber, label: 'Challan Number (passed material to Washing)' }] : []),
      ...(issuesReworkChallan ? [{ value: body.reworkChallanNumber, label: 'Challan Number (rework return)' }] : []),
    ]);
    if (!numberChecks.ok) return challanNumberErrorResponse(numberChecks);
    const passChallanNumber = issuesPassChallan ? numberChecks.challanNumbers[0] : '';
    const reworkChallanNumber = issuesReworkChallan ? numberChecks.challanNumbers[issuesPassChallan ? 1 : 0] : '';
    const departmentBlocked = await inactiveDepartmentError(prisma, ['THREADCUT_QC', issuesPassChallan ? 'WASHING' : null, issuesReworkChallan ? challan.fromDepartment || 'THREAD_CUTTING' : null]);
    if (departmentBlocked) return NextResponse.json({ error: departmentBlocked }, { status: 409 });

    // 5. ATOMIC TRANSACTION
    const transactionResult = await prisma.$transaction(async (tx) => {
      // A. Create QualityInspection Record
      const inspection = await tx.qualityInspection.create({
        data: {
          challanId: challan.id,
          programId: challan.programId,
          departmentCode: 'THREADCUT_QC',
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
          departmentCode: 'THREADCUT_QC',
          operationName: 'THREADCUT_QC_GARMENT_INSPECTION',
          operatorId: actorId,
          inputQuantity: qInspected,
          goodQuantity: qPassed,
          rejectQuantity: qFailed,
          reworkQuantity: qRework,
          balanceQuantity: 0,
          unitOfMeasure: uom,
          reworkReason: reworkReason || null,
          rejectReason: defectRemarks || (normalizedResult === 'REJECT' ? effectiveRemark : null),
          notes: effectiveRemark || `Threadcut QC Inspection complete: ${normalizedResult}. Passed: ${qPassed} ${uom}`,
          recordedAt: new Date(),
        },
      });

      // E. Return Rework pieces to source department if rework quantity > 0
      let reworkReturnChallan = null;
      if (qRework > 0) {
        const reworkTargetDept = challan.fromDepartment || 'THREAD_CUTTING';

        reworkReturnChallan = await tx.challan.create({
          data: {
            challanNumber: reworkChallanNumber,
            challanType: 'REWORK_RETURN',
            programId: challan.programId,
            parentChallanId: challan.id,
            fromDepartment: 'THREADCUT_QC',
            toDepartment: reworkTargetDept,
            status: 'ISSUED',
            priority: challan.priority || 'HIGH',
            createdById: actorId,
            issuedById: actorId,
            issuedDate: new Date(),
            remarks: `Threadcut QC Rework/Alteration Return to ${reworkTargetDept} for Sheet ${challan.program.programSerialNo || challan.program.programNumber}. Reason: ${reworkReason || effectiveRemark}. Must undergo Threadcut QC inspection after rectification.`,
          },
        });

        await tx.challanItem.create({
          data: {
            challanId: reworkReturnChallan.id,
            itemDescription: `${primaryItem?.itemDescription || 'Garment Pieces'} - Threadcut QC Rework Return to ${reworkTargetDept}`,
            fabricCode: primaryItem?.fabricCode || 'PIECE',
            colour: primaryItem?.colour || 'Dyed',
            unitType: 'PCS',
            quantity: qRework,
            uom: 'PCS',
            remarks: `Returned for rework/alteration. Reason: ${reworkReason || effectiveRemark}`,
          },
        });

      }

      // F. Keep rejected garments on the Threadcut QC departmental shelf.
      let rejectReturnChallan: any = null;
      if (qFailed > 0) {
        const savedDefect = await tx.defectRecord.create({
          data: {
            defectCode: `DEF-THREADCUT-QC-${Date.now().toString().slice(-6)}-${crypto.randomUUID().slice(0, 6)}`,
            programId: challan.programId,
            productionSheetNumber: challan.program?.programSerialNo || challan.program?.programNumber,
            challanId: challan.id,
            departmentCode: 'THREADCUT_QC',
            shelfCode: 'DEF-SHELF-THREADCUT-QC',
            color: primaryItem?.colour || challan.program?.fabricColor || null,
            fabricType: challan.program?.fabricType || challan.program?.fabricName || primaryItem?.fabricCode || null,
            quantityUnit: uom,
            responsibleIncharge: actorUser?.fullName || null,
            itemDescription: primaryItem?.itemDescription || `${challan.program?.styleCode || 'Garment'} - Threadcut QC defect`,
            severity: 'CRITICAL',
            quantity: qFailed,
            reason: String(defectRemarks).trim(),
            detectedById: actorId,
            status: 'OPEN',
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

      // F.2 Forward Passed pieces to Washing Department if result is PASS
      let passForwardChallan: any = null;
      if (normalizedResult === 'PASS' && qPassed > 0) {

        passForwardChallan = await tx.challan.create({
          data: {
            challanNumber: passChallanNumber,
            challanType: 'THREADCUT_QC_TO_WASHING',
            programId: challan.programId,
            parentChallanId: challan.id,
            fromDepartment: 'THREADCUT_QC',
            toDepartment: 'WASHING',
            status: 'ISSUED',
            priority: challan.priority || 'NORMAL',
            createdById: actorId,
            issuedById: actorId,
            issuedDate: new Date(),
            fabricIn: qPassed,
            defectivePieces: 0,
            fabricOut: qPassed,
            fabricUnit: uom,
            detectedFromDepartment: 'THREADCUT_QC',
            detectedFromChallanId: challan.id,
            remarks: `Threadcut QC Passed Garments — Handover to Washing Department for Sheet ${challan.program?.programSerialNo || challan.program?.programNumber || ''}. QC Incharge Remark: ${effectiveRemark}`,
            items: {
              create: [
                {
                  itemDescription: `${primaryItem?.itemDescription || 'Garment Pieces'} — Washed Handover Lot`,
                  fabricCode: primaryItem?.fabricCode || 'PIECE',
                  colour: primaryItem?.colour || 'Standard',
                  unitType: 'PCS',
                  quantity: qPassed,
                  uom: uom,
                  remarks: `Inspected & Passed by Threadcut QC Gate. Approved for Washing: ${effectiveRemark}`,
                },
              ],
            },
          },
        });
      }

      // G. Update Main Challan status
      const updatedMainChallan = await tx.challan.update({
        where: { id: challan.id },
        data: {
          status: targetChallanStatus,
          defectivePieces: (Number(challan.defectivePieces) || 0) + qFailed,
          defectiveShelfLocation: qFailed > 0 ? 'DEF-SHELF-THREADCUT-QC' : challan.defectiveShelfLocation,
          defectReason: qFailed > 0 ? String(defectRemarks).trim() : challan.defectReason,
          remarks: `${challan.remarks ? challan.remarks + ' | ' : ''}Threadcut QC Inspection ${normalizedResult}: Inspected ${qInspected} ${uom}, Passed ${qPassed}, Failed to Defected Shelf ${qFailed}, Rework ${qRework}. ${effectiveRemark}`,
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
          notes: `Threadcut QC Inspection completed. Result: ${normalizedResult} (Passed: ${qPassed} ${uom}, Failed: ${qFailed}, Rework: ${qRework}). ${effectiveRemark}`,
          actorId: actorId,
        },
      });

      return {
        inspection,
        prodTx,
        reworkReturnChallan,
        rejectReturnChallan,
        passForwardChallan,
        updatedChallan: updatedMainChallan,
      };
    });

    return NextResponse.json({
      success: true,
      message: `Threadcut QC inspection completed: ${normalizedResult}. Passed: ${qPassed} ${uom}, Rejected and quarantined on the Threadcut QC shelf: ${qFailed} ${uom}, Rework: ${qRework} ${uom}.`,
      data: {
        inspectionId: transactionResult.inspection.id,
        result: normalizedResult,
        status: targetChallanStatus,
        quantityPassed: qPassed,
        quantityFailed: qFailed,
        quantityRework: qRework,
        defectiveReturnChallan: transactionResult.rejectReturnChallan?.challanNumber || null,
        reworkReturnChallan: transactionResult.reworkReturnChallan?.challanNumber || null,
        passForwardChallan: transactionResult.passForwardChallan?.challanNumber || null,
        challan: transactionResult.updatedChallan,
      },
    });
  } catch (error: any) {
    if (isDuplicateChallanNumberError(error)) {
      return duplicateChallanNumberResponse();
    }
    console.error('Error submitting Threadcut QC inspection:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to submit Threadcut QC inspection' },
      { status: 500 }
    );
  }
}
