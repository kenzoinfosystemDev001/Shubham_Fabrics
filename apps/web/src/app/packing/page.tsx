'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Boxes,
  Package,
  PackageCheck,
  Clock3,
  RefreshCw,
  Warehouse,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Sparkles,
} from 'lucide-react';
import { api } from '@/lib/api';

interface PackingDashboardData {
  summary: {
    awaitingInwardCount: number;
    awaitingInwardPcs: number;
    readyToPackCount: number;
    readyToPackPcs: number;
    inProgressCount: number;
    inProgressPcs: number;
    completedCount: number;
    completedPcs: number;
    onHoldCount: number;
    onHoldPcs: number;
    totalIncomingChallans: number;
    totalCartonsCount: number;
    totalFgStockPcs: number;
    totalPackedPcs: number;
  };
  incomingChallans: Array<{
    id: string;
    challanNumber: string;
    fromDepartment: string;
    toDepartment: string;
    status: string;
    createdAt: string;
    program?: {
      id: string;
      programNumber?: string;
      styleCode?: string;
      buyerName?: string;
      clientName?: string;
      fabricName?: string;
    };
    items: Array<{ quantity: number; uom: string; size?: string; color?: string }>;
    issuedBy?: { fullName?: string };
    receivedBy?: { fullName?: string };
  }>;
  recentCartons: Array<{
    id: string;
    cartonNumber: string;
    size: string;
    colour?: string;
    quantity: number;
    grossWeightKg?: number;
    locationRack?: string;
    locationShelf?: string;
    status: string;
    createdAt: string;
    program?: {
      programNumber?: string;
      styleCode?: string;
      clientName?: string;
    };
  }>;
  fgStockBalances: Array<{
    id: string;
    identifier: string;
    currentQuantity: number;
    uom: string;
    updatedAt: string;
  }>;
}

export default function PackingDashboard() {
  const [data, setData] = useState<PackingDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadDashboard = useCallback(async (quiet = false) => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden' && quiet) return;
    try {
      if (!quiet) setLoading(true);
      setError('');
      const result = await api.getPackingDashboard();
      if (result?.success && result?.data) {
        setData(result.data);
      } else {
        // Direct fetch fallback if api wrapper format varies
        const res = await fetch('/api/packing/dashboard', { cache: 'no-store' });
        const json = await res.json();
        if (json.success && json.data) {
          setData(json.data);
        } else {
          throw new Error(json.error || 'Failed to load packing dashboard');
        }
      }
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to load Packing dashboard data.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
    const interval = window.setInterval(() => void loadDashboard(true), 10000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void loadDashboard(true);
    };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadDashboard]);

  const summary = data?.summary;

  const statCards = [
    {
      label: 'Awaiting Inward',
      count: summary?.awaitingInwardCount ?? 0,
      pieces: summary?.awaitingInwardPcs ?? 0,
      icon: Clock3,
      color: 'text-accent-700',
      bgColor: 'bg-accent-400/10 border-accent-500/30',
      href: '/packing/incoming',
      badge: 'From Final QC',
    },
    {
      label: 'Ready to Pack',
      count: summary?.readyToPackCount ?? 0,
      pieces: summary?.readyToPackPcs ?? 0,
      icon: Package,
      color: 'text-accent-700',
      bgColor: 'bg-accent-400/10 border-accent-500/30',
      href: '/packing/workspace',
      badge: 'Floor Queue',
    },
    {
      label: 'In Progress Jobs',
      count: summary?.inProgressCount ?? 0,
      pieces: summary?.inProgressPcs ?? 0,
      icon: Layers,
      color: 'text-brand-600',
      bgColor: 'bg-brand-500/10 border-brand-500/30',
      href: '/packing/queue',
      badge: 'Active Packing',
    },
    {
      label: 'FG Stock Available',
      count: summary?.totalCartonsCount ?? 0,
      pieces: summary?.totalFgStockPcs ?? 0,
      icon: Warehouse,
      color: 'text-brand-600',
      bgColor: 'bg-brand-500/10 border-brand-500/30',
      href: '/packing/inventory',
      badge: 'FG Warehouse',
    },
  ];

  return (
    <div className="min-h-screen bg-canvas px-4 py-8 text-neutral-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* HEADER */}
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent-400/10 text-accent-700 border border-accent-500/30">
                <Sparkles className="w-3.5 h-3.5" />
                Department 15 &bull; Final Production Handover
              </span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold text-neutral-900 tracking-tight">
              Packing & Finished Goods Inventory
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Receipt of QC-inspected garments, barcode carton packing, and authoritative stock ledger updates.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => void loadDashboard()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 py-2 text-xs font-semibold text-neutral-900 transition hover:bg-neutral-200 hover:text-neutral-900 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-accent-700' : ''}`} />
              <span>Refresh</span>
            </button>
            <Link
              href="/packing/workspace"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-700 shadow-sm"
            >
              <Package className="w-4 h-4" />
              <span>Start Packing</span>
            </Link>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-danger-500/40 bg-danger-500/10 p-4 text-sm text-danger-600 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-danger-600" />
            <div>
              <p className="font-semibold">Dashboard Notice</p>
              <p className="text-xs text-danger-600">{error}</p>
            </div>
          </div>
        )}

        {/* STATS OVERVIEW CARDS */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.label}
                href={card.href}
                className={`relative rounded-xl border p-5 transition hover:scale-[1.01] hover:shadow-lg ${card.bgColor}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                    {card.label}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white text-neutral-700 border border-neutral-200">
                    {card.badge}
                  </span>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <div>
                    <span className="text-2xl font-black text-neutral-900">{card.pieces.toLocaleString()}</span>
                    <span className="ml-1.5 text-xs font-medium text-neutral-500">pcs</span>
                  </div>
                  <div className={`p-2 rounded-lg bg-white ${card.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-neutral-500 border-t border-neutral-200 pt-2">
                  <span>
                    <strong className="text-neutral-900">{card.count}</strong> {card.label.includes('FG') ? 'cartons' : 'challans'}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-accent-700 hover:text-accent-700">
                    View <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* SECOND ROW: QUICK ACTION WORKFLOW */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* INCOMING FROM FINAL QC (2 cols) */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5 lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div>
                <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  <Clock3 className="w-4 h-4 text-accent-700" />
                  Incoming Piece Transfers (Final QC)
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Verify piece quantities against physical Challans from Final QC before packing.
                </p>
              </div>
              <Link
                href="/packing/incoming"
                className="text-xs font-semibold text-accent-700 hover:text-accent-700 inline-flex items-center gap-1"
              >
                All Incoming <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="divide-y divide-neutral-200">
              {data?.incomingChallans && data.incomingChallans.length > 0 ? (
                data.incomingChallans.slice(0, 5).map((ch) => {
                  const totalPcs = ch.items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
                  const isIssued = ch.status === 'ISSUED';
                  const isReceived = ch.status === 'RECEIVED';
                  const isInProcess = ch.status === 'IN_PROCESS';
                  return (
                    <div key={ch.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-accent-700">{ch.challanNumber}</span>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${
                              isIssued
                                ? 'bg-accent-400/20 text-accent-700 border border-accent-500/40'
                                : isReceived
                                ? 'bg-accent-400/20 text-accent-700 border border-accent-500/40'
                                : isInProcess
                                ? 'bg-brand-500/20 text-brand-600 border border-brand-500/40'
                                : 'bg-neutral-100 text-neutral-500'
                            }`}
                          >
                            {ch.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-700 truncate mt-1">
                          <strong>Prog #{ch.program?.programNumber || 'N/A'}</strong> &bull; {ch.program?.styleCode || 'N/A'} &bull; {ch.program?.clientName || 'N/A'}
                        </p>
                        <p className="text-[11px] text-neutral-500">
                          From: {ch.fromDepartment} &bull; Issued by: {ch.issuedBy?.fullName || 'QC Inspector'}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-sm font-black text-neutral-900">{totalPcs.toLocaleString()} <span className="text-xs font-normal text-neutral-500">pcs</span></p>
                        <div className="mt-1">
                          {isIssued ? (
                            <Link
                              href="/packing/incoming"
                              className="inline-flex items-center gap-1 rounded bg-accent-400/20 hover:bg-accent-400/30 text-accent-700 px-2 py-1 text-[11px] font-bold border border-accent-500/40 transition"
                            >
                              Receive Pieces
                            </Link>
                          ) : (
                            <Link
                              href={`/packing/workspace/${ch.id}`}
                              className="inline-flex items-center gap-1 rounded bg-accent-400/20 hover:bg-accent-400/30 text-accent-700 px-2 py-1 text-[11px] font-bold border border-accent-500/40 transition"
                            >
                              Pack Now
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs text-neutral-500">
                  {loading ? 'Loading incoming handovers...' : 'No incoming piece transfers awaiting action.'}
                </div>
              )}
            </div>
          </div>

          {/* RECENT CARTONS & FG SNAPSHOT (1 col) */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div>
                <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-accent-700" />
                  Recent Cartons Packed
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Packaged inventory transferred to FG warehouse.
                </p>
              </div>
              <Link
                href="/packing/inventory"
                className="text-xs font-semibold text-accent-700 hover:text-accent-700 inline-flex items-center gap-1"
              >
                Store <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="divide-y divide-neutral-200">
              {data?.recentCartons && data.recentCartons.length > 0 ? (
                data.recentCartons.slice(0, 5).map((carton) => (
                  <div key={carton.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-mono font-bold text-neutral-900">{carton.cartonNumber}</p>
                      <p className="text-[11px] text-neutral-500">
                        Size: <strong className="text-accent-700">{carton.size}</strong> &bull; Rack: {carton.locationRack || 'A1'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-accent-700">{carton.quantity} pcs</p>
                      <p className="text-[10px] text-neutral-500">{carton.grossWeightKg ? `${carton.grossWeightKg} kg` : 'Standard'}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-neutral-500">
                  No cartons packed recently.
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-neutral-200">
              <div className="rounded-lg bg-white p-3 border border-neutral-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-neutral-500 block">Total FG Physical Stock</span>
                  <span className="text-lg font-black text-brand-600">
                    {(summary?.totalFgStockPcs ?? 0).toLocaleString()} <span className="text-xs font-normal text-neutral-500">pcs</span>
                  </span>
                </div>
                <Link
                  href="/packing/inventory"
                  className="rounded-lg bg-brand-500/20 hover:bg-brand-500/30 text-brand-600 px-3 py-1.5 text-xs font-bold border border-brand-500/40 transition"
                >
                  View FG Ledger
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM SECTION: PRODUCTION TRACEABILITY GUARANTEE */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-accent-400/10 border border-accent-500/30 text-accent-700 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900">Full Invariant & Reconciliation Protection</h3>
              <p className="text-xs text-neutral-500">
                Packed pieces are bounded by Final QC received quantities ($Remaining = Received - Packed$). Finished Goods stock movements generate immutable audit ledger receipts. Double counting is mathematically prohibited.
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <span className="text-xs font-mono text-neutral-500 block">
              Last Synced: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Connecting...'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
