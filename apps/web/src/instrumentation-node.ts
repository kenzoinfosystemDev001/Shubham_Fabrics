/**
 * Node.js-only startup work, loaded from instrumentation.ts when NEXT_RUNTIME is 'nodejs'.
 * Kept in its own module so the Edge build never sees the node: imports.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execFile } from 'node:child_process';

export async function applyPendingMigrations() {
  // Serverless deployments (Vercel) do not ship the scripts folder.
  if (process.env.SKIP_AUTO_MIGRATIONS === '1' || process.env.VERCEL) return;

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
