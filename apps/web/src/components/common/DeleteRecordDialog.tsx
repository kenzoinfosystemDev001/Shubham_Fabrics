'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

// Delete confirmation shared by every department: a challan (lib/admin-delete-server.ts), a received entry or a HOLD
// (lib/record-delete-server.ts). It first shows what the delete affects and why it is refused when it cannot be
// done (another department's record, already used downstream ...); a reason is required. The server checks it all
// again, so this dialog never decides on its own.

export type DeleteRecordKind = 'CHALLAN' | 'RECEIPT_WORK_ITEM' | 'RECEIPT_DYEING_ORDER' | 'RECEIPT_CHALLAN' | 'HOLD';
export type DeleteRecordTarget = { kind: DeleteRecordKind; id: string; label: string };

/** Small trash button that opens the dialog; `onDeleted` reloads the screen. */
export function DeleteRecordButton({ target, onDeleted, text }: { target: DeleteRecordTarget; onDeleted: (message: string) => void; text?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={text || 'Delete'}
        aria-label={`${text || 'Delete'} ${target.label}`}
        className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md text-[11px] font-semibold text-danger-700 hover:bg-danger-50"
      >
        <Trash2 className="w-3.5 h-3.5" />
        {text && <span>{text}</span>}
      </button>
      {open && (
        <DeleteRecordDialog
          target={target}
          onClose={() => setOpen(false)}
          onDeleted={(m) => {
            setOpen(false);
            onDeleted(m);
          }}
        />
      )}
    </>
  );
}

const TITLE: Record<DeleteRecordKind, string> = {
  CHALLAN: 'Delete Challan',
  RECEIPT_WORK_ITEM: 'Delete Received Fabric',
  RECEIPT_DYEING_ORDER: 'Delete Received Fabric',
  RECEIPT_CHALLAN: 'Delete Challan Receipt',
  HOLD: 'Delete HOLD',
};

/** The challan preview in the same shape as the other records. */
function challanImpact(c: any) {
  const byUnit = c.quantityByUnit && typeof c.quantityByUnit === 'object' ? Object.entries(c.quantityByUnit) : [];
  return {
    recordType: 'Challan',
    details: [
      ['Record', `Challan ${c.challanNumber}`],
      ['Challan Number', c.challanNumber],
      ['Design Number', c.designNumber],
      ['Serial Number', c.serialNumber],
      ['Production Sheet', c.productionSheet],
      ['Issuing Department', c.fromDepartmentName || c.fromDepartment],
      ['Receiving Department', c.toDepartmentName || c.toDepartment],
      ['Lines', c.itemCount],
      ...(byUnit.length ? byUnit.map(([u, q]) => [`Quantity (${u})`, `${q} ${u}`]) : [['Quantity', c.quantity]]),
      ['Status', String(c.status || '').replace(/_/g, ' ')],
    ],
    effects: c.effects || [],
    blockers: c.blockers || [],
    warning: c.warning || null,
  };
}

export function DeleteRecordDialog({ target, onClose, onDeleted }: { target: DeleteRecordTarget; onClose: () => void; onDeleted: (message: string) => void }) {
  const [impact, setImpact] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const isChallan = target.kind === 'CHALLAN';

  useEffect(() => {
    const url = isChallan ? `/api/challans/${target.id}/delete-impact` : `/api/records/delete?kind=${target.kind}&id=${encodeURIComponent(target.id)}`;
    fetch(url)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Could not check what this delete affects.');
        setImpact(isChallan ? challanImpact(body.data) : body.data);
      })
      .catch((err) => setLoadError(err.message));
  }, [target.id, target.kind, isChallan]);

  const blocked = Boolean(impact?.blockers?.length);
  const ready = impact && !blocked && reason.trim() && !deleting;

  const submit = async () => {
    if (!ready) return;
    setDeleting(true);
    setError(null);
    try {
      const res = isChallan
        ? await fetch(`/api/challans/${target.id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: reason.trim() }) })
        : await fetch('/api/records/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: target.kind, id: target.id, reason: reason.trim() }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Delete failed. Nothing was changed.');
      onDeleted(body.message || `${target.label} deleted.`);
    } catch (err: any) {
      setError(err.message);
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-neutral-900/50 p-3 overflow-y-auto text-left" role="dialog" aria-modal="true" aria-labelledby="delete-record-title">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-neutral-200">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between gap-3">
          <h3 id="delete-record-title" className="text-sm font-bold text-neutral-900 flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-danger-600" />
            {TITLE[target.kind]} · {target.label}
          </h3>
          <button type="button" onClick={onClose} className="p-1.5 text-neutral-500 hover:bg-neutral-100 rounded-lg" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4 text-xs">
          {loadError && <p role="alert" className="px-3 py-2 rounded-lg border border-danger-200 bg-danger-50 font-semibold text-danger-700">{loadError}</p>}
          {!impact && !loadError && <p className="text-neutral-500">Checking what this delete affects…</p>}
          {impact && (
            <>
              <div className="rounded-xl border border-neutral-200 px-3 py-1">
                {(impact.details as Array<[string, any]>).map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3 py-1 border-b border-neutral-100 last:border-0">
                    <span className="text-neutral-500">{label}</span>
                    <span className="font-semibold text-neutral-900 text-right">{value === null || value === undefined || value === '' ? '—' : value}</span>
                  </div>
                ))}
              </div>
              {blocked ? (
                <div role="alert" className="px-3 py-2.5 rounded-lg border border-danger-200 bg-danger-50 text-danger-800 space-y-1">
                  <p className="font-bold flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> This cannot be deleted</p>
                  {impact.blockers.map((b: string, i: number) => <p key={i}>{b}</p>)}
                </div>
              ) : (
                <>
                  {impact.warning && (
                    <p role="alert" className="px-3 py-2 rounded-lg border border-danger-200 bg-danger-50 font-semibold text-danger-800 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {impact.warning}
                    </p>
                  )}
                  {impact.effects?.length > 0 && (
                    <div className="px-3 py-2.5 rounded-lg border border-accent-300 bg-accent-50 text-neutral-900 space-y-1">
                      <p className="font-bold">What happens</p>
                      <ul className="list-disc pl-4 space-y-0.5">{impact.effects.map((e: string, i: number) => <li key={i}>{e}</li>)}</ul>
                    </div>
                  )}
                  <label className="block space-y-1">
                    <span className="font-semibold text-neutral-700">Reason for deleting <span className="text-danger-600">*</span></span>
                    <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} autoFocus className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </label>
                </>
              )}
              {error && <p role="alert" className="px-3 py-2 rounded-lg border border-danger-200 bg-danger-50 font-semibold text-danger-700">{error}</p>}
            </>
          )}
        </div>
        <div className="px-5 py-4 border-t border-neutral-200 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={deleting} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-700 border border-neutral-300 hover:bg-neutral-50">
            {blocked ? 'Close' : 'Cancel'}
          </button>
          {!blocked && (
            <button type="button" onClick={submit} disabled={!ready} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-danger-600 hover:bg-danger-700 disabled:opacity-50">
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
