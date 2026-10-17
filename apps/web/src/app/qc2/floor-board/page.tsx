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
  PackageCheck
} from 'lucide-react';
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';

export default function QC2FloorBoard() {
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

  const loadBoard = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/qc2/floor-board');
      if (!res.ok) {
        throw new Error('Failed to load QC2 Floor Board data.');
      }
      const json = await res.json();
      setLanes(json.data?.lanes || { incoming: [], underInspection: [], passed: [], rejected: [], rework: [] });
      setCounts(json.data?.counts || { incoming: 0, underInspection: 0, passed: 0, rejected: 0, rework: 0, total: 0 });
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error loading board');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoard();
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

  return (
    <div className="min-h-screen bg-[#FDFBF7] pb-16">
      {/* HEADER */}
      <header
        style={{
          backgroundImage: `linear-gradient(to right, rgba(15, 23, 42, 0.88), rgba(15, 23, 42, 0.72)), url('${DEPARTMENT_NAV_BG_IMAGE}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        className="border-b border-slate-700/80 sticky top-0 z-30 px-4 sm:px-8 py-4 shadow-md text-white"
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 block drop-shadow-sm">
              SHUBHAM FABRICS MES · QC2 FLOOR BOARD
            </span>
            <h1 className="text-xl font-bold text-white flex items-center gap-2.5 drop-shadow-sm">
              <Kanban className="w-5 h-5 text-emerald-400" />
              <span>QC2 Interactive Kanban Floor Board</span>
            </h1>
            <p className="text-xs text-slate-300 mt-0.5">
              Live Swimlanes: Inflow from Thread Cutting → Inspection → Defected Shelf Rejections &amp; Rework
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={loadBoard}
              disabled={loading}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-lg border border-slate-700/60 transition"
              title="Refresh Floor Board"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <Link
              href="/qc2/my-work"
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
            >
              <Briefcase className="w-4 h-4" />
              <span>Inspection Station</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ERROR NOTICE */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-8 mt-4">
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* FILTER SEARCH BAR */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 mt-6">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Filter by Challan #, Sheet #, Client, Style..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>

          <div className="text-xs font-mono font-bold text-slate-600">
            Total Active Cards: <span className="text-emerald-700">{counts.total}</span>
          </div>
        </div>
      </div>

      {/* 5-COLUMN KANBAN SWIMLANES */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-start">
          {/* LANE 1: INCOMING FROM THREAD CUTTING */}
          <div className="bg-slate-100/90 rounded-xl border border-slate-200 border-t-4 border-t-cyan-500 flex flex-col min-h-[420px] md:h-[calc(100vh-250px)] shadow-xs">
            <div className="p-3 border-b border-slate-200/80 bg-white/70 rounded-t-lg flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Scissors className="w-4 h-4 text-cyan-600" />
                <h3 className="text-xs font-bold text-slate-900">1. From Thread Cutting</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-100 text-cyan-800">
                {counts.incoming}
              </span>
            </div>

            <div className="p-2 space-y-2.5 flex-1 overflow-y-auto">
              {filterCards(lanes.incoming).length === 0 ? (
                <div className="h-32 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center p-3 text-center">
                  <span className="text-[11px] text-slate-400 font-mono">No lots pending</span>
                </div>
              ) : (
                filterCards(lanes.incoming).map((c) => {
                  const qty = c.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
                  return (
                    <div
                      key={c.id}
                      className="bg-white rounded-lg p-3 border border-slate-200 hover:border-cyan-400 shadow-2xs hover:shadow-xs transition space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-slate-900">{c.challanNumber}</span>
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700">
                          {c.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-700">
                        <span className="font-semibold block truncate">
                          {c.program?.clientName || 'Standard Client'}
                        </span>
                        <span className="text-[10px] text-slate-500 block truncate">
                          {c.program?.mainStyle || c.program?.styleCode || 'General Style'}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span className="font-mono font-bold text-slate-800">{qty} PCS</span>
                        <Link
                          href={`/qc2/my-work?challanId=${c.id}`}
                          className="text-[10px] font-bold text-emerald-700 hover:underline flex items-center gap-0.5"
                        >
                          <span>Inspect →</span>
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* LANE 2: UNDER INSPECTION */}
          <div className="bg-slate-100/90 rounded-xl border border-slate-200 border-t-4 border-t-blue-500 flex flex-col min-h-[420px] md:h-[calc(100vh-250px)] shadow-xs">
            <div className="p-3 border-b border-slate-200/80 bg-white/70 rounded-t-lg flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900">2. Under Inspection</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-100 text-blue-800">
                {counts.underInspection}
              </span>
            </div>

            <div className="p-2 space-y-2.5 flex-1 overflow-y-auto">
              {filterCards(lanes.underInspection).length === 0 ? (
                <div className="h-32 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center p-3 text-center">
                  <span className="text-[11px] text-slate-400 font-mono">No lots in terminal</span>
                </div>
              ) : (
                filterCards(lanes.underInspection).map((c) => {
                  const qty = c.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
                  return (
                    <div
                      key={c.id}
                      className="bg-white rounded-lg p-3 border border-blue-300 shadow-2xs hover:shadow-xs transition space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-blue-900">{c.challanNumber}</span>
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 animate-pulse">
                          Checking
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-700">
                        <span className="font-semibold block truncate">
                          {c.program?.clientName || 'Standard Client'}
                        </span>
                        <span className="text-[10px] text-slate-500 block truncate">
                          {c.program?.mainStyle || c.program?.styleCode || 'General Style'}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span className="font-mono font-bold text-slate-800">{qty} PCS</span>
                        <Link
                          href={`/qc2/my-work?challanId=${c.id}`}
                          className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-semibold"
                        >
                          Resume
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* LANE 3: PASSED / APPROVED */}
          <div className="bg-slate-100/90 rounded-xl border border-slate-200 border-t-4 border-t-emerald-500 flex flex-col min-h-[420px] md:h-[calc(100vh-250px)] shadow-xs">
            <div className="p-3 border-b border-slate-200/80 bg-white/70 rounded-t-lg flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-900">3. Approved / Passed</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">
                {counts.passed}
              </span>
            </div>

            <div className="p-2 space-y-2.5 flex-1 overflow-y-auto">
              {filterCards(lanes.passed).length === 0 ? (
                <div className="h-32 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center p-3 text-center">
                  <span className="text-[11px] text-slate-400 font-mono">No passed lots</span>
                </div>
              ) : (
                filterCards(lanes.passed).map((c) => {
                  const qty = c.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
                  return (
                    <div
                      key={c.id}
                      className="bg-white rounded-lg p-3 border border-emerald-200 shadow-2xs hover:shadow-xs transition space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-slate-900">{c.challanNumber}</span>
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          APPROVED
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-700">
                        <span className="font-semibold block truncate">
                          {c.program?.clientName || 'Standard Client'}
                        </span>
                        <span className="text-[10px] text-slate-500 block truncate">
                          {c.program?.mainStyle || c.program?.styleCode || 'General Style'}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span className="font-mono font-bold text-emerald-700">{qty} PCS Good</span>
                        <span className="text-[10px] text-slate-400">QC Verified ✓</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* LANE 4: DEFECTED SHELF (REJECTED) */}
          <div className="bg-rose-50/40 rounded-xl border border-rose-200 border-t-4 border-t-rose-600 flex flex-col min-h-[420px] md:h-[calc(100vh-250px)] shadow-xs">
            <div className="p-3 border-b border-rose-200/80 bg-white/70 rounded-t-lg flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <h3 className="text-xs font-bold text-rose-900">4. Defected Shelf</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-100 text-rose-800">
                {counts.rejected}
              </span>
            </div>

            <div className="p-2 space-y-2.5 flex-1 overflow-y-auto">
              {filterCards(lanes.rejected).length === 0 ? (
                <div className="h-32 border-2 border-dashed border-rose-200 rounded-lg flex items-center justify-center p-3 text-center">
                  <span className="text-[11px] text-slate-400 font-mono">No rejected lots</span>
                </div>
              ) : (
                filterCards(lanes.rejected).map((c) => {
                  const qty = c.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
                  return (
                    <div
                      key={c.id}
                      className="bg-white rounded-lg p-3 border border-rose-300 shadow-2xs hover:shadow-xs transition space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-rose-900">{c.challanNumber}</span>
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                          REJECTED
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-700">
                        <span className="font-semibold block truncate">
                          {c.program?.clientName || 'Standard Client'}
                        </span>
                        <span className="text-[10px] text-rose-600 block truncate font-medium">
                          Sent to DEF-SHELF-01
                        </span>
                      </div>
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span className="font-mono font-bold text-rose-700">{qty} PCS Defective</span>
                        <span className="text-[10px] font-mono font-bold text-rose-600 bg-rose-50 px-1 py-0.5 rounded">
                          DEF-SHELF
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* LANE 5: REWORK RETURNED */}
          <div className="bg-amber-50/40 rounded-xl border border-amber-200 border-t-4 border-t-amber-500 flex flex-col min-h-[420px] md:h-[calc(100vh-250px)] shadow-xs">
            <div className="p-3 border-b border-amber-200/80 bg-white/70 rounded-t-lg flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs font-bold text-amber-900">5. Rework (TC)</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-800">
                {counts.rework}
              </span>
            </div>

            <div className="p-2 space-y-2.5 flex-1 overflow-y-auto">
              {filterCards(lanes.rework).length === 0 ? (
                <div className="h-32 border-2 border-dashed border-amber-200 rounded-lg flex items-center justify-center p-3 text-center">
                  <span className="text-[11px] text-slate-400 font-mono">No rework lots</span>
                </div>
              ) : (
                filterCards(lanes.rework).map((c) => {
                  const qty = c.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
                  return (
                    <div
                      key={c.id}
                      className="bg-white rounded-lg p-3 border border-amber-300 shadow-2xs hover:shadow-xs transition space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-amber-900">{c.challanNumber}</span>
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                          REWORK
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-700">
                        <span className="font-semibold block truncate">
                          {c.program?.clientName || 'Standard Client'}
                        </span>
                        <span className="text-[10px] text-amber-700 block truncate font-medium">
                          Returned to Thread Cutting
                        </span>
                      </div>
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span className="font-mono font-bold text-amber-700">{qty} PCS</span>
                        <span className="text-[10px] text-slate-400">Re-trim</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
