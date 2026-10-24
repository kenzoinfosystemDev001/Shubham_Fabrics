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

export default function QCWashingDashboard() {
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
      const res = await fetch('/api/qcwashing/dashboard');
      if (!res.ok) {
        throw new Error('Failed to load QC Washing dashboard data');
      }
      const json = await res.json();
      setData(json.data);
      setLastSyncTime(new Date());
    } catch (err: any) {
      console.error('Error loading QC Washing dashboard:', err);
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
    <div className="min-h-screen bg-neutral-50 pb-16">
      {/* TOP HEADER */}
      <header
        className="bg-white border-b border-neutral-200 sticky top-0 z-30 px-4 sm:px-8 py-4 shadow-md text-neutral-900"
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-accent-400/20 text-accent-700 border border-accent-500/30">
                QC WASHING TERMINAL
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-accent-700 font-medium">
                <span className="w-2 h-2 rounded-full bg-accent-400 animate-pulse" />
                Live Real-Time Sync Active
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-neutral-900 tracking-tight mt-1 flex items-center gap-2">
              <Waves className="w-6 h-6 text-brand-600" />
              <span>QC Washing Verification & Control Tower</span>
            </h1>
            <p className="text-xs text-neutral-700 mt-0.5">
              Verify washed garments for shrinkage, hand-feel, shade bleeding, and wash defects before finishing hand-over.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadData(true)}
              disabled={loading}
              className="px-3 py-1.5 bg-neutral-50 hover:bg-neutral-200 text-neutral-900 border border-neutral-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
              title="Refresh Dashboard"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <Link
              href="/qcwashing/my-work"
              className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Open My Work</span>
            </Link>

            <Link
              href="/qcwashing/floor-board"
              className="px-3.5 py-1.5 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
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
          <div className="p-4 bg-danger-50 border border-danger-200 text-danger-800 rounded-xl text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-danger-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => loadData(true)}
              className="text-danger-700 font-bold underline hover:no-underline ml-4"
            >
              Retry
            </button>
          </div>
        )}

        {/* 1. TOP SUMMARY KPI CARDS */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Card 1: Total Received */}
          <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-xs">
            <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider block">
              From Washing
            </span>
            <div className="text-2xl font-black text-neutral-900 mt-1 font-mono">
              {summary.totalChallansReceived}
            </div>
            <span className="text-[11px] font-medium text-neutral-600 mt-0.5 block">
              {summary.totalPcsReceived.toLocaleString()} Total PCS
            </span>
          </div>

          {/* Card 2: Pending Inspection */}
          <div className="bg-accent-50/70 rounded-xl border border-accent-200 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-neutral-700 uppercase tracking-wider block">
                Pending / Ready
              </span>
              <Clock className="w-4 h-4 text-accent-700" />
            </div>
            <div className="text-2xl font-black text-neutral-900 mt-1 font-mono">
              {summary.pendingInspectionCount}
            </div>
            <span className="text-[11px] font-medium text-accent-800 mt-0.5 block">
              Awaiting Inspection
            </span>
          </div>

          {/* Card 3: Under Inspection */}
          <div className="bg-brand-50/70 rounded-xl border border-brand-200 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-brand-800 uppercase tracking-wider block">
                Under Inspect
              </span>
              <RefreshCw className="w-4 h-4 text-brand-600" />
            </div>
            <div className="text-2xl font-black text-brand-900 mt-1 font-mono">
              {summary.underInspectionCount}
            </div>
            <span className="text-[11px] font-medium text-brand-700 mt-0.5 block">
              On Table Testing
            </span>
          </div>

          {/* Card 4: Passed & Handed Over */}
          <div className="bg-accent-50/70 rounded-xl border border-accent-200 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-neutral-700 uppercase tracking-wider block">
                QC Approved
              </span>
              <CheckCircle2 className="w-4 h-4 text-accent-700" />
            </div>
            <div className="text-2xl font-black text-neutral-900 mt-1 font-mono">
              {summary.approvedChallansCount}
            </div>
            <span className="text-[11px] font-medium text-accent-800 mt-0.5 block">
              Ready for Finishing
            </span>
          </div>

          {/* Card 5: Rework Count */}
          <div className="bg-accent-50/70 rounded-xl border border-accent-200 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-neutral-700 uppercase tracking-wider block">
                Re-Wash Required
              </span>
              <RotateCcw className="w-4 h-4 text-accent-700" />
            </div>
            <div className="text-2xl font-black text-neutral-900 mt-1 font-mono">
              {summary.reworkChallansCount}
            </div>
            <span className="text-[11px] font-medium text-accent-800 mt-0.5 block">
              {summary.totalReworkPcs} PCS Returned
            </span>
          </div>

          {/* Card 6: Pass Rate */}
          <div className="bg-brand-50 rounded-xl border border-brand-200 p-4 shadow-xs text-neutral-900">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-neutral-700 uppercase tracking-wider block">
                Pass Rate
              </span>
              <TrendingUp className="w-4 h-4 text-accent-700" />
            </div>
            <div className="text-2xl font-black text-neutral-900 mt-1 font-mono">
              {summary.passRatePercent}%
            </div>
            <span className="text-[11px] font-medium text-neutral-700 mt-0.5 block">
              {summary.defectRatePercent}% Defect Rate
            </span>
          </div>
        </section>

        {/* 2. ACTIVE WORKFLOW SHORTCUTS */}
        <section className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-bold text-neutral-900 tracking-tight flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent-700" />
                <span>Station Handoff & Quick Actions</span>
              </h2>
              <p className="text-xs text-neutral-500">
                Washing Handover ➔ QC Washing Inspection ➔ Pass to Finishing Section
              </p>
            </div>
            <div className="text-xs font-mono text-neutral-500">
              Synced: {lastSyncTime.toLocaleTimeString()}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Action 1 */}
            <Link
              href="/qcwashing/my-work?tab=INCOMING"
              className="group p-4 rounded-xl border border-accent-100 bg-accent-50/40 hover:bg-accent-50 hover:border-accent-300 transition flex items-start gap-3"
            >
              <div className="w-9 h-9 rounded-lg bg-accent-400 text-neutral-900 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-900 group-hover:text-accent-800">
                    Verify Incoming Washed Pieces
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-neutral-500 group-hover:text-accent-700 group-hover:translate-x-0.5 transition" />
                </div>
                <p className="text-[11px] text-neutral-600 mt-0.5">
                  Receive challans from Washing, conduct wash quality, hand-feel & shrinkage tests.
                </p>
                <span className="inline-block mt-2 font-mono font-bold text-[10px] text-accent-800 bg-accent-100/70 px-2 py-0.5 rounded">
                  {summary.pendingInspectionCount} Pending Review
                </span>
              </div>
            </Link>

            {/* Action 2 */}
            <Link
              href="/qcwashing/issue-challan"
              className="group p-4 rounded-xl border border-brand-100 bg-brand-50/40 hover:bg-brand-50 hover:border-brand-300 transition flex items-start gap-3"
            >
              <div className="w-9 h-9 rounded-lg bg-brand-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <Send className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-900 group-hover:text-brand-700">
                    Issue Challan to Finishing
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-neutral-500 group-hover:text-brand-600 group-hover:translate-x-0.5 transition" />
                </div>
                <p className="text-[11px] text-neutral-600 mt-0.5">
                  Create electronic handover challan to Finishing & Steam Pressing department.
                </p>
                <span className="inline-block mt-2 font-mono font-bold text-[10px] text-brand-700 bg-brand-100/70 px-2 py-0.5 rounded">
                  {summary.approvedChallansCount} Approved Lots
                </span>
              </div>
            </Link>

            {/* Action 3 */}
            <Link
              href="/qcwashing/floor-board"
              className="group p-4 rounded-xl border border-accent-100 bg-accent-50/40 hover:bg-accent-50 hover:border-accent-300 transition flex items-start gap-3"
            >
              <div className="w-9 h-9 rounded-lg bg-accent-400 text-neutral-900 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <Kanban className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-900 group-hover:text-accent-800">
                    Live Floor Board Kanban
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-neutral-500 group-hover:text-accent-700 group-hover:translate-x-0.5 transition" />
                </div>
                <p className="text-[11px] text-neutral-600 mt-0.5">
                  Real-time visual lanes for Inbound, Under Inspection, Approved, Rework, and Rejection.
                </p>
                <span className="inline-block mt-2 font-mono font-bold text-[10px] text-accent-800 bg-accent-100/70 px-2 py-0.5 rounded">
                  {challans.length} Active Challans
                </span>
              </div>
            </Link>
          </div>
        </section>

        {/* 3. PENDING INSPECTIONS QUEUE */}
        <section className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-xs">
          <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-accent-700" />
              <h3 className="text-sm font-bold text-neutral-900">
                Active Verification Queue ({pendingChallans.length})
              </h3>
            </div>
            <Link
              href="/qcwashing/my-work"
              className="text-xs text-accent-700 hover:text-accent-800 font-bold flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {pendingChallans.length === 0 ? (
            <div className="py-12 text-center text-neutral-500">
              <CheckCircle2 className="w-8 h-8 mx-auto text-accent-700 mb-2" />
              <p className="text-xs font-medium">All washed lots are verified & cleared! No pending challans.</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-neutral-50/80 text-neutral-500 text-[11px] font-semibold border-b border-neutral-100">
                    <th className="py-2.5 px-4">Challan #</th>
                    <th className="py-2.5 px-4">Program / Style</th>
                    <th className="py-2.5 px-4">Client</th>
                    <th className="py-2.5 px-4">From</th>
                    <th className="py-2.5 px-4">Quantity</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {pendingChallans.slice(0, 8).map((c: any) => {
                    const qty = c.items?.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0) || 0;
                    return (
                      <tr key={c.id} className="hover:bg-neutral-50/60 transition">
                        <td className="py-3 px-4 font-mono font-bold text-neutral-900">
                          {c.challanNumber}
                        </td>
                        <td className="py-3 px-4 font-medium text-neutral-900">
                          {c.program?.programSerialNo || c.program?.programNumber || '—'}
                          <span className="block text-[10px] text-neutral-500 font-mono">
                            {c.program?.styleCode || 'Standard Style'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-neutral-600">
                          {c.program?.clientName || 'Standard Client'}
                        </td>
                        <td className="py-3 px-4 text-neutral-600 font-mono text-[11px]">
                          {c.fromDepartment}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-neutral-900">
                          {qty} PCS
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              c.status === 'UNDER_INSPECTION'
                                ? 'bg-brand-100 text-brand-800 border border-brand-200'
                                : c.status === 'RECEIVED'
                                ? 'bg-accent-100 text-accent-800 border border-accent-200'
                                : 'bg-neutral-100 text-neutral-900 border border-neutral-200'
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            href={`/qcwashing/my-work?challanId=${c.id}`}
                            className="px-2.5 py-1 bg-accent-400 hover:bg-accent-500 text-neutral-900 font-bold rounded text-[11px] inline-flex items-center gap-1 transition shadow-2xs"
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
