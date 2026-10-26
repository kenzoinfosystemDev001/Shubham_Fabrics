import type { Prisma } from '@subham/database';
import {
  addInward,
  addLegacyOutward,
  applyMovement,
  bucketBalance,
  challanStockLines,
  checkDocumentBalances,
  createStockBook,
  isFabricStoreDepartment,
  ledgerIdempotencyKey,
  normalizeFabricStockType,
  normalizeStockUnit,
  planIssue,
  planLedgerAdjustments,
  roundQty,
  stockKey,
} from '@/lib/fabric-stock-rules.mjs';

/**
 * Fabric Store stock in meters and pieces, per fabric, type and colour.
 *
 * Received stock comes from FabricInward rows. Every document that changes stock (inward entry,
 * Fabric Store challan, manual outward) is posted to StockLedgerEntry (department STORE) by
 * reconciling what it should contribute now against what the ledger already holds for it, inside
 * the caller's transaction and under one advisory lock. Issues, edits, cancellations and retries
 * therefore post only the difference, and a change that would take a bucket below zero is refused.
 * Outward documents recorded before the ledger existed are still counted, matched by the same rules.
 */

type Tx = Prisma.TransactionClient;

export const STORE_STOCK_DEPARTMENT = 'STORE';
export const STOCK_REFERENCE = {
  INWARD: 'FABRIC_INWARD',
  CHALLAN: 'CHALLAN',
  OUTWARD: 'FABRIC_OUTWARD',
} as const;
type StockReferenceType = (typeof STOCK_REFERENCE)[keyof typeof STOCK_REFERENCE];

/** Transaction options for stock-changing requests (the stock book is rebuilt inside them). */
export const STOCK_TRANSACTION_OPTIONS = { maxWait: 15000, timeout: 30000 } as const;

// Arbitrary constant shared by every stock-changing transaction.
const FABRIC_STOCK_LOCK_ID = 740_021_337;

/** Refused stock change; routes return it as a 400 with `details`. */
export class FabricStockError extends Error {
  constructor(message: string, readonly details: string[] = []) {
    super(message);
    this.name = 'FabricStockError';
  }
}

/** Serializes stock-changing transactions so two issues cannot both spend the same balance. */
export async function lockFabricStock(tx: Tx): Promise<void> {
  await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${FABRIC_STOCK_LOCK_ID})`);
}

const storeOutwardChallanWhere: Prisma.ChallanWhereInput = {
  NOT: { toDepartment: { equals: 'STORE', mode: 'insensitive' } },
  OR: [
    { fromDepartment: { contains: 'STORE', mode: 'insensitive' } },
    { fromDepartment: { equals: 'FABRIC', mode: 'insensitive' } },
  ],
};

const ACTIVE_CHALLAN_EXCLUDED_STATUSES = ['DRAFT', 'CANCELLED'];

export function isStoreOutwardChallan(challan: { fromDepartment: string; toDepartment: string }) {
  return isFabricStoreDepartment(challan.fromDepartment) && challan.toDepartment.trim().toUpperCase() !== 'STORE';
}

function refId(type: string, id: string) {
  return `${type}:${id}`;
}

export interface StockBookResult {
  book: ReturnType<typeof createStockBook>;
  storeChallans: Array<Prisma.ChallanGetPayload<{ include: { items: true; program: { select: { fabricName: true; designNumber: true; programSerialNo: true; programNumber: true } } } }>>;
  manualOutwards: Array<Prisma.FabricOutwardGetPayload<object>>;
  inwardEntries: Array<Prisma.FabricInwardGetPayload<object>>;
}

/**
 * Builds the stock book. `exclude` leaves one document out entirely (its inward row, its ledger
 * rows or its legacy contribution), which gives the balances a change to that document is
 * checked against.
 */
export async function loadStockBook(
  db: Tx,
  exclude?: { referenceType: StockReferenceType; referenceId: string },
  options: { excludeInwardIds?: Set<string> } = {},
): Promise<StockBookResult> {
  const excluded = exclude ? refId(exclude.referenceType, exclude.referenceId) : null;
  const [inwardEntries, ledgerEntries, storeChallansRaw, manualOutwards] = await Promise.all([
    db.fabricInward.findMany({ orderBy: [{ receivingDate: 'asc' }, { createdAt: 'asc' }] }),
    db.stockLedgerEntry.findMany({
      where: {
        departmentCode: STORE_STOCK_DEPARTMENT,
        referenceType: { in: [STOCK_REFERENCE.CHALLAN, STOCK_REFERENCE.OUTWARD] },
      },
      select: {
        itemCode: true,
        itemName: true,
        colour: true,
        quantity: true,
        referenceType: true,
        referenceId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    db.challan.findMany({
      where: storeOutwardChallanWhere,
      include: {
        items: true,
        program: { select: { fabricName: true, designNumber: true, programSerialNo: true, programNumber: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    db.fabricOutward.findMany({ orderBy: { date: 'asc' } }),
  ]);
  const storeChallans = storeChallansRaw.filter(isStoreOutwardChallan);

  const book = createStockBook();
  for (const inward of inwardEntries) {
    if (excluded === refId(STOCK_REFERENCE.INWARD, inward.id) || options.excludeInwardIds?.has(inward.id)) continue;
    addInward(book, {
      fabric: inward.itemName,
      type: inward.entryType,
      colour: inward.colour,
      unit: inward.unit,
      quantity: inward.billQty,
      date: inward.receivingDate,
    });
  }

  const posted = new Set<string>();
  for (const entry of ledgerEntries) {
    const ref = refId(entry.referenceType, entry.referenceId || '');
    posted.add(ref);
    if (ref === excluded) continue;
    applyMovement(book, entry.itemCode, { fabric: entry.itemName, colour: entry.colour, date: entry.createdAt }, entry.quantity);
  }

  // Outward documents recorded before the ledger: counted from their own lines.
  const challanNumbers = new Set(storeChallans.map((c) => c.challanNumber.trim().toLowerCase()));
  for (const challan of storeChallans) {
    const ref = refId(STOCK_REFERENCE.CHALLAN, challan.id);
    if (ref === excluded || posted.has(ref)) continue;
    if (ACTIVE_CHALLAN_EXCLUDED_STATUSES.includes(challan.status)) continue;
    for (const line of challanStockLines(challan)) {
      addLegacyOutward(book, { ...line, date: challan.issuedDate || challan.createdAt });
    }
  }
  for (const outward of manualOutwards) {
    const ref = refId(STOCK_REFERENCE.OUTWARD, outward.id);
    if (ref === excluded || posted.has(ref) || isChallanMirror(outward, challanNumbers)) continue;
    addLegacyOutward(book, manualOutwardLine(outward));
  }

  return { book, storeChallans, manualOutwards, inwardEntries };
}

/** A manual outward row that only mirrors a Fabric Store challan; the challan already counts. */
export function isChallanMirror(
  outward: { challanId: string | null; challanNumber: string | null },
  storeChallanNumbers: Set<string>,
) {
  return Boolean(outward.challanId) ||
    Boolean(outward.challanNumber && storeChallanNumbers.has(outward.challanNumber.trim().toLowerCase()));
}

function manualOutwardLine(outward: Prisma.FabricOutwardGetPayload<object>) {
  return {
    fabric: outward.itemName,
    type: normalizeFabricStockType(outward.fabricType),
    colour: outward.colour,
    unit: outward.unit,
    quantity: outward.issueQty,
    date: outward.date,
  };
}

interface DesiredMovement {
  key: string;
  quantity: number; // signed: + received, - issued
  itemName: string;
  colour: string | null;
  unit: string;
}

/**
 * Posts the difference between what a document should contribute and what the ledger holds for
 * it. Refuses (FabricStockError) when a reduced bucket would end below zero.
 */
async function postDocument(
  tx: Tx,
  options: {
    referenceType: StockReferenceType;
    referenceId: string;
    desired: DesiredMovement[];
    baseBook: ReturnType<typeof createStockBook>;
    actorId: string;
    programId?: string | null;
    label: string;
  },
) {
  const { referenceType, referenceId, baseBook } = options;
  const desired = new Map<string, number>();
  const meta = new Map<string, DesiredMovement>();
  for (const movement of options.desired) {
    desired.set(movement.key, roundQty((desired.get(movement.key) || 0) + movement.quantity));
    meta.set(movement.key, movement);
  }

  const postedRows = await tx.stockLedgerEntry.findMany({
    where: { departmentCode: STORE_STOCK_DEPARTMENT, referenceType, referenceId },
    select: { itemCode: true, itemName: true, colour: true, uom: true, quantity: true },
  });
  const posted = new Map<string, number>();
  const postedCount = new Map<string, number>();
  for (const row of postedRows) {
    posted.set(row.itemCode, roundQty((posted.get(row.itemCode) || 0) + row.quantity));
    postedCount.set(row.itemCode, (postedCount.get(row.itemCode) || 0) + 1);
    if (!meta.has(row.itemCode)) {
      meta.set(row.itemCode, { key: row.itemCode, quantity: 0, itemName: row.itemName, colour: row.colour, unit: row.uom });
    }
  }

  const adjustments = planLedgerAdjustments(desired, posted);
  if (adjustments.length === 0) return [];

  const baseBalances = new Map(adjustments.map(({ key }) => [key, bucketBalance(baseBook, key)]));
  const { balances, violations } = checkDocumentBalances(baseBalances, desired, adjustments);
  if (violations.length > 0) {
    const details = violations.map(({ key, balance }) => {
      const m = meta.get(key)!;
      const label = [m.itemName, m.colour].filter(Boolean).join(' / ');
      return `${label}: ${Math.max(0, roundQty(baseBalances.get(key) || 0))} ${m.unit} available, this change needs ${roundQty(-(desired.get(key) || 0))} ${m.unit} (would leave ${balance} ${m.unit}).`;
    });
    throw new FabricStockError(`${options.label} would take Fabric Store stock below zero.`, details);
  }

  const isFirstPosting = postedRows.length === 0;
  const created = [];
  for (const { key, delta } of adjustments) {
    const m = meta.get(key)!;
    const revision = postedCount.get(key) || 0;
    created.push(
      await tx.stockLedgerEntry.create({
        data: {
          entryType: isFirstPosting ? (delta > 0 ? 'RECEIPT' : 'ISSUE') : 'ADJUSTMENT',
          departmentCode: STORE_STOCK_DEPARTMENT,
          itemCode: key,
          itemName: m.itemName,
          colour: m.colour,
          quantity: delta,
          uom: m.unit,
          referenceType,
          referenceId,
          programId: options.programId || null,
          actorId: options.actorId,
          balanceAfter: balances.get(key) ?? 0,
          idempotencyKey: ledgerIdempotencyKey(referenceType, referenceId, key, revision),
          notes: isFirstPosting
            ? options.label
            : `${options.label}: ${delta > 0 ? 'returned' : 'deducted'} ${Math.abs(delta)} ${m.unit} after edit or cancellation`,
        },
      }),
    );
  }
  return created;
}

/**
 * Posts a Fabric Store challan: active challans issue their lines, cancelled / draft / deleted
 * ones (pass `removed`) give everything back. Other challans are ignored.
 */
export async function syncChallanStock(tx: Tx, challanId: string, actorId: string, options: { removed?: boolean } = {}) {
  const challan = await tx.challan.findUnique({
    where: { id: challanId },
    include: { items: true, program: { select: { fabricName: true } } },
  });
  if (!challan || !isStoreOutwardChallan(challan)) return [];
  await lockFabricStock(tx);

  const { book } = await loadStockBook(tx, { referenceType: STOCK_REFERENCE.CHALLAN, referenceId: challan.id });
  const active = !options.removed && !ACTIVE_CHALLAN_EXCLUDED_STATUSES.includes(challan.status);
  const desired: DesiredMovement[] = [];
  if (active) {
    const lines = challanStockLines(challan);
    const plan = planIssue(book, lines);
    if (!plan.ok) {
      throw new FabricStockError(`Challan ${challan.challanNumber} cannot be issued from Fabric Store stock.`, plan.errors);
    }
    for (const allocation of plan.allocations) {
      const bucket = book.buckets.get(allocation.key)!;
      desired.push({
        key: allocation.key,
        quantity: -allocation.quantity,
        itemName: bucket.itemName,
        colour: bucket.colour,
        unit: bucket.unit,
      });
    }
  }
  return postDocument(tx, {
    referenceType: STOCK_REFERENCE.CHALLAN,
    referenceId: challan.id,
    desired,
    baseBook: book,
    actorId,
    programId: challan.programId,
    label: `Challan ${challan.challanNumber} (${challan.fromDepartment} to ${challan.toDepartment})`,
  });
}

/** Posts an inward row as received (or removes it when the row no longer exists). */
export async function syncInwardStock(tx: Tx, inwardId: string, actorId: string) {
  await lockFabricStock(tx);
  const inward = await tx.fabricInward.findUnique({ where: { id: inwardId } });
  const { book } = await loadStockBook(tx, { referenceType: STOCK_REFERENCE.INWARD, referenceId: inwardId });
  const desired: DesiredMovement[] = [];
  const unit = inward ? normalizeStockUnit(inward.unit) : null;
  if (inward && unit) {
    desired.push({
      key: stockKey({ fabric: inward.itemName, type: inward.entryType, colour: inward.colour, unit }),
      quantity: inward.billQty,
      itemName: inward.itemName,
      colour: inward.colour,
      unit,
    });
  }
  return postDocument(tx, {
    referenceType: STOCK_REFERENCE.INWARD,
    referenceId: inwardId,
    desired,
    baseBook: book,
    actorId,
    label: inward ? `Inward bill ${inward.billNo}` : 'Inward entry',
  });
}

/**
 * Posts many inward rows created in this same transaction (stock-sheet import) as receipts, with one
 * lock and one stock-book load instead of one per row. Receipts only add stock, so no balance check
 * can fail; the result is the same as calling syncInwardStock for each row in order.
 */
export async function postNewInwardStock(tx: Tx, inwards: Array<Prisma.FabricInwardGetPayload<object>>, actorId: string) {
  if (inwards.length === 0) return 0;
  await lockFabricStock(tx);
  const newIds = new Set(inwards.map((row) => row.id));
  const already = await tx.stockLedgerEntry.count({
    where: { departmentCode: STORE_STOCK_DEPARTMENT, referenceType: STOCK_REFERENCE.INWARD, referenceId: { in: [...newIds] } },
  });
  if (already > 0) throw new Error('These inward rows are already posted to the stock ledger.');

  // Balances before these rows; each row is then added in order, so its balanceAfter includes itself.
  const { book } = await loadStockBook(tx, undefined, { excludeInwardIds: newIds });

  const data: Prisma.StockLedgerEntryCreateManyInput[] = [];
  for (const row of inwards) {
    const unit = normalizeStockUnit(row.unit);
    if (!unit || !(row.billQty > 0)) continue;
    const key = addInward(book, { fabric: row.itemName, type: row.entryType, colour: row.colour, unit, quantity: row.billQty, date: row.receivingDate });
    if (!key) continue;
    data.push({
      entryType: 'RECEIPT',
      departmentCode: STORE_STOCK_DEPARTMENT,
      itemCode: key,
      itemName: row.itemName,
      colour: row.colour,
      quantity: row.billQty,
      uom: unit,
      referenceType: STOCK_REFERENCE.INWARD,
      referenceId: row.id,
      programId: null,
      actorId,
      balanceAfter: bucketBalance(book, key),
      idempotencyKey: ledgerIdempotencyKey(STOCK_REFERENCE.INWARD, row.id, key, 0),
      notes: `Inward bill ${row.billNo}`,
    });
  }
  if (data.length > 0) await tx.stockLedgerEntry.createMany({ data });
  return data.length;
}

/** Posts a manual outward row; rows that mirror a Fabric Store challan post nothing. */
export async function syncManualOutwardStock(tx: Tx, outwardId: string, actorId: string) {
  await lockFabricStock(tx);
  const outward = await tx.fabricOutward.findUnique({ where: { id: outwardId } });
  const { book, storeChallans } = await loadStockBook(tx, { referenceType: STOCK_REFERENCE.OUTWARD, referenceId: outwardId });
  const desired: DesiredMovement[] = [];
  const challanNumbers = new Set(storeChallans.map((c) => c.challanNumber.trim().toLowerCase()));
  if (outward && !isChallanMirror(outward, challanNumbers)) {
    const plan = planIssue(book, [manualOutwardLine(outward)]);
    if (!plan.ok) throw new FabricStockError('This outward entry cannot be issued from Fabric Store stock.', plan.errors);
    for (const allocation of plan.allocations) {
      const bucket = book.buckets.get(allocation.key)!;
      desired.push({ key: allocation.key, quantity: -allocation.quantity, itemName: bucket.itemName, colour: bucket.colour, unit: bucket.unit });
    }
  }
  return postDocument(tx, {
    referenceType: STOCK_REFERENCE.OUTWARD,
    referenceId: outwardId,
    desired,
    baseBook: book,
    actorId,
    label: outward ? `Manual outward ${outward.challanNumber || outward.itemName}` : 'Manual outward',
  });
}

/** JSON body for a refused stock change. */
export function fabricStockErrorBody(error: FabricStockError) {
  return { error: [error.message, ...error.details].join(' '), details: error.details, code: 'INSUFFICIENT_STOCK' };
}

/**
 * Posts newly created inward rows (an Excel import) as receipts in one pass. Call it in the same
 * transaction that created the rows, with `baseBook` loaded before they were created. Each row
 * gets the ledger posting syncInwardStock would make (same idempotency key, revision 0), so later
 * edits or removals of a row reconcile normally.
 */
export async function postNewInwardRows(
  tx: Tx,
  rows: Array<{ id: string; itemName: string; entryType: string; colour: string | null; unit: string; billQty: number }>,
  options: { actorId: string; baseBook: ReturnType<typeof createStockBook>; label: string },
) {
  const running = new Map<string, number>();
  const data = rows.map((row) => {
    const unit = normalizeStockUnit(row.unit);
    if (!unit) throw new FabricStockError(`${options.label}: unit ${row.unit} is not MTR or PCS.`);
    const key = stockKey({ fabric: row.itemName, type: row.entryType, colour: row.colour, unit });
    const balance = roundQty((running.get(key) ?? bucketBalance(options.baseBook, key)) + row.billQty);
    running.set(key, balance);
    return {
      id: crypto.randomUUID(),
      entryType: 'RECEIPT',
      departmentCode: STORE_STOCK_DEPARTMENT,
      itemCode: key,
      itemName: row.itemName,
      colour: row.colour,
      quantity: row.billQty,
      uom: unit,
      referenceType: STOCK_REFERENCE.INWARD,
      referenceId: row.id,
      actorId: options.actorId,
      balanceAfter: balance,
      idempotencyKey: ledgerIdempotencyKey(STOCK_REFERENCE.INWARD, row.id, key, 0),
      notes: options.label,
    };
  });
  if (data.length > 0) await tx.stockLedgerEntry.createMany({ data });
  return data.map(({ id, referenceId, itemCode, quantity, uom, balanceAfter }) => ({ id, inwardId: referenceId, key: itemCode, quantity, uom, balanceAfter }));
}
