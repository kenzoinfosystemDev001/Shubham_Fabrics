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

    const validDepts = ['WASHING_QC'];
    if (!validDepts.includes(challan.toDepartment.toUpperCase())) {
      return NextResponse.json(
        { error: `Challan ${challan.challanNumber} is not routed to Washing QC.` },
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

    // 2. Strict Validations on Quantities
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
          error: `Quantity Inspected (${qInspected}) cannot exceed Quantity Received from Washing (${totalReceivedQty}).`,
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
        { error: 'A specific defect reason is required for rejected pieces at Washing QC.' },
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
        { error: 'Rework reason is mandatory when requesting re-wash / alteration at Washing QC.' },
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
          { username: 'qcwashing' },
          { username: 'qc3' },
          { departmentCode: 'WASHING_QC' },
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
      const auth = await authorizeDefectReport(request, 'WASHING_QC');
      if (!auth.actor) return auth.response;
      actorId = auth.actor.id;
      actorUser = { id: auth.actor.id, fullName: auth.actor.fullName, username: auth.actor.roles[0] || 'WASHING_QC' };
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
      `Washing QC inspection completed: ${normalizedResult}`;

    // Numbers for the challans this decision issues are entered manually by the QC Incharge.
    const issuesPassChallan = normalizedResult === 'PASS' && qPassed > 0;
    const issuesReworkChallan = qRework > 0;
    const numberChecks = await validateManualChallanNumbers([
      ...(issuesPassChallan ? [{ value: body.passChallanNumber, label: 'Challan Number (passed material to Recutting)' }] : []),
      ...(issuesReworkChallan ? [{ value: body.reworkChallanNumber, label: 'Challan Number (rework return)' }] : []),
    ]);
    if (!numberChecks.ok) return challanNumberErrorResponse(numberChecks);
    const passChallanNumber = issuesPassChallan ? numberChecks.challanNumbers[0] : '';
    const reworkChallanNumber = issuesReworkChallan ? numberChecks.challanNumbers[issuesPassChallan ? 1 : 0] : '';
    const departmentBlocked = await inactiveDepartmentError(prisma, ['WASHING_QC', issuesPassChallan ? 'RECUTTING' : null, issuesReworkChallan ? challan.fromDepartment || 'WASHING' : null]);
    if (departmentBlocked) return NextResponse.json({ error: departmentBlocked }, { status: 409 });

    // 5. ATOMIC TRANSACTION
    const transactionResult = await prisma.$transaction(async (tx) => {
      // A. Create QualityInspection Record
      const inspection = await tx.qualityInspection.create({
        data: {
          challanId: challan.id,
          programId: challan.programId,
          departmentCode: 'WASHING_QC',
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
      }

      // C. Save Defect Records and Inspection Defect Logs if failed or rework
      if (Array.isArray(defects) && defects.length > 0) {
        for (const d of defects) {
          const dQty = Number(d.quantity || d.defectCount || 1);
          // 1. QualityInspection DefectLog
          await tx.defectLog.create({
            data: {
              inspectionId: inspection.id,
              defectType: d.defectCode || d.defectType || 'WASH_DEFECT',
              severity: d.severity || 'MAJOR',
              count: dQty,
            },
          });

        }
      }

      // D. Keep failed pieces on the Washing QC departmental shelf.
      let defectiveReturnChallan: any = null;
      if (qFailed > 0) {
        const savedDefect = await tx.defectRecord.create({
          data: {
            defectCode: `DEF-WASHING-QC-${Date.now().toString().slice(-6)}-${crypto.randomUUID().slice(0, 6)}`,
            programId: challan.programId,
            productionSheetNumber: challan.program?.programSerialNo || challan.program?.programNumber,
            challanId: challan.id,
            departmentCode: 'WASHING_QC',
            shelfCode: 'DEF-SHELF-WASHING-QC',
            color: primaryItem?.colour || challan.program?.fabricColor || null,
            fabricType: challan.program?.fabricType || challan.program?.fabricName || primaryItem?.fabricCode || null,
            quantityUnit: uom,
            responsibleIncharge: actorUser?.fullName || null,
            itemDescription: primaryItem?.itemDescription || `${challan.program?.styleCode || 'Garment'} - Washing QC defect`,
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

      // E. If Rework Pieces exist -> Create Rework Challan back to SOURCE department (use actual challan.fromDepartment)
      let reworkChallan: any = null;
      if (qRework > 0) {
        // Use the actual source department from the incoming challan, not hardcoded WASHING
        const reworkTargetDept = challan.fromDepartment || 'WASHING';
        reworkChallan = await tx.challan.create({
          data: {
            challanNumber: reworkChallanNumber,
            challanType: 'REWORK_HANDOFF',
            programId: challan.programId,
            fromDepartment: 'WASHING_QC',
            toDepartment: reworkTargetDept,
            parentChallanId: challan.id,
            status: 'ISSUED',
            priority: 'HIGH',
            remarks: `Washing QC rework return to ${reworkTargetDept}. Reason: ${reworkReason || remarks || 'Re-processing required'}. Original Challan: ${challan.challanNumber}`,
            createdById: actorId,
            issuedById: actorId,
            issuedDate: new Date(),
            items: {
              create: [
                {
                  itemDescription: `${primaryItem?.itemDescription || 'Garment Pieces'} - Washing QC Rework Return`,
                  fabricCode: primaryItem?.fabricCode || 'PIECE',
                  colour: primaryItem?.colour || 'Standard',
                  quantity: qRework,
                  uom: uom,
                  unitType: primaryItem?.unitType || 'PCS',
                  remarks: reworkReason || 'Requires re-processing at source department',
                },
              ],
            },
          },
        });
      }

      // E.2 Forward Passed pieces to Recutting Section if result is PASS
      let passForwardChallan: any = null;
      if (normalizedResult === 'PASS' && qPassed > 0) {

        passForwardChallan = await tx.challan.create({
          data: {
            challanNumber: passChallanNumber,
            challanType: 'WASHING_QC_TO_RECUTTING',
            programId: challan.programId,
            parentChallanId: challan.id,
            fromDepartment: 'WASHING_QC',
            toDepartment: 'RECUTTING',
            status: 'ISSUED',
            priority: challan.priority || 'NORMAL',
            createdById: actorId,
            issuedById: actorId,
            issuedDate: new Date(),
            fabricIn: qPassed,
            defectivePieces: 0,
            fabricOut: qPassed,
            fabricUnit: uom,
            detectedFromDepartment: 'WASHING_QC',
            detectedFromChallanId: challan.id,
            remarks: `Washing QC Passed pieces — Handover to Recutting Section for embroidery precision cutting for Sheet ${challan.program?.programSerialNo || challan.program?.programNumber || ''}. Remarks: ${effectiveRemark}`,
            items: {
              create: [
                {
                  itemDescription: `${primaryItem?.itemDescription || 'Garment Pieces'} — Washing QC Passed & Verified for Recutting`,
                  fabricCode: primaryItem?.fabricCode || 'PIECE',
                  colour: primaryItem?.colour || 'Standard',
                  unitType: 'PCS',
                  quantity: qPassed,
                  uom: uom,
                  remarks: `Inspected & Passed by Washing QC. Approved for Recutting: ${effectiveRemark}`,
                },
              ],
            },
          },
        });
      }

      // F. Create Production Transaction Record
      await tx.productionTransaction.create({
        data: {
          programId: challan.programId,
          challanId: challan.id,
          departmentCode: 'WASHING_QC',
          operationName: 'WASHING_QC_INSPECTION',
          operatorId: actorId,
          inputQuantity: qInspected,
          goodQuantity: qPassed,
          reworkQuantity: qRework,
          rejectQuantity: qFailed,
          wasteQuantity: 0,
          balanceQuantity: qHold,
          unitOfMeasure: uom || 'PCS',
          recordedAt: new Date(),
          notes: `Washing QC Verification: Passed=${qPassed}, Failed=${qFailed}, Rework=${qRework}, Hold=${qHold}`,
        },
      });

      // G. Update Main Challan Status
      const updatedChallan = await tx.challan.update({
        where: { id: challan.id },
        data: {
          status: targetChallanStatus,
          fabricIn: qInspected,
          fabricOut: qPassed,
          defectivePieces: (Number(challan.defectivePieces) || 0) + qFailed,
          defectiveShelfLocation: qFailed > 0 ? 'DEF-SHELF-WASHING-QC' : challan.defectiveShelfLocation,
          defectReason: qFailed > 0 ? String(defectRemarks).trim() : challan.defectReason,
          remarks: `${challan.remarks ? challan.remarks + ' | ' : ''}Washing QC Inspection: ${normalizedResult} (Passed=${qPassed}, Failed=${qFailed}, Rework=${qRework})`,
        },
        include: {
          program: true,
          items: true,
          inspections: {
            include: {
              parameters: true,
              defects: true,
              inspector: { select: { fullName: true, username: true } },
            },
            orderBy: { inspectedAt: 'desc' },
            take: 1,
          },
        },
      });

      // H. Create Challan Audit Event
      await tx.challanEvent.create({
        data: {
          challanId: challan.id,
          action: challanEventType,
          fromStatus: challan.status,
          toStatus: targetChallanStatus,
          notes: `Inspection completed by ${actorUser?.fullName || 'Washing QC Inspector'}: ${normalizedResult} (Passed: ${qPassed}, Failed: ${qFailed}, Rework: ${qRework})`,
          actorId: actorId,
        },
      });

      return {
        updatedChallan,
        inspection,
        defectiveReturnChallan,
        reworkChallan,
        passForwardChallan,
      };
    });

    return NextResponse.json({
      success: true,
      message: `Washing QC verification recorded successfully. Status: ${transactionResult.updatedChallan.status}`,
      data: transactionResult.updatedChallan,
      inspection: transactionResult.inspection,
      defectiveReturn: transactionResult.defectiveReturnChallan,
      reworkChallan: transactionResult.reworkChallan,
      passForwardChallan: transactionResult.passForwardChallan,
    });
  } catch (error: any) {
    if (isDuplicateChallanNumberError(error)) {
      return duplicateChallanNumberResponse();
    }
    console.error('Error recording Washing QC inspection:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to record Washing QC inspection' },
      { status: 500 }
    );
  }
}
