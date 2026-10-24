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
  Calendar,
  Layers,
  ArrowRight,
  Briefcase,
  ShieldAlert,
  RotateCcw,
  Scissors,
  PackageCheck,
  FileText,
  Waves
} from 'lucide-react';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';

export default function QCWashingFloorBoard() {
  const [loading, setLoading] = useState(true);
  const [lanes, setLanes] = useState<{
    incoming: any[];
    underInspection: any[];
    passed: any[];
    rejected: any[];
    rework: any[];
  }>({
    incoming: [],
    underInspection: [],
    passed: [],
    rejected: [],
    rework: [],
  });
  const [counts, setCounts] = useState<any>({
    incoming: 0,
    underInspection: 0,
    passed: 0,
    rejected: 0,
    rework: 0,
    total: 0,
  });
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [selectedSheetForView, setSelectedSheetForView] = useState<any | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  const loadBoard = async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
      setError('');
      const res = await fetch('/api/qcwashing/floor-board');
      if (!res.ok) {
        throw new Error('Failed to load QC Washing Floor Board data.');
      }
      const json = await res.json();
      setLanes(json.data?.lanes || { incoming: [], underInspection: [], passed: [], rejected: [], rework: [] });
      setCounts(json.data?.counts || { incoming: 0, underInspection: 0, passed: 0, rejected: 0, rework: 0, total: 0 });
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

    // Live real-time polling sync every 4 seconds
    const interval = setInterval(() => {
      loadBoard(false);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const filterCards = (list: any[]) => {
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (c) =>
        c.challanNumber.toLowerCase().includes(q) ||
        c.program?.programNumber?.toLowerCase().includes(q) ||
        c.program?.programSerialNo?.toLowerCase().includes(q) ||
        c.program?.clientName?.toLowerCase().includes(q) ||
        c.program?.styleCode?.toLowerCase().includes(q)
    );
  };

  const renderCard = (c: any) => {
    const qty = c.items?.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0) || 0;
    const totalDefects = c.inspections?.[0]?.defects?.length || 0;

    return (
      <div
        key={c.id}
        className="bg-white rounded-xl border border-neutral-200 p-3.5 shadow-2xs hover:shadow-md transition space-y-2.5"
      >
        <div className="flex items-center justify-between">
          <span className="font-mono font-bold text-xs text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded">
            {c.challanNumber}
          </span>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              c.priority === 'URGENT'
                ? 'bg-danger-100 text-danger-800'
                : c.priority === 'HIGH'
                ? 'bg-accent-100 text-accent-800'
                : 'bg-neutral-100 text-neutral-700'
            }`}
          >
            {c.priority}
          </span>
        </div>

        <div>
          <div className="text-xs font-bold text-neutral-900">
            {c.program?.clientName || 'Standard Client'}
          </div>
          <div className="text-[11px] text-neutral-500 font-mono">
            Sheet #{c.program?.programSerialNo || c.program?.programNumber || '—'} · Style:{' '}
            {c.program?.styleCode || 'Std'}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs pt-1 border-t border-neutral-100">
          <span className="font-mono font-bold text-accent-800 text-sm">{qty} PCS</span>
          <div className="flex items-center gap-1.5">
            {c.program && (
              <button
                type="button"
                onClick={() => setSelectedSheetForView(c.program)}
                className="p-1 hover:bg-neutral-100 text-neutral-500 hover:text-neutral-700 rounded transition"
                title="View Sheet"
              >
                <FileText className="w-3.5 h-3.5" />
              </button>
            )}
            <Link
              href={`/qcwashing/my-work?challanId=${c.id}`}
              className="px-2 py-0.5 bg-accent-400 hover:bg-accent-500 text-neutral-900 rounded text-[10px] font-bold transition flex items-center gap-0.5"
            >
              <span>Work</span>
              <ArrowRight className="w-2.5 h-2.5" />
            </Link>
          </div>
        </div>

        {totalDefects > 0 && (
          <div className="text-[10px] text-danger-700 bg-danger-50 px-2 py-0.5 rounded flex items-center gap-1 font-medium">
            <ShieldAlert className="w-3 h-3 text-danger-600" />
            <span>{totalDefects} Defect(s) Flagged</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-neutral-50 pb-16">
      {/* HEADER */}
      <header
        className="bg-white border-b border-neutral-200 sticky top-0 z-30 px-4 sm:px-8 py-4 shadow-md text-neutral-900"
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-accent-400/20 text-accent-700 border border-accent-500/30">
                QC WASHING SHOP-FLOOR
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-accent-700 font-medium">
                <span className="w-2 h-2 rounded-full bg-accent-400 animate-pulse" />
                Live Real-Time Kanban
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-neutral-900 tracking-tight mt-1 flex items-center gap-2">
              <Kanban className="w-6 h-6 text-accent-700" />
              <span>QC Washing Floor Board</span>
            </h1>
            <p className="text-xs text-neutral-700 mt-0.5">
              Live visual Kanban board tracking washed lots from arrival to verification and handover.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadBoard(true)}
              disabled={loading}
              className="px-3 py-1.5 bg-neutral-50 hover:bg-neutral-200 text-neutral-900 border border-neutral-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
              title="Refresh Board"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <Link
              href="/qcwashing/my-work"
              className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>My Work</span>
            </Link>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        {/* SEARCH BAR */}
        <div className="flex items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by Challan #, Serial #, Client, or Style..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-neutral-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
            />
          </div>

          <div className="flex items-center gap-3 text-xs text-neutral-500">
            <span>Total Challans: <strong className="text-neutral-900 font-mono">{counts.total}</strong></span>
            <span>·</span>
            <span>Synced: <strong className="text-neutral-900 font-mono">{lastSyncTime.toLocaleTimeString()}</strong></span>
          </div>
        </div>

        {/* KANBAN LANES GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* LANE 1: INCOMING */}
          <div className="bg-neutral-100/70 rounded-2xl p-4 border border-neutral-200 flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-accent-700" />
                <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                  Inbound from Wash
                </h3>
              </div>
              <span className="px-2 py-0.5 bg-white text-neutral-700 font-mono font-bold text-xs rounded-full border border-neutral-200">
                {counts.incoming}
              </span>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto">
              {filterCards(lanes.incoming).map(renderCard)}
              {filterCards(lanes.incoming).length === 0 && (
                <div className="py-12 text-center text-neutral-500 text-xs">No incoming challans</div>
              )}
            </div>
          </div>

          {/* LANE 2: UNDER INSPECTION */}
          <div className="bg-brand-50/50 rounded-2xl p-4 border border-brand-200 flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between pb-3 border-b border-brand-200 mb-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-brand-600" />
                <h3 className="text-xs font-bold text-brand-900 uppercase tracking-wider">
                  On Test Table
                </h3>
              </div>
              <span className="px-2 py-0.5 bg-white text-brand-800 font-mono font-bold text-xs rounded-full border border-brand-200">
                {counts.underInspection}
              </span>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto">
              {filterCards(lanes.underInspection).map(renderCard)}
              {filterCards(lanes.underInspection).length === 0 && (
                <div className="py-12 text-center text-neutral-500 text-xs">No lots on test table</div>
              )}
            </div>
          </div>

          {/* LANE 3: PASSED / HANDOVER READY */}
          <div className="bg-accent-50/50 rounded-2xl p-4 border border-accent-200 flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between pb-3 border-b border-accent-200 mb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-accent-700" />
                <h3 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                  Approved ➔ Handover
                </h3>
              </div>
              <span className="px-2 py-0.5 bg-white text-accent-800 font-mono font-bold text-xs rounded-full border border-accent-200">
                {counts.passed}
              </span>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto">
              {filterCards(lanes.passed).map(renderCard)}
              {filterCards(lanes.passed).length === 0 && (
                <div className="py-12 text-center text-neutral-500 text-xs">No approved lots pending</div>
              )}
            </div>
          </div>

          {/* LANE 4: REWORK & QUARANTINE */}
          <div className="bg-danger-50/50 rounded-2xl p-4 border border-danger-200 flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between pb-3 border-b border-danger-200 mb-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-accent-700" />
                <h3 className="text-xs font-bold text-danger-900 uppercase tracking-wider">
                  Re-Wash & Quarantine
                </h3>
              </div>
              <span className="px-2 py-0.5 bg-white text-danger-800 font-mono font-bold text-xs rounded-full border border-danger-200">
                {counts.rework + counts.rejected}
              </span>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto">
              {[...filterCards(lanes.rework), ...filterCards(lanes.rejected)].map(renderCard)}
              {[...filterCards(lanes.rework), ...filterCards(lanes.rejected)].length === 0 && (
                <div className="py-12 text-center text-neutral-500 text-xs">Zero rework or quarantine lots</div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* TECH SHEET PRINT MODAL */}
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
