'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock3, PackageCheck, RefreshCw, ShieldAlert } from 'lucide-react';

interface FinalCheckDashboardData {
  summary: {
    awaitingReceiptCount: number;
    awaitingReceiptPcs: number;
    inQueueCount: number;
    inQueuePcs: number;
    inProgressCount: number;
    inProgressPcs: number;
    completedCount: number;
    completedPcs: number;
    readyForHandoverCount: number;
    readyForHandoverPcs: number;
    handedOverCount: number;
    handedOverPcs: number;
    onHoldCount: number;
    onHoldPcs: number;
    totalInputPcs: number;
    totalAcceptedPcs: number;
    totalReworkPcs: number;
    totalRejectPcs: number;
    firstPassYield: string;
  };
  incomingChallans: Array<{
    id: string;
    challanNumber: string;
    fromDepartment: string;
    status: string;
    createdAt: string;
    program?: {
      programNumber?: string;
      styleCode?: string;
      buyerName?: string;
      clientName?: string;
    };
    items: Array<{ quantity: number; uom: string }>;
  }>;
}

export default function FinalCheckDashboard() {
  const [data, setData] = useState<FinalCheckDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadDashboard = useCallback(async (quiet = false) => {
    if (document.visibilityState === 'hidden' && quiet) return;
    try {
      if (!quiet) setLoading(true);
      setError('');
      const response = await fetch('/api/final-check/dashboard', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Could not load the Final QC dashboard.');
      }
      setData(result.data);
      setLastUpdated(new Date());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load the Final QC dashboard.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
    const interval = window.setInterval(() => void loadDashboard(true), 5000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void loadDashboard(true);
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [loadDashboard]);

  const summary = data?.summary;
  const cards = [
    { label: 'Awaiting Receipt', count: summary?.awaitingReceiptCount ?? 0, pieces: summary?.awaitingReceiptPcs ?? 0, icon: Clock3 },
    { label: 'Inspection Queue', count: summary?.inQueueCount ?? 0, pieces: summary?.inQueuePcs ?? 0, icon: CheckCircle2 },
    { label: 'Ready for Handover', count: summary?.readyForHandoverCount ?? 0, pieces: summary?.readyForHandoverPcs ?? 0, icon: PackageCheck },
    { label: 'On Hold', count: summary?.onHoldCount ?? 0, pieces: summary?.onHoldPcs ?? 0, icon: ShieldAlert },
  ];

  return (
    <div className="min-h-screen bg-canvas px-4 py-8 text-neutral-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-700">Quality Control</p>
            <h1 className="mt-1 text-3xl font-bold text-neutral-900">Final QC Dashboard</h1>
            <p className="mt-2 text-sm text-neutral-500">Final garment inspection, quality status, and handover overview.</p>
          </div>
          <button
            type="button"
            onClick={() => void loadDashboard()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 transition hover:border-accent-500/50 hover:text-neutral-900 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </header>

        {error && (
          <div role="alert" className="flex items-center gap-3 rounded-xl border border-danger-500/30 bg-danger-500/10 p-4 text-sm text-danger-800">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <section aria-label="Final QC summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ label, count, pieces, icon: Icon }) => (
            <article key={label} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm shadow-black/10">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-500">{label}</p>
                  <p className="mt-3 text-3xl font-bold text-neutral-900">{loading ? '—' : count}</p>
                  <p className="mt-1 text-xs text-neutral-500">{pieces.toLocaleString()} pcs</p>
                </div>
                <span className="rounded-xl border border-accent-500/20 bg-accent-400/10 p-3 text-accent-700">
                  <Icon className="h-5 w-5" />
                </span>
              </div>
            </article>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
              <div>
                <h2 className="font-semibold text-neutral-900">Incoming Challans</h2>
                <p className="mt-1 text-xs text-neutral-500">Latest handovers awaiting Final QC receipt or inspection</p>
              </div>
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700">
                {data?.incomingChallans.length ?? 0}
              </span>
            </div>
            {loading && !data ? (
              <p className="p-6 text-sm text-neutral-500">Loading Final QC data…</p>
            ) : data?.incomingChallans.length ? (
              <div className="divide-y divide-neutral-200">
                {data.incomingChallans.slice(0, 10).map((challan) => {
                  const quantity = challan.items.reduce((total, item) => total + Number(item.quantity || 0), 0);
                  return (
                    <article key={challan.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-neutral-900">{challan.challanNumber}</p>
                        <p className="mt-1 text-xs text-neutral-500">
                          {challan.program?.programNumber || 'Program unavailable'} · From {challan.fromDepartment}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="font-medium text-neutral-700">{quantity.toLocaleString()} pcs</span>
                        <span className="rounded-full border border-accent-500/20 bg-accent-400/10 px-2.5 py-1 text-accent-700">
                          {challan.status.replaceAll('_', ' ')}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="p-6 text-sm text-neutral-500">No incoming Final QC challans yet.</p>
            )}
          </div>

          <aside className="rounded-2xl border border-neutral-200 bg-white p-5">
            <h2 className="font-semibold text-neutral-900">Quality Summary</h2>
            <p className="mt-1 text-xs text-neutral-500">Recorded Final QC production totals</p>
            <dl className="mt-5 space-y-4">
              <div className="flex justify-between gap-3 text-sm">
                <dt className="text-neutral-500">First-pass yield</dt>
                <dd className="font-semibold text-accent-700">{summary?.firstPassYield ?? '—'}%</dd>
              </div>
              <div className="flex justify-between gap-3 text-sm">
                <dt className="text-neutral-500">Input inspected</dt>
                <dd className="font-medium text-neutral-900">{(summary?.totalInputPcs ?? 0).toLocaleString()} pcs</dd>
              </div>
              <div className="flex justify-between gap-3 text-sm">
                <dt className="text-neutral-500">Accepted</dt>
                <dd className="font-medium text-neutral-900">{(summary?.totalAcceptedPcs ?? 0).toLocaleString()} pcs</dd>
              </div>
              <div className="flex justify-between gap-3 text-sm">
                <dt className="text-neutral-500">Rework / rejects</dt>
                <dd className="font-medium text-neutral-900">
                  {(summary?.totalReworkPcs ?? 0).toLocaleString()} / {(summary?.totalRejectPcs ?? 0).toLocaleString()} pcs
                </dd>
              </div>
            </dl>
            {lastUpdated && (
              <p className="mt-6 border-t border-neutral-200 pt-4 text-xs text-neutral-500">
                Updated {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </aside>
        </section>
      </div>
    </div>
  );
}
