'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowUpFromLine, RefreshCw, CheckCircle2, Layers, AlertCircle, Send } from 'lucide-react';

export default function MaterialIssuePage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rolls, setRolls] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedRollIds, setSelectedRollIds] = useState<string[]>([]);
  const [targetProgramId, setTargetProgramId] = useState('');
  const [issueRemarks, setIssueRemarks] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [fabricTypeFilter, setFabricTypeFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [rollsRes, programsRes] = await Promise.all([
        fetch('/api/fabric-store/rolls?status=IN_STOCK&qcStatus=PASSED&limit=200'),
        fetch('/api/programs'),
      ]);

      const rollsJson = await rollsRes.json();
      const programsJson = await programsRes.json();

      setRolls(rollsJson.data || []);
      setPrograms(Array.isArray(programsJson) ? programsJson : []);
    } catch (err: any) {
      console.error('Failed to load issue data:', err);
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

  const selectAllFiltered = () => {
    if (selectedRollIds.length === filteredRolls.length) {
      setSelectedRollIds([]);
    } else {
      setSelectedRollIds(filteredRolls.map((r) => r.id));
    }
  };

  const filteredRolls = rolls.filter((r) => {
    if (fabricTypeFilter && r.batch?.fabricType !== fabricTypeFilter) return false;
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      const matchesNum = r.rollNumber?.toLowerCase().includes(q);
      const matchesBatch = r.batch?.batchNumber?.toLowerCase().includes(q);
      const matchesDesc = r.batch?.fabricDescription?.toLowerCase().includes(q);
      return matchesNum || matchesBatch || matchesDesc;
    }
    return true;
  });

  const selectedRollsData = rolls.filter((r) => selectedRollIds.includes(r.id));
  const totalSelectedMeters = selectedRollsData.reduce(
    (sum, r) => sum + parseFloat(r.length || '0'),
    0
  );

  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (selectedRollIds.length === 0) {
      setError('Please select at least one roll to issue.');
      return;
    }
    if (!targetProgramId) {
      setError('Please select a production program to issue material to.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/fabric-store/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rollIds: selectedRollIds,
          programId: targetProgramId,
          remarks: issueRemarks || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to issue material');

      setSuccess(json.message || 'Rolls successfully issued to production program!');
      setSelectedRollIds([]);
      setIssueRemarks('');
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
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-700 block">
            FABRIC STORE · DISPATCH &amp; ISSUE
          </span>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ArrowUpFromLine className="w-5 h-5 text-blue-600" />
            Material Issue to Production
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

        {/* Issue Configuration Card */}
        <form onSubmit={handleIssueSubmit} className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-4">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
            Target Production Program &amp; Assignment
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Select Destination Program <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={targetProgramId}
                onChange={(e) => setTargetProgramId(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-900 font-semibold focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-- Choose Target Program --</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.programNumber} — {p.clientName || p.buyerName || 'General Buyer'} · Style: {p.styleCode || p.mainStyle || '—'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Issue Challan / Job Reference
              </label>
              <input
                type="text"
                placeholder="Issue note, job order, or operator tag"
                value={issueRemarks}
                onChange={(e) => setIssueRemarks(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </form>

        {/* Available Rolls Table */}
        <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Available Stock (Status: IN_STOCK &amp; QC_PASSED)
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Only approved, inspected fabric rolls can be issued to production.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search roll, batch, fabric..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="text-xs border border-slate-300 rounded-md px-3 py-1.5 w-52"
              />
              <select
                value={fabricTypeFilter}
                onChange={(e) => setFabricTypeFilter(e.target.value)}
                className="text-xs border border-slate-300 rounded-md px-3 py-1.5"
              >
                <option value="">All Fabric Types</option>
                <option value="KORA">KORA</option>
                <option value="DYED">DYED</option>
                <option value="WOVEN">WOVEN</option>
                <option value="BLENDED">BLENDED</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading available rolls...</div>
          ) : filteredRolls.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <Layers className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">No stock ready for issue</p>
              <p className="text-xs text-slate-500">
                Ensure rolls have completed and passed QC inspection before issuing.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={
                          filteredRolls.length > 0 &&
                          selectedRollIds.length === filteredRolls.length
                        }
                        onChange={selectAllFiltered}
                        className="rounded border-slate-300 text-blue-600"
                      />
                    </th>
                    <th className="py-3 px-4">Roll Number</th>
                    <th className="py-3 px-4">Batch Number</th>
                    <th className="py-3 px-4">Fabric Type &amp; Description</th>
                    <th className="py-3 px-4">Color</th>
                    <th className="py-3 px-4">Length</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">QC Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredRolls.map((roll) => {
                    const isSelected = selectedRollIds.includes(roll.id);
                    return (
                      <tr
                        key={roll.id}
                        onClick={() => toggleSelectRoll(roll.id)}
                        className={`cursor-pointer transition ${
                          isSelected ? 'bg-blue-50/60 font-medium' : 'hover:bg-slate-50/60'
                        }`}
                      >
                        <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectRoll(roll.id)}
                            className="rounded border-slate-300 text-blue-600"
                          />
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-blue-900">
                          {roll.rollNumber}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">
                          {roll.batch?.batchNumber}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-semibold block text-slate-900">
                            {roll.batch?.fabricType}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {roll.batch?.fabricDescription}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {roll.batch?.colorName || 'Natural'}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          {parseFloat(roll.length).toFixed(2)} m
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">
                          {roll.location?.locationCode || 'UNASSIGNED'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            PASSED
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

      {/* Floating Action Bar when rolls are selected */}
      {selectedRollIds.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur-xs border-t border-slate-800 p-4 z-40 flex items-center justify-between px-8 text-white">
          <div className="flex items-center gap-6 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Selected Rolls</span>
              <span className="text-base font-bold text-blue-400">{selectedRollIds.length} rolls</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Meters</span>
              <span className="text-base font-bold font-mono text-emerald-400">
                {totalSelectedMeters.toFixed(2)} m
              </span>
            </div>
          </div>
          <button
            type="button"
            disabled={submitting || !targetProgramId}
            onClick={handleIssueSubmit}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition"
          >
            <Send className="w-4 h-4" />
            <span>{submitting ? 'Issuing Rolls...' : 'Confirm Issue to Program'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
