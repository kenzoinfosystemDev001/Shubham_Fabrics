/**
 * Maps a database user to the normalized role, department and home page used by the
 * login response, the session token and /api/auth/me.
 */

export interface SessionUserSource {
  id: string;
  username: string;
  fullName: string;
  email: string;
  departmentCode: string | null;
  userRoles?: { role: { code: string } }[];
}

export interface SessionUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: string;
  roles: string[];
  departmentCode: string;
  defaultRedirect: string;
}

export function buildSessionUser(user: SessionUserSource): SessionUser {
  const roleCodes = user.userRoles?.map((ur) => ur.role.code) || [];
  const isAdmin =
    user.username.toLowerCase() === 'admin' ||
    user.departmentCode === 'ADMIN' ||
    roleCodes.includes('ADMIN') ||
    roleCodes.includes('SUPER_ADMIN');

  const isStore =
    !isAdmin &&
    (user.username.toLowerCase() === 'store' ||
      user.departmentCode === 'STORE' ||
      roleCodes.includes('FABRIC_STORE') ||
      roleCodes.includes('STORE_MANAGER') ||
      roleCodes.includes('STORE_OPERATOR'));

  const isProgramming =
    !isAdmin &&
    !isStore &&
    (user.username.toLowerCase() === 'program' ||
      user.username.toLowerCase() === 'programmer' ||
      user.departmentCode === 'PROGRAMMING' ||
      roleCodes.includes('PROGRAMMING_INCHARGE') ||
      roleCodes.includes('PROGRAMMER') ||
      roleCodes.includes('PRODUCTION_MANAGER'));

  const isDyeing =
    !isAdmin &&
    !isStore &&
    !isProgramming &&
    (user.username.toLowerCase() === 'dyeing' ||
      user.departmentCode === 'DYEING' ||
      roleCodes.includes('DYEING_INCHARGE') ||
      roleCodes.includes('DYEING_OPERATOR'));

  const isQCWashing =
    !isAdmin &&
    !isStore &&
    !isProgramming &&
    (user.username.toLowerCase() === 'qcwashing' ||
      user.username.toLowerCase() === 'qc_washing' ||
      user.username.toLowerCase() === 'qc3' ||
      user.username.toLowerCase() === 'qc3_insp' ||
      user.departmentCode === 'QC3' ||
      user.departmentCode === 'QCWASHING' ||
      user.departmentCode === 'QC_WASHING' ||
      roleCodes.includes('QC3_INSPECTOR') ||
      roleCodes.includes('QCWASHING_INSPECTOR'));

  const isQC1 =
    !isAdmin &&
    !isStore &&
    !isProgramming &&
    !isDyeing &&
    !isQCWashing &&
    (user.username.toLowerCase() === 'qc1' ||
      user.username.toLowerCase() === 'qc_insp' ||
      user.departmentCode === 'QC1' ||
      roleCodes.includes('QC1_INSPECTOR') ||
      (roleCodes.includes('QC_INSPECTOR') &&
        user.departmentCode !== 'QC2' &&
        user.departmentCode !== 'QC3' &&
        user.departmentCode !== 'QCWASHING' &&
        user.departmentCode !== 'QC_WASHING'));

  const isEmbroidery =
    !isAdmin &&
    !isStore &&
    !isProgramming &&
    !isDyeing &&
    !isQCWashing &&
    !isQC1 &&
    (user.username.toLowerCase() === 'embroidery' ||
      user.departmentCode === 'EMBROIDERY' ||
      roleCodes.includes('EMBROIDERY_INCHARGE') ||
      roleCodes.includes('EMBROIDERY_OPERATOR'));

  const isThreadCutting =
    !isAdmin &&
    !isStore &&
    !isProgramming &&
    !isDyeing &&
    !isQCWashing &&
    !isQC1 &&
    !isEmbroidery &&
    (user.username.toLowerCase() === 'thread-cutting' ||
      user.username.toLowerCase() === 'cutting' ||
      user.departmentCode === 'THREAD_CUTTING' ||
      roleCodes.includes('THREAD_CUTTING_INCHARGE') ||
      roleCodes.includes('THREAD_CUTTER') ||
      roleCodes.includes('CUTTING_INCHARGE'));

  const isQC2 =
    !isAdmin &&
    !isStore &&
    !isProgramming &&
    !isDyeing &&
    !isQCWashing &&
    !isQC1 &&
    !isEmbroidery &&
    !isThreadCutting &&
    (user.username.toLowerCase() === 'qc2' ||
      user.username.toLowerCase() === 'qc2_insp' ||
      user.departmentCode === 'QC2' ||
      roleCodes.includes('QC2_INSPECTOR') ||
      (roleCodes.includes('QC_INSPECTOR') &&
        user.departmentCode !== 'QC1' &&
        user.departmentCode !== 'QC3' &&
        user.departmentCode !== 'QCWASHING' &&
        user.departmentCode !== 'QC_WASHING'));

  const isWashing =
    !isAdmin &&
    !isStore &&
    !isProgramming &&
    !isDyeing &&
    !isQCWashing &&
    !isQC1 &&
    !isEmbroidery &&
    !isThreadCutting &&
    !isQC2 &&
    (user.username.toLowerCase() === 'washing' ||
      user.username.toLowerCase() === 'washing_incharge' ||
      user.departmentCode === 'WASHING' ||
      roleCodes.includes('WASHING_INCHARGE') ||
      roleCodes.includes('WASHING_OPERATOR'));

  const isRecutting =
    !isAdmin &&
    !isStore &&
    !isProgramming &&
    !isDyeing &&
    !isQCWashing &&
    !isQC1 &&
    !isEmbroidery &&
    !isThreadCutting &&
    !isQC2 &&
    !isWashing &&
    (user.username.toLowerCase() === 'recutting' ||
      user.departmentCode === 'RECUTTING' ||
      roleCodes.includes('RECUTTING_SUPERVISOR') ||
      roleCodes.includes('RECUTTING_OPERATOR') ||
      roleCodes.includes('RECUTTING_INCHARGE'));

  const isStitching =
    !isAdmin &&
    !isStore &&
    !isProgramming &&
    !isDyeing &&
    !isQCWashing &&
    !isQC1 &&
    !isEmbroidery &&
    !isThreadCutting &&
    !isQC2 &&
    !isWashing &&
    !isRecutting &&
    (user.username.toLowerCase() === 'stitching' ||
      user.departmentCode === 'STITCHING' ||
      roleCodes.includes('STITCHING_SUPERVISOR') ||
      roleCodes.includes('STITCHING_OPERATOR') ||
      roleCodes.includes('STITCHING_INCHARGE'));

  const isFinishing =
    !isAdmin &&
    !isStore &&
    !isProgramming &&
    !isDyeing &&
    !isQCWashing &&
    !isQC1 &&
    !isEmbroidery &&
    !isThreadCutting &&
    !isQC2 &&
    !isWashing &&
    !isRecutting &&
    !isStitching &&
    (user.username.toLowerCase() === 'finishing' ||
      user.departmentCode === 'FINISHING' ||
      roleCodes.includes('FINISHING_SUPERVISOR') ||
      roleCodes.includes('FINISHING_OPERATOR') ||
      roleCodes.includes('FINISHING_INCHARGE'));

  const isPacking =
    !isAdmin &&
    (user.username.toLowerCase() === 'packing' ||
      user.username.toLowerCase() === 'packing_supervisor' ||
      user.departmentCode === 'PACKING' ||
      user.departmentCode === 'FINISHED_GOODS' ||
      roleCodes.includes('PACKING_SUPERVISOR') ||
      roleCodes.includes('PACKING_OPERATOR') ||
      roleCodes.includes('PACKING_INCHARGE'));

  const isFinalCheck =
    !isAdmin &&
    (user.username.toLowerCase() === 'finalcheck' ||
      user.username.toLowerCase() === 'final_check' ||
      user.departmentCode === 'FINAL_CHECK' ||
      roleCodes.includes('FINAL_CHECK_INSPECTOR') ||
      roleCodes.includes('FINAL_CHECK_SUPERVISOR'));

  const isSteamPress =
    !isAdmin &&
    !isStore &&
    !isProgramming &&
    !isEmbroidery &&
    !isDyeing &&
    !isQC1 &&
    !isThreadCutting &&
    !isQC2 &&
    !isWashing &&
    !isRecutting &&
    !isStitching &&
    !isFinishing &&
    (user.username.toLowerCase() === 'steampress' ||
      user.username.toLowerCase() === 'steam_press' ||
      user.departmentCode === 'STEAM_PRESS' ||
      roleCodes.includes('STEAM_PRESS_SUPERVISOR') ||
      roleCodes.includes('STEAM_PRESS_OPERATOR') ||
      roleCodes.includes('STEAM_PRESS_INCHARGE'));

  const normalizedRole = isAdmin
    ? 'ADMIN'
    : isFinishing
    ? 'FINISHING_SUPERVISOR'
    : isStitching
    ? 'STITCHING_SUPERVISOR'
    : isRecutting
    ? 'RECUTTING_SUPERVISOR'
    : isQCWashing
    ? 'QC3_INSPECTOR'
    : isWashing
    ? 'WASHING_INCHARGE'
    : isQC2
    ? 'QC2_INSPECTOR'
    : isThreadCutting
    ? 'THREAD_CUTTING_INCHARGE'
    : isQC1
    ? 'QC_INSPECTOR'
    : isDyeing
    ? 'DYEING_INCHARGE'
    : isStore
    ? 'FABRIC_STORE'
    : isEmbroidery
    ? 'EMBROIDERY_INCHARGE'
    : isProgramming
    ? 'PROGRAMMER'
    : isPacking
    ? 'PACKING_SUPERVISOR'
    : isFinalCheck
    ? 'FINAL_CHECK_INSPECTOR'
    : isSteamPress
    ? 'STEAM_PRESS_OPERATOR'
    : roleCodes[0] || 'USER';

  const normalizedDept = isAdmin
    ? 'ADMIN'
    : isFinishing
    ? 'FINISHING'
    : isStitching
    ? 'STITCHING'
    : isRecutting
    ? 'RECUTTING'
    : isQCWashing
    ? 'QC3'
    : isWashing
    ? 'WASHING'
    : isQC2
    ? 'QC2'
    : isThreadCutting
    ? 'THREAD_CUTTING'
    : isQC1
    ? 'QC1'
    : isDyeing
    ? 'DYEING'
    : isStore
    ? 'STORE'
    : isEmbroidery
    ? 'EMBROIDERY'
    : isProgramming
    ? 'PROGRAMMING'
    : isPacking
    ? 'PACKING'
    : isFinalCheck
    ? 'FINAL_CHECK'
    : isSteamPress
    ? 'STEAM_PRESS'
    : user.departmentCode || 'FINISHING';

  const defaultRedirect = isAdmin
    ? '/admin'
    : isFinishing
    ? '/finishing'
    : isStitching
    ? '/stitching'
    : isRecutting
    ? '/recutting'
    : isQCWashing
    ? '/qcwashing'
    : isWashing
    ? '/washing'
    : isQC2
    ? '/qc2'
    : isThreadCutting
    ? '/thread-cutting'
    : isQC1
    ? '/qc1'
    : isDyeing
    ? '/dyeing'
    : isStore
    ? '/fabric-store'
    : isEmbroidery
    ? '/embroidery'
    : isPacking
    ? '/packing'
    : isFinalCheck
    ? '/final-check'
    : isSteamPress
    ? '/steam-press'
    : '/programming';

  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    role: normalizedRole,
    roles: roleCodes.length > 0 ? roleCodes : [normalizedRole],
    departmentCode: normalizedDept,
    defaultRedirect,
  };
}
