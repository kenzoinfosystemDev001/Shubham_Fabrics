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

export function getUserStationHome(user: MESUser | null): string {
  if (!user) return '/login';
  if (isAdminUser(user)) return '/admin';
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
      reason: 'Access Restricted: You are not authorized for the QC1 Department. Access is restricted to QC1 Quality personnel and Admins.',
    };
  }

  // QC2 Department routes protection
  if (pathname.startsWith('/qc2')) {
    if (isQc2User(user)) {
      return { allowed: true, redirectTarget: pathname };
    }
    return {
      allowed: false,
      redirectTarget: defaultUserHome,
      reason: 'Access Restricted: You are not authorized for the QC2 Department. Access is restricted to QC2 Quality personnel and Admins.',
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

  // Programming department routes protection (/programming, my-work, programs, floor-board)
  const isProgrammingRoute =
    pathname === '/programming' ||
    pathname.startsWith('/programming/') ||
    pathname === '/dashboard' ||
    pathname.startsWith('/my-work') ||
    pathname.startsWith('/programs') ||
    (pathname.startsWith('/floor-board') &&
      !pathname.startsWith('/fabric-store/floor-board') &&
      !pathname.startsWith('/dyeing/floor-board') &&
      !pathname.startsWith('/qc1/floor-board') &&
      !pathname.startsWith('/qc2/floor-board') &&
      !pathname.startsWith('/embroidery/floor-board') &&
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
