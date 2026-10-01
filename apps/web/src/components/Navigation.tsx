'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Briefcase, 
  FilePlus, 
  Send, 
  Kanban, 
  ChevronDown, 
  ChevronRight, 
  LogOut, 
  UserCircle 
} from 'lucide-react';
import { api } from '@/lib/api';

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [myWorkOpen, setMyWorkOpen] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>({
    fullName: 'Programming Incharge',
    username: 'programmer',
    role: 'PROGRAMMING_INCHARGE',
    departmentCode: 'PROGRAMMING',
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
  }, []);

  const handleSignOut = () => {
    api.clearToken();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('subham_mes_token');
      localStorage.removeItem('subham_mes_user');
    }
    router.push('/login');
  };

  // Do not render sidebar on login page
  if (pathname === '/login') {
    return null;
  }

  const isDashboardActive = pathname === '/' || pathname === '/dashboard';
  const isCreateSheetActive = pathname === '/my-work/create-production-sheet';
  const isIssueChallanActive = pathname === '/my-work/issue-challan';
  const isMyWorkRootActive = pathname === '/my-work';
  const isFloorBoardActive = pathname === '/floor-board';

  return (
    <aside className="w-64 bg-[#0F172A] text-slate-300 flex flex-col fixed inset-y-0 left-0 z-50 border-r border-slate-800 select-none">
      {/* BRANDING HEADER */}
      <div className="p-5 border-b border-slate-800 bg-[#0A0F1D]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-[#163767] border border-amber-500/40 flex items-center justify-center text-amber-400 font-serif font-black text-sm shadow-sm">
            SF
          </div>
          <div>
            <span className="text-xs font-bold tracking-[0.16em] text-white block">
              SHUBHAM FABRICS
            </span>
            <span className="text-[10px] font-medium tracking-[0.2em] text-amber-400/90 block">
              MES ENTERPRISE
            </span>
          </div>
        </div>
      </div>

      {/* DEPARTMENT TITLE */}
      <div className="px-5 pt-5 pb-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400 block">
          PROGRAMMING
        </span>
      </div>

      {/* NAVIGATION ITEMS */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto pt-1">
        {/* 1. Dashboard */}
        <Link
          href="/"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-semibold transition ${
            isDashboardActive
              ? 'bg-[#1E293B] text-white border-l-2 border-amber-400 pl-2.5 shadow-xs'
              : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
          }`}
        >
          <LayoutDashboard className="w-4 h-4 text-slate-400" />
          <span>Dashboard</span>
        </Link>

        {/* 2. My Work (Expandable) */}
        <div>
          <div
            onClick={() => setMyWorkOpen(!myWorkOpen)}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-semibold cursor-pointer transition ${
              isMyWorkRootActive || isCreateSheetActive || isIssueChallanActive
                ? 'text-white'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <Briefcase className="w-4 h-4 text-slate-400" />
              <span>My Work</span>
            </div>
            {myWorkOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>

          {/* Sub-menu items */}
          {myWorkOpen && (
            <div className="ml-4 pl-3 border-l border-slate-700/80 my-1 space-y-1">
              <Link
                href="/my-work/create-production-sheet"
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[11px] font-medium transition ${
                  isCreateSheetActive
                    ? 'bg-[#1E293B] text-white border-l-2 border-amber-400 pl-2 shadow-xs'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                }`}
              >
                <FilePlus className="w-3.5 h-3.5 text-amber-400/80" />
                <span>Create Production Sheet</span>
              </Link>

              <Link
                href="/my-work/issue-challan"
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[11px] font-medium transition ${
                  isIssueChallanActive
                    ? 'bg-[#1E293B] text-white border-l-2 border-amber-400 pl-2 shadow-xs'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                }`}
              >
                <Send className="w-3.5 h-3.5 text-blue-400" />
                <span>Issue Challan</span>
              </Link>
            </div>
          )}
        </div>

        {/* 3. Floor Board (Separate Main Nav Item) */}
        <Link
          href="/floor-board"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-semibold transition ${
            isFloorBoardActive
              ? 'bg-[#1E293B] text-white border-l-2 border-amber-400 pl-2.5 shadow-xs'
              : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
          }`}
        >
          <Kanban className="w-4 h-4 text-slate-400" />
          <span>Floor Board</span>
        </Link>
      </nav>

      {/* USER & SIGN OUT FOOTER */}
      <div className="p-4 border-t border-slate-800 bg-[#0A0F1D]/80">
        <div className="flex items-center gap-3 mb-3">
          <UserCircle className="w-8 h-8 text-slate-400" />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-semibold text-white truncate block">
              {currentUser.fullName || 'Programming User'}
            </span>
            <span className="text-[10px] text-amber-400/90 font-medium tracking-wide block truncate">
              Programming Department
            </span>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-800/80 hover:bg-rose-950/40 hover:text-rose-300 hover:border-rose-900 border border-slate-700/60 rounded text-xs text-slate-300 transition"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
