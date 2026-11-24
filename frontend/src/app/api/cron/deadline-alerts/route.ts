import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/require-user';
import { reconcileAllDepartments } from '@/lib/deadline-alerts/engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Constant-time comparison so the secret cannot be guessed byte by byte. */
function safeEqual(a: string, b: string) {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/**
 * Scheduled generation of deadline alerts (see vercel.json). Authorized by
 * `Authorization: Bearer $CRON_SECRET` (what Vercel Cron sends) or an administrator session for
 * a manual run. Idempotent: retries and overlapping runs never duplicate alerts.
 */
async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get('authorization') || '';
  const bySecret = !!secret && secret.length >= 16 && safeEqual(header, `Bearer ${secret}`);

  if (!bySecret) {
    const user = await getSessionUser(request).catch(() => null);
    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Not authorized.' }, { status: 401 });
    }
  }

  const startedAt = new Date();
  const results = await reconcileAllDepartments(startedAt);
  const failed = results.some((r) => r.error);
  return NextResponse.json(
    { data: { startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(), results } },
    { status: failed ? 500 : 200 },
  );
}

export const GET = run;
export const POST = run;
