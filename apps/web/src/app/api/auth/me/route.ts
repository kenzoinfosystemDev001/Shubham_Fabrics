import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireUser } from '@/lib/auth/require-user';
import { buildSessionUser } from '@/lib/auth/session-user';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { user, response } = await requireUser(request);
  if (!user) return response;

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { userRoles: { include: { role: true } } },
    });
    if (!dbUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.json(buildSessionUser(dbUser));
  } catch (error) {
    console.error('Error in auth/me:', error);
    return NextResponse.json({ error: 'Failed to load the current user.' }, { status: 500 });
  }
}
