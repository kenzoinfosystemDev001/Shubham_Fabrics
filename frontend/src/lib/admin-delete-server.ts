import { prisma } from '@shubham/database';
import type { AuthenticatedUser } from '@/lib/auth/require-user';
import { WorkRequestError, round } from '@/lib/work-items-server';
import { isQcItem, qcStatusOf, statusAfterTransfer } from '@/lib/work-items.mjs';
import { allocationStatusOf } from '@/lib/recutting.mjs';
import { statusAfterTransfer as dyeingStatusAfterTransfer } from '@/lib/dyeing-workflow.mjs';
import { MIXED_UNIT, totalsByUnit, unitOf } from '@/lib/challan-units.mjs';
import { STOCK_TRANSACTION_OPTIONS, isStoreOutwardChallan, syncChallanStock } from '@/lib/fabric-stock-ledger';
import { syncItem as syncRecuttingItem } from '@/lib/recutting-server';
import { writeAuditLog } from '@/lib/audit-log';
import { wilcomSheetLabel } from '@/lib/wilcom-sheets';
import { userBelongsToDepartment } from '@/lib/auth/department-access';
import { departmentName } from '@/lib/workflow-views';

// Deletes of one challan or one Production Sheet, done so nothing is left inconsistent.
//
// Administrators: nothing built on the record stops the delete. Everything that depends on it (onward challans,
// department lines, dyeing orders, QC records, HOLDs, packing) is removed with it, following the exact records by id,
// with every quantity rolled back; see "Administrator deletes" below.
//
// The issuing department (before receipt): deleting a challan removes it with everything that exists only because of it, and rolls back what it changed
// elsewhere, in one transaction:
// - the sending side gets the quantity back (the department line, Recutting allocation or dyeing order it was
//   issued from), and Fabric Store stock it issued returns to the store (MTR and PCS apart);
// - the receiving side's records of it go: the department lines received on it (with their inspections, photos and
//   HOLDs), its dyeing orders (with their HOLDs), QC inspections, production logs, defects, bundles and shrinkage.
// When later work was built on the challan (a challan issued onward from its lines, QC results sent on, packing),
// deleting it would leave that work pointing at nothing, so the delete is refused and names what to delete first.
// Deleting from the end of the chain backwards keeps every count right.
//
// Deleting a Production Sheet (administrators only once it has challans) removes its challan lines with everything
// built on them, then the sheet with its own records (Wilcom designs are stored in the sheet). Lines of other sheets
// are never removed: a challan shared with another sheet keeps that sheet's lines.
//
// Every delete needs a reason and is written to the audit log with a snapshot; audit rows are never deleted.

const TX = { maxWait: 15000, timeout: 60000 };
const QC_OUTPUT_TYPES = ['REWORK_RETURN', 'QC1_TO_EMBROIDERY'];
const INACTIVE = ['CANCELLED', 'REJECTED'];

type Db = typeof prisma | Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const sheetRef = (p: { programSerialNo?: string | null; programNumber?: string | null } | null | undefined) => p?.programSerialNo || p?.programNumber || '—';

/** Totals per unit as "120 MTR · 40 PCS" (units are never added together). */
const totalsText = (items: Array<{ quantity: number; uom: string }>) => {
  const totals = totalsByUnit(items, null) as Record<string, number>;
  return Object.keys(totals).length ? Object.entries(totals).map(([u, q]) => `${round(q)} ${u}`).join(' · ') : '—';
};

/** Everything about one challan that a delete would remove, roll back, or be stopped by. */
async function challanFacts(db: Db, id: string) {
  const challan = await db.challan.findUnique({
    where: { id },
    include: {
      items: { orderBy: { createdAt: 'asc' } },
      program: { select: { id: true, programNumber: true, programSerialNo: true, designNumber: true } },
      _count: { select: { productionLogs: true, inspections: true, defects: true, bundles: true } },
    },
  });
  if (!challan) return null;
  const itemIds = challan.items.map((i) => i.id);
  const [workItems, orders, derived, qcOutputs, sentFrom, dyedFrom] = await Promise.all([
    db.departmentWorkItem.findMany({
      where: { inboundChallanId: id },
      select: {
        id: true,
        itemNumber: true,
        status: true,
        // A rework task (QC REWORK routed without a challan) shares this challan and is removed with it, so it is
        // not a "later department line"; once forwarded, its onward challan blocks the delete below.
        _count: { select: { transfers: true, packingAllocations: true, downstreamWorkItems: { where: { origin: { not: 'REWORK' } } }, inspections: true } },
      },
    }),
    db.dyeingOrder.findMany({ where: { inboundChallanId: id }, select: { id: true, orderNumber: true, status: true, _count: { select: { qcTransfers: true } } } }),
    db.challanItem.findMany({ where: { sourceChallanItemId: { in: itemIds } }, select: { challan: { select: { id: true, challanNumber: true, status: true, fromDepartment: true } } } }),
    db.challan.findMany({ where: { parentChallanId: id, challanType: { in: QC_OUTPUT_TYPES } }, select: { id: true, challanNumber: true, status: true, fromDepartment: true } }),
    db.departmentWorkTransfer.findMany({ where: { challanItemId: { in: itemIds } }, select: { id: true } }),
    db.dyeingQcTransfer.findMany({ where: { challanItemId: { in: itemIds } }, select: { id: true } }),
  ]);
  // Onward challans issued from the work received on this challan.
  const onwardTransfers = workItems.some((w) => w._count.transfers > 0)
    ? await db.departmentWorkTransfer.findMany({
        where: { workItemId: { in: workItems.map((w) => w.id) } },
        select: { challan: { select: { id: true, challanNumber: true, status: true, fromDepartment: true } } },
      })
    : [];
  const onwardDyeing = orders.some((o) => o._count.qcTransfers > 0)
    ? await db.dyeingQcTransfer.findMany({
        where: { dyeingOrderId: { in: orders.map((o) => o.id) } },
        select: { challan: { select: { id: true, challanNumber: true, status: true, fromDepartment: true } } },
      })
    : [];

  const dependants = new Map<string, { challanNumber: string; fromDepartment: string }>();
  for (const c of [...derived.map((d) => d.challan), ...qcOutputs, ...onwardTransfers.map((t) => t.challan), ...onwardDyeing.map((t) => t.challan)]) {
    if (c && c.id !== id && !INACTIVE.includes(c.status)) dependants.set(c.id, { challanNumber: c.challanNumber, fromDepartment: c.fromDepartment });
  }
  const blockers: string[] = [];
  if (dependants.size) {
    blockers.push(
      `Challan${dependants.size === 1 ? '' : 's'} ${Array.from(dependants.values()).map((d) => `${d.challanNumber} (${d.fromDepartment})`).join(', ')} ${dependants.size === 1 ? 'was' : 'were'} issued onward from this challan. Delete ${dependants.size === 1 ? 'it' : 'them'} first.`,
    );
  }
  const packed = workItems.filter((w) => w._count.packingAllocations > 0);
  if (packed.length) blockers.push(`Inventory has sent ${packed.map((w) => w.itemNumber).join(', ')} for packing. Remove that packing first.`);
  const linked = workItems.filter((w) => w._count.downstreamWorkItems > 0 && w._count.transfers === 0);
  if (linked.length) blockers.push(`Later department lines were issued from ${linked.map((w) => w.itemNumber).join(', ')}. Delete those challans first.`);

  const mtrPcs = totalsText(challan.items);
  // Lines the receiving department has already received (department lines, dyeing orders, or the challan itself).
  const receivedLines =
    workItems.filter((w) => w.status !== 'AWAITING_RECEIPT').length + orders.filter((o) => o.status !== 'AWAITING_RECEIPT').length;
  const received = Boolean(challan.receivedDate) || receivedLines > 0 || !['DRAFT', 'SUBMITTED', 'ISSUED', 'IN_TRANSIT', ...INACTIVE].includes(challan.status);
  return {
    challan,
    received,
    blockers,
    summary: {
      id: challan.id,
      challanNumber: challan.challanNumber,
      fromDepartment: challan.fromDepartment,
      toDepartment: challan.toDepartment,
      status: challan.status,
      productionSheet: sheetRef(challan.program),
      designNumber: challan.program?.designNumber || null,
      serialNumber: challan.program?.programSerialNo || null,
      itemCount: challan.items.length,
      quantity: mtrPcs,
      quantityByUnit: totalsByUnit(challan.items, null),
    },
    effects: [
      sentFrom.length || dyedFrom.length ? `The quantity goes back to the ${challan.fromDepartment} line${sentFrom.length + dyedFrom.length === 1 ? '' : 's'} it was issued from.` : null,
      ['STORE'].includes(String(challan.fromDepartment).toUpperCase()) ? `Fabric Store stock issued on it (${mtrPcs}) returns to the store.` : null,
      workItems.length ? `${workItems.length} ${challan.toDepartment} line${workItems.length === 1 ? '' : 's'} received on it ${workItems.length === 1 ? 'is' : 'are'} removed, with ${workItems.length === 1 ? 'its' : 'their'} inspections, photos and HOLDs.` : null,
      orders.length ? `${orders.length} dyeing order${orders.length === 1 ? '' : 's'} (${orders.map((o) => o.orderNumber).join(', ')}) ${orders.length === 1 ? 'is' : 'are'} removed with ${orders.length === 1 ? 'its' : 'their'} HOLDs.` : null,
      challan._count.inspections || challan._count.productionLogs ? `${challan._count.inspections} QC inspection(s) and ${challan._count.productionLogs} production record(s) on it are removed.` : null,
      challan._count.defects ? `${challan._count.defects} defect record(s) on it are removed.` : null,
    ].filter(Boolean) as string[],
    workItemIds: workItems.map((w) => w.id),
    orderIds: orders.map((o) => o.id),
  };
}

/**
 * Who may delete a challan: an administrator, or the department that issued it while the receiving department has
 * not received it yet (afterwards the receiver first deletes its receipt). A receiving department never deletes
 * the sender's challan.
 */
function permissionBlockers(facts: NonNullable<Awaited<ReturnType<typeof challanFacts>>>, user: AuthenticatedUser): string[] {
  if (user.isAdmin) return [];
  const { fromDepartment, toDepartment } = facts.challan;
  if (!userBelongsToDepartment(user, fromDepartment)) {
    return [`Only ${departmentName(fromDepartment)} (the department that issued it) or an administrator can delete this challan.`];
  }
  if (facts.received) {
    return [`${departmentName(toDepartment)} has already received this challan. ${departmentName(toDepartment)} must first delete its received entry, or an administrator can delete the challan.`];
  }
  return [];
}

/** What deleting the challan would do (for the confirmation dialog), or why this user cannot delete it yet. */
export async function challanDeleteImpact(id: string, user: AuthenticatedUser) {
  const facts = await challanFacts(prisma, id);
  if (!facts) throw new WorkRequestError('Challan not found.', 404);
  if (user.isAdmin) return adminChallanImpact(facts);
  return {
    ...facts.summary,
    fromDepartmentName: departmentName(facts.challan.fromDepartment),
    toDepartmentName: departmentName(facts.challan.toDepartment),
    received: facts.received,
    warning: facts.received ? `${departmentName(facts.challan.toDepartment)} has already received this challan; deleting it also removes that receipt.` : null,
    blockers: [...permissionBlockers(facts, user), ...facts.blockers],
    effects: facts.effects,
  };
}

/** Rolls back the sending side of a challan's lines (the quantity returns to the line it was issued from). */
async function returnToSenders(tx: any, itemIds: string[]) {
  const touchedRecutting = new Set<string>();
  const transfers = await tx.departmentWorkTransfer.findMany({ where: { challanItemId: { in: itemIds } } });
  for (const t of transfers) {
    if (t.allocationId) {
      const a = await tx.workItemAllocation.findUnique({ where: { id: t.allocationId } });
      if (a && unitOf(t.uom) === unitOf(a.cutUom)) {
        const after = Math.max(0, round(a.transferredQuantity - t.quantity));
        await tx.workItemAllocation.update({ where: { id: a.id }, data: { transferredQuantity: after, status: allocationStatusOf({ ...a, transferredQuantity: after }) } });
      }
      touchedRecutting.add(t.workItemId);
    } else {
      const w = await tx.departmentWorkItem.findUnique({ where: { id: t.workItemId } });
      if (w) {
        const field = t.kind === 'REJECT' ? 'rejectSentQuantity' : t.kind === 'REWORK' ? 'reworkSentQuantity' : 'transferredQuantity';
        const after = Math.max(0, round((w as any)[field] - t.quantity));
        const next = { ...w, [field]: after };
        const status = isQcItem(w) ? qcStatusOf(next) : field === 'transferredQuantity' ? statusAfterTransfer(w, after) : w.status;
        await tx.departmentWorkItem.update({ where: { id: w.id }, data: { [field]: after, status } });
      }
    }
    await tx.departmentWorkTransfer.delete({ where: { id: t.id } });
  }
  const dyed = await tx.dyeingQcTransfer.findMany({ where: { challanItemId: { in: itemIds } } });
  for (const d of dyed) {
    const o = await tx.dyeingOrder.findUnique({ where: { id: d.dyeingOrderId } });
    if (o) {
      const after = Math.max(0, round(o.sentToQc1Quantity - d.quantity));
      await tx.dyeingOrder.update({ where: { id: o.id }, data: { sentToQc1Quantity: after, status: dyeingStatusAfterTransfer(o, after) } });
    }
    await tx.dyeingQcTransfer.delete({ where: { id: d.id } });
  }
  for (const itemId of touchedRecutting) {
    if (await tx.departmentWorkItem.findUnique({ where: { id: itemId }, select: { id: true } })) await syncRecuttingItem(tx, itemId);
  }
}

/** Removes one challan and everything that exists only because of it (see the notes at the top). */
async function removeChallan(tx: any, facts: NonNullable<Awaited<ReturnType<typeof challanFacts>>>, actorId: string) {
  const id = facts.challan.id;
  const itemIds = facts.challan.items.map((i) => i.id);

  await returnToSenders(tx, itemIds);
  await syncChallanStock(tx, id, actorId, { removed: true });

  // Receiving side. HOLDs name their source by id; their events go with them.
  const holdSources = [
    ...facts.workItemIds.map((sid) => ({ sourceType: 'WORK_ITEM', sourceId: sid })),
    ...facts.orderIds.map((sid) => ({ sourceType: 'DYEING_ORDER', sourceId: sid })),
    { sourceType: 'QC1_CHALLAN', sourceId: id },
  ];
  await tx.departmentHold.deleteMany({ where: { OR: holdSources } });
  await tx.departmentWorkItem.deleteMany({ where: { id: { in: facts.workItemIds } } });
  await tx.dyeingOrder.deleteMany({ where: { id: { in: facts.orderIds } } });
  await tx.dyeingOrder.updateMany({ where: { qc1ChallanId: id }, data: { qc1ChallanId: null } });

  await tx.productionTransaction.deleteMany({ where: { challanId: id } });
  const inspections = await tx.qualityInspection.findMany({ where: { challanId: id }, select: { id: true } });
  const inspectionIds = inspections.map((i: { id: string }) => i.id);
  if (inspectionIds.length) {
    await tx.defectLog.deleteMany({ where: { inspectionId: { in: inspectionIds } } });
    await tx.qualityInspectionParameter.deleteMany({ where: { inspectionId: { in: inspectionIds } } });
  }
  await tx.qualityInspection.deleteMany({ where: { challanId: id } });
  await tx.defectRecord.deleteMany({ where: { challanId: id } });
  const bundles = await tx.bundle.findMany({ where: { challanId: id }, select: { id: true } });
  if (bundles.length) await tx.cartonBundle.deleteMany({ where: { bundleId: { in: bundles.map((b: { id: string }) => b.id) } } });
  await tx.bundle.deleteMany({ where: { challanId: id } });

  // Other challans keep their own records; only the link back to this one is cleared.
  await tx.challan.updateMany({ where: { parentChallanId: id }, data: { parentChallanId: null } });
  await tx.challanItem.deleteMany({ where: { challanId: id } });
  await tx.challanEvent.deleteMany({ where: { challanId: id } });
  await tx.challan.delete({ where: { id } });
}

const snapshotOf = (facts: NonNullable<Awaited<ReturnType<typeof challanFacts>>>) => ({
  ...facts.summary,
  issuedDate: facts.challan.issuedDate,
  createdById: facts.challan.createdById,
  remarks: facts.challan.remarks,
  items: facts.challan.items.map((i) => ({
    id: i.id,
    fabric: i.fabricCode || i.itemDescription,
    colour: i.colour,
    quantity: i.quantity,
    uom: i.uom,
    programId: i.programId,
  })),
  effects: facts.effects,
});

/**
 * Deletes one challan: an administrator, or the issuing department before the challan is received (refused while
 * later work depends on it). Checked again inside the transaction, so a receipt saved meanwhile stops it.
 */
export async function deleteChallanAsAdmin(id: string, reason: string | null | undefined, user: AuthenticatedUser) {
  const why = typeof reason === 'string' ? reason.trim().slice(0, 500) : '';
  // Administrators confirm in the dialog without a reason; a department deleting its own challan gives one.
  if (!why && !user.isAdmin) throw new WorkRequestError('Enter the reason for deleting this challan.');
  return prisma.$transaction(async (tx) => {
    const facts = await challanFacts(tx, id);
    if (!facts) throw new WorkRequestError('Challan not found.', 404);
    if (user.isAdmin) {
      const plan = await buildDeletePlan(tx, { challanIds: [id] });
      const removed = await describePlan(tx, plan, facts.challan.programId);
      await executeDeletePlan(tx, plan, user.id, why || null);
      await writeAuditLog(tx, {
        actorId: user.id,
        action: 'CHALLAN_DELETED',
        entity: 'Challan',
        entityId: id,
        before: { ...snapshotOf(facts), stockAdjustments: { fabricStoreReturned: removed.storeReturnByUnit }, removed, reason: why || null },
      });
      return facts.summary;
    }
    const denied = permissionBlockers(facts, user);
    if (denied.length) throw new WorkRequestError(denied.join(' '), 403);
    if (facts.blockers.length) throw new WorkRequestError(`Challan ${facts.challan.challanNumber} cannot be deleted yet. ${facts.blockers.join(' ')}`, 409);
    await removeChallan(tx, facts, user.id);
    await writeAuditLog(tx, { actorId: user.id, action: 'CHALLAN_DELETED', entity: 'Challan', entityId: id, before: { ...snapshotOf(facts), reason: why } });
    return facts.summary;
  }, { ...TX, ...STOCK_TRANSACTION_OPTIONS, timeout: 120000 });
}

/** An administrator's view of a challan delete: everything that goes with it, and nothing that stops it. */
async function adminChallanImpact(facts: NonNullable<Awaited<ReturnType<typeof challanFacts>>>) {
  const plan = await buildDeletePlan(prisma, { challanIds: [facts.challan.id] });
  const details = await describePlan(prisma, plan, facts.challan.programId);
  const onward = details.challans.filter((c) => c.id !== facts.challan.id);
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  return {
    ...facts.summary,
    fromDepartmentName: departmentName(facts.challan.fromDepartment),
    toDepartmentName: departmentName(facts.challan.toDepartment),
    received: facts.received,
    warning: facts.received ? `${departmentName(facts.challan.toDepartment)} has already received this challan; deleting it also removes that receipt and everything done with it since.` : null,
    blockers: [] as string[],
    effects: [
      ...facts.effects,
      onward.length
        ? `${plural(onward.length, 'later challan')} built on it ${onward.length === 1 ? 'is' : 'are'} rolled back too: ${onward
            .map((c) => `${c.challanNumber} (${c.whole ? 'deleted' : `${c.removedLines} of ${c.removedLines + c.keptLines} lines removed`})`)
            .join(', ')}.`
        : null,
      details.departmentLines.length > facts.workItemIds.length
        ? `${plural(details.departmentLines.length, 'department line')} in all ${details.departmentLines.length === 1 ? 'is' : 'are'} removed (${details.linesByDepartment.map((d) => `${d.department} ${d.count}`).join(', ')}).`
        : null,
      details.packing.length
        ? `Packing ${details.packing.map((p) => `${p.packingNumber} (${p.inventoryLine}, ${p.quantity} PCS)`).join(', ')} ${details.packing.length === 1 ? 'is' : 'are'} removed with ${details.packing.length === 1 ? 'its' : 'their'} Inventory stock entries.`
        : null,
      details.otherSheets.length ? `Lines of other Production Sheets built on this challan are removed too: ${details.otherSheets.join(', ')}.` : null,
    ].filter(Boolean) as string[],
    ...details,
  };
}


// ---------------------------------------------------------------- Administrator deletes: the whole dependency chain
//
// An administrator's delete is never stopped by later work. Starting from the exact challan lines being deleted (by
// id, never by design or serial number), the plan follows every record built on them: lines issued onward from them
// (sourceChallanItemId), department lines and dyeing orders received on them, what those forwarded on challans,
// rework tasks and Recutting lines made from them, and packing sent from Inventory lines. Everything found is removed
// in one transaction; quantities go back to whatever line they came from that stays, and Fabric Store stock comes back
// per challan (MTR and PCS apart). A challan loses only the lines in the plan: one that also carries other lines
// (another Production Sheet's) keeps them, and is deleted only when no line is left.

interface PlanChallan {
  id: string;
  challanNumber: string;
  challanType: string;
  programId: string;
  fromDepartment: string;
  toDepartment: string;
  status: string;
  fabricUnit: string | null;
  defectiveUnit: string | null;
  defectivePieces: number | null;
  items: Array<{ id: string; programId: string | null; quantity: number; uom: string }>;
  removedItemIds: string[];
  /** Every line goes, so the challan goes too. */
  whole: boolean;
}

interface DeletePlan {
  itemIds: Set<string>;
  workItemIds: Set<string>;
  orderIds: Set<string>;
  challans: PlanChallan[];
}

const MAX_PLAN_ROUNDS = 200;

async function buildDeletePlan(db: Db, seed: { itemIds?: string[]; challanIds?: string[] }): Promise<DeletePlan> {
  const itemIds = new Set<string>();
  const workItemIds = new Set<string>();
  const orderIds = new Set<string>();
  const wholeIds = new Set<string>();
  let lines: string[] = [];
  let works: string[] = [];
  let orders: string[] = [];
  let wholes: string[] = [];
  const add = (set: Set<string>, queue: string[], id: string | null | undefined) => {
    if (id && !set.has(id)) {
      set.add(id);
      queue.push(id);
    }
  };
  for (const id of seed.itemIds || []) add(itemIds, lines, id);
  for (const id of seed.challanIds || []) add(wholeIds, wholes, id);

  let challans: PlanChallan[] = [];
  for (let round = 0; ; round++) {
    if (round > MAX_PLAN_ROUNDS) throw new WorkRequestError('This record is linked to too many others to delete in one step.', 409);
    if (wholes.length) {
      const ids = wholes;
      wholes = [];
      const [items, received, dyed, qcOutputs] = await Promise.all([
        db.challanItem.findMany({ where: { challanId: { in: ids } }, select: { id: true } }),
        db.departmentWorkItem.findMany({ where: { inboundChallanId: { in: ids } }, select: { id: true } }),
        db.dyeingOrder.findMany({ where: { inboundChallanId: { in: ids } }, select: { id: true } }),
        // QC results sent on from the challan; older ones are linked to it only as their parent.
        db.challan.findMany({ where: { parentChallanId: { in: ids }, challanType: { in: QC_OUTPUT_TYPES } }, select: { id: true } }),
      ]);
      items.forEach((i) => add(itemIds, lines, i.id));
      received.forEach((w) => add(workItemIds, works, w.id));
      dyed.forEach((o) => add(orderIds, orders, o.id));
      qcOutputs.forEach((c) => add(wholeIds, wholes, c.id));
      continue;
    }
    if (lines.length) {
      const ids = lines;
      lines = [];
      const [derived, received, dyed] = await Promise.all([
        db.challanItem.findMany({ where: { sourceChallanItemId: { in: ids } }, select: { id: true } }),
        db.departmentWorkItem.findMany({ where: { inboundChallanItemId: { in: ids } }, select: { id: true } }),
        db.dyeingOrder.findMany({ where: { OR: [{ inboundChallanItemId: { in: ids } }, { reworkChallanItemId: { in: ids } }] }, select: { id: true } }),
      ]);
      derived.forEach((i) => add(itemIds, lines, i.id));
      received.forEach((w) => add(workItemIds, works, w.id));
      dyed.forEach((o) => add(orderIds, orders, o.id));
      continue;
    }
    if (works.length) {
      const ids = works;
      works = [];
      const [transfers, downstream] = await Promise.all([
        db.departmentWorkTransfer.findMany({ where: { workItemId: { in: ids } }, select: { challanItemId: true } }),
        // Rework tasks and Recutting lines made from these lines (with or without a challan of their own).
        db.departmentWorkItem.findMany({
          where: { OR: [{ sourceWorkItemId: { in: ids } }, { reworkSourceItemId: { in: ids } }, { sourceAllocation: { workItemId: { in: ids } } }] },
          select: { id: true, inboundChallanItemId: true, origin: true },
        }),
      ]);
      transfers.forEach((t) => add(itemIds, lines, t.challanItemId));
      for (const w of downstream) {
        add(workItemIds, works, w.id);
        // A rework task shares the incoming line of the QC line it came from; other lines came on their own line.
        if (w.origin !== 'REWORK') add(itemIds, lines, w.inboundChallanItemId);
      }
      continue;
    }
    if (orders.length) {
      const ids = orders;
      orders = [];
      const sent = await db.dyeingQcTransfer.findMany({ where: { dyeingOrderId: { in: ids } }, select: { challanItemId: true } });
      sent.forEach((t) => add(itemIds, lines, t.challanItemId));
      continue;
    }

    // Nothing new to follow: see which challans lose every line. Those go as a whole, which can reach a little more
    // (records tied only to the challan), so the walk continues until nothing changes.
    const touched = itemIds.size ? await db.challanItem.findMany({ where: { id: { in: [...itemIds] } }, select: { challanId: true } }) : [];
    const ids = Array.from(new Set([...wholeIds, ...touched.map((t) => t.challanId)]));
    const rows = ids.length
      ? await db.challan.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            challanNumber: true,
            challanType: true,
            programId: true,
            fromDepartment: true,
            toDepartment: true,
            status: true,
            fabricUnit: true,
            defectiveUnit: true,
            defectivePieces: true,
            items: { select: { id: true, programId: true, quantity: true, uom: true } },
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];
    challans = rows.map((c) => {
      const removedItemIds = c.items.filter((i) => itemIds.has(i.id)).map((i) => i.id);
      return { ...c, removedItemIds, whole: wholeIds.has(c.id) || removedItemIds.length === c.items.length };
    });
    const newlyWhole = challans.filter((c) => c.whole && !wholeIds.has(c.id));
    if (!newlyWhole.length) break;
    newlyWhole.forEach((c) => add(wholeIds, wholes, c.id));
  }
  return { itemIds, workItemIds, orderIds, challans };
}

/** What a plan removes, in words and numbers, for the confirmation dialog and the deletion history snapshot. */
async function describePlan(db: Db, plan: DeletePlan, targetProgramId: string | null) {
  const workIds = [...plan.workItemIds];
  const orderIds = [...plan.orderIds];
  const wholeIds = plan.challans.filter((c) => c.whole).map((c) => c.id);
  const [works, orders, packing, holds, qcInspections, productionLogs] = await Promise.all([
    workIds.length
      ? db.departmentWorkItem.findMany({
          where: { id: { in: workIds } },
          select: { id: true, itemNumber: true, departmentCode: true, programId: true, status: true, uom: true, receivedQuantity: true, expectedQuantity: true },
        })
      : [],
    orderIds.length
      ? db.dyeingOrder.findMany({ where: { id: { in: orderIds } }, select: { id: true, orderNumber: true, programId: true, status: true, uom: true, requiredQuantity: true } })
      : [],
    workIds.length
      ? db.packingAllocation.findMany({
          where: { workItemId: { in: workIds } },
          select: { id: true, packingNumber: true, quantity: true, packedQuantity: true, returnedQuantity: true, status: true, workItem: { select: { itemNumber: true } } },
          orderBy: { createdAt: 'asc' },
        })
      : [],
    workIds.length || orderIds.length || wholeIds.length
      ? db.departmentHold.count({
          where: {
            OR: [
              { sourceType: 'WORK_ITEM', sourceId: { in: workIds } },
              { sourceType: 'DYEING_ORDER', sourceId: { in: orderIds } },
              { sourceType: 'QC1_CHALLAN', sourceId: { in: wholeIds } },
            ],
          },
        })
      : 0,
    wholeIds.length ? db.qualityInspection.count({ where: { challanId: { in: wholeIds } } }) : 0,
    wholeIds.length ? db.productionTransaction.count({ where: { challanId: { in: wholeIds } } }) : 0,
  ]);

  const removedLines = plan.challans.flatMap((c) =>
    c.items.filter((i) => plan.itemIds.has(i.id)).map((i) => ({ ...i, sheetId: i.programId || c.programId, challan: c })),
  );
  const storeLines = removedLines.filter((l) => isStoreOutwardChallan(l.challan));
  const byDepartment: Record<string, number> = {};
  for (const w of works) byDepartment[w.departmentCode] = (byDepartment[w.departmentCode] || 0) + 1;
  if (orders.length) byDepartment.DYEING = (byDepartment.DYEING || 0) + orders.length;

  // Lines of other Production Sheets that the plan reaches (built on this material) are named, never hidden.
  const otherIds = new Set<string>();
  if (targetProgramId) {
    for (const l of removedLines) if (l.sheetId !== targetProgramId) otherIds.add(l.sheetId);
    for (const r of [...works, ...orders]) if (r.programId !== targetProgramId) otherIds.add(r.programId);
  }
  const otherSheets = otherIds.size
    ? (await db.program.findMany({ where: { id: { in: [...otherIds] } }, select: { programNumber: true, programSerialNo: true } })).map(sheetRef)
    : [];

  return {
    challans: plan.challans.map((c) => {
      const removed = c.items.filter((i) => plan.itemIds.has(i.id));
      return {
        id: c.id,
        challanNumber: c.challanNumber,
        fromDepartment: c.fromDepartment,
        toDepartment: c.toDepartment,
        whole: c.whole,
        removedLines: removed.length,
        keptLines: c.items.length - removed.length,
        quantity: totalsText(removed),
        quantityByUnit: totalsByUnit(removed, null),
      };
    }),
    departmentLines: works.map((w) => ({
      itemNumber: w.itemNumber,
      department: departmentName(w.departmentCode),
      status: w.status,
      quantity: `${round(w.receivedQuantity ?? w.expectedQuantity)} ${w.uom}`,
    })),
    dyeingOrders: orders.map((o) => ({ orderNumber: o.orderNumber, status: o.status, quantity: `${round(o.requiredQuantity)} ${o.uom}` })),
    packing: packing.map((a) => ({
      packingNumber: a.packingNumber,
      inventoryLine: a.workItem.itemNumber,
      quantity: a.quantity,
      packedQuantity: a.packedQuantity,
      returnedQuantity: a.returnedQuantity,
      status: a.status,
    })),
    inventoryLines: works.filter((w) => w.departmentCode === 'INVENTORY').map((w) => w.itemNumber),
    linesByDepartment: Object.entries(byDepartment).map(([code, count]) => ({ department: departmentName(code), count })),
    counts: { holds, qcInspections, productionLogs },
    storeReturn: storeLines.length ? totalsText(storeLines) : null,
    storeReturnByUnit: totalsByUnit(storeLines, null),
    otherSheets,
  };
}

/** Removes everything in the plan (see the notes above). Runs inside the caller's transaction. */
async function executeDeletePlan(tx: any, plan: DeletePlan, actorId: string, why: string | null) {
  const itemIds = [...plan.itemIds];
  const workIds = [...plan.workItemIds];
  const orderIds = [...plan.orderIds];
  const whole = plan.challans.filter((c) => c.whole);
  const partial = plan.challans.filter((c) => !c.whole);
  const wholeIds = whole.map((c) => c.id);

  // Senders that stay get their quantity back (senders in the plan are removed below anyway). Fabric Store stock
  // issued on challans that go returns now; challans that keep lines are re-posted once their removed lines are gone.
  await returnToSenders(tx, itemIds);
  for (const c of whole) await syncChallanStock(tx, c.id, actorId, { removed: true });

  // Receiving side: packing and its Inventory stock entries, receipt stock entries, HOLDs, deadline alerts.
  const works = workIds.length ? await tx.departmentWorkItem.findMany({ where: { id: { in: workIds } }, select: { id: true, departmentCode: true } }) : [];
  const packing = workIds.length ? await tx.packingAllocation.findMany({ where: { workItemId: { in: workIds } }, select: { id: true } }) : [];
  const packingIds = packing.map((p: { id: string }) => p.id);
  if (packingIds.length || works.length) {
    await tx.stockLedgerEntry.deleteMany({
      where: {
        OR: [
          { referenceType: 'PACKING', referenceId: { in: packingIds } },
          { idempotencyKey: { in: works.map((w: { id: string; departmentCode: string }) => `${w.departmentCode}_RECEIPT:${w.id}`) } },
        ],
      },
    });
  }
  await tx.packingAllocation.deleteMany({ where: { id: { in: packingIds } } });
  await tx.departmentHold.deleteMany({
    where: {
      OR: [
        { sourceType: 'WORK_ITEM', sourceId: { in: workIds } },
        { sourceType: 'DYEING_ORDER', sourceId: { in: orderIds } },
        { sourceType: 'QC1_CHALLAN', sourceId: { in: wholeIds } },
      ],
    },
  });
  const alerts = await tx.deadlineAlert.findMany({
    where: { OR: [{ challanId: { in: wholeIds } }, { entityId: { in: [...wholeIds, ...orderIds, ...workIds] } }] },
    select: { id: true },
  });
  if (alerts.length) {
    const alertIds = alerts.map((a: { id: string }) => a.id);
    await tx.deadlineAlertDismissal.deleteMany({ where: { alertId: { in: alertIds } } });
    await tx.deadlineAlert.deleteMany({ where: { id: { in: alertIds } } });
  }
  await tx.departmentWorkItem.deleteMany({ where: { id: { in: workIds } } });
  await tx.dyeingOrder.deleteMany({ where: { id: { in: orderIds } } });

  // Challans that keep other lines: only the plan's lines go; stock and header totals follow the remaining lines.
  for (const c of partial) {
    const removed = c.items.filter((i) => c.removedItemIds.includes(i.id));
    const remaining = c.items.filter((i) => !c.removedItemIds.includes(i.id));
    await tx.challanItem.deleteMany({ where: { id: { in: c.removedItemIds } } });
    await syncChallanStock(tx, c.id, actorId);
    const totals = totalsByUnit(remaining, c.fabricUnit) as Record<string, number>;
    const units = Object.keys(totals);
    const defective = units.length === 1 && unitOf(c.defectiveUnit || c.fabricUnit) === units[0] ? Number(c.defectivePieces) || 0 : 0;
    await tx.challan.update({
      where: { id: c.id },
      data:
        units.length === 1
          ? { fabricUnit: units[0], fabricOut: totals[units[0]], fabricIn: round(totals[units[0]] + defective) }
          : { fabricUnit: MIXED_UNIT, fabricOut: null, fabricIn: null },
    });
    await tx.challanEvent.create({
      data: {
        challanId: c.id,
        fromStatus: c.status,
        toStatus: c.status,
        action: 'LINES_DELETED',
        actorId,
        reason: why,
        notes: `Administrator delete removed ${removed.length} line(s) (${totalsText(removed)}); ${remaining.length} line(s) kept.`,
      },
    });
  }

  // Challans that go: their own records, then the challans. Other challans only lose their link back to them.
  if (wholeIds.length) {
    await tx.dyeingOrder.updateMany({ where: { qc1ChallanId: { in: wholeIds } }, data: { qc1ChallanId: null } });
    await tx.productionTransaction.deleteMany({ where: { challanId: { in: wholeIds } } });
    const inspections = await tx.qualityInspection.findMany({ where: { challanId: { in: wholeIds } }, select: { id: true } });
    const inspectionIds = inspections.map((i: { id: string }) => i.id);
    if (inspectionIds.length) {
      await tx.defectLog.deleteMany({ where: { inspectionId: { in: inspectionIds } } });
      await tx.qualityInspectionParameter.deleteMany({ where: { inspectionId: { in: inspectionIds } } });
    }
    await tx.qualityInspection.deleteMany({ where: { challanId: { in: wholeIds } } });
    await tx.defectRecord.deleteMany({ where: { challanId: { in: wholeIds } } });
    const bundles = await tx.bundle.findMany({ where: { challanId: { in: wholeIds } }, select: { id: true } });
    if (bundles.length) await tx.cartonBundle.deleteMany({ where: { bundleId: { in: bundles.map((b: { id: string }) => b.id) } } });
    await tx.bundle.deleteMany({ where: { challanId: { in: wholeIds } } });
    await tx.challan.updateMany({ where: { parentChallanId: { in: wholeIds } }, data: { parentChallanId: null } });
    await tx.challanItem.deleteMany({ where: { challanId: { in: wholeIds } } });
    await tx.challanEvent.deleteMany({ where: { challanId: { in: wholeIds } } });
    await tx.challan.deleteMany({ where: { id: { in: wholeIds } } });
  }
}

/** The lines a Production Sheet owns: lines naming it, and older lines without a sheet on its own challans. */
async function sheetSeed(db: Db, programId: string) {
  const [items, empty] = await Promise.all([
    db.challanItem.findMany({ where: { OR: [{ programId }, { programId: null, challan: { programId } }] }, select: { id: true } }),
    db.challan.findMany({ where: { programId, items: { none: {} } }, select: { id: true } }),
  ]);
  return { itemIds: items.map((i) => i.id), challanIds: empty.map((c) => c.id) };
}

/** What deleting the Production Sheet would remove (for the confirmation dialog). Nothing is changed. */
export async function programDeleteImpact(id: string) {
  const program = await prisma.program.findUnique({
    where: { id },
    select: { id: true, programNumber: true, programSerialNo: true, designNumber: true, status: true, metadataJson: true, mainStyle: true, styleCode: true },
  });
  if (!program) throw new WorkRequestError('Production Sheet not found.', 404);
  const plan = await buildDeletePlan(prisma, await sheetSeed(prisma, id));
  const details = await describePlan(prisma, plan, id);
  const [sheetLines, sheetOrders, sheetHolds, sheetLogs] = await Promise.all([
    // Records named after the sheet but not reached through a challan line (older data) go with the sheet too.
    prisma.departmentWorkItem.count({ where: { programId: id, id: { notIn: [...plan.workItemIds] } } }),
    prisma.dyeingOrder.count({ where: { programId: id, id: { notIn: [...plan.orderIds] } } }),
    prisma.departmentHold.count({ where: { programId: id } }),
    prisma.productionTransaction.count({ where: { programId: id } }),
  ]);
  let wilcom = 0;
  let productionTypes: string[] = [];
  try {
    const meta = program.metadataJson ? JSON.parse(program.metadataJson) : {};
    wilcom = Array.isArray(meta?.wilcomEntries) ? meta.wilcomEntries.length : 0;
    // The sheet's production types are the keys of its components (TOP, BOTTOM, DUPATTA, custom); none means TOP.
    const components = meta?.components && typeof meta.components === 'object' ? meta.components : null;
    const keys = components ? Object.keys(components).filter((k) => components[k]?.enabled !== false) : [];
    productionTypes = keys.length ? Array.from(new Set(keys.map((k) => wilcomSheetLabel(k, components)))) : ['TOP'];
  } catch {}
  const deleted = details.challans.filter((c) => c.whole);
  const departmentLines = details.departmentLines.length + sheetLines;
  const dyeingOrders = details.dyeingOrders.length + sheetOrders;
  return {
    id: program.id,
    productionSheet: sheetRef(program),
    programNumber: program.programNumber,
    serialNumber: program.programSerialNo,
    designNumber: program.designNumber,
    style: program.mainStyle || program.styleCode || null,
    productionTypes,
    status: program.status,
    challanCount: deleted.length,
    challanNumbers: deleted.map((c) => c.challanNumber),
    sharedChallans: details.challans.filter((c) => !c.whole),
    wilcomCount: wilcom,
    dependentRecords: {
      departmentLines,
      dyeingOrders,
      holds: Math.max(details.counts.holds, sheetHolds),
      qcInspections: details.counts.qcInspections,
      productionLogs: Math.max(details.counts.productionLogs, sheetLogs),
      packingRecords: details.packing.length,
    },
    dependentTotal: details.challans.length + departmentLines + dyeingOrders + details.packing.length,
    ...details,
    highImpact: details.challans.length > 0 || departmentLines > 0 || dyeingOrders > 0,
    // An administrator's delete is not stopped by later work; kept for the dialog's shape.
    blockers: [] as string[],
  };
}

/**
 * Deletes a Production Sheet with everything built on its challan lines (see the notes above) and then the sheet with
 * its own records. `removeSheetRecords` removes the sheet itself and its sheet-only records (the existing route code).
 */
export async function deleteProgramAsAdmin(
  id: string,
  reason: string | null | undefined,
  user: AuthenticatedUser,
  removeSheetRecords: (tx: any) => Promise<void>,
) {
  if (!user.isAdmin) throw new WorkRequestError('Only an administrator can delete a Production Sheet that has challans.', 403);
  // Optional: the administrator confirms in the dialog; a reason sent anyway is kept in the history.
  const why = typeof reason === 'string' ? reason.trim().slice(0, 500) || null : null;
  const impact = await programDeleteImpact(id);

  return prisma.$transaction(async (tx) => {
    // Planned again inside the transaction, so work saved since the dialog opened is included.
    const plan = await buildDeletePlan(tx, await sheetSeed(tx, id));
    const removed = await describePlan(tx, plan, id);
    await executeDeletePlan(tx, plan, user.id, why);

    // Challans of this sheet that keep other sheets' lines move to the sheet of their remaining lines, with their
    // Fabric Store entries, so removing the sheet's own records below leaves the other sheets' stock as it is.
    const kept = await tx.challan.findMany({
      where: { programId: id },
      select: { id: true, challanNumber: true, items: { where: { programId: { not: null } }, select: { programId: true }, take: 1 } },
    });
    for (const c of kept) {
      const owner = c.items[0]?.programId;
      if (!owner || owner === id) {
        throw new WorkRequestError(`Challan ${c.challanNumber} could not be separated from Production Sheet ${impact.productionSheet}. Nothing was deleted.`, 409);
      }
      await tx.challan.update({ where: { id: c.id }, data: { programId: owner } });
      await tx.stockLedgerEntry.updateMany({ where: { referenceId: c.id, programId: id }, data: { programId: owner } });
      await tx.deadlineAlert.updateMany({ where: { challanId: c.id, programId: id }, data: { programId: owner } });
    }

    await removeSheetRecords(tx);
    await writeAuditLog(tx, {
      actorId: user.id,
      action: 'PROGRAM_DELETED',
      entity: 'Program',
      entityId: id,
      before: {
        productionSheet: impact.productionSheet,
        programNumber: impact.programNumber,
        serialNumber: impact.serialNumber,
        designNumber: impact.designNumber,
        style: impact.style,
        productionTypes: impact.productionTypes,
        status: impact.status,
        wilcomCount: impact.wilcomCount,
        dependentRecords: impact.dependentRecords,
        quantity: removed.storeReturn,
        stockAdjustments: { fabricStoreReturned: removed.storeReturnByUnit },
        removed,
        reason: why,
      },
    });
    return impact;
  }, { ...TX, ...STOCK_TRANSACTION_OPTIONS, timeout: 120000 });
}
