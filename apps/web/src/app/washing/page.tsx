'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Waves,
  RefreshCw,
  Briefcase,
  Kanban,
  Clock,
  Send,
  AlertCircle,
  Calendar,
  Layers,
  ArrowRight,
  TrendingDown,
  FileText,
  PackageCheck,
  Archive,
  Barcode,
  Thermometer,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';

export default function WashingDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedSheetForView, setSelectedSheetForView] = useState<any | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/washing/dashboard');
      if (!res.ok) {
        throw new Error('Failed to load Washing dashboard data');
      }
      const json = await res.json();
      setData(json.data);
    } catch (err: any) {
      console.error('Error loading Washing dashboard:', err);
      setError(err.message || 'Error connecting to database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('subham_mes_user');
      if (savedUser) {
        try {
          setCurrentUser(JSON.parse(savedUser));
        } catch {}
      }
    }
    loadData();
  }, []);

  const summary = data?.summary || {
    totalIncomingChallans: 0,
    totalPieceIn: 0,
    totalPieceOut: 0,
    totalDefectivePieces: 0,
    activeWashingLots: 0,
    readyForDispatchLots: 0,
    completedLots: 0,
    dispatchedChallansCount: 0,
    shrinkageRatePercent: '0.00',
  };

  const incomingChallans = data?.incomingChallans || [];
  const dispatchedChallans = data?.dispatchedChallans || [];
  const washingTransactions = data?.washingTransactions || [];

  const pendingWashes = incomingChallans.filter((c: any) =>
    ['ISSUED', 'RECEIVED', 'IN_PROCESS'].includes(c.status)
  );

  return (
    <div className="min-h-screen bg-neutral-50 pb-16">
      {/* TOP HEADER */}
      <header
        className="bg-white border-b border-neutral-200 sticky top-0 z-30 px-4 sm:px-8 py-4 shadow-md text-neutral-900"
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-600 block drop-shadow-sm">
              SHUBHAM FABRICS MES · WASHING & DRYING DEPARTMENT
            </span>
            <h1 className="text-xl font-bold text-neutral-900 flex items-center gap-2.5 drop-shadow-sm">
              <Waves className="w-5 h-5 text-brand-600" />
              <span>Washing Operations Control Dashboard</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-lg bg-neutral-50 hover:bg-neutral-200 text-neutral-900 transition border border-neutral-200 flex items-center gap-1.5 text-xs font-semibold shadow-xs"
              title="Refresh Live Metrics"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-600' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <Link
              href="/washing/my-work"
              className="px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
            >
              <Briefcase className="w-4 h-4" />
              <span>Work Center</span>
            </Link>

            <Link
              href="/washing/floor-board"
              className="px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold border border-neutral-200 transition flex items-center gap-1.5"
            >
              <Kanban className="w-4 h-4 text-brand-600" />
              <span>Floor Board</span>
            </Link>

            <Link
              href="/washing/my-work?tab=PRODUCTION_SHEETS"
              className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-brand-600 rounded-lg text-xs font-semibold border border-brand-500/40 transition flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4 text-brand-600" />
              <span>Production Sheets</span>
            </Link>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        {error && (
          <div className="bg-danger-50 border border-danger-200 rounded-xl p-4 flex items-center gap-3 text-danger-800 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 text-danger-600" />
            <span>{error}</span>
          </div>
        )}

        {/* 4 CORE KPI METRICS CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* 1. PIECE IN */}
          <div className="bg-white rounded-xl border border-neutral-200/90 p-4 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
              <span className="font-semibold uppercase tracking-wider text-[10px] text-brand-700">Total Piece In</span>
              <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center">
                <Waves className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold font-mono text-neutral-900">
              {summary.totalPieceIn.toLocaleString()} <span className="text-xs font-normal text-neutral-500">PCS</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-neutral-600">
              <span className="font-semibold text-brand-700 font-mono">{summary.totalIncomingChallans}</span>
              <span>incoming lots received</span>
            </div>
          </div>

          {/* 2. PIECE OUT */}
          <div className="bg-white rounded-xl border border-neutral-200/90 p-4 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
              <span className="font-semibold uppercase tracking-wider text-[10px] text-neutral-700">Total Piece Out</span>
              <div className="w-7 h-7 rounded-lg bg-accent-50 text-accent-800 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold font-mono text-neutral-900">
              {summary.totalPieceOut.toLocaleString()} <span className="text-xs font-normal text-neutral-500">PCS</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-neutral-600">
              <span className="font-semibold text-accent-800 font-mono">{summary.readyForDispatchLots}</span>
              <span>ready for dispatch</span>
            </div>
          </div>

          {/* 3. SHRINKAGE & DEFECT RATE */}
          <div className="bg-white rounded-xl border border-neutral-200/90 p-4 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
              <span className="font-semibold uppercase tracking-wider text-[10px] text-neutral-700">Shrinkage / Loss</span>
              <div className="w-7 h-7 rounded-lg bg-accent-50 text-accent-800 flex items-center justify-center">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold font-mono text-neutral-900">
              {summary.shrinkageRatePercent}%
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-neutral-600">
              <span className="font-semibold text-danger-600 font-mono">{summary.totalDefectivePieces} PCS</span>
              <span>loss / defective pieces</span>
            </div>
          </div>

          {/* 4. DISPATCHED TO FINISHING */}
          <div className="bg-white rounded-xl border border-neutral-200/90 p-4 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
              <span className="font-semibold uppercase tracking-wider text-[10px] text-brand-700">Dispatched Lots</span>
              <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center">
                <PackageCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold font-mono text-brand-700">
              {summary.dispatchedChallansCount} <span className="text-xs font-normal text-neutral-500">LOTS</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-neutral-600">
              <span className="font-semibold text-brand-700 font-mono">{summary.activeWashingLots}</span>
              <span>lots currently in drum/hydro</span>
            </div>
          </div>
        </div>

        {/* WORKFLOW BANNER & QUICK LINKS */}
        <div className="bg-brand-800 rounded-2xl p-5 text-white shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center md:text-left">
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-600">
              Washing Mandatory Protocol
            </span>
            <h2 className="text-base font-bold text-neutral-900">
              Piece In → Washing Barcode Tag → Piece Out → Handover to Finishing
            </h2>
            <p className="text-xs text-neutral-700 max-w-2xl">
              All received pieces are tracked with exact Piece In count, assigned a unique Washing Barcode sticker,
              processed through designated wash recipes (Enzyme, Bio-Polish, Silicon Softener), and reconciled with Piece Out.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/washing/my-work"
              className="px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-neutral-900 font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-2"
            >
              <span>Open Washing Terminal</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* MAIN SPLIT: INCOMING LOTS (LEFT) & RECENT ACTIVITY (RIGHT) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT 2 COLUMNS: INCOMING LOTS PENDING WASHING */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-neutral-200/90 p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <Waves className="w-4 h-4 text-brand-600" />
                  <h3 className="text-sm font-bold text-neutral-900">Incoming Lots for Washing</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-brand-100 text-brand-800">
                    {pendingWashes.length} Pending
                  </span>
                </div>
                <Link
                  href="/washing/my-work"
                  className="text-xs font-semibold text-brand-700 hover:underline flex items-center gap-1"
                >
                  <span>View All In Work Center</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {pendingWashes.length === 0 ? (
                <div className="py-12 text-center text-neutral-500">
                  <CheckCircle2 className="w-10 h-10 mx-auto text-neutral-700 mb-2" />
                  <p className="text-xs font-medium">All incoming lots have been processed through washing.</p>
                </div>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {pendingWashes.slice(0, 6).map((c: any) => {
                    const pIn = c.fabricIn || c.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
                    return (
                      <div key={c.id} className="py-3 flex items-center justify-between gap-3 hover:bg-neutral-50/60 transition rounded-lg px-2">
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-neutral-900">{c.challanNumber}</span>
                            <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-700">
                              {c.status}
                            </span>
                            <span className="text-[10px] font-mono text-brand-700 font-semibold">
                              From: {c.fromDepartment}
                            </span>
                          </div>
                          <div className="text-xs text-neutral-600 truncate">
                            <span className="font-semibold text-neutral-900">
                              {c.program?.clientName || 'Standard Client'}
                            </span>
                            {' · '}
                            <span>{c.program?.mainStyle || c.program?.styleCode || 'General Lot'}</span>
                            {' · Sheet #'}
                            <span className="font-mono font-semibold text-neutral-900">
                              {c.program?.programSerialNo || c.program?.programNumber || '—'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <span className="font-mono font-bold text-xs text-neutral-900">{pIn} PCS</span>
                            <span className="text-[10px] text-neutral-500 block">Piece In</span>
                          </div>

                          {c.program && (
                            <button
                              type="button"
                              onClick={() => setSelectedSheetForView(c.program)}
                              className="px-2.5 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                              title="View Production Sheet Traveler"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Sheet</span>
                            </button>
                          )}

                          <Link
                            href={`/washing/my-work?challanId=${c.id}`}
                            className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
                          >
                            Wash Process →
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* HANDED OVER CHALLANS TO FINISHING */}
            <div className="bg-white rounded-2xl border border-neutral-200/90 p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <PackageCheck className="w-4 h-4 text-accent-700" />
                  <h3 className="text-sm font-bold text-neutral-900">Recent Dispatches to Finishing / Store</h3>
                </div>
                <span className="text-xs text-neutral-500 font-mono">
                  {dispatchedChallans.length} Total Handed Over
                </span>
              </div>

              {dispatchedChallans.length === 0 ? (
                <div className="py-8 text-center text-neutral-500 text-xs">
                  No outgoing handover challans generated yet.
                </div>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {dispatchedChallans.slice(0, 5).map((c: any) => {
                    const outQty = c.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
                    return (
                      <div key={c.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-mono font-bold text-neutral-900">{c.challanNumber}</span>
                          <span className="text-neutral-500 ml-2">→ To: {c.toDepartment}</span>
                          <span className="text-[10px] text-neutral-500 block font-mono">
                            Sheet: {c.program?.programSerialNo || c.program?.programNumber || '—'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-accent-800">{outQty} PCS</span>
                          {c.program && (
                            <button
                              type="button"
                              onClick={() => setSelectedSheetForView(c.program)}
                              className="p-1 hover:bg-neutral-100 rounded text-neutral-500"
                              title="View Production Sheet"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: RECENT WASH RUN AUDIT LOG */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-neutral-200/90 p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-neutral-600" />
                  <h3 className="text-sm font-bold text-neutral-900">Recent Wash Cycles</h3>
                </div>
                <span className="text-[10px] font-mono text-neutral-500">Live Logs</span>
              </div>

              {washingTransactions.length === 0 ? (
                <div className="py-8 text-center text-neutral-500 text-xs">
                  No wash transactions recorded yet.
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  {washingTransactions.slice(0, 6).map((tx: any) => {
                    let parsedNotes: any = {};
                    try {
                      parsedNotes = JSON.parse(tx.notes || '{}');
                    } catch {}
                    return (
                      <div
                        key={tx.id}
                        className="p-3 rounded-xl bg-neutral-50 border border-neutral-100 space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-neutral-900 truncate">
                            {tx.operationName || 'Soft Wash'}
                          </span>
                          <span className="text-[10px] font-mono text-brand-800 font-semibold bg-brand-100 px-1.5 py-0.5 rounded">
                            {tx.machineId || 'DRUM-01'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-neutral-600 font-mono">
                          <span>In: {tx.inputQuantity} PCS</span>
                          <span className="text-accent-800 font-bold">Out: {tx.goodQuantity} PCS</span>
                          {tx.rejectQuantity > 0 && (
                            <span className="text-danger-600 font-semibold">Loss: {tx.rejectQuantity} PCS</span>
                          )}
                        </div>
                        {parsedNotes.washingBarcode && (
                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-neutral-500 pt-1 border-t border-neutral-200/60">
                            <Barcode className="w-3.5 h-3.5 text-neutral-500" />
                            <span className="font-bold text-neutral-700">{parsedNotes.washingBarcode}</span>
                            {parsedNotes.shrinkageRate && (
                              <span className="text-accent-800 font-semibold ml-auto">
                                Shrinkage: {parsedNotes.shrinkageRate}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* QUICK PROTOCOL GUIDE */}
            <div className="bg-brand-50/70 border border-brand-200/80 rounded-2xl p-4 text-xs space-y-2">
              <span className="font-bold text-brand-900 uppercase tracking-wider text-[10px] block">
                Standard Washing Protocol
              </span>
              <ul className="space-y-1 text-neutral-700 list-disc list-inside">
                <li>Check Piece In against QC2 Challan slip.</li>
                <li>Assign unique Washing Barcode tag (`WB-...`).</li>
                <li>Record Drum ID, Recipe, Water Temp, & Duration.</li>
                <li>Count Piece Out and calculate Shrinkage %.</li>
                <li>Handover directly to Finishing / Packing.</li>
              </ul>
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
