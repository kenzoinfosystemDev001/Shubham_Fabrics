'use client';

import React, { useEffect, useState } from 'react';
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
 * Admin Console sidebar department section: every MES department in floor order, searchable, opening the
 * department's real workspace. Built from MES_DEPARTMENTS so a new department appears here too.
 */
export function AdminDepartmentMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState('');
  // The department the admin last opened, highlighted in the list.
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('active_department');
    setSelected(stored === 'FABRIC_STORE' ? 'STORE' : stored);
  }, []);

  const departments = MES_DEPARTMENTS.filter((d) => DEPARTMENT_HOME[d.code]);
  const q = query.trim().toLowerCase();
  const shown = q
    ? departments.filter((d) => [d.name, d.shortName, d.code].some((text) => text.toLowerCase().includes(q)))
    : departments;

  const openDepartment = (code: string) => {
    const href = DEPARTMENT_HOME[code];
    setSelected(code);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('active_department', code === 'STORE' ? 'FABRIC_STORE' : code);
      sessionStorage.setItem('active_department_root', href);
    }
    router.push(href);
  };

  return (
    <div className="bg-white rounded-xl ring-1 ring-neutral-200 p-1.5 lg:p-0 lg:pb-3 lg:bg-transparent lg:rounded-none lg:ring-0 lg:border-b lg:border-neutral-100">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 h-9 px-3 rounded-lg text-[13px] font-semibold text-neutral-800 hover:bg-neutral-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
        title="Open any department's workspace"
      >
        <Building2 className="w-4 h-4 shrink-0 text-brand-600" />
        <span>Departments</span>
        <span className="ml-auto text-[11px] leading-[18px] min-w-[22px] px-1.5 rounded-md tabular-nums text-center font-semibold bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
          {departments.length}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-1.5 space-y-1.5">
          <label className="relative block">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && shown[0]) openDepartment(shown[0].code);
                if (e.key === 'Escape') setQuery('');
              }}
              placeholder="Search departments"
              aria-label="Search departments"
              className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </label>
          <div className="max-h-56 overflow-y-auto flex flex-col gap-0.5">
            {shown.map((d, index) => {
              const active = selected === d.code;
              return (
                <button
                  type="button"
                  key={d.code}
                  onClick={() => openDepartment(d.code)}
                  aria-current={active ? 'page' : undefined}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors cursor-pointer ${
                    active
                      ? 'bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-100'
                      : 'text-neutral-700 hover:bg-brand-50 hover:text-brand-800'
                  }`}
                >
                  <span className="w-5 shrink-0 text-[10px] font-mono text-neutral-400 tabular-nums">
                    {MES_DEPARTMENTS.indexOf(d) + 1}
                  </span>
                  <span className="flex-1 truncate font-medium">{d.name}</span>
                  {index === 0 && q && <span className="text-[9px] text-neutral-400">Enter</span>}
                </button>
              );
            })}
            {shown.length === 0 && <p className="px-3 py-3 text-center text-xs text-neutral-500">No department matches.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
