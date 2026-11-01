'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  PauseCircle,
  X,
} from 'lucide-react';
import { printWhenReady } from '@/lib/print-window';

// Admin: factory-wide REJECTED, REWORK and HOLD fabric (GET /api/admin/quality-monitor). Read-only. Every
// figure comes from the records the API returns; MTR and PCS are always shown separately.

export type MonitorKind = 'REJECT' | 'REWORK' | 'HOLD';
type Totals = Record<string, number>;

interface MonitorRecord {
  id: string;
  kind: MonitorKind;
  source: string;
  date: string;
  departmentCode: string;
  qcDepartmentCode: string | null;
  sourceDepartmentCode: string | null;
  reworkToCode: string | null;
  programId: string | null;
  productionSheetNumber: string;
  serialNumber: string;
  designNumber: string;
  clientName: string;
  style: string | null;
  fabricName: string;
  colour: string | null;
  shade: string | null;
  quantity: number;
  unit: string;
  sentQuantity: number | null;
  remainingQuantity: number | null;
  reason: string;
  remarks: string | null;
  status: string;
  statusLabel: string;
  active: boolean;
  location: string;
  references: string[];
  challanId: string | null;
  recordedBy: string | null;
  releasedAt: string | null;
}

interface SummaryBlock { records: number; quantity: Totals; departments: number; productionSheets: number; open: number }
interface MonitorSummary {
  REJECT: SummaryBlock;
  REWORK: SummaryBlock & { pending: number; inProgress: number; completed: number };
  HOLD: SummaryBlock & { onHold: number; blockedQuantity: Totals };
}
interface DepartmentRow {
  code: string; name: string;
  rejected: Totals; rejectCount: number;
  reworkMarked: Totals; reworkMarkedCount: number;
  reworkAssigned: Totals; reworkAssignedCount: number;
  hold: Totals; holdCount: number; holdBlocked: Totals;
}
type Option = { value: string; label: string };
interface MonitorResponse {
  records: MonitorRecord[];
  summary: MonitorSummary;
  departments: DepartmentRow[];
  counts: Record<MonitorKind, number>;
  options: {
    departments: Option[]; qcDepartments: Option[]; sourceDepartments: Option[];
    units: string[]; styles: string[]; clients: string[];
    statuses: Record<MonitorKind, Option[]>;
  };
  generatedAt: string;
}

const KIND_META: Record<MonitorKind, { title: string; noun: string; icon: React.ElementType }> = {
  REJECT: { title: 'Rejected Fabric', noun: 'rejected', icon: ShieldAlert },
  REWORK: { title: 'Rework Fabric', noun: 'rework', icon: RotateCcw },
  HOLD: { title: 'Hold Fabric', noun: 'hold', icon: PauseCircle },
};

const DEPT_NAMES: Record<string, string> = {
  STORE: 'Fabric Store', DYEING: 'Dyeing', QC1: 'Dyeing QC', EMBROIDERY: 'Embroidery', THREAD_CUTTING: 'Thread Cutting',
  QC2: 'Threadcut QC', WASHING: 'Washing', QC3: 'Washing QC', RECUTTING: 'Recutting', STITCHING: 'Stitching',
  FINISHING: 'Finishing', STEAM_PRESS: 'Steam Press', FINAL_CHECK: 'Final QC', INVENTORY: 'Inventory',
};
/** Department-wise columns of one kind: label and the figures it reads. */
const DEPT_COLUMNS: Record<MonitorKind, Array<{ label: string; pick: (d: DepartmentRow) => Totals }>> = {
  REJECT: [{ label: 'Rejected', pick: (d) => d.rejected }],
  REWORK: [
    { label: 'Rework marked (QC)', pick: (d) => d.reworkMarked },
    { label: 'Rework assigned (sent back)', pick: (d) => d.reworkAssigned },
  ],
  HOLD: [
    { label: 'Hold (total)', pick: (d) => d.hold },
    { label: 'Currently on hold', pick: (d) => d.holdBlocked },
  ],
};
const hasAny = (t: Totals) => Object.values(t || {}).some((v) => v);
/** Departments with records of this kind only. */
const departmentsOf = (rows: DepartmentRow[] | undefined, kind: MonitorKind) => (rows || []).filter((d) => DEPT_COLUMNS[kind].some((c) => hasAny(c.pick(d))));

const dept = (code: string | null | undefined) => (code ? DEPT_NAMES[code] || code.replace(/_/g, ' ') : '—');

const EMPTY_FILTERS = {
  q: '', from: '', to: '', department: '', qcDepartment: '', sourceDepartment: '', design: '', style: '',
  serial: '', client: '', fabric: '', colour: '', status: '', unit: '', reason: '',
};
type Filters = typeof EMPTY_FILTERS;

const PAGE_SIZE = 25;
const qty = (n: number | null | undefined) => (n == null ? '—' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: 3 }));
const totalsText = (t: Totals | null | undefined, empty = '—') => {
  const e = Object.entries(t || {}).filter(([, v]) => v);
  return e.length ? e.map(([u, v]) => `${qty(v)} ${u}`).join(' · ') : empty;
};
const dateTime = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const dateOnly = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function TotalsCell({ totals }: { totals: Totals | null | undefined }) {
  const e = Object.entries(totals || {}).filter(([, v]) => v);
  if (!e.length) return <span className="text-neutral-400">—</span>;
  return (
    <span className="whitespace-nowrap tabular-nums">
      {e.map(([u, v], i) => (
        <span key={u}>
          {i > 0 && <span className="text-neutral-300"> · </span>}
          <span className="font-bold text-neutral-900">{qty(v)}</span> <span className="text-[10px] font-semibold text-neutral-500">{u}</span>
        </span>
      ))}
    </span>
  );
}

function StatusPill({ record }: { record: MonitorRecord }) {
  const tone = !record.active
    ? 'bg-accent-100 text-neutral-900 border-accent-300'
    : record.status === 'PENDING' || record.status === 'AT_DEPARTMENT'
      ? 'bg-danger-50 text-danger-700 border-danger-200'
      : 'bg-brand-50 text-brand-800 border-brand-200';
  return <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold whitespace-nowrap ${tone}`}>{record.statusLabel}</span>;
}

// ---------------------------------------------------------------- columns (table, Excel and print share them)

interface Column {
  key: string;
  label: string;
  value: (r: MonitorRecord, i: number) => string | number;
  render?: (r: MonitorRecord, i: number) => React.ReactNode;
  align?: 'right';
  sort?: (r: MonitorRecord) => string | number;
}

const colourShade = (r: MonitorRecord) => [r.colour, r.shade && r.shade !== r.colour ? `Shade: ${r.shade}` : null].filter(Boolean).join(' · ') || '—';

function columnsFor(kind: MonitorKind): Column[] {
  const sNo: Column = { key: 'sno', label: 'S.No.', value: (_r, i) => i + 1 };
  const date = (label: string): Column => ({ key: 'date', label, value: (r) => dateTime(r.date), sort: (r) => r.date });
  const design: Column = { key: 'design', label: 'Design Number', value: (r) => r.designNumber, sort: (r) => r.designNumber };
  const style: Column = { key: 'style', label: 'Style', value: (r) => r.style || '—' };
  const serial: Column = { key: 'serial', label: 'Production Serial', value: (r) => r.serialNumber, sort: (r) => r.serialNumber };
  const client: Column = { key: 'client', label: 'Client Name', value: (r) => r.clientName, sort: (r) => r.clientName };
  const fabric: Column = { key: 'fabric', label: 'Fabric Name', value: (r) => r.fabricName, sort: (r) => r.fabricName };
  const unit: Column = { key: 'unit', label: 'Unit', value: (r) => r.unit };
  const reference: Column = { key: 'reference', label: 'Reference', value: (r) => [r.productionSheetNumber, ...r.references].join(' | ') };
  const quantity = (label: string): Column => ({
    key: 'qty', label, align: 'right', value: (r) => r.quantity, sort: (r) => r.quantity,
    render: (r) => <span className="font-bold text-neutral-900 tabular-nums">{qty(r.quantity)}</span>,
  });
  const status: Column = { key: 'status', label: 'Status', value: (r) => r.statusLabel, render: (r) => <StatusPill record={r} />, sort: (r) => r.statusLabel };
  if (kind === 'REJECT') {
    return [
      sNo, date('Rejection Date'),
      { key: 'dept', label: 'Department', value: (r) => dept(r.departmentCode), sort: (r) => dept(r.departmentCode) },
      { key: 'qc', label: 'QC Stage', value: (r) => (r.qcDepartmentCode ? dept(r.qcDepartmentCode) : 'Recorded by department') },
      { key: 'src', label: 'Source Department', value: (r) => dept(r.sourceDepartmentCode) },
      design, style, serial, client, fabric,
      { key: 'colour', label: 'Colour', value: (r) => r.colour || '—' },
      { key: 'shade', label: 'Shade', value: (r) => r.shade || '—' },
      quantity('Rejected Quantity'), unit,
      { key: 'reason', label: 'Rejection Reason', value: (r) => r.reason },
      { key: 'location', label: 'Current Location', value: (r) => r.location },
      status, reference,
    ];
  }
  if (kind === 'REWORK') {
    return [
      sNo, date('Rework Date'),
      { key: 'qc', label: 'QC Department', value: (r) => dept(r.qcDepartmentCode), sort: (r) => dept(r.qcDepartmentCode) },
      { key: 'src', label: 'Source Department', value: (r) => dept(r.sourceDepartmentCode) },
      { key: 'to', label: 'Rework Assigned To', value: (r) => dept(r.reworkToCode), sort: (r) => dept(r.reworkToCode) },
      design, style, serial, client, fabric,
      { key: 'colour', label: 'Colour / Shade', value: colourShade },
      quantity('Rework Quantity'), unit,
      { key: 'reason', label: 'Rework Reason', value: (r) => r.reason },
      { ...status, label: 'Rework Status' },
      { key: 'location', label: 'Current Location', value: (r) => r.location },
      reference,
    ];
  }
  return [
    sNo, date('Hold Date'),
    { key: 'dept', label: 'Department', value: (r) => dept(r.departmentCode), sort: (r) => dept(r.departmentCode) },
    design, style, serial, client, fabric,
    { key: 'colour', label: 'Colour / Shade', value: colourShade },
    quantity('Hold Quantity'),
    {
      key: 'remaining', label: 'Still on Hold', align: 'right', value: (r) => (r.active ? r.remainingQuantity ?? 0 : 0), sort: (r) => r.remainingQuantity ?? 0,
      render: (r) => <span className="tabular-nums">{r.active ? qty(r.remainingQuantity) : '0'}</span>,
    },
    unit,
    { key: 'reason', label: 'Hold Reason', value: (r) => r.reason },
    { key: 'location', label: 'Current Location', value: (r) => r.location },
    { ...status, label: 'Hold Status' },
    { key: 'released', label: 'Released Date', value: (r) => (r.active ? '—' : dateOnly(r.releasedAt)), sort: (r) => r.releasedAt || '' },
    { key: 'reference', label: 'Reference', value: (r) => [r.productionSheetNumber, ...r.references].join(' | ') },
  ];
}

// ---------------------------------------------------------------- grouped reports (Excel and print)

type GroupBy = 'department' | 'date' | 'client' | 'design';
const GROUPS: Record<GroupBy, { label: string; key: (r: MonitorRecord) => string }> = {
  department: { label: 'Department', key: (r) => dept(r.departmentCode) },
  date: { label: 'Date', key: (r) => r.date.slice(0, 10) },
  client: { label: 'Client', key: (r) => r.clientName },
  design: { label: 'Design Number', key: (r) => r.designNumber },
};

function groupRows(records: MonitorRecord[], by: GroupBy) {
  const units = Array.from(new Set(records.map((r) => r.unit))).sort();
  const map = new Map<string, { count: number; totals: Totals; open: number }>();
  for (const r of records) {
    const k = GROUPS[by].key(r) || '—';
    const row = map.get(k) || { count: 0, totals: {}, open: 0 };
    row.count++;
    if (r.active) row.open++;
    row.totals[r.unit] = Math.round(((row.totals[r.unit] || 0) + r.quantity) * 1000) / 1000;
    map.set(k, row);
  }
  const rows = Array.from(map.entries()).sort((a, b) => (by === 'date' ? b[0].localeCompare(a[0]) : a[0].localeCompare(b[0])));
  return { units, rows };
}

// ---------------------------------------------------------------- panel

export function QualityMonitorPanel({ kind, onKindChange, onCounts }: {
  kind: MonitorKind;
  onKindChange: (kind: MonitorKind) => void;
  onCounts?: (counts: Record<MonitorKind, number>) => void;
}) {
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [data, setData] = useState<MonitorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'date', dir: 'desc' });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [drillDept, setDrillDept] = useState<string | null>(null);
  const [reportBy, setReportBy] = useState<GroupBy>('department');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ kind });
      for (const [k, v] of Object.entries(applied)) if (v.trim()) params.set(k, v.trim());
      const res = await fetch(`/api/admin/quality-monitor?${params.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not load the records.');
      setData(json);
      onCounts?.(json.counts);
    } catch (e: any) {
      setError(e.message || 'Could not load the records.');
    } finally {
      setLoading(false);
    }
  }, [kind, applied, onCounts]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    setPage(1);
    setSort({ key: 'date', dir: 'desc' });
  }, [kind, applied]);
  // A status belongs to one kind; clear it when switching tabs.
  useEffect(() => {
    setDraft((d) => ({ ...d, status: '' }));
    setApplied((a) => (a.status ? { ...a, status: '' } : a));
  }, [kind]);

  const columns = useMemo(() => columnsFor(kind), [kind]);
  const sorted = useMemo(() => {
    const list = [...(data?.records || [])];
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sort) return list;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return list.sort((a, b) => {
      const x = col.sort!(a);
      const y = col.sort!(b);
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * dir;
    });
  }, [data, columns, sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const shown = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const meta = KIND_META[kind];

  const apply = (e?: React.FormEvent) => {
    e?.preventDefault();
    setApplied({ ...draft });
  };
  const reset = () => {
    setDraft(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
  };
  const activeFilters = Object.entries(applied).filter(([, v]) => v.trim());

  // ---------------------------------------------------------------- exports (exactly the filtered records)

  const filtersText = () =>
    activeFilters.length
      ? activeFilters.map(([k, v]) => `${k}: ${['department', 'qcDepartment', 'sourceDepartment'].includes(k) ? dept(v) : v}`).join(', ')
      : 'No filters (all records)';

  const exportExcel = async () => {
    const XLSX = await import('xlsx');
    const book = XLSX.utils.book_new();
    const sheet = (name: string, rows: Array<Record<string, unknown>>) => {
      const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: 'No records' }]);
      const headers = Object.keys(rows[0] || { Note: '' });
      ws['!cols'] = headers.map((h) => ({ wch: Math.min(45, Math.max(h.length, ...rows.map((r) => String(r[h] ?? '').length)) + 2) }));
      XLSX.utils.book_append_sheet(book, ws, name.slice(0, 31));
    };
    sheet(`${meta.title}`, sorted.map((r, i) => Object.fromEntries(columns.map((c) => [c.label, c.value(r, i)]))));
    for (const by of Object.keys(GROUPS) as GroupBy[]) {
      const { units, rows } = groupRows(sorted, by);
      sheet(`By ${GROUPS[by].label}`, rows.map(([k, row]) => ({
        [GROUPS[by].label]: k,
        Records: row.count,
        Open: row.open,
        ...Object.fromEntries(units.map((u) => [`Quantity (${u})`, row.totals[u] || 0])),
      })));
    }
    if (data) {
      sheet('Department Analysis', departmentsOf(data.departments, kind).map((d) => ({
        Department: d.name,
        ...Object.fromEntries(DEPT_COLUMNS[kind].map((c) => [c.label, totalsText(c.pick(d), '0')])),
      })));
    }
    sheet('Report Info', [{ Report: meta.title, Generated: dateTime(new Date().toISOString()), Filters: filtersText(), Records: sorted.length }]);
    XLSX.writeFile(book, `${meta.title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const printReport = (asPdf: boolean) => {
    const w = window.open('', '_blank');
    if (!w) return;
    const { units, rows } = groupRows(sorted, reportBy);
    const totals: Totals = {};
    for (const r of sorted) totals[r.unit] = Math.round(((totals[r.unit] || 0) + r.quantity) * 1000) / 1000;
    const title = `${meta.title} Report`;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)} ${new Date().toISOString().slice(0, 10)}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  body { font-family: Arial, sans-serif; font-size: 9px; color: #111; }
  h1 { font-size: 15px; margin: 0 0 2px; } h2 { font-size: 11px; margin: 14px 0 4px; }
  .meta { color: #555; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #bbb; padding: 3px 4px; text-align: left; vertical-align: top; }
  th { background: #eee; font-size: 8px; text-transform: uppercase; }
  td.r, th.r { text-align: right; }
  .hint { background: #fff8d6; border: 1px solid #e6c84c; padding: 6px; margin-bottom: 8px; }
  @media print { .hint { display: none; } }
</style></head><body>
${asPdf ? '<div class="hint">In the print dialog, choose <b>Save as PDF</b> as the destination to download this report as a PDF.</div>' : ''}
<h1>${esc(title)}</h1>
<div class="meta">Generated ${esc(dateTime(new Date().toISOString()))} · ${esc(filtersText())} · ${sorted.length} records · Total: ${esc(totalsText(totals, '0'))}</div>
<h2>By ${esc(GROUPS[reportBy].label)}</h2>
<table><thead><tr><th>${esc(GROUPS[reportBy].label)}</th><th class="r">Records</th><th class="r">Open</th>${units.map((u) => `<th class="r">${esc(u)}</th>`).join('')}</tr></thead>
<tbody>${rows.map(([k, row]) => `<tr><td>${esc(k)}</td><td class="r">${row.count}</td><td class="r">${row.open}</td>${units.map((u) => `<td class="r">${esc(qty(row.totals[u] || 0))}</td>`).join('')}</tr>`).join('') || '<tr><td colspan="9">No records</td></tr>'}</tbody></table>
${data ? `<h2>Department-wise analysis</h2><table><thead><tr><th>Department</th>${DEPT_COLUMNS[kind].map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${departmentsOf(data.departments, kind).map((d) => `<tr><td>${esc(d.name)}</td>${DEPT_COLUMNS[kind].map((c) => `<td>${esc(totalsText(c.pick(d), '0'))}</td>`).join('')}</tr>`).join('')}</tbody></table>` : ''}
<h2>Records</h2>
<table><thead><tr>${columns.map((c) => `<th class="${c.align === 'right' ? 'r' : ''}">${esc(c.label)}</th>`).join('')}</tr></thead>
<tbody>${sorted.map((r, i) => `<tr>${columns.map((c) => `<td class="${c.align === 'right' ? 'r' : ''}">${esc(c.value(r, i))}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${columns.length}">No records</td></tr>`}</tbody></table>
</body></html>`);
    w.document.close();
    printWhenReady(w);
  };

  // ---------------------------------------------------------------- render

  const s = data?.summary;
  const opts = data?.options;
  const highest = (pick: (d: DepartmentRow) => Totals) => {
    const out: string[] = [];
    for (const u of opts?.units || []) {
      let best: DepartmentRow | null = null;
      for (const d of departmentsOf(data?.departments, kind)) if ((pick(d)[u] || 0) > (best ? pick(best)[u] || 0 : 0)) best = d;
      if (best) out.push(`${best.name} (${qty(pick(best)[u])} ${u})`);
    }
    return out.join(' · ') || '—';
  };

  const input = 'h-9 px-2.5 border border-neutral-300 rounded-lg text-xs text-neutral-900 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 w-full';
  const label = 'block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1';
  const text = (k: keyof Filters, l: string, type = 'text') => (
    <div>
      <label className={label} htmlFor={`qm-${k}`}>{l}</label>
      <input id={`qm-${k}`} type={type} value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} className={input} />
    </div>
  );
  const select = (k: keyof Filters, l: string, options: Option[]) => (
    <div>
      <label className={label} htmlFor={`qm-${k}`}>{l}</label>
      <select id={`qm-${k}`} value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} className={input}>
        <option value="">All</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
            <meta.icon className="w-5 h-5 text-brand-600" />
            {meta.title} Monitoring
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Factory-wide, live from QC decisions, defect records and HOLD records · MTR and PCS are never added together
            {data && <> · Updated {dateTime(data.generatedAt)}</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={reportBy} onChange={(e) => setReportBy(e.target.value as GroupBy)} className="h-8 px-2 border border-neutral-300 rounded-lg text-xs bg-white" aria-label="Report grouping for PDF and print">
            {(Object.keys(GROUPS) as GroupBy[]).map((g) => <option key={g} value={g}>Report by {GROUPS[g].label}</option>)}
          </select>
          <button type="button" onClick={exportExcel} disabled={!data} className="inline-flex items-center gap-1.5 h-8 px-3 bg-white hover:bg-neutral-50 text-neutral-800 rounded-lg text-xs font-semibold ring-1 ring-neutral-300 disabled:opacity-50">
            <Download className="w-3.5 h-3.5" /> Excel
          </button>
          <button type="button" onClick={() => printReport(true)} disabled={!data} className="inline-flex items-center gap-1.5 h-8 px-3 bg-white hover:bg-neutral-50 text-neutral-800 rounded-lg text-xs font-semibold ring-1 ring-neutral-300 disabled:opacity-50">
            <FileText className="w-3.5 h-3.5" /> PDF
          </button>
          <button type="button" onClick={() => printReport(false)} disabled={!data} className="inline-flex items-center gap-1.5 h-8 px-3 bg-white hover:bg-neutral-50 text-neutral-800 rounded-lg text-xs font-semibold ring-1 ring-neutral-300 disabled:opacity-50">
            <Printer className="w-3.5 h-3.5" /> Print
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

      {/* SUMMARY: only the kind of this tab */}
      {(() => {
        const b = s?.[kind];
        const tiles: Array<[string, React.ReactNode]> =
          kind === 'REJECT'
            ? [['Total rejected records', b?.records ?? '—'], ['Rejected quantity', <TotalsCell key="q" totals={b?.quantity} />], ['Departments', b?.departments ?? '—'], ['Production sheets affected', b?.productionSheets ?? '—']]
            : kind === 'REWORK'
              ? [['Total rework records', b?.records ?? '—'], ['Rework quantity', <TotalsCell key="q" totals={b?.quantity} />], ['Departments', b?.departments ?? '—'], ['Pending / in progress', s ? `${s.REWORK.pending} / ${s.REWORK.inProgress}` : '—']]
              : [['Total hold records', b?.records ?? '—'], ['Hold quantity', <TotalsCell key="q" totals={b?.quantity} />], ['Departments', b?.departments ?? '—'], ['Currently on hold', s ? <span key="h">{s.HOLD.onHold} · <TotalsCell totals={s.HOLD.blockedQuantity} /></span> : '—']];
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {tiles.map(([l, v]) => (
              <div key={l} className="bg-white p-4 rounded-xl border border-neutral-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">{l}</span>
                <div className="mt-1 text-lg font-bold text-neutral-900">{v}</div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* FILTERS */}
      <form onSubmit={apply} className="bg-white p-4 rounded-xl border border-neutral-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={draft.q}
              onChange={(e) => setDraft({ ...draft, q: e.target.value })}
              placeholder="Search Challan No., Production Sheet No., Design No. or Fabric Name"
              aria-label="Global search"
              className={`${input} pl-8`}
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="h-9 px-4 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold">Apply</button>
            <button type="button" onClick={reset} className="h-9 px-3 bg-white hover:bg-neutral-50 text-neutral-700 rounded-lg text-xs font-semibold ring-1 ring-neutral-300">Reset</button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {text('from', 'From date', 'date')}
          {text('to', 'To date', 'date')}
          {select('department', 'Department', opts?.departments || [])}
          {select('qcDepartment', 'QC Department', opts?.qcDepartments || [])}
          {select('sourceDepartment', 'Source Department', opts?.sourceDepartments || [])}
          {select('status', 'Status', [{ value: 'OPEN', label: 'Open (any)' }, { value: 'CLOSED', label: 'Closed (any)' }, ...(opts?.statuses?.[kind] || [])])}
          {text('design', 'Design Number')}
          {select('style', 'Top / Bottom', (opts?.styles || []).map((v) => ({ value: v, label: v })))}
          {text('serial', 'Production Serial')}
          {text('client', 'Client Name')}
          {text('fabric', 'Fabric Name')}
          {text('colour', 'Colour / Shade')}
          {select('unit', 'Unit', (opts?.units || []).map((v) => ({ value: v, label: v })))}
          {text('reason', 'Reason')}
        </div>
        {activeFilters.length > 0 && <p className="text-[11px] text-neutral-500">Filtered: {filtersText()}</p>}
      </form>

      {/* DEPARTMENT-WISE ANALYSIS */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-2xs overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-200 bg-neutral-50 flex flex-col md:flex-row md:items-center justify-between gap-2">
          <span className="font-bold text-xs uppercase tracking-wider text-neutral-900">Department-wise quantity analysis</span>
          <span className="text-[11px] text-neutral-500">Click a department to open its records</span>
        </div>
        {data && (
          <div className="px-4 py-2.5 border-b border-neutral-100 text-[11px]">
            <span className="font-bold text-neutral-700">
              {kind === 'REJECT' ? 'Highest rejected:' : kind === 'REWORK' ? 'Highest rework (marked):' : 'Most on hold now:'}
            </span>{' '}
            <span className="text-neutral-900">{highest(kind === 'REJECT' ? (d) => d.rejected : kind === 'REWORK' ? (d) => d.reworkMarked : (d) => d.holdBlocked)}</span>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 text-[10px] font-bold uppercase tracking-wider text-neutral-500 border-b border-neutral-200">
              <tr>
                <th className="py-2.5 px-4">Department</th>
                {DEPT_COLUMNS[kind].map((c) => <th key={c.label} className="py-2.5 px-4 text-right">{c.label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {!data ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-neutral-500">{loading ? 'Loading…' : 'No data'}</td></tr>
              ) : departmentsOf(data.departments, kind).length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-neutral-500">No {meta.noun} records for these filters.</td></tr>
              ) : (
                departmentsOf(data.departments, kind).map((d) => (
                  <tr key={d.code} onClick={() => setDrillDept(d.code)} className="hover:bg-brand-50/40 cursor-pointer">
                    <td className="py-2.5 px-4 font-semibold text-brand-800 underline-offset-2 hover:underline">{d.name}</td>
                    {DEPT_COLUMNS[kind].map((c) => <td key={c.label} className="py-2.5 px-4 text-right"><TotalsCell totals={c.pick(d)} /></td>)}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECORDS TABLE */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-2xs overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between gap-2">
          <span className="font-bold text-xs uppercase tracking-wider text-neutral-900">{meta.title} records ({sorted.length})</span>
          {kind === 'REWORK' && <span className="text-[11px] text-neutral-500">QC department marks rework · the assigned processing department performs it</span>}
        </div>
        <div className="overflow-x-auto">
          <table className={`w-full text-left text-xs ${loading ? 'opacity-60' : ''}`}>
            <thead className="bg-neutral-50 text-[10px] font-bold uppercase tracking-wider text-neutral-500 border-b border-neutral-200">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className={`py-2.5 px-3 whitespace-nowrap ${c.align === 'right' ? 'text-right' : ''}`}>
                    {c.sort ? (
                      <button
                        type="button"
                        onClick={() => setSort((p) => ({ key: c.key, dir: p.key === c.key && p.dir === 'desc' ? 'asc' : 'desc' }))}
                        className="inline-flex items-center gap-1 uppercase hover:text-neutral-900"
                      >
                        {c.label}
                        {sort.key === c.key && (sort.dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                      </button>
                    ) : (
                      c.label
                    )}
                  </th>
                ))}
                <th className="py-2.5 px-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-neutral-800">
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="px-4 py-12 text-center text-neutral-500">
                    {loading ? 'Loading…' : `No ${meta.noun} records${activeFilters.length ? ' match these filters' : ' yet'}.`}
                  </td>
                </tr>
              ) : (
                shown.map((r, i) => {
                  const index = (page - 1) * PAGE_SIZE + i;
                  return (
                    <tr key={r.id} className={`hover:bg-neutral-50/70 ${r.active ? '' : 'text-neutral-500'}`}>
                      {columns.map((c) => (
                        <td key={c.key} className={`py-2.5 px-3 align-top ${c.align === 'right' ? 'text-right' : ''} ${['reason', 'location', 'reference', 'fabric'].includes(c.key) ? 'min-w-[11rem] max-w-[16rem]' : 'whitespace-nowrap'}`}>
                          {c.render ? c.render(r, index) : <span className={c.key === 'reference' ? 'font-mono text-[10px]' : ''}>{c.value(r, index)}</span>}
                        </td>
                      ))}
                      <td className="py-2.5 px-3">
                        <button type="button" onClick={() => setDetailId(r.id)} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-brand-700 hover:bg-brand-50 whitespace-nowrap">
                          <Eye className="w-3.5 h-3.5" /> View Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-neutral-100 text-xs text-neutral-600">
          <span>{sorted.length === 0 ? 'No records' : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, sorted.length)} of ${sorted.length}`}</span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setPage(page - 1)} disabled={page <= 1} className="p-1.5 rounded-md ring-1 ring-neutral-300 disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="w-4 h-4" /></button>
            <span className="px-2 font-semibold">{page} / {pages}</span>
            <button type="button" onClick={() => setPage(page + 1)} disabled={page >= pages} className="p-1.5 rounded-md ring-1 ring-neutral-300 disabled:opacity-40" aria-label="Next page"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {detailId && <RecordDetailModal id={detailId} onClose={() => setDetailId(null)} />}
      {drillDept && <DepartmentDrillDown code={drillDept} kind={kind} filters={applied} onClose={() => setDrillDept(null)} onView={setDetailId} />}
    </div>
  );
}

// ---------------------------------------------------------------- modals

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-neutral-900/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="bg-white rounded-xl shadow-2xl border border-neutral-200 w-full max-w-6xl my-auto">
        <div className="px-5 py-3.5 border-b border-neutral-200 bg-neutral-50 flex items-start justify-between gap-3 rounded-t-xl">
          <div>
            <h3 className="font-bold text-sm text-neutral-900">{title}</h3>
            {subtitle && <p className="text-[11px] text-neutral-500 mt-0.5">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-neutral-500 hover:bg-neutral-200" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Facts({ items }: { items: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2.5">
      {items.map(([l, v]) => (
        <div key={l}>
          <dt className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{l}</dt>
          <dd className="text-xs font-semibold text-neutral-900 mt-0.5 break-words">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

function RecordDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [detail, setDetail] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/admin/quality-monitor/record?id=${encodeURIComponent(id)}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Could not load this record.');
        if (live) setDetail(json);
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [id]);
  const r: MonitorRecord | undefined = detail?.record;
  const p = detail?.program;
  const decision = r?.kind === 'REJECT' ? 'REJECT' : r?.kind === 'REWORK' ? 'REWORK' : 'HOLD';
  return (
    <Modal title={r ? `${KIND_META[r.kind].title} · ${r.designNumber} · Serial ${r.serialNumber}` : 'Record details'} subtitle={r ? r.references.join(' · ') : undefined} onClose={onClose}>
      {error ? (
        <p className="text-xs text-danger-700">{error}</p>
      ) : !r ? (
        <p className="text-xs text-neutral-500">Loading…</p>
      ) : (
        <div className="space-y-5">
          <section>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-brand-800 mb-2">Production Sheet, client &amp; design</h4>
            <Facts items={[
              ['Production Sheet', p?.programNumber || r.productionSheetNumber],
              ['Production Serial', r.serialNumber],
              ['Design Number', r.designNumber],
              ['Client', r.clientName],
              ['Order No.', p?.orderNumber],
              ['Style name', [p?.mainStyle, p?.subStyle].filter(Boolean).join(' / ') || '—'],
              ['Top / Bottom', r.style || 'Not yet cut into garments'],
              ['Sheet status', p?.status],
              ['Original production qty', p?.targetQuantity != null ? `${p.targetQuantity} ${p.quantityMeasurement || 'PCS'}` : '—'],
              ['Delivery date', dateOnly(p?.deliveryDate)],
              ['Line', detail.line ? detail.line.label : '—'],
              ['Line received qty', detail.line?.received != null ? `${qty(detail.line.received)} ${detail.line.unit || ''}` : '—'],
            ]} />
          </section>
          <section>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-brand-800 mb-2">Decision</h4>
            <Facts items={[
              ['QC decision', decision],
              ['Affected quantity', <span key="q" className="text-sm">{qty(r.quantity)} {r.unit}</span>],
              ['Unit', r.unit],
              ['Status', <StatusPill key="s" record={r} />],
              ['Recorded in', dept(r.departmentCode)],
              ['QC stage', r.qcDepartmentCode ? dept(r.qcDepartmentCode) : '—'],
              ['Previous department', dept(r.sourceDepartmentCode)],
              ['Next department', r.kind === 'REWORK' ? `${dept(r.reworkToCode)} (rework)` : r.kind === 'REJECT' ? (r.qcDepartmentCode ? 'Fabric Store Defective Shelf' : 'Department defective shelf') : '—'],
              ['Fabric', r.fabricName],
              ['Colour / shade', colourShade(r)],
              ['Date & time', dateTime(r.date)],
              ['Recorded by', r.recordedBy],
              ['Reason', r.reason],
              ['Remarks', r.remarks],
              ['Current location', r.location],
              [r.kind === 'HOLD' ? 'Still on hold' : r.kind === 'REWORK' ? 'Sent back' : 'Sent to shelf', r.kind === 'HOLD' ? `${qty(r.active ? r.remainingQuantity : 0)} ${r.unit}` : r.sentQuantity != null ? `${qty(r.sentQuantity)} ${r.unit}` : '—'],
            ]} />
          </section>
          <section>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-brand-800 mb-2">Movement history</h4>
            <div className="border border-neutral-200 rounded-lg overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  <tr><th className="py-2 px-3">Date &amp; time</th><th className="py-2 px-3">Department</th><th className="py-2 px-3">Action</th><th className="py-2 px-3">Details</th><th className="py-2 px-3 text-right">Quantity</th><th className="py-2 px-3">Reference</th><th className="py-2 px-3">By</th></tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {detail.history.length === 0 ? (
                    <tr><td colSpan={7} className="px-3 py-6 text-center text-neutral-500">No movement recorded.</td></tr>
                  ) : (
                    detail.history.map((e: any, i: number) => (
                      <tr key={i}>
                        <td className="py-2 px-3 whitespace-nowrap">{dateTime(e.at)}</td>
                        <td className="py-2 px-3 whitespace-nowrap">{e.department || '—'}</td>
                        <td className="py-2 px-3 font-semibold whitespace-nowrap">{e.action}</td>
                        <td className="py-2 px-3 min-w-[14rem]">{e.detail || '—'}</td>
                        <td className="py-2 px-3 text-right whitespace-nowrap tabular-nums">{e.quantity != null ? `${qty(e.quantity)} ${e.unit || ''}` : '—'}</td>
                        <td className="py-2 px-3 font-mono text-[10px] whitespace-nowrap">{e.reference || '—'}</td>
                        <td className="py-2 px-3 whitespace-nowrap">{e.by || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <section>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-brand-800 mb-2">Related challans</h4>
            {detail.challans.length === 0 ? (
              <p className="text-xs text-neutral-500">No challan linked.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {detail.challans.map((c: any) => (
                  <a key={c.id} href={`/challans/${c.id}`} target="_blank" rel="noreferrer" className="px-2.5 py-1.5 rounded-lg border border-neutral-200 hover:border-brand-300 hover:bg-brand-50 text-[11px]">
                    <span className="font-mono font-bold text-brand-800">{c.challanNumber}</span>
                    <span className="text-neutral-500"> · {c.from} → {c.to} · {String(c.status).replace(/_/g, ' ')} · {dateOnly(c.date)}</span>
                  </a>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}

function DepartmentDrillDown({ code, kind, filters, onClose, onView }: { code: string; kind: MonitorKind; filters: Filters; onClose: () => void; onView: (id: string) => void }) {
  const [data, setData] = useState<MonitorResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v.trim()) params.set(k, v.trim());
    params.set('department', code);
    params.set('kind', kind);
    fetch(`/api/admin/quality-monitor?${params.toString()}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Could not load the department.');
        if (live) setData(json);
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [code, kind, filters]);
  const row = data?.departments.find((d) => d.code === code);
  const role = (r: MonitorRecord) => (r.kind === 'REWORK' && r.reworkToCode === code && r.departmentCode !== code ? 'Rework received' : r.kind === 'REWORK' ? 'Rework marked' : r.kind === 'REJECT' ? 'Rejected' : 'Hold');
  return (
    <Modal
      title={`${dept(code)} · ${KIND_META[kind].title}`}
      subtitle={kind === 'REWORK' ? 'Rework marked in this department, or sent back to it for rework' : `Every ${KIND_META[kind].noun} record of this department`}
      onClose={onClose}
    >
      {error ? (
        <p className="text-xs text-danger-700">{error}</p>
      ) : !data ? (
        <p className="text-xs text-neutral-500">Loading…</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {row && DEPT_COLUMNS[kind].map((c) => (
              <div key={c.label} className="p-3 rounded-lg border border-neutral-200 bg-neutral-50">
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{c.label}</div>
                <div className="text-xs mt-1"><TotalsCell totals={c.pick(row)} /></div>
              </div>
            ))}
            <div className="p-3 rounded-lg border border-neutral-200 bg-neutral-50">
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Records</div>
              <div className="text-xs mt-1 font-bold">{data.records.length}</div>
            </div>
          </div>
          <div className="border border-neutral-200 rounded-lg overflow-x-auto max-h-[60vh]">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 text-[10px] font-bold uppercase tracking-wider text-neutral-500 sticky top-0">
                <tr>
                  {['Date', 'Type', 'Production Sheet', 'Serial', 'Design', 'Style', 'Fabric', 'Quantity', 'From → To', 'Reason / remarks', 'Status', 'Location', ''].map((h) => <th key={h} className="py-2 px-3 whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {data.records.length === 0 ? (
                  <tr><td colSpan={13} className="px-3 py-8 text-center text-neutral-500">No records.</td></tr>
                ) : (
                  data.records.map((r) => (
                    <tr key={r.id} className="hover:bg-neutral-50">
                      <td className="py-2 px-3 whitespace-nowrap">{dateTime(r.date)}</td>
                      <td className="py-2 px-3 whitespace-nowrap font-semibold">{role(r)}</td>
                      <td className="py-2 px-3 whitespace-nowrap font-mono text-[10px]">{r.productionSheetNumber}</td>
                      <td className="py-2 px-3 whitespace-nowrap">{r.serialNumber}</td>
                      <td className="py-2 px-3 whitespace-nowrap">{r.designNumber}</td>
                      <td className="py-2 px-3 whitespace-nowrap">{r.style || '—'}</td>
                      <td className="py-2 px-3 min-w-[10rem]">{r.fabricName}</td>
                      <td className="py-2 px-3 whitespace-nowrap text-right font-bold tabular-nums">{qty(r.quantity)} <span className="text-[10px] text-neutral-500">{r.unit}</span></td>
                      <td className="py-2 px-3 whitespace-nowrap">{dept(r.sourceDepartmentCode)} → {r.kind === 'REWORK' ? dept(r.reworkToCode) : dept(r.departmentCode)}</td>
                      <td className="py-2 px-3 min-w-[12rem]">{[r.reason, r.remarks].filter(Boolean).join(' · ')}</td>
                      <td className="py-2 px-3"><StatusPill record={r} /></td>
                      <td className="py-2 px-3 min-w-[10rem]">{r.location}</td>
                      <td className="py-2 px-3"><button type="button" onClick={() => onView(r.id)} className="text-[11px] font-semibold text-brand-700 hover:underline whitespace-nowrap">View</button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
