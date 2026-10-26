'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Download, Printer } from 'lucide-react';
import {
  BTN_PRIMARY,
  BTN_QUIET,
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
import { DYEING_STATUS_LABEL, receivedBasis } from '@/lib/dyeing-workflow.mjs';

type View = 'lines' | 'incoming' | 'outgoing';
const VIEWS: Array<{ id: View; label: string }> = [
  { id: 'lines', label: 'Dyeing Lines' },
  { id: 'incoming', label: 'Incoming Challans' },
  { id: 'outgoing', label: 'Outgoing Challans' },
];
const EMPTY_FILTERS = { from: '', to: '', challan: '', design: '', serial: '', fabric: '', color: '', status: '', priority: '' };
const CHALLAN_STATUSES = ['ISSUED', 'IN_TRANSIT', 'RECEIVED', 'UNDER_INSPECTION', 'COMPLETED', 'CANCELLED'];

function csvCell(value: unknown) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(name: string, rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

function HistoryContent() {
  const params = useSearchParams();
  const initial = params.get('view');
  const [view, setView] = useState<View>(initial === 'incoming' || initial === 'outgoing' ? initial : 'lines');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (f = filters, v = view) => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ view: v });
      Object.entries(f).forEach(([k, val]) => val && q.set(k, val));
      const body = await fetchJson(`/api/dyeing/history?${q}`);
      setRows(body.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(filters, view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const set = (k: keyof typeof EMPTY_FILTERS) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFilters({ ...filters, [k]: e.target.value });

  const exportCsv = () => {
    if (view === 'lines') {
      downloadCsv(
        'dyeing-lines.csv',
        rows.map((o) => ({
          'Dyeing Ref': o.orderNumber,
          'Production Sheet': sheetRef(o.program),
          Design: o.program?.designNumber || '',
          'Incoming Challan': o.inboundChallan?.challanNumber || '',
          Fabric: o.fabricName,
          'Required Colour': o.targetColor,
          'Dyed Colour': o.dyedColor || '',
          Unit: o.uom,
          Expected: o.requiredQuantity,
          Received: o.status === 'AWAITING_RECEIPT' ? '' : receivedBasis(o),
          Processed: o.dyedQuantity,
          'Sent to QC': o.sentToQc1Quantity,
          Status: (DYEING_STATUS_LABEL as Record<string, string>)[o.status] || o.status,
          Priority: o.priority,
          'Received At': o.receivedAt || '',
          'Started At': o.startedAt || '',
          'Completed At': o.completedAt || '',
          'QC Challans': (o.qcTransfers || []).map((t: any) => `${t.challan?.challanNumber} (${t.quantity} ${t.uom})`).join('; '),
        })),
      );
    } else {
      downloadCsv(
        `dyeing-${view}-challans.csv`,
        rows.flatMap((c) =>
          (c.items || []).map((i: any) => ({
            Challan: c.challanNumber,
            Date: c.issuedDate || c.createdAt,
            From: c.fromDepartment,
            To: c.toDepartment,
            'Production Sheet': sheetRef(c.program),
            Design: c.program?.designNumber || '',
            Fabric: i.fabricCode || i.itemDescription,
            Colour: i.colour || '',
            'Required Colour': i.requiredColour || '',
            Quantity: i.quantity,
            Unit: i.uom,
            Status: c.status,
            Priority: c.priority,
            'Received At': c.receivedDate || '',
          })),
        ),
      );
    }
  };

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <PageHeader title="Dyeing History" loading={loading} onRefresh={() => load()}>
        <button onClick={exportCsv} disabled={rows.length === 0} className={BTN_QUIET}>
          <Download className="w-3.5 h-3.5" />
          <span>Download CSV</span>
        </button>
        <button onClick={() => window.print()} className={BTN_QUIET}>
          <Printer className="w-3.5 h-3.5" />
          <span>Print</span>
        </button>
      </PageHeader>

      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {error && <Notice kind="error" onClose={() => setError(null)}>{error}</Notice>}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
          className="bg-white border border-neutral-200 rounded-2xl shadow-xs p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 print:hidden"
        >
          <label className="block">
            <span className="text-xs font-semibold text-neutral-600">From</span>
            <input type="date" value={filters.from} onChange={set('from')} className={`${FIELD} mt-1`} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-neutral-600">To</span>
            <input type="date" value={filters.to} onChange={set('to')} className={`${FIELD} mt-1`} />
          </label>
          {(['challan', 'design', 'serial', 'fabric', 'color'] as const).map((k) => (
            <label key={k} className="block">
              <span className="text-xs font-semibold text-neutral-600">{{ challan: 'Challan No.', design: 'Design No.', serial: 'Serial No.', fabric: 'Fabric', color: 'Colour' }[k]}</span>
              <input value={filters[k]} onChange={set(k)} className={`${FIELD} mt-1`} />
            </label>
          ))}
          <label className="block">
            <span className="text-xs font-semibold text-neutral-600">Status</span>
            <select value={filters.status} onChange={set('status')} className={`${FIELD} mt-1`}>
              <option value="">Any</option>
              {view === 'lines'
                ? Object.entries(DYEING_STATUS_LABEL)
                    .filter(([k]) => k !== 'PARTIALLY_DYED')
                    .map(([k, label]) => <option key={k} value={k}>{label}</option>)
                : CHALLAN_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-neutral-600">Priority</span>
            <select value={filters.priority} onChange={set('priority')} className={`${FIELD} mt-1`}>
              <option value="">Any</option>
              {['URGENT', 'HIGH', 'NORMAL', 'LOW'].map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button type="submit" className={`${BTN_PRIMARY} flex-1`}>Apply</button>
            <button
              type="button"
              onClick={() => {
                setFilters(EMPTY_FILTERS);
                load(EMPTY_FILTERS);
              }}
              className={BTN_QUIET}
            >
              Reset
            </button>
          </div>
        </form>

        <Panel
          title={VIEWS.find((v) => v.id === view)!.label}
          count={rows.length}
          actions={
            <div role="tablist" className="inline-flex p-0.5 bg-neutral-100 rounded-lg print:hidden">
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  role="tab"
                  aria-selected={view === v.id}
                  onClick={() => {
                    setFilters({ ...filters, status: '' });
                    setView(v.id);
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                    view === v.id ? 'bg-white text-brand-800 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          }
        >
          <div className="overflow-x-auto">
            {view === 'lines' ? (
              <table className="w-full text-left text-sm">
                <thead className={THEAD}>
                  <tr>
                    <th className="py-3 px-4">Production Sheet</th>
                    <th className="py-3 px-3">Incoming Challan</th>
                    <th className="py-3 px-3">Fabric</th>
                    <th className="py-3 px-3">Required / Dyed</th>
                    <th className="py-3 px-3 text-right">Received</th>
                    <th className="py-3 px-3 text-right">Processed</th>
                    <th className="py-3 px-3 text-right">Sent to QC</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Priority</th>
                    <th className="py-3 px-3">Timeline</th>
                    <th className="py-3 px-3">QC Challans</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {!loading && rows.length === 0 && <EmptyRow colSpan={11} text="No records match these filters" />}
                  {rows.map((o) => (
                    <tr key={o.id} className="hover:bg-neutral-50/60 align-top">
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs font-semibold">{sheetRef(o.program)}</span>
                        <span className="block font-mono text-[11px] text-neutral-500">{o.orderNumber}</span>
                        <span className="block text-[11px] text-neutral-500">{o.program?.designNumber || ''}</span>
                      </td>
                      <td className="py-3 px-3 font-mono text-xs text-brand-800">
                        {o.inboundChallan ? <Link href={`/challans/${o.inboundChallan.id}`} className="hover:underline">{o.inboundChallan.challanNumber}</Link> : '—'}
                      </td>
                      <td className="py-3 px-3 font-semibold">{o.fabricName}</td>
                      <td className="py-3 px-3 text-xs">
                        <span className="text-brand-900 font-semibold">{o.targetColor || '—'}</span>
                        <span className={`block ${o.colorMismatch ? 'text-danger-700 font-semibold' : 'text-neutral-600'}`}>{o.dyedColor || '—'}</span>
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{o.status === 'AWAITING_RECEIPT' ? '—' : fmtQty(receivedBasis(o), o.uom)}</td>
                      <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(o.dyedQuantity, o.uom)}</td>
                      <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(o.sentToQc1Quantity, o.uom)}</td>
                      <td className="py-3 px-3"><StatusBadge status={o.status} /></td>
                      <td className="py-3 px-3"><PriorityBadge priority={o.priority} /></td>
                      <td className="py-3 px-3 text-[11px] text-neutral-600 whitespace-nowrap">
                        <span className="block">Received {fmtDate(o.receivedAt, true)}{o.receivedBy ? ` · ${o.receivedBy.fullName}` : ''}</span>
                        <span className="block">Started {fmtDate(o.startedAt, true)}</span>
                        <span className="block">Completed {fmtDate(o.completedAt, true)}</span>
                      </td>
                      <td className="py-3 px-3 text-xs">
                        {(o.qcTransfers || []).length === 0
                          ? '—'
                          : o.qcTransfers.map((t: any) => (
                              <span key={t.id} className="block whitespace-nowrap">
                                <Link href={`/challans/${t.challan?.id}`} className="font-mono text-brand-800 hover:underline">{t.challan?.challanNumber}</Link>
                                <span className="text-neutral-500"> {fmtQty(t.quantity, t.uom)} · {fmtDate(t.createdAt)}</span>
                              </span>
                            ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className={THEAD}>
                  <tr>
                    <th className="py-3 px-4">Challan</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Production Sheet</th>
                    <th className="py-3 px-3">{view === 'outgoing' ? 'Incoming Challan' : 'From'}</th>
                    <th className="py-3 px-3">Items</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Priority</th>
                    <th className="py-3 px-3">Activity</th>
                    <th className="py-3 px-3 print:hidden"><span className="sr-only">Documents</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {!loading && rows.length === 0 && <EmptyRow colSpan={9} text="No challans match these filters" />}
                  {rows.map((c) => (
                    <tr key={c.id} className="hover:bg-neutral-50/60 align-top">
                      <td className="py-3 px-4 font-mono text-xs font-bold text-brand-800">
                        <Link href={`/challans/${c.id}`} className="hover:underline">{c.challanNumber}</Link>
                      </td>
                      <td className="py-3 px-3 text-xs text-neutral-600 whitespace-nowrap">{fmtDate(c.issuedDate || c.createdAt)}</td>
                      <td className="py-3 px-3 font-mono text-xs">
                        {sheetRef(c.program)}
                        <span className="block text-[11px] text-neutral-500 font-sans">{c.program?.designNumber || ''}</span>
                      </td>
                      <td className="py-3 px-3 text-xs">{view === 'outgoing' ? c.parentChallan?.challanNumber || '—' : c.fromDepartment}</td>
                      <td className="py-3 px-3 text-xs text-neutral-700">
                        {(c.items || []).map((i: any) => (
                          <span key={i.id} className="block whitespace-nowrap">
                            {i.fabricCode || i.itemDescription} · {i.colour || '—'}
                            {i.requiredColour ? ` (to ${i.requiredColour})` : ''} · {fmtQty(i.quantity, i.uom)}
                          </span>
                        ))}
                      </td>
                      <td className="py-3 px-3 text-xs">{String(c.status || '').replace(/_/g, ' ')}</td>
                      <td className="py-3 px-3"><PriorityBadge priority={c.priority} /></td>
                      <td className="py-3 px-3 text-[11px] text-neutral-600">
                        {(c.events || []).length === 0
                          ? `Issued ${fmtDate(c.issuedDate || c.createdAt, true)}`
                          : c.events.map((ev: any) => (
                              <span key={ev.id} className="block whitespace-nowrap">
                                {String(ev.action).charAt(0) + String(ev.action).slice(1).toLowerCase()} {fmtDate(ev.createdAt, true)}
                                {ev.actor ? ` · ${ev.actor.fullName}` : ''}
                              </span>
                            ))}
                      </td>
                      <td className="py-3 px-3 text-right print:hidden"><DocumentsButton programId={c.programId} challanId={c.id} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Panel>
      </main>
    </div>
  );
}

export default function DyeingHistoryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <HistoryContent />
    </Suspense>
  );
}
