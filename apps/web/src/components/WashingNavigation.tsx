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
            aria-label="Open Washing Navigation Menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white p-0.5 border border-neutral-200 flex items-center justify-center shrink-0">
              <img
                src="/shubham-logo.jpg"
                alt="Shubham Fabrics Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <span className="text-xs font-bold text-neutral-900 tracking-wide block leading-none">SHUBHAM FABRICS</span>
              <span className="text-[9px] font-bold text-brand-700 tracking-wider uppercase block">WASHING DEPT</span>
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
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* MOBILE DRAWER OVERLAY */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-neutral-900/60 transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* SIDEBAR NAVIGATION (Desktop: sticky, Mobile: fixed slide-over) */}
      <aside
        className={`bg-white fixed top-0 bottom-0 left-0 z-50 w-64 border-r border-neutral-200 flex flex-col justify-between transition-transform duration-300 md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* SIDEBAR TEXTILE BACKGROUND (one image for all departments, Admin > Sidebar Image) */}
        <SidebarDepartmentArt />

        <div className="flex flex-col h-full overflow-hidden">
          {/* BRAND HEADER */}
          <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
            <Link href="/washing" className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white p-0.5 border border-neutral-200 flex items-center justify-center shrink-0 shadow-xs">
                <img
                  src="/shubham-logo.jpg"
                  alt="Shubham Fabrics Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <span className="text-xs font-bold text-neutral-900 tracking-wide block leading-none">SHUBHAM FABRICS</span>
                <span className="text-[10px] font-bold text-brand-700 tracking-wider uppercase block mt-1">
                  WASHING & DRYING
                </span>
              </div>
            </Link>
            <button
              onClick={() => setMobileOpen(false)}
              className="md:hidden p-1 rounded-md text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* DEPARTMENT SWITCHER & QUICK ACTIONS */}
          <div className="px-3 py-2 border-b border-neutral-200 flex flex-col gap-2 [&:not(:has(button))]:hidden">
            <DepartmentSwitcher
              currentDepartmentName="Washing Department"
              accentColor="teal"
              onNavigate={() => setMobileOpen(false)}
            />
            <InstallAppButton variant="sidebar" />
          </div>

          {/* NAVIGATION LINKS */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {/* 1. Dashboard */}
            <Link href="/washing" onClick={() => setMobileOpen(false)} className={linkClass('/washing', true)}>
              <span>Dashboard</span>
            </Link>

            {/* 2. My Work */}
            <div>
              <div
                className={`px-3 py-2.5 text-xs font-semibold ${
                  pathname.startsWith('/washing/my-work') ? 'text-neutral-900' : 'text-neutral-700'
                }`}
              >
                My Work
              </div>
              <div className="ml-4 pl-3 border-l border-neutral-200 space-y-0.5 mb-1">
                {[
                  { href: '/washing/my-work/incoming', label: 'Incoming Challans' },
                  { href: '/washing/my-work/received', label: 'Received Material' },
                  { href: '/washing/my-work/process', label: 'Washing Process' },
                  { href: '/washing/my-work/issue-challan', label: 'Issue Challan to Washing QC' },
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

            {/* 3. Washing History */}
            <Link href="/washing/history" onClick={() => setMobileOpen(false)} className={linkClass('/washing/history', true)}>
              <span>Washing History</span>
            </Link>

            {/* HOLD: fabric kept back from forwarding */}
            <Link href="/washing/hold" onClick={() => setMobileOpen(false)} className={linkClass('/washing/hold', true)}>
              <span>HOLD</span>
            </Link>
            {/* 4. Floor Board */}
            <Link href="/washing/floor-board" onClick={() => setMobileOpen(false)} className={linkClass('/washing/floor-board', true)}>
              <span>Floor Board</span>
            </Link>
          </nav>

          {/* USER PROFILE & FOOTER */}
          <div className="p-3 border-t border-neutral-200 bg-white/75 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white border border-neutral-200">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-brand-50 border border-neutral-200 flex items-center justify-center shrink-0">
                  <UserCircle className="w-5 h-5 text-brand-700" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-neutral-900 block truncate">
                    {currentUser?.fullName || 'Washing Incharge'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono text-brand-700 truncate">
                      {currentUser?.username || 'washing'}
                    </span>
                    <span className="text-[8px] uppercase tracking-wider px-1 py-0.2 rounded bg-brand-50 text-brand-700 font-bold">
                      WSH
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-white hover:bg-danger-50 hover:text-danger-800 hover:border-danger-500/60 border border-neutral-200 rounded-lg text-xs text-neutral-900 transition shadow-xs"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
