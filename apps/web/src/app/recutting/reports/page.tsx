'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  RefreshCw,
  Calendar,
  Filter,
  Scissors,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  FileText,
  User,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react';

export default function RecuttingReportsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadReports = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError('');

      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await fetch(`/api/recutting/reports?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load Recutting reports');
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
  }, [startDate, endDate]);

  const summary = data?.summary || {
    totalInput: 0,
    totalGood: 0,
    totalRework: 0,
    totalReject: 0,
    overallAccuracy: 100,
    rejectRate: 0,
    totalTransactions: 0,
  };

  const operatorPerformance = data?.operatorPerformance || [];
  const designPerformance = data?.designPerformance || [];
  const recentTransactions = data?.recentTransactions || [];
  const defectRecords = data?.defectRecords || [];

  return (
    <div className="min-h-screen bg-neutral-50 pb-16">
      {/* HEADER */}
      <header
        className="bg-white border-b border-neutral-200 sticky top-0 z-30 px-4 sm:px-8 py-4 shadow-md text-neutral-900"
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-brand-500/20 text-brand-600 border border-brand-500/30">
                AUDIT & ANALYTICS
              </span>
              <span className="text-xs text-neutral-700 font-medium">
                Production Performance & Scrap Accounting
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-neutral-900 tracking-tight mt-1 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-brand-600" />
              <span>Recutting Production & Scrap Reports</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadReports(true)}
              disabled={loading}
              className="px-3 py-1.5 bg-neutral-50 hover:bg-neutral-200 text-neutral-900 border border-neutral-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <Link
              href="/recutting/my-work"
              className="px-3 py-1.5 bg-danger-600 hover:bg-danger-700 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1.5"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>Cutting Queue</span>
            </Link>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        {/* DATE FILTER CONTROLS */}
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-neutral-700">
            <Filter className="w-4 h-4 text-brand-600" />
            <span>Filter Report by Date Range:</span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <span className="text-xs text-neutral-500">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-semibold"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* METRICS SUMMARY */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
            <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wide">
              Total Input Processed
            </span>
            <div className="text-2xl font-black text-neutral-900 mt-1">
              {summary.totalInput.toLocaleString()} <span className="text-xs font-semibold text-neutral-500">PCS</span>
            </div>
            <span className="text-[11px] text-neutral-500 mt-1 block">
              {summary.totalTransactions} cutting operations logged
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-accent-200 shadow-xs">
            <span className="text-[11px] font-bold text-neutral-700 uppercase tracking-wide">
              Good Cut Panels
            </span>
            <div className="text-2xl font-black text-neutral-900 mt-1">
              {summary.totalGood.toLocaleString()} <span className="text-xs font-semibold text-accent-700">PCS</span>
            </div>
            <span className="text-[11px] text-accent-700 font-semibold mt-1 block">
              {summary.overallAccuracy}% Overall Accuracy
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-accent-200 shadow-xs">
            <span className="text-[11px] font-bold text-neutral-700 uppercase tracking-wide">
              Retrim / Secondary Rework
            </span>
            <div className="text-2xl font-black text-neutral-900 mt-1">
              {summary.totalRework.toLocaleString()} <span className="text-xs font-semibold text-accent-700">PCS</span>
            </div>
            <span className="text-[11px] text-neutral-500 mt-1 block">
              Edge trimming & thread shearing
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-danger-200 shadow-xs">
            <span className="text-[11px] font-bold text-danger-700 uppercase tracking-wide">
              Reject / Cut Scrap
            </span>
            <div className="text-2xl font-black text-danger-700 mt-1">
              {summary.totalReject.toLocaleString()} <span className="text-xs font-semibold text-danger-600">PCS</span>
            </div>
            <span className="text-[11px] text-danger-600 font-semibold mt-1 block">
              {summary.rejectRate}% Scrap Rate
            </span>
          </div>
        </div>

        {/* DESIGN-WISE PERFORMANCE */}
        <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-600" />
              <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-wide">
                Wilcom Design-Wise Cutting Breakdown
              </h2>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 text-neutral-600 font-bold uppercase tracking-wider border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3">Design Number</th>
                  <th className="px-4 py-3">Wilcom File #</th>
                  <th className="px-4 py-3">Buyer / Client</th>
                  <th className="px-4 py-3 text-right">Input (PCS)</th>
                  <th className="px-4 py-3 text-right">Good Cut (PCS)</th>
                  <th className="px-4 py-3 text-right">Scrap (PCS)</th>
                  <th className="px-4 py-3 text-right">Yield %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-700">
                {designPerformance.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">
                      No design cutting records logged in this period.
                    </td>
                  </tr>
                ) : (
                  designPerformance.map((d: any, idx: number) => {
                    const yieldRate = d.totalInput > 0 ? ((d.totalGood / d.totalInput) * 100).toFixed(1) : '100.0';
                    return (
                      <tr key={idx} className="hover:bg-neutral-50/60 transition">
                        <td className="px-4 py-3 font-semibold text-neutral-900">{d.designNumber}</td>
                        <td className="px-4 py-3 font-mono font-bold text-danger-700">{d.wilcomDesignNumber}</td>
                        <td className="px-4 py-3">{d.clientName}</td>
                        <td className="px-4 py-3 text-right font-medium">{d.totalInput}</td>
                        <td className="px-4 py-3 text-right font-bold text-accent-800">{d.totalGood}</td>
                        <td className="px-4 py-3 text-right font-bold text-danger-700">{d.totalScrap}</td>
                        <td className="px-4 py-3 text-right font-black text-neutral-900">{yieldRate}%</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* OPERATOR EFFICIENCY */}
        <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-danger-600" />
              <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-wide">
                Operator Throughput & Accuracy
              </h2>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 text-neutral-600 font-bold uppercase tracking-wider border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3">Operator Name</th>
                  <th className="px-4 py-3 text-right">Jobs Completed</th>
                  <th className="px-4 py-3 text-right">Total Input (PCS)</th>
                  <th className="px-4 py-3 text-right">Good Cut (PCS)</th>
                  <th className="px-4 py-3 text-right">Rework (PCS)</th>
                  <th className="px-4 py-3 text-right">Scrap (PCS)</th>
                  <th className="px-4 py-3 text-right">Accuracy Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-700">
                {operatorPerformance.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">
                      No operator data found.
                    </td>
                  </tr>
                ) : (
                  operatorPerformance.map((op: any, idx: number) => {
                    const acc = op.totalInput > 0 ? ((op.totalGood / op.totalInput) * 100).toFixed(1) : '100.0';
                    return (
                      <tr key={idx} className="hover:bg-neutral-50/60 transition">
                        <td className="px-4 py-3 font-semibold text-neutral-900">
                          {op.name} <span className="text-neutral-500 text-[11px]">({op.username})</span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{op.jobsCompleted}</td>
                        <td className="px-4 py-3 text-right font-medium">{op.totalInput}</td>
                        <td className="px-4 py-3 text-right font-bold text-accent-800">{op.totalGood}</td>
                        <td className="px-4 py-3 text-right text-accent-800">{op.totalRework}</td>
                        <td className="px-4 py-3 text-right text-danger-700 font-bold">{op.totalReject}</td>
                        <td className="px-4 py-3 text-right font-black text-neutral-900">{acc}%</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RECENT PRODUCTION TRANSACTIONS AUDIT */}
        <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-600" />
              <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-wide">
                Production Transactions Audit Trail
              </h2>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 text-neutral-600 font-bold uppercase tracking-wider border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Challan #</th>
                  <th className="px-4 py-3">Program / Design</th>
                  <th className="px-4 py-3">Operator</th>
                  <th className="px-4 py-3 text-right">Input</th>
                  <th className="px-4 py-3 text-right">Good</th>
                  <th className="px-4 py-3 text-right">Rework</th>
                  <th className="px-4 py-3 text-right">Reject</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-700">
                {recentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-neutral-500">
                      No transaction records logged.
                    </td>
                  </tr>
                ) : (
                  recentTransactions.map((tx: any) => (
                    <tr key={tx.id} className="hover:bg-neutral-50/60 transition">
                      <td className="px-4 py-3 text-neutral-500">
                        {new Date(tx.recordedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-neutral-900">
                        {tx.challan?.challanNumber || 'Direct'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-neutral-900">{tx.program?.programNumber || 'N/A'}</div>
                        <div className="text-[11px] text-neutral-500 font-mono">
                          Wilcom: {tx.program?.wilcomDesignNumber || tx.program?.designNumber || 'N/A'}
                        </div>
                      </td>
                      <td className="px-4 py-3">{tx.operator?.fullName || tx.operator?.username || 'System'}</td>
                      <td className="px-4 py-3 text-right font-medium">{tx.inputQuantity}</td>
                      <td className="px-4 py-3 text-right font-bold text-accent-800">{tx.goodQuantity}</td>
                      <td className="px-4 py-3 text-right text-accent-800">{tx.reworkQuantity}</td>
                      <td className="px-4 py-3 text-right text-danger-700 font-bold">{tx.rejectQuantity}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
