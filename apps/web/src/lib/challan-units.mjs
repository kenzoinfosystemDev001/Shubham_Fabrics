// Per-unit quantities for challans. Every challan line keeps its own unit (MTR or PCS); meters and
// pieces are never added together or converted. Pure, no database or framework imports.
import { normalizeStockUnit } from './fabric-stock-rules.mjs';

export const QUANTITY_UNITS = /** @type {const} */ (['MTR', 'PCS']);

/** Header unit of a challan whose lines carry more than one unit; its header quantities stay empty. */
export const MIXED_UNIT = 'MIXED';

// Challans from Programming to Recutting list their Items as Size | Average | Unit | Remarks, each of Size,
// Average and Unit a quantity with its own MTR / PCS; challans issued after Recutting (Stitching onward) keep
// Size | Unit | Average | Remarks, where Unit is the unit of the Size.
const AFTER_RECUTTING = new Set(['STITCHING', 'FINISHING', 'STEAM_PRESS', 'FINAL_CHECK', 'INVENTORY', 'PACKING']);

/** Whether a challan from this department uses the Programming-to-Recutting Items layout. */
export function isProgrammingToRecutting(fromDepartment) {
  return !AFTER_RECUTTING.has(String(fromDepartment || '').toUpperCase());
}

const pairText = (value, unit) =>
  value === undefined || value === null || String(value) === '' ? '—' : `${value}${unit ? ` ${unit}` : ''}`;

/** A challan line's Average with its own unit, e.g. "2.5 MTR"; "—" when none was entered. */
export function averageText(item) {
  return pairText(item?.average, item?.averageUnit);
}

/** A challan line's Unit quantity with its own unit, e.g. "40 PCS"; "—" when none was entered. */
export function unitQuantityText(item) {
  return pairText(item?.unitQuantity, item?.unitQuantityUom);
}

/**
 * An optional quantity entered with its own MTR / PCS (a line's Average or Unit quantity). Blank gives
 * { value: null, unit: null }; an entered value needs a unit. Never converted to the line's own unit.
 * @returns {{ value: number | null, unit: 'MTR' | 'PCS' | null } | { error: string }}
 */
export function quantityPairOf(rawValue, rawUnit, label) {
  const raw = rawValue === undefined || rawValue === null ? '' : String(rawValue).trim();
  if (raw === '') return { value: null, unit: null };
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return { error: `${label} must be 0 or more.` };
  const unit = unitOf(rawUnit);
  if (!unit) return { error: `choose MTR or PCS for the ${label}.` };
  return { value, unit };
}

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

/**
 * What a challan line carries in meters and in pieces, for receiving screens: its quantity (the figure stock moves
 * by) in its own unit, and its Unit quantity when that is in the other unit. A unit the line does not carry is
 * null. The two are never added or converted.
 * @returns {{ MTR: number | null, PCS: number | null }}
 */
export function lineQuantitiesByUnit(line) {
  const out = /** @type {{ MTR: number | null, PCS: number | null }} */ ({ MTR: null, PCS: null });
  const unit = unitOf(line?.uom);
  if (unit === 'MTR' || unit === 'PCS') out[unit] = round(Number(line?.quantity) || 0);
  const other = unitOf(line?.unitQuantityUom);
  if ((other === 'MTR' || other === 'PCS') && out[other] === null && line?.unitQuantity !== null && line?.unitQuantity !== undefined) {
    out[other] = round(Number(line.unitQuantity) || 0);
  }
  return out;
}

/** The unit of a line's second quantity (its Unit quantity in the other unit), or null when it has none. */
export function secondUnitOf(line) {
  const unit = unitOf(line?.uom);
  const other = unitOf(line?.unitQuantityUom);
  return other && other !== unit && (other === 'MTR' || other === 'PCS') && line?.unitQuantity !== null && line?.unitQuantity !== undefined ? other : null;
}

/** Total MTR and total PCS over lines, each added on its own (see lineQuantitiesByUnit). */
export function linesTotalsMtrPcs(lines) {
  const totals = { MTR: 0, PCS: 0 };
  for (const line of lines || []) {
    const q = lineQuantitiesByUnit(line);
    totals.MTR = round(totals.MTR + (q.MTR || 0));
    totals.PCS = round(totals.PCS + (q.PCS || 0));
  }
  return totals;
}
