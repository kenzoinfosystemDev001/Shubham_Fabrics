// Dyeing workflow rules: statuses, quantities and floor-board stages for one DyeingOrder
// (one Store -> Dyeing challan line). Pure, no database or framework imports.
//
// Quantity flow per order:  expected (challan line) -> received -> dyed -> sent to QC1.
// Each stage can only draw from the one before it, so nothing is counted twice.

export const DYEING_STATUS = /** @type {const} */ ({
  AWAITING_RECEIPT: 'AWAITING_RECEIPT',
  RECEIVED: 'RECEIVED',
  IN_DYEING: 'IN_DYEING',
  PARTIALLY_DYED: 'PARTIALLY_DYED',
  DYED: 'DYED',
  READY_FOR_QC1: 'READY_FOR_QC1',
  PARTIALLY_SENT_TO_QC1: 'PARTIALLY_SENT_TO_QC1',
  SENT_TO_QC1: 'SENT_TO_QC1',
});

/** Operator-facing names (Pending / In Progress / Completed / Ready for QC ...). */
export const DYEING_STATUS_LABEL = {
  AWAITING_RECEIPT: 'Awaiting Receipt',
  RECEIVED: 'Pending',
  IN_DYEING: 'In Progress',
  PARTIALLY_DYED: 'In Progress',
  DYED: 'Completed',
  READY_FOR_QC1: 'Ready for QC',
  PARTIALLY_SENT_TO_QC1: 'Partially Sent to QC',
  SENT_TO_QC1: 'Sent to QC',
};

/** Statuses with work still to do in Dyeing (used by alerts and "open" filters). */
export const OPEN_DYEING_STATUSES = [
  'AWAITING_RECEIPT',
  'RECEIVED',
  'IN_DYEING',
  'PARTIALLY_DYED',
  'DYED',
  'READY_FOR_QC1',
  'PARTIALLY_SENT_TO_QC1',
];

/** Statuses an operator may set directly; SENT statuses only come from issuing a QC challan. */
export const OPERATOR_STATUSES = ['RECEIVED', 'IN_DYEING', 'DYED', 'READY_FOR_QC1'];

/** Floor Board stages, in flow order. */
export const DYEING_STAGES = [
  { key: 'AWAITING_RECEIPT', label: 'Awaiting Receipt' },
  { key: 'RECEIVED', label: 'Received' },
  { key: 'PENDING_DYEING', label: 'Pending Dyeing' },
  { key: 'IN_PROGRESS', label: 'Dyeing In Progress' },
  { key: 'COMPLETED', label: 'Dyeing Completed' },
  { key: 'PARTIALLY_TRANSFERRED', label: 'Partially Transferred to QC' },
  { key: 'FULLY_TRANSFERRED', label: 'Fully Transferred to QC' },
];

const round = (n) => Math.round((Number(n) || 0) * 1000) / 1000;

/**
 * Quantity Dyeing actually holds for this line. Orders created before receipt tracking existed
 * have no receivedQuantity; once past AWAITING_RECEIPT they count their expected quantity.
 * @param {{ status: string, receivedQuantity?: number | null, requiredQuantity: number }} order
 */
export function receivedBasis(order) {
  if (order.receivedQuantity !== null && order.receivedQuantity !== undefined) return round(order.receivedQuantity);
  return order.status === 'AWAITING_RECEIPT' ? 0 : round(order.requiredQuantity);
}

/** Received but not yet dyed. */
export function remainingToDye(order) {
  return round(Math.max(0, receivedBasis(order) - (Number(order.dyedQuantity) || 0)));
}

/** Dyed but not yet sent to QC1: the most a new QC challan line may carry. */
export function availableForQc(order) {
  return round(Math.max(0, (Number(order.dyedQuantity) || 0) - (Number(order.sentToQc1Quantity) || 0)));
}

function norm(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * True when a dyed colour was recorded and differs from the required colour. Orders without a
 * required colour (rework returns, older lines) never mismatch.
 */
export function isColorMismatch(targetColor, dyedColor) {
  const target = norm(targetColor);
  const dyed = norm(dyedColor);
  return Boolean(target && dyed && target !== dyed);
}

/** A mismatch blocks transfer to QC until someone has reviewed it. */
export function needsColorReview(order) {
  return Boolean(order.colorMismatch) && !order.colorReviewedAt;
}

/**
 * Status after a QC transfer. Fully transferred only when everything received has been dyed and
 * sent; anything still undyed or unsent keeps the line partially transferred.
 */
export function statusAfterTransfer(order, sentAfter) {
  const received = receivedBasis(order);
  const dyed = round(order.dyedQuantity);
  const sent = round(sentAfter);
  if (sent <= 0) return order.status;
  return sent >= dyed && dyed >= received ? 'SENT_TO_QC1' : 'PARTIALLY_SENT_TO_QC1';
}

/**
 * Floor Board stage for an order.
 * Received = in Dyeing with nothing planned yet; Pending Dyeing = planned (batch, machine or
 * expected completion set) but not started.
 */
export function stageOf(order) {
  const sent = Number(order.sentToQc1Quantity) || 0;
  if (order.status === 'AWAITING_RECEIPT') return 'AWAITING_RECEIPT';
  if (order.status === 'SENT_TO_QC1') return 'FULLY_TRANSFERRED';
  if (sent > 0 || order.status === 'PARTIALLY_SENT_TO_QC1') return 'PARTIALLY_TRANSFERRED';
  if (order.status === 'DYED' || order.status === 'READY_FOR_QC1') return 'COMPLETED';
  if (order.status === 'IN_DYEING' || order.status === 'PARTIALLY_DYED') return 'IN_PROGRESS';
  const planned = Boolean(order.batchNumber || order.machineNumber || order.expectedCompletionDate);
  return planned ? 'PENDING_DYEING' : 'RECEIVED';
}

/**
 * Validates an operator's process update and returns the resulting values, or an error message.
 * @param {any} order current order
 * @param {{ status?: string, dyedQuantity?: unknown, dyedColor?: unknown, colorReviewNote?: unknown }} input
 * @returns {{ ok: true, status: string, dyedQuantity: number, dyedColor: string | null, colorMismatch: boolean, reviewNow: boolean }
 *          | { ok: false, error: string }}
 */
export function validateProcessUpdate(order, input) {
  if (order.status === 'AWAITING_RECEIPT') {
    return { ok: false, error: 'Receive this fabric before recording dyeing work.' };
  }
  if (order.status === 'SENT_TO_QC1') {
    return { ok: false, error: 'This line has been fully transferred to QC; it can no longer be changed.' };
  }

  const received = receivedBasis(order);
  const sent = round(order.sentToQc1Quantity);

  let dyed = round(order.dyedQuantity);
  if (input.dyedQuantity !== undefined && input.dyedQuantity !== null && input.dyedQuantity !== '') {
    const parsed = Number(input.dyedQuantity);
    if (!Number.isFinite(parsed) || parsed < 0) return { ok: false, error: 'Processed quantity must be zero or more.' };
    dyed = round(parsed);
  }
  if (dyed > received) {
    return { ok: false, error: `Processed quantity cannot exceed the received ${received} ${order.uom}.` };
  }
  if (dyed < sent) {
    return { ok: false, error: `${sent} ${order.uom} has already been sent to QC; processed quantity cannot be lower.` };
  }

  const dyedColor =
    input.dyedColor === undefined ? order.dyedColor ?? null : String(input.dyedColor ?? '').trim() || null;
  const colorMismatch = isColorMismatch(order.targetColor, dyedColor);
  const reviewNote = String(input.colorReviewNote ?? '').trim();
  const colorChanged = norm(dyedColor) !== norm(order.dyedColor);
  // Changing the dyed colour after a review needs a fresh review.
  const reviewed = colorMismatch && (reviewNote.length > 0 || (Boolean(order.colorReviewedAt) && !colorChanged));

  let status = order.status;
  if (input.status !== undefined && input.status !== null && input.status !== '') {
    if (!OPERATOR_STATUSES.includes(String(input.status))) {
      return { ok: false, error: 'That status cannot be set here.' };
    }
    status = String(input.status);
  } else if (order.status === 'RECEIVED' && dyed > 0) {
    status = 'IN_DYEING';
  }

  if (sent > 0) {
    // Lines already partly sent stay partially transferred; only quantities and colour move.
    status = 'PARTIALLY_SENT_TO_QC1';
  } else {
    if (status === 'RECEIVED' && dyed > 0) {
      return { ok: false, error: 'A line with processed quantity cannot go back to Pending.' };
    }
    if ((status === 'DYED' || status === 'READY_FOR_QC1') && dyed <= 0) {
      return { ok: false, error: 'Record the processed quantity before completing.' };
    }
    if (status === 'READY_FOR_QC1' && colorMismatch && !reviewed) {
      return {
        ok: false,
        error: 'The dyed colour differs from the required colour. Add a review note before marking it ready for QC.',
      };
    }
  }

  return { ok: true, status, dyedQuantity: dyed, dyedColor, colorMismatch, reviewNow: colorMismatch && reviewNote.length > 0 };
}

/**
 * Validates the lines of a Dyeing -> QC1 challan against their orders.
 * @param {Array<{ orderId: string, quantity: unknown }>} lines
 * @param {Map<string, any>} ordersById
 * @returns {{ ok: true, unit: string, programId: string } | { ok: false, error: string }}
 */
export function validateQcTransferLines(lines, ordersById) {
  if (!Array.isArray(lines) || lines.length === 0) return { ok: false, error: 'Add at least one item to transfer.' };
  const seen = new Set();
  let unit = null;
  let programId = null;
  for (const [index, line] of lines.entries()) {
    const n = index + 1;
    const order = ordersById.get(line.orderId);
    if (!order) return { ok: false, error: `Line ${n}: dyeing record not found.` };
    if (seen.has(line.orderId)) return { ok: false, error: `Line ${n}: the same dyeing record is listed twice.` };
    seen.add(line.orderId);
    if (programId && order.programId !== programId) {
      return { ok: false, error: 'All items on one challan must belong to the same Production Sheet.' };
    }
    programId = order.programId;
    if (unit && order.uom !== unit) return { ok: false, error: 'Meters and pieces cannot be mixed on one challan.' };
    unit = order.uom;
    if (!['DYED', 'READY_FOR_QC1', 'PARTIALLY_SENT_TO_QC1'].includes(order.status)) {
      return { ok: false, error: `Line ${n}: ${order.orderNumber} is not ready for QC.` };
    }
    if (needsColorReview(order)) {
      return { ok: false, error: `Line ${n}: ${order.orderNumber} has an unreviewed colour difference.` };
    }
    const quantity = Number(line.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, error: `Line ${n}: enter a quantity greater than zero.` };
    const available = availableForQc(order);
    if (round(quantity) > available) {
      return { ok: false, error: `Line ${n}: only ${available} ${order.uom} of ${order.orderNumber} is available to transfer.` };
    }
  }
  return { ok: true, unit: /** @type {string} */ (unit), programId: /** @type {string} */ (programId) };
}
