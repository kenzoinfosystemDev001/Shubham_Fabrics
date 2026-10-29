import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import { buildSessionUser, type SessionUser } from './session-user';
import {
  AuthConfigError,
  DEPT_COOKIE,
  ROLE_COOKIE,
  SESSION_COOKIE,
  getSessionTtlSeconds,
  isAdminClaims,
  readSessionToken,
  verifySessionToken,
} from './session-token';

export interface AuthenticatedUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  /** Department code stored on the user record. */
  departmentCode: string | null;
  /** Role codes from the database, upper-cased. */
  roles: string[];
  /** Normalized role and department from the session (same values the login response returned). */
  sessionRole: string;
  sessionDepartment: string;
  isAdmin: boolean;
}

export interface RequireUserOptions {
  /** Only administrators may call the route. */
  admin?: boolean;
  /** Users whose department is in this list may call the route (administrators always may). */
  departments?: Iterable<string>;
  /** Users holding any of these role codes may call the route (administrators always may). */
  roles?: string[];
}

export type RequireUserResult =
  | { user: AuthenticatedUser; response: null }
  | { user: null; response: NextResponse };

function readCookie(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.get('cookie') || '';
  for (const part of cookieHeader.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

/**
 * Resolves the signed-in user from the session cookie (or Bearer token), re-checking the
 * database so deactivated users lose access immediately. Returns null when unauthenticated.
 */
export async function getSessionUser(request: Request): Promise<AuthenticatedUser | null> {
  const token = readSessionToken(readCookie(request, SESSION_COOKIE), request.headers.get('authorization'));
  const claims = await verifySessionToken(token);
  if (!claims) return null;

  // Runs on every API request. The user and their role codes are read in parallel (the role filter
  // is a subquery), so the check costs one database round trip instead of three sequential ones.
  const [user, roleRows] = await Promise.all([
    prisma.user.findUnique({ where: { id: claims.sub } }),
    prisma.role.findMany({ where: { userRoles: { some: { userId: claims.sub } } }, select: { code: true } }),
  ]);
  if (!user || !user.isActive) return null;

  // Role and department are recomputed from the database on every request, so an admin's
  // changes (new department, removed admin role) apply immediately, not at the next login.
  const roles = roleRows.map(({ code }) => code.toUpperCase());
  const current = buildSessionUser({ ...user, userRoles: roleRows.map((role) => ({ role })) });
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    departmentCode: user.departmentCode,
    roles,
    sessionRole: current.role,
    sessionDepartment: current.departmentCode,
    isAdmin: isAdminClaims({ role: current.role, roles, dept: current.departmentCode }),
  };
}

/**
 * Route-handler guard. Usage:
 *   const { user, response } = await requireUser(request, { departments: ['INVENTORY'] });
 *   if (!user) return response;
 */
export async function requireUser(request: Request, options: RequireUserOptions = {}): Promise<RequireUserResult> {
  let user: AuthenticatedUser | null;
  try {
    user = await getSessionUser(request);
  } catch (error) {
    if (error instanceof AuthConfigError) {
      console.error(error.message);
      return { user: null, response: NextResponse.json({ error: 'Server authentication is not configured.' }, { status: 500 }) };
    }
    throw error;
  }

  if (!user) {
    return { user: null, response: NextResponse.json({ error: 'Authentication required. Please sign in.' }, { status: 401 }) };
  }

  if (user.isAdmin) return { user, response: null };
  if (options.admin) {
    return { user: null, response: NextResponse.json({ error: 'Administrator access is required.' }, { status: 403 }) };
  }

  const departments = options.departments ? new Set(Array.from(options.departments, (d) => d.toUpperCase())) : null;
  const allowedRoles = options.roles?.map((r) => r.toUpperCase());
  if (!departments && !allowedRoles) return { user, response: null };

  const inDepartment =
    !!departments &&
    (departments.has((user.departmentCode || '').toUpperCase()) || departments.has(user.sessionDepartment.toUpperCase()));
  const hasRole = !!allowedRoles && user.roles.some((role) => allowedRoles.includes(role));
  if (inDepartment || hasRole) return { user, response: null };

  return {
    user: null,
    response: NextResponse.json({ error: 'You do not have access to this department.' }, { status: 403 }),
  };
}

function isHttpsRequest(request: Request): boolean {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  if (forwardedProto) return forwardedProto.split(',')[0].trim() === 'https';
  return new URL(request.url).protocol === 'https:';
}

export function setSessionCookies(response: NextResponse, request: Request, token: string, user: SessionUser) {
  const base = {
    path: '/',
    maxAge: getSessionTtlSeconds(),
    sameSite: 'lax' as const,
    secure: isHttpsRequest(request),
  };
  // The session token is never readable from JavaScript.
  response.cookies.set(SESSION_COOKIE, token, { ...base, httpOnly: true });
  // Role and department cookies are display hints for the client only; the server never trusts them.
  response.cookies.set(ROLE_COOKIE, user.role, base);
  response.cookies.set(DEPT_COOKIE, user.departmentCode, base);
}

export function clearSessionCookies(response: NextResponse) {
  for (const name of [SESSION_COOKIE, ROLE_COOKIE, DEPT_COOKIE]) {
    response.cookies.set(name, '', { path: '/', maxAge: 0 });
  }
}

export function canViewClientCode(user: Pick<AuthenticatedUser, 'isAdmin' | 'sessionRole' | 'sessionDepartment' | 'roles'>): boolean {
  if (user.isAdmin) return true;
  const programmingRoles = ['PROGRAMMER', 'PROGRAMMING_INCHARGE'];
  return (
    user.sessionDepartment.toUpperCase() === 'PROGRAMMING' ||
    programmingRoles.includes(user.sessionRole.toUpperCase()) ||
    user.roles.some((role) => programmingRoles.includes(role))
  );
}

/**
 * Bulk-delete endpoints (clear-all-data, delete-all) are disabled unless
 * ALLOW_DESTRUCTIVE_ADMIN_ACTIONS=true is set explicitly for the deployment.
 */
export function destructiveAdminActionsDisabled(): NextResponse | null {
  if (process.env.ALLOW_DESTRUCTIVE_ADMIN_ACTIONS === 'true') return null;
  return NextResponse.json(
    { error: 'Bulk delete actions are disabled on this server. Set ALLOW_DESTRUCTIVE_ADMIN_ACTIONS=true to enable them.' },
    { status: 403 },
  );
}
