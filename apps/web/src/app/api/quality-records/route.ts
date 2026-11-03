import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { departmentKeyFor, userBelongsToDepartment } from '@/lib/auth/department-access';
import { errorResponse, WorkRequestError } from '@/lib/work-items-server';
import { loadRejectRecords, loadReworkRecords } from '@/lib/quality-monitor-server';

export const dynamic = 'force-dynamic';

// GET /api/quality-records?department=CODE&kind=REJECT|REWORK — a QC department's own REJECT or REWORK decisions,
// with where each one is now (on the Defective Shelf; the rework department's task and its forwarding challans).
// Read-only views of the same records the Defective Shelves and the admin dashboards use.
export async function GET(request: Request) {
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    const p = new URL(request.url).searchParams;
    const department = departmentKeyFor(p.get('department')) || '';
    const kind = (p.get('kind') || '').toUpperCase();
    if (!department) throw new WorkRequestError('Choose the department.');
    if (kind !== 'REJECT' && kind !== 'REWORK') throw new WorkRequestError('Choose REJECT or REWORK.');
    if (!userBelongsToDepartment(user, department)) throw new WorkRequestError('You do not have access to this department.', 403);
    const all = kind === 'REJECT' ? await loadRejectRecords() : await loadReworkRecords();
    return NextResponse.json({ data: all.filter((r) => r.departmentCode === department && r.quantity > 0) });
  } catch (error) {
    return errorResponse(error, 'Failed to load the QC decisions.');
  }
}
