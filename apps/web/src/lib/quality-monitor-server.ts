import { prisma } from '@shubham/database';
import { departmentKeyFor } from '@/lib/auth/department-access';
import type { AuthenticatedUser } from '@/lib/auth/require-user';
import { WORKFLOWS, WorkRequestError, type WorkflowConfig } from '@/lib/work-items-server';
import { receivedBasis } from '@/lib/work-items.mjs';
import { unitOf } from '@/lib/challan-units.mjs';
import { HOLD_STATUS_LABEL } from '@/lib/holds.mjs';
import { holdDetail, listHolds, HOLD_DEPARTMENTS } from '@/lib/holds-server';
import { departmentName } from '@/lib/workflow-views';

// Admin monitoring of REJECTED, REWORK and HOLD quantities across the floor. Read-only: every record is built
// from the existing transactions and nothing here changes production, QC or stock quantities.
// - REJECT: QC inspection batches (Threadcut QC, Washing QC, Final QC) and department defect records.
// - REWORK: QC inspection batches, and Dyeing QC rework (its production transactions and rework challans).
// - HOLD:   DepartmentHold (lib/holds-server.ts), refreshed against its line as the department pages do.
// Quantities stay in their own unit (MTR or PCS) and are never added across units.

export type MonitorKind = 'REJECT' | 'REWORK' | 'HOLD';
export const MONITOR_KINDS: MonitorKind[] = ['REJECT', 'REWORK', 'HOLD'];

export interface MonitorRecord {
  id: string;
  kind: MonitorKind;
  source: 'QC_INSPECTION' | 'DEFECT_RECORD' | 'DYEING_QC' | 'HOLD';
  date: string;
  /** Where the decision was recorded (REJECT / REWORK) or the HOLD placed. */
  departmentCode: string;
  /** QC stage that recorded it; null for defects recorded by a processing department and for HOLDs. */
  qcDepartmentCode: string | null;
  /** Department the fabric came from. */
  sourceDepartmentCode: string | null;
  /** REWORK: the processing department that receives the fabric back. */
  reworkToCode: string | null;
  programId: string | null;
  productionSheetNumber: string;
  serialNumber: string;
  designNumber: string;
  clientName: string;
  /** TOP / BOTTOM / DUPATTA / OTHERS once the fabric is cut into garments; null before. */
  style: string | null;
  fabricName: string;
  colour: string | null;
  shade: string | null;
  quantity: number;
  unit: string;
  /** REWORK: part already sent back; HOLD: still held. */
  sentQuantity: number | null;
  remainingQuantity: number | null;
  reason: string;
  remarks: string | null;
  status: string;
  statusLabel: string;
  /** Still open: not yet on the shelf / rework not completed / still on HOLD. */
  active: boolean;
  location: string;
  references: string[];
  challanId: string | null;
  recordedBy: string | null;
  releasedAt: string | null;
}

/** Departments in floor order, for the department-wise analysis. */
export const FLOOR_ORDER = [
  'STORE', 'DYEING', 'QC1', 'EMBROIDERY', 'THREAD_CUTTING', 'QC2', 'WASHING', 'QC3', 'RECUTTING',
  'STITCHING', 'FINISHING', 'STEAM_PRESS', 'FINAL_CHECK', 'INVENTORY',
];

const EPS = 0.001;
const round = (n: number) => Math.round((Number(n) || 0) * 1000) / 1000;
const unitKey = (raw: unknown) => (unitOf(raw) || String(raw || '').trim().toUpperCase() || 'UNSPECIFIED') as string;
const deptKey = (raw: string | null | undefined) => (raw ? departmentKeyFor(raw) || raw.trim().toUpperCase() : null);
const userName = (u: { fullName?: string | null; username?: string | null } | null | undefined) => u?.fullName || u?.username || null;
const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);
/** Challans sent but not yet received by the destination. */
const NOT_YET_RECEIVED = ['DRAFT', 'ISSUED', 'SUBMITTED', 'IN_TRANSIT'];
const GARMENT_CATEGORIES = ['TOP', 'BOTTOM', 'DUPATTA', 'OTHERS', 'OTHER'];
const DEFECT_OPEN = ['OPEN', 'UNDER_REVIEW'];
const STORE_SHELF = 'Fabric Store Defective Shelf (DEF-SHELF-STORE)';

const PROGRAM_SELECT = {
  id: true,
  programNumber: true,
  programSerialNo: true,
  designNumber: true,
  designName: true,
  clientName: true,
  buyerName: true,
  fabricName: true,
  fabricColor: true,
} as const;

type ProgramRef = {
  id: string;
  programNumber: string;
  programSerialNo: string | null;
  designNumber: string | null;
  designName: string;
  clientName: string | null;
  buyerName: string;
  fabricName: string | null;
  fabricColor: string | null;
};

function programFields(p: ProgramRef | null | undefined) {
  return {
    programId: p?.id ?? null,
    productionSheetNumber: p?.programNumber || '—',
    serialNumber: (p?.programSerialNo || '').trim() || p?.programNumber || '—',
    designNumber: (p?.designNumber || '').trim() || (p?.designName || '').trim() || '—',
    clientName: (p?.clientName || '').trim() || (p?.buyerName || '').trim() || '—',
  };
}

function styleOf(raw: string | null | undefined) {
  const v = String(raw || '').trim().toUpperCase();
  return GARMENT_CATEGORIES.includes(v) ? (v === 'OTHER' ? 'OTHERS' : v) : null;
}

const qcConfigs = () => (Object.values(WORKFLOWS) as WorkflowConfig[]).filter((c) => c.qc);

/**
 * Splits quantities sent on challans over the decisions that produced them, oldest first, so each decision
 * knows which challans carried it (a decision of 50 may leave on a 30 and a 20 challan).
 */
function allocate<T extends { quantity: number }>(demands: number[], supplies: T[]) {
  const left = supplies.map((s) => round(s.quantity));
  let i = 0;
  return demands.map((demand) => {
    const slices: Array<{ supply: T; quantity: number }> = [];
    let need = round(demand);
    while (need > EPS && i < supplies.length) {
      const take = round(Math.min(need, left[i]));
      if (take > EPS) slices.push({ supply: supplies[i], quantity: take });
      left[i] = round(left[i] - take);
      need = round(need - take);
      if (left[i] <= EPS) i++;
    }
    return slices;
  });
}

// ---------------------------------------------------------------- QC inspection batches (QC2, QC3, Final QC)

async function qcInspectionRecords(): Promise<MonitorRecord[]> {
  const configs = qcConfigs();
  const items = await prisma.departmentWorkItem.findMany({
    where: {
      departmentCode: { in: configs.map((c) => c.code) },
      OR: [{ rejectedQuantity: { gt: 0 } }, { reworkQuantity: { gt: 0 } }],
    },
    include: {
      program: { select: PROGRAM_SELECT },
      inboundChallan: { select: { id: true, challanNumber: true } },
      inspections: { orderBy: { createdAt: 'asc' }, include: { inspector: { select: { fullName: true, username: true } } } },
      transfers: {
        where: { kind: { in: ['REJECT', 'REWORK'] } },
        orderBy: { createdAt: 'asc' },
        include: { challan: { select: { id: true, challanNumber: true, status: true } } },
      },
    },
  });

  // Where rework went: the receiving department's work item for each REWORK challan line.
  const reworkLineIds = items.flatMap((i) => i.transfers.filter((t) => t.kind === 'REWORK').map((t) => t.challanItemId));
  const downstream = reworkLineIds.length
    ? await prisma.departmentWorkItem.findMany({
        where: { inboundChallanItemId: { in: reworkLineIds } },
        select: { inboundChallanItemId: true, departmentCode: true, itemNumber: true, status: true, receivedQuantity: true, expectedQuantity: true, transferredQuantity: true, defectQuantity: true },
      })
    : [];
  const downstreamOf = new Map(downstream.map((d) => [d.inboundChallanItemId, d]));
  const finished = (d: (typeof downstream)[number]) => {
    if (d.status === 'TRANSFERRED') return true;
    const received = receivedBasis(d);
    return received > 0 && round(d.transferredQuantity + d.defectQuantity) >= received - EPS;
  };

  const records: MonitorRecord[] = [];
  for (const item of items) {
    const cfg = configs.find((c) => c.code === item.departmentCode)!;
    const qcName = cfg.label;
    const reworkTo = cfg.qc!.reworkTo;
    const base = {
      ...programFields(item.program),
      source: 'QC_INSPECTION' as const,
      departmentCode: cfg.code,
      qcDepartmentCode: cfg.code,
      sourceDepartmentCode: deptKey(item.sourceDepartment),
      style: styleOf(item.garmentCategory),
      fabricName: item.fabricName,
      colour: item.colour,
      shade: null,
      unit: unitKey(item.uom),
      challanId: item.inboundChallanId,
    };
    const rejectTransfers = item.transfers.filter((t) => t.kind === 'REJECT');
    const reworkTransfers = item.transfers.filter((t) => t.kind === 'REWORK');
    const rejectSlices = allocate(item.inspections.map((x) => x.rejectQuantity), rejectTransfers);
    const reworkSlices = allocate(item.inspections.map((x) => x.reworkQuantity), reworkTransfers);

    item.inspections.forEach((insp, index) => {
      const inboundRef = `Inbound challan ${item.inboundChallan.challanNumber}`;
      if (insp.rejectQuantity > EPS) {
        const slices = rejectSlices[index];
        const sent = round(slices.reduce((s, x) => s + x.quantity, 0));
        const inTransit = slices.some((s) => NOT_YET_RECEIVED.includes(s.supply.challan.status));
        let status: string, statusLabel: string, location: string;
        if (sent <= EPS) {
          status = 'AT_DEPARTMENT';
          statusLabel = 'Awaiting Defective Shelf';
          location = `${qcName} (awaiting Defective Shelf)`;
        } else if (sent < insp.rejectQuantity - EPS) {
          status = 'PARTLY_SENT';
          statusLabel = `Partly sent (${sent} of ${round(insp.rejectQuantity)})`;
          location = `${qcName} / ${inTransit ? 'in transit to ' : ''}${STORE_SHELF}`;
        } else if (inTransit) {
          status = 'IN_TRANSIT';
          statusLabel = 'In transit to Defective Shelf';
          location = `In transit to ${STORE_SHELF}`;
        } else {
          status = 'ON_SHELF';
          statusLabel = 'On Defective Shelf';
          location = STORE_SHELF;
        }
        records.push({
          ...base,
          id: `rej-insp:${insp.id}`,
          kind: 'REJECT',
          date: insp.createdAt.toISOString(),
          reworkToCode: null,
          quantity: round(insp.rejectQuantity),
          sentQuantity: sent,
          remainingQuantity: null,
          reason: insp.rejectReason || '—',
          remarks: insp.remarks,
          status,
          statusLabel,
          active: status !== 'ON_SHELF',
          location,
          references: [item.itemNumber, inboundRef, ...slices.map((s) => `Defect challan ${s.supply.challan.challanNumber}`)],
          recordedBy: userName(insp.inspector),
          releasedAt: null,
        });
      }
      if (insp.reworkQuantity > EPS) {
        const slices = reworkSlices[index];
        const sent = round(slices.reduce((s, x) => s + x.quantity, 0));
        const downs = slices.map((s) => downstreamOf.get(s.supply.challanItemId));
        const notReceived = downs.some((d) => !d || d.status === 'AWAITING_RECEIPT');
        let status: string, statusLabel: string, location: string;
        if (sent <= EPS) {
          status = 'PENDING';
          statusLabel = 'Pending';
          location = `${qcName} (awaiting return to ${reworkTo.label})`;
        } else if (sent < insp.reworkQuantity - EPS) {
          status = 'IN_PROGRESS';
          statusLabel = `In Progress (${sent} of ${round(insp.reworkQuantity)} sent)`;
          location = `${qcName} / ${reworkTo.label}`;
        } else if (downs.every((d) => d && finished(d))) {
          status = 'COMPLETED';
          statusLabel = 'Completed';
          location = `Reworked at ${reworkTo.label}; sent back for QC`;
        } else {
          status = 'IN_PROGRESS';
          statusLabel = notReceived ? 'In Progress (in transit)' : 'In Progress';
          location = notReceived ? `In transit to ${reworkTo.label}` : `${reworkTo.label} (rework in progress)`;
        }
        records.push({
          ...base,
          id: `rwk-insp:${insp.id}`,
          kind: 'REWORK',
          date: insp.createdAt.toISOString(),
          reworkToCode: deptKey(reworkTo.code),
          quantity: round(insp.reworkQuantity),
          sentQuantity: sent,
          remainingQuantity: null,
          reason: insp.reworkReason || '—',
          remarks: insp.remarks,
          status,
          statusLabel,
          active: status !== 'COMPLETED',
          location,
          references: [
            item.itemNumber,
            inboundRef,
            ...slices.map((s, i) => `Rework challan ${s.supply.challan.challanNumber}${downs[i] ? ` → ${downs[i]!.itemNumber}` : ''}`),
          ],
          recordedBy: userName(insp.inspector),
          releasedAt: null,
        });
      }
    });
  }
  return records;
}

// ---------------------------------------------------------------- Dyeing QC rework

async function dyeingQcReworkRecords(): Promise<MonitorRecord[]> {
  const txs = await prisma.productionTransaction.findMany({
    where: { departmentCode: 'QC1', reworkQuantity: { gt: 0 } },
    include: {
      program: { select: PROGRAM_SELECT },
      operator: { select: { fullName: true, username: true } },
      challan: {
        select: {
          id: true,
          challanNumber: true,
          fromDepartment: true,
          items: { select: { itemDescription: true, fabricCode: true, colour: true, shade: true, uom: true } },
        },
      },
    },
    orderBy: { recordedAt: 'desc' },
  });
  if (txs.length === 0) return [];
  const returns = await prisma.challan.findMany({
    where: { parentChallanId: { in: Array.from(new Set(txs.map((t) => t.challanId))) }, challanType: 'REWORK_RETURN' },
    select: {
      id: true,
      challanNumber: true,
      status: true,
      parentChallanId: true,
      items: { select: { id: true, uom: true, colour: true, shade: true } },
      dyeingInboundOrders: { select: { orderNumber: true, status: true, inboundChallanItemId: true } },
    },
  });

  return txs.map((t) => {
    const unit = unitKey(t.unitOfMeasure);
    const line = t.challan.items.find((it) => unitKey(it.uom) === unit) || t.challan.items[0];
    const back = returns.filter((r) => r.parentChallanId === t.challanId);
    const lines = back.flatMap((r) => r.items.filter((it) => unitKey(it.uom) === unit).map((it) => ({ challan: r, item: it })));
    const orders = lines.flatMap(({ challan, item }) => challan.dyeingInboundOrders.filter((o) => o.inboundChallanItemId === item.id));
    let status: string, statusLabel: string, location: string;
    if (lines.length === 0) {
      status = 'PENDING';
      statusLabel = 'Pending';
      location = 'Dyeing QC (awaiting return to Dyeing)';
    } else if (orders.length > 0 && orders.every((o) => o.status === 'SENT_TO_QC1')) {
      status = 'COMPLETED';
      statusLabel = 'Completed';
      location = 'Re-dyed at Dyeing; sent back to Dyeing QC';
    } else if (lines.every(({ challan }) => NOT_YET_RECEIVED.includes(challan.status)) && orders.every((o) => o.status === 'AWAITING_RECEIPT')) {
      status = 'IN_PROGRESS';
      statusLabel = 'In Progress (in transit)';
      location = 'In transit to Dyeing';
    } else {
      status = 'IN_PROGRESS';
      statusLabel = 'In Progress';
      location = 'Dyeing (re-dyeing in progress)';
    }
    const returnLine = lines[0]?.item;
    return {
      ...programFields(t.program),
      id: `rwk-qc1:${t.id}`,
      kind: 'REWORK' as const,
      source: 'DYEING_QC' as const,
      date: t.recordedAt.toISOString(),
      departmentCode: 'QC1',
      qcDepartmentCode: 'QC1',
      sourceDepartmentCode: deptKey(t.challan.fromDepartment),
      reworkToCode: 'DYEING',
      style: null,
      fabricName: line?.itemDescription || line?.fabricCode || t.program.fabricName || '—',
      colour: line?.colour || t.program.fabricColor || null,
      shade: returnLine?.colour || line?.shade || null,
      quantity: round(t.reworkQuantity),
      unit,
      sentQuantity: lines.length ? round(t.reworkQuantity) : 0,
      remainingQuantity: null,
      reason: t.reworkReason || t.notes || '—',
      remarks: t.notes,
      status,
      statusLabel,
      active: status !== 'COMPLETED',
      location,
      references: [
        `QC challan ${t.challan.challanNumber}`,
        ...back.map((r) => `Rework challan ${r.challanNumber}`),
        ...orders.map((o) => `Dyeing order ${o.orderNumber}`),
      ],
      challanId: t.challanId,
      recordedBy: userName(t.operator),
      releasedAt: null,
    };
  });
}

// ---------------------------------------------------------------- department defect records

async function defectRecords(): Promise<MonitorRecord[]> {
  const rows = await prisma.defectRecord.findMany({
    include: {
      program: { select: PROGRAM_SELECT },
      challan: { select: { id: true, challanNumber: true, fromDepartment: true, toDepartment: true, defectiveShelfLocation: true, defectiveUnit: true, fabricUnit: true } },
      detectedBy: { select: { fullName: true, username: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => {
    const dept = deptKey(r.departmentCode) || 'UNKNOWN';
    const open = DEFECT_OPEN.includes(r.status);
    const came = r.challan && deptKey(r.challan.toDepartment) === dept ? deptKey(r.challan.fromDepartment) : null;
    // Older records have no unit: their challan's defective unit, else pieces (as the defective shelves read them).
    const unit = unitOf(r.uom) || unitOf(r.challan?.defectiveUnit) || unitOf(r.challan?.fabricUnit) || 'PCS';
    const shelf = r.challan?.defectiveShelfLocation || `${departmentName(dept)} defective shelf`;
    const [first, ...rest] = r.itemDescription.split(' · ');
    const style = styleOf(first);
    return {
      ...programFields(r.program),
      id: `rej-def:${r.id}`,
      kind: 'REJECT' as const,
      source: 'DEFECT_RECORD' as const,
      date: r.createdAt.toISOString(),
      departmentCode: dept,
      qcDepartmentCode: null,
      sourceDepartmentCode: came,
      reworkToCode: null,
      style,
      fabricName: (style ? rest.join(' · ') : r.itemDescription) || r.program.fabricName || '—',
      colour: null,
      shade: null,
      quantity: round(r.quantity),
      unit,
      sentQuantity: null,
      remainingQuantity: null,
      reason: r.reason || '—',
      remarks: r.resolutionNotes,
      status: open ? 'ON_SHELF' : 'RESOLVED',
      statusLabel: open ? 'On defective shelf' : `Resolved (${r.status.replace(/_/g, ' ')})`,
      active: open,
      location: open ? shelf : `Resolved: ${r.status.replace(/_/g, ' ')}`,
      references: [r.defectCode, ...(r.challan ? [`Challan ${r.challan.challanNumber}`] : [])],
      challanId: r.challanId,
      recordedBy: userName(r.detectedBy),
      releasedAt: iso(r.resolvedAt),
    };
  });
}

// ---------------------------------------------------------------- HOLD

async function holdRecords(): Promise<MonitorRecord[]> {
  const holds = await listHolds(Object.keys(HOLD_DEPARTMENTS), 'all', '');
  const raw = holds.length
    ? await prisma.departmentHold.findMany({
        where: { id: { in: holds.map((h) => h.id) } },
        select: { id: true, sourceType: true, sourceId: true, program: { select: PROGRAM_SELECT } },
      })
    : [];
  const rawOf = new Map(raw.map((r) => [r.id, r]));
  const workItemIds = raw.filter((r) => r.sourceType === 'WORK_ITEM').map((r) => r.sourceId);
  const workItems = workItemIds.length
    ? await prisma.departmentWorkItem.findMany({ where: { id: { in: workItemIds } }, select: { id: true, garmentCategory: true, sourceDepartment: true } })
    : [];
  const workItemOf = new Map(workItems.map((w) => [w.id, w]));
  const releases = holds.length
    ? await prisma.departmentHoldEvent.groupBy({ by: ['holdId'], where: { holdId: { in: holds.map((h) => h.id) }, action: 'RELEASE' }, _max: { createdAt: true } })
    : [];
  const releasedOf = new Map(releases.map((r) => [r.holdId, r._max.createdAt]));

  return holds.map((h) => {
    const r = rawOf.get(h.id);
    const wi = r?.sourceType === 'WORK_ITEM' ? workItemOf.get(r.sourceId) : undefined;
    const dept = departmentName(h.departmentCode);
    const location = h.active
      ? `${dept} (on HOLD)`
      : h.status === 'FORWARDED'
        ? `Forwarded from ${dept}`
        : h.status === 'CLEARED'
          ? `Written off at ${dept}`
          : `${dept} (released)`;
    return {
      ...programFields(r?.program),
      designNumber: h.designNumber,
      serialNumber: h.serialNumber,
      productionSheetNumber: h.productionSheetNumber,
      id: `hold:${h.id}`,
      kind: 'HOLD' as const,
      source: 'HOLD' as const,
      date: iso(h.heldAt)!,
      departmentCode: h.departmentCode,
      qcDepartmentCode: null,
      sourceDepartmentCode: deptKey(wi?.sourceDepartment),
      reworkToCode: null,
      style: styleOf(wi?.garmentCategory),
      fabricName: h.fabricName,
      colour: h.colour,
      shade: null,
      quantity: round(h.holdQuantity),
      unit: unitKey(h.unit),
      sentQuantity: null,
      remainingQuantity: round(h.remainingQuantity),
      reason: h.reasonText,
      remarks: h.remarks,
      status: h.active ? 'ACTIVE' : 'RELEASED',
      statusLabel: h.active ? `Active · ${h.statusLabel}` : (HOLD_STATUS_LABEL as Record<string, string>)[h.status] || h.statusLabel,
      active: h.active,
      location,
      references: [h.holdNumber, ...(h.challanNumber ? [`Challan ${h.challanNumber}`] : [])],
      challanId: h.challanId,
      recordedBy: h.heldByName,
      releasedAt: iso(h.closedAt) || iso(releasedOf.get(h.id)),
    };
  });
}

/** Every REJECT, REWORK and HOLD record, newest first. */
export async function loadMonitorRecords(): Promise<MonitorRecord[]> {
  const parts = await Promise.all([qcInspectionRecords(), dyeingQcReworkRecords(), defectRecords(), holdRecords()]);
  return parts.flat().sort((a, b) => b.date.localeCompare(a.date));
}

// ---------------------------------------------------------------- filters and summaries

export interface MonitorFilters {
  kind?: string | null;
  from?: string | null;
  to?: string | null;
  department?: string | null;
  qcDepartment?: string | null;
  sourceDepartment?: string | null;
  design?: string | null;
  style?: string | null;
  serial?: string | null;
  client?: string | null;
  fabric?: string | null;
  colour?: string | null;
  status?: string | null;
  unit?: string | null;
  reason?: string | null;
  q?: string | null;
}

const has = (value: string | null | undefined, wanted: string) => String(value || '').toLowerCase().includes(wanted);
const dayStart = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00`) : null);

/** Records matching the filters. `department` matches where it was recorded or, for REWORK, where it went back. */
export function filterRecords(records: MonitorRecord[], f: MonitorFilters, { ignoreKind = false } = {}) {
  const t = (v: string | null | undefined) => (v || '').trim().toLowerCase();
  const from = f.from ? dayStart(f.from) : null;
  const toStart = f.to ? dayStart(f.to) : null;
  const to = toStart ? new Date(toStart.getTime() + 86400000) : null;
  const kind = (f.kind || '').toUpperCase();
  const dept = (f.department || '').toUpperCase();
  const qc = (f.qcDepartment || '').toUpperCase();
  const src = (f.sourceDepartment || '').toUpperCase();
  const style = (f.style || '').toUpperCase();
  const status = (f.status || '').toUpperCase();
  const unit = (f.unit || '').toUpperCase();
  const [design, serial, client, fabric, colour, reason, q] = [f.design, f.serial, f.client, f.fabric, f.colour, f.reason, f.q].map(t);
  return records.filter((r) => {
    if (!ignoreKind && kind && r.kind !== kind) return false;
    const at = new Date(r.date);
    if (from && at < from) return false;
    if (to && at >= to) return false;
    if (dept && r.departmentCode !== dept && r.reworkToCode !== dept) return false;
    if (qc && r.qcDepartmentCode !== qc) return false;
    if (src && r.sourceDepartmentCode !== src) return false;
    if (style && r.style !== style) return false;
    if (status && r.status !== status && !(status === 'OPEN' && r.active) && !(status === 'CLOSED' && !r.active)) return false;
    if (unit && r.unit !== unit) return false;
    if (design && !has(r.designNumber, design)) return false;
    if (serial && !has(r.serialNumber, serial) && !has(r.productionSheetNumber, serial)) return false;
    if (client && !has(r.clientName, client)) return false;
    if (fabric && !has(r.fabricName, fabric)) return false;
    if (colour && !has(r.colour, colour) && !has(r.shade, colour)) return false;
    if (reason && !has(r.reason, reason)) return false;
    if (q) {
      const hay = [r.productionSheetNumber, r.serialNumber, r.designNumber, r.fabricName, r.clientName, ...r.references].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

type Totals = Record<string, number>;
const addTo = (totals: Totals, unit: string, qty: number) => {
  totals[unit] = round((totals[unit] || 0) + qty);
};

export function summarize(records: MonitorRecord[]) {
  const of = (kind: MonitorKind) => records.filter((r) => r.kind === kind);
  const block = (list: MonitorRecord[]) => {
    const quantity: Totals = {};
    for (const r of list) addTo(quantity, r.unit, r.quantity);
    return {
      records: list.length,
      quantity,
      departments: new Set(list.map((r) => r.departmentCode)).size,
      productionSheets: new Set(list.map((r) => r.programId).filter(Boolean)).size,
      open: list.filter((r) => r.active).length,
    };
  };
  const rework = of('REWORK');
  const hold = of('HOLD');
  const blocked: Totals = {};
  for (const r of hold) if (r.active) addTo(blocked, r.unit, r.remainingQuantity || 0);
  return {
    REJECT: block(of('REJECT')),
    REWORK: {
      ...block(rework),
      pending: rework.filter((r) => r.status === 'PENDING').length,
      inProgress: rework.filter((r) => r.status === 'IN_PROGRESS').length,
      completed: rework.filter((r) => r.status === 'COMPLETED').length,
    },
    HOLD: { ...block(hold), onHold: hold.filter((r) => r.active).length, blockedQuantity: blocked },
  };
}

/** Per department: rejected there, rework marked there (QC), rework sent back to it, and HOLD there. */
export function departmentBreakdown(records: MonitorRecord[]) {
  const rows = new Map<string, { code: string; name: string; rejected: Totals; rejectCount: number; reworkMarked: Totals; reworkMarkedCount: number; reworkAssigned: Totals; reworkAssignedCount: number; hold: Totals; holdCount: number; holdBlocked: Totals }>();
  const row = (code: string) => {
    if (!rows.has(code)) {
      rows.set(code, { code, name: departmentName(code), rejected: {}, rejectCount: 0, reworkMarked: {}, reworkMarkedCount: 0, reworkAssigned: {}, reworkAssignedCount: 0, hold: {}, holdCount: 0, holdBlocked: {} });
    }
    return rows.get(code)!;
  };
  for (const r of records) {
    if (r.kind === 'REJECT') {
      const x = row(r.departmentCode);
      addTo(x.rejected, r.unit, r.quantity);
      x.rejectCount++;
    } else if (r.kind === 'REWORK') {
      const x = row(r.departmentCode);
      addTo(x.reworkMarked, r.unit, r.quantity);
      x.reworkMarkedCount++;
      if (r.reworkToCode) {
        const y = row(r.reworkToCode);
        addTo(y.reworkAssigned, r.unit, r.quantity);
        y.reworkAssignedCount++;
      }
    } else {
      const x = row(r.departmentCode);
      addTo(x.hold, r.unit, r.quantity);
      x.holdCount++;
      if (r.active) addTo(x.holdBlocked, r.unit, r.remainingQuantity || 0);
    }
  }
  const order = (code: string) => {
    const i = FLOOR_ORDER.indexOf(code);
    return i < 0 ? FLOOR_ORDER.length : i;
  };
  return Array.from(rows.values()).sort((a, b) => order(a.code) - order(b.code) || a.name.localeCompare(b.name));
}

/** Values the filter dropdowns offer, from every record. */
export function filterOptions(records: MonitorRecord[]) {
  const uniq = (values: Array<string | null | undefined>) => Array.from(new Set(values.filter((v): v is string => !!v && v !== '—'))).sort();
  const depts = uniq(records.flatMap((r) => [r.departmentCode, r.reworkToCode, r.sourceDepartmentCode]));
  const floor = (code: string) => (FLOOR_ORDER.includes(code) ? FLOOR_ORDER.indexOf(code) : FLOOR_ORDER.length);
  const byFloor = (codes: string[]) => codes.sort((a, b) => floor(a) - floor(b)).map((c) => ({ value: c, label: departmentName(c) }));
  return {
    departments: byFloor(depts),
    qcDepartments: byFloor(uniq(records.map((r) => r.qcDepartmentCode))),
    sourceDepartments: byFloor(uniq(records.map((r) => r.sourceDepartmentCode))),
    units: uniq(records.map((r) => r.unit)),
    styles: uniq(records.map((r) => r.style)),
    clients: uniq(records.map((r) => r.clientName)),
    statuses: Object.fromEntries(
      MONITOR_KINDS.map((k) => [
        k,
        Array.from(new Map(records.filter((r) => r.kind === k).map((r) => [r.status, r.statusLabel.split(' (')[0].split(' · ')[0]])).entries()).map(([value, label]) => ({ value, label })),
      ]),
    ),
  };
}

// ---------------------------------------------------------------- one record in full

export interface HistoryEvent {
  at: string;
  department: string | null;
  action: string;
  detail: string;
  quantity: number | null;
  unit: string | null;
  reference: string | null;
  by: string | null;
}

const challanBrief = { id: true, challanNumber: true, challanType: true, fromDepartment: true, toDepartment: true, status: true, issuedDate: true, receivedDate: true, createdAt: true } as const;
type ChallanBrief = { id: string; challanNumber: string; challanType: string; fromDepartment: string; toDepartment: string; status: string; issuedDate: Date | null; receivedDate: Date | null; createdAt: Date };
const challanRow = (c: ChallanBrief) => ({
  id: c.id,
  challanNumber: c.challanNumber,
  challanType: c.challanType,
  from: departmentName(deptKey(c.fromDepartment)),
  to: departmentName(deptKey(c.toDepartment)),
  status: c.status,
  date: iso(c.issuedDate || c.createdAt),
});

/** The movement of a work item and of the lines it came from, oldest first. */
async function workItemHistory(startId: string) {
  const events: HistoryEvent[] = [];
  const challans = new Map<string, ChallanBrief>();
  const chain: any[] = [];
  let id: string | null = startId;
  for (let depth = 0; id && depth < 15; depth++) {
    const wi: any = await prisma.departmentWorkItem.findUnique({
      where: { id },
      include: {
        inboundChallan: { select: challanBrief },
        receivedBy: { select: { fullName: true, username: true } },
        inspections: { orderBy: { createdAt: 'asc' }, include: { inspector: { select: { fullName: true, username: true } } } },
        transfers: { orderBy: { createdAt: 'asc' }, include: { challan: { select: challanBrief }, createdBy: { select: { fullName: true, username: true } } } },
      },
    });
    if (!wi) break;
    chain.push(wi);
    id = wi.sourceWorkItemId;
  }
  for (const wi of chain.reverse()) {
    const dept = departmentName(wi.departmentCode);
    const inbound = wi.inboundChallan as ChallanBrief;
    challans.set(inbound.id, inbound);
    events.push({ at: iso(inbound.issuedDate || inbound.createdAt)!, department: departmentName(deptKey(inbound.fromDepartment)), action: 'Challan issued', detail: `${departmentName(deptKey(inbound.fromDepartment))} → ${dept} (${wi.itemNumber})`, quantity: wi.expectedQuantity, unit: wi.uom, reference: inbound.challanNumber, by: null });
    if (wi.receivedAt) {
      events.push({ at: iso(wi.receivedAt)!, department: dept, action: 'Received', detail: wi.receiptRemarks || `Received at ${dept}`, quantity: wi.receivedQuantity, unit: wi.uom, reference: wi.itemNumber, by: userName(wi.receivedBy) });
    }
    for (const x of wi.inspections) {
      events.push({
        at: iso(x.createdAt)!,
        department: dept,
        action: 'QC inspection',
        detail: [`PASS ${x.passQuantity}, REJECT ${x.rejectQuantity}, REWORK ${x.reworkQuantity}`, x.rejectReason ? `Reject: ${x.rejectReason}` : null, x.reworkReason ? `Rework: ${x.reworkReason}` : null, x.remarks].filter(Boolean).join(' · '),
        quantity: x.inspectedQuantity,
        unit: x.uom,
        reference: wi.itemNumber,
        by: userName(x.inspector),
      });
    }
    if (wi.defectQuantity > 0) {
      events.push({ at: iso(wi.updatedAt)!, department: dept, action: 'Defective (total)', detail: `Kept apart as defective in ${dept}`, quantity: wi.defectQuantity, unit: wi.uom, reference: wi.itemNumber, by: null });
    }
    for (const t of wi.transfers) {
      challans.set(t.challan.id, t.challan);
      const label = t.kind === 'REJECT' ? 'Sent to Defective Shelf' : t.kind === 'REWORK' ? 'Sent back for rework' : 'Forwarded';
      events.push({ at: iso(t.createdAt)!, department: dept, action: label, detail: `${dept} → ${departmentName(deptKey(t.challan.toDepartment))}`, quantity: t.quantity, unit: t.uom, reference: t.challan.challanNumber, by: userName(t.createdBy) });
    }
  }
  return { events, challans: Array.from(challans.values()), lineItem: chain[chain.length - 1] || null };
}

/** One record with its Production Sheet, line and complete movement history. Administrators only (checked by the route). */
export async function monitorRecordDetail(id: string, user: AuthenticatedUser) {
  const records = await loadMonitorRecords();
  const record = records.find((r) => r.id === id);
  if (!record) throw new WorkRequestError('Record not found.', 404);
  const [prefix, rawId] = id.split(':');
  let history: HistoryEvent[] = [];
  let challans: ChallanBrief[] = [];
  let line: { label: string; received: number | null; unit: string | null } | null = null;

  if (prefix === 'rej-insp' || prefix === 'rwk-insp') {
    const insp = await prisma.workItemInspection.findUnique({ where: { id: rawId }, select: { workItemId: true } });
    if (insp) {
      const h = await workItemHistory(insp.workItemId);
      history = h.events;
      challans = h.challans;
      if (h.lineItem) line = { label: h.lineItem.itemNumber, received: receivedBasis(h.lineItem), unit: h.lineItem.uom };
      // Where the rework went: the receiving department's lines for its rework challans.
      if (prefix === 'rwk-insp' && h.lineItem) {
        const lineIds = h.lineItem.transfers.filter((t: any) => t.kind === 'REWORK').map((t: any) => t.challanItemId);
        const backs = lineIds.length
          ? await prisma.departmentWorkItem.findMany({ where: { inboundChallanItemId: { in: lineIds } }, include: { transfers: { include: { challan: { select: challanBrief } } } } })
          : [];
        for (const b of backs) {
          const dept = departmentName(b.departmentCode);
          if (b.receivedAt) history.push({ at: iso(b.receivedAt)!, department: dept, action: 'Rework received', detail: `${b.itemNumber} · ${b.status.replace(/_/g, ' ')}`, quantity: b.receivedQuantity, unit: b.uom, reference: b.itemNumber, by: null });
          for (const t of b.transfers) {
            challans.push(t.challan);
            history.push({ at: iso(t.createdAt)!, department: dept, action: 'Reworked and forwarded', detail: `${dept} → ${departmentName(deptKey(t.challan.toDepartment))}`, quantity: t.quantity, unit: t.uom, reference: t.challan.challanNumber, by: null });
          }
        }
      }
    }
  } else if (prefix === 'rwk-qc1') {
    const t = await prisma.productionTransaction.findUnique({ where: { id: rawId }, include: { challan: { select: { ...challanBrief, items: { select: { quantity: true, uom: true } } } }, operator: { select: { fullName: true, username: true } } } });
    if (t) {
      challans.push(t.challan);
      const unit = unitKey(t.unitOfMeasure);
      const received = round(t.challan.items.filter((i) => unitKey(i.uom) === unit).reduce((s, i) => s + i.quantity, 0));
      line = { label: `QC challan ${t.challan.challanNumber}`, received, unit };
      history.push({ at: iso(t.challan.issuedDate || t.challan.createdAt)!, department: 'Dyeing', action: 'Challan issued', detail: 'Dyeing → Dyeing QC', quantity: received, unit, reference: t.challan.challanNumber, by: null });
      if (t.challan.receivedDate) history.push({ at: iso(t.challan.receivedDate)!, department: 'Dyeing QC', action: 'Received', detail: 'Received at Dyeing QC', quantity: null, unit: null, reference: t.challan.challanNumber, by: null });
      history.push({ at: iso(t.recordedAt)!, department: 'Dyeing QC', action: 'QC inspection', detail: `PASS ${t.goodQuantity}, REWORK ${t.reworkQuantity}, Shrinkage ${t.wasteQuantity}${t.reworkReason ? ` · Rework: ${t.reworkReason}` : ''}`, quantity: t.inputQuantity, unit, reference: t.challan.challanNumber, by: userName(t.operator) });
      const returns = await prisma.challan.findMany({
        where: { parentChallanId: t.challanId },
        select: { ...challanBrief, items: { select: { quantity: true, uom: true } }, dyeingInboundOrders: { include: { qcTransfers: { include: { challan: { select: challanBrief } } } } } },
      });
      for (const r of returns) {
        challans.push(r);
        const qty = round(r.items.filter((i) => unitKey(i.uom) === unit).reduce((s, i) => s + i.quantity, 0));
        history.push({ at: iso(r.issuedDate || r.createdAt)!, department: 'Dyeing QC', action: r.challanType === 'REWORK_RETURN' ? 'Sent back for rework' : 'Forwarded', detail: `Dyeing QC → ${departmentName(deptKey(r.toDepartment))}`, quantity: qty || null, unit, reference: r.challanNumber, by: null });
        for (const o of r.dyeingInboundOrders) {
          if (o.receivedAt) history.push({ at: iso(o.receivedAt)!, department: 'Dyeing', action: 'Rework received', detail: `${o.orderNumber} · ${o.status.replace(/_/g, ' ')}`, quantity: o.receivedQuantity, unit: o.uom, reference: o.orderNumber, by: null });
          for (const q of o.qcTransfers) {
            challans.push(q.challan);
            history.push({ at: iso(q.createdAt)!, department: 'Dyeing', action: 'Re-dyed and sent to Dyeing QC', detail: o.orderNumber, quantity: q.quantity, unit: q.uom, reference: q.challan.challanNumber, by: null });
          }
        }
      }
    }
  } else if (prefix === 'rej-def') {
    const d = await prisma.defectRecord.findUnique({ where: { id: rawId }, include: { challan: { select: challanBrief }, detectedBy: { select: { fullName: true, username: true } } } });
    if (d) {
      const wi = d.challanId
        ? await prisma.departmentWorkItem.findFirst({ where: { inboundChallanId: d.challanId, departmentCode: deptKey(d.departmentCode) || d.departmentCode }, select: { id: true } })
        : null;
      if (wi) {
        const h = await workItemHistory(wi.id);
        history = h.events;
        challans = h.challans;
        if (h.lineItem) line = { label: h.lineItem.itemNumber, received: receivedBasis(h.lineItem), unit: h.lineItem.uom };
      } else if (d.challan) {
        challans.push(d.challan);
        history.push({ at: iso(d.challan.issuedDate || d.challan.createdAt)!, department: departmentName(deptKey(d.challan.fromDepartment)), action: 'Challan issued', detail: `${departmentName(deptKey(d.challan.fromDepartment))} → ${departmentName(deptKey(d.challan.toDepartment))}`, quantity: null, unit: null, reference: d.challan.challanNumber, by: null });
      }
      history.push({ at: iso(d.createdAt)!, department: departmentName(deptKey(d.departmentCode)), action: 'Defect recorded', detail: `${d.reason}${d.resolutionNotes ? ` · ${d.resolutionNotes}` : ''}`, quantity: d.quantity, unit: record.unit, reference: d.defectCode, by: userName(d.detectedBy) });
      if (d.resolvedAt) history.push({ at: iso(d.resolvedAt)!, department: departmentName(deptKey(d.departmentCode)), action: `Resolved (${d.status})`, detail: d.resolutionNotes || '', quantity: null, unit: null, reference: d.defectCode, by: null });
    }
  } else if (prefix === 'hold') {
    const h = await holdDetail(rawId, user);
    line = { label: h.holdNumber, received: h.receivedQuantity, unit: h.unit };
    const actionLabel: Record<string, string> = { HOLD: 'Placed on HOLD', RELEASE: 'Released', CLOSE: 'Closed', FORWARD: 'Forwarded', DECISION: 'Given a QC decision' };
    history = h.history.map((e: any) => ({ at: iso(e.createdAt)!, department: h.departmentName, action: actionLabel[e.action] || e.action, detail: [e.remarks, e.remainingAfter != null ? `Remaining on HOLD: ${e.remainingAfter} ${e.unit}` : null].filter(Boolean).join(' · '), quantity: e.quantity, unit: e.unit, reference: h.holdNumber, by: e.actorName }));
    const hold = await prisma.departmentHold.findUnique({ where: { id: rawId }, select: { sourceType: true, sourceId: true } });
    if (hold?.sourceType === 'WORK_ITEM') {
      const wh = await workItemHistory(hold.sourceId);
      history = [...wh.events, ...history];
      challans = wh.challans;
    } else if (h.challanId) {
      const c = await prisma.challan.findUnique({ where: { id: h.challanId }, select: challanBrief });
      if (c) challans.push(c);
    }
  }

  const program = record.programId
    ? await prisma.program.findUnique({
        where: { id: record.programId },
        select: { id: true, programNumber: true, programSerialNo: true, designNumber: true, designName: true, clientName: true, buyerName: true, orderNumber: true, mainStyle: true, subStyle: true, fabricName: true, fabricColor: true, targetQuantity: true, quantityMeasurement: true, deliveryDate: true, status: true },
      })
    : null;
  const seen = new Set<string>();
  const related = challans.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true))).map(challanRow);
  history.sort((a, b) => a.at.localeCompare(b.at));
  return { record, program, line, history, challans: related };
}
