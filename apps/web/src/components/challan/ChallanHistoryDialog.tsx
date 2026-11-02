'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { BTN_QUIET, Notice, fetchJson } from '@/components/workflow/WorkflowUi';

// A challan's edit history (GET /api/challans/:id/history): who changed it, when, why, and each value before and
// after, including lines added and removed. History is never erased.

const show = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));

export function ChallanHistoryDialog({ challan, onClose }: { challan: any; onClose: () => void }) {
  const [entries, setEntries] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson(`/api/challans/${challan.id}/history`)
      .then((body) => setEntries(body.data || []))
      .catch((err) => setError(err.message));
  }, [challan.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-neutral-900/50 p-3 overflow-y-auto print:hidden" role="dialog" aria-modal="true" aria-labelledby="challan-history-title">
      <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 w-full max-w-3xl">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div>
            <h3 id="challan-history-title" className="text-sm font-bold text-neutral-900">Edit History: Challan {challan.challanNumber}</h3>
            <p className="text-xs text-neutral-500">Every correction made to this challan, newest first.</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-neutral-500 hover:bg-neutral-100 rounded-lg" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && <Notice kind="error">{error}</Notice>}
          {!entries && !error && <p className="text-xs text-neutral-500">Loading…</p>}
          {entries && entries.length === 0 && <p className="text-xs text-neutral-500">This challan has not been edited.</p>}
          {entries?.map((e) => (
            <div key={e.id} className="border border-neutral-200 rounded-xl p-4 space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-xs font-bold text-neutral-900">{e.by}</span>
                <span className="text-[11px] text-neutral-500">{new Date(e.at).toLocaleString()}</span>
              </div>
              <p className="text-xs text-neutral-700">
                <span className="font-semibold">Reason:</span> {show(e.reason)}
              </p>
              {e.changes ? (
                <div className="space-y-1.5 text-xs">
                  {Object.values(e.changes.header || {}).map((c: any, i: number) => (
                    <p key={`h${i}`} className="text-neutral-800">
                      {c.label}: <span className="line-through text-neutral-500">{show(c.from)}</span> → <span className="font-semibold">{show(c.to)}</span>
                    </p>
                  ))}
                  {(e.changes.lines || []).map((l: any) => (
                    <div key={l.id}>
                      <p className="font-semibold text-neutral-900">{l.line}</p>
                      {Object.values(l.changes || {}).map((c: any, i: number) => (
                        <p key={i} className="pl-3 text-neutral-800">
                          {c.label}: <span className="line-through text-neutral-500">{show(c.from)}</span> → <span className="font-semibold">{show(c.to)}</span>
                        </p>
                      ))}
                    </div>
                  ))}
                  {(e.changes.added || []).map((l: any, i: number) => (
                    <p key={`a${i}`} className="text-accent-800">
                      Line added: {l.line} ({show(l.quantity)} {l.uom}){l.colour ? `, ${l.colour}` : ''}
                    </p>
                  ))}
                  {(e.changes.removed || []).map((l: any, i: number) => (
                    <p key={`r${i}`} className="text-danger-700">
                      Line removed: {l.line} ({show(l.quantity)} {l.uom}){l.colour ? `, ${l.colour}` : ''}
                    </p>
                  ))}
                </div>
              ) : e.legacyFields ? (
                <p className="text-[11px] text-neutral-500">
                  Changed: {[...(e.legacyFields.header || []), ...(e.legacyFields.lines || []).flatMap((l: any) => l.fields || [])].join(', ') || '—'} (older edit: previous values were not recorded).
                </p>
              ) : null}
            </div>
          ))}
        </div>
        <div className="px-5 py-4 border-t border-neutral-200 flex justify-end">
          <button type="button" onClick={onClose} className={BTN_QUIET}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
