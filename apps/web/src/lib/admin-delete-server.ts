import { prisma } from '@shubham/database';
import type { AuthenticatedUser } from '@/lib/auth/require-user';
import { WorkRequestError, round } from '@/lib/work-items-server';
import { isQcItem, qcStatusOf, statusAfterTransfer } from '@/lib/work-items.mjs';
import { allocationStatusOf } from '@/lib/recutting.mjs';
import { statusAfterTransfer as dyeingStatusAfterTransfer } from '@/lib/dyeing-workflow.mjs';
import { totalsByUnit, unitOf } from '@/lib/challan-units.mjs';
import { STOCK_TRANSACTION_OPTIONS, syncChallanStock } from '@/lib/fabric-stock-ledger';
import { syncItem as syncRecuttingItem } from '@/lib/recutting-server';
import { writeAuditLog } from '@/lib/audit-log';
import { wilcomSheetLabel } from '@/lib/wilcom-sheets';
import { userBelongsToDepartment } from '@/lib/auth/department-access';
import { departmentName } from '@/lib/workflow-views';

// Administrator deletes of one challan or one Production Sheet, done so nothing is left inconsistent.
//
// Deleting a challan removes it with everything that exists only because of it, and rolls back what it changed
// elsewhere, in one transaction:
// - the sending side gets the quantity back (the department line, Recutting allocation or dyeing order it was
//   issued from), and Fabric Store stock it issued returns to the store (MTR and PCS apart);
// - the receiving side's records of it go: the department lines received on it (with their inspections, photos and
//   HOLDs), its dyeing orders (with their HOLDs), QC inspections, production logs, defects, bundles and shrinkage.
// When later work was built on the challan (a challan issued onward from its lines, QC results sent on, packing),
// deleting it would leave that work pointing at nothing, so the delete is refused and names what to delete first.
// Deleting from the end of the chain backwards keeps every count right.
//
// Deleting a Production Sheet deletes all of its challans the same way (dependents first), then the sheet with its
// own records (Wilcom designs are stored in the sheet). Records of other sheets are never touched: a sheet whose
// challans also carry lines of another sheet (or the other way round) is refused until those lines are separated.
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
        _count: { select: { transfers: true, packingAllocations: true, downstreamWorkItems: true, inspections: true } },
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
  if (!why) throw new WorkRequestError('Enter the reason for deleting this challan.');
  return prisma.$transaction(async (tx) => {
    const facts = await challanFacts(tx, id);
    if (!facts) throw new WorkRequestError('Challan not found.', 404);
    const denied = permissionBlockers(facts, user);
    if (denied.length) throw new WorkRequestError(denied.join(' '), 403);
    if (facts.blockers.length) throw new WorkRequestError(`Challan ${facts.challan.challanNumber} cannot be deleted yet. ${facts.blockers.join(' ')}`, 409);
    await removeChallan(tx, facts, user.id);
    await writeAuditLog(tx, { actorId: user.id, action: 'CHALLAN_DELETED', entity: 'Challan', entityId: id, before: { ...snapshotOf(facts), reason: why } });
    return facts.summary;
  }, { ...TX, ...STOCK_TRANSACTION_OPTIONS });
}

/** A sheet's challans in delete order: a challan built on another goes first. */
async function sheetChallans(db: Db, programId: string) {
  const challans = await db.challan.findMany({ where: { programId }, select: { id: true, challanNumber: true, createdAt: true }, orderBy: { createdAt: 'desc' } });
  return challans;
}

/** What deleting the Production Sheet would do (for the confirmation dialog), or why it cannot be deleted yet. */
export async function programDeleteImpact(id: string) {
  const program = await prisma.program.findUnique({
    where: { id },
    select: { id: true, programNumber: true, programSerialNo: true, designNumber: true, status: true, metadataJson: true, mainStyle: true, styleCode: true },
  });
  if (!program) throw new WorkRequestError('Production Sheet not found.', 404);
  const challans = await sheetChallans(prisma, id);
  const challanIds = challans.map((c) => c.id);
  const [foreignLines, ownLinesElsewhere, workItems, orders, holds, inspections, productionLogs] = await Promise.all([
    // Lines of other sheets carried on this sheet's challans.
    prisma.challanItem.findMany({ where: { challanId: { in: challanIds }, programId: { not: null }, NOT: { programId: id } }, select: { challan: { select: { challanNumber: true } } } }),
    // This sheet's lines carried on other sheets' challans.
    prisma.challanItem.findMany({ where: { programId: id, challan: { programId: { not: id } } }, select: { challan: { select: { challanNumber: true } } } }),
    prisma.departmentWorkItem.count({ where: { OR: [{ programId: id }, { inboundChallanId: { in: challanIds } }] } }),
    prisma.dyeingOrder.count({ where: { programId: id } }),
    prisma.departmentHold.count({ where: { programId: id } }),
    prisma.qualityInspection.count({ where: { challanId: { in: challanIds } } }),
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
  const blockers: string[] = [];
  const foreign = Array.from(new Set(foreignLines.map((l) => l.challan.challanNumber)));
  if (foreign.length) blockers.push(`Challan${foreign.length === 1 ? '' : 's'} ${foreign.join(', ')} of this sheet also carr${foreign.length === 1 ? 'ies' : 'y'} lines of other Production Sheets. Remove those lines (Edit challan) first.`);
  const elsewhere = Array.from(new Set(ownLinesElsewhere.map((l) => l.challan.challanNumber)));
  if (elsewhere.length) blockers.push(`This sheet has lines on other sheets' challan${elsewhere.length === 1 ? '' : 's'} ${elsewhere.join(', ')}. Remove those lines (Edit challan) first.`);
  return {
    id: program.id,
    productionSheet: sheetRef(program),
    programNumber: program.programNumber,
    serialNumber: program.programSerialNo,
    designNumber: program.designNumber,
    style: program.mainStyle || program.styleCode || null,
    productionTypes,
    status: program.status,
    challanCount: challans.length,
    challanNumbers: challans.map((c) => c.challanNumber),
    wilcomCount: wilcom,
    dependentRecords: { departmentLines: workItems, dyeingOrders: orders, holds, qcInspections: inspections, productionLogs },
    highImpact: challans.length > 0 || workItems > 0 || orders > 0,
    blockers,
  };
}

/**
 * Deletes a Production Sheet with all of its challans (each rolled back as a single challan delete is) and its own
 * records. `removeSheetRecords` removes the sheet itself and its sheet-only records (the existing route code).
 */
export async function deleteProgramAsAdmin(
  id: string,
  reason: string | null | undefined,
  user: AuthenticatedUser,
  removeSheetRecords: (tx: any) => Promise<void>,
) {
  if (!user.isAdmin) throw new WorkRequestError('Only an administrator can delete a Production Sheet that has challans.', 403);
  const why = typeof reason === 'string' ? reason.trim().slice(0, 500) : '';
  if (!why) throw new WorkRequestError('Enter the reason for deleting this Production Sheet.');
  const impact = await programDeleteImpact(id);
  if (impact.blockers.length) throw new WorkRequestError(`Production Sheet ${impact.productionSheet} cannot be deleted yet. ${impact.blockers.join(' ')}`, 409);

  return prisma.$transaction(async (tx) => {
    // Challans built on another challan go first, so every rollback finds its source. Challans of other sheets that
    // were issued onward from this sheet's challans would stop the loop; the blockers above rule out shared lines.
    let remaining = await sheetChallans(tx, id);
    const removed: any[] = [];
    while (remaining.length) {
      let progressed = false;
      for (const c of remaining) {
        const facts = await challanFacts(tx, c.id);
        if (!facts) continue;
        // Only dependants on this same sheet may wait for their turn; anything else blocks the delete.
        if (facts.blockers.length) continue;
        await removeChallan(tx, facts, user.id);
        removed.push(snapshotOf(facts));
        progressed = true;
      }
      const left = await sheetChallans(tx, id);
      if (!progressed && left.length) {
        const facts = await challanFacts(tx, left[0].id);
        throw new WorkRequestError(`Production Sheet ${impact.productionSheet} cannot be deleted yet. ${facts?.blockers.join(' ') || ''}`, 409);
      }
      remaining = left;
    }
    await removeSheetRecords(tx);
    await writeAuditLog(tx, {
      actorId: user.id,
      action: 'PROGRAM_DELETED',
      entity: 'Program',
      entityId: id,
      before: { ...impact, reason: why, challans: removed },
    });
    return impact;
  }, { ...TX, ...STOCK_TRANSACTION_OPTIONS, timeout: 120000 });
}
