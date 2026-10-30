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
  FabricStatusBadge,
  Notice,
  PageHeader,
  Panel,
  PriorityBadge,
  THEAD,
  WorkStatusBadge,
  fetchJson,
  fmtDate,
  fmtQty,
  challanRef,
  sheetRef,
} from '@/components/workflow/WorkflowUi';
import { WORK_STATUS, qcStatusLabel, receivedBasis, workStatusLabel } from '@/lib/work-items.mjs';
import { departmentName, statusName, type WorkflowView } from '@/lib/workflow-views';
import { GarmentTag } from '@/components/recutting/RecuttingUi';
import { CATEGORY_LABEL, GARMENT_CATEGORIES } from '@/lib/recutting.mjs';

type View = 'lines' | 'incoming' | 'inspections' | 'outgoing';
const EMPTY_FILTERS = {
  from: '',
  to: '',
  challan: '',
  sheet: '',
  design: '',
  fabric: '',
  color: '',
  fabricStatus: '',
  status: '',
  unit: '',
  outcome: '',
  // flow.historyFilters only
  category: '',
  reason: '',
  reworkStatus: '',
  dispatch: '',
};
const CHALLAN_STATUSES = ['ISSUED', 'IN_TRANSIT', 'RECEIVED', 'UNDER_INSPECTION', 'COMPLETED', 'CANCELLED'];
const TEXT_FILTERS = [
  { key: 'challan', label: 'Challan No.' },
  { key: 'sheet', label: 'Production Sheet / Serial' },
  { key: 'design', label: 'Design No.' },
  { key: 'fabric', label: 'Fabric' },
  { key: 'color', label: 'Colour' },
] as const;

const fabricText = (s?: string | null) => (s === 'DYED' ? 'Dyed' : s === 'UNDYED' ? 'Undyed' : '');

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

function HistoryContent({ flow }: { flow: WorkflowView }) {
  const params = useSearchParams();
  const initial = params.get('view');
  const views: Array<{ id: View; label: string }> = flow.qc
    ? [
        { id: 'lines', label: `${flow.label} Lines` },
        { id: 'incoming', label: 'Incoming Challans' },
        { id: 'inspections', label: 'Inspections' },
        { id: 'outgoing', label: 'Outgoing Challans' },
      ]
    : [
        { id: 'lines', label: `${flow.label} Lines` },
        { id: 'incoming', label: 'Incoming Challans' },
        { id: 'outgoing', label: `Challans to ${flow.next}` },
      ];
  const [view, setView] = useState<View>(views.some((v) => v.id === initial) ? (initial as View) : 'lines');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const slug = flow.label.toLowerCase().replace(/\s+/g, '-');
  const statusText = (s: string) => statusName(flow, s, flow.qc ? qcStatusLabel(s) : workStatusLabel(s, flow.next));

  const load = async (f = filters, v = view) => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ view: v });
      Object.entries(f).forEach(([k, val]) => val && q.set(k, val));
      const body = await fetchJson(`${flow.api}/history?${q}`);
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
    if (view === 'inspections') {
      downloadCsv(
        `${slug}-inspections.csv`,
        rows.map((x) => ({
          Date: x.createdAt,
          'Production Sheet': sheetRef(x.workItem?.program),
          Design: x.workItem?.program?.designNumber || '',
          'Incoming Challan': x.workItem?.inboundChallan?.challanNumber || '',
          Fabric: x.workItem?.fabricName || '',
          Colour: x.workItem?.colour || '',
          'Dyed / Undyed': fabricText(x.workItem?.fabricProcessingStatus),
          Unit: x.uom,
          Inspected: x.inspectedQuantity,
          Pass: x.passQuantity,
          Reject: x.rejectQuantity,
          Rework: x.reworkQuantity,
          'Defect Reason': x.rejectReason || '',
          'Rework Reason': x.reworkReason || '',
          Remarks: x.remarks || '',
          Inspector: x.inspector?.fullName || '',
        })),
      );
    } else if (view === 'lines') {
      downloadCsv(
        `${slug}-lines.csv`,
        rows.map((i) => ({
          'Production Sheet': sheetRef(i.program),
          Design: i.program?.designNumber || '',
          'Incoming Challan': i.inboundChallan?.challanNumber || '',
          From: departmentName(i.sourceDepartment),
          Fabric: i.fabricName,
          Colour: i.colour || '',
          'Dyed / Undyed': fabricText(i.fabricProcessingStatus),
          Unit: i.uom,
          Expected: i.expectedQuantity,
          Received: i.status === 'AWAITING_RECEIPT' ? '' : receivedBasis(i),
          ...(flow.qc
            ? {
                Inspected: i.processedQuantity,
                Pass: i.passedQuantity,
                Reject: i.rejectedQuantity,
                Rework: i.reworkQuantity,
                [`Sent to ${flow.next}`]: i.transferredQuantity,
                'Sent to Defective Shelf': i.rejectSentQuantity,
                'Returned for Rework': i.reworkSentQuantity,
              }
            : { Processed: i.processedQuantity, Transferred: i.transferredQuantity }),
          Status: statusText(i.status),
          Priority: i.priority,
          'Received At': i.receivedAt || '',
          'Started At': i.startedAt || '',
          'Completed At': i.completedAt || '',
          'Outgoing Challans': (i.transfers || []).map((t: any) => `${t.challan?.challanNumber} (${t.quantity} ${t.uom})`).join('; '),
        })),
      );
    } else {
      downloadCsv(
        `${slug}-${view}-challans.csv`,
        rows.flatMap((c) =>
          (c.items || []).map((i: any) => ({
            Challan: c.challanNumber,
            Date: c.issuedDate || c.createdAt,
            From: departmentName(c.fromDepartment),
            To: departmentName(c.toDepartment),
            'Production Sheet': sheetRef(c.program),
            Design: c.program?.designNumber || '',
            Fabric: i.fabricCode || i.itemDescription,
            Colour: i.colour || '',
            'Dyed / Undyed': fabricText(lineFabricStatus(c, i)),
            Quantity: i.quantity,
            Unit: i.uom,
            Status: c.status,
            'Received At': c.receivedDate || '',
          })),
        ),
      );
    }
  };

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <PageHeader title={`${flow.label} History`} loading={loading} onRefresh={() => load()}>
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
          {TEXT_FILTERS.map((f) => (
            <label key={f.key} className="block">
              <span className="text-xs font-semibold text-neutral-600">{f.label}</span>
              <input value={filters[f.key]} onChange={set(f.key)} className={`${FIELD} mt-1`} />
            </label>
          ))}
          <label className="block">
            <span className="text-xs font-semibold text-neutral-600">Dyed / Undyed</span>
            <select value={filters.fabricStatus} onChange={set('fabricStatus')} className={`${FIELD} mt-1`}>
              <option value="">Any</option>
              <option value="DYED">Dyed</option>
              <option value="UNDYED">Undyed</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-neutral-600">Status</span>
            <select value={filters.status} onChange={set('status')} className={`${FIELD} mt-1`}>
              <option value="">Any</option>
              {view === 'lines'
                ? Object.keys(WORK_STATUS)
                    .filter((s) => !flow.qc || s !== 'READY_FOR_TRANSFER')
                    .map((s) => <option key={s} value={s}>{statusText(s)}</option>)
                : CHALLAN_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-neutral-600">Unit</span>
            <select value={filters.unit} onChange={set('unit')} className={`${FIELD} mt-1`}>
              <option value="">Any</option>
              <option value="MTR">Meters</option>
              <option value="PCS">Pieces</option>
            </select>
          </label>
          {flow.qc && (
            <label className="block">
              <span className="text-xs font-semibold text-neutral-600">Inspection outcome</span>
              <select value={filters.outcome} onChange={set('outcome')} className={`${FIELD} mt-1`}>
                <option value="">Any</option>
                <option value="PASS">Pass</option>
                <option value="REJECT">Reject</option>
                <option value="REWORK">Rework</option>
              </select>
            </label>
          )}
          {flow.historyFilters && (
            <>
              <label className="block">
                <span className="text-xs font-semibold text-neutral-600">Garment category</span>
                <select value={filters.category} onChange={set('category')} className={`${FIELD} mt-1`}>
                  <option value="">Any</option>
                  {GARMENT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
                  ))}
                </select>
              </label>
              {(view === 'lines' || view === 'inspections') && (
                <label className="block">
                  <span className="text-xs font-semibold text-neutral-600">Defect / rework reason</span>
                  <input value={filters.reason} onChange={set('reason')} className={`${FIELD} mt-1`} />
                </label>
              )}
              {view === 'lines' && (
                <>
                  <label className="block">
                    <span className="text-xs font-semibold text-neutral-600">Rework status</span>
                    <select value={filters.reworkStatus} onChange={set('reworkStatus')} className={`${FIELD} mt-1`}>
                      <option value="">Any</option>
                      <option value="PENDING">Awaiting return to {flow.qc?.reworkTo}</option>
                      <option value="RETURNED">Returned to {flow.qc?.reworkTo}</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-neutral-600">{flow.next} dispatch</span>
                    <select value={filters.dispatch} onChange={set('dispatch')} className={`${FIELD} mt-1`}>
                      <option value="">Any</option>
                      <option value="AWAITING">Passed, not dispatched</option>
                      <option value="PARTIAL">Partially dispatched</option>
                      <option value="DISPATCHED">Dispatched</option>
                    </select>
                  </label>
                </>
              )}
            </>
          )}
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
          title={views.find((v) => v.id === view)!.label}
          count={rows.length}
          actions={
            <div role="tablist" className="inline-flex p-0.5 bg-neutral-100 rounded-lg print:hidden">
              {views.map((v) => (
                <button
                  key={v.id}
                  role="tab"
                  aria-selected={view === v.id}
                  onClick={() => {
                    setFilters({ ...filters, status: '', outcome: '', reworkStatus: '', dispatch: '', ...(v.id === 'lines' || v.id === 'inspections' ? {} : { reason: '' }) });
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
                    <th className="py-3 px-3">Colour</th>
                    <th className="py-3 px-3">Dyed / Undyed</th>
                    <th className="py-3 px-3 text-right">Received</th>
                    <th className="py-3 px-3 text-right">{flow.qc ? 'Inspected / Outcome' : flow.allocation ? 'Allocated' : 'Processed'}</th>
                    <th className="py-3 px-3 text-right">{flow.qc ? 'Sent' : 'Transferred'}</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Priority</th>
                    <th className="py-3 px-3">Timeline</th>
                    <th className="py-3 px-3">Outgoing Challans</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {!loading && rows.length === 0 && <EmptyRow colSpan={12} text="No records match these filters" />}
                  {rows.map((i) => (
                    <tr key={i.id} className="hover:bg-neutral-50/60 align-top">
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs font-semibold">{sheetRef(i.program)}</span>
                        <span className="block font-mono text-[11px] text-neutral-500">{challanRef(i)}</span>
                        <span className="block text-[11px] text-neutral-500">{i.program?.designNumber || ''}</span>
                      </td>
                      <td className="py-3 px-3 text-xs">
                        {i.inboundChallan ? (
                          <Link href={`/challans/${i.inboundChallan.id}`} className="font-mono text-brand-800 hover:underline">{i.inboundChallan.challanNumber}</Link>
                        ) : (
                          '—'
                        )}
                        <span className="block text-[11px] text-neutral-500">{departmentName(i.sourceDepartment)}</span>
                      </td>
                      <td className="py-3 px-3 font-semibold">{i.fabricName}<GarmentTag item={i} /></td>
                      <td className="py-3 px-3 text-neutral-700">{i.colour || '—'}</td>
                      <td className="py-3 px-3">
                        <FabricStatusBadge status={i.fabricProcessingStatus} />
                        {i.fabricStatusSource === 'CORRECTED' && <span className="block text-[11px] text-neutral-500 mt-0.5">Corrected</span>}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">
                        {i.status === 'AWAITING_RECEIPT' ? '—' : fmtQty(receivedBasis(i), i.uom)}
                        {i.receiptRemarks && <span className="block text-[11px] text-danger-700">{i.receiptRemarks}</span>}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">
                        {fmtQty(i.processedQuantity, i.uom)}
                        {flow.qc && (
                          <span className="block text-[11px] text-neutral-600">
                            P {fmtQty(i.passedQuantity, i.uom)} · <span className="text-danger-700">R {fmtQty(i.rejectedQuantity, i.uom)}</span> · RW {fmtQty(i.reworkQuantity, i.uom)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">
                        {flow.allocation ? transferredByUnit(i) : fmtQty(i.transferredQuantity, i.uom)}
                        {flow.qc && (
                          <span className="block text-[11px] text-neutral-600">
                            Shelf {fmtQty(i.rejectSentQuantity, i.uom)} · Rework {fmtQty(i.reworkSentQuantity, i.uom)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3"><WorkStatusBadge status={i.status} next={flow.next} qc={Boolean(flow.qc)} dispatch={flow.dispatchWords} /></td>
                      <td className="py-3 px-3"><PriorityBadge priority={i.priority} /></td>
                      <td className="py-3 px-3 text-[11px] text-neutral-600 whitespace-nowrap">
                        <span className="block">Received {fmtDate(i.receivedAt, true)}{i.receivedBy ? ` · ${i.receivedBy.fullName}` : ''}</span>
                        <span className="block">Started {fmtDate(i.startedAt, true)}</span>
                        <span className="block">Completed {fmtDate(i.completedAt, true)}</span>
                      </td>
                      <td className="py-3 px-3 text-xs">
                        {(i.transfers || []).length === 0
                          ? '—'
                          : i.transfers.map((t: any) => (
                              <span key={t.id} className="block whitespace-nowrap">
                                <Link href={`/challans/${t.challan?.id}`} className="font-mono text-brand-800 hover:underline">{t.challan?.challanNumber}</Link>
                                <span className="text-neutral-500">
                                  {' '}
                                  {flow.qc ? `${t.kind === 'REJECT' ? 'Reject' : t.kind === 'REWORK' ? 'Rework' : 'Pass'} ` : ''}
                                  {fmtQty(t.quantity, t.uom)} · {fmtDate(t.createdAt)}
                                </span>
                              </span>
                            ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : view === 'inspections' ? (
              <table className="w-full text-left text-sm">
                <thead className={THEAD}>
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-3">Production Sheet</th>
                    <th className="py-3 px-3">Incoming Challan</th>
                    <th className="py-3 px-3">Fabric / Colour</th>
                    <th className="py-3 px-3">Dyed / Undyed</th>
                    <th className="py-3 px-3 text-right">Inspected</th>
                    <th className="py-3 px-3 text-right">Pass</th>
                    <th className="py-3 px-3 text-right">Reject</th>
                    <th className="py-3 px-3 text-right">Rework</th>
                    <th className="py-3 px-3">Reasons / Remarks</th>
                    <th className="py-3 px-3">Inspector</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {!loading && rows.length === 0 && <EmptyRow colSpan={11} text="No inspections match these filters" />}
                  {rows.map((x) => (
                    <tr key={x.id} className="hover:bg-neutral-50/60 align-top">
                      <td className="py-3 px-4 text-xs text-neutral-600 whitespace-nowrap">{fmtDate(x.createdAt, true)}</td>
                      <td className="py-3 px-3">
                        <span className="font-mono text-xs font-semibold">{sheetRef(x.workItem?.program)}</span>
                        <span className="block font-mono text-[11px] text-neutral-500">{challanRef(x.workItem)}</span>
                      </td>
                      <td className="py-3 px-3 font-mono text-xs text-brand-800">
                        {x.workItem?.inboundChallan ? (
                          <Link href={`/challans/${x.workItem.inboundChallan.id}`} className="hover:underline">{x.workItem.inboundChallan.challanNumber}</Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-3 text-xs">
                        <span className="font-semibold text-neutral-900">{x.workItem?.fabricName}</span>
                        <span className="block text-neutral-600">{x.workItem?.colour || '—'}</span>
                      </td>
                      <td className="py-3 px-3"><FabricStatusBadge status={x.workItem?.fabricProcessingStatus} /></td>
                      <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(x.inspectedQuantity, x.uom)}</td>
                      <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(x.passQuantity, x.uom)}</td>
                      <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap text-danger-700">{fmtQty(x.rejectQuantity, x.uom)}</td>
                      <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(x.reworkQuantity, x.uom)}</td>
                      <td className="py-3 px-3 text-xs max-w-[240px]">
                        {x.rejectReason && <span className="block text-danger-700">Defect: {x.rejectReason}</span>}
                        {x.reworkReason && <span className="block text-neutral-700">Rework: {x.reworkReason}</span>}
                        {x.remarks && <span className="block text-neutral-500">{x.remarks}</span>}
                        {!x.rejectReason && !x.reworkReason && !x.remarks && '—'}
                      </td>
                      <td className="py-3 px-3 text-xs text-neutral-700 whitespace-nowrap">{x.inspector?.fullName || '—'}</td>
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
                        {view === 'outgoing' && flow.qc && (
                          <span className={`block font-sans text-[11px] font-semibold ${c.challanType === 'DEFECT_RETURN' ? 'text-danger-700' : 'text-neutral-600'}`}>
                            To {c.challanType === 'DEFECT_RETURN' ? flow.qc.rejectTo : departmentName(c.toDepartment)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-xs text-neutral-600 whitespace-nowrap">{fmtDate(c.issuedDate || c.createdAt)}</td>
                      <td className="py-3 px-3 font-mono text-xs">
                        {sheetRef(c.program)}
                        <span className="block text-[11px] text-neutral-500 font-sans">{c.program?.designNumber || ''}</span>
                      </td>
                      <td className="py-3 px-3 text-xs">{view === 'outgoing' ? c.parentChallan?.challanNumber || '—' : departmentName(c.fromDepartment)}</td>
                      <td className="py-3 px-3 text-xs text-neutral-700">
                        {(c.items || []).map((i: any) => (
                          <span key={i.id} className="flex items-center gap-1.5 whitespace-nowrap py-0.5">
                            <span>{i.garmentCategory ? `${i.garmentCategory}${i.styleRef ? ` ${i.styleRef}` : ''} · ` : ''}{i.fabricCode || i.itemDescription} · {i.colour || '—'} · {fmtQty(i.quantity, i.uom)}</span>
                            <FabricStatusBadge status={lineFabricStatus(c, i)} />
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

/** Sent quantity per unit, from the transfers (Recutting sends cut quantities in their own unit). */
function transferredByUnit(item: any) {
  const totals: Record<string, number> = {};
  for (const t of item.transfers || []) totals[t.uom] = (totals[t.uom] || 0) + (Number(t.quantity) || 0);
  return Object.entries(totals).map(([u, q]) => fmtQty(q, u)).join(' · ') || '—';
}

/** Dyed / Undyed of a challan line: the department's work item for incoming lines, else the line itself. */
function lineFabricStatus(challan: any, item: any) {
  const work = (challan.workItemsInbound || []).find((w: any) => w.inboundChallanItemId === item.id);
  return work?.fabricProcessingStatus || item.fabricProcessingStatus || null;
}

export function WorkHistory({ flow }: { flow: WorkflowView }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <HistoryContent flow={flow} />
    </Suspense>
  );
}
