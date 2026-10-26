/**
 * Runs once when the Next.js server starts (dev or start), before it serves requests:
 * 1. applies any database migration this version of the app needs and the database does not have yet
 *    (scripts/apply-appearance-migrations.js — idempotent; applied files are recorded in the database,
 *    so a normal start only checks that record), so no screen fails for a missing table or column;
 * 2. checks that the database has every table and column the app expects and logs anything missing.
 * Set SKIP_AUTO_MIGRATIONS=1 to turn step 1 off.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  await applyPendingMigrations();
  const { reportDatabaseSchema } = await import('@/lib/schema-check');
  // Do not delay startup; the result is logged when ready.
  void reportDatabaseSchema();
}

async function applyPendingMigrations() {
  // Serverless deployments (Vercel) do not ship the scripts folder.
  if (process.env.SKIP_AUTO_MIGRATIONS === '1' || process.env.VERCEL) return;
  const { existsSync } = await import('node:fs');
  const { dirname, join } = await import('node:path');
  const { execFile } = await import('node:child_process');

  // The web app runs from apps/web; the script is in the repository's scripts folder.
  let dir = process.cwd();
  let script: string | null = null;
  for (let i = 0; i < 5 && !script; i++) {
    const candidate = join(dir, 'scripts', 'apply-appearance-migrations.js');
    if (existsSync(candidate)) script = candidate;
    dir = dirname(dir);
  }
  if (!script) return;
  const root = dirname(dirname(script));

  await new Promise<void>((resolve) => {
    // --soft: a problem is printed but never stops the app from starting.
    execFile(process.execPath, [script!, '--soft'], { cwd: root, timeout: 5 * 60 * 1000, env: process.env }, (error, stdout, stderr) => {
      const out = `${stdout || ''}${stderr || ''}`.trim();
      if (out) console.log(out);
      if (error) console.error('[migrations] Could not run the database migrations at startup:', error.message);
      resolve();
    });
  });
}
