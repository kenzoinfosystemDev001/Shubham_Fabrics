import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import { requireDepartment } from '@/lib/auth/department-access';
import { assertChallanNumbersAvailable, challanNumberErrorResponse, requireChallanNumber } from '@/lib/challan-number-server';
import { unitOf, totalsByUnit } from '@/lib/challan-units.mjs';
import { ACTIVE_HOLD_STATUSES, HOLD_REASONS } from '@/lib/holds.mjs';
import { addToHold, loadLines, lockSource, takeFromHold } from '@/lib/holds-server';
import { TX, WorkRequestError, errorResponse, round, textOf } from '@/lib/work-items-server';

// Changing a Dyeing QC decision. Dyeing QC decides PASS or REWORK per unit (it never rejects: lost fabric is
// shrinkage), and keeps quantity back on HOLD. REWORK and HOLD can be swapped, in whole or in part:
// - REWORK -> HOLD: the rework already sits on a return challan to Dyeing, so that challan line is reduced (only
//   while Dyeing has not received it); the inspection's rework and inspected quantities go down and the quantity is
//   held on the Dyeing QC challan, to be inspected again once released.
// - HOLD -> REWORK: the held quantity is added to the return challan Dyeing has not received yet, or goes on a new
//   return challan (its number typed by the incharge); the inspection records it as rework.
// Every change is kept in the audit log with its reason. PASS (already on its way to Embroidery) is not changed here.

const NOT_YET_RECEIVED = ['ISSUED', 'SUBMITTED', 'IN_TRANSIT'];
const INSPECTION = 'QC1_FABRIC_INSPECTION';
const unitKey = (raw: unknown) => (unitOf(raw) || String(raw || '').trim().toUpperCase()) as string;

async function loadState(id: string, db: any = prisma) {
  const challan = await db.challan.findUnique({
    where: { id },
    include: {
      items: { orderBy: { createdAt: 'asc' } },
      program: { select: { programSerialNo: true, programNumber: true } },
      productionLogs: { where: { departmentCode: 'QC1', operationName: INSPECTION }, orderBy: { recordedAt: 'asc' } },
      childChallans: {
        where: { fromDepartment: 'QC1', challanType: 'REWORK_RETURN', status: { notIn: ['DRAFT', 'CANCELLED', 'REJECTED'] } },
        orderBy: { createdAt: 'asc' },
        include: { items: { orderBy: { createdAt: 'asc' } }, dyeingInboundOrders: { select: { id: true, status: true, inboundChallanItemId: true, requiredQuantity: true } } },
      },
    },
  });
  if (!challan || unitKey(challan.toDepartment) !== 'QC1') throw new WorkRequestError('Dyeing QC challan not found.', 404);
  const holds = await db.departmentHold.findMany({ where: { sourceType: 'QC1_CHALLAN', sourceId: id, status: { in: ACTIVE_HOLD_STATUSES } } });
  return { challan, holds };
}

/** Rework lines of a unit Dyeing has not received yet (they can still change), newest first. */
function openReworkLines(challan: any, unit: string) {
  const out: Array<{ returnChallan: any; item: any; order: any | null }> = [];
  for (const rc of challan.childChallans) {
    if (!NOT_YET_RECEIVED.includes(rc.status)) continue;
    for (const item of rc.items) {
      if (unitKey(item.uom) !== unit) continue;
      const order = rc.dyeingInboundOrders.find((o: any) => o.inboundChallanItemId === item.id) || null;
      if (order && order.status !== 'AWAITING_RECEIPT') continue;
      out.push({ returnChallan: rc, item, order });
    }
  }
  return out.reverse();
}

function summaryOf(challan: any, holds: any[]) {
  const units = Object.keys(totalsByUnit(challan.items, challan.fabricUnit));
  return units.map((unit) => {
    const logs = challan.productionLogs.filter((l: any) => unitKey(l.unitOfMeasure) === unit);
    const open = openReworkLines(challan, unit);
    return {
      unit,
      rework: round(logs.reduce((s: number, l: any) => s + (l.reworkQuantity || 0), 0)),
      // Rework that can still change: on return challans Dyeing has not received.
      reworkChangeable: round(open.reduce((s, l) => s + l.item.quantity, 0)),
      held: round(holds.filter((h) => unitKey(h.unit) === unit).reduce((s, h) => s + h.remainingQuantity, 0)),
      inspections: logs.map((l: any) => ({ id: l.id, at: l.recordedAt, inspected: l.inputQuantity, passed: l.goodQuantity, rework: l.reworkQuantity, shrinkage: l.wasteQuantity, reason: l.reworkReason })),
      // HOLD -> REWORK needs a new return challan (and its number) when none is still open for this unit.
      needsReworkChallan: open.length === 0,
      reworkChallans: challan.childChallans.filter((rc: any) => rc.items.some((i: any) => unitKey(i.uom) === unit)).map((rc: any) => ({ id: rc.id, challanNumber: rc.challanNumber, status: rc.status })),
    };
  });
}

/** GET /api/qc1/challans/:id/decision — per unit: rework (and how much can still change), HOLD, inspections, decision changes. */
export async function qc1DecisionState(request: Request, id: string) {
  const { user, response } = await requireDepartment(request, 'QC1');
  if (!user) return response;
  try {
    const { challan, holds } = await loadState(id);
    const history = await prisma.auditLog.findMany({
      where: { entity: 'Challan', entityId: id, action: 'QC1_DECISION_CHANGED' },
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { fullName: true, username: true } } },
    });
    return NextResponse.json({
      data: {
        challanNumber: challan.challanNumber,
        status: challan.status,
        units: summaryOf(challan, holds),
        history: history.map((r: any) => ({ id: r.id, at: r.createdAt, by: r.actor?.fullName || r.actor?.username || null, ...JSON.parse(r.afterState || '{}') })),
      },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load the Dyeing QC decisions.');
  }
}

/**
 * POST /api/qc1/challans/:id/decision  { unit, from: REWORK|HOLD, to: REWORK|HOLD, quantity, correctionReason, remarks?,
 *   inspectionId? (REWORK -> HOLD), holdReason?, holdReasonOther? (-> HOLD), reworkReason?, reworkChallanNumber? (-> REWORK) }
 */
export async function changeQc1Decision(request: Request, id: string) {
  const { user, response } = await requireDepartment(request, 'QC1');
  if (!user) return response;
  try {
    const body = await request.json().catch(() => null);
    if (!body) throw new WorkRequestError('Invalid request.');
    const from = String(body.from || '').toUpperCase();
    const to = String(body.to || '').toUpperCase();
    if (!['REWORK', 'HOLD'].includes(from) || !['REWORK', 'HOLD'].includes(to)) {
      throw new WorkRequestError('Dyeing QC decisions that can change are REWORK and HOLD (it never rejects; lost fabric is shrinkage).');
    }
    if (from === to) throw new WorkRequestError(`Select a decision other than ${from}.`);
    const unit = unitKey(body.unit);
    const quantity = round(Number(body.quantity));
    if (!Number.isFinite(quantity) || quantity <= 0) throw new WorkRequestError('Enter the quantity whose decision changes (more than zero).');
    const correctionReason = textOf(body.correctionReason, 300);
    if (!correctionReason) throw new WorkRequestError('Enter the reason for this correction.');
    const remarks = textOf(body.remarks, 500);

    let holdCheck: { quantity: number; reason: string; reasonOther: string | null; remarks: string | null } | null = null;
    if (to === 'HOLD') {
      const code = String(body.holdReason || '').toUpperCase();
      if (!HOLD_REASONS.some((r) => r.code === code)) throw new WorkRequestError('Select the Hold Reason.');
      const other = code === 'OTHER' ? textOf(body.holdReasonOther, 200) : null;
      if (code === 'OTHER' && !other) throw new WorkRequestError('Enter the reason for Other.');
      holdCheck = { quantity, reason: code, reasonOther: other, remarks };
    }
    const reworkReason = to === 'REWORK' ? textOf(body.reworkReason, 300) : null;
    if (to === 'REWORK' && !reworkReason) throw new WorkRequestError('Enter the rework reason.');

    // A new return challan's number is checked before anything changes.
    const pre = await loadState(id);
    let newNumber: string | null = null;
    if (to === 'REWORK' && openReworkLines(pre.challan, unit).length === 0) {
      newNumber = requireChallanNumber(body.reworkChallanNumber, 'Rework challan number', 'reworkChallanNumber');
      await assertChallanNumbersAvailable(prisma, 'QC1', [{ field: 'reworkChallanNumber', value: newNumber }]);
    }

    const message = await prisma.$transaction(async (tx) => {
      await lockSource(tx, 'QC1_CHALLAN', id);
      const { challan, holds } = await loadState(id, tx);
      const logs = challan.productionLogs.filter((l: any) => unitKey(l.unitOfMeasure) === unit);
      const note = `Dyeing QC decision changed from ${from} to ${to}: ${correctionReason}`;
      const touched: string[] = [];

      if (from === 'REWORK') {
        const pt = logs.find((l: any) => l.id === body.inspectionId) || [...logs].reverse().find((l: any) => l.reworkQuantity > 0);
        if (!pt) throw new WorkRequestError(`No rework is recorded in ${unit} on this challan.`);
        if (quantity > round(pt.reworkQuantity)) throw new WorkRequestError(`This inspection recorded ${round(pt.reworkQuantity)} ${unit} as REWORK; no more can change.`);
        const open = openReworkLines(challan, unit);
        const changeable = round(open.reduce((s, l) => s + l.item.quantity, 0));
        if (quantity > changeable) {
          throw new WorkRequestError(
            `Only ${changeable} ${unit} of the rework is still on a return challan Dyeing has not received; the rest is already with Dyeing and must come back through Dyeing QC before its decision can change.`,
          );
        }
        // Take the quantity off the open return lines, newest first.
        let left = quantity;
        for (const l of open) {
          if (left <= 0) break;
          const take = round(Math.min(left, l.item.quantity));
          const after = round(l.item.quantity - take);
          if (after <= 0) await tx.challanItem.delete({ where: { id: l.item.id } });
          else await tx.challanItem.update({ where: { id: l.item.id }, data: { quantity: after } });
          if (l.order) {
            if (after <= 0) await tx.dyeingOrder.delete({ where: { id: l.order.id } });
            else await tx.dyeingOrder.update({ where: { id: l.order.id }, data: { requiredQuantity: round(l.order.requiredQuantity - take) } });
          }
          const remainingLines = await tx.challanItem.findMany({ where: { challanId: l.returnChallan.id }, select: { quantity: true, uom: true } });
          const totals = totalsByUnit(remainingLines, l.returnChallan.fabricUnit);
          const totalUnits = Object.keys(totals);
          await tx.challan.update({
            where: { id: l.returnChallan.id },
            data: remainingLines.length === 0
              ? { status: 'CANCELLED', remarks: [l.returnChallan.remarks, `Cancelled: ${note}`].filter(Boolean).join(' | ') }
              : { fabricOut: totalUnits.length === 1 ? totals[totalUnits[0]] : null },
          });
          await tx.challanEvent.create({
            data: {
              challanId: l.returnChallan.id,
              fromStatus: l.returnChallan.status,
              toStatus: remainingLines.length === 0 ? 'CANCELLED' : l.returnChallan.status,
              action: remainingLines.length === 0 ? 'CANCEL' : 'QC',
              actorId: user.id,
              notes: `${take} ${unit} taken off for HOLD. ${note}`,
            },
          });
          touched.push(l.returnChallan.challanNumber);
          left = round(left - take);
        }
        // The inspection: the quantity is no longer inspected (it is held, to be inspected again after release).
        await tx.productionTransaction.update({
          where: { id: pt.id },
          data: { reworkQuantity: round(pt.reworkQuantity - quantity), inputQuantity: round(pt.inputQuantity - quantity), notes: [pt.notes, note].filter(Boolean).join(' | ') },
        });
        const line = (await loadLines('QC1', [id])).find((l) => l.unit === unit);
        if (!line) throw new WorkRequestError(`This challan has no ${unit} line to hold.`);
        // The line was read before this change: the quantity taken off the return challan is free to hold now.
        await addToHold(tx, 'QC1', { ...line, forwarded: round(Math.max(0, line.forwarded - quantity)) }, holdCheck!, user, note);
        await tx.challan.update({ where: { id }, data: { status: 'ON_HOLD' } });
      } else {
        // HOLD -> REWORK
        await takeFromHold(tx, 'QC1', `QC1_CHALLAN:${id}:${unit}`, quantity, user, note);
        const open = openReworkLines(challan, unit);
        if (open.length > 0) {
          const l = open[0];
          await tx.challanItem.update({ where: { id: l.item.id }, data: { quantity: round(l.item.quantity + quantity) } });
          if (l.order) await tx.dyeingOrder.update({ where: { id: l.order.id }, data: { requiredQuantity: round(l.order.requiredQuantity + quantity) } });
          const lines = await tx.challanItem.findMany({ where: { challanId: l.returnChallan.id }, select: { quantity: true, uom: true } });
          const totals = totalsByUnit(lines, l.returnChallan.fabricUnit);
          const totalUnits = Object.keys(totals);
          await tx.challan.update({ where: { id: l.returnChallan.id }, data: { fabricOut: totalUnits.length === 1 ? totals[totalUnits[0]] : null } });
          await tx.challanEvent.create({
            data: { challanId: l.returnChallan.id, fromStatus: l.returnChallan.status, toStatus: l.returnChallan.status, action: 'QC', actorId: user.id, notes: `${quantity} ${unit} added from HOLD. ${note}` },
          });
          touched.push(l.returnChallan.challanNumber);
        } else {
          const src = challan.items.find((i: any) => unitKey(i.uom) === unit) || challan.items[0];
          const rc = await tx.challan.create({
            data: {
              challanNumber: newNumber!,
              challanType: 'REWORK_RETURN',
              programId: challan.programId,
              parentChallanId: challan.id,
              fromDepartment: 'QC1',
              toDepartment: 'DYEING',
              status: 'ISSUED',
              priority: challan.priority || 'HIGH',
              createdById: user.id,
              issuedById: user.id,
              issuedDate: new Date(),
              fabricOut: quantity,
              fabricUnit: unit,
              remarks: `Dyeing QC Rework/Alter Return for Sheet ${challan.program?.programSerialNo || challan.program?.programNumber || ''}. Reason: ${reworkReason}. From HOLD (${correctionReason}). Must go through Dyeing QC again before Embroidery.`,
            },
          });
          await tx.challanItem.create({
            data: {
              challanId: rc.id,
              itemDescription: `${src?.itemDescription || 'Dyed Fabric'} - Dyeing QC Rework Return`,
              fabricCode: src?.fabricCode || null,
              colour: src?.colour || null,
              shade: src?.shade || null,
              unitType: unit === 'PCS' ? 'PCS' : 'ROLL',
              quantity,
              uom: unit,
              remarks: `Returned for rework/alteration. Must go through Dyeing QC again: ${reworkReason}`,
            },
          });
          await tx.challanEvent.create({ data: { challanId: rc.id, fromStatus: 'DRAFT', toStatus: 'ISSUED', action: 'ISSUE', actorId: user.id, notes: note } });
          touched.push(rc.challanNumber);
        }
        // The inspection records the quantity as inspected and REWORK.
        const pt = [...logs].reverse()[0];
        if (pt) {
          await tx.productionTransaction.update({
            where: { id: pt.id },
            data: { reworkQuantity: round(pt.reworkQuantity + quantity), inputQuantity: round(pt.inputQuantity + quantity), reworkReason: reworkReason, notes: [pt.notes, note].filter(Boolean).join(' | ') },
          });
        } else {
          await tx.productionTransaction.create({
            data: {
              programId: challan.programId,
              challanId: challan.id,
              departmentCode: 'QC1',
              operationName: INSPECTION,
              operatorId: user.id,
              inputQuantity: quantity,
              goodQuantity: 0,
              reworkQuantity: quantity,
              rejectQuantity: 0,
              wasteQuantity: 0,
              balanceQuantity: 0,
              unitOfMeasure: unit,
              reworkReason,
              notes: note,
            },
          });
        }
        const stillHeld = holds.reduce((s: number, h: any) => s + h.remainingQuantity, 0) - quantity > 0.0005;
        await tx.challan.update({ where: { id }, data: { status: stillHeld ? 'ON_HOLD' : 'REWORK_REQUESTED' } });
      }

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'QC1_DECISION_CHANGED',
          entity: 'Challan',
          entityId: id,
          beforeState: JSON.stringify({ status: challan.status, units: summaryOf(challan, holds) }),
          afterState: JSON.stringify({ from, to, quantity, unit, correctionReason, remarks, reworkReason, holdReason: holdCheck?.reason || null, returnChallans: touched }),
        },
      });
      return `${quantity} ${unit} changed from ${from} to ${to}${touched.length ? ` (return challan ${touched.join(', ')})` : ''}.`;
    }, TX);
    return NextResponse.json({ message });
  } catch (error) {
    const numbers = challanNumberErrorResponse(error);
    if (numbers) return numbers;
    return errorResponse(error, 'Failed to change the Dyeing QC decision.');
  }
}

