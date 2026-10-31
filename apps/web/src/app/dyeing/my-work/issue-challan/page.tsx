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
import { formatTotals, totalsByUnit } from '@/lib/challan-units.mjs';
import { StockItemsSection, newStockFabric, stockLinesOf, type StockFabric, type StockSource } from '@/components/challan/StockItemsSection';
import { ProductionSheetQuickView } from '@/components/challan/ProductionSheetQuickView';
import { IncomingChallanPicker, SheetBreakdown } from '@/components/challan/IncomingChallanPicker';
import { NO_INCOMING_CHALLAN, challanSheetRefs, distinct, incomingChallanOptions } from '@/lib/challan-sheets.mjs';

const sourceOf = (o: any) => o.inboundChallanId || NO_INCOMING_CHALLAN;

const READY = ['DYED', 'READY_FOR_QC1', 'PARTIALLY_SENT_TO_QC1'];

function IssueChallanContent() {
  const params = useSearchParams();
  const [orders, setOrders] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // A link may open this page for one incoming challan (?challanId=) or one sheet (?programId=, a filter).
  const sheetFilter = params.get('programId') || '';
  const [sourceIds, setSourceIds] = useState<string[]>(() => (params.get('challanId') ? [params.get('challanId') as string] : []));
  const [challanNumber, setChallanNumber] = useState('');
  const [numberError, setNumberError] = useState<string | null>(null);
  const [challanDate, setChallanDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [priority, setPriority] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submissionKey, setSubmissionKey] = useState(newSubmissionKey);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<any | null>(null);
  // Typed by the user (e.g. the incharge on duty); left empty, the challan shows the issuing account.
  const [incharge, setIncharge] = useState('');

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
  // Step 1: incoming challans with dyed lines still to send. Nothing is selected for the user.
  const options = useMemo(() => incomingChallanOptions(eligible, availableForQc), [eligible]);
  // A selected challan that has nothing left any more is dropped from the selection.
  useEffect(() => {
    if (loading) return;
    setSourceIds((ids) => {
      const next = ids.filter((id) => options.some((o) => o.id === id));
      return next.length === ids.length ? ids : next;
    });
  }, [options, loading]);
  const selectedOptions = options.filter((o) => sourceIds.includes(o.id));
  const hasSource = sourceIds.length > 0;
  // Step 2: only dyed lines of the selected incoming challans (of any Production Sheet on them).
  const sheetOrders = eligible.filter((o) => sourceIds.includes(sourceOf(o)));
  const orderById = (id: string) => sheetOrders.find((o) => o.id === id);
  const chosenSheets = distinct(selectedOptions.flatMap((o) => o.sheets.map((s: any) => sheetRef(s))));
  // Items section: each colour is a dyed line (colour as recorded in Dyeing Process).
  const [fabrics, setFabrics] = useState<StockFabric[]>([newStockFabric()]);
  const colourOf = (o: any) => o.dyedColor || o.targetColor || '';
  const sources: StockSource[] = sheetOrders.map((o) => ({
    id: o.id,
    fabric: o.fabricName,
    colour: colourOf(o),
    uom: o.uom,
    available: availableForQc(o),
    // Each dyed line names its Production Sheet and incoming challan.
    detail: [
      `Sheet ${sheetRef(o.program)}`,
      o.inboundChallan?.challanNumber ? `Challan ${o.inboundChallan.challanNumber}` : '',
      baseColour(o) ? `Base ${baseColour(o)}` : '',
      o.targetColor && o.targetColor !== colourOf(o) ? `Required ${o.targetColor}` : '',
    ].filter(Boolean).join(' · '),
  }));
  const itemsCheck = stockLinesOf(fabrics, sources);
  const itemLines = 'lines' in itemsCheck ? itemsCheck.lines : [];
  const breakdownRows = itemLines
    .map((l, index) => ({ l, index, o: orderById(l.sourceId) }))
    .filter((x) => x.o)
    .map(({ l, index, o }) => ({
      key: `${l.sourceId}-${index}`,
      program: o.program,
      fabric: o.fabricName,
      colour: colourOf(o),
      quantity: l.quantity,
      uom: o.uom,
      source: o.inboundChallan?.challanNumber || null,
    }));
  const chooseSources = (ids: string[]) => {
    setSourceIds(ids);
    setFabrics([newStockFabric()]);
  };

  const totals = itemLines.reduce<Record<string, number>>((acc, l) => {
    const o = orderById(l.sourceId);
    if (o) acc[o.uom] = (acc[o.uom] || 0) + l.quantity;
    return acc;
  }, {});

  const resetForm = () => {
    setChallanNumber('');
    setFabrics([newStockFabric()]);
    setRemarks('');
    setSubmissionKey(newSubmissionKey());
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNumberError(null);
    if (!hasSource) return setError('Select the incoming challan this challan is issued from.');
    if (!challanNumber.trim()) return setNumberError('Challan Number is required.');
    if ('error' in itemsCheck) return setError(itemsCheck.error);
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
          inchargeName: incharge.trim(),
          sourceChallanIds: sourceIds,
          lines: itemLines.map((l) => ({
            orderId: l.sourceId,
            quantity: l.quantity,
            actualDyedColor: colourOf(orderById(l.sourceId)),
            average: l.average,
            averageUnit: l.averageUnit,
            unitQuantity: l.unitQuantity,
            unitQuantityUom: l.unitQuantityUom,
            remarks: l.remarks,
          })),
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
        <ProductionSheetQuickView
          sheets={(selectedOptions.length ? selectedOptions : options).flatMap((o) => o.sheets)}
          title={selectedOptions.length ? "Production Sheet" : "Production Sheets with work to issue"}
          emptyText="No Production Sheet has anything to issue yet."
        />
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
              <label className="block">
                <span className="text-xs font-semibold text-neutral-600">Department incharge</span>
                <input value={incharge} onChange={(e) => setIncharge(e.target.value)} maxLength={100} placeholder="Incharge name" className={`${FIELD} mt-1`} />
              </label>
              <label className="block sm:col-span-2 lg:col-span-4">
                <span className="text-xs font-semibold text-neutral-600">Remarks</span>
                <input value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={500} className={`${FIELD} mt-1`} />
              </label>
            </div>
          </Panel>

          <Panel title="3. Color / Fabric / Measurement" count={itemLines.length}>
            <div className="p-5">
              {hasSource ? (
                <StockItemsSection sources={sources} value={fabrics} onChange={setFabrics} />
              ) : (
                <p className="text-sm text-neutral-500">Select an incoming challan above to add its dyed lines.</p>
              )}
            </div>
            <div className="px-5 py-4 border-t border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-sm text-neutral-600">
                Total to transfer:{' '}
                <span className="font-semibold text-neutral-900 tabular-nums">
                  {Object.entries(totals).map(([u, q]) => fmtQty(q, u)).join(' · ') || '—'}
                </span>
              </span>
              <button type="submit" disabled={submitting || !hasSource} className={BTN_PRIMARY}>
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
