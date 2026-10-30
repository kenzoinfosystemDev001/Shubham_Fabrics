// Dyeing QC (QC1) inspection quantities, per challan line. Each line keeps its own fabric, colour,
// unit and Production Sheet, so its pass / rework / reject outcome is recorded against that line and
// the challans QC1 issues carry one line per inspected line. A unit total is never spread across
// lines. Pure, no database or framework imports.
import { unitOf } from './challan-units.mjs';

const round = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
const num = (v) => (v === undefined || v === null || v === '' ? 0 : Number(v));

/** "Cotton — Red" style label of a challan line. */
export function lineLabel(item) {
  const fabric = item?.fabricCode || item?.itemDescription || 'Line';
  return item?.colour ? `${fabric} — ${item.colour}` : fabric;
}

/**
 * The inspected lines of a QC1 inspection.
 * - body.byLine: { [challanItemId]: { quantityInspected, quantityPassed, quantityFailed, quantityRework, quantityHold, observedColor? } }
 * - otherwise body.byUnit ({ MTR: {...}, PCS: {...} }) or the plain quantity fields (single-unit challans),
 *   accepted only when each of those units has exactly one line on the challan.
 * @param {ReadonlyArray<{ id: string, quantity: number, uom: string, fabricCode?: string | null, itemDescription?: string | null, colour?: string | null }>} items
 * @param {Record<string, any>} body
 * @returns {{ ok: true, lines: Array<{ item: any, unit: string, inspected: number, passed: number, failed: number, rework: number, hold: number, observedColor: string | null }> } | { ok: false, error: string }}
 */
export function qc1LineQuantities(items, body) {
  const list = Array.from(items || []);
  /** @type {Record<string, any>} */
  let raw;
  if (body?.byLine && typeof body.byLine === 'object' && !Array.isArray(body.byLine)) {
    raw = body.byLine;
  } else {
    const linesByUnit = new Map();
    for (const item of list) {
      const unit = unitOf(item.uom) || 'MTR';
      if (!linesByUnit.has(unit)) linesByUnit.set(unit, []);
      linesByUnit.get(unit).push(item);
    }
    const plain = { quantityInspected: body?.quantityInspected, quantityPassed: body?.quantityPassed, quantityFailed: body?.quantityFailed, quantityRework: body?.quantityRework, quantityHold: body?.quantityHold };
    const byUnit = body?.byUnit && typeof body.byUnit === 'object' ? body.byUnit : linesByUnit.size === 1 ? { [Array.from(linesByUnit.keys())[0]]: plain } : null;
    if (!byUnit) return { ok: false, error: 'This challan has lines in MTR and PCS. Enter the inspection quantities for each line.' };
    raw = {};
    for (const [rawUnit, q] of Object.entries(byUnit)) {
      const unit = unitOf(rawUnit);
      const lines = unit ? linesByUnit.get(unit) : null;
      if (!lines) return { ok: false, error: `This challan has no ${rawUnit} line to inspect.` };
      const entered = [q?.quantityInspected, q?.quantityPassed, q?.quantityFailed, q?.quantityRework, q?.quantityHold].some((v) => num(v) > 0);
      if (lines.length > 1 && entered) {
        return {
          ok: false,
          error: `This challan has ${lines.length} ${unit} lines (different fabrics, colours or Production Sheets). Enter the inspection quantities for each line; a total is never split across lines.`,
        };
      }
      raw[lines[0].id] = q;
    }
  }

  const byId = new Map(list.map((i) => [i.id, i]));
  const out = [];
  for (const [id, q] of Object.entries(raw)) {
    const item = byId.get(id);
    if (!item) return { ok: false, error: 'An inspected line is not on this challan. Refresh and try again.' };
    const unit = unitOf(item.uom) || 'MTR';
    const label = lineLabel(item);
    const row = {
      item,
      unit,
      inspected: num(q?.quantityInspected),
      passed: num(q?.quantityPassed),
      failed: num(q?.quantityFailed),
      rework: num(q?.quantityRework),
      hold: num(q?.quantityHold),
      observedColor: typeof q?.observedColor === 'string' && q.observedColor.trim() ? q.observedColor.trim().slice(0, 100) : null,
    };
    for (const [name, v] of [['Inspected', row.inspected], ['Passed', row.passed], ['Failed', row.failed], ['Rework', row.rework], ['Hold', row.hold]]) {
      if (!Number.isFinite(v) || v < 0) return { ok: false, error: `${label}: ${name} quantity cannot be negative.` };
    }
    const outcomes = round(row.passed + row.failed + row.rework + row.hold);
    if (row.inspected <= 0 && outcomes <= 0) continue; // this line is not part of this inspection
    if (row.inspected <= 0) return { ok: false, error: `${label}: Quantity Inspected must be greater than 0.` };
    if (row.inspected > Number(item.quantity) + 0.001) {
      return { ok: false, error: `${label}: Quantity Inspected (${row.inspected} ${unit}) cannot exceed the quantity received on this line (${round(item.quantity)} ${unit}).` };
    }
    if (outcomes > row.inspected + 0.001) {
      return {
        ok: false,
        error: `${label}: Passed (${row.passed}) + Failed (${row.failed}) + Rework (${row.rework}) + Hold (${row.hold}) = ${outcomes} ${unit}, which exceeds Quantity Inspected (${row.inspected} ${unit}).`,
      };
    }
    out.push(row);
  }
  if (out.length === 0) return { ok: false, error: 'Quantity Inspected must be a positive number greater than 0.' };
  // Challan line order, so outgoing challans list lines as the incoming one did.
  const order = new Map(list.map((i, index) => [i.id, index]));
  out.sort((a, b) => (order.get(a.item.id) ?? 0) - (order.get(b.item.id) ?? 0));
  return { ok: true, lines: out };
}

/** Per-unit sums of inspected lines: [{ unit, inspected, passed, failed, rework, hold }]. */
export function qc1UnitTotals(lines) {
  const byUnit = new Map();
  for (const l of lines || []) {
    const t = byUnit.get(l.unit) || { unit: l.unit, inspected: 0, passed: 0, failed: 0, rework: 0, hold: 0 };
    for (const k of ['inspected', 'passed', 'failed', 'rework', 'hold']) t[k] = round(t[k] + l[k]);
    byUnit.set(l.unit, t);
  }
  return Array.from(byUnit.values());
}
