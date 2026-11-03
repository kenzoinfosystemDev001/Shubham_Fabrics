// Which status changes the generic challan routes (PATCH /api/challans/[id] and /api/challans/[id]/status)
// may make. Department screens own every other transition: they keep each line's quantities, the sender's
// counters and the audit trail in step, which a bare status change cannot. Pure, no database imports.

/**
 * Routes the generic POST /api/challans may create (department keys, as in lib/auth/department-access).
 * Programming sends the sheet's fabric request to the Store; the Store issues stock to Dyeing or straight to
 * Embroidery (undyed fabric). Every other route is issued from its department's own screen, which checks and
 * records the quantities (Dyeing, Dyeing QC's inspection, the work-item departments).
 */
export const GENERIC_ISSUE_ROUTES = /** @type {Record<string, readonly string[]>} */ ({
  PROGRAMMING: ['STORE'],
  STORE: ['DYEING', 'EMBROIDERY'],
});

/**
 * @param {string | null} fromKey department key of the sender
 * @param {string | null} toKey department key of the receiver
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function checkGenericIssueRoute(fromKey, toKey) {
  const allowed = (fromKey && GENERIC_ISSUE_ROUTES[fromKey]) || [];
  if (toKey && allowed.includes(toKey)) return { ok: true };
  return {
    ok: false,
    error: `Challans from ${fromKey || 'this department'} to ${toKey || 'that department'} are not issued here. Use the sending department's own Issue Challan screen.`,
  };
}

/** Statuses before anything was received: the challan can still be cancelled or received. */
export const NOT_YET_RECEIVED = ['DRAFT', 'SUBMITTED', 'ISSUED', 'IN_TRANSIT'];

/** Final clean-up an administrator may record for challans no department screen tracks (older records). */
const ADMIN_CLOSE_FROM = ['RECEIVED', 'IN_PROCESS', 'UNDER_INSPECTION', 'ON_HOLD', 'COMPLETED'];
const ADMIN_CLOSE_TO = ['COMPLETED', 'HANDED_OVER'];

/**
 * @param {string} from current status
 * @param {string} to requested status
 * @param {{ engineManaged: boolean, isSender: boolean, isReceiver: boolean, isAdmin: boolean }} ctx
 *   engineManaged: a department screen tracks this challan's quantities (work items, dyeing orders, transfers).
 * @returns {{ ok: true } | { ok: false, status: number, error: string }}
 */
export function checkGenericStatusChange(from, to, ctx) {
  const current = String(from || '').toUpperCase();
  const next = String(to || '').toUpperCase();
  // A challan is received once: a second receipt (double click, second tablet) is refused, not re-stamped.
  if (next === 'RECEIVED' && current === 'RECEIVED') return { ok: false, status: 409, error: 'This challan has already been received.' };
  if (!next || next === current) return { ok: true };

  if (next === 'RECEIVED') {
    if (!ctx.isReceiver && !ctx.isAdmin) return { ok: false, status: 403, error: 'Only the receiving department can receive this challan.' };
    if (!NOT_YET_RECEIVED.includes(current)) {
      return { ok: false, status: 409, error: `This challan is ${current}; only an issued challan can be received.` };
    }
    return { ok: true };
  }

  if (next === 'CANCELLED') {
    // The sender withdraws it, or the receiver declines it (e.g. Fabric Store: "Not in Stock"), before receipt.
    if (!ctx.isSender && !ctx.isReceiver && !ctx.isAdmin) {
      return { ok: false, status: 403, error: 'Only the sending or receiving department can cancel this challan.' };
    }
    if (!NOT_YET_RECEIVED.includes(current)) {
      return { ok: false, status: 409, error: `This challan is ${current}; a challan can only be cancelled before it is received.` };
    }
    if (ctx.engineManaged) {
      return {
        ok: false,
        status: 409,
        error: 'A department screen tracks this challan\'s quantities, so cancelling it here would lose them. Correct it from the issuing department\'s screen.',
      };
    }
    return { ok: true };
  }

  if (ctx.isAdmin && !ctx.engineManaged && ADMIN_CLOSE_FROM.includes(current) && ADMIN_CLOSE_TO.includes(next)) {
    return { ok: true };
  }

  return {
    ok: false,
    status: 409,
    error: `Status ${next} is recorded by the department's own screen, not here.`,
  };
}
