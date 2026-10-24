// Dyeing instructions carried from Fabric Store challan lines to Dyeing. Pure, no database or
// framework imports, so scripts/test-production-fixes.mjs can run them with node:test.
//
// Every challan line keeps its own current colour/shade, required dyeing colour, quantity and
// unit. A required colour is only ever what the Fabric Store entered: lines recorded before the
// field existed show "not specified" and nothing is guessed from the shade or the program.

function text(value) {
  const trimmed = String(value ?? '').trim();
  return trimmed || null;
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

/**
 * @param {{ id?: string, challanNumber?: string, fabricUnit?: string | null, items?: any[], program?: any, programId?: string } | null | undefined} challan
 * @returns {Array<{
 *   itemId: string | null, lineNo: number, fabric: string, fabricType: string | null,
 *   currentColour: string | null, currentShade: string | null, requiredColour: string | null,
 *   quantity: number, unit: string, requiredQuantity: number | null,
 *   challanId: string | null, challanNumber: string | null, programId: string | null, programRef: string | null
 * }>}
 */
export function mapChallanItemsToDyeingLines(challan) {
  if (!challan) return [];
  const items = Array.isArray(challan.items) ? challan.items : [];
  const program = challan.program || null;
  const programRef = text(program?.programSerialNo) || text(program?.programNumber);
  return items.map((item, index) => ({
    itemId: item.id ?? null,
    lineNo: index + 1,
    fabric: text(item.fabricCode) || text(item.itemDescription) || text(program?.fabricName) || 'Fabric',
    fabricType: text(program?.fabricType),
    currentColour: text(item.colour),
    currentShade: text(item.shade),
    requiredColour: text(item.requiredColour),
    quantity: Number(item.quantity) || 0,
    unit: text(item.uom) || text(challan.fabricUnit) || 'MTR',
    requiredQuantity: positiveNumber(item.requiredQuantity),
    challanId: challan.id ?? null,
    challanNumber: text(challan.challanNumber),
    programId: program?.id ?? challan.programId ?? null,
    programRef,
  }));
}

/** Distinct required colours in line order, or [] when none was entered. */
export function requiredColours(lines) {
  const seen = new Map();
  for (const line of lines) {
    if (!line.requiredColour) continue;
    const key = line.requiredColour.toLowerCase();
    if (!seen.has(key)) seen.set(key, line.requiredColour);
  }
  return Array.from(seen.values());
}

/**
 * DyeingOrder.targetColor for an inbound challan: the required colours joined with " / ".
 * Challans without required colours (older records, QC1 rework returns) keep `legacyTarget`,
 * which is the value the order would have had before per-line instructions existed.
 */
export function summarizeTargetColour(lines, legacyTarget) {
  const colours = requiredColours(lines);
  return colours.length > 0 ? colours.join(' / ') : legacyTarget;
}

/** Totals per unit across lines; meters and pieces are reported separately. */
export function dyeingLineTotals(lines) {
  const totals = {};
  for (const line of lines) {
    totals[line.unit] = Math.round(((totals[line.unit] || 0) + line.quantity) * 1000) / 1000;
  }
  return totals;
}

/**
 * Challan item fields for a Store -> Dyeing line as typed in the issue form: the current colour
 * stays in `colour`/`shade`; the colour to achieve goes to `requiredColour` only.
 */
export function storeDyeingItemFields(input) {
  return {
    colour: text(input.colour ?? input.color),
    shade: text(input.shade),
    requiredColour: text(input.requiredColour ?? input.requiredDyeColor),
    requiredQuantity: positiveNumber(input.requiredQuantity ?? input.requiredDyeQuantity),
  };
}
