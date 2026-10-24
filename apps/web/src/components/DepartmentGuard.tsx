'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { checkRouteAccess, getCurrentUser, isAdminUser, getUserStationHome, isRouteWithin, MESUser } from '@/lib/rbac';
import { ShieldAlert } from 'lucide-react';

interface GuardProps {
  children: React.ReactNode;
}

export type DepartmentScope =
  | 'EMBROIDERY'
  | 'THREAD_CUTTING'
  | 'DYEING'
  | 'FABRIC_STORE'
  | 'DYEING_QC'
  | 'THREADCUT_QC'
  | 'WASHING'
  | 'WASHING_QC'
  | 'RECUTTING'
  | 'STITCHING'
  | 'FINISHING'
  | 'STEAM_PRESS'
  | 'FINAL_QC'
  | 'PROGRAMMING'
  | 'ADMIN'
  | 'AUTH'
  | 'SHARED';

export function getDepartmentScope(path: string): DepartmentScope {
  if (!path || path === '/' || path === '/login' || path === '/signup') return 'AUTH';
  if (path.startsWith('/embroidery')) return 'EMBROIDERY';
  if (path.startsWith('/thread-cutting')) return 'THREAD_CUTTING';
  if (isRouteWithin(path, '/dyeing')) return 'DYEING';
  if (path.startsWith('/fabric-store')) return 'FABRIC_STORE';
  if (path.startsWith('/dyeing-qc')) return 'DYEING_QC';
  if (path.startsWith('/threadcut-qc')) return 'THREADCUT_QC';
  if (isRouteWithin(path, '/washing')) return 'WASHING';
  if (path.startsWith('/washing-qc')) return 'WASHING_QC';
  if (path.startsWith('/recutting')) return 'RECUTTING';
  if (path.startsWith('/stitching')) return 'STITCHING';
  if (path.startsWith('/finishing')) return 'FINISHING';
  if (path.startsWith('/steam-press')) return 'STEAM_PRESS';
  if (path.startsWith('/final-qc')) return 'FINAL_QC';
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
    case 'DYEING_QC': return '/dyeing-qc';
    case 'THREADCUT_QC': return '/threadcut-qc';
    case 'WASHING': return '/washing';
    case 'WASHING_QC': return '/washing-qc';
    case 'RECUTTING': return '/recutting';
    case 'STITCHING': return '/stitching';
    case 'FINISHING': return '/finishing';
    case 'STEAM_PRESS': return '/steam-press';
    case 'FINAL_QC': return '/final-qc';
    case 'PROGRAMMING': return '/programming';
    case 'ADMIN': return '/admin';
    default: return '/login';
  }
}

export function DepartmentGuard({ children }: GuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [denialReason, setDenialReason] = useState<string | null>(null);

  // 1. Synchronize active department context in sessionStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const scope = getDepartmentScope(pathname);
    if (scope !== 'AUTH' && scope !== 'SHARED') {
      sessionStorage.setItem('active_department', scope);
      sessionStorage.setItem('active_department_root', getDepartmentRoot(scope));
    }
  }, [pathname]);

  // 2. Strict Department Navigation & Route Authorization Check
  useEffect(() => {
    const user = getCurrentUser();
    if (pathname === '/') {
      router.replace('/login');
      return;
    }

    if (!user) {
      if (pathname === '/login' || pathname === '/signup') {
        setAuthorized(true);
        setDenialReason(null);
        return;
      }
      router.replace('/login');
      return;
    }

    // Allow user to land on /login or /signup if they navigated or pressed back to it
    if (pathname === '/login' || pathname === '/signup') {
      setAuthorized(true);
      setDenialReason(null);
      return;
    }

    const check = checkRouteAccess(pathname, user);

    if (!check.allowed) {
      router.replace(check.redirectTarget);
      return;
    } else {
      setAuthorized(true);
      setDenialReason(null);
    }
  }, [pathname, router]);

  // 3. Intercept browser back/forward buttons (popstate)
  // RULE: Going back only stays within that individual department, or at last exits to /login.
  // NEVER allows crossing into a different department (e.g. from Embroidery to Programming).
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = () => {
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
    if (typeof window !== 'undefined') {
      localStorage.removeItem('subham_mes_token');
      localStorage.removeItem('subham_mes_user');
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
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-800 border border-rose-500/40 rounded-2xl p-6 shadow-2xl text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-rose-500/20 border border-rose-500/50 mx-auto flex items-center justify-center text-rose-400">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white mb-2">Access Restricted (RBAC)</h2>
            <p className="text-xs text-slate-300 leading-relaxed">{denialReason}</p>
          </div>
          <div className="inline-flex items-center gap-2 text-xs text-amber-400 bg-amber-950/40 px-3 py-1.5 rounded-lg border border-amber-800/40">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            Redirecting to your authorized station...
          </div>
          <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
            <button
              onClick={() => router.replace(stationHome)}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-semibold transition"
            >
              Return to My Department
            </button>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition"
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-slate-700 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            Verifying Station Security...
          </span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
