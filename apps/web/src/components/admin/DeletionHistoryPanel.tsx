'use client';

import React, { useEffect, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';

// Admin: every delete across the MES (challans, Production Sheets, received entries, HOLDs, bulk deletes), newest
// first, with who did it, when and why. Read from the audit log, which is never deleted.

export function DeletionHistoryPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (q = search) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/deletion-history${q.trim() ? `?search=${encodeURIComponent(q.trim())}` : ''}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not load the deletion history.');
      setRows(body.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">Deletion History</h2>
          <p className="text-xs text-neutral-500 mt-0.5">Every deleted challan, Production Sheet, received entry and HOLD, with who deleted it and why.</p>
        </div>
        <div className="flex items-center gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              load();
            }}
            className="relative"
          >
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Challan, sheet, reason, user…" aria-label="Search deletion history" className="h-9 pl-9 pr-3 w-64 rounded-lg border border-neutral-300 text-xs" />
          </form>
          <button type="button" onClick={() => load()} disabled={loading} className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      {error && <p role="alert" className="px-3 py-2 rounded-lg border border-danger-200 bg-danger-50 text-xs font-semibold text-danger-700">{error}</p>}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-neutral-50 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="py-2.5 px-3">Date & Time</th>
              <th className="py-2.5 px-3">What</th>
              <th className="py-2.5 px-3">Record</th>
              <th className="py-2.5 px-3">Production Sheet</th>
              <th className="py-2.5 px-3">Design No.</th>
              <th className="py-2.5 px-3">Department</th>
              <th className="py-2.5 px-3">Quantity</th>
              <th className="py-2.5 px-3">Reason</th>
              <th className="py-2.5 px-3">Deleted By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-neutral-500">Nothing has been deleted.</td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="align-top">
                <td className="py-2.5 px-3 whitespace-nowrap">{new Date(r.at).toLocaleString()}</td>
                <td className="py-2.5 px-3 font-semibold text-neutral-900 whitespace-nowrap">{r.label}</td>
                <td className="py-2.5 px-3 font-mono">{r.reference || '—'}</td>
                <td className="py-2.5 px-3 font-mono">{r.productionSheet || '—'}</td>
                <td className="py-2.5 px-3">{r.designNumber || '—'}</td>
                <td className="py-2.5 px-3 whitespace-nowrap">{r.department || '—'}</td>
                <td className="py-2.5 px-3 whitespace-nowrap">{typeof r.quantity === 'string' ? r.quantity : '—'}</td>
                <td className="py-2.5 px-3 min-w-[180px] text-neutral-700">{r.reason || '—'}</td>
                <td className="py-2.5 px-3 whitespace-nowrap">{r.by}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
