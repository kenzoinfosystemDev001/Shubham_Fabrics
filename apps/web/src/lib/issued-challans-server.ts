import { prisma } from '@shubham/database';
import { DEPARTMENT_ACCESS, departmentKeyFor, userBelongsToDepartment, type DepartmentKey } from '@/lib/auth/department-access';
import type { AuthenticatedUser } from '@/lib/auth/require-user';
import { WorkRequestError } from '@/lib/work-items-server';
import { receivedBasis } from '@/lib/work-items.mjs';
import { unitOf } from '@/lib/challan-units.mjs';
import { inchargeNameOf, userChallanRemarks } from '@/lib/challan-remarks.mjs';
import { cleanFabricName } from '@/lib/fabric-stock-rules.mjs';
import { departmentName } from '@/lib/workflow-views';

// Floor Board > COMPLETED: the challans a department has issued, read straight from Challan and its items.
// Nothing is stored for this list: a challan appears as soon as it is issued (not DRAFT), and its receiving
// status comes from the destination's own receipt records, so it updates when the destination receives:
// - work items (Embroidery onward): the line's received quantity;
// - dyeing orders (Dyeing, including Dyeing QC rework returns): the line's received quantity;
// - otherwise (Dyeing QC, Fabric Store ...): the challan's own receipt (status / received date).
// Quantities stay per unit (MTR or PCS) and are never added across units.

/** Challans that were never issued, or were withdrawn: never listed as issued. */
const NOT_ISSUED = ['DRAFT', 'CANCELLED', 'REJECTED'];
/** Challan statuses before the destination received it. */
const NOT_YET_RECEIVED = ['ISSUED', 'SUBMITTED', 'IN_TRANSIT'];
const EPS = 0.001;
const MAX_PAGE_SIZE = 100;
const round = (n: number) => Math.round((Number(n) || 0) * 1000) / 1000;
const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);
const userName = (u: { fullName?: string | null; username?: string | null } | null | undefined) => u?.fullName || u?.username || null;
const unitKey = (raw: unknown) => (unitOf(raw) || String(raw || '').trim().toUpperCase() || '—') as string;

export type ReceivingStatus = 'PENDING' | 'PARTIALLY_RECEIVED' | 'RECEIVED';
export const RECEIVING_LABEL: Record<ReceivingStatus, string> = {
  PENDING: 'Pending Receipt',
  PARTIALLY_RECEIVED: 'Partially Received',
  RECEIVED: 'Received',
};

/** The department whose issued challans to list: the user's own, or any (administrators; "ALL" for every department). */
export function issuingDepartmentFor(user: AuthenticatedUser, raw: string | null): DepartmentKey | 'ALL' {
  if (!raw || raw.toUpperCase() === 'ALL') {
    if (user.isAdmin && (raw || '').toUpperCase() === 'ALL') return 'ALL';
    const own = departmentKeyFor(user.departmentCode) || departmentKeyFor(user.sessionDepartment);
    if (!own) throw new WorkRequestError('Choose a department.', 400);
    return own;
  }
  const key = departmentKeyFor(raw);
  if (!key) throw new WorkRequestError('Unknown department.', 404);
  if (!userBelongsToDepartment(user, key)) throw new WorkRequestError('You can only see challans issued by your own department.', 403);
  return key;
}

const codesOf = (key: DepartmentKey) => [...DEPARTMENT_ACCESS[key].codes] as string[];

function issuedWhere(dept: DepartmentKey | 'ALL') {
  return {
    status: { notIn: NOT_ISSUED },
    ...(dept === 'ALL' ? {} : { fromDepartment: { in: codesOf(dept) } }),
  };
}

/** Number of challans the department has issued (the COMPLETED badge). */
export async function issuedCount(dept: DepartmentKey | 'ALL') {
  return prisma.challan.count({ where: issuedWhere(dept) });
}

// ---------------------------------------------------------------- receipt of each line

type LineReceipt = { received: number; receivedAt: string | null; receivedBy: string | null; remarks: string | null; reference: string | null };

/** How much of each challan line the destination has received, from its own receipt records. */
async function receiptsFor(challans: Array<{ id: string; toDepartment: string; status: string; receivedDate: Date | null; receivedBy?: { fullName: string | null; username: string } | null; items: Array<{ id: string; quantity: number }> }>) {
  const itemIds = challans.flatMap((c) => c.items.map((i) => i.id));
  const [workItems, orders] = itemIds.length
    ? await Promise.all([
        prisma.departmentWorkItem.findMany({
          where: { inboundChallanItemId: { in: itemIds } },
          select: { id: true, itemNumber: true, departmentCode: true, inboundChallanItemId: true, status: true, expectedQuantity: true, receivedQuantity: true, receivedAt: true, receiptRemarks: true, receivedBy: { select: { fullName: true, username: true } } },
        }),
        prisma.dyeingOrder.findMany({
          where: { inboundChallanItemId: { in: itemIds } },
          select: { id: true, orderNumber: true, inboundChallanItemId: true, status: true, receivedQuantity: true, receivedAt: true, receiptRemarks: true, receivedBy: { select: { fullName: true, username: true } } },
        }),
      ])
    : [[], []];
  const workItemsOf = new Map<string, typeof workItems>();
  for (const w of workItems) workItemsOf.set(w.inboundChallanItemId, [...(workItemsOf.get(w.inboundChallanItemId) || []), w]);
  const orderOf = new Map(orders.map((o) => [o.inboundChallanItemId as string, o]));
  const out = new Map<string, LineReceipt>();
  for (const c of challans) {
    const destination = departmentKeyFor(c.toDepartment);
    const challanReceived = !NOT_YET_RECEIVED.includes(c.status) || !!c.receivedDate;
    for (const item of c.items) {
      const candidates = workItemsOf.get(item.id) || [];
      const wi = candidates.find((w) => departmentKeyFor(w.departmentCode) === destination) || candidates[0];
      const order = orderOf.get(item.id);
      if (wi) {
        const received = wi.status === 'AWAITING_RECEIPT' ? 0 : receivedBasis(wi);
        out.set(item.id, { received, receivedAt: iso(wi.receivedAt), receivedBy: userName(wi.receivedBy), remarks: wi.receiptRemarks, reference: wi.itemNumber });
      } else if (order) {
        // Orders received before per-line receipt existed have no received quantity: the line was received whole.
        const received = order.status === 'AWAITING_RECEIPT' ? 0 : round(order.receivedQuantity ?? item.quantity);
        out.set(item.id, { received, receivedAt: iso(order.receivedAt), receivedBy: userName(order.receivedBy), remarks: order.receiptRemarks, reference: order.orderNumber });
      } else {
        out.set(item.id, { received: challanReceived ? round(item.quantity) : 0, receivedAt: iso(c.receivedDate), receivedBy: userName(c.receivedBy), remarks: null, reference: null });
      }
    }
  }
  return out;
}

function receivingStatusOf(items: Array<{ id: string; quantity: number }>, receipts: Map<string, LineReceipt>): ReceivingStatus {
  if (items.length === 0) return 'PENDING';
  const got = items.map((i) => receipts.get(i.id)?.received || 0);
  if (got.every((g) => g <= EPS)) return 'PENDING';
  return items.every((i, k) => got[k] >= i.quantity - EPS) ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
}

const totalsOf = (rows: Array<{ unit: string; quantity: number }>) => {
  const t: Record<string, number> = {};
  for (const r of rows) t[r.unit] = round((t[r.unit] || 0) + r.quantity);
  return t;
};

// ---------------------------------------------------------------- fabric width

/**
 * Width of each line's fabric: as entered on the matching Fabric Store inward entry (same fabric name, the
 * latest that has a width), else the Production Sheet's fabric width. Null when neither is recorded.
 */
async function widthsFor(lines: Array<{ id: string; name: string; unit: string; program: { fabricWidth: string | null; fabricWidthInches: number | null } | null }>) {
  const names = Array.from(new Set(lines.map((l) => cleanFabricName(l.name).toLowerCase()).filter(Boolean)));
  const inward = names.length
    ? await prisma.fabricInward.findMany({ where: { width: { not: null } }, select: { itemName: true, width: true, unit: true }, orderBy: { receivingDate: 'desc' } })
    : [];
  const byName = new Map<string, Array<{ width: string; unit: string }>>();
  for (const r of inward) {
    const key = cleanFabricName(r.itemName).toLowerCase();
    if (!names.includes(key)) continue;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push({ width: r.width!, unit: r.unit });
  }
  const out = new Map<string, string | null>();
  for (const l of lines) {
    const matches = byName.get(cleanFabricName(l.name).toLowerCase()) || [];
    const inwardWidth = (matches.find((m) => unitKey(m.unit) === l.unit) || matches[0])?.width;
    const sheetWidth = l.program?.fabricWidth?.trim() || (l.program?.fabricWidthInches ? `${l.program.fabricWidthInches}"` : null);
    out.set(l.id, inwardWidth || sheetWidth || null);
  }
  return out;
}

// ---------------------------------------------------------------- list

export interface IssuedFilters {
  q?: string | null;
  toDepartment?: string | null;
  from?: string | null;
  to?: string | null;
  status?: string | null;
  fabric?: string | null;
  style?: string | null;
  sort?: string | null;
  page?: string | null;
  pageSize?: string | null;
}

const PROGRAM_SELECT = {
  id: true,
  programNumber: true,
  programSerialNo: true,
  designNumber: true,
  designName: true,
  clientName: true,
  buyerName: true,
  fabricWidth: true,
  fabricWidthInches: true,
} as const;

const dayStart = (v: string | null | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00`) : null);

/**
 * One page of the challans a department issued, newest (or oldest) issue first. Database filters narrow the
 * challans; the receiving status filter needs each challan's receipts, so the page is cut after it.
 */
export async function listIssuedChallans(dept: DepartmentKey | 'ALL', f: IssuedFilters) {
  const q = (f.q || '').trim();
  const fabric = (f.fabric || '').trim();
  const style = (f.style || '').trim().toUpperCase();
  const toKey = f.toDepartment ? departmentKeyFor(f.toDepartment) : null;
  const from = dayStart(f.from);
  const toStart = dayStart(f.to);
  const to = toStart ? new Date(toStart.getTime() + 86400000) : null;
  const range = from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } : null;
  const contains = (v: string) => ({ contains: v, mode: 'insensitive' as const });

  const where: any = {
    ...issuedWhere(dept),
    ...(toKey ? { toDepartment: { in: codesOf(toKey) } } : {}),
    AND: [
      ...(q
        ? [{
            OR: [
              { challanNumber: contains(q) },
              { program: { is: { OR: [{ designNumber: contains(q) }, { designName: contains(q) }, { programSerialNo: contains(q) }, { programNumber: contains(q) }, { clientName: contains(q) }, { buyerName: contains(q) }] } } },
            ],
          }]
        : []),
      ...(range ? [{ OR: [{ issuedDate: range }, { issuedDate: null, createdAt: range }] }] : []),
      ...(fabric ? [{ items: { some: { OR: [{ itemDescription: contains(fabric) }, { fabricCode: contains(fabric) }] } } }] : []),
      ...(style ? [{ items: { some: { garmentCategory: { equals: style, mode: 'insensitive' as const } } } }] : []),
    ],
  };

  // Every matching challan, light: enough to work out its receiving status and issue time.
  const light = await prisma.challan.findMany({
    where,
    select: { id: true, toDepartment: true, status: true, issuedDate: true, createdAt: true, receivedDate: true, items: { select: { id: true, quantity: true } } },
  });
  const receipts = await receiptsFor(light);
  const wantedStatus = (f.status || '').toUpperCase();
  const asc = (f.sort || '').toLowerCase() === 'oldest';
  const rows = light
    .map((c) => ({ id: c.id, at: (c.issuedDate || c.createdAt).getTime(), receiving: receivingStatusOf(c.items, receipts) }))
    .filter((c) => !wantedStatus || c.receiving === wantedStatus)
    .sort((a, b) => (asc ? a.at - b.at : b.at - a.at));

  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(f.pageSize) || 20));
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(pages, Math.max(1, Number(f.page) || 1));
  const pageIds = rows.slice((page - 1) * pageSize, page * pageSize).map((r) => r.id);

  const full = pageIds.length
    ? await prisma.challan.findMany({
        where: { id: { in: pageIds } },
        include: {
          program: { select: PROGRAM_SELECT },
          items: { orderBy: { createdAt: 'asc' } },
          issuedBy: { select: { fullName: true, username: true } },
          createdBy: { select: { fullName: true, username: true } },
        },
      })
    : [];
  const byId = new Map(full.map((c) => [c.id, c]));
  const ordered = pageIds.map((id) => byId.get(id)!).filter(Boolean);
  const widths = await widthsFor(ordered.flatMap((c) => c.items.map((i) => ({ id: i.id, name: i.fabricCode || i.itemDescription, unit: unitKey(i.uom), program: c.program }))));

  const data = ordered.map((c) => shapeChallan(c, receipts, widths));
  const counts = { PENDING: 0, PARTIALLY_RECEIVED: 0, RECEIVED: 0 };
  for (const r of rows) counts[r.receiving]++;
  return { data, page, pageSize, pages, total: rows.length, receivingCounts: counts };
}

function shapeChallan(c: any, receipts: Map<string, LineReceipt>, widths: Map<string, string | null>) {
  const items = c.items.map((i: any) => {
    const receipt = receipts.get(i.id);
    const unit = unitKey(i.uom);
    return {
      id: i.id,
      fabricName: i.itemDescription,
      fabricCode: i.fabricCode,
      colour: i.colour,
      shade: i.shade,
      requiredColour: i.requiredColour,
      style: i.garmentCategory ? String(i.garmentCategory).toUpperCase() : null,
      styleRef: i.styleRef,
      size: i.size,
      width: widths.get(i.id) ?? null,
      quantity: round(i.quantity),
      unit,
      received: round(receipt?.received || 0),
      pending: round(Math.max(0, i.quantity - (receipt?.received || 0))),
      receivedAt: receipt?.receivedAt ?? null,
      receivedBy: receipt?.receivedBy ?? null,
      receiptRemarks: receipt?.remarks ?? null,
      receiptReference: receipt?.reference ?? null,
      remarks: userChallanRemarks(i.remarks) || null,
    };
  });
  const receiving = receivingStatusOf(c.items, receipts);
  const styles = Array.from(new Set(items.map((i: any) => i.style).filter(Boolean)));
  return {
    id: c.id,
    challanNumber: c.challanNumber,
    challanType: c.challanType,
    status: c.status,
    issuedAt: iso(c.issuedDate || c.createdAt),
    fromDepartment: c.fromDepartment,
    fromDepartmentName: departmentName(departmentKeyFor(c.fromDepartment) || c.fromDepartment),
    toDepartment: c.toDepartment,
    toDepartmentName: departmentName(departmentKeyFor(c.toDepartment) || c.toDepartment),
    program: c.program
      ? {
          id: c.program.id,
          programNumber: c.program.programNumber,
          serialNumber: (c.program.programSerialNo || '').trim() || c.program.programNumber,
          designNumber: (c.program.designNumber || '').trim() || c.program.designName,
          clientName: (c.program.clientName || '').trim() || c.program.buyerName,
        }
      : null,
    styles,
    issuedBy: inchargeNameOf(c) || userName(c.createdBy),
    remarks: userChallanRemarks(c.remarks) || null,
    receivingStatus: receiving,
    receivingLabel: RECEIVING_LABEL[receiving],
    issuedTotals: totalsOf(items),
    receivedTotals: totalsOf(items.map((i: any) => ({ unit: i.unit, quantity: i.received }))),
    items,
  };
}

// ---------------------------------------------------------------- one challan

interface HistoryEvent { at: string; action: string; detail: string | null; by: string | null; reference: string | null }

const EVENT_LABEL: Record<string, string> = {
  CREATE: 'Challan created', SUBMIT: 'Challan submitted', ISSUE: 'Challan issued', RECEIVE: 'Material received', START: 'Processing started',
  COMPLETE: 'Completed', HOLD: 'On hold', RESUME: 'Resumed', QC: 'QC', HANDOVER: 'Handed over', CLOSE: 'Closed', CANCEL: 'Cancelled',
};

/** One issued challan with its lines, receipt of each line and every recorded movement. */
export async function issuedChallanDetail(id: string, user: AuthenticatedUser) {
  const c = await prisma.challan.findUnique({
    where: { id },
    include: {
      program: { select: { ...PROGRAM_SELECT, mainStyle: true, orderNumber: true, deliveryDate: true } },
      items: { orderBy: { createdAt: 'asc' } },
      issuedBy: { select: { fullName: true, username: true } },
      createdBy: { select: { fullName: true, username: true } },
      receivedBy: { select: { fullName: true, username: true } },
      events: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { fullName: true, username: true } } } },
    },
  });
  if (!c) throw new WorkRequestError('Challan not found.', 404);
  if (!userBelongsToDepartment(user, c.fromDepartment)) throw new WorkRequestError('You can only see challans issued by your own department.', 403);
  if (NOT_ISSUED.includes(c.status)) throw new WorkRequestError('This challan has not been issued.', 404);

  const receipts = await receiptsFor([c]);
  const widths = await widthsFor(c.items.map((i) => ({ id: i.id, name: i.fabricCode || i.itemDescription, unit: unitKey(i.uom), program: c.program })));
  const shaped = shapeChallan(c, receipts, widths);

  // Movement: creation and issue, the challan's recorded events, receipt of each line, and what the
  // destination later sent onward from those lines.
  const history: HistoryEvent[] = [];
  const hasEvent = (action: string) => c.events.some((e) => e.action === action);
  if (!hasEvent('CREATE')) history.push({ at: iso(c.createdAt)!, action: 'Challan created', detail: `${shaped.fromDepartmentName} → ${shaped.toDepartmentName}`, by: userName(c.createdBy), reference: c.challanNumber });
  if (c.issuedDate && !hasEvent('ISSUE')) history.push({ at: iso(c.issuedDate)!, action: 'Challan issued · material dispatched', detail: `To ${shaped.toDepartmentName}`, by: shaped.issuedBy, reference: c.challanNumber });
  for (const e of c.events) {
    history.push({
      at: iso(e.createdAt)!,
      action: EVENT_LABEL[e.action] || e.action.replace(/_/g, ' '),
      detail: [`${e.fromStatus.replace(/_/g, ' ')} → ${e.toStatus.replace(/_/g, ' ')}`, e.reason, e.notes].filter(Boolean).join(' · '),
      by: userName(e.actor),
      reference: c.challanNumber,
    });
  }
  const itemIds = c.items.map((i) => i.id);
  const [workItems, orders] = await Promise.all([
    prisma.departmentWorkItem.findMany({
      where: { inboundChallanItemId: { in: itemIds } },
      select: { itemNumber: true, departmentCode: true, transfers: { orderBy: { createdAt: 'asc' }, select: { createdAt: true, quantity: true, uom: true, kind: true, challan: { select: { challanNumber: true, toDepartment: true } } } } },
    }),
    prisma.dyeingOrder.findMany({
      where: { inboundChallanItemId: { in: itemIds } },
      select: { orderNumber: true, qcTransfers: { orderBy: { createdAt: 'asc' }, select: { createdAt: true, quantity: true, uom: true, challan: { select: { challanNumber: true } } } } },
    }),
  ]);
  for (const item of shaped.items) {
    if (item.receivedAt && item.received > 0) {
      const partial = item.received < item.quantity - EPS;
      history.push({
        at: item.receivedAt,
        action: partial ? 'Partial receipt' : 'Material received',
        detail: `${item.fabricName}: ${item.received} of ${item.quantity} ${item.unit}${item.receiptRemarks ? ` · ${item.receiptRemarks}` : ''}`,
        by: item.receivedBy,
        reference: item.receiptReference,
      });
    }
  }
  if (c.receivedDate && !hasEvent('RECEIVE') && !shaped.items.some((i: { receivedAt: string | null }) => i.receivedAt)) {
    history.push({ at: iso(c.receivedDate)!, action: 'Material received', detail: `At ${shaped.toDepartmentName}`, by: userName(c.receivedBy), reference: c.challanNumber });
  }
  for (const wi of workItems) {
    for (const t of wi.transfers) {
      const kind = t.kind === 'REJECT' ? 'Sent to Defective Shelf' : t.kind === 'REWORK' ? 'Sent back for rework' : 'Forwarded';
      history.push({ at: iso(t.createdAt)!, action: `${departmentName(wi.departmentCode)}: ${kind}`, detail: `${t.quantity} ${t.uom} to ${departmentName(departmentKeyFor(t.challan.toDepartment) || t.challan.toDepartment)}`, by: null, reference: t.challan.challanNumber });
    }
  }
  for (const o of orders) {
    for (const t of o.qcTransfers) {
      history.push({ at: iso(t.createdAt)!, action: 'Dyeing: sent to Dyeing QC', detail: `${o.orderNumber} · ${t.quantity} ${t.uom}`, by: null, reference: t.challan.challanNumber });
    }
  }
  history.sort((a, b) => a.at.localeCompare(b.at));

  return {
    ...shaped,
    program: shaped.program && c.program ? { ...shaped.program, mainStyle: c.program.mainStyle, orderNumber: c.program.orderNumber, deliveryDate: iso(c.program.deliveryDate) } : shaped.program,
    receivedDate: iso(c.receivedDate),
    receivedByName: userName(c.receivedBy),
    history,
  };
}
