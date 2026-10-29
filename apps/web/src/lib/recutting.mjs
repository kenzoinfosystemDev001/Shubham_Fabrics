// Recutting rules: a received line (DepartmentWorkItem) is allocated to garment categories and styles
// (WorkItemAllocation); what is actually cut, in its own unit, goes to Stitching. Pure, no database
// or framework imports. Quantity flow per line: received -> allocated (line unit) -> cut (cut unit,
// never converted automatically) -> transferred to Stitching.

import { receivedBasis } from './work-items.mjs';
import { headerUnitOf, unitOf } from './challan-units.mjs';

export const GARMENT_CATEGORIES = /** @type {const} */ (['TOP', 'BOTTOM', 'DUPATTA', 'OTHERS']);
export const CATEGORY_LABEL = { TOP: 'Top', BOTTOM: 'Bottom', DUPATTA: 'Dupatta', OTHERS: 'Others' };
export const CUT_UNITS = /** @type {const} */ (['MTR', 'PCS']);

export const ALLOCATION_STATUS_LABEL = {
  ALLOCATED: 'Allocated',
  CUT: 'Cut',
  PARTIALLY_TRANSFERRED: 'Partially Issued',
  TRANSFERRED: 'Issued to Stitching',
  CANCELLED: 'Cancelled',
};

const round = (n) => Math.round((Number(n) || 0) * 1000) / 1000;

/** Category name as shown, e.g. "Top" or "Others: Scarf". */
export function categoryName(allocation) {
  const base = CATEGORY_LABEL[allocation?.category] || String(allocation?.category || '');
  return allocation?.category === 'OTHERS' && allocation?.otherName ? `${base}: ${allocation.otherName}` : base;
}

export function isActiveAllocation(a) {
  return a && a.status !== 'CANCELLED';
}

/** Total allocated out of the line, in the line's unit. */
export function allocatedTotal(allocations) {
  return round((allocations || []).filter(isActiveAllocation).reduce((s, a) => s + (Number(a.allocatedQuantity) || 0), 0));
}

/** Received but not yet allocated. */
export function unallocated(item, allocations) {
  return round(Math.max(0, receivedBasis(item) - allocatedTotal(allocations)));
}

/** Cut but not yet sent to Stitching, in the allocation's cut unit. */
export function readyForStitching(allocation) {
  if (!isActiveAllocation(allocation)) return 0;
  return round(Math.max(0, (Number(allocation.cutQuantity) || 0) - (Number(allocation.transferredQuantity) || 0)));
}

export function allocationStatusOf(a) {
  if (a.status === 'CANCELLED') return 'CANCELLED';
  const cut = round(a.cutQuantity);
  const sent = round(a.transferredQuantity);
  if (sent > 0 && sent >= cut) return 'TRANSFERRED';
  if (sent > 0) return 'PARTIALLY_TRANSFERRED';
  return cut > 0 ? 'CUT' : 'ALLOCATED';
}

/**
 * Line status: pending until something is allocated, in progress while part is unallocated,
 * completed when fully allocated, closed once every allocation has gone to Stitching.
 */
export function recuttingItemStatus(item, allocations) {
  if (item.status === 'AWAITING_RECEIPT') return 'AWAITING_RECEIPT';
  const active = (allocations || []).filter(isActiveAllocation);
  const received = receivedBasis(item);
  const allocated = allocatedTotal(active);
  if (allocated >= received && active.every((a) => allocationStatusOf(a) === 'TRANSFERRED')) return 'TRANSFERRED';
  if (allocated <= 0) return 'RECEIVED';
  if (allocated < received) return 'IN_PROGRESS';
  return active.some((a) => round(a.transferredQuantity) > 0) ? 'PARTIALLY_TRANSFERRED' : 'COMPLETED';
}

const text = (v, max = 120) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/**
 * Validates new allocation rows for one received line.
 * Row: { category, otherName?, styleRef?, allocatedQuantity, cutUom, cutQuantity?, remarks? }
 * @returns {{ ok: true, rows: Array<{ category: string, otherName: string|null, styleRef: string|null, allocatedQuantity: number, cutUom: string, cutQuantity: number, remarks: string|null }>, total: number } | { ok: false, error: string }}
 */
export function validateAllocationRows(item, existing, rows) {
  if (item.status === 'AWAITING_RECEIPT') return { ok: false, error: 'Receive this fabric before allocating it.' };
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: 'Add at least one allocation row.' };
  const out = [];
  for (const [index, row] of rows.entries()) {
    const n = `Row ${index + 1}`;
    const category = String(row?.category || '').toUpperCase();
    if (!GARMENT_CATEGORIES.includes(/** @type {any} */ (category))) return { ok: false, error: `${n}: choose TOP, BOTTOM, DUPATTA or OTHERS.` };
    const otherName = text(row.otherName);
    if (category === 'OTHERS' && !otherName) return { ok: false, error: `${n}: enter the item / category name for OTHERS.` };
    const allocatedQuantity = Number(row.allocatedQuantity);
    if (!Number.isFinite(allocatedQuantity) || allocatedQuantity <= 0) return { ok: false, error: `${n}: allocated quantity must be greater than zero.` };
    const cutUom = String(row.cutUom || '').toUpperCase();
    if (!CUT_UNITS.includes(/** @type {any} */ (cutUom))) return { ok: false, error: `${n}: choose the unit (MTR or PCS) for the cut quantity.` };
    const rawCut = row.cutQuantity === undefined || row.cutQuantity === null || row.cutQuantity === '' ? 0 : Number(row.cutQuantity);
    if (!Number.isFinite(rawCut) || rawCut < 0) return { ok: false, error: `${n}: cut quantity must be zero or more.` };
    if (cutUom === item.uom && round(rawCut) > round(allocatedQuantity)) {
      return { ok: false, error: `${n}: cut quantity cannot exceed the allocated ${round(allocatedQuantity)} ${item.uom}.` };
    }
    out.push({ category, otherName: category === 'OTHERS' ? otherName : null, styleRef: text(row.styleRef), allocatedQuantity: round(allocatedQuantity), cutUom, cutQuantity: round(rawCut), remarks: text(row.remarks, 300) });
  }
  const total = round(out.reduce((s, r) => s + r.allocatedQuantity, 0));
  const open = unallocated(item, existing);
  if (total > open) return { ok: false, error: `These rows allocate ${total} ${item.uom}, but only ${open} ${item.uom} is unallocated.` };
  return { ok: true, rows: out, total };
}

/**
 * Validates recording the cut quantity of an allocation (total, in its cut unit).
 * @returns {{ ok: true, cutQuantity: number } | { ok: false, error: string }}
 */
export function validateCut(allocation, cutQuantity) {
  if (allocation.status === 'CANCELLED') return { ok: false, error: 'This allocation was cancelled.' };
  const cut = Number(cutQuantity);
  if (!Number.isFinite(cut) || cut < 0) return { ok: false, error: 'Cut quantity must be zero or more.' };
  const sent = round(allocation.transferredQuantity);
  if (round(cut) < sent) return { ok: false, error: `${sent} ${allocation.cutUom} has already gone to Stitching; the cut quantity cannot be lower.` };
  if (allocation.cutUom === allocation.allocatedUom && round(cut) > round(allocation.allocatedQuantity)) {
    return { ok: false, error: `Cut quantity cannot exceed the allocated ${round(allocation.allocatedQuantity)} ${allocation.allocatedUom}.` };
  }
  return { ok: true, cutQuantity: round(cut) };
}

/**
 * An allocation can be cancelled (its quantity returns to the line) only before anything was issued.
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validateCancel(allocation, reason) {
  if (allocation.status === 'CANCELLED') return { ok: false, error: 'This allocation is already cancelled.' };
  if (round(allocation.transferredQuantity) > 0) return { ok: false, error: 'Part of this allocation has gone to Stitching; it can no longer be cancelled.' };
  if (!text(reason, 300)) return { ok: false, error: 'Enter the reason for cancelling.' };
  return { ok: true };
}

/**
 * How much of an allocation's cut balance (in its cut unit) a Stitching challan line uses. A line in the cut
 * unit uses its own quantity; a line sent in the other unit (e.g. cut in PCS, sent as MTR) cannot be converted,
 * so it carries everything of the allocation still to send and its quantity is what Stitching receives.
 * @returns {{ unit: string, consumes: number }}
 */
export function stitchingLineUse(allocation, line) {
  const unit = unitOf(line?.uom) || allocation.cutUom;
  return { unit, consumes: unit === allocation.cutUom ? round(Number(line?.quantity)) : readyForStitching(allocation) };
}

/**
 * Validates Stitching challan lines against their allocations: one Production Sheet, each line in its
 * own unit (the allocation's cut unit unless MTR / PCS is chosen, see stitchingLineUse), only cut quantity
 * not yet sent.
 * @param {Array<{ allocationId: string, quantity: unknown, uom?: unknown }>} lines
 * @param {Map<string, any>} allocationsById allocation with workItem { programId, departmentCode }
 * @returns {{ ok: true, unit: string, programId: string } | { ok: false, error: string }}
 */
export function validateStitchingLines(lines, allocationsById) {
  if (!Array.isArray(lines) || lines.length === 0) return { ok: false, error: 'Add at least one item.' };
  const seen = new Set();
  const units = [];
  let programId = null;
  for (const [index, line] of lines.entries()) {
    const n = index + 1;
    const a = allocationsById.get(line.allocationId);
    if (!a || a.workItem?.departmentCode !== 'RECUTTING') return { ok: false, error: `Line ${n}: allocation not found.` };
    if (seen.has(line.allocationId)) return { ok: false, error: `Line ${n}: the same allocation is listed twice.` };
    seen.add(line.allocationId);
    if (a.status === 'CANCELLED') return { ok: false, error: `Line ${n}: ${a.allocationNumber} was cancelled.` };
    if (programId && a.workItem.programId !== programId) return { ok: false, error: 'All items on one challan must belong to the same Production Sheet.' };
    programId = a.workItem.programId;
    if (line.uom !== undefined && line.uom !== null && line.uom !== '' && !CUT_UNITS.includes(/** @type {any} */ (unitOf(line.uom)))) {
      return { ok: false, error: `Line ${n}: choose MTR or PCS for the Size.` };
    }
    const { unit } = stitchingLineUse(a, line);
    // Each line keeps its own unit; meters and pieces are never added together.
    units.push(unit);
    const quantity = Number(line.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, error: `Line ${n}: enter a quantity greater than zero.` };
    const ready = readyForStitching(a);
    if (ready <= 0) return { ok: false, error: `Line ${n}: nothing of ${a.allocationNumber} is cut and not yet issued.` };
    if (unit === a.cutUom && round(quantity) > ready) return { ok: false, error: `Line ${n}: only ${ready} ${a.cutUom} of ${a.allocationNumber} is cut and not yet issued.` };
  }
  return { ok: true, unit: /** @type {string} */ (headerUnitOf(units)), programId: /** @type {string} */ (programId) };
}
