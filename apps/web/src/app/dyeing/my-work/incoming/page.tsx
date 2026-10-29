'use client';

import React, { useEffect, useState } from 'react';
import { departmentName } from '@/lib/workflow-views';
import Link from 'next/link';
import { ChevronDown, ChevronRight, PackageCheck, Search, X } from 'lucide-react';
import {
  BTN_PRIMARY,
  BTN_QUIET,
  ChallanBarcode,
  DeadlineText,
  DocumentsButton,
  EmptyRow,
  FIELD,
  Notice,
  PageHeader,
  Panel,
  PriorityBadge,
  StatusBadge,
  THEAD,
  fetchJson,
  fmtDate,
  fmtQty,
  sheetRef,
} from '@/components/dyeing/DyeingUi';

type View = 'pending' | 'received' | 'all';
const VIEWS: Array<{ id: View; label: string }> = [
  { id: 'pending', label: 'To Receive' },
  { id: 'received', label: 'Received' },
  { id: 'all', label: 'All' },
];

/** Totals per unit, e.g. "120 MTR · 40 PCS". */
function totalsByUnit(orders: any[], pick: (o: any) => number) {
  const totals: Record<string, number> = {};
  for (const o of orders) totals[o.uom] = (totals[o.uom] || 0) + (pick(o) || 0);
  return Object.entries(totals).map(([u, q]) => fmtQty(q, u)).join(' · ') || '—';
}

export default function DyeingIncomingChallansPage() {
  const [view, setView] = useState<View>('pending');
  const [search, setSearch] = useState('');
  const [challans, setChallans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [receiving, setReceiving] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ view });
      if (search.trim()) params.set('search', search.trim());
      const body = await fetchJson(`/api/dyeing/challans?${params}`);
      setChallans(body.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <PageHeader title="Incoming Challans" loading={loading} onRefresh={load} />

      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {error && <Notice kind="error" onClose={() => setError(null)}>{error}</Notice>}
        {success && <Notice kind="success" onClose={() => setSuccess(null)}>{success}</Notice>}

        <Panel
          title="Store to Dyeing Challans"
          count={challans.length}
          actions={
            <>
              <div role="tablist" className="inline-flex p-0.5 bg-neutral-100 rounded-lg">
                {VIEWS.map((v) => (
                  <button
                    key={v.id}
                    role="tab"
                    aria-selected={view === v.id}
                    onClick={() => setView(v.id)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                      view === v.id ? 'bg-white text-brand-800 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
                    }`}
                  >
                    {v.label}
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
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Challan, sheet or design"
                  aria-label="Search challans"
                  className={`${FIELD} pl-9 md:w-64`}
                />
              </form>
            </>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className={THEAD}>
                <tr>
                  <th className="py-3 pl-4 pr-2 w-8" />
                  <th className="py-3 px-3">Challan</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">From / To</th>
                  <th className="py-3 px-3">Priority</th>
                  <th className="py-3 px-3">Production Sheet</th>
                  <th className="py-3 px-3">Design</th>
                  <th className="py-3 px-3">Delivery</th>
                  <th className="py-3 px-3 text-right">Expected</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {!loading && challans.length === 0 && (
                  <EmptyRow colSpan={11} text={view === 'pending' ? 'No challans waiting to be received' : 'No challans found'} />
                )}
                {challans.map((ch) => {
                  const orders: any[] = ch.dyeingInboundOrders || [];
                  const awaiting = orders.filter((o) => o.status === 'AWAITING_RECEIPT');
                  const open = expanded === ch.id;
                  return (
                    <React.Fragment key={ch.id}>
                      <tr className="hover:bg-neutral-50/60">
                        <td className="py-3 pl-4 pr-2">
                          <button
                            onClick={() => setExpanded(open ? null : ch.id)}
                            className="p-1 text-neutral-400 hover:text-neutral-900 rounded"
                            aria-label={open ? 'Hide items' : 'Show items'}
                            aria-expanded={open}
                          >
                            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <Link href={`/challans/${ch.id}`} className="font-mono text-xs font-bold text-brand-800 hover:underline">
                            {ch.challanNumber}
                          </Link>
                          {ch.challanType === 'REWORK_RETURN' && <span className="ml-2 text-[11px] font-semibold text-danger-700">Rework</span>}
                        </td>
                        <td className="py-3 px-3 text-xs text-neutral-600 whitespace-nowrap">{fmtDate(ch.issuedDate || ch.createdAt)}</td>
                        <td className="py-3 px-3 text-xs text-neutral-700 whitespace-nowrap">
                          {departmentName(ch.fromDepartment)} to {departmentName(ch.toDepartment)}
                        </td>
                        <td className="py-3 px-3"><PriorityBadge priority={ch.priority} /></td>
                        <td className="py-3 px-3">
                          {ch.program ? (
                            <Link href={`/programs/${ch.program.id}`} className="font-mono text-xs font-semibold text-neutral-900 hover:underline">
                              {sheetRef(ch.program)}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3 px-3 text-xs text-neutral-700">{ch.program?.designNumber || ch.program?.wilcomDesignNumber || '—'}</td>
                        <td className="py-3 px-3 text-xs whitespace-nowrap"><DeadlineText program={ch.program} /></td>
                        <td className="py-3 px-3 text-right text-xs font-semibold tabular-nums whitespace-nowrap">
                          {totalsByUnit(orders, (o) => o.requiredQuantity)}
                        </td>
                        <td className="py-3 px-3">
                          {awaiting.length > 0 ? (
                            <StatusBadge status="AWAITING_RECEIPT" />
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold bg-accent-100 text-neutral-900">Received</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center justify-end gap-2">
                            <DocumentsButton programId={ch.program?.id} challanId={ch.id} />
                            {awaiting.length > 0 && (
                              <button onClick={() => setReceiving(ch)} className={BTN_PRIMARY}>
                                <PackageCheck className="w-3.5 h-3.5" />
                                <span>Receive</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {open && (
                        <tr className="bg-neutral-50/60">
                          <td colSpan={11} className="px-4 sm:px-6 py-4">
                            <div className="flex flex-col lg:flex-row gap-5">
                              <div className="shrink-0 space-y-2">
                                <ChallanBarcode value={ch.challanNumber} />
                                <p className="text-[11px] text-neutral-500">
                                  Issued by {ch.issuedBy?.fullName || ch.createdBy?.fullName || '—'}
                                  {ch.receivedBy ? ` · Received by ${ch.receivedBy.fullName} on ${fmtDate(ch.receivedDate, true)}` : ''}
                                </p>
                              </div>
                              <div className="flex-1 overflow-x-auto">
                                <table className="w-full text-left text-xs bg-white border border-neutral-200 rounded-xl overflow-hidden">
                                  <thead className={THEAD}>
                                    <tr>
                                      <th className="py-2.5 px-3">Dyeing Ref</th>
                                      <th className="py-2.5 px-3">Fabric</th>
                                      <th className="py-2.5 px-3">Colour</th>
                                      <th className="py-2.5 px-3">Required Dye Colour</th>
                                      <th className="py-2.5 px-3 text-right">Expected</th>
                                      <th className="py-2.5 px-3 text-right">Received</th>
                                      <th className="py-2.5 px-3">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-neutral-100">
                                    {orders.map((o) => {
                                      const item = (ch.items || []).find((i: any) => i.id === o.inboundChallanItemId);
                                      return (
                                        <tr key={o.id}>
                                          <td className="py-2.5 px-3 font-mono text-neutral-600">{o.orderNumber}</td>
                                          <td className="py-2.5 px-3 font-semibold text-neutral-900">{o.fabricName}</td>
                                          <td className="py-2.5 px-3">{item?.colour || '—'}</td>
                                          <td className="py-2.5 px-3 font-semibold text-brand-900">{o.targetColor || '—'}</td>
                                          <td className="py-2.5 px-3 text-right tabular-nums">{fmtQty(o.requiredQuantity, o.uom)}</td>
                                          <td className="py-2.5 px-3 text-right tabular-nums">
                                            {o.status === 'AWAITING_RECEIPT' ? '—' : fmtQty(o.receivedQuantity ?? o.requiredQuantity, o.uom)}
                                            {o.receiptRemarks && <span className="block text-[11px] text-danger-700">{o.receiptRemarks}</span>}
                                          </td>
                                          <td className="py-2.5 px-3"><StatusBadge status={o.status} /></td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </main>

      {receiving && (
        <ReceiveDialog
          challan={receiving}
          onClose={() => setReceiving(null)}
          onDone={(message) => {
            setReceiving(null);
            setSuccess(message);
            load();
          }}
        />
      )}
    </div>
  );
}

function ReceiveDialog({ challan, onClose, onDone }: { challan: any; onClose: () => void; onDone: (message: string) => void }) {
  const lines: any[] = (challan.dyeingInboundOrders || []).filter((o: any) => o.status === 'AWAITING_RECEIPT');
  const [values, setValues] = useState<Record<string, { qty: string; remarks: string }>>(() =>
    Object.fromEntries(lines.map((o) => [o.id, { qty: o.requiredQuantity ? String(o.requiredQuantity) : '', remarks: '' }])),
  );
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = await fetchJson(`/api/dyeing/challans/${challan.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          remarks,
          lines: lines.map((o) => ({ orderId: o.id, receivedQuantity: values[o.id].qty, remarks: values[o.id].remarks })),
        }),
      });
      onDone(body.message);
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-neutral-900/50 p-3 overflow-y-auto" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="bg-white rounded-2xl shadow-xl border border-neutral-200 w-full max-w-3xl">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-neutral-900">Receive Fabric</h3>
            <p className="text-xs text-neutral-500 font-mono">{challan.challanNumber} · {sheetRef(challan.program)}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-neutral-500 hover:bg-neutral-100 rounded-lg" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && <Notice kind="error">{error}</Notice>}
          <div className="overflow-x-auto border border-neutral-200 rounded-xl">
            <table className="w-full text-left text-sm">
              <thead className={THEAD}>
                <tr>
                  <th className="py-2.5 px-3">Fabric</th>
                  <th className="py-2.5 px-3">Required Colour</th>
                  <th className="py-2.5 px-3 text-right">Expected</th>
                  <th className="py-2.5 px-3 w-36">Received</th>
                  <th className="py-2.5 px-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {lines.map((o) => {
                  const v = values[o.id];
                  const diff = Math.round(((Number(v.qty) || 0) - o.requiredQuantity) * 1000) / 1000;
                  return (
                    <tr key={o.id}>
                      <td className="py-2.5 px-3 font-semibold text-neutral-900">{o.fabricName}</td>
                      <td className="py-2.5 px-3 text-brand-900">{o.targetColor || '—'}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-neutral-600">{fmtQty(o.requiredQuantity, o.uom)}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            required
                            value={v.qty}
                            onChange={(e) => setValues({ ...values, [o.id]: { ...v, qty: e.target.value } })}
                            className={`${FIELD} text-right tabular-nums`}
                            aria-label={`Received quantity for ${o.fabricName}`}
                          />
                          <span className="text-xs text-neutral-500">{o.uom}</span>
                        </div>
                        {v.qty !== '' && diff !== 0 && (
                          <span className={`block mt-1 text-[11px] font-semibold ${diff < 0 ? 'text-danger-700' : 'text-brand-800'}`}>
                            {diff < 0 ? `Short ${fmtQty(-diff, o.uom)}` : `Excess ${fmtQty(diff, o.uom)}`}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          value={v.remarks}
                          onChange={(e) => setValues({ ...values, [o.id]: { ...v, remarks: e.target.value } })}
                          maxLength={300}
                          className={FIELD}
                          aria-label={`Remarks for ${o.fabricName}`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-neutral-600">Challan remarks</span>
            <input value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={500} className={`${FIELD} mt-1`} />
          </label>
        </div>

        <div className="px-5 py-4 border-t border-neutral-200 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={BTN_QUIET}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={BTN_PRIMARY}>
            {saving ? 'Saving…' : 'Confirm Receipt'}
          </button>
        </div>
      </form>
    </div>
  );
}
