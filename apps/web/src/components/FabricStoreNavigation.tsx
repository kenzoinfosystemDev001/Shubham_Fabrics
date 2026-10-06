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
  ArrowUpFromLine,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  LogOut,
  UserCircle,
  Boxes,
  MapPin,
  BookOpen,
  ShieldCheck,
  ListChecks,
  PauseCircle,
  XCircle,
  Kanban,
  Building2,
} from 'lucide-react';
import { api } from '@/lib/api';

export function FabricStoreNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [myWorkOpen, setMyWorkOpen] = useState(true);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>({
    fullName: 'Store Incharge',
    username: 'store_mgr',
    role: 'STORE_MANAGER',
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
    if (pathname.includes('/fabric-store/quality')) setQualityOpen(true);
  }, [pathname]);

  const handleSignOut = () => {
    api.clearToken();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('subham_mes_token');
      localStorage.removeItem('subham_mes_user');
    }
    router.push('/login');
  };

  if (!mounted) return null;

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const linkClass = (href: string, exact = false) => {
    const active = exact ? pathname === href : isActive(href);
    return `flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-semibold transition ${
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
      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-semibold cursor-pointer transition ${
        isAnyActive ? 'text-white' : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
      }`}
    >
      <span>{label}</span>
      {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
    </div>
  );

  const myWorkActive = pathname.includes('/fabric-store/my-work');
  const inventoryActive = pathname.includes('/fabric-store/inventory');
  const qualityActive = pathname.includes('/fabric-store/quality');

  return (
    <aside className="w-64 bg-[#0F172A] text-slate-300 flex flex-col fixed inset-y-0 left-0 z-50 border-r border-slate-800 select-none">
      {/* BRANDING */}
      <div className="p-5 border-b border-slate-800 bg-[#0A0F1D]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-[#0D3B3B] border border-teal-500/40 flex items-center justify-center text-teal-400 font-serif font-black text-sm shadow-sm">
            SF
          </div>
          <div>
            <span className="text-xs font-bold tracking-[0.16em] text-white block">SHUBHAM FABRICS</span>
            <span className="text-[10px] font-medium tracking-[0.2em] text-teal-400/90 block">MES ENTERPRISE</span>
          </div>
        </div>
      </div>

      {/* DEPT SWITCHER */}
      <div className="px-3 pt-3 pb-1 border-b border-slate-800/60">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500 px-1 mb-1">Department</p>
        <Link
          href="/"
          className="flex items-center gap-2 px-2 py-1.5 rounded text-[11px] text-slate-400 hover:bg-slate-800/50 hover:text-white transition"
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Programming Dept.</span>
        </Link>
        <div className="flex items-center gap-2 px-2 py-1.5 rounded text-[11px] text-white bg-slate-800/70 border border-teal-800/40">
          <Building2 className="w-3.5 h-3.5 text-teal-400" />
          <span className="font-semibold text-teal-300">Fabric Store Dept.</span>
        </div>
      </div>

      <div className="px-5 pt-4 pb-1">
        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-teal-600 block">FABRIC STORE</span>
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
          <div className="flex items-center gap-3 px-3 py-2.5">
            <Briefcase className="w-4 h-4 text-slate-400" />
            {sectionHeader('My Work', myWorkOpen, () => setMyWorkOpen(!myWorkOpen), myWorkActive)}
          </div>
          {myWorkOpen && (
            <div className="ml-4 pl-3 border-l border-slate-700/80 my-1 space-y-0.5">
              <Link href="/fabric-store/my-work/incoming-challans" className={subLinkClass('/fabric-store/my-work/incoming-challans')}>
                <ArrowDownToLine className="w-3.5 h-3.5 text-teal-400/80" />
                <span>Incoming Challans</span>
              </Link>
              <Link href="/fabric-store/my-work/material-receipt" className={subLinkClass('/fabric-store/my-work/material-receipt')}>
                <PackageCheck className="w-3.5 h-3.5 text-teal-400/80" />
                <span>Material Receipt (GRN)</span>
              </Link>
              <Link href="/fabric-store/my-work/qc-inspections" className={subLinkClass('/fabric-store/my-work/qc-inspections')}>
                <ClipboardCheck className="w-3.5 h-3.5 text-amber-400/80" />
                <span>QC Inspections</span>
              </Link>
              <Link href="/fabric-store/my-work/material-issue" className={subLinkClass('/fabric-store/my-work/material-issue')}>
                <ArrowUpFromLine className="w-3.5 h-3.5 text-blue-400/80" />
                <span>Material Issue</span>
              </Link>
              <Link href="/fabric-store/my-work/material-return" className={subLinkClass('/fabric-store/my-work/material-return')}>
                <RotateCcw className="w-3.5 h-3.5 text-purple-400/80" />
                <span>Material Return</span>
              </Link>
            </div>
          )}
        </div>

        {/* Inventory */}
        <div>
          <div className="flex items-center gap-3 px-3 py-2.5">
            <Boxes className="w-4 h-4 text-slate-400" />
            {sectionHeader('Inventory', inventoryOpen, () => setInventoryOpen(!inventoryOpen), inventoryActive)}
          </div>
          {inventoryOpen && (
            <div className="ml-4 pl-3 border-l border-slate-700/80 my-1 space-y-0.5">
              <Link href="/fabric-store/inventory/stock" className={subLinkClass('/fabric-store/inventory/stock')}>
                <Boxes className="w-3.5 h-3.5 text-teal-400/70" />
                <span>Stock</span>
              </Link>
              <Link href="/fabric-store/inventory/rolls" className={subLinkClass('/fabric-store/inventory/rolls')}>
                <ListChecks className="w-3.5 h-3.5 text-slate-400" />
                <span>Rolls</span>
              </Link>
              <Link href="/fabric-store/inventory/locations" className={subLinkClass('/fabric-store/inventory/locations')}>
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>Locations</span>
              </Link>
              <Link href="/fabric-store/inventory/stock-ledger" className={subLinkClass('/fabric-store/inventory/stock-ledger')}>
                <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                <span>Stock Ledger</span>
              </Link>
            </div>
          )}
        </div>

        {/* Quality */}
        <div>
          <div className="flex items-center gap-3 px-3 py-2.5">
            <ShieldCheck className="w-4 h-4 text-slate-400" />
            {sectionHeader('Quality', qualityOpen, () => setQualityOpen(!qualityOpen), qualityActive)}
          </div>
          {qualityOpen && (
            <div className="ml-4 pl-3 border-l border-slate-700/80 my-1 space-y-0.5">
              <Link href="/fabric-store/quality/qc-queue" className={subLinkClass('/fabric-store/quality/qc-queue')}>
                <ClipboardCheck className="w-3.5 h-3.5 text-amber-400/80" />
                <span>QC Queue</span>
              </Link>
              <Link href="/fabric-store/quality/inspections" className={subLinkClass('/fabric-store/quality/inspections')}>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400/70" />
                <span>Inspections</span>
              </Link>
              <Link href="/fabric-store/quality/holds" className={subLinkClass('/fabric-store/quality/holds')}>
                <PauseCircle className="w-3.5 h-3.5 text-amber-500/80" />
                <span>Holds</span>
              </Link>
              <Link href="/fabric-store/quality/rejections" className={subLinkClass('/fabric-store/quality/rejections')}>
                <XCircle className="w-3.5 h-3.5 text-red-400/80" />
                <span>Rejections</span>
              </Link>
            </div>
          )}
        </div>

        {/* Floor Board */}
        <Link href="/floor-board" className={linkClass('/floor-board')}>
          <Kanban className="w-4 h-4 text-slate-400" />
          <span>Floor Board</span>
        </Link>
      </nav>

      {/* USER FOOTER */}
      <div className="p-4 border-t border-slate-800 bg-[#0A0F1D]/80">
        <div className="flex items-center gap-3 mb-3">
          <UserCircle className="w-8 h-8 text-slate-400" />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-semibold text-white truncate block">
              {currentUser.fullName || 'Store User'}
            </span>
            <span className="text-[10px] text-teal-400/90 font-medium tracking-wide block truncate">
              Fabric Store Department
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
