import { requireUser, type AuthenticatedUser, type RequireUserResult } from './require-user';

/**
 * Which department codes (including the historical aliases found in the data) and which
 * role codes belong to each department. Administrators always pass every check.
 */
export const DEPARTMENT_ACCESS = {
  PROGRAMMING: {
    codes: ['PROGRAMMING', 'PROGRAM', 'PROGRAMMER'],
    roles: ['PROGRAMMING_INCHARGE', 'PROGRAMMER', 'PRODUCTION_MANAGER'],
  },
  STORE: {
    codes: ['STORE', 'FABRIC_STORE', 'FABRIC STORE', 'FABRIC-STORE'],
    roles: ['FABRIC_STORE', 'STORE_MANAGER', 'STORE_OPERATOR', 'STORE_INCHARGE', 'FABRIC_STORE_INCHARGE'],
  },
  DYEING: {
    codes: ['DYEING'],
    roles: ['DYEING_INCHARGE', 'DYEING_OPERATOR'],
  },
  QC1: {
    codes: ['QC1', 'DYEING_QC'],
    roles: ['QC1_INSPECTOR'],
  },
  EMBROIDERY: {
    codes: ['EMBROIDERY', 'EMB'],
    roles: ['EMBROIDERY_INCHARGE', 'EMBROIDERY_OPERATOR'],
  },
  THREAD_CUTTING: {
    codes: ['THREAD_CUTTING', 'THREAD CUTTING', 'THREAD-CUTTING', 'CUTTING'],
    roles: ['THREAD_CUTTING_INCHARGE', 'THREAD_CUTTER', 'CUTTING_INCHARGE'],
  },
  QC2: {
    codes: ['QC2'],
    roles: ['QC2_INSPECTOR'],
  },
  WASHING: {
    codes: ['WASHING'],
    roles: ['WASHING_INCHARGE', 'WASHING_OPERATOR'],
  },
  QC3: {
    codes: ['QC3', 'QCWASHING', 'QC_WASHING', 'WASHING_QC', 'QC WASHING'],
    roles: ['QC3_INSPECTOR', 'QCWASHING_INSPECTOR'],
  },
  RECUTTING: {
    codes: ['RECUTTING', 'RE-CUTTING', 'RE_CUTTING'],
    roles: ['RECUTTING_SUPERVISOR', 'RECUTTING_OPERATOR', 'RECUTTING_INCHARGE'],
  },
  STITCHING: {
    codes: ['STITCHING', 'STITCH', 'ASSEMBLY'],
    roles: ['STITCHING_SUPERVISOR', 'STITCHING_OPERATOR', 'STITCHING_INCHARGE'],
  },
  FINISHING: {
    codes: ['FINISHING'],
    roles: ['FINISHING_SUPERVISOR', 'FINISHING_OPERATOR', 'FINISHING_INCHARGE'],
  },
  STEAM_PRESS: {
    codes: ['STEAM_PRESS', 'STEAMPRESS', 'STEAM PRESS', 'STEAM-PRESS'],
    roles: ['STEAM_PRESS_SUPERVISOR', 'STEAM_PRESS_OPERATOR', 'STEAM_PRESS_INCHARGE'],
  },
  FINAL_CHECK: {
    codes: ['FINAL_CHECK', 'FINAL CHECK', 'FINAL_QC', 'FINAL-CHECK'],
    roles: ['FINAL_CHECK_INSPECTOR', 'FINAL_CHECK_SUPERVISOR', 'FINAL_QC_INSPECTOR'],
  },
  // Inventory includes Packing (a module of Inventory, not a department). The PACKING codes and roles
  // are the earlier "Packing & Inventory" department's, moved to INVENTORY by
  // manual-migrations/20261026_inventory_department.sql; they stay recognised for rows not yet moved.
  INVENTORY: {
    codes: ['INVENTORY', 'PACKING', 'PACK', 'FOLDING', 'FINISHED_GOODS'],
    roles: [
      'INVENTORY_SUPERVISOR',
      'INVENTORY_OPERATOR',
      'INVENTORY_INCHARGE',
      'PACKING_SUPERVISOR',
      'PACKING_OPERATOR',
      'PACKING_INCHARGE',
      'STORE_SUPERVISOR',
    ],
  },
} as const;

export type DepartmentKey = keyof typeof DEPARTMENT_ACCESS;

const normalize = (code: string) => code.trim().toUpperCase();

/** Maps any stored department code or alias (e.g. "QC_WASHING") to its department key. */
export function departmentKeyFor(code: string | null | undefined): DepartmentKey | null {
  if (!code) return null;
  const wanted = normalize(code);
  for (const key of Object.keys(DEPARTMENT_ACCESS) as DepartmentKey[]) {
    if ((DEPARTMENT_ACCESS[key].codes as readonly string[]).includes(wanted)) return key;
  }
  return null;
}

/** True when the user is an administrator or belongs to the department that `code` names. */
export function userBelongsToDepartment(user: AuthenticatedUser, code: string | null | undefined): boolean {
  if (user.isAdmin) return true;
  const key = departmentKeyFor(code);
  if (!key) return false;
  const access = DEPARTMENT_ACCESS[key];
  const codes = access.codes as readonly string[];
  const roles = access.roles as readonly string[];
  return (
    codes.includes(normalize(user.departmentCode || '')) ||
    codes.includes(normalize(user.sessionDepartment)) ||
    user.roles.some((role) => roles.includes(role))
  );
}

/**
 * Route-handler guard for department endpoints. Passes for administrators and for members
 * of any of the listed departments. Usage:
 *   const { user: authUser, response: authResponse } = await requireDepartment(request, 'STITCHING');
 *   if (!authUser) return authResponse;
 */
export function requireDepartment(request: Request, ...keys: DepartmentKey[]): Promise<RequireUserResult> {
  return requireUser(request, {
    departments: keys.flatMap((key) => DEPARTMENT_ACCESS[key].codes),
    roles: keys.flatMap((key) => DEPARTMENT_ACCESS[key].roles),
  });
}

/**
 * Who may change a challan through the generic challan routes: receiving belongs to the
 * destination department; any other update may come from either the sender or the receiver.
 */
export function canUpdateChallan(
  user: AuthenticatedUser,
  challan: { fromDepartment: string; toDepartment: string },
  status?: string | null,
): boolean {
  if (status === 'RECEIVED') return userBelongsToDepartment(user, challan.toDepartment);
  return userBelongsToDepartment(user, challan.toDepartment) || userBelongsToDepartment(user, challan.fromDepartment);
}
