import { NextResponse } from 'next/server';
import { requireDepartment } from '@/lib/auth/department-access';

export interface PackingActor {
  id: string;
  fullName: string;
  username: string;
  departmentCode: string | null;
  roles: string[];
  isAdmin: boolean;
}

export async function getPackingActor(request: Request): Promise<
  | { actor: PackingActor; response: null }
  | { actor: null; response: NextResponse }
> {
  const { user, response } = await requireDepartment(request, 'PACKING');
  if (!user) return { actor: null, response };

  return {
    actor: {
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      departmentCode: user.departmentCode,
      roles: user.roles,
      isAdmin: user.isAdmin,
    },
    response: null,
  };
}
