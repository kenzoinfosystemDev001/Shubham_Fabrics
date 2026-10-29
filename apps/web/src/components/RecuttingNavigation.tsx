'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LogOut,
  UserCircle,
  Menu,
  X
} from 'lucide-react';
import { api } from '@/lib/api';
import { isAdminUser } from '@/lib/rbac';
import { DepartmentSwitcher } from '@/components/DepartmentSwitcher';
import { SidebarDepartmentArt } from '@/components/SidebarDepartmentArt';
import { InstallAppButton } from '@/components/InstallAppButton';

export function RecuttingNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>({
    fullName: 'Recutting Supervisor',
    username: 'recutting',
    role: 'RECUTTING_SUPERVISOR',
    departmentCode: 'RECUTTING',
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
        ? 'bg-brand-50 text-brand-800 border-l-2 border-brand-500 pl-2.5'
        : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
    }`;
  };

  return (
    <>
      {/* MOBILE TOP BAR (visible on screens < md) */}
      <div className="md:hidden sticky top-0 z-40 bg-white border-b border-neutral-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 transition"
            aria-label="Open Recutting Navigation Menu"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white p-0.5 border border-danger-500/40 flex items-center justify-center shrink-0">
              <img
                src="/shubham-logo.jpg"
                alt="Shubham Fabrics Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <span className="text-xs font-bold text-neutral-900 tracking-wide block leading-none">SHUBHAM FABRICS</span>
              <span className="text-[9px] font-bold text-brand-700 tracking-wider uppercase block">RECUTTING DEPT</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <InstallAppButton variant="nav" />
          <button
            onClick={handleSignOut}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-danger-600 hover:bg-neutral-100 transition"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* BACKDROP OVERLAY FOR MOBILE */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 bg-neutral-900/60 z-50 transition-opacity"
        />
      )}

      {/* SIDEBAR ASIDE */}
      <aside
        className={`bg-white fixed inset-y-0 left-0 z-50 w-72 md:w-64 text-neutral-900 flex flex-col border-r border-neutral-200 select-none transform transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* SIDEBAR TEXTILE BACKGROUND (one image for all departments, Admin > Sidebar Image) */}
        <SidebarDepartmentArt />

        {/* BRANDING */}
        <div className="p-4 border-b border-neutral-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white p-0.5 border border-danger-500/40 flex items-center justify-center shadow-sm overflow-hidden shrink-0">
              <img
                src="/shubham-logo.jpg"
                alt="Shubham Fabrics Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold tracking-[0.14em] text-neutral-900 truncate block">SHUBHAM FABRICS</span>
            </div>
          </div>

          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* DEPARTMENT TITLE & WORKSPACE SWITCHER */}
        <div className="relative px-3 pt-3 pb-2.5 border-b border-neutral-200 bg-white [&:not(:has(button))]:hidden">
          <div className="relative z-10">
            <DepartmentSwitcher
              currentDepartmentName="Recutting"
              accentColor="rose"
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>

        {/* NAVIGATION ITEMS */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto pt-2">
          {/* 1. Dashboard */}
          <Link
            href="/recutting"
            onClick={() => setMobileOpen(false)}
            className={linkClass('/recutting', true)}
          >
            <span>Dashboard</span>
          </Link>

          {/* 2. My Work */}
          <div>
            <div
              className={`px-3 py-2.5 text-xs font-semibold ${
                pathname.startsWith('/recutting/my-work') ? 'text-neutral-900' : 'text-neutral-700'
              }`}
            >
              My Work
            </div>
            <div className="ml-4 pl-3 border-l border-neutral-200 space-y-0.5 mb-1">
              {[
                { href: '/recutting/my-work/incoming', label: 'Incoming Challans' },
                { href: '/recutting/my-work/received', label: 'Received Fabric' },
                { href: '/recutting/my-work/allocation', label: 'Fabric Allocation & Recutting' },
                { href: '/recutting/my-work/allocation-history', label: 'Allocation History' },
                { href: '/recutting/my-work/issue-challan', label: 'Generate Stitching Challan' },
                { href: '/recutting/my-work/issued-challans', label: 'Issued Challans' },
              ].map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center px-2.5 py-2 rounded-lg text-[11px] font-medium transition ${
                      active
                        ? 'bg-brand-50 text-brand-800 border-l-2 border-brand-500 pl-2'
                        : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* 3. Recutting History */}
          <Link
            href="/recutting/history"
            onClick={() => setMobileOpen(false)}
            className={linkClass('/recutting/history', true)}
          >
            <span>Recutting History</span>
          </Link>

          {/* HOLD: fabric kept back from forwarding */}
          <Link
            href="/recutting/hold"
            onClick={() => setMobileOpen(false)}
            className={linkClass('/recutting/hold', true)}
          >
            <span>HOLD</span>
          </Link>
          {/* 4. Floor Board */}
          <Link
            href="/recutting/floor-board"
            onClick={() => setMobileOpen(false)}
            className={linkClass('/recutting/floor-board', true)}
          >
            <span>Floor Board</span>
          </Link>
        </nav>

        {/* USER & SIGN OUT FOOTER */}
        <div className="p-4 border-t border-neutral-200 bg-white/75 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-3">
            <UserCircle className="w-8 h-8 text-danger-600" />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-neutral-900 truncate block drop-shadow-xs">
                {(currentUser.fullName && currentUser.fullName.trim().toLowerCase() !== 'recutting department' ? currentUser.fullName : '') || (isAdmin ? 'System Administrator' : 'Recutting Supervisor')}
              </span>
              <span className="text-[10px] text-danger-600 font-bold tracking-wide block truncate drop-shadow-xs">
                Recutting Department
              </span>
            </div>
          </div>

          <div className="mb-3">
            <InstallAppButton variant="nav" className="w-full justify-center" />
          </div>

          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white hover:bg-danger-50 hover:text-danger-800 hover:border-danger-500/60 border border-neutral-200 rounded-lg text-xs text-neutral-900 transition shadow-xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
