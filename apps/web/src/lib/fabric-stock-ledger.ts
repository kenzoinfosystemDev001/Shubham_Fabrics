import { prisma } from '@subham/database';
import {
  buildFabricStockLedger,
  challanItemStockLine,
  isFabricStoreDepartment,
  type FabricStockLedger,
  type FabricStockLine,
} from '@/lib/fabric-stock';
import { getDefectiveShelfActor } from '@/lib/defective-shelf';

type StockDb = Pick<typeof prisma, 'challan' | 'fabricInward' | 'fabricOutward'>;
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Arbitrary constant key for pg_advisory_xact_lock that serialises Fabric Store stock changes. */
export const FABRIC_STORE_STOCK_LOCK_KEY = 470_118_001;

/** Serialises stock-changing transactions so two requests cannot both spend the same balance. */
export async function lockFabricStoreStock(tx: TxClient): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${FABRIC_STORE_STOCK_LOCK_KEY})`;
}

/** Signed-in user when available, otherwise the same fallback actor other store routes use. */
export async function resolveStockActorId(request: Request, db: Pick<typeof prisma, 'user'> = prisma): Promise<string | null> {
  const auth = await getDefectiveShelfActor(request).catch(() => null);
  if (auth?.actor) return auth.actor.id;
  const fallback = await db.user.findFirst({
    where: { OR: [{ username: 'store' }, { departmentCode: 'STORE' }, { username: 'admin' }] },
    select: { id: true },
  }) || await db.user.findFirst({ select: { id: true } });
  return fallback?.id || null;
}

/** Stock rows that the change left below zero and lower than before (untouched historical negatives are ignored). */
export function findNewlyNegativeRows(before: FabricStockLedger, after: FabricStockLedger) {
  return Array.from(after.rows.entries())
    .filter(([key, row]) => row.rawBalance < -1e-9 && row.rawBalance < (before.rows.get(key)?.rawBalance ?? 0) - 1e-9)
    .map(([, row]) => row);
}

export interface StockMovementAudit {
  entryType: 'RECEIPT' | 'ISSUE' | 'ADJUSTMENT';
  line: FabricStockLine;
  quantity: number; // signed: + receipt, - issue
  referenceType: string;
  referenceId: string;
  programId?: string | null;
  notes?: string | null;
}

/** Writes audit rows to the existing StockLedgerEntry table with the balance after the movement. */
export async function recordStockMovements(
  tx: TxClient,
  ledgerAfter: FabricStockLedger,
  actorId: string,
  movements: StockMovementAudit[]
): Promise<void> {
  const keys = movements.map((movement) => ledgerAfter.resolveKey(movement.line));
  for (const [index, movement] of movements.entries()) {
    const row = ledgerAfter.rows.get(keys[index]);
    // Running balance: the final balance minus the effect of later movements on the same row.
    const laterEffect = movements.reduce((sum, later, j) => (j > index && keys[j] === keys[index] ? sum + later.quantity : sum), 0);
    await tx.stockLedgerEntry.create({
      data: {
        entryType: movement.entryType,
        departmentCode: 'STORE',
        itemCode: (row?.itemName || movement.line.name).toUpperCase().slice(0, 120),
        itemName: row?.itemName || movement.line.name,
        colour: movement.line.color || null,
        quantity: movement.quantity,
        uom: movement.line.unit,
        referenceType: movement.referenceType,
        referenceId: movement.referenceId,
        programId: movement.programId || null,
        actorId,
        balanceAfter: Math.round(((row?.rawBalance ?? 0) - laterEffect) * 1000) / 1000,
        notes: [movement.line.type, movement.notes].filter(Boolean).join(' · ') || null,
      },
    });
  }
}

/**
 * Loads every record that affects Fabric Store stock and builds the ledger.
 * Pass a transaction client to read consistently inside a stock deduction.
 */
export async function loadFabricStockLedger(db: StockDb = prisma): Promise<FabricStockLedger> {
  const [inwardEntries, storeChallans, manualOutwards] = await Promise.all([
    db.fabricInward.findMany({ orderBy: { receivingDate: 'desc' } }),
    db.challan.findMany({
      where: {
        NOT: { toDepartment: { equals: 'STORE', mode: 'insensitive' } },
        OR: [
          { fromDepartment: { contains: 'STORE', mode: 'insensitive' } },
          { fromDepartment: { equals: 'FABRIC', mode: 'insensitive' } },
        ],
        status: { notIn: ['DRAFT', 'CANCELLED'] },
      },
      include: {
        program: { select: { fabricName: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    db.fabricOutward.findMany({ orderBy: { date: 'desc' } }),
  ]);

  return buildFabricStockLedger({
    inwardEntries,
    storeChallans: storeChallans.filter((challan) => isFabricStoreDepartment(challan.fromDepartment)),
    manualOutwards,
  });
}

const UNCOUNTED_CHALLAN_STATUSES = new Set(['DRAFT', 'CANCELLED']);

export class StockChangeError extends Error {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Guards a status change on a Fabric Store challan. Stock only counts challans that are not
 * DRAFT / CANCELLED, so moving into or out of those states changes stock. Call before the
 * status update inside the same transaction, then call the returned `finish` after it:
 * reactivation is refused if it would push any balance negative, and every change is
 * written to the stock ledger (ISSUE when it starts counting, ADJUSTMENT reversal on cancel).
 */
export async function guardStoreChallanStatusChange(
  tx: TxClient,
  challan: {
    id: string;
    challanNumber: string;
    status: string;
    fromDepartment: string;
    toDepartment: string;
    fabricUnit?: string | null;
    programId: string;
    items: Array<{ fabricCode?: string | null; itemDescription?: string | null; colour?: string | null; remarks?: string | null; uom?: string | null; quantity: number }>;
    program?: { fabricName?: string | null } | null;
  },
  nextStatus: string | undefined,
  actorId: string | null
): Promise<(tx: TxClient) => Promise<void>> {
  const noop = async () => {};
  if (!nextStatus || !isFabricStoreDepartment(challan.fromDepartment) || challan.toDepartment.toUpperCase() === 'STORE') return noop;
  const wasCounted = !UNCOUNTED_CHALLAN_STATUSES.has(challan.status.toUpperCase());
  const willCount = !UNCOUNTED_CHALLAN_STATUSES.has(nextStatus.toUpperCase());
  if (wasCounted === willCount) return noop;

  await lockFabricStoreStock(tx);
  const before = await loadFabricStockLedger(tx);
  const lines = challan.items
    .filter((item) => Number(item.quantity) > 0)
    .map((item) => ({ line: challanItemStockLine(item, challan.toDepartment, challan.fabricUnit, challan.program?.fabricName), quantity: Number(item.quantity) }));

  return async (txAfter: TxClient) => {
    const after = await loadFabricStockLedger(txAfter);
    if (willCount) {
      const negative = findNewlyNegativeRows(before, after);
      if (negative.length > 0) {
        throw new StockChangeError(
          `Challan ${challan.challanNumber} cannot be re-activated: insufficient Fabric Store stock for ${negative
            .map((row) => `${row.itemName}${row.color ? ` / ${row.color}` : ''} (${row.unit})`)
            .join(', ')}.`
        );
      }
    }
    if (actorId) {
      await recordStockMovements(txAfter, after, actorId, lines.map(({ line, quantity }) => ({
        entryType: willCount ? ('ISSUE' as const) : ('ADJUSTMENT' as const),
        line,
        quantity: willCount ? -quantity : quantity,
        referenceType: 'CHALLAN_STATUS',
        referenceId: challan.id,
        programId: challan.programId,
        notes: `Challan ${challan.challanNumber}: ${challan.status} → ${nextStatus}`,
      })));
    }
  };
}
