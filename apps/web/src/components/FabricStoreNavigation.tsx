'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Briefcase,
  PackageCheck,
  ClipboardCheck,
  ArrowDownToLine,
  ChevronDown,
  ChevronRight,
  LogOut,
  UserCircle,
  Boxes,
  BookOpen,
  ListChecks,
  Kanban,
  Building2,
  Send,
  AlertTriangle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { isAdminUser } from '@/lib/rbac';

export function FabricStoreNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [myWorkOpen, setMyWorkOpen] = useState(true);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>({
    fullName: 'Fabric Store Incharge',
    username: 'store',
    role: 'FABRIC_STORE',
    departmentCode: 'STORE',
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

    // Auto-expand sections based on current path
    if (pathname.includes('/fabric-store/my-work')) setMyWorkOpen(true);
    if (pathname.includes('/fabric-store/inventory')) setInventoryOpen(true);
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
    return `flex items-center gap-3 px-3 py-2 rounded-md text-xs font-semibold transition ${
      active
        ? 'bg-[#1E293B] text-white border-l-2 border-teal-400 pl-2.5 shadow-xs'
        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
    }`;
  };

  const subLinkClass = (href: string) => {
    const active = pathname === href || pathname.startsWith(href + '/');
    return `flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[11px] font-medium transition ${
      active
        ? 'bg-[#1E293B] text-white border-l-2 border-teal-400 pl-2 shadow-xs'
        : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
    }`;
  };

  const sectionHeader = (label: string, isOpen: boolean, toggle: () => void, isAnyActive: boolean) => (
    <div
      onClick={toggle}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-semibold cursor-pointer transition ${
        isAnyActive ? 'text-white' : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
      }`}
    >
      <span>{label}</span>
      {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
    </div>
  );

  const myWorkActive = pathname.includes('/fabric-store/my-work');
  const inventoryActive = pathname.includes('/fabric-store/inventory');

  return (
    <aside className="w-64 bg-[#0F172A] text-slate-300 flex flex-col fixed inset-y-0 left-0 z-50 border-r border-slate-800 select-none">
      {/* BRANDING WITH OFFICIAL IMG 3 LOGO */}
      <div className="p-4 border-b border-slate-800 bg-[#0A0F1D]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white p-0.5 border border-teal-500/40 flex items-center justify-center shadow-sm overflow-hidden shrink-0">
            <img
              src="/shubham-logo.jpg"
              alt="Shubham Fabrics Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold tracking-[0.14em] text-white truncate block">SHUBHAM FABRICS</span>
            <span className="text-[10px] font-medium tracking-[0.18em] text-teal-400 block truncate">MES ENTERPRISE</span>
          </div>
        </div>
      </div>

      <div className="px-5 pt-4 pb-2 border-b border-slate-800/60">
        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-teal-400 font-semibold block">
          FABRIC STORE DEPARTMENT
        </span>
      </div>

      {/* NAV */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto pt-1">

        {/* Dashboard */}
        <Link href="/fabric-store" className={linkClass('/fabric-store', true)}>
          <LayoutDashboard className="w-4 h-4 text-slate-400" />
          <span>Dashboard</span>
        </Link>

        {/* My Work */}
        <div>
          <div className="flex items-center gap-3 px-3 py-2">
            <Briefcase className="w-4 h-4 text-slate-400" />
            <div className="flex-1">
              {sectionHeader('My Work', myWorkOpen, () => setMyWorkOpen(!myWorkOpen), myWorkActive)}
            </div>
          </div>
          {myWorkOpen && (
            <div className="ml-7 pl-3 border-l border-slate-700/80 space-y-0.5 my-0.5">
              <Link href="/fabric-store/my-work/incoming-challans" className={subLinkClass('/fabric-store/my-work/incoming-challans')}>
                <PackageCheck className="w-3.5 h-3.5 text-teal-400" />
                <span>Incoming Challans</span>
              </Link>
              <Link href="/fabric-store/my-work/material-receipt" className={subLinkClass('/fabric-store/my-work/material-receipt')}>
                <ArrowDownToLine className="w-3.5 h-3.5 text-blue-400" />
                <span>Material Receipt</span>
              </Link>
              <Link href="/fabric-store/my-work/qc-inspections" className={subLinkClass('/fabric-store/my-work/qc-inspections')}>
                <ClipboardCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>QC Inspections</span>
              </Link>
              <Link href="/fabric-store/my-work/issue-challan" className={subLinkClass('/fabric-store/my-work/issue-challan')}>
                <Send className="w-3.5 h-3.5 text-emerald-400" />
                <span>Issue Challan</span>
              </Link>
            </div>
          )}
        </div>

        {/* Inventory */}
        <div>
          <div className="flex items-center gap-3 px-3 py-2">
            <Boxes className="w-4 h-4 text-slate-400" />
            <div className="flex-1">
              {sectionHeader('Inventory', inventoryOpen, () => setInventoryOpen(!inventoryOpen), inventoryActive)}
            </div>
          </div>
          {inventoryOpen && (
            <div className="ml-7 pl-3 border-l border-slate-700/80 space-y-0.5 my-0.5">
              <Link href="/fabric-store/inventory/stock" className={subLinkClass('/fabric-store/inventory/stock')}>
                <Boxes className="w-3.5 h-3.5 text-teal-400" />
                <span>Stock Overview</span>
              </Link>
              <Link href="/fabric-store/inventory/rolls" className={subLinkClass('/fabric-store/inventory/rolls')}>
                <ListChecks className="w-3.5 h-3.5 text-blue-400" />
                <span>Rolls Registry</span>
              </Link>
              <Link href="/fabric-store/inventory/batches" className={subLinkClass('/fabric-store/inventory/batches')}>
                <PackageCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Batches</span>
              </Link>
              <Link href="/fabric-store/inventory/defected-shelf" className={subLinkClass('/fabric-store/inventory/defected-shelf')}>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>Defected Shelf</span>
              </Link>
              <Link href="/fabric-store/inventory/stock-ledger" className={subLinkClass('/fabric-store/inventory/stock-ledger')}>
                <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                <span>Stock Ledger</span>
              </Link>
            </div>
          )}
        </div>

        {/* Floor Board */}
        <Link href="/fabric-store/floor-board" className={linkClass('/fabric-store/floor-board', true)}>
          <Kanban className="w-4 h-4 text-slate-400" />
          <span>Floor Board</span>
        </Link>

      </nav>

      {/* USER & SIGN OUT */}
      <div className="p-4 border-t border-slate-800 bg-[#0A0F1D]/80">
        <div className="flex items-center gap-3 mb-3">
          <UserCircle className="w-8 h-8 text-slate-400" />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-semibold text-white truncate block">
              {currentUser.fullName || currentUser.username || 'Store Incharge'}
            </span>
            <span className="text-[10px] text-teal-400/90 font-medium tracking-wide block truncate">
              {isAdmin ? 'System Administrator' : 'Fabric Store Department'}
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
