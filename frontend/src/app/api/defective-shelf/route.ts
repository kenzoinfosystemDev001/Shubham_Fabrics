import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { departmentKeyFor, userBelongsToDepartment } from '@/lib/auth/department-access';
import { errorResponse, WorkRequestError } from '@/lib/work-items-server';
import { loadRejectRecords } from '@/lib/quality-monitor-server';

export const dynamic = 'force-dynamic';

// GET /api/defective-shelf?department=CODE|ALL — currently rejected fabric. A department sees only its own
// rejections; the Fabric Store (central Defective Shelf) and administrators see every department (ALL).
// Read-only: the records are the QC inspection batches and defect records themselves, never copies.
export async function GET(request: Request) {
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    const raw = (new URL(request.url).searchParams.get('department') || '').trim().toUpperCase();
    const central = userBelongsToDepartment(user, 'STORE'); // administrators pass too
    let department: string | null;
    if (!raw || raw === 'ALL' || raw === 'STORE') {
      if (!central) throw new WorkRequestError('Only the Fabric Store sees every department’s Defective Shelf.', 403);
      department = null;
    } else {
      department = departmentKeyFor(raw) || raw;
      if (!central && !userBelongsToDepartment(user, department)) throw new WorkRequestError('You can only see your own department’s Defective Shelf.', 403);
    }
    const all = await loadRejectRecords();
    const data = (department ? all.filter((r) => r.departmentCode === department) : all).filter((r) => r.quantity > 0);
    return NextResponse.json({ department: department || 'ALL', data });
  } catch (error) {
    return errorResponse(error, 'Failed to load the Defective Shelf.');
  }
}
