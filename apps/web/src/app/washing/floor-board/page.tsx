'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Waves,
  Kanban,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  PackageCheck,
  Thermometer,
  Wind,
  Layers,
  ArrowRight
} from 'lucide-react';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';

export default function WashingFloorBoard() {
  const [loading, setLoading] = useState(true);
  const [lanes, setLanes] = useState<{
    incoming: any[];
    inWasher: any[];
    hydroDrying: any[];
    qualityChecked: any[];
    dispatched: any[];
  }>({
    incoming: [],
    inWasher: [],
    hydroDrying: [],
    qualityChecked: [],
    dispatched: [],
  });
  const [counts, setCounts] = useState<any>({
    incoming: 0,
    inWasher: 0,
    hydroDrying: 0,
    qualityChecked: 0,
    dispatched: 0,
    total: 0,
  });
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [selectedSheetForView, setSelectedSheetForView] = useState<any | null>(null);

  const loadBoard = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/washing/floor-board');
      if (!res.ok) {
        throw new Error('Failed to load Washing Floor Board data.');
      }
      const json = await res.json();
      setLanes(json.data?.lanes || { incoming: [], inWasher: [], hydroDrying: [], qualityChecked: [], dispatched: [] });
      setCounts(json.data?.counts || { incoming: 0, inWasher: 0, hydroDrying: 0, qualityChecked: 0, dispatched: 0, total: 0 });
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
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-600 block drop-shadow-sm">
              SHUBHAM FABRICS MES · WASHING FLOOR BOARD
            </span>
            <h1 className="text-xl font-bold text-neutral-900 flex items-center gap-2.5 drop-shadow-sm">
              <Kanban className="w-5 h-5 text-brand-600" />
              <span>Live Drum & Washing Floor Swimlanes</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadBoard}
              disabled={loading}
              className="p-2 rounded-lg bg-neutral-50 hover:bg-neutral-200 text-neutral-900 transition border border-neutral-200 flex items-center gap-1.5 text-xs font-semibold shadow-xs"
              title="Refresh Swimlanes"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-600' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <Link
              href="/washing/my-work"
              className="px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
            >
              <Waves className="w-4 h-4" />
              <span>Washing Terminal</span>
            </Link>
          </div>
        </div>
      </header>

      {/* FILTER & SWIMLANES */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-4">
        {/* SEARCH BAR */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="Search by challan, sheet #, client or style..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-neutral-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-brand-500 shadow-2xs"
            />
          </div>
          <div className="text-xs text-neutral-500 font-mono">
            Total active lots: <strong className="text-neutral-900">{counts.total}</strong>
          </div>
        </div>

        {error && (
          <div className="bg-danger-50 border border-danger-200 rounded-xl p-3 flex items-center gap-2 text-danger-800 text-xs">
            <AlertCircle className="w-4 h-4 text-danger-600" />
            <span>{error}</span>
          </div>
        )}

        {/* 5 SWIMLANES */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5 items-start">
          {/* LANE 1: INCOMING LOTS */}
          <div className="bg-neutral-100/90 rounded-xl border border-neutral-200 border-t-4 border-t-brand-500 flex flex-col min-h-[420px] md:h-[calc(100vh-250px)] shadow-xs">
            <div className="p-3 border-b border-neutral-200/80 bg-white/70 rounded-t-lg flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Waves className="w-4 h-4 text-brand-600" />
                <h3 className="text-xs font-bold text-neutral-900">1. Incoming Lots</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-brand-100 text-brand-800">
                {counts.incoming}
              </span>
            </div>

            <div className="p-2 space-y-2.5 flex-1 overflow-y-auto">
              {filterCards(lanes.incoming).length === 0 ? (
                <div className="h-32 border-2 border-dashed border-neutral-200 rounded-lg flex items-center justify-center p-3 text-center">
                  <span className="text-[11px] text-neutral-500 font-mono">No incoming lots</span>
                </div>
              ) : (
                filterCards(lanes.incoming).map((c) => {
                  const qty = c.fabricIn || c.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
                  return (
                    <div
                      key={c.id}
                      className="bg-white rounded-lg p-3 border border-neutral-200 shadow-2xs hover:shadow-xs transition space-y-2"
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
                        <span className="font-mono font-bold text-neutral-900">{qty} PCS In</span>
                        <div className="flex items-center gap-1.5">
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
                            href={`/washing/my-work?challanId=${c.id}`}
                            className="text-[10px] font-bold text-brand-700 hover:underline flex items-center gap-0.5"
                          >
                            <span>Wash →</span>
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* LANE 2: IN WASHER / DRUM */}
          <div className="bg-neutral-100/90 rounded-xl border border-neutral-200 border-t-4 border-t-brand-500 flex flex-col min-h-[420px] md:h-[calc(100vh-250px)] shadow-xs">
            <div className="p-3 border-b border-neutral-200/80 bg-white/70 rounded-t-lg flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Thermometer className="w-4 h-4 text-brand-600" />
                <h3 className="text-xs font-bold text-neutral-900">2. In Drum Washer</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-brand-100 text-brand-800">
                {counts.inWasher}
              </span>
            </div>

            <div className="p-2 space-y-2.5 flex-1 overflow-y-auto">
              {filterCards(lanes.inWasher).length === 0 ? (
                <div className="h-32 border-2 border-dashed border-neutral-200 rounded-lg flex items-center justify-center p-3 text-center">
                  <span className="text-[11px] text-neutral-500 font-mono">No lots in washer</span>
                </div>
              ) : (
                filterCards(lanes.inWasher).map((c) => {
                  const qty = c.fabricIn || c.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
                  return (
                    <div
                      key={c.id}
                      className="bg-white rounded-lg p-3 border border-brand-300 shadow-2xs hover:shadow-xs transition space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-brand-900">{c.challanNumber}</span>
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 animate-pulse">
                          Washing
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
                        <div className="flex items-center gap-1.5">
                          {c.program && (
                            <button
                              type="button"
                              onClick={() => setSelectedSheetForView(c.program)}
                              className="text-[10px] font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-0.5 hover:underline"
                            >
                              <FileText className="w-3 h-3" />
                              <span>Sheet</span>
                            </button>
                          )}
                          <Link
                            href={`/washing/my-work?challanId=${c.id}`}
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

          {/* LANE 3: HYDRO DRYING */}
          <div className="bg-neutral-100/90 rounded-xl border border-neutral-200 border-t-4 border-t-accent-500 flex flex-col min-h-[420px] md:h-[calc(100vh-250px)] shadow-xs">
            <div className="p-3 border-b border-neutral-200/80 bg-white/70 rounded-t-lg flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Wind className="w-4 h-4 text-accent-700" />
                <h3 className="text-xs font-bold text-neutral-900">3. Hydro & Drying</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-accent-100 text-accent-800">
                {counts.hydroDrying}
              </span>
            </div>

            <div className="p-2 space-y-2.5 flex-1 overflow-y-auto">
              {filterCards(lanes.hydroDrying).length === 0 ? (
                <div className="h-32 border-2 border-dashed border-neutral-200 rounded-lg flex items-center justify-center p-3 text-center">
                  <span className="text-[11px] text-neutral-500 font-mono">No lots in hydro dryer</span>
                </div>
              ) : (
                filterCards(lanes.hydroDrying).map((c) => {
                  const qty = c.fabricIn || c.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
                  return (
                    <div
                      key={c.id}
                      className="bg-white rounded-lg p-3 border border-accent-300 shadow-2xs hover:shadow-xs transition space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-accent-800">{c.challanNumber}</span>
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-accent-100 text-accent-800">
                          Drying
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
                        <span className="font-mono font-bold text-accent-800">{qty} PCS</span>
                        <div className="flex items-center gap-1.5">
                          {c.program && (
                            <button
                              type="button"
                              onClick={() => setSelectedSheetForView(c.program)}
                              className="text-[10px] font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-0.5 hover:underline"
                            >
                              <FileText className="w-3 h-3" />
                              <span>Sheet</span>
                            </button>
                          )}
                          <Link
                            href={`/washing/my-work?challanId=${c.id}`}
                            className="px-2 py-0.5 bg-accent-400 hover:bg-accent-500 text-neutral-900 rounded text-[10px] font-semibold"
                          >
                            Details
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* LANE 4: QUALITY CHECKED & BARCODE TAGGED */}
          <div className="bg-neutral-100/90 rounded-xl border border-neutral-200 border-t-4 border-t-accent-500 flex flex-col min-h-[420px] md:h-[calc(100vh-250px)] shadow-xs">
            <div className="p-3 border-b border-neutral-200/80 bg-white/70 rounded-t-lg flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-accent-700" />
                <h3 className="text-xs font-bold text-neutral-900">4. Washed & Tagged</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-accent-100 text-accent-800">
                {counts.qualityChecked}
              </span>
            </div>

            <div className="p-2 space-y-2.5 flex-1 overflow-y-auto">
              {filterCards(lanes.qualityChecked).length === 0 ? (
                <div className="h-32 border-2 border-dashed border-neutral-200 rounded-lg flex items-center justify-center p-3 text-center">
                  <span className="text-[11px] text-neutral-500 font-mono">No lots ready for dispatch</span>
                </div>
              ) : (
                filterCards(lanes.qualityChecked).map((c) => {
                  const outQty = c.fabricOut || c.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
                  return (
                    <div
                      key={c.id}
                      className="bg-white rounded-lg p-3 border border-accent-300 shadow-2xs hover:shadow-xs transition space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-neutral-900">{c.challanNumber}</span>
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-accent-100 text-accent-800">
                          READY
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
                        <span className="font-mono font-bold text-accent-800">{outQty} PCS Out</span>
                        <div className="flex items-center gap-1.5">
                          {c.program && (
                            <button
                              type="button"
                              onClick={() => setSelectedSheetForView(c.program)}
                              className="text-[10px] font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-0.5 hover:underline"
                            >
                              <FileText className="w-3 h-3" />
                              <span>Sheet</span>
                            </button>
                          )}
                          <Link
                            href={`/washing/my-work?challanId=${c.id}&action=handover`}
                            className="px-2 py-0.5 bg-accent-400 hover:bg-accent-500 text-neutral-900 rounded text-[10px] font-semibold"
                          >
                            Handover →
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* LANE 5: DISPATCHED TO FINISHING */}
          <div className="bg-neutral-100/90 rounded-xl border border-neutral-200 border-t-4 border-t-brand-500 flex flex-col min-h-[420px] md:h-[calc(100vh-250px)] shadow-xs">
            <div className="p-3 border-b border-neutral-200/80 bg-white/70 rounded-t-lg flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <PackageCheck className="w-4 h-4 text-brand-600" />
                <h3 className="text-xs font-bold text-neutral-900">5. Dispatched</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-brand-100 text-brand-800">
                {counts.dispatched}
              </span>
            </div>

            <div className="p-2 space-y-2.5 flex-1 overflow-y-auto">
              {filterCards(lanes.dispatched).length === 0 ? (
                <div className="h-32 border-2 border-dashed border-neutral-200 rounded-lg flex items-center justify-center p-3 text-center">
                  <span className="text-[11px] text-neutral-500 font-mono">No dispatched lots</span>
                </div>
              ) : (
                filterCards(lanes.dispatched).map((c) => {
                  const outQty = c.fabricOut || c.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
                  return (
                    <div
                      key={c.id}
                      className="bg-white rounded-lg p-3 border border-brand-200 shadow-2xs hover:shadow-xs transition space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-brand-900">{c.challanNumber}</span>
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-brand-100 text-brand-800">
                          SENT
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
                        <span className="font-mono font-bold text-brand-700">{outQty} PCS</span>
                        <div className="flex items-center gap-1.5">
                          {c.program && (
                            <button
                              type="button"
                              onClick={() => setSelectedSheetForView(c.program)}
                              className="text-[10px] font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-0.5 hover:underline"
                            >
                              <FileText className="w-3 h-3" />
                              <span>Sheet</span>
                            </button>
                          )}
                          <span className="text-[10px] text-neutral-500">To Finishing</span>
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
