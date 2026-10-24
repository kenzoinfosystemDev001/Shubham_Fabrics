'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Briefcase,
  Kanban,
  Send,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldAlert,
  UserCircle,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { isAdminUser } from '@/lib/rbac';
import { DepartmentSwitcher } from '@/components/DepartmentSwitcher';
import { InstallAppButton } from '@/components/InstallAppButton';
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/final-check', icon: LayoutDashboard, exact: true },
  { label: 'My Work', href: '/final-check/queue', icon: Briefcase },
  { label: 'Issue Challan', href: '/final-check/issue-challan', icon: Send },
  { label: 'Floor Board', href: '/final-check/floor-board', icon: Kanban },
  { label: 'Quality Summary', href: '/final-check/reports', icon: ShieldAlert },
];

export function FinalCheckNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>({
    fullName: 'Final QC Inspector',
    username: 'finalcheck',
    role: 'FINAL_CHECK_INSPECTOR',
    departmentCode: 'FINAL_CHECK',
  });

  useEffect(() => {
    const savedUser = localStorage.getItem('subham_mes_user');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch {
        // Keep the department identity shown while the profile is refreshed.
      }
    }

    const syncUser = async () => {
      if (!api.hasSession()) return;
      try {
        const profile = await api.getProfile();
        if (profile) {
          setCurrentUser(profile);
          localStorage.setItem('subham_mes_user', JSON.stringify(profile));
        }
      } catch {
        // The authenticated session and dashboard remain usable if profile refresh is unavailable.
      }
    };

    void syncUser();
    setMobileOpen(false);
  }, [pathname]);

  const handleSignOut = () => {
    api.clearToken();
    localStorage.removeItem('subham_mes_token');
    localStorage.removeItem('subham_mes_user');
    document.cookie = 'subham_mes_token=; path=/; max-age=0';
    document.cookie = 'subham_mes_role=; path=/; max-age=0';
    document.cookie = 'subham_mes_dept=; path=/; max-age=0';
    router.replace('/login');
  };

  const isAdmin = isAdminUser(currentUser);
  const linkClass = (href: string, exact = false) => {
    const active = exact
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

    return `flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold transition ${
      active
        ? 'border-l-2 border-emerald-400 bg-[#1E293B] pl-2.5 text-white shadow-xs'
        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
    }`;
  };

  return (
    <>
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-800 bg-[#0F172A] px-4 py-3 shadow-sm md:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-1.5 text-slate-300 transition hover:bg-slate-800 hover:text-white"
            aria-label="Open Final QC navigation"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg border border-emerald-500/40 bg-white p-0.5">
              <img src="/shubham-logo.jpg" alt="Shubham Fabrics" className="h-full w-full object-contain" />
            </div>
            <div>
              <span className="block text-xs font-bold leading-none tracking-wide text-white">SHUBHAM FABRICS</span>
              <span className="block text-[9px] font-bold uppercase tracking-wider text-emerald-400">Final QC</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <InstallAppButton variant="nav" />
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-rose-400"
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
          aria-label="Close Final QC navigation"
        />
      )}

      <aside
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(15, 23, 42, 0.4), rgba(10, 15, 29, 0.6)), url('${DEPARTMENT_NAV_BG_IMAGE}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        className={`fixed inset-y-0 left-0 z-50 flex w-72 select-none flex-col border-r border-slate-700/80 text-slate-100 shadow-2xl transition-transform duration-300 md:w-64 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-700/60 bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-emerald-500/40 bg-white p-0.5">
              <img src="/shubham-logo.jpg" alt="Shubham Fabrics" className="h-full w-full object-contain" />
            </div>
            <div>
              <span className="block truncate text-xs font-bold tracking-[0.14em] text-white">SHUBHAM FABRICS</span>
              <span className="block truncate text-[10px] font-medium tracking-[0.18em] text-emerald-400">MES ENTERPRISE</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white md:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative border-b border-slate-700/60 bg-slate-950/20 px-3 pb-2.5 pt-3">
          <DepartmentSwitcher
            currentDepartmentName="Final QC Department"
            accentColor="emerald"
            onNavigate={() => setMobileOpen(false)}
          />
        </div>

        <nav aria-label="Final QC navigation" className="flex-1 space-y-1 overflow-y-auto px-3 pt-2">
          {NAV_ITEMS.map(({ label, href, icon: Icon, exact }) => (
            <Link
              key={label}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={linkClass(href, exact)}
            >
              <Icon className="h-4 w-4 text-emerald-400" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <div className="border-t border-slate-700/60 bg-slate-950/50 p-4 backdrop-blur-md">
          <div className="mb-3 flex items-center gap-3">
            <UserCircle className="h-8 w-8 shrink-0 text-emerald-400/90" />
            <div className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-white">
                {currentUser.fullName || (isAdmin ? 'System Administrator' : 'Final QC Inspector')}
              </span>
              <span className="block truncate text-[10px] font-bold tracking-wide text-emerald-400">
                Final QC Department
              </span>
            </div>
          </div>
          <div className="mb-3">
            <InstallAppButton variant="nav" className="w-full justify-center" />
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700/60 bg-slate-900/70 px-3 py-2 text-xs text-slate-200 shadow-xs transition hover:border-rose-700/60 hover:bg-rose-950/50 hover:text-rose-200"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
