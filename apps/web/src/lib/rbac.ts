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

  // Admin routes protection
  if (pathname.startsWith('/admin')) {
    const fallback = user.departmentCode === 'STORE' ? '/fabric-store' : '/';
    return {
      allowed: false,
      redirectTarget: fallback,
      reason: 'Access Restricted: Admin Console is restricted to System Administrators.',
    };
  }

  // Fabric Store routes protection
  if (pathname.startsWith('/fabric-store')) {
    if (isFabricStoreUser(user)) {
      return { allowed: true, redirectTarget: pathname };
    }
    return {
      allowed: false,
      redirectTarget: '/',
      reason: 'Access Restricted: You are logged into Programming. Fabric Store is restricted to Store Department personnel and Admins.',
    };
  }

  // Programming department routes protection (root dashboard, my-work, programs, floor-board)
  const isProgrammingRoute =
    pathname === '/' ||
    pathname === '/dashboard' ||
    pathname.startsWith('/my-work') ||
    pathname.startsWith('/programs') ||
    (pathname.startsWith('/floor-board') && !pathname.startsWith('/fabric-store/floor-board'));

  if (isProgrammingRoute) {
    if (isProgrammingUser(user)) {
      return { allowed: true, redirectTarget: pathname };
    }
    return {
      allowed: false,
      redirectTarget: '/fabric-store',
      reason: 'Access Restricted: You are logged into Fabric Store. Programming Department is restricted to Programming personnel and Admins.',
    };
  }

  return { allowed: true, redirectTarget: pathname };
}
