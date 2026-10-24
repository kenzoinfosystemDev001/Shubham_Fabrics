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
  Waves,
  Sparkles
} from 'lucide-react';
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';

export default function WashingQCDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  const loadData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError('');
      const res = await fetch('/api/washing-qc/dashboard');
      if (!res.ok) {
        throw new Error('Failed to load Washing QC dashboard data');
      }
      const json = await res.json();
      setData(json.data);
      setLastSyncTime(new Date());
    } catch (err: any) {
      console.error('Error loading Washing QC dashboard:', err);
      setError(err.message || 'Error connecting to database');
    } finally {
      if (showLoading) setLoading(false);
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
    loadData(true);

    // Real-time synchronization polling every 5 seconds
    const interval = setInterval(() => {
      loadData(false);
    }, 5000);

    return () => clearInterval(interval);
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
    <div className="min-h-screen bg-ink-50 pb-16">
      {/* TOP HEADER */}
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
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                WASHING QC TERMINAL
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Real-Time Sync Active
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mt-1 flex items-center gap-2">
              <Waves className="w-6 h-6 text-cyan-400" />
              <span>Washing QC Verification & Control Tower</span>
            </h1>
            <p className="text-xs text-slate-300 mt-0.5">
              Verify washed garments for shrinkage, hand-feel, shade bleeding, and wash defects before finishing hand-over.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadData(true)}
              disabled={loading}
              className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
              title="Refresh Dashboard"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <Link
              href="/washing-qc/my-work"
              className="px-3.5 py-1.5 bg-lavender-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Open My Work</span>
            </Link>

            <Link
              href="/washing-qc/floor-board"
              className="px-3.5 py-1.5 bg-cyan-700 hover:bg-cyan-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Floor Board</span>
            </Link>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => loadData(true)}
              className="text-rose-700 font-bold underline hover:no-underline ml-4"
            >
              Retry
            </button>
          </div>
        )}

        {/* 1. TOP SUMMARY KPI CARDS */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Card 1: Total Received */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              From Washing
            </span>
            <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
              {summary.totalChallansReceived}
            </div>
            <span className="text-[11px] font-medium text-slate-600 mt-0.5 block">
              {summary.totalPcsReceived.toLocaleString()} Total PCS
            </span>
          </div>

          {/* Card 2: Pending Inspection */}
          <div className="bg-amber-50/70 rounded-xl border border-amber-200 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider block">
                Pending / Ready
              </span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-amber-900 mt-1 font-mono">
              {summary.pendingInspectionCount}
            </div>
            <span className="text-[11px] font-medium text-amber-700 mt-0.5 block">
              Awaiting Inspection
            </span>
          </div>

          {/* Card 3: Under Inspection */}
          <div className="bg-blue-50/70 rounded-xl border border-blue-200 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-blue-800 uppercase tracking-wider block">
                Under Inspect
              </span>
              <RefreshCw className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-blue-900 mt-1 font-mono">
              {summary.underInspectionCount}
            </div>
            <span className="text-[11px] font-medium text-blue-700 mt-0.5 block">
              On Table Testing
            </span>
          </div>

          {/* Card 4: Passed & Handed Over */}
          <div className="bg-emerald-50/70 rounded-xl border border-emerald-200 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">
                QC Approved
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-900 mt-1 font-mono">
              {summary.approvedChallansCount}
            </div>
            <span className="text-[11px] font-medium text-emerald-700 mt-0.5 block">
              Ready for Finishing
            </span>
          </div>

          {/* Card 5: Rework Count */}
          <div className="bg-orange-50/70 rounded-xl border border-orange-200 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-orange-800 uppercase tracking-wider block">
                Re-Wash Required
              </span>
              <RotateCcw className="w-4 h-4 text-orange-600" />
            </div>
            <div className="text-2xl font-black text-orange-900 mt-1 font-mono">
              {summary.reworkChallansCount}
            </div>
            <span className="text-[11px] font-medium text-orange-700 mt-0.5 block">
              {summary.totalReworkPcs} PCS Returned
            </span>
          </div>

          {/* Card 6: Pass Rate */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 shadow-xs text-white">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">
                Pass Rate
              </span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white mt-1 font-mono">
              {summary.passRatePercent}%
            </div>
            <span className="text-[11px] font-medium text-slate-300 mt-0.5 block">
              {summary.defectRatePercent}% Defect Rate
            </span>
          </div>
        </section>

        {/* 2. ACTIVE WORKFLOW SHORTCUTS */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Station Handoff & Quick Actions</span>
              </h2>
              <p className="text-xs text-slate-500">
                Washing Handover ➔ Washing QC Inspection ➔ Pass to Finishing Section
              </p>
            </div>
            <div className="text-xs font-mono text-slate-400">
              Synced: {lastSyncTime.toLocaleTimeString()}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Action 1 */}
            <Link
              href="/washing-qc/my-work?tab=INCOMING"
              className="group p-4 rounded-xl border border-emerald-100 bg-emerald-50/40 hover:bg-emerald-50 hover:border-emerald-300 transition flex items-start gap-3"
            >
              <div className="w-9 h-9 rounded-lg bg-lavender-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 group-hover:text-emerald-700">
                    Verify Incoming Washed Pieces
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition" />
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Receive challans from Washing, conduct wash quality, hand-feel & shrinkage tests.
                </p>
                <span className="inline-block mt-2 font-mono font-bold text-[10px] text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded">
                  {summary.pendingInspectionCount} Pending Review
                </span>
              </div>
            </Link>

            {/* Action 2 */}
            <Link
              href="/washing-qc/issue-challan"
              className="group p-4 rounded-xl border border-blue-100 bg-blue-50/40 hover:bg-blue-50 hover:border-blue-300 transition flex items-start gap-3"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <Send className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 group-hover:text-blue-700">
                    Issue Challan to Finishing
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition" />
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Create electronic handover challan to Finishing & Steam Pressing department.
                </p>
                <span className="inline-block mt-2 font-mono font-bold text-[10px] text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded">
                  {summary.approvedChallansCount} Approved Lots
                </span>
              </div>
            </Link>

            {/* Action 3 */}
            <Link
              href="/washing-qc/floor-board"
              className="group p-4 rounded-xl border border-amber-100 bg-amber-50/40 hover:bg-amber-50 hover:border-amber-300 transition flex items-start gap-3"
            >
              <div className="w-9 h-9 rounded-lg bg-lavender-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <Kanban className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 group-hover:text-amber-700">
                    Live Floor Board Kanban
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition" />
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Real-time visual lanes for Inbound, Under Inspection, Approved, Rework, and Rejection.
                </p>
                <span className="inline-block mt-2 font-mono font-bold text-[10px] text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded">
                  {challans.length} Active Challans
                </span>
              </div>
            </Link>
          </div>
        </section>

        {/* 3. PENDING INSPECTIONS QUEUE */}
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Active Verification Queue ({pendingChallans.length})
              </h3>
            </div>
            <Link
              href="/washing-qc/my-work"
              className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {pendingChallans.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
              <p className="text-xs font-medium">All washed lots are verified & cleared! No pending challans.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-500 text-[11px] font-semibold border-b border-slate-100">
                    <th className="py-2.5 px-4">Challan #</th>
                    <th className="py-2.5 px-4">Program / Style</th>
                    <th className="py-2.5 px-4">Client</th>
                    <th className="py-2.5 px-4">From</th>
                    <th className="py-2.5 px-4">Quantity</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingChallans.slice(0, 8).map((c: any) => {
                    const qty = c.items?.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0) || 0;
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {c.challanNumber}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800">
                          {c.program?.programSerialNo || c.program?.programNumber || '—'}
                          <span className="block text-[10px] text-slate-400 font-mono">
                            {c.program?.styleCode || 'Standard Style'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {c.program?.clientName || 'Standard Client'}
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                          {c.fromDepartment}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {qty} PCS
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              c.status === 'UNDER_INSPECTION'
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : c.status === 'RECEIVED'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-slate-100 text-slate-800 border border-slate-200'
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            href={`/washing-qc/my-work?challanId=${c.id}`}
                            className="px-2.5 py-1 bg-lavender-600 hover:bg-lavender-700 text-white font-bold rounded text-[11px] inline-flex items-center gap-1 transition shadow-2xs"
                          >
                            <span>Inspect</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
