'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { newSubmissionKey } from '@/components/challan/ChallanNumberField';
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
import { availableToProcess, pendingReject, pendingRework, readyToTransfer, receivedBasis } from '@/lib/work-items.mjs';
import { departmentName, transferPath, workPath, type WorkflowView } from '@/lib/workflow-views';
import { GarmentTag } from '@/components/recutting/RecuttingUi';
import { FabricPhotos } from '@/components/workflow/FabricPhotos';

const HELD = 'RECEIVED,IN_PROGRESS,COMPLETED,PARTIALLY_TRANSFERRED';
const FILTERS = [
  { id: 'open', label: 'To Inspect' },
  { id: 'pending', label: 'Pending' },
  { id: 'progress', label: 'In Progress' },
  { id: 'all', label: 'All Received' },
];

const round = (n: number) => Math.round(n * 1000) / 1000;

function InspectionContent({ flow }: { flow: WorkflowView }) {
  const params = useSearchParams();
  const router = useRouter();
  const page = workPath(flow);
  const overdue = params.get('overdue') === '1';
  const [filter, setFilter] = useState(params.get('inspection') || 'open');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(params.get('itemId'));

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ status: HELD });
      if (filter !== 'all') q.set('inspection', filter);
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
  }, [filter, overdue]);

  const listed = useMemo(() => items.find((i) => i.id === openId) || null, [items, openId]);
  // A line opened by link may be outside the current filter: load it on its own.
  const [linked, setLinked] = useState<any | null>(null);
  useEffect(() => {
    if (!openId || listed || loading) return;
    fetchJson(`${flow.api}/items/${openId}`)
      .then((b) => setLinked(b.data))
      .catch(() => setLinked(null));
  }, [openId, listed, loading, flow.api]);
  const current = listed || (linked?.id === openId ? linked : null);

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <PageHeader title={flow.inspectionTitle || 'QC Inspection'} loading={loading} onRefresh={load}>
        <Link href={transferPath(flow, 'PASS')} className={BTN_PRIMARY}>
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
          title="Material for Inspection"
          count={items.length}
          actions={
            <>
              <div role="tablist" className="inline-flex flex-wrap p-0.5 bg-neutral-100 rounded-lg">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    role="tab"
                    aria-selected={filter === f.id}
                    onClick={() => setFilter(f.id)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                      filter === f.id ? 'bg-white text-brand-800 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
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
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" aria-label="Search material" className={`${FIELD} pl-9 md:w-56`} />
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
                  <th className="py-3 px-3 text-right">Uninspected</th>
                  <th className="py-3 px-3 text-right">Pass</th>
                  <th className="py-3 px-3 text-right">Reject</th>
                  <th className="py-3 px-3 text-right">Rework</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Priority</th>
                  <th className="py-3 px-3">Deadline</th>
                  <th className="py-3 px-3"><span className="sr-only">Inspect</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {!loading && items.length === 0 && <EmptyRow colSpan={14} text="No material in this view" />}
                {items.map((i) => (
                  <tr key={i.id} className={`hover:bg-neutral-50/60 ${openId === i.id ? 'bg-brand-50/40' : ''}`}>
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
                    <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap font-semibold">{fmtQty(availableToProcess(i), i.uom)}</td>
                    <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(i.passedQuantity, i.uom)}</td>
                    <td className={`py-3 px-3 text-right tabular-nums whitespace-nowrap ${i.rejectedQuantity > 0 ? 'text-danger-700' : ''}`}>{fmtQty(i.rejectedQuantity, i.uom)}</td>
                    <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(i.reworkQuantity, i.uom)}</td>
                    <td className="py-3 px-3"><WorkStatusBadge status={i.status} qc /></td>
                    <td className="py-3 px-3"><PriorityBadge priority={i.priority} /></td>
                    <td className="py-3 px-3 text-xs whitespace-nowrap"><DeadlineText program={i.program} /></td>
                    <td className="py-3 px-3 text-right">
                      <button onClick={() => setOpenId(i.id)} className={BTN_QUIET}>
                        {availableToProcess(i) > 0 ? 'Inspect' : 'View'}
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
        <InspectionDrawer
          key={`${current.id}-${current.updatedAt}`}
          flow={flow}
          item={current}
          onClose={() => {
            setOpenId(null);
            setLinked(null);
            if (params.get('itemId')) router.replace(page);
          }}
          onSaved={(saved, message) => {
            setSuccess(message);
            setItems((list) => list.map((i) => (i.id === saved.id ? saved : i)));
            if (linked?.id === saved.id) setLinked(saved);
          }}
        />
      )}
    </div>
  );
}

function QtyInput({ label, value, onChange, uom, tone }: { label: string; value: string; onChange: (v: string) => void; uom: string; tone?: string }) {
  return (
    <label className="block">
      <span className={`text-xs font-semibold ${tone || 'text-neutral-600'}`}>{label}</span>
      <div className="mt-1 flex items-center gap-1.5">
        <input type="number" min="0" step="any" value={value} onChange={(e) => onChange(e.target.value)} className={`${FIELD} text-right tabular-nums`} />
        <span className="text-xs text-neutral-500">{uom}</span>
      </div>
    </label>
  );
}

function InspectionDrawer({ flow, item, onClose, onSaved }: { flow: WorkflowView; item: any; onClose: () => void; onSaved: (item: any, message: string) => void }) {
  const open = availableToProcess(item);
  const [inspected, setInspected] = useState('');
  const [pass, setPass] = useState('');
  const [reject, setReject] = useState('');
  const [rework, setRework] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [reworkReason, setReworkReason] = useState('');
  const [remarks, setRemarks] = useState('');
  // Blank until the inspector records each one.
  const [checks, setChecks] = useState<Record<string, string>>({});
  const [submissionKey] = useState(newSubmissionKey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const n = (v: string) => Number(v) || 0;
  const sum = round(n(pass) + n(reject) + n(rework));
  const balanced = inspected !== '' && sum === round(n(inspected));
  const over = n(inspected) > open;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (over) return setError(`Only ${fmtQty(open, item.uom)} is still uninspected.`);
    if (!balanced) return setError(`PASS + REJECT + REWORK must equal the inspected quantity.`);
    const unchecked = (flow.checkpoints || []).find((c) => !checks[c.key]);
    if (unchecked) return setError(`Record ${unchecked.label} as Pass or Fail.`);
    setSaving(true);
    try {
      const body = await fetchJson(`${flow.api}/items/${item.id}/inspections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: submissionKey,
          inspectedQuantity: inspected,
          passQuantity: pass,
          rejectQuantity: reject,
          reworkQuantity: rework,
          rejectReason,
          reworkReason,
          remarks,
          ...(flow.checkpoints ? { checkpoints: checks } : {}),
        }),
      });
      onSaved(body.data, `${item.fabricName}: inspection of ${fmtQty(n(inspected), item.uom)} recorded.`);
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-neutral-900/40" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="bg-white w-full max-w-xl h-full overflow-y-auto shadow-xl border-l border-neutral-200 flex flex-col">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-start justify-between gap-3 sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              {item.fabricName}
              <GarmentTag item={item} />
              <FabricStatusBadge status={item.fabricProcessingStatus} />
            </h3>
            <p className="text-xs text-neutral-500 font-mono">
              <Link href={`/programs/${item.program?.id}`} className="hover:underline">{sheetRef(item.program)}</Link> ·{' '}
              <Link href={`/challans/${item.inboundChallan?.id}`} className="hover:underline">{item.inboundChallan?.challanNumber || '—'}</Link>
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

          <dl className="grid grid-cols-3 gap-x-4 gap-y-3 text-sm">
            {flow.garments && (
              <>
                <div><dt className="text-xs text-neutral-500">Design</dt><dd className="font-semibold">{item.program?.designNumber || item.program?.wilcomDesignNumber || '—'}</dd></div>
                <div><dt className="text-xs text-neutral-500">Serial</dt><dd className="font-semibold font-mono">{item.program?.programSerialNo || '—'}</dd></div>
                <div><dt className="text-xs text-neutral-500">From</dt><dd className="font-semibold">{departmentName(item.sourceDepartment)}</dd></div>
              </>
            )}
            <div><dt className="text-xs text-neutral-500">Colour</dt><dd className="font-semibold">{item.colour || '—'}</dd></div>
            <div><dt className="text-xs text-neutral-500">Received</dt><dd className="font-semibold tabular-nums">{fmtQty(receivedBasis(item), item.uom)}</dd></div>
            <div><dt className="text-xs text-neutral-500">Uninspected</dt><dd className="font-semibold tabular-nums">{fmtQty(open, item.uom)}</dd></div>
            <div><dt className="text-xs text-neutral-500">Passed, not sent</dt><dd className="font-semibold tabular-nums">{fmtQty(readyToTransfer(item), item.uom)}</dd></div>
            <div><dt className="text-xs text-neutral-500">Rejected, not sent</dt><dd className="font-semibold tabular-nums text-danger-700">{fmtQty(pendingReject(item), item.uom)}</dd></div>
            <div><dt className="text-xs text-neutral-500">Rework, not returned</dt><dd className="font-semibold tabular-nums">{fmtQty(pendingRework(item), item.uom)}</dd></div>
            {flow.garments && (
              <>
                <div><dt className="text-xs text-neutral-500">Inspected</dt><dd className="font-semibold tabular-nums">{fmtQty(item.processedQuantity, item.uom)}</dd></div>
                <div><dt className="text-xs text-neutral-500">Passed</dt><dd className="font-semibold tabular-nums">{fmtQty(item.passedQuantity, item.uom)}</dd></div>
                <div><dt className="text-xs text-neutral-500">Rejected / Rework</dt><dd className="font-semibold tabular-nums">{fmtQty(item.rejectedQuantity, item.uom)} / {fmtQty(item.reworkQuantity, item.uom)}</dd></div>
              </>
            )}
          </dl>

          {/* Fabric photos: Threadcut QC sees Embroidery's and uploads its own. */}
          <FabricPhotos workItemId={item.id} />

          {open <= 0 ? (
            <Notice kind="success">All received material on this line has been inspected.</Notice>
          ) : (
            <fieldset className="space-y-4">
              <legend className="text-xs font-semibold text-neutral-600 mb-2">New inspection</legend>
              <div className="grid grid-cols-2 gap-4">
                <QtyInput label="Inspected quantity" value={inspected} onChange={setInspected} uom={item.uom} />
                <div className="flex items-end">
                  <p className={`text-xs font-semibold ${inspected === '' ? 'text-neutral-500' : balanced && !over ? 'text-brand-800' : 'text-danger-700'}`}>
                    Allocated {fmtQty(sum, item.uom)} of {fmtQty(n(inspected), item.uom)}
                    {over ? ` (only ${fmtQty(open, item.uom)} uninspected)` : ''}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <QtyInput label="Pass" value={pass} onChange={setPass} uom={item.uom} tone="text-brand-800" />
                <QtyInput label="Reject" value={reject} onChange={setReject} uom={item.uom} tone="text-danger-700" />
                <QtyInput label="Rework" value={rework} onChange={setRework} uom={item.uom} />
              </div>
              {n(reject) > 0 && (
                <label className="block">
                  <span className="text-xs font-semibold text-danger-700">Defect reason (required)</span>
                  <input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} maxLength={300} required className={`${FIELD} mt-1`} />
                </label>
              )}
              {n(rework) > 0 && (
                <label className="block">
                  <span className="text-xs font-semibold text-neutral-700">Rework reason (required)</span>
                  <input value={reworkReason} onChange={(e) => setReworkReason(e.target.value)} maxLength={300} required className={`${FIELD} mt-1`} />
                </label>
              )}
              {flow.checkpoints && (
                <div>
                  <span className="text-xs font-semibold text-neutral-600">Checkpoints</span>
                  <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                    {flow.checkpoints.map((c) => (
                      <label key={c.key} className="flex items-center justify-between gap-3">
                        <span className="text-sm text-neutral-800">{c.label}</span>
                        <select
                          value={checks[c.key] || ''}
                          onChange={(e) => setChecks({ ...checks, [c.key]: e.target.value })}
                          required
                          className={`${FIELD} w-28 ${checks[c.key] === 'FAIL' ? 'border-danger-500 text-danger-700' : ''}`}
                        >
                          <option value="">Select</option>
                          <option value="PASS">Pass</option>
                          <option value="FAIL">Fail</option>
                        </select>
                      </label>
                    ))}
                  </div>
                  {Object.values(checks).includes('FAIL') && (
                    <p className="mt-1 text-[11px] text-danger-700">A failed checkpoint needs the affected quantity recorded as Reject or Rework.</p>
                  )}
                </div>
              )}
              <label className="block">
                <span className="text-xs font-semibold text-neutral-600">Inspection remarks</span>
                <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={500} rows={2} className={`${FIELD} h-auto py-2 mt-1`} />
              </label>
            </fieldset>
          )}

          {item.inspections?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-neutral-600 mb-2">Inspections</h4>
              <ul className="space-y-2 text-xs">
                {item.inspections.map((x: any) => (
                  <li key={x.id} className="border border-neutral-200 rounded-lg p-2.5">
                    <div className="flex justify-between gap-3">
                      <span className="font-semibold tabular-nums">Inspected {fmtQty(x.inspectedQuantity, x.uom)}</span>
                      <span className="text-neutral-500">{fmtDate(x.createdAt, true)} · {x.inspector?.fullName || '—'}</span>
                    </div>
                    <p className="mt-1 tabular-nums text-neutral-700">
                      Pass {fmtQty(x.passQuantity, x.uom)} · <span className="text-danger-700">Reject {fmtQty(x.rejectQuantity, x.uom)}</span> · Rework {fmtQty(x.reworkQuantity, x.uom)}
                    </p>
                    {x.rejectReason && <p className="text-danger-700">Defect: {x.rejectReason}</p>}
                    {x.reworkReason && <p className="text-neutral-700">Rework: {x.reworkReason}</p>}
                    {x.remarks && <p className="text-neutral-500">{x.remarks}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-neutral-200 flex flex-wrap justify-end gap-2 sticky bottom-0 bg-white">
          {readyToTransfer(item) > 0 && <Link href={transferPath(flow, 'PASS')} className={BTN_QUIET}>Send passed to {flow.next}</Link>}
          {pendingReject(item) > 0 && <Link href={transferPath(flow, 'REJECT')} className={BTN_QUIET}>Rejected Material</Link>}
          {pendingRework(item) > 0 && <Link href={transferPath(flow, 'REWORK')} className={BTN_QUIET}>Rework Material</Link>}
          {open > 0 && (
            <button type="submit" disabled={saving} className={BTN_PRIMARY}>
              {saving ? 'Saving…' : 'Record Inspection'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export function WorkInspection({ flow }: { flow: WorkflowView }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <InspectionContent flow={flow} />
    </Suspense>
  );
}
