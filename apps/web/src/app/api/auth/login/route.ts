import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import bcrypt from 'bcryptjs';
import { buildSessionUser } from '@/lib/auth/session-user';
import { setSessionCookies } from '@/lib/auth/require-user';
import { AuthConfigError, signSessionToken } from '@/lib/auth/session-token';
import { MES_DEPARTMENTS, isStationUsername } from '@/lib/departments';

export const dynamic = 'force-dynamic';

const INVALID_CREDENTIALS = 'Invalid username or PIN. Please try again.';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const usernameOrEmail = String(body.usernameOrEmail || '').trim().toLowerCase();
    const password = String(body.password || '').trim();

    if (!usernameOrEmail || !password) {
      return NextResponse.json(
        { message: 'Username and PIN / password are required.' },
        { status: 400 }
      );
    }

    const include = { userRoles: { include: { role: true } } } as const;
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: usernameOrEmail, mode: 'insensitive' } },
          { email: { equals: usernameOrEmail, mode: 'insensitive' } },
        ],
      },
      include,
    });
    // A station's other sign-in names (e.g. "inventory" and the earlier "packing") reach the same account.
    const station = user ? null : MES_DEPARTMENTS.find((d) => isStationUsername(d, usernameOrEmail));
    if (station) {
      const names = [station.stationId, ...(station.stationAliases || [])].filter((n) => n !== usernameOrEmail);
      user = await prisma.user.findFirst({
        where: { OR: names.map((n) => ({ username: { equals: n, mode: 'insensitive' as const } })) },
        include,
      });
    }

    const isPasswordValid = user?.passwordHash
      ? await bcrypt.compare(password, user.passwordHash).catch(() => false)
      : false;

    if (!user || !isPasswordValid) {
      return NextResponse.json({ message: INVALID_CREDENTIALS }, { status: 401 });
    }

    if (!user.isActive) {
      return NextResponse.json(
        { message: 'This user account has been deactivated. Please contact an Administrator.' },
        { status: 403 }
      );
    }

    const sessionUser = buildSessionUser(user);
    const token = await signSessionToken({
      sub: sessionUser.id,
      username: sessionUser.username,
      fullName: sessionUser.fullName,
      role: sessionUser.role,
      roles: sessionUser.roles,
      dept: sessionUser.departmentCode,
    });

    const response = NextResponse.json({ user: sessionUser });
    setSessionCookies(response, request, token, sessionUser);
    return response;
  } catch (error: any) {
    console.error('Error in login handler:', error);
    if (error instanceof AuthConfigError) {
      return NextResponse.json({ message: 'Server authentication is not configured.' }, { status: 500 });
    }
    return NextResponse.json({ message: 'Login failed due to an internal error.' }, { status: 500 });
  }
}
