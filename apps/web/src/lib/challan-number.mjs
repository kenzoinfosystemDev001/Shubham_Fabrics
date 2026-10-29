// Manual challan number rules. Pure, no database or framework imports.
//
// Challan numbers are typed by the issuing department. The server stores exactly what was
// typed (surrounding whitespace removed) and never generates or overwrites one.

export const CHALLAN_NUMBER_MAX_LENGTH = 64;

/** Surrounding whitespace removed; everything else kept as typed. */
export function normalizeChallanNumber(raw) {
  if (raw === null || raw === undefined) return '';
  return String(raw).trim();
}

/**
 * Validates a typed challan number.
 * @returns {{ ok: true, value: string } | { ok: false, error: string }}
 */
export function validateChallanNumber(raw, label = 'Challan Number') {
  const value = normalizeChallanNumber(raw);
  if (!value) return { ok: false, error: `${label} is required.` };
  if (value.length > CHALLAN_NUMBER_MAX_LENGTH) {
    return { ok: false, error: `${label} must be ${CHALLAN_NUMBER_MAX_LENGTH} characters or fewer.` };
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    return { ok: false, error: `${label} contains characters that cannot be printed.` };
  }
  return { ok: true, value };
}

/** Comparison key for duplicate detection: "CH-001" and "ch-001" are the same challan number. */
export function challanNumberKey(raw) {
  return normalizeChallanNumber(raw).toLowerCase();
}

export function duplicateChallanNumberMessage(value) {
  return `Challan Number "${value}" is already used by this department. Enter a different number.`;
}

/**
 * Validates several numbers that one request will create (e.g. an inspection that issues a
 * forward and a return challan). Every entry is required and they must differ from each other.
 * @param {Array<{ field: string, label: string, value: unknown }>} entries
 * @returns {{ ok: true, values: Record<string, string> } | { ok: false, field: string, error: string }}
 */
export function validateChallanNumberSet(entries) {
  const values = {};
  const seen = new Map();
  for (const entry of entries) {
    const result = validateChallanNumber(entry.value, entry.label);
    if (!result.ok) return { ok: false, field: entry.field, error: result.error };
    const key = challanNumberKey(result.value);
    if (seen.has(key)) {
      return {
        ok: false,
        field: entry.field,
        error: `${entry.label} must be different from ${seen.get(key)}.`,
      };
    }
    seen.set(key, entry.label);
    values[entry.field] = result.value;
  }
  return { ok: true, values };
}
