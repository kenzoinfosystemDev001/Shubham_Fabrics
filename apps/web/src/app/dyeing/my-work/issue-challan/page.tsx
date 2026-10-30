'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus, Send, Trash2 } from 'lucide-react';
import { ChallanNumberField, newSubmissionKey } from '@/components/challan/ChallanNumberField';
import { IncomingChallanPicker, SheetBreakdown } from '@/components/challan/IncomingChallanPicker';
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
import { formatTotals, totalsByUnit } from '@/lib/challan-units.mjs';
import { NO_INCOMING_CHALLAN, challanSheetRefs, distinct, incomingChallanOptions } from '@/lib/challan-sheets.mjs';

const READY = ['DYED', 'READY_FOR_QC1', 'PARTIALLY_SENT_TO_QC1'];

interface Row {
  key: string;
  orderId: string;
  quantity: string;
  actualDyedColor: string;
  remarks: string;
}

const newRow = (): Row => ({ key: Math.random().toString(36).slice(2), orderId: '', quantity: '', actualDyedColor: '', remarks: '' });
const sourceOf = (o: any) => o.inboundChallanId || NO_INCOMING_CHALLAN;

function IssueChallanContent() {
  const params = useSearchParams();
  // A link may open this page for one incoming challan (?challanId=) or one sheet (?programId=, a filter).
  const sheetFilter = params.get('programId') || '';
  const [orders, setOrders] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceIds, setSourceIds] = useState<string[]>(() => (params.get('challanId') ? [params.get('challanId') as string] : []));
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
  const eligible = useMemo(
    () => orders.filter((o) => READY.includes(o.status) && availableForQc(o) > 0 && !needsColorReview(o) && (!sheetFilter || o.programId === sheetFilter)),
    [orders, sheetFilter],
  );
  const waitingReview = useMemo(() => orders.filter((o) => READY.includes(o.status) && needsColorReview(o)), [orders]);
  // Step 1: incoming challans with dyed lines still to send.
  const options = useMemo(() => incomingChallanOptions(eligible, availableForQc), [eligible]);
  // A selected challan that has nothing left any more is dropped from the selection.
  useEffect(() => {
    if (loading) return;
    setSourceIds((ids) => {
      const next = ids.filter((id) => options.some((o) => o.id === id));
      return next.length === ids.length ? ids : next;
    });
  }, [options, loading]);
  // Step 2: only lines of the selected incoming challans can be chosen.
  const selectable = eligible.filter((o) => sourceIds.includes(sourceOf(o)));
  const orderById = (id: string) => selectable.find((o) => o.id === id);
  const selectedOptions = options.filter((o) => sourceIds.includes(o.id));

  const chooseSources = (ids: string[]) => {
    setSourceIds(ids);
    // Lines of a challan that is no longer selected leave the form.
    setRows((rs) => {
      const kept = rs.filter((r) => !r.orderId || ids.includes(sourceOf(eligible.find((o) => o.id === r.orderId) || {})));
      return kept.length ? kept : [newRow()];
    });
  };

  const updateRow = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const chooseOrder = (key: string, orderId: string) => {
    const o = orderById(orderId);
    updateRow(key, { orderId, quantity: o ? String(availableForQc(o)) : '', actualDyedColor: o?.dyedColor || '' });
  };
  const addAllLines = () => {
    const taken = new Set(rows.map((r) => r.orderId));
    const added = selectable.filter((o) => !taken.has(o.id)).map((o) => ({ ...newRow(), orderId: o.id, quantity: String(availableForQc(o)), actualDyedColor: o.dyedColor || '' }));
    setRows((rs) => {
      const next = [...rs.filter((r) => r.orderId), ...added];
      return next.length ? next : [newRow()];
    });
  };

  const filled = rows.filter((r) => r.orderId);
  const totals = totalsByUnit(filled.map((r) => ({ quantity: Number(r.quantity) || 0, uom: orderById(r.orderId)?.uom })));
  const breakdownRows = filled
    .map((r) => ({ r, o: orderById(r.orderId) }))
    .filter((x) => x.o)
    .map(({ r, o }) => ({
      key: r.key,
      program: o.program,
      fabric: o.fabricName,
      colour: r.actualDyedColor || o.dyedColor || o.targetColor,
      quantity: Number(r.quantity) || 0,
      uom: o.uom,
      source: o.inboundChallan?.challanNumber || null,
    }));
  const chosenSheets = distinct(selectedOptions.flatMap((o) => o.sheets.map((s: any) => sheetRef(s))));

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
    if (sourceIds.length === 0) return setError('Select the incoming challan this challan is issued from.');
    if (!challanNumber.trim()) return setNumberError('Challan Number is required.');
    if (filled.length === 0) return setError('Add at least one item.');
    const over = filled.find((r) => {
      const o = orderById(r.orderId);
      return o && Number(r.quantity) > availableForQc(o);
    });
    if (over) return setError(`Requested quantity exceeds the available balance of ${orderById(over.orderId)?.orderNumber}.`);
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
          sourceChallanIds: sourceIds,
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

        <IncomingChallanPicker options={options} selected={sourceIds} onChange={chooseSources} loading={loading} availableLabel="Dyed, not sent" />

        <form onSubmit={submit} className="space-y-6">
          <Panel title="2. Challan">
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <ChallanNumberField value={challanNumber} onChange={setChallanNumber} error={numberError} />
              <label className="block">
                <span className="text-xs font-semibold text-neutral-600">Challan date</span>
                <input type="date" value={challanDate} onChange={(e) => setChallanDate(e.target.value)} required className={`${FIELD} mt-1`} />
              </label>
              <ReadOnly label="Incoming challans" value={selectedOptions.map((o) => o.challan?.challanNumber || 'Not recorded').join(', ') || '—'} />
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
              <ReadOnly label="Production Sheets" value={chosenSheets.join(', ') || '—'} />
              <ReadOnly label="Department incharge" value={incharge || '—'} />
              <label className="block sm:col-span-2 lg:col-span-4">
                <span className="text-xs font-semibold text-neutral-600">Remarks</span>
                <input value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={500} className={`${FIELD} mt-1`} />
              </label>
            </div>
          </Panel>

          <Panel
            title="3. Color / Fabric / Measurement"
            count={filled.length}
            actions={
              <div className="flex gap-2">
                <button type="button" onClick={addAllLines} disabled={selectable.length === 0 || filled.length >= selectable.length} className={BTN_SECONDARY}>
                  <span>Add all lines</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRows((rs) => [...rs, newRow()])}
                  disabled={selectable.length === 0 || rows.length >= selectable.length}
                  className={BTN_SECONDARY}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add item</span>
                </button>
              </div>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className={THEAD}>
                  <tr>
                    <th className="py-3 px-4 min-w-[200px]">Dyeing Line</th>
                    <th className="py-3 px-3">Production Sheet</th>
                    <th className="py-3 px-3">Incoming</th>
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
                  {sourceIds.length === 0 && <EmptyRow colSpan={12} text="Select an incoming challan above to add its dyed lines" />}
                  {sourceIds.length > 0 &&
                    rows.map((r) => {
                      const o = orderById(r.orderId);
                      const taken = new Set(rows.filter((x) => x.key !== r.key).map((x) => x.orderId));
                      const over = o && Number(r.quantity) > availableForQc(o);
                      return (
                        <tr key={r.key}>
                          <td className="py-2.5 px-4">
                            <select value={r.orderId} onChange={(e) => chooseOrder(r.key, e.target.value)} className={FIELD} aria-label="Dyeing line">
                              <option value="">Choose a dyed line</option>
                              {selectable.filter((x) => !taken.has(x.id)).map((x) => (
                                <option key={x.id} value={x.id}>
                                  {sheetRef(x.program)} · {x.orderNumber} · {x.fabricName} · {x.dyedColor || x.targetColor || '—'}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-xs">{o ? sheetRef(o.program) : '—'}</td>
                          <td className="py-2.5 px-3 font-mono text-xs text-neutral-600">{o?.inboundChallan?.challanNumber || '—'}</td>
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
                Total to transfer: <span className="font-semibold text-neutral-900 tabular-nums">{formatTotals(totals, '—')}</span>
              </span>
              <button type="submit" disabled={submitting || sourceIds.length === 0} className={BTN_PRIMARY}>
                <Send className="w-3.5 h-3.5" />
                <span>{submitting ? 'Issuing…' : 'Issue Challan'}</span>
              </button>
            </div>
          </Panel>

          <SheetBreakdown title="4. Review: Production Sheet breakdown" rows={breakdownRows} />
        </form>

        <Panel title="Recent Challans to Dyeing QC" count={recent.length}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className={THEAD}>
                <tr>
                  <th className="py-3 px-4">Challan</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Production Sheets</th>
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
                    <td className="py-3 px-3 font-mono text-xs">{challanSheetRefs(c)}</td>
                    <td className="py-3 px-3 font-mono text-xs text-neutral-600">{c.parentChallan?.challanNumber || '—'}</td>
                    <td className="py-3 px-3 text-xs text-neutral-700">
                      {(c.items || []).map((i: any) => i.colour || i.itemDescription).join(', ') || '—'}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">
                      {formatTotals(totalsByUnit(c.items || []), '—')}
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
      <div className="mt-1 h-9 px-3 flex items-center bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-700 truncate" title={value}>{value}</div>
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
