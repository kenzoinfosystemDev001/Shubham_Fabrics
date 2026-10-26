/**
 * Runs once when the Next.js server starts (dev or start), before it serves requests:
 * 1. applies any database migration this version of the app needs and the database does not have yet
 *    (scripts/apply-appearance-migrations.js — idempotent; applied files are recorded in the database,
 *    so a normal start only checks that record), so no screen fails for a missing table or column;
 * 2. checks that the database has every table and column the app expects and logs anything missing.
 * Set SKIP_AUTO_MIGRATIONS=1 to turn step 1 off.
 *
 * Node-only code must be imported inside the NEXT_RUNTIME === 'nodejs' block so webpack drops it
 * from the Edge build (otherwise the build fails on node:fs / node:child_process).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { applyPendingMigrations } = await import('./instrumentation-node');
    await applyPendingMigrations();
    const { reportDatabaseSchema } = await import('@/lib/schema-check');
    // Do not delay startup; the result is logged when ready.
    void reportDatabaseSchema();
  }
}
