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

// HOLD in every department, Programming to Inventory (Packing). Each department holds back part of a line it
// already tracks; the line's received / forwarded figures come from the existing records, never from the HOLD:
// - Programming: a Production Sheet's quantity per unit, forwarded on Programming -> Store challans.
// - Fabric Store: what Programming's challans for a Production Sheet brought in, per unit, less Store's issues.
// - Dyeing: a dyeing order (one Store -> Dyeing challan line), less what was sent to Dyeing QC.
// - Dyeing QC: an incoming challan's lines of one unit, less its PASS / rework challans and shrinkage.
// - Embroidery to Inventory: a work item (DepartmentWorkItem), less its transfers (Recutting: allocations;
//   Inventory: sent for packing) and defective quantity.

type Unit = 'MTR' | 'PCS';
type SourceType = 'PROGRAM' | 'STORE_PROGRAM' | 'DYEING_ORDER' | 'QC1_CHALLAN' | 'WORK_ITEM';

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
  received: number;
  forwarded: number;
  writtenOff: number;
  forwardLog: ForwardEntry[];
  forwardPath: string;
}

/** Departments with a HOLD page, in floor order: page, where held quantity is forwarded from, received column. */
export const HOLD_DEPARTMENTS: Record<string, { page: string; forward: string; receivedLabel: string }> = {
  PROGRAMMING: { page: '/programming/hold', forward: '/my-work/issue-challan', receivedLabel: 'Production Sheet Qty' },
  STORE: { page: '/fabric-store/hold', forward: '/fabric-store/my-work/issue-challan', receivedLabel: 'Total Received' },
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
      inboundChallan: { select: { id: true, challanNumber: true } },
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
      received: receivedBasis(item),
      forwarded,
      // Defective quantity (production departments) never leaves as good work.
      writtenOff: cfg?.production ? round(item.defectQuantity || 0) : 0,
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
      inboundChallan: { select: { id: true, challanNumber: true } },
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
      productionLogs: { where: { departmentCode: { in: qc1 } }, select: { wasteQuantity: true, unitOfMeasure: true } },
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

/** Programming -> Store challans per Production Sheet, and every challan Store issued for those sheets. */
async function programChallans(programIds: string[] | undefined) {
  const store = codesOf('STORE');
  const programming = codesOf('PROGRAMMING');
  const select = {
    id: true,
    programId: true,
    challanNumber: true,
    status: true,
    createdAt: true,
    fabricUnit: true,
    items: { select: { quantity: true, uom: true, fabricCode: true, itemDescription: true, colour: true, size: true, unitQuantity: true, unitQuantityUom: true } },
    issuedBy: { select: { fullName: true, username: true } },
  } as const;
  const toStore = await prisma.challan.findMany({
    where: { fromDepartment: { in: programming }, toDepartment: { in: store }, status: { notIn: DEAD_CHALLAN }, ...(programIds ? { programId: { in: programIds } } : {}) },
    select,
    orderBy: { createdAt: 'asc' },
  });
  const sheetIds = programIds || Array.from(new Set(toStore.map((c) => c.programId)));
  const fromStore = sheetIds.length
    ? await prisma.challan.findMany({
        where: { fromDepartment: { in: store }, toDepartment: { notIn: store }, status: { notIn: DEAD_CHALLAN }, programId: { in: sheetIds } },
        select,
        orderBy: { createdAt: 'asc' },
      })
    : [];
  return { toStore, fromStore };
}

type ChallanRow = Awaited<ReturnType<typeof programChallans>>['toStore'][number];
const forwardEntriesOf = (challans: ChallanRow[], unit: string): ForwardEntry[] =>
  challans
    .map((c) => ({ at: c.createdAt, quantity: totalsByUnit(c.items, c.fabricUnit)[unit] || 0, unit, reference: `Challan ${c.challanNumber}`, by: userName(c.issuedBy) }))
    .filter((e) => e.quantity > 0);
const sumOf = (entries: ForwardEntry[]) => round(entries.reduce((s, e) => s + e.quantity, 0));

async function storeLines(programIds?: string[]): Promise<HoldLine[]> {
  const { toStore, fromStore } = await programChallans(programIds);
  const sheetIds = Array.from(new Set(toStore.map((c) => c.programId)));
  const programs = await prisma.program.findMany({ where: { id: { in: sheetIds } }, select: PROGRAM_FIELDS });
  const lines: HoldLine[] = [];
  for (const p of programs) {
    const inbound = toStore.filter((c) => c.programId === p.id);
    const received = inbound.filter((c) => !NOT_YET_RECEIVED.includes(c.status));
    const outbound = fromStore.filter((c) => c.programId === p.id);
    const units = Array.from(new Set(inbound.flatMap((c) => Object.keys(totalsByUnit(c.items, c.fabricUnit)))));
    for (const unit of units) {
      const unitItems = inbound.flatMap((c) => c.items.filter((i) => (unitOf(i.uom) || unitOf(c.fabricUnit) || 'MTR') === unit));
      const forwardLog = forwardEntriesOf(outbound, unit);
      lines.push({
        key: `STORE_PROGRAM:${p.id}:${unit}`,
        sourceType: 'STORE_PROGRAM',
        sourceId: p.id,
        departmentCode: 'STORE',
        unit,
        ...programRefs(p),
        challanId: inbound[0]?.id || null,
        challanNumber: joined(inbound.map((c) => c.challanNumber)),
        challanRequired: true,
        fabricName: joined(unitItems.map((i) => i.fabricCode || i.itemDescription)) || p.fabricName || 'Fabric',
        colour: joined(unitItems.map((i) => i.colour)) || p.fabricColor || null,
        size: joined(unitItems.map((i) => sizeText(i))),
        received: round(received.reduce((s, c) => s + (totalsByUnit(c.items, c.fabricUnit)[unit] || 0), 0)),
        forwarded: sumOf(forwardLog),
        writtenOff: 0,
        forwardLog,
        forwardPath: `${HOLD_DEPARTMENTS.STORE.forward}?programId=${p.id}`,
      });
    }
  }
  return lines;
}

/** A Production Sheet's planned quantity per unit: its item rows, else its colour / target quantity. Rows without a unit are skipped. */
function plannedByUnit(p: { metadataJson: string | null; colorQuantity: number | null; targetQuantity: number; quantityMeasurement: string | null }) {
  let items: any[] = [];
  try {
    const meta = p.metadataJson ? JSON.parse(p.metadataJson) : null;
    if (Array.isArray(meta?.items)) items = meta.items;
  } catch {}
  const planned: Record<string, number> = {};
  const rows = items.filter((it) => unitOf(it?.unit) && Number(it?.measurement) > 0);
  if (rows.length) {
    for (const it of rows) planned[unitOf(it.unit) as string] = round((planned[unitOf(it.unit) as string] || 0) + Number(it.measurement));
  } else if (unitOf(p.quantityMeasurement) && Number(p.colorQuantity || p.targetQuantity) > 0) {
    planned[unitOf(p.quantityMeasurement) as string] = round(Number(p.colorQuantity || p.targetQuantity));
  }
  return { planned, colours: joined(items.map((it) => it?.color)) };
}

async function programmingLines(ids?: string[]): Promise<HoldLine[]> {
  const programs = await prisma.program.findMany({
    where: ids ? { id: { in: ids } } : { status: { notIn: ['COMPLETED', 'CANCELLED'] } },
    select: { ...PROGRAM_FIELDS, metadataJson: true, colorQuantity: true, targetQuantity: true, quantityMeasurement: true },
    orderBy: { createdAt: 'desc' },
    take: ids ? undefined : LIST_LIMIT,
  });
  const { toStore } = await programChallans(programs.map((p) => p.id));
  const lines: HoldLine[] = [];
  for (const p of programs) {
    const { planned, colours } = plannedByUnit(p);
    const issued = toStore.filter((c) => c.programId === p.id);
    for (const unit of Object.keys(planned)) {
      const forwardLog = forwardEntriesOf(issued, unit);
      lines.push({
        key: `PROGRAM:${p.id}:${unit}`,
        sourceType: 'PROGRAM',
        sourceId: p.id,
        departmentCode: 'PROGRAMMING',
        unit,
        ...programRefs(p),
        challanId: issued[0]?.id || null,
        challanNumber: joined(issued.map((c) => c.challanNumber)),
        // Programming holds a Production Sheet before any challan is issued for it.
        challanRequired: false,
        fabricName: p.fabricName || 'Fabric',
        colour: colours || p.fabricColor || null,
        size: null,
        received: planned[unit],
        forwarded: sumOf(forwardLog),
        writtenOff: 0,
        forwardLog,
        forwardPath: `${HOLD_DEPARTMENTS.PROGRAMMING.forward}?programId=${p.id}`,
      });
    }
  }
  return lines;
}

/** Lines of a department: the given sources (any state), or every line that may still hold quantity. */
export async function loadLines(code: string, sourceIds?: string[]): Promise<HoldLine[]> {
  if (sourceIds && sourceIds.length === 0) return [];
  switch (code) {
    case 'PROGRAMMING':
      return programmingLines(sourceIds);
    case 'STORE':
      return storeLines(sourceIds);
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

type HoldRow = Awaited<ReturnType<typeof prisma.departmentHold.findFirstOrThrow>>;

const lineFields = (line: HoldLine) => ({
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
  unit: line.unit,
  received: line.received,
  forwarded: line.forwarded,
  writtenOff: line.writtenOff,
  outstanding: outstandingOf(line),
});

/** Lines of a department with quantity still to hold and no open HOLD. */
export async function holdCandidates(code: string) {
  const [lines, open] = await Promise.all([
    loadLines(code),
    prisma.departmentHold.findMany({ where: { departmentCode: code, status: { in: ACTIVE_HOLD_STATUSES } }, select: { sourceKey: true } }),
  ]);
  const held = new Set(open.map((h) => h.sourceKey));
  return lines.filter((l) => !held.has(l.key) && outstandingOf(l) > 0 && l.unit && (l.unit === 'MTR' || l.unit === 'PCS')).map(lineFields);
}

/** A HOLD as screens show it; `line` (live figures) is absent for closed HOLDs and for lines no longer found. */
function shapeHold(hold: HoldRow, line: HoldLine | null) {
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
  };
}

/**
 * Brings an open HOLD in line with its line's live quantities: forwarding lowers what is left, and a HOLD with
 * nothing left closes (FORWARDED, or CLEARED when the rest was written off). Writes only when something
 * changed, and only while the HOLD is still open, so two readers never close it twice.
 */
async function refreshHold(hold: HoldRow, line: HoldLine | undefined): Promise<HoldRow> {
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

/** HOLDs of these departments: open ones (refreshed against their lines), closed ones, or both. */
export async function listHolds(departments: string[], rawView: string | null, search: string) {
  const view = rawView === 'closed' || rawView === 'all' ? rawView : 'open';
  const status = view === 'closed' ? { notIn: ACTIVE_HOLD_STATUSES } : view === 'all' ? undefined : { in: ACTIVE_HOLD_STATUSES };
  const q = search.trim();
  const holds = await prisma.departmentHold.findMany({
    where: {
      departmentCode: { in: departments },
      ...(status ? { status } : {}),
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
  return { ...shapeHold(hold, line), writtenOff: line?.writtenOff ?? null, outstanding: line ? outstandingOf(line) : null, history };
}

const actorNameOf = (user: AuthenticatedUser) => user.fullName || user.username;

/** Places a HOLD on one line of the department. Only one open HOLD per line. */
export async function placeHold(code: string, body: any, user: AuthenticatedUser) {
  const key = String(body?.lineKey || '');
  const [sourceType, sourceId] = key.split(':');
  if (!sourceType || !sourceId) throw new WorkRequestError('Select the line to place on HOLD.');
  const line = (await loadLines(code, [sourceId])).find((l) => l.key === key) || null;
  const check = validateHold(line, body);
  if (!check.ok) throw new WorkRequestError(check.error);
  const l = line as HoldLine;
  const activeKey = `${code}|${l.key}`;
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 3; attempt++) {
    const existing = await prisma.departmentHold.findUnique({ where: { activeKey }, select: { holdNumber: true } });
    if (existing) throw new WorkRequestError(`This line is already on HOLD (${existing.holdNumber}). Release or update that HOLD instead.`, 409);
    const latest = await prisma.departmentHold.findFirst({ where: { holdNumber: { startsWith: `HLD-${year}-` } }, orderBy: { holdNumber: 'desc' }, select: { holdNumber: true } });
    const seq = (parseInt(latest?.holdNumber.split('-').pop() || '0', 10) || 0) + 1;
    try {
      return await prisma.$transaction(async (tx) => {
        const hold = await tx.departmentHold.create({
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
        await tx.departmentHoldEvent.create({
          data: { holdId: hold.id, action: 'HOLD', quantity: check.quantity, remainingAfter: check.quantity, unit: l.unit, remarks: [holdReasonText(hold), check.remarks].filter(Boolean).join(' · '), actorId: user.id, actorName: actorNameOf(user) },
        });
        await tx.auditLog.create({
          data: { actorId: user.id, action: 'HOLD', entity: 'DepartmentHold', entityId: hold.id, afterState: JSON.stringify({ departmentCode: code, line: l.key, quantity: check.quantity, unit: l.unit, reason: check.reason }) },
        });
        return shapeHold(hold, l);
      }, TX);
    } catch (error) {
      // P2002: the HOLD number was taken at the same moment (try the next), or the line was just held (reported above).
      if ((error as { code?: string } | null)?.code !== 'P2002') throw error;
    }
  }
  throw new WorkRequestError('Could not number the HOLD record. Try again.', 409);
}

/** Releases part or all of what is still on HOLD; the HOLD closes as RELEASED when nothing is left. */
export async function releaseHold(id: string, body: any, user: AuthenticatedUser) {
  const found = await prisma.departmentHold.findUnique({ where: { id } });
  if (!found) throw new WorkRequestError('HOLD record not found.', 404);
  if (!userBelongsToDepartment(user, found.departmentCode)) throw new WorkRequestError('You do not have access to this department.', 403);
  const line = (await loadLines(found.departmentCode, [found.sourceId])).find((l) => l.key === found.sourceKey);
  const hold = await refreshHold(found, line);
  const remaining = line ? remainingOnHold(hold, line) : hold.remainingQuantity;
  const check = validateRelease(hold, remaining, body);
  if (!check.ok) throw new WorkRequestError(check.error);
  const after = round(remaining - check.quantity);
  const status = after <= 0 ? 'RELEASED' : 'PARTIALLY_RELEASED';
  return prisma.$transaction(async (tx) => {
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
    await tx.departmentHoldEvent.create({
      data: { holdId: hold.id, action: 'RELEASE', quantity: check.quantity, remainingAfter: after, unit: hold.unit, remarks: check.remarks, actorId: user.id, actorName: actorNameOf(user) },
    });
    await tx.auditLog.create({
      data: { actorId: user.id, action: 'HOLD_RELEASE', entity: 'DepartmentHold', entityId: hold.id, afterState: JSON.stringify({ quantity: check.quantity, unit: hold.unit, remaining: after }) },
    });
    const updated = await tx.departmentHold.findUniqueOrThrow({ where: { id: hold.id } });
    return shapeHold(updated, line || null);
  }, TX);
}
