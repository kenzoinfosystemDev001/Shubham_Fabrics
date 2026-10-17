'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Briefcase,
  Kanban,
  LogOut,
  UserCircle,
  Menu,
  X,
  Waves,
  FileText
} from 'lucide-react';
import { api } from '@/lib/api';
import { isAdminUser } from '@/lib/rbac';
import { DepartmentSwitcher } from '@/components/DepartmentSwitcher';
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';
import { InstallAppButton } from '@/components/InstallAppButton';

export function WashingNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>({
    fullName: 'Washing Incharge',
    username: 'washing',
    role: 'WASHING_INCHARGE',
    departmentCode: 'WASHING',
  });

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('subham_mes_user');
      if (savedUser) {
        try {
          setCurrentUser(JSON.parse(savedUser));
        } catch {}
      }
    }
    const syncUser = async () => {
      try {
        if (api.getToken()) {
          const profile = await api.getProfile();
          if (profile) {
            setCurrentUser(profile);
            if (typeof window !== 'undefined') {
              localStorage.setItem('subham_mes_user', JSON.stringify(profile));
            }
          }
        }
      } catch {}
    };
    syncUser();

    // Close mobile drawer on route transition
    setMobileOpen(false);
  }, [pathname]);

  const handleSignOut = () => {
    api.clearToken();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('subham_mes_token');
      localStorage.removeItem('subham_mes_user');
      document.cookie = 'subham_mes_token=; path=/; max-age=0';
      document.cookie = 'subham_mes_role=; path=/; max-age=0';
      document.cookie = 'subham_mes_dept=; path=/; max-age=0';
    }
    router.replace('/login');
  };

  const isAdmin = isAdminUser(currentUser);

  const linkClass = (href: string, exact = false) => {
    const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');
    return `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition ${
      active
        ? 'bg-[#1E293B] text-white border-l-2 border-cyan-400 pl-2.5 shadow-xs'
        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
    }`;
  };

  return (
    <>
      {/* MOBILE TOP BAR (visible on screens < md) */}
      <div className="md:hidden sticky top-0 z-40 bg-[#0F172A] border-b border-slate-800 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
            aria-label="Open Washing Navigation Menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white p-0.5 border border-cyan-500/40 flex items-center justify-center shrink-0">
              <img
                src="/shubham-logo.jpg"
                alt="Shubham Fabrics Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <span className="text-xs font-bold text-white tracking-wide block leading-none">SHUBHAM FABRICS</span>
              <span className="text-[9px] font-bold text-cyan-400 tracking-wider uppercase block">WASHING DEPT</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <InstallAppButton variant="nav" />
          <button
            onClick={handleSignOut}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
            title="Sign Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* MOBILE DRAWER OVERLAY */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* SIDEBAR NAVIGATION (Desktop: sticky, Mobile: fixed slide-over) */}
      <aside
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(15, 23, 42, 0.94), rgba(15, 23, 42, 0.88)), url('${DEPARTMENT_NAV_BG_IMAGE}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 border-r border-slate-800/80 flex flex-col justify-between transition-transform duration-300 md:translate-x-0 ${
          mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* BRAND HEADER */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <Link href="/washing" className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white p-0.5 border border-cyan-500/40 flex items-center justify-center shrink-0 shadow-xs">
                <img
                  src="/shubham-logo.jpg"
                  alt="Shubham Fabrics Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <span className="text-xs font-bold text-white tracking-wide block leading-none">SHUBHAM FABRICS</span>
                <span className="text-[10px] font-bold text-cyan-400 tracking-wider uppercase block mt-1">
                  WASHING & DRYING
                </span>
              </div>
            </Link>
            <button
              onClick={() => setMobileOpen(false)}
              className="md:hidden p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* DEPARTMENT SWITCHER & QUICK ACTIONS */}
          <div className="px-3 py-2 border-b border-slate-800/60 flex flex-col gap-2">
            <DepartmentSwitcher
              currentDepartmentName="Washing Department"
              accentColor="teal"
              onNavigate={() => setMobileOpen(false)}
            />
            <InstallAppButton variant="sidebar" />
          </div>

          {/* NAVIGATION LINKS */}
          <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
            <div className="px-3 pb-1 text-[10px] font-bold tracking-wider uppercase text-slate-400">
              Washing Operations
            </div>

            <Link href="/washing" className={linkClass('/washing', true)}>
              <LayoutDashboard className="w-4 h-4 text-cyan-400" />
              <span>Dashboard</span>
            </Link>

            <Link href="/washing/my-work" className={linkClass('/washing/my-work')}>
              <Briefcase className="w-4 h-4 text-cyan-400" />
              <span>Work Center & Lots</span>
            </Link>

            <Link href="/washing/floor-board" className={linkClass('/washing/floor-board')}>
              <Kanban className="w-4 h-4 text-cyan-400" />
              <span>Washing Floor Board</span>
            </Link>

            <div className="pt-3 px-3 pb-1 text-[10px] font-bold tracking-wider uppercase text-slate-400">
              Fabric & Production
            </div>

            <Link
              href="/washing/my-work?tab=PRODUCTION_SHEETS"
              className={linkClass('/washing/my-work?tab=PRODUCTION_SHEETS')}
            >
              <FileText className="w-4 h-4 text-cyan-400" />
              <span>Production Sheets</span>
            </Link>
          </nav>

          {/* USER PROFILE & FOOTER */}
          <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
            <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-900/60 border border-slate-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-cyan-900/40 border border-cyan-500/40 flex items-center justify-center shrink-0">
                  <UserCircle className="w-5 h-5 text-cyan-400" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-white block truncate">
                    {currentUser?.fullName || 'Washing Incharge'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono text-cyan-300 truncate">
                      {currentUser?.username || 'washing'}
                    </span>
                    <span className="text-[8px] uppercase tracking-wider px-1 py-0.2 rounded bg-cyan-900/60 text-cyan-300 font-bold">
                      WSH
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition shrink-0"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
