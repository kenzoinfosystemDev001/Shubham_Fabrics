import { NextResponse } from 'next/server';
import { getDefectiveShelfActor, normalizeShelfDepartment, type DefectiveShelfActor } from '@/lib/defective-shelf';

/** A user may see and dismiss a department's alerts only for their own department (admins: any). */
export function canAccessDepartmentAlerts(actor: Pick<DefectiveShelfActor, 'isAdmin' | 'departmentCode'>, department: string): boolean {
  return actor.isAdmin || normalizeShelfDepartment(actor.departmentCode) === department;
}

export async function authorizeAlertAccess(
  request: Request,
  department: string
): Promise<{ actor: DefectiveShelfActor; response: null } | { actor: null; response: NextResponse }> {
  const auth = await getDefectiveShelfActor(request);
  if (!auth.actor) return auth;
  if (!canAccessDepartmentAlerts(auth.actor, department)) {
    return {
      actor: null,
      response: NextResponse.json({ error: 'You do not have access to this department\'s alerts.' }, { status: 403 }),
    };
  }
  return { actor: auth.actor, response: null };
}
