// Per-unit quantities for challans. Every challan line keeps its own unit (MTR or PCS); meters and
// pieces are never added together or converted. Pure, no database or framework imports.
import { normalizeStockUnit } from './fabric-stock-rules.mjs';

export const QUANTITY_UNITS = /** @type {const} */ (['MTR', 'PCS']);

/** Header unit of a challan whose lines carry more than one unit; its header quantities stay empty. */
export const MIXED_UNIT = 'MIXED';

/** "MTR" / "PCS" for any spelling (m, meters, pieces ...); null when it is neither. */
export function unitOf(raw) {
  return normalizeStockUnit(raw);
}

/** The one unit all these lines share, MIXED when they differ, null when there are none. */
export function headerUnitOf(units) {
  const set = new Set(Array.from(units || []).map((u) => unitOf(u) || String(u || '').toUpperCase()).filter(Boolean));
  if (set.size === 0) return null;
  return set.size === 1 ? Array.from(set)[0] : MIXED_UNIT;
}

const round = (n) => Math.round((Number(n) || 0) * 1000) / 1000;

/**
 * { MTR: x, PCS: y } over challan lines, each in its own unit. A line without a unit uses fallbackUnit
 * (the challan header unit) unless that is MIXED.
 * @param {ReadonlyArray<{ quantity?: unknown, uom?: unknown }>} items
 * @param {unknown} [fallbackUnit]
 * @param {(item: any) => unknown} [quantityOf]
 * @returns {Record<string, number>}
 */
export function totalsByUnit(items, fallbackUnit, quantityOf = (i) => i?.quantity) {
  const fallback = unitOf(fallbackUnit);
  const totals = {};
  for (const item of items || []) {
    const unit = unitOf(item?.uom) || fallback || 'MTR';
    totals[unit] = round((totals[unit] || 0) + (Number(quantityOf(item)) || 0));
  }
  return totals;
}

/**
 * Per-unit totals of a whole challan: its lines when it has any, otherwise its header quantity.
 * @param {{ items?: any[], fabricUnit?: unknown, fabricOut?: unknown, fabricIn?: unknown } | null | undefined} challan
 */
export function challanTotalsByUnit(challan) {
  if (!challan) return {};
  if (Array.isArray(challan.items) && challan.items.length > 0) return totalsByUnit(challan.items, challan.fabricUnit);
  const unit = unitOf(challan.fabricUnit);
  const qty = Number(challan.fabricOut ?? challan.fabricIn) || 0;
  return unit && qty > 0 ? { [unit]: round(qty) } : {};
}

/** Adds per-unit totals into acc (same units only). */
export function addTotals(acc, totals) {
  for (const [unit, qty] of Object.entries(totals || {})) acc[unit] = round((acc[unit] || 0) + (Number(qty) || 0));
  return acc;
}

/** "30 MTR · 10 PCS"; meters keep two decimals, pieces none. Empty totals show `empty`. */
export function formatTotals(totals, empty = '0') {
  const parts = QUANTITY_UNITS.filter((u) => Number(totals?.[u]) > 0)
    .concat(Object.keys(totals || {}).filter((u) => !QUANTITY_UNITS.includes(/** @type {any} */ (u)) && Number(totals[u]) > 0))
    .map((u) => `${Number(totals[u]).toLocaleString('en-IN', { maximumFractionDigits: u === 'PCS' ? 0 : 2 })} ${u}`);
  return parts.length ? parts.join(' · ') : empty;
}
