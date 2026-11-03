'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

// Admin delete of one Production Sheet or one challan. It first shows what the delete affects (from the server's
// delete-impact check), and why it is refused when later work depends on the record. A reason is required; a
// high-impact delete (a sheet with challans or production records) also needs its number typed.

export type AdminDeleteTarget = { kind: 'program' | 'challan'; id: string; label: string };

const row = (label: string, value: React.ReactNode) => (
  <div className="flex justify-between gap-3 py-1 border-b border-neutral-100 last:border-0">
    <span className="text-neutral-500">{label}</span>
    <span className="font-semibold text-neutral-900 text-right">{value ?? '—'}</span>
  </div>
);

export function AdminDeleteDialog({ target, onClose, onDeleted }: { target: AdminDeleteTarget; onClose: () => void; onDeleted: (message: string) => void }) {
  const [impact, setImpact] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const isProgram = target.kind === 'program';

  useEffect(() => {
    const url = isProgram ? `/api/admin/programs/${target.id}/delete-impact` : `/api/admin/challans/${target.id}/delete-impact`;
    fetch(url)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Could not check what this delete affects.');
        setImpact(body.data);
      })
      .catch((err) => setLoadError(err.message));
  }, [target.id, isProgram]);

  const blocked = Boolean(impact?.blockers?.length);
  const highImpact = isProgram ? Boolean(impact?.highImpact) : false;
  const confirmText = isProgram ? impact?.productionSheet : impact?.challanNumber;
  const ready = impact && !blocked && reason.trim() && (!highImpact || typed.trim() === String(confirmText));

  const submit = async () => {
    if (!ready) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(isProgram ? `/api/programs/${target.id}` : `/api/challans/${target.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Delete failed.');
      onDeleted(body.message || `${target.label} deleted.`);
    } catch (err: any) {
      setError(err.message);
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-neutral-900/50 p-3 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="admin-delete-title">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-neutral-200">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h3 id="admin-delete-title" className="text-sm font-bold text-neutral-900 flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-danger-600" />
            Delete {isProgram ? 'Production Sheet' : 'Challan'} {target.label}
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
                {isProgram ? (
                  <>
                    {row('Production Sheet', impact.productionSheet)}
                    {row('Design Number', impact.designNumber)}
                    {row('Serial Number', impact.serialNumber)}
                    {row('Production Type', impact.productionTypes?.length ? impact.productionTypes.join(', ') : '—')}
                    {row('Challans', impact.challanCount ? `${impact.challanCount} (${impact.challanNumbers.join(', ')})` : '0')}
                    {row('Wilcom designs', impact.wilcomCount)}
                    {row('Department lines', impact.dependentRecords.departmentLines)}
                    {row('Dyeing orders', impact.dependentRecords.dyeingOrders)}
                    {row('HOLD records', impact.dependentRecords.holds)}
                    {row('QC inspections', impact.dependentRecords.qcInspections)}
                    {row('Production records', impact.dependentRecords.productionLogs)}
                  </>
                ) : (
                  <>
                    {row('Challan Number', impact.challanNumber)}
                    {row('Issuing Department', impact.fromDepartment)}
                    {row('Receiving Department', impact.toDepartment)}
                    {row('Production Sheet', impact.productionSheet)}
                    {row('Design Number', impact.designNumber)}
                    {row('Serial Number', impact.serialNumber)}
                    {row('Items', impact.itemCount)}
                    {row('Quantity (MTR / PCS)', impact.quantity)}
                    {row('Status', impact.status)}
                  </>
                )}
              </div>

              {blocked ? (
                <div role="alert" className="px-3 py-2.5 rounded-lg border border-danger-200 bg-danger-50 text-danger-800 space-y-1">
                  <p className="font-bold flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> This cannot be deleted yet</p>
                  {impact.blockers.map((b: string, i: number) => (
                    <p key={i}>{b}</p>
                  ))}
                </div>
              ) : (
                <>
                  {!isProgram && impact.effects?.length > 0 && (
                    <div className="px-3 py-2.5 rounded-lg border border-accent-300 bg-accent-50 text-neutral-900 space-y-1">
                      <p className="font-bold">What happens</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {impact.effects.map((e: string, i: number) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {isProgram && (
                    <p className="px-3 py-2.5 rounded-lg border border-accent-300 bg-accent-50 text-neutral-900">
                      The sheet, its Wilcom designs and all of its challans are deleted. Each challan is rolled back: Fabric Store stock it issued returns to the store and its department records are removed. Other Production Sheets are not touched.
                    </p>
                  )}
                  <label className="block space-y-1">
                    <span className="font-semibold text-neutral-700">Reason for deleting <span className="text-danger-600">*</span></span>
                    <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} autoFocus className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </label>
                  {highImpact && (
                    <label className="block space-y-1">
                      <span className="font-semibold text-neutral-700">
                        This also deletes its challans and production records. Type <span className="font-mono text-danger-700">{confirmText}</span> to confirm
                      </span>
                      <input value={typed} onChange={(e) => setTyped(e.target.value)} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs font-mono text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                    </label>
                  )}
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
            <button type="button" onClick={submit} disabled={!ready || deleting} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-danger-600 hover:bg-danger-700 disabled:opacity-50">
              {deleting ? 'Deleting…' : 'Delete Permanently'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
