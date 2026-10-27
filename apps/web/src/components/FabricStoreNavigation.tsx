'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChevronDown,
  ChevronRight,
  LogOut,
  UserCircle,
  Menu,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { isAdminUser } from '@/lib/rbac';
import { DepartmentSwitcher } from '@/components/DepartmentSwitcher';
import { SidebarDepartmentArt } from '@/components/SidebarDepartmentArt';

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
    if (pathname.includes('/fabric-store/inventory/inward')) setInventoryOpen(true);
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
        ? 'bg-brand-50 text-brand-800 border-l-2 border-brand-500 pl-2.5'
        : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
    }`;
  };

  const subLinkClass = (href: string, exact = false) => {
    const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');
    return `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[11px] font-medium transition ${
      active
        ? 'bg-brand-50 text-brand-800 border-l-2 border-brand-500 pl-2'
        : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
    }`;
  };

  const sectionHeader = (label: string, isOpen: boolean, toggle: () => void, isAnyActive: boolean) => (
    <div
      onClick={toggle}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition ${
        isAnyActive ? 'text-neutral-900' : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
      }`}
    >
      <span>{label}</span>
      {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-neutral-500" /> : <ChevronRight className="w-3.5 h-3.5 text-neutral-500" />}
    </div>
  );

  const myWorkActive = pathname.includes('/fabric-store/my-work');
  const inventoryActive = pathname.includes('/fabric-store/inventory/inward');
  const totalStockActive = pathname.includes('/fabric-store/inventory/total-stock');

  return (
    <>
      {/* MOBILE TOP BAR (visible on screens < md) */}
      <div className="md:hidden sticky top-0 z-40 bg-white border-b border-neutral-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 transition"
            aria-label="Open Fabric Store Menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white p-0.5 border border-neutral-200 flex items-center justify-center shrink-0">
              <img
                src="/shubham-logo.jpg"
                alt="Shubham Fabrics"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <span className="text-xs font-bold text-neutral-900 tracking-wide block leading-none">SHUBHAM FABRICS</span>
              <span className="text-[9px] font-bold text-brand-700 tracking-wider uppercase block">FABRIC STORE</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="p-1.5 rounded-lg text-neutral-500 hover:text-danger-600 hover:bg-neutral-100 transition"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* BACKDROP OVERLAY FOR MOBILE */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 bg-neutral-900/60 z-50 transition-opacity"
        />
      )}

      {/* SIDEBAR ASIDE (responsive drawer on mobile, fixed w-64 on md+) */}
      <aside
        className={`bg-white fixed inset-y-0 left-0 z-50 w-72 md:w-64 text-neutral-900 flex flex-col border-r border-neutral-200 select-none transform transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* SIDEBAR TEXTILE BACKGROUND (one image for all departments, Admin > Sidebar Image) */}
        <SidebarDepartmentArt />

        {/* BRANDING WITH OFFICIAL IMG 3 LOGO */}
        <div className="p-4 border-b border-neutral-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white p-0.5 border border-neutral-200 flex items-center justify-center shadow-sm overflow-hidden shrink-0">
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

          {/* Close button on mobile */}
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
            <span>Dashboard</span>
          </Link>

          {/* 2. My Work */}
          <div>
            <div>
              <div className="flex-1">
                {sectionHeader('My Work', myWorkOpen, () => setMyWorkOpen(!myWorkOpen), myWorkActive)}
              </div>
            </div>
            {myWorkOpen && (
              <div className="ml-7 pl-3 border-l border-neutral-200 space-y-0.5 my-0.5">
                <Link
                  href="/fabric-store/my-work/incoming-challans"
                  onClick={() => setMobileOpen(false)}
                  className={subLinkClass('/fabric-store/my-work/incoming-challans')}
                >
                  <span>Incoming Challans</span>
                </Link>
                <Link
                  href="/fabric-store/my-work/challan-to-dyeing"
                  onClick={() => setMobileOpen(false)}
                  className={subLinkClass('/fabric-store/my-work/challan-to-dyeing')}
                >
                  <span>Store to Dyeing (Challan)</span>
                </Link>
                <Link
                  href="/fabric-store/my-work/challan-to-embroidery"
                  onClick={() => setMobileOpen(false)}
                  className={subLinkClass('/fabric-store/my-work/challan-to-embroidery')}
                >
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
            <span>Floor Board</span>
          </Link>

          {/* 4. Inventory (Inward Stock) */}
          <div>
            <div>
              <div className="flex-1">
                {sectionHeader('Inventory', inventoryOpen, () => setInventoryOpen(!inventoryOpen), inventoryActive)}
              </div>
            </div>
            {inventoryOpen && (
              <div className="ml-7 pl-3 border-l border-neutral-200 space-y-0.5 my-0.5">
                <Link
                  href="/fabric-store/inventory/inward"
                  onClick={() => setMobileOpen(false)}
                  className={subLinkClass('/fabric-store/inventory/inward')}
                >
                  <span>Inward Stock</span>
                </Link>
              </div>
            )}
          </div>

          {/* 5. Outward Stock (top level, outside Inventory) */}
          <Link
            href="/fabric-store/inventory/outward"
            onClick={() => setMobileOpen(false)}
            className={linkClass('/fabric-store/inventory/outward')}
          >
            <span>Outward Stock</span>
          </Link>

          {/* 6. Defective Shelf */}
          <Link
            href="/fabric-store/inventory/defected-shelf"
            onClick={() => setMobileOpen(false)}
            className={linkClass('/fabric-store/inventory/defected-shelf')}
          >
            <span>Defective Shelf</span>
          </Link>

          {/* 7. Total Stock (UNDYED & DYED) */}
          <div>
            <div>
              <div className="flex-1">
                {sectionHeader('Total Stock', totalStockOpen, () => setTotalStockOpen(!totalStockOpen), totalStockActive)}
              </div>
            </div>
            {totalStockOpen && (
              <div className="ml-7 pl-3 border-l border-neutral-200 space-y-0.5 my-0.5">
                <Link
                  href="/fabric-store/inventory/total-stock"
                  onClick={() => setMobileOpen(false)}
                  className={subLinkClass('/fabric-store/inventory/total-stock', true)}
                >
                  <span>All Stock Balance</span>
                </Link>
                <Link
                  href="/fabric-store/inventory/total-stock?type=UNDYED"
                  onClick={() => setMobileOpen(false)}
                  className={subLinkClass('/fabric-store/inventory/total-stock?type=UNDYED')}
                >
                  <span className="w-2 h-2 rounded-full bg-accent-400 inline-block mr-1" />
                  <span>1. UNDYED</span>
                </Link>
                <Link
                  href="/fabric-store/inventory/total-stock?type=DYED"
                  onClick={() => setMobileOpen(false)}
                  className={subLinkClass('/fabric-store/inventory/total-stock?type=DYED')}
                >
                  <span className="w-2 h-2 rounded-full bg-brand-500 inline-block mr-1" />
                  <span>2. DYED</span>
                </Link>
              </div>
            )}
          </div>

        </nav>

        {/* USER & SIGN OUT */}
        <div className="p-4 border-t border-neutral-200 bg-white/75 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-3">
            <UserCircle className="w-8 h-8 text-brand-700" />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-neutral-900 truncate block drop-shadow-xs">
                {currentUser.fullName || (isAdmin ? 'System Administrator' : 'Store Incharge')}
              </span>
              <span className="text-[10px] text-brand-700 font-bold tracking-wide block truncate drop-shadow-xs">
                Store Department
              </span>
            </div>
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
