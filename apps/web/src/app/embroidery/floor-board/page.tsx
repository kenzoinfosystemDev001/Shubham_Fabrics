'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Kanban,
  Sparkles,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Scissors,
  ArrowRight
} from 'lucide-react';

export default function EmbroideryFloorBoardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/embroidery/dashboard');
      const json = await res.json();
      setData(json.data);
    } catch (err) {
      console.error('Error loading embroidery floor board:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const challans = data?.challans || [];
  const queued = challans.filter((c: any) => c.status === 'ISSUED' || c.status === 'DRAFT');
  const running = challans.filter((c: any) => c.status === 'RECEIVED' || c.status === 'IN_PROGRESS');
  const done = challans.filter((c: any) => c.status === 'COMPLETED');

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C026D3] block">
            SHUBHAM FABRICS MES · FLOOR OPERATIONS
          </span>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Kanban className="w-5 h-5 text-fuchsia-600" />
            <span>Embroidery Department Floor Board</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition"
            title="Refresh Board"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/embroidery"
            className="px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition"
          >
            Back to Dashboard
          </Link>
        </div>
      </header>

      {/* KANBAN LANES */}
      <main className="p-4 sm:p-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* LANE 1: QUEUED */}
          <div className="bg-slate-100/80 rounded-2xl p-4 border border-slate-200 flex flex-col">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  1. Staged / Incoming Queue
                </span>
              </div>
              <span className="text-[11px] font-mono font-bold bg-white px-2 py-0.5 rounded-full border border-slate-200 text-slate-600">
                {queued.length}
              </span>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto">
              {queued.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-white/60 rounded-xl border border-dashed border-slate-200">
                  No batches awaiting pickup.
                </div>
              ) : (
                queued.map((c: any) => (
                  <div key={c.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate-800">{c.challanNumber}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-fuchsia-100 text-fuchsia-800 font-semibold">
                        {c.program?.wilcomDesignNumber || 'W-STD'}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-700">{c.program?.mainStyle || 'Embroidery Lot'}</p>
                    <div className="text-[10px] text-slate-400">From Store Department</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* LANE 2: IN STITCHING */}
          <div className="bg-slate-100/80 rounded-2xl p-4 border border-slate-200 flex flex-col">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-fuchsia-500 animate-pulse"></span>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  2. Active on Machine Frames
                </span>
              </div>
              <span className="text-[11px] font-mono font-bold bg-white px-2 py-0.5 rounded-full border border-slate-200 text-slate-600">
                {running.length}
              </span>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto">
              {running.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-white/60 rounded-xl border border-dashed border-slate-200">
                  No orders currently stitching.
                </div>
              ) : (
                running.map((c: any) => (
                  <div key={c.id} className="bg-white p-4 rounded-xl border border-fuchsia-300 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-fuchsia-900">{c.challanNumber}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-fuchsia-100 text-fuchsia-800 font-semibold">
                        {c.program?.wilcomDesignNumber || 'W-STD'}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800">{c.program?.mainStyle || 'Embroidery Lot'}</p>
                    <span className="text-[10px] text-fuchsia-600 font-semibold block">Multi-head Running</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* LANE 3: COMPLETED */}
          <div className="bg-slate-100/80 rounded-2xl p-4 border border-slate-200 flex flex-col">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  3. Completed &amp; Dispatched
                </span>
              </div>
              <span className="text-[11px] font-mono font-bold bg-white px-2 py-0.5 rounded-full border border-slate-200 text-slate-600">
                {done.length}
              </span>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto">
              {done.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-white/60 rounded-xl border border-dashed border-slate-200">
                  No completed orders yet.
                </div>
              ) : (
                done.map((c: any) => (
                  <div key={c.id} className="bg-white p-4 rounded-xl border border-emerald-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate-800">{c.challanNumber}</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </div>
                    <p className="text-xs font-semibold text-slate-700">{c.program?.mainStyle || 'Completed Lot'}</p>
                    <div className="text-[10px] text-emerald-600 font-semibold">Ready for Thread Cutting / QC Gate</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
