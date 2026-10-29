'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, ChevronDown, Search } from 'lucide-react';
import { MES_DEPARTMENTS } from '@/lib/departments';

/** Each department's own workspace (the same pages its incharge uses). */
const DEPARTMENT_HOME: Record<string, string> = {
  PROGRAMMING: '/programming',
  STORE: '/fabric-store',
  DYEING: '/dyeing',
  QC1: '/qc1',
  EMBROIDERY: '/embroidery',
  THREAD_CUTTING: '/thread-cutting',
  QC2: '/qc2',
  WASHING: '/washing',
  QC3: '/qcwashing',
  RECUTTING: '/recutting',
  STITCHING: '/stitching',
  FINISHING: '/finishing',
  STEAM_PRESS: '/steam-press',
  FINAL_CHECK: '/final-check',
  INVENTORY: '/inventory',
};

/**
 * Admin Console department picker: every MES department in floor order, searchable, opening the
 * department's real workspace. Built from MES_DEPARTMENTS so a new department appears here too.
 */
export function AdminDepartmentMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    if (open) searchRef.current?.focus();
    else setQuery('');
  }, [open]);

  const departments = MES_DEPARTMENTS.filter((d) => DEPARTMENT_HOME[d.code]);
  const q = query.trim().toLowerCase();
  const shown = q
    ? departments.filter((d) => [d.name, d.shortName, d.code].some((text) => text.toLowerCase().includes(q)))
    : departments;

  const openDepartment = (code: string) => {
    const href = DEPARTMENT_HOME[code];
    setOpen(false);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('active_department', code === 'STORE' ? 'FABRIC_STORE' : code);
      sessionStorage.setItem('active_department_root', href);
    }
    router.push(href);
  };

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-500/10 text-brand-700 border border-brand-500/30 hover:bg-brand-500/20 transition"
        title="Open any department's workspace"
      >
        <Building2 className="w-3.5 h-3.5" />
        <span>Departments ({departments.length})</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-72 max-w-[calc(100vw-2rem)] bg-white border border-neutral-200 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="p-2 border-b border-neutral-200">
            <label className="relative block">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && shown[0]) openDepartment(shown[0].code);
                  if (e.key === 'Escape') setOpen(false);
                }}
                aria-label="Search departments"
                className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </label>
          </div>
          <div className="p-1 max-h-80 overflow-y-auto">
            {shown.map((d, index) => (
              <button
                type="button"
                key={d.code}
                onClick={() => openDepartment(d.code)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-left text-neutral-800 hover:bg-brand-50 hover:text-brand-800 transition cursor-pointer"
              >
                <span className="w-5 text-[10px] font-mono text-neutral-400 tabular-nums">
                  {MES_DEPARTMENTS.indexOf(d) + 1}
                </span>
                <span className="flex-1 truncate font-semibold">{d.name}</span>
                {index === 0 && q && <span className="text-[9px] text-neutral-400">Enter</span>}
              </button>
            ))}
            {shown.length === 0 && <p className="px-3 py-4 text-center text-xs text-neutral-500">No department matches.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
