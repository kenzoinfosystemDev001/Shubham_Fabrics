import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';
import {
  assertChallanNumbersAvailable,
  challanNumberErrorResponse,
  requireChallanNumberSet,
} from '@/lib/challan-number-server';
import { MIXED_UNIT, formatTotals, headerUnitOf, totalsByUnit, unitOf } from '@/lib/challan-units.mjs';

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

    // 2. Strict Backend Validations on Quantities, per unit. Every challan line keeps its unit (MTR or
    // PCS); each unit is inspected in that unit and nothing is ever added across units. A single-unit
    // challan may still send the plain quantityInspected / quantityPassed / ... fields.
    const receivedByUnit = totalsByUnit(challan.items, challan.fabricUnit);
    const challanUnits = Object.keys(receivedByUnit);
    if (challanUnits.length === 0) {
      return NextResponse.json({ error: 'This challan has no quantity to inspect.' }, { status: 400 });
    }
    const rawByUnit: Record<string, any> | null =
      body.byUnit && typeof body.byUnit === 'object'
        ? body.byUnit
        : challanUnits.length === 1
          ? { [challanUnits[0]]: { quantityInspected, quantityPassed, quantityFailed, quantityRework, quantityHold } }
          : null;
    if (!rawByUnit) {
      return NextResponse.json(
        { error: 'This challan has lines in MTR and PCS. Enter the inspection quantities for each unit.' },
        { status: 400 }
      );
    }
    const num = (v: unknown) => (v === undefined || v === null || v === '' ? 0 : Number(v));
    const byUnit: Array<{ unit: string; inspected: number; passed: number; failed: number; rework: number; hold: number }> = [];
    for (const [rawUnit, q] of Object.entries(rawByUnit)) {
      const unit = unitOf(rawUnit);
      if (!unit || !(unit in receivedByUnit)) {
        return NextResponse.json({ error: `Challan ${challan.challanNumber} has no ${rawUnit} line to inspect.` }, { status: 400 });
      }
      const row = {
        unit,
        inspected: num(q?.quantityInspected),
        passed: num(q?.quantityPassed),
        failed: num(q?.quantityFailed),
        rework: num(q?.quantityRework),
        hold: num(q?.quantityHold),
      };
      for (const [label, v] of [['Quantity Inspected', row.inspected], ['Quantity Passed', row.passed], ['Quantity Failed', row.failed], ['Quantity Rework', row.rework], ['Quantity Hold', row.hold]] as const) {
        if (!Number.isFinite(v) || v < 0) {
          return NextResponse.json({ error: `${label} (${unit}) cannot be negative.` }, { status: 400 });
        }
      }
      const sumCategories = row.passed + row.failed + row.rework + row.hold;
      if (row.inspected <= 0 && sumCategories <= 0) continue; // this unit is not part of this inspection
      if (row.inspected <= 0) {
        return NextResponse.json({ error: `Quantity Inspected (${unit}) must be a positive number greater than 0.` }, { status: 400 });
      }
      if (row.inspected > receivedByUnit[unit] + 0.001) {
        return NextResponse.json(
          { error: `Quantity Inspected (${row.inspected} ${unit}) cannot exceed Quantity Received from Dyeing (${receivedByUnit[unit]} ${unit}).` },
          { status: 400 }
        );
      }
      // Allow slight float precision variance (0.001)
      if (sumCategories > row.inspected + 0.001) {
        return NextResponse.json(
          {
            error: `The sum of Passed (${row.passed}) + Failed (${row.failed}) + Rework (${row.rework}) + Hold (${row.hold}) = ${sumCategories} ${unit}, which exceeds Quantity Inspected (${row.inspected} ${unit}).`,
          },
          { status: 400 }
        );
      }
      byUnit.push(row);
    }
    if (byUnit.length === 0) {
      return NextResponse.json({ error: 'Quantity Inspected must be a positive number greater than 0.' }, { status: 400 });
    }
    // "Any quantity" flags only; quantities of different units are never added together.
    const qPassed = byUnit.some((r) => r.passed > 0) ? 1 : 0;
    const qFailed = byUnit.some((r) => r.failed > 0) ? 1 : 0;
    const qRework = byUnit.some((r) => r.rework > 0) ? 1 : 0;
    const lineTotals = (key: 'inspected' | 'passed' | 'failed' | 'rework') =>
      Object.fromEntries(byUnit.filter((r) => r[key] > 0).map((r) => [r.unit, r[key]])) as Record<string, number>;
    const breakdownText = (key: 'inspected' | 'passed' | 'failed' | 'rework') => formatTotals(lineTotals(key));
    // Header quantities hold one unit only: set when this inspection (and the challan) use a single unit.
    const singleUnit = byUnit.length === 1 && challanUnits.length === 1 ? byUnit[0] : null;

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

    // 3b. Manual challan numbers for every challan this inspection creates
    const numberEntries: Array<{ field: string; label: string; value: unknown }> = [];
    if (qRework > 0) numberEntries.push({ field: 'reworkChallanNumber', label: 'Rework challan number', value: body.reworkChallanNumber });
    if (qFailed > 0) numberEntries.push({ field: 'rejectChallanNumber', label: 'Defective shelf challan number', value: body.rejectChallanNumber });
    if (normalizedResult === 'PASS' && qPassed > 0) numberEntries.push({ field: 'passChallanNumber', label: 'Embroidery challan number', value: body.passChallanNumber });
    const typedNumbers = requireChallanNumberSet(numberEntries);
    await assertChallanNumbersAvailable(
      prisma,
      Object.entries(typedNumbers).map(([field, value]) => ({ field, value })),
    );

    // 4. Resolve Authenticated Inspector
    const actorUser = { id: authUser.id, fullName: authUser.fullName, username: authUser.username };
    const actorId = actorUser?.id || '';

    const primaryItem = challan.items[0];
    const uom = singleUnit?.unit || headerUnitOf(byUnit.map((r) => r.unit)) || 'MTR';
    const effectiveColor = observedColor || primaryItem?.colour || challan.program?.fabricColor || 'Standard';
    // The challan line a unit's outgoing quantity is described from (fabric, colour).
    const itemFor = (unit: string) => challan.items.find((it) => unitOf(it.uom) === unit) || primaryItem;
    // Lines of an outgoing challan: one per unit with quantity; header totals only for one unit.
    const outgoing = (key: 'passed' | 'failed' | 'rework') => {
      const rows = byUnit.filter((r) => r[key] > 0);
      const one = rows.length === 1 ? rows[0] : null;
      return { rows, unit: one ? one.unit : MIXED_UNIT, quantity: one ? one[key] : null };
    };
    const recordedAt = new Date();

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
              status: normalizedResult === 'REJECT' && defectRemarks?.toLowerCase().includes('shade') ? 'FAIL' : 'PASS',
              comments: observedColor ? `Observed: ${observedColor}` : 'Matches standard lab dip',
              uom: 'VISUAL',
            },
            // One breakdown per unit: meters and pieces are recorded separately.
            ...byUnit.map((r) => ({
              inspectionId: inspection.id,
              parameterName: 'QUANTITY_BREAKDOWN',
              expectedValue: `${receivedByUnit[r.unit]} ${r.unit}`,
              measuredValue: `Pass: ${r.passed}, Reject: ${r.failed}, Rework: ${r.rework}`,
              status: normalizedResult === 'PASS' ? 'PASS' : 'FAIL',
              comments: `Inspected: ${r.inspected} ${r.unit}`,
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
        } else if (qFailed > 0 || qRework > 0) {
          // Automatic defect log entry (per unit) for non-zero failed or rework yardage
          for (const r of byUnit.filter((x) => x.failed + x.rework > 0)) {
            await tx.defectLog.create({
              data: {
                inspectionId: inspection.id,
                defectType: normalizedResult === 'REWORK' ? (reworkReason || 'ALTERATION_REWORK') : (defectRemarks || 'FABRIC_DEFECT'),
                count: Math.round(r.failed + r.rework),
                severity: normalizedResult === 'REJECT' ? 'CRITICAL' : 'MAJOR',
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
                rejectQuantity: r.failed,
                reworkQuantity: r.rework,
                balanceQuantity: 0,
                unitOfMeasure: r.unit,
                reworkReason: reworkReason || null,
                rejectReason: defectRemarks || (normalizedResult === 'REJECT' ? effectiveRemark : null),
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
              remarks: `QC1 Rework/Alter Return for Sheet ${challan.program.programSerialNo || challan.program.programNumber}. Reason: ${reworkReason || effectiveRemark}. Must go through QC1 again before Embroidery.`,
            },
          });

          for (const r of rework.rows) {
            const src = itemFor(r.unit);
            await tx.challanItem.create({
              data: {
                challanId: reworkReturnChallan.id,
                itemDescription: `${src?.itemDescription || 'Dyed Fabric'} - QC1 Rework Return`,
                fabricCode: src?.fabricCode || 'KNIT',
                colour: observedColor || src?.colour || effectiveColor,
                unitType: r.unit === 'PCS' ? 'PCS' : 'ROLL',
                quantity: r.rework,
                uom: r.unit,
                remarks: `Returned for rework/alteration. Must go through QC1 again: ${reworkReason || effectiveRemark}`,
              },
            });
          }
        }

        // E.2 Return Rejected / Defective yardage to Fabric Store Defective Shelf if failed quantity > 0 (Rule 6)
        let rejectReturnChallan = null;
        if (qFailed > 0) {
          const rejectChallanNumber = typedNumbers.rejectChallanNumber;
          const reject = outgoing('failed');

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
              // One unit: header quantities; both units: the lines carry them.
              fabricIn: reject.quantity,
              defectivePieces: reject.quantity,
              defectiveUnit: reject.quantity === null ? null : reject.unit,
              fabricOut: 0,
              fabricUnit: reject.unit,
              defectiveShelfLocation: 'DEF-SHELF-STORE (Fabric Store Quarantined Shelf · DEF-SHELF-CENTRAL)',
              defectReason: defectRemarks || effectiveRemark,
              detectedFromDepartment: 'QC1',
              detectedFromChallanId: challan.id,
              remarks: `QC1 Defective Return to Fabric Store Defective Shelf (DEF-SHELF-STORE) for Sheet ${challan.program.programSerialNo || challan.program.programNumber}. Reason: ${defectRemarks || effectiveRemark}. Strictly forbidden for Embroidery.`,
            },
          });

          for (const r of reject.rows) {
            const src = itemFor(r.unit);
            await tx.challanItem.create({
              data: {
                challanId: rejectReturnChallan.id,
                itemDescription: `${src?.itemDescription || 'Dyed Fabric'} - DEFECTIVE SHELF (DEF-SHELF-STORE)`,
                fabricCode: src?.fabricCode || 'KNIT',
                colour: observedColor || src?.colour || effectiveColor,
                unitType: r.unit === 'PCS' ? 'PCS' : 'ROLL',
                quantity: r.failed,
                uom: r.unit,
                remarks: `QC_REJECTED: Allocated to Fabric Store Defective Shelf (DEF-SHELF-STORE). Not approved for Embroidery. Reason: ${defectRemarks || effectiveRemark}`,
              },
            });
          }
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
              remarks: `QC1 Passed Fabric — Approved for Embroidery Department for Sheet ${challan.program?.programSerialNo || challan.program?.programNumber || ''}. QC Incharge Remark: ${effectiveRemark}`,
            },
          });

          for (const r of pass.rows) {
            const src = itemFor(r.unit);
            await tx.challanItem.create({
              data: {
                challanId: passForwardChallan.id,
                itemDescription: `${src?.itemDescription || 'QC1 Approved Fabric'} — Embroidery Lot`,
                fabricCode: src?.fabricCode || 'FABRIC',
                colour: observedColor || src?.colour || effectiveColor,
                unitType: r.unit === 'PCS' ? 'PCS' : 'ROLL',
                quantity: r.passed,
                uom: r.unit,
                // Passed QC after dyeing: this line is dyed fabric.
                fabricProcessingStatus: 'DYED',
                remarks: `Inspected & Passed by QC1 Gate. Approved for Embroidery: ${effectiveRemark}`,
              },
            });
          }
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
            // Header quantities only for a single-unit challan; with MTR and PCS lines they stay per line.
            ...(singleUnit
              ? {
                  fabricIn: challan.fabricIn ?? singleUnit.inspected,
                  defectivePieces: (challan.defectivePieces || 0) + singleUnit.failed,
                  defectiveUnit: singleUnit.failed > 0 || challan.defectivePieces ? singleUnit.unit : challan.defectiveUnit,
                  fabricOut: singleUnit.passed,
                  fabricUnit: singleUnit.unit,
                }
              : { fabricIn: null, fabricOut: null, fabricUnit: headerUnitOf(challanUnits) }),
            defectiveShelfLocation: qFailed > 0 ? 'DEF-SHELF-STORE (Fabric Store Quarantined Shelf · DEF-SHELF-CENTRAL)' : challan.defectiveShelfLocation,
            defectReason: qFailed > 0 ? (defectRemarks || effectiveRemark) : challan.defectReason,
            remarks: [
              challan.remarks,
              `QC1 Result: ${normalizedResult} (Pass: ${breakdownText('passed')} → Embroidery | Rework: ${breakdownText('rework')} → Dyeing | Reject: ${breakdownText('failed')} → Store Defective Shelf) | QC Remark: ${effectiveRemark}`,
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
              byUnit,
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
              byUnit,
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
          productionTransactions,
          byUnit,
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
    const numberResponse = challanNumberErrorResponse(error);
    if (numberResponse) return numberResponse;
    console.error('Error completing QC1 inspection:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to complete QC1 inspection.' },
      { status: 500 }
    );
  }
}
