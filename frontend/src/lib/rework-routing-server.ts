import { WORKFLOWS, WorkRequestError, round, type WorkflowConfig } from '@/lib/work-items-server';
import type { AuthenticatedUser } from '@/lib/auth/require-user';
import { receivedBasis, statusAfterTransfer } from '@/lib/work-items.mjs';
import { lineSheetId } from '@/lib/challan-sheets.mjs';

// REWORK and REJECT are QC decisions, not challan transfers: neither asks for a challan when it is recorded.
// - REJECT is on the Defective Shelf the moment it is decided. The department shelf, the Fabric Store central
//   shelf and the admin dashboards all read the same inspection record (lib/quality-monitor-server.ts).
// - REWORK becomes a rework task in the department's configured rework destination (cfg.qc.reworkTo), received
//   there straight away with the QC line's Production Sheet, challan and fabric. The rework department works it
//   like any other line and forwards it on its normal Issue Challan screen: that is the only challan involved.
// A QC line's rejectSentQuantity / reworkSentQuantity count what has been routed; older decisions that left on
// REJECT / REWORK challans (DepartmentWorkTransfer) stay counted as they were.

export const REWORK_ORIGIN = 'REWORK';

type Tx = any;

/** Quantity of each kind that left this QC line on REJECT / REWORK challans, before decisions were routed directly. */
async function challanRouted(tx: Tx, itemId: string) {
  const rows: Array<{ kind: string; _sum: { quantity: number | null } }> = await tx.departmentWorkTransfer.groupBy({
    by: ['kind'],
    where: { workItemId: itemId, kind: { in: ['REJECT', 'REWORK'] } },
    _sum: { quantity: true },
  });
  const of = (kind: string) => round(rows.find((r) => r.kind === kind)?._sum.quantity || 0);
  return { reject: of('REJECT'), rework: of('REWORK') };
}

async function nextItemNumber(tx: Tx, prefix: string) {
  const year = new Date().getFullYear();
  const latest = await tx.departmentWorkItem.findFirst({ where: { itemNumber: { startsWith: `${prefix}-${year}-` } }, orderBy: { itemNumber: 'desc' }, select: { itemNumber: true } });
  const seq = (parseInt(latest?.itemNumber.split('-').pop() || '0', 10) || 0) + 1;
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
}

/** What the rework department has not touched yet: received, less processed / taken in / defective, less HOLD. */
export function untouchedRework(task: any) {
  const used = Math.max(round((task.processedQuantity || 0) + (task.defectQuantity || 0)), round(task.takenQuantity || 0));
  return round(Math.max(0, receivedBasis(task) - used - (task.heldQuantity || 0)));
}

/** Status of a rework task after its quantity changed, from its own quantities. */
function taskStatus(task: any) {
  const received = receivedBasis(task);
  const transferred = round(task.transferredQuantity || 0);
  if (transferred > 0) return statusAfterTransfer(task, transferred);
  const processed = round(task.processedQuantity || 0);
  if (processed <= 0 && round(task.takenQuantity || 0) <= 0) return 'RECEIVED';
  if (round(processed + (task.defectQuantity || 0)) >= received) return ['COMPLETED', 'READY_FOR_TRANSFER'].includes(task.status) ? task.status : 'COMPLETED';
  return 'IN_PROGRESS';
}

function reworkConfig(cfg: WorkflowConfig) {
  if (!cfg.qc) throw new WorkRequestError(`${cfg.label} does not inspect.`, 404);
  const dest = (Object.values(WORKFLOWS) as WorkflowConfig[]).find((c) => c.code === cfg.qc!.reworkTo.code);
  if (!dest) throw new WorkRequestError(`No rework department is set up for ${cfg.label}.`);
  return dest;
}

/** The rework task a QC line's REWORK was routed to (one per QC line), if any. */
export function findReworkTask(tx: Tx, cfg: WorkflowConfig, line: { id: string; inboundChallanItemId: string }) {
  return tx.departmentWorkItem.findFirst({ where: { departmentCode: reworkConfig(cfg).code, origin: REWORK_ORIGIN, reworkSourceItemId: line.id } });
}

async function addToReworkTask(tx: Tx, cfg: WorkflowConfig, line: any, quantity: number, reason: string | null, user: AuthenticatedUser) {
  const dest = reworkConfig(cfg);
  const now = new Date();
  const existing = await findReworkTask(tx, cfg, line);
  if (existing) {
    const received = round(receivedBasis(existing) + quantity);
    const next = { ...existing, receivedQuantity: received };
    const res = await tx.departmentWorkItem.updateMany({
      where: { id: existing.id, updatedAt: existing.updatedAt },
      data: {
        expectedQuantity: round(existing.expectedQuantity + quantity),
        receivedQuantity: received,
        status: taskStatus(next),
        completedAt: null,
        ...(reason ? { reworkReason: reason } : {}),
      },
    });
    if (res.count !== 1) throw new WorkRequestError(`${dest.label} changed this rework task just now. Refresh and try again.`, 409);
    return existing;
  }
  // The rework department's line keeps the challan line the QC line came in on (its Production Sheet, fabric and
  // challan), so the challan it is later forwarded on links back to that original line.
  const clash = await tx.departmentWorkItem.findFirst({ where: { departmentCode: dest.code, inboundChallanItemId: line.inboundChallanItemId }, select: { itemNumber: true } });
  if (clash) throw new WorkRequestError(`${dest.label} already has line ${clash.itemNumber} for this challan line; the rework cannot be routed to it.`, 409);
  return tx.departmentWorkItem.create({
    data: {
      departmentCode: dest.code,
      itemNumber: await nextItemNumber(tx, dest.prefix),
      origin: REWORK_ORIGIN,
      reworkSourceItemId: line.id,
      reworkReason: reason,
      programId: line.programId,
      inboundChallanId: line.inboundChallanId,
      inboundChallanItemId: line.inboundChallanItemId,
      sourceDepartment: cfg.code,
      sourceWorkItemId: line.id,
      fabricName: line.fabricName,
      colour: line.colour,
      fabricProcessingStatus: line.fabricProcessingStatus,
      garmentCategory: line.garmentCategory,
      styleRef: line.styleRef,
      sourceAllocationId: line.sourceAllocationId ?? null,
      status: 'RECEIVED',
      priority: line.priority || 'NORMAL',
      uom: line.uom,
      expectedQuantity: quantity,
      receivedQuantity: quantity,
      receivedAt: now,
      receivedById: user.id,
      receiptRemarks: `REWORK from ${cfg.label} (${line.itemNumber})${reason ? `: ${reason}` : ''}`,
    },
  });
}

async function takeFromReworkTask(tx: Tx, cfg: WorkflowConfig, line: any, quantity: number) {
  const dest = reworkConfig(cfg);
  const task = await findReworkTask(tx, cfg, line);
  const free = task ? untouchedRework(task) : 0;
  if (!task || free < quantity) {
    throw new WorkRequestError(
      `${dest.label} has already started on this rework; only ${free} ${line.uom} of it can still change. Quantity already in rework comes back through ${cfg.label} once it is done.`,
      409,
    );
  }
  const received = round(receivedBasis(task) - quantity);
  const untouched = received <= 0 && task.transferredQuantity <= 0 && task.processedQuantity <= 0 && task.takenQuantity <= 0;
  const history = untouched
    ? (await tx.departmentWorkTransfer.count({ where: { workItemId: task.id } })) + (await tx.departmentHold.count({ where: { sourceType: 'WORK_ITEM', sourceId: task.id } }))
    : 1;
  if (untouched && history === 0) {
    // Guarded like the updates: work the rework department saved meanwhile is never deleted with the task.
    const gone = await tx.departmentWorkItem.deleteMany({ where: { id: task.id, updatedAt: task.updatedAt } });
    if (gone.count !== 1) throw new WorkRequestError(`${dest.label} changed this rework task just now. Refresh and try again.`, 409);
    return;
  }
  const res = await tx.departmentWorkItem.updateMany({
    where: { id: task.id, updatedAt: task.updatedAt },
    data: { expectedQuantity: round(Math.max(0, task.expectedQuantity - quantity)), receivedQuantity: received, status: taskStatus({ ...task, receivedQuantity: received }) },
  });
  if (res.count !== 1) throw new WorkRequestError(`${dest.label} changed this rework task just now. Refresh and try again.`, 409);
}

/**
 * Routes a QC line's REJECT and REWORK after its decided totals change (an inspection, an inspection correction or a
 * decision change), inside the caller's transaction: REJECT onto the Defective Shelf, REWORK to the rework task.
 * `after` is the line as it will be saved. Returns the routed counters to save with it. Quantity that left on a
 * challan earlier cannot be taken back here; REWORK already started in the rework department cannot either.
 */
export async function routeQcDecisions(
  tx: Tx,
  cfg: WorkflowConfig,
  before: any,
  after: { rejectedQuantity: number; reworkQuantity: number },
  user: AuthenticatedUser,
  reworkReason: string | null,
) {
  const onChallans = await challanRouted(tx, before.id);
  const reject = round(after.rejectedQuantity);
  const rework = round(after.reworkQuantity);
  if (reject < onChallans.reject) {
    throw new WorkRequestError(`${onChallans.reject} ${before.uom} of the REJECT already went to the Defective Shelf on a challan; REJECT cannot go below that.`);
  }
  if (rework < onChallans.rework) {
    throw new WorkRequestError(`${onChallans.rework} ${before.uom} of the REWORK already went back on a challan; REWORK cannot go below that.`);
  }
  // REWORK routed directly so far (older lines may have rework that was never sent: it is routed now).
  const routedBefore = round(Math.max(0, (before.reworkSentQuantity || 0) - onChallans.rework));
  const routedAfter = round(rework - onChallans.rework);
  const delta = round(routedAfter - routedBefore);
  if (delta > 0) await addToReworkTask(tx, cfg, before, delta, reworkReason, user);
  if (delta < 0) await takeFromReworkTask(tx, cfg, before, -delta);
  return { rejectSentQuantity: reject, reworkSentQuantity: rework };
}

// ---------------------------------------------------------------- Dyeing QC -> Dyeing

async function nextDyeingOrderNumber(tx: Tx) {
  const year = new Date().getFullYear();
  const latest = await tx.dyeingOrder.findFirst({ where: { orderNumber: { startsWith: `DYE-${year}-` } }, orderBy: { orderNumber: 'desc' }, select: { orderNumber: true } });
  const seq = (parseInt(latest?.orderNumber.split('-').pop() || '0', 10) || 0) + 1;
  return `DYE-${year}-${String(seq).padStart(4, '0')}`;
}

/** Dyeing has not started on it: nothing dyed, readied or sent to Dyeing QC, and nothing on HOLD. */
export function untouchedDyeingRework(order: any) {
  if ((order.dyedQuantity || 0) > 0 || (order.undyedQuantity || 0) > 0 || (order.readyForQc1Quantity || 0) > 0 || (order.sentToQc1Quantity || 0) > 0) return 0;
  return round(Math.max(0, (order.receivedQuantity ?? order.requiredQuantity) - (order.heldQuantity || 0)));
}

/**
 * Dyeing QC REWORK: a Dyeing order for the quantity, received in Dyeing straight away (no challan). It keeps the Dyeing
 * QC challan and line it was decided on, its Production Sheet, fabric and colour; Dyeing re-dyes it and sends it back
 * to Dyeing QC on its normal challan.
 */
export async function routeDyeingRework(
  tx: Tx,
  challan: { id: string; challanNumber: string; programId: string; priority?: string | null; program?: { fabricType?: string | null; priority?: string | null } | null },
  line: { id: string; programId?: string | null; fabricCode?: string | null; itemDescription?: string | null; colour?: string | null; shade?: string | null; uom: string },
  quantity: number,
  reason: string,
  user: AuthenticatedUser,
) {
  const incharge = await tx.user.findFirst({
    where: { isActive: true, OR: [{ departmentCode: 'DYEING' }, { userRoles: { some: { role: { code: 'DYEING_INCHARGE' } } } }] },
    select: { id: true, fullName: true, username: true },
  });
  const order = await tx.dyeingOrder.create({
    data: {
      orderNumber: await nextDyeingOrderNumber(tx),
      programId: lineSheetId(line, challan) || challan.programId,
      inboundChallanId: challan.id,
      origin: REWORK_ORIGIN,
      reworkChallanItemId: line.id,
      reworkReason: reason,
      status: 'RECEIVED',
      priority: challan.priority || challan.program?.priority || 'HIGH',
      fabricName: line.fabricCode || line.itemDescription || 'Fabric',
      fabricType: challan.program?.fabricType || null,
      // Re-dyed to the colour it came back with.
      targetColor: line.colour || '',
      colorCode: line.shade || null,
      requiredQuantity: quantity,
      receivedQuantity: quantity,
      receivedAt: new Date(),
      receivedById: user.id,
      receiptRemarks: `REWORK from Dyeing QC (challan ${challan.challanNumber}): ${reason}`,
      uom: line.uom,
      inchargeId: incharge?.id ?? null,
      inchargeName: incharge?.fullName || incharge?.username || null,
      processRemarks: `Dyeing QC rework, decided on challan ${challan.challanNumber}: ${reason}`,
    },
  });
  await tx.program.updateMany({ where: { id: order.programId }, data: { status: 'IN_PRODUCTION' } });
  return order;
}
