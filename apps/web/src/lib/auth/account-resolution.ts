import { prisma } from '@shubham/database';
import bcrypt from 'bcryptjs';
import { MES_DEPARTMENTS, isStationUsername, type MesDepartment } from '@/lib/departments';
import { DELETED_USER_USERNAME } from '@/lib/auth/delete-user';

/**
 * Sign-in identity rules, shared by login and Admin > Users so both agree on which accounts a name can mean.
 *
 * A username is not unique: several incharges may share a department login (e.g. three "inventory"
 * accounts). What is typed or picked on the login page is resolved to every account it could mean, and the
 * PIN then decides which one: exactly one account may match a given name + PIN. Admin refuses to save a PIN
 * that would make two such accounts indistinguishable.
 */

const include = { userRoles: { include: { role: true } } } as const;

/** The station a login name points at: its station ID, an older alias, or its designation. */
export function stationForLoginName(name: string): MesDepartment | undefined {
  const n = name.trim().toLowerCase();
  if (!n) return undefined;
  return MES_DEPARTMENTS.find((d) => isStationUsername(d, n) || d.designation.toLowerCase() === n);
}

/**
 * Every account a login name can refer to: accounts with that username or email, and, for a station name
 * ("inventory", "Inventory Incharge", the older "packing"), every account of that station's department,
 * so the station tile works even after its account was recreated under a different username.
 */
export async function loginCandidates(loginName: string) {
  const n = loginName.trim().toLowerCase();
  if (!n) return [];
  const names = new Set([n]);
  if (n === 'system administrator') names.add('admin');
  const station = stationForLoginName(n);
  if (station) {
    names.add(station.stationId);
    (station.stationAliases || []).forEach((a) => names.add(a));
    names.add(station.designation.toLowerCase());
  }
  return prisma.user.findMany({
    where: {
      username: { not: DELETED_USER_USERNAME },
      OR: [
        ...[...names].map((u) => ({ username: { equals: u, mode: 'insensitive' as const } })),
        { email: { equals: n, mode: 'insensitive' as const } },
        ...(station ? [{ departmentCode: station.code }] : []),
      ],
    },
    include,
    orderBy: { createdAt: 'asc' },
  });
}

async function pinMatches(pin: string, passwordHash?: string | null) {
  return passwordHash ? bcrypt.compare(pin, passwordHash).catch(() => false) : false;
}

export type LoginResolution =
  | { kind: 'ok'; user: Awaited<ReturnType<typeof loginCandidates>>[number] }
  | { kind: 'invalid' }
  | { kind: 'inactive' }
  | { kind: 'ambiguous' };

/** Finds the one account this login name + PIN belongs to. Never picks an account by name alone. */
export async function resolveLogin(loginName: string, pin: string): Promise<LoginResolution> {
  const candidates = await loginCandidates(loginName);
  const matched = [];
  for (const user of candidates) {
    if (await pinMatches(pin, user.passwordHash)) matched.push(user);
  }
  if (matched.length === 0) return { kind: 'invalid' };
  const active = matched.filter((u) => u.isActive);
  if (active.length === 1) return { kind: 'ok', user: active[0] };
  if (active.length > 1) return { kind: 'ambiguous' };
  return { kind: 'inactive' };
}

/**
 * Before Admin saves a PIN: another account that the same login could reach (same username, or same
 * department) must not already use it, or sign-in could not tell the two apart. Returns that account.
 */
export async function findPinConflict(
  pin: string,
  scope: { username: string; departmentCode?: string | null; excludeUserId?: string },
) {
  const others = await prisma.user.findMany({
    where: {
      username: { not: DELETED_USER_USERNAME },
      ...(scope.excludeUserId ? { id: { not: scope.excludeUserId } } : {}),
      OR: [
        { username: { equals: scope.username.trim().toLowerCase(), mode: 'insensitive' } },
        ...(scope.departmentCode ? [{ departmentCode: scope.departmentCode }] : []),
      ],
    },
    select: { id: true, username: true, fullName: true, passwordHash: true },
  });
  for (const other of others) {
    if (await pinMatches(pin, other.passwordHash)) return other;
  }
  return null;
}

/** True when a Prisma error is the old one-account-per-username rule (migration not applied yet). */
export function isUsernameUniqueError(error: any) {
  const target = error?.meta?.target;
  return (
    error?.code === 'P2002' &&
    (Array.isArray(target) ? target.includes('username') : String(target || '').includes('username'))
  );
}

export const USERNAME_MIGRATION_MESSAGE =
  'This username is already used, and the database still allows only one account per username. ' +
  'Ask the administrator to run: node scripts/apply-appearance-migrations.js';
