'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Shirt,
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
  Sparkles,
  Scissors,
  Check,
} from 'lucide-react';
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';

export default function StitchingDashboard() {
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
      const res = await fetch('/api/stitching/dashboard');
      if (!res.ok) {
        throw new Error('Failed to load Stitching dashboard data');
      }
      const json = await res.json();
      setData(json.data);
      setLastSyncTime(new Date());
    } catch (err: any) {
      console.error('Error loading Stitching dashboard:', err);
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
      const res = await fetch(`/api/stitching/challans/${challanId}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actorId: currentUser?.id,
          remarks: 'Quick physical verification confirmed on Stitching floor.',
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
    onHoldCount: 0,
    onHoldPcs: 0,
    totalIncomingChallans: 0,
    totalOutgoingChallans: 0,
    totalInputPcs: 0,
    totalGoodPcs: 0,
    totalReworkPcs: 0,
    totalRejectPcs: 0,
    efficiencyRate: '100.0',
  };

  const incomingChallans = data?.incomingChallans || [];
  const outgoingChallans = data?.outgoingChallans || [];
  const pendingReceipt = incomingChallans.filter((c: any) => c.status === 'ISSUED');
  const inFloorQueue = incomingChallans.filter((c: any) => c.status === 'RECEIVED' || c.status === 'IN_PROCESS');

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col">
      {/* HEADER HERO */}
      <div
        style={{
          backgroundImage: `linear-gradient(to right, rgba(15, 23, 42, 0.95), rgba(15, 23, 42, 0.85)), url('${DEPARTMENT_NAV_BG_IMAGE}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        className="border-b border-slate-800 p-6 shadow-md"
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center shadow-lg">
              <Shirt className="w-7 h-7 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">
                  Stitching & Assembly Department
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Station STC-01
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Garment Construction, Line Balancing, In-line Quality & Downstream Finishing Handover
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700/80 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Live 5s Sync</span>
              <span className="text-[10px] text-slate-400 font-mono">
                {lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>

            <button
              onClick={() => loadData(true)}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700 disabled:opacity-50"
              title="Refresh Dashboard"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <Link
              href="/stitching/issue-challan"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-md hover:shadow-indigo-500/20"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Issue Handover Challan</span>
            </Link>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="max-w-7xl mx-auto w-full p-4 md:p-6 space-y-6 flex-1">
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => loadData(true)}
              className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 rounded text-xs font-semibold text-rose-200"
            >
              Retry
            </button>
          </div>
        )}

        {/* 6 PRIMARY KPI TILES */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
          {/* 1. Awaiting Receipt */}
          <Link
            href="/stitching/incoming"
            className="group p-4 rounded-xl bg-slate-900/60 border border-amber-500/30 hover:border-amber-400 transition shadow-sm hover:shadow-amber-500/10 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider">Awaiting Receipt</span>
              <ArrowDownLeft className="w-4 h-4 text-amber-400 group-hover:translate-y-0.5 transition-transform" />
            </div>
            <div className="space-y-0.5">
              <div className="text-2xl font-black text-amber-400">{summary.awaitingReceiptCount}</div>
              <div className="text-[11px] text-slate-400 font-medium">
                {summary.awaitingReceiptPcs.toLocaleString()} <span className="text-[10px]">pcs</span>
              </div>
            </div>
            <div className="text-[10px] text-amber-400/80 font-medium mt-2 flex items-center gap-1">
              <span>From Recutting</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
            </div>
          </Link>

          {/* 2. In Floor Queue */}
          <Link
            href="/stitching/my-work"
            className="group p-4 rounded-xl bg-slate-900/60 border border-blue-500/30 hover:border-blue-400 transition shadow-sm hover:shadow-blue-500/10 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] font-semibold text-blue-300 uppercase tracking-wider">In Floor Queue</span>
              <Layers className="w-4 h-4 text-blue-400 group-hover:scale-105 transition-transform" />
            </div>
            <div className="space-y-0.5">
              <div className="text-2xl font-black text-blue-400">{summary.inQueueCount}</div>
              <div className="text-[11px] text-slate-400 font-medium">
                {summary.inQueuePcs.toLocaleString()} <span className="text-[10px]">pcs</span>
              </div>
            </div>
            <div className="text-[10px] text-blue-400/80 font-medium mt-2 flex items-center gap-1">
              <span>Ready for Assembly</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
            </div>
          </Link>

          {/* 3. Under Active Stitching */}
          <Link
            href="/stitching/my-work?status=IN_PROCESS"
            className="group p-4 rounded-xl bg-slate-900/60 border border-indigo-500/40 hover:border-indigo-400 transition shadow-sm hover:shadow-indigo-500/10 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">In Stitching</span>
              <Shirt className="w-4 h-4 text-indigo-400 animate-pulse" />
            </div>
            <div className="space-y-0.5">
              <div className="text-2xl font-black text-indigo-400">{summary.inProgressCount}</div>
              <div className="text-[11px] text-slate-400 font-medium">
                {summary.inProgressPcs.toLocaleString()} <span className="text-[10px]">pcs</span>
              </div>
            </div>
            <div className="text-[10px] text-indigo-400/80 font-medium mt-2 flex items-center gap-1">
              <span>On Assembly Lines</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
            </div>
          </Link>

          {/* 4. End-Line QC & Inspection */}
          <Link
            href="/stitching/my-work?status=COMPLETED"
            className="group p-4 rounded-xl bg-slate-900/60 border border-purple-500/30 hover:border-purple-400 transition shadow-sm hover:shadow-purple-500/10 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] font-semibold text-purple-300 uppercase tracking-wider">End-Line QC</span>
              <ShieldCheck className="w-4 h-4 text-purple-400 group-hover:scale-105 transition-transform" />
            </div>
            <div className="space-y-0.5">
              <div className="text-2xl font-black text-purple-400">{summary.completedCount}</div>
              <div className="text-[11px] text-slate-400 font-medium">
                {summary.completedPcs.toLocaleString()} <span className="text-[10px]">pcs</span>
              </div>
            </div>
            <div className="text-[10px] text-purple-400/80 font-medium mt-2 flex items-center gap-1">
              <span>SPI & Seam Strength</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
            </div>
          </Link>

          {/* 5. Ready for Handover */}
          <Link
            href="/stitching/issue-challan"
            className="group p-4 rounded-xl bg-slate-900/60 border border-emerald-500/30 hover:border-emerald-400 transition shadow-sm hover:shadow-emerald-500/10 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider">Ready for Handover</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 group-hover:scale-105 transition-transform" />
            </div>
            <div className="space-y-0.5">
              <div className="text-2xl font-black text-emerald-400">{summary.readyForHandoverCount}</div>
              <div className="text-[11px] text-slate-400 font-medium">
                {summary.readyForHandoverPcs.toLocaleString()} <span className="text-[10px]">garments</span>
              </div>
            </div>
            <div className="text-[10px] text-emerald-400/80 font-medium mt-2 flex items-center gap-1">
              <span>To Finishing</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
            </div>
          </Link>

          {/* 6. Handed Over Downstream */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-teal-500/30 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] font-semibold text-teal-300 uppercase tracking-wider">Handed Over</span>
              <Send className="w-4 h-4 text-teal-400" />
            </div>
            <div className="space-y-0.5">
              <div className="text-2xl font-black text-teal-400">{summary.handedOverCount}</div>
              <div className="text-[11px] text-slate-400 font-medium">
                {summary.handedOverPcs.toLocaleString()} <span className="text-[10px]">garments</span>
              </div>
            </div>
            <div className="text-[10px] text-teal-400/80 font-medium mt-2">
              <span>Transferred Out</span>
            </div>
          </div>
        </div>

        {/* PRODUCTION OUTPUT & EFFICIENCY STRIP */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-indigo-950/40 border border-slate-800 shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide">Production Yield & Assembly Efficiency</h3>
                <p className="text-xs text-slate-400">Reconciled assembly metrics across all stitching lines</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-xs text-slate-400 block">First-Pass Yield</span>
                <span className="text-lg font-black text-emerald-400">{summary.efficiencyRate}%</span>
              </div>
              <Link
                href="/stitching/reports"
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
              >
                <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
                <span>Full Analytics</span>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800">
              <span className="text-xs text-slate-400 block mb-1">Total Cut Inputs</span>
              <span className="text-xl font-bold text-white">{summary.totalInputPcs.toLocaleString()}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Pieces</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/50 border border-emerald-500/20">
              <span className="text-xs text-emerald-400 block mb-1">Good Finished Garments</span>
              <span className="text-xl font-bold text-emerald-400">{summary.totalGoodPcs.toLocaleString()}</span>
              <span className="text-[10px] text-emerald-400/70 block mt-0.5">Approved</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/50 border border-amber-500/20">
              <span className="text-xs text-amber-400 block mb-1">Re-stitch / Rework</span>
              <span className="text-xl font-bold text-amber-400">{summary.totalReworkPcs.toLocaleString()}</span>
              <span className="text-[10px] text-amber-400/70 block mt-0.5">Correctable</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/50 border border-rose-500/20">
              <span className="text-xs text-rose-400 block mb-1">Scrap / Rejects</span>
              <span className="text-xl font-bold text-rose-400">{summary.totalRejectPcs.toLocaleString()}</span>
              <span className="text-[10px] text-rose-400/70 block mt-0.5">Quarantined</span>
            </div>
          </div>
        </div>

        {/* 2 COLUMN LAYOUT: PENDING INCOMING & ACTIVE FLOOR JOBS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: PENDING INCOMING CHALLANS */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <ArrowDownLeft className="w-5 h-5 text-amber-400" />
                  <h3 className="text-sm font-bold text-white tracking-wide">Incoming from Recutting</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {pendingReceipt.length} Pending
                  </span>
                </div>
                <Link
                  href="/stitching/incoming"
                  className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1"
                >
                  <span>View All</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {pendingReceipt.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-slate-950/40 border border-dashed border-slate-800">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400/60 mx-auto mb-2" />
                  <p className="text-xs text-slate-400 font-medium">All incoming cut panels from Recutting have been physically received.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingReceipt.slice(0, 4).map((ch: any) => {
                    const totalPcs = ch.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
                    return (
                      <div
                        key={ch.id}
                        className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold font-mono text-white">{ch.challanNumber}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              {ch.priority || 'NORMAL'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 truncate mt-0.5">
                            {ch.program?.programNumber || 'Program'} &bull; Style: {ch.program?.styleCode || 'Standard'} &bull; {totalPcs} pcs
                          </p>
                        </div>

                        <button
                          onClick={() => handleQuickReceive(ch.id)}
                          disabled={quickActionLoading === ch.id}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shrink-0 disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{quickActionLoading === ch.id ? 'Receiving...' : 'Confirm In'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>Strict physical count reconciliation mandatory</span>
              <Link href="/stitching/incoming" className="text-indigo-400 hover:underline">
                Open Receipt Terminal &rarr;
              </Link>
            </div>
          </div>

          {/* RIGHT: ACTIVE FLOOR JOBS */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <Shirt className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white tracking-wide">Active Stitching Jobs</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {inFloorQueue.length} Active
                  </span>
                </div>
                <Link
                  href="/stitching/my-work"
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <span>Workstation</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {inFloorQueue.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-slate-950/40 border border-dashed border-slate-800">
                  <Shirt className="w-8 h-8 text-indigo-400/60 mx-auto mb-2" />
                  <p className="text-xs text-slate-400 font-medium">No active stitching jobs in floor queue. Receive an incoming Challan to begin.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {inFloorQueue.slice(0, 4).map((ch: any) => {
                    const totalPcs = ch.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
                    const isInProcess = ch.status === 'IN_PROCESS';
                    return (
                      <div
                        key={ch.id}
                        className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold font-mono text-white">{ch.challanNumber}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                isInProcess
                                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                                  : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                              }`}
                            >
                              {isInProcess ? 'IN PROGRESS' : 'READY IN QUEUE'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 truncate mt-0.5">
                            {ch.program?.programNumber || 'Program'} &bull; Style: {ch.program?.styleCode || 'Standard'} &bull; {totalPcs} pcs
                          </p>
                        </div>

                        <Link
                          href={`/stitching/workspace/${ch.id}`}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shrink-0 flex items-center gap-1.5 shadow-sm"
                        >
                          <Shirt className="w-3.5 h-3.5" />
                          <span>{isInProcess ? 'Continue' : 'Start'}</span>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>Real-time line tally counters supported</span>
              <Link href="/stitching/floor-board" className="text-indigo-400 hover:underline">
                Open Kanban Floor Board &rarr;
              </Link>
            </div>
          </div>
        </div>

        {/* RECENT OUTGOING CHALLANS TABLE */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <Send className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-bold text-white tracking-wide">Recent Handover Challans (To Finishing)</h3>
            </div>
            <Link
              href="/stitching/issue-challan"
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
            >
              <span>Create New Handover</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {outgoingChallans.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-slate-950/40 border border-dashed border-slate-800">
              <p className="text-xs text-slate-400 font-medium">No outgoing handover challans issued yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-3 font-semibold">Challan No</th>
                    <th className="pb-3 font-semibold">Style / Program</th>
                    <th className="pb-3 font-semibold">Destination</th>
                    <th className="pb-3 font-semibold text-right">Garments</th>
                    <th className="pb-3 font-semibold text-center">Status</th>
                    <th className="pb-3 font-semibold text-right">Issued At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {outgoingChallans.slice(0, 6).map((ch: any) => {
                    const totalPcs = ch.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
                    return (
                      <tr key={ch.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 font-mono font-bold text-white">{ch.challanNumber}</td>
                        <td className="py-3">
                          <span className="font-semibold text-slate-200">{ch.program?.styleCode || 'Garment'}</span>
                          <span className="text-[10px] text-slate-500 block">{ch.program?.programNumber}</span>
                        </td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-indigo-300 border border-indigo-500/20">
                            {ch.toDepartment}
                          </span>
                        </td>
                        <td className="py-3 text-right font-bold text-white">{totalPcs.toLocaleString()}</td>
                        <td className="py-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {ch.status}
                          </span>
                        </td>
                        <td className="py-3 text-right text-slate-400">
                          {new Date(ch.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
