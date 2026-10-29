'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import {
  BTN_PRIMARY,
  BTN_QUIET,
  DeadlineText,
  DocumentsButton,
  EmptyRow,
  FIELD,
  FabricStatusBadge,
  Notice,
  PageHeader,
  Panel,
  PriorityBadge,
  THEAD,
  WorkStatusBadge,
  fetchJson,
  fmtDate,
  fmtQty,
  challanRef,
  sheetRef,
} from '@/components/workflow/WorkflowUi';
import { availableToProcess, awaitingTakeIn, inProduction, readyToTransfer, receivedBasis } from '@/lib/work-items.mjs';
import { isAdminUser } from '@/lib/rbac';
import { departmentName, type WorkflowView } from '@/lib/workflow-views';
import { GarmentTag } from '@/components/recutting/RecuttingUi';
import { FabricPhotos } from '@/components/workflow/FabricPhotos';

const WORKING = 'RECEIVED,IN_PROGRESS,COMPLETED,READY_FOR_TRANSFER,PARTIALLY_TRANSFERRED';

function ProcessContent({ flow }: { flow: WorkflowView }) {
  const params = useSearchParams();
  const router = useRouter();
  const page = `${flow.base}/my-work/process`;
  const overdue = params.get('overdue') === '1';
  const filters = [
    { id: WORKING, label: 'All' },
    { id: 'RECEIVED', label: 'Pending' },
    { id: 'IN_PROGRESS', label: 'In Progress' },
    ...(flow.production ? [{ id: 'stage:PARTIALLY_COMPLETED', label: 'Partially Completed' }] : []),
    { id: 'COMPLETED', label: 'Completed' },
    { id: 'READY_FOR_TRANSFER,PARTIALLY_TRANSFERRED', label: `Ready for ${flow.next}` },
  ];
  // Production: in progress with some good quantity done reads as "Partially Completed".
  const partlyDone = (i: any) => Boolean(flow.production) && i.status === 'IN_PROGRESS' && i.processedQuantity > 0;
  const [statusFilter, setStatusFilter] = useState(params.get('status') || WORKING);
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(params.get('itemId'));
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    try {
      setIsAdmin(isAdminUser(JSON.parse(localStorage.getItem('subham_mes_user') || 'null')));
    } catch {}
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [kind, value] = statusFilter.startsWith('stage:') ? ['stage', statusFilter.slice(6)] : ['status', statusFilter];
      const q = new URLSearchParams({ [kind]: value });
      if (overdue) q.set('overdue', '1');
      if (search.trim()) q.set('search', search.trim());
      const body = await fetchJson(`${flow.api}/items?${q}`);
      setItems(body.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, overdue]);

  const editing = useMemo(() => items.find((i) => i.id === editingId) || null, [items, editingId]);

  // A line opened by link may be outside the current filter: load it on its own.
  const [linked, setLinked] = useState<any | null>(null);
  useEffect(() => {
    if (!editingId || editing || loading) return;
    fetchJson(`${flow.api}/items/${editingId}`)
      .then((b) => setLinked(b.data))
      .catch(() => setLinked(null));
  }, [editingId, editing, loading, flow.api]);

  const current = editing || (linked?.id === editingId ? linked : null);
  const replace = (saved: any) => {
    setItems((list) => list.map((i) => (i.id === saved.id ? saved : i)));
    if (linked?.id === saved.id) setLinked(saved);
  };

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <PageHeader title={flow.processTitle || (flow.production ? `${flow.label} Production` : `${flow.label} Process`)} loading={loading} onRefresh={load}>
        <Link href={`${flow.base}/my-work/issue-challan`} className={BTN_PRIMARY}>
          Issue Challan to {flow.next}
        </Link>
      </PageHeader>

      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {error && <Notice kind="error" onClose={() => setError(null)}>{error}</Notice>}
        {success && <Notice kind="success" onClose={() => setSuccess(null)}>{success}</Notice>}
        {overdue && (
          <Notice kind="error" onClose={() => router.replace(page)}>
            Showing overdue work only.
          </Notice>
        )}

        <Panel
          title={`${flow.label} Work`}
          count={items.length}
          actions={
            <>
              <div role="tablist" className="inline-flex flex-wrap p-0.5 bg-neutral-100 rounded-lg">
                {filters.map((f) => (
                  <button
                    key={f.id}
                    role="tab"
                    aria-selected={statusFilter === f.id}
                    onClick={() => setStatusFilter(f.id)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                      statusFilter === f.id ? 'bg-white text-brand-800 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  load();
                }}
                className="relative"
              >
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" aria-label={`Search ${flow.label} work`} className={`${FIELD} pl-9 md:w-56`} />
              </form>
            </>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className={THEAD}>
                <tr>
                  <th className="py-3 px-4">Production Sheet</th>
                  <th className="py-3 px-3">Incoming Challan</th>
                  <th className="py-3 px-3">Fabric</th>
                  <th className="py-3 px-3">Colour</th>
                  <th className="py-3 px-3">Dyed / Undyed</th>
                  <th className="py-3 px-3 text-right">Received</th>
                  <th className="py-3 px-3 text-right">{flow.production ? 'Completed' : 'Processed'}</th>
                  <th className="py-3 px-3 text-right">Transferred</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Priority</th>
                  <th className="py-3 px-3">Expected / Deadline</th>
                  <th className="py-3 px-3"><span className="sr-only">Update</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {!loading && items.length === 0 && <EmptyRow colSpan={12} text={`No ${flow.label} work in this view`} />}
                {items.map((i) => (
                  <tr key={i.id} className={`hover:bg-neutral-50/60 ${editingId === i.id ? 'bg-brand-50/40' : ''}`}>
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs font-semibold text-neutral-900">{sheetRef(i.program)}</span>
                      <span className="block font-mono text-[11px] text-neutral-500">{challanRef(i)}</span>
                    </td>
                    <td className="py-3 px-3 text-xs">
                      <span className="font-mono text-brand-800">{i.inboundChallan?.challanNumber || '—'}</span>
                      <span className="block text-[11px] text-neutral-500">{departmentName(i.sourceDepartment)}</span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-neutral-900">{i.fabricName}<GarmentTag item={i} /></td>
                    <td className="py-3 px-3 text-neutral-700">{i.colour || '—'}</td>
                    <td className="py-3 px-3"><FabricStatusBadge status={i.fabricProcessingStatus} /></td>
                    <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(receivedBasis(i), i.uom)}</td>
                    <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(i.processedQuantity, i.uom)}</td>
                    <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(i.transferredQuantity, i.uom)}</td>
                    <td className="py-3 px-3"><WorkStatusBadge status={i.status} next={flow.next} qc={Boolean(flow.qc)} dispatch={flow.dispatchWords} label={partlyDone(i) ? 'Partially Completed' : undefined} /></td>
                    <td className="py-3 px-3"><PriorityBadge priority={i.priority} /></td>
                    <td className="py-3 px-3 text-xs whitespace-nowrap">
                      <span className="block text-neutral-600">{fmtDate(i.expectedCompletionDate)}</span>
                      <DeadlineText program={i.program} />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button onClick={() => setEditingId(i.id)} className={BTN_QUIET}>
                        Update
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </main>

      {current && (
        <ProcessEditor
          key={`${current.id}-${current.updatedAt}`}
          flow={flow}
          item={current}
          isAdmin={isAdmin}
          onClose={() => {
            setEditingId(null);
            setLinked(null);
            if (params.get('itemId')) router.replace(page);
          }}
          onSaved={(saved, message) => {
            setSuccess(message);
            replace(saved);
          }}
        />
      )}
    </div>
  );
}

function ProcessEditor({
  flow,
  item,
  isAdmin,
  onClose,
  onSaved,
}: {
  flow: WorkflowView;
  item: any;
  isAdmin: boolean;
  onClose: () => void;
  onSaved: (item: any, message: string) => void;
}) {
  const steps = [
    { status: 'RECEIVED', label: 'Pending' },
    { status: 'IN_PROGRESS', label: 'In Progress' },
    { status: 'COMPLETED', label: 'Completed' },
    { status: 'READY_FOR_TRANSFER', label: `Ready for ${flow.next}` },
  ];
  const partlySent = item.transferredQuantity > 0;
  const locked = item.status === 'TRANSFERRED';
  const [status, setStatus] = useState(item.status === 'PARTIALLY_TRANSFERRED' ? 'READY_FOR_TRANSFER' : item.status);
  // Saved quantities are shown; a quantity of 0 is shown as an empty field (sent as 0).
  const [processed, setProcessed] = useState(item.processedQuantity ? String(item.processedQuantity) : '');
  const [taken, setTaken] = useState(item.takenQuantity ? String(item.takenQuantity) : '');
  const [defect, setDefect] = useState(item.defectQuantity ? String(item.defectQuantity) : '');
  const [defectReason, setDefectReason] = useState('');
  const newDefect = Math.round(((Number(defect) || 0) - (Number(item.defectQuantity) || 0)) * 1000) / 1000;
  const [expected, setExpected] = useState(item.expectedCompletionDate ? String(item.expectedCompletionDate).slice(0, 10) : '');
  const [remarks, setRemarks] = useState(item.remarks || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const [reason, setReason] = useState('');

  const received = receivedBasis(item);
  const other = item.fabricProcessingStatus === 'DYED' ? 'UNDYED' : 'DYED';

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = await fetchJson(`${flow.api}/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(partlySent ? {} : { status }),
          processedQuantity: processed || '0',
          ...(flow.production ? { takenQuantity: taken || '0', defectQuantity: defect || '0', defectReason } : {}),
          expectedCompletionDate: expected || null,
          remarks,
        }),
      });
      onSaved(body.data, `${item.fabricName} updated.`);
      onClose();
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  const correct = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = await fetchJson(`${flow.api}/items/${item.id}/fabric-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fabricProcessingStatus: other, reason }),
      });
      onSaved(body.data, `${item.fabricName} corrected to ${other === 'DYED' ? 'Dyed' : 'Undyed'}.`);
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-neutral-900/40" role="dialog" aria-modal="true">
      <form onSubmit={save} className="bg-white w-full max-w-xl h-full overflow-y-auto shadow-xl border-l border-neutral-200 flex flex-col">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-start justify-between gap-3 sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              {item.fabricName}
              <FabricStatusBadge status={item.fabricProcessingStatus} />
            </h3>
            <GarmentTag item={item} />
            <p className="text-xs text-neutral-500 font-mono">
              {sheetRef(item.program)} · {challanRef(item) || '—'}
            </p>
            {/* Production Sheets, Wilcom sheets and the incoming challan of this line. */}
            <div className="mt-2">
              <DocumentsButton programId={item.programId} challanId={item.inboundChallanId} />
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-neutral-500 hover:bg-neutral-100 rounded-lg" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 flex-1">
          {error && <Notice kind="error">{error}</Notice>}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div><dt className="text-xs text-neutral-500">Colour</dt><dd className="font-semibold">{item.colour || '—'}</dd></div>
            <div><dt className="text-xs text-neutral-500">Received from</dt><dd className="font-semibold">{departmentName(item.sourceDepartment)}</dd></div>
            <div><dt className="text-xs text-neutral-500">Received</dt><dd className="font-semibold tabular-nums">{fmtQty(received, item.uom)}</dd></div>
            {flow.production ? (
              <>
                <div><dt className="text-xs text-neutral-500">Not yet taken in</dt><dd className="font-semibold tabular-nums">{fmtQty(awaitingTakeIn(item), item.uom)}</dd></div>
                <div><dt className="text-xs text-neutral-500">On the floor</dt><dd className="font-semibold tabular-nums">{fmtQty(inProduction(item), item.uom)}</dd></div>
                <div><dt className="text-xs text-neutral-500">Defective</dt><dd className="font-semibold tabular-nums text-danger-700">{fmtQty(item.defectQuantity, item.uom)}</dd></div>
                {item.sourceAllocation && (
                  <div><dt className="text-xs text-neutral-500">Recutting allocation</dt><dd className="font-mono text-xs">{item.sourceAllocation.allocationNumber}</dd></div>
                )}
                {item.sourceWorkItem && (
                  <div>
                    <dt className="text-xs text-neutral-500">{departmentName(item.sourceWorkItem.departmentCode)} line</dt>
                    <dd className="font-mono text-xs">{challanRef(item.sourceWorkItem) || '—'}</dd>
                  </div>
                )}
              </>
            ) : (
              <div><dt className="text-xs text-neutral-500">Still to process</dt><dd className="font-semibold tabular-nums">{fmtQty(availableToProcess(item), item.uom)}</dd></div>
            )}
            <div><dt className="text-xs text-neutral-500">Transferred to {flow.next}</dt><dd className="font-semibold tabular-nums">{fmtQty(item.transferredQuantity, item.uom)}</dd></div>
            <div><dt className="text-xs text-neutral-500">Ready for {flow.next}</dt><dd className="font-semibold tabular-nums">{fmtQty(readyToTransfer(item), item.uom)}</dd></div>
            <div><dt className="text-xs text-neutral-500">Started</dt><dd>{fmtDate(item.startedAt, true)}</dd></div>
            <div><dt className="text-xs text-neutral-500">Completed</dt><dd>{fmtDate(item.completedAt, true)}</dd></div>
          </dl>

          {/* Fabric photos: Embroidery and Stitching upload; every department sees the ones before it. */}
          <FabricPhotos workItemId={item.id} />

          {locked ? (
            <Notice kind="success">This line has been fully transferred to {flow.next}.</Notice>
          ) : (
            <>
              <fieldset disabled={partlySent}>
                <legend className="text-xs font-semibold text-neutral-600 mb-2">Status</legend>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-neutral-100 rounded-xl">
                  {steps.map((s) => (
                    <button
                      type="button"
                      key={s.status}
                      onClick={() => setStatus(s.status)}
                      aria-pressed={status === s.status}
                      className={`py-2 px-1 rounded-lg text-xs font-semibold transition cursor-pointer disabled:cursor-not-allowed ${
                        status === s.status ? 'bg-white text-brand-800 shadow-xs ring-1 ring-brand-300' : 'text-neutral-600 hover:text-neutral-900'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                {partlySent && <p className="mt-2 text-[11px] text-neutral-500">Part of this line is already with {flow.next}; only quantities can change.</p>}
              </fieldset>

              {flow.production && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-xs font-semibold text-neutral-600">Taken into {flow.label.toLowerCase()} (total)</span>
                    <div className="mt-1 flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={received}
                        step="any"
                        value={taken}
                        onChange={(e) => setTaken(e.target.value)}
                        className={`${FIELD} text-right tabular-nums`}
                      />
                      <span className="text-xs text-neutral-500">{item.uom}</span>
                    </div>
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-neutral-600">Defective (total, kept apart from good)</span>
                    <div className="mt-1 flex items-center gap-1.5">
                      <input
                        type="number"
                        min={item.defectQuantity || 0}
                        step="any"
                        value={defect}
                        onChange={(e) => setDefect(e.target.value)}
                        className={`${FIELD} text-right tabular-nums`}
                      />
                      <span className="text-xs text-neutral-500">{item.uom}</span>
                    </div>
                  </label>
                  {newDefect > 0 && (
                    <label className="block sm:col-span-2">
                      <span className="text-xs font-semibold text-danger-700">Defect reason for the new {fmtQty(newDefect, item.uom)} (required)</span>
                      <input value={defectReason} onChange={(e) => setDefectReason(e.target.value)} maxLength={300} required className={`${FIELD} mt-1`} />
                    </label>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-semibold text-neutral-600">{flow.production ? 'Completed, good (total)' : 'Processed quantity (total)'}</span>
                  <div className="mt-1 flex items-center gap-1.5">
                    <input
                      type="number"
                      min={item.transferredQuantity || 0}
                      max={received}
                      step="any"
                      value={processed}
                      onChange={(e) => setProcessed(e.target.value)}
                      className={`${FIELD} text-right tabular-nums`}
                    />
                    <span className="text-xs text-neutral-500">{item.uom}</span>
                  </div>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-neutral-600">Expected completion</span>
                  <input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} className={`${FIELD} mt-1`} />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-semibold text-neutral-600">Remarks / observations</span>
                <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={500} rows={2} className={`${FIELD} h-auto py-2 mt-1`} />
              </label>
            </>
          )}

          {isAdmin && !partlySent && (
            <div className="rounded-xl border border-neutral-200 p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-neutral-700">
                  Dyed / Undyed{item.fabricStatusSource === 'CORRECTED' ? ' (corrected)' : ' (from route)'}
                </p>
                {!correcting && (
                  <button type="button" onClick={() => setCorrecting(true)} className={BTN_QUIET}>
                    Correct
                  </button>
                )}
              </div>
              {correcting && (
                <>
                  <label className="block">
                    <span className="text-xs text-neutral-700">Reason for changing to {other === 'DYED' ? 'Dyed' : 'Undyed'} (recorded in the audit log)</span>
                    <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className={`${FIELD} mt-1`} />
                  </label>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setCorrecting(false)} className={BTN_QUIET}>Cancel</button>
                    <button type="button" onClick={correct} disabled={saving || !reason.trim()} className={BTN_PRIMARY}>
                      Mark as {other === 'DYED' ? 'Dyed' : 'Undyed'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {item.transfers?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-neutral-600 mb-2">Transfers to {flow.next}</h4>
              <ul className="space-y-1 text-xs">
                {item.transfers.map((t: any) => (
                  <li key={t.id} className="flex justify-between gap-3 border-b border-neutral-100 pb-1">
                    <Link href={`/challans/${t.challan?.id}`} className="font-mono text-brand-800 hover:underline">{t.challan?.challanNumber}</Link>
                    <span className="tabular-nums">{fmtQty(t.quantity, t.uom)}</span>
                    <span className="text-neutral-500">{fmtDate(t.createdAt, true)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {!locked && (
          <div className="px-5 py-4 border-t border-neutral-200 flex justify-end gap-2 sticky bottom-0 bg-white">
            <button type="button" onClick={onClose} className={BTN_QUIET}>Cancel</button>
            <button type="submit" disabled={saving} className={BTN_PRIMARY}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        )}
      </form>
    </div>
  );
}

export function WorkProcess({ flow }: { flow: WorkflowView }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <ProcessContent flow={flow} />
    </Suspense>
  );
}
