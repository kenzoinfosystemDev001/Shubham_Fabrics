import { prisma } from '@shubham/database';
import { userBelongsToDepartment, departmentKeyFor } from '@/lib/auth/department-access';
import type { AuthenticatedUser } from '@/lib/auth/require-user';
import { TX, WorkRequestError, round, syncWorkItems, workflowReceiving } from '@/lib/work-items-server';
import { availableFor, isQcItem, qcStatusOf, statusAfterTransfer } from '@/lib/work-items.mjs';
import { allocationStatusOf } from '@/lib/recutting.mjs';
import { availableForQc, statusAfterTransfer as dyeingStatusAfterTransfer } from '@/lib/dyeing-workflow.mjs';
import { MIXED_UNIT, quantityPairOf, totalsByUnit, unitOf, widthOf } from '@/lib/challan-units.mjs';
import { canStoreChallanAverage, canStoreChallanUnitQuantity, canStoreChallanWidth } from '@/lib/challan-item-average';
import { syncInboundChallansToDyeingOrders } from '@/lib/dyeing-sync';
import { STOCK_TRANSACTION_OPTIONS, syncChallanStock } from '@/lib/fabric-stock-ledger';
import { syncItem as syncRecuttingItem } from '@/lib/recutting-server';
import { withUserRemarks } from '@/lib/challan-remarks.mjs';

// Editing an issued challan to correct mistakes. The same challan is updated: its ID, number, issuing and
// receiving departments, Production Sheet, creator and history never change. Everything descriptive can always be
// corrected: the header (date, priority, remarks, incharge) and each line's fabric, colour, shade, size, Average,
// Unit quantity, width and remarks. Until the receiving department has received a line, its quantity and unit can
// be corrected and the line can be removed; until nothing on the challan is received, lines can be added (on
// challans whose lines are not issued from another department line: Programming and Fabric Store challans).
// The records that copied a line move with it in the same transaction, so nothing is counted twice:
// - the sending line's transferred total (work item, Recutting allocation, dyeing order);
// - Fabric Store stock (challans issued by the Store are re-posted from their lines; only the difference moves);
// - the receiving department's line still awaiting receipt (work item or dyeing order).
// Received quantities are never overwritten, and Dyeing QC's PASS / rework challans keep the inspection's quantities.
// Every edit needs a reason and is recorded (ChallanEvent EDIT with each change, and AuditLog before/after).

const NOT_RECEIVED = ['DRAFT', 'ISSUED', 'SUBMITTED', 'IN_TRANSIT'];
const CLOSED = ['CANCELLED', 'REJECTED'];
const text = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) || null : undefined);
const LINE_FIELDS = ['itemDescription', 'fabricCode', 'colour', 'shade', 'requiredColour', 'size', 'rollNumber', 'lotNumber', 'remarks'] as const;
const LINE_LABELS: Record<string, string> = {
  itemDescription: 'Description', fabricCode: 'Fabric', colour: 'Colour', shade: 'Shade', requiredColour: 'Dye colour', size: 'Size',
  rollNumber: 'Roll', lotNumber: 'Lot', remarks: 'Remarks', quantity: 'Quantity', uom: 'Unit', average: 'Average', averageUnit: 'Average unit',
  unitQuantity: 'Unit quantity', unitQuantityUom: 'Unit quantity unit', width: 'Width', unitType: 'Unit type',
};
const HEADER_LABELS: Record<string, string> = {
  issuedDate: 'Challan date', priority: 'Priority', remarks: 'Remarks', inchargeName: 'Incharge',
  fabricUnit: 'Unit', fabricIn: 'Fabric in', fabricOut: 'Fabric out',
};
const shown = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v === null || v === undefined || v === '' ? null : v);
const lineLabel = (l: { fabricCode?: string | null; itemDescription?: string | null }) => l.fabricCode || l.itemDescription || 'Line';

/** Who may edit: administrators and the department that issued the challan. */
export function canEditChallan(user: AuthenticatedUser, challan: { fromDepartment: string }) {
  return user.isAdmin || userBelongsToDepartment(user, challan.fromDepartment);
}

/** Lines issued from another department's line (work, dyeing order, inspection): they cannot be added here. */
function isSourcedChallan(challan: { fromDepartment: string; parentChallanId: string | null; items: Array<{ id: string; sourceChallanItemId?: string | null }> }) {
  return challan.items.some((i) => i.sourceChallanItemId) || (departmentKeyFor(challan.fromDepartment) === 'QC1' && Boolean(challan.parentChallanId));
}

/** What the edit form may offer for this challan and user (the server checks every save again). */
export async function challanEditOptions(challan: { id: string; status: string; fromDepartment: string; parentChallanId: string | null; items: Array<{ id: string; sourceChallanItemId?: string | null }> }, user: AuthenticatedUser | null) {
  const canEdit = Boolean(user && canEditChallan(user, challan)) && !CLOSED.includes(challan.status);
  const notReceived = NOT_RECEIVED.includes(challan.status);
  const inspectionChallan = departmentKeyFor(challan.fromDepartment) === 'QC1' && Boolean(challan.parentChallanId);
  const ids = challan.items.map((i) => i.id);
  const [received, orders] = notReceived && ids.length
    ? await Promise.all([
        prisma.departmentWorkItem.findMany({ where: { inboundChallanItemId: { in: ids }, status: { not: 'AWAITING_RECEIPT' } }, select: { inboundChallanItemId: true } }),
        prisma.dyeingOrder.findMany({ where: { inboundChallanItemId: { in: ids }, status: { not: 'AWAITING_RECEIPT' } }, select: { inboundChallanItemId: true } }),
      ])
    : [[], []];
  const receivedLineIds = Array.from(new Set([...received, ...orders].map((r) => r.inboundChallanItemId as string)));
  return {
    canEdit,
    quantitiesOpen: canEdit && notReceived && !inspectionChallan,
    receivedLineIds,
    canRemoveLines: canEdit && notReceived && !inspectionChallan,
    canAddLines: canEdit && notReceived && receivedLineIds.length === 0 && !isSourcedChallan(challan),
  };
}

export async function editChallan(id: string, body: any, user: AuthenticatedUser) {
  const challan = await prisma.challan.findUnique({ where: { id }, include: { items: { orderBy: { createdAt: 'asc' } } } });
  if (!challan) throw new WorkRequestError('Challan not found.', 404);
  if (!canEditChallan(user, challan)) throw new WorkRequestError('Only the department that issued this challan (or an administrator) can edit it.', 403);
  if (CLOSED.includes(challan.status)) throw new WorkRequestError(`Challan ${challan.challanNumber} is ${challan.status.toLowerCase()} and can no longer be edited.`, 409);
  if (body?.expectedUpdatedAt && new Date(body.expectedUpdatedAt).getTime() !== challan.updatedAt.getTime()) {
    throw new WorkRequestError('This challan was changed after you opened it. Reload it and make your edit again.', 409);
  }
  const editReason = text(body?.editReason, 500);
  if (!editReason) throw new WorkRequestError('Enter the reason for this correction.');

  // Header. The challan number identifies the challan and never changes.
  const header: Record<string, unknown> = {};
  if (body.challanNumber !== undefined && String(body.challanNumber).trim().toLowerCase() !== challan.challanNumber.toLowerCase()) {
    throw new WorkRequestError(`The challan number (${challan.challanNumber}) cannot be changed.`);
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
    for (const field of LINE_FIELDS) {
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

  // Lines removed and added.
  const removeIds: string[] = Array.isArray(body.removeItemIds) ? Array.from(new Set(body.removeItemIds.map((v: unknown) => String(v)))) : [];
  if (removeIds.some((rid) => !byId.has(rid))) throw new WorkRequestError('A removed line does not belong to this challan.');
  if (lineUpdates.some((u) => removeIds.includes(u.line.id))) throw new WorkRequestError('A line cannot be both changed and removed.');
  const newLines: Array<Record<string, any>> = [];
  for (const [index, e] of (Array.isArray(body.newItems) ? body.newItems : []).entries()) {
    const n = `New line ${index + 1}`;
    const description = text(e?.itemDescription, 200) || text(e?.fabricCode, 200);
    if (!description) throw new WorkRequestError(`${n}: enter the fabric or description.`);
    const quantity = round(Number(e?.quantity));
    if (!Number.isFinite(quantity) || quantity <= 0) throw new WorkRequestError(`${n}: quantity must be greater than zero.`);
    const uom = unitOf(e?.uom);
    if (uom !== 'MTR' && uom !== 'PCS') throw new WorkRequestError(`${n}: choose MTR or PCS.`);
    const data: Record<string, any> = { itemDescription: description, quantity, uom, unitType: uom === 'PCS' ? 'PCS' : 'ROLL' };
    for (const field of LINE_FIELDS) if (field !== 'itemDescription') data[field] = text(e?.[field], field === 'remarks' ? 500 : 200) ?? null;
    const status = String(e?.fabricProcessingStatus || '').toUpperCase();
    if (status === 'DYED' || status === 'UNDYED') data.fabricProcessingStatus = status;
    const avg = quantityPairOf(e?.average, e?.averageUnit, 'Average');
    if ('error' in avg) throw new WorkRequestError(`${n}: ${avg.error}`);
    if (storeAverage) Object.assign(data, { average: avg.value, averageUnit: avg.unit });
    const uq = quantityPairOf(e?.unitQuantity, e?.unitQuantityUom, 'Unit quantity');
    if ('error' in uq) throw new WorkRequestError(`${n}: ${uq.error}`);
    if (storeUnitQuantity) Object.assign(data, { unitQuantity: uq.value, unitQuantityUom: uq.unit });
    const w = widthOf(e?.width ?? '');
    if ('error' in w) throw new WorkRequestError(`${n}: ${w.error}`);
    if (storeWidth) data.width = w.value;
    newLines.push(data);
  }
  if (challan.items.length - removeIds.length + newLines.length < 1) throw new WorkRequestError('A challan needs at least one line. Cancel the challan instead.');
  if (!lineUpdates.length && !removeIds.length && !newLines.length && !Object.keys(header).length) throw new WorkRequestError('Nothing was changed.');

  const changingQuantity = lineUpdates.filter((u) => u.quantityChanged);
  const changingLines = changingQuantity.length > 0 || removeIds.length > 0 || newLines.length > 0;
  if (changingLines) {
    if (!NOT_RECEIVED.includes(challan.status)) {
      throw new WorkRequestError(
        `Challan ${challan.challanNumber} has already been received (${challan.status.replace(/_/g, ' ').toLowerCase()}); quantities and lines can no longer be changed here. Descriptions, remarks and other details can still be corrected.`,
        409,
      );
    }
    if (departmentKeyFor(challan.fromDepartment) === 'QC1' && challan.parentChallanId) {
      throw new WorkRequestError('This challan was created by a Dyeing QC inspection; its quantities and lines follow that inspection and cannot be changed here.', 409);
    }
  }
  if (newLines.length && isSourcedChallan(challan)) {
    throw new WorkRequestError(`The lines of this challan are issued from ${challan.fromDepartment} work; lines cannot be added here. Issue a new challan for the extra quantity.`, 409);
  }

  const allIds = challan.items.map((i) => i.id);
  const ids = lineUpdates.map((u) => u.line.id);
  const challanItemIds = [...changingQuantity.map((u) => u.line.id), ...removeIds];
  const [receivingItems, receivingOrders, workTransfers, dyeingTransfers] = await Promise.all([
    prisma.departmentWorkItem.findMany({ where: { inboundChallanItemId: { in: allIds } } }),
    prisma.dyeingOrder.findMany({ where: { inboundChallanItemId: { in: allIds } } }),
    prisma.departmentWorkTransfer.findMany({ where: { challanItemId: { in: newLines.length ? allIds : challanItemIds } }, include: { workItem: true, allocation: true } }),
    prisma.dyeingQcTransfer.findMany({ where: { challanItemId: { in: newLines.length ? allIds : challanItemIds } }, include: { dyeingOrder: true } }),
  ]);
  const isReceived = (lineId: string) =>
    receivingItems.some((w) => w.inboundChallanItemId === lineId && w.status !== 'AWAITING_RECEIPT') ||
    receivingOrders.some((o) => o.inboundChallanItemId === lineId && o.status !== 'AWAITING_RECEIPT');
  if (newLines.length && (workTransfers.length || dyeingTransfers.length)) {
    throw new WorkRequestError(`The lines of this challan are issued from ${challan.fromDepartment} work; lines cannot be added here. Issue a new challan for the extra quantity.`, 409);
  }
  if (newLines.length && allIds.some(isReceived)) {
    throw new WorkRequestError(`${challan.toDepartment} has already received part of this challan; lines can no longer be added. Issue a new challan for the extra quantity.`, 409);
  }
  for (const rid of removeIds) {
    if (isReceived(rid)) throw new WorkRequestError(`${lineLabel(byId.get(rid)!)} has already been received by ${challan.toDepartment}; it can no longer be removed.`, 409);
  }
  for (const u of changingQuantity) {
    const label = lineLabel(u.line);
    if (isReceived(u.line.id)) {
      throw new WorkRequestError(`${label} has already been received by ${challan.toDepartment}; its quantity can no longer be changed here.`, 409);
    }
    const sourced = workTransfers.find((t) => t.challanItemId === u.line.id) || dyeingTransfers.find((t) => t.challanItemId === u.line.id);
    if (sourced && unitOf(u.uom) !== unitOf(sourced.uom)) {
      throw new WorkRequestError(`${label} was issued from a line kept in ${sourced.uom}; its unit cannot change (MTR and PCS are never converted). Correct the quantity only.`);
    }
  }

  // What the history shows: every changed value with its old and new value.
  const headerChanges = (after: Record<string, unknown>) =>
    Object.fromEntries(
      Object.keys(after)
        .filter((k) => k !== 'updatedAt')
        .map((k) => [k, { label: HEADER_LABELS[k] || k, from: shown((challan as any)[k]), to: shown(after[k]) }])
        .filter(([, c]: any) => JSON.stringify(c.from) !== JSON.stringify(c.to)),
    );
  const lineChanges = lineUpdates
    .map((u) => ({
      id: u.line.id,
      line: lineLabel(u.line),
      changes: Object.fromEntries(
        Object.keys(u.data)
          .map((k) => [k, { label: LINE_LABELS[k] || k, from: shown((u.line as any)[k]), to: shown(u.data[k]) }])
          .filter(([, c]: any) => JSON.stringify(c.from) !== JSON.stringify(c.to)),
      ),
    }))
    .filter((l) => Object.keys(l.changes).length);
  const snapshot = (l: Record<string, any>) => ({
    line: lineLabel(l as any),
    description: l.itemDescription ?? null,
    colour: l.colour ?? null,
    quantity: l.quantity,
    uom: l.uom,
    width: l.width ?? null,
  });

  const now = new Date();
  const outcome = await prisma.$transaction(async (tx) => {
    const touchedRecutting = new Set<string>();

    // Sending side: the line a challan line was issued from carries its corrected quantity (`quantity` null:
    // the challan line is removed, so its transfer goes and the whole quantity returns to the sending line).
    // Records are read again inside the transaction, so two lines from the same source both count.
    const moveSource = async (line: (typeof challan.items)[number], quantity: number | null) => {
      const delta = round((quantity ?? 0) - line.quantity);
      const t = workTransfers.find((x) => x.challanItemId === line.id);
      if (t) {
        if (quantity === null) await tx.departmentWorkTransfer.delete({ where: { id: t.id } });
        else await tx.departmentWorkTransfer.update({ where: { id: t.id }, data: { quantity } });
        if (t.allocation) {
          const a = await tx.workItemAllocation.findUnique({ where: { id: t.allocation.id } });
          if (a && unitOf(t.uom) === unitOf(a.cutUom)) {
            const after = round(a.transferredQuantity + delta);
            if (after < 0 || after > round(a.cutQuantity)) {
              throw new WorkRequestError(`${a.allocationNumber}: only ${round(a.cutQuantity - a.transferredQuantity + line.quantity)} ${a.cutUom} is cut for this line.`);
            }
            const moved = await tx.workItemAllocation.updateMany({
              where: { id: a.id, transferredQuantity: a.transferredQuantity },
              data: { transferredQuantity: after, status: allocationStatusOf({ ...a, transferredQuantity: after }) },
            });
            if (moved.count !== 1) throw new WorkRequestError(`${a.allocationNumber} changed while saving. Reload and try again.`, 409);
          }
          touchedRecutting.add(t.workItemId);
        } else {
          const w = await tx.departmentWorkItem.findUnique({ where: { id: t.workItemId } });
          if (!w) throw new WorkRequestError(`The line ${lineLabel(line)} was issued from no longer exists.`, 409);
          const field = t.kind === 'REJECT' ? 'rejectSentQuantity' : t.kind === 'REWORK' ? 'reworkSentQuantity' : 'transferredQuantity';
          const kind = (t.kind || 'PASS') as 'PASS' | 'REJECT' | 'REWORK';
          if (delta > 0 && delta > availableFor(w, kind)) {
            throw new WorkRequestError(`${w.fabricName}: only ${round(availableFor(w, kind) + line.quantity)} ${w.uom} can go on this line.`);
          }
          const after = round((w as any)[field] + delta);
          if (after < 0) throw new WorkRequestError(`${w.fabricName}: the sending line's totals no longer match this challan. Reload and try again.`, 409);
          const next = { ...w, [field]: after };
          const status = isQcItem(w) ? qcStatusOf(next) : field === 'transferredQuantity' ? statusAfterTransfer(w, after) : w.status;
          const res = await tx.departmentWorkItem.updateMany({ where: { id: w.id, updatedAt: w.updatedAt }, data: { [field]: after, status } });
          if (res.count !== 1) throw new WorkRequestError(`${w.fabricName} changed while saving. Reload and try again.`, 409);
        }
      }
      const d = dyeingTransfers.find((x) => x.challanItemId === line.id);
      if (d) {
        const o = await tx.dyeingOrder.findUnique({ where: { id: d.dyeingOrderId } });
        if (!o) throw new WorkRequestError(`The dyeing order ${lineLabel(line)} was issued from no longer exists.`, 409);
        if (delta > 0 && delta > availableForQc(o)) throw new WorkRequestError(`${o.orderNumber}: only ${round(availableForQc(o) + line.quantity)} ${o.uom} is dyed for this line.`);
        const after = round(o.sentToQc1Quantity + delta);
        if (after < 0) throw new WorkRequestError(`${o.orderNumber}: the dyeing order's totals no longer match this challan. Reload and try again.`, 409);
        if (quantity === null) await tx.dyeingQcTransfer.delete({ where: { id: d.id } });
        else await tx.dyeingQcTransfer.update({ where: { id: d.id }, data: { quantity } });
        const res = await tx.dyeingOrder.updateMany({ where: { id: o.id, updatedAt: o.updatedAt }, data: { sentToQc1Quantity: after, status: dyeingStatusAfterTransfer(o, after) } });
        if (res.count !== 1) throw new WorkRequestError(`${o.orderNumber} changed while saving. Reload and try again.`, 409);
      }
    };

    for (const u of lineUpdates) {
      await tx.challanItem.update({ where: { id: u.line.id }, data: u.data });
      if (u.quantityChanged) await moveSource(u.line, u.quantity);

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

    // Removed lines: the quantity returns to the sending line, the receiving department's line (still awaiting
    // receipt) goes, and so does the challan line.
    for (const rid of removeIds) {
      const line = byId.get(rid)!;
      await moveSource(line, null);
      await tx.departmentWorkItem.deleteMany({ where: { inboundChallanItemId: rid, status: 'AWAITING_RECEIPT' } });
      await tx.dyeingOrder.deleteMany({ where: { inboundChallanItemId: rid, status: 'AWAITING_RECEIPT' } });
      await tx.challanItem.delete({ where: { id: rid } });
    }

    // Added lines belong to the challan's own Production Sheet (sheets are never mixed by an edit). Nothing on
    // the challan is received yet, so the receiving department's lines are rebuilt for every line after saving.
    for (const data of newLines) {
      await tx.challanItem.create({
        data: {
          ...data,
          challanId: id,
          programId: challan.programId,
          fabricProcessingStatus: data.fabricProcessingStatus ?? challan.items.find((i) => i.fabricProcessingStatus)?.fabricProcessingStatus ?? null,
        } as any,
      });
    }
    const rebuildReceiving = newLines.length > 0 && (receivingItems.length > 0 || receivingOrders.length > 0);
    if (rebuildReceiving) {
      await tx.departmentWorkItem.deleteMany({ where: { inboundChallanId: id, status: 'AWAITING_RECEIPT' } });
      await tx.dyeingOrder.deleteMany({ where: { inboundChallanId: id, status: 'AWAITING_RECEIPT' } });
    }
    for (const itemId of touchedRecutting) await syncRecuttingItem(tx, itemId);

    // Header quantities follow the lines: one unit gives a header total, both units leave it to the lines.
    if (changingLines) {
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

    // Fabric Store stock is re-posted from the corrected lines (only the difference moves; MTR and PCS apart).
    if (changingLines) await syncChallanStock(tx, id, user.id);

    const changes = {
      header: headerChanges(header),
      lines: lineChanges,
      added: newLines.map(snapshot),
      removed: removeIds.map((rid) => snapshot(byId.get(rid)!)),
    };
    await tx.challanEvent.create({
      data: {
        challanId: id,
        fromStatus: challan.status,
        toStatus: challan.status,
        action: 'EDIT',
        actorId: user.id,
        reason: editReason,
        notes: editReason,
        metadata: JSON.stringify(changes),
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: 'CHALLAN_EDITED',
        entity: 'Challan',
        entityId: id,
        beforeState: JSON.stringify({
          challanNumber: challan.challanNumber,
          header: Object.fromEntries(Object.keys(header).map((k) => [k, (challan as any)[k]])),
          lines: lineUpdates.map((u) => ({ id: u.line.id, before: Object.fromEntries(Object.keys(u.data).map((k) => [k, (u.line as any)[k]])) })),
          removed: removeIds.map((rid) => byId.get(rid)),
        }),
        afterState: JSON.stringify({ reason: editReason, header, lines: lineUpdates.map((u) => ({ id: u.line.id, after: u.data })), added: newLines }),
      },
    });
    const saved = await tx.challan.findUnique({ where: { id }, include: { items: true } });
    return { saved, rebuildReceiving };
  }, { ...TX, ...STOCK_TRANSACTION_OPTIONS });

  // The receiving department's lines for the changed challan are created again (as when it was issued).
  if (outcome.rebuildReceiving) await rebuildReceivingLines(challan).catch((error) => console.error('Could not rebuild receiving lines:', error));
  return outcome.saved;
}

async function rebuildReceivingLines(challan: { fromDepartment: string; toDepartment: string; challanType: string }) {
  if (departmentKeyFor(challan.toDepartment) === 'DYEING') {
    await syncInboundChallansToDyeingOrders();
    return;
  }
  const cfg = workflowReceiving(challan);
  if (cfg) await syncWorkItems(cfg);
}

/** The challan's edits, newest first, with who made them and why. */
export async function challanEditHistory(challanId: string) {
  const events = await prisma.challanEvent.findMany({
    where: { challanId, action: 'EDIT' },
    orderBy: { createdAt: 'desc' },
    include: { actor: { select: { fullName: true, username: true } } },
  });
  return events.map((e) => {
    let changes: any = null;
    try {
      changes = e.metadata ? JSON.parse(e.metadata) : null;
    } catch {}
    return {
      id: e.id,
      at: e.createdAt,
      by: e.actor?.fullName || e.actor?.username || 'Unknown',
      reason: e.reason || e.notes || null,
      status: e.fromStatus,
      // Edits saved before old/new values were recorded list only which fields changed.
      changes: changes && !Array.isArray(changes.header) ? changes : null,
      legacyFields: changes && Array.isArray(changes.header) ? changes : null,
    };
  });
}
