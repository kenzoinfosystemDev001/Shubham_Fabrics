'use client';

import React, { useState, useEffect } from 'react';
import { XCircle, RefreshCw, AlertCircle, Ban } from 'lucide-react';

export default function QualityRejectionsPage() {
  const [loading, setLoading] = useState(true);
  const [rolls, setRolls] = useState<any[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/fabric-store/rolls?status=QC_REJECTED');
      const json = await res.json();
      setRolls(json.data || []);
    } catch (err: any) {
      console.error('Failed to load rejected rolls:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="min-h-screen bg-[#F0FAF9] pb-16">
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-8 py-4 flex items-center justify-between shadow-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-700 block">
            FABRIC STORE · DEFECT QUARANTINE
          </span>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <XCircle className="w-5 h-5 text-rose-600" />
            Rejected Fabric Rolls (Scrap / Write-Off)
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <main className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center justify-between gap-4 text-xs text-rose-900">
          <div className="flex items-center gap-3">
            <Ban className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <span className="font-bold block">Production Issue Barred</span>
              <span className="text-rose-700 text-[11px]">
                Business Rule Enforced: Rejected fabric rolls can never be issued to production. They are retained for vendor debit or scrap write-off.
              </span>
            </div>
          </div>
          <span className="font-mono font-bold bg-rose-100 px-3 py-1.5 rounded-lg border border-rose-300">
            {rolls.length} Rejected Rolls
          </span>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading rejected rolls...</div>
          ) : rolls.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <XCircle className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-800">No rejected fabric rolls</p>
              <p className="text-xs text-slate-500">Zero scrap recorded in this period.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Roll Number</th>
                    <th className="py-3 px-4">Batch Number</th>
                    <th className="py-3 px-4">Fabric Description</th>
                    <th className="py-3 px-4">Length</th>
                    <th className="py-3 px-4">Audited Date</th>
                    <th className="py-3 px-4">Auditor</th>
                    <th className="py-3 px-4">Rejection Reason / Defect Log</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {rolls.map((roll) => (
                    <tr key={roll.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-rose-900">
                        {roll.rollNumber}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {roll.batch?.batchNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold block text-slate-900">{roll.batch?.fabricType}</span>
                        <span className="text-[10px] text-slate-500">{roll.batch?.fabricDescription}</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {parseFloat(roll.length).toFixed(2)} m
                      </td>
                      <td className="py-3.5 px-4 text-[11px] text-slate-500">
                        {roll.qcInspectedAt ? new Date(roll.qcInspectedAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-800 font-medium">
                        {roll.qcInspectedBy?.fullName || 'QC Auditor'}
                      </td>
                      <td className="py-3.5 px-4 text-rose-800 font-medium">
                        {roll.qcRemarks || 'Failed quality inspection'}
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
