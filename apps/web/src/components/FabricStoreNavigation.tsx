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
  Layers,
  BookOpen,
  ListChecks,
  Kanban,
  Building2,
  Send,
  AlertTriangle,
  Menu,
  X
} from 'lucide-react';
import { api } from '@/lib/api';
import { isAdminUser } from '@/lib/rbac';
import { DepartmentSwitcher } from '@/components/DepartmentSwitcher';
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';

export function FabricStoreNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [myWorkOpen, setMyWorkOpen] = useState(true);
  const [inventoryOpen, setInventoryOpen] = useState(true);
  const [totalStockOpen, setTotalStockOpen] = useState(true);
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

    // Auto-expand sections based on current path
    if (pathname.includes('/fabric-store/my-work')) setMyWorkOpen(true);
    if (pathname.includes('/fabric-store/inventory/inward') || pathname.includes('/fabric-store/inventory/outward')) setInventoryOpen(true);
    if (pathname.includes('/fabric-store/inventory/total-stock')) setTotalStockOpen(true);
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
        ? 'bg-[#1E293B] text-white border-l-2 border-teal-400 pl-2.5 shadow-xs'
        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
    }`;
  };

  const subLinkClass = (href: string, exact = false) => {
    const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');
    return `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[11px] font-medium transition ${
      active
        ? 'bg-[#1E293B] text-white border-l-2 border-teal-400 pl-2 shadow-xs'
        : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
    }`;
  };

  const sectionHeader = (label: string, isOpen: boolean, toggle: () => void, isAnyActive: boolean) => (
    <div
      onClick={toggle}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition ${
        isAnyActive ? 'text-white' : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
      }`}
    >
      <span>{label}</span>
      {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
    </div>
  );

  const myWorkActive = pathname.includes('/fabric-store/my-work');
  const inventoryActive = pathname.includes('/fabric-store/inventory/inward') || pathname.includes('/fabric-store/inventory/outward');
  const totalStockActive = pathname.includes('/fabric-store/inventory/total-stock');

  return (
    <>
      {/* MOBILE TOP BAR (visible on screens < md) */}
      <div className="md:hidden sticky top-0 z-40 bg-[#0F172A] border-b border-slate-800 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
            aria-label="Open Fabric Store Menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white p-0.5 border border-teal-500/40 flex items-center justify-center shrink-0">
              <img
                src="/shubham-logo.jpg"
                alt="Shubham Fabrics"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <span className="text-xs font-bold text-white tracking-wide block leading-none">SHUBHAM FABRICS</span>
              <span className="text-[9px] font-bold text-teal-400 tracking-wider uppercase block">FABRIC STORE</span>
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

      {/* SIDEBAR ASIDE (responsive drawer on mobile, fixed w-64 on md+) */}
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
              currentDepartmentName="Store Department"
              accentColor="teal"
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>

        {/* NAV */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto pt-1">

          {/* 1. Dashboard */}
          <Link
            href="/fabric-store"
            onClick={() => setMobileOpen(false)}
            className={linkClass('/fabric-store', true)}
          >
            <LayoutDashboard className="w-4 h-4 text-slate-400" />
            <span>Dashboard</span>
          </Link>

          {/* 2. My Work */}
          <div>
            <div className="flex items-center gap-3 px-3 py-2">
              <Briefcase className="w-4 h-4 text-slate-400" />
              <div className="flex-1">
                {sectionHeader('My Work', myWorkOpen, () => setMyWorkOpen(!myWorkOpen), myWorkActive)}
              </div>
            </div>
            {myWorkOpen && (
              <div className="ml-7 pl-3 border-l border-slate-700/80 space-y-0.5 my-0.5">
                <Link
                  href="/fabric-store/my-work/incoming-challans"
                  onClick={() => setMobileOpen(false)}
                  className={subLinkClass('/fabric-store/my-work/incoming-challans')}
                >
                  <PackageCheck className="w-3.5 h-3.5 text-teal-400" />
                  <span>Incoming Challans</span>
                </Link>
                <Link
                  href="/fabric-store/my-work/challan-to-dyeing"
                  onClick={() => setMobileOpen(false)}
                  className={subLinkClass('/fabric-store/my-work/challan-to-dyeing')}
                >
                  <Send className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Store to Dyeing (Challan)</span>
                </Link>
                <Link
                  href="/fabric-store/my-work/challan-to-embroidery"
                  onClick={() => setMobileOpen(false)}
                  className={subLinkClass('/fabric-store/my-work/challan-to-embroidery')}
                >
                  <Send className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Store to Embroidery (Challan)</span>
                </Link>
              </div>
            )}
          </div>

          {/* 3. Floor Board */}
          <Link
            href="/fabric-store/floor-board"
            onClick={() => setMobileOpen(false)}
            className={linkClass('/fabric-store/floor-board', true)}
          >
            <Kanban className="w-4 h-4 text-slate-400" />
            <span>Floor Board</span>
          </Link>

          {/* 4. Inventory (Inward Stock & Outward Stock) */}
          <div>
            <div className="flex items-center gap-3 px-3 py-2">
              <Boxes className="w-4 h-4 text-slate-400" />
              <div className="flex-1">
                {sectionHeader('Inventory', inventoryOpen, () => setInventoryOpen(!inventoryOpen), inventoryActive)}
              </div>
            </div>
            {inventoryOpen && (
              <div className="ml-7 pl-3 border-l border-slate-700/80 space-y-0.5 my-0.5">
                <Link
                  href="/fabric-store/inventory/inward"
                  onClick={() => setMobileOpen(false)}
                  className={subLinkClass('/fabric-store/inventory/inward')}
                >
                  <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Inward Stock</span>
                </Link>
                <Link
                  href="/fabric-store/inventory/outward"
                  onClick={() => setMobileOpen(false)}
                  className={subLinkClass('/fabric-store/inventory/outward')}
                >
                  <Send className="w-3.5 h-3.5 text-amber-400" />
                  <span>Outward Stock</span>
                </Link>
              </div>
            )}
          </div>

          {/* 5. Defective Shelf */}
          <Link
            href="/fabric-store/inventory/defected-shelf"
            onClick={() => setMobileOpen(false)}
            className={linkClass('/fabric-store/inventory/defected-shelf')}
          >
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>Defective Shelf</span>
          </Link>

          {/* 6. Total Stock (UNDYED & DYED) */}
          <div>
            <div className="flex items-center gap-3 px-3 py-2">
              <Layers className="w-4 h-4 text-teal-400" />
              <div className="flex-1">
                {sectionHeader('Total Stock', totalStockOpen, () => setTotalStockOpen(!totalStockOpen), totalStockActive)}
              </div>
            </div>
            {totalStockOpen && (
              <div className="ml-7 pl-3 border-l border-slate-700/80 space-y-0.5 my-0.5">
                <Link
                  href="/fabric-store/inventory/total-stock"
                  onClick={() => setMobileOpen(false)}
                  className={subLinkClass('/fabric-store/inventory/total-stock', true)}
                >
                  <Boxes className="w-3.5 h-3.5 text-teal-300" />
                  <span>All Stock Balance</span>
                </Link>
                <Link
                  href="/fabric-store/inventory/total-stock?type=UNDYED"
                  onClick={() => setMobileOpen(false)}
                  className={subLinkClass('/fabric-store/inventory/total-stock?type=UNDYED')}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block mr-1" />
                  <span>1. UNDYED</span>
                </Link>
                <Link
                  href="/fabric-store/inventory/total-stock?type=DYED"
                  onClick={() => setMobileOpen(false)}
                  className={subLinkClass('/fabric-store/inventory/total-stock?type=DYED')}
                >
                  <span className="w-2 h-2 rounded-full bg-purple-400 inline-block mr-1" />
                  <span>2. DYED</span>
                </Link>
              </div>
            )}
          </div>

        </nav>

        {/* USER & SIGN OUT */}
        <div className="p-4 border-t border-slate-700/60 bg-slate-950/50 backdrop-blur-md">
          <div className="flex items-center gap-3 mb-3">
            <UserCircle className="w-8 h-8 text-teal-400/90" />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-white truncate block drop-shadow-xs">
                {currentUser.fullName || (isAdmin ? 'System Administrator' : 'Store Incharge')}
              </span>
              <span className="text-[10px] text-teal-400 font-bold tracking-wide block truncate drop-shadow-xs">
                Store Department
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
