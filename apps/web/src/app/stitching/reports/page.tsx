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
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';

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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white">Stitching Yield & Scrap Analytics</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Line Balancing Performance, First-Pass Assembly Yield, and Quarantined Scrap Audit Trail
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadReports(true)}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700 disabled:opacity-50"
              title="Refresh Analytics"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <Link
              href="/stitching/my-work"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-md"
            >
              Back to Floor Workstation
            </Link>
          </div>
        </div>
      </div>

      {/* CONTENT BODY */}
      <div className="max-w-7xl mx-auto w-full p-4 md:p-6 space-y-6 flex-1">
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 4 SUMMARY METRIC CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-[11px] text-slate-400 block mb-1">Total Cut Inputs</span>
            <span className="text-2xl font-black text-white">{totalInput.toLocaleString()}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Panels / Garment Units</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-emerald-500/30">
            <span className="text-[11px] text-emerald-400 block mb-1">Good Garments Assembled</span>
            <span className="text-2xl font-black text-emerald-400">{totalGood.toLocaleString()}</span>
            <span className="text-[10px] text-emerald-400/70 block mt-0.5">Passed QA</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-amber-500/30">
            <span className="text-[11px] text-amber-400 block mb-1">Re-stitch / Rework</span>
            <span className="text-2xl font-black text-amber-400">{totalRework.toLocaleString()}</span>
            <span className="text-[10px] text-amber-400/70 block mt-0.5">Correctable</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-rose-500/30">
            <span className="text-[11px] text-rose-400 block mb-1">Scrap / Rejects</span>
            <span className="text-2xl font-black text-rose-400">{totalReject.toLocaleString()}</span>
            <span className="text-[10px] text-rose-400/70 block mt-0.5">Quarantined</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-purple-500/30 col-span-2 lg:col-span-1">
            <span className="text-[11px] text-purple-400 block mb-1">First-Pass Yield</span>
            <span className="text-2xl font-black text-purple-300">{yieldPercentage}%</span>
            <span className="text-[10px] text-purple-400/70 block mt-0.5">Standard &ge; 98.0%</span>
          </div>
        </div>

        {/* 2 PANELS: STYLE-WISE YIELD & DEFECT CATEGORIZATION */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* STYLE-WISE THROUGHPUT */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>Style-Wise Yield & Output</span>
            </h3>

            {styleWiseMetrics.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">No production data recorded yet.</div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400">
                    <tr>
                      <th className="p-2.5 font-semibold">Style Code</th>
                      <th className="p-2.5 font-semibold text-right">Input</th>
                      <th className="p-2.5 font-semibold text-right">Good</th>
                      <th className="p-2.5 font-semibold text-right">Re-stitch</th>
                      <th className="p-2.5 font-semibold text-right">Scrap</th>
                      <th className="p-2.5 font-semibold text-right">Yield</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {styleWiseMetrics.map((sm: any) => {
                      const yld = sm.totalInput > 0 ? ((sm.totalGood / sm.totalInput) * 100).toFixed(1) : '100.0';
                      return (
                        <tr key={sm.styleCode}>
                          <td className="p-2.5 font-bold text-white">{sm.styleCode}</td>
                          <td className="p-2.5 text-right font-mono text-slate-300">{sm.totalInput}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-emerald-400">{sm.totalGood}</td>
                          <td className="p-2.5 text-right font-mono text-amber-400">{sm.totalRework}</td>
                          <td className="p-2.5 text-right font-mono text-rose-400">{sm.totalReject}</td>
                          <td className="p-2.5 text-right font-bold text-purple-300">{yld}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* DEFECT BREAKDOWN */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>Scrap & Defect Root Cause Distribution</span>
            </h3>

            {Object.keys(defectDistribution).length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Zero scrap recorded. 100% clean production flow!
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(defectDistribution).map(([reason, count]) => (
                  <div
                    key={reason}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <span className="font-semibold text-slate-300">{reason}</span>
                    <span className="px-2.5 py-0.5 rounded-full font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      {count as number} pcs
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* PRODUCTION TRANSACTIONS AUDIT TRAIL */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            <span>Stitching Line Transactions Audit Log</span>
          </h3>

          {transactions.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">No transaction logs recorded yet.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400">
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
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {transactions.slice(0, 15).map((tx: any) => (
                    <tr key={tx.id} className="hover:bg-slate-800/20 transition">
                      <td className="p-3 font-mono font-bold text-indigo-300">{tx.challan?.challanNumber || '-'}</td>
                      <td className="p-3">
                        <span className="font-semibold text-white">{tx.program?.styleCode || 'Standard'}</span>
                        <span className="text-[10px] text-slate-500 block">{tx.program?.programNumber}</span>
                      </td>
                      <td className="p-3 text-slate-300">{tx.operator?.fullName || 'Operator'}</td>
                      <td className="p-3 text-right font-mono text-slate-400">{tx.inputQuantity}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-400">{tx.goodQuantity}</td>
                      <td className="p-3 text-right font-mono text-amber-400">{tx.reworkQuantity}</td>
                      <td className="p-3 text-right font-mono text-rose-400">{tx.rejectQuantity}</td>
                      <td className="p-3 text-right text-slate-400">
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
