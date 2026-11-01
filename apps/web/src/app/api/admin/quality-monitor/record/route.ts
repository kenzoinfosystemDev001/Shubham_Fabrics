import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { apiErrorResponse } from '@/lib/api-errors';
import { WorkRequestError } from '@/lib/work-items-server';
import { monitorRecordDetail } from '@/lib/quality-monitor-server';

export const dynamic = 'force-dynamic';

// GET /api/admin/quality-monitor/record?id=rej-insp:<id> — one REJECT / REWORK / HOLD record with its
// Production Sheet, line, related challans and complete movement history (administrators only).
export async function GET(request: Request) {
  const { user, response } = await requireUser(request, { admin: true });
  if (!user) return response;
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!/^(rej-insp|rwk-insp|rwk-qc1|rej-def|hold):[\w-]+$/.test(id)) {
    return NextResponse.json({ error: 'A valid record id is required.' }, { status: 400 });
  }
  try {
    return NextResponse.json(await monitorRecordDetail(id, user));
  } catch (error) {
    if (error instanceof WorkRequestError) return NextResponse.json({ error: error.message }, { status: error.status });
    return apiErrorResponse(error, 'Could not load this record.', 'Quality monitor record failed:');
  }
}
