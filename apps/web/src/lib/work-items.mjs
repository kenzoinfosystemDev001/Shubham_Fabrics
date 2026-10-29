// Rules for DepartmentWorkItem: one incoming challan line as work in a downstream department
// (Embroidery now; Thread Cutting and later departments reuse these). Pure, no database or framework
// imports. Quantity flow: expected -> received -> processed -> transferred.

import { headerUnitOf } from './challan-units.mjs';

export const WORK_STATUS = /** @type {const} */ ({
  AWAITING_RECEIPT: 'AWAITING_RECEIPT',
  RECEIVED: 'RECEIVED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  READY_FOR_TRANSFER: 'READY_FOR_TRANSFER',
  PARTIALLY_TRANSFERRED: 'PARTIALLY_TRANSFERRED',
  TRANSFERRED: 'TRANSFERRED',
});

/** Statuses with work still to do in the department. */
export const OPEN_WORK_STATUSES = ['AWAITING_RECEIPT', 'RECEIVED', 'IN_PROGRESS', 'COMPLETED', 'READY_FOR_TRANSFER', 'PARTIALLY_TRANSFERRED'];
/** Statuses an operator may set; the transfer statuses only come from issuing a challan. */
export const OPERATOR_WORK_STATUSES = ['RECEIVED', 'IN_PROGRESS', 'COMPLETED', 'READY_FOR_TRANSFER'];
/** Statuses from which processed quantity may be transferred. */
export const TRANSFERABLE_STATUSES = ['COMPLETED', 'READY_FOR_TRANSFER', 'PARTIALLY_TRANSFERRED'];

export const FABRIC_STATUS = /** @type {const} */ ({ DYED: 'DYED', UNDYED: 'UNDYED' });

/**
 * QC departments inspect instead of process: processed = inspected, and each inspected quantity is
 * PASS (onward on the normal transfer), REJECT (defective shelf) or REWORK (back for rework).
 */
export const QC_DEPARTMENTS = ['QC2', 'QC3', 'FINAL_CHECK'];
export const TRANSFER_KINDS = /** @type {const} */ (['PASS', 'REJECT', 'REWORK']);

/** Final QC's inspection checkpoints (the ones the earlier Final QC module recorded), each PASS or FAIL. */
export const FINAL_QC_CHECKPOINTS = /** @type {const} */ ([
  { key: 'STITCHING_QUALITY', label: 'Stitching quality' },
  { key: 'MEASUREMENT_CHECK', label: 'Measurement' },
  { key: 'APPEARANCE_CHECK', label: 'Appearance' },
  { key: 'LABEL_CHECK', label: 'Label' },
  { key: 'PACKAGING_READINESS', label: 'Packaging readiness' },
]);

/**
 * Validates an inspection batch's checkpoint results: every checkpoint answered PASS or FAIL, and a
 * failed checkpoint means part of the batch was rejected or sent for rework (it cannot all pass).
 * @param {ReadonlyArray<{ key: string, label: string }>} checkpoints
 * @param {Record<string, unknown> | null | undefined} results
 * @param {{ pass: number, inspected: number }} batch
 * @returns {{ ok: true, results: Array<{ key: string, result: 'PASS' | 'FAIL' }> } | { ok: false, error: string }}
 */
export function validateCheckpoints(checkpoints, results, batch) {
  const out = [];
  for (const c of checkpoints) {
    const value = String(results?.[c.key] ?? '').toUpperCase();
    if (value !== 'PASS' && value !== 'FAIL') return { ok: false, error: `Record ${c.label} as Pass or Fail.` };
    out.push({ key: c.key, result: /** @type {'PASS' | 'FAIL'} */ (value) });
  }
  if (out.some((r) => r.result === 'FAIL') && batch.pass >= batch.inspected) {
    return { ok: false, error: 'A failed checkpoint needs the affected quantity recorded as REJECT or REWORK.' };
  }
  return { ok: true, results: out };
}

export function isQcItem(item) {
  return QC_DEPARTMENTS.includes(String(item?.departmentCode || '').toUpperCase());
}

/** QC status names (statuses are derived from quantities, see qcStatusOf). */
export function qcStatusLabel(status) {
  return (
    {
      AWAITING_RECEIPT: 'Awaiting Receipt',
      RECEIVED: 'Pending Inspection',
      IN_PROGRESS: 'Inspection In Progress',
      COMPLETED: 'Inspected',
      PARTIALLY_TRANSFERRED: 'Partially Routed',
      TRANSFERRED: 'Completed',
    }[status] || String(status || '').replace(/_/g, ' ')
  );
}

/** Operator-facing status names; `next` is the receiving department, e.g. "Thread Cutting". */
export function workStatusLabel(status, next = 'Next Department') {
  return (
    {
      AWAITING_RECEIPT: 'Awaiting Receipt',
      RECEIVED: 'Pending',
      IN_PROGRESS: 'In Progress',
      COMPLETED: 'Completed',
      READY_FOR_TRANSFER: `Ready for ${next}`,
      PARTIALLY_TRANSFERRED: 'Partially Transferred',
      TRANSFERRED: 'Fully Transferred',
    }[status] || String(status || '').replace(/_/g, ' ')
  );
}

/** Floor Board stages in flow order; `process` names the work (e.g. "Embroidery"). */
export function workStages(process, next) {
  return [
    { key: 'AWAITING_RECEIPT', label: 'Awaiting Receipt' },
    { key: 'RECEIVED', label: 'Received' },
    { key: 'PENDING', label: `Pending ${process}` },
    { key: 'IN_PROGRESS', label: 'In Progress' },
    { key: 'PARTIALLY_COMPLETED', label: 'Partially Completed' },
    { key: 'READY', label: `Ready for ${next}` },
    { key: 'PARTIALLY_TRANSFERRED', label: 'Partially Transferred' },
    { key: 'FULLY_TRANSFERRED', label: 'Fully Transferred' },
  ];
}

const round = (n) => Math.round((Number(n) || 0) * 1000) / 1000;

/** Quantity the department holds: what was received (legacy rows past receipt count as expected). */
export function receivedBasis(item) {
  if (item.receivedQuantity !== null && item.receivedQuantity !== undefined) return round(item.receivedQuantity);
  return item.status === 'AWAITING_RECEIPT' ? 0 : round(item.expectedQuantity);
}

/** Received but not yet processed. */
export function availableToProcess(item) {
  return round(Math.max(0, receivedBasis(item) - (Number(item.processedQuantity) || 0)));
}

/** Processed (QC: passed) but not yet transferred: the most a new outgoing challan line may carry. */
export function readyToTransfer(item) {
  const basis = isQcItem(item) ? item.passedQuantity : item.processedQuantity;
  return round(Math.max(0, (Number(basis) || 0) - (Number(item.transferredQuantity) || 0)));
}

/** QC: rejected but not yet sent to the defective shelf. */
export function pendingReject(item) {
  return round(Math.max(0, (Number(item.rejectedQuantity) || 0) - (Number(item.rejectSentQuantity) || 0)));
}

/** QC: marked for rework but not yet returned. */
export function pendingRework(item) {
  return round(Math.max(0, (Number(item.reworkQuantity) || 0) - (Number(item.reworkSentQuantity) || 0)));
}

/** What a transfer of this kind may still carry for the line. */
export function availableFor(item, kind = 'PASS') {
  return kind === 'REJECT' ? pendingReject(item) : kind === 'REWORK' ? pendingRework(item) : readyToTransfer(item);
}

/**
 * QC status from quantities: pending until something is inspected, in progress until everything
 * received is inspected, completed once every inspected quantity has left on a challan.
 */
export function qcStatusOf(item) {
  if (item.status === 'AWAITING_RECEIPT') return 'AWAITING_RECEIPT';
  const received = receivedBasis(item);
  const inspected = round(item.processedQuantity);
  const routed = round((Number(item.transferredQuantity) || 0) + (Number(item.rejectSentQuantity) || 0) + (Number(item.reworkSentQuantity) || 0));
  if (inspected >= received && routed >= inspected) return 'TRANSFERRED';
  if (routed > 0) return 'PARTIALLY_TRANSFERRED';
  if (inspected <= 0) return 'RECEIVED';
  return inspected < received ? 'IN_PROGRESS' : 'COMPLETED';
}

/** QC Floor Board stages; `next` receives PASS, `reworkTo` receives REWORK. */
export function qcStages(next, reworkTo) {
  return [
    { key: 'AWAITING_RECEIPT', label: 'Awaiting Receipt' },
    { key: 'AWAITING_INSPECTION', label: 'Awaiting Inspection' },
    { key: 'INSPECTING', label: 'Inspection In Progress' },
    { key: 'PASSED', label: `Passed, awaiting ${next}` },
    { key: 'REJECTED', label: 'Rejected, awaiting Defective Shelf' },
    { key: 'REWORK', label: `Rework, awaiting return to ${reworkTo}` },
    { key: 'COMPLETED', label: 'Completed' },
  ];
}

/** Every QC stage a line is in, with the quantity that belongs there (a line can be in several). */
export function qcStageEntries(item) {
  if (item.status === 'AWAITING_RECEIPT') return [{ key: 'AWAITING_RECEIPT', quantity: round(item.expectedQuantity) }];
  if (qcStatusOf(item) === 'TRANSFERRED') return [{ key: 'COMPLETED', quantity: round(item.processedQuantity) }];
  const entries = [];
  const uninspected = availableToProcess(item);
  if (uninspected > 0) entries.push({ key: Number(item.processedQuantity) > 0 ? 'INSPECTING' : 'AWAITING_INSPECTION', quantity: uninspected });
  if (readyToTransfer(item) > 0) entries.push({ key: 'PASSED', quantity: readyToTransfer(item) });
  if (pendingReject(item) > 0) entries.push({ key: 'REJECTED', quantity: pendingReject(item) });
  if (pendingRework(item) > 0) entries.push({ key: 'REWORK', quantity: pendingRework(item) });
  return entries;
}

/**
 * Validates one inspection batch: it covers only uninspected quantity, and every inspected unit gets
 * exactly one outcome. REJECT and REWORK need a reason.
 * @returns {{ ok: true, inspected: number, pass: number, reject: number, rework: number } | { ok: false, error: string }}
 */
export function validateInspection(item, input) {
  if (item.status === 'AWAITING_RECEIPT') return { ok: false, error: 'Receive this material before inspecting it.' };
  const num = (v) => (v === undefined || v === null || v === '' ? 0 : Number(v));
  const inspected = num(input.inspectedQuantity);
  const pass = num(input.passQuantity);
  const reject = num(input.rejectQuantity);
  const rework = num(input.reworkQuantity);
  if (!Number.isFinite(inspected) || inspected <= 0) return { ok: false, error: 'Inspected quantity must be greater than zero.' };
  for (const [label, v] of /** @type {Array<[string, number]>} */ ([['PASS', pass], ['REJECT', reject], ['REWORK', rework]])) {
    if (!Number.isFinite(v) || v < 0) return { ok: false, error: `${label} quantity must be zero or more.` };
  }
  const open = availableToProcess(item);
  if (round(inspected) > open) return { ok: false, error: `Only ${open} ${item.uom} is still uninspected.` };
  const sum = round(pass + reject + rework);
  if (sum !== round(inspected)) {
    return { ok: false, error: `PASS + REJECT + REWORK (${sum}) must equal the inspected quantity (${round(inspected)} ${item.uom}).` };
  }
  if (reject > 0 && !String(input.rejectReason || '').trim()) return { ok: false, error: 'Enter the defect reason for the rejected quantity.' };
  if (rework > 0 && !String(input.reworkReason || '').trim()) return { ok: false, error: 'Enter the reason for the rework quantity.' };
  return { ok: true, inspected: round(inspected), pass: round(pass), reject: round(reject), rework: round(rework) };
}

/** Fully transferred only when everything received was processed and sent. */
export function statusAfterTransfer(item, transferredAfter) {
  if (isQcItem(item)) return qcStatusOf({ ...item, transferredQuantity: transferredAfter });
  const processed = round(item.processedQuantity);
  const sent = round(transferredAfter);
  if (sent <= 0) return item.status;
  // Defective quantity (production departments) never leaves as good work, so it counts as done.
  const done = round(processed + (Number(item.defectQuantity) || 0));
  return sent >= processed && done >= receivedBasis(item) ? 'TRANSFERRED' : 'PARTIALLY_TRANSFERRED';
}

/** Floor Board stage. Pending = received and scheduled (expected completion set) but not started. */
export function workStageOf(item) {
  const processed = Number(item.processedQuantity) || 0;
  const transferred = Number(item.transferredQuantity) || 0;
  switch (item.status) {
    case 'AWAITING_RECEIPT':
      return 'AWAITING_RECEIPT';
    case 'TRANSFERRED':
      return 'FULLY_TRANSFERRED';
    case 'PARTIALLY_TRANSFERRED':
      return 'PARTIALLY_TRANSFERRED';
    case 'COMPLETED':
    case 'READY_FOR_TRANSFER':
      return transferred > 0 ? 'PARTIALLY_TRANSFERRED' : 'READY';
    case 'IN_PROGRESS':
      return processed > 0 ? 'PARTIALLY_COMPLETED' : 'IN_PROGRESS';
    default:
      return item.expectedCompletionDate ? 'PENDING' : 'RECEIVED';
  }
}

/**
 * Dyed / Undyed for an incoming line, from the validated route — never from the colour.
 * - A QC1 PASS transfer (QC1 -> department, type QC1_TO_<DEPT>) carries dyed fabric.
 * - Fabric Store's direct route uses the status stored on the line, else Undyed (no dyeing).
 * - Any other route keeps the line's stored status when it has one, else Undyed.
 * @returns {'DYED' | 'UNDYED'}
 */
export function fabricStatusForInboundLine(challan, item) {
  const from = String(challan?.fromDepartment || '').toUpperCase();
  if (from === 'QC1') return 'DYED';
  const stored = String(item?.fabricProcessingStatus || '').toUpperCase();
  if (stored === 'DYED' || stored === 'UNDYED') return stored;
  const remark = String(item?.remarks || '').match(/\bStatus:\s*(Undyed|Dyed)\b/i)?.[1]?.toUpperCase();
  if (remark === 'DYED' || remark === 'UNDYED') return remark;
  return 'UNDYED';
}

/**
 * Validates an operator's process update.
 * @param {any} item current work item
 * @param {{ status?: unknown, processedQuantity?: unknown }} input
 * @returns {{ ok: true, status: string, processedQuantity: number } | { ok: false, error: string }}
 */
export function validateWorkUpdate(item, input) {
  if (item.status === 'AWAITING_RECEIPT') return { ok: false, error: 'Receive this fabric before recording work.' };
  if (item.status === 'TRANSFERRED') return { ok: false, error: 'This line has been fully transferred; it can no longer be changed.' };

  const received = receivedBasis(item);
  const transferred = round(item.transferredQuantity);
  let processed = round(item.processedQuantity);
  if (input.processedQuantity !== undefined && input.processedQuantity !== null && input.processedQuantity !== '') {
    const parsed = Number(input.processedQuantity);
    if (!Number.isFinite(parsed) || parsed < 0) return { ok: false, error: 'Processed quantity must be zero or more.' };
    processed = round(parsed);
  }
  if (processed > received) return { ok: false, error: `Processed quantity cannot exceed the received ${received} ${item.uom}.` };
  if (processed < transferred) {
    return { ok: false, error: `${transferred} ${item.uom} has already been transferred; processed quantity cannot be lower.` };
  }

  let status = item.status;
  if (input.status !== undefined && input.status !== null && input.status !== '') {
    if (!OPERATOR_WORK_STATUSES.includes(String(input.status))) return { ok: false, error: 'That status cannot be set here.' };
    status = String(input.status);
  } else if (item.status === 'RECEIVED' && processed > 0) {
    status = 'IN_PROGRESS';
  }

  if (transferred > 0) {
    status = 'PARTIALLY_TRANSFERRED';
  } else {
    if (status === 'RECEIVED' && processed > 0) return { ok: false, error: 'A line with processed quantity cannot go back to Pending.' };
    if ((status === 'COMPLETED' || status === 'READY_FOR_TRANSFER') && processed <= 0) {
      return { ok: false, error: 'Record the processed quantity before completing.' };
    }
  }
  return { ok: true, status, processedQuantity: processed };
}

/** Production departments: received but not yet taken into production. */
export function awaitingTakeIn(item) {
  return round(Math.max(0, receivedBasis(item) - (Number(item.takenQuantity) || 0)));
}

/** Production departments: taken in but neither completed (good) nor found defective. */
export function inProduction(item) {
  return round(Math.max(0, (Number(item.takenQuantity) || 0) - (Number(item.processedQuantity) || 0) - (Number(item.defectQuantity) || 0)));
}

/**
 * Validates a production update (Stitching): quantity taken into production, good completed and
 * defective, all totals in the line's unit. received >= taken >= completed + defective;
 * completed >= already transferred; defective never goes down (it was already recorded).
 * @returns {{ ok: true, status: string, processedQuantity: number, takenQuantity: number, defectQuantity: number } | { ok: false, error: string }}
 */
export function validateProductionUpdate(item, input) {
  const num = (v, fallback) => (v === undefined || v === null || v === '' ? fallback : Number(v));
  const taken = num(input.takenQuantity, Number(item.takenQuantity) || 0);
  const defect = num(input.defectQuantity, Number(item.defectQuantity) || 0);
  if (!Number.isFinite(taken) || taken < 0) return { ok: false, error: 'Quantity taken into production must be zero or more.' };
  if (!Number.isFinite(defect) || defect < 0) return { ok: false, error: 'Defective quantity must be zero or more.' };
  const received = receivedBasis(item);
  if (round(taken) > received) return { ok: false, error: `Quantity taken into production cannot exceed the received ${received} ${item.uom}.` };
  if (round(defect) < round(item.defectQuantity)) {
    return { ok: false, error: `${round(item.defectQuantity)} ${item.uom} was already recorded as defective; it cannot be reduced here.` };
  }
  // Completed quantity and status follow the shared rules, against what is on the floor (taken - defective).
  const check = validateWorkUpdate({ ...item, receivedQuantity: round(taken - defect) }, input);
  if (!check.ok) {
    return { ok: false, error: check.error.replace(/the received/, 'the quantity taken in (less defective),') };
  }
  let status = check.status;
  if (status === 'RECEIVED' && round(taken) > 0) status = 'IN_PROGRESS';
  return { ok: true, status, processedQuantity: check.processedQuantity, takenQuantity: round(taken), defectQuantity: round(defect) };
}

/**
 * Validates the lines of an outgoing challan against their work items.
 * @param {Array<{ workItemId: string, quantity: unknown }>} lines
 * @param {Map<string, any>} itemsById
 * @param {string} departmentCode
 * @param {string} [kind] PASS (default) | REJECT | REWORK: which QC outcome the challan carries
 * @returns {{ ok: true, unit: string, programId: string } | { ok: false, error: string }}
 */
export function validateTransferLines(lines, itemsById, departmentCode, kind = 'PASS') {
  if (!Array.isArray(lines) || lines.length === 0) return { ok: false, error: 'Add at least one item to transfer.' };
  // A work line may appear on several challan lines (entries of one fabric colour); together they may not
  // exceed what it has available.
  const sent = new Map();
  const units = [];
  let programId = null;
  for (const [index, line] of lines.entries()) {
    const n = index + 1;
    const item = itemsById.get(line.workItemId);
    if (!item || item.departmentCode !== departmentCode) return { ok: false, error: `Line ${n}: work item not found.` };
    if (programId && item.programId !== programId) {
      return { ok: false, error: 'All items on one challan must belong to the same Production Sheet.' };
    }
    programId = item.programId;
    // Each line keeps its own unit; meters and pieces are never added together.
    units.push(item.uom);
    const qc = isQcItem(item);
    if (!qc && kind !== 'PASS') return { ok: false, error: `Line ${n}: ${item.fabricName} has no inspection outcomes.` };
    if (!qc && !TRANSFERABLE_STATUSES.includes(item.status)) return { ok: false, error: `Line ${n}: ${item.fabricName} is not ready for transfer.` };
    const quantity = Number(line.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, error: `Line ${n}: enter a quantity greater than zero.` };
    const available = availableFor(item, kind);
    const total = round((sent.get(line.workItemId) || 0) + quantity);
    sent.set(line.workItemId, total);
    if (total > available) {
      const what = kind === 'REJECT' ? 'rejected and not yet sent' : kind === 'REWORK' ? 'marked for rework and not yet returned' : qc ? 'passed and not yet transferred' : 'ready to transfer';
      return { ok: false, error: `Line ${n}: only ${available} ${item.uom} of ${item.fabricName} is ${what}.` };
    }
  }
  return { ok: true, unit: /** @type {string} */ (headerUnitOf(units)), programId: /** @type {string} */ (programId) };
}
