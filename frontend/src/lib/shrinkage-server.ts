import { randomUUID } from 'crypto';
import { prisma } from '@shubham/database';
import { unitOf } from '@/lib/challan-units.mjs';

// Shrinkage of dyed fabric, one record per line of a Dyeing -> Dyeing QC challan (table "ShrinkageRecord",
// manual-migrations/20261028_shrinkage.sql). Dyeing QC enters and edits it; the Fabric Store reads the same
// rows. It is information only and never changes Fabric Store stock.
//
// Queries are raw SQL so they work with a Prisma client generated before the table was added.

type Db = Pick<typeof prisma, '$queryRaw' | '$executeRaw'>;

export class ShrinkageError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export const SHRINKAGE_NOT_SET_UP =
  'Shrinkage is not set up in the database yet. Restart the app (or run: node scripts/apply-appearance-migrations.js) and try again.';

// The same additive, re-runnable statements as manual-migrations/20261028_shrinkage.sql. Run once when the
// table is missing, so Shrinkage works even when the app was started without applying that migration.
const CREATE_SHRINKAGE_TABLE = [
  `CREATE TABLE IF NOT EXISTS "ShrinkageRecord" (
    "id" TEXT NOT NULL,
    "challanId" TEXT NOT NULL,
    "challanItemId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "originalQty" DOUBLE PRECISION NOT NULL,
    "originalUnit" TEXT NOT NULL,
    "shrinkageQty" DOUBLE PRECISION NOT NULL,
    "shrinkageUnit" TEXT NOT NULL,
    "remainingQty" DOUBLE PRECISION,
    "remarks" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShrinkageRecord_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ShrinkageRecord_challanItemId_key" ON "ShrinkageRecord"("challanItemId")`,
  `CREATE INDEX IF NOT EXISTS "ShrinkageRecord_programId_idx" ON "ShrinkageRecord"("programId")`,
  `CREATE INDEX IF NOT EXISTS "ShrinkageRecord_challanId_idx" ON "ShrinkageRecord"("challanId")`,
  `CREATE INDEX IF NOT EXISTS "ShrinkageRecord_updatedAt_idx" ON "ShrinkageRecord"("updatedAt")`,
  `DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ShrinkageRecord_challanId_fkey') THEN
      ALTER TABLE "ShrinkageRecord" ADD CONSTRAINT "ShrinkageRecord_challanId_fkey" FOREIGN KEY ("challanId") REFERENCES "Challan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ShrinkageRecord_challanItemId_fkey') THEN
      ALTER TABLE "ShrinkageRecord" ADD CONSTRAINT "ShrinkageRecord_challanItemId_fkey" FOREIGN KEY ("challanItemId") REFERENCES "ChallanItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ShrinkageRecord_programId_fkey') THEN
      ALTER TABLE "ShrinkageRecord" ADD CONSTRAINT "ShrinkageRecord_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ShrinkageRecord_createdById_fkey') THEN
      ALTER TABLE "ShrinkageRecord" ADD CONSTRAINT "ShrinkageRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ShrinkageRecord_updatedById_fkey') THEN
      ALTER TABLE "ShrinkageRecord" ADD CONSTRAINT "ShrinkageRecord_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
  END $$`,
];

const tableExistsNow = async () => {
  const rows = await prisma.$queryRaw<Array<{ ok: boolean }>>`
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ShrinkageRecord') AS ok`;
  return Boolean(rows[0]?.ok);
};

let tableReady = false;
let creating: Promise<void> | null = null;
/**
 * True once the ShrinkageRecord table exists (cached after the first success). When it is missing it is
 * created here; false only if that fails (the error is logged).
 */
export async function shrinkageTableExists(): Promise<boolean> {
  if (tableReady) return true;
  if (await tableExistsNow()) return (tableReady = true);
  try {
    creating ??= (async () => {
      for (const statement of CREATE_SHRINKAGE_TABLE) await prisma.$executeRawUnsafe(statement);
    })().finally(() => {
      creating = null;
    });
    await creating;
  } catch (error) {
    console.error('Could not create the ShrinkageRecord table:', error);
  }
  tableReady = await tableExistsNow();
  return tableReady;
}

/** Remaining quantity: only when shrinkage is in the line's own unit (MTR and PCS are never mixed). */
export function remainingOf(originalQty: number, originalUnit: string, shrinkageQty: number, shrinkageUnit: string) {
  return unitOf(originalUnit) && unitOf(originalUnit) === unitOf(shrinkageUnit)
    ? Math.round((originalQty - shrinkageQty) * 1000) / 1000
    : null;
}

/** Checks a shrinkage entry against its line; returns the cleaned values. */
export function validateShrinkage(
  line: { quantity: number; uom: string },
  input: { shrinkageQty: unknown; shrinkageUnit: unknown },
) {
  const raw = input.shrinkageQty;
  const shrinkageQty = raw === '' || raw === null || raw === undefined ? NaN : Number(raw);
  if (!Number.isFinite(shrinkageQty)) throw new ShrinkageError('Enter the shrinkage quantity.');
  if (shrinkageQty < 0) throw new ShrinkageError('Shrinkage cannot be negative.');
  const shrinkageUnit = unitOf(String(input.shrinkageUnit ?? ''));
  if (!shrinkageUnit) throw new ShrinkageError('Choose the shrinkage unit (MTR or PCS).');
  const originalUnit = unitOf(line.uom) || String(line.uom || '').toUpperCase();
  if (shrinkageUnit === originalUnit && shrinkageQty > line.quantity + 0.001) {
    throw new ShrinkageError(
      `Shrinkage (${shrinkageQty} ${shrinkageUnit}) cannot be more than the original quantity (${line.quantity} ${originalUnit}).`,
    );
  }
  return {
    shrinkageQty,
    shrinkageUnit,
    originalQty: line.quantity,
    originalUnit,
    remainingQty: remainingOf(line.quantity, originalUnit, shrinkageQty, shrinkageUnit),
  };
}

/** A line of a Dyeing -> Dyeing QC challan that has been sent (shrinkage can be recorded against it). */
async function eligibleLine(db: Db, challanItemId: string) {
  const rows = await db.$queryRaw<Array<{ id: string; challanId: string; programId: string; quantity: number; uom: string }>>`
    SELECT i."id", i."challanId", c."programId", i."quantity", i."uom"
    FROM "ChallanItem" i JOIN "Challan" c ON c."id" = i."challanId"
    WHERE i."id" = ${challanItemId}
      AND c."toDepartment" = 'QC1'
      AND c."status" NOT IN ('DRAFT', 'CANCELLED')`;
  if (!rows[0]) throw new ShrinkageError('This fabric line is not a fabric line received by Dyeing QC.', 404);
  return rows[0];
}

/**
 * Creates the line's record, or updates it when it already exists (one record per line).
 * `mode: 'create'` refuses a line that already has a record instead of updating it.
 */
export async function saveShrinkageForLine(
  db: Db,
  input: {
    challanItemId: string;
    shrinkageQty: unknown;
    shrinkageUnit: unknown;
    remarks?: unknown;
    userId: string;
    source: 'INSPECTION' | 'MANUAL';
    mode?: 'create' | 'upsert';
  },
) {
  const line = await eligibleLine(db, input.challanItemId);
  const v = validateShrinkage(line, input);
  const remarks = String(input.remarks ?? '').trim() || null;
  if (input.mode === 'create') {
    const existing = await db.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "ShrinkageRecord" WHERE "challanItemId" = ${line.id}`;
    if (existing[0]) {
      throw new ShrinkageError('This fabric line already has a shrinkage record. Edit that record instead.', 409);
    }
  }
  await db.$executeRaw`
    INSERT INTO "ShrinkageRecord" ("id", "challanId", "challanItemId", "programId", "originalQty", "originalUnit",
      "shrinkageQty", "shrinkageUnit", "remainingQty", "remarks", "source", "createdById", "updatedById", "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${line.challanId}, ${line.id}, ${line.programId}, ${v.originalQty}, ${v.originalUnit},
      ${v.shrinkageQty}, ${v.shrinkageUnit}, ${v.remainingQty}, ${remarks}, ${input.source}, ${input.userId}, ${input.userId}, NOW(), NOW())
    ON CONFLICT ("challanItemId") DO UPDATE SET
      "originalQty" = EXCLUDED."originalQty", "originalUnit" = EXCLUDED."originalUnit",
      "shrinkageQty" = EXCLUDED."shrinkageQty", "shrinkageUnit" = EXCLUDED."shrinkageUnit",
      "remainingQty" = EXCLUDED."remainingQty",
      "remarks" = COALESCE(EXCLUDED."remarks", "ShrinkageRecord"."remarks"),
      "updatedById" = EXCLUDED."updatedById", "updatedAt" = NOW()`;
}

/** Updates one record's shrinkage, unit and remarks. */
export async function updateShrinkageRecord(
  id: string,
  input: { shrinkageQty: unknown; shrinkageUnit: unknown; remarks?: unknown; userId: string },
) {
  const rows = await prisma.$queryRaw<Array<{ challanItemId: string }>>`
    SELECT "challanItemId" FROM "ShrinkageRecord" WHERE "id" = ${id}`;
  if (!rows[0]) throw new ShrinkageError('Shrinkage record not found.', 404);
  const line = await eligibleLine(prisma, rows[0].challanItemId);
  const v = validateShrinkage(line, input);
  const remarks = String(input.remarks ?? '').trim() || null;
  await prisma.$executeRaw`
    UPDATE "ShrinkageRecord" SET
      "originalQty" = ${v.originalQty}, "originalUnit" = ${v.originalUnit},
      "shrinkageQty" = ${v.shrinkageQty}, "shrinkageUnit" = ${v.shrinkageUnit}, "remainingQty" = ${v.remainingQty},
      "remarks" = ${remarks}, "updatedById" = ${input.userId}, "updatedAt" = NOW()
    WHERE "id" = ${id}`;
}

export interface ShrinkageFilters {
  search?: string;
  design?: string;
  serial?: string;
  from?: string; // yyyy-mm-dd, on the updated date
  to?: string;
}

export interface ShrinkageRow {
  id: string;
  challanId: string;
  challanItemId: string;
  programId: string;
  challanNumber: string;
  designNumber: string;
  serialNumber: string;
  fabric: string;
  colour: string;
  originalQty: number;
  originalUnit: string;
  shrinkageQty: number;
  shrinkageUnit: string;
  remainingQty: number | null;
  remarks: string;
  source: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

const like = (s: string) => `%${s.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
// Fixed SQL expressions only (never user input); user values always go in as $n parameters. Plain strings
// with $queryRawUnsafe: Prisma.sql fragments from @shubham/database are not recognised by its client here
// and get sent as jsonb values.
const DESIGN_SQL = `COALESCE(NULLIF(p."designNumber", ''), NULLIF(p."designName", ''), '')`;
const SERIAL_SQL = `COALESCE(NULLIF(p."programSerialNo", ''), p."programNumber")`;
const FABRIC_SQL = `COALESCE(NULLIF(i."fabricCode", ''), NULLIF(i."itemDescription", ''), NULLIF(p."fabricName", ''), '')`;

function dayStart(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Records matching the filters, newest update first. */
export async function listShrinkage(filters: ShrinkageFilters): Promise<ShrinkageRow[]> {
  const where: string[] = ['TRUE'];
  const values: unknown[] = [];
  const param = (v: unknown) => {
    values.push(v);
    return `$${values.length}`;
  };
  const search = filters.search?.trim();
  if (search) {
    const q = param(like(search));
    where.push(`(${DESIGN_SQL} ILIKE ${q} OR ${SERIAL_SQL} ILIKE ${q} OR ${FABRIC_SQL} ILIKE ${q}
      OR c."challanNumber" ILIKE ${q} OR COALESCE(i."colour", '') ILIKE ${q} OR COALESCE(r."remarks", '') ILIKE ${q})`);
  }
  if (filters.design?.trim()) where.push(`${DESIGN_SQL} ILIKE ${param(like(filters.design.trim()))}`);
  if (filters.serial?.trim()) where.push(`${SERIAL_SQL} ILIKE ${param(like(filters.serial.trim()))}`);
  const from = dayStart(filters.from);
  if (from) where.push(`r."updatedAt" >= ${param(from)}`);
  const to = dayStart(filters.to);
  if (to) where.push(`r."updatedAt" < ${param(new Date(to.getTime() + 86_400_000))}`);

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT r."id", r."challanId", r."challanItemId", r."programId", c."challanNumber",
      ${DESIGN_SQL} AS "designNumber", ${SERIAL_SQL} AS "serialNumber", ${FABRIC_SQL} AS "fabric",
      COALESCE(i."colour", '') AS "colour",
      r."originalQty", r."originalUnit", r."shrinkageQty", r."shrinkageUnit", r."remainingQty",
      COALESCE(r."remarks", '') AS "remarks", r."source",
      COALESCE(cu."fullName", cu."username", '') AS "createdBy",
      COALESCE(uu."fullName", uu."username", '') AS "updatedBy",
      r."createdAt", r."updatedAt"
    FROM "ShrinkageRecord" r
    JOIN "ChallanItem" i ON i."id" = r."challanItemId"
    JOIN "Challan" c ON c."id" = r."challanId"
    JOIN "Program" p ON p."id" = r."programId"
    LEFT JOIN "User" cu ON cu."id" = r."createdById"
    LEFT JOIN "User" uu ON uu."id" = r."updatedById"
    WHERE ${where.join(' AND ')}
    ORDER BY r."updatedAt" DESC
    LIMIT 2000`,
    ...values,
  );
  return rows.map((r) => ({
    ...r,
    createdAt: new Date(r.createdAt).toISOString(),
    updatedAt: new Date(r.updatedAt).toISOString(),
  }));
}

export interface ShrinkageCandidate {
  challanItemId: string;
  challanNumber: string;
  designNumber: string;
  serialNumber: string;
  fabric: string;
  colour: string;
  quantity: number;
  uom: string;
}

/** Fabric lines received by Dyeing QC that have no shrinkage record yet (for "Add Shrinkage"). */
export async function listShrinkageCandidates(search?: string): Promise<ShrinkageCandidate[]> {
  const q = search?.trim() ? like(search.trim()) : null;
  return prisma.$queryRawUnsafe<ShrinkageCandidate[]>(
    `SELECT i."id" AS "challanItemId", c."challanNumber",
      ${DESIGN_SQL} AS "designNumber", ${SERIAL_SQL} AS "serialNumber", ${FABRIC_SQL} AS "fabric",
      COALESCE(i."colour", '') AS "colour", i."quantity", i."uom"
    FROM "ChallanItem" i
    JOIN "Challan" c ON c."id" = i."challanId"
    JOIN "Program" p ON p."id" = c."programId"
    LEFT JOIN "ShrinkageRecord" r ON r."challanItemId" = i."id"
    WHERE c."toDepartment" = 'QC1'
      AND c."status" NOT IN ('DRAFT', 'CANCELLED')
      AND r."id" IS NULL
      ${q ? `AND (${DESIGN_SQL} ILIKE $1 OR ${SERIAL_SQL} ILIKE $1 OR ${FABRIC_SQL} ILIKE $1 OR c."challanNumber" ILIKE $1)` : ''}
    ORDER BY c."createdAt" DESC, i."createdAt" ASC
    LIMIT 300`,
    ...(q ? [q] : []),
  );
}
