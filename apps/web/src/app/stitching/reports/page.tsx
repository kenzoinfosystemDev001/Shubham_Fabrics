'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Shirt,
  ShieldCheck,
  User,
  Clock,
  Layers,
  ArrowRight,
} from 'lucide-react';

export default function StitchingReportsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  const loadReports = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError('');
      const res = await fetch('/api/stitching/reports');
      if (!res.ok) throw new Error('Failed to load Stitching reports data');
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
        className="bg-white border-b border-neutral-200 p-6 shadow-sm"
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/20 border border-brand-500/40 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-brand-600" />
            </div>
            <div>
              <h1 className="text-xl font-black text-neutral-900">Stitching Yield & Scrap Analytics</h1>
              <p className="text-xs text-neutral-500 mt-0.5">
                Line Balancing Performance, First-Pass Assembly Yield, and Quarantined Scrap Audit Trail
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadReports(true)}
              disabled={loading}
              className="p-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-neutral-900 transition border border-neutral-200 disabled:opacity-50"
              title="Refresh Analytics"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <Link
              href="/stitching/my-work"
              className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs transition shadow-sm"
            >
              Back to Floor Workstation
            </Link>
          </div>
        </div>
      </div>

      {/* CONTENT BODY */}
      <div className="max-w-7xl mx-auto w-full p-4 md:p-6 space-y-6 flex-1">
        {error && (
          <div className="p-3 rounded-xl bg-danger-500/10 border border-danger-500/30 text-danger-600 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 4 SUMMARY METRIC CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
          <div className="p-4 rounded-xl bg-white border border-neutral-200">
            <span className="text-[11px] text-neutral-500 block mb-1">Total Cut Inputs</span>
            <span className="text-2xl font-black text-neutral-900">{totalInput.toLocaleString()}</span>
            <span className="text-[10px] text-neutral-500 block mt-0.5">Panels / Garment Units</span>
          </div>

          <div className="p-4 rounded-xl bg-white border border-accent-500/30">
            <span className="text-[11px] text-accent-700 block mb-1">Good Garments Assembled</span>
            <span className="text-2xl font-black text-neutral-900">{totalGood.toLocaleString()}</span>
            <span className="text-[10px] text-accent-700 block mt-0.5">Passed QA</span>
          </div>

          <div className="p-4 rounded-xl bg-white border border-accent-500/30">
            <span className="text-[11px] text-accent-700 block mb-1">Re-stitch / Rework</span>
            <span className="text-2xl font-black text-neutral-900">{totalRework.toLocaleString()}</span>
            <span className="text-[10px] text-accent-700 block mt-0.5">Correctable</span>
          </div>

          <div className="p-4 rounded-xl bg-white border border-danger-500/30">
            <span className="text-[11px] text-danger-600 block mb-1">Scrap / Rejects</span>
            <span className="text-2xl font-black text-danger-600">{totalReject.toLocaleString()}</span>
            <span className="text-[10px] text-danger-600 block mt-0.5">Quarantined</span>
          </div>

          <div className="p-4 rounded-xl bg-white border border-brand-500/30 col-span-2 lg:col-span-1">
            <span className="text-[11px] text-brand-600 block mb-1">First-Pass Yield</span>
            <span className="text-2xl font-black text-brand-600">{yieldPercentage}%</span>
            <span className="text-[10px] text-brand-600 block mt-0.5">Standard &ge; 98.0%</span>
          </div>
        </div>

        {/* 2 PANELS: STYLE-WISE YIELD & DEFECT CATEGORIZATION */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* STYLE-WISE THROUGHPUT */}
          <div className="p-5 rounded-2xl bg-white border border-neutral-200 space-y-3">
            <h3 className="text-xs font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-600" />
              <span>Style-Wise Yield & Output</span>
            </h3>

            {styleWiseMetrics.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-500">No production data recorded yet.</div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-neutral-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-canvas text-neutral-500">
                    <tr>
                      <th className="p-2.5 font-semibold">Style Code</th>
                      <th className="p-2.5 font-semibold text-right">Input</th>
                      <th className="p-2.5 font-semibold text-right">Good</th>
                      <th className="p-2.5 font-semibold text-right">Re-stitch</th>
                      <th className="p-2.5 font-semibold text-right">Scrap</th>
                      <th className="p-2.5 font-semibold text-right">Yield</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 text-neutral-900">
                    {styleWiseMetrics.map((sm: any) => {
                      const yld = sm.totalInput > 0 ? ((sm.totalGood / sm.totalInput) * 100).toFixed(1) : '100.0';
                      return (
                        <tr key={sm.styleCode}>
                          <td className="p-2.5 font-bold text-neutral-900">{sm.styleCode}</td>
                          <td className="p-2.5 text-right font-mono text-neutral-700">{sm.totalInput}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-accent-700">{sm.totalGood}</td>
                          <td className="p-2.5 text-right font-mono text-accent-700">{sm.totalRework}</td>
                          <td className="p-2.5 text-right font-mono text-danger-600">{sm.totalReject}</td>
                          <td className="p-2.5 text-right font-bold text-brand-600">{yld}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* DEFECT BREAKDOWN */}
          <div className="p-5 rounded-2xl bg-white border border-neutral-200 space-y-3">
            <h3 className="text-xs font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-danger-600" />
              <span>Scrap & Defect Root Cause Distribution</span>
            </h3>

            {Object.keys(defectDistribution).length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-500">
                Zero scrap recorded. 100% clean production flow!
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(defectDistribution).map(([reason, count]) => (
                  <div
                    key={reason}
                    className="p-3 rounded-xl bg-white border border-neutral-200 flex items-center justify-between text-xs"
                  >
                    <span className="font-semibold text-neutral-700">{reason}</span>
                    <span className="px-2.5 py-0.5 rounded-full font-mono font-bold bg-danger-500/20 text-danger-600 border border-danger-500/30">
                      {count as number} pcs
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* PRODUCTION TRANSACTIONS AUDIT TRAIL */}
        <div className="p-5 rounded-2xl bg-white border border-neutral-200 space-y-3">
          <h3 className="text-xs font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand-600" />
            <span>Stitching Line Transactions Audit Log</span>
          </h3>

          {transactions.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-500">No transaction logs recorded yet.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-neutral-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-canvas text-neutral-500">
                  <tr>
                    <th className="p-3 font-semibold">Challan No</th>
                    <th className="p-3 font-semibold">Style / Program</th>
                    <th className="p-3 font-semibold">Operator</th>
                    <th className="p-3 font-semibold text-right">Input</th>
                    <th className="p-3 font-semibold text-right">Good</th>
                    <th className="p-3 font-semibold text-right">Rework</th>
                    <th className="p-3 font-semibold text-right">Reject</th>
                    <th className="p-3 font-semibold text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 text-neutral-700">
                  {transactions.slice(0, 15).map((tx: any) => (
                    <tr key={tx.id} className="hover:bg-neutral-100 transition">
                      <td className="p-3 font-mono font-bold text-brand-600">{tx.challan?.challanNumber || '-'}</td>
                      <td className="p-3">
                        <span className="font-semibold text-neutral-900">{tx.program?.styleCode || 'Standard'}</span>
                        <span className="text-[10px] text-neutral-500 block">{tx.program?.programNumber}</span>
                      </td>
                      <td className="p-3 text-neutral-700">{tx.operator?.fullName || 'Operator'}</td>
                      <td className="p-3 text-right font-mono text-neutral-500">{tx.inputQuantity}</td>
                      <td className="p-3 text-right font-mono font-bold text-accent-700">{tx.goodQuantity}</td>
                      <td className="p-3 text-right font-mono text-accent-700">{tx.reworkQuantity}</td>
                      <td className="p-3 text-right font-mono text-danger-600">{tx.rejectQuantity}</td>
                      <td className="p-3 text-right text-neutral-500">
                        {new Date(tx.recordedAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
