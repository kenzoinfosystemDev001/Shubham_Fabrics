import { NextResponse } from 'next/server';

export const MIGRATION_COMMAND = 'node scripts/apply-appearance-migrations.js';

/**
 * Recognises database problems that are setup issues rather than bugs, so API routes can say what
 * to do instead of a generic "failed" message:
 * - the running server still has a database client generated before a schema change (restart it);
 * - the database is missing tables/columns the code expects (apply the migrations);
 * - the database cannot be reached.
 * Returns null for anything else.
 */
export function describeDatabaseError(error: unknown): { status: number; message: string } | null {
  const err = error as { name?: string; code?: string; message?: string } | null;
  if (!err) return null;
  const message = String(err.message || '');

  if (err.name === 'PrismaClientValidationError' && /Unknown (field|argument|arg)|Unknown nested field|Invalid value for argument/i.test(message)) {
    return {
      status: 503,
      message:
        'The web server is running an outdated database client. Restart the web app (stop it and start it again) to load the latest version.',
    };
  }
  if (err.code === 'P2021' || err.code === 'P2022') {
    return {
      status: 503,
      message: `The database is missing tables or columns this screen needs. From the Shubham_Fabrics folder run "${MIGRATION_COMMAND}", then restart the web app.`,
    };
  }
  // A department code with no Department row yet (e.g. INVENTORY before its migration has run).
  if (err.code === 'P2003' && /Department/i.test(JSON.stringify((err as { meta?: unknown }).meta ?? '') + message)) {
    return {
      status: 503,
      message: `The database does not have this department set up yet. From the Shubham_Fabrics folder run "${MIGRATION_COMMAND}", then restart the web app.`,
    };
  }
  if (err.name === 'PrismaClientInitializationError' || err.code === 'P1001' || err.code === 'P1002') {
    return { status: 503, message: 'The database cannot be reached right now. Check the connection and try again.' };
  }
  return null;
}

/** JSON error response for an API route: a specific setup message when recognised, otherwise `fallback`. */
export function apiErrorResponse(error: unknown, fallback: string, log = fallback) {
  const known = describeDatabaseError(error);
  if (known) {
    console.error(`${log} ${known.message}`, error);
    return NextResponse.json({ error: known.message }, { status: known.status });
  }
  console.error(log, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
