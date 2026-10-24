import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getDefectiveShelfActor } from '@/lib/defective-shelf';
import { syncAllDeadlineAlerts } from '@/lib/deadline-alerts/engine';

export const dynamic = 'force-dynamic';

function hasCronSecret(request: Request): boolean {
  const secret = process.env.DEADLINE_ALERTS_CRON_SECRET;
  if (!secret) return false;
  const provided = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

// POST /api/alerts/run
// Generates deadline alerts for every enabled department. Called by the in-process scheduler
// and, on hosts without a long-running server, by an external cron with
// `Authorization: Bearer $DEADLINE_ALERTS_CRON_SECRET`. Admins may also trigger it.
export async function POST(request: Request) {
  if (!hasCronSecret(request)) {
    const auth = await getDefectiveShelfActor(request);
    if (!auth.actor) return auth.response;
    if (!auth.actor.isAdmin) {
      return NextResponse.json({ error: 'Only an administrator or the scheduler can run alert generation.' }, { status: 403 });
    }
  }

  const results = await syncAllDeadlineAlerts();
  const failed = results.filter((r) => 'error' in r);
  return NextResponse.json({ success: failed.length === 0, results }, { status: failed.length > 0 ? 500 : 200 });
}
