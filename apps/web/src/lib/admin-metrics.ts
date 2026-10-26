/** Pure helpers for Admin dashboard metrics (no database access). */

export type ChallanStatusGroup = 'PENDING' | 'COMPLETED' | 'CANCELLED';

// Work on a challan is finished once it was completed, approved, handed over or closed.
const COMPLETED = new Set(['COMPLETED', 'CLOSED', 'QC_APPROVED', 'HANDED_OVER', 'DISPATCHED', 'PACKED']);
const CANCELLED = new Set(['CANCELLED', 'REJECTED', 'QC_REJECTED']);

export function challanStatusGroup(status: string | null | undefined): ChallanStatusGroup {
  const s = String(status || '').toUpperCase();
  if (COMPLETED.has(s)) return 'COMPLETED';
  if (CANCELLED.has(s)) return 'CANCELLED';
  return 'PENDING';
}

export const COMPLETED_CHALLAN_STATUSES = Array.from(COMPLETED);
export const CANCELLED_CHALLAN_STATUSES = Array.from(CANCELLED);

/** Sums quantities per unit (MTR / PCS / ...) without ever adding different units together. */
export function sumByUnit<T>(rows: T[], qty: (row: T) => number, unit: (row: T) => string | null | undefined): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const row of rows) {
    const u = String(unit(row) || 'UNSPECIFIED').toUpperCase();
    totals[u] = Math.round(((totals[u] || 0) + (Number(qty(row)) || 0)) * 1000) / 1000;
  }
  return totals;
}
