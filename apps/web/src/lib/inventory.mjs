// Inventory Department rules: finished garments received from Final QC, held as stock and packed
// (Packing is a module of Inventory, not a department). Pure, no database or framework imports.
//
// A record is one received challan line (DepartmentWorkItem, department INVENTORY), in whole pieces:
//   received  = receivedQuantity
//   sent      = takenQuantity       pieces sent for packing, net of pieces returned unpacked
//   packed    = processedQuantity
//   available = received - sent     ready to send for packing
//   inPacking = sent - packed       sent and not yet packed
//   remaining = received - packed   still to be packed
// A PackingAllocation is one "Send for Packing": quantity, packedQuantity, returnedQuantity.
//
// Every change is posted to StockLedgerEntry (department INVENTORY). The available balance is the
// sum of RECEIPT, SENT_FOR_PACKING (negative) and RETURNED_FROM_PACKING; packed is the sum of PACKED.

import { CATEGORY_LABEL } from './recutting.mjs';

export const INVENTORY_UNIT = 'PCS';
export const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

export const LEDGER = /** @type {const} */ ({
  RECEIPT: 'RECEIPT',
  SENT_FOR_PACKING: 'SENT_FOR_PACKING',
  PACKING_STARTED: 'PACKING_STARTED',
  PACKED: 'PACKED',
  RETURNED_FROM_PACKING: 'RETURNED_FROM_PACKING',
  IMAGE_UPLOADED: 'IMAGE_UPLOADED',
});

export const LEDGER_LABEL = {
  RECEIPT: 'Garments received',
  SENT_FOR_PACKING: 'Sent for packing',
  PACKING_STARTED: 'Packing started',
  PACKED: 'Packed',
  RETURNED_FROM_PACKING: 'Returned from packing',
  IMAGE_UPLOADED: 'Garment image uploaded',
};

const n = (v) => Number(v) || 0;

/** "Top · Kurta · Red": what the garment is, never its fabric. */
export function garmentLabel(item) {
  const category = item?.garmentCategory ? CATEGORY_LABEL[item.garmentCategory] || item.garmentCategory : null;
  return [category, item?.styleRef, item?.colour].filter(Boolean).join(' · ') || item?.itemNumber || 'Garment';
}

/**
 * A positive whole number of pieces, or an error naming the field.
 * @returns {{ ok: true, value: number } | { ok: false, error: string }}
 */
export function wholePieces(value, label, { allowZero = false } = {}) {
  if (value === undefined || value === null || String(value).trim() === '') return { ok: false, error: `Enter the ${label}.` };
  const q = Number(value);
  if (!Number.isInteger(q) || q < 0) return { ok: false, error: `${label[0].toUpperCase()}${label.slice(1)} must be a whole number of pieces.` };
  if (q === 0 && !allowZero) return { ok: false, error: `${label[0].toUpperCase()}${label.slice(1)} must be greater than zero.` };
  return { ok: true, value: q };
}

/** Quantities of one record (see the header). Awaiting receipt holds nothing yet. */
export function stockOf(item) {
  const received = item?.status === 'AWAITING_RECEIPT' ? 0 : n(item?.receivedQuantity ?? item?.expectedQuantity);
  const sent = n(item?.takenQuantity);
  const packed = n(item?.processedQuantity);
  return {
    received,
    sent,
    packed,
    available: Math.max(0, received - sent),
    inPacking: Math.max(0, sent - packed),
    remaining: Math.max(0, received - packed),
  };
}

export const INVENTORY_STATUS_LABEL = {
  AWAITING_RECEIPT: 'Awaiting Receipt',
  NOTHING_RECEIVED: 'Nothing Received',
  READY: 'Ready for Packing',
  SENT: 'Sent for Packing',
  PARTIAL: 'Partially Packed',
  PACKED: 'Packing Completed',
};

/** Where a record stands; each status follows from recorded quantities only. */
export function inventoryStatus(item) {
  if (item?.status === 'AWAITING_RECEIPT') return 'AWAITING_RECEIPT';
  const s = stockOf(item);
  if (s.received <= 0) return 'NOTHING_RECEIVED';
  if (s.packed >= s.received) return 'PACKED';
  if (s.packed > 0) return 'PARTIAL';
  if (s.sent > 0) return 'SENT';
  return 'READY';
}

/** DepartmentWorkItem.status for a received record. */
export function workStatusOf(item) {
  const s = stockOf(item);
  if (s.received > 0 && s.packed >= s.received) return 'COMPLETED';
  return s.sent > 0 || s.packed > 0 ? 'IN_PROGRESS' : 'RECEIVED';
}

export const ALLOCATION_STATUS_LABEL = {
  SENT_FOR_PACKING: 'Sent for Packing',
  PACKING_IN_PROGRESS: 'Packing In Progress',
  PARTIALLY_PACKED: 'Partially Packed',
  PACKING_COMPLETED: 'Packing Completed',
  CANCELLED: 'Returned Unpacked',
};

/** Pieces of an allocation neither packed nor returned. */
export function allocationOpen(a) {
  return Math.max(0, n(a?.quantity) - n(a?.returnedQuantity) - n(a?.packedQuantity));
}

/** Completed only when every piece sent was packed or returned, with something packed. */
export function allocationStatus(a) {
  const net = n(a?.quantity) - n(a?.returnedQuantity);
  const packed = n(a?.packedQuantity);
  if (net <= 0) return 'CANCELLED';
  if (packed >= net) return 'PACKING_COMPLETED';
  if (packed > 0) return 'PARTIALLY_PACKED';
  return a?.startedAt ? 'PACKING_IN_PROGRESS' : 'SENT_FOR_PACKING';
}

/**
 * Send for Packing: whole pieces, more than zero, no more than the record's available quantity,
 * and the record must be in pieces (Inventory never holds meters).
 * @returns {{ ok: true, quantity: number, priority: string, packingDate: Date } | { ok: false, error: string }}
 */
export function validateSendForPacking(item, input) {
  if (!item || item.status === 'AWAITING_RECEIPT') return { ok: false, error: 'Receive these garments before sending them for packing.' };
  if (item.uom !== INVENTORY_UNIT) return { ok: false, error: `${garmentLabel(item)} is recorded in ${item.uom}; only pieces can be packed.` };
  const q = wholePieces(input?.quantity, 'quantity to send for packing');
  if (!q.ok) return q;
  const { available } = stockOf(item);
  if (q.value > available) return { ok: false, error: `Only ${available} PCS of ${garmentLabel(item)} is available for packing.` };
  const priority = input?.priority ? String(input.priority).toUpperCase() : 'NORMAL';
  if (!PRIORITIES.includes(priority)) return { ok: false, error: 'Choose a valid priority.' };
  if (!input?.packingDate) return { ok: false, error: 'Enter the packing date.' };
  const packingDate = new Date(String(input.packingDate));
  if (Number.isNaN(packingDate.getTime())) return { ok: false, error: 'Packing date is not a valid date.' };
  return { ok: true, quantity: q.value, priority, packingDate };
}

/**
 * Record packed pieces: never more than the allocation still has open.
 * @returns {{ ok: true, quantity: number } | { ok: false, error: string }}
 */
export function validatePacked(allocation, input) {
  if (!allocation) return { ok: false, error: 'Packing reference not found.' };
  const q = wholePieces(input?.quantity, 'packed quantity');
  if (!q.ok) return q;
  const open = allocationOpen(allocation);
  if (q.value > open) return { ok: false, error: `Only ${open} PCS of ${allocation.packingNumber} is still to be packed.` };
  return { ok: true, quantity: q.value };
}

/**
 * Return unpacked pieces to inventory (with a reason): never more than the allocation still has open.
 * @returns {{ ok: true, quantity: number } | { ok: false, error: string }}
 */
export function validateReturn(allocation, input) {
  if (!allocation) return { ok: false, error: 'Packing reference not found.' };
  const q = wholePieces(input?.quantity, 'quantity to return');
  if (!q.ok) return q;
  const open = allocationOpen(allocation);
  if (q.value > open) return { ok: false, error: `Only ${open} PCS of ${allocation.packingNumber} is unpacked and can be returned.` };
  if (!String(input?.remarks || '').trim()) return { ok: false, error: 'Enter the reason for returning these garments.' };
  return { ok: true, quantity: q.value };
}

/** Balances rebuilt from ledger entries; they must equal the record's own quantities. */
export function balancesFromLedger(entries) {
  let available = 0;
  let packed = 0;
  for (const e of entries || []) {
    if (e.entryType === LEDGER.RECEIPT || e.entryType === LEDGER.SENT_FOR_PACKING || e.entryType === LEDGER.RETURNED_FROM_PACKING) available += n(e.quantity);
    if (e.entryType === LEDGER.PACKED) packed += n(e.quantity);
  }
  return { available, packed };
}
