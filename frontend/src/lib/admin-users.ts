/** Pure account-safety rules for Admin user management (no database access). */

export interface AccountSnapshot {
  id: string;
  isActive: boolean;
  departmentCode: string | null;
  roles: string[];
}

export const PROTECTED_ROLE = 'SUPER_ADMIN';

export function hasAdminAccess(account: Pick<AccountSnapshot, 'departmentCode' | 'roles'>): boolean {
  const roles = account.roles.map((r) => r.toUpperCase());
  return String(account.departmentCode || '').toUpperCase() === 'ADMIN' || roles.includes('ADMIN') || roles.includes(PROTECTED_ROLE);
}

export interface AccountChange {
  isActive?: boolean;
  departmentCode?: string | null;
  roles?: string[];
  resetsPin?: boolean;
}

/**
 * Returns an error message when a change would lock the factory out of administration:
 * an admin cannot deactivate or demote themselves, the last active admin cannot be removed,
 * and accounts holding SUPER_ADMIN can only be changed by another SUPER_ADMIN.
 */
export function checkAccountChange(
  actor: { id: string; roles: string[] },
  target: AccountSnapshot,
  change: AccountChange,
  allAccounts: AccountSnapshot[]
): string | null {
  const actorRoles = actor.roles.map((r) => r.toUpperCase());
  const targetRoles = target.roles.map((r) => r.toUpperCase());
  const after: AccountSnapshot = {
    ...target,
    isActive: change.isActive ?? target.isActive,
    departmentCode: change.departmentCode === undefined ? target.departmentCode : change.departmentCode,
    roles: change.roles ?? target.roles,
  };

  const touchesAccess = change.isActive !== undefined || change.roles !== undefined || change.departmentCode !== undefined || change.resetsPin;
  if (targetRoles.includes(PROTECTED_ROLE) && touchesAccess && !actorRoles.includes(PROTECTED_ROLE) && actor.id !== target.id) {
    return 'Only a Super Admin can change a Super Admin account.';
  }
  if (actor.id === target.id && !after.isActive) {
    return 'You cannot deactivate your own account.';
  }
  if (actor.id === target.id && hasAdminAccess(target) && !hasAdminAccess(after)) {
    return 'You cannot remove your own administrator access.';
  }
  const activeAdminsAfter = allAccounts
    .map((a) => (a.id === target.id ? after : a))
    .filter((a) => a.isActive && hasAdminAccess(a));
  if (activeAdminsAfter.length === 0) {
    return 'At least one active administrator account must remain.';
  }
  return null;
}

/** PINs / passwords set by an admin: 4–64 characters, no surrounding whitespace. */
export function validatePin(pin: unknown): string | null {
  const value = String(pin ?? '');
  if (!value) return 'A PIN or password is required.';
  if (value !== value.trim()) return 'The PIN cannot start or end with spaces.';
  if (value.length < 4 || value.length > 64) return 'The PIN must be 4–64 characters.';
  return null;
}
