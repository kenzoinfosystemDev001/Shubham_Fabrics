'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { checkRouteAccess, getCurrentUser, isAdminUser, getUserStationHome, MESUser } from '@/lib/rbac';
import { ShieldAlert } from 'lucide-react';
import { api } from '@/lib/api';

interface GuardProps {
  children: React.ReactNode;
}

export type DepartmentScope =
  | 'EMBROIDERY'
  | 'THREAD_CUTTING'
  | 'DYEING'
  | 'FABRIC_STORE'
  | 'QC1'
  | 'QC2'
  | 'WASHING'
  | 'QC3'
  | 'RECUTTING'
  | 'STITCHING'
  | 'FINISHING'
  | 'STEAM_PRESS'
  | 'FINAL_CHECK'
  | 'INVENTORY'
  | 'PROGRAMMING'
  | 'ADMIN'
  | 'AUTH'
  | 'SHARED';

export function getDepartmentScope(path: string): DepartmentScope {
  if (!path || path === '/' || path === '/login' || path === '/signup') return 'AUTH';
  if (path.startsWith('/embroidery')) return 'EMBROIDERY';
  if (path.startsWith('/thread-cutting')) return 'THREAD_CUTTING';
  if (path.startsWith('/dyeing')) return 'DYEING';
  if (path.startsWith('/fabric-store')) return 'FABRIC_STORE';
  if (path.startsWith('/qc1')) return 'QC1';
  if (path.startsWith('/qc2')) return 'QC2';
  if (path.startsWith('/washing')) return 'WASHING';
  if (path.startsWith('/qcwashing') || path.startsWith('/qc3') || path.startsWith('/qc-washing')) return 'QC3';
  if (path.startsWith('/recutting')) return 'RECUTTING';
  if (path.startsWith('/stitching')) return 'STITCHING';
  if (path.startsWith('/finishing')) return 'FINISHING';
  if (path.startsWith('/steam-press')) return 'STEAM_PRESS';
  if (path.startsWith('/final-check')) return 'FINAL_CHECK';
  if (path.startsWith('/inventory') || path.startsWith('/packing')) return 'INVENTORY';
  if (path.startsWith('/programming')) return 'PROGRAMMING';
  if (path.startsWith('/admin')) return 'ADMIN';
  if (path.startsWith('/challans') || path.startsWith('/programs')) return 'SHARED';
  return 'SHARED';
}

export function getDepartmentRoot(scope: DepartmentScope): string {
  switch (scope) {
    case 'EMBROIDERY': return '/embroidery';
    case 'THREAD_CUTTING': return '/thread-cutting';
    case 'DYEING': return '/dyeing';
    case 'FABRIC_STORE': return '/fabric-store';
    case 'QC1': return '/qc1';
    case 'QC2': return '/qc2';
    case 'WASHING': return '/washing';
    case 'QC3': return '/qcwashing';
    case 'RECUTTING': return '/recutting';
    case 'STITCHING': return '/stitching';
    case 'FINISHING': return '/finishing';
    case 'STEAM_PRESS': return '/steam-press';
    case 'FINAL_CHECK': return '/final-check';
    case 'INVENTORY': return '/inventory';
    case 'PROGRAMMING': return '/programming';
    case 'ADMIN': return '/admin';
    default: return '/login';
  }
}

export function DepartmentGuard({ children }: GuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [denialReason] = useState<string | null>(null);
  // Access is decided while rendering (after mount, when the stored session can be read), never in a
  // later effect: a page this session may not see is not shown, not even for one frame, including
  // when Back / Forward restores it from the router or browser history cache.
  const [mounted, setMounted] = useState(false);
  const [, setRecheck] = useState(0);

  // 1. Synchronize active department context in sessionStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const scope = getDepartmentScope(pathname);
    if (scope !== 'AUTH' && scope !== 'SHARED') {
      sessionStorage.setItem('active_department', scope);
      sessionStorage.setItem('active_department_root', getDepartmentRoot(scope));
    }
  }, [pathname]);

  // 2. Route authorization, checked on every render. It is re-checked when the browser restores a page
  //    from its back/forward cache, and when another tab signs in or out.
  useEffect(() => {
    setMounted(true);
    const recheck = () => setRecheck((n) => n + 1);
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) recheck();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === 'subham_mes_user') recheck();
    };
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const isAuthPage = pathname === '/login' || pathname === '/signup';
  const access = mounted && !isAuthPage && pathname !== '/' ? checkRouteAccess(pathname, getCurrentUser()) : null;
  // The site root opens the signed-in user's own station (the login page would end their session).
  const redirectTarget = !mounted
    ? null
    : pathname === '/'
      ? getUserStationHome(getCurrentUser())
      : access && !access.allowed
        ? access.redirectTarget
        : null;
  const authorized = isAuthPage || Boolean(access?.allowed);

  useEffect(() => {
    if (redirectTarget) router.replace(redirectTarget);
  }, [redirectTarget, router]);

  // 3. Intercept browser back/forward buttons (popstate)
  // RULE: Going back only stays within that individual department, or at last exits to /login.
  // NEVER allows crossing into a different department (e.g. from Embroidery to Programming).
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = () => {
      // Administrators work across every department, so Back may return to any of them or the Admin Console.
      if (isAdminUser(getCurrentUser())) return;
      const activeDept = sessionStorage.getItem('active_department') as DepartmentScope | null;
      const targetPath = window.location.pathname;
      const targetDept = getDepartmentScope(targetPath);

      // Keep the active department while on the login page so older history entries
      // cannot take the user into a different department.
      if (targetPath === '/login' || targetPath === '/signup') {
        if (targetPath === '/login') {
          sessionStorage.setItem('allow_login_after_back', 'true');
        }
        return;
      }

      if (activeDept && activeDept !== 'AUTH') {
        const activeRoot = getDepartmentRoot(activeDept);

        if (targetDept === activeDept) {
          return;
        }

        if (targetDept === 'SHARED') {
          return;
        }

        const currentScope = getDepartmentScope(pathname);
        const fallbackPath =
          pathname === activeRoot || currentScope === 'AUTH' ? '/login' : activeRoot;

        if (fallbackPath === '/login') {
          sessionStorage.setItem('allow_login_after_back', 'true');
        }
        window.history.replaceState(null, '', fallbackPath);
        router.replace(fallbackPath);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [pathname, router]);

  const handleSignOut = () => {
    // Ends the server session too: the session cookie is httpOnly, so clearing it from the page cannot.
    api.clearToken();
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('active_department');
      sessionStorage.removeItem('active_department_root');
      document.cookie = 'subham_mes_token=; path=/; max-age=0';
      document.cookie = 'subham_mes_role=; path=/; max-age=0';
      document.cookie = 'subham_mes_dept=; path=/; max-age=0';
    }
    router.replace('/login');
  };

  if (denialReason) {
    const user = getCurrentUser();
    const stationHome = getUserStationHome(user);

    return (
      <div className="min-h-screen bg-canvas text-neutral-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-danger-200 rounded-2xl p-6 shadow-sm text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-danger-50 border border-danger-200 mx-auto flex items-center justify-center text-danger-600">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-neutral-900 mb-2">Access Restricted (RBAC)</h2>
            <p className="text-xs text-neutral-700 leading-relaxed">{denialReason}</p>
          </div>
          <div className="inline-flex items-center gap-2 text-xs text-accent-700 bg-accent-50 px-3 py-1.5 rounded-lg border border-accent-500/40">
            <span className="w-2 h-2 rounded-full bg-accent-400 animate-ping"></span>
            Redirecting to your authorized station...
          </div>
          <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
            <button
              onClick={() => router.replace(stationHome)}
              className="px-4 py-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-900 rounded-lg text-xs font-semibold transition"
            >
              Return to My Department
            </button>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-lg text-xs font-semibold transition"
            >
              Sign Out to Switch
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (pathname === '/') {
    return <>{children}</>;
  }

  if (!authorized && pathname !== '/login' && pathname !== '/signup') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
            Verifying Station Security...
          </span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
