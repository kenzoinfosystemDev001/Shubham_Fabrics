'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LogOut,
  Menu,
  UserCircle,
  X
} from 'lucide-react';
import { api } from '@/lib/api';
import { isAdminUser } from '@/lib/rbac';
import { DepartmentSwitcher } from '@/components/DepartmentSwitcher';
import { SidebarDepartmentArt } from '@/components/SidebarDepartmentArt';
import { InstallAppButton } from '@/components/InstallAppButton';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/final-check', exact: true },
  { label: 'Incoming Challans', href: '/final-check/my-work/incoming' },
  { label: 'Received Garments', href: '/final-check/my-work/received' },
  { label: 'Final Inspection', href: '/final-check/my-work/inspection' },
  { label: 'Passed Items', href: '/final-check/my-work/passed' },
  { label: 'Rejected Items', href: '/final-check/my-work/rejected' },
  { label: 'Rework Items', href: '/final-check/my-work/rework' },
  { label: 'Ready for Inventory', href: '/final-check/my-work/issue-challan' },
  { label: 'Outgoing Challans', href: '/final-check/my-work/outgoing' },
  { label: 'Inspection History', href: '/final-check/history' },
  { label: 'Defective Shelf', href: '/final-check/my-work/defective' },
  { label: 'HOLD', href: '/final-check/hold' },
  { label: 'Floor Board', href: '/final-check/floor-board' },
];

export function FinalCheckNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>({
    fullName: 'Final QC Inspector',
    username: 'finalcheck',
    role: 'FINAL_CHECK_INSPECTOR',
    departmentCode: 'FINAL_CHECK',
  });

  useEffect(() => {
    const savedUser = localStorage.getItem('subham_mes_user');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch {
        // Keep the department identity shown while the profile is refreshed.
      }
    }

    const syncUser = async () => {
      if (!api.hasSession()) return;
      try {
        const profile = await api.getProfile();
        if (profile) {
          setCurrentUser(profile);
          localStorage.setItem('subham_mes_user', JSON.stringify(profile));
        }
      } catch {
        // The authenticated session and dashboard remain usable if profile refresh is unavailable.
      }
    };

    void syncUser();
    setMobileOpen(false);
  }, [pathname]);

  const handleSignOut = () => {
    api.clearToken();
    localStorage.removeItem('subham_mes_token');
    localStorage.removeItem('subham_mes_user');
    document.cookie = 'subham_mes_token=; path=/; max-age=0';
    document.cookie = 'subham_mes_role=; path=/; max-age=0';
    document.cookie = 'subham_mes_dept=; path=/; max-age=0';
    router.replace('/login');
  };

  const isAdmin = isAdminUser(currentUser);
  const linkClass = (href: string, exact = false) => {
    const active = exact
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

    return `flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold transition ${
      active
        ? 'border-l-2 border-brand-500 bg-brand-50 pl-2.5 text-brand-800'
        : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
    }`;
  };

  return (
    <>
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 shadow-sm md:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-1.5 text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-900"
            aria-label="Open Final QC navigation"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg border border-neutral-200 bg-white p-0.5">
              <img src="/shubham-logo.jpg" alt="Shubham Fabrics" className="h-full w-full object-contain" />
            </div>
            <div>
              <span className="block text-xs font-bold leading-none tracking-wide text-neutral-900">SHUBHAM FABRICS</span>
              <span className="block text-[9px] font-bold uppercase tracking-wider text-brand-700">Final QC</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <InstallAppButton variant="nav" />
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-danger-600"
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-neutral-900/60 md:hidden"
          aria-label="Close Final QC navigation"
        />
      )}

      <aside
        className={`bg-white fixed inset-y-0 left-0 z-50 flex w-72 select-none flex-col border-r border-neutral-200 text-neutral-900 transition-transform duration-300 md:w-64 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* SIDEBAR TEXTILE BACKGROUND (one image for all departments, Admin > Sidebar Image) */}
        <SidebarDepartmentArt />

        <div className="flex items-center justify-between border-b border-neutral-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-white p-0.5">
              <img src="/shubham-logo.jpg" alt="Shubham Fabrics" className="h-full w-full object-contain" />
            </div>
            <div>
              <span className="block truncate text-xs font-bold tracking-[0.14em] text-neutral-900">SHUBHAM FABRICS</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 md:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative border-b border-neutral-200 bg-white px-3 pb-2.5 pt-3 [&:not(:has(button))]:hidden">
          <DepartmentSwitcher
            currentDepartmentName="Final QC Department"
            accentColor="emerald"
            onNavigate={() => setMobileOpen(false)}
          />
        </div>

        <nav aria-label="Final QC navigation" className="flex-1 space-y-1 overflow-y-auto px-3 pt-2">
          {NAV_ITEMS.map(({ label, href, exact }) => (
            <Link
              key={label}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={linkClass(href, exact)}
            >
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <div className="border-t border-neutral-200 bg-white/75 backdrop-blur-sm p-4">
          <div className="mb-3 flex items-center gap-3">
            <UserCircle className="h-8 w-8 shrink-0 text-brand-700" />
            <div className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-neutral-900">
                {(currentUser.fullName && currentUser.fullName.trim().toLowerCase() !== 'final qc department' ? currentUser.fullName : '') || (isAdmin ? 'System Administrator' : 'Final QC Inspector')}
              </span>
              <span className="block truncate text-[10px] font-bold tracking-wide text-brand-700">
                Final QC Department
              </span>
            </div>
          </div>
          <div className="mb-3">
            <InstallAppButton variant="nav" className="w-full justify-center" />
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900 shadow-xs transition hover:border-danger-500/60 hover:bg-danger-50 hover:text-danger-800"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
