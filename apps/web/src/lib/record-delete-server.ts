import { prisma } from '@shubham/database';
import type { AuthenticatedUser } from '@/lib/auth/require-user';
import { departmentKeyFor, userBelongsToDepartment } from '@/lib/auth/department-access';
import { TX, WORKFLOWS, WorkRequestError, round, workflowReceiving, type WorkflowConfig } from '@/lib/work-items-server';
import { ACTIVE_HOLD_STATUSES } from '@/lib/holds.mjs';
import { lockSource, reopenHeldChallan, syncHeld } from '@/lib/holds-server';
import { writeAuditLog } from '@/lib/audit-log';
import { departmentName } from '@/lib/workflow-views';

// Department deletes of records entered by mistake, besides challans (lib/admin-delete-server.ts). Nothing is
// deleted in a way that breaks counts: each delete is checked against everything built on the record and refused
// while anything is, and each is recorded (challan history and audit log, with the reason).
//
// - Received Fabric (RECEIPT): one received line goes back to Awaiting Receipt, as if it had not been received. It
//   stays on its challan, which appears again in the department's Incoming Challans to be received correctly (or
//   deleted by the department that issued it). Allowed only while nothing was done with the line: not processed,
//   inspected, held, allocated, packed or forwarded. Lines: a department line (Embroidery to Inventory), a dyeing
//   order (Dyeing), or a challan received as a whole (Dyeing QC, Fabric Store).
// - HOLD: a HOLD placed by mistake is cancelled. Its quantity is free again (as a release would make it) and the
//   record stays, marked Deleted, with its history. Allowed only while nothing was released or decided on it.
//
// Department users act only on their own department's records; administrators on every department's.

export type DeleteKind = 'RECEIPT_WORK_ITEM' | 'RECEIPT_DYEING_ORDER' | 'RECEIPT_CHALLAN' | 'HOLD';
export const DELETE_KINDS: DeleteKind[] = ['RECEIPT_WORK_ITEM', 'RECEIPT_DYEING_ORDER', 'RECEIPT_CHALLAN', 'HOLD'];

/** What a delete would do, as the confirmation dialog shows it; `blockers` say why it cannot be done (yet). */
export interface DeleteImpact {
  kind: DeleteKind;
  id: string;
  recordType: string;
  title: string;
  department: string;
  details: Array<[string, string | number | null]>;
  effects: string[];
  blockers: string[];
  warning: string | null;
}

const qty = (n: number | null | undefined, unit: string | null | undefined) => `${round(Number(n) || 0)} ${unit || ''}`.trim();
const sheetRef = (p: { programSerialNo?: string | null; programNumber?: string | null } | null | undefined) => p?.programSerialNo || p?.programNumber || null;
const PROGRAM = { select: { id: true, programNumber: true, programSerialNo: true, designNumber: true } } as const;
/** Challans that left Fabric Store and still count (cancelled / rejected ones do not). */
const DEAD = ['DRAFT', 'CANCELLED', 'REJECTED'];
/** Challans received as a whole (no line records): their receipt is the challan's own status. */
const WHOLE_CHALLAN_RECEIVED = ['RECEIVED'];
const QC_HOLD_DEPARTMENTS = ['QC1', 'QC2', 'QC3', 'FINAL_CHECK'];

function accessBlocker(user: AuthenticatedUser, code: string) {
  return user.isAdmin || userBelongsToDepartment(user, code) ? [] : [`Only ${departmentName(code)} or an administrator can delete this record.`];
}

// ---------------------------------------------------------------- Received Fabric: department lines

async function workItemImpact(id: string, user: AuthenticatedUser) {
  const w = await prisma.departmentWorkItem.findUnique({
    where: { id },
    include: {
      program: PROGRAM,
      inboundChallan: { select: { id: true, challanNumber: true, status: true, fromDepartment: true } },
      _count: { select: { transfers: true, inspections: true, allocations: true, packingAllocations: true, downstreamWorkItems: true } },
    },
  });
  if (!w) throw new WorkRequestError('Received line not found.', 404);
  const holds = await prisma.departmentHold.count({ where: { sourceType: 'WORK_ITEM', sourceId: id } });
  const blockers = [...accessBlocker(user, w.departmentCode)];
  if (w.status === 'AWAITING_RECEIPT') {
    blockers.push(`This line has not been received yet, so there is no receipt to delete. Challan ${w.inboundChallan?.challanNumber || ''} can be deleted by ${departmentName(departmentKeyFor(w.inboundChallan?.fromDepartment) || w.inboundChallan?.fromDepartment)} (Floor Board > Issued Challans) or an administrator.`);
  }
  const done: string[] = [];
  if (w.processedQuantity > 0) done.push(`${qty(w.processedQuantity, w.uom)} processed or inspected`);
  if (w.takenQuantity > 0) done.push(`${qty(w.takenQuantity, w.uom)} taken into production`);
  if (w.defectQuantity > 0) done.push(`${qty(w.defectQuantity, w.uom)} recorded defective`);
  if (w.transferredQuantity + w.rejectSentQuantity + w.reworkSentQuantity > 0 || w._count.transfers > 0) done.push('quantity forwarded on challans');
  if (w._count.inspections > 0) done.push(`${w._count.inspections} inspection(s)`);
  if (w._count.allocations > 0) done.push(`${w._count.allocations} allocation(s)`);
  if (w._count.packingAllocations > 0) done.push('sent for packing');
  if (w._count.downstreamWorkItems > 0) done.push('later department lines built on it');
  if (w.heldQuantity > 0 || holds > 0) done.push('HOLD records');
  if (done.length) blockers.push(`This line already has ${done.join(', ')}. Correct or remove those first; a used receipt is not deleted.`);
  const cfg = (WORKFLOWS as Record<string, WorkflowConfig>)[w.departmentCode];
  const impact: DeleteImpact = {
    kind: 'RECEIPT_WORK_ITEM',
    id,
    recordType: 'Received Fabric',
    title: `${w.itemNumber} · ${w.fabricName}`,
    department: w.departmentCode,
    details: [
      ['Record', `Received line ${w.itemNumber}`],
      ['Challan Number', w.inboundChallan?.challanNumber || null],
      ['Design Number', w.program?.designNumber || null],
      ['Serial Number', w.program?.programSerialNo || null],
      ['Production Sheet', sheetRef(w.program)],
      ['Department', departmentName(w.departmentCode)],
      ['Sent by', w.sourceDepartment ? departmentName(departmentKeyFor(w.sourceDepartment) || w.sourceDepartment) : null],
      ['Fabric / Colour', [w.garmentCategory, w.fabricName, w.colour].filter(Boolean).join(' · ')],
      [`Quantity sent (${w.uom})`, qty(w.expectedQuantity, w.uom)],
      [`Quantity received (${w.uom})`, w.receivedQuantity == null ? null : qty(w.receivedQuantity, w.uom)],
      ['Status', w.status.replace(/_/g, ' ')],
    ],
    effects: [
      `The receipt of ${w.itemNumber} is removed: it goes back to Awaiting Receipt in ${departmentName(w.departmentCode)} > Incoming Challans, where it can be received again with the right quantity, or the challan can be deleted by ${departmentName(w.inboundChallan?.fromDepartment)}.`,
      `${departmentName(w.departmentCode)}'s received, available and pending quantities are recalculated from the remaining lines (${w.uom} only).`,
      cfg?.garmentStock ? `The Inventory stock entry posted by this receipt (${qty(w.receivedQuantity, w.uom)}) is removed.` : null,
      'The challan and its other lines are not changed.',
    ].filter(Boolean) as string[],
    blockers,
    warning: null,
  };
  return { impact, w, cfg };
}

async function reverseWorkItem(id: string, why: string, user: AuthenticatedUser) {
  const { impact, w, cfg } = await workItemImpact(id, user);
  if (impact.blockers.length) throw new WorkRequestError(impact.blockers.join(' '), 409);
  await prisma.$transaction(async (tx) => {
    // Only the untouched receipt is reversed: any processing, transfer or HOLD saved meanwhile stops it.
    const res = await tx.departmentWorkItem.updateMany({
      where: {
        id,
        updatedAt: w.updatedAt,
        status: { not: 'AWAITING_RECEIPT' },
        processedQuantity: 0,
        takenQuantity: 0,
        defectQuantity: 0,
        transferredQuantity: 0,
        rejectSentQuantity: 0,
        reworkSentQuantity: 0,
        heldQuantity: 0,
      },
      data: {
        status: 'AWAITING_RECEIPT',
        receivedQuantity: null,
        receivedUnitQuantity: null,
        receivedUnitQuantityUom: null,
        receivedAt: null,
        receivedById: null,
        receiptRemarks: null,
        startedAt: null,
        completedAt: null,
      },
    });
    if (res.count !== 1) throw new WorkRequestError(`${w.itemNumber} changed while deleting its receipt. Refresh and try again.`, 409);
    if (cfg?.garmentStock) await tx.stockLedgerEntry.deleteMany({ where: { idempotencyKey: `${cfg.code}_RECEIPT:${id}` } });
    await reopenChallan(tx, w.inboundChallanId, { departmentCode: w.departmentCode }, why, user, `${w.itemNumber}: receipt of ${qty(w.receivedQuantity, w.uom)} deleted`);
    await writeAuditLog(tx, { actorId: user.id, action: 'RECEIPT_DELETED', entity: 'DepartmentWorkItem', entityId: id, before: { ...Object.fromEntries(impact.details), reason: why } });
  }, TX);
  return `Receipt of ${w.itemNumber} deleted. It is back in ${departmentName(w.departmentCode)} > Incoming Challans.`;
}

/**
 * After a line's receipt is deleted: the challan goes back to Issued once none of its lines in that department is
 * received any more, so it is pending again for the receiver (and may be deleted by the sender).
 */
async function reopenChallan(tx: any, challanId: string | null, lines: { departmentCode?: string; dyeing?: boolean }, why: string, user: AuthenticatedUser, note: string) {
  if (!challanId) return;
  const stillReceived = lines.dyeing
    ? await tx.dyeingOrder.count({ where: { inboundChallanId: challanId, status: { not: 'AWAITING_RECEIPT' } } })
    : await tx.departmentWorkItem.count({ where: { inboundChallanId: challanId, departmentCode: lines.departmentCode, status: { not: 'AWAITING_RECEIPT' } } });
  const challan = await tx.challan.findUnique({ where: { id: challanId }, select: { status: true } });
  if (!challan) return;
  const reopen = stillReceived === 0 && challan.status === 'RECEIVED';
  if (reopen) await tx.challan.update({ where: { id: challanId }, data: { status: 'ISSUED', receivedDate: null, receivedById: null } });
  await tx.challanEvent.create({
    data: { challanId, fromStatus: challan.status, toStatus: reopen ? 'ISSUED' : challan.status, action: 'RECEIPT_DELETED', actorId: user.id, notes: `${note}. Reason: ${why}` },
  });
}

// ---------------------------------------------------------------- Received Fabric: dyeing orders

async function dyeingOrderImpact(id: string, user: AuthenticatedUser) {
  const o = await prisma.dyeingOrder.findUnique({
    where: { id },
    include: { program: PROGRAM, inboundChallan: { select: { id: true, challanNumber: true, fromDepartment: true } }, _count: { select: { qcTransfers: true } } },
  });
  if (!o) throw new WorkRequestError('Received line not found.', 404);
  const holds = await prisma.departmentHold.count({ where: { sourceType: 'DYEING_ORDER', sourceId: id } });
  const blockers = [...accessBlocker(user, 'DYEING')];
  if (o.status === 'AWAITING_RECEIPT') {
    blockers.push(`This line has not been received yet, so there is no receipt to delete. Challan ${o.inboundChallan?.challanNumber || ''} can be deleted by ${departmentName(departmentKeyFor(o.inboundChallan?.fromDepartment) || o.inboundChallan?.fromDepartment || 'STORE')} (Floor Board > Issued Challans) or an administrator.`);
  }
  const done: string[] = [];
  if (o.dyedQuantity > 0) done.push(`${qty(o.dyedQuantity, o.uom)} dyed`);
  if (o.sentToQc1Quantity > 0 || o._count.qcTransfers > 0) done.push('quantity sent to Dyeing QC');
  if (o.heldQuantity > 0 || holds > 0) done.push('HOLD records');
  if (done.length) blockers.push(`This line already has ${done.join(', ')}. Correct or remove those first; a used receipt is not deleted.`);
  const impact: DeleteImpact = {
    kind: 'RECEIPT_DYEING_ORDER',
    id,
    recordType: 'Received Fabric',
    title: `${o.orderNumber} · ${o.fabricName}`,
    department: 'DYEING',
    details: [
      ['Record', `Dyeing line ${o.orderNumber}`],
      ['Challan Number', o.inboundChallan?.challanNumber || null],
      ['Design Number', o.program?.designNumber || null],
      ['Serial Number', o.program?.programSerialNo || null],
      ['Production Sheet', sheetRef(o.program)],
      ['Department', 'Dyeing'],
      ['Fabric / Colour', [o.fabricName, o.targetColor ? `required ${o.targetColor}` : null].filter(Boolean).join(' · ')],
      [`Quantity sent (${o.uom})`, qty(o.requiredQuantity, o.uom)],
      [`Quantity received (${o.uom})`, o.receivedQuantity == null ? null : qty(o.receivedQuantity, o.uom)],
      ['Status', o.status.replace(/_/g, ' ')],
    ],
    effects: [
      `The receipt of ${o.orderNumber} is removed: it goes back to Awaiting Receipt in Dyeing > Incoming Challans, where it can be received again, or the challan can be deleted by ${departmentName(o.inboundChallan?.fromDepartment || 'STORE')}.`,
      `Dyeing's received, available and pending quantities are recalculated (${o.uom} only).`,
      'The challan and its other lines are not changed.',
    ],
    blockers,
    warning: null,
  };
  return { impact, o };
}

async function reverseDyeingOrder(id: string, why: string, user: AuthenticatedUser) {
  const { impact, o } = await dyeingOrderImpact(id, user);
  if (impact.blockers.length) throw new WorkRequestError(impact.blockers.join(' '), 409);
  await prisma.$transaction(async (tx) => {
    const res = await tx.dyeingOrder.updateMany({
      where: { id, updatedAt: o.updatedAt, status: { not: 'AWAITING_RECEIPT' }, dyedQuantity: 0, sentToQc1Quantity: 0, heldQuantity: 0 },
      data: {
        status: 'AWAITING_RECEIPT',
        receivedQuantity: null,
        receivedUnitQuantity: null,
        receivedUnitQuantityUom: null,
        undyedQuantity: 0,
        receivedAt: null,
        receivedById: null,
        receiptRemarks: null,
        startedAt: null,
        completedAt: null,
      },
    });
    if (res.count !== 1) throw new WorkRequestError(`${o.orderNumber} changed while deleting its receipt. Refresh and try again.`, 409);
    await reopenChallan(tx, o.inboundChallanId, { dyeing: true }, why, user, `${o.orderNumber}: receipt of ${qty(o.receivedQuantity, o.uom)} deleted`);
    await writeAuditLog(tx, { actorId: user.id, action: 'RECEIPT_DELETED', entity: 'DyeingOrder', entityId: id, before: { ...Object.fromEntries(impact.details), reason: why } });
  }, TX);
  return `Receipt of ${o.orderNumber} deleted. It is back in Dyeing > Incoming Challans.`;
}

// ---------------------------------------------------------------- Received Fabric: challans received as a whole

async function challanReceiptImpact(id: string, user: AuthenticatedUser) {
  const c = await prisma.challan.findUnique({
    where: { id },
    include: {
      program: PROGRAM,
      items: { select: { quantity: true, uom: true, fabricCode: true, itemDescription: true, colour: true } },
      _count: { select: { workItemsInbound: true, dyeingInboundOrders: true, productionLogs: true, inspections: true, childChallans: true } },
    },
  });
  if (!c) throw new WorkRequestError('Challan not found.', 404);
  const to = departmentKeyFor(c.toDepartment) || c.toDepartment;
  const blockers = [...accessBlocker(user, to)];
  // Department lines and dyeing orders are deleted line by line (above), never as a whole challan.
  if (c._count.workItemsInbound > 0 || c._count.dyeingInboundOrders > 0 || workflowReceiving(c)) {
    blockers.push(`${departmentName(to)} received this challan line by line; delete the received lines in its Received Fabric instead.`);
  }
  if (!WHOLE_CHALLAN_RECEIVED.includes(c.status)) blockers.push(`This challan is ${c.status.replace(/_/g, ' ')}; only a received challan's receipt can be deleted.`);
  const done: string[] = [];
  if (c._count.productionLogs > 0 || c._count.inspections > 0) done.push('inspections or production records');
  const holds = await prisma.departmentHold.count({ where: { sourceType: 'QC1_CHALLAN', sourceId: id } });
  if (holds > 0) done.push('HOLD records');
  const onward = await prisma.challan.count({ where: { parentChallanId: id, status: { notIn: DEAD } } });
  if (onward > 0) done.push(`${onward} challan(s) issued from it`);
  if (to === 'STORE' && c.programId) {
    const issued = await prisma.challan.findMany({
      where: { fromDepartment: 'STORE', status: { notIn: DEAD }, OR: [{ programId: c.programId }, { items: { some: { programId: c.programId } } }] },
      select: { challanNumber: true },
    });
    if (issued.length) done.push(`Fabric Store challan${issued.length === 1 ? '' : 's'} ${issued.map((i) => i.challanNumber).join(', ')} already issued for this Production Sheet`);
  }
  if (done.length) blockers.push(`This challan already has ${done.join(', ')}. Delete or correct those first.`);
  const totals: Record<string, number> = {};
  for (const i of c.items) totals[i.uom] = round((totals[i.uom] || 0) + i.quantity);
  const impact: DeleteImpact = {
    kind: 'RECEIPT_CHALLAN',
    id,
    recordType: 'Received Challan',
    title: c.challanNumber,
    department: to,
    details: [
      ['Record', `Receipt of challan ${c.challanNumber}`],
      ['Challan Number', c.challanNumber],
      ['Design Number', c.program?.designNumber || null],
      ['Serial Number', c.program?.programSerialNo || null],
      ['Production Sheet', sheetRef(c.program)],
      ['Department', departmentName(to)],
      ['Sent by', departmentName(departmentKeyFor(c.fromDepartment) || c.fromDepartment)],
      ['Fabric / Colour', Array.from(new Set(c.items.map((i) => [i.fabricCode || i.itemDescription, i.colour].filter(Boolean).join(' · ')))).join('; ')],
      ...(Object.entries(totals).map(([u, q]) => [`Quantity (${u})`, `${q} ${u}`]) as Array<[string, string]>),
      ['Status', c.status.replace(/_/g, ' ')],
    ],
    effects: [
      `Challan ${c.challanNumber} goes back to Issued: it is pending again in ${departmentName(to)} > Incoming Challans, where it can be received again, or deleted by ${departmentName(departmentKeyFor(c.fromDepartment) || c.fromDepartment)}.`,
      to === 'STORE' ? 'Fabric Store stock does not change (receiving this challan never added stock).' : null,
    ].filter(Boolean) as string[],
    blockers,
    warning: null,
  };
  return { impact, c, to };
}

async function reverseChallanReceipt(id: string, why: string, user: AuthenticatedUser) {
  const { impact, c, to } = await challanReceiptImpact(id, user);
  if (impact.blockers.length) throw new WorkRequestError(impact.blockers.join(' '), 409);
  await prisma.$transaction(async (tx) => {
    const res = await tx.challan.updateMany({ where: { id, status: c.status, updatedAt: c.updatedAt }, data: { status: 'ISSUED', receivedDate: null, receivedById: null } });
    if (res.count !== 1) throw new WorkRequestError(`Challan ${c.challanNumber} changed while deleting its receipt. Refresh and try again.`, 409);
    await tx.challanEvent.create({
      data: { challanId: id, fromStatus: c.status, toStatus: 'ISSUED', action: 'RECEIPT_DELETED', actorId: user.id, notes: `Receipt deleted by ${departmentName(to)}. Reason: ${why}` },
    });
    await writeAuditLog(tx, { actorId: user.id, action: 'RECEIPT_DELETED', entity: 'Challan', entityId: id, before: { ...Object.fromEntries(impact.details), reason: why } });
  }, TX);
  return `Receipt of challan ${c.challanNumber} deleted. It is pending again in ${departmentName(to)} > Incoming Challans.`;
}

// ---------------------------------------------------------------- HOLD placed by mistake

async function holdImpact(id: string, user: AuthenticatedUser) {
  const h = await prisma.departmentHold.findUnique({ where: { id }, include: { events: { select: { action: true } }, _count: { select: { releases: true } } } });
  if (!h) throw new WorkRequestError('HOLD record not found.', 404);
  const blockers = [...accessBlocker(user, h.departmentCode)];
  if (!ACTIVE_HOLD_STATUSES.includes(h.status)) blockers.push(`This HOLD is already ${h.status.replace(/_/g, ' ').toLowerCase()}.`);
  if (h.releasedQuantity > 0 || h._count.releases > 0) blockers.push('Part of this HOLD was already released; its history must stay. Release the rest instead.');
  if (h.events.some((e) => e.action !== 'HOLD')) blockers.push('This HOLD already has a QC decision or release in its history; release it instead.');
  // In QC departments a HOLD can be part of an inspection result; removing it would unbalance that result.
  if (QC_HOLD_DEPARTMENTS.includes(h.departmentCode)) blockers.push(`In ${departmentName(h.departmentCode)} a HOLD can be part of an inspection result, so it is not deleted. Release it to return the quantity to inspection.`);
  const impact: DeleteImpact = {
    kind: 'HOLD',
    id,
    recordType: 'HOLD Record',
    title: h.holdNumber,
    department: h.departmentCode,
    details: [
      ['Record', `HOLD ${h.holdNumber}`],
      ['Challan Number', h.challanNumber],
      ['Design Number', h.designNumber],
      ['Serial Number', h.serialNumber],
      ['Production Sheet', h.productionSheetNumber],
      ['Department', departmentName(h.departmentCode)],
      ['Fabric / Colour', [h.fabricName, h.colour].filter(Boolean).join(' · ')],
      [`On HOLD (${h.unit})`, qty(h.remainingQuantity, h.unit)],
      ['Status', h.status.replace(/_/g, ' ')],
    ],
    effects: [
      `${qty(h.remainingQuantity, h.unit)} is no longer held: it is available again for ${departmentName(h.departmentCode)}'s normal work.`,
      'The HOLD record stays in the list as Deleted, with its history and the reason.',
    ],
    blockers,
    warning: null,
  };
  return { impact, h };
}

async function deleteHold(id: string, why: string, user: AuthenticatedUser) {
  const { impact, h } = await holdImpact(id, user);
  if (impact.blockers.length) throw new WorkRequestError(impact.blockers.join(' '), 409);
  await prisma.$transaction(async (tx) => {
    await lockSource(tx, h.sourceType, h.sourceId);
    const res = await tx.departmentHold.updateMany({
      where: { id, updatedAt: h.updatedAt, status: { in: ACTIVE_HOLD_STATUSES }, releasedQuantity: 0 },
      data: { status: 'DELETED', remainingQuantity: 0, activeKey: null, closedAt: new Date() },
    });
    if (res.count !== 1) throw new WorkRequestError(`HOLD ${h.holdNumber} changed while deleting it. Refresh and try again.`, 409);
    await syncHeld(tx, h.sourceType, h.sourceId);
    await reopenHeldChallan(tx, h.sourceType, h.sourceId);
    await tx.departmentHoldEvent.create({
      data: { holdId: id, action: 'DELETE', quantity: h.remainingQuantity, remainingAfter: 0, unit: h.unit, remarks: `Deleted (placed by mistake): ${why}`, actorId: user.id, actorName: user.fullName || user.username },
    });
    await writeAuditLog(tx, { actorId: user.id, action: 'HOLD_DELETED', entity: 'DepartmentHold', entityId: id, before: { ...Object.fromEntries(impact.details), reason: why } });
  }, TX);
  return `HOLD ${h.holdNumber} deleted. ${qty(h.remainingQuantity, h.unit)} is available again.`;
}

// ---------------------------------------------------------------- entry points

function kindOf(raw: unknown): DeleteKind {
  const kind = String(raw || '').toUpperCase() as DeleteKind;
  if (!DELETE_KINDS.includes(kind)) throw new WorkRequestError('Unknown record type.');
  return kind;
}

/** What deleting the record would do, and why it cannot be done yet. Nothing is changed. */
export async function recordDeleteImpact(rawKind: unknown, id: string, user: AuthenticatedUser): Promise<DeleteImpact> {
  switch (kindOf(rawKind)) {
    case 'RECEIPT_WORK_ITEM':
      return (await workItemImpact(id, user)).impact;
    case 'RECEIPT_DYEING_ORDER':
      return (await dyeingOrderImpact(id, user)).impact;
    case 'RECEIPT_CHALLAN':
      return (await challanReceiptImpact(id, user)).impact;
    default:
      return (await holdImpact(id, user)).impact;
  }
}

/** Deletes the record (checked again inside its transaction); returns the message to show. */
export async function deleteRecord(rawKind: unknown, id: string, reason: unknown, user: AuthenticatedUser): Promise<string> {
  const why = typeof reason === 'string' ? reason.trim().slice(0, 500) : '';
  if (!why) throw new WorkRequestError('Enter the reason for deleting.');
  switch (kindOf(rawKind)) {
    case 'RECEIPT_WORK_ITEM':
      return reverseWorkItem(id, why, user);
    case 'RECEIPT_DYEING_ORDER':
      return reverseDyeingOrder(id, why, user);
    case 'RECEIPT_CHALLAN':
      return reverseChallanReceipt(id, why, user);
    default:
      return deleteHold(id, why, user);
  }
}
