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
    <div className="min-h-screen bg-canvas text-neutral-900 flex flex-col">
      {/* HEADER HERO */}
      <div
        className="bg-white border-b border-neutral-200 p-6 shadow-sm"
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand-500/20 border border-brand-500/40 flex items-center justify-center shadow-sm">
              <Shirt className="w-7 h-7 text-brand-600" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl md:text-2xl font-black tracking-tight text-neutral-900">
                  Stitching & Assembly Department
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-500/20 text-brand-600 border border-brand-500/30">
                  Station STC-01
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Garment Construction, Line Balancing, In-line Quality & Downstream Finishing Handover
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-neutral-200 text-xs text-neutral-700">
              <span className="w-2 h-2 rounded-full bg-accent-400 animate-pulse" />
              <span>Live 5s Sync</span>
              <span className="text-[10px] text-neutral-500 font-mono">
                {lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>

            <button
              onClick={() => loadData(true)}
              disabled={loading}
              className="p-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-neutral-900 transition border border-neutral-200 disabled:opacity-50"
              title="Refresh Dashboard"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <Link
              href="/stitching/issue-challan"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs transition shadow-sm"
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
          <div className="p-4 rounded-xl bg-danger-500/10 border border-danger-500/30 text-danger-600 text-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-danger-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => loadData(true)}
              className="px-3 py-1 bg-danger-500/20 hover:bg-danger-500/30 rounded text-xs font-semibold text-danger-800"
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
            className="group p-4 rounded-xl bg-white border border-accent-500/30 hover:border-accent-500 transition shadow-sm flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-neutral-500 mb-2">
              <span className="text-[11px] font-semibold text-neutral-700 uppercase tracking-wider">Awaiting Receipt</span>
              <ArrowDownLeft className="w-4 h-4 text-accent-700 group-hover:translate-y-0.5 transition-transform" />
            </div>
            <div className="space-y-0.5">
              <div className="text-2xl font-black text-neutral-900">{summary.awaitingReceiptCount}</div>
              <div className="text-[11px] text-neutral-500 font-medium">
                {summary.awaitingReceiptPcs.toLocaleString()} <span className="text-[10px]">pcs</span>
              </div>
            </div>
            <div className="text-[10px] text-accent-700 font-medium mt-2 flex items-center gap-1">
              <span>From Recutting</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
            </div>
          </Link>

          {/* 2. In Floor Queue */}
          <Link
            href="/stitching/my-work"
            className="group p-4 rounded-xl bg-white border border-brand-500/30 hover:border-brand-500 transition shadow-sm flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-neutral-500 mb-2">
              <span className="text-[11px] font-semibold text-brand-600 uppercase tracking-wider">In Floor Queue</span>
              <Layers className="w-4 h-4 text-brand-600 group-hover:scale-105 transition-transform" />
            </div>
            <div className="space-y-0.5">
              <div className="text-2xl font-black text-brand-600">{summary.inQueueCount}</div>
              <div className="text-[11px] text-neutral-500 font-medium">
                {summary.inQueuePcs.toLocaleString()} <span className="text-[10px]">pcs</span>
              </div>
            </div>
            <div className="text-[10px] text-brand-600 font-medium mt-2 flex items-center gap-1">
              <span>Ready for Assembly</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
            </div>
          </Link>

          {/* 3. Under Active Stitching */}
          <Link
            href="/stitching/my-work?status=IN_PROCESS"
            className="group p-4 rounded-xl bg-white border border-brand-500/40 hover:border-brand-500 transition shadow-sm flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-neutral-500 mb-2">
              <span className="text-[11px] font-semibold text-brand-600 uppercase tracking-wider">In Stitching</span>
              <Shirt className="w-4 h-4 text-brand-600 animate-pulse" />
            </div>
            <div className="space-y-0.5">
              <div className="text-2xl font-black text-brand-600">{summary.inProgressCount}</div>
              <div className="text-[11px] text-neutral-500 font-medium">
                {summary.inProgressPcs.toLocaleString()} <span className="text-[10px]">pcs</span>
              </div>
            </div>
            <div className="text-[10px] text-brand-600 font-medium mt-2 flex items-center gap-1">
              <span>On Assembly Lines</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
            </div>
          </Link>

          {/* 4. End-Line QC & Inspection */}
          <Link
            href="/stitching/my-work?status=COMPLETED"
            className="group p-4 rounded-xl bg-white border border-brand-500/30 hover:border-brand-500 transition shadow-sm flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-neutral-500 mb-2">
              <span className="text-[11px] font-semibold text-brand-600 uppercase tracking-wider">End-Line QC</span>
              <ShieldCheck className="w-4 h-4 text-brand-600 group-hover:scale-105 transition-transform" />
            </div>
            <div className="space-y-0.5">
              <div className="text-2xl font-black text-brand-600">{summary.completedCount}</div>
              <div className="text-[11px] text-neutral-500 font-medium">
                {summary.completedPcs.toLocaleString()} <span className="text-[10px]">pcs</span>
              </div>
            </div>
            <div className="text-[10px] text-brand-600 font-medium mt-2 flex items-center gap-1">
              <span>SPI & Seam Strength</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
            </div>
          </Link>

          {/* 5. Ready for Handover */}
          <Link
            href="/stitching/issue-challan"
            className="group p-4 rounded-xl bg-white border border-accent-500/30 hover:border-accent-500 transition shadow-sm flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-neutral-500 mb-2">
              <span className="text-[11px] font-semibold text-neutral-700 uppercase tracking-wider">Ready for Handover</span>
              <CheckCircle2 className="w-4 h-4 text-accent-700 group-hover:scale-105 transition-transform" />
            </div>
            <div className="space-y-0.5">
              <div className="text-2xl font-black text-neutral-900">{summary.readyForHandoverCount}</div>
              <div className="text-[11px] text-neutral-500 font-medium">
                {summary.readyForHandoverPcs.toLocaleString()} <span className="text-[10px]">garments</span>
              </div>
            </div>
            <div className="text-[10px] text-accent-700 font-medium mt-2 flex items-center gap-1">
              <span>To Finishing</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
            </div>
          </Link>

          {/* 6. Handed Over Downstream */}
          <div className="p-4 rounded-xl bg-white border border-brand-500/30 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-500 mb-2">
              <span className="text-[11px] font-semibold text-brand-600 uppercase tracking-wider">Handed Over</span>
              <Send className="w-4 h-4 text-brand-600" />
            </div>
            <div className="space-y-0.5">
              <div className="text-2xl font-black text-brand-600">{summary.handedOverCount}</div>
              <div className="text-[11px] text-neutral-500 font-medium">
                {summary.handedOverPcs.toLocaleString()} <span className="text-[10px]">garments</span>
              </div>
            </div>
            <div className="text-[10px] text-brand-600 font-medium mt-2">
              <span>Transferred Out</span>
            </div>
          </div>
        </div>

        {/* PRODUCTION OUTPUT & EFFICIENCY STRIP */}
        <div className="p-5 rounded-2xl bg-white border border-neutral-200 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-3 border-b border-neutral-200">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-brand-500/20 text-brand-600">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-900 tracking-wide">Production Yield & Assembly Efficiency</h3>
                <p className="text-xs text-neutral-500">Reconciled assembly metrics across all stitching lines</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-xs text-neutral-500 block">First-Pass Yield</span>
                <span className="text-lg font-black text-neutral-900">{summary.efficiencyRate}%</span>
              </div>
              <Link
                href="/stitching/reports"
                className="px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-xs font-semibold text-neutral-900 border border-neutral-200 transition flex items-center gap-1.5"
              >
                <BarChart3 className="w-3.5 h-3.5 text-brand-600" />
                <span>Full Analytics</span>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-3 rounded-xl bg-white border border-neutral-200">
              <span className="text-xs text-neutral-500 block mb-1">Total Cut Inputs</span>
              <span className="text-xl font-bold text-neutral-900">{summary.totalInputPcs.toLocaleString()}</span>
              <span className="text-[10px] text-neutral-500 block mt-0.5">Pieces</span>
            </div>

            <div className="p-3 rounded-xl bg-white border border-accent-500/20">
              <span className="text-xs text-accent-700 block mb-1">Good Finished Garments</span>
              <span className="text-xl font-bold text-neutral-900">{summary.totalGoodPcs.toLocaleString()}</span>
              <span className="text-[10px] text-accent-700 block mt-0.5">Approved</span>
            </div>

            <div className="p-3 rounded-xl bg-white border border-accent-500/20">
              <span className="text-xs text-accent-700 block mb-1">Re-stitch / Rework</span>
              <span className="text-xl font-bold text-neutral-900">{summary.totalReworkPcs.toLocaleString()}</span>
              <span className="text-[10px] text-accent-700 block mt-0.5">Correctable</span>
            </div>

            <div className="p-3 rounded-xl bg-white border border-danger-500/20">
              <span className="text-xs text-danger-600 block mb-1">Scrap / Rejects</span>
              <span className="text-xl font-bold text-danger-600">{summary.totalRejectPcs.toLocaleString()}</span>
              <span className="text-[10px] text-danger-600 block mt-0.5">Quarantined</span>
            </div>
          </div>
        </div>

        {/* 2 COLUMN LAYOUT: PENDING INCOMING & ACTIVE FLOOR JOBS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: PENDING INCOMING CHALLANS */}
          <div className="p-5 rounded-2xl bg-white border border-neutral-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <ArrowDownLeft className="w-5 h-5 text-accent-700" />
                  <h3 className="text-sm font-bold text-neutral-900 tracking-wide">Incoming from Recutting</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-400/20 text-accent-700 border border-accent-500/30">
                    {pendingReceipt.length} Pending
                  </span>
                </div>
                <Link
                  href="/stitching/incoming"
                  className="text-xs font-semibold text-accent-700 hover:text-accent-700 flex items-center gap-1"
                >
                  <span>View All</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {pendingReceipt.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-white border border-dashed border-neutral-200">
                  <CheckCircle2 className="w-8 h-8 text-accent-700 mx-auto mb-2" />
                  <p className="text-xs text-neutral-500 font-medium">All incoming cut panels from Recutting have been physically received.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingReceipt.slice(0, 4).map((ch: any) => {
                    const totalPcs = ch.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
                    return (
                      <div
                        key={ch.id}
                        className="p-3.5 rounded-xl bg-white border border-neutral-200 hover:border-neutral-200 transition flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold font-mono text-neutral-900">{ch.challanNumber}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-accent-400/20 text-accent-700 border border-accent-500/30">
                              {ch.priority || 'NORMAL'}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-500 truncate mt-0.5">
                            {ch.program?.programNumber || 'Program'} &bull; Style: {ch.program?.styleCode || 'Standard'} &bull; {totalPcs} pcs
                          </p>
                        </div>

                        <button
                          onClick={() => handleQuickReceive(ch.id)}
                          disabled={quickActionLoading === ch.id}
                          className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs transition shrink-0 disabled:opacity-50 flex items-center gap-1.5"
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

            <div className="pt-4 mt-4 border-t border-neutral-200 flex items-center justify-between text-xs text-neutral-500">
              <span>Strict physical count reconciliation mandatory</span>
              <Link href="/stitching/incoming" className="text-brand-600 hover:underline">
                Open Receipt Terminal &rarr;
              </Link>
            </div>
          </div>

          {/* RIGHT: ACTIVE FLOOR JOBS */}
          <div className="p-5 rounded-2xl bg-white border border-neutral-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <Shirt className="w-5 h-5 text-brand-600" />
                  <h3 className="text-sm font-bold text-neutral-900 tracking-wide">Active Stitching Jobs</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-500/20 text-brand-600 border border-brand-500/30">
                    {inFloorQueue.length} Active
                  </span>
                </div>
                <Link
                  href="/stitching/my-work"
                  className="text-xs font-semibold text-brand-600 hover:text-brand-600 flex items-center gap-1"
                >
                  <span>Workstation</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {inFloorQueue.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-white border border-dashed border-neutral-200">
                  <Shirt className="w-8 h-8 text-brand-600 mx-auto mb-2" />
                  <p className="text-xs text-neutral-500 font-medium">No active stitching jobs in floor queue. Receive an incoming Challan to begin.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {inFloorQueue.slice(0, 4).map((ch: any) => {
                    const totalPcs = ch.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
                    const isInProcess = ch.status === 'IN_PROCESS';
                    return (
                      <div
                        key={ch.id}
                        className="p-3.5 rounded-xl bg-white border border-neutral-200 hover:border-neutral-200 transition flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold font-mono text-neutral-900">{ch.challanNumber}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                isInProcess
                                  ? 'bg-brand-500/20 text-brand-600 border-brand-500/30'
                                  : 'bg-brand-500/20 text-brand-600 border-brand-500/30'
                              }`}
                            >
                              {isInProcess ? 'IN PROGRESS' : 'READY IN QUEUE'}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-500 truncate mt-0.5">
                            {ch.program?.programNumber || 'Program'} &bull; Style: {ch.program?.styleCode || 'Standard'} &bull; {totalPcs} pcs
                          </p>
                        </div>

                        <Link
                          href={`/stitching/workspace/${ch.id}`}
                          className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs transition shrink-0 flex items-center gap-1.5 shadow-sm"
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

            <div className="pt-4 mt-4 border-t border-neutral-200 flex items-center justify-between text-xs text-neutral-500">
              <span>Real-time line tally counters supported</span>
              <Link href="/stitching/floor-board" className="text-brand-600 hover:underline">
                Open Kanban Floor Board &rarr;
              </Link>
            </div>
          </div>
        </div>

        {/* RECENT OUTGOING CHALLANS TABLE */}
        <div className="p-5 rounded-2xl bg-white border border-neutral-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <Send className="w-5 h-5 text-accent-700" />
              <h3 className="text-sm font-bold text-neutral-900 tracking-wide">Recent Handover Challans (To Finishing)</h3>
            </div>
            <Link
              href="/stitching/issue-challan"
              className="text-xs font-semibold text-accent-700 hover:text-accent-700 flex items-center gap-1"
            >
              <span>Create New Handover</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {outgoingChallans.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-white border border-dashed border-neutral-200">
              <p className="text-xs text-neutral-500 font-medium">No outgoing handover challans issued yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-500">
                    <th className="pb-3 font-semibold">Challan No</th>
                    <th className="pb-3 font-semibold">Style / Program</th>
                    <th className="pb-3 font-semibold">Destination</th>
                    <th className="pb-3 font-semibold text-right">Garments</th>
                    <th className="pb-3 font-semibold text-center">Status</th>
                    <th className="pb-3 font-semibold text-right">Issued At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 text-neutral-700">
                  {outgoingChallans.slice(0, 6).map((ch: any) => {
                    const totalPcs = ch.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
                    return (
                      <tr key={ch.id} className="hover:bg-neutral-100 transition">
                        <td className="py-3 font-mono font-bold text-neutral-900">{ch.challanNumber}</td>
                        <td className="py-3">
                          <span className="font-semibold text-neutral-900">{ch.program?.styleCode || 'Garment'}</span>
                          <span className="text-[10px] text-neutral-500 block">{ch.program?.programNumber}</span>
                        </td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-brand-600 border border-brand-500/20">
                            {ch.toDepartment}
                          </span>
                        </td>
                        <td className="py-3 text-right font-bold text-neutral-900">{totalPcs.toLocaleString()}</td>
                        <td className="py-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-accent-400/20 text-accent-700 border border-accent-500/30">
                            {ch.status}
                          </span>
                        </td>
                        <td className="py-3 text-right text-neutral-500">
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
