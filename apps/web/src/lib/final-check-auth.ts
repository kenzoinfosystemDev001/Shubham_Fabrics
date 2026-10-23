import { NextResponse } from 'next/server';
import { requireDepartment } from '@/lib/auth/department-access';

interface FinalCheckActor {
  id: string;
  departmentCode: string | null;
  roles: string[];
  isAdmin: boolean;
}

export async function getFinalCheckActor(request: Request): Promise<
  | { actor: FinalCheckActor; response: null }
  | { actor: null; response: NextResponse }
> {
  const { user, response } = await requireDepartment(request, 'FINAL_CHECK');
  if (!user) return { actor: null, response };

  return {
    actor: { id: user.id, departmentCode: user.departmentCode, roles: user.roles, isAdmin: user.isAdmin },
    response: null,
  };
}
