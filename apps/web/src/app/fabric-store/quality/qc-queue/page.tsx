'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ClipboardCheck, RefreshCw, ArrowRight, Clock, AlertTriangle } from 'lucide-react';

export default function QualityQCQueuePage() {
  const [loading, setLoading] = useState(true);
  const [rolls, setRolls] = useState<any[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/fabric-store/qc');
      const json = await res.json();
      setRolls(json.data || []);
    } catch (err: any) {
      console.error('Failed to load QC queue:', err);
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
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700 block">
            FABRIC STORE · QUALITY ASSURANCE
          </span>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-amber-600" />
            Quality Assurance Inspection Queue (FIFO)
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
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-4 text-xs text-amber-900">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold block">First-In First-Out (FIFO) Sorting Active</span>
              <span className="text-amber-700 text-[11px]">
                Rolls received earliest are prioritized to avoid holding up production schedules.
              </span>
            </div>
          </div>
          <span className="font-mono font-bold bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-300">
            {rolls.length} Rolls Awaiting Audit
          </span>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading audit queue...</div>
          ) : rolls.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <ClipboardCheck className="w-10 h-10 text-emerald-500 mx-auto" />
              <p className="text-sm font-semibold text-slate-800">Queue is completely clear!</p>
              <p className="text-xs text-slate-500">All received fabric has been audited.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Priority / Queue Pos</th>
                    <th className="py-3 px-4">Roll Number</th>
                    <th className="py-3 px-4">Batch #</th>
                    <th className="py-3 px-4">Fabric Description</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Length</th>
                    <th className="py-3 px-4">Date Received</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {rolls.map((roll, idx) => (
                    <tr key={roll.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-amber-800">
                        #{idx + 1}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {roll.rollNumber}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {roll.batch?.batchNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold block text-slate-900">{roll.batch?.fabricType}</span>
                        <span className="text-[10px] text-slate-500">{roll.batch?.fabricDescription}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">
                        {roll.batch?.supplierId || roll.receiptItems?.[0]?.receipt?.supplierName || '—'}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {parseFloat(roll.length).toFixed(2)} m
                      </td>
                      <td className="py-3.5 px-4 text-[11px] text-slate-500">
                        {new Date(roll.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/fabric-store/my-work/qc-inspections/${roll.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-[11px] shadow-2xs transition"
                        >
                          <span>Conduct Audit</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
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
