'use client';

import React, { useEffect, useState } from 'react';
import { Eraser, RefreshCw, Search, Trash2, X } from 'lucide-react';

// Admin: every delete across the MES (challans, Production Sheets, received entries, HOLDs, bulk deletes), newest
// first, with who did it, when and why. Read from the audit log. An administrator may clear it (all, or entries
// before a date, with a typed confirmation) or remove one entry; the clear itself stays recorded in the audit log.

const CLEAR_PHRASE = 'CLEAR HISTORY';

export function DeletionHistoryPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [scope, setScope] = useState<'ALL' | 'BEFORE'>('ALL');
  const [before, setBefore] = useState('');
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmRow, setConfirmRow] = useState<any | null>(null);

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

  const clear = async (payload: Record<string, unknown>, key: string) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/deletion-history', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not clear the deletion history.');
      setNotice(body.message);
      setClearing(false);
      setConfirmRow(null);
      setPhrase('');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const toClear = scope === 'ALL' ? rows.length : rows.filter((r) => before && new Date(r.at) < new Date(`${before}T00:00:00`)).length;
  const canClear = phrase.trim().toUpperCase() === CLEAR_PHRASE && (scope === 'ALL' || Boolean(before));

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
          <button
            type="button"
            onClick={() => {
              setClearing((v) => !v);
              setPhrase('');
            }}
            disabled={rows.length === 0 && !clearing}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-danger-200 bg-white text-xs font-semibold text-danger-700 hover:bg-danger-50 disabled:opacity-50 transition"
          >
            <Eraser className="w-4 h-4" /> Clear History
          </button>
          <button type="button" onClick={() => load()} disabled={loading} className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && <p role="alert" className="px-3 py-2 rounded-lg border border-danger-200 bg-danger-50 text-xs font-semibold text-danger-700">{error}</p>}
      {notice && <p role="status" className="px-3 py-2 rounded-lg border border-accent-300 bg-white text-xs font-semibold text-neutral-900">{notice}</p>}

      {clearing && (
        <div role="region" aria-label="Clear deletion history" className="rounded-xl border border-danger-200 bg-white p-4 space-y-3 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-neutral-900">Clear Deletion History</p>
              <p className="text-xs text-neutral-500 mt-0.5">
                Removes the history entries only. Nothing that was deleted comes back, and no other record changes. Who cleared it, and when, stays in the audit log.
              </p>
            </div>
            <button type="button" onClick={() => setClearing(false)} className="p-1 text-neutral-400 hover:text-neutral-700 rounded" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input type="radio" name="clear-scope" checked={scope === 'ALL'} onChange={() => setScope('ALL')} className="accent-danger-600" />
              Everything
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input type="radio" name="clear-scope" checked={scope === 'BEFORE'} onChange={() => setScope('BEFORE')} className="accent-danger-600" />
              Entries before
            </label>
            <input
              type="date"
              value={before}
              onChange={(e) => {
                setBefore(e.target.value);
                setScope('BEFORE');
              }}
              aria-label="Clear entries before this date"
              className="h-8 px-2 rounded-lg border border-neutral-300 text-xs"
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <label className="block flex-1">
              <span className="text-[11px] font-semibold text-neutral-600">
                Type <span className="font-mono text-danger-700">{CLEAR_PHRASE}</span> to confirm
              </span>
              <input value={phrase} onChange={(e) => setPhrase(e.target.value)} autoComplete="off" className="mt-1 h-9 w-full px-3 rounded-lg border border-neutral-300 text-xs font-mono" />
            </label>
            <button
              type="button"
              onClick={() => clear({ scope, before: scope === 'BEFORE' ? before : undefined, confirm: phrase }, 'bulk')}
              disabled={!canClear || busy !== null}
              className="h-9 px-4 rounded-lg bg-danger-600 hover:bg-danger-700 text-white text-xs font-semibold disabled:opacity-50 transition"
            >
              {busy === 'bulk' ? 'Clearing…' : `Clear ${scope === 'ALL' ? 'all' : ''} ${toClear} ${toClear === 1 ? 'entry' : 'entries'}`.replace('  ', ' ')}
            </button>
          </div>
          {search.trim() && <p className="text-[11px] text-neutral-500">The search does not limit the clear: it applies to every entry{scope === 'BEFORE' ? ' before the date' : ''}.</p>}
        </div>
      )}

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
              <th className="py-2.5 px-3"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-neutral-500">Nothing has been deleted.</td>
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
                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                  {confirmRow?.id === r.id ? (
                    <span className="inline-flex items-center gap-1.5">
                      <button type="button" onClick={() => clear({ scope: 'ONE', id: r.id }, r.id)} disabled={busy !== null} className="px-2 py-1 rounded-md bg-danger-600 hover:bg-danger-700 text-white text-[11px] font-semibold disabled:opacity-50">
                        {busy === r.id ? 'Removing…' : 'Remove'}
                      </button>
                      <button type="button" onClick={() => setConfirmRow(null)} className="px-2 py-1 rounded-md border border-neutral-300 text-[11px] font-semibold text-neutral-700">
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setConfirmRow(r)} className="p-1.5 rounded-md text-neutral-400 hover:text-danger-700 hover:bg-danger-50" title="Remove this entry from the history" aria-label={`Remove ${r.label} ${r.reference || ''} from the history`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
