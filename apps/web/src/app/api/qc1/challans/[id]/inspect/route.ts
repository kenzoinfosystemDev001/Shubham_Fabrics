import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import { requireDepartment } from '@/lib/auth/department-access';
import {
  assertChallanNumbersAvailable,
  challanNumberErrorResponse,
  requireChallanNumberSet,
} from '@/lib/challan-number-server';
import { MIXED_UNIT, formatTotals, headerUnitOf, totalsByUnit } from '@/lib/challan-units.mjs';
import { lineSheetId } from '@/lib/challan-sheets.mjs';
import { lineLabel, qc1LineQuantities, qc1UnitTotals } from '@/lib/qc1-inspection.mjs';
import { canWriteColumns } from '@/lib/challan-item-average';
import { SHRINKAGE_NOT_SET_UP, ShrinkageError, saveShrinkageForLine, shrinkageTableExists } from '@/lib/shrinkage-server';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'QC1');
  if (!authUser) return authResponse;
  try {
    const { id } = await params;
    const body = await request.json();

    const {
      quantityInspected,
      quantityPassed,
      quantityShrinkage,
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

    // 2. Strict Backend Validations on Quantities, per challan line. Each line keeps its own fabric,
    // colour, unit (MTR or PCS) and Production Sheet; its outcome (pass, shrinkage, rework, hold) is
    // recorded against that line and nothing is ever added across units or split across lines
    // (lib/qc1-inspection). Shrinkage is fabric lost in dyeing, recorded as the line's shrinkage.
    const receivedByUnit = totalsByUnit(challan.items, challan.fabricUnit);
    const challanUnits = Object.keys(receivedByUnit);
    if (challanUnits.length === 0) {
      return NextResponse.json({ error: 'This challan has no quantity to inspect.' }, { status: 400 });
    }
    const lineCheck = qc1LineQuantities(challan.items, { ...body, quantityInspected, quantityPassed, quantityShrinkage, quantityRework, quantityHold });
    if (!lineCheck.ok) {
      return NextResponse.json({ error: lineCheck.error }, { status: 400 });
    }
    const inspectedLines = lineCheck.lines;
    // Per-unit sums of the inspected lines, for header quantities, records and messages.
    const byUnit = qc1UnitTotals(inspectedLines);
    const lineSummary = inspectedLines.map((r) => ({
      challanItemId: r.item.id,
      line: lineLabel(r.item),
      programId: lineSheetId(r.item, challan),
      unit: r.unit,
      inspected: r.inspected,
      passed: r.passed,
      shrinkage: r.shrinkage,
      rework: r.rework,
      hold: r.hold,
    }));
    // "Any quantity" flags only; quantities of different units are never added together.
    const qPassed = byUnit.some((r) => r.passed > 0) ? 1 : 0;
    const qShrinkage = byUnit.some((r) => r.shrinkage > 0) ? 1 : 0;
    const qRework = byUnit.some((r) => r.rework > 0) ? 1 : 0;
    const lineTotals = (key: 'inspected' | 'passed' | 'shrinkage' | 'rework') =>
      Object.fromEntries(byUnit.filter((r) => r[key] > 0).map((r) => [r.unit, r[key]])) as Record<string, number>;
    const breakdownText = (key: 'inspected' | 'passed' | 'shrinkage' | 'rework') => formatTotals(lineTotals(key));
    // Header quantities hold one unit only: set when this inspection (and the challan) use a single unit.
    const singleUnit = byUnit.length === 1 && challanUnits.length === 1 ? byUnit[0] : null;

    // 3. Two decisions: PASS and REWORK. Dyeing QC does not reject to the Defective Shelf; fabric lost in
    // dyeing is recorded as shrinkage.
    const normalizedResult = result;
    const validResults = ['PASS', 'REWORK'];
    if (!normalizedResult || !validResults.includes(normalizedResult)) {
      return NextResponse.json(
        { error: 'Dyeing QC has two decisions: PASS and REWORK. Record lost fabric as Shrinkage.' },
        { status: 400 }
      );
    }

    // Rule 4: Every decision requires a remark from the QC Incharge.
    const effectiveRemark = (remarks || defectRemarks || reworkReason || '').trim();
    if (!effectiveRemark) {
      return NextResponse.json(
        { error: 'A remark from the QC Incharge is strictly mandatory for every inspection decision (PASS or REWORK).' },
        { status: 400 }
      );
    }

    if (normalizedResult === 'PASS' && qPassed <= 0) {
      return NextResponse.json(
        { error: 'Result is set to PASS, but Passed Quantity is 0. Please enter the passed quantity.' },
        { status: 400 }
      );
    }

    if (normalizedResult === 'REWORK') {
      if (qRework <= 0) {
        return NextResponse.json(
          { error: 'Result is set to REWORK, but Rework Quantity is 0. Please specify the rework yardage to return to Dyeing.' },
          { status: 400 }
        );
      }
    }

    // 3b. Manual challan numbers for every challan this inspection creates
    const numberEntries: Array<{ field: string; label: string; value: unknown }> = [];
    if (qRework > 0) numberEntries.push({ field: 'reworkChallanNumber', label: 'Rework challan number', value: body.reworkChallanNumber });
    if (normalizedResult === 'PASS' && qPassed > 0) numberEntries.push({ field: 'passChallanNumber', label: 'Embroidery challan number', value: body.passChallanNumber });
    const typedNumbers = requireChallanNumberSet(numberEntries);
    // Every challan this inspection creates is issued by Dyeing QC (QC1).
    await assertChallanNumbersAvailable(
      prisma,
      'QC1',
      Object.entries(typedNumbers).map(([field, value]) => ({ field, value })),
    );

    if (qShrinkage > 0 && !(await shrinkageTableExists())) {
      return NextResponse.json({ error: SHRINKAGE_NOT_SET_UP }, { status: 503 });
    }

    // 4. Resolve Authenticated Inspector
    const actorUser = { id: authUser.id, fullName: authUser.fullName, username: authUser.username };
    const actorId = actorUser?.id || '';

    const primaryItem = challan.items[0];
    const uom = singleUnit?.unit || headerUnitOf(byUnit.map((r) => r.unit)) || 'MTR';
    const effectiveColor = observedColor || primaryItem?.colour || challan.program?.fabricColor || 'Standard';
    // Observed colour of an outgoing line: its own, or (a one-line challan) the colour observed for the challan.
    const singleLine = challan.items.length === 1;
    const colourOf = (r: (typeof inspectedLines)[number]) =>
      r.observedColor || (singleLine ? observedColor : null) || r.item.colour || effectiveColor;
    // Each outgoing line comes from one inspected line and keeps its fabric, colour and Production Sheet.
    const lineSource = (r: (typeof inspectedLines)[number]) => ({ programId: lineSheetId(r.item, challan), sourceChallanItemId: r.item.id });
    // Lines of an outgoing challan: one per inspected line with quantity; header totals only for one unit.
    const outgoing = (key: 'passed' | 'rework') => {
      const rows = inspectedLines.filter((r) => r[key] > 0);
      const totals = totalsByUnit(rows.map((r) => ({ quantity: r[key], uom: r.unit })));
      const units = Object.keys(totals);
      const one = units.length === 1 ? units[0] : null;
      return { rows, unit: one || MIXED_UNIT, quantity: one ? totals[one] : null };
    };
    const recordedAt = new Date();
    // The Dyeing QC incharge name typed on the form goes on every challan this inspection creates: in its
    // own column, or as an "Incharge:" remarks note while that column is not in the database yet.
    const inchargeName = typeof body.inchargeName === 'string' ? body.inchargeName.trim().slice(0, 100) : '';
    const storeInchargeColumn = inchargeName ? await canWriteColumns('Challan', ['inchargeName']) : false;
    const inchargeFields = storeInchargeColumn ? { inchargeName } : {};
    const inchargeNote = inchargeName && !storeInchargeColumn ? ` | Incharge: ${inchargeName}` : '';

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
            sampleSize: Math.round(byUnit[0].inspected), // per-unit figures are in the QUANTITY_BREAKDOWN parameters
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
              status: 'PASS',
              comments: observedColor ? `Observed: ${observedColor}` : 'Matches standard lab dip',
              uom: 'VISUAL',
            },
            // One breakdown per unit: meters and pieces are recorded separately.
            ...byUnit.map((r) => ({
              inspectionId: inspection.id,
              parameterName: 'QUANTITY_BREAKDOWN',
              expectedValue: `${receivedByUnit[r.unit]} ${r.unit}`,
              measuredValue: `Pass: ${r.passed}, Shrinkage: ${r.shrinkage}, Rework: ${r.rework}`,
              status: normalizedResult === 'PASS' ? 'PASS' : 'FAIL',
              comments: `Inspected: ${r.inspected} ${r.unit}`,
              uom: r.unit,
            })),
            // One outcome per challan line (fabric, colour and Production Sheet stay with their line).
            ...inspectedLines.map((r) => ({
              inspectionId: inspection.id,
              parameterName: 'LINE_BREAKDOWN',
              expectedValue: `${r.item.quantity} ${r.unit}`,
              measuredValue: `Pass: ${r.passed}, Shrinkage: ${r.shrinkage}, Rework: ${r.rework}, Hold: ${r.hold}`,
              status: r.rework > 0 ? 'FAIL' : 'PASS',
              comments: `${lineLabel(r.item)} · Inspected: ${r.inspected} ${r.unit} · Line ${r.item.id}`,
              uom: r.unit,
            })),
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
        } else if (qRework > 0) {
          // Automatic defect log entry (per unit) for non-zero rework yardage
          for (const r of byUnit.filter((x) => x.rework > 0)) {
            await tx.defectLog.create({
              data: {
                inspectionId: inspection.id,
                defectType: reworkReason || 'ALTERATION_REWORK',
                count: Math.round(r.rework),
                severity: 'MAJOR',
              },
            });
          }
        }

        // D. Record Production Transactions (one per unit) for traceability and balance accounting
        const productionTransactions = [];
        for (const r of byUnit) {
          productionTransactions.push(
            await tx.productionTransaction.create({
              data: {
                programId: challan.programId,
                challanId: challan.id,
                departmentCode: 'QC1',
                operationName: 'QC1_FABRIC_INSPECTION',
                operatorId: actorId,
                inputQuantity: r.inspected,
                goodQuantity: r.passed,
                rejectQuantity: 0,
                reworkQuantity: r.rework,
                wasteQuantity: r.shrinkage,
                wasteReason: r.shrinkage > 0 ? 'SHRINKAGE' : null,
                balanceQuantity: 0,
                unitOfMeasure: r.unit,
                reworkReason: reworkReason || null,
                rejectReason: null,
                notes: effectiveRemark || `Dyeing QC Inspection complete: ${normalizedResult}. Passed: ${r.passed} ${r.unit}`,
                recordedAt,
              },
            })
          );
        }
        const prodTx = productionTransactions[0];

        // E. Return Rework yardage to Dyeing Department if rework quantity > 0 (Rule 5)
        let reworkReturnChallan = null;
        if (qRework > 0) {
          const returnChallanNumber = typedNumbers.reworkChallanNumber;
          const rework = outgoing('rework');

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
              fabricOut: rework.quantity,
              fabricUnit: rework.unit,
              remarks: `Dyeing QC Rework/Alter Return for Sheet ${challan.program.programSerialNo || challan.program.programNumber}. Reason: ${reworkReason || effectiveRemark}. Must go through Dyeing QC again before Embroidery.${inchargeNote}`,
              ...inchargeFields,
            },
          });

          for (const r of rework.rows) {
            const src = r.item;
            await tx.challanItem.create({
              data: {
                challanId: reworkReturnChallan.id,
                itemDescription: `${src?.itemDescription || 'Dyed Fabric'} - Dyeing QC Rework Return`,
                fabricCode: src?.fabricCode || 'KNIT',
                colour: colourOf(r),
                unitType: r.unit === 'PCS' ? 'PCS' : 'ROLL',
                quantity: r.rework,
                uom: r.unit,
                ...lineSource(r),
                remarks: `Returned for rework/alteration. Must go through Dyeing QC again: ${reworkReason || effectiveRemark}`,
              },
            });
          }
        }

        // E.2 Shrinkage: recorded on the line it was measured on (one record per line, updated if it
        // already exists); never spread across lines. Fabric Store stock is not changed.
        for (const r of inspectedLines.filter((x) => x.shrinkage > 0)) {
          await saveShrinkageForLine(tx, {
            challanItemId: r.item.id,
            shrinkageQty: r.shrinkage,
            shrinkageUnit: r.unit,
            userId: actorId,
            source: 'INSPECTION',
          });
        }

        // E.3 Forward Passed yardage to Embroidery Department if result is PASS (Rule 7)
        let passForwardChallan = null;
        if (normalizedResult === 'PASS' && qPassed > 0) {
          const passChallanNumber = typedNumbers.passChallanNumber;
          const pass = outgoing('passed');

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
              fabricIn: pass.quantity,
              defectivePieces: 0,
              fabricOut: pass.quantity,
              fabricUnit: pass.unit,
              detectedFromDepartment: 'QC1',
              detectedFromChallanId: challan.id,
              remarks: `Dyeing QC Passed Fabric — Approved for Embroidery Department for Sheet ${challan.program?.programSerialNo || challan.program?.programNumber || ''}. QC Incharge Remark: ${effectiveRemark}${inchargeNote}`,
              ...inchargeFields,
            },
          });

          for (const r of pass.rows) {
            const src = r.item;
            await tx.challanItem.create({
              data: {
                challanId: passForwardChallan.id,
                itemDescription: `${src?.itemDescription || 'Dyeing QC Approved Fabric'} — Embroidery Lot`,
                fabricCode: src?.fabricCode || 'FABRIC',
                colour: colourOf(r),
                unitType: r.unit === 'PCS' ? 'PCS' : 'ROLL',
                quantity: r.passed,
                uom: r.unit,
                ...lineSource(r),
                // Passed QC after dyeing: this line is dyed fabric.
                fabricProcessingStatus: 'DYED',
                remarks: `Inspected & Passed by Dyeing QC Gate. Approved for Embroidery: ${effectiveRemark}`,
              },
            });
          }
        }

        // F. Compute final status for the Dyeing -> QC1 Challan
        let newChallanStatus = 'QC_APPROVED';
        if (normalizedResult === 'REWORK') {
          newChallanStatus = 'REWORK_REQUESTED';
        }

        const updatedChallan = await tx.challan.update({
          where: { id },
          data: {
            status: newChallanStatus,
            completedDate: new Date(),
            // Header quantities only for a single-unit challan; with MTR and PCS lines they stay per line.
            ...(singleUnit
              ? {
                  fabricIn: challan.fabricIn ?? singleUnit.inspected,
                  fabricOut: singleUnit.passed,
                  fabricUnit: singleUnit.unit,
                }
              : { fabricIn: null, fabricOut: null, fabricUnit: headerUnitOf(challanUnits) }),
            remarks: [
              challan.remarks,
              `Dyeing QC Result: ${normalizedResult} (Pass: ${breakdownText('passed')} → Embroidery | Rework: ${breakdownText('rework')} → Dyeing | Shrinkage: ${breakdownText('shrinkage')}) | QC Remark: ${effectiveRemark}`,
              passForwardChallan ? `Embroidery Challan: ${passForwardChallan.challanNumber}` : null,
              reworkReturnChallan ? `Rework Challan (Dyeing): ${reworkReturnChallan.challanNumber}` : null,
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
              byUnit,
              byLine: lineSummary,
              reworkReturnChallanNumber: reworkReturnChallan?.challanNumber || null,
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
              byUnit,
              byLine: lineSummary,
              qcRemark: effectiveRemark,
              reworkReturnChallan: reworkReturnChallan?.challanNumber || null,
              passForwardChallan: passForwardChallan?.challanNumber || null,
              inspector: actorUser?.fullName || actorUser?.username,
            }),
          },
        });

        return {
          inspection,
          productionTransaction: prodTx,
          productionTransactions,
          byUnit,
          byLine: lineSummary,
          passForwardChallan,
          reworkReturnChallan,
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
    if (error instanceof ShrinkageError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const numberResponse = challanNumberErrorResponse(error);
    if (numberResponse) return numberResponse;
    console.error('Error completing QC1 inspection:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to complete Dyeing QC inspection.' },
      { status: 500 }
    );
  }
}
