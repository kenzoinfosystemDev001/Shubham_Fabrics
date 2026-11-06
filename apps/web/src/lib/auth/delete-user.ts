import { prisma } from '@shubham/database';

/**
 * Removing a user deletes the user row and its role links from the database. Challans, production sheets,
 * inspections, ledger entries and every other record that names the user are kept, and from then on name
 * one shared "Deleted User" account instead. That account is switched off and has no usable password, so it
 * can never sign in, and it is not listed in Users & RBAC.
 */
export const DELETED_USER_USERNAME = 'deleted-user';

// Not a bcrypt hash, so no password ever matches it (login treats it as a wrong password).
const NO_PASSWORD = '!no-sign-in';

// Every column in the database that points at a user, read from the foreign keys themselves so that a table
// added later is covered too. The user's own settings (role links, dismissed deadline alerts, both unique per
// user) are deleted with the user rather than moved.
const USER_REFERENCES_SQL = `
  SELECT c.conrelid::regclass::text AS table_name, a.attname AS column_name
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
  WHERE c.contype = 'f' AND c.confrelid = '"User"'::regclass
    AND c.conrelid::regclass::text NOT IN ('"UserRole"', '"DeadlineAlertDismissal"')`;

const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;

/** Deletes the user for good; returns how many records were moved to "Deleted User". */
export async function deleteUserPermanently(userId: string): Promise<{ movedRecords: number }> {
  return prisma.$transaction(
    async (tx) => {
      const placeholder =
        (await tx.user.findFirst({ where: { username: DELETED_USER_USERNAME }, select: { id: true }, orderBy: { createdAt: 'asc' } })) ||
        (await tx.user.create({
          data: {
            username: DELETED_USER_USERNAME,
            email: 'deleted-user@subhamfabrics.invalid',
            fullName: 'Deleted User',
            passwordHash: NO_PASSWORD,
            isActive: false,
          },
          select: { id: true },
        }));
      if (placeholder.id === userId) throw new Error('The Deleted User account cannot be removed.');

      await tx.userRole.deleteMany({ where: { userId } });
      await tx.deadlineAlertDismissal.deleteMany({ where: { userId } });
      const references = await tx.$queryRawUnsafe<Array<{ table_name: string; column_name: string }>>(USER_REFERENCES_SQL);
      let movedRecords = 0;
      for (const { table_name, column_name } of references) {
        // table_name comes from regclass, already quoted where needed.
        movedRecords += await tx.$executeRawUnsafe(
          `UPDATE ${table_name} SET ${quoteIdent(column_name)} = $1 WHERE ${quoteIdent(column_name)} = $2`,
          placeholder.id,
          userId,
        );
      }
      await tx.user.delete({ where: { id: userId } });
      return { movedRecords };
    },
    { maxWait: 10_000, timeout: 60_000 },
  );
}
