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

    const validDepts = ['QC3', 'QCWASHING', 'QC_WASHING', 'WASHING_QC', 'QC WASHING'];
    if (!validDepts.includes(challan.toDepartment.toUpperCase())) {
      return NextResponse.json(
        { error: `Challan ${challan.challanNumber} is not routed to QC Washing.` },
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

    if (normalizedResult === 'REJECT' && !defectRemarks?.trim() && !remarks?.trim()) {
      return NextResponse.json(
        { error: 'Defect remarks are mandatory when rejecting pieces at QC Washing.' },
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
        { error: 'Rework reason is mandatory when requesting re-wash / alteration from Washing.' },
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
          { departmentCode: 'QC3' },
          { departmentCode: 'QCWASHING' },
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
      `QC Washing inspection completed: ${normalizedResult}`;

    // 5. ATOMIC TRANSACTION
    const transactionResult = await prisma.$transaction(async (tx) => {
      // A. Create QualityInspection Record
      const inspection = await tx.qualityInspection.create({
        data: {
          challanId: challan.id,
          programId: challan.programId,
          departmentCode: 'QC3',
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

          // 2. Factory DefectRecord (defective shelf tracking)
          await tx.defectRecord.create({
            data: {
              defectCode: d.defectCode || d.defectType || `DEF-QC3-${Date.now().toString().slice(-4)}`,
              programId: challan.programId,
              challanId: challan.id,
              departmentCode: 'QC3',
              itemDescription: `Washed garment defect (${d.location || 'Garment Body'})`,
              severity: d.severity || 'MAJOR',
              quantity: dQty,
              reason: d.remarks || d.notes || defectRemarks || 'Washing Quality Defect',
              detectedById: actorId,
              status: normalizedResult === 'REWORK' ? 'REWORK' : 'OPEN',
              resolutionNotes: `Logged during QC Washing inspection. Action: ${normalizedResult === 'REWORK' ? 'Re-wash Cycle' : 'Quarantine / Scrap'}`,
            },
          });
        }
      }

      // D. If Failed Pieces exist -> Create Defective Shelf Return Challan
      let defectiveReturnChallan: any = null;
      if (qFailed > 0) {
        const nextRetNum = `DEF-QC3-${Date.now().toString().slice(-6)}`;
        defectiveReturnChallan = await tx.challan.create({
          data: {
            challanNumber: nextRetNum,
            challanType: 'DEFECTIVE_RETURN',
            programId: challan.programId,
            fromDepartment: 'QC3',
            toDepartment: 'STORE',
            parentChallanId: challan.id,
            status: 'ISSUED',
            priority: 'NORMAL',
            remarks: `Defective pieces quarantined at QC Washing. Defective Shelf: DEF-SHELF-QC3 (Washing QC Defective Shelf). Reason: ${defectRemarks || remarks || 'Washing Quality Failure'}`,
            createdById: actorId,
            issuedById: actorId,
            issuedDate: new Date(),
            items: {
              create: [
                {
                  itemDescription: `${primaryItem?.itemDescription || 'Garment Pieces'} - Defective / Rejected at QC Washing`,
                  fabricCode: primaryItem?.fabricCode || 'PIECE',
                  colour: primaryItem?.colour || 'Standard',
                  quantity: qFailed,
                  uom: uom,
                  unitType: primaryItem?.unitType || 'PCS',
                  remarks: defectRemarks || 'Failed wash inspection',
                },
              ],
            },
          },
        });
      }

      // E. If Rework Pieces exist -> Create Rework Challan back to WASHING
      let reworkChallan: any = null;
      if (qRework > 0) {
        const nextRewNum = `REW-QC3-${Date.now().toString().slice(-6)}`;
        reworkChallan = await tx.challan.create({
          data: {
            challanNumber: nextRewNum,
            challanType: 'REWORK_HANDOFF',
            programId: challan.programId,
            fromDepartment: 'QC3',
            toDepartment: 'WASHING',
            parentChallanId: challan.id,
            status: 'ISSUED',
            priority: 'HIGH',
            remarks: `Pieces sent for re-wash from QC Washing. Reason: ${reworkReason || remarks || 'Re-washing & softening required'}`,
            createdById: actorId,
            issuedById: actorId,
            issuedDate: new Date(),
            items: {
              create: [
                {
                  itemDescription: `${primaryItem?.itemDescription || 'Garment Pieces'} - Rework / Re-Wash`,
                  fabricCode: primaryItem?.fabricCode || 'PIECE',
                  colour: primaryItem?.colour || 'Standard',
                  quantity: qRework,
                  uom: uom,
                  unitType: primaryItem?.unitType || 'PCS',
                  remarks: reworkReason || 'Requires re-washing',
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
          departmentCode: 'QC3',
          operationName: 'QC_WASHING_INSPECTION',
          operatorId: actorId,
          inputQuantity: qInspected,
          goodQuantity: qPassed,
          reworkQuantity: qRework,
          rejectQuantity: qFailed,
          wasteQuantity: 0,
          balanceQuantity: qHold,
          unitOfMeasure: uom || 'PCS',
          recordedAt: new Date(),
          notes: `QC Washing Verification: Passed=${qPassed}, Failed=${qFailed}, Rework=${qRework}, Hold=${qHold}`,
        },
      });

      // G. Update Main Challan Status
      const updatedChallan = await tx.challan.update({
        where: { id: challan.id },
        data: {
          status: targetChallanStatus,
          fabricIn: qInspected,
          fabricOut: qPassed,
          defectivePieces: qFailed,
          defectReason: defectRemarks || reworkReason || null,
          remarks: `${challan.remarks ? challan.remarks + ' | ' : ''}QC Washing Inspection: ${normalizedResult} (Passed=${qPassed}, Failed=${qFailed}, Rework=${qRework})`,
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
          notes: `Inspection completed by ${actorUser?.fullName || 'QC Washing Inspector'}: ${normalizedResult} (Passed: ${qPassed}, Failed: ${qFailed}, Rework: ${qRework})`,
          actorId: actorId,
        },
      });

      return {
        updatedChallan,
        inspection,
        defectiveReturnChallan,
        reworkChallan,
      };
    });

    return NextResponse.json({
      success: true,
      message: `QC Washing verification recorded successfully. Status: ${transactionResult.updatedChallan.status}`,
      data: transactionResult.updatedChallan,
      inspection: transactionResult.inspection,
      defectiveReturn: transactionResult.defectiveReturnChallan,
      reworkChallan: transactionResult.reworkChallan,
    });
  } catch (error: any) {
    console.error('Error recording QC Washing inspection:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to record QC Washing inspection' },
      { status: 500 }
    );
  }
}
