import { Prisma, prisma } from '@shubham/database';

const confirmed = new Set<string>();

/**
 * Whether newly added columns can be written yet: the loaded Prisma client must know the fields and
 * the database must have the columns (their manual migration has run). Until both are true the caller
 * saves without them instead of failing; once confirmed the answer is kept for the life of the process.
 */
export async function canWriteColumns(model: string, columns: string[]): Promise<boolean> {
  const key = `${model}:${columns.join(',')}`;
  if (confirmed.has(key)) return true;
  const fields = (Prisma as any)[`${model}ScalarFieldEnum`] as Record<string, string> | undefined;
  if (!fields || columns.some((column) => !(column in fields))) return false;
  try {
    const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = ${model} AND column_name = ANY(${columns})`;
    if (rows.length === columns.length) {
      confirmed.add(key);
      return true;
    }
  } catch {
    // Treated as not available yet.
  }
  return false;
}

/** A challan line's Average and its MTR / PCS unit (manual migration 20261028_challan_item_average.sql). */
export function canStoreChallanAverage(): Promise<boolean> {
  return canWriteColumns('ChallanItem', ['average', 'averageUnit']);
}
