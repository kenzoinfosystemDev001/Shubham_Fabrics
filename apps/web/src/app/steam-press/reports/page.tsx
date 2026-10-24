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
    <div className="min-h-screen bg-canvas text-neutral-900 flex flex-col">
      {/* HEADER HERO */}
      <div
        className="bg-white border-b border-neutral-200 px-6 py-8"
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-600 shadow-inner">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900 flex items-center gap-2">
                Steam Press Analytics & Performance Reports
              </h1>
              <p className="text-xs text-neutral-500 mt-0.5">
                Yield analysis, first-pass quality rate, defect categorization, and audit log
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadReports(true)}
              disabled={loading}
              className="p-2 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-700 hover:text-neutral-900 transition disabled:opacity-50"
              title="Refresh Reports"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-600' : ''}`} />
            </button>
            <Link
              href="/steam-press/my-work"
              className="px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
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
          <div className="p-3 bg-danger-500/10 border border-danger-500/30 rounded-xl text-danger-600 text-xs">
            {error}
          </div>
        )}

        {/* TOP LEVEL METRICS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Yield */}
          <div className="p-4 bg-white border border-neutral-200 rounded-2xl backdrop-blur-xs space-y-1">
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>First-Pass Yield</span>
              <TrendingUp className="w-4 h-4 text-accent-700" />
            </div>
            <div className="font-mono text-2xl font-bold text-neutral-900">{yieldPercentage}%</div>
            <span className="text-[10px] text-neutral-500">Good pieces ratio to total</span>
          </div>

          {/* Total Handled */}
          <div className="p-4 bg-white border border-neutral-200 rounded-2xl backdrop-blur-xs space-y-1">
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>Total Inward Pieces</span>
              <Layers className="w-4 h-4 text-brand-600" />
            </div>
            <div className="font-mono text-2xl font-bold text-neutral-900">{totalInput} PCS</div>
            <span className="text-[10px] text-neutral-500">Processed across all runs</span>
          </div>

          {/* Good Released */}
          <div className="p-4 bg-white border border-neutral-200 rounded-2xl backdrop-blur-xs space-y-1">
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>Good Pressed Released</span>
              <CheckCircle2 className="w-4 h-4 text-brand-600" />
            </div>
            <div className="font-mono text-2xl font-bold text-brand-600">{totalGood} PCS</div>
            <span className="text-[10px] text-neutral-500">Handed over to Final QC</span>
          </div>

          {/* Re-press Rework */}
          <div className="p-4 bg-white border border-neutral-200 rounded-2xl backdrop-blur-xs space-y-1">
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>Re-press Rework</span>
              <AlertTriangle className="w-4 h-4 text-accent-700" />
            </div>
            <div className="font-mono text-2xl font-bold text-neutral-900">{totalRework} PCS</div>
            <span className="text-[10px] text-neutral-500">Minor re-steam touchups</span>
          </div>

          {/* Scorch Scrap */}
          <div className="p-4 bg-white border border-neutral-200 rounded-2xl backdrop-blur-xs space-y-1">
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>Permanent Scorch Scrap</span>
              <AlertTriangle className="w-4 h-4 text-danger-600" />
            </div>
            <div className="font-mono text-2xl font-bold text-danger-600">{totalReject} PCS</div>
            <span className="text-[10px] text-neutral-500">Non-recoverable glaze/burn</span>
          </div>
        </div>

        {/* DEFECT CATEGORIES & STYLE BREAKDOWN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* DEFECT REASONS BREAKDOWN (5 cols) */}
          <div className="lg:col-span-5 bg-white border border-neutral-200 rounded-2xl p-5 backdrop-blur-xs space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <h3 className="font-bold text-sm text-neutral-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-danger-600" />
                <span>Defect Categorization</span>
              </h3>
              <span className="text-xs text-neutral-500">{defects.length} Incidents</span>
            </div>

            {Object.keys(defectDistribution).length === 0 ? (
              <div className="py-8 text-center text-neutral-500 text-xs">
                Zero defects recorded! Pristine pressing operations.
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(defectDistribution).map(([reason, count]: [string, any]) => {
                  const pct = totalReject > 0 ? ((count / totalReject) * 100).toFixed(0) : '0';
                  return (
                    <div key={reason} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-neutral-700">{reason}</span>
                        <span className="font-mono font-bold text-danger-600">
                          {count} PCS ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-canvas h-2 rounded-full overflow-hidden border border-neutral-200">
                        <div
                          className="bg-danger-500 h-full rounded-full"
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
          <div className="lg:col-span-7 bg-white border border-neutral-200 rounded-2xl p-5 backdrop-blur-xs space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <h3 className="font-bold text-sm text-neutral-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-600" />
                <span>Style-Wise Throughput</span>
              </h3>
            </div>

            {styleWiseMetrics.length === 0 ? (
              <div className="py-8 text-center text-neutral-500 text-xs">
                No style throughput data recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-neutral-700">
                  <thead className="bg-white text-neutral-500 text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="p-2.5 rounded-l-lg">Style / Program</th>
                      <th className="p-2.5">Inward</th>
                      <th className="p-2.5">Good</th>
                      <th className="p-2.5">Scrap</th>
                      <th className="p-2.5 rounded-r-lg">Yield</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {styleWiseMetrics.map((st: any, idx: number) => {
                      const yieldPct =
                        st.inward > 0 ? ((st.good / st.inward) * 100).toFixed(1) : '100.0';
                      return (
                        <tr key={idx} className="hover:bg-neutral-100">
                          <td className="p-2.5">
                            <span className="font-semibold text-neutral-900 block">{st.styleCode}</span>
                            <span className="text-[10px] text-neutral-500">{st.programNumber}</span>
                          </td>
                          <td className="p-2.5 font-mono">{st.inward}</td>
                          <td className="p-2.5 font-mono text-accent-700 font-bold">{st.good}</td>
                          <td className="p-2.5 font-mono text-danger-600">{st.reject}</td>
                          <td className="p-2.5 font-mono font-bold text-brand-600">{yieldPct}%</td>
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
        <div className="bg-white border border-neutral-200 rounded-2xl p-5 backdrop-blur-xs space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
            <h3 className="font-bold text-sm text-neutral-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-600" />
              <span>Production Transactions & Execution Log</span>
            </h3>
            <span className="text-xs text-neutral-500">{transactions.length} Records</span>
          </div>

          {transactions.length === 0 ? (
            <div className="py-8 text-center text-neutral-500 text-xs">
              No transactions recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-neutral-700">
                <thead className="bg-white text-neutral-500 text-[11px] uppercase tracking-wider">
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
                <tbody className="divide-y divide-neutral-200">
                  {transactions.map((tx: any) => (
                    <tr key={tx.id} className="hover:bg-neutral-100">
                      <td className="p-2.5 font-mono text-neutral-500 text-[11px]">
                        {new Date(tx.createdAt).toLocaleString()}
                      </td>
                      <td className="p-2.5 font-mono font-bold text-brand-600">
                        {tx.challan?.challanNumber || 'N/A'}
                      </td>
                      <td className="p-2.5">
                        <span className="text-neutral-900 block font-medium">
                          {tx.program?.styleCode || 'Standard'}
                        </span>
                        <span className="text-[10px] text-neutral-500">{tx.program?.programNumber}</span>
                      </td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-brand-50 text-brand-600 border border-brand-500/40">
                          {tx.transactionType}
                        </span>
                      </td>
                      <td className="p-2.5 font-mono font-bold text-accent-700">
                        {tx.goodQuantity || 0}
                      </td>
                      <td className="p-2.5 font-mono text-accent-700">
                        {tx.reworkQuantity || 0}
                      </td>
                      <td className="p-2.5 font-mono text-danger-600">
                        {tx.rejectQuantity || 0}
                      </td>
                      <td className="p-2.5 text-neutral-500 truncate max-w-xs">
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
