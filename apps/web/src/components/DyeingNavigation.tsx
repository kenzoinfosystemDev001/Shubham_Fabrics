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
  Droplet
} from 'lucide-react';
import { api } from '@/lib/api';
import { isAdminUser } from '@/lib/rbac';
import { DepartmentSwitcher } from '@/components/DepartmentSwitcher';
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';

export function DyeingNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>({
    fullName: 'Dyeing Incharge',
    username: 'dyeing',
    role: 'DYEING_INCHARGE',
    departmentCode: 'DYEING',
  });

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('subham_mes_user');
      if (savedUser) {
        try { setCurrentUser(JSON.parse(savedUser)); } catch {}
      }
    }
    const syncUser = async () => {
      try {
        if (api.hasSession()) {
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

    // Close mobile drawer on navigation
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
        ? 'bg-[#1E293B] text-white border-l-2 border-purple-400 pl-2.5 shadow-xs'
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
            aria-label="Open Dyeing Menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white p-0.5 border border-purple-500/40 flex items-center justify-center shrink-0">
              <img
                src="/shubham-logo.jpg"
                alt="Shubham Fabrics"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <span className="text-xs font-bold text-white tracking-wide block leading-none">SHUBHAM FABRICS</span>
              <span className="text-[9px] font-bold text-purple-400 tracking-wider uppercase block">DYEING DEPT</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* BACKDROP OVERLAY FOR MOBILE */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-50 transition-opacity"
        />
      )}

      {/* SIDEBAR ASIDE */}
      <aside
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(15, 23, 42, 0.40), rgba(10, 15, 29, 0.60)), url('${DEPARTMENT_NAV_BG_IMAGE}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
        className={`fixed inset-y-0 left-0 z-50 w-72 md:w-64 text-slate-100 flex flex-col border-r border-slate-700/80 select-none transform transition-transform duration-300 ease-in-out shadow-2xl backdrop-blur-xs ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* BRANDING WITH OFFICIAL IMG 3 LOGO */}
        <div className="p-4 border-b border-slate-700/60 bg-slate-950/40 backdrop-blur-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white p-0.5 border border-purple-500/40 flex items-center justify-center shadow-sm overflow-hidden shrink-0">
              <img
                src="/shubham-logo.jpg"
                alt="Shubham Fabrics Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold tracking-[0.14em] text-white truncate block">SHUBHAM FABRICS</span>
              <span className="text-[10px] font-medium tracking-[0.18em] text-purple-400 block truncate">MES ENTERPRISE</span>
            </div>
          </div>

          {/* Close button on mobile */}
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* DEPARTMENT TITLE & WORKSPACE SWITCHER */}
        <div className="relative px-3 pt-3 pb-2.5 border-b border-slate-700/60 bg-slate-950/20 backdrop-blur-xs">
          <div className="relative z-10">
            <DepartmentSwitcher
              currentDepartmentName="Dyeing Department"
              accentColor="purple"
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>

        {/* NAVIGATION ITEMS: Dashboard, My Work (Incoming Challans, Create Challan to QC1), Floor Board */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto pt-2">
          {/* 1. Dashboard */}
          <Link
            href="/dyeing"
            onClick={() => setMobileOpen(false)}
            className={linkClass('/dyeing', true)}
          >
            <LayoutDashboard className="w-4 h-4 text-purple-400" />
            <span>Dashboard</span>
          </Link>

          {/* 2. My Work */}
          <div>
            <Link
              href="/dyeing/my-work"
              onClick={() => setMobileOpen(false)}
              className={linkClass('/dyeing/my-work', false)}
            >
              <Briefcase className="w-4 h-4 text-emerald-400" />
              <span>My Work</span>
            </Link>

            {/* Sublinks matching handwritten sheet */}
            <div className="ml-7 pl-2.5 border-l border-slate-700/80 space-y-0.5 my-1">
              <Link
                href="/dyeing/my-work?tab=incoming"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-[11px] font-medium transition ${
                  pathname === '/dyeing/my-work'
                    ? 'text-purple-300 hover:text-white hover:bg-slate-800/60'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                <span>Incoming Challans</span>
              </Link>
              <Link
                href="/dyeing/my-work?tab=create-challan"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-[11px] font-medium transition ${
                  pathname === '/dyeing/my-work'
                    ? 'text-purple-300 hover:text-white hover:bg-slate-800/60'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                <span>Create Challan to QC1</span>
              </Link>
            </div>
          </div>

          {/* 3. Floor Board */}
          <Link
            href="/dyeing/floor-board"
            onClick={() => setMobileOpen(false)}
            className={linkClass('/dyeing/floor-board', true)}
          >
            <Kanban className="w-4 h-4 text-amber-400" />
            <span>Floor Board</span>
          </Link>
        </nav>

        {/* USER & SIGN OUT FOOTER */}
        <div className="p-4 border-t border-slate-700/60 bg-slate-950/50 backdrop-blur-md">
          <div className="flex items-center gap-3 mb-3">
            <UserCircle className="w-8 h-8 text-purple-400/90" />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-white truncate block drop-shadow-xs">
                {currentUser.fullName || (isAdmin ? 'System Administrator' : 'Dyeing Incharge')}
              </span>
              <span className="text-[10px] text-purple-400 font-bold tracking-wide block truncate drop-shadow-xs">
                Dyeing Department
              </span>
            </div>
          </div>


          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-900/70 hover:bg-rose-950/50 hover:text-rose-200 hover:border-rose-700/60 border border-slate-700/60 rounded-lg text-xs text-slate-200 transition shadow-xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
