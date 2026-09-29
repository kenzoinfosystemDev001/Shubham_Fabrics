'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function FutureModuleContent() {
  const searchParams = useSearchParams();
  const moduleName = searchParams.get('module') || 'Advanced Module';
  const targetPhase = searchParams.get('phase') || 'Phase 2';

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 text-center">
      <div className="w-16 h-16 bg-blue-900/40 border border-blue-500 text-blue-400 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6 shadow-lg">
        🏗️
      </div>

      <div className="inline-block px-3 py-1 rounded-full text-xs font-mono font-semibold bg-blue-950 text-blue-300 border border-blue-800 mb-4">
        ROADMAP SCHEDULED: {targetPhase.toUpperCase()}
      </div>

      <h1 className="text-2xl font-bold text-slate-100 mb-3">{moduleName}</h1>
      <p className="text-sm text-slate-400 leading-relaxed mb-8 max-w-xl mx-auto">
        This screen is scheduled for development in <strong className="text-slate-200">{targetPhase}</strong>.
        The underlying PostgreSQL schema, relational master tables, role-based access control, and mathematical audit records are already operational in Phase 1.
      </p>

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 text-left mb-8 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
          <span>⚡</span> Phase 1 Operational Foundation Ready:
        </h3>
        <ul className="text-xs text-slate-400 space-y-2 font-mono">
          <li className="flex items-center gap-2">
            <span className="text-emerald-400">✓</span> Relational Neon PostgreSQL database connected with strict integrity
          </li>
          <li className="flex items-center gap-2">
            <span className="text-emerald-400">✓</span> Master Data Management (Suppliers, Fabrics, Machines, Shifts, Operations)
          </li>
          <li className="flex items-center gap-2">
            <span className="text-emerald-400">✓</span> Configurable 17-department Production Route &amp; Program BOM Builder
          </li>
          <li className="flex items-center gap-2">
            <span className="text-emerald-400">✓</span> Mathematical Balance Accounting: Input = Good + Rework + Reject + Waste + Balance
          </li>
        </ul>
      </div>

      <div className="flex items-center justify-center gap-4">
        <Link
          href="/"
          className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2.5 rounded shadow transition"
        >
          Return to Executive Dashboard
        </Link>
        <Link
          href="/programs"
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2.5 rounded border border-slate-700 transition"
        >
          View Live Program Files
        </Link>
      </div>
    </div>
  );
}

export default function FutureModulePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400 font-mono">Loading module roadmap...</div>}>
      <FutureModuleContent />
    </Suspense>
  );
}
