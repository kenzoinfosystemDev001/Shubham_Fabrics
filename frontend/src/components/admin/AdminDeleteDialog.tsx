'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { ModalShell } from '@/components/common/ModalShell';

// Admin delete of one Production Sheet or one challan. It first shows everything the delete removes (from the server's
// delete-impact check): later challans, department lines, QC and HOLD records, Inventory packing, and the MTR / PCS
// returned to Fabric Store. Nothing built on the record stops an administrator; `blockers` remain only for checks the
// server may still report. No reason or typed confirmation is asked; the Delete button confirms.

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
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const isProgram = target.kind === 'program';
  const bodyRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

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

  // A failed delete keeps the dialog open and brings its message into view.
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [error]);

  const blocked = Boolean(impact?.blockers?.length);
  const ready = impact && !blocked;

  const submit = async () => {
    if (!ready) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(isProgram ? `/api/programs/${target.id}` : `/api/challans/${target.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
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
    <ModalShell
      titleId="admin-delete-title"
      title={
        <>
          <Trash2 className="w-4 h-4 shrink-0 text-danger-600" />
          Delete {isProgram ? 'Production Sheet' : 'Challan'} {target.label}
        </>
      }
      onClose={onClose}
      busy={deleting}
      bodyRef={bodyRef}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={deleting} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-700 border border-neutral-300 hover:bg-neutral-50">
            {blocked ? 'Close' : 'Cancel'}
          </button>
          {!blocked && (
            <button type="button" onClick={submit} disabled={!ready || deleting} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-danger-600 hover:bg-danger-700 disabled:opacity-50">
              {deleting ? 'Deleting…' : isProgram ? 'Delete Production Sheet' : 'Delete Challan'}
            </button>
          )}
        </>
      }
    >
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
                    {row('Challans deleted', impact.challanCount ? `${impact.challanCount} (${impact.challanNumbers.join(', ')})` : '0')}
                    {impact.sharedChallans?.length > 0 &&
                      row(
                        "Shared challans (only this sheet's lines removed)",
                        impact.sharedChallans.map((c: any) => `${c.challanNumber}: ${c.removedLines} removed, ${c.keptLines} kept`).join(' · '),
                      )}
                    {row('Wilcom designs', impact.wilcomCount)}
                    {row('Department lines', impact.dependentRecords.departmentLines)}
                    {row('Dyeing orders', impact.dependentRecords.dyeingOrders)}
                    {row('HOLD records', impact.dependentRecords.holds)}
                    {row('QC inspections', impact.dependentRecords.qcInspections)}
                    {row('Production records', impact.dependentRecords.productionLogs)}
                    {row('Inventory lines', impact.inventoryLines?.length ? impact.inventoryLines.join(', ') : '0')}
                    {row('Packing records', impact.packing?.length ? impact.packing.map((p: any) => `${p.packingNumber} (${p.inventoryLine}, ${p.quantity} PCS)`).join(', ') : '0')}
                    {row('Fabric Store stock returned', impact.storeReturn || '—')}
                    {row('Dependent records in all', impact.dependentTotal)}
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
                    {impact.storeReturn && row('Fabric Store stock returned', impact.storeReturn)}
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
                    <div className="px-3 py-2.5 rounded-lg border border-accent-300 bg-accent-50 text-neutral-900 space-y-1">
                      <p className="font-bold">What happens</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        <li>The sheet, its Wilcom designs and its challans are deleted, with every record built on them in every department: received lines, dyeing orders, QC PASS / REJECT / REWORK results, HOLDs, Inventory lines and packing.</li>
                        {impact.linesByDepartment?.length > 0 && (
                          <li>Department lines removed: {impact.linesByDepartment.map((d: any) => `${d.department} ${d.count}`).join(', ')}.</li>
                        )}
                        <li>Fabric Store stock issued to the sheet returns to the store{impact.storeReturn ? ` (${impact.storeReturn})` : ''}; MTR and PCS stay separate. Pending, available and inventory figures are recalculated.</li>
                        {impact.sharedChallans?.length > 0 && <li>Challans shared with other Production Sheets keep those sheets' lines; only this sheet's lines are removed.</li>}
                      </ul>
                    </div>
                  )}
                  {impact.otherSheets?.length > 0 && (
                    <p role="alert" className="px-3 py-2.5 rounded-lg border border-danger-200 bg-danger-50 text-danger-800">
                      Lines recorded under other Production Sheets ({impact.otherSheets.join(', ')}) were made from this material and are removed with it.
                    </p>
                  )}
                  <p className="px-3 py-2.5 rounded-lg border border-danger-200 bg-danger-50 text-danger-800 font-semibold flex gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                    This permanently removes the complete production history of this {isProgram ? 'Production Sheet' : 'challan'}. It cannot be undone; a snapshot is kept in Deletion History.
                  </p>
                </>
              )}
              {error && (
                <p ref={errorRef} role="alert" className="px-3 py-2 rounded-lg border border-danger-200 bg-danger-50 font-semibold text-danger-700 whitespace-pre-wrap">
                  {error}
                </p>
              )}
            </>
          )}
    </ModalShell>
  );
}
