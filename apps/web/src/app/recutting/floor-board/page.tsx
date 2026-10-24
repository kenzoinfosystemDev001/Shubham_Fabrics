'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Kanban,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Scissors,
  ArrowRight,
  ShieldCheck,
  Send,
  FileText,
  Package,
} from 'lucide-react';
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';

export default function RecuttingFloorBoard() {
  const [loading, setLoading] = useState(true);
  const [lanes, setLanes] = useState<{
    incoming: any[];
    inProcess: any[];
    verification: any[];
    readyForStitching: any[];
    handedOver: any[];
  }>({
    incoming: [],
    inProcess: [],
    verification: [],
    readyForStitching: [],
    handedOver: [],
  });

  const [counts, setCounts] = useState<any>({
    incoming: 0,
    inProcess: 0,
    verification: 0,
    readyForStitching: 0,
    handedOver: 0,
    total: 0,
    totalPcs: 0,
  });

  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [selectedSheetForView, setSelectedSheetForView] = useState<any | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  const loadBoard = async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
      setError('');
      const res = await fetch('/api/recutting/floor-board');
      if (!res.ok) {
        throw new Error('Failed to load Recutting Floor Board data.');
      }
      const json = await res.json();
      setLanes(
        json.data?.lanes || {
          incoming: [],
          inProcess: [],
          verification: [],
          readyForStitching: [],
          handedOver: [],
        }
      );
      setCounts(
        json.data?.counts || {
          incoming: 0,
          inProcess: 0,
          verification: 0,
          readyForStitching: 0,
          handedOver: 0,
          total: 0,
          totalPcs: 0,
        }
      );
      setLastSyncTime(new Date());
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error loading board');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadBoard(true);
    const interval = setInterval(() => {
      loadBoard(false);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const filterCards = (list: any[]) => {
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (c) =>
        c.challanNumber.toLowerCase().includes(q) ||
        c.program?.programNumber?.toLowerCase().includes(q) ||
        c.program?.designNumber?.toLowerCase().includes(q) ||
        c.program?.wilcomDesignNumber?.toLowerCase().includes(q) ||
        c.program?.clientName?.toLowerCase().includes(q) ||
        c.program?.buyerName?.toLowerCase().includes(q)
    );
  };

  const renderCard = (c: any) => {
    const qty = c.items?.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0) || 0;

    return (
      <div
        key={c.id}
        className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs hover:border-lavender-400 hover:shadow-md transition space-y-2.5"
      >
        <div className="flex items-center justify-between">
          <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
            {c.challanNumber}
          </span>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              c.priority === 'URGENT'
                ? 'bg-rose-100 text-rose-800'
                : c.priority === 'HIGH'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {c.priority || 'NORMAL'}
          </span>
        </div>

        <div>
          <div className="text-xs font-bold text-slate-800">
            {c.program?.buyerName || c.program?.clientName || 'Standard Client'}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            Sheet #{c.program?.programNumber || '—'} · Wilcom:{' '}
            <strong className="text-lavender-700">{c.program?.wilcomDesignNumber || c.program?.designNumber || 'Std'}</strong>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
          <span className="font-mono font-extrabold text-slate-900 text-sm">{qty} PCS</span>
          <div className="flex items-center gap-1.5">
            {c.program && (
              <button
                type="button"
                onClick={() => setSelectedSheetForView(c.program)}
                className="p-1 hover:bg-slate-100 text-slate-500 hover:text-sky-600 rounded transition"
                title="View Production Sheet"
              >
                <FileText className="w-3.5 h-3.5" />
              </button>
            )}

            <Link
              href={`/recutting/my-work?jobId=${c.id}`}
              className="p-1 hover:bg-lavender-50 text-slate-500 hover:text-lavender-600 rounded transition"
              title="Open Workstation"
            >
              <Scissors className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-ink-50 pb-16 flex flex-col">
      {/* HEADER */}
      <header
        style={{
          backgroundImage: `linear-gradient(to right, rgba(37, 35, 42, 0.88), rgba(37, 35, 42, 0.72)), url('${DEPARTMENT_NAV_BG_IMAGE}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        className="border-b border-slate-700/80 sticky top-0 z-30 px-4 sm:px-8 py-4 shadow-md text-white"
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                KANBAN BOARD
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Real-Time Floor Pulse
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mt-1 flex items-center gap-2">
              <Kanban className="w-6 h-6 text-blue-400" />
              <span>Recutting Floor & Pipeline Board</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadBoard(true)}
              disabled={loading}
              className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <Link
              href="/recutting/my-work"
              className="px-3 py-1.5 bg-lavender-600 hover:bg-lavender-500 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1.5"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>Cutting Queue</span>
            </Link>
          </div>
        </div>
      </header>

      {/* SEARCH BAR & CONTROLS */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-8 pt-6 pb-2">
        <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search challan, buyer, sheet, design, wilcom #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-lavender-500"
            />
          </div>
          <div className="text-xs text-slate-500">
            Total Pipeline: <strong className="text-slate-800">{counts.total} Jobs</strong> ({counts.totalPcs.toLocaleString()} PCS)
          </div>
        </div>
      </div>

      {/* KANBAN BOARD LANES */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-4 flex-1">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {/* LANE 1: INCOMING & QUEUED */}
          <div className="bg-slate-100/80 rounded-2xl p-3 border border-slate-200 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <h3 className="text-xs font-bold uppercase text-slate-800 tracking-wide">
                  Incoming Intake
                </h3>
              </div>
              <span className="text-xs font-mono font-bold bg-white px-2 py-0.5 rounded-full border border-slate-200 text-slate-700">
                {counts.incoming}
              </span>
            </div>

            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              {filterCards(lanes.incoming).length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs bg-white/50 rounded-xl border border-dashed border-slate-300">
                  No incoming challans
                </div>
              ) : (
                filterCards(lanes.incoming).map((c) => renderCard(c))
              )}
            </div>
          </div>

          {/* LANE 2: IN PRECISION CUTTING */}
          <div className="bg-slate-100/80 rounded-2xl p-3 border border-slate-200 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-lavender-500" />
                <h3 className="text-xs font-bold uppercase text-slate-800 tracking-wide">
                  In Precision Cutting
                </h3>
              </div>
              <span className="text-xs font-mono font-bold bg-white px-2 py-0.5 rounded-full border border-slate-200 text-lavender-700">
                {counts.inProcess}
              </span>
            </div>

            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              {filterCards(lanes.inProcess).length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs bg-white/50 rounded-xl border border-dashed border-slate-300">
                  No active cutting jobs
                </div>
              ) : (
                filterCards(lanes.inProcess).map((c) => renderCard(c))
              )}
            </div>
          </div>

          {/* LANE 3: QUALITY VERIFICATION */}
          <div className="bg-slate-100/80 rounded-2xl p-3 border border-slate-200 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                <h3 className="text-xs font-bold uppercase text-slate-800 tracking-wide">
                  Pre-Stitching Check
                </h3>
              </div>
              <span className="text-xs font-mono font-bold bg-white px-2 py-0.5 rounded-full border border-slate-200 text-purple-700">
                {counts.verification}
              </span>
            </div>

            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              {filterCards(lanes.verification).length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs bg-white/50 rounded-xl border border-dashed border-slate-300">
                  No jobs awaiting verification
                </div>
              ) : (
                filterCards(lanes.verification).map((c) => renderCard(c))
              )}
            </div>
          </div>

          {/* LANE 4: READY FOR STITCHING */}
          <div className="bg-slate-100/80 rounded-2xl p-3 border border-slate-200 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <h3 className="text-xs font-bold uppercase text-slate-800 tracking-wide">
                  Ready for Stitching
                </h3>
              </div>
              <span className="text-xs font-mono font-bold bg-white px-2 py-0.5 rounded-full border border-slate-200 text-emerald-700">
                {counts.readyForStitching + counts.handedOver}
              </span>
            </div>

            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              {filterCards([...lanes.readyForStitching, ...lanes.handedOver]).length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs bg-white/50 rounded-xl border border-dashed border-slate-300">
                  No verified pieces ready
                </div>
              ) : (
                filterCards([...lanes.readyForStitching, ...lanes.handedOver]).map((c) => renderCard(c))
              )}
            </div>
          </div>
        </div>
      </main>

      {/* TECH SHEET MODAL */}
      {selectedSheetForView && (
        <ProductionSheetPrintModal
          isOpen={true}
          onClose={() => setSelectedSheetForView(null)}
          program={selectedSheetForView}
        />
      )}
    </div>
  );
}
