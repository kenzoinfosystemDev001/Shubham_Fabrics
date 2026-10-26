/**
 * Runs once when the Next.js server starts. Checks that the database has every table and column the
 * app expects, so a schema change without its migration shows up in the server log immediately.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { reportDatabaseSchema } = await import('@/lib/schema-check');
  // Do not delay startup; the result is logged when ready.
  void reportDatabaseSchema();
}
