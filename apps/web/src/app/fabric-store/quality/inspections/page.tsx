'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, RefreshCw, Filter, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

export default function QualityInspectionsLogPage() {
  const [loading, setLoading] = useState(true);
  const [inspections, setInspections] = useState<any[]>([]);
  const [resultFilter, setResultFilter] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const url = resultFilter
        ? `/api/fabric-store/qc?result=${encodeURIComponent(resultFilter)}`
        : '/api/fabric-store/qc?result=PASS';
      // If no resultFilter selected, let's fetch PASS by default or all results
      // Let's create a combined query or fetch all results
      const res = await fetch(resultFilter ? `/api/fabric-store/qc?result=${resultFilter}` : '/api/fabric-store/qc?result=PASS');
      const json = await res.json();
      setInspections(json.data || []);
    } catch (err: any) {
      console.error('Failed to load inspections:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [resultFilter]);

  const resultBadge = (res: string) => {
    if (res === 'PASS') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>PASS</span>
        </span>
      );
    }
    if (res === 'HOLD') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
          <AlertTriangle className="w-3 h-3 text-amber-600" />
          <span>HOLD</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
        <XCircle className="w-3 h-3 text-rose-600" />
        <span>REJECT</span>
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#F0FAF9] pb-16">
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-8 py-4 flex items-center justify-between shadow-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-700 block">
            FABRIC STORE · QUALITY ASSURANCE
          </span>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-600" />
            Inspection Audit Records
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
        {/* Filter bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-700">Audit Result:</span>
            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-md px-3 py-1.5"
            >
              <option value="PASS">PASS (Accepted)</option>
              <option value="HOLD">HOLD (Quarantine)</option>
              <option value="REJECT">REJECT (Scrapped)</option>
            </select>
          </div>
          <span className="text-xs text-slate-500">
            Total Records: <strong className="text-slate-800">{inspections.length}</strong>
          </span>
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading audit records...</div>
          ) : inspections.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">No inspection records found for this filter</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Inspection #</th>
                    <th className="py-3 px-4">Date &amp; Time</th>
                    <th className="py-3 px-4">Roll Number</th>
                    <th className="py-3 px-4">Batch Number</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Verdict</th>
                    <th className="py-3 px-4">Defects Flagged</th>
                    <th className="py-3 px-4">Auditor</th>
                    <th className="py-3 px-4">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {inspections.map((insp) => (
                    <tr key={insp.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-teal-900">
                        {insp.inspectionNumber}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {new Date(insp.inspectedAt).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {insp.roll?.rollNumber}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {insp.roll?.batch?.batchNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-800">{insp.inspectionType}</span>
                      </td>
                      <td className="py-3.5 px-4">{resultBadge(insp.result)}</td>
                      <td className="py-3.5 px-4">
                        {Array.isArray(insp.defects) && insp.defects.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {insp.defects.map((d: string, idx: number) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 bg-rose-50 border border-rose-200 text-rose-800 rounded text-[10px]"
                              >
                                {d}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400">None</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-800 font-medium">
                        {insp.inspectedBy?.fullName}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate" title={insp.remarks}>
                        {insp.remarks || '—'}
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
