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
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';
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
    <div className="min-h-screen bg-[#FDFBF7] pb-16">
      {/* TOP HEADER */}
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
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400 block drop-shadow-sm">
              SHUBHAM FABRICS MES · WASHING & DRYING DEPARTMENT
            </span>
            <h1 className="text-xl font-bold text-white flex items-center gap-2.5 drop-shadow-sm">
              <Waves className="w-5 h-5 text-cyan-400" />
              <span>Washing Operations Control Dashboard</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 transition border border-slate-600/50 flex items-center gap-1.5 text-xs font-semibold shadow-xs"
              title="Refresh Live Metrics"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <Link
              href="/washing/my-work"
              className="px-3 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
            >
              <Briefcase className="w-4 h-4" />
              <span>Work Center</span>
            </Link>

            <Link
              href="/washing/floor-board"
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold border border-slate-600/60 transition flex items-center gap-1.5"
            >
              <Kanban className="w-4 h-4 text-cyan-400" />
              <span>Floor Board</span>
            </Link>

            <Link
              href="/washing/my-work?tab=PRODUCTION_SHEETS"
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg text-xs font-semibold border border-cyan-500/40 transition flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4 text-cyan-400" />
              <span>Production Sheets</span>
            </Link>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3 text-rose-800 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* 4 CORE KPI METRICS CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* 1. PIECE IN */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span className="font-semibold uppercase tracking-wider text-[10px] text-cyan-700">Total Piece In</span>
              <div className="w-7 h-7 rounded-lg bg-cyan-50 text-cyan-700 flex items-center justify-center">
                <Waves className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold font-mono text-slate-900">
              {summary.totalPieceIn.toLocaleString()} <span className="text-xs font-normal text-slate-500">PCS</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-600">
              <span className="font-semibold text-cyan-700 font-mono">{summary.totalIncomingChallans}</span>
              <span>incoming lots received</span>
            </div>
          </div>

          {/* 2. PIECE OUT */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span className="font-semibold uppercase tracking-wider text-[10px] text-emerald-700">Total Piece Out</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold font-mono text-emerald-700">
              {summary.totalPieceOut.toLocaleString()} <span className="text-xs font-normal text-slate-500">PCS</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-600">
              <span className="font-semibold text-emerald-700 font-mono">{summary.readyForDispatchLots}</span>
              <span>ready for dispatch</span>
            </div>
          </div>

          {/* 3. SHRINKAGE & DEFECT RATE */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span className="font-semibold uppercase tracking-wider text-[10px] text-amber-700">Shrinkage / Loss</span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold font-mono text-amber-700">
              {summary.shrinkageRatePercent}%
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-600">
              <span className="font-semibold text-rose-600 font-mono">{summary.totalDefectivePieces} PCS</span>
              <span>loss / defective pieces</span>
            </div>
          </div>

          {/* 4. DISPATCHED TO FINISHING */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span className="font-semibold uppercase tracking-wider text-[10px] text-blue-700">Dispatched Lots</span>
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                <PackageCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold font-mono text-blue-700">
              {summary.dispatchedChallansCount} <span className="text-xs font-normal text-slate-500">LOTS</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-600">
              <span className="font-semibold text-blue-700 font-mono">{summary.activeWashingLots}</span>
              <span>lots currently in drum/hydro</span>
            </div>
          </div>
        </div>

        {/* WORKFLOW BANNER & QUICK LINKS */}
        <div className="bg-gradient-to-r from-sky-900 to-slate-900 rounded-2xl p-5 text-white shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center md:text-left">
            <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">
              Washing Mandatory Protocol
            </span>
            <h2 className="text-base font-bold text-white">
              Piece In → Washing Barcode Tag → Piece Out → Handover to Finishing
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl">
              All received pieces are tracked with exact Piece In count, assigned a unique Washing Barcode sticker,
              processed through designated wash recipes (Enzyme, Bio-Polish, Silicon Softener), and reconciled with Piece Out.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/washing/my-work"
              className="px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition flex items-center gap-2"
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
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Waves className="w-4 h-4 text-cyan-600" />
                  <h3 className="text-sm font-bold text-slate-900">Incoming Lots for Washing</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-100 text-cyan-800">
                    {pendingWashes.length} Pending
                  </span>
                </div>
                <Link
                  href="/washing/my-work"
                  className="text-xs font-semibold text-cyan-700 hover:underline flex items-center gap-1"
                >
                  <span>View All In Work Center</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {pendingWashes.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <CheckCircle2 className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-medium">All incoming lots have been processed through washing.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {pendingWashes.slice(0, 6).map((c: any) => {
                    const pIn = c.fabricIn || c.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
                    return (
                      <div key={c.id} className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition rounded-lg px-2">
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-slate-900">{c.challanNumber}</span>
                            <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700">
                              {c.status}
                            </span>
                            <span className="text-[10px] font-mono text-cyan-700 font-semibold">
                              From: {c.fromDepartment}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 truncate">
                            <span className="font-semibold text-slate-800">
                              {c.program?.clientName || 'Standard Client'}
                            </span>
                            {' · '}
                            <span>{c.program?.mainStyle || c.program?.styleCode || 'General Lot'}</span>
                            {' · Sheet #'}
                            <span className="font-mono font-semibold text-slate-900">
                              {c.program?.programSerialNo || c.program?.programNumber || '—'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <span className="font-mono font-bold text-xs text-slate-900">{pIn} PCS</span>
                            <span className="text-[10px] text-slate-400 block">Piece In</span>
                          </div>

                          {c.program && (
                            <button
                              type="button"
                              onClick={() => setSelectedSheetForView(c.program)}
                              className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                              title="View Production Sheet Traveler"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Sheet</span>
                            </button>
                          )}

                          <Link
                            href={`/washing/my-work?challanId=${c.id}`}
                            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
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
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <PackageCheck className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-900">Recent Dispatches to Finishing / Store</h3>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {dispatchedChallans.length} Total Handed Over
                </span>
              </div>

              {dispatchedChallans.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No outgoing handover challans generated yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {dispatchedChallans.slice(0, 5).map((c: any) => {
                    const outQty = c.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
                    return (
                      <div key={c.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-mono font-bold text-slate-900">{c.challanNumber}</span>
                          <span className="text-slate-500 ml-2">→ To: {c.toDepartment}</span>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            Sheet: {c.program?.programSerialNo || c.program?.programNumber || '—'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-emerald-700">{outQty} PCS</span>
                          {c.program && (
                            <button
                              type="button"
                              onClick={() => setSelectedSheetForView(c.program)}
                              className="p-1 hover:bg-slate-100 rounded text-slate-500"
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
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-600" />
                  <h3 className="text-sm font-bold text-slate-900">Recent Wash Cycles</h3>
                </div>
                <span className="text-[10px] font-mono text-slate-400">Live Logs</span>
              </div>

              {washingTransactions.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
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
                        className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 truncate">
                            {tx.operationName || 'Soft Wash'}
                          </span>
                          <span className="text-[10px] font-mono text-cyan-800 font-semibold bg-cyan-100 px-1.5 py-0.5 rounded">
                            {tx.machineId || 'DRUM-01'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-600 font-mono">
                          <span>In: {tx.inputQuantity} PCS</span>
                          <span className="text-emerald-700 font-bold">Out: {tx.goodQuantity} PCS</span>
                          {tx.rejectQuantity > 0 && (
                            <span className="text-rose-600 font-semibold">Loss: {tx.rejectQuantity} PCS</span>
                          )}
                        </div>
                        {parsedNotes.washingBarcode && (
                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-200/60">
                            <Barcode className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-bold text-slate-700">{parsedNotes.washingBarcode}</span>
                            {parsedNotes.shrinkageRate && (
                              <span className="text-amber-700 font-semibold ml-auto">
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
            <div className="bg-sky-50/70 border border-sky-200/80 rounded-2xl p-4 text-xs space-y-2">
              <span className="font-bold text-sky-900 uppercase tracking-wider text-[10px] block">
                Standard Washing Protocol
              </span>
              <ul className="space-y-1 text-slate-700 list-disc list-inside">
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
