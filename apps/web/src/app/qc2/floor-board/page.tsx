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
  FileText
} from 'lucide-react';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';

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
  const [selectedSheetForView, setSelectedSheetForView] = useState<any | null>(null);

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
    <div className="min-h-screen bg-neutral-50 pb-16">
      {/* HEADER */}
      <header
        className="bg-white border-b border-neutral-200 sticky top-0 z-30 px-4 sm:px-8 py-4 shadow-md text-neutral-900"
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-700 block drop-shadow-sm">
              SHUBHAM FABRICS MES · QC2 FLOOR BOARD
            </span>
            <h1 className="text-xl font-bold text-neutral-900 flex items-center gap-2.5 drop-shadow-sm">
              <Kanban className="w-5 h-5 text-accent-700" />
              <span>QC2 Interactive Kanban Floor Board</span>
            </h1>
            <p className="text-xs text-neutral-700 mt-0.5">
              Live Swimlanes: Inflow from Thread Cutting → Inspection → Defected Shelf Rejections &amp; Rework
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={loadBoard}
              disabled={loading}
              className="p-2 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition"
              title="Refresh Floor Board"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <Link
              href="/qc2/my-work"
              className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
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
          <div className="p-3 bg-danger-50 border border-danger-200 text-danger-800 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-danger-600" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* FILTER SEARCH BAR */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 mt-6">
        <div className="bg-white p-3.5 rounded-xl border border-neutral-200 shadow-2xs flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Filter by Challan #, Sheet #, Client, Style..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
            />
            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
          </div>

          <div className="text-xs font-mono font-bold text-neutral-600">
            Total Active Cards: <span className="text-accent-800">{counts.total}</span>
          </div>
        </div>
      </div>

      {/* 5-COLUMN KANBAN SWIMLANES */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-start">
          {/* LANE 1: INCOMING FROM THREAD CUTTING */}
          <div className="bg-neutral-100/90 rounded-xl border border-neutral-200 border-t-4 border-t-brand-500 flex flex-col min-h-[420px] md:h-[calc(100vh-250px)] shadow-xs">
            <div className="p-3 border-b border-neutral-200/80 bg-white/70 rounded-t-lg flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Scissors className="w-4 h-4 text-brand-600" />
                <h3 className="text-xs font-bold text-neutral-900">1. From Thread Cutting</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-brand-100 text-brand-800">
                {counts.incoming}
              </span>
            </div>

            <div className="p-2 space-y-2.5 flex-1 overflow-y-auto">
              {filterCards(lanes.incoming).length === 0 ? (
                <div className="h-32 border-2 border-dashed border-neutral-200 rounded-lg flex items-center justify-center p-3 text-center">
                  <span className="text-[11px] text-neutral-500 font-mono">No lots pending</span>
                </div>
              ) : (
                filterCards(lanes.incoming).map((c) => {
                  const qty = c.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
                  return (
                    <div
                      key={c.id}
                      className="bg-white rounded-lg p-3 border border-neutral-200 hover:border-brand-500 shadow-2xs hover:shadow-xs transition space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-neutral-900">{c.challanNumber}</span>
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-brand-50 text-brand-700">
                          {c.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-700">
                        <span className="font-semibold block truncate">
                          {c.program?.clientName || 'Standard Client'}
                        </span>
                        <span className="text-[10px] text-neutral-500 block truncate">
                          {c.program?.mainStyle || c.program?.styleCode || 'General Style'}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px]">
                        <span className="font-mono font-bold text-neutral-900">{qty} PCS</span>
                        <div className="flex items-center gap-2">
                          {c.program && (
                            <button
                              type="button"
                              onClick={() => setSelectedSheetForView(c.program)}
                              className="text-[10px] font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-0.5 hover:underline"
                              title="View Production Sheet"
                            >
                              <FileText className="w-3 h-3" />
                              <span>Sheet</span>
                            </button>
                          )}
                          <Link
                            href={`/qc2/my-work?challanId=${c.id}`}
                            className="text-[10px] font-bold text-accent-800 hover:underline flex items-center gap-0.5"
                          >
                            <span>Inspect →</span>
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* LANE 2: UNDER INSPECTION */}
          <div className="bg-neutral-100/90 rounded-xl border border-neutral-200 border-t-4 border-t-brand-500 flex flex-col min-h-[420px] md:h-[calc(100vh-250px)] shadow-xs">
            <div className="p-3 border-b border-neutral-200/80 bg-white/70 rounded-t-lg flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-brand-600" />
                <h3 className="text-xs font-bold text-neutral-900">2. Under Inspection</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-brand-100 text-brand-800">
                {counts.underInspection}
              </span>
            </div>

            <div className="p-2 space-y-2.5 flex-1 overflow-y-auto">
              {filterCards(lanes.underInspection).length === 0 ? (
                <div className="h-32 border-2 border-dashed border-neutral-200 rounded-lg flex items-center justify-center p-3 text-center">
                  <span className="text-[11px] text-neutral-500 font-mono">No lots in terminal</span>
                </div>
              ) : (
                filterCards(lanes.underInspection).map((c) => {
                  const qty = c.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
                  return (
                    <div
                      key={c.id}
                      className="bg-white rounded-lg p-3 border border-brand-300 shadow-2xs hover:shadow-xs transition space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-brand-900">{c.challanNumber}</span>
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 animate-pulse">
                          Checking
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-700">
                        <span className="font-semibold block truncate">
                          {c.program?.clientName || 'Standard Client'}
                        </span>
                        <span className="text-[10px] text-neutral-500 block truncate">
                          {c.program?.mainStyle || c.program?.styleCode || 'General Style'}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px]">
                        <span className="font-mono font-bold text-neutral-900">{qty} PCS</span>
                        <div className="flex items-center gap-2">
                          {c.program && (
                            <button
                              type="button"
                              onClick={() => setSelectedSheetForView(c.program)}
                              className="text-[10px] font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-0.5 hover:underline"
                              title="View Production Sheet"
                            >
                              <FileText className="w-3 h-3" />
                              <span>Sheet</span>
                            </button>
                          )}
                          <Link
                            href={`/qc2/my-work?challanId=${c.id}`}
                            className="px-2 py-0.5 bg-brand-600 hover:bg-brand-700 text-white rounded text-[10px] font-semibold"
                          >
                            Resume
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* LANE 3: PASSED / APPROVED */}
          <div className="bg-neutral-100/90 rounded-xl border border-neutral-200 border-t-4 border-t-accent-500 flex flex-col min-h-[420px] md:h-[calc(100vh-250px)] shadow-xs">
            <div className="p-3 border-b border-neutral-200/80 bg-white/70 rounded-t-lg flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-accent-700" />
                <h3 className="text-xs font-bold text-neutral-900">3. Approved / Passed</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-accent-100 text-accent-800">
                {counts.passed}
              </span>
            </div>

            <div className="p-2 space-y-2.5 flex-1 overflow-y-auto">
              {filterCards(lanes.passed).length === 0 ? (
                <div className="h-32 border-2 border-dashed border-neutral-200 rounded-lg flex items-center justify-center p-3 text-center">
                  <span className="text-[11px] text-neutral-500 font-mono">No passed lots</span>
                </div>
              ) : (
                filterCards(lanes.passed).map((c) => {
                  const qty = c.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
                  return (
                    <div
                      key={c.id}
                      className="bg-white rounded-lg p-3 border border-accent-200 shadow-2xs hover:shadow-xs transition space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-neutral-900">{c.challanNumber}</span>
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-accent-100 text-accent-800">
                          APPROVED
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-700">
                        <span className="font-semibold block truncate">
                          {c.program?.clientName || 'Standard Client'}
                        </span>
                        <span className="text-[10px] text-neutral-500 block truncate">
                          {c.program?.mainStyle || c.program?.styleCode || 'General Style'}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px]">
                        <span className="font-mono font-bold text-accent-800">{qty} PCS Good</span>
                        <div className="flex items-center gap-2">
                          {c.program && (
                            <button
                              type="button"
                              onClick={() => setSelectedSheetForView(c.program)}
                              className="text-[10px] font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-0.5 hover:underline"
                              title="View Production Sheet"
                            >
                              <FileText className="w-3 h-3" />
                              <span>Sheet</span>
                            </button>
                          )}
                          <span className="text-[10px] text-neutral-500">QC Verified ✓</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* LANE 4: DEFECTED SHELF (REJECTED) */}
          <div className="bg-danger-50/40 rounded-xl border border-danger-200 border-t-4 border-t-danger-500 flex flex-col min-h-[420px] md:h-[calc(100vh-250px)] shadow-xs">
            <div className="p-3 border-b border-danger-200/80 bg-white/70 rounded-t-lg flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-danger-600" />
                <h3 className="text-xs font-bold text-danger-900">4. Defected Shelf</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-danger-100 text-danger-800">
                {counts.rejected}
              </span>
            </div>

            <div className="p-2 space-y-2.5 flex-1 overflow-y-auto">
              {filterCards(lanes.rejected).length === 0 ? (
                <div className="h-32 border-2 border-dashed border-danger-200 rounded-lg flex items-center justify-center p-3 text-center">
                  <span className="text-[11px] text-neutral-500 font-mono">No rejected lots</span>
                </div>
              ) : (
                filterCards(lanes.rejected).map((c) => {
                  const qty = c.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
                  return (
                    <div
                      key={c.id}
                      className="bg-white rounded-lg p-3 border border-danger-300 shadow-2xs hover:shadow-xs transition space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-danger-900">{c.challanNumber}</span>
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-danger-100 text-danger-800">
                          REJECTED
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-700">
                        <span className="font-semibold block truncate">
                          {c.program?.clientName || 'Standard Client'}
                        </span>
                        <span className="text-[10px] text-danger-600 block truncate font-medium">
                          Sent to DEF-SHELF-01
                        </span>
                      </div>
                      <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px]">
                        <span className="font-mono font-bold text-danger-700">{qty} PCS Defective</span>
                        <div className="flex items-center gap-2">
                          {c.program && (
                            <button
                              type="button"
                              onClick={() => setSelectedSheetForView(c.program)}
                              className="text-[10px] font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-0.5 hover:underline"
                              title="View Production Sheet"
                            >
                              <FileText className="w-3 h-3" />
                              <span>Sheet</span>
                            </button>
                          )}
                          <span className="text-[10px] font-mono font-bold text-danger-600 bg-danger-50 px-1 py-0.5 rounded">
                            DEF-SHELF
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* LANE 5: REWORK RETURNED */}
          <div className="bg-accent-50/40 rounded-xl border border-accent-200 border-t-4 border-t-accent-500 flex flex-col min-h-[420px] md:h-[calc(100vh-250px)] shadow-xs">
            <div className="p-3 border-b border-accent-200/80 bg-white/70 rounded-t-lg flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-accent-700" />
                <h3 className="text-xs font-bold text-accent-800">5. Rework (TC)</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-accent-100 text-accent-800">
                {counts.rework}
              </span>
            </div>

            <div className="p-2 space-y-2.5 flex-1 overflow-y-auto">
              {filterCards(lanes.rework).length === 0 ? (
                <div className="h-32 border-2 border-dashed border-accent-200 rounded-lg flex items-center justify-center p-3 text-center">
                  <span className="text-[11px] text-neutral-500 font-mono">No rework lots</span>
                </div>
              ) : (
                filterCards(lanes.rework).map((c) => {
                  const qty = c.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
                  return (
                    <div
                      key={c.id}
                      className="bg-white rounded-lg p-3 border border-accent-300 shadow-2xs hover:shadow-xs transition space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-accent-800">{c.challanNumber}</span>
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-accent-100 text-accent-800">
                          REWORK
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-700">
                        <span className="font-semibold block truncate">
                          {c.program?.clientName || 'Standard Client'}
                        </span>
                        <span className="text-[10px] text-accent-800 block truncate font-medium">
                          Returned to Thread Cutting
                        </span>
                      </div>
                      <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px]">
                        <span className="font-mono font-bold text-accent-800">{qty} PCS</span>
                        <div className="flex items-center gap-2">
                          {c.program && (
                            <button
                              type="button"
                              onClick={() => setSelectedSheetForView(c.program)}
                              className="text-[10px] font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-0.5 hover:underline"
                              title="View Production Sheet"
                            >
                              <FileText className="w-3 h-3" />
                              <span>Sheet</span>
                            </button>
                          )}
                          <span className="text-[10px] text-neutral-500">Re-trim</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* PRODUCTION SHEET PRINT / TRAVELER MODAL */}
      {selectedSheetForView && (
        <ProductionSheetPrintModal
          program={selectedSheetForView}
          isOpen={!!selectedSheetForView}
          onClose={() => setSelectedSheetForView(null)}
        />
      )}
    </div>
  );
}
