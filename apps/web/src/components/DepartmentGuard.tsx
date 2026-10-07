'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { checkRouteAccess, getCurrentUser, MESUser } from '@/lib/rbac';
import { ShieldAlert } from 'lucide-react';

interface GuardProps {
  children: React.ReactNode;
}

export function DepartmentGuard({ children }: GuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [denialReason, setDenialReason] = useState<string | null>(null);

  useEffect(() => {
    // Skip guard for login page
    if (pathname === '/login') {
      setAuthorized(true);
      return;
    }

    const user = getCurrentUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const check = checkRouteAccess(pathname, user);

    if (!check.allowed) {
      setDenialReason(check.reason || 'Access denied for your role.');
      const timer = setTimeout(() => {
        router.push(check.redirectTarget);
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      setAuthorized(true);
      setDenialReason(null);
    }
  }, [pathname, router]);

  if (denialReason) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-800 border border-rose-500/40 rounded-2xl p-6 shadow-2xl text-center">
          <div className="w-14 h-14 rounded-full bg-rose-500/20 border border-rose-500/50 mx-auto flex items-center justify-center mb-4 text-rose-400">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Access Restricted (RBAC)</h2>
          <p className="text-xs text-slate-300 leading-relaxed mb-4">{denialReason}</p>
          <div className="inline-flex items-center gap-2 text-xs text-amber-400 bg-amber-950/40 px-3 py-1.5 rounded-lg border border-amber-800/40">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            Redirecting to your authorized station...
          </div>
        </div>
      </div>
    );
  }

  if (!authorized && pathname !== '/login') {
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
