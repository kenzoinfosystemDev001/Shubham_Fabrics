import type { Prisma } from '@shubham/database';

/**
 * A record changed between being read and being written (a double-click, a second tablet, a retry).
 * Routes answer it with 409 so the user refreshes instead of the same work being recorded twice.
 */
export class ConflictError extends Error {
  readonly status = 409;
}

/**
 * Optimistic lock on a challan inside a transaction: succeeds only if the challan still has the status and
 * `updatedAt` that were read before the transaction. Every write to a challan moves `updatedAt`, so a second
 * concurrent request (which waits for the first one's row lock, then re-checks) finds no match and fails.
 */
export async function claimChallan(
  tx: Prisma.TransactionClient,
  challan: { id: string; status: string; updatedAt: Date; challanNumber?: string | null },
) {
  const claim = await tx.challan.updateMany({
    where: { id: challan.id, status: challan.status, updatedAt: challan.updatedAt },
    data: { updatedAt: new Date() },
  });
  if (claim.count !== 1) {
    throw new ConflictError(
      `Challan ${challan.challanNumber || ''} was changed by someone else while you were saving. Refresh and try again.`.replace('  ', ' '),
    );
  }
}
