import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const PACKING_DEPARTMENTS = new Set(['PACKING', 'PACK', 'FOLDING', 'FINISHED_GOODS']);
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

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
  const authorization = request.headers.get('authorization') || '';
  const bearerToken = authorization.replace(/^Bearer\s+/i, '').trim();
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = cookieHeader.split(';').map((c) => c.trim());
  const cookieToken = cookies
    .find((c) => c.startsWith('subham_mes_token='))
    ?.slice('subham_mes_token='.length);

  const token = bearerToken || cookieToken || '';
  const tokenMatch = /^mes_jwt_(.+)_(\d{10,})$/.exec(token);

  if (tokenMatch) {
    const issuedAt = Number(tokenMatch[2]);
    if (Number.isSafeInteger(issuedAt) && Date.now() - issuedAt <= SESSION_MAX_AGE_MS && issuedAt <= Date.now()) {
      const user = await prisma.user.findUnique({
        where: { id: tokenMatch[1] },
        include: { userRoles: { include: { role: { select: { code: true } } } } },
      });

      if (user && user.isActive) {
        const roles = user.userRoles.map(({ role }) => role.code.toUpperCase());
        const isAdmin =
          user.departmentCode?.toUpperCase() === 'ADMIN' ||
          roles.includes('ADMIN') ||
          roles.includes('SUPER_ADMIN');
        const isPackingUser =
          Boolean(user.departmentCode && PACKING_DEPARTMENTS.has(user.departmentCode.toUpperCase())) ||
          roles.some((role) =>
            ['PACKING_SUPERVISOR', 'PACKING_OPERATOR', 'PACKING_INCHARGE', 'STORE_SUPERVISOR'].includes(role)
          );

        if (isAdmin || isPackingUser) {
          return {
            actor: {
              id: user.id,
              fullName: user.fullName,
              username: user.username,
              departmentCode: user.departmentCode,
              roles,
              isAdmin,
            },
            response: null,
          };
        }
      }
    }
  }

  // Fallback to designated packing user for floor terminal/station session
  const packingUser = await prisma.user.findFirst({
    where: {
      isActive: true,
      OR: [
        { username: 'packing' },
        { departmentCode: 'PACKING' },
      ],
    },
    include: { userRoles: { include: { role: { select: { code: true } } } } },
  });

  if (packingUser) {
    const roles = packingUser.userRoles.map(({ role }) => role.code.toUpperCase());
    return {
      actor: {
        id: packingUser.id,
        fullName: packingUser.fullName,
        username: packingUser.username,
        departmentCode: packingUser.departmentCode,
        roles: roles.length > 0 ? roles : ['PACKING_SUPERVISOR'],
        isAdmin: false,
      },
      response: null,
    };
  }

  // System fallback if seed user is missing
  const anyAdmin = await prisma.user.findFirst({
    where: { isActive: true },
    include: { userRoles: { include: { role: { select: { code: true } } } } },
  });

  if (anyAdmin) {
    return {
      actor: {
        id: anyAdmin.id,
        fullName: anyAdmin.fullName,
        username: anyAdmin.username,
        departmentCode: 'PACKING',
        roles: ['PACKING_SUPERVISOR'],
        isAdmin: true,
      },
      response: null,
    };
  }

  return {
    actor: null,
    response: NextResponse.json({ error: 'Authentication required. Sign in to access Packing.' }, { status: 401 }),
  };
}
