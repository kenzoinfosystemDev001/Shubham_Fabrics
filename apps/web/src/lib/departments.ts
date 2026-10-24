/**
 * The 15 approved MES departments, in factory order, with their exact display names.
 * Codes match the values stored on challans, users and dyeing orders.
 */
export const MES_DEPARTMENTS = [
  { code: 'PROGRAMMING', name: 'Programming Department', isQc: false },
  { code: 'STORE', name: 'Fabric Store Department', isQc: false },
  { code: 'DYEING', name: 'Dyeing Department', isQc: false },
  { code: 'DYEING_QC', name: 'Dyeing QC', isQc: true },
  { code: 'EMBROIDERY', name: 'Embroidery Department', isQc: false },
  { code: 'THREAD_CUTTING', name: 'Thread Cutting Department', isQc: false },
  { code: 'THREADCUT_QC', name: 'Threadcut QC', isQc: true },
  { code: 'WASHING', name: 'Washing Department', isQc: false },
  { code: 'WASHING_QC', name: 'Washing QC', isQc: true },
  { code: 'RECUTTING', name: 'Recutting Department', isQc: false },
  { code: 'STITCHING', name: 'Stitching Department', isQc: false },
  { code: 'FINISHING', name: 'Finishing Department', isQc: false },
  { code: 'STEAM_PRESS', name: 'Steam Press Department', isQc: false },
  { code: 'FINAL_QC', name: 'Final QC', isQc: true },
  { code: 'PACKING', name: 'Packing Department', isQc: false },
] as const;

export type MesDepartmentCode = (typeof MES_DEPARTMENTS)[number]['code'];

/** Departments a user account can belong to: the 15 factory departments plus Administration. */
export const ACCOUNT_DEPARTMENT_CODES: string[] = ['ADMIN', ...MES_DEPARTMENTS.map((d) => d.code)];

export function departmentName(code: string | null | undefined): string {
  if (!code) return '—';
  if (code === 'ADMIN') return 'Administration';
  return MES_DEPARTMENTS.find((d) => d.code === code)?.name || code;
}

export const QC_DEPARTMENT_CODES: string[] = MES_DEPARTMENTS.filter((d) => d.isQc).map((d) => d.code);

/**
 * Departments an Admin has deactivated cannot receive or issue new challans. Returns an error
 * message, or null when every given department is active (unknown rows count as active).
 */
export async function inactiveDepartmentError(
  db: { department: { findMany: (args: any) => Promise<Array<{ code: string; name: string; isActive: boolean }>> } },
  codes: Array<string | null | undefined>
): Promise<string | null> {
  const wanted = Array.from(new Set(codes.filter(Boolean).map((c) => String(c).toUpperCase())));
  if (wanted.length === 0) return null;
  const rows = await db.department.findMany({ where: { code: { in: wanted } }, select: { code: true, name: true, isActive: true } });
  const inactive = rows.filter((r) => !r.isActive);
  return inactive.length > 0
    ? `${inactive.map((r) => departmentName(r.code) || r.name).join(', ')} is deactivated. Re-activate it in Admin → All Departments before issuing challans.`
    : null;
}
