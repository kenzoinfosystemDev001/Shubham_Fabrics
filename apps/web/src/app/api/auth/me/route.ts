import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { buildSessionUser } from '@/lib/auth/session-user';

export const dynamic = 'force-dynamic';

/** The signed-in user's profile, from the same database read as the session check (no second lookup). */
export async function GET(request: Request) {
  const { user, response } = await requireUser(request);
  if (!user) return response;
  return NextResponse.json(
    buildSessionUser({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      departmentCode: user.departmentCode,
      userRoles: user.roles.map((code) => ({ role: { code } })),
    }),
  );
}
