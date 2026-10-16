'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, Building2, Check, ExternalLink, ShieldCheck } from 'lucide-react';
import { isAdminUser, getCurrentUser } from '@/lib/rbac';
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';

export interface DepartmentSwitcherProps {
  currentDepartmentName: string;
  accentColor?: 'amber' | 'teal' | 'purple' | 'emerald' | 'fuchsia' | 'indigo' | 'cyan';
  onNavigate?: () => void;
}

const DEPARTMENTS = [
  {
    name: 'Programming Department',
    code: 'PROGRAMMING',
    href: '/programming',
    color: 'amber',
    badge: 'PRG',
    dotClass: 'bg-amber-400',
    hoverClass: 'hover:bg-amber-500/10 hover:text-amber-300',
    activeBg: 'bg-amber-500/15 text-amber-300 font-bold',
  },
  {
    name: 'Store Department',
    code: 'STORE',
    href: '/fabric-store',
    color: 'teal',
    badge: 'STR',
    dotClass: 'bg-teal-400',
    hoverClass: 'hover:bg-teal-500/10 hover:text-teal-300',
    activeBg: 'bg-teal-500/15 text-teal-300 font-bold',
  },
  {
    name: 'Dyeing Department',
    code: 'DYEING',
    href: '/dyeing',
    color: 'purple',
    badge: 'DYE',
    dotClass: 'bg-purple-400',
    hoverClass: 'hover:bg-purple-500/10 hover:text-purple-300',
    activeBg: 'bg-purple-500/15 text-purple-300 font-bold',
  },
  {
    name: 'QC1 Department',
    code: 'QC1',
    href: '/qc1',
    color: 'emerald',
    badge: 'QC1',
    dotClass: 'bg-emerald-400',
    hoverClass: 'hover:bg-emerald-500/10 hover:text-emerald-300',
    activeBg: 'bg-emerald-500/15 text-emerald-300 font-bold',
  },
  {
    name: 'Embroidery Department',
    code: 'EMBROIDERY',
    href: '/embroidery',
    color: 'fuchsia',
    badge: 'EMB',
    dotClass: 'bg-fuchsia-400',
    hoverClass: 'hover:bg-fuchsia-500/10 hover:text-fuchsia-300',
    activeBg: 'bg-fuchsia-500/15 text-fuchsia-300 font-bold',
  },
  {
    name: 'Thread Cutting Department',
    code: 'THREAD_CUTTING',
    href: '/thread-cutting',
    color: 'cyan',
    badge: 'THC',
    dotClass: 'bg-cyan-400',
    hoverClass: 'hover:bg-cyan-500/10 hover:text-cyan-300',
    activeBg: 'bg-cyan-500/15 text-cyan-300 font-bold',
  },
  {
    name: 'QC2 Department',
    code: 'QC2',
    href: '/qc2',
    color: 'emerald',
    badge: 'QC2',
    dotClass: 'bg-emerald-400',
    hoverClass: 'hover:bg-emerald-500/10 hover:text-emerald-300',
    activeBg: 'bg-emerald-500/15 text-emerald-300 font-bold',
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
    switch (accentColor) {
      case 'teal':
        return 'text-teal-400';
      case 'purple':
        return 'text-purple-400';
      case 'emerald':
        return 'text-emerald-400';
      case 'fuchsia':
        return 'text-fuchsia-400';
      case 'indigo':
        return 'text-indigo-400';
      case 'cyan':
        return 'text-cyan-400';
      case 'amber':
      default:
        return 'text-amber-400';
    }
  };

  // If user is NOT an Admin: Department incharge can ONLY see their assigned department.
  // No other departments can be seen or opened.
  if (!isAdmin) {
    return (
      <div className="relative w-full">
        <div
          style={{
            backgroundImage: `linear-gradient(to right, rgba(15, 23, 42, 0.40), rgba(15, 23, 42, 0.45)), url('${bgImage}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-slate-600/70 text-left shadow-lg relative overflow-hidden backdrop-blur-xs select-none"
        >
          <div className="min-w-0 flex-1 pr-2 relative z-10">
            <span className="text-[9px] font-bold text-slate-200 uppercase tracking-widest block leading-tight drop-shadow-sm">
              Active Station
            </span>
            <span className={`text-[11px] font-bold uppercase tracking-wider truncate block leading-snug mt-0.5 drop-shadow-sm ${getAccentText()}`}>
              {currentDepartmentName}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-900/80 border border-slate-700/60 text-[9px] font-bold text-slate-300 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
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
        style={{
          backgroundImage: `linear-gradient(to right, rgba(15, 23, 42, 0.40), rgba(15, 23, 42, 0.45)), url('${bgImage}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-slate-600/70 text-left transition group shadow-lg hover:border-slate-500 relative overflow-hidden backdrop-blur-xs"
        aria-expanded={open}
        aria-haspopup="true"
        title="Switch Department Workspace (Administrator Access)"
      >
        <div className="min-w-0 flex-1 pr-2 relative z-10">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-bold text-slate-200 uppercase tracking-widest block leading-tight drop-shadow-sm">
              Active Station
            </span>
            <span className="text-[8px] font-bold uppercase tracking-widest px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
              Admin
            </span>
          </div>
          <span className={`text-[11px] font-bold uppercase tracking-wider truncate block leading-snug mt-0.5 drop-shadow-sm ${getAccentText()}`}>
            {currentDepartmentName}
          </span>
        </div>
        <div className="w-5 h-5 rounded-lg flex items-center justify-center bg-slate-900/70 group-hover:bg-slate-800 text-slate-200 transition shrink-0 relative z-10 border border-slate-600/60 shadow-xs">
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div
          style={{
            backgroundImage: `linear-gradient(to bottom, rgba(15, 23, 42, 0.70), rgba(15, 23, 42, 0.85)), url('${bgImage}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
          className="absolute left-0 right-0 top-full mt-1.5 border border-slate-600/90 rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 backdrop-blur-md overflow-hidden"
        >
          <div className="px-3 py-1.5 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-amber-400" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-300">
                MES Departments
              </span>
            </div>
            <span className="text-[9px] text-amber-400/90 font-mono font-semibold">ALL ACCESS</span>
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
                    isCurrent ? dept.activeBg : `text-slate-300 ${dept.hoverClass} hover:bg-slate-800/70`
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${dept.dotClass}`} />
                    <span className="truncate">{dept.name}</span>
                  </div>
                  {isCurrent ? (
                    <Check className="w-3.5 h-3.5 shrink-0 text-white" />
                  ) : (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 shrink-0">
                      {dept.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="pt-1 mt-1 border-t border-slate-800 px-1">
            <Link
              href="/admin"
              onClick={() => {
                setOpen(false);
                if (onNavigate) onNavigate();
              }}
              className="flex items-center justify-between px-2.5 py-2 rounded-lg text-xs text-indigo-300 hover:bg-indigo-950/40 hover:text-indigo-200 transition font-medium"
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Admin Console</span>
              </div>
              <ExternalLink className="w-3 h-3 text-slate-500" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
