'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PackageCheck } from 'lucide-react';
import { DeadlineAlertsPanel } from '@/components/alerts/DeadlineAlertsPanel';
import {
  BTN_PRIMARY,
  BTN_QUIET,
  BTN_SECONDARY,
  DeadlineText,
  DocumentsButton,
  EmptyRow,
  FIELD,
  Notice,
  PageHeader,
  Panel,
  PriorityBadge,
  THEAD,
  fetchJson,
  fmtDate,
  sheetRef,
} from '@/components/workflow/WorkflowUi';
import { ALLOCATION_STATUS_LABEL, LEDGER, LEDGER_LABEL } from '@/lib/inventory.mjs';
import {
  API,
  AllocationStatusBadge,
  CategorySelect,
  DesignCell,
  GarmentImage,
  PackingActionDialog,
  PackingActions,
  Pager,
  RecordDrawer,
  ledgerLabel,
  pcs,
} from '@/components/inventory/InventoryUi';
import { RecordsBrowser } from '@/components/inventory/InventoryRecords';
import { departmentName } from '@/lib/workflow-views';

function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: Array<{ id: T; label: string }> }) {
  return (
    <div role="tablist" className="inline-flex p-0.5 bg-neutral-100 rounded-lg">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${value === t.id ? 'bg-white text-brand-800 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------------------------

export function InventoryDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alertsKey, setAlertsKey] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const body = await fetchJson(`${API}/dashboard`);
      setData(body.data);
      setAlertsKey((k) => k + 1);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const t = data?.totals;
  const c = data?.counts;
  const cards: Array<{ label: string; value: string | number; sub?: string; href: string; danger?: boolean }> = [
    { label: 'Total Garments Received', value: pcs(t?.received), sub: `${c?.records ?? 0} records`, href: '/inventory/stock' },
    { label: 'Ready for Packing', value: pcs(t?.available), sub: `${c?.readyRecords ?? 0} records`, href: '/inventory/packing' },
    { label: 'Sent for Packing', value: pcs(t?.sentForPacking), sub: 'Not started yet', href: '/inventory/packing?view=references' },
    { label: 'Being Packed', value: pcs(t?.beingPacked), sub: `${c?.openAllocations ?? 0} open references`, href: '/inventory/packing?view=references' },
    { label: 'Partially Packed', value: c?.partiallyPackedRecords ?? 0, sub: `${c?.partiallyPackedAllocations ?? 0} references part-packed`, href: '/inventory/stock' },
    { label: 'Fully Packed', value: pcs(t?.packed), sub: `${c?.packedRecords ?? 0} records completed`, href: '/inventory/stock' },
    { label: 'Remaining to Pack', value: pcs(t?.remaining), href: '/inventory/packing' },
    { label: 'Awaiting Receipt', value: c?.pendingChallans ?? 0, sub: `${pcs(t?.awaitingReceipt)} dispatched`, href: '/inventory/received' },
    { label: 'Overdue Work', value: c?.overdue ?? 0, href: '/inventory/packing', danger: (c?.overdue || 0) > 0 },
  ];

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <PageHeader title="Inventory" loading={loading} onRefresh={load}>
        <Link href="/inventory/received" className={BTN_SECONDARY}>Receive Finished Garments</Link>
        <Link href="/inventory/packing" className={BTN_PRIMARY}>Packing Management</Link>
      </PageHeader>
      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {error && <Notice kind="error" onClose={() => setError(null)}>{error}</Notice>}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-9 gap-3">
          {cards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className={`group bg-white border rounded-2xl px-4 py-3.5 shadow-xs transition hover:shadow-sm ${card.danger ? 'border-danger-300 hover:border-danger-500' : 'border-neutral-200 hover:border-brand-300'}`}
            >
              <p className={`text-lg leading-tight font-bold tabular-nums ${card.danger ? 'text-danger-600' : 'text-neutral-900'}`}>{loading && !data ? '…' : card.value}</p>
              <p className="text-xs font-medium text-neutral-500 mt-2">{card.label}</p>
              {card.sub && <p className="text-[11px] text-neutral-500 tabular-nums mt-0.5">{card.sub}</p>}
            </Link>
          ))}
        </section>

        <DeadlineAlertsPanel department="INVENTORY" refreshKey={alertsKey} />

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Panel title="Packing In Hand" count={data?.pendingPacking?.length}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className={THEAD}>
                  <tr>
                    <th className="py-3 px-4">Reference</th>
                    <th className="py-3 px-3">Garment</th>
                    <th className="py-3 px-3 text-right">Still to Pack</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Packing Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {data && data.pendingPacking.length === 0 && <EmptyRow colSpan={5} text="Nothing is being packed" />}
                  {(data?.pendingPacking || []).map((a: any) => (
                    <tr key={a.id} className="hover:bg-neutral-50/60">
                      <td className="py-2.5 px-4 font-mono text-xs font-semibold">{a.packingNumber}</td>
                      <td className="py-2.5 px-3 text-xs">
                        <button type="button" onClick={() => setOpenId(a.record?.id)} className="text-left hover:underline">
                          <span className="font-semibold">{a.record?.garment}</span>
                          <span className="block text-neutral-500">{a.record?.program?.designNumber || sheetRef(a.record?.program)}</span>
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{pcs(a.open)}</td>
                      <td className="py-2.5 px-3"><AllocationStatusBadge status={a.status} /></td>
                      <td className="py-2.5 px-3 text-xs text-neutral-600">{fmtDate(a.packingDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Ready to Send for Packing" count={data?.readyToSend?.length}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className={THEAD}>
                  <tr>
                    <th className="py-3 px-4">Image</th>
                    <th className="py-3 px-3">Garment</th>
                    <th className="py-3 px-3 text-right">Available</th>
                    <th className="py-3 px-3">Delivery</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {data && data.readyToSend.length === 0 && <EmptyRow colSpan={4} text="No garments waiting to be sent for packing" />}
                  {(data?.readyToSend || []).map((r: any) => (
                    <tr key={r.id} className="hover:bg-neutral-50/60">
                      <td className="py-2.5 px-4"><GarmentImage image={r.image} alt={r.garment} /></td>
                      <td className="py-2.5 px-3 text-xs">
                        <button type="button" onClick={() => setOpenId(r.id)} className="text-left hover:underline">
                          <span className="font-semibold">{r.garment}</span>
                          <span className="block text-neutral-500">{r.program?.designNumber || sheetRef(r.program)}</span>
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{pcs(r.stock.available)}</td>
                      <td className="py-2.5 px-3 text-xs"><DeadlineText program={r.program} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <LedgerPanel title="Recent Receipts" rows={data?.recentReceipts} empty="No garments received yet" />
          <LedgerPanel title="Recent Packing Transactions" rows={data?.recentPacking} empty="No packing recorded yet" />
        </div>
      </main>
      {openId && <RecordDrawer id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}

function LedgerPanel({ title, rows, empty }: { title: string; rows?: any[]; empty: string }) {
  return (
    <Panel title={title} count={rows?.length}>
      <ul className="divide-y divide-neutral-100 text-xs">
        {rows && rows.length === 0 && <li className="px-5 py-8 text-center text-neutral-500">{empty}</li>}
        {(rows || []).map((t) => (
          <li key={t.id} className="px-5 py-2.5 flex flex-wrap justify-between gap-2">
            <span>
              <span className="font-semibold text-neutral-900">{ledgerLabel(t.entryType)}</span>
              <span className="text-neutral-700"> · {t.itemName}</span>
              {t.quantity !== 0 && <span className="tabular-nums text-neutral-700"> · {pcs(Math.abs(t.quantity))}</span>}
            </span>
            <span className="text-neutral-500 whitespace-nowrap">{fmtDate(t.createdAt, true)} · {t.actor?.fullName || '—'}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// ---------------------------------------------------------------------------------------------
// Received Finished Garments: Final QC challans to receive, and what has been received
// ---------------------------------------------------------------------------------------------

function IncomingChallans() {
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [receiving, setReceiving] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ view: 'pending' });
      if (search.trim()) q.set('search', search.trim());
      const body = await fetchJson(`${API}/challans?${q}`);
      setRows(body.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      {error && <Notice kind="error" onClose={() => setError(null)}>{error}</Notice>}
      {notice && <Notice kind="success" onClose={() => setNotice(null)}>{notice}</Notice>}
      <Panel
        title="Final QC Challans to Receive"
        count={rows.length}
        actions={
          <form
            onSubmit={(e) => {
              e.preventDefault();
              load();
            }}
          >
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Challan, sheet or design" aria-label="Search challans" className={`${FIELD} md:w-64`} />
          </form>
        }
      >
        <div className="divide-y divide-neutral-100">
          {!loading && rows.length === 0 && <p className="px-5 py-12 text-center text-sm font-medium text-neutral-500">No finished garments waiting to be received</p>}
          {rows.map((c) => {
            const dispatched = c.lines.reduce((s: number, l: any) => s + (Number(l.dispatchedQuantity) || 0), 0);
            return (
              <div key={c.id} className="px-5 py-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <dl className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-x-5 gap-y-1.5 text-xs">
                    <div><dt className="text-neutral-500">Challan</dt><dd className="font-mono font-bold text-brand-800">{c.challanNumber}</dd></div>
                    <div><dt className="text-neutral-500">Challan date</dt><dd className="font-semibold">{fmtDate(c.issuedDate || c.createdAt)}</dd></div>
                    <div><dt className="text-neutral-500">From / To</dt><dd className="font-semibold">{departmentName(c.fromDepartment)} → Inventory</dd></div>
                    <div><dt className="text-neutral-500">Design / Serial</dt><dd className="font-semibold">{c.program?.designNumber || c.program?.wilcomDesignNumber || '—'} · {c.program?.programSerialNo || '—'}</dd></div>
                    <div><dt className="text-neutral-500">Production Sheet</dt><dd className="font-mono font-semibold">{sheetRef(c.program)}</dd></div>
                    <div><dt className="text-neutral-500">Department incharge</dt><dd className="font-semibold">{c.issuedBy?.fullName || '—'}</dd></div>
                    <div><dt className="text-neutral-500">Priority</dt><dd><PriorityBadge priority={c.priority} /></dd></div>
                    <div><dt className="text-neutral-500">Delivery</dt><dd><DeadlineText program={c.program} /></dd></div>
                    <div><dt className="text-neutral-500">Dispatched</dt><dd className="font-semibold tabular-nums">{pcs(dispatched)}</dd></div>
                  </dl>
                  <div className="flex items-center gap-2">
                    <DocumentsButton programId={c.programId} challanId={c.id} />
                    <button type="button" onClick={() => setReceiving(c)} className={BTN_PRIMARY}>
                      <PackageCheck className="w-3.5 h-3.5" />
                      <span>Receive</span>
                    </button>
                  </div>
                </div>
                {c.remarks && <p className="text-[11px] text-neutral-600">Remarks: {c.remarks}</p>}
                <div className="flex flex-wrap gap-3">
                  {c.lines.map((l: any) => (
                    <div key={l.id} className="flex items-center gap-2.5 border border-neutral-200 rounded-xl p-2 pr-3">
                      <GarmentImage image={l.image} alt={l.garment} />
                      <div className="text-xs">
                        <span className="font-semibold text-neutral-900">{l.garment}</span>
                        <span className="block text-neutral-600 tabular-nums">Dispatched {pcs(l.dispatchedQuantity)}</span>
                        <span className="block text-neutral-500 tabular-nums">Pending receipt {pcs(l.status === 'AWAITING_RECEIPT' ? l.dispatchedQuantity : 0)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
      {receiving && (
        <ReceiveDialog
          challan={receiving}
          onClose={() => setReceiving(null)}
          onDone={(message) => {
            setNotice(message);
            setReceiving(null);
            load();
          }}
        />
      )}
    </div>
  );
}

/** Actual pieces counted per line, blank until entered; never above what Final QC dispatched. */
function ReceiveDialog({ challan, onClose, onDone }: { challan: any; onClose: () => void; onDone: (message: string) => void }) {
  const lines: any[] = challan.lines.filter((l: any) => l.status === 'AWAITING_RECEIPT');
  const [values, setValues] = useState<Record<string, { qty: string; remarks: string }>>(() => Object.fromEntries(lines.map((l) => [l.id, { qty: '', remarks: '' }])));
  const [remarks, setRemarks] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const problem = () => {
    for (const l of lines) {
      const raw = values[l.id].qty;
      const q = Number(raw);
      if (raw === '') return `Enter the received quantity for ${l.garment}.`;
      if (!Number.isInteger(q) || q < 0) return `${l.garment}: enter a whole number of pieces.`;
      if (q > l.dispatchedQuantity) return `${l.garment}: received cannot be more than the ${pcs(l.dispatchedQuantity)} dispatched.`;
    }
    return null;
  };
  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = await fetchJson(`${API}/challans/${challan.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remarks, lines: lines.map((l) => ({ workItemId: l.id, receivedQuantity: Number(values[l.id].qty), remarks: values[l.id].remarks })) }),
      });
      onDone(body.message);
    } catch (e: any) {
      setError(e.message);
      setConfirming(false);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-neutral-900/50 p-3 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Receive finished garments">
      <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 w-full max-w-4xl">
        <div className="px-5 py-4 border-b border-neutral-200">
          <h3 className="text-sm font-bold text-neutral-900">Receive Finished Garments</h3>
          <p className="text-xs text-neutral-500 font-mono">{challan.challanNumber} · {sheetRef(challan.program)} · from {departmentName(challan.fromDepartment)}</p>
        </div>
        <div className="p-5 space-y-4">
          {error && <Notice kind="error">{error}</Notice>}
          <div className="overflow-x-auto border border-neutral-200 rounded-xl">
            <table className="w-full text-left text-sm">
              <thead className={THEAD}>
                <tr>
                  <th className="py-2.5 px-3">Garment</th>
                  <th className="py-2.5 px-3 text-right">Dispatched</th>
                  <th className="py-2.5 px-3 w-36">Received (PCS)</th>
                  <th className="py-2.5 px-3">Discrepancy remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {lines.map((l) => {
                  const v = values[l.id];
                  const short = v.qty !== '' ? l.dispatchedQuantity - Number(v.qty) : 0;
                  return (
                    <tr key={l.id}>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <GarmentImage image={l.image} alt={l.garment} />
                          <span className="text-xs font-semibold text-neutral-900">{l.garment}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-neutral-600">{pcs(l.dispatchedQuantity)}</td>
                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          max={l.dispatchedQuantity}
                          value={v.qty}
                          disabled={confirming}
                          onChange={(e) => setValues({ ...values, [l.id]: { ...v, qty: e.target.value } })}
                          className={`${FIELD} text-right tabular-nums`}
                          aria-label={`Received pieces of ${l.garment}`}
                        />
                        {short > 0 && <span className="block mt-1 text-[11px] font-semibold text-danger-700">Short {pcs(short)}</span>}
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          value={v.remarks}
                          disabled={confirming}
                          onChange={(e) => setValues({ ...values, [l.id]: { ...v, remarks: e.target.value } })}
                          maxLength={300}
                          placeholder={short > 0 ? 'Shortage or damage details' : ''}
                          className={FIELD}
                          aria-label={`Remarks for ${l.garment}`}
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
            <input value={remarks} onChange={(e) => setRemarks(e.target.value)} disabled={confirming} maxLength={500} className={`${FIELD} mt-1`} />
          </label>
          {confirming && <Notice kind="success">Receive these quantities into Inventory. Each line is received once; shortages stay recorded against the challan.</Notice>}
        </div>
        <div className="px-5 py-4 border-t border-neutral-200 flex justify-end gap-2">
          <button type="button" onClick={() => (confirming ? setConfirming(false) : onClose())} className={BTN_QUIET} disabled={saving}>{confirming ? 'Back' : 'Cancel'}</button>
          {confirming ? (
            <button type="button" onClick={submit} disabled={saving} className={BTN_PRIMARY}>{saving ? 'Saving…' : 'Confirm Receipt'}</button>
          ) : (
            <button
              type="button"
              onClick={() => {
                const p = problem();
                if (p) setError(p);
                else {
                  setError(null);
                  setConfirming(true);
                }
              }}
              className={BTN_PRIMARY}
            >
              Review
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReceivedContent() {
  const params = useSearchParams();
  const [tab, setTab] = useState<'incoming' | 'received'>(params.get('view') === 'received' ? 'received' : 'incoming');
  return (
    <div className="min-h-screen bg-canvas pb-16">
      <PageHeader title="Received Finished Garments">
        <Tabs value={tab} onChange={setTab} tabs={[{ id: 'incoming', label: 'To Receive' }, { id: 'received', label: 'Received' }]} />
      </PageHeader>
      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {tab === 'incoming' ? <IncomingChallans /> : <RecordsBrowser mode="received" title="Received Finished Garments" />}
      </main>
    </div>
  );
}

export function InventoryReceived() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <ReceivedContent />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------------------------
// Finished Garment Inventory
// ---------------------------------------------------------------------------------------------

export function InventoryStock() {
  return (
    <div className="min-h-screen bg-canvas pb-16">
      <PageHeader title="Finished Garment Inventory" />
      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        <RecordsBrowser mode="stock" title="Finished Garments" />
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Packing Management (a module of Inventory)
// ---------------------------------------------------------------------------------------------

const REFERENCE_FILTERS = ['SENT_FOR_PACKING', 'PACKING_IN_PROGRESS', 'PARTIALLY_PACKED', 'PACKING_COMPLETED', 'CANCELLED'] as const;

function PackingReferences() {
  const [filters, setFilters] = useState({ search: '', category: '', status: 'OPEN', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{ data: any[]; total: number; pageSize: number }>({ data: [], total: 0, pageSize: 25 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [acting, setActing] = useState<{ allocation: any; action: 'START' | 'PACK' | 'RETURN' } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async (f = filters, p = page) => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ page: String(p), pageSize: '25' });
      Object.entries(f).forEach(([k, v]) => v && q.set(k, v));
      const body = await fetchJson(`${API}/packing?${q}`);
      setResult({ data: body.data || [], total: body.total || 0, pageSize: body.pageSize || 25 });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const set = (k: keyof typeof filters) => (v: string) => setFilters({ ...filters, [k]: v });

  return (
    <div className="space-y-4">
      {error && <Notice kind="error" onClose={() => setError(null)}>{error}</Notice>}
      {notice && <Notice kind="success" onClose={() => setNotice(null)}>{notice}</Notice>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          load(filters, 1);
        }}
        className="bg-white border border-neutral-200 rounded-2xl shadow-xs p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
      >
        <label className="block col-span-2">
          <span className="text-xs font-semibold text-neutral-600">Reference, design, serial or challan</span>
          <input value={filters.search} onChange={(e) => set('search')(e.target.value)} className={`${FIELD} mt-1`} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-neutral-600">Category</span>
          <CategorySelect value={filters.category} onChange={set('category')} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-neutral-600">Packing status</span>
          <select value={filters.status} onChange={(e) => set('status')(e.target.value)} className={`${FIELD} mt-1`}>
            <option value="OPEN">Still to pack</option>
            <option value="">Any</option>
            {REFERENCE_FILTERS.map((s) => (
              <option key={s} value={s}>{ALLOCATION_STATUS_LABEL[s]}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-neutral-600">Packing date from</span>
          <input type="date" value={filters.from} onChange={(e) => set('from')(e.target.value)} className={`${FIELD} mt-1`} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-neutral-600">Packing date to</span>
          <input type="date" value={filters.to} onChange={(e) => set('to')(e.target.value)} className={`${FIELD} mt-1`} />
        </label>
        <div className="flex items-end gap-2 col-span-2 sm:col-span-1">
          <button type="submit" className={`${BTN_PRIMARY} flex-1`}>Apply</button>
        </div>
      </form>

      <Panel title="Packing References" count={result.total}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className={THEAD}>
              <tr>
                <th className="py-3 px-4">Image</th>
                <th className="py-3 px-3">Reference</th>
                <th className="py-3 px-3">Design</th>
                <th className="py-3 px-3">Garment</th>
                <th className="py-3 px-3 text-right">Allocated</th>
                <th className="py-3 px-3 text-right">Packed</th>
                <th className="py-3 px-3 text-right">Remaining</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Packing Date</th>
                <th className="py-3 px-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {!loading && result.data.length === 0 && <EmptyRow colSpan={10} text="No packing references match these filters" />}
              {result.data.map((a) => (
                <tr key={a.id} className="hover:bg-neutral-50/60 align-top">
                  <td className="py-2.5 px-4"><GarmentImage image={a.record?.image} alt={a.record?.garment || 'Garment'} /></td>
                  <td className="py-2.5 px-3">
                    <span className="font-mono text-xs font-bold text-neutral-900">{a.packingNumber}</span>
                    <span className="block text-[11px] text-neutral-500">{a.createdBy?.fullName || ''}</span>
                    <PriorityBadge priority={a.priority} />
                  </td>
                  <td className="py-2.5 px-3"><DesignCell program={a.record?.program} /></td>
                  <td className="py-2.5 px-3 text-xs">
                    <button type="button" onClick={() => setOpenId(a.record?.id)} className="text-left hover:underline font-semibold">{a.record?.garment}</button>
                    <span className="block font-mono text-[11px] text-neutral-500">{a.record?.inboundChallan?.challanNumber}</span>
                    {a.remarks && <span className="block text-[11px] text-neutral-500">{a.remarks}</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                    {pcs(a.quantity - a.returnedQuantity)}
                    {a.returnedQuantity > 0 && <span className="block text-[11px] text-neutral-500">{pcs(a.returnedQuantity)} returned</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{pcs(a.packedQuantity)}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap font-semibold">{pcs(a.open)}</td>
                  <td className="py-2.5 px-3"><AllocationStatusBadge status={a.status} /></td>
                  <td className="py-2.5 px-3 text-xs text-neutral-600 whitespace-nowrap">
                    {fmtDate(a.packingDate)}
                    {a.completedAt && <span className="block">Done {fmtDate(a.completedAt)}</span>}
                  </td>
                  <td className="py-2.5 px-3"><PackingActions allocation={a} onAction={(action) => setActing({ allocation: a, action })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager
          page={page}
          pageSize={result.pageSize}
          total={result.total}
          onPage={(p) => {
            setPage(p);
            load(filters, p);
          }}
        />
      </Panel>
      {acting && (
        <PackingActionDialog
          allocation={acting.allocation}
          action={acting.action}
          onClose={() => setActing(null)}
          onDone={(message) => {
            setNotice(message);
            setActing(null);
            load();
          }}
        />
      )}
      {openId && <RecordDrawer id={openId} onClose={() => setOpenId(null)} onChanged={() => load()} />}
    </div>
  );
}

function PackingContent() {
  const params = useSearchParams();
  const [tab, setTab] = useState<'garments' | 'references'>(params.get('view') === 'references' ? 'references' : 'garments');
  return (
    <div className="min-h-screen bg-canvas pb-16">
      <PageHeader title="Packing Management">
        <Tabs value={tab} onChange={setTab} tabs={[{ id: 'garments', label: 'Garments' }, { id: 'references', label: 'Packing References' }]} />
      </PageHeader>
      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {tab === 'garments' ? <RecordsBrowser mode="packing" title="Garments for Packing" focusId={params.get('itemId')} /> : <PackingReferences />}
      </main>
    </div>
  );
}

export function InventoryPacking() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <PackingContent />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------------------------
// Challan History
// ---------------------------------------------------------------------------------------------

const CHALLAN_FILTERS = { from: '', to: '', challan: '', sheet: '', design: '', category: '' };

export function InventoryChallans() {
  const [filters, setFilters] = useState(CHALLAN_FILTERS);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (f = filters) => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      Object.entries(f).forEach(([k, v]) => v && q.set(k, v));
      const body = await fetchJson(`${API}/history?${q}`);
      setRows(body.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const set = (k: keyof typeof CHALLAN_FILTERS) => (e: React.ChangeEvent<HTMLInputElement>) => setFilters({ ...filters, [k]: e.target.value });

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <PageHeader title="Challan History" loading={loading} onRefresh={() => load()} />
      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {error && <Notice kind="error" onClose={() => setError(null)}>{error}</Notice>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
          className="bg-white border border-neutral-200 rounded-2xl shadow-xs p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3"
        >
          <label className="block">
            <span className="text-xs font-semibold text-neutral-600">From</span>
            <input type="date" value={filters.from} onChange={set('from')} className={`${FIELD} mt-1`} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-neutral-600">To</span>
            <input type="date" value={filters.to} onChange={set('to')} className={`${FIELD} mt-1`} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-neutral-600">Challan No.</span>
            <input value={filters.challan} onChange={set('challan')} className={`${FIELD} mt-1`} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-neutral-600">Sheet / Serial</span>
            <input value={filters.sheet} onChange={set('sheet')} className={`${FIELD} mt-1`} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-neutral-600">Design No.</span>
            <input value={filters.design} onChange={set('design')} className={`${FIELD} mt-1`} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-neutral-600">Category</span>
            <CategorySelect value={filters.category} onChange={(v) => setFilters({ ...filters, category: v })} />
          </label>
          <div className="flex items-end gap-2">
            <button type="submit" className={`${BTN_PRIMARY} flex-1`}>Apply</button>
            <button
              type="button"
              onClick={() => {
                setFilters(CHALLAN_FILTERS);
                load(CHALLAN_FILTERS);
              }}
              className={BTN_QUIET}
            >
              Reset
            </button>
          </div>
        </form>

        <Panel title="Challans Received into Inventory" count={rows.length}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className={THEAD}>
                <tr>
                  <th className="py-3 px-4">Challan</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Design</th>
                  <th className="py-3 px-3">Garments</th>
                  <th className="py-3 px-3 text-right">Dispatched</th>
                  <th className="py-3 px-3 text-right">Received</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Incharge / Receiver</th>
                  <th className="py-3 px-3"><span className="sr-only">Documents</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {!loading && rows.length === 0 && <EmptyRow colSpan={9} text="No challans match these filters" />}
                {rows.map((c) => {
                  const dispatched = c.lines.reduce((s: number, l: any) => s + (Number(l.dispatchedQuantity) || 0), 0);
                  const received = c.lines.reduce((s: number, l: any) => s + (Number(l.receivedQuantity) || 0), 0);
                  const anyReceived = c.lines.some((l: any) => l.receivedQuantity !== null);
                  return (
                    <tr key={c.id} className="hover:bg-neutral-50/60 align-top">
                      <td className="py-3 px-4 font-mono text-xs font-bold text-brand-800">
                        <Link href={`/challans/${c.id}`} className="hover:underline">{c.challanNumber}</Link>
                        <span className="block font-sans text-[11px] font-normal text-neutral-500">{departmentName(c.fromDepartment)}</span>
                      </td>
                      <td className="py-3 px-3 text-xs text-neutral-600 whitespace-nowrap">{fmtDate(c.issuedDate || c.createdAt)}</td>
                      <td className="py-3 px-3"><DesignCell program={c.program} /></td>
                      <td className="py-3 px-3 text-xs">
                        {c.lines.map((l: any) => (
                          <span key={l.id} className="flex items-center gap-1.5 py-0.5 whitespace-nowrap">
                            <span className="font-semibold">{l.garment}</span>
                            <span className="text-neutral-500 tabular-nums">{pcs(l.dispatchedQuantity)}</span>
                            {l.receiptRemarks && <span className="text-danger-700">{l.receiptRemarks}</span>}
                          </span>
                        ))}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{pcs(dispatched)}</td>
                      <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{anyReceived ? pcs(received) : '—'}</td>
                      <td className="py-3 px-3 text-xs">{String(c.status || '').replace(/_/g, ' ')}</td>
                      <td className="py-3 px-3 text-[11px] text-neutral-600">
                        <span className="block">{c.issuedBy?.fullName || '—'}</span>
                        {c.receivedBy && <span className="block">Received by {c.receivedBy.fullName} · {fmtDate(c.receivedDate, true)}</span>}
                      </td>
                      <td className="py-3 px-3 text-right"><DocumentsButton programId={c.programId} challanId={c.id} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Transaction History
// ---------------------------------------------------------------------------------------------

const TYPE_OPTIONS = Object.values(LEDGER);
const TX_FILTERS = { type: '', search: '', from: '', to: '' };

export function InventoryTransactions() {
  const [filters, setFilters] = useState(TX_FILTERS);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{ data: any[]; total: number; pageSize: number }>({ data: [], total: 0, pageSize: 50 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (f = filters, p = page) => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ page: String(p), pageSize: '50' });
      Object.entries(f).forEach(([k, v]) => v && q.set(k, v));
      const body = await fetchJson(`${API}/transactions?${q}`);
      setResult({ data: body.data || [], total: body.total || 0, pageSize: body.pageSize || 50 });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <PageHeader title="Transaction History" loading={loading} onRefresh={() => load()} />
      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {error && <Notice kind="error" onClose={() => setError(null)}>{error}</Notice>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            load(filters, 1);
          }}
          className="bg-white border border-neutral-200 rounded-2xl shadow-xs p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
        >
          <label className="block">
            <span className="text-xs font-semibold text-neutral-600">Transaction</span>
            <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} className={`${FIELD} mt-1`}>
              <option value="">Any</option>
              {TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{(LEDGER_LABEL as Record<string, string>)[t]}</option>
              ))}
            </select>
          </label>
          <label className="block col-span-2 sm:col-span-1">
            <span className="text-xs font-semibold text-neutral-600">Design, serial, record or reference</span>
            <input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} className={`${FIELD} mt-1`} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-neutral-600">From</span>
            <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className={`${FIELD} mt-1`} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-neutral-600">To</span>
            <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className={`${FIELD} mt-1`} />
          </label>
          <div className="flex items-end gap-2">
            <button type="submit" className={`${BTN_PRIMARY} flex-1`}>Apply</button>
            <button
              type="button"
              onClick={() => {
                setFilters(TX_FILTERS);
                setPage(1);
                load(TX_FILTERS, 1);
              }}
              className={BTN_QUIET}
            >
              Reset
            </button>
          </div>
        </form>

        <Panel title="Inventory Transactions" count={result.total}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className={THEAD}>
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-3">Transaction</th>
                  <th className="py-3 px-3">Garment</th>
                  <th className="py-3 px-3">Record</th>
                  <th className="py-3 px-3">Reference</th>
                  <th className="py-3 px-3 text-right">Quantity</th>
                  <th className="py-3 px-3 text-right">Available After</th>
                  <th className="py-3 px-3">By</th>
                  <th className="py-3 px-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {!loading && result.data.length === 0 && <EmptyRow colSpan={9} text="No transactions match these filters" />}
                {result.data.map((t) => (
                  <tr key={t.id} className="hover:bg-neutral-50/60 align-top">
                    <td className="py-2.5 px-4 text-xs text-neutral-600 whitespace-nowrap">{fmtDate(t.createdAt, true)}</td>
                    <td className="py-2.5 px-3 text-xs font-semibold">
                      {ledgerLabel(t.entryType)}
                      {t.legacy && <span className="block text-[11px] font-normal text-neutral-500">Earlier Packing module</span>}
                    </td>
                    <td className="py-2.5 px-3 text-xs">
                      {t.itemName}
                      <span className="block text-[11px] text-neutral-500">{t.program?.designNumber || ''} {t.program?.programSerialNo ? `· ${t.program.programSerialNo}` : ''}</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs">{t.itemCode}</td>
                    <td className="py-2.5 px-3 font-mono text-xs text-brand-800">
                      {t.referenceType === 'CHALLAN' && t.referenceId ? <Link href={`/challans/${t.referenceId}`} className="hover:underline">{t.reference || 'Challan'}</Link> : t.reference || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{t.quantity === 0 ? '—' : `${t.quantity > 0 && t.entryType !== 'PACKED' ? '+' : ''}${pcs(t.quantity)}`}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{t.entryType === 'IMAGE_UPLOADED' ? '—' : pcs(t.balanceAfter)}</td>
                    <td className="py-2.5 px-3 text-xs text-neutral-700 whitespace-nowrap">{t.actor?.fullName || '—'}</td>
                    <td className="py-2.5 px-3 text-xs text-neutral-600 max-w-[260px]">{t.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager
            page={page}
            pageSize={result.pageSize}
            total={result.total}
            onPage={(p) => {
              setPage(p);
              load(filters, p);
            }}
          />
        </Panel>
      </main>
    </div>
  );
}
