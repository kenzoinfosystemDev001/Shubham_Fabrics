export type MESRole = 'ADMIN' | 'PROGRAMMER' | 'FABRIC_STORE' | 'SUPER_ADMIN' | 'STORE_MANAGER' | 'USER';
export type MESDepartment = 'ADMIN' | 'PROGRAMMING' | 'STORE' | 'DYEING' | 'EMBROIDERY' | 'CENTRAL';

export interface MESUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: string;
  roles: string[];
  departmentCode: string;
  defaultRedirect?: string;
}

export function getCurrentUser(): MESUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('subham_mes_user');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.departmentCode || parsed.role || parsed.username)) {
        return parsed;
      }
    } catch {}
  }
  
  // Fallback from auth cookies
  try {
    const cookies = document.cookie.split(';').reduce((acc: any, c) => {
      const [k, v] = c.trim().split('=');
      if (k && v) acc[k] = decodeURIComponent(v);
      return acc;
    }, {});
    if (cookies.subham_mes_dept || cookies.subham_mes_role) {
      const dept = (cookies.subham_mes_dept || 'PROGRAMMING').toUpperCase();
      const role = (cookies.subham_mes_role || 'PROGRAMMER').toUpperCase();
      const userObj: MESUser = {
        id: 'cookie_session',
        username: dept.toLowerCase(),
        fullName: `${dept} Incharge`,
        email: `${dept.toLowerCase()}@subhamfabrics.com`,
        role: role,
        roles: [role],
        departmentCode: dept,
      };
      localStorage.setItem('subham_mes_user', JSON.stringify(userObj));
      return userObj;
    }
  } catch {}
  return null;
}

export function isAdminUser(user: MESUser | null): boolean {
  if (!user) return false;
  const username = (user.username || '').toLowerCase();
  const dept = (user.departmentCode || '').toUpperCase();
  const role = (user.role || '').toUpperCase();
  const roles = (user.roles || []).map((r) => r.toUpperCase());

  return (
    username === 'admin' ||
    dept === 'ADMIN' ||
    role === 'ADMIN' ||
    role === 'SUPER_ADMIN' ||
    roles.includes('ADMIN') ||
    roles.includes('SUPER_ADMIN')
  );
}

export function isProgrammingUser(user: MESUser | null): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return true; // Admins have all access

  const username = (user.username || '').toLowerCase();
  const dept = (user.departmentCode || '').toUpperCase();
  const role = (user.role || '').toUpperCase();
  const roles = (user.roles || []).map((r) => r.toUpperCase());

  return (
    username === 'program' ||
    username === 'programmer' ||
    dept === 'PROGRAMMING' ||
    role === 'PROGRAMMER' ||
    role === 'PROGRAMMING_INCHARGE' ||
    roles.includes('PROGRAMMER') ||
    roles.includes('PROGRAMMING_INCHARGE')
  );
}

/**
 * Only Programming and Admin departments are authorized to view the Client Code.
 * All other departments (Fabric Store, Dyeing, QC1, Embroidery, Thread Cutting, etc.)
 * are strictly restricted from seeing client code.
 */
export function canViewClientCode(user: MESUser | null): boolean {
  if (!user) return false;
  return isAdminUser(user) || isProgrammingUser(user);
}

export const canViewClientName = canViewClientCode;

export function isFabricStoreUser(user: MESUser | null): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return true; // Admins have all access

  const username = (user.username || '').toLowerCase();
  const dept = (user.departmentCode || '').toUpperCase();
  const role = (user.role || '').toUpperCase();
  const roles = (user.roles || []).map((r) => r.toUpperCase());

  return (
    username === 'store' ||
    dept === 'STORE' ||
    dept === 'FABRIC_STORE' ||
    role === 'FABRIC_STORE' ||
    role === 'STORE_MANAGER' ||
    role === 'STORE_INCHARGE' ||
    role === 'FABRIC_STORE_INCHARGE' ||
    roles.includes('FABRIC_STORE') ||
    roles.includes('STORE_MANAGER') ||
    roles.includes('STORE_INCHARGE') ||
    roles.includes('FABRIC_STORE_INCHARGE')
  );
}

export function isDyeingUser(user: MESUser | null): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return true; // Admins have all access

  const username = (user.username || '').toLowerCase();
  const dept = (user.departmentCode || '').toUpperCase();
  const role = (user.role || '').toUpperCase();
  const roles = (user.roles || []).map((r) => r.toUpperCase());

  return (
    username === 'dyeing' ||
    dept === 'DYEING' ||
    role === 'DYEING_INCHARGE' ||
    role === 'DYEING_OPERATOR' ||
    roles.includes('DYEING_INCHARGE') ||
    roles.includes('DYEING_OPERATOR')
  );
}

export function isQc1User(user: MESUser | null): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return true; // Admins have all access

  const username = (user.username || '').toLowerCase();
  const dept = (user.departmentCode || '').toUpperCase();
  const role = (user.role || '').toUpperCase();
  const roles = (user.roles || []).map((r) => r.toUpperCase());

  if (dept === 'QC2' || dept === 'QC3' || dept === 'QCWASHING' || dept === 'QC_WASHING') return false;
  if (username === 'qc2' || username === 'qc2_insp' || username === 'qc3' || username === 'qcwashing' || username === 'qc_washing') return false;

  return (
    username === 'qc1' ||
    username === 'qc_insp' ||
    dept === 'QC1' ||
    role === 'QC_INSPECTOR' ||
    role === 'QC1_INSPECTOR' ||
    roles.includes('QC_INSPECTOR') ||
    roles.includes('QC1_INSPECTOR')
  );
}

export function isQc2User(user: MESUser | null): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return true; // Admins have all access

  const username = (user.username || '').toLowerCase();
  const dept = (user.departmentCode || '').toUpperCase();
  const role = (user.role || '').toUpperCase();
  const roles = (user.roles || []).map((r) => r.toUpperCase());

  if (dept === 'QC1' || dept === 'QC3' || dept === 'QCWASHING' || dept === 'QC_WASHING') return false;
  if (username === 'qc1' || username === 'qc_insp' || username === 'qc3' || username === 'qcwashing' || username === 'qc_washing') return false;

  return (
    username === 'qc2' ||
    username === 'qc2_insp' ||
    dept === 'QC2' ||
    role === 'QC2_INSPECTOR' ||
    role === 'QC_INSPECTOR' ||
    roles.includes('QC2_INSPECTOR')
  );
}

export function isEmbroideryUser(user: MESUser | null): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return true; // Admins have all access

  const username = (user.username || '').toLowerCase();
  const dept = (user.departmentCode || '').toUpperCase();
  const role = (user.role || '').toUpperCase();
  const roles = (user.roles || []).map((r) => r.toUpperCase());

  return (
    username === 'embroidery' ||
    dept === 'EMBROIDERY' ||
    role === 'EMBROIDERY_INCHARGE' ||
    role === 'EMBROIDERY_OPERATOR' ||
    roles.includes('EMBROIDERY_INCHARGE') ||
    roles.includes('EMBROIDERY_OPERATOR')
  );
}

export function isThreadCuttingUser(user: MESUser | null): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return true; // Admins have all access

  const username = (user.username || '').toLowerCase();
  const dept = (user.departmentCode || '').toUpperCase();
  const role = (user.role || '').toUpperCase();
  const roles = (user.roles || []).map((r) => r.toUpperCase());

  return (
    username === 'cutting' ||
    username === 'thread_cutting' ||
    dept === 'THREAD_CUTTING' ||
    dept === 'CUTTING' ||
    role === 'CUTTING_INCHARGE' ||
    role === 'THREAD_CUTTING_INCHARGE' ||
    roles.includes('CUTTING_INCHARGE') ||
    roles.includes('THREAD_CUTTING_INCHARGE')
  );
}

export function isWashingUser(user: MESUser | null): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return true; // Admins have all access

  const username = (user.username || '').toLowerCase();
  const dept = (user.departmentCode || '').toUpperCase();
  const role = (user.role || '').toUpperCase();
  const roles = (user.roles || []).map((r) => r.toUpperCase());

  return (
    username === 'washing' ||
    username === 'washing_incharge' ||
    dept === 'WASHING' ||
    role === 'WASHING_INCHARGE' ||
    role === 'WASHING_OPERATOR' ||
    roles.includes('WASHING_INCHARGE') ||
    roles.includes('WASHING_OPERATOR')
  );
}

export function isQcWashingUser(user: MESUser | null): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return true; // Admins have all access

  const username = (user.username || '').toLowerCase();
  const dept = (user.departmentCode || '').toUpperCase();
  const role = (user.role || '').toUpperCase();
  const roles = (user.roles || []).map((r) => r.toUpperCase());

  if (dept === 'QC1' || dept === 'QC2') return false;
  if (username === 'qc1' || username === 'qc_insp' || username === 'qc2' || username === 'qc2_insp') return false;

  return (
    username === 'qcwashing' ||
    username === 'qc_washing' ||
    username === 'qc3' ||
    username === 'qc3_insp' ||
    dept === 'QC3' ||
    dept === 'QCWASHING' ||
    dept === 'QC_WASHING' ||
    dept === 'WASHING_QC' ||
    role === 'QCWASHING_INSPECTOR' ||
    role === 'QC3_INSPECTOR' ||
    roles.includes('QCWASHING_INSPECTOR') ||
    roles.includes('QC3_INSPECTOR') ||
    (roles.includes('QC_INSPECTOR') && (dept === 'QC3' || dept === 'QCWASHING' || dept === 'QC_WASHING'))
  );
}

export function isRecuttingUser(user: MESUser | null): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return true; // Admins have all access

  const username = (user.username || '').toLowerCase();
  const dept = (user.departmentCode || '').toUpperCase();
  const role = (user.role || '').toUpperCase();
  const roles = (user.roles || []).map((r) => r.toUpperCase());

  return (
    username === 'recutting' ||
    dept === 'RECUTTING' ||
    role === 'RECUTTING_SUPERVISOR' ||
    role === 'RECUTTING_OPERATOR' ||
    role === 'RECUTTING_INCHARGE' ||
    roles.includes('RECUTTING_SUPERVISOR') ||
    roles.includes('RECUTTING_OPERATOR') ||
    roles.includes('RECUTTING_INCHARGE')
  );
}

export function isStitchingUser(user: MESUser | null): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return true; // Admins have all access

  const username = (user.username || '').toLowerCase();
  const dept = (user.departmentCode || '').toUpperCase();
  const role = (user.role || '').toUpperCase();
  const roles = (user.roles || []).map((r) => r.toUpperCase());

  return (
    username === 'stitching' ||
    dept === 'STITCHING' ||
    role === 'STITCHING_SUPERVISOR' ||
    role === 'STITCHING_OPERATOR' ||
    role === 'STITCHING_INCHARGE' ||
    roles.includes('STITCHING_SUPERVISOR') ||
    roles.includes('STITCHING_OPERATOR') ||
    roles.includes('STITCHING_INCHARGE')
  );
}

export function isSteamPressUser(user: MESUser | null): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return true; // Admins have all access

  const username = (user.username || '').toLowerCase();
  const dept = (user.departmentCode || '').toUpperCase();
  const role = (user.role || '').toUpperCase();
  const roles = (user.roles || []).map((r) => r.toUpperCase());

  return (
    username === 'steampress' ||
    username === 'steam_press' ||
    dept === 'STEAM_PRESS' ||
    role === 'STEAM_PRESS_SUPERVISOR' ||
    role === 'STEAM_PRESS_OPERATOR' ||
    role === 'STEAM_PRESS_INCHARGE' ||
    roles.includes('STEAM_PRESS_SUPERVISOR') ||
    roles.includes('STEAM_PRESS_OPERATOR') ||
    roles.includes('STEAM_PRESS_INCHARGE')
  );
}

/** Inventory Department (Packing is a module of Inventory); "packing" / PACKING_* are the earlier department's names. */
export function isInventoryUser(user: MESUser | null): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return true; // Admins have all access

  const username = (user.username || '').toLowerCase();
  const dept = (user.departmentCode || '').toUpperCase();
  const role = (user.role || '').toUpperCase();
  const roles = (user.roles || []).map((r) => r.toUpperCase());

  return (
    username === 'inventory' ||
    username === 'packing' ||
    username === 'packing_supervisor' ||
    dept === 'INVENTORY' ||
    dept === 'PACKING' ||
    dept === 'FINISHED_GOODS' ||
    ['INVENTORY_SUPERVISOR', 'INVENTORY_OPERATOR', 'INVENTORY_INCHARGE', 'PACKING_SUPERVISOR', 'PACKING_OPERATOR', 'PACKING_INCHARGE'].some(
      (r) => role === r || roles.includes(r),
    )
  );
}

export function isFinalCheckUser(user: MESUser | null): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return true; // Admins have all access

  const username = (user.username || '').toLowerCase();
  const dept = (user.departmentCode || '').toUpperCase();
  const role = (user.role || '').toUpperCase();
  const roles = (user.roles || []).map((r) => r.toUpperCase());

  return (
    username === 'finalcheck' ||
    username === 'final_check' ||
    username === 'finalqc' ||
    dept === 'FINAL_CHECK' ||
    dept === 'FINAL_QC' ||
    role === 'FINAL_CHECK_INSPECTOR' ||
    role === 'FINAL_CHECK_SUPERVISOR' ||
    roles.includes('FINAL_CHECK_INSPECTOR') ||
    roles.includes('FINAL_CHECK_SUPERVISOR')
  );
}

export function isFinishingUser(user: MESUser | null): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return true; // Admins have all access

  const username = (user.username || '').toLowerCase();
  const dept = (user.departmentCode || '').toUpperCase();
  const role = (user.role || '').toUpperCase();
  const roles = (user.roles || []).map((r) => r.toUpperCase());

  return (
    username === 'finishing' ||
    dept === 'FINISHING' ||
    role === 'FINISHING_SUPERVISOR' ||
    role === 'FINISHING_OPERATOR' ||
    role === 'FINISHING_INCHARGE' ||
    roles.includes('FINISHING_SUPERVISOR') ||
    roles.includes('FINISHING_OPERATOR') ||
    roles.includes('FINISHING_INCHARGE')
  );
}

export function getUserStationHome(user: MESUser | null): string {
  if (!user) return '/login';
  if (isAdminUser(user)) return '/admin';
  if (isInventoryUser(user)) return '/inventory';
  if (isFinalCheckUser(user)) return '/final-check';
  if (isSteamPressUser(user)) return '/steam-press';
  if (isFinishingUser(user)) return '/finishing';
  if (isStitchingUser(user)) return '/stitching';
  if (isRecuttingUser(user)) return '/recutting';
  if (isQcWashingUser(user)) return '/qcwashing';
  if (isWashingUser(user)) return '/washing';
  if (isQc1User(user)) return '/qc1';
  if (isQc2User(user)) return '/qc2';
  if (isDyeingUser(user)) return '/dyeing';
  if (isFabricStoreUser(user)) return '/fabric-store';
  if (isEmbroideryUser(user)) return '/embroidery';
  if (isThreadCuttingUser(user)) return '/thread-cutting';
  return '/programming';
}

/**
 * Checks if the current user has access to a specific route pathname.
 * Returns { allowed: boolean, redirectTarget: string, reason?: string }
 */
export function checkRouteAccess(pathname: string, user: MESUser | null): {
  allowed: boolean;
  redirectTarget: string;
  reason?: string;
} {
  if (!user) {
    return {
      allowed: false,
      redirectTarget: '/login',
      reason: 'Authentication required. Please sign in.',
    };
  }

  // Admin has access to all dashboards
  if (isAdminUser(user)) {
    return { allowed: true, redirectTarget: pathname };
  }

  const defaultUserHome = getUserStationHome(user);

  // Prevent signed-in department users from accidentally escaping to root or login
  if (pathname === '/' || pathname === '/login') {
    return {
      allowed: false,
      redirectTarget: defaultUserHome,
      reason: 'Active station session in progress. Please use Sign Out to switch stations.',
    };
  }

  // Admin routes protection
  if (pathname.startsWith('/admin')) {
    return {
      allowed: false,
      redirectTarget: defaultUserHome,
      reason: 'Access Restricted: Admin Console is restricted to System Administrators.',
    };
  }

  // Shared Production Sheets access: QC2, Washing, and all authenticated stations must be able to view Production Sheets
  if (pathname.startsWith('/programs')) {
    return { allowed: true, redirectTarget: pathname };
  }

  // Washing Department routes protection
  if (pathname.startsWith('/washing')) {
    if (isWashingUser(user)) {
      return { allowed: true, redirectTarget: pathname };
    }
    return {
      allowed: false,
      redirectTarget: defaultUserHome,
      reason: 'Access Restricted: You are not authorized for the Washing Department. Access is restricted to Washing personnel and Admins.',
    };
  }

  // Embroidery Department routes protection
  if (pathname.startsWith('/embroidery')) {
    if (isEmbroideryUser(user)) {
      return { allowed: true, redirectTarget: pathname };
    }
    return {
      allowed: false,
      redirectTarget: defaultUserHome,
      reason: 'Access Restricted: You are not authorized for the Embroidery Department. Access is restricted to Embroidery personnel and Admins.',
    };
  }

  // Thread Cutting Department routes protection
  if (pathname.startsWith('/thread-cutting')) {
    if (isThreadCuttingUser(user)) {
      return { allowed: true, redirectTarget: pathname };
    }
    return {
      allowed: false,
      redirectTarget: defaultUserHome,
      reason: 'Access Restricted: You are not authorized for the Thread Cutting Department. Access is restricted to Thread Cutting personnel and Admins.',
    };
  }

  // QC1 Department routes protection
  if (pathname.startsWith('/qc1')) {
    if (isQc1User(user)) {
      return { allowed: true, redirectTarget: pathname };
    }
    return {
      allowed: false,
      redirectTarget: defaultUserHome,
      reason: 'Access Restricted: You are not authorized for the Dyeing QC Department. Access is restricted to Dyeing QC personnel and Admins.',
    };
  }

  // Threadcut QC (QC2) routes protection
  if (pathname.startsWith('/qc2')) {
    if (isQc2User(user)) {
      return { allowed: true, redirectTarget: pathname };
    }
    return {
      allowed: false,
      redirectTarget: defaultUserHome,
      reason: 'Access Restricted: You are not authorized for Threadcut QC. Access is restricted to Threadcut QC personnel and Admins.',
    };
  }

  // Washing QC (QC3) routes protection
  if (pathname.startsWith('/qcwashing') || pathname.startsWith('/qc-washing') || pathname.startsWith('/qc3')) {
    if (isQcWashingUser(user)) {
      return { allowed: true, redirectTarget: pathname };
    }
    return {
      allowed: false,
      redirectTarget: defaultUserHome,
      reason: 'Access Restricted: You are not authorized for Washing QC. Access is restricted to Washing QC personnel and Admins.',
    };
  }

  // Recutting Department routes protection
  if (pathname.startsWith('/recutting')) {
    if (isRecuttingUser(user)) {
      return { allowed: true, redirectTarget: pathname };
    }
    return {
      allowed: false,
      redirectTarget: defaultUserHome,
      reason: 'Access Restricted: You are not authorized for the Recutting Department. Access is restricted to Recutting personnel and Admins.',
    };
  }

  // Dyeing Department routes protection
  if (pathname.startsWith('/dyeing')) {
    if (isDyeingUser(user)) {
      return { allowed: true, redirectTarget: pathname };
    }
    return {
      allowed: false,
      redirectTarget: defaultUserHome,
      reason: 'Access Restricted: You are not authorized for the Dyeing Department. Access is restricted to Dyeing Department personnel and Admins.',
    };
  }

  // Fabric Store routes protection
  if (pathname.startsWith('/fabric-store')) {
    if (isFabricStoreUser(user)) {
      return { allowed: true, redirectTarget: pathname };
    }
    return {
      allowed: false,
      redirectTarget: defaultUserHome,
      reason: 'Access Restricted: Fabric Store is restricted to Store Department personnel and Admins.',
    };
  }

  // Stitching Department routes protection
  if (pathname.startsWith('/stitching')) {
    if (isStitchingUser(user)) {
      return { allowed: true, redirectTarget: pathname };
    }
    return {
      allowed: false,
      redirectTarget: defaultUserHome,
      reason: 'Access Restricted: You are not authorized for the Stitching Department. Access is restricted to Stitching personnel and Admins.',
    };
  }

  // Finishing Department routes protection
  if (pathname.startsWith('/finishing')) {
    if (isFinishingUser(user)) {
      return { allowed: true, redirectTarget: pathname };
    }
    return {
      allowed: false,
      redirectTarget: defaultUserHome,
      reason: 'Access Restricted: You are not authorized for the Finishing Department. Access is restricted to Finishing personnel and Admins.',
    };
  }

  // Inventory Department routes protection (/packing only redirects into Inventory)
  if (pathname.startsWith('/inventory') || pathname.startsWith('/packing')) {
    if (isInventoryUser(user)) {
      return { allowed: true, redirectTarget: pathname };
    }
    return {
      allowed: false,
      redirectTarget: defaultUserHome,
      reason: 'Access Restricted: You are not authorized for the Inventory Department. Access is restricted to Inventory personnel and Admins.',
    };
  }

  // Final QC Department routes protection
  if (pathname.startsWith('/final-check')) {
    if (isFinalCheckUser(user)) {
      return { allowed: true, redirectTarget: pathname };
    }
    return {
      allowed: false,
      redirectTarget: defaultUserHome,
      reason: 'Access Restricted: Final QC is restricted to Final QC personnel and Admins.',
    };
  }

  // Programming department routes protection (/programming, my-work, floor-board)
  const isProgrammingRoute =
    pathname === '/programming' ||
    pathname.startsWith('/programming/') ||
    pathname === '/dashboard' ||
    pathname.startsWith('/my-work') ||
    (pathname.startsWith('/floor-board') &&
      !pathname.startsWith('/fabric-store/floor-board') &&
      !pathname.startsWith('/dyeing/floor-board') &&
      !pathname.startsWith('/qc1/floor-board') &&
      !pathname.startsWith('/qc2/floor-board') &&
      !pathname.startsWith('/washing/floor-board') &&
      !pathname.startsWith('/embroidery/floor-board') &&
      !pathname.startsWith('/recutting/floor-board') &&
      !pathname.startsWith('/stitching/floor-board') &&
      !pathname.startsWith('/finishing/floor-board') &&
      !pathname.startsWith('/steam-press/floor-board') &&
      !pathname.startsWith('/final-check/floor-board') &&
      !pathname.startsWith('/inventory/floor-board') &&
      !pathname.startsWith('/thread-cutting/floor-board'));

  if (isProgrammingRoute) {
    if (isProgrammingUser(user)) {
      return { allowed: true, redirectTarget: pathname };
    }
    return {
      allowed: false,
      redirectTarget: defaultUserHome,
      reason: 'Access Restricted: Programming Department is restricted to Programming personnel and Admins.',
    };
  }

  return { allowed: true, redirectTarget: pathname };
}
