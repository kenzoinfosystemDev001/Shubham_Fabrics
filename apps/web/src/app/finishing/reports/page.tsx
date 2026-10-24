'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  User,
  Clock,
  Layers,
  ArrowRight,
} from 'lucide-react';

export default function FinishingReportsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  const loadReports = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError('');
      const res = await fetch('/api/finishing/reports');
      if (!res.ok) throw new Error('Failed to load Finishing reports data');
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
              <h1 className="text-xl font-black text-neutral-900">Finishing Yield & Defect Analytics</h1>
              <p className="text-xs text-neutral-500 mt-0.5">
                First-Pass Yield, Trimming Cleanliness, Spot Removal & Quarantined Scrap Traceability
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
              href="/finishing/my-work"
              className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs transition shadow-sm"
            >
              Back to Floor Workspace
            </Link>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto w-full p-4 md:p-6 space-y-6 flex-1">
        {error && (
          <div className="p-3 bg-danger-500/10 border border-danger-500/30 rounded-xl flex items-center gap-3 text-danger-600 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* TOP SUMMARY CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-4 rounded-2xl bg-white border border-neutral-200">
            <span className="text-[11px] font-semibold text-neutral-500 block uppercase">Total Garments Input</span>
            <div className="text-2xl font-black text-neutral-900 mt-1 font-mono">{totalInput} pcs</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-accent-500/30">
            <span className="text-[11px] font-semibold text-accent-700 block uppercase">Good Finished Garments</span>
            <div className="text-2xl font-black text-neutral-900 mt-1 font-mono">{totalGood} pcs</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-accent-500/30">
            <span className="text-[11px] font-semibold text-accent-700 block uppercase">Re-trim / Rework</span>
            <div className="text-2xl font-black text-neutral-900 mt-1 font-mono">{totalRework} pcs</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-danger-500/30">
            <span className="text-[11px] font-semibold text-danger-600 block uppercase">Scrapped / Reject</span>
            <div className="text-2xl font-black text-danger-600 mt-1 font-mono">{totalReject} pcs</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-brand-500/30 col-span-2 md:col-span-1">
            <span className="text-[11px] font-semibold text-brand-600 block uppercase">Finishing Yield %</span>
            <div className="text-2xl font-black text-brand-600 mt-1 font-mono">{yieldPercentage}%</div>
          </div>
        </div>

        {/* TWO-COLUMN REPORTS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* STYLE-WISE METRICS */}
          <section className="p-5 rounded-2xl bg-white border border-neutral-200 space-y-4">
            <h3 className="text-sm font-bold text-neutral-900 tracking-wide uppercase flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-600" />
              <span>Style-Wise Finishing Throughput</span>
            </h3>

            {styleWiseMetrics.length === 0 ? (
              <div className="p-8 text-center text-neutral-500 text-xs">No style metrics recorded.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 text-neutral-500 font-semibold">
                      <th className="py-2.5 px-3">Style Code</th>
                      <th className="py-2.5 px-3 text-right">Input</th>
                      <th className="py-2.5 px-3 text-right">Good</th>
                      <th className="py-2.5 px-3 text-right">Rework</th>
                      <th className="py-2.5 px-3 text-right">Reject</th>
                      <th className="py-2.5 px-3 text-right">Yield</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 text-neutral-700">
                    {styleWiseMetrics.map((row: any) => {
                      const yld = row.totalInput > 0 ? ((row.totalGood / row.totalInput) * 100).toFixed(1) : '100.0';
                      return (
                        <tr key={row.styleCode}>
                          <td className="py-2 px-3 font-semibold text-neutral-900">{row.styleCode}</td>
                          <td className="py-2 px-3 text-right font-mono">{row.totalInput}</td>
                          <td className="py-2 px-3 text-right font-mono text-accent-700 font-bold">{row.totalGood}</td>
                          <td className="py-2 px-3 text-right font-mono text-accent-700">{row.totalRework}</td>
                          <td className="py-2 px-3 text-right font-mono text-danger-600">{row.totalReject}</td>
                          <td className="py-2 px-3 text-right font-mono text-brand-600 font-bold">{yld}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* DEFECT CATEGORIZATION */}
          <section className="p-5 rounded-2xl bg-white border border-neutral-200 space-y-4">
            <h3 className="text-sm font-bold text-neutral-900 tracking-wide uppercase flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-accent-700" />
              <span>Defect & Scrap Categorization</span>
            </h3>

            {Object.keys(defectDistribution).length === 0 ? (
              <div className="p-8 text-center text-neutral-500 text-xs">No defects logged in this period. Zero scrap recorded.</div>
            ) : (
              <div className="space-y-3">
                {Object.entries(defectDistribution).map(([reason, count]) => {
                  const pct = totalReject > 0 ? ((Number(count) / totalReject) * 100).toFixed(1) : '0.0';
                  return (
                    <div key={reason} className="p-3 rounded-xl bg-white border border-neutral-200 space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-neutral-900">{reason}</span>
                        <span className="font-mono font-bold text-danger-600">{count as number} pcs ({pct}%)</span>
                      </div>
                      <div className="w-full bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-danger-500 h-1.5 rounded-full"
                          style={{ width: `${Math.min(100, Number(pct))}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* DEFECT AUDIT LOG TABLE */}
        <section className="p-5 rounded-2xl bg-white border border-neutral-200 space-y-4">
          <h3 className="text-sm font-bold text-neutral-900 tracking-wide uppercase flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-danger-600" />
            <span>Quarantined Scrap & Defect Records Audit Trail</span>
          </h3>

          {defects.length === 0 ? (
            <div className="p-8 text-center text-neutral-500 text-xs">No quarantined scrap records. High quality run.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-500 font-semibold">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Challan Ref</th>
                    <th className="py-2.5 px-3">Style / Program</th>
                    <th className="py-2.5 px-3">Reason</th>
                    <th className="py-2.5 px-3">Severity</th>
                    <th className="py-2.5 px-3 text-right">Quantity</th>
                    <th className="py-2.5 px-3">Inspector</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 text-neutral-700">
                  {defects.map((def: any) => (
                    <tr key={def.id}>
                      <td className="py-2 px-3 font-mono text-neutral-500">
                        {new Date(def.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2 px-3 font-mono text-neutral-900">{def.challan?.challanNumber || '-'}</td>
                      <td className="py-2 px-3 text-brand-600 font-medium">
                        {def.program?.styleCode || 'Standard'} ({def.program?.programNumber || 'N/A'})
                      </td>
                      <td className="py-2 px-3 font-medium text-neutral-900">{def.reason || def.defectType}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            def.severity === 'CRITICAL'
                              ? 'bg-danger-500/20 text-danger-600 border border-danger-500/30'
                              : 'bg-accent-400/20 text-accent-700 border border-accent-500/30'
                          }`}
                        >
                          {def.severity}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-danger-600">
                        {def.quantity} PCS
                      </td>
                      <td className="py-2 px-3 text-neutral-500">{def.detectedBy?.fullName || 'Inspector'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
