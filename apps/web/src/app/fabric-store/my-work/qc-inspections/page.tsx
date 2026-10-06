'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ClipboardCheck, RefreshCw, Eye, ArrowRight, ShieldCheck, Filter } from 'lucide-react';

export default function QCInspectionsQueuePage() {
  const [loading, setLoading] = useState(true);
  const [rolls, setRolls] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const url = selectedBatch
        ? `/api/fabric-store/qc?batchId=${encodeURIComponent(selectedBatch)}`
        : '/api/fabric-store/qc';
      const [qcRes, batchRes] = await Promise.all([
        fetch(url),
        fetch('/api/fabric-store/batches'),
      ]);

      const qcJson = await qcRes.json();
      const batchJson = await batchRes.json();

      setRolls(qcJson.data || []);
      setBatches(batchJson.data || []);
    } catch (e) {
      console.error('Error fetching QC queue:', e);
      setRolls([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedBatch]);

  return (
    <div className="min-h-screen bg-[#F0FAF9]">
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-8 py-4 flex items-center justify-between shadow-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700 block">
            FABRIC STORE · QUALITY CONTROL
          </span>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-amber-600" />
            QC Inspection Queue
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
          <Link
            href="/fabric-store/quality/inspections"
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-md transition"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <span>Inspection Log</span>
          </Link>
        </div>
      </header>

      <main className="p-8 max-w-7xl mx-auto space-y-6">
        {/* Filter bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-700">Filter by Batch:</span>
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="text-xs border border-slate-300 rounded-md px-3 py-1.5 bg-white text-slate-800 focus:ring-1 focus:ring-amber-500"
            >
              <option value="">All Batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.batchNumber} — {b.fabricType} ({b.fabricDescription})
                </option>
              ))}
            </select>
          </div>
          <span className="text-xs text-amber-700 font-semibold bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
            Pending Inspection: <strong>{rolls.length}</strong> rolls
          </span>
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading QC queue...</div>
          ) : rolls.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <ClipboardCheck className="w-10 h-10 text-emerald-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-800">All received fabric has been inspected!</p>
              <p className="text-xs text-slate-500">
                New inward rolls from GRN will automatically queue here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Roll Number</th>
                    <th className="py-3 px-4">Batch Number</th>
                    <th className="py-3 px-4">Fabric Type &amp; Details</th>
                    <th className="py-3 px-4">Color</th>
                    <th className="py-3 px-4">Length</th>
                    <th className="py-3 px-4">Width</th>
                    <th className="py-3 px-4">Weight</th>
                    <th className="py-3 px-4">Inward Date</th>
                    <th className="py-3 px-4">QC Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {rolls.map((roll) => (
                    <tr key={roll.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-amber-900">
                        {roll.rollNumber}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700">
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
                      <td className="py-3.5 px-4 text-slate-700 font-medium">
                        {roll.batch?.colorName || '—'}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {parseFloat(roll.length).toFixed(2)} m
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {roll.width ? `${roll.width} cm` : '—'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {roll.weight ? `${roll.weight} kg` : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-[11px] text-slate-500">
                        {new Date(roll.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-orange-800 border border-orange-200">
                          PENDING
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/fabric-store/my-work/qc-inspections/${roll.id}`}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-amber-600 hover:bg-amber-700 px-3 py-1.5 rounded shadow-2xs transition"
                        >
                          <span>Conduct QC</span>
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
