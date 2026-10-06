'use client';

import React, { useState, useEffect } from 'react';
import { RotateCcw, RefreshCw, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

export default function MaterialReturnPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [issuedRolls, setIssuedRolls] = useState<any[]>([]);
  const [selectedRollIds, setSelectedRollIds] = useState<string[]>([]);
  const [returnReason, setReturnReason] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/fabric-store/return');
      const json = await res.json();
      setIssuedRolls(json.data || []);
    } catch (err: any) {
      console.error('Failed to load issued rolls:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleSelectRoll = (id: string) => {
    if (selectedRollIds.includes(id)) {
      setSelectedRollIds(selectedRollIds.filter((rId) => rId !== id));
    } else {
      setSelectedRollIds([...selectedRollIds, id]);
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (selectedRollIds.length === 0) {
      setError('Please select at least one roll to return.');
      return;
    }
    if (!returnReason.trim()) {
      setError('Please provide a reason for material return.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/fabric-store/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rollIds: selectedRollIds,
          returnReason: returnReason.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to accept return');

      setSuccess(json.message || 'Rolls successfully returned and queued for return QC.');
      setSelectedRollIds([]);
      setReturnReason('');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0FAF9] pb-24">
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-8 py-4 flex items-center justify-between shadow-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-700 block">
            FABRIC STORE · MATERIAL INWARD
          </span>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-purple-600" />
            Accept Material Return from Production
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
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold">
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold">
            {success}
          </div>
        )}

        {/* Return reason card */}
        <form onSubmit={handleReturnSubmit} className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-3">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
            Return Documentation &amp; Authorization
          </h2>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Return Reason / Notes <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Leftover meters from lay cutting, program cancel, shade discrepancy returned from dyeing..."
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 focus:ring-1 focus:ring-purple-500"
            />
          </div>
        </form>

        {/* Issued rolls table */}
        <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200/80">
            <h2 className="text-sm font-bold text-slate-900">
              Active Rolls Issued to Production (Status: ISSUED)
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Select any rolls returned from the floor. Returned rolls automatically route to Return QC.
            </p>
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading issued rolls...</div>
          ) : issuedRolls.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <RotateCcw className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">No active rolls currently issued</p>
              <p className="text-xs text-slate-500">
                Rolls issued to production will appear here if available for return.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">Select</th>
                    <th className="py-3 px-4">Roll Number</th>
                    <th className="py-3 px-4">Issued To Program</th>
                    <th className="py-3 px-4">Batch Number</th>
                    <th className="py-3 px-4">Fabric Description</th>
                    <th className="py-3 px-4">Length</th>
                    <th className="py-3 px-4">Issued At</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {issuedRolls.map((roll) => {
                    const isSelected = selectedRollIds.includes(roll.id);
                    return (
                      <tr
                        key={roll.id}
                        onClick={() => toggleSelectRoll(roll.id)}
                        className={`cursor-pointer transition ${
                          isSelected ? 'bg-purple-50/60 font-medium' : 'hover:bg-slate-50/60'
                        }`}
                      >
                        <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectRoll(roll.id)}
                            className="rounded border-slate-300 text-purple-600"
                          />
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-purple-900">
                          {roll.rollNumber}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-900 font-semibold">
                          {roll.programIssuedTo?.programNumber} ({roll.programIssuedTo?.clientName || 'General'})
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">
                          {roll.batch?.batchNumber}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {roll.batch?.fabricDescription}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          {parseFloat(roll.length).toFixed(2)} m
                        </td>
                        <td className="py-3.5 px-4 text-[11px] text-slate-500">
                          {roll.issuedAt ? new Date(roll.issuedAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            ISSUED
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Floating Action Bar */}
      {selectedRollIds.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur-xs border-t border-slate-800 p-4 z-40 flex items-center justify-between px-8 text-white">
          <div className="flex items-center gap-4 text-xs">
            <span className="text-slate-400">Selected for Return:</span>
            <span className="text-base font-bold text-purple-400">{selectedRollIds.length} rolls</span>
          </div>
          <button
            type="button"
            disabled={submitting || !returnReason.trim()}
            onClick={handleReturnSubmit}
            className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{submitting ? 'Processing Return...' : 'Accept Return & Route to QC'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
