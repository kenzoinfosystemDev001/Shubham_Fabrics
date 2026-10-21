'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Wind,
  RefreshCw,
  Kanban,
  Clock,
  Send,
  AlertCircle,
  Layers,
  ArrowRight,
  TrendingUp,
  FileText,
  ShieldCheck,
  CheckCircle2,
  ArrowDownLeft,
  BarChart3,
  Check,
} from 'lucide-react';
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';

export default function SteamPressDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [quickActionLoading, setQuickActionLoading] = useState<string | null>(null);

  const loadData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError('');
      const res = await fetch('/api/steam-press/dashboard');
      if (!res.ok) {
        throw new Error('Failed to load Steam Press dashboard data');
      }
      const json = await res.json();
      setData(json.data);
      setLastSyncTime(new Date());
    } catch (err: any) {
      console.error('Error loading Steam Press dashboard:', err);
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

    // Live 5-second polling
    const interval = setInterval(() => {
      loadData(false);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleQuickReceive = async (challanId: string) => {
    try {
      setQuickActionLoading(challanId);
      const res = await fetch(`/api/steam-press/challans/${challanId}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actorId: currentUser?.id,
          remarks: 'Quick physical verification confirmed on Steam Press floor.',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to receive challan');
      }

      await loadData(false);
    } catch (err: any) {
      alert(err.message || 'Error receiving challan');
    } finally {
      setQuickActionLoading(null);
    }
  };

  const summary = data?.summary || {
    awaitingReceiptCount: 0,
    awaitingReceiptPcs: 0,
    inQueueCount: 0,
    inQueuePcs: 0,
    inProgressCount: 0,
    inProgressPcs: 0,
    completedCount: 0,
    completedPcs: 0,
    readyForHandoverCount: 0,
    readyForHandoverPcs: 0,
    handedOverCount: 0,
    handedOverPcs: 0,
    totalInputPcs: 0,
    totalGoodPcs: 0,
    totalReworkPcs: 0,
    totalRejectPcs: 0,
    efficiencyRate: '100.0',
  };

  const incomingPending = (data?.incomingChallans || []).filter(
    (ch: any) => ch.status === 'ISSUED'
  );

  const activeFloorJobs = (data?.incomingChallans || []).filter((ch: any) =>
    ['RECEIVED', 'IN_PROCESS', 'COMPLETED', 'READY_FOR_HANDOVER', 'ON_HOLD'].includes(ch.status)
  );

  return (
    <div
      className="min-h-screen text-slate-100 flex flex-col"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(15, 23, 42, 0.94), rgba(10, 15, 29, 0.98)), url('${DEPARTMENT_NAV_BG_IMAGE}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* TOP HEADER */}
      <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md px-6 py-4 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
              <Wind className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">Steam Press Department</h1>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-full tracking-wider uppercase">
                  LIVE MES
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Garment steam ironing, crease setting, piece-in/piece-out reconciliation & Final QC handover
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-medium text-slate-300">
                {currentUser?.fullName || 'Steam Press Incharge'}
              </div>
              <div className="text-[10px] text-cyan-400 font-mono">
                Auto-sync: {lastSyncTime.toLocaleTimeString()}
              </div>
            </div>

            <button
              onClick={() => loadData(true)}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-300 hover:text-white transition disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>

            <Link
              href="/steam-press/issue-challan"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-900/30 transition"
            >
              <Send className="w-4 h-4" />
              <span>Issue Handover Challan</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ERROR BANNER */}
      {error && (
        <div className="max-w-7xl mx-auto w-full px-6 pt-4">
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6 space-y-6">
        {/* KPI METRIC CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* 1. Inward Pending */}
          <Link
            href="/steam-press/incoming"
            className="p-4 rounded-xl bg-slate-900/70 border border-amber-500/30 hover:border-amber-400/60 transition group relative overflow-hidden backdrop-blur-xs shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                Awaiting Inward
              </span>
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:scale-110 transition">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-white">{summary.awaitingReceiptCount}</div>
            <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
              <span>{summary.awaitingReceiptPcs} garments pending receipt</span>
              <ArrowRight className="w-3.5 h-3.5 text-amber-400 opacity-0 group-hover:opacity-100 transition" />
            </div>
          </Link>

          {/* 2. In Queue & In Process */}
          <Link
            href="/steam-press/my-work"
            className="p-4 rounded-xl bg-slate-900/70 border border-cyan-500/30 hover:border-cyan-400/60 transition group relative overflow-hidden backdrop-blur-xs shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider">
                In Pressing Floor
              </span>
              <div className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition">
                <Wind className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-white">
              {summary.inQueueCount + summary.inProgressCount}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
              <span>{summary.inQueuePcs + summary.inProgressPcs} garments on tables</span>
              <ArrowRight className="w-3.5 h-3.5 text-cyan-400 opacity-0 group-hover:opacity-100 transition" />
            </div>
          </Link>

          {/* 3. Completed / Ready for Handover */}
          <Link
            href="/steam-press/issue-challan"
            className="p-4 rounded-xl bg-slate-900/70 border border-emerald-500/30 hover:border-emerald-400/60 transition group relative overflow-hidden backdrop-blur-xs shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                Ready for Final QC
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-white">{summary.readyForHandoverCount}</div>
            <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
              <span>{summary.readyForHandoverPcs} garments pressed & audited</span>
              <ArrowRight className="w-3.5 h-3.5 text-emerald-400 opacity-0 group-hover:opacity-100 transition" />
            </div>
          </Link>

          {/* 4. Efficiency Rate */}
          <Link
            href="/steam-press/reports"
            className="p-4 rounded-xl bg-slate-900/70 border border-purple-500/30 hover:border-purple-400/60 transition group relative overflow-hidden backdrop-blur-xs shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider">
                First-Pass Yield
              </span>
              <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:scale-110 transition">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-white">{summary.efficiencyRate}%</div>
            <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
              <span>{summary.totalGoodPcs} / {summary.totalInputPcs} garments good</span>
              <ArrowRight className="w-3.5 h-3.5 text-purple-400 opacity-0 group-hover:opacity-100 transition" />
            </div>
          </Link>
        </div>

        {/* SECONDARY QUANTITY STRIP */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 backdrop-blur-xs">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-300">Throughput Reconciliation:</span>
          </div>
          <div className="flex items-center gap-6 flex-wrap text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
              <span className="text-slate-400">Total Input:</span>
              <span className="font-bold text-white font-mono">{summary.totalInputPcs} pcs</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <span className="text-slate-400">Good Pressed:</span>
              <span className="font-bold text-emerald-400 font-mono">{summary.totalGoodPcs} pcs</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              <span className="text-slate-400">Re-press / Rework:</span>
              <span className="font-bold text-amber-400 font-mono">{summary.totalReworkPcs} pcs</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400"></span>
              <span className="text-slate-400">Scorch / Reject:</span>
              <span className="font-bold text-rose-400 font-mono">{summary.totalRejectPcs} pcs</span>
            </div>
          </div>
        </div>

        {/* TWO-COLUMN WORKFLOW GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* COLUMN 1: INCOMING CHALLANS PENDING INWARD */}
          <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col space-y-4 backdrop-blur-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <ArrowDownLeft className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold text-white tracking-wide">
                  Pending Inward from Finishing ({incomingPending.length})
                </h2>
              </div>
              <Link
                href="/steam-press/incoming"
                className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
              >
                <span>View All Inward</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {incomingPending.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                <Check className="w-8 h-8 mx-auto mb-2 text-emerald-500/40" />
                No inbound challans waiting. All received bundles are acknowledged.
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-[380px] pr-1">
                {incomingPending.map((ch: any) => {
                  const pcs = ch.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
                  const isQuickReceiving = quickActionLoading === ch.id;

                  return (
                    <div
                      key={ch.id}
                      className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-amber-500/40 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-amber-300">
                            {ch.challanNumber}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                            From: {ch.fromDepartment || 'FINISHING'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-300 font-medium">
                          Program: {ch.program?.programNumber || 'N/A'} • Style: {ch.program?.styleCode || 'Standard'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {ch.program?.clientName ? `Client: ${ch.program.clientName} • ` : ''}
                          Quantity: <span className="font-bold text-white">{pcs} pcs</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          onClick={() => handleQuickReceive(ch.id)}
                          disabled={isQuickReceiving}
                          className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold transition disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isQuickReceiving ? 'Receiving...' : 'Acknowledge Inward'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* COLUMN 2: ACTIVE STEAM PRESS FLOOR JOBS */}
          <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col space-y-4 backdrop-blur-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Wind className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-bold text-white tracking-wide">
                  Active Steam Press Jobs ({activeFloorJobs.length})
                </h2>
              </div>
              <Link
                href="/steam-press/my-work"
                className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition"
              >
                <span>Pressing Floor</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {activeFloorJobs.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                <Layers className="w-8 h-8 mx-auto mb-2 text-cyan-500/40" />
                No active jobs currently in process. Inward new bundles to start.
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-[380px] pr-1">
                {activeFloorJobs.map((ch: any) => {
                  const pcs = ch.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
                  const isReady = ch.status === 'READY_FOR_HANDOVER';
                  const isCompleted = ch.status === 'COMPLETED';
                  const isInProcess = ch.status === 'IN_PROCESS';

                  return (
                    <div
                      key={ch.id}
                      className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-cyan-500/40 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-white">
                            {ch.challanNumber}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              isReady
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : isCompleted
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                : isInProcess
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}
                          >
                            {ch.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="text-xs text-slate-300 font-medium">
                          Program: {ch.program?.programNumber || 'N/A'} • Style: {ch.program?.styleCode || 'Standard'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Bundle: <span className="font-bold text-white">{pcs} pcs</span>
                          {ch.fabricOut ? ` • Good Output: ${ch.fabricOut} pcs` : ''}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {isReady ? (
                          <Link
                            href={`/steam-press/issue-challan?jobId=${ch.id}`}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Issue to Final QC</span>
                          </Link>
                        ) : (
                          <Link
                            href={`/steam-press/workspace/${ch.id}`}
                            className="px-3 py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/40 text-xs font-semibold transition flex items-center gap-1.5"
                          >
                            <Wind className="w-3.5 h-3.5" />
                            <span>Open Press Table</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* RECENT PRODUCTION TRANSACTIONS */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 backdrop-blur-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-bold text-white tracking-wide">
                Recent Steam Press Transactions & Shift Output
              </h2>
            </div>
            <Link
              href="/steam-press/reports"
              className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition"
            >
              <span>Full Analytics</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {(!data?.recentTransactions || data.recentTransactions.length === 0) ? (
            <div className="py-6 text-center text-slate-500 text-xs">
              No transactions recorded yet in this shift.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3">Program / Style</th>
                    <th className="py-2.5 px-3">Challan Ref</th>
                    <th className="py-2.5 px-3">Operator</th>
                    <th className="py-2.5 px-3 text-right">Input</th>
                    <th className="py-2.5 px-3 text-right">Good</th>
                    <th className="py-2.5 px-3 text-right">Rework</th>
                    <th className="py-2.5 px-3 text-right">Reject</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {data.recentTransactions.slice(0, 10).map((tx: any) => (
                    <tr key={tx.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-400">
                        {new Date(tx.recordedAt).toLocaleTimeString()}
                      </td>
                      <td className="py-2 px-3 font-medium text-white">
                        {tx.program?.programNumber || 'N/A'} ({tx.program?.styleCode || 'Standard'})
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-400">
                        {tx.challan?.challanNumber || '-'}
                      </td>
                      <td className="py-2 px-3">{tx.operator?.fullName || 'Steam Press Operator'}</td>
                      <td className="py-2 px-3 text-right font-mono">{tx.inputQuantity}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400">
                        {tx.goodQuantity}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-amber-400">
                        {tx.reworkQuantity}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-rose-400">
                        {tx.rejectQuantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
