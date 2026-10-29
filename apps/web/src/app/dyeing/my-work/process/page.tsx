'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Search, X } from 'lucide-react';
import {
  BTN_PRIMARY,
  BTN_QUIET,
  DeadlineText,
  EmptyRow,
  FIELD,
  Notice,
  PageHeader,
  Panel,
  PriorityBadge,
  StatusBadge,
  THEAD,
  baseColour,
  fetchJson,
  fmtDate,
  fmtQty,
  sheetRef,
} from '@/components/dyeing/DyeingUi';
import { availableForQc, isColorMismatch, receivedBasis, remainingToDye } from '@/lib/dyeing-workflow.mjs';

const WORKING = 'RECEIVED,IN_DYEING,PARTIALLY_DYED,DYED,READY_FOR_QC1,PARTIALLY_SENT_TO_QC1';
const FILTERS = [
  { id: WORKING, label: 'All' },
  { id: 'RECEIVED', label: 'Pending' },
  { id: 'IN_DYEING,PARTIALLY_DYED', label: 'In Progress' },
  { id: 'DYED', label: 'Completed' },
  { id: 'READY_FOR_QC1,PARTIALLY_SENT_TO_QC1', label: 'Ready for QC' },
];

function ProcessContent() {
  const params = useSearchParams();
  const router = useRouter();
  const overdue = params.get('overdue') === '1';
  const [statusFilter, setStatusFilter] = useState(params.get('status') || WORKING);
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(params.get('orderId'));

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ status: statusFilter });
      if (overdue) q.set('overdue', '1');
      if (search.trim()) q.set('search', search.trim());
      const body = await fetchJson(`/api/dyeing/orders?${q}`);
      setOrders(body.data || []);
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

  const editing = useMemo(() => orders.find((o) => o.id === editingId) || null, [orders, editingId]);

  // An order opened by link may be outside the current filter: load it on its own.
  const [linked, setLinked] = useState<any | null>(null);
  useEffect(() => {
    if (!editingId || editing || loading) return;
    fetchJson(`/api/dyeing/orders/${editingId}`)
      .then((b) => setLinked(b.data))
      .catch(() => setLinked(null));
  }, [editingId, editing, loading]);

  const current = editing || (linked?.id === editingId ? linked : null);

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <PageHeader title="Dyeing Process" loading={loading} onRefresh={load}>
        <Link href="/dyeing/my-work/issue-challan" className={BTN_PRIMARY}>
          Issue Challan to Dyeing QC
        </Link>
      </PageHeader>

      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {error && <Notice kind="error" onClose={() => setError(null)}>{error}</Notice>}
        {success && <Notice kind="success" onClose={() => setSuccess(null)}>{success}</Notice>}
        {overdue && (
          <Notice kind="error" onClose={() => router.replace('/dyeing/my-work/process')}>
            Showing overdue work only.
          </Notice>
        )}

        <Panel
          title="Dyeing Work"
          count={orders.length}
          actions={
            <>
              <div role="tablist" className="inline-flex flex-wrap p-0.5 bg-neutral-100 rounded-lg">
                {FILTERS.map((f) => (
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
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" aria-label="Search dyeing work" className={`${FIELD} pl-9 md:w-56`} />
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
                  <th className="py-3 px-3">Base / Required Colour</th>
                  <th className="py-3 px-3 text-right">Received</th>
                  <th className="py-3 px-3 text-right">Processed</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Priority</th>
                  <th className="py-3 px-3">Expected / Deadline</th>
                  <th className="py-3 px-3"><span className="sr-only">Update</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {!loading && orders.length === 0 && <EmptyRow colSpan={10} text="No dyeing work in this view" />}
                {orders.map((o) => (
                  <tr key={o.id} className={`hover:bg-neutral-50/60 ${editingId === o.id ? 'bg-brand-50/40' : ''}`}>
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs font-semibold text-neutral-900">{sheetRef(o.program)}</span>
                      <span className="block font-mono text-[11px] text-neutral-500">{o.orderNumber}</span>
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-brand-800">{o.inboundChallan?.challanNumber || '—'}</td>
                    <td className="py-3 px-3 font-semibold text-neutral-900">{o.fabricName}</td>
                    <td className="py-3 px-3 text-xs">
                      <span className="text-neutral-600">{baseColour(o) || '—'}</span>
                      <span className="block font-semibold text-brand-900">{o.targetColor || '—'}</span>
                      {o.colorMismatch && (
                        <span className={`block font-semibold ${o.colorReviewedAt ? 'text-neutral-500' : 'text-danger-700'}`}>
                          Dyed {o.dyedColor}{o.colorReviewedAt ? ' (reviewed)' : ' (review needed)'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(receivedBasis(o), o.uom)}</td>
                    <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(o.dyedQuantity, o.uom)}</td>
                    <td className="py-3 px-3"><StatusBadge status={o.status} /></td>
                    <td className="py-3 px-3"><PriorityBadge priority={o.priority} /></td>
                    <td className="py-3 px-3 text-xs whitespace-nowrap">
                      <span className="block text-neutral-600">{fmtDate(o.expectedCompletionDate)}</span>
                      <DeadlineText program={o.program} />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button onClick={() => setEditingId(o.id)} className={BTN_QUIET}>
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
          order={current}
          onClose={() => {
            setEditingId(null);
            setLinked(null);
            if (params.get('orderId')) router.replace('/dyeing/my-work/process');
          }}
          onSaved={(saved) => {
            setSuccess(`${saved.orderNumber} updated.`);
            setOrders((list) => list.map((o) => (o.id === saved.id ? saved : o)));
            if (linked?.id === saved.id) setLinked(saved);
          }}
        />
      )}
    </div>
  );
}

const STEPS = [
  { status: 'RECEIVED', label: 'Pending' },
  { status: 'IN_DYEING', label: 'In Progress' },
  { status: 'DYED', label: 'Completed' },
  { status: 'READY_FOR_QC1', label: 'Ready for QC' },
];

function ProcessEditor({ order, onClose, onSaved }: { order: any; onClose: () => void; onSaved: (o: any) => void }) {
  const partlySent = order.sentToQc1Quantity > 0;
  const locked = order.status === 'SENT_TO_QC1';
  const currentStep = order.status === 'PARTIALLY_DYED' ? 'IN_DYEING' : order.status === 'PARTIALLY_SENT_TO_QC1' ? 'READY_FOR_QC1' : order.status;
  const [status, setStatus] = useState(currentStep);
  const [dyedQuantity, setDyedQuantity] = useState(order.dyedQuantity ? String(order.dyedQuantity) : '');
  const [dyedColor, setDyedColor] = useState(order.dyedColor || '');
  const [reviewNote, setReviewNote] = useState('');
  const [batchNumber, setBatchNumber] = useState(order.batchNumber || '');
  const [machineNumber, setMachineNumber] = useState(order.machineNumber || '');
  const [expected, setExpected] = useState(order.expectedCompletionDate ? String(order.expectedCompletionDate).slice(0, 10) : '');
  const [remarks, setRemarks] = useState(order.processRemarks || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const received = receivedBasis(order);
  const mismatch = isColorMismatch(order.targetColor, dyedColor);
  const alreadyReviewed = mismatch && Boolean(order.colorReviewedAt) && dyedColor.trim().toLowerCase() === String(order.dyedColor || '').trim().toLowerCase();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = await fetchJson(`/api/dyeing/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(partlySent ? {} : { status }),
          dyedQuantity: dyedQuantity || '0',
          dyedColor,
          colorReviewNote: reviewNote,
          batchNumber,
          machineNumber,
          expectedCompletionDate: expected || null,
          processRemarks: remarks,
        }),
      });
      onSaved(body.data);
      onClose();
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
            <h3 className="text-sm font-bold text-neutral-900">{order.fabricName}</h3>
            <p className="text-xs text-neutral-500 font-mono">
              {order.orderNumber} · {sheetRef(order.program)} · {order.inboundChallan?.challanNumber || '—'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-neutral-500 hover:bg-neutral-100 rounded-lg" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 flex-1">
          {error && <Notice kind="error">{error}</Notice>}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div><dt className="text-xs text-neutral-500">Base colour</dt><dd className="font-semibold">{baseColour(order) || '—'}</dd></div>
            <div><dt className="text-xs text-neutral-500">Required dye colour</dt><dd className="font-semibold text-brand-900">{order.targetColor || '—'}</dd></div>
            <div><dt className="text-xs text-neutral-500">Received</dt><dd className="font-semibold tabular-nums">{fmtQty(received, order.uom)}</dd></div>
            <div><dt className="text-xs text-neutral-500">Still to dye</dt><dd className="font-semibold tabular-nums">{fmtQty(remainingToDye(order), order.uom)}</dd></div>
            <div><dt className="text-xs text-neutral-500">Sent to QC</dt><dd className="font-semibold tabular-nums">{fmtQty(order.sentToQc1Quantity, order.uom)}</dd></div>
            <div><dt className="text-xs text-neutral-500">Available for QC</dt><dd className="font-semibold tabular-nums">{fmtQty(availableForQc(order), order.uom)}</dd></div>
            <div><dt className="text-xs text-neutral-500">Started</dt><dd>{fmtDate(order.startedAt, true)}</dd></div>
            <div><dt className="text-xs text-neutral-500">Completed</dt><dd>{fmtDate(order.completedAt, true)}</dd></div>
          </dl>

          {locked ? (
            <Notice kind="success">This line has been fully transferred to Dyeing QC.</Notice>
          ) : (
            <>
              <fieldset disabled={partlySent}>
                <legend className="text-xs font-semibold text-neutral-600 mb-2">Status</legend>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-neutral-100 rounded-xl">
                  {STEPS.map((s) => (
                    <button
                      type="button"
                      key={s.status}
                      onClick={() => setStatus(s.status)}
                      aria-pressed={status === s.status}
                      className={`py-2 rounded-lg text-xs font-semibold transition cursor-pointer disabled:cursor-not-allowed ${
                        status === s.status ? 'bg-white text-brand-800 shadow-xs ring-1 ring-brand-300' : 'text-neutral-600 hover:text-neutral-900'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                {partlySent && <p className="mt-2 text-[11px] text-neutral-500">Part of this line is already with QC; only quantities and colour can change.</p>}
              </fieldset>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-semibold text-neutral-600">Processed quantity (total)</span>
                  <div className="mt-1 flex items-center gap-1.5">
                    <input
                      type="number"
                      min={order.sentToQc1Quantity || 0}
                      max={received}
                      step="any"
                      value={dyedQuantity}
                      onChange={(e) => setDyedQuantity(e.target.value)}
                      className={`${FIELD} text-right tabular-nums`}
                    />
                    <span className="text-xs text-neutral-500">{order.uom}</span>
                  </div>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-neutral-600">Actual dyed colour</span>
                  <input value={dyedColor} onChange={(e) => setDyedColor(e.target.value)} placeholder={order.targetColor || ''} className={`${FIELD} mt-1`} />
                </label>
              </div>

              {mismatch && (
                <div className="rounded-xl border border-danger-200 bg-danger-50 p-3 space-y-2">
                  <p className="text-xs font-semibold text-danger-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    Dyed colour differs from the required colour ({order.targetColor}).
                  </p>
                  {alreadyReviewed ? (
                    <p className="text-xs text-neutral-700">
                      Reviewed by {order.colorReviewedBy?.fullName || '—'} on {fmtDate(order.colorReviewedAt, true)}: {order.colorReviewNote}
                    </p>
                  ) : (
                    <label className="block">
                      <span className="text-xs text-neutral-700">Review note (required before Ready for QC)</span>
                      <input value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} maxLength={500} className={`${FIELD} mt-1`} />
                    </label>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <label className="block">
                  <span className="text-xs font-semibold text-neutral-600">Batch</span>
                  <input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} maxLength={60} className={`${FIELD} mt-1`} />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-neutral-600">Machine</span>
                  <input value={machineNumber} onChange={(e) => setMachineNumber(e.target.value)} maxLength={60} className={`${FIELD} mt-1`} />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-neutral-600">Expected completion</span>
                  <input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} className={`${FIELD} mt-1`} />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-semibold text-neutral-600">Remarks</span>
                <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={500} rows={2} className={`${FIELD} h-auto py-2 mt-1`} />
              </label>
            </>
          )}

          {order.qcTransfers?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-neutral-600 mb-2">Transfers to Dyeing QC</h4>
              <ul className="space-y-1 text-xs">
                {order.qcTransfers.map((t: any) => (
                  <li key={t.id} className="flex justify-between gap-3 border-b border-neutral-100 pb-1">
                    <Link href={`/challans/${t.challan?.id}`} className="font-mono text-brand-800 hover:underline">{t.challan?.challanNumber}</Link>
                    <span className="tabular-nums">{fmtQty(t.quantity, t.uom)} · {t.actualDyedColor || '—'}</span>
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

export default function DyeingProcessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <ProcessContent />
    </Suspense>
  );
}
