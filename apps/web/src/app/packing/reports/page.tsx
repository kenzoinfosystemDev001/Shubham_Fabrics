'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  RefreshCw,
  AlertTriangle,
  Package,
  Boxes,
  Layers,
  Calendar,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';
import { api } from '@/lib/api';

interface ReportsData {
  period: { days: number; from: string; to: string };
  summary: {
    totalPackingJobs: number;
    totalCartonsCreated: number;
    totalPiecesPacked: number;
    totalFgStockAdded: number;
    avgCartonsPerJob: number;
    avgPiecesPerCarton: number;
  };
  styleBreakdown: Array<{
    styleCode: string;
    programNumber: string;
    totalPiecesPacked: number;
    cartonsCount: number;
    fgStockAdded: number;
  }>;
  sizeBreakdown: Array<{
    size: string;
    totalPieces: number;
    cartonsCount: number;
  }>;
  dailyOutput: Array<{
    date: string;
    piecesPacked: number;
    cartonsCreated: number;
  }>;
  recentCartons: Array<{
    cartonNumber: string;
    size: string;
    quantity: number;
    createdAt: string;
    program?: { styleCode?: string; programNumber?: string };
  }>;
}

export default function PackingReportsPage() {
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [days, setDays] = useState(30);

  const loadReports = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setLoading(true);
      setError('');
      const res = await api.getPackingReports(days);
      if (res?.success && res.data) {
        setData(res.data);
      } else {
        const fallbackRes = await fetch(`/api/packing/reports?days=${days}`, { cache: 'no-store' });
        const json = await fallbackRes.json();
        if (json.success && json.data) {
          setData(json.data);
        } else {
          throw new Error(json.error || 'Failed to load reports');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load packing reports');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const summary = data?.summary;

  return (
    <div className="min-h-screen bg-canvas px-4 py-8 text-neutral-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* HEADER */}
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-600 border border-brand-500/30">
                <BarChart3 className="w-3.5 h-3.5" />
                Production Analytics
              </span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold text-neutral-900 tracking-tight">
              Yield & Packaging Reports
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Packing output analytics, style-wise yield, carton distribution, and size breakdown for the selected period.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-white border border-neutral-200 rounded-lg p-1">
              {[7, 14, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-3 py-1.5 rounded text-xs font-bold transition ${
                    days === d
                      ? 'bg-accent-400 text-neutral-900'
                      : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <button
              onClick={() => void loadReports()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 py-2 text-xs font-semibold text-neutral-900 transition hover:bg-neutral-200 hover:text-neutral-900 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-accent-700' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-danger-500/40 bg-danger-500/10 p-4 text-sm text-danger-600 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-danger-600" />
            <p className="font-semibold">{error}</p>
          </div>
        )}

        {/* PERIOD INFO */}
        {data?.period && (
          <div className="flex items-center gap-2 text-xs text-neutral-500 bg-white border border-neutral-200 rounded-lg px-4 py-2">
            <Calendar className="w-4 h-4 text-accent-700" />
            <span>
              Reporting Period: <strong className="text-neutral-900">{new Date(data.period.from).toLocaleDateString()}</strong>
              {' → '}
              <strong className="text-neutral-900">{new Date(data.period.to).toLocaleDateString()}</strong>
              {' '}({data.period.days} days)
            </span>
          </div>
        )}

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Packing Jobs', value: summary?.totalPackingJobs ?? 0, color: 'text-accent-700', icon: Package },
            { label: 'Cartons Created', value: summary?.totalCartonsCreated ?? 0, color: 'text-accent-700', icon: Boxes },
            { label: 'Total Pieces Packed', value: (summary?.totalPiecesPacked ?? 0).toLocaleString(), color: 'text-neutral-900', icon: Layers },
            { label: 'FG Stock Added', value: (summary?.totalFgStockAdded ?? 0).toLocaleString(), color: 'text-brand-600', icon: TrendingUp },
            { label: 'Avg Cartons/Job', value: (summary?.avgCartonsPerJob ?? 0).toFixed(1), color: 'text-brand-600', icon: BarChart3 },
            { label: 'Avg Pcs/Carton', value: (summary?.avgPiecesPerCarton ?? 0).toFixed(1), color: 'text-brand-600', icon: BarChart3 },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="rounded-xl border border-neutral-200 bg-white p-4 text-center">
                <Icon className={`w-5 h-5 mx-auto mb-2 ${card.color}`} />
                <div className={`text-xl font-black ${card.color}`}>{card.value}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mt-1">{card.label}</div>
              </div>
            );
          })}
        </div>

        {/* STYLE-WISE BREAKDOWN */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-4">
            <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2 border-b border-neutral-200 pb-3">
              <Package className="w-4 h-4 text-accent-700" />
              Style / Program Packing Yield
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-neutral-700">
                <thead className="bg-white text-[10px] font-bold uppercase tracking-wider text-neutral-500 border-b border-neutral-200">
                  <tr>
                    <th className="px-3 py-2">Style / Prog</th>
                    <th className="px-3 py-2 text-right">Pieces</th>
                    <th className="px-3 py-2 text-right">Cartons</th>
                    <th className="px-3 py-2 text-right">FG Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {data?.styleBreakdown && data.styleBreakdown.length > 0 ? (
                    data.styleBreakdown.slice(0, 10).map((row, idx) => (
                      <tr key={idx} className="hover:bg-neutral-100">
                        <td className="px-3 py-2.5">
                          <span className="font-bold text-neutral-900 block font-mono">{row.styleCode}</span>
                          <span className="text-[10px] text-neutral-500">#{row.programNumber}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-black text-accent-700">{row.totalPiecesPacked}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-accent-700">{row.cartonsCount}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-brand-600">{row.fgStockAdded}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-neutral-500">
                        {loading ? 'Loading...' : 'No style data for this period.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SIZE BREAKDOWN */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-4">
            <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2 border-b border-neutral-200 pb-3">
              <Layers className="w-4 h-4 text-brand-600" />
              Size-Wise Carton Distribution
            </h2>
            <div className="space-y-3">
              {data?.sizeBreakdown && data.sizeBreakdown.length > 0 ? (
                data.sizeBreakdown.map((row, idx) => {
                  const maxPieces = Math.max(...data.sizeBreakdown.map((r) => r.totalPieces));
                  const pct = maxPieces > 0 ? Math.round((row.totalPieces / maxPieces) * 100) : 0;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-bold text-neutral-900">{row.size}</span>
                        <div className="flex items-center gap-3 font-mono text-neutral-700">
                          <span>{row.totalPieces.toLocaleString()} pcs</span>
                          <span className="text-neutral-500">·</span>
                          <span className="text-accent-700">{row.cartonsCount} ctns</span>
                        </div>
                      </div>
                      <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent-400 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs text-neutral-500">
                  {loading ? 'Loading...' : 'No size breakdown data for this period.'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RECENT CARTONS TABLE */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
            <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
              <Boxes className="w-4 h-4 text-accent-700" />
              Recent Carton Packaging Activity
            </h2>
            <Link
              href="/packing/inventory"
              className="text-xs font-semibold text-accent-700 hover:text-accent-700 flex items-center gap-1"
            >
              Full FG Store <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-700">
              <thead className="bg-white text-[10px] font-bold uppercase tracking-wider text-neutral-500 border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-2.5">Carton #</th>
                  <th className="px-4 py-2.5">Style</th>
                  <th className="px-4 py-2.5">Size</th>
                  <th className="px-4 py-2.5 text-right">Pieces</th>
                  <th className="px-4 py-2.5 text-right">Packed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 font-mono">
                {data?.recentCartons && data.recentCartons.length > 0 ? (
                  data.recentCartons.slice(0, 15).map((ctn, idx) => (
                    <tr key={idx} className="hover:bg-neutral-100">
                      <td className="px-4 py-2.5 font-bold text-accent-700">{ctn.cartonNumber}</td>
                      <td className="px-4 py-2.5 font-sans">
                        <span className="text-neutral-900 font-bold">{ctn.program?.styleCode || 'N/A'}</span>
                        <span className="text-[10px] text-neutral-500 block">#{ctn.program?.programNumber || 'N/A'}</span>
                      </td>
                      <td className="px-4 py-2.5 font-sans font-bold text-neutral-900">{ctn.size}</td>
                      <td className="px-4 py-2.5 text-right font-black text-accent-700">{ctn.quantity}</td>
                      <td className="px-4 py-2.5 text-right text-neutral-500 text-[11px] font-sans">
                        {new Date(ctn.createdAt).toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-neutral-500 font-sans">
                      {loading ? 'Loading carton data...' : 'No cartons packed in this period.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
