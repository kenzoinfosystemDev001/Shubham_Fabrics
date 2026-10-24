import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { normalizeDepartmentCode, normalizeRoleCode } from '@subham/types';

export const DEFECTIVE_SHELF_DEPARTMENTS = [
  'DYEING',
  'DYEING_QC',
  'EMBROIDERY',
  'THREAD_CUTTING',
  'THREADCUT_QC',
  'WASHING',
  'WASHING_QC',
  'RECUTTING',
  'STITCHING',
  'FINISHING',
  'STEAM_PRESS',
  'FINAL_QC',
  'PACKING',
] as const;

export type DefectiveShelfDepartment = (typeof DEFECTIVE_SHELF_DEPARTMENTS)[number];

export const DEFECTIVE_SHELF_INFO: Record<DefectiveShelfDepartment, { code: string; name: string }> = {
  DYEING: { code: 'DEF-SHELF-DYEING', name: 'Dyeing Station' },
  DYEING_QC: { code: 'DEF-SHELF-DYEING-QC', name: 'Dyeing QC' },
  EMBROIDERY: { code: 'DEF-SHELF-EMBROIDERY', name: 'Embroidery Station' },
  THREAD_CUTTING: { code: 'DEF-SHELF-THREAD-CUTTING', name: 'Thread Cutting' },
  THREADCUT_QC: { code: 'DEF-SHELF-THREADCUT-QC', name: 'Threadcut QC' },
  WASHING: { code: 'DEF-SHELF-WASHING', name: 'Washing Station' },
  WASHING_QC: { code: 'DEF-SHELF-WASHING-QC', name: 'Washing QC' },
  RECUTTING: { code: 'DEF-SHELF-RECUTTING', name: 'Recutting' },
  STITCHING: { code: 'DEF-SHELF-STITCHING', name: 'Stitching' },
  FINISHING: { code: 'DEF-SHELF-FINISHING', name: 'Finishing' },
  STEAM_PRESS: { code: 'DEF-SHELF-STEAM-PRESS', name: 'Steam Press' },
  FINAL_QC: { code: 'DEF-SHELF-FINAL-QC', name: 'Final QC' },
  PACKING: { code: 'DEF-SHELF-PACKING', name: 'Packing' },
};

export interface DefectiveShelfActor {
  id: string;
  fullName: string;
  departmentCode: string | null;
  roles: string[];
  isAdmin: boolean;
}

export function normalizeShelfDepartment(value?: string | null): string | null {
  const key = normalizeDepartmentCode(value);
  if (!key) return null;
  if (key === 'WASHING_QC_INSPECTOR') return 'WASHING_QC';
  if (['THREAD_CUT', 'CUTTING', 'THC'].includes(key)) return 'THREAD_CUTTING';
  if (key === 'FINALCHECK') return 'FINAL_QC';
  if (['FABRIC_STORE', 'RAW_FABRIC_STORE'].includes(key)) return 'STORE';
  if (key === 'PROGRAMMER') return 'PROGRAMMING';
  return key;
}

function departmentFromRoles(roles: string[]): string | null {
  const patterns: Array<[RegExp, string]> = [
    [/^WASHING_QC_/, 'WASHING_QC'],
    [/^THREADCUT_QC_/, 'THREADCUT_QC'],
    [/^DYEING_QC_/, 'DYEING_QC'],
    [/^FINAL_(CHECK|QC)_/, 'FINAL_QC'],
    [/^STEAM_PRESS_/, 'STEAM_PRESS'],
    [/^THREAD_CUTTING_|^CUTTING_/, 'THREAD_CUTTING'],
    [/^EMBROIDERY_/, 'EMBROIDERY'],
    [/^RECUTTING_/, 'RECUTTING'],
    [/^STITCHING_/, 'STITCHING'],
    [/^FINISHING_/, 'FINISHING'],
    [/^WASHING_/, 'WASHING'],
    [/^DYEING_/, 'DYEING'],
    [/^PACKING_/, 'PACKING'],
  ];
  for (const role of roles) {
    for (const [pattern, department] of patterns) {
      if (pattern.test(role)) return department;
    }
  }
  if (roles.includes('FABRIC_STORE') || roles.includes('STORE_MANAGER') || roles.includes('STORE_INCHARGE')) return 'STORE';
  if (roles.includes('STORE_OPERATOR')) return 'STORE';
  if (roles.includes('QC_INSPECTOR')) return 'DYEING_QC';
  if (roles.includes('PROGRAMMER') || roles.includes('PROGRAMMING_INCHARGE')) return 'PROGRAMMING';
  return null;
}

export async function getDefectiveShelfActor(request: Request): Promise<
  | { actor: DefectiveShelfActor; response: null }
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
  const match = /^mes_jwt_(.+)_(\d{10,})$/.exec(token);
  if (!match) {
    return { actor: null, response: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) };
  }

  const issuedAt = Number(match[2]);
  const maxAge = 7 * 24 * 60 * 60 * 1000;
  if (!Number.isSafeInteger(issuedAt) || Date.now() - issuedAt > maxAge || issuedAt > Date.now()) {
    return { actor: null, response: NextResponse.json({ error: 'Session has expired. Sign in again.' }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({
    where: { id: match[1] },
    include: { userRoles: { include: { role: { select: { code: true } } } } },
  });
  if (!user || !user.isActive) {
    return { actor: null, response: NextResponse.json({ error: 'Authenticated user is unavailable.' }, { status: 401 }) };
  }

  const roles = user.userRoles.map(({ role }) => normalizeRoleCode(role.code));
  const departmentCode = normalizeShelfDepartment(user.departmentCode) || departmentFromRoles(roles);
  const isAdmin = departmentCode === 'ADMIN' || roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');

  return {
    actor: { id: user.id, fullName: user.fullName, departmentCode, roles, isAdmin },
    response: null,
  };
}

export function isShelfDepartment(value?: string | null): value is DefectiveShelfDepartment {
  return DEFECTIVE_SHELF_DEPARTMENTS.includes(value as DefectiveShelfDepartment);
}

export function isProgrammingActor(actor: DefectiveShelfActor): boolean {
  return actor.departmentCode === 'PROGRAMMING' || actor.roles.some((role) => ['PROGRAMMER', 'PROGRAMMING_INCHARGE'].includes(role));
}

export function canViewCentralShelf(actor: DefectiveShelfActor): boolean {
  if (isProgrammingActor(actor)) return false;
  return actor.departmentCode === 'STORE' || actor.isAdmin;
}

export function canManageShelfDepartment(actor: DefectiveShelfActor, department: string): boolean {
  if (!isShelfDepartment(department) || isProgrammingActor(actor)) return false;
  return actor.departmentCode === department || actor.isAdmin;
}

export async function authorizeDefectReport(request: Request, department: string): Promise<
  | { actor: DefectiveShelfActor; response: null }
  | { actor: null; response: NextResponse }
> {
  const auth = await getDefectiveShelfActor(request);
  if (!auth.actor) return auth;
  if (!canManageShelfDepartment(auth.actor, normalizeShelfDepartment(department) || department.toUpperCase())) {
    return {
      actor: null,
      response: NextResponse.json({ error: 'Only the reporting department can send material to its defective shelf.' }, { status: 403 }),
    };
  }
  return auth;
}

