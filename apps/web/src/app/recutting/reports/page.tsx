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
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';

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
    <div className="min-h-screen bg-[#FDFBF7] pb-16">
      {/* HEADER */}
      <header
        style={{
          backgroundImage: `linear-gradient(to right, rgba(15, 23, 42, 0.88), rgba(15, 23, 42, 0.72)), url('${DEPARTMENT_NAV_BG_IMAGE}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        className="border-b border-slate-700/80 sticky top-0 z-30 px-4 sm:px-8 py-4 shadow-md text-white"
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                AUDIT & ANALYTICS
              </span>
              <span className="text-xs text-slate-300 font-medium">
                Production Performance & Scrap Accounting
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mt-1 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-purple-400" />
              <span>Recutting Production & Scrap Reports</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadReports(true)}
              disabled={loading}
              className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <Link
              href="/recutting/my-work"
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1.5"
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
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Filter className="w-4 h-4 text-purple-600" />
            <span>Filter Report by Date Range:</span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* METRICS SUMMARY */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              Total Input Processed
            </span>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {summary.totalInput.toLocaleString()} <span className="text-xs font-semibold text-slate-400">PCS</span>
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              {summary.totalTransactions} cutting operations logged
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">
              Good Cut Panels
            </span>
            <div className="text-2xl font-black text-emerald-700 mt-1">
              {summary.totalGood.toLocaleString()} <span className="text-xs font-semibold text-emerald-500">PCS</span>
            </div>
            <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">
              {summary.overallAccuracy}% Overall Accuracy
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-xs">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wide">
              Retrim / Secondary Rework
            </span>
            <div className="text-2xl font-black text-amber-700 mt-1">
              {summary.totalRework.toLocaleString()} <span className="text-xs font-semibold text-amber-500">PCS</span>
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Edge trimming & thread shearing
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-xs">
            <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wide">
              Reject / Cut Scrap
            </span>
            <div className="text-2xl font-black text-rose-700 mt-1">
              {summary.totalReject.toLocaleString()} <span className="text-xs font-semibold text-rose-500">PCS</span>
            </div>
            <span className="text-[11px] text-rose-600 font-semibold mt-1 block">
              {summary.rejectRate}% Scrap Rate
            </span>
          </div>
        </div>

        {/* DESIGN-WISE PERFORMANCE */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Wilcom Design-Wise Cutting Breakdown
              </h2>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
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
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {designPerformance.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No design cutting records logged in this period.
                    </td>
                  </tr>
                ) : (
                  designPerformance.map((d: any, idx: number) => {
                    const yieldRate = d.totalInput > 0 ? ((d.totalGood / d.totalInput) * 100).toFixed(1) : '100.0';
                    return (
                      <tr key={idx} className="hover:bg-slate-50/60 transition">
                        <td className="px-4 py-3 font-semibold text-slate-900">{d.designNumber}</td>
                        <td className="px-4 py-3 font-mono font-bold text-rose-700">{d.wilcomDesignNumber}</td>
                        <td className="px-4 py-3">{d.clientName}</td>
                        <td className="px-4 py-3 text-right font-medium">{d.totalInput}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-700">{d.totalGood}</td>
                        <td className="px-4 py-3 text-right font-bold text-rose-700">{d.totalScrap}</td>
                        <td className="px-4 py-3 text-right font-black text-slate-900">{yieldRate}%</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* OPERATOR EFFICIENCY */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-rose-600" />
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Operator Throughput & Accuracy
              </h2>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
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
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {operatorPerformance.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No operator data found.
                    </td>
                  </tr>
                ) : (
                  operatorPerformance.map((op: any, idx: number) => {
                    const acc = op.totalInput > 0 ? ((op.totalGood / op.totalInput) * 100).toFixed(1) : '100.0';
                    return (
                      <tr key={idx} className="hover:bg-slate-50/60 transition">
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {op.name} <span className="text-slate-400 text-[11px]">({op.username})</span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{op.jobsCompleted}</td>
                        <td className="px-4 py-3 text-right font-medium">{op.totalInput}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-700">{op.totalGood}</td>
                        <td className="px-4 py-3 text-right text-amber-700">{op.totalRework}</td>
                        <td className="px-4 py-3 text-right text-rose-700 font-bold">{op.totalReject}</td>
                        <td className="px-4 py-3 text-right font-black text-slate-900">{acc}%</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RECENT PRODUCTION TRANSACTIONS AUDIT */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Production Transactions Audit Trail
              </h2>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
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
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {recentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      No transaction records logged.
                    </td>
                  </tr>
                ) : (
                  recentTransactions.map((tx: any) => (
                    <tr key={tx.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-4 py-3 text-slate-500">
                        {new Date(tx.recordedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {tx.challan?.challanNumber || 'Direct'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{tx.program?.programNumber || 'N/A'}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          Wilcom: {tx.program?.wilcomDesignNumber || tx.program?.designNumber || 'N/A'}
                        </div>
                      </td>
                      <td className="px-4 py-3">{tx.operator?.fullName || tx.operator?.username || 'System'}</td>
                      <td className="px-4 py-3 text-right font-medium">{tx.inputQuantity}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700">{tx.goodQuantity}</td>
                      <td className="px-4 py-3 text-right text-amber-700">{tx.reworkQuantity}</td>
                      <td className="px-4 py-3 text-right text-rose-700 font-bold">{tx.rejectQuantity}</td>
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
