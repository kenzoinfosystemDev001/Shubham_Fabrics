'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Wind,
  Flame,
  ShieldCheck,
  User,
  Clock,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';

export default function SteamPressReportsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  const loadReports = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError('');
      const res = await fetch('/api/steam-press/reports');
      if (!res.ok) throw new Error('Failed to load Steam Press reports data');
      const json = await res.json();
      setData(json.data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error loading reports data');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadReports(true);
  }, []);

  const transactions = data?.transactions || [];
  const defects = data?.defects || [];
  const styleWiseMetrics = data?.styleWiseMetrics || [];
  const defectDistribution = data?.defectDistribution || {};

  let totalInput = 0;
  let totalGood = 0;
  let totalRework = 0;
  let totalReject = 0;

  transactions.forEach((tx: any) => {
    totalInput += Number(tx.inputQuantity) || 0;
    totalGood += Number(tx.goodQuantity) || 0;
    totalRework += Number(tx.reworkQuantity) || 0;
    totalReject += Number(tx.rejectQuantity) || 0;
  });

  const yieldPercentage = totalInput > 0 ? ((totalGood / totalInput) * 100).toFixed(1) : '100.0';

  return (
    <div className="min-h-screen bg-ink-950 text-slate-100 flex flex-col">
      {/* HEADER HERO */}
      <div
        style={{
          backgroundImage: `linear-gradient(to right, rgba(37, 35, 42, 0.95), rgba(37, 35, 42, 0.85)), url('${DEPARTMENT_NAV_BG_IMAGE}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        className="border-b border-slate-800/80 px-6 py-8"
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Steam Press Analytics & Performance Reports
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Yield analysis, first-pass quality rate, defect categorization, and audit log
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadReports(true)}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-300 hover:text-white transition disabled:opacity-50"
              title="Refresh Reports"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            <Link
              href="/steam-press/my-work"
              className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-900/30 transition flex items-center gap-1.5"
            >
              <Flame className="w-4 h-4" />
              <span>Workstation</span>
            </Link>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 space-y-8">
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* TOP LEVEL METRICS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Yield */}
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl backdrop-blur-xs space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>First-Pass Yield</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="font-mono text-2xl font-bold text-emerald-400">{yieldPercentage}%</div>
            <span className="text-[10px] text-slate-500">Good pieces ratio to total</span>
          </div>

          {/* Total Handled */}
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl backdrop-blur-xs space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Total Inward Pieces</span>
              <Layers className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="font-mono text-2xl font-bold text-white">{totalInput} PCS</div>
            <span className="text-[10px] text-slate-500">Processed across all runs</span>
          </div>

          {/* Good Released */}
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl backdrop-blur-xs space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Good Pressed Released</span>
              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="font-mono text-2xl font-bold text-cyan-300">{totalGood} PCS</div>
            <span className="text-[10px] text-slate-500">Handed over to Final QC</span>
          </div>

          {/* Re-press Rework */}
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl backdrop-blur-xs space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Re-press Rework</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="font-mono text-2xl font-bold text-amber-400">{totalRework} PCS</div>
            <span className="text-[10px] text-slate-500">Minor re-steam touchups</span>
          </div>

          {/* Scorch Scrap */}
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl backdrop-blur-xs space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Permanent Scorch Scrap</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="font-mono text-2xl font-bold text-rose-400">{totalReject} PCS</div>
            <span className="text-[10px] text-slate-500">Non-recoverable glaze/burn</span>
          </div>
        </div>

        {/* DEFECT CATEGORIES & STYLE BREAKDOWN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* DEFECT REASONS BREAKDOWN (5 cols) */}
          <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Defect Categorization</span>
              </h3>
              <span className="text-xs text-slate-400">{defects.length} Incidents</span>
            </div>

            {Object.keys(defectDistribution).length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                Zero defects recorded! Pristine pressing operations.
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(defectDistribution).map(([reason, count]: [string, any]) => {
                  const pct = totalReject > 0 ? ((count / totalReject) * 100).toFixed(0) : '0';
                  return (
                    <div key={reason} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300">{reason}</span>
                        <span className="font-mono font-bold text-rose-400">
                          {count} PCS ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className="bg-rose-500 h-full rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* STYLE-WISE METRICS (7 cols) */}
          <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>Style-Wise Throughput</span>
              </h3>
            </div>

            {styleWiseMetrics.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                No style throughput data recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/60 text-slate-400 text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="p-2.5 rounded-l-lg">Style / Program</th>
                      <th className="p-2.5">Inward</th>
                      <th className="p-2.5">Good</th>
                      <th className="p-2.5">Scrap</th>
                      <th className="p-2.5 rounded-r-lg">Yield</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {styleWiseMetrics.map((st: any, idx: number) => {
                      const yieldPct =
                        st.inward > 0 ? ((st.good / st.inward) * 100).toFixed(1) : '100.0';
                      return (
                        <tr key={idx} className="hover:bg-slate-800/30">
                          <td className="p-2.5">
                            <span className="font-semibold text-white block">{st.styleCode}</span>
                            <span className="text-[10px] text-slate-500">{st.programNumber}</span>
                          </td>
                          <td className="p-2.5 font-mono">{st.inward}</td>
                          <td className="p-2.5 font-mono text-emerald-400 font-bold">{st.good}</td>
                          <td className="p-2.5 font-mono text-rose-400">{st.reject}</td>
                          <td className="p-2.5 font-mono font-bold text-cyan-300">{yieldPct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* PRODUCTION TRANSACTION LOG */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>Production Transactions & Execution Log</span>
            </h3>
            <span className="text-xs text-slate-400">{transactions.length} Records</span>
          </div>

          {transactions.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              No transactions recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/60 text-slate-400 text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="p-2.5 rounded-l-lg">Timestamp</th>
                    <th className="p-2.5">Challan #</th>
                    <th className="p-2.5">Style / Program</th>
                    <th className="p-2.5">Type</th>
                    <th className="p-2.5">Good</th>
                    <th className="p-2.5">Rework</th>
                    <th className="p-2.5">Scrap</th>
                    <th className="p-2.5 rounded-r-lg">Operator Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {transactions.map((tx: any) => (
                    <tr key={tx.id} className="hover:bg-slate-800/30">
                      <td className="p-2.5 font-mono text-slate-400 text-[11px]">
                        {new Date(tx.createdAt).toLocaleString()}
                      </td>
                      <td className="p-2.5 font-mono font-bold text-cyan-300">
                        {tx.challan?.challanNumber || 'N/A'}
                      </td>
                      <td className="p-2.5">
                        <span className="text-white block font-medium">
                          {tx.program?.styleCode || 'Standard'}
                        </span>
                        <span className="text-[10px] text-slate-500">{tx.program?.programNumber}</span>
                      </td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-950/40 text-cyan-300 border border-cyan-800/40">
                          {tx.transactionType}
                        </span>
                      </td>
                      <td className="p-2.5 font-mono font-bold text-emerald-400">
                        {tx.goodQuantity || 0}
                      </td>
                      <td className="p-2.5 font-mono text-amber-400">
                        {tx.reworkQuantity || 0}
                      </td>
                      <td className="p-2.5 font-mono text-rose-400">
                        {tx.rejectQuantity || 0}
                      </td>
                      <td className="p-2.5 text-slate-400 truncate max-w-xs">
                        {tx.remarks || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
