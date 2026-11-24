'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Download,
  Inbox,
  PackageCheck,
  PackageOpen,
  Printer,
  RefreshCw,
  Shirt,
  Boxes,
  Layers3,
  ChevronRight,
} from 'lucide-react';
import { EmptyRow, THEAD, fetchJson, fmtDate, sheetRef } from '@/components/workflow/WorkflowUi';
import { CategorySelect, GarmentImage, Pager, RecordDrawer, ledgerLabel, pcs } from '@/components/inventory/InventoryUi';
import { ALLOCATION_STATUS_LABEL } from '@/lib/inventory.mjs';
import { CATEGORY_LABEL } from '@/lib/recutting.mjs';
import { departmentName } from '@/lib/workflow-views';
import { printWhenReady } from '@/lib/print-window';

// Admin Console > Inventory: finished garments received from Final QC (always PCS) and how far packing has got,
// factory-wide. Figures come from /api/admin/inventory (records, packing references and the inventory ledger);
// packing itself happens in the Inventory department and in the record drawer, through the Inventory endpoints.

const ADMIN_API = '/api/admin/inventory';
const PAGE_SIZE = 25;

const PACKING_LABEL: Record<string, string> = {
  PENDING_PACKING: 'Pending Packing',
  PARTIALLY_PACKED: 'Partially Packed',
  FULLY_PACKED: 'Fully Packed',
};
const PACKING_TONE: Record<string, string> = {
  PENDING_PACKING: 'bg-accent-100 text-neutral-900',
  PARTIALLY_PACKED: 'bg-brand-100 text-brand-900',
  FULLY_PACKED: 'bg-brand-600 text-white',
};
const ALERT_TONE: Record<string, { box: string; icon: React.ElementType }> = {
  info: { box: 'bg-white border-brand-200 text-neutral-900', icon: Inbox },
  warning: { box: 'bg-accent-50 border-accent-300 text-neutral-900', icon: AlertTriangle },
  danger: { box: 'bg-danger-50 border-danger-200 text-danger-800', icon: AlertCircle },
  success: { box: 'bg-brand-50 border-brand-200 text-brand-900', icon: CheckCircle2 },
};
const HISTORY_TYPES = ['RECEIPT', 'SENT_FOR_PACKING', 'PACKING_STARTED', 'PACKED', 'RETURNED_FROM_PACKING'];

const category = (c: string | null | undefined) => (c ? CATEGORY_LABEL[c as keyof typeof CATEGORY_LABEL] || c : 'Garment');
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] as string);

function PackingBadge({ status }: { status: string }) {
  return <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${PACKING_TONE[status] || 'bg-neutral-100 text-neutral-700'}`}>{PACKING_LABEL[status] || status}</span>;
}

function Progress({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 rounded-full bg-neutral-100 overflow-hidden" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full ${value >= 100 ? 'bg-brand-600' : 'bg-accent-400'}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="text-[11px] font-semibold tabular-nums text-neutral-700 w-11 text-right">{value}%</span>
    </div>
  );
}

function Card({ label, value, sub, icon: Icon }: { label: string; value: string; sub?: string; icon: React.ElementType }) {
  return (
    <div className="bg-white rounded-2xl p-4 ring-1 ring-neutral-200 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-neutral-600">{label}</span>
        <Icon className="w-4 h-4 text-brand-600" aria-hidden="true" />
      </div>
      <p className="mt-2 text-xl font-semibold text-neutral-900 tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-neutral-500 mt-0.5">{sub}</p>}
    </div>
  );
}

/** Print (or save as PDF) one finished-garment record with its packing references and transactions. */
function printRecord(record: any) {
  const w = window.open('', '_blank');
  if (!w) return;
  const s = record.stock;
  const facts: Array<[string, unknown]> = [
    ['Production Sheet', sheetRef(record.program)],
    ['Design', record.program?.designNumber || record.program?.wilcomDesignNumber || '—'],
    ['Serial', record.program?.programSerialNo || '—'],
    ['Client', record.program?.clientName || '—'],
    ['Garment', [category(record.garmentCategory), record.styleRef].filter(Boolean).join(' · ')],
    ['Colour', record.colour || '—'],
    ['Final QC challan', record.inboundChallan?.challanNumber || '—'],
    ['Final Check date', fmtDate(record.inboundChallan?.issuedDate)],
    ['Received in Inventory', `${fmtDate(record.receivedAt, true)}${record.receivedBy ? ` · ${record.receivedBy.fullName}` : ''}`],
    ['Received', pcs(s.received)],
    ['Packed', pcs(s.packed)],
    ['Remaining', pcs(s.remaining)],
    ['Available', pcs(s.available)],
    ['In packing', pcs(s.inPacking)],
    ['On HOLD', pcs(s.held)],
  ];
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(record.itemNumber)} ${esc(sheetRef(record.program))}</title>
<style>
  @page { size: A4; margin: 12mm; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #111; }
  h1 { font-size: 15px; margin: 0 0 2px; } h2 { font-size: 11px; margin: 14px 0 4px; }
  .meta { color: #555; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #bbb; padding: 3px 5px; text-align: left; vertical-align: top; }
  th { background: #eee; font-size: 9px; text-transform: uppercase; }
  .r { text-align: right; }
  .facts td:first-child { width: 32%; color: #555; }
</style></head><body>
<h1>Shubham Fabrics India Pvt. Ltd. · Finished Goods Record</h1>
<div class="meta">${esc(record.itemNumber)} · ${esc(record.garment)} · Printed ${esc(fmtDate(new Date().toISOString(), true))}</div>
<table class="facts"><tbody>${facts.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</tbody></table>
<h2>Packing references</h2>
<table><thead><tr><th>Reference</th><th>Packing date</th><th class="r">Sent</th><th class="r">Packed</th><th class="r">Returned</th><th>Status</th><th>By</th></tr></thead>
<tbody>${(record.allocations || []).map((a: any) => `<tr><td>${esc(a.packingNumber)}</td><td>${esc(fmtDate(a.packingDate))}</td><td class="r">${esc(pcs(a.quantity))}</td><td class="r">${esc(pcs(a.packedQuantity))}</td><td class="r">${esc(pcs(a.returnedQuantity))}</td><td>${esc((ALLOCATION_STATUS_LABEL as Record<string, string>)[a.status] || a.status)}</td><td>${esc(a.createdBy?.fullName || '')}</td></tr>`).join('') || '<tr><td colspan="7">Not sent for packing yet</td></tr>'}</tbody></table>
<h2>Transactions</h2>
<table><thead><tr><th>Date</th><th>Transaction</th><th class="r">Quantity</th><th>Notes</th><th>By</th></tr></thead>
<tbody>${(record.transactions || []).map((t: any) => `<tr><td>${esc(fmtDate(t.createdAt, true))}</td><td>${esc(ledgerLabel(t.entryType))}</td><td class="r">${esc(pcs(t.quantity))}</td><td>${esc(t.notes || '')}</td><td>${esc(t.actor?.fullName || '')}</td></tr>`).join('') || '<tr><td colspan="5">No transactions</td></tr>'}</tbody></table>
</body></html>`);
  w.document.close();
  printWhenReady(w);
}

/** Download one record (details, packing references, transactions) as an Excel workbook. */
async function downloadRecord(record: any) {
  const XLSX = await import('xlsx');
  const book = XLSX.utils.book_new();
  const s = record.stock;
  const add = (name: string, rows: Array<Record<string, unknown>>) =>
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: 'None' }]), name);
  add('Record', [{
    Record: record.itemNumber,
    'Production Sheet': sheetRef(record.program),
    Design: record.program?.designNumber || record.program?.wilcomDesignNumber || '',
    Serial: record.program?.programSerialNo || '',
    Garment: category(record.garmentCategory),
    Style: record.styleRef || '',
    Colour: record.colour || '',
    'Final QC challan': record.inboundChallan?.challanNumber || '',
    'Final Check date': fmtDate(record.inboundChallan?.issuedDate),
    'Received on': fmtDate(record.receivedAt, true),
    'Received (PCS)': s.received,
    'Packed (PCS)': s.packed,
    'Remaining (PCS)': s.remaining,
    'Available (PCS)': s.available,
  }]);
  add('Packing', (record.allocations || []).map((a: any) => ({ Reference: a.packingNumber, 'Packing date': fmtDate(a.packingDate), 'Sent (PCS)': a.quantity, 'Packed (PCS)': a.packedQuantity, 'Returned (PCS)': a.returnedQuantity, Status: (ALLOCATION_STATUS_LABEL as Record<string, string>)[a.status] || a.status })));
  add('Transactions', (record.transactions || []).map((t: any) => ({ Date: fmtDate(t.createdAt, true), Transaction: ledgerLabel(t.entryType), 'Quantity (PCS)': t.quantity, Notes: t.notes || '', By: t.actor?.fullName || '' })));
  XLSX.writeFile(book, `${record.itemNumber}_${sheetRef(record.program)}.xlsx`.replace(/[\\/:*?"<>|\s]+/g, '_'));
}

type Tab = 'sheets' | 'designs' | 'goods' | 'today' | 'history';
const EMPTY_FILTERS = { search: '', category: '', packingStatus: '', from: '', to: '', sort: 'received_desc' };

export function FinishedGoodsPanel({ onOpenSheets }: { onOpenSheets?: (count: number) => void }) {
  const [overview, setOverview] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('sheets');
  const [openId, setOpenId] = useState<string | null>(null);

  // Production Sheets (filtered in the browser: one row per sheet).
  const [sheetSearch, setSheetSearch] = useState('');
  const [sheetStatus, setSheetStatus] = useState('');
  const [designSearch, setDesignSearch] = useState('');

  // Finished goods records (server pages).
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [records, setRecords] = useState<{ data: any[]; total: number }>({ data: [], total: 0 });
  const [recordsLoading, setRecordsLoading] = useState(false);

  // Packing history (the inventory ledger).
  const [history, setHistory] = useState<{ data: any[]; total: number }>({ data: [], total: 0 });
  const [historyFilters, setHistoryFilters] = useState({ type: '', search: '', from: '', to: '' });
  const [historyPage, setHistoryPage] = useState(1);

  const loadOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const body = await fetchJson(`${ADMIN_API}?view=overview`);
      setOverview(body);
      onOpenSheets?.(body.counts.pendingSheets + body.counts.partialSheets);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const recordQuery = (f: typeof EMPTY_FILTERS, p: number, pageSize = PAGE_SIZE) => {
    const q = new URLSearchParams({ view: 'records', page: String(p), pageSize: String(pageSize) });
    Object.entries(f).forEach(([k, v]) => v && q.set(k, v));
    return `${ADMIN_API}?${q}`;
  };
  const loadRecords = async (f = applied, p = page) => {
    setRecordsLoading(true);
    try {
      const body = await fetchJson(recordQuery(f, p));
      setRecords({ data: body.data || [], total: body.total || 0 });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRecordsLoading(false);
    }
  };

  const loadHistory = async (f = historyFilters, p = historyPage) => {
    try {
      const q = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
      Object.entries(f).forEach(([k, v]) => v && q.set(k, v));
      const body = await fetchJson(`/api/inventory/transactions?${q}`);
      setHistory({ data: body.data || [], total: body.total || 0 });
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (tab === 'goods') loadRecords();
    if (tab === 'history') loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const refreshAll = () => {
    loadOverview();
    if (tab === 'goods') loadRecords();
    if (tab === 'history') loadHistory();
  };

  const applyFilters = (f: typeof EMPTY_FILTERS) => {
    setFilters(f);
    setApplied(f);
    setPage(1);
    loadRecords(f, 1);
  };
  const showSheetGarments = (sheet: any) => {
    const f = { ...EMPTY_FILTERS, search: sheet.program?.programSerialNo || sheet.program?.programNumber || '' };
    setTab('goods');
    applyFilters(f);
  };

  const exportExcel = async () => {
    const XLSX = await import('xlsx');
    const body = await fetchJson(recordQuery(applied, 1, 2000)).catch((e: any) => {
      setError(e.message);
      return null;
    });
    const book = XLSX.utils.book_new();
    const add = (name: string, rows: Array<Record<string, unknown>>) =>
      XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: 'No records' }]), name);
    const t = overview?.totals;
    if (t) {
      add('Summary', [
        { Metric: 'Total finished clothes (PCS)', Value: t.received },
        { Metric: 'Total packed (PCS)', Value: t.packed },
        { Metric: 'Pending packing (PCS)', Value: t.pendingPacking },
        { Metric: 'Available stock (PCS)', Value: t.available },
        { Metric: 'Total packing batches', Value: t.batches },
        { Metric: "Today's packing (PCS)", Value: t.todayPacked },
        { Metric: 'Generated', Value: fmtDate(overview.generatedAt, true) },
      ]);
      add('Production Sheets', overview.sheets.map((r: any) => ({
        'Production Sheet': sheetRef(r.program),
        Design: r.program?.designNumber || '',
        Client: r.program?.clientName || '',
        'Received (PCS)': r.received,
        'Packed (PCS)': r.packed,
        'Remaining (PCS)': r.remaining,
        'Progress %': r.progress,
        Status: PACKING_LABEL[r.packingStatus],
        'Packing batches': r.batches.join(', '),
        'Latest packing date': fmtDate(r.latestPackingDate),
      })));
    }
    if (overview?.designs) {
      add('Design & Department-wise', overview.designs.map((d: any) => ({
        Design: d.design,
        'Production Sheets': d.sheets.map((p: any) => sheetRef(p)).join(', '),
        ...Object.fromEntries(overview.stages.flatMap((st: string) => [[`${stageName(st)} received (PCS)`, d.stages[st].received], [`${stageName(st)} awaiting (PCS)`, d.stages[st].awaiting]])),
        'Packed (PCS)': d.packed,
        'Remaining to pack (PCS)': d.remaining,
        'Packing %': d.progress,
      })));
    }
    add('Finished Goods', (body?.data || []).map((r: any) => ({
      'Production Sheet': sheetRef(r.program),
      Design: r.program?.designNumber || r.program?.wilcomDesignNumber || '',
      Serial: r.program?.programSerialNo || '',
      Garment: category(r.garmentCategory),
      Style: r.styleRef || '',
      Size: r.size || '',
      Colour: r.colour || '',
      'Finished (PCS)': r.stock.received,
      'Packed (PCS)': r.stock.packed,
      'Remaining (PCS)': r.stock.remaining,
      'Final Check date': fmtDate(r.finalCheckDate),
      'Received in Inventory': fmtDate(r.receivedAt),
      Status: PACKING_LABEL[r.packingStatus],
    })));
    XLSX.writeFile(book, `Finished_Goods_Inventory_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const t = overview?.totals;
  const c = overview?.counts;
  const sq = sheetSearch.trim().toLowerCase();
  const sheets: any[] = (overview?.sheets || []).filter(
    (r: any) =>
      (!sheetStatus || r.packingStatus === sheetStatus) &&
      (!sq || [r.program?.programSerialNo, r.program?.programNumber, r.program?.designNumber, r.program?.wilcomDesignNumber, r.program?.clientName].some((v) => String(v || '').toLowerCase().includes(sq))),
  );
  const dq = designSearch.trim().toLowerCase();
  const designs: any[] = (overview?.designs || []).filter(
    (d: any) => !dq || [d.design, ...d.sheets.flatMap((p: any) => [p?.programSerialNo, p?.programNumber, p?.clientName])].some((v) => String(v || '').toLowerCase().includes(dq)),
  );
  const stages: string[] = overview?.stages || [];
  const stageName = (code: string) => (code === 'INVENTORY' ? 'Inventory' : departmentName(code).replace(/ Department$/, ''));
  const field = 'h-9 px-2.5 border border-neutral-300 rounded-lg text-xs text-neutral-900 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 w-full';
  const label = 'block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1';
  const TABS: Array<{ id: Tab; label: string; count?: number }> = [
    { id: 'sheets', label: 'Production Sheets', count: c?.sheets },
    { id: 'designs', label: 'Design & Department-wise', count: overview?.designs?.length },
    { id: 'goods', label: 'Finished Goods', count: c?.records },
    { id: 'today', label: "Today's Packing", count: overview?.today?.length },
    { id: 'history', label: 'Packing History' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-brand-600" />
            Finished Goods Inventory
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/inventory" className="inline-flex items-center gap-1.5 h-8 px-3 bg-white hover:bg-neutral-50 text-neutral-800 rounded-lg text-xs font-semibold ring-1 ring-neutral-300">
            <Boxes className="w-3.5 h-3.5" /> Open Inventory
          </Link>
          <button type="button" onClick={exportExcel} disabled={!overview} className="inline-flex items-center gap-1.5 h-8 px-3 bg-white hover:bg-neutral-50 text-neutral-800 rounded-lg text-xs font-semibold ring-1 ring-neutral-300 disabled:opacity-50">
            <Download className="w-3.5 h-3.5" /> Excel
          </button>
          <button type="button" onClick={refreshAll} disabled={loading} className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-danger-50 border border-danger-200 text-xs text-danger-800">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} className="font-bold underline">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <Card label="Total Finished Clothes" value={t ? pcs(t.received) : '—'} sub="Received from Final Check" icon={Shirt} />
        <Card label="Total Packed" value={t ? pcs(t.packed) : '—'} sub={c ? `${c.packedSheets} sheet${c.packedSheets === 1 ? '' : 's'} fully packed` : undefined} icon={PackageCheck} />
        <Card label="Pending Packing" value={t ? pcs(t.pendingPacking) : '—'} sub={t ? `${pcs(t.inPacking)} in packing now` : undefined} icon={PackageOpen} />
        <Card label="Available Stock" value={t ? pcs(t.available) : '—'} sub={t?.held ? `${pcs(t.held)} on HOLD` : 'Ready to send for packing'} icon={Boxes} />
        <Card label="Packing Batches" value={t ? t.batches.toLocaleString('en-IN') : '—'} sub={t ? `${t.openBatches} still open` : undefined} icon={Layers3} />
        <Card label="Today's Packing" value={t ? pcs(t.todayPacked) : '—'} sub={t ? `${t.todayBatches} new batch${t.todayBatches === 1 ? '' : 'es'} today` : undefined} icon={CalendarCheck} />
      </div>

      {overview?.alerts?.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {overview.alerts.map((a: any) => {
            const tone = ALERT_TONE[a.tone] || ALERT_TONE.info;
            const Icon = tone.icon;
            return (
              <div key={a.key} className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border text-xs ${tone.box}`}>
                <Icon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-semibold">{a.title}</p>
                  <p className="opacity-80 mt-0.5">{a.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <section className="bg-white border border-neutral-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-4 pt-3 border-b border-neutral-200 overflow-x-auto">
          <div className="flex gap-1 w-max" role="tablist" aria-label="Inventory views">
            {TABS.map((v) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={tab === v.id}
                onClick={() => setTab(v.id)}
                className={`px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 -mb-px transition ${tab === v.id ? 'border-brand-600 text-brand-800' : 'border-transparent text-neutral-500 hover:text-neutral-800'}`}
              >
                {v.label}
                {v.count !== undefined && <span className="tabular-nums text-neutral-400"> ({v.count})</span>}
              </button>
            ))}
          </div>
        </div>

        {/* PRODUCTION SHEETS: packing progress per sheet */}
        {tab === 'sheets' && (
          <>
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 border-b border-neutral-100">
              <div className="col-span-2">
                <label className={label} htmlFor="fg-sheet-search">Search</label>
                <input id="fg-sheet-search" value={sheetSearch} onChange={(e) => setSheetSearch(e.target.value)} placeholder="Production Sheet, serial, design or client" className={field} />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className={label} htmlFor="fg-sheet-status">Packing status</label>
                <select id="fg-sheet-status" value={sheetStatus} onChange={(e) => setSheetStatus(e.target.value)} className={field}>
                  <option value="">All</option>
                  {Object.entries(PACKING_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={THEAD}>
                  <tr>
                    <th className="py-3 px-4">Production Sheet</th>
                    <th className="py-3 px-3 text-right">Received</th>
                    <th className="py-3 px-3 text-right">Packed</th>
                    <th className="py-3 px-3 text-right">Remaining</th>
                    <th className="py-3 px-3">Packing Progress</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Packing Batches</th>
                    <th className="py-3 px-3">Last Packing</th>
                    <th className="py-3 px-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {loading && !overview && <EmptyRow colSpan={9} text="Loading inventory…" />}
                  {overview && sheets.length === 0 && <EmptyRow colSpan={9} text="No Production Sheets have finished garments in Inventory yet" />}
                  {sheets.map((r) => (
                    <tr key={r.programId} className="hover:bg-neutral-50/60 align-top">
                      <td className="py-2.5 px-4">
                        <Link href={`/programs/${r.programId}`} className="font-mono font-semibold text-brand-800 hover:underline">{sheetRef(r.program)}</Link>
                        <span className="block text-neutral-700">Design {r.program?.designNumber || r.program?.wilcomDesignNumber || '—'}</span>
                        {r.program?.clientName && <span className="block text-[11px] text-neutral-500">{r.program.clientName}</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{pcs(r.received)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{pcs(r.packed)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap font-semibold">{pcs(r.remaining)}</td>
                      <td className="py-2.5 px-3"><Progress value={r.progress} /></td>
                      <td className="py-2.5 px-3"><PackingBadge status={r.packingStatus} /></td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-neutral-700">
                        {r.batches.length === 0 ? '—' : r.batches.slice(0, 2).join(', ')}
                        {r.batches.length > 2 && <span className="block font-sans text-neutral-500">+{r.batches.length - 2} more</span>}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-neutral-600">{fmtDate(r.latestPackingDate)}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button type="button" onClick={() => showSheetGarments(r)} className="text-xs font-semibold text-brand-700 hover:underline whitespace-nowrap">View garments</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* DESIGN & DEPARTMENT-WISE: garment pieces received at each stage, per design */}
        {tab === 'designs' && (
          <>
            <div className="p-4 border-b border-neutral-100 space-y-3">
              <div className="flex flex-wrap items-stretch gap-1.5">
                {stages.map((st, i) => (
                  <React.Fragment key={st}>
                    <div className={`flex-1 min-w-[120px] rounded-xl px-3 py-2.5 ring-1 ${st === 'INVENTORY' ? 'bg-brand-50 ring-brand-100' : 'bg-neutral-50 ring-neutral-200'}`}>
                      <p className="text-[11px] font-semibold text-neutral-600">{stageName(st)}</p>
                      <p className="text-sm font-semibold text-neutral-900 tabular-nums">{pcs(overview?.departments?.[st]?.received)}</p>
                      <p className="text-[10px] text-neutral-500 tabular-nums">
                        {overview?.departments?.[st]?.awaiting ? `${pcs(overview.departments[st].awaiting)} awaiting receipt` : 'received'}
                      </p>
                    </div>
                    {i < stages.length - 1 && <ChevronRight className="hidden md:block w-4 h-4 self-center text-neutral-300 shrink-0" aria-hidden="true" />}
                  </React.Fragment>
                ))}
              </div>
              <div className="max-w-md">
                <label className={label} htmlFor="fg-design-search">Search</label>
                <input id="fg-design-search" value={designSearch} onChange={(e) => setDesignSearch(e.target.value)} placeholder="Design number, Production Sheet or client" className={field} />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={THEAD}>
                  <tr>
                    <th className="py-3 px-4">Design</th>
                    {stages.map((st) => <th key={st} className="py-3 px-3 text-right">{stageName(st)}</th>)}
                    <th className="py-3 px-3 text-right">Packed</th>
                    <th className="py-3 px-3">Packing Progress</th>
                    <th className="py-3 px-3">Last Received</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {overview && designs.length === 0 && <EmptyRow colSpan={stages.length + 4} text="No garments have reached Stitching or later yet" />}
                  {designs.map((d) => (
                    <tr key={d.design} className="hover:bg-neutral-50/60 align-top">
                      <td className="py-2.5 px-4">
                        <span className="font-semibold text-neutral-900">{d.design}</span>
                        <span className="block font-mono text-[11px] text-neutral-500">{d.sheets.map((p: any) => sheetRef(p)).join(', ')}</span>
                      </td>
                      {stages.map((st) => (
                        <td key={st} className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                          {d.stages[st].received ? pcs(d.stages[st].received) : <span className="text-neutral-300">—</span>}
                          {d.stages[st].awaiting > 0 && <span className="block text-[10px] text-neutral-500">+{pcs(d.stages[st].awaiting)} awaiting</span>}
                        </td>
                      ))}
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{pcs(d.packed)}</td>
                      <td className="py-2.5 px-3">{d.packingStatus ? <Progress value={d.progress} /> : <span className="text-neutral-400">Not in Inventory yet</span>}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-neutral-600">{fmtDate(d.lastActivityAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* FINISHED GOODS: one row per received garment line */}
        {tab === 'goods' && (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                applyFilters(filters);
              }}
              className="p-4 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 border-b border-neutral-100"
            >
              <div className="col-span-2">
                <label className={label} htmlFor="fg-search">Search</label>
                <input id="fg-search" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Production Sheet, design or serial number" className={field} />
              </div>
              <div>
                <span className={label}>Garment type</span>
                <CategorySelect value={filters.category} onChange={(v) => setFilters({ ...filters, category: v })} />
              </div>
              <div>
                <label className={label} htmlFor="fg-status">Packing status</label>
                <select id="fg-status" value={filters.packingStatus} onChange={(e) => setFilters({ ...filters, packingStatus: e.target.value })} className={field}>
                  <option value="">All</option>
                  {Object.entries(PACKING_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className={label} htmlFor="fg-from">Received from</label>
                <input id="fg-from" type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className={field} />
              </div>
              <div>
                <label className={label} htmlFor="fg-to">Received to</label>
                <input id="fg-to" type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className={field} />
              </div>
              <div>
                <label className={label} htmlFor="fg-sort">Sort by</label>
                <select id="fg-sort" value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })} className={field}>
                  <option value="received_desc">Newest received</option>
                  <option value="received_asc">Oldest received</option>
                  <option value="final_check">Latest Final Check</option>
                  <option value="sheet">Production Sheet</option>
                  <option value="design">Design number</option>
                  <option value="remaining">Most still to pack</option>
                  <option value="progress">Least packed</option>
                </select>
              </div>
              <div className="col-span-2 md:col-span-4 xl:col-span-7 flex justify-end gap-2">
                <button type="button" onClick={() => applyFilters(EMPTY_FILTERS)} className="h-8 px-3 rounded-lg text-xs font-semibold text-neutral-700 ring-1 ring-neutral-300 hover:bg-neutral-50">Reset</button>
                <button type="submit" className="h-8 px-4 rounded-lg text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700">Apply</button>
              </div>
            </form>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={THEAD}>
                  <tr>
                    <th className="py-3 px-4">Image</th>
                    <th className="py-3 px-3">Production Sheet</th>
                    <th className="py-3 px-3">Design / Serial</th>
                    <th className="py-3 px-3">Garment</th>
                    <th className="py-3 px-3">Size</th>
                    <th className="py-3 px-3">Colour</th>
                    <th className="py-3 px-3 text-right">Finished</th>
                    <th className="py-3 px-3 text-right">Packed</th>
                    <th className="py-3 px-3 text-right">Remaining</th>
                    <th className="py-3 px-3">Final Check</th>
                    <th className="py-3 px-3">Received</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {recordsLoading && records.data.length === 0 && <EmptyRow colSpan={13} text="Loading finished goods…" />}
                  {!recordsLoading && records.data.length === 0 && <EmptyRow colSpan={13} text="No finished garments match these filters" />}
                  {records.data.map((r) => (
                    <tr key={r.id} className="hover:bg-neutral-50/60 align-top">
                      <td className="py-2.5 px-4"><GarmentImage image={r.image} alt={r.garment} /></td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-neutral-900 whitespace-nowrap">{sheetRef(r.program)}</td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-neutral-900">{r.program?.designNumber || r.program?.wilcomDesignNumber || '—'}</span>
                        <span className="block font-mono text-[11px] text-neutral-500">{r.program?.programSerialNo || '—'}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-neutral-900">{category(r.garmentCategory)}</span>
                        {r.styleRef && <span className="block text-neutral-500">{r.styleRef}</span>}
                      </td>
                      <td className="py-2.5 px-3 text-neutral-700">{r.size || '—'}</td>
                      <td className="py-2.5 px-3 text-neutral-700">{r.colour || '—'}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{pcs(r.stock.received)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{pcs(r.stock.packed)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap font-semibold">{pcs(r.stock.remaining)}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-neutral-600">{fmtDate(r.finalCheckDate)}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-neutral-600">{fmtDate(r.receivedAt)}</td>
                      <td className="py-2.5 px-3">
                        <PackingBadge status={r.packingStatus} />
                        <div className="mt-1.5"><Progress value={r.progress} /></div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button type="button" onClick={() => setOpenId(r.id)} className="text-xs font-semibold text-brand-700 hover:underline">View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager
              page={page}
              pageSize={PAGE_SIZE}
              total={records.total}
              onPage={(p) => {
                setPage(p);
                loadRecords(applied, p);
              }}
            />
          </>
        )}

        {/* TODAY'S PACKING: every packing movement posted today */}
        {tab === 'today' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={THEAD}>
                <tr>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-3">Activity</th>
                  <th className="py-3 px-3">Batch</th>
                  <th className="py-3 px-3">Production Sheet</th>
                  <th className="py-3 px-3">Garment</th>
                  <th className="py-3 px-3 text-right">Quantity</th>
                  <th className="py-3 px-3">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {(overview?.today || []).length === 0 && <EmptyRow colSpan={7} text="No packing activity yet today" />}
                {(overview?.today || []).map((e: any) => (
                  <tr key={e.id} className="hover:bg-neutral-50/60">
                    <td className="py-2.5 px-4 whitespace-nowrap text-neutral-600">{new Date(e.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="py-2.5 px-3 font-semibold text-neutral-900">{ledgerLabel(e.entryType)}</td>
                    <td className="py-2.5 px-3 font-mono">{e.reference || '—'}</td>
                    <td className="py-2.5 px-3 font-mono">{sheetRef(e.program)}</td>
                    <td className="py-2.5 px-3 text-neutral-700">{e.itemName}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{e.quantity ? pcs(Math.abs(e.quantity)) : '—'}</td>
                    <td className="py-2.5 px-3 text-neutral-600">{e.actor?.fullName || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PACKING HISTORY: the full inventory ledger */}
        {tab === 'history' && (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setHistoryPage(1);
                loadHistory(historyFilters, 1);
              }}
              className="p-4 grid grid-cols-2 md:grid-cols-5 gap-3 border-b border-neutral-100"
            >
              <div className="col-span-2">
                <label className={label} htmlFor="fg-h-search">Search</label>
                <input id="fg-h-search" value={historyFilters.search} onChange={(e) => setHistoryFilters({ ...historyFilters, search: e.target.value })} placeholder="Batch, sheet, design or garment" className={field} />
              </div>
              <div>
                <label className={label} htmlFor="fg-h-type">Transaction</label>
                <select id="fg-h-type" value={historyFilters.type} onChange={(e) => setHistoryFilters({ ...historyFilters, type: e.target.value })} className={field}>
                  <option value="">All</option>
                  {HISTORY_TYPES.map((type) => <option key={type} value={type}>{ledgerLabel(type)}</option>)}
                </select>
              </div>
              <div>
                <label className={label} htmlFor="fg-h-from">From</label>
                <input id="fg-h-from" type="date" value={historyFilters.from} onChange={(e) => setHistoryFilters({ ...historyFilters, from: e.target.value })} className={field} />
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className={label} htmlFor="fg-h-to">To</label>
                  <input id="fg-h-to" type="date" value={historyFilters.to} onChange={(e) => setHistoryFilters({ ...historyFilters, to: e.target.value })} className={field} />
                </div>
                <button type="submit" className="h-9 px-3 rounded-lg text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700">Apply</button>
              </div>
            </form>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={THEAD}>
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-3">Transaction</th>
                    <th className="py-3 px-3">Reference</th>
                    <th className="py-3 px-3">Production Sheet</th>
                    <th className="py-3 px-3">Garment</th>
                    <th className="py-3 px-3 text-right">Quantity</th>
                    <th className="py-3 px-3">Notes</th>
                    <th className="py-3 px-3">By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {history.data.length === 0 && <EmptyRow colSpan={8} text="No inventory transactions match these filters" />}
                  {history.data.map((e) => (
                    <tr key={e.id} className="hover:bg-neutral-50/60 align-top">
                      <td className="py-2.5 px-4 whitespace-nowrap text-neutral-600">{fmtDate(e.createdAt, true)}</td>
                      <td className="py-2.5 px-3 font-semibold text-neutral-900 whitespace-nowrap">{ledgerLabel(e.entryType)}</td>
                      <td className="py-2.5 px-3 font-mono">{e.reference || '—'}</td>
                      <td className="py-2.5 px-3 font-mono">{e.program ? sheetRef(e.program) : '—'}</td>
                      <td className="py-2.5 px-3 text-neutral-700">{e.itemName}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{e.quantity ? `${e.quantity > 0 && e.entryType !== 'PACKED' ? '+' : ''}${pcs(e.quantity)}` : '—'}</td>
                      <td className="py-2.5 px-3 text-neutral-500 max-w-xs">{e.notes || ''}</td>
                      <td className="py-2.5 px-3 text-neutral-600">{e.actor?.fullName || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager
              page={historyPage}
              pageSize={PAGE_SIZE}
              total={history.total}
              onPage={(p) => {
                setHistoryPage(p);
                loadHistory(historyFilters, p);
              }}
            />
          </>
        )}
      </section>

      {openId && (
        <RecordDrawer
          id={openId}
          onClose={() => setOpenId(null)}
          onChanged={refreshAll}
          extraActions={(record) => (
            <>
              <button type="button" onClick={() => printRecord(record)} className="inline-flex items-center gap-1.5 h-8 px-3 bg-white hover:bg-neutral-50 text-neutral-800 rounded-lg text-xs font-semibold ring-1 ring-neutral-300">
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
              <button type="button" onClick={() => downloadRecord(record)} className="inline-flex items-center gap-1.5 h-8 px-3 bg-white hover:bg-neutral-50 text-neutral-800 rounded-lg text-xs font-semibold ring-1 ring-neutral-300">
                <Download className="w-3.5 h-3.5" /> Download
              </button>
            </>
          )}
        />
      )}
    </div>
  );
}
