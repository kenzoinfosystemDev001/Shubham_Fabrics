'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  RefreshCw,
  Briefcase,
  Kanban,
  Clock,
  Send,
  AlertCircle,
  Calendar,
  Layers,
  User,
  ArrowRight,
  TrendingUp,
  FileText,
  ShieldAlert,
  RotateCcw,
  PackageCheck,
  Archive,
  Scissors
} from 'lucide-react';
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';

export default function QC2Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/qc2/dashboard');
      if (!res.ok) {
        throw new Error('Failed to load QC2 dashboard data');
      }
      const json = await res.json();
      setData(json.data);
    } catch (err: any) {
      console.error('Error loading QC2 dashboard:', err);
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
    totalChallansReceived: 0,
    totalPcsReceived: 0,
    pendingInspectionCount: 0,
    underInspectionCount: 0,
    approvedChallansCount: 0,
    rejectedChallansCount: 0,
    reworkChallansCount: 0,
    totalInspectedPcs: 0,
    totalPassedPcs: 0,
    totalFailedPcs: 0,
    totalReworkPcs: 0,
    passRatePercent: '100.0',
    defectRatePercent: '0.0',
    reworkRatePercent: '0.0',
  };

  const challans = data?.challans || [];
  const defectiveReturns = data?.defectiveReturns || [];
  const reworkReturns = data?.reworkReturns || [];
  const transactions = data?.transactions || [];

  const pendingChallans = challans.filter((c: any) =>
    ['ISSUED', 'RECEIVED', 'UNDER_INSPECTION'].includes(c.status)
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
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 block drop-shadow-sm">
              SHUBHAM FABRICS MES · QUALITY CHECK 2 (QC2)
            </span>
            <h1 className="text-xl font-bold text-white flex items-center gap-2.5 drop-shadow-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>QC2 Department · Operations Center</span>
            </h1>
            <p className="text-xs text-slate-300 mt-0.5">
              Garment Inspection after Thread Cutting · Direct Rejection to Defected Shelf (DEF-SHELF-01)
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-lg border border-slate-700/60 transition"
              title="Refresh Dashboard"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <Link
              href="/qc2/my-work"
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
            >
              <Briefcase className="w-4 h-4" />
              <span>Inspection Terminal</span>
            </Link>

            <Link
              href="/qc2/floor-board"
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition"
            >
              <Kanban className="w-4 h-4 text-amber-400" />
              <span>Floor Board</span>
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

      {/* KPI METRICS STRIP */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 mt-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
          {/* Card 1: Incoming from Thread Cutting */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Incoming From TC
              </span>
              <Scissors className="w-4 h-4 text-cyan-600" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-slate-900">
              {summary.totalChallansReceived}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {summary.totalPcsReceived.toLocaleString()} Pieces Total
            </div>
          </div>

          {/* Card 2: Inspected */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Pieces Inspected
              </span>
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-blue-700">
              {summary.totalInspectedPcs.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {summary.pendingInspectionCount} Lots Pending
            </div>
          </div>

          {/* Card 3: Approved / Passed */}
          <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-2xs bg-emerald-50/20">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                Passed (Good PCS)
              </span>
              <PackageCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-emerald-700">
              {summary.totalPassedPcs.toLocaleString()}
            </div>
            <div className="text-[11px] text-emerald-700 font-semibold mt-0.5 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              <span>Pass Rate: {summary.passRatePercent}%</span>
            </div>
          </div>

          {/* Card 4: Defective Shelf (Rejected) */}
          <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-2xs bg-rose-50/20">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800">
                Defected Shelf
              </span>
              <ShieldAlert className="w-4 h-4 text-rose-600" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-rose-700">
              {summary.totalFailedPcs.toLocaleString()}
            </div>
            <div className="text-[11px] text-rose-600 font-semibold mt-0.5">
              Direct to DEF-SHELF-01
            </div>
          </div>

          {/* Card 5: Rework to Thread Cutting */}
          <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-2xs bg-amber-50/20">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                Rework / Re-trim
              </span>
              <RotateCcw className="w-4 h-4 text-amber-600" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-amber-700">
              {summary.totalReworkPcs.toLocaleString()}
            </div>
            <div className="text-[11px] text-amber-700 font-semibold mt-0.5">
              Returned to Thread Cutting
            </div>
          </div>
        </div>
      </div>

      {/* MAIN TWO-COLUMN CONTENT */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN (2 Cols): INCOMING QUEUE FROM THREAD CUTTING */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Scissors className="w-4 h-4 text-cyan-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Incoming Lots from Thread Cutting Section
                </h2>
              </div>
              <span className="text-xs font-mono font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                {pendingChallans.length} Pending
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[640px]">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-4 font-bold">Challan #</th>
                    <th className="py-2.5 px-4 font-bold">Program #</th>
                    <th className="py-2.5 px-4 font-bold">Client / Style</th>
                    <th className="py-2.5 px-4 font-bold">Quantity</th>
                    <th className="py-2.5 px-4 font-bold">Status</th>
                    <th className="py-2.5 px-4 font-bold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingChallans.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                        No pending challans from Thread Cutting.
                      </td>
                    </tr>
                  ) : (
                    pendingChallans.map((c: any) => {
                      const totalQty = c.items.reduce(
                        (s: number, it: any) => s + (Number(it.quantity) || 0),
                        0
                      );
                      const uom = c.items[0]?.uom || 'PCS';
                      return (
                        <tr key={c.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {c.challanNumber}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600">
                            {c.program?.programSerialNo || c.program?.programNumber || '—'}
                          </td>
                          <td className="py-3 px-4 text-slate-700">
                            <span className="font-semibold block truncate">
                              {c.program?.clientName || c.program?.buyerName || 'Standard Client'}
                            </span>
                            <span className="text-[10px] text-slate-500 block truncate">
                              {c.program?.mainStyle || c.program?.styleCode || 'General Style'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {totalQty.toLocaleString()} {uom}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                c.status === 'UNDER_INSPECTION'
                                  ? 'bg-blue-100 text-blue-800'
                                  : c.status === 'RECEIVED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {c.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Link
                              href={`/qc2/my-work?challanId=${c.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold transition shadow-2xs"
                            >
                              <span>Inspect</span>
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* DIRECT DEFECTIVE SHELF DISPATCHES LOG */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-rose-50/30">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Direct Defective Shelf Returns (DEF-SHELF-01)
                </h2>
              </div>
              <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                Strictly Quarantined
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[640px]">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-4 font-bold">Return Slip #</th>
                    <th className="py-2.5 px-4 font-bold">Sheet #</th>
                    <th className="py-2.5 px-4 font-bold">Quantity</th>
                    <th className="py-2.5 px-4 font-bold">Shelf Target</th>
                    <th className="py-2.5 px-4 font-bold">Reason / Defect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {defectiveReturns.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400 text-xs">
                        No rejected lots sent to defective shelf yet.
                      </td>
                    </tr>
                  ) : (
                    defectiveReturns.map((dr: any) => {
                      const qty = dr.items.reduce(
                        (s: number, it: any) => s + (Number(it.quantity) || 0),
                        0
                      );
                      return (
                        <tr key={dr.id} className="hover:bg-rose-50/20 transition">
                          <td className="py-2.5 px-4 font-mono font-bold text-rose-900">
                            {dr.challanNumber}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-slate-600">
                            {dr.program?.programSerialNo || dr.program?.programNumber || '—'}
                          </td>
                          <td className="py-2.5 px-4 font-mono font-bold text-rose-700">
                            {qty} PCS
                          </td>
                          <td className="py-2.5 px-4">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 text-rose-800">
                              DEF-SHELF-01
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-600 text-[11px] truncate max-w-xs">
                            {dr.remarks || dr.items[0]?.remarks || 'Defect Quarantine'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (1 Col): INSPECTION WORKFLOW & QUICK STATS */}
        <div className="space-y-6">
          {/* WORKFLOW GUIDE */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>QC2 Pipeline &amp; Routing Rules</span>
            </h3>

            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex items-start gap-2.5 p-2 rounded-lg bg-cyan-50/60 border border-cyan-100">
                <span className="font-bold text-cyan-800 font-mono text-[11px]">1.</span>
                <div>
                  <strong className="text-cyan-900">Thread Cutting Inflow:</strong> Receive cleaned and trimmed piece bundles with challan from Thread Cutting.
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2 rounded-lg bg-blue-50/60 border border-blue-100">
                <span className="font-bold text-blue-800 font-mono text-[11px]">2.</span>
                <div>
                  <strong className="text-blue-900">QC2 Piece Inspection:</strong> Verify stitch quality, embroidery alignment, dimensions, loose threads, and needle holes.
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2 rounded-lg bg-rose-50/60 border border-rose-100">
                <span className="font-bold text-rose-800 font-mono text-[11px]">3.</span>
                <div>
                  <strong className="text-rose-900">Rejections:</strong> Defective pieces go directly to <span className="font-mono font-bold">Fabric Store Defected Shelf (DEF-SHELF-01)</span> automatically.
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2 rounded-lg bg-amber-50/60 border border-amber-100">
                <span className="font-bold text-amber-800 font-mono text-[11px]">4.</span>
                <div>
                  <strong className="text-amber-900">Rework:</strong> Pieces with repairable trimming or thread defects return to Thread Cutting for alteration.
                </div>
              </div>
            </div>
          </div>

          {/* RECENT INSPECTION TRANSACTIONS */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Recent QC2 Transactions
              </span>
              <Clock className="w-3.5 h-3.5 text-slate-400" />
            </div>

            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {transactions.length === 0 ? (
                <p className="p-4 text-center text-xs text-slate-400">
                  No inspection transactions recorded yet.
                </p>
              ) : (
                transactions.map((tx: any) => (
                  <div key={tx.id} className="p-3 hover:bg-slate-50 transition space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-slate-800">
                        {tx.inputQuantity} PCS Checked
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {new Date(tx.recordedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-emerald-700 font-semibold">
                        ✓ {tx.goodQuantity} Passed
                      </span>
                      {tx.rejectQuantity > 0 && (
                        <span className="text-rose-700 font-semibold">
                          ✗ {tx.rejectQuantity} Defected
                        </span>
                      )}
                      {tx.reworkQuantity > 0 && (
                        <span className="text-amber-700 font-semibold">
                          ↺ {tx.reworkQuantity} Rework
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
