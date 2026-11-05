'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowDownToLine, ArrowUpFromLine, Download, Layers, RefreshCw, Warehouse } from 'lucide-react';
import { EmptyRow, THEAD, fetchJson, fmtDate } from '@/components/workflow/WorkflowUi';
import { Pager } from '@/components/inventory/InventoryUi';
import { departmentName } from '@/lib/workflow-views';

// Admin Console > Fabric Store: dyed and undyed fabric stock with its inward and outward registers, read from
// the Fabric Store's own endpoints so the figures are the department's. MTR and PCS are never added together.

type Summary = {
  totalInwardMeters: number;
  totalOutwardMeters: number;
  availableBalanceMeters: number;
  totalInwardPcs: number;
  totalOutwardPcs: number;
  availableBalancePcs: number;
  itemCount: number;
};
type View = 'stock' | 'inward' | 'outward';
type TypeFilter = '' | 'DYED' | 'UNDYED';

const PAGE_SIZE = 50;
const TYPE_LABEL: Record<string, string> = { DYED: 'Dyed', UNDYED: 'Undyed', KORA: 'Undyed' };

const num = (v: number) => (Number(v) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
/** "1,250 MTR · 40 PCS", leaving out a unit with nothing in it. */
const both = (mtr: number, pcs: number) => {
  const parts = [mtr ? `${num(mtr)} MTR` : '', pcs ? `${num(pcs)} PCS` : ''].filter(Boolean);
  return parts.join(' · ') || '0';
};
const typeOf = (t: string | null | undefined) => (String(t || '').toUpperCase() === 'DYED' ? 'DYED' : 'UNDYED');
const inRange = (date: string | null | undefined, from: string, to: string) => {
  if (!from && !to) return true;
  if (!date) return false;
  const t = new Date(date).getTime();
  return (!from || t >= new Date(`${from}T00:00:00`).getTime()) && (!to || t <= new Date(`${to}T23:59:59.999`).getTime());
};

function TypeBadge({ type }: { type: string }) {
  const dyed = typeOf(type) === 'DYED';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${dyed ? 'bg-brand-50 text-brand-800' : 'bg-neutral-100 text-neutral-700'}`}>
      {dyed ? 'Dyed' : 'Undyed'}
    </span>
  );
}

function StockCard({ title, summary, tone, active, onClick }: { title: string; summary?: Summary; tone: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`text-left bg-white rounded-2xl p-4 ring-1 shadow-xs transition hover:ring-brand-300 ${active ? 'ring-2 ring-brand-500' : 'ring-neutral-200'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-neutral-600">{title}</span>
        <span className={`w-2 h-2 rounded-full ${tone}`} aria-hidden="true" />
      </div>
      <p className="mt-2 text-xl font-semibold text-neutral-900 tabular-nums">{summary ? both(summary.availableBalanceMeters, summary.availableBalancePcs) : '—'}</p>
      <p className="text-[11px] text-neutral-500">Available stock{summary ? ` · ${summary.itemCount} item${summary.itemCount === 1 ? '' : 's'}` : ''}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs border-t border-neutral-100 pt-3">
        <div>
          <dt className="text-neutral-500 flex items-center gap-1"><ArrowDownToLine className="w-3 h-3" /> Inward</dt>
          <dd className="font-semibold text-neutral-800 tabular-nums">{summary ? both(summary.totalInwardMeters, summary.totalInwardPcs) : '—'}</dd>
        </div>
        <div>
          <dt className="text-neutral-500 flex items-center gap-1"><ArrowUpFromLine className="w-3 h-3" /> Outward</dt>
          <dd className="font-semibold text-neutral-800 tabular-nums">{summary ? both(summary.totalOutwardMeters, summary.totalOutwardPcs) : '—'}</dd>
        </div>
      </dl>
    </button>
  );
}

export function FabricStorePanel() {
  const [stock, setStock] = useState<{ data: any[]; summary: { overall: Summary; dyed: Summary; undyed: Summary }; outwardHistory: any[] } | null>(null);
  const [inward, setInward] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('stock');
  const [type, setType] = useState<TypeFilter>('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, i] = await Promise.all([fetchJson('/api/fabric-store/total-stock'), fetchJson('/api/fabric-store/inward')]);
      setStock(s);
      setInward(Array.isArray(i.data) ? i.data : []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  useEffect(() => setPage(1), [view, type, search, from, to]);

  const q = search.trim().toLowerCase();
  const matches = (...values: unknown[]) => !q || values.some((v) => String(v || '').toLowerCase().includes(q));

  const stockRows = useMemo(
    () => (stock?.data || []).filter((r) => (!type || typeOf(r.fabricType) === type) && matches(r.itemName, r.colour)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stock, type, q],
  );
  const inwardRows = useMemo(
    () =>
      inward.filter(
        (r) => (!type || typeOf(r.entryType) === type) && inRange(r.receivingDate, from, to) && matches(r.itemName, r.colour, r.billNo, r.supplierName, r.rollNumber),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inward, type, from, to, q],
  );
  const outwardRows = useMemo(
    () =>
      (stock?.outwardHistory || []).filter(
        (r) => (!type || typeOf(r.fabricType) === type) && inRange(r.date, from, to) && matches(r.itemName, r.colour, r.challanNumber, r.destination),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stock, type, from, to, q],
  );

  // Inward and outward totals of the filtered register, per unit.
  const unitSum = (rows: any[], qty: (r: any) => number) => ({
    mtr: rows.filter((r) => String(r.unit).toUpperCase() === 'MTR').reduce((s, r) => s + qty(r), 0),
    pcs: rows.filter((r) => String(r.unit).toUpperCase() === 'PCS').reduce((s, r) => s + qty(r), 0),
  });
  const inwardTotal = unitSum(inwardRows, (r) => Number(r.billQty) || 0);
  const outwardTotal = unitSum(outwardRows, (r) => Number(r.quantity) || 0);

  const rows = view === 'stock' ? stockRows : view === 'inward' ? inwardRows : outwardRows;
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportExcel = async () => {
    const XLSX = await import('xlsx');
    const book = XLSX.utils.book_new();
    const add = (name: string, data: Array<Record<string, unknown>>) =>
      XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(data.length ? data : [{ Note: 'No records' }]), name);
    add('Stock', stockRows.map((r) => ({ Fabric: r.itemName, Type: TYPE_LABEL[typeOf(r.fabricType)], Colour: r.colour || '', Unit: r.unit, Inward: r.totalInward, Outward: r.totalOutward, Balance: r.balance, 'Last activity': fmtDate(r.lastActivity) })));
    add('Inward', inwardRows.map((r) => ({ 'Received on': fmtDate(r.receivingDate), 'Bill no': r.billNo, 'Bill date': fmtDate(r.billDate), Supplier: r.supplierName || '', Fabric: r.itemName, Type: TYPE_LABEL[typeOf(r.entryType)], Colour: r.colour || '', Roll: r.rollNumber || '', Quantity: r.billQty, Unit: r.unit })));
    add('Outward', outwardRows.map((r) => ({ Date: fmtDate(r.date), Challan: r.challanNumber, 'Issued to': departmentName(r.destination) || r.destination, Fabric: r.itemName, Type: TYPE_LABEL[typeOf(r.fabricType)], Colour: r.colour || '', Quantity: r.quantity, Unit: r.unit })));
    XLSX.writeFile(book, `Fabric_Store_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const s = stock?.summary;
  const field = 'h-9 px-2.5 border border-neutral-300 rounded-lg text-xs text-neutral-900 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 w-full';
  const label = 'block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1';
  const VIEWS: Array<{ id: View; label: string; count: number }> = [
    { id: 'stock', label: 'Stock', count: stockRows.length },
    { id: 'inward', label: 'Inward', count: inwardRows.length },
    { id: 'outward', label: 'Outward', count: outwardRows.length },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
            <Warehouse className="w-5 h-5 text-brand-600" />
            Fabric Store
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">Dyed and undyed fabric stock, inward and outward · live from the Fabric Store · MTR and PCS are never added together</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/fabric-store/inventory/total-stock" className="inline-flex items-center gap-1.5 h-8 px-3 bg-white hover:bg-neutral-50 text-neutral-800 rounded-lg text-xs font-semibold ring-1 ring-neutral-300">
            <Layers className="w-3.5 h-3.5" /> Open Fabric Store
          </Link>
          <button type="button" onClick={exportExcel} disabled={!stock} className="inline-flex items-center gap-1.5 h-8 px-3 bg-white hover:bg-neutral-50 text-neutral-800 rounded-lg text-xs font-semibold ring-1 ring-neutral-300 disabled:opacity-50">
            <Download className="w-3.5 h-3.5" /> Excel
          </button>
          <button type="button" onClick={load} disabled={loading} className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-danger-50 border border-danger-200 text-xs text-danger-800">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={load} className="font-bold underline">Retry</button>
        </div>
      )}

      {/* Clicking a card filters the registers below to that type. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StockCard title="Dyed Fabric" summary={s?.dyed} tone="bg-brand-600" active={type === 'DYED'} onClick={() => setType(type === 'DYED' ? '' : 'DYED')} />
        <StockCard title="Undyed Fabric" summary={s?.undyed} tone="bg-neutral-400" active={type === 'UNDYED'} onClick={() => setType(type === 'UNDYED' ? '' : 'UNDYED')} />
        <StockCard title="Total Fabric Stock" summary={s?.overall} tone="bg-accent-500" active={type === ''} onClick={() => setType('')} />
      </div>

      <section className="bg-white border border-neutral-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-4 pt-3 border-b border-neutral-200 flex flex-wrap items-end justify-between gap-2">
          <div className="flex gap-1" role="tablist" aria-label="Fabric Store registers">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={view === v.id}
                onClick={() => setView(v.id)}
                className={`px-3 py-2 text-xs font-semibold border-b-2 -mb-px transition ${view === v.id ? 'border-brand-600 text-brand-800' : 'border-transparent text-neutral-500 hover:text-neutral-800'}`}
              >
                {v.label} <span className="tabular-nums text-neutral-400">({v.count})</span>
              </button>
            ))}
          </div>
          {view !== 'stock' && (
            <p className="pb-2 text-xs text-neutral-600 tabular-nums">
              Total {view}: <span className="font-semibold text-neutral-900">{view === 'inward' ? both(inwardTotal.mtr, inwardTotal.pcs) : both(outwardTotal.mtr, outwardTotal.pcs)}</span>
            </p>
          )}
        </div>

        <div className="p-4 grid grid-cols-2 md:grid-cols-5 gap-3 border-b border-neutral-100">
          <div className="col-span-2">
            <label className={label} htmlFor="fs-search">Search</label>
            <input
              id="fs-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={view === 'stock' ? 'Fabric or colour' : view === 'inward' ? 'Fabric, colour, bill, supplier or roll' : 'Fabric, colour, challan or department'}
              className={field}
            />
          </div>
          <div>
            <label className={label} htmlFor="fs-type">Type</label>
            <select id="fs-type" value={type} onChange={(e) => setType(e.target.value as TypeFilter)} className={field}>
              <option value="">Dyed and undyed</option>
              <option value="DYED">Dyed</option>
              <option value="UNDYED">Undyed</option>
            </select>
          </div>
          {view !== 'stock' && (
            <>
              <div>
                <label className={label} htmlFor="fs-from">From</label>
                <input id="fs-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={field} />
              </div>
              <div>
                <label className={label} htmlFor="fs-to">To</label>
                <input id="fs-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className={field} />
              </div>
            </>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={THEAD}>
              {view === 'stock' ? (
                <tr>
                  <th className="py-3 px-4">Fabric</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Colour</th>
                  <th className="py-3 px-3 text-right">Inward</th>
                  <th className="py-3 px-3 text-right">Outward</th>
                  <th className="py-3 px-3 text-right">Balance</th>
                  <th className="py-3 px-3">Last Activity</th>
                </tr>
              ) : view === 'inward' ? (
                <tr>
                  <th className="py-3 px-4">Received On</th>
                  <th className="py-3 px-3">Bill</th>
                  <th className="py-3 px-3">Supplier</th>
                  <th className="py-3 px-3">Fabric</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Colour</th>
                  <th className="py-3 px-3 text-right">Quantity</th>
                </tr>
              ) : (
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-3">Challan</th>
                  <th className="py-3 px-3">Issued To</th>
                  <th className="py-3 px-3">Fabric</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Colour</th>
                  <th className="py-3 px-3 text-right">Quantity</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading && !stock && <EmptyRow colSpan={7} text="Loading Fabric Store…" />}
              {!loading && shown.length === 0 && <EmptyRow colSpan={7} text={`No ${view} records match these filters`} />}
              {view === 'stock' &&
                shown.map((r) => (
                  <tr key={r.key} className="hover:bg-neutral-50/60">
                    <td className="py-2.5 px-4 font-semibold text-neutral-900">{r.itemName}</td>
                    <td className="py-2.5 px-3"><TypeBadge type={r.fabricType} /></td>
                    <td className="py-2.5 px-3 text-neutral-700">{r.colour || '—'}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{num(r.totalInward)} {r.unit}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{num(r.totalOutward)} {r.unit}</td>
                    <td className={`py-2.5 px-3 text-right tabular-nums whitespace-nowrap font-semibold ${r.balance > 0 ? 'text-neutral-900' : 'text-danger-700'}`}>
                      {num(r.balance)} {r.unit}
                      {r.shortfall > 0 && <span className="block text-[10px] font-medium text-danger-700">Short by {num(r.shortfall)} {r.unit}</span>}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-600 whitespace-nowrap">{fmtDate(r.lastActivity)}</td>
                  </tr>
                ))}
              {view === 'inward' &&
                shown.map((r) => (
                  <tr key={r.id} className="hover:bg-neutral-50/60">
                    <td className="py-2.5 px-4 whitespace-nowrap">{fmtDate(r.receivingDate)}</td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono font-semibold text-neutral-900">{r.billNo}</span>
                      <span className="block text-[11px] text-neutral-500">{fmtDate(r.billDate)}</span>
                    </td>
                    <td className="py-2.5 px-3 text-neutral-700">{r.supplierName || '—'}</td>
                    <td className="py-2.5 px-3 font-semibold text-neutral-900">
                      {r.itemName}
                      {r.rollNumber && <span className="block font-mono text-[11px] font-normal text-neutral-500">Roll {r.rollNumber}</span>}
                    </td>
                    <td className="py-2.5 px-3"><TypeBadge type={r.entryType} /></td>
                    <td className="py-2.5 px-3 text-neutral-700">{r.colour || '—'}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap font-semibold">{num(r.billQty)} {r.unit}</td>
                  </tr>
                ))}
              {view === 'outward' &&
                shown.map((r) => (
                  <tr key={r.id} className="hover:bg-neutral-50/60">
                    <td className="py-2.5 px-4 whitespace-nowrap">{fmtDate(r.date)}</td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-neutral-900">{r.challanNumber}</td>
                    <td className="py-2.5 px-3 text-neutral-700">{departmentName(r.destination) || r.destination}</td>
                    <td className="py-2.5 px-3 font-semibold text-neutral-900">{r.itemName}</td>
                    <td className="py-2.5 px-3"><TypeBadge type={r.fabricType} /></td>
                    <td className="py-2.5 px-3 text-neutral-700">{r.colour || '—'}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap font-semibold">{num(r.quantity)} {r.unit}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <Pager page={page} pageSize={PAGE_SIZE} total={rows.length} onPage={setPage} />
      </section>
    </div>
  );
}
