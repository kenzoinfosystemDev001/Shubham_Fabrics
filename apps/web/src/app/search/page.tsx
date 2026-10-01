'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams?.get('q') || '';

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full pt-20">
      <div className="mb-6">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          GLOBAL TRACEABILITY SEARCH
        </span>
        <h1 className="text-2xl font-bold text-slate-900">Search Results</h1>
        <p className="text-xs text-slate-500 mt-1">
          Showing matching records for: <span className="font-mono font-semibold text-slate-800">"{query}"</span>
        </p>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Matching Challans & Lots</h2>
        <div className="space-y-3">
          <div className="p-3 border border-slate-100 rounded-lg hover:bg-slate-50 transition flex items-center justify-between">
            <div>
              <Link href="/challans" className="font-mono font-bold text-[#1E3A8A] text-xs">
                CH-DYE-2026-000451
              </Link>
              <p className="text-xs text-slate-600 mt-0.5">Lot: SF-3201-NEW-2609-01 · 250 MTR Cotton Cambric</p>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700">
              IN_PROCESS
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-8 pt-24 text-center text-xs text-slate-500">Loading search results...</div>}>
      <SearchResults />
    </Suspense>
  );
}
