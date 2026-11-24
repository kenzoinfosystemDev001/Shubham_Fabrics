// Rework task stages, shared by the rework department screens, the QC "Rework" pages and the admin monitor.
// Pure: no database or framework imports. A rework task is a QC REWORK decision routed to the configured rework
// department without a challan (lib/rework-routing-server.ts); it is forwarded on that department's normal challan.

/** Stages in order. Partial work and partial forwarding are allowed: the remaining quantity stays with the task. */
export const REWORK_STAGES = /** @type {const} */ (['PENDING', 'IN_PROGRESS', 'COMPLETED', 'READY', 'PARTLY_FORWARDED', 'FORWARDED', 'RECEIVED_NEXT']);

export const REWORK_STAGE_LABEL = {
  PENDING: 'Rework Pending',
  IN_PROGRESS: 'Rework In Progress',
  COMPLETED: 'Rework Completed',
  READY: 'Ready for Forwarding',
  PARTLY_FORWARDED: 'Partly Forwarded',
  FORWARDED: 'Forwarded',
  RECEIVED_NEXT: 'Received by Next Department',
};

/** Challan statuses before the destination has received it. */
const NOT_YET_RECEIVED = ['DRAFT', 'ISSUED', 'SUBMITTED', 'IN_TRANSIT'];
const EPS = 0.001;
const num = (v) => Number(v) || 0;

/** Whether every forwarding challan has been received by the next department. */
function allReceived(challanStatuses) {
  return challanStatuses.length > 0 && challanStatuses.every((s) => !NOT_YET_RECEIVED.includes(String(s)));
}

/**
 * Stage of a rework task in a work-item department (Thread Cutting, Washing, Steam Press).
 * @param {any} task the DepartmentWorkItem (origin REWORK)
 * @param {string[]} forwardStatuses statuses of the challans it was forwarded on
 */
export function workTaskStage(task, forwardStatuses = []) {
  const received = task.receivedQuantity == null ? num(task.expectedQuantity) : num(task.receivedQuantity);
  const processed = num(task.processedQuantity);
  const defect = num(task.defectQuantity);
  const transferred = num(task.transferredQuantity);
  if (transferred > EPS) {
    if (transferred + defect >= received - EPS) return allReceived(forwardStatuses) ? 'RECEIVED_NEXT' : 'FORWARDED';
    return 'PARTLY_FORWARDED';
  }
  if (processed <= EPS && num(task.takenQuantity) <= EPS) return 'PENDING';
  if (processed + defect >= received - EPS) return task.status === 'READY_FOR_TRANSFER' ? 'READY' : 'COMPLETED';
  return 'IN_PROGRESS';
}

/**
 * Stage of a Dyeing rework order (Dyeing QC REWORK).
 * @param {any} order the DyeingOrder (origin REWORK)
 * @param {string[]} forwardStatuses statuses of the Dyeing -> Dyeing QC challans it was sent on
 */
export function dyeingTaskStage(order, forwardStatuses = []) {
  const required = order.receivedQuantity == null ? num(order.requiredQuantity) : num(order.receivedQuantity);
  const sent = num(order.sentToQc1Quantity);
  if (sent > EPS) {
    if (sent >= required - EPS) return allReceived(forwardStatuses) ? 'RECEIVED_NEXT' : 'FORWARDED';
    return 'PARTLY_FORWARDED';
  }
  switch (order.status) {
    case 'READY_FOR_QC1':
      return 'READY';
    case 'DYED':
      return 'COMPLETED';
    case 'IN_DYEING':
    case 'PARTIALLY_DYED':
      return 'IN_PROGRESS';
    default:
      return num(order.dyedQuantity) > EPS ? 'IN_PROGRESS' : 'PENDING';
  }
}

/** Quantity of the task still to forward (done or not), in its own unit. A Dyeing order is told apart by its orderNumber. */
export function reworkRemaining(task) {
  const dyeing = Boolean(task.orderNumber);
  const received = task.receivedQuantity == null ? num(dyeing ? task.requiredQuantity : task.expectedQuantity) : num(task.receivedQuantity);
  const gone = dyeing ? num(task.sentToQc1Quantity) : num(task.transferredQuantity) + num(task.defectQuantity);
  return Math.max(0, Math.round((received - gone) * 1000) / 1000);
}
