import { prisma } from '@shubham/database';
import { DEPARTMENT_ACCESS, departmentKeyFor, userBelongsToDepartment } from '@/lib/auth/department-access';
import type { AuthenticatedUser } from '@/lib/auth/require-user';
import { TX, WORKFLOWS, WorkRequestError, type WorkflowConfig } from '@/lib/work-items-server';
import { receivedBasis } from '@/lib/work-items.mjs';
import { allocatedTotal, isActiveAllocation } from '@/lib/recutting.mjs';
import { stockOf } from '@/lib/inventory.mjs';
import { totalsByUnit, unitOf } from '@/lib/challan-units.mjs';
import {
  ACTIVE_HOLD_STATUSES,
  HOLD_STATUS_LABEL,
  activeHoldStatus,
  forwardedSinceHold,
  holdReasonText,
  outstandingOf,
  remainingOnHold,
  validateHold,
  validateRelease,
} from '@/lib/holds.mjs';
import { departmentName } from '@/lib/workflow-views';

// HOLD in the production departments, Dyeing to Inventory (Packing); Programming and Fabric Store have none.
// Each department holds back part of a line it already tracks; the line's received / forwarded figures come
// from the existing records, never from the HOLD. Held quantity is blocked: the line's heldQuantity (work items,
// dyeing orders; syncHeld) is kept in step with its open HOLDs in the same transaction, and every quantity check
// (lib/work-items.mjs, recutting.mjs, inventory.mjs, dyeing-workflow.mjs, the Dyeing QC inspection) takes it off
// what may be processed or sent on. Only an explicit release frees it. Lines:
// - Dyeing: a dyeing order (one Store -> Dyeing challan line), less what was sent to Dyeing QC.
// - Dyeing QC: an incoming challan's lines of one unit, less its PASS / rework challans and shrinkage.
// - Embroidery to Inventory: a work item (DepartmentWorkItem), less its transfers (Recutting: allocations;
//   Inventory: sent for packing) and defective quantity.

type Unit = 'MTR' | 'PCS';
type SourceType = 'DYEING_ORDER' | 'QC1_CHALLAN' | 'WORK_ITEM';

/** One forwarding of a line (a challan, allocation or packing), shown in a HOLD's history. */
export interface ForwardEntry {
  at: Date;
  quantity: number;
  unit: string;
  reference: string;
  by: string | null;
}

/** A line a department may place on HOLD, with its live quantities. */
export interface HoldLine {
  key: string;
  sourceType: SourceType;
  sourceId: string;
  departmentCode: string;
  unit: string;
  programId: string;
  designNumber: string;
  serialNumber: string;
  productionSheetNumber: string;
  challanId: string | null;
  challanNumber: string | null;
  challanRequired: boolean;
  fabricName: string;
  colour: string | null;
  size: string | null;
  productionType: string | null;
  requiredColour: string | null;
  challanDate: Date | null;
  sendingDepartment: string | null;
  /** Already processed (QC: inspected; Dyeing: dyed; Recutting: allocated; Inventory: packed). */
  processed: number;
  received: number;
  forwarded: number;
  writtenOff: number;
  forwardLog: ForwardEntry[];
  forwardPath: string;
}

/** Departments with a HOLD page, in floor order: page, where held quantity is forwarded from, received column. */
export const HOLD_DEPARTMENTS: Record<string, { page: string; forward: string; receivedLabel: string }> = {
  DYEING: { page: '/dyeing/hold', forward: '/dyeing/my-work/issue-challan', receivedLabel: 'Total Received' },
  QC1: { page: '/qc1/hold', forward: '/qc1/my-work', receivedLabel: 'Total Received' },
  EMBROIDERY: { page: '/embroidery/hold', forward: '/embroidery/my-work/issue-challan', receivedLabel: 'Total Received' },
  THREAD_CUTTING: { page: '/thread-cutting/hold', forward: '/thread-cutting/my-work/issue-challan', receivedLabel: 'Total Received' },
  QC2: { page: '/qc2/hold', forward: '/qc2/my-work/issue-challan', receivedLabel: 'Total Received' },
  WASHING: { page: '/washing/hold', forward: '/washing/my-work/issue-challan', receivedLabel: 'Total Received' },
  QC3: { page: '/qcwashing/hold', forward: '/qcwashing/my-work/issue-challan', receivedLabel: 'Total Received' },
  RECUTTING: { page: '/recutting/hold', forward: '/recutting/my-work/allocation', receivedLabel: 'Total Received' },
  STITCHING: { page: '/stitching/hold', forward: '/stitching/my-work/issue-challan', receivedLabel: 'Total Received' },
  FINISHING: { page: '/finishing/hold', forward: '/finishing/my-work/issue-challan', receivedLabel: 'Total Received' },
  STEAM_PRESS: { page: '/steam-press/hold', forward: '/steam-press/my-work/issue-challan', receivedLabel: 'Total Received' },
  FINAL_CHECK: { page: '/final-check/hold', forward: '/final-check/my-work/issue-challan', receivedLabel: 'Total Received' },
  INVENTORY: { page: '/inventory/hold', forward: '/inventory/packing', receivedLabel: 'Total Received' },
};

/**
 * Where released HOLD quantity of a department may be sent straight on a new challan ("Release and Forward"): the
 * department's own next step, on its own challan type. QC departments send on only after a PASS / REJECT / REWORK
 * decision, Recutting through its allocations and Inventory sends nothing on, so their released quantity only
 * returns to the department's normal work (`reason` says why).
 */
export function forwardRouteOf(code: string): { to: string; toName: string; challanType: string } | { to: null; reason: string } {
  if (code === 'DYEING') return { to: 'QC1', toName: departmentName('QC1'), challanType: 'DYEING_TO_QC1' };
  const cfg = (WORKFLOWS as Record<string, WorkflowConfig>)[code];
  if (cfg?.qc) return { to: null, reason: `${cfg.label} is a QC department: released quantity goes back to inspection and moves on only after its PASS / REJECT / REWORK decision.` };
  if (cfg?.allocation) return { to: null, reason: `${cfg.label} sends work on through its allocations: released quantity goes back to My Work > ${cfg.issueScreen}.` };
  if (code === 'QC1') return { to: null, reason: 'Dyeing QC is a QC department: released quantity goes back to inspection and moves on only after its PASS / REWORK decision.' };
  if (!cfg?.next) return { to: null, reason: `${cfg?.label || departmentName(code)} sends nothing onward: released quantity returns to its stock.` };
  return { to: cfg.next.code, toName: cfg.next.label, challanType: cfg.next.challanType };
}

const round = (n: number) => Math.round((Number(n) || 0) * 1000) / 1000;
const codesOf = (key: keyof typeof DEPARTMENT_ACCESS) => [...DEPARTMENT_ACCESS[key].codes] as string[];
/** Challans that never moved quantity. */
const DEAD_CHALLAN = ['DRAFT', 'CANCELLED', 'REJECTED'];
/** Challans sent but not yet received by the destination. */
const NOT_YET_RECEIVED = ['ISSUED', 'SUBMITTED', 'IN_TRANSIT'];
const LIST_LIMIT = 400;

/** The HOLD department code for any stored code or alias (e.g. "QCWASHING" -> QC3), or null. */
export function holdDepartmentFor(raw: string | null | undefined): string | null {
  const key = departmentKeyFor(raw);
  return key && HOLD_DEPARTMENTS[key] ? key : null;
}

const PROGRAM_FIELDS = {
  id: true,
  programNumber: true,
  programSerialNo: true,
  designNumber: true,
  designName: true,
  fabricName: true,
  fabricColor: true,
} as const;

function programRefs(p: { id: string; programNumber: string; programSerialNo: string | null; designNumber: string | null; designName: string }) {
  return {
    programId: p.id,
    designNumber: (p.designNumber || '').trim() || (p.designName || '').trim(),
    serialNumber: (p.programSerialNo || '').trim() || p.programNumber,
    productionSheetNumber: p.programNumber,
  };
}

const userName = (u: { fullName?: string | null; username?: string | null } | null | undefined) => u?.fullName || u?.username || null;
const unitKey = (raw: unknown) => (unitOf(raw) || String(raw || '').trim().toUpperCase()) as string;
const joined = (values: Array<string | null | undefined>) => {
  const list = Array.from(new Set(values.map((v) => (v || '').trim()).filter(Boolean)));
  return list.length ? list.join(', ') : null;
};
/** "M · 2.5 MTR": the line's size and its unit quantity, as entered on the challan. */
function sizeText(item: { size?: string | null; unitQuantity?: number | null; unitQuantityUom?: string | null } | null | undefined) {
  if (!item) return null;
  const unitQty = item.unitQuantity ? `${round(item.unitQuantity)} ${item.unitQuantityUom || ''}`.trim() : null;
  return joined([item.size, unitQty])?.replace(', ', ' · ') || null;
}

async function challanItemsById(ids: string[]) {
  const rows = ids.length
    ? await prisma.challanItem.findMany({ where: { id: { in: ids } }, select: { id: true, size: true, unitQuantity: true, unitQuantityUom: true } })
    : [];
  return new Map(rows.map((r) => [r.id, r]));
}

// ---------------------------------------------------------------- lines, per department

async function workItemLines(code: string, ids?: string[]): Promise<HoldLine[]> {
  const cfg = (WORKFLOWS as Record<string, WorkflowConfig>)[code];
  const items = await prisma.departmentWorkItem.findMany({
    where: { departmentCode: code, ...(ids ? { id: { in: ids } } : { status: { notIn: ['AWAITING_RECEIPT', 'TRANSFERRED'] } }) },
    include: {
      program: { select: PROGRAM_FIELDS },
      inboundChallan: { select: { id: true, challanNumber: true, issuedDate: true, createdAt: true } },
      transfers: {
        orderBy: { createdAt: 'asc' },
        select: { quantity: true, uom: true, kind: true, createdAt: true, challan: { select: { challanNumber: true } }, createdBy: { select: { fullName: true, username: true } } },
      },
      ...(code === 'RECUTTING'
        ? { allocations: { orderBy: { createdAt: 'asc' as const }, include: { createdBy: { select: { fullName: true, username: true } } } } }
        : {}),
      ...(code === 'INVENTORY'
        ? { packingAllocations: { orderBy: { createdAt: 'asc' as const }, include: { createdBy: { select: { fullName: true, username: true } } } } }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: ids ? undefined : LIST_LIMIT,
  });
  const lineItems = await challanItemsById(items.map((i) => i.inboundChallanItemId));
  return items.map((item: any) => {
    const unit = unitKey(item.uom);
    let forwarded: number;
    let forwardLog: ForwardEntry[];
    if (code === 'RECUTTING') {
      // Recutting forwards a line by allocating it to garment categories (in the line's unit); cut pieces then
      // go to Stitching in their own unit, which is never converted back.
      const allocations = (item.allocations || []).filter(isActiveAllocation);
      forwarded = allocatedTotal(allocations);
      forwardLog = allocations.map((a: any) => ({ at: a.createdAt, quantity: round(a.allocatedQuantity), unit: a.allocatedUom || unit, reference: `Allocation ${a.allocationNumber}`, by: userName(a.createdBy) }));
    } else if (code === 'INVENTORY') {
      forwarded = stockOf(item).sent;
      forwardLog = (item.packingAllocations || [])
        .map((a: any) => ({ at: a.createdAt, quantity: round(a.quantity - (a.returnedQuantity || 0)), unit, reference: `Packing ${a.packingNumber}`, by: userName(a.createdBy) }))
        .filter((e: ForwardEntry) => e.quantity > 0);
    } else {
      forwarded = round((item.transferredQuantity || 0) + (item.rejectSentQuantity || 0) + (item.reworkSentQuantity || 0));
      forwardLog = item.transfers.map((t: any) => ({
        at: t.createdAt,
        quantity: round(t.quantity),
        unit: unitKey(t.uom),
        reference: `Challan ${t.challan?.challanNumber || '—'}${t.kind && t.kind !== 'PASS' ? ` (${t.kind === 'REJECT' ? 'Rejected' : 'Rework'})` : ''}`,
        by: userName(t.createdBy),
      }));
    }
    return {
      key: `WORK_ITEM:${item.id}:${unit}`,
      sourceType: 'WORK_ITEM' as const,
      sourceId: item.id,
      departmentCode: code,
      unit,
      ...programRefs(item.program),
      challanId: item.inboundChallan?.id || null,
      challanNumber: item.inboundChallan?.challanNumber || null,
      challanRequired: true,
      fabricName: item.fabricName,
      colour: joined([item.colour, item.styleRef]),
      size: sizeText(lineItems.get(item.inboundChallanItemId)),
      productionType: item.garmentCategory || null,
      requiredColour: null,
      challanDate: item.inboundChallan?.issuedDate || item.inboundChallan?.createdAt || null,
      sendingDepartment: item.sourceDepartment || null,
      processed: round(item.processedQuantity || 0),
      received: receivedBasis(item),
      forwarded,
      // Defective quantity (production departments) never leaves as good work; QC REJECT and REWORK not yet sent
      // are already decided, so they cannot also be held.
      writtenOff: cfg?.production
        ? round(item.defectQuantity || 0)
        : cfg?.qc
          ? round(Math.max(0, (item.rejectedQuantity || 0) - (item.rejectSentQuantity || 0)) + Math.max(0, (item.reworkQuantity || 0) - (item.reworkSentQuantity || 0)))
          : 0,
      forwardLog,
      forwardPath: HOLD_DEPARTMENTS[code].forward,
    };
  });
}

async function dyeingLines(ids?: string[]): Promise<HoldLine[]> {
  const orders = await prisma.dyeingOrder.findMany({
    where: ids ? { id: { in: ids } } : { status: { notIn: ['AWAITING_RECEIPT', 'SENT_TO_QC1'] } },
    include: {
      program: { select: PROGRAM_FIELDS },
      inboundChallan: { select: { id: true, challanNumber: true, issuedDate: true, createdAt: true, fromDepartment: true } },
      qcTransfers: {
        orderBy: { createdAt: 'asc' },
        select: { quantity: true, uom: true, createdAt: true, challan: { select: { challanNumber: true } }, createdBy: { select: { fullName: true, username: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: ids ? undefined : LIST_LIMIT,
  });
  const lineItems = await challanItemsById(orders.map((o) => o.inboundChallanItemId).filter((v): v is string => !!v));
  return orders.map((o) => {
    const unit = unitKey(o.uom);
    return {
      key: `DYEING_ORDER:${o.id}:${unit}`,
      sourceType: 'DYEING_ORDER' as const,
      sourceId: o.id,
      departmentCode: 'DYEING',
      unit,
      ...programRefs(o.program),
      challanId: o.inboundChallan?.id || null,
      challanNumber: o.inboundChallan?.challanNumber || null,
      challanRequired: true,
      fabricName: o.fabricName,
      colour: o.dyedColor || o.targetColor || null,
      size: sizeText(o.inboundChallanItemId ? lineItems.get(o.inboundChallanItemId) : null),
      productionType: null,
      requiredColour: o.targetColor || null,
      challanDate: o.inboundChallan?.issuedDate || o.inboundChallan?.createdAt || null,
      sendingDepartment: o.inboundChallan?.fromDepartment || 'STORE',
      processed: round(o.dyedQuantity || 0),
      received: round(o.receivedQuantity ?? (o.status === 'AWAITING_RECEIPT' ? 0 : o.requiredQuantity)),
      forwarded: round(o.sentToQc1Quantity),
      writtenOff: 0,
      forwardLog: o.qcTransfers.map((t) => ({ at: t.createdAt, quantity: round(t.quantity), unit: unitKey(t.uom), reference: `Challan ${t.challan?.challanNumber || '—'}`, by: userName(t.createdBy) })),
      forwardPath: HOLD_DEPARTMENTS.DYEING.forward,
    };
  });
}

async function qc1Lines(ids?: string[]): Promise<HoldLine[]> {
  const qc1 = codesOf('QC1');
  const challans = await prisma.challan.findMany({
    where: { toDepartment: { in: qc1 }, ...(ids ? { id: { in: ids } } : { status: { notIn: [...DEAD_CHALLAN, ...NOT_YET_RECEIVED] } }) },
    include: {
      program: { select: PROGRAM_FIELDS },
      items: { orderBy: { createdAt: 'asc' } },
      // PASS (to Embroidery) and rework (back to Dyeing) challans issued from this one.
      childChallans: {
        where: { fromDepartment: { in: qc1 }, status: { notIn: DEAD_CHALLAN } },
        orderBy: { createdAt: 'asc' },
        select: { challanNumber: true, challanType: true, createdAt: true, fabricUnit: true, items: { select: { quantity: true, uom: true } }, issuedBy: { select: { fullName: true, username: true } } },
      },
      productionLogs: { where: { departmentCode: { in: qc1 } }, select: { wasteQuantity: true, inputQuantity: true, operationName: true, unitOfMeasure: true } },
      // REWORK sent to Dyeing without a challan (lib/rework-routing-server.ts): it has left Dyeing QC too.
      dyeingInboundOrders: {
        where: { origin: 'REWORK' },
        orderBy: { createdAt: 'asc' },
        select: { orderNumber: true, uom: true, receivedQuantity: true, requiredQuantity: true, createdAt: true, receivedBy: { select: { fullName: true, username: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: ids ? undefined : LIST_LIMIT,
  });
  const lines: HoldLine[] = [];
  for (const c of challans) {
    const received = totalsByUnit(c.items, c.fabricUnit);
    const units = Object.keys(received);
    for (const unit of units) {
      const unitItems = c.items.filter((i) => (unitOf(i.uom) || unitOf(c.fabricUnit) || 'MTR') === unit);
      const forwardLog: ForwardEntry[] = c.childChallans
        .map((ch) => ({
          at: ch.createdAt,
          quantity: totalsByUnit(ch.items, ch.fabricUnit)[unit] || 0,
          unit,
          reference: `Challan ${ch.challanNumber}${ch.challanType === 'REWORK_RETURN' ? ' (Rework to Dyeing)' : ''}`,
          by: userName(ch.issuedBy),
        }))
        .concat(
          c.dyeingInboundOrders
            .filter((o) => (unitOf(o.uom) || 'MTR') === unit)
            .map((o) => ({
              at: o.createdAt,
              quantity: round(o.receivedQuantity ?? o.requiredQuantity),
              unit,
              reference: `Rework to Dyeing ${o.orderNumber} (no challan)`,
              by: userName(o.receivedBy),
            })),
        )
        .filter((e) => e.quantity > 0);
      // Shrinkage (fabric lost in dyeing) is recorded by the inspection and never forwarded.
      const shrinkage = c.productionLogs
        .filter((l) => (unitOf(l.unitOfMeasure) || units[0]) === unit)
        .reduce((s, l) => s + (Number(l.wasteQuantity) || 0), 0);
      lines.push({
        key: `QC1_CHALLAN:${c.id}:${unit}`,
        sourceType: 'QC1_CHALLAN',
        sourceId: c.id,
        departmentCode: 'QC1',
        unit,
        ...programRefs(c.program),
        challanId: c.id,
        challanNumber: c.challanNumber,
        challanRequired: true,
        fabricName: joined(unitItems.map((i) => i.fabricCode || i.itemDescription)) || c.program.fabricName || 'Fabric',
        colour: joined(unitItems.map((i) => i.colour || i.shade)),
        size: joined(unitItems.map((i) => sizeText(i))),
        productionType: joined(unitItems.map((i) => i.garmentCategory)),
        requiredColour: joined(unitItems.map((i) => i.requiredColour)),
        challanDate: c.issuedDate || c.createdAt,
        sendingDepartment: c.fromDepartment,
        // Inspected in Dyeing QC so far (each inspection records its inspected quantity).
        processed: round(
          c.productionLogs
            .filter((l) => l.operationName === 'QC1_FABRIC_INSPECTION' && (unitOf(l.unitOfMeasure) || units[0]) === unit)
            .reduce((s, l) => s + (Number(l.inputQuantity) || 0), 0),
        ),
        received: NOT_YET_RECEIVED.includes(c.status) ? 0 : round(received[unit]),
        forwarded: round(forwardLog.reduce((s, e) => s + e.quantity, 0)),
        writtenOff: round(shrinkage),
        forwardLog,
        forwardPath: HOLD_DEPARTMENTS.QC1.forward,
      });
    }
  }
  return lines;
}

/** Lines of a department: the given sources (any state), or every line that may still hold quantity. */
export async function loadLines(code: string, sourceIds?: string[]): Promise<HoldLine[]> {
  if (sourceIds && sourceIds.length === 0) return [];
  switch (code) {
    case 'DYEING':
      return dyeingLines(sourceIds);
    case 'QC1':
      return qc1Lines(sourceIds);
    default:
      if (!HOLD_DEPARTMENTS[code]) throw new WorkRequestError('This department has no HOLD records.', 404);
      return workItemLines(code, sourceIds);
  }
}

// ---------------------------------------------------------------- HOLD records

export type HoldRow = Awaited<ReturnType<typeof prisma.departmentHold.findFirstOrThrow>>;

/** A line as screens show it; `outstanding` is what is still free to hold (what is already on HOLD is not). */
const lineFields = (line: HoldLine, onHold = 0) => ({
  key: line.key,
  departmentCode: line.departmentCode,
  departmentName: departmentName(line.departmentCode),
  programId: line.programId,
  designNumber: line.designNumber,
  serialNumber: line.serialNumber,
  productionSheetNumber: line.productionSheetNumber,
  challanId: line.challanId,
  challanNumber: line.challanNumber,
  fabricName: line.fabricName,
  colour: line.colour,
  size: line.size,
  productionType: line.productionType,
  requiredColour: line.requiredColour,
  challanDate: line.challanDate,
  sendingDepartment: line.sendingDepartment,
  sendingDepartmentName: line.sendingDepartment ? departmentName(departmentKeyFor(line.sendingDepartment) || line.sendingDepartment) : null,
  processed: line.processed,
  unit: line.unit,
  received: line.received,
  forwarded: line.forwarded,
  writtenOff: line.writtenOff,
  onHold: round(onHold),
  outstanding: round(Math.max(0, outstandingOf(line) - onHold)),
});

/** Lines of a department with quantity still free to hold (a line with an open HOLD may have more added to it). */
export async function holdCandidates(code: string) {
  const [lines, open] = await Promise.all([
    loadLines(code),
    prisma.departmentHold.findMany({ where: { departmentCode: code, status: { in: ACTIVE_HOLD_STATUSES } }, select: { sourceKey: true, remainingQuantity: true } }),
  ]);
  const held = new Map(open.map((h) => [h.sourceKey, h.remainingQuantity]));
  return lines
    .map((l) => lineFields(l, held.get(l.key) || 0))
    .filter((l) => l.outstanding > 0 && l.unit && (l.unit === 'MTR' || l.unit === 'PCS'));
}

/** The lines of one source (a dyeing order or work item) with their open HOLD, for the Hold section of a processing form. */
export async function holdsOfSource(code: string, sourceId: string) {
  const lines = await loadLines(code, [sourceId]);
  const open = await prisma.departmentHold.findMany({
    where: { departmentCode: code, sourceId, status: { in: ACTIVE_HOLD_STATUSES } },
  });
  const rows = await withLines(open);
  return lines.map((line) => {
    const found = rows.find((r) => r.hold.sourceKey === line.key && ACTIVE_HOLD_STATUSES.includes(r.hold.status));
    return { line: lineFields(line, found ? found.hold.remainingQuantity : 0), hold: found ? shapeHold(found.hold, found.line) : null };
  });
}

/** A HOLD as screens show it; `line` (live figures) is absent for closed HOLDs and for lines no longer found. */
export function shapeHold(hold: HoldRow, line: HoldLine | null) {
  const active = ACTIVE_HOLD_STATUSES.includes(hold.status);
  return {
    id: hold.id,
    holdNumber: hold.holdNumber,
    departmentCode: hold.departmentCode,
    departmentName: departmentName(hold.departmentCode),
    programId: hold.programId,
    designNumber: hold.designNumber,
    serialNumber: hold.serialNumber,
    productionSheetNumber: hold.productionSheetNumber,
    challanId: hold.challanId,
    challanNumber: hold.challanNumber,
    fabricName: hold.fabricName,
    colour: hold.colour,
    size: hold.size,
    productionType: hold.productionType,
    requiredColour: hold.requiredColour,
    challanDate: hold.challanDate,
    sendingDepartment: hold.sendingDepartment,
    sendingDepartmentName: hold.sendingDepartment ? departmentName(departmentKeyFor(hold.sendingDepartment) || hold.sendingDepartment) : null,
    processedAtHold: hold.processedAtHold,
    // Live while the HOLD is open; as it was at the HOLD otherwise.
    processedQuantity: line && active ? line.processed : hold.processedAtHold,
    unit: hold.unit,
    receivedQuantity: line && active ? line.received : hold.receivedQuantity,
    forwardedQuantity: line && active ? line.forwarded : hold.forwardedQuantity,
    forwardedAtHold: hold.forwardedAtHold,
    forwardedSinceHold: round(Math.max(0, (line && active ? line.forwarded : hold.forwardedQuantity) - hold.forwardedAtHold)),
    holdQuantity: hold.holdQuantity,
    releasedQuantity: hold.releasedQuantity,
    remainingQuantity: hold.remainingQuantity,
    reason: hold.reason,
    reasonOther: hold.reasonOther,
    reasonText: holdReasonText(hold),
    remarks: hold.remarks,
    status: hold.status,
    statusLabel: (HOLD_STATUS_LABEL as Record<string, string>)[hold.status] || hold.status,
    active,
    heldByName: hold.heldByName,
    heldAt: hold.heldAt,
    closedAt: hold.closedAt,
    forwardPath: line?.forwardPath || HOLD_DEPARTMENTS[hold.departmentCode]?.forward || null,
    forwardTo: (() => {
      const route = forwardRouteOf(hold.departmentCode);
      return 'reason' in route ? null : { code: route.to, name: route.toName };
    })(),
  };
}

/**
 * Brings an open HOLD in line with its line's live quantities: forwarding lowers what is left, and a HOLD with
 * nothing left closes (FORWARDED, or CLEARED when the rest was written off). Writes only when something
 * changed, and only while the HOLD is still open, so two readers never close it twice.
 */
export async function refreshHold(hold: HoldRow, line: HoldLine | undefined): Promise<HoldRow> {
  if (!line || !ACTIVE_HOLD_STATUSES.includes(hold.status)) return hold;
  const remaining = remainingOnHold(hold, line);
  const status = activeHoldStatus(hold, line, remaining);
  const closing = !ACTIVE_HOLD_STATUSES.includes(status);
  if (
    status === hold.status &&
    round(remaining) === round(hold.remainingQuantity) &&
    round(line.forwarded) === round(hold.forwardedQuantity) &&
    round(line.received) === round(hold.receivedQuantity)
  ) {
    return hold;
  }
  const data = {
    status,
    remainingQuantity: remaining,
    forwardedQuantity: line.forwarded,
    receivedQuantity: line.received,
    ...(closing ? { activeKey: null, closedAt: new Date() } : {}),
  };
  return prisma.$transaction(async (tx) => {
    const res = await tx.departmentHold.updateMany({ where: { id: hold.id, updatedAt: hold.updatedAt, status: { in: ACTIVE_HOLD_STATUSES } }, data });
    if (res.count === 1) await syncHeld(tx, hold.sourceType, hold.sourceId);
    if (res.count === 1 && closing) {
      const since = forwardedSinceHold(hold, line);
      await tx.departmentHoldEvent.create({
        data: {
          holdId: hold.id,
          action: 'CLOSE',
          quantity: 0,
          remainingAfter: 0,
          unit: hold.unit,
          remarks: status === 'FORWARDED' ? `Everything held has left the department (${since} ${hold.unit} forwarded since the HOLD).` : 'Nothing of the line is left in the department.',
          actorName: 'System',
        },
      });
    }
    return (await tx.departmentHold.findUnique({ where: { id: hold.id } })) || hold;
  }, TX);
}

/** Loads the live lines of these HOLDs (grouped by department) and refreshes the open ones. */
async function withLines(holds: HoldRow[]) {
  const lines = new Map<string, HoldLine>();
  const byDept = new Map<string, Set<string>>();
  for (const h of holds) {
    if (!ACTIVE_HOLD_STATUSES.includes(h.status)) continue;
    if (!byDept.has(h.departmentCode)) byDept.set(h.departmentCode, new Set());
    byDept.get(h.departmentCode)!.add(h.sourceId);
  }
  await Promise.all(
    Array.from(byDept, async ([code, ids]) => {
      if (!HOLD_DEPARTMENTS[code]) return;
      for (const l of await loadLines(code, Array.from(ids))) lines.set(`${code}|${l.key}`, l);
    }),
  );
  const out: Array<{ hold: HoldRow; line: HoldLine | null }> = [];
  for (const h of holds) {
    const line = lines.get(`${h.departmentCode}|${h.sourceKey}`);
    out.push({ hold: await refreshHold(h, line), line: line || null });
  }
  return out;
}

/** Departments this user may see HOLDs of: one department, or every department (administrators, "ALL"). */
export function holdDepartmentsFor(user: AuthenticatedUser, raw: string | null): string[] {
  if (!raw || raw.toUpperCase() === 'ALL') {
    if (!user.isAdmin) throw new WorkRequestError('Choose your department to see its HOLD records.', 403);
    return Object.keys(HOLD_DEPARTMENTS);
  }
  const code = holdDepartmentFor(raw);
  if (!code) throw new WorkRequestError('This department has no HOLD records.', 404);
  if (!userBelongsToDepartment(user, code)) throw new WorkRequestError('You do not have access to this department.', 403);
  return [code];
}

export interface HoldFilters {
  reason?: string | null;
  unit?: string | null;
  from?: string | null;
  to?: string | null;
  status?: string | null;
}

const dayStart = (v: string | null | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00`) : null);

/** HOLDs of these departments: open ones (refreshed against their lines), closed ones, or both. */
export async function listHolds(departments: string[], rawView: string | null, search: string, filters: HoldFilters = {}) {
  const view = rawView === 'closed' || rawView === 'all' ? rawView : 'open';
  const status = view === 'closed' ? { notIn: ACTIVE_HOLD_STATUSES } : view === 'all' ? undefined : { in: ACTIVE_HOLD_STATUSES };
  const q = search.trim();
  const from = dayStart(filters.from);
  const toStart = dayStart(filters.to);
  const heldAt = from || toStart ? { ...(from ? { gte: from } : {}), ...(toStart ? { lt: new Date(toStart.getTime() + 86400000) } : {}) } : null;
  const holds = await prisma.departmentHold.findMany({
    where: {
      departmentCode: { in: departments },
      ...(status ? { status } : {}),
      ...(filters.reason ? { reason: filters.reason.toUpperCase() } : {}),
      ...(filters.unit ? { unit: filters.unit.toUpperCase() } : {}),
      // One HOLD status (ON_HOLD, PARTIALLY_RELEASED ... CLEARED), within the open / closed view.
      ...(filters.status ? { AND: [{ status: filters.status.toUpperCase() }] } : {}),
      ...(heldAt ? { heldAt } : {}),
      ...(q
        ? {
            OR: ['holdNumber', 'designNumber', 'serialNumber', 'productionSheetNumber', 'challanNumber', 'fabricName', 'colour'].map((field) => ({
              [field]: { contains: q, mode: 'insensitive' as const },
            })),
          }
        : {}),
    },
    orderBy: { heldAt: 'desc' },
    take: 500,
  });
  const rows = await withLines(holds);
  const shaped = rows.map(({ hold, line }) => shapeHold(hold, line));
  // A HOLD that closed while being refreshed leaves the "open" list.
  return view === 'open' ? shaped.filter((h) => h.active) : shaped;
}

/** One HOLD with its history: placed, releases and closing, plus every forwarding of the line since it was placed. */
export async function holdDetail(id: string, user: AuthenticatedUser) {
  const found = await prisma.departmentHold.findUnique({ where: { id } });
  if (!found) throw new WorkRequestError('HOLD record not found.', 404);
  if (!userBelongsToDepartment(user, found.departmentCode)) throw new WorkRequestError('You do not have access to this department.', 403);
  // Every forwarding since the HOLD, also for closed HOLDs (their line is loaded for its history only).
  const [lines, events] = await Promise.all([
    HOLD_DEPARTMENTS[found.departmentCode] ? loadLines(found.departmentCode, [found.sourceId]) : Promise.resolve([] as HoldLine[]),
    prisma.departmentHoldEvent.findMany({ where: { holdId: id }, orderBy: { createdAt: 'asc' } }),
  ]);
  const line = lines.find((l) => l.key === found.sourceKey) || null;
  const hold = await refreshHold(found, line || undefined);
  const latestEvents = hold === found ? events : await prisma.departmentHoldEvent.findMany({ where: { holdId: id }, orderBy: { createdAt: 'asc' } });
  const until = hold.closedAt ? hold.closedAt.getTime() : Infinity;
  const forwards = (line?.forwardLog || [])
    .filter((e) => e.at.getTime() > hold.heldAt.getTime() && e.at.getTime() <= until)
    .map((e) => ({ id: `fwd-${e.reference}-${e.at.getTime()}`, action: 'FORWARD', quantity: e.quantity, unit: e.unit, remainingAfter: null, remarks: e.reference, actorName: e.by || '—', createdAt: e.at }));
  const history = [
    ...latestEvents.map((e) => ({ id: e.id, action: e.action, quantity: e.quantity, unit: e.unit, remainingAfter: e.remainingAfter, remarks: e.remarks, actorName: e.actorName, createdAt: e.createdAt })),
    ...forwards,
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const [original, releases] = await Promise.all([originalLineOf(hold), releasesOf({ holdId: hold.id })]);
  const route = forwardRouteOf(hold.departmentCode);
  // Original challan -> received here -> HOLD -> each release (and its new challan, and its receipt downstream).
  const movement = [
    ...(hold.challanNumber
      ? [{ at: hold.challanDate, step: 'Original Challan', detail: `${hold.challanNumber}${hold.sendingDepartment ? ` from ${departmentName(departmentKeyFor(hold.sendingDepartment) || hold.sendingDepartment)}` : ''}` }]
      : []),
    { at: original.receivedAt, step: `Received in ${departmentName(hold.departmentCode)}`, detail: `${fmt(hold.receivedQuantity)} ${hold.unit}` },
    { at: hold.heldAt, step: 'HOLD Created', detail: `${hold.holdNumber}: ${fmt(hold.holdQuantity)} ${hold.unit} by ${hold.heldByName}` },
    ...releases.flatMap((r) => [
      { at: r.createdAt, step: r.mode === 'FORWARD' ? 'HOLD Released and Forwarded' : 'HOLD Released to Available', detail: `${fmt(r.quantity)} ${r.unit} by ${r.releasedByName} · ${fmt(r.remainingAfter)} ${r.unit} left on HOLD` },
      ...(r.newChallanNumber
        ? [{ at: r.newChallanIssuedAt || r.createdAt, step: 'New Challan Issued', detail: `${r.newChallanNumber} to ${r.destinationName || '—'}${r.newChallanDeleted ? ' (challan since deleted)' : ''}` }]
        : []),
      ...(r.receivedAt ? [{ at: r.receivedAt, step: `Received by ${r.destinationName}`, detail: `${r.newChallanNumber}${r.receivedByName ? ` by ${r.receivedByName}` : ''}` }] : []),
    ]),
  ];
  return {
    ...shapeHold(hold, line),
    writtenOff: line?.writtenOff ?? null,
    outstanding: line ? outstandingOf(line) : null,
    history,
    original,
    releases,
    movement,
    forwardBlockedReason: 'reason' in route ? route.reason : null,
  };
}

const fmt = (n: number | null | undefined) => String(round(Number(n) || 0));

/**
 * The exact incoming line a HOLD was placed on (by its challan line id, never by design or serial number), with
 * its shade and when the department received it. Dyeing QC holds cover a challan's lines of one unit, so they
 * have no single line.
 */
export async function originalLineOf(hold: Pick<HoldRow, 'sourceType' | 'sourceId' | 'challanId'>) {
  let challanItemId: string | null = null;
  let receivedAt: Date | null = null;
  if (hold.sourceType === 'WORK_ITEM') {
    const w = await prisma.departmentWorkItem.findUnique({ where: { id: hold.sourceId }, select: { inboundChallanItemId: true, receivedAt: true } });
    challanItemId = w?.inboundChallanItemId || null;
    receivedAt = w?.receivedAt || null;
  } else if (hold.sourceType === 'DYEING_ORDER') {
    const o = await prisma.dyeingOrder.findUnique({ where: { id: hold.sourceId }, select: { inboundChallanItemId: true, receivedAt: true } });
    challanItemId = o?.inboundChallanItemId || null;
    receivedAt = o?.receivedAt || null;
  } else if (hold.challanId) {
    const c = await prisma.challan.findUnique({ where: { id: hold.challanId }, select: { receivedDate: true } });
    receivedAt = c?.receivedDate || null;
  }
  const item = challanItemId
    ? await prisma.challanItem.findUnique({ where: { id: challanItemId }, select: { id: true, shade: true, quantity: true, uom: true, garmentCategory: true } })
    : null;
  return {
    challanItemId,
    shade: item?.shade || null,
    issuedQuantity: item ? round(item.quantity) : null,
    issuedUnit: item?.uom || null,
    receivedAt,
  };
}

const RECEIVED_CHALLAN = ['RECEIVED', 'COMPLETED', 'CLOSED'];

/** Status of a release as screens show it: Released (to available), Forwarded (challan not yet received), Received. */
function releaseStatus(mode: string, challan: { status: string } | null, hadChallan: boolean) {
  if (mode !== 'FORWARD') return 'RELEASED';
  if (!challan) return hadChallan ? 'CHALLAN_DELETED' : 'FORWARDED';
  if (DEAD_CHALLAN.includes(challan.status)) return 'CHALLAN_CANCELLED';
  return RECEIVED_CHALLAN.includes(challan.status) ? 'RECEIVED' : 'FORWARDED';
}

export const RELEASE_STATUS_LABEL: Record<string, string> = {
  RELEASED: 'Released',
  FORWARDED: 'Forwarded',
  RECEIVED: 'Received',
  CHALLAN_CANCELLED: 'Challan cancelled',
  CHALLAN_DELETED: 'Challan deleted',
};

/** HOLD releases (newest first) with their HOLD's production details and the new challan's live state. */
export async function releasesOf(where: Record<string, unknown>, take = 500) {
  const rows = await prisma.departmentHoldRelease.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take,
    include: {
      hold: { select: { holdNumber: true, designNumber: true, serialNumber: true, productionSheetNumber: true, programId: true, fabricName: true, colour: true, productionType: true } },
      newChallan: { select: { id: true, status: true, issuedDate: true, createdAt: true, receivedDate: true, toDepartment: true, receivedBy: { select: { fullName: true, username: true } } } },
    },
  });
  return rows.map((r) => {
    const status = releaseStatus(r.mode, r.newChallan, Boolean(r.newChallanNumber));
    const destination = r.destinationDepartment || r.newChallan?.toDepartment || null;
    return {
      id: r.id,
      holdId: r.holdId,
      holdNumber: r.hold.holdNumber,
      departmentCode: r.departmentCode,
      departmentName: departmentName(r.departmentCode),
      mode: r.mode,
      quantity: r.quantity,
      unit: r.unit,
      remainingAfter: r.remainingAfter,
      programId: r.hold.programId,
      designNumber: r.hold.designNumber,
      serialNumber: r.hold.serialNumber,
      productionSheetNumber: r.hold.productionSheetNumber,
      fabricName: r.hold.fabricName,
      colour: r.hold.colour,
      productionType: r.hold.productionType,
      originalChallanId: r.originalChallanId,
      originalChallanNumber: r.originalChallanNumber,
      originalChallanItemId: r.originalChallanItemId,
      newChallanId: r.newChallan?.id || null,
      newChallanNumber: r.newChallanNumber,
      newChallanIssuedAt: r.newChallan ? r.newChallan.issuedDate || r.newChallan.createdAt : null,
      newChallanDeleted: Boolean(r.newChallanNumber && !r.newChallan),
      destinationDepartment: destination,
      destinationName: destination ? departmentName(departmentKeyFor(destination) || destination) : null,
      receivedAt: r.newChallan && RECEIVED_CHALLAN.includes(r.newChallan.status) ? r.newChallan.receivedDate : null,
      receivedByName: userName(r.newChallan?.receivedBy),
      releasedByName: r.releasedByName,
      remarks: r.remarks,
      createdAt: r.createdAt,
      status,
      statusLabel: RELEASE_STATUS_LABEL[status] || status,
    };
  });
}

/**
 * HOLD totals of these departments, per unit (MTR and PCS never added): held now, released in total, released and
 * forwarded on a new challan; plus the same per department.
 */
export async function holdSummary(departments: string[]) {
  const [held, released] = await Promise.all([
    prisma.departmentHold.groupBy({
      by: ['departmentCode', 'unit'],
      where: { departmentCode: { in: departments }, status: { in: ACTIVE_HOLD_STATUSES } },
      _sum: { remainingQuantity: true },
      _count: { _all: true },
    }),
    prisma.departmentHoldRelease.groupBy({
      by: ['departmentCode', 'unit', 'mode'],
      where: { departmentCode: { in: departments } },
      _sum: { quantity: true },
    }),
  ]);
  type Totals = { held: Record<string, number>; released: Record<string, number>; forwarded: Record<string, number>; openHolds: number };
  const empty = (): Totals => ({ held: {}, released: {}, forwarded: {}, openHolds: 0 });
  const add = (bucket: Record<string, number>, unit: string, q: number | null) => {
    if (q) bucket[unit] = round((bucket[unit] || 0) + q);
  };
  const total = empty();
  const byDept = new Map<string, Totals>();
  const dept = (code: string) => {
    if (!byDept.has(code)) byDept.set(code, empty());
    return byDept.get(code)!;
  };
  for (const h of held) {
    for (const t of [total, dept(h.departmentCode)]) {
      add(t.held, h.unit, h._sum.remainingQuantity);
      t.openHolds += h._count._all;
    }
  }
  for (const r of released) {
    for (const t of [total, dept(r.departmentCode)]) {
      add(t.released, r.unit, r._sum.quantity);
      if (r.mode === 'FORWARD') add(t.forwarded, r.unit, r._sum.quantity);
    }
  }
  return {
    total,
    departments: departments
      .filter((code) => byDept.has(code))
      .map((code) => ({ code, name: departmentName(code), ...byDept.get(code)! })),
  };
}

export const actorNameOf = (user: AuthenticatedUser) => user.fullName || user.username;

/**
 * Sets the line's heldQuantity to what its open HOLDs still keep back. Call inside the transaction that changed a
 * HOLD, so the line and its HOLDs never disagree. Dyeing QC challans keep no column (their inspection reads the HOLDs).
 */
export async function syncHeld(tx: any, sourceType: string, sourceId: string) {
  if (sourceType !== 'WORK_ITEM' && sourceType !== 'DYEING_ORDER') return;
  const sum = await tx.departmentHold.aggregate({
    where: { sourceType, sourceId, status: { in: ACTIVE_HOLD_STATUSES } },
    _sum: { remainingQuantity: true },
  });
  const heldQuantity = round(sum._sum.remainingQuantity || 0);
  if (sourceType === 'WORK_ITEM') await tx.departmentWorkItem.update({ where: { id: sourceId }, data: { heldQuantity } });
  else await tx.dyeingOrder.update({ where: { id: sourceId }, data: { heldQuantity } });
}

/**
 * Dyeing QC marks a challan ON_HOLD while part of it is held. Once nothing of it is held any more, the released
 * quantity is waiting for inspection again (UNDER_INSPECTION), so the challan no longer counts as on HOLD.
 */
export async function reopenHeldChallan(tx: any, sourceType: string, sourceId: string) {
  if (sourceType !== 'QC1_CHALLAN') return;
  const stillHeld = await tx.departmentHold.count({ where: { sourceType, sourceId, status: { in: ACTIVE_HOLD_STATUSES } } });
  if (stillHeld === 0) await tx.challan.updateMany({ where: { id: sourceId, status: 'ON_HOLD' }, data: { status: 'UNDER_INSPECTION' } });
}

/**
 * Locks the line's row for the rest of the transaction (and changes its updatedAt), so a challan, inspection or
 * allocation being saved at the same moment either finishes first or fails its guard and is retried.
 */
export async function lockSource(tx: any, sourceType: string, sourceId: string) {
  const now = new Date();
  if (sourceType === 'WORK_ITEM') await tx.departmentWorkItem.update({ where: { id: sourceId }, data: { updatedAt: now } });
  else if (sourceType === 'DYEING_ORDER') await tx.dyeingOrder.update({ where: { id: sourceId }, data: { updatedAt: now } });
  else await tx.challan.update({ where: { id: sourceId }, data: { updatedAt: now } });
}

/**
 * Places a HOLD on one line of the department, or adds to the line's open HOLD (one open HOLD per line; each
 * addition is its own entry in the HOLD's history). Never more than the line still has free. The same submission
 * (idempotencyKey) is saved once: a double click or retry returns the HOLD it already placed.
 */
export async function placeHold(code: string, body: any, user: AuthenticatedUser) {
  const key = String(body?.lineKey || '');
  const [sourceType, sourceId] = key.split(':');
  if (!sourceType || !sourceId) throw new WorkRequestError('Select the line to place on HOLD.');
  const raw = typeof body?.idempotencyKey === 'string' ? body.idempotencyKey.trim().slice(0, 128) : '';
  const submission = raw ? `HOLD_PLACE:${user.id}:${raw}` : null;
  const replay = async () => {
    if (!submission) return null;
    const record = await prisma.idempotencyRecord.findUnique({ where: { key: submission } });
    if (!record || record.endpoint !== 'HOLD_PLACE') return null;
    const hold = await prisma.departmentHold.findUnique({ where: { id: JSON.parse(record.responseBody).holdId } });
    return hold ? shapeHold(hold, null) : null;
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    const earlier = await replay();
    if (earlier) return earlier;
    try {
      return await prisma.$transaction(async (tx) => {
        await lockSource(tx, sourceType, sourceId);
        // Read after the lock: anything saved before it is counted.
        const line = (await loadLines(code, [sourceId])).find((l) => l.key === key) || null;
        const check = validateHold(line, body);
        if (!check.ok) throw new WorkRequestError(check.error);
        const placed = await addToHold(tx, code, line as HoldLine, check, user);
        if (submission) {
          await tx.idempotencyRecord.create({ data: { key: submission, endpoint: 'HOLD_PLACE', method: 'POST', statusCode: 201, responseBody: JSON.stringify({ holdId: placed.id }) } });
        }
        return placed;
      }, TX);
    } catch (error) {
      // P2002: the HOLD number was taken at the same moment (try the next), or this same submission was saved
      // first (the replay above returns it).
      if ((error as { code?: string } | null)?.code !== 'P2002') throw error;
    }
  }
  throw new WorkRequestError('Could not save the HOLD record. Try again.', 409);
}

/**
 * Holds `check.quantity` more of the line, inside the caller's transaction (the line is already locked and its
 * figures read after the lock): opens a HOLD, or adds to the line's open HOLD. The quantity must be free on the
 * line (what is already held is not free). Updates the line's heldQuantity and records the history.
 */
export async function addToHold(
  tx: any,
  code: string,
  l: HoldLine,
  check: { quantity: number; reason: string; reasonOther: string | null; remarks: string | null },
  user: AuthenticatedUser,
  note?: string,
) {
  const activeKey = `${code}|${l.key}`;
  const existing = await tx.departmentHold.findUnique({ where: { activeKey } });
  const alreadyHeld = existing ? round(existing.remainingQuantity) : 0;
  const free = round(outstandingOf(l) - alreadyHeld);
  if (round(check.quantity) > free) {
    throw new WorkRequestError(
      `Only ${Math.max(0, free)} ${l.unit} of this line is free to hold${alreadyHeld > 0 ? ` (${alreadyHeld} ${l.unit} is already on HOLD)` : ''}.`,
    );
  }
  let hold;
  if (existing) {
    hold = await tx.departmentHold.update({
      where: { id: existing.id },
      data: {
        holdQuantity: round(existing.holdQuantity + check.quantity),
        remainingQuantity: round(existing.remainingQuantity + check.quantity),
        receivedQuantity: l.received,
        forwardedQuantity: l.forwarded,
        status: existing.releasedQuantity > 0 ? 'PARTIALLY_RELEASED' : 'ON_HOLD',
      },
    });
  } else {
    const year = new Date().getFullYear();
    const latest = await tx.departmentHold.findFirst({ where: { holdNumber: { startsWith: `HLD-${year}-` } }, orderBy: { holdNumber: 'desc' }, select: { holdNumber: true } });
    const seq = (parseInt(latest?.holdNumber.split('-').pop() || '0', 10) || 0) + 1;
    hold = await tx.departmentHold.create({
      data: {
        holdNumber: `HLD-${year}-${String(seq).padStart(4, '0')}`,
        departmentCode: code,
        sourceType: l.sourceType,
        sourceId: l.sourceId,
        sourceKey: l.key,
        activeKey,
        programId: l.programId,
        challanId: l.challanId,
        challanNumber: l.challanNumber,
        designNumber: l.designNumber,
        serialNumber: l.serialNumber,
        productionSheetNumber: l.productionSheetNumber,
        fabricName: l.fabricName,
        colour: l.colour,
        size: l.size,
        productionType: l.productionType,
        requiredColour: l.requiredColour,
        challanDate: l.challanDate,
        sendingDepartment: l.sendingDepartment,
        processedAtHold: l.processed,
        unit: l.unit,
        receivedQuantity: l.received,
        forwardedQuantity: l.forwarded,
        forwardedAtHold: l.forwarded,
        holdQuantity: check.quantity,
        remainingQuantity: check.quantity,
        reason: check.reason,
        reasonOther: check.reasonOther,
        remarks: check.remarks,
        status: 'ON_HOLD',
        heldById: user.id,
        heldByName: actorNameOf(user),
      },
    });
  }
  await syncHeld(tx, l.sourceType, l.sourceId);
  await tx.departmentHoldEvent.create({
    data: {
      holdId: hold.id,
      action: 'HOLD',
      quantity: check.quantity,
      remainingAfter: hold.remainingQuantity,
      unit: l.unit,
      remarks: [holdReasonText({ reason: check.reason, reasonOther: check.reasonOther }), existing ? 'Added to the open HOLD' : null, note || null, check.remarks].filter(Boolean).join(' · '),
      actorId: user.id,
      actorName: actorNameOf(user),
    },
  });
  await tx.auditLog.create({
    data: { actorId: user.id, action: 'HOLD', entity: 'DepartmentHold', entityId: hold.id, afterState: JSON.stringify({ departmentCode: code, line: l.key, quantity: check.quantity, unit: l.unit, reason: check.reason, heldNow: hold.remainingQuantity, note: note || null }) },
  });
  return shapeHold(hold, l);
}

/**
 * Takes `quantity` off the line's open HOLD inside the caller's transaction, because that quantity got a QC
 * decision instead (REJECT / REWORK). Recorded in the HOLD's history; the HOLD closes when nothing is left.
 */
export async function takeFromHold(tx: any, code: string, sourceKey: string, quantity: number, user: AuthenticatedUser, note: string) {
  const hold = await tx.departmentHold.findUnique({ where: { activeKey: `${code}|${sourceKey}` } });
  if (!hold || round(hold.remainingQuantity) < round(quantity)) {
    throw new WorkRequestError(`Only ${hold ? round(hold.remainingQuantity) : 0} ${hold?.unit || ''} of this line is on HOLD.`.trim());
  }
  const after = round(hold.remainingQuantity - quantity);
  const res = await tx.departmentHold.updateMany({
    where: { id: hold.id, updatedAt: hold.updatedAt, status: { in: ACTIVE_HOLD_STATUSES } },
    data: {
      holdQuantity: round(hold.holdQuantity - quantity),
      remainingQuantity: after,
      ...(after <= 0 ? { status: 'CLEARED', activeKey: null, closedAt: new Date() } : {}),
    },
  });
  if (res.count !== 1) throw new WorkRequestError('This HOLD was changed by someone else. Refresh and try again.', 409);
  await syncHeld(tx, hold.sourceType, hold.sourceId);
  await tx.departmentHoldEvent.create({
    data: { holdId: hold.id, action: 'DECISION', quantity, remainingAfter: after, unit: hold.unit, remarks: note, actorId: user.id, actorName: actorNameOf(user) },
  });
  return hold;
}

/**
 * Releases part or all of what is still on HOLD back to the department's available quantity; the HOLD closes as
 * RELEASED when nothing is left. The same submission (idempotencyKey) is applied once.
 */
export async function releaseHold(id: string, body: any, user: AuthenticatedUser) {
  const found = await prisma.departmentHold.findUnique({ where: { id } });
  if (!found) throw new WorkRequestError('HOLD record not found.', 404);
  if (!userBelongsToDepartment(user, found.departmentCode)) throw new WorkRequestError('You do not have access to this department.', 403);
  const key = releaseKey(body, user);
  if (key && (await prisma.departmentHoldRelease.findUnique({ where: { idempotencyKey: key } }))) {
    return shapeHold(await prisma.departmentHold.findUniqueOrThrow({ where: { id } }), null);
  }
  const line = (await loadLines(found.departmentCode, [found.sourceId])).find((l) => l.key === found.sourceKey);
  const hold = await refreshHold(found, line);
  const remaining = line ? remainingOnHold(hold, line) : hold.remainingQuantity;
  const check = validateRelease(hold, remaining, body);
  if (!check.ok) throw new WorkRequestError(check.error);
  const after = round(remaining - check.quantity);
  const status = after <= 0 ? 'RELEASED' : 'PARTIALLY_RELEASED';
  const original = await originalLineOf(hold);
  try {
    return await prisma.$transaction(async (tx) => {
      const res = await tx.departmentHold.updateMany({
        where: { id: hold.id, updatedAt: hold.updatedAt, status: { in: ACTIVE_HOLD_STATUSES } },
        data: {
          releasedQuantity: round(hold.releasedQuantity + check.quantity),
          remainingQuantity: after,
          status,
          ...(after <= 0 ? { activeKey: null, closedAt: new Date() } : {}),
        },
      });
      if (res.count !== 1) throw new WorkRequestError('This HOLD was changed by someone else. Refresh and try again.', 409);
      // The released quantity is available again on the line straight away.
      await syncHeld(tx, hold.sourceType, hold.sourceId);
      await reopenHeldChallan(tx, hold.sourceType, hold.sourceId);
      const event = await tx.departmentHoldEvent.create({
        data: { holdId: hold.id, action: 'RELEASE', quantity: check.quantity, remainingAfter: after, unit: hold.unit, remarks: check.remarks, actorId: user.id, actorName: actorNameOf(user) },
      });
      await tx.departmentHoldRelease.create({
        data: {
          holdId: hold.id,
          departmentCode: hold.departmentCode,
          mode: 'AVAILABLE',
          quantity: check.quantity,
          unit: hold.unit,
          remainingAfter: after,
          programId: hold.programId,
          originalChallanId: hold.challanId,
          originalChallanNumber: hold.challanNumber,
          originalChallanItemId: original.challanItemId,
          eventId: event.id,
          idempotencyKey: key,
          remarks: check.remarks,
          releasedById: user.id,
          releasedByName: actorNameOf(user),
        },
      });
      await tx.auditLog.create({
        data: { actorId: user.id, action: 'HOLD_RELEASE', entity: 'DepartmentHold', entityId: hold.id, afterState: JSON.stringify({ quantity: check.quantity, unit: hold.unit, remaining: after }) },
      });
      const updated = await tx.departmentHold.findUniqueOrThrow({ where: { id: hold.id } });
      return shapeHold(updated, line || null);
    }, TX);
  } catch (error) {
    // A concurrent copy of this same submission was saved first: return the HOLD as it now is.
    if (key && (error as { code?: string } | null)?.code === 'P2002' && (await prisma.departmentHoldRelease.findUnique({ where: { idempotencyKey: key } }))) {
      return shapeHold(await prisma.departmentHold.findUniqueOrThrow({ where: { id } }), null);
    }
    throw error;
  }
}

/** The per-user key that makes one release submission apply once (a double click or retry finds it). */
export function releaseKey(body: any, user: AuthenticatedUser) {
  const raw = typeof body?.idempotencyKey === 'string' ? body.idempotencyKey.trim().slice(0, 128) : '';
  return raw ? `HOLD_RELEASE:${user.id}:${raw}` : null;
}
