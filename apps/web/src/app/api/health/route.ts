import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { describeDatabaseError } from '@/lib/api-errors';
import { checkDatabaseSchema } from '@/lib/schema-check';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const programCount = await prisma.program.count();
    const schema = await checkDatabaseSchema();
    return NextResponse.json({
      status: schema.ok ? 'ok' : 'degraded',
      service: 'Shubham Fabrics Web & MES Gateway',
      database: 'connected',
      // Public endpoint: only whether a migration is pending. The missing names are in the server log.
      schema: { ok: schema.ok, missing: schema.missingTables.length + schema.missingColumns.length, checkedAt: schema.checkedAt },
      programCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'error',
        database: 'error',
        error: describeDatabaseError(error)?.message || error.message,
      },
      { status: 500 },
    );
  }
}
