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
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
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
    roles.includes('FABRIC_STORE') ||
    roles.includes('STORE_MANAGER')
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

  const defaultUserHome =
    user.departmentCode === 'DYEING'
      ? '/dyeing'
      : user.departmentCode === 'STORE'
      ? '/fabric-store'
      : '/';

  // Admin routes protection
  if (pathname.startsWith('/admin')) {
    return {
      allowed: false,
      redirectTarget: defaultUserHome,
      reason: 'Access Restricted: Admin Console is restricted to System Administrators.',
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

  // Programming department routes protection (root dashboard, my-work, programs, floor-board)
  const isProgrammingRoute =
    pathname === '/' ||
    pathname === '/dashboard' ||
    pathname.startsWith('/my-work') ||
    pathname.startsWith('/programs') ||
    (pathname.startsWith('/floor-board') &&
      !pathname.startsWith('/fabric-store/floor-board') &&
      !pathname.startsWith('/dyeing/floor-board'));

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
