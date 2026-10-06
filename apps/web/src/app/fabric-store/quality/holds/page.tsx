'use client';

import React, { useState, useEffect } from 'react';
import { PauseCircle, RefreshCw, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

export default function QualityHoldsPage() {
  const [loading, setLoading] = useState(true);
  const [rolls, setRolls] = useState<any[]>([]);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/fabric-store/rolls?status=QC_HOLD');
      const json = await res.json();
      setRolls(json.data || []);
    } catch (err: any) {
      console.error('Failed to load hold rolls:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleResolveHold = async (rollId: string, result: 'PASS' | 'REJECT') => {
    const actionText = result === 'PASS' ? 'Release to Stock' : 'Confirm Rejection (Write-Off)';
    if (!confirm(`Are you sure you want to ${actionText} for this roll?`)) return;

    try {
      setActioningId(rollId);
      const res = await fetch('/api/fabric-store/qc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rollId,
          inspectionType: 'RANDOM_QC',
          result,
          remarks: `Resolved from QC Hold: ${result === 'PASS' ? 'Released to Stock' : 'Confirmed Reject'}`,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update roll');

      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0FAF9] pb-16">
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-8 py-4 flex items-center justify-between shadow-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700 block">
            FABRIC STORE · QUALITY QUARANTINE
          </span>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <PauseCircle className="w-5 h-5 text-amber-600" />
            Quarantined Rolls (QC Hold)
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
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold block">Quarantined Material Gate</span>
              <span className="text-amber-700 text-[11px]">
                Rolls on hold cannot be issued to production. Inspect lab results or conduct shade comparison to release or reject.
              </span>
            </div>
          </div>
          <span className="font-mono font-bold bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-300">
            {rolls.length} Rolls On Hold
          </span>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading hold rolls...</div>
          ) : rolls.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <PauseCircle className="w-10 h-10 text-emerald-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-800">No rolls currently quarantined</p>
              <p className="text-xs text-slate-500">All fabric in stock is cleared or rejected.</p>
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
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Audited Date</th>
                    <th className="py-3 px-4">QC Remarks / Reason</th>
                    <th className="py-3 px-4 text-right">Gate Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {rolls.map((roll) => (
                    <tr key={roll.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-amber-900">
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
                      <td className="py-3.5 px-4 font-mono font-semibold text-amber-800">
                        {roll.location?.locationCode || 'QUARANTINE'}
                      </td>
                      <td className="py-3.5 px-4 text-[11px] text-slate-500">
                        {roll.qcInspectedAt ? new Date(roll.qcInspectedAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 max-w-xs truncate" title={roll.qcRemarks}>
                        {roll.qcRemarks || 'Pending secondary approval'}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        <button
                          disabled={actioningId === roll.id}
                          onClick={() => handleResolveHold(roll.id, 'PASS')}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-emerald-700 hover:bg-emerald-800 px-2.5 py-1.5 rounded shadow-2xs transition disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Release to Stock</span>
                        </button>
                        <button
                          disabled={actioningId === roll.id}
                          onClick={() => handleResolveHold(roll.id, 'REJECT')}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-rose-700 hover:bg-rose-800 px-2.5 py-1.5 rounded shadow-2xs transition disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
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
