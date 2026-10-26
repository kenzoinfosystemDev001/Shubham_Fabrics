// Who may do what with Excel stock imports. Pure; the routes also require Fabric Store
// department membership (lib/auth/department-access.ts) for every import endpoint.

/** Roles that may post stock and accept new fabric names. STORE_OPERATOR may only prepare imports. */
export const STOCK_INWARD_APPROVER_ROLES = Object.freeze(['FABRIC_STORE', 'STORE_MANAGER', 'STORE_INCHARGE', 'FABRIC_STORE_INCHARGE']);

/** @param {{ isAdmin: boolean, roles: string[] }} user */
export function canApproveStockInward(user) {
  return Boolean(user && (user.isAdmin || user.roles.some((role) => STOCK_INWARD_APPROVER_ROLES.includes(String(role).toUpperCase()))));
}
