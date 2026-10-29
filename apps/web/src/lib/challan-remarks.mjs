// Challan remarks as the user typed them. Older challans also carried system details in their remarks
// (design, serial, incharge, delivery date, in / defective / out accounting, auto-detection notes);
// those are already stored in their own fields, so they are left out wherever remarks are shown.

const SYSTEM_PART =
  /^(design\s*#?\s*:|serial\s*:|incharge\s*:|store incharge\s*:|contact\s*:|delivery date\s*:|accounting\s*:|in\s*:|defective cut\s*:|leftover out to store\s*:|out to [a-z_ ]+:|ref\s*:|dyeing ref\s*:|\[auto-detected from|\[defect isolation)/i;

/**
 * The department incharge of a challan or outward entry: the name typed on the form (saved in its own
 * field, or as an "Incharge:" note in older records / before that field existed), else the account
 * that issued it.
 * @param {{ inchargeName?: string | null, remarks?: string | null, issuedBy?: { fullName?: string | null } | null, createdBy?: { fullName?: string | null } | null }} record
 * @returns {string}
 */
export function inchargeNameOf(record) {
  return typedInchargeNameOf(record) || String(record?.issuedBy?.fullName || record?.createdBy?.fullName || '').trim();
}

/**
 * Only a name someone typed on the form (its own field, or an "Incharge:" note); '' when none was typed.
 * @param {{ inchargeName?: string | null, remarks?: string | null }} record
 * @returns {string}
 */
export function typedInchargeNameOf(record) {
  const typed = String(record?.inchargeName ?? '').trim();
  if (typed) return typed;
  const noted = String(record?.remarks ?? '').match(/(?:^|[|·]\s*)(?:store\s+)?incharge\s*:\s*([^|·]+)/i);
  return noted && noted[1].trim() ? noted[1].trim() : '';
}

/**
 * @param {unknown} remarks
 * @returns {string}
 */
export function userChallanRemarks(remarks) {
  const text = String(remarks ?? '').trim();
  if (!text) return '';
  return text
    .split(/\s+[|·]\s+/)
    .map((part) => part.trim())
    .filter((part) => part && !SYSTEM_PART.test(part))
    .join(' | ');
}

/**
 * Remarks with the user's part replaced and any older system details (see userChallanRemarks) kept, so
 * correcting the remarks never loses them.
 * @param {unknown} previous
 * @param {string | null | undefined} userText
 * @returns {string | null}
 */
export function withUserRemarks(previous, userText) {
  const system = String(previous ?? '')
    .trim()
    .split(/\s+[|·]\s+/)
    .map((part) => part.trim())
    .filter((part) => part && SYSTEM_PART.test(part));
  const all = [...system, String(userText ?? '').trim()].filter(Boolean);
  return all.length ? all.join(' | ') : null;
}
