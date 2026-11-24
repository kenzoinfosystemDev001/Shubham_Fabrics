import { NextResponse } from 'next/server';
import { buildSessionUser } from '@/lib/auth/session-user';
import { setSessionCookies } from '@/lib/auth/require-user';
import { AuthConfigError, signSessionToken } from '@/lib/auth/session-token';
import { resolveLogin } from '@/lib/auth/account-resolution';

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

    // The login name (username, station ID, older alias or designation such as "Inventory Incharge") is
    // resolved to every account it can mean; the PIN then picks exactly one. See account-resolution.ts.
    const result = await resolveLogin(usernameOrEmail, password);
    if (result.kind === 'invalid') {
      return NextResponse.json({ message: INVALID_CREDENTIALS }, { status: 401 });
    }
    if (result.kind === 'inactive') {
      return NextResponse.json(
        { message: 'This user account has been deactivated. Please contact an Administrator.' },
        { status: 403 }
      );
    }
    if (result.kind === 'ambiguous') {
      return NextResponse.json(
        { message: 'Two accounts share this username and PIN. Ask the Administrator to give each a different PIN.' },
        { status: 409 }
      );
    }
    const user = result.user;

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
