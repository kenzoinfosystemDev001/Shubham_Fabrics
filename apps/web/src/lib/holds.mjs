// Rules for DepartmentHold: quantity a department keeps back from a line it received. Pure, no database or
// framework imports (lib/holds-server.ts loads the lines). Quantities stay in the line's own unit (MTR or PCS);
// meters and pieces are never added together or converted.
//
// A line's figures: received, forwarded (left on challans, allocations or packing) and written off (defective,
// shrinkage). Outstanding = received - forwarded - written off is what the department still has; a HOLD keeps
// part or all of it back. Remaining on HOLD = held - released, never more than the outstanding quantity, so
// forwarding 20 of a 50 HOLD leaves 30 without the HOLD record deducting anything itself.

/** Hold reasons offered in the dropdown; OTHER needs the reason typed in. */
export const HOLD_REASONS = /** @type {const} */ ([
  { code: 'PRODUCTION_PENDING', label: 'Production Pending' },
  { code: 'QUALITY_ISSUE', label: 'Quality Issue' },
  { code: 'FABRIC_DEFECT', label: 'Fabric Defect' },
  { code: 'COLOUR_SHADE_ISSUE', label: 'Colour/Shade Issue' },
  { code: 'MEASUREMENT_ISSUE', label: 'Measurement Issue' },
  { code: 'MATERIAL_SHORTAGE', label: 'Material Shortage' },
  { code: 'AWAITING_APPROVAL', label: 'Awaiting Approval' },
  { code: 'MACHINE_PROCESS_ISSUE', label: 'Machine/Process Issue' },
  { code: 'OTHER', label: 'Other' },
]);

/** Statuses of a HOLD that still keeps quantity back. */
export const ACTIVE_HOLD_STATUSES = ['ON_HOLD', 'PARTIALLY_RELEASED', 'PARTIALLY_FORWARDED'];

export const HOLD_STATUS_LABEL = {
  ON_HOLD: 'On Hold',
  PARTIALLY_RELEASED: 'Partially Released',
  PARTIALLY_FORWARDED: 'Partially Forwarded',
  RELEASED: 'Released',
  FORWARDED: 'Forwarded',
  CLEARED: 'Cleared',
};

export const HOLD_EVENT_LABEL = { HOLD: 'Placed on HOLD', RELEASE: 'Released', CLOSE: 'Closed', FORWARD: 'Forwarded' };

const round = (n) => Math.round((Number(n) || 0) * 1000) / 1000;

export function isActiveHold(hold) {
  return ACTIVE_HOLD_STATUSES.includes(String(hold?.status || ''));
}

/** "Quality Issue", or the typed reason for Other ("Other: buyer asked to wait"). */
export function holdReasonText(hold) {
  const found = HOLD_REASONS.find((r) => r.code === hold?.reason);
  if (hold?.reason === 'OTHER') return hold?.reasonOther ? `Other: ${hold.reasonOther}` : 'Other';
  return found ? found.label : String(hold?.reason || '—');
}

/** What the department still has of the line: received - forwarded - written off. */
export function outstandingOf(line) {
  return round(Math.max(0, round(line?.received) - round(line?.forwarded) - round(line?.writtenOff)));
}

/** Forwarded from the line since the HOLD was placed. */
export function forwardedSinceHold(hold, line) {
  return round(Math.max(0, round(line?.forwarded) - round(hold?.forwardedAtHold)));
}

/** Still on HOLD: held - released, capped by what the line still has. Closed HOLDs keep nothing back. */
export function remainingOnHold(hold, line) {
  if (!isActiveHold(hold)) return 0;
  const held = round(Math.max(0, round(hold.holdQuantity) - round(hold.releasedQuantity)));
  return round(Math.min(held, outstandingOf(line)));
}

/**
 * Status of an active HOLD from its quantities. `remaining` is remainingOnHold; a HOLD with nothing left
 * closes as FORWARDED when quantity was forwarded since it was placed, otherwise CLEARED (written off).
 */
export function activeHoldStatus(hold, line, remaining) {
  const forwarded = forwardedSinceHold(hold, line) > 0;
  if (remaining <= 0) return forwarded ? 'FORWARDED' : 'CLEARED';
  if (round(hold.releasedQuantity) > 0) return 'PARTIALLY_RELEASED';
  return round(remaining) < round(hold.holdQuantity) ? 'PARTIALLY_FORWARDED' : 'ON_HOLD';
}

const text = (v, max = 500) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/**
 * Validates placing a HOLD on a line: the line's identifiers, a reason (typed when Other), a quantity above
 * zero and no more than the line still has, in the line's own unit.
 * @param {any} line the line as loaded (lib/holds-server.ts)
 * @param {{ reason?: unknown, reasonOther?: unknown, remarks?: unknown, quantity?: unknown, unit?: unknown }} input
 * @returns {{ ok: true, reason: string, reasonOther: string | null, remarks: string | null, quantity: number } | { ok: false, error: string }}
 */
export function validateHold(line, input) {
  if (!line) return { ok: false, error: 'That line was not found in this department.' };
  if (!line.programId || !line.serialNumber || !line.designNumber) {
    return { ok: false, error: 'This line has no Production Sheet, Design Number or Serial Number; it cannot be placed on HOLD.' };
  }
  if (line.challanRequired && !line.challanNumber) return { ok: false, error: 'This line has no challan reference; it cannot be placed on HOLD.' };
  if (line.unit !== 'MTR' && line.unit !== 'PCS') return { ok: false, error: 'Only MTR or PCS quantities can be placed on HOLD.' };
  const unit = String(input?.unit ?? '').trim().toUpperCase();
  if (!unit) return { ok: false, error: 'Select the unit (MTR or PCS).' };
  if (unit !== line.unit) return { ok: false, error: `This line is in ${line.unit}; it cannot be held in ${unit}. MTR and PCS are never converted.` };

  const reason = String(input?.reason ?? '').trim().toUpperCase();
  if (!reason) return { ok: false, error: 'Select the Hold Reason.' };
  if (!HOLD_REASONS.some((r) => r.code === reason)) return { ok: false, error: 'Select a Hold Reason from the list.' };
  const reasonOther = reason === 'OTHER' ? text(input?.reasonOther, 200) : null;
  if (reason === 'OTHER' && !reasonOther) return { ok: false, error: 'Enter the reason for Other.' };

  const raw = input?.quantity;
  const quantity = raw === undefined || raw === null || raw === '' ? NaN : Number(raw);
  if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, error: 'Enter a HOLD quantity greater than zero.' };
  const outstanding = outstandingOf(line);
  if (outstanding <= 0) return { ok: false, error: 'Nothing of this line is left in the department to hold.' };
  if (round(quantity) > outstanding) return { ok: false, error: `Only ${outstanding} ${line.unit} of this line is left in the department.` };
  return { ok: true, reason, reasonOther, remarks: text(input?.remarks, 1000), quantity: round(quantity) };
}

/**
 * Validates releasing quantity from a HOLD: above zero and no more than is still on HOLD.
 * @returns {{ ok: true, quantity: number, remarks: string | null } | { ok: false, error: string }}
 */
export function validateRelease(hold, remaining, input) {
  if (!isActiveHold(hold)) return { ok: false, error: 'This HOLD is already closed.' };
  if (remaining <= 0) return { ok: false, error: 'Nothing is left on this HOLD to release.' };
  const raw = input?.quantity;
  const quantity = raw === undefined || raw === null || raw === '' ? remaining : Number(raw);
  if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, error: 'Enter a release quantity greater than zero.' };
  if (round(quantity) > round(remaining)) return { ok: false, error: `Only ${round(remaining)} ${hold.unit} is on HOLD.` };
  return { ok: true, quantity: round(quantity), remarks: text(input?.remarks, 1000) };
}
