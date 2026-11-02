// Production Sheets on challans. A challan is a transfer document: it may carry lines of several
// Production Sheets, and every line keeps its own sheet (and the incoming line it was issued from)
// through every department. Totals are per unit, from the lines. Pure, no database or framework imports.
import { addTotals, totalsByUnit } from './challan-units.mjs';

/** Production Sheet fields a challan line shows (Prisma select). */
export const SHEET_FIELDS = { id: true, programNumber: true, programSerialNo: true, designNumber: true };

/** Challan lines in order, each with its own Production Sheet (Prisma include of Challan.items). */
export const ITEMS_WITH_SHEET = { orderBy: { createdAt: /** @type {const} */ ('asc') }, include: { program: { select: SHEET_FIELDS } } };

/** As ITEMS_WITH_SHEET, plus the incoming line (and its challan) each line was issued from. */
export const ITEMS_WITH_SOURCE = {
  orderBy: ITEMS_WITH_SHEET.orderBy,
  include: {
    program: { select: SHEET_FIELDS },
    sourceChallanItem: {
      select: { id: true, quantity: true, uom: true, challan: { select: { id: true, challanNumber: true, fromDepartment: true, toDepartment: true } } },
    },
  },
};

/** Selection key for lines recorded before incoming challans were linked (older Dyeing orders). */
export const NO_INCOMING_CHALLAN = 'NO_INCOMING_CHALLAN';

/** The sheet a line belongs to: its own, or (lines recorded before per-line sheets) its challan's. */
export function lineSheetId(item, challan) {
  return item?.programId || challan?.programId || null;
}

/** "PS-12" style reference of a Production Sheet. */
export function sheetLabel(program) {
  return program?.programSerialNo || program?.programNumber || '—';
}

/** Distinct values in first-seen order (null and empty skipped). */
export function distinct(values) {
  return Array.from(new Set(Array.from(values || []).filter(Boolean)));
}

/**
 * The lines of a challan grouped by Production Sheet, in line order, with per-unit totals for each
 * sheet and for the whole challan. A sheet's details come from the line (item.program) or, for the
 * challan's own sheet, from challan.program.
 * @param {{ programId?: string | null, program?: any, fabricUnit?: unknown, items?: any[] } | null | undefined} challan
 * @returns {{ sheets: Array<{ programId: string | null, program: any, lines: any[], totals: Record<string, number> }>, totals: Record<string, number>, multiSheet: boolean }}
 */
export function sheetBreakdown(challan) {
  const groups = new Map();
  for (const item of challan?.items || []) {
    const programId = lineSheetId(item, challan);
    let group = groups.get(programId);
    if (!group) {
      const program = item?.program || (programId && programId === challan?.programId ? challan?.program : null) || null;
      group = { programId, program, lines: [] };
      groups.set(programId, group);
    }
    if (!group.program && item?.program) group.program = item.program;
    group.lines.push(item);
  }
  const sheets = Array.from(groups.values()).map((g) => ({ ...g, totals: totalsByUnit(g.lines, challan?.fabricUnit) }));
  const totals = sheets.reduce((acc, s) => addTotals(acc, s.totals), {});
  return { sheets, totals, multiSheet: sheets.length > 1 };
}

/** "PS-1, PS-2": the Production Sheets of a challan's lines, in line order. */
export function challanSheetRefs(challan) {
  const refs = sheetBreakdown(challan).sheets.map((s) => sheetLabel(s.program));
  return refs.length ? refs.join(', ') : sheetLabel(challan?.program);
}

/**
 * Eligible lines (Dyeing orders or work items) grouped by the incoming challan they arrived on: the
 * choices of an "Incoming challan" picker. Each group lists its sheets and what is available per unit.
 * Lines without an incoming challan are grouped under NO_INCOMING_CHALLAN.
 * @template T
 * @param {ReadonlyArray<T & { inboundChallanId?: string | null, inboundChallan?: any, programId?: string | null, program?: any, uom?: string }>} records
 * @param {(record: T) => number} available
 */
export function incomingChallanOptions(records, available) {
  const groups = new Map();
  for (const record of records || []) {
    const id = record.inboundChallanId || NO_INCOMING_CHALLAN;
    let group = groups.get(id);
    if (!group) {
      group = { id, challan: record.inboundChallan || null, sheets: new Map(), lines: [], available: {} };
      groups.set(id, group);
    }
    group.lines.push(record);
    if (record.programId && !group.sheets.has(record.programId)) group.sheets.set(record.programId, record.program || { id: record.programId });
    addTotals(group.available, totalsByUnit([{ quantity: available(record), uom: record.uom }]));
  }
  const when = (g) => new Date(g.challan?.issuedDate || g.challan?.createdAt || 0).getTime();
  return Array.from(groups.values())
    .map((g) => ({ ...g, sheets: Array.from(g.sheets.values()) }))
    .sort((a, b) => when(b) - when(a));
}

/**
 * Checks the incoming challans an outgoing challan is issued from: at least one must be selected, and
 * every line must come from one of them (a line of another challan is refused, never re-assigned).
 * @param {unknown} sourceChallanIds what the user selected
 * @param {ReadonlyArray<{ label: string, inboundChallanId?: string | null }>} lines
 * @returns {{ ok: true, ids: string[] } | { ok: false, error: string }}
 */
export function checkSourceSelection(sourceChallanIds, lines) {
  const ids = distinct(Array.isArray(sourceChallanIds) ? sourceChallanIds.map((v) => String(v ?? '').trim()) : []);
  if (ids.length === 0) return { ok: false, error: 'Select the incoming challan this challan is issued from.' };
  const allowed = new Set(ids);
  for (const [index, line] of (lines || []).entries()) {
    const from = line.inboundChallanId || NO_INCOMING_CHALLAN;
    if (!allowed.has(from)) {
      return { ok: false, error: `Line ${index + 1}: ${line.label} does not belong to the selected incoming challan. Refresh and select again.` };
    }
  }
  return { ok: true, ids };
}
