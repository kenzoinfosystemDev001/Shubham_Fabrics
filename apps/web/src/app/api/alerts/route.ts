import { NextResponse } from 'next/server';
import { normalizeShelfDepartment } from '@/lib/defective-shelf';
import { authorizeAlertAccess } from '@/lib/deadline-alerts/access';
import { getDepartmentAlertView, isAlertDepartmentActive } from '@/lib/deadline-alerts/engine';

export const dynamic = 'force-dynamic';

// GET /api/alerts?department=DYEING
// Re-checks every open task's current status and deadline before returning the caller's alerts.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const department = normalizeShelfDepartment(searchParams.get('department'));
    if (!department) {
      return NextResponse.json({ error: 'department is required' }, { status: 400 });
    }

    const auth = await authorizeAlertAccess(request, department);
    if (!auth.actor) return auth.response;

    if (!isAlertDepartmentActive(department)) {
      return NextResponse.json({ success: true, data: { department, enabled: false } });
    }

    const view = await getDepartmentAlertView(department, auth.actor.id);
    return NextResponse.json({ success: true, data: { ...view, enabled: true } });
  } catch (error: any) {
    console.error('Error loading deadline alerts:', error);
    return NextResponse.json({ error: 'Failed to load deadline alerts' }, { status: 500 });
  }
}
