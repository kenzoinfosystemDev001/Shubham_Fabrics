import { Prisma, prisma } from '@shubham/database';
import { MIGRATION_COMMAND } from '@/lib/api-errors';

export interface SchemaCheckResult {
  ok: boolean;
  missingTables: string[];
  missingColumns: string[];
  checkedAt: string;
  error?: string;
}

let cached: SchemaCheckResult | null = null;
let pending: Promise<SchemaCheckResult> | null = null;

/**
 * Compares the tables/columns the generated Prisma client expects with the live database
 * (read-only: information_schema). Catches a schema change whose migration was never applied,
 * for any department, before users hit failing screens. A matching result is kept for the life of
 * the process; a mismatch is re-checked on the next call, so applying the migration clears it.
 */
export async function checkDatabaseSchema(force = false): Promise<SchemaCheckResult> {
  if (cached?.ok && !force) return cached;
  pending ??= run().finally(() => {
    pending = null;
  });
  cached = await pending;
  return cached;
}

async function run(): Promise<SchemaCheckResult> {
  const checkedAt = new Date().toISOString();
  try {
    const rows = await prisma.$queryRaw<Array<{ table_name: string; column_name: string }>>`
      SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = current_schema()`;
    const columns = new Map<string, Set<string>>();
    for (const r of rows) {
      if (!columns.has(r.table_name)) columns.set(r.table_name, new Set());
      columns.get(r.table_name)!.add(r.column_name);
    }

    const missingTables: string[] = [];
    const missingColumns: string[] = [];
    for (const model of Prisma.dmmf.datamodel.models) {
      const table = model.dbName || model.name;
      const existing = columns.get(table);
      if (!existing) {
        missingTables.push(table);
        continue;
      }
      for (const field of model.fields) {
        if (field.kind !== 'scalar' && field.kind !== 'enum') continue;
        const column = field.dbName || field.name;
        if (!existing.has(column)) missingColumns.push(`${table}.${column}`);
      }
    }
    return { ok: missingTables.length === 0 && missingColumns.length === 0, missingTables, missingColumns, checkedAt };
  } catch (error: any) {
    return { ok: false, missingTables: [], missingColumns: [], checkedAt, error: error?.message || String(error) };
  }
}

/** Logs the result once at startup so a missing migration is visible in the server output. */
export async function reportDatabaseSchema() {
  const result = await checkDatabaseSchema();
  if (result.error) {
    console.warn(`[schema-check] Could not verify the database schema: ${result.error}`);
  } else if (!result.ok) {
    console.warn(
      [
        '[schema-check] The database does not match this version of the app.',
        result.missingTables.length ? `  Missing tables: ${result.missingTables.join(', ')}` : null,
        result.missingColumns.length ? `  Missing columns: ${result.missingColumns.join(', ')}` : null,
        `  Fix: from the Shubham_Fabrics folder run "${MIGRATION_COMMAND}", then restart the web app.`,
      ]
        .filter(Boolean)
        .join('\n'),
    );
  } else {
    console.log('[schema-check] Database schema matches the app.');
  }
  return result;
}
