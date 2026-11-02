import { prisma } from '@shubham/database';
import { userBelongsToDepartment, departmentKeyFor } from '@/lib/auth/department-access';
import type { AuthenticatedUser } from '@/lib/auth/require-user';
import { TX, WorkRequestError, round } from '@/lib/work-items-server';
import { availableFor, isQcItem, qcStatusOf, statusAfterTransfer } from '@/lib/work-items.mjs';
import { allocationStatusOf } from '@/lib/recutting.mjs';
import { availableForQc, statusAfterTransfer as dyeingStatusAfterTransfer } from '@/lib/dyeing-workflow.mjs';
import { MIXED_UNIT, quantityPairOf, totalsByUnit, unitOf, widthOf } from '@/lib/challan-units.mjs';
import { canStoreChallanAverage, canStoreChallanUnitQuantity, canStoreChallanWidth } from '@/lib/challan-item-average';
import { assertChallanNumbersAvailable, requireChallanNumber } from '@/lib/challan-number-server';
import { STOCK_TRANSACTION_OPTIONS, syncChallanStock } from '@/lib/fabric-stock-ledger';
import { syncItem as syncRecuttingItem } from '@/lib/recutting-server';
import { withUserRemarks } from '@/lib/challan-remarks.mjs';

// Editing an issued challan to correct mistakes. Everything descriptive can always be corrected: the header
// (number, date, priority, remarks, incharge) and each line's fabric, colour, shade, size, Average, Unit quantity
// and remarks. A line's quantity and unit can be corrected until the receiving department has received it; the
// records that copied it move with it in the same transaction, so nothing is counted twice:
// - the sending line's transferred total (work item, Recutting allocation, dyeing order);
// - Fabric Store stock (challans issued by the Store are re-posted from their lines);
// - the receiving department's line still awaiting receipt (work item or dyeing order).
// Lines are not added or removed here, and Dyeing QC's PASS / rework challans keep the inspection's quantities.

const NOT_RECEIVED = ['DRAFT', 'ISSUED', 'SUBMITTED', 'IN_TRANSIT'];
const text = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) || null : undefined);

/** Who may edit: administrators and the department that issued the challan. */
export function canEditChallan(user: AuthenticatedUser, challan: { fromDepartment: string }) {
  return user.isAdmin || userBelongsToDepartment(user, challan.fromDepartment);
}

export async function editChallan(id: string, body: any, user: AuthenticatedUser) {
  const challan = await prisma.challan.findUnique({ where: { id }, include: { items: true } });
  if (!challan) throw new WorkRequestError('Challan not found.', 404);
  if (!canEditChallan(user, challan)) throw new WorkRequestError('Only the department that issued this challan (or an administrator) can edit it.', 403);
  if (body?.expectedUpdatedAt && new Date(body.expectedUpdatedAt).getTime() !== challan.updatedAt.getTime()) {
    throw new WorkRequestError('This challan was changed after you opened it. Reload it and make your edit again.', 409);
  }

  // Header.
  const header: Record<string, unknown> = {};
  if (body.challanNumber !== undefined && String(body.challanNumber).trim() !== challan.challanNumber) {
    const number = requireChallanNumber(body.challanNumber);
    if (number.toLowerCase() !== challan.challanNumber.toLowerCase()) await assertChallanNumbersAvailable(prisma, challan.fromDepartment, [{ value: number }]);
    header.challanNumber = number;
  }
  if (body.issuedDate !== undefined) {
    const d = new Date(String(body.issuedDate));
    if (Number.isNaN(d.getTime())) throw new WorkRequestError('Challan date is not a valid date.');
    header.issuedDate = d;
  }
  if (body.priority !== undefined) {
    const p = String(body.priority).toUpperCase();
    if (!['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(p)) throw new WorkRequestError('Priority must be Low, Normal, High or Urgent.');
    header.priority = p;
  }
  if (body.remarks !== undefined) header.remarks = withUserRemarks(challan.remarks, text(body.remarks, 1000));
  if (body.inchargeName !== undefined) header.inchargeName = text(body.inchargeName, 120);

  // Lines.
  const edits: any[] = Array.isArray(body.items) ? body.items : [];
  const byId = new Map(challan.items.map((i) => [i.id, i]));
  if (edits.some((e) => !byId.has(e?.id))) throw new WorkRequestError('A line does not belong to this challan.');
  const [storeAverage, storeUnitQuantity, storeWidth] = await Promise.all([canStoreChallanAverage(), canStoreChallanUnitQuantity(), canStoreChallanWidth()]);

  const lineUpdates: Array<{ line: (typeof challan.items)[number]; data: Record<string, any>; quantity: number; uom: string; quantityChanged: boolean }> = [];
  for (const [index, e] of edits.entries()) {
    const line = byId.get(e.id)!;
    const n = `Line ${index + 1}`;
    const data: Record<string, any> = {};
    for (const field of ['itemDescription', 'fabricCode', 'colour', 'shade', 'requiredColour', 'size', 'rollNumber', 'lotNumber', 'remarks'] as const) {
      if (e[field] !== undefined) data[field] = text(e[field], field === 'remarks' ? 500 : 200);
    }
    if (data.itemDescription === null) throw new WorkRequestError(`${n}: the fabric description cannot be empty.`);
    if (data.remarks !== undefined) data.remarks = withUserRemarks(line.remarks, data.remarks);
    if (e.average !== undefined || e.averageUnit !== undefined) {
      const avg = quantityPairOf(e.average, e.averageUnit, 'Average');
      if ('error' in avg) throw new WorkRequestError(`${n}: ${avg.error}`);
      if (storeAverage) Object.assign(data, { average: avg.value, averageUnit: avg.unit });
    }
    if (e.unitQuantity !== undefined || e.unitQuantityUom !== undefined) {
      const uq = quantityPairOf(e.unitQuantity, e.unitQuantityUom, 'Unit quantity');
      if ('error' in uq) throw new WorkRequestError(`${n}: ${uq.error}`);
      if (storeUnitQuantity) Object.assign(data, { unitQuantity: uq.value, unitQuantityUom: uq.unit });
    }
    // This line's own fabric width (blank clears it); other lines are never touched.
    if (e.width !== undefined) {
      const w = widthOf(e.width);
      if ('error' in w) throw new WorkRequestError(`${n}: ${w.error}`);
      if (storeWidth) data.width = w.value;
    }
    let quantity = line.quantity;
    let uom = line.uom;
    if (e.quantity !== undefined && e.quantity !== null && e.quantity !== '') {
      quantity = round(Number(e.quantity));
      if (!Number.isFinite(quantity) || quantity <= 0) throw new WorkRequestError(`${n}: quantity must be greater than zero.`);
    }
    if (e.uom !== undefined && e.uom !== null && e.uom !== '') {
      const u = unitOf(e.uom);
      if (u !== 'MTR' && u !== 'PCS') throw new WorkRequestError(`${n}: choose MTR or PCS.`);
      uom = u;
    }
    const quantityChanged = round(quantity) !== round(line.quantity) || unitOf(uom) !== unitOf(line.uom);
    if (quantityChanged) {
      Object.assign(data, { quantity, uom, unitType: uom === 'PCS' ? 'PCS' : line.unitType === 'PCS' ? 'ROLL' : line.unitType });
    }
    if (Object.keys(data).length) lineUpdates.push({ line, data, quantity, uom, quantityChanged });
  }

  const changingQuantity = lineUpdates.filter((u) => u.quantityChanged);
  if (changingQuantity.length) {
    if (!NOT_RECEIVED.includes(challan.status)) {
      throw new WorkRequestError(
        `Challan ${challan.challanNumber} has already been received (${challan.status.replace(/_/g, ' ').toLowerCase()}); quantities can no longer be changed here. Descriptions, remarks and other details can still be corrected.`,
        409,
      );
    }
    if (departmentKeyFor(challan.fromDepartment) === 'QC1' && challan.parentChallanId) {
      throw new WorkRequestError('This challan was created by a Dyeing QC inspection; its quantities follow that inspection and cannot be changed here.', 409);
    }
  }

  const ids = lineUpdates.map((u) => u.line.id);
  const challanItemIds = changingQuantity.map((u) => u.line.id);
  const [receivingItems, receivingOrders, workTransfers, dyeingTransfers] = await Promise.all([
    prisma.departmentWorkItem.findMany({ where: { inboundChallanItemId: { in: ids } } }),
    prisma.dyeingOrder.findMany({ where: { inboundChallanItemId: { in: ids } } }),
    prisma.departmentWorkTransfer.findMany({ where: { challanItemId: { in: challanItemIds } }, include: { workItem: true, allocation: true } }),
    prisma.dyeingQcTransfer.findMany({ where: { challanItemId: { in: challanItemIds } }, include: { dyeingOrder: true } }),
  ]);
  for (const u of changingQuantity) {
    const label = u.line.fabricCode || u.line.itemDescription;
    if (receivingItems.some((w) => w.inboundChallanItemId === u.line.id && w.status !== 'AWAITING_RECEIPT') || receivingOrders.some((o) => o.inboundChallanItemId === u.line.id && o.status !== 'AWAITING_RECEIPT')) {
      throw new WorkRequestError(`${label} has already been received by ${challan.toDepartment}; its quantity can no longer be changed here.`, 409);
    }
    const sourced = workTransfers.find((t) => t.challanItemId === u.line.id) || dyeingTransfers.find((t) => t.challanItemId === u.line.id);
    if (sourced && unitOf(u.uom) !== unitOf(sourced.uom)) {
      throw new WorkRequestError(`${label} was issued from a line kept in ${sourced.uom}; its unit cannot change (MTR and PCS are never converted). Correct the quantity only.`);
    }
  }

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const touchedRecutting = new Set<string>();
    for (const u of lineUpdates) {
      await tx.challanItem.update({ where: { id: u.line.id }, data: u.data });
      const delta = round(u.quantity - u.line.quantity);

      if (u.quantityChanged) {
        // Sending side: the line it was issued from carries the corrected quantity.
        const t = workTransfers.find((x) => x.challanItemId === u.line.id);
        if (t) {
          await tx.departmentWorkTransfer.update({ where: { id: t.id }, data: { quantity: u.quantity } });
          if (t.allocation) {
            const a = t.allocation;
            if (unitOf(t.uom) === unitOf(a.cutUom)) {
              const after = round(a.transferredQuantity + delta);
              if (after < 0 || after > round(a.cutQuantity)) {
                throw new WorkRequestError(`${a.allocationNumber}: only ${round(a.cutQuantity - a.transferredQuantity + u.line.quantity)} ${a.cutUom} is cut for this line.`);
              }
              const moved = await tx.workItemAllocation.updateMany({
                where: { id: a.id, transferredQuantity: a.transferredQuantity },
                data: { transferredQuantity: after, status: allocationStatusOf({ ...a, transferredQuantity: after }) },
              });
              if (moved.count !== 1) throw new WorkRequestError(`${a.allocationNumber} changed while saving. Reload and try again.`, 409);
            }
            touchedRecutting.add(t.workItemId);
          } else {
            const w = t.workItem;
            const field = t.kind === 'REJECT' ? 'rejectSentQuantity' : t.kind === 'REWORK' ? 'reworkSentQuantity' : 'transferredQuantity';
            const kind = (t.kind || 'PASS') as 'PASS' | 'REJECT' | 'REWORK';
            if (delta > 0 && delta > availableFor(w, kind)) {
              throw new WorkRequestError(`${w.fabricName}: only ${round(availableFor(w, kind) + u.line.quantity)} ${w.uom} can go on this line.`);
            }
            const after = round((w as any)[field] + delta);
            const next = { ...w, [field]: after };
            const status = isQcItem(w) ? qcStatusOf(next) : field === 'transferredQuantity' ? statusAfterTransfer(w, after) : w.status;
            const res = await tx.departmentWorkItem.updateMany({ where: { id: w.id, updatedAt: w.updatedAt }, data: { [field]: after, status } });
            if (res.count !== 1) throw new WorkRequestError(`${w.fabricName} changed while saving. Reload and try again.`, 409);
          }
        }
        const d = dyeingTransfers.find((x) => x.challanItemId === u.line.id);
        if (d) {
          const o = d.dyeingOrder;
          if (delta > 0 && delta > availableForQc(o)) throw new WorkRequestError(`${o.orderNumber}: only ${round(availableForQc(o) + u.line.quantity)} ${o.uom} is dyed for this line.`);
          const after = round(o.sentToQc1Quantity + delta);
          await tx.dyeingQcTransfer.update({ where: { id: d.id }, data: { quantity: u.quantity } });
          const res = await tx.dyeingOrder.updateMany({ where: { id: o.id, updatedAt: o.updatedAt }, data: { sentToQc1Quantity: after, status: dyeingStatusAfterTransfer(o, after) } });
          if (res.count !== 1) throw new WorkRequestError(`${o.orderNumber} changed while saving. Reload and try again.`, 409);
        }
      }

      // Receiving side: lines still awaiting receipt take the corrected figures; names follow corrections.
      const name = u.data.fabricCode !== undefined || u.data.itemDescription !== undefined ? (u.data.fabricCode ?? u.line.fabricCode) || (u.data.itemDescription ?? u.line.itemDescription) : undefined;
      const colour = u.data.colour !== undefined || u.data.shade !== undefined ? (u.data.colour ?? u.line.colour) || (u.data.shade ?? u.line.shade) || null : undefined;
      for (const w of receivingItems.filter((x) => x.inboundChallanItemId === u.line.id)) {
        await tx.departmentWorkItem.update({
          where: { id: w.id },
          data: {
            ...(name ? { fabricName: name } : {}),
            ...(colour !== undefined ? { colour } : {}),
            ...(u.quantityChanged && w.status === 'AWAITING_RECEIPT' ? { expectedQuantity: u.quantity, uom: u.uom } : {}),
          },
        });
      }
      for (const o of receivingOrders.filter((x) => x.inboundChallanItemId === u.line.id && x.status === 'AWAITING_RECEIPT')) {
        const required = u.data.requiredQuantity ?? u.line.requiredQuantity;
        await tx.dyeingOrder.update({
          where: { id: o.id },
          data: {
            ...(name ? { fabricName: name } : {}),
            ...(u.data.requiredColour !== undefined && u.data.requiredColour ? { targetColor: u.data.requiredColour } : {}),
            ...(u.quantityChanged ? { requiredQuantity: required ?? u.quantity, uom: u.uom } : {}),
          },
        });
      }
    }
    for (const itemId of touchedRecutting) await syncRecuttingItem(tx, itemId);

    // Header quantities follow the lines: one unit gives a header total, both units leave it to the lines.
    if (changingQuantity.length) {
      const items = await tx.challanItem.findMany({ where: { challanId: id }, select: { quantity: true, uom: true } });
      const totals = totalsByUnit(items, challan.fabricUnit);
      const units = Object.keys(totals);
      if (units.length === 1) {
        const defective = unitOf(challan.defectiveUnit || challan.fabricUnit) === units[0] ? Number(challan.defectivePieces) || 0 : 0;
        Object.assign(header, { fabricUnit: units[0], fabricOut: totals[units[0]], fabricIn: round(totals[units[0]] + defective) });
      } else {
        Object.assign(header, { fabricUnit: MIXED_UNIT, fabricOut: null, fabricIn: null });
      }
    }
    const updated = await tx.challan.updateMany({ where: { id, updatedAt: challan.updatedAt }, data: { ...header, updatedAt: now } });
    if (updated.count !== 1) throw new WorkRequestError('This challan was changed by someone else while saving. Reload and try again.', 409);

    // Fabric Store stock is re-posted from the corrected lines (only the difference moves).
    if (changingQuantity.length) await syncChallanStock(tx, id, user.id);

    await tx.challanEvent.create({
      data: {
        challanId: id,
        fromStatus: challan.status,
        toStatus: challan.status,
        action: 'EDIT',
        actorId: user.id,
        notes: text(body.editReason, 500) || 'Challan corrected',
        metadata: JSON.stringify({ header: Object.keys(header), lines: lineUpdates.map((u) => ({ id: u.line.id, fields: Object.keys(u.data) })) }),
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: 'CHALLAN_EDITED',
        entity: 'Challan',
        entityId: id,
        beforeState: JSON.stringify({ challanNumber: challan.challanNumber, header: Object.fromEntries(Object.keys(header).map((k) => [k, (challan as any)[k]])), lines: lineUpdates.map((u) => ({ id: u.line.id, before: Object.fromEntries(Object.keys(u.data).map((k) => [k, (u.line as any)[k]])) })) }),
        afterState: JSON.stringify({ header, lines: lineUpdates.map((u) => ({ id: u.line.id, after: u.data })) }),
      },
    });
    return tx.challan.findUnique({ where: { id }, include: { items: true } });
  }, { ...TX, ...STOCK_TRANSACTION_OPTIONS });
  return result;
}
