'use client';

import React, { useState, useEffect } from 'react';
import { BookOpen, RefreshCw, Filter, ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react';

export default function StockLedgerPage() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 1 });
  const [typeFilter, setTypeFilter] = useState('');

  const loadData = async (page = 1) => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      query.set('page', String(page));
      query.set('limit', '50');
      if (typeFilter) query.set('transactionType', typeFilter);

      const res = await fetch(`/api/fabric-store/ledger?${query.toString()}`);
      const json = await res.json();
      setEntries(json.data || []);
      if (json.pagination) setPagination(json.pagination);
    } catch (err: any) {
      console.error('Failed to load ledger:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(1);
  }, [typeFilter]);

  const typeBadge = (type: string) => {
    const colors: Record<string, string> = {
      RECEIPT: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      ISSUE: 'bg-blue-100 text-blue-800 border-blue-200',
      RETURN: 'bg-purple-100 text-purple-800 border-purple-200',
      ADJUSTMENT: 'bg-amber-100 text-amber-800 border-amber-200',
      WRITE_OFF: 'bg-rose-100 text-rose-800 border-rose-200',
      TRANSFER: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    };
    return (
      <span
        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
          colors[type] || 'bg-slate-100 text-slate-700'
        }`}
      >
        {type}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#F0FAF9] pb-16">
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-8 py-4 flex items-center justify-between shadow-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-700 block">
            FABRIC STORE · AUDIT &amp; TRACEABILITY
          </span>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-teal-600" />
            Immutable Stock Movement Ledger
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => loadData(pagination.page)}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <main className="p-8 max-w-7xl mx-auto space-y-6">
        {/* Banner */}
        <div className="bg-slate-900 text-white rounded-xl p-4 flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-teal-400 shrink-0" />
            <div>
              <span className="font-bold block">Immutable Transactional Ledger</span>
              <span className="text-slate-400 text-[11px]">
                Every meter moved, received, issued, or transferred generates a permanent cryptographically stamped ledger entry.
              </span>
            </div>
          </div>
          <span className="font-mono text-teal-300 font-bold bg-slate-800 px-3 py-1.5 rounded-lg shrink-0">
            {pagination.total} Total Ledger Entries
          </span>
        </div>

        {/* Filter bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-700">Transaction Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-md px-3 py-1.5"
            >
              <option value="">All Movement Types</option>
              <option value="RECEIPT">RECEIPT (+)</option>
              <option value="ISSUE">ISSUE (-)</option>
              <option value="RETURN">RETURN (+)</option>
              <option value="TRANSFER">TRANSFER (Location)</option>
              <option value="ADJUSTMENT">ADJUSTMENT</option>
              <option value="WRITE_OFF">WRITE_OFF (-)</option>
            </select>
          </div>
          <span className="text-xs text-slate-500">
            Showing Page {pagination.page} of {pagination.pages}
          </span>
        </div>

        {/* Ledger Table */}
        <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading ledger trail...</div>
          ) : entries.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">No ledger entries found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Entry #</th>
                    <th className="py-3 px-4">Date &amp; Time</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Roll Number</th>
                    <th className="py-3 px-4">Batch #</th>
                    <th className="py-3 px-4">Meters Moved</th>
                    <th className="py-3 px-4">From Location</th>
                    <th className="py-3 px-4">To Location</th>
                    <th className="py-3 px-4">Transacted By</th>
                    <th className="py-3 px-4">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4 font-mono font-bold text-teal-900">
                        {entry.entryNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {new Date(entry.transactedAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">{typeBadge(entry.transactionType)}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {entry.roll?.rollNumber}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {entry.batch?.batchNumber}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {parseFloat(entry.quantity).toFixed(2)} m
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {entry.fromLocation?.locationCode || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700 font-semibold">
                        {entry.toLocation?.locationCode || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-800 font-medium">
                        {entry.transactedBy?.fullName}
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate" title={entry.remarks}>
                        {entry.remarks || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs">
              <button
                disabled={pagination.page <= 1}
                onClick={() => loadData(pagination.page - 1)}
                className="flex items-center gap-1 px-3 py-1.5 border rounded hover:bg-slate-50 disabled:opacity-30"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <span className="text-slate-500">
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                disabled={pagination.page >= pagination.pages}
                onClick={() => loadData(pagination.page + 1)}
                className="flex items-center gap-1 px-3 py-1.5 border rounded hover:bg-slate-50 disabled:opacity-30"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
