import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

const FINAL_CHECK_DEPARTMENTS = new Set(['FINAL_CHECK', 'FINAL CHECK', 'FINAL_QC', 'FINAL-CHECK']);
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

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
  const authorization = request.headers.get('authorization') || '';
  const bearerToken = authorization.replace(/^Bearer\s+/i, '').trim();
  const cookieToken = request.headers
    .get('cookie')
    ?.split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith('subham_mes_token='))
    ?.slice('subham_mes_token='.length);
  const token = bearerToken || cookieToken || '';
  const tokenMatch = /^mes_jwt_(.+)_(\d{10,})$/.exec(token);
  if (!tokenMatch) {
    return { actor: null, response: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) };
  }

  const issuedAt = Number(tokenMatch[2]);
  if (!Number.isSafeInteger(issuedAt) || Date.now() - issuedAt > SESSION_MAX_AGE_MS || issuedAt > Date.now()) {
    return { actor: null, response: NextResponse.json({ error: 'Session has expired. Sign in again.' }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({
    where: { id: tokenMatch[1] },
    include: { userRoles: { include: { role: { select: { code: true } } } } },
  });
  if (!user || !user.isActive) {
    return { actor: null, response: NextResponse.json({ error: 'Authenticated user is unavailable.' }, { status: 401 }) };
  }

  const roles = user.userRoles.map(({ role }) => role.code.toUpperCase());
  const isAdmin =
    user.departmentCode?.toUpperCase() === 'ADMIN' ||
    roles.includes('ADMIN') ||
    roles.includes('SUPER_ADMIN');
  const isFinalCheckUser =
    Boolean(user.departmentCode && FINAL_CHECK_DEPARTMENTS.has(user.departmentCode.toUpperCase())) ||
    roles.some((role) => ['FINAL_CHECK_INSPECTOR', 'FINAL_QC_INSPECTOR'].includes(role));
  if (!isAdmin && !isFinalCheckUser) {
    return {
      actor: null,
      response: NextResponse.json({ error: 'Final QC department access is required.' }, { status: 403 }),
    };
  }

  return {
    actor: { id: user.id, departmentCode: user.departmentCode, roles, isAdmin },
    response: null,
  };
}
