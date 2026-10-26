'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus, Send, Trash2 } from 'lucide-react';
import { ChallanNumberField, newSubmissionKey } from '@/components/challan/ChallanNumberField';
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  DocumentsButton,
  EmptyRow,
  FIELD,
  Notice,
  PageHeader,
  Panel,
  THEAD,
  baseColour,
  fetchJson,
  fmtDate,
  fmtQty,
  sheetRef,
} from '@/components/dyeing/DyeingUi';
import { availableForQc, needsColorReview } from '@/lib/dyeing-workflow.mjs';

const READY = ['DYED', 'READY_FOR_QC1', 'PARTIALLY_SENT_TO_QC1'];

interface Row {
  key: string;
  orderId: string;
  quantity: string;
  actualDyedColor: string;
  remarks: string;
}

const newRow = (): Row => ({ key: Math.random().toString(36).slice(2), orderId: '', quantity: '', actualDyedColor: '', remarks: '' });

function IssueChallanContent() {
  const params = useSearchParams();
  const [orders, setOrders] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [programId, setProgramId] = useState(params.get('programId') || '');
  const [challanNumber, setChallanNumber] = useState('');
  const [numberError, setNumberError] = useState<string | null>(null);
  const [challanDate, setChallanDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [priority, setPriority] = useState('');
  const [remarks, setRemarks] = useState('');
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [submissionKey, setSubmissionKey] = useState(newSubmissionKey);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<any | null>(null);
  const [incharge, setIncharge] = useState('');

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('subham_mes_user') || 'null');
      setIncharge(u?.fullName || u?.username || '');
    } catch {}
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [o, r] = await Promise.all([fetchJson('/api/dyeing/orders?qcReady=1'), fetchJson('/api/dyeing/qc-challans')]);
      setOrders(o.data || []);
      setRecent(r.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  // Lines that may go to QC now: completed or ready, something left to send, colour reviewed if needed.
  const eligible = useMemo(() => orders.filter((o) => READY.includes(o.status) && availableForQc(o) > 0 && !needsColorReview(o)), [orders]);
  const waitingReview = useMemo(() => orders.filter((o) => READY.includes(o.status) && needsColorReview(o)), [orders]);
  const sheets = useMemo(() => {
    const map = new Map<string, any>();
    for (const o of eligible) if (o.program) map.set(o.program.id, o.program);
    return Array.from(map.values());
  }, [eligible]);
  const program = sheets.find((p) => p.id === programId) || null;
  const sheetOrders = eligible.filter((o) => o.programId === programId);
  const orderById = (id: string) => sheetOrders.find((o) => o.id === id);

  useEffect(() => {
    if (!programId && sheets.length === 1) setProgramId(sheets[0].id);
  }, [sheets, programId]);

  const updateRow = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const chooseOrder = (key: string, orderId: string) => {
    const o = orderById(orderId);
    updateRow(key, { orderId, quantity: o ? String(availableForQc(o)) : '', actualDyedColor: o?.dyedColor || '' });
  };

  const filled = rows.filter((r) => r.orderId);
  const units = new Set(filled.map((r) => orderById(r.orderId)?.uom));
  const totals = filled.reduce<Record<string, number>>((acc, r) => {
    const o = orderById(r.orderId);
    if (o) acc[o.uom] = (acc[o.uom] || 0) + (Number(r.quantity) || 0);
    return acc;
  }, {});

  const resetForm = () => {
    setChallanNumber('');
    setRows([newRow()]);
    setRemarks('');
    setSubmissionKey(newSubmissionKey());
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNumberError(null);
    if (!program) return setError('Choose a Production Sheet.');
    if (!challanNumber.trim()) return setNumberError('Challan Number is required.');
    if (filled.length === 0) return setError('Add at least one item.');
    if (units.size > 1) return setError('Meters and pieces cannot be mixed on one challan.');
    setSubmitting(true);
    try {
      const body = await fetchJson('/api/dyeing/qc-challans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: submissionKey,
          challanNumber: challanNumber.trim(),
          issuedDate: challanDate,
          priority: priority || undefined,
          remarks,
          lines: filled.map((r) => ({ orderId: r.orderId, quantity: r.quantity, actualDyedColor: r.actualDyedColor, remarks: r.remarks })),
        }),
      });
      setIssued(body.data);
      resetForm();
      load();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      if (err.body?.field === 'challanNumber') setNumberError(err.message);
      else setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <PageHeader title="Issue Challan to Dyeing QC" loading={loading} onRefresh={load} />

      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {issued && (
          <Notice kind="success" onClose={() => setIssued(null)}>
            <div className="flex flex-wrap items-center gap-3">
              <span>
                Challan <span className="font-mono font-semibold">{issued.challanNumber}</span> issued to Dyeing QC.
              </span>
              <DocumentsButton programId={issued.programId} challanId={issued.id} />
            </div>
          </Notice>
        )}
        {error && <Notice kind="error" onClose={() => setError(null)}>{error}</Notice>}
        {waitingReview.length > 0 && (
          <Notice kind="error">
            {waitingReview.length} completed line{waitingReview.length === 1 ? '' : 's'} need a colour review before transfer.{' '}
            <Link href="/dyeing/my-work/process?status=DYED,READY_FOR_QC1" className="font-semibold underline">Review in Dyeing Process</Link>
          </Notice>
        )}

        <form onSubmit={submit} className="space-y-6">
          <Panel title="Challan">
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <ChallanNumberField value={challanNumber} onChange={setChallanNumber} error={numberError} />
              <label className="block">
                <span className="text-xs font-semibold text-neutral-600">Challan date</span>
                <input type="date" value={challanDate} onChange={(e) => setChallanDate(e.target.value)} required className={`${FIELD} mt-1`} />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-neutral-600">Production Sheet</span>
                <select
                  value={programId}
                  onChange={(e) => {
                    setProgramId(e.target.value);
                    setRows([newRow()]);
                  }}
                  className={`${FIELD} mt-1`}
                  required
                >
                  <option value="">{sheets.length ? 'Choose a sheet' : 'No dyed fabric ready'}</option>
                  {sheets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {sheetRef(p)}{p.designNumber ? ` · ${p.designNumber}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-neutral-600">Priority</span>
                <select value={priority} onChange={(e) => setPriority(e.target.value)} className={`${FIELD} mt-1`}>
                  <option value="">Same as sheet</option>
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </label>
              <ReadOnly label="Source" value="Dyeing" />
              <ReadOnly label="Destination" value="Dyeing QC" />
              <ReadOnly label="Design / Serial" value={program ? `${program.designNumber || program.wilcomDesignNumber || '—'} · ${program.programSerialNo || '—'}` : '—'} />
              <ReadOnly label="Delivery date" value={program ? fmtDate(program.deliveryDate) : '—'} />
              <ReadOnly label="Department incharge" value={incharge || '—'} />
              <label className="block sm:col-span-2 lg:col-span-3">
                <span className="text-xs font-semibold text-neutral-600">Remarks</span>
                <input value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={500} className={`${FIELD} mt-1`} />
              </label>
            </div>
          </Panel>

          <Panel
            title="Color / Fabric / Measurement"
            count={filled.length}
            actions={
              <button
                type="button"
                onClick={() => setRows((rs) => [...rs, newRow()])}
                disabled={!program || rows.length >= sheetOrders.length}
                className={BTN_SECONDARY}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add item</span>
              </button>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className={THEAD}>
                  <tr>
                    <th className="py-3 px-4 min-w-[200px]">Dyeing Line</th>
                    <th className="py-3 px-3">Colour</th>
                    <th className="py-3 px-3">Fabric</th>
                    <th className="py-3 px-3">Required Dye Colour</th>
                    <th className="py-3 px-3 min-w-[150px]">Actual Dyed Colour</th>
                    <th className="py-3 px-3 text-right">Available</th>
                    <th className="py-3 px-3 min-w-[130px] text-right">Transfer Qty</th>
                    <th className="py-3 px-3">Unit</th>
                    <th className="py-3 px-3 min-w-[140px]">Remarks</th>
                    <th className="py-3 px-3"><span className="sr-only">Remove</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {!program && <EmptyRow colSpan={10} text="Choose a Production Sheet to add items" />}
                  {program &&
                    rows.map((r) => {
                      const o = orderById(r.orderId);
                      const taken = new Set(rows.filter((x) => x.key !== r.key).map((x) => x.orderId));
                      const over = o && Number(r.quantity) > availableForQc(o);
                      return (
                        <tr key={r.key}>
                          <td className="py-2.5 px-4">
                            <select value={r.orderId} onChange={(e) => chooseOrder(r.key, e.target.value)} className={FIELD} aria-label="Dyeing line">
                              <option value="">Choose a dyed line</option>
                              {sheetOrders.filter((x) => !taken.has(x.id)).map((x) => (
                                <option key={x.id} value={x.id}>
                                  {x.orderNumber} · {x.fabricName} · {x.dyedColor || x.targetColor || '—'}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5 px-3 text-neutral-700">{o ? baseColour(o) || '—' : '—'}</td>
                          <td className="py-2.5 px-3 font-semibold text-neutral-900">{o?.fabricName || '—'}</td>
                          <td className="py-2.5 px-3 text-brand-900">{o?.targetColor || '—'}</td>
                          <td className="py-2.5 px-3">
                            <input
                              value={r.actualDyedColor}
                              onChange={(e) => updateRow(r.key, { actualDyedColor: e.target.value })}
                              readOnly={Boolean(o?.dyedColor)}
                              required={Boolean(o)}
                              className={`${FIELD} ${o?.dyedColor ? 'bg-neutral-50' : ''}`}
                              aria-label="Actual dyed colour"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{o ? fmtQty(availableForQc(o), o.uom) : '—'}</td>
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              min="0.001"
                              step="any"
                              max={o ? availableForQc(o) : undefined}
                              value={r.quantity}
                              onChange={(e) => updateRow(r.key, { quantity: e.target.value })}
                              disabled={!o}
                              required={Boolean(o)}
                              className={`${FIELD} text-right tabular-nums ${over ? 'border-danger-500' : ''}`}
                              aria-label="Quantity to transfer"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-xs font-semibold">{o?.uom || '—'}</td>
                          <td className="py-2.5 px-3">
                            <input value={r.remarks} onChange={(e) => updateRow(r.key, { remarks: e.target.value })} maxLength={300} className={FIELD} aria-label="Remarks" />
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : [newRow()]))}
                              className="p-2 text-neutral-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg"
                              aria-label="Remove item"
                              title="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-4 border-t border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-sm text-neutral-600">
                Total to transfer:{' '}
                <span className="font-semibold text-neutral-900 tabular-nums">
                  {Object.entries(totals).map(([u, q]) => fmtQty(q, u)).join(' · ') || '—'}
                </span>
                {units.size > 1 && <span className="ml-2 text-danger-700 font-semibold">Mixed units</span>}
              </span>
              <button type="submit" disabled={submitting || !program} className={BTN_PRIMARY}>
                <Send className="w-3.5 h-3.5" />
                <span>{submitting ? 'Issuing…' : 'Issue Challan'}</span>
              </button>
            </div>
          </Panel>
        </form>

        <Panel title="Recent Challans to Dyeing QC" count={recent.length}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className={THEAD}>
                <tr>
                  <th className="py-3 px-4">Challan</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Production Sheet</th>
                  <th className="py-3 px-3">Incoming Challan</th>
                  <th className="py-3 px-3">Items</th>
                  <th className="py-3 px-3 text-right">Quantity</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3"><span className="sr-only">Documents</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {!loading && recent.length === 0 && <EmptyRow colSpan={8} text="No challans issued yet" />}
                {recent.slice(0, 15).map((c) => (
                  <tr key={c.id} className="hover:bg-neutral-50/60">
                    <td className="py-3 px-4 font-mono text-xs font-bold text-brand-800">
                      <Link href={`/challans/${c.id}`} className="hover:underline">{c.challanNumber}</Link>
                    </td>
                    <td className="py-3 px-3 text-xs text-neutral-600">{fmtDate(c.issuedDate || c.createdAt)}</td>
                    <td className="py-3 px-3 font-mono text-xs">{sheetRef(c.program)}</td>
                    <td className="py-3 px-3 font-mono text-xs text-neutral-600">{c.parentChallan?.challanNumber || '—'}</td>
                    <td className="py-3 px-3 text-xs text-neutral-700">
                      {(c.items || []).map((i: any) => i.colour || i.itemDescription).join(', ') || '—'}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">
                      {fmtQty((c.items || []).reduce((s: number, i: any) => s + (Number(i.quantity) || 0), 0), c.items?.[0]?.uom)}
                    </td>
                    <td className="py-3 px-3 text-xs">{String(c.status || '').replace(/_/g, ' ')}</td>
                    <td className="py-3 px-3 text-right"><DocumentsButton programId={c.programId} challanId={c.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </main>
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs font-semibold text-neutral-600">{label}</span>
      <div className="mt-1 h-9 px-3 flex items-center bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-700 truncate">{value}</div>
    </div>
  );
}

export default function DyeingIssueChallanPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <IssueChallanContent />
    </Suspense>
  );
}
