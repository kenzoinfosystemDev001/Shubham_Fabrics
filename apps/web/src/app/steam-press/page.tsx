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
      className="min-h-screen text-neutral-900 flex flex-col"
      
    >
      {/* TOP HEADER */}
      <header className="border-b border-neutral-200 bg-white backdrop-blur-md px-6 py-4 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-600 shadow-inner">
              <Wind className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-neutral-900">Steam Press Department</h1>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-brand-500/20 text-brand-600 border border-brand-500/40 rounded-full tracking-wider uppercase">
                  LIVE MES
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                Garment steam ironing, crease setting, piece-in/piece-out reconciliation & Final QC handover
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-medium text-neutral-700">
                {currentUser?.fullName || 'Steam Press Incharge'}
              </div>
              <div className="text-[10px] text-brand-600 font-mono">
                Auto-sync: {lastSyncTime.toLocaleTimeString()}
              </div>
            </div>

            <button
              onClick={() => loadData(true)}
              disabled={loading}
              className="p-2 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-700 hover:text-neutral-900 transition disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-600' : ''}`} />
            </button>

            <Link
              href="/steam-press/issue-challan"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm transition"
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
          <div className="p-3 bg-danger-500/10 border border-danger-500/30 rounded-xl flex items-center gap-3 text-danger-600 text-xs">
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
            className="p-4 rounded-xl bg-white border border-accent-500/30 hover:border-accent-500/60 transition group relative overflow-hidden backdrop-blur-xs shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-neutral-700 uppercase tracking-wider">
                Awaiting Inward
              </span>
              <div className="w-7 h-7 rounded-lg bg-accent-400/10 flex items-center justify-center text-accent-700 group-hover:scale-110 transition">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-neutral-900">{summary.awaitingReceiptCount}</div>
            <div className="text-xs text-neutral-500 mt-1 flex items-center justify-between">
              <span>{summary.awaitingReceiptPcs} garments pending receipt</span>
              <ArrowRight className="w-3.5 h-3.5 text-accent-700 opacity-0 group-hover:opacity-100 transition" />
            </div>
          </Link>

          {/* 2. In Queue & In Process */}
          <Link
            href="/steam-press/my-work"
            className="p-4 rounded-xl bg-white border border-brand-500/30 hover:border-brand-500/60 transition group relative overflow-hidden backdrop-blur-xs shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-brand-600 uppercase tracking-wider">
                In Pressing Floor
              </span>
              <div className="w-7 h-7 rounded-lg bg-brand-500/10 flex items-center justify-center text-brand-600 group-hover:scale-110 transition">
                <Wind className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-neutral-900">
              {summary.inQueueCount + summary.inProgressCount}
            </div>
            <div className="text-xs text-neutral-500 mt-1 flex items-center justify-between">
              <span>{summary.inQueuePcs + summary.inProgressPcs} garments on tables</span>
              <ArrowRight className="w-3.5 h-3.5 text-brand-600 opacity-0 group-hover:opacity-100 transition" />
            </div>
          </Link>

          {/* 3. Completed / Ready for Handover */}
          <Link
            href="/steam-press/issue-challan"
            className="p-4 rounded-xl bg-white border border-accent-500/30 hover:border-accent-500/60 transition group relative overflow-hidden backdrop-blur-xs shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-neutral-700 uppercase tracking-wider">
                Ready for Final QC
              </span>
              <div className="w-7 h-7 rounded-lg bg-accent-400/10 flex items-center justify-center text-accent-700 group-hover:scale-110 transition">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-neutral-900">{summary.readyForHandoverCount}</div>
            <div className="text-xs text-neutral-500 mt-1 flex items-center justify-between">
              <span>{summary.readyForHandoverPcs} garments pressed & audited</span>
              <ArrowRight className="w-3.5 h-3.5 text-accent-700 opacity-0 group-hover:opacity-100 transition" />
            </div>
          </Link>

          {/* 4. Efficiency Rate */}
          <Link
            href="/steam-press/reports"
            className="p-4 rounded-xl bg-white border border-brand-500/30 hover:border-brand-500/60 transition group relative overflow-hidden backdrop-blur-xs shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-brand-600 uppercase tracking-wider">
                First-Pass Yield
              </span>
              <div className="w-7 h-7 rounded-lg bg-brand-500/10 flex items-center justify-center text-brand-600 group-hover:scale-110 transition">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-neutral-900">{summary.efficiencyRate}%</div>
            <div className="text-xs text-neutral-500 mt-1 flex items-center justify-between">
              <span>{summary.totalGoodPcs} / {summary.totalInputPcs} garments good</span>
              <ArrowRight className="w-3.5 h-3.5 text-brand-600 opacity-0 group-hover:opacity-100 transition" />
            </div>
          </Link>
        </div>

        {/* SECONDARY QUANTITY STRIP */}
        <div className="bg-white border border-neutral-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 backdrop-blur-xs">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-neutral-700">Throughput Reconciliation:</span>
          </div>
          <div className="flex items-center gap-6 flex-wrap text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-500"></span>
              <span className="text-neutral-500">Total Input:</span>
              <span className="font-bold text-neutral-900 font-mono">{summary.totalInputPcs} pcs</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-accent-400"></span>
              <span className="text-neutral-500">Good Pressed:</span>
              <span className="font-bold text-accent-700 font-mono">{summary.totalGoodPcs} pcs</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-accent-400"></span>
              <span className="text-neutral-500">Re-press / Rework:</span>
              <span className="font-bold text-accent-700 font-mono">{summary.totalReworkPcs} pcs</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-danger-500"></span>
              <span className="text-neutral-500">Scorch / Reject:</span>
              <span className="font-bold text-danger-600 font-mono">{summary.totalRejectPcs} pcs</span>
            </div>
          </div>
        </div>

        {/* TWO-COLUMN WORKFLOW GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* COLUMN 1: INCOMING CHALLANS PENDING INWARD */}
          <section className="bg-white border border-neutral-200 rounded-2xl p-5 flex flex-col space-y-4 backdrop-blur-xs">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2.5">
                <ArrowDownLeft className="w-4 h-4 text-accent-700" />
                <h2 className="text-sm font-bold text-neutral-900 tracking-wide">
                  Pending Inward from Finishing ({incomingPending.length})
                </h2>
              </div>
              <Link
                href="/steam-press/incoming"
                className="text-xs font-semibold text-accent-700 hover:text-accent-700 flex items-center gap-1 transition"
              >
                <span>View All Inward</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {incomingPending.length === 0 ? (
              <div className="py-8 text-center text-neutral-500 text-xs">
                <Check className="w-8 h-8 mx-auto mb-2 text-accent-700" />
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
                      className="p-3.5 rounded-xl bg-white border border-neutral-200 hover:border-accent-500/40 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-accent-700">
                            {ch.challanNumber}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200">
                            From: {ch.fromDepartment || 'FINISHING'}
                          </span>
                        </div>
                        <div className="text-xs text-neutral-700 font-medium">
                          Program: {ch.program?.programNumber || 'N/A'} • Style: {ch.program?.styleCode || 'Standard'}
                        </div>
                        <div className="text-[11px] text-neutral-500">
                          {ch.program?.clientName ? `Client: ${ch.program.clientName} • ` : ''}
                          Quantity: <span className="font-bold text-neutral-900">{pcs} pcs</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          onClick={() => handleQuickReceive(ch.id)}
                          disabled={isQuickReceiving}
                          className="px-3 py-1.5 rounded-lg bg-accent-400/20 hover:bg-accent-400/30 text-accent-700 border border-accent-500/40 text-xs font-semibold transition disabled:opacity-50 flex items-center gap-1.5"
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
          <section className="bg-white border border-neutral-200 rounded-2xl p-5 flex flex-col space-y-4 backdrop-blur-xs">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2.5">
                <Wind className="w-4 h-4 text-brand-600" />
                <h2 className="text-sm font-bold text-neutral-900 tracking-wide">
                  Active Steam Press Jobs ({activeFloorJobs.length})
                </h2>
              </div>
              <Link
                href="/steam-press/my-work"
                className="text-xs font-semibold text-brand-600 hover:text-brand-600 flex items-center gap-1 transition"
              >
                <span>Pressing Floor</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {activeFloorJobs.length === 0 ? (
              <div className="py-8 text-center text-neutral-500 text-xs">
                <Layers className="w-8 h-8 mx-auto mb-2 text-brand-600" />
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
                      className="p-3.5 rounded-xl bg-white border border-neutral-200 hover:border-brand-500/40 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-neutral-900">
                            {ch.challanNumber}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              isReady
                                ? 'bg-accent-400/20 text-accent-700 border border-accent-500/40'
                                : isCompleted
                                ? 'bg-brand-500/20 text-brand-600 border border-brand-500/40'
                                : isInProcess
                                ? 'bg-brand-500/20 text-brand-600 border border-brand-500/40'
                                : 'bg-neutral-100 text-neutral-700 border border-neutral-200'
                            }`}
                          >
                            {ch.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="text-xs text-neutral-700 font-medium">
                          Program: {ch.program?.programNumber || 'N/A'} • Style: {ch.program?.styleCode || 'Standard'}
                        </div>
                        <div className="text-[11px] text-neutral-500">
                          Bundle: <span className="font-bold text-neutral-900">{pcs} pcs</span>
                          {ch.fabricOut ? ` • Good Output: ${ch.fabricOut} pcs` : ''}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {isReady ? (
                          <Link
                            href={`/steam-press/issue-challan?jobId=${ch.id}`}
                            className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Issue to Final QC</span>
                          </Link>
                        ) : (
                          <Link
                            href={`/steam-press/workspace/${ch.id}`}
                            className="px-3 py-1.5 rounded-lg bg-brand-500/30 hover:bg-brand-500/50 text-brand-800 border border-brand-500/40 text-xs font-semibold transition flex items-center gap-1.5"
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
        <section className="bg-white border border-neutral-200 rounded-2xl p-5 backdrop-blur-xs space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-brand-600" />
              <h2 className="text-sm font-bold text-neutral-900 tracking-wide">
                Recent Steam Press Transactions & Shift Output
              </h2>
            </div>
            <Link
              href="/steam-press/reports"
              className="text-xs font-semibold text-brand-600 hover:text-brand-600 flex items-center gap-1 transition"
            >
              <span>Full Analytics</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {(!data?.recentTransactions || data.recentTransactions.length === 0) ? (
            <div className="py-6 text-center text-neutral-500 text-xs">
              No transactions recorded yet in this shift.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-500 font-semibold">
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
                <tbody className="divide-y divide-neutral-200 text-neutral-700">
                  {data.recentTransactions.slice(0, 10).map((tx: any) => (
                    <tr key={tx.id} className="hover:bg-neutral-100 transition">
                      <td className="py-2 px-3 font-mono text-[11px] text-neutral-500">
                        {new Date(tx.recordedAt).toLocaleTimeString()}
                      </td>
                      <td className="py-2 px-3 font-medium text-neutral-900">
                        {tx.program?.programNumber || 'N/A'} ({tx.program?.styleCode || 'Standard'})
                      </td>
                      <td className="py-2 px-3 font-mono text-neutral-500">
                        {tx.challan?.challanNumber || '-'}
                      </td>
                      <td className="py-2 px-3">{tx.operator?.fullName || 'Steam Press Operator'}</td>
                      <td className="py-2 px-3 text-right font-mono">{tx.inputQuantity}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-accent-700">
                        {tx.goodQuantity}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-accent-700">
                        {tx.reworkQuantity}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-danger-600">
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
