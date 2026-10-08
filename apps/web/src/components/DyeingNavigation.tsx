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
    router.push('/login');
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
        className={`fixed inset-y-0 left-0 z-50 w-72 md:w-64 bg-[#0F172A] text-slate-300 flex flex-col border-r border-slate-800 select-none transform transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* BRANDING WITH OFFICIAL IMG 3 LOGO */}
        <div className="p-4 border-b border-slate-800 bg-[#0A0F1D] flex items-center justify-between">
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

        {/* DEPARTMENT TITLE */}
        <div className="px-5 pt-4 pb-2 border-b border-slate-800/60 flex items-center gap-2">
          <Droplet className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-purple-400 font-semibold block">
            DYEING DEPARTMENT
          </span>
        </div>

        {/* NAVIGATION ITEMS: Dashboard, Floor Board, My Work ONLY */}
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

          {/* 2. Floor Board */}
          <Link
            href="/dyeing/floor-board"
            onClick={() => setMobileOpen(false)}
            className={linkClass('/dyeing/floor-board', true)}
          >
            <Kanban className="w-4 h-4 text-amber-400" />
            <span>Floor Board</span>
          </Link>

          {/* 3. My Work */}
          <Link
            href="/dyeing/my-work"
            onClick={() => setMobileOpen(false)}
            className={linkClass('/dyeing/my-work', false)}
          >
            <Briefcase className="w-4 h-4 text-emerald-400" />
            <span>My Work</span>
          </Link>
        </nav>

        {/* USER & SIGN OUT FOOTER */}
        <div className="p-4 border-t border-slate-800 bg-[#0A0F1D]/80">
          <div className="flex items-center gap-3 mb-3">
            <UserCircle className="w-8 h-8 text-slate-400" />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-white truncate block">
                {currentUser.fullName || currentUser.username || 'Dyeing Incharge'}
              </span>
              <span className="text-[10px] text-purple-400/90 font-medium tracking-wide block truncate">
                {isAdmin ? 'System Administrator' : 'Dyeing Department'}
              </span>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-800/80 hover:bg-rose-950/40 hover:text-rose-300 hover:border-rose-900 border border-slate-700/60 rounded-lg text-xs text-slate-300 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
