'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, Building2, Check, ExternalLink, ShieldCheck } from 'lucide-react';
import { isAdminUser, getCurrentUser } from '@/lib/rbac';
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';

export interface DepartmentSwitcherProps {
  currentDepartmentName: string;
  accentColor?: 'amber' | 'teal' | 'purple' | 'emerald' | 'fuchsia' | 'indigo' | 'cyan' | 'rose';
  onNavigate?: () => void;
}

const DEPARTMENTS = [
  {
    name: 'Programming Department',
    code: 'PROGRAMMING',
    href: '/programming',
    color: 'amber',
    badge: 'PRG',
    dotClass: 'bg-brand-500',
    hoverClass: 'hover:text-neutral-900',
    activeBg: 'bg-brand-50 text-brand-800 font-bold',
  },
  {
    name: 'Store Department',
    code: 'STORE',
    href: '/fabric-store',
    color: 'teal',
    badge: 'STR',
    dotClass: 'bg-brand-500',
    hoverClass: 'hover:text-neutral-900',
    activeBg: 'bg-brand-50 text-brand-800 font-bold',
  },
  {
    name: 'Dyeing Department',
    code: 'DYEING',
    href: '/dyeing',
    color: 'purple',
    badge: 'DYE',
    dotClass: 'bg-brand-500',
    hoverClass: 'hover:text-neutral-900',
    activeBg: 'bg-brand-50 text-brand-800 font-bold',
  },
  {
    name: 'Dyeing QC',
    code: 'QC1',
    href: '/qc1',
    color: 'emerald',
    badge: 'QC1',
    dotClass: 'bg-brand-500',
    hoverClass: 'hover:text-neutral-900',
    activeBg: 'bg-brand-50 text-brand-800 font-bold',
  },
  {
    name: 'Embroidery Department',
    code: 'EMBROIDERY',
    href: '/embroidery',
    color: 'fuchsia',
    badge: 'EMB',
    dotClass: 'bg-brand-500',
    hoverClass: 'hover:text-neutral-900',
    activeBg: 'bg-brand-50 text-brand-800 font-bold',
  },
  {
    name: 'Thread Cutting Department',
    code: 'THREAD_CUTTING',
    href: '/thread-cutting',
    color: 'cyan',
    badge: 'THC',
    dotClass: 'bg-brand-500',
    hoverClass: 'hover:text-neutral-900',
    activeBg: 'bg-brand-50 text-brand-800 font-bold',
  },
  {
    name: 'QC2 Department',
    code: 'QC2',
    href: '/qc2',
    color: 'emerald',
    badge: 'QC2',
    dotClass: 'bg-brand-500',
    hoverClass: 'hover:text-neutral-900',
    activeBg: 'bg-brand-50 text-brand-800 font-bold',
  },
  {
    name: 'Washing Department',
    code: 'WASHING',
    href: '/washing',
    color: 'teal',
    badge: 'WSH',
    dotClass: 'bg-brand-500',
    hoverClass: 'hover:text-neutral-900',
    activeBg: 'bg-brand-50 text-brand-800 font-bold',
  },
  {
    name: 'QC Washing',
    code: 'QC3',
    href: '/qcwashing',
    color: 'emerald',
    badge: 'QCW',
    dotClass: 'bg-brand-500',
    hoverClass: 'hover:text-neutral-900',
    activeBg: 'bg-brand-50 text-brand-800 font-bold',
  },
  {
    name: 'Recutting Department',
    code: 'RECUTTING',
    href: '/recutting',
    color: 'emerald',
    badge: 'REC',
    dotClass: 'bg-brand-500',
    hoverClass: 'hover:text-neutral-900',
    activeBg: 'bg-brand-50 text-brand-800 font-bold',
  },
  {
    name: 'Stitching & Assembly',
    code: 'STITCHING',
    href: '/stitching',
    color: 'indigo',
    badge: 'STC',
    dotClass: 'bg-brand-500',
    hoverClass: 'hover:text-neutral-900',
    activeBg: 'bg-brand-50 text-brand-800 font-bold',
  },
  {
    name: 'Finishing Department',
    code: 'FINISHING',
    href: '/finishing',
    color: 'teal',
    badge: 'FIN',
    dotClass: 'bg-brand-500',
    hoverClass: 'hover:text-neutral-900',
    activeBg: 'bg-brand-50 text-brand-800 font-bold',
  },
  {
    name: 'Steam Press Department',
    code: 'STEAM_PRESS',
    href: '/steam-press',
    color: 'cyan',
    badge: 'STP',
    dotClass: 'bg-brand-500',
    hoverClass: 'hover:text-neutral-900',
    activeBg: 'bg-brand-50 text-brand-800 font-bold',
  },
  {
    name: 'Final QC Department',
    code: 'FINAL_CHECK',
    href: '/final-check',
    color: 'emerald',
    badge: 'FQC',
    dotClass: 'bg-brand-500',
    hoverClass: 'hover:text-neutral-900',
    activeBg: 'bg-brand-50 text-brand-800 font-bold',
  },
  {
    name: 'Packing & Inventory',
    code: 'PACKING',
    href: '/packing',
    color: 'amber',
    badge: 'PCK',
    dotClass: 'bg-brand-500',
    hoverClass: 'hover:text-neutral-900',
    activeBg: 'bg-brand-50 text-brand-800 font-bold',
  },
];

export function DepartmentSwitcher({
  currentDepartmentName,
  accentColor = 'amber',
  onNavigate,
}: DepartmentSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [bgImage, setBgImage] = useState<string>(DEPARTMENT_NAV_BG_IMAGE);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('subham_mes_user');
      if (saved) {
        try {
          setCurrentUser(JSON.parse(saved));
        } catch {}
      }
    }

    // Load real background image from database API
    fetch('/api/department-nav/background')
      .then((res) => res.json())
      .then((json) => {
        if (json.data?.fileUrl) {
          setBgImage(json.data.fileUrl);
        }
      })
      .catch(() => {});

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeUser = currentUser || (typeof window !== 'undefined' ? getCurrentUser() : null);
  const isAdmin = isAdminUser(activeUser);

  const getAccentText = () => {
    // One brand color for every department; accentColor is kept for API compatibility.
    return 'text-brand-700';
  };

  // If user is NOT an Admin: Department incharge can ONLY see their assigned department.
  // No other departments can be seen or opened.
  if (!isAdmin) {
    return (
      <div className="relative w-full">
        <div
          className="bg-white w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-neutral-200 text-left relative overflow-hidden select-none"
        >
          <div className="min-w-0 flex-1 pr-2 relative z-10">
            <span className="text-[9px] font-bold text-neutral-900 uppercase tracking-widest block leading-tight">
              Active Station
            </span>
            <span className={`text-[11px] font-bold uppercase tracking-wider truncate block leading-snug mt-0.5 ${getAccentText()}`}>
              {currentDepartmentName}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white border border-neutral-200 text-[9px] font-bold text-neutral-700 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-400" />
            <span className="tracking-wide">ASSIGNED</span>
          </div>
        </div>
      </div>
    );
  }

  // Admin user: Can see and switch between all departments
  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="bg-white w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-neutral-200 text-left transition group hover:border-neutral-300 relative overflow-hidden"
        aria-expanded={open}
        aria-haspopup="true"
        title="Switch Department Workspace (Administrator Access)"
      >
        <div className="min-w-0 flex-1 pr-2 relative z-10">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-bold text-neutral-900 uppercase tracking-widest block leading-tight">
              Active Station
            </span>
            <span className="text-[8px] font-bold uppercase tracking-widest px-1 py-0.2 rounded bg-brand-50 text-brand-700 border border-neutral-200">
              Admin
            </span>
          </div>
          <span className={`text-[11px] font-bold uppercase tracking-wider truncate block leading-snug mt-0.5 ${getAccentText()}`}>
            {currentDepartmentName}
          </span>
        </div>
        <div className="w-5 h-5 rounded-lg flex items-center justify-center bg-white group-hover:bg-neutral-100 text-neutral-900 transition shrink-0 relative z-10 border border-neutral-200 shadow-xs">
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div
          className="bg-white absolute left-0 right-0 top-full mt-1.5 border border-neutral-200 rounded-xl py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 overflow-hidden"
        >
          <div className="px-3 py-1.5 flex items-center justify-between border-b border-neutral-200">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-brand-700" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-700">
                MES Departments
              </span>
            </div>
            <span className="text-[9px] text-brand-700 font-mono font-semibold">ALL ACCESS</span>
          </div>

          <div className="p-1 space-y-0.5 max-h-[300px] overflow-y-auto">
            {DEPARTMENTS.map((dept) => {
              const isCurrent = currentDepartmentName.toLowerCase() === dept.name.toLowerCase();
              return (
                <button
                  type="button"
                  key={dept.code}
                  onClick={() => {
                    setOpen(false);
                    if (onNavigate) onNavigate();
                    if (typeof window !== 'undefined') {
                      sessionStorage.setItem('active_department', dept.code);
                      sessionStorage.setItem('active_department_root', dept.href);
                    }
                    router.replace(dept.href);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition cursor-pointer text-left ${
                    isCurrent ? dept.activeBg : `text-neutral-700 ${dept.hoverClass} hover:bg-neutral-100`
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${dept.dotClass}`} />
                    <span className="truncate">{dept.name}</span>
                  </div>
                  {isCurrent ? (
                    <Check className="w-3.5 h-3.5 shrink-0 text-neutral-900" />
                  ) : (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-neutral-50 text-neutral-500 shrink-0">
                      {dept.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="pt-1 mt-1 border-t border-neutral-200 px-1">
            <Link
              href="/admin"
              onClick={() => {
                setOpen(false);
                if (onNavigate) onNavigate();
              }}
              className="flex items-center justify-between px-2.5 py-2 rounded-lg text-xs text-brand-700 hover:bg-brand-50 hover:text-brand-800 transition font-medium"
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                <span>Admin Console</span>
              </div>
              <ExternalLink className="w-3 h-3 text-neutral-500" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
