import type { Prisma } from '@shubham/database';

/**
 * Appends an AuditLog row. Audit rows are never deleted: when a record is removed, this keeps who removed
 * it, when, and what it was (`beforeState`), so the history of a challan or Production Sheet survives it.
 */
export async function writeAuditLog(
  tx: Prisma.TransactionClient,
  entry: { actorId: string; action: string; entity: string; entityId: string; before?: unknown; after?: unknown },
) {
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      beforeState: entry.before === undefined ? null : JSON.stringify(entry.before),
      afterState: entry.after === undefined ? null : JSON.stringify(entry.after),
    },
  });
}
