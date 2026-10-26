/** Shared shape for user records returned by Admin APIs. */

// Never select passwordHash: account secrets are not returned by any Admin API.
export const ADMIN_USER_SELECT = {
  id: true,
  username: true,
  fullName: true,
  email: true,
  departmentCode: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  userRoles: { select: { role: { select: { id: true, code: true, name: true } } } },
} as const;

export function formatAdminUser(u: any) {
  const roles = (u.userRoles || []).map((ur: any) => ur.role);
  return {
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    email: u.email,
    departmentCode: u.departmentCode || null,
    isActive: u.isActive,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    roles: roles.map((r: any) => ({ id: r.id, code: r.code, name: r.name })),
    // Kept for the existing screens that read a single role.
    role: roles[0]?.code || null,
    roleName: roles[0]?.name || null,
  };
}
