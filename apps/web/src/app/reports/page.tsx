'use client';

import React, { useState } from 'react';

export default function ReportsPage() {
  const [reportType, setReportType] = useState('production-accounting');

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full pt-20">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">
            BUSINESS INTELLIGENCE & AUDIT
          </span>
          <h1 className="text-2xl font-bold text-slate-900">Executive Factory Reports</h1>
          <p className="text-xs text-slate-500 mt-1">
            Reconciliation ledger, quality Pareto distribution, and stage throughput analytics
          </p>
        </div>

        <button
          onClick={() => alert('Exporting report as CSV...')}
          className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-md shadow-sm transition flex items-center gap-1.5"
        >
          <span>📥</span> Export CSV / Excel
        </button>
      </div>

      {/* Report Selector Pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { id: 'production-accounting', label: 'Production Accounting' },
          { id: 'quality-pareto', label: 'Defects & Rework Pareto' },
          { id: 'material-variance', label: 'Fabric Yield Variance' },
          { id: 'traceability', label: 'Barcode Genealogy' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setReportType(tab.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
              reportType === tab.id
                ? 'bg-[#1E3A8A] text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* KPI Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
          <span className="text-xs text-slate-500">First-Time Right (FTR)</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">98.4%</p>
          <span className="text-[10px] text-emerald-600">+0.8% vs last week</span>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
          <span className="text-xs text-slate-500">Total Production This Month</span>
          <p className="text-2xl font-bold text-blue-900 mt-1">14,820</p>
          <span className="text-[10px] text-slate-500">Pieces inspected & packed</span>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
          <span className="text-xs text-slate-500">Scrap / Waste Rate</span>
          <p className="text-2xl font-bold text-amber-600 mt-1">1.2%</p>
          <span className="text-[10px] text-emerald-600">Within 2.0% tolerance</span>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
          <span className="text-xs text-slate-500">Active Challans Audited</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">100%</p>
          <span className="text-[10px] text-blue-600">Full custody balance match</span>
        </div>
      </div>

      {/* Report Data Table */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">
            {reportType === 'production-accounting' && 'Production Equation Balance Ledger'}
            {reportType === 'quality-pareto' && 'Defect Pareto Analysis by Operation'}
            {reportType === 'material-variance' && 'BOM vs Actual Consumption Ledger'}
            {reportType === 'traceability' && 'Roll to Carton Traceability Audit'}
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] text-slate-500 border-b border-slate-100 font-medium">
              <tr>
                <th className="py-3 px-4">Program / Lot</th>
                <th className="py-3 px-4">Operation</th>
                <th className="py-3 px-4">Input</th>
                <th className="py-3 px-4">Good</th>
                <th className="py-3 px-4">Rework</th>
                <th className="py-3 px-4">Reject</th>
                <th className="py-3 px-4">Waste</th>
                <th className="py-3 px-4 text-right">Yield %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50">
                <td className="py-3 px-4 font-mono font-medium text-slate-900">PRG-2026-0001</td>
                <td className="py-3 px-4 text-slate-700">Spreading & Auto Cutting</td>
                <td className="py-3 px-4 font-mono font-semibold">650 KG</td>
                <td className="py-3 px-4 font-mono text-emerald-700 font-semibold">620 KG</td>
                <td className="py-3 px-4 font-mono text-amber-700">0 KG</td>
                <td className="py-3 px-4 font-mono text-rose-700">10 KG</td>
                <td className="py-3 px-4 font-mono text-slate-500">20 KG</td>
                <td className="py-3 px-4 font-mono font-bold text-right text-emerald-700">95.4%</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="py-3 px-4 font-mono font-medium text-slate-900">PRG-2026-0002</td>
                <td className="py-3 px-4 text-slate-700">Sewing & Assembly</td>
                <td className="py-3 px-4 font-mono font-semibold">450 PC</td>
                <td className="py-3 px-4 font-mono text-emerald-700 font-semibold">442 PC</td>
                <td className="py-3 px-4 font-mono text-amber-700">5 PC</td>
                <td className="py-3 px-4 font-mono text-rose-700">3 PC</td>
                <td className="py-3 px-4 font-mono text-slate-500">0 PC</td>
                <td className="py-3 px-4 font-mono font-bold text-right text-emerald-700">98.2%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
