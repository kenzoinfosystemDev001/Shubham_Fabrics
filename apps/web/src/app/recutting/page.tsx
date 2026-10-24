'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Scissors,
  RefreshCw,
  Briefcase,
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
} from 'lucide-react';

export default function RecuttingDashboard() {
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
      const res = await fetch('/api/recutting/dashboard');
      if (!res.ok) {
        throw new Error('Failed to load Recutting dashboard data');
      }
      const json = await res.json();
      setData(json.data);
      setLastSyncTime(new Date());
    } catch (err: any) {
      console.error('Error loading Recutting dashboard:', err);
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

  const summary = data?.summary || {
    awaitingReceiptCount: 0,
    awaitingReceiptPcs: 0,
    inCuttingQueueCount: 0,
    inCuttingQueuePcs: 0,
    inProgressCount: 0,
    inProgressPcs: 0,
    completedVerificationCount: 0,
    completedVerificationPcs: 0,
    readyForStitchingCount: 0,
    readyForStitchingPcs: 0,
    handedOverCount: 0,
    handedOverPcs: 0,
    onHoldCount: 0,
    onHoldPcs: 0,
    totalIncomingChallans: 0,
    totalOutgoingChallans: 0,
    totalProcessedPcs: 0,
    totalGoodCutPcs: 0,
    totalRetrimPcs: 0,
    totalRejectPcs: 0,
    accuracyRate: '100.0',
  };

  const incomingChallans = data?.incomingChallans || [];
  const outgoingChallans = data?.outgoingChallans || [];
  const recentTransactions = data?.recentTransactions || [];

  const pendingReceipt = incomingChallans.filter((c: any) => c.status === 'ISSUED');
  const inWorkQueue = incomingChallans.filter((c: any) =>
    ['RECEIVED', 'IN_PROCESS', 'COMPLETED', 'READY_FOR_STITCHING'].includes(c.status)
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
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-danger-500/20 text-danger-600 border border-danger-500/30">
                RECUTTING TERMINAL
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-accent-700 font-medium">
                <span className="w-2 h-2 rounded-full bg-accent-400 animate-pulse" />
                Live Real-Time Sync Active
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-neutral-900 tracking-tight mt-1 flex items-center gap-2">
              <Scissors className="w-6 h-6 text-danger-600" />
              <span>Embroidery Recutting & Separation Control Tower</span>
            </h1>
            <p className="text-xs text-neutral-700 mt-0.5">
              Precision cutting, motif panel separation, and pre-stitching verification aligned with Production Sheets.
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
              href="/recutting/issue-challan"
              className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Handover to Stitching</span>
            </Link>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        {error && (
          <div className="p-4 bg-danger-50 border border-danger-200 rounded-xl text-danger-700 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              onClick={() => loadData(true)}
              className="px-3 py-1 bg-danger-600 text-white text-xs font-semibold rounded hover:bg-danger-700 transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* METRICS KPI GRID */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Card 1: Awaiting Receipt */}
          <div className="bg-white p-3.5 rounded-xl border border-neutral-200 shadow-xs flex flex-col justify-between hover:border-accent-500 transition">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-[11px] font-bold uppercase tracking-wider">Awaiting Receipt</span>
              <ArrowDownLeft className="w-4 h-4 text-accent-700" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-black text-neutral-900">{summary.awaitingReceiptCount}</div>
              <div className="text-[11px] font-medium text-accent-700 mt-0.5">
                {summary.awaitingReceiptPcs.toLocaleString()} pcs from QC3
              </div>
            </div>
            <Link
              href="/recutting/incoming"
              className="mt-2 pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] font-semibold text-accent-800 hover:text-accent-800"
            >
              <span>Receive now</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Card 2: In Cutting Queue */}
          <div className="bg-white p-3.5 rounded-xl border border-neutral-200 shadow-xs flex flex-col justify-between hover:border-danger-500 transition">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-[11px] font-bold uppercase tracking-wider">Cutting Queue</span>
              <Briefcase className="w-4 h-4 text-danger-600" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-black text-neutral-900">{summary.inCuttingQueueCount}</div>
              <div className="text-[11px] font-medium text-danger-600 mt-0.5">
                {summary.inCuttingQueuePcs.toLocaleString()} pcs queued
              </div>
            </div>
            <Link
              href="/recutting/my-work"
              className="mt-2 pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] font-semibold text-danger-700 hover:text-danger-800"
            >
              <span>Open queue</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Card 3: In Process */}
          <div className="bg-white p-3.5 rounded-xl border border-neutral-200 shadow-xs flex flex-col justify-between hover:border-brand-500 transition">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-[11px] font-bold uppercase tracking-wider">In Cutting</span>
              <Clock className="w-4 h-4 text-brand-600 animate-spin" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-black text-neutral-900">{summary.inProgressCount}</div>
              <div className="text-[11px] font-medium text-brand-600 mt-0.5">
                {summary.inProgressPcs.toLocaleString()} pcs active
              </div>
            </div>
            <Link
              href="/recutting/my-work"
              className="mt-2 pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] font-semibold text-brand-700 hover:text-brand-800"
            >
              <span>View active</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Card 4: Ready for Stitching */}
          <div className="bg-white p-3.5 rounded-xl border border-neutral-200 shadow-xs flex flex-col justify-between hover:border-accent-500 transition">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-[11px] font-bold uppercase tracking-wider">Ready for Stitching</span>
              <ShieldCheck className="w-4 h-4 text-accent-700" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-black text-neutral-900">{summary.readyForStitchingCount}</div>
              <div className="text-[11px] font-medium text-accent-700 mt-0.5">
                {summary.readyForStitchingPcs.toLocaleString()} pcs verified
              </div>
            </div>
            <Link
              href="/recutting/issue-challan"
              className="mt-2 pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] font-semibold text-accent-800 hover:text-accent-800"
            >
              <span>Dispatch</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Card 5: Handed Over */}
          <div className="bg-white p-3.5 rounded-xl border border-neutral-200 shadow-xs flex flex-col justify-between hover:border-brand-500 transition">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-[11px] font-bold uppercase tracking-wider">Handed Over</span>
              <CheckCircle2 className="w-4 h-4 text-brand-600" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-black text-neutral-900">{summary.handedOverCount}</div>
              <div className="text-[11px] font-medium text-brand-600 mt-0.5">
                {summary.handedOverPcs.toLocaleString()} pcs to Stitching
              </div>
            </div>
            <Link
              href="/recutting/reports"
              className="mt-2 pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] font-semibold text-brand-700 hover:text-brand-800"
            >
              <span>View audit</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Card 6: Cut Accuracy */}
          <div className="bg-white p-3.5 rounded-xl border border-neutral-200 shadow-xs flex flex-col justify-between hover:border-danger-500 transition">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-[11px] font-bold uppercase tracking-wider">Cut Accuracy</span>
              <TrendingUp className="w-4 h-4 text-accent-700" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-black text-neutral-900">{summary.accuracyRate}%</div>
              <div className="text-[11px] font-medium text-neutral-500 mt-0.5">
                {summary.totalGoodCutPcs} good / {summary.totalRejectPcs} scrap
              </div>
            </div>
            <Link
              href="/recutting/reports"
              className="mt-2 pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] font-semibold text-danger-700 hover:text-danger-800"
            >
              <span>Scrap report</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </section>

        {/* WORK PIPELINE & FAST ACTION CARDS */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Incoming Challans Pending Receipt */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-200 bg-neutral-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="w-4 h-4 text-accent-700" />
                <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wide">
                  Incoming from QC Washing (Pending Physical Receipt)
                </h2>
              </div>
              <Link
                href="/recutting/incoming"
                className="text-xs font-bold text-accent-800 hover:text-accent-800 flex items-center gap-1"
              >
                <span>View All ({pendingReceipt.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="p-0 divide-y divide-neutral-100">
              {pendingReceipt.length === 0 ? (
                <div className="p-8 text-center text-neutral-500">
                  <CheckCircle2 className="w-8 h-8 text-accent-700 mx-auto mb-2 opacity-60" />
                  <p className="text-sm font-semibold text-neutral-600">All incoming challans have been received</p>
                  <p className="text-xs text-neutral-500 mt-0.5">New transfers from QC Washing will appear here in real time.</p>
                </div>
              ) : (
                pendingReceipt.slice(0, 5).map((ch: any) => {
                  const pcs = ch.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
                  return (
                    <div
                      key={ch.id}
                      className="p-4 hover:bg-accent-50/40 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-bold text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded">
                            {ch.challanNumber}
                          </span>
                          <span className="text-xs font-bold text-neutral-700">
                            {ch.program?.programNumber || 'No Program'}
                          </span>
                          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-accent-100 text-accent-800 border border-accent-200">
                            Awaiting Receipt
                          </span>
                        </div>
                        <div className="text-xs text-neutral-600 mt-1 flex items-center gap-3 flex-wrap">
                          <span>
                            <strong>Design:</strong> {ch.program?.designNumber || ch.program?.wilcomDesignNumber || 'N/A'}
                          </span>
                          <span>
                            <strong>Buyer:</strong> {ch.program?.buyerName || ch.program?.clientName || 'N/A'}
                          </span>
                          <span>
                            <strong>Fabric:</strong> {ch.program?.fabricName || 'Embroidered Cloth'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className="text-sm font-extrabold text-neutral-900">{pcs.toLocaleString()} PCS</div>
                          <div className="text-[10px] text-neutral-500">
                            {new Date(ch.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <Link
                          href="/recutting/incoming"
                          className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
                        >
                          Receive
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Quick Operations Guide & Status */}
          <div className="bg-white rounded-xl border border-neutral-200 shadow-xs p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-danger-700 mb-3">
                <Scissors className="w-5 h-5" />
                <h3 className="text-sm font-bold uppercase tracking-wide">Recutting Workflow</h3>
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed">
                The Recutting Department receives washed embroidered goods from QC Washing, checks piece counts against the Challan, and cuts/separates motifs according to the approved Production Sheet.
              </p>

              <div className="mt-4 space-y-2.5">
                <div className="p-2.5 rounded-lg bg-neutral-50 border border-neutral-100 text-xs">
                  <div className="font-bold text-neutral-900">1. Physical Count Verification</div>
                  <div className="text-neutral-500 text-[11px] mt-0.5">Receive incoming challan and match washed pieces.</div>
                </div>
                <div className="p-2.5 rounded-lg bg-neutral-50 border border-neutral-100 text-xs">
                  <div className="font-bold text-neutral-900">2. Precision Cut Operation</div>
                  <div className="text-neutral-500 text-[11px] mt-0.5">Separate panels/motifs with seam allowance.</div>
                </div>
                <div className="p-2.5 rounded-lg bg-neutral-50 border border-neutral-100 text-xs">
                  <div className="font-bold text-neutral-900">3. Pre-Stitching Check & Handover</div>
                  <div className="text-neutral-500 text-[11px] mt-0.5">Verify symmetry and issue Challan to Stitching.</div>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-neutral-100 flex items-center justify-between">
              <Link
                href="/recutting/my-work"
                className="w-full py-2 bg-danger-600 hover:bg-danger-700 text-white text-center rounded-lg text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5"
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>Open Cutting Station</span>
              </Link>
            </div>
          </div>
        </section>

        {/* WORK QUEUE & RECENT ACTIVITY */}
        <section className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-200 bg-neutral-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-danger-600" />
              <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wide">
                Active Cutting Work Queue
              </h2>
            </div>
            <Link
              href="/recutting/my-work"
              className="text-xs font-bold text-danger-700 hover:text-danger-800 flex items-center gap-1"
            >
              <span>Full Workstation ({inWorkQueue.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 text-neutral-600 font-bold uppercase tracking-wider border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3">Challan #</th>
                  <th className="px-4 py-3">Program & Design</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Quantity</th>
                  <th className="px-4 py-3">Issued By</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-700">
                {inWorkQueue.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                      No active jobs in queue. Receive pending challans above to start cutting.
                    </td>
                  </tr>
                ) : (
                  inWorkQueue.slice(0, 8).map((ch: any) => {
                    const pcs = ch.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
                    return (
                      <tr key={ch.id} className="hover:bg-neutral-50/60 transition">
                        <td className="px-4 py-3 font-mono font-bold text-neutral-900">
                          {ch.challanNumber}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-neutral-900">
                            {ch.program?.programNumber || 'No Program'}
                          </div>
                          <div className="text-[11px] text-neutral-500">
                            Design: {ch.program?.designNumber || ch.program?.wilcomDesignNumber || 'N/A'} • {ch.program?.clientName || 'N/A'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {ch.status === 'RECEIVED' && (
                            <span className="px-2 py-0.5 rounded bg-brand-100 text-brand-800 font-semibold text-[10px] border border-brand-200">
                              Ready for Cutting
                            </span>
                          )}
                          {ch.status === 'IN_PROCESS' && (
                            <span className="px-2 py-0.5 rounded bg-accent-100 text-accent-800 font-semibold text-[10px] border border-accent-200">
                              Cutting in Progress
                            </span>
                          )}
                          {ch.status === 'COMPLETED' && (
                            <span className="px-2 py-0.5 rounded bg-brand-100 text-brand-800 font-semibold text-[10px] border border-brand-200">
                              Awaiting Verification
                            </span>
                          )}
                          {ch.status === 'READY_FOR_STITCHING' && (
                            <span className="px-2 py-0.5 rounded bg-accent-100 text-accent-800 font-semibold text-[10px] border border-accent-200">
                              Ready for Stitching
                            </span>
                          )}
                          {ch.status === 'HANDED_OVER' && (
                            <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 font-semibold text-[10px] border border-neutral-200">
                              Handed Over
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-extrabold text-neutral-900">
                          {pcs.toLocaleString()} PCS
                        </td>
                        <td className="px-4 py-3 text-neutral-500">
                          {ch.issuedBy?.fullName || ch.issuedBy?.username || 'QC Washing'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/recutting/my-work?jobId=${ch.id}`}
                            className="px-3 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded text-[11px] font-semibold transition"
                          >
                            Open Workstation
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* OUTGOING HANDOVERS TO STITCHING */}
        <section className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-200 bg-neutral-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-accent-700" />
              <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wide">
                Recent Handover Challans to Stitching Department
              </h2>
            </div>
            <Link
              href="/recutting/issue-challan"
              className="text-xs font-bold text-accent-800 hover:text-accent-800 flex items-center gap-1"
            >
              <span>Issue New Challan</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-neutral-100">
            {outgoingChallans.length === 0 ? (
              <div className="p-8 text-center text-neutral-500">
                <p className="text-sm font-semibold text-neutral-600">No outgoing Challans to Stitching yet</p>
                <p className="text-xs text-neutral-500 mt-0.5">Completed recut jobs will be issued to Stitching Department here.</p>
              </div>
            ) : (
              outgoingChallans.slice(0, 5).map((ch: any) => {
                const pcs = ch.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
                return (
                  <div
                    key={ch.id}
                    className="p-4 hover:bg-neutral-50/60 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-accent-800 bg-accent-50 border border-accent-200 px-2 py-0.5 rounded">
                          {ch.challanNumber}
                        </span>
                        <span className="text-xs font-bold text-neutral-900">
                          {ch.program?.programNumber}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-neutral-500">
                          &rarr; STITCHING
                        </span>
                      </div>
                      <div className="text-xs text-neutral-500 mt-1">
                        Design: {ch.program?.designNumber || ch.program?.wilcomDesignNumber || 'N/A'} • {ch.program?.clientName || 'N/A'}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-black text-neutral-900">{pcs.toLocaleString()} PCS</div>
                      <div className="text-[10px] text-neutral-500">
                        {new Date(ch.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
