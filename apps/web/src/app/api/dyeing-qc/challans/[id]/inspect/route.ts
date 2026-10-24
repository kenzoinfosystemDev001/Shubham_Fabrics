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
      observedColor,
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

    if (challan.toDepartment !== 'DYEING_QC') {
      return NextResponse.json(
        { error: `Challan ${challan.challanNumber} is not routed to Dyeing QC.` },
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

    // Must be in RECEIVED or UNDER_INSPECTION
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
          error: `Quantity Inspected (${qInspected}) cannot exceed Quantity Received from Dyeing (${totalReceivedQty}).`,
        },
        { status: 400 }
      );
    }

    const sumCategories = qPassed + qFailed + qRework + qHold;
    // Allow slight float precision variance (0.001)
    if (sumCategories > qInspected + 0.001) {
      return NextResponse.json(
        {
          error: `The sum of Passed (${qPassed}) + Failed (${qFailed}) + Rework (${qRework}) + Hold (${qHold}) = ${sumCategories}, which exceeds Quantity Inspected (${qInspected}).`,
        },
        { status: 400 }
      );
    }

    // 3. Strict 3 Decisions: PASS, REWORK, REJECT (Rule 4)
    const normalizedResult = result === 'FAIL' ? 'REJECT' : result;
    const validResults = ['PASS', 'REWORK', 'REJECT'];
    if (!normalizedResult || !validResults.includes(normalizedResult)) {
      return NextResponse.json(
        { error: 'Dyeing QC has only three valid decisions: PASS, REWORK, and REJECT. Please select one of these three decisions.' },
        { status: 400 }
      );
    }

    if (qFailed > 0 && !String(defectRemarks || '').trim()) {
      return NextResponse.json({ error: 'A specific defect reason is required for rejected material.' }, { status: 400 });
    }

    // Rule 4: Every decision requires a remark from the QC Incharge.
    const effectiveRemark = (remarks || defectRemarks || reworkReason || '').trim();
    if (!effectiveRemark) {
      return NextResponse.json(
        { error: 'A remark from the QC Incharge is strictly mandatory for every inspection decision (PASS, REWORK, or REJECT).' },
        { status: 400 }
      );
    }

    if (normalizedResult === 'PASS' && qPassed <= 0) {
      return NextResponse.json(
        { error: 'Result is set to PASS, but Passed Quantity is 0. Please enter the passed quantity.' },
        { status: 400 }
      );
    }

    if (normalizedResult === 'REJECT') {
      if (qFailed <= 0) {
        return NextResponse.json(
          { error: 'Result is set to REJECT, but Rejected Quantity is 0. Please record the defective yardage for the Defective Shelf.' },
          { status: 400 }
        );
      }
    }

    if (normalizedResult === 'REWORK') {
      if (qRework <= 0) {
        return NextResponse.json(
          { error: 'Result is set to REWORK, but Rework Quantity is 0. Please specify the rework yardage to return to Dyeing.' },
          { status: 400 }
        );
      }
    }

    // 4. Resolve Authenticated Inspector
    let actorUser = await prisma.user.findFirst({
      where: {
        OR: [
          { id: inspectorId || '' },
          { username: 'qc_insp' },
          { username: 'qc1' },
          { departmentCode: 'DYEING_QC' },
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
      const auth = await authorizeDefectReport(request, 'DYEING_QC');
      if (!auth.actor) return auth.response;
      actorId = auth.actor.id;
      actorUser = { id: auth.actor.id, fullName: auth.actor.fullName, username: auth.actor.roles[0] || 'DYEING_QC' };
    }

    const primaryItem = challan.items[0];
    const uom = primaryItem?.uom || challan.program?.quantityMeasurement || 'MTR';
    const effectiveColor = observedColor || primaryItem?.colour || challan.program?.fabricColor || 'Standard';

    // Numbers for the challans this decision issues are entered manually by the QC Incharge.
    const issuesPassChallan = normalizedResult === 'PASS' && qPassed > 0;
    const issuesReworkChallan = qRework > 0;
    const numberChecks = await validateManualChallanNumbers([
      ...(issuesPassChallan ? [{ value: body.passChallanNumber, label: 'Challan Number (passed material to Embroidery)' }] : []),
      ...(issuesReworkChallan ? [{ value: body.reworkChallanNumber, label: 'Challan Number (rework return)' }] : []),
    ]);
    if (!numberChecks.ok) return challanNumberErrorResponse(numberChecks);
    const passChallanNumber = issuesPassChallan ? numberChecks.challanNumbers[0] : '';
    const reworkChallanNumber = issuesReworkChallan ? numberChecks.challanNumbers[issuesPassChallan ? 1 : 0] : '';
    const departmentBlocked = await inactiveDepartmentError(prisma, ['DYEING_QC', issuesPassChallan ? 'EMBROIDERY' : null, issuesReworkChallan ? challan.fromDepartment || 'DYEING' : null]);
    if (departmentBlocked) return NextResponse.json({ error: departmentBlocked }, { status: 409 });

    // 5. Transactional Execution
    const transactionResult = await prisma.$transaction(
      async (tx) => {
        // A. Create QualityInspection Record
        const inspection = await tx.qualityInspection.create({
          data: {
            challanId: id,
            programId: challan.programId,
            departmentCode: 'DYEING_QC',
            inspectorId: actorId,
            sampleSize: Math.round(qInspected),
            status: normalizedResult,
            notes: [
              effectiveRemark,
              defectRemarks ? `Defects: ${defectRemarks}` : null,
              reworkReason ? `Rework: ${reworkReason}` : null,
              observedColor ? `Observed Shade: ${observedColor}` : null,
            ]
              .filter(Boolean)
              .join(' | ') || null,
            inspectedAt: new Date(),
          },
        });

        // B. Create Traceable Parameters in QualityInspectionParameter
        await tx.qualityInspectionParameter.createMany({
          data: [
            {
              inspectionId: inspection.id,
              parameterName: 'COLOR_SHADE_MATCH',
              expectedValue: primaryItem?.requiredDyeColor || primaryItem?.colour || challan.program?.fabricColor || 'Target Color',
              measuredValue: observedColor || primaryItem?.colour || 'Standard',
              status: normalizedResult === 'REJECT' && defectRemarks?.toLowerCase().includes('shade') ? 'FAIL' : 'PASS',
              comments: observedColor ? `Observed: ${observedColor}` : 'Matches standard lab dip',
              uom: 'VISUAL',
            },
            {
              inspectionId: inspection.id,
              parameterName: 'QUANTITY_BREAKDOWN',
              expectedValue: `${totalReceivedQty} ${uom}`,
              measuredValue: `Pass: ${qPassed}, Reject: ${qFailed}, Rework: ${qRework}`,
              status: normalizedResult === 'PASS' ? 'PASS' : 'FAIL',
              comments: `Inspected: ${qInspected} ${uom}`,
              uom,
            },
          ],
        });

        // C. Record Defect Logs if defects provided
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
          // Automatic defect log entry for non-zero failed or rework yardage
          await tx.defectLog.create({
            data: {
              inspectionId: inspection.id,
              defectType: normalizedResult === 'REWORK' ? (reworkReason || 'ALTERATION_REWORK') : (defectRemarks || 'FABRIC_DEFECT'),
              count: Math.round(qFailed + qRework),
              severity: normalizedResult === 'REJECT' ? 'CRITICAL' : 'MAJOR',
            },
          });
        }

        // D. Record Production Transaction for traceability and balance accounting
        const prodTx = await tx.productionTransaction.create({
          data: {
            programId: challan.programId,
            challanId: challan.id,
            departmentCode: 'DYEING_QC',
            operationName: 'DYEING_QC_FABRIC_INSPECTION',
            operatorId: actorId,
            inputQuantity: qInspected,
            goodQuantity: qPassed,
            rejectQuantity: qFailed,
            reworkQuantity: qRework,
            balanceQuantity: 0,
            unitOfMeasure: uom,
            reworkReason: reworkReason || null,
            rejectReason: defectRemarks || (normalizedResult === 'REJECT' ? effectiveRemark : null),
            notes: effectiveRemark || `Dyeing QC Inspection complete: ${normalizedResult}. Passed: ${qPassed} ${uom}`,
            recordedAt: new Date(),
          },
        });

        // E. Return Rework yardage to the incoming challan's source department (Dyeing) if rework quantity > 0 (Rule 5)
        let reworkReturnChallan = null;
        if (qRework > 0) {

          reworkReturnChallan = await tx.challan.create({
            data: {
              challanNumber: reworkChallanNumber,
              challanType: 'REWORK_RETURN',
              programId: challan.programId,
              parentChallanId: challan.id, // Direct genealogy back to Dyeing -> Dyeing QC Challan!
              fromDepartment: 'DYEING_QC',
              toDepartment: challan.fromDepartment || 'DYEING',
              status: 'ISSUED',
              priority: challan.priority || 'HIGH',
              createdById: actorId,
              issuedById: actorId,
              issuedDate: new Date(),
              remarks: `Dyeing QC Rework/Alter Return for Sheet ${challan.program.programSerialNo || challan.program.programNumber}. Reason: ${reworkReason || effectiveRemark}. Must go through Dyeing QC again before Embroidery.`,
            },
          });

          await tx.challanItem.create({
            data: {
              challanId: reworkReturnChallan.id,
              itemDescription: `${primaryItem?.itemDescription || 'Dyed Fabric'} - Dyeing QC Rework Return`,
              fabricCode: primaryItem?.fabricCode || 'KNIT',
              colour: effectiveColor,
              unitType: 'ROLL',
              quantity: qRework,
              uom,
              remarks: `Returned for rework/alteration. Must go through Dyeing QC again: ${reworkReason || effectiveRemark}`,
            },
          });

        }

        // E.2 Keep rejected yardage on the Dyeing QC departmental shelf.
        let rejectReturnChallan: any = null;
        if (qFailed > 0) {
          const savedDefect = await tx.defectRecord.create({
            data: {
              defectCode: `DEF-DYEING-QC-${Date.now().toString().slice(-6)}-${crypto.randomUUID().slice(0, 6)}`,
              programId: challan.programId,
              productionSheetNumber: challan.program?.programSerialNo || challan.program?.programNumber,
              challanId: challan.id,
              departmentCode: 'DYEING_QC',
              shelfCode: 'DEF-SHELF-DYEING-QC',
              color: effectiveColor,
              fabricType: challan.program?.fabricType || challan.program?.fabricName || primaryItem?.fabricCode || null,
              quantityUnit: uom,
              responsibleIncharge: actorUser?.fullName || null,
              itemDescription: primaryItem?.itemDescription || `${challan.program?.styleCode || 'Dyed Fabric'} - Dyeing QC defect`,
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

        // E.3 Forward Passed yardage to Embroidery Department if result is PASS (Rule 7)
        let passForwardChallan = null;
        if (normalizedResult === 'PASS' && qPassed > 0) {

          passForwardChallan = await tx.challan.create({
            data: {
              challanNumber: passChallanNumber,
              challanType: 'DYEING_QC_TO_EMBROIDERY',
              programId: challan.programId,
              parentChallanId: challan.id,
              fromDepartment: 'DYEING_QC',
              toDepartment: 'EMBROIDERY',
              status: 'ISSUED',
              priority: challan.priority || 'NORMAL',
              createdById: actorId,
              issuedById: actorId,
              issuedDate: new Date(),
              fabricIn: qPassed,
              defectivePieces: 0,
              fabricOut: qPassed,
              fabricUnit: uom,
              detectedFromDepartment: 'DYEING_QC',
              detectedFromChallanId: challan.id,
              remarks: `Dyeing QC Passed Fabric — Approved for Embroidery Department for Sheet ${challan.program?.programSerialNo || challan.program?.programNumber || ''}. QC Incharge Remark: ${effectiveRemark}`,
            },
          });

          await tx.challanItem.create({
            data: {
              challanId: passForwardChallan.id,
              itemDescription: `${primaryItem?.itemDescription || 'Dyeing QC Approved Fabric'} — Embroidery Lot`,
              fabricCode: primaryItem?.fabricCode || 'FABRIC',
              colour: effectiveColor,
              unitType: 'ROLL',
              quantity: qPassed,
              uom,
              remarks: `Inspected & Passed by Dyeing QC Gate. Approved for Embroidery: ${effectiveRemark}`,
            },
          });
        }

        // F. Compute final status for the Dyeing -> Dyeing QC Challan
        let newChallanStatus = 'QC_APPROVED';
        if (normalizedResult === 'REJECT') {
          newChallanStatus = 'QC_REJECTED';
        } else if (normalizedResult === 'REWORK') {
          newChallanStatus = 'REWORK_REQUESTED';
        }

        const updatedChallan = await tx.challan.update({
          where: { id },
          data: {
            status: newChallanStatus,
            completedDate: new Date(),
            fabricIn: challan.fabricIn ?? qInspected,
            defectivePieces: (challan.defectivePieces || 0) + qFailed,
            fabricOut: qPassed,
            fabricUnit: uom,
            defectiveShelfLocation: qFailed > 0 ? 'DEF-SHELF-DYEING-QC' : challan.defectiveShelfLocation,
            defectReason: qFailed > 0 ? (defectRemarks || effectiveRemark) : challan.defectReason,
            remarks: [
              challan.remarks,
              `Dyeing QC Result: ${normalizedResult} (Pass: ${qPassed} → Embroidery | Rework: ${qRework} → Dyeing | Reject: ${qFailed} → Dyeing QC Defective Shelf ${uom}) | QC Remark: ${effectiveRemark}`,
              passForwardChallan ? `Embroidery Challan: ${passForwardChallan.challanNumber}` : null,
              reworkReturnChallan ? `Rework Challan (Dyeing): ${reworkReturnChallan.challanNumber}` : null,
              rejectReturnChallan ? `Dyeing QC Defective Shelf` : null,
            ]
              .filter(Boolean)
              .join(' | '),
          },
          include: {
            program: true,
            items: true,
          },
        });

        // G. Log Challan Event
        await tx.challanEvent.create({
          data: {
            challanId: id,
            fromStatus: challan.status,
            toStatus: newChallanStatus,
            action: 'QC_INSPECTION_COMPLETED',
            actorId,
            notes: effectiveRemark,
            metadata: JSON.stringify({
              result: normalizedResult,
              quantityInspected: qInspected,
              quantityPassed: qPassed,
              quantityFailed: qFailed,
              quantityRework: qRework,
              uom,
              reworkReturnChallanNumber: reworkReturnChallan?.challanNumber || null,
              rejectReturnChallanNumber: rejectReturnChallan?.challanNumber || null,
              passForwardChallanNumber: passForwardChallan?.challanNumber || null,
            }),
          },
        });

        // H. Log System Audit Log
        await tx.auditLog.create({
          data: {
            action: 'DYEING_QC_INSPECTION_COMPLETED',
            entity: 'QualityInspection',
            entityId: inspection.id,
            actor: { connect: { id: actorId } },
            afterState: JSON.stringify({
              challanNumber: challan.challanNumber,
              result: normalizedResult,
              quantityInspected: qInspected,
              quantityPassed: qPassed,
              quantityFailed: qFailed,
              quantityRework: qRework,
              qcRemark: effectiveRemark,
              reworkReturnChallan: reworkReturnChallan?.challanNumber || null,
              rejectReturnChallan: rejectReturnChallan?.challanNumber || null,
              passForwardChallan: passForwardChallan?.challanNumber || null,
              inspector: actorUser?.fullName || actorUser?.username,
            }),
          },
        });

        return {
          inspection,
          productionTransaction: prodTx,
          passForwardChallan,
          reworkReturnChallan,
          rejectReturnChallan,
          challan: updatedChallan,
        };
      },
      { maxWait: 15000, timeout: 30000 }
    );

    return NextResponse.json({
      message: `Dyeing QC inspection recorded successfully: ${result}.`,
      data: transactionResult,
    });
  } catch (error: any) {
    if (isDuplicateChallanNumberError(error)) {
      return duplicateChallanNumberResponse();
    }
    console.error('Error completing Dyeing QC inspection:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to complete Dyeing QC inspection.' },
      { status: 500 }
    );
  }
}
