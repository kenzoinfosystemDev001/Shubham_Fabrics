import { Prisma, prisma } from '@shubham/database';
import { quantityPairOf } from '@/lib/challan-units.mjs';

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

/** A challan line's Unit quantity and its MTR / PCS unit (manual migration 20261029_challan_item_unit_quantity.sql). */
export function canStoreChallanUnitQuantity(): Promise<boolean> {
  return canWriteColumns('ChallanItem', ['unitQuantity', 'unitQuantityUom']);
}

/** A challan entry's optional Average and Unit quantity (Items section), each with its own MTR / PCS; never converted. */
export interface LineExtras {
  average: number | null;
  averageUnit: 'MTR' | 'PCS' | null;
  unitQuantity: number | null;
  unitQuantityUom: 'MTR' | 'PCS' | null;
}

/** Reads a line's extras; `fail` builds the caller's own request error for a bad value. */
export function lineExtrasOf(
  line: { average?: unknown; averageUnit?: unknown; unitQuantity?: unknown; unitQuantityUom?: unknown },
  index: number,
  fail: (message: string) => Error,
): LineExtras {
  const average = quantityPairOf(line.average, line.averageUnit, 'Average');
  if ('error' in average) throw fail(`Line ${index + 1}: ${average.error}`);
  const unitQuantity = quantityPairOf(line.unitQuantity, line.unitQuantityUom, 'Unit quantity');
  if ('error' in unitQuantity) throw fail(`Line ${index + 1}: ${unitQuantity.error}`);
  return { average: average.value, averageUnit: average.unit, unitQuantity: unitQuantity.value, unitQuantityUom: unitQuantity.unit };
}

/** ChallanItem fields for the entered extras only, each written once its columns exist (manual migrations). */
export async function lineExtrasWriter(lines: LineExtras[]) {
  const storeAverage = lines.some((l) => l.average !== null) ? await canStoreChallanAverage() : false;
  const storeUnitQuantity = lines.some((l) => l.unitQuantity !== null) ? await canStoreChallanUnitQuantity() : false;
  return (l: LineExtras) => ({
    ...(storeAverage && l.average !== null ? { average: l.average, averageUnit: l.averageUnit } : {}),
    ...(storeUnitQuantity && l.unitQuantity !== null ? { unitQuantity: l.unitQuantity, unitQuantityUom: l.unitQuantityUom } : {}),
  });
}
