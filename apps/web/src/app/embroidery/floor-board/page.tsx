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
    <div className="min-h-screen bg-neutral-50">
      {/* HEADER */}
      <header className="bg-white border-b border-neutral-200/80 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-600 block">
            SHUBHAM FABRICS MES · FLOOR OPERATIONS
          </span>
          <h1 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
            <Kanban className="w-5 h-5 text-brand-600" />
            <span>Embroidery Department Floor Board</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition"
            title="Refresh Board"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/embroidery"
            className="px-3.5 py-2 text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-md transition"
          >
            Back to Dashboard
          </Link>
        </div>
      </header>

      {/* KANBAN LANES */}
      <main className="p-4 sm:p-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* LANE 1: QUEUED */}
          <div className="bg-neutral-100/80 rounded-2xl p-4 border border-neutral-200 flex flex-col">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-accent-400"></span>
                <span className="text-xs font-bold text-neutral-900 uppercase tracking-wide">
                  1. Staged / Incoming Queue
                </span>
              </div>
              <span className="text-[11px] font-mono font-bold bg-white px-2 py-0.5 rounded-full border border-neutral-200 text-neutral-600">
                {queued.length}
              </span>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto">
              {queued.length === 0 ? (
                <div className="p-6 text-center text-xs text-neutral-500 bg-white/60 rounded-xl border border-dashed border-neutral-200">
                  No batches awaiting pickup.
                </div>
              ) : (
                queued.map((c: any) => (
                  <div key={c.id} className="bg-white p-4 rounded-xl border border-neutral-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-neutral-900">{c.challanNumber}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-100 text-brand-800 font-semibold">
                        {c.program?.wilcomDesignNumber || 'W-STD'}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-neutral-700">{c.program?.mainStyle || 'Embroidery Lot'}</p>
                    <div className="text-[10px] text-neutral-500">From Store Department</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* LANE 2: IN STITCHING */}
          <div className="bg-neutral-100/80 rounded-2xl p-4 border border-neutral-200 flex flex-col">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-500 animate-pulse"></span>
                <span className="text-xs font-bold text-neutral-900 uppercase tracking-wide">
                  2. Active on Machine Frames
                </span>
              </div>
              <span className="text-[11px] font-mono font-bold bg-white px-2 py-0.5 rounded-full border border-neutral-200 text-neutral-600">
                {running.length}
              </span>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto">
              {running.length === 0 ? (
                <div className="p-6 text-center text-xs text-neutral-500 bg-white/60 rounded-xl border border-dashed border-neutral-200">
                  No orders currently stitching.
                </div>
              ) : (
                running.map((c: any) => (
                  <div key={c.id} className="bg-white p-4 rounded-xl border border-brand-300 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-brand-900">{c.challanNumber}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-100 text-brand-800 font-semibold">
                        {c.program?.wilcomDesignNumber || 'W-STD'}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-neutral-900">{c.program?.mainStyle || 'Embroidery Lot'}</p>
                    <span className="text-[10px] text-brand-600 font-semibold block">Multi-head Running</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* LANE 3: COMPLETED */}
          <div className="bg-neutral-100/80 rounded-2xl p-4 border border-neutral-200 flex flex-col">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-accent-400"></span>
                <span className="text-xs font-bold text-neutral-900 uppercase tracking-wide">
                  3. Completed &amp; Dispatched
                </span>
              </div>
              <span className="text-[11px] font-mono font-bold bg-white px-2 py-0.5 rounded-full border border-neutral-200 text-neutral-600">
                {done.length}
              </span>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto">
              {done.length === 0 ? (
                <div className="p-6 text-center text-xs text-neutral-500 bg-white/60 rounded-xl border border-dashed border-neutral-200">
                  No completed orders yet.
                </div>
              ) : (
                done.map((c: any) => (
                  <div key={c.id} className="bg-white p-4 rounded-xl border border-accent-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-neutral-900">{c.challanNumber}</span>
                      <CheckCircle2 className="w-4 h-4 text-accent-700" />
                    </div>
                    <p className="text-xs font-semibold text-neutral-700">{c.program?.mainStyle || 'Completed Lot'}</p>
                    <div className="text-[10px] text-accent-700 font-semibold">Ready for Thread Cutting / QC Gate</div>
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
