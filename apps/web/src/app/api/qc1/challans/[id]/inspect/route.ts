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

    if (challan.toDepartment !== 'QC1') {
      return NextResponse.json(
        { error: `Challan ${challan.challanNumber} is not routed to QC1.` },
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
        { error: 'QC1 has only three valid decisions: PASS, REWORK, and REJECT. Please select one of these three decisions.' },
        { status: 400 }
      );
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
          { departmentCode: 'QC1' },
          { username: 'admin' },
        ],
      },
      select: { id: true, fullName: true, username: true },
    });
    if (!actorUser) {
      actorUser = await prisma.user.findFirst({ select: { id: true, fullName: true, username: true } });
    }
    const actorId = actorUser?.id || '';

    const primaryItem = challan.items[0];
    const uom = primaryItem?.uom || challan.program?.quantityMeasurement || 'MTR';
    const effectiveColor = observedColor || primaryItem?.colour || challan.program?.fabricColor || 'Standard';

    // 5. Transactional Execution
    const transactionResult = await prisma.$transaction(
      async (tx) => {
        // A. Create QualityInspection Record
        const inspection = await tx.qualityInspection.create({
          data: {
            challanId: id,
            programId: challan.programId,
            departmentCode: 'QC1',
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
              expectedValue: primaryItem?.colour || challan.program?.fabricColor || 'Target Color',
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
            departmentCode: 'QC1',
            operationName: 'QC1_FABRIC_INSPECTION',
            operatorId: actorId,
            inputQuantity: qInspected,
            goodQuantity: qPassed,
            rejectQuantity: qFailed,
            reworkQuantity: qRework,
            balanceQuantity: 0,
            unitOfMeasure: uom,
            reworkReason: reworkReason || null,
            rejectReason: defectRemarks || (normalizedResult === 'REJECT' ? effectiveRemark : null),
            notes: effectiveRemark || `QC1 Inspection complete: ${normalizedResult}. Passed: ${qPassed} ${uom}`,
            recordedAt: new Date(),
          },
        });

        // E. Return Rework yardage to Dyeing Department if rework quantity > 0 (Rule 5)
        let reworkReturnChallan = null;
        if (qRework > 0) {
          const year = new Date().getFullYear();
          const retPrefix = `CH-RET-QC1-${year}-`;
          const retCount = await tx.challan.count({
            where: { challanNumber: { startsWith: retPrefix } },
          });
          const returnChallanNumber = `${retPrefix}${String(retCount + 1).padStart(5, '0')}`;

          reworkReturnChallan = await tx.challan.create({
            data: {
              challanNumber: returnChallanNumber,
              challanType: 'REWORK_RETURN',
              programId: challan.programId,
              parentChallanId: challan.id, // Direct genealogy back to Dyeing -> QC1 Challan!
              fromDepartment: 'QC1',
              toDepartment: 'DYEING',
              status: 'ISSUED',
              priority: challan.priority || 'HIGH',
              createdById: actorId,
              issuedById: actorId,
              issuedDate: new Date(),
              remarks: `QC1 Rework/Alter Return for Sheet ${challan.program.programSerialNo || challan.program.programNumber}. Reason: ${reworkReason || effectiveRemark}. Must go through QC1 again before Embroidery.`,
            },
          });

          await tx.challanItem.create({
            data: {
              challanId: reworkReturnChallan.id,
              itemDescription: `${primaryItem?.itemDescription || 'Dyed Fabric'} - QC1 Rework Return`,
              fabricCode: primaryItem?.fabricCode || 'KNIT',
              colour: effectiveColor,
              unitType: 'ROLL',
              quantity: qRework,
              uom,
              remarks: `Returned for rework/alteration. Must go through QC1 again: ${reworkReason || effectiveRemark}`,
            },
          });
        }

        // E.2 Return Rejected / Defective yardage to Fabric Store Defective Shelf if failed quantity > 0 (Rule 6)
        let rejectReturnChallan = null;
        if (qFailed > 0) {
          const year = new Date().getFullYear();
          const rejPrefix = `CH-REJ-QC1-${year}-`;
          const rejCount = await tx.challan.count({
            where: { challanNumber: { startsWith: rejPrefix } },
          });
          const rejectChallanNumber = `${rejPrefix}${String(rejCount + 1).padStart(5, '0')}`;

          rejectReturnChallan = await tx.challan.create({
            data: {
              challanNumber: rejectChallanNumber,
              challanType: 'DEFECTIVE_RETURN',
              programId: challan.programId,
              parentChallanId: challan.id, // Full genealogy back to Dyeing -> QC1 Challan
              fromDepartment: 'QC1',
              toDepartment: 'STORE',
              status: 'ISSUED',
              priority: challan.priority || 'NORMAL',
              createdById: actorId,
              issuedById: actorId,
              issuedDate: new Date(),
              remarks: `QC1 Defective Return to Fabric Store Defective Shelf (DEF-SHELF-01) for Sheet ${challan.program.programSerialNo || challan.program.programNumber}. Reason: ${defectRemarks || effectiveRemark}. Strictly forbidden for Embroidery.`,
            },
          });

          await tx.challanItem.create({
            data: {
              challanId: rejectReturnChallan.id,
              itemDescription: `${primaryItem?.itemDescription || 'Dyed Fabric'} - DEFECTIVE SHELF (DEF-SHELF-01)`,
              fabricCode: primaryItem?.fabricCode || 'KNIT',
              colour: effectiveColor,
              unitType: 'ROLL',
              quantity: qFailed,
              uom,
              remarks: `QC_REJECTED: Allocated to Fabric Store Defective Shelf. Not approved for Embroidery. Reason: ${defectRemarks || effectiveRemark}`,
            },
          });
        }

        // E.3 Forward Passed yardage to Embroidery Department if result is PASS (Rule 7)
        let passForwardChallan = null;
        if (normalizedResult === 'PASS' && qPassed > 0) {
          const year = new Date().getFullYear();
          const fwdPrefix = `CH-EMB-QC1-${year}-`;
          const fwdCount = await tx.challan.count({
            where: { challanNumber: { startsWith: fwdPrefix } },
          });
          const passChallanNumber = `${fwdPrefix}${String(fwdCount + 1).padStart(5, '0')}`;

          passForwardChallan = await tx.challan.create({
            data: {
              challanNumber: passChallanNumber,
              challanType: 'QC1_TO_EMBROIDERY',
              programId: challan.programId,
              parentChallanId: challan.id,
              fromDepartment: 'QC1',
              toDepartment: 'EMBROIDERY',
              status: 'ISSUED',
              priority: challan.priority || 'NORMAL',
              createdById: actorId,
              issuedById: actorId,
              issuedDate: new Date(),
              remarks: `QC1 Passed Fabric — Approved for Embroidery Department for Sheet ${challan.program?.programSerialNo || challan.program?.programNumber || ''}. QC Incharge Remark: ${effectiveRemark}`,
            },
          });

          await tx.challanItem.create({
            data: {
              challanId: passForwardChallan.id,
              itemDescription: `${primaryItem?.itemDescription || 'QC1 Approved Fabric'} — Embroidery Lot`,
              fabricCode: primaryItem?.fabricCode || 'FABRIC',
              colour: effectiveColor,
              unitType: 'ROLL',
              quantity: qPassed,
              uom,
              remarks: `Inspected & Passed by QC1 Gate. Approved for Embroidery: ${effectiveRemark}`,
            },
          });
        }

        // F. Compute final status for the Dyeing -> QC1 Challan
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
            remarks: [
              challan.remarks,
              `QC1 Result: ${normalizedResult} (Pass: ${qPassed} → Embroidery | Rework: ${qRework} → Dyeing | Reject: ${qFailed} → Store Defective Shelf ${uom}) | QC Remark: ${effectiveRemark}`,
              passForwardChallan ? `Embroidery Challan: ${passForwardChallan.challanNumber}` : null,
              reworkReturnChallan ? `Rework Challan (Dyeing): ${reworkReturnChallan.challanNumber}` : null,
              rejectReturnChallan ? `Defective Shelf Challan (Store): ${rejectReturnChallan.challanNumber}` : null,
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
            action: 'QC1_INSPECTION_COMPLETED',
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
      message: `QC1 inspection recorded successfully: ${result}.`,
      data: transactionResult,
    });
  } catch (error: any) {
    console.error('Error completing QC1 inspection:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to complete QC1 inspection.' },
      { status: 500 }
    );
  }
}
