'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Download, Printer } from 'lucide-react';
import { BTN_PRIMARY, BTN_QUIET, EmptyRow, FIELD, Notice, PageHeader, Panel, THEAD, fetchJson, fmtDate, fmtQty, sheetRef } from '@/components/workflow/WorkflowUi';
import { AllocationStatusBadge, CategoryBadge, fmtTotals } from '@/components/recutting/RecuttingUi';
import { ALLOCATION_STATUS_LABEL, CATEGORY_LABEL, GARMENT_CATEGORIES, allocationStatusOf, categoryName, readyForStitching } from '@/lib/recutting.mjs';

const EMPTY = { from: '', to: '', challan: '', sheet: '', design: '', style: '', color: '', category: '', unit: '', status: '' };
const TEXT_FILTERS = [
  { key: 'challan', label: 'Challan No.' },
  { key: 'sheet', label: 'Production Sheet / Serial' },
  { key: 'design', label: 'Design No.' },
  { key: 'style', label: 'Style / Item' },
  { key: 'color', label: 'Colour' },
] as const;

function csvCell(value: unknown) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function HistoryContent() {
  const params = useSearchParams();
  const [filters, setFilters] = useState({ ...EMPTY, category: (params.get('category') || '').toUpperCase() });
  const openOnly = params.get('open') === '1';
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (f = filters) => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      Object.entries(f).forEach(([k, v]) => v && q.set(k, v));
      if (openOnly) q.set('open', '1');
      const body = await fetchJson(`/api/recutting/allocations?${q}`);
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

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFilters({ ...filters, [k]: e.target.value });

  // Totals per category and unit (MTR and PCS are never added together).
  const totals: Record<string, { allocated: Record<string, number>; cut: Record<string, number>; issued: Record<string, number> }> = {};
  for (const a of rows) {
    if (a.status === 'CANCELLED') continue;
    const t = (totals[a.category] ||= { allocated: {}, cut: {}, issued: {} });
    t.allocated[a.allocatedUom] = (t.allocated[a.allocatedUom] || 0) + a.allocatedQuantity;
    t.cut[a.cutUom] = (t.cut[a.cutUom] || 0) + a.cutQuantity;
    t.issued[a.cutUom] = (t.issued[a.cutUom] || 0) + a.transferredQuantity;
  }

  const exportCsv = () => {
    if (rows.length === 0) return;
    const data = rows.map((a) => ({
      Date: a.createdAt,
      Allocation: a.allocationNumber,
      Category: categoryName(a),
      Style: a.styleRef || '',
      'Production Sheet': sheetRef(a.workItem?.program),
      Design: a.workItem?.program?.designNumber || '',
      Serial: a.workItem?.program?.programSerialNo || '',
      'Incoming Challan': a.workItem?.inboundChallan?.challanNumber || '',
      Fabric: a.workItem?.fabricName || '',
      Colour: a.workItem?.colour || '',
      'Allocated Qty': a.allocatedQuantity,
      'Allocated Unit': a.allocatedUom,
      'Cut Qty': a.cutQuantity,
      'Cut Unit': a.cutUom,
      'Issued to Stitching': a.transferredQuantity,
      'Ready for Stitching': readyForStitching(a),
      Status: (ALLOCATION_STATUS_LABEL as Record<string, string>)[allocationStatusOf(a)],
      'Stitching Challans': (a.transfers || []).map((t: any) => `${t.challan?.challanNumber} (${t.quantity} ${t.uom})`).join('; '),
      'Allocated By': a.createdBy?.fullName || '',
      'Cancel Reason': a.cancelReason || '',
    }));
    const headers = Object.keys(data[0]);
    const csv = [headers.join(','), ...data.map((r) => headers.map((h) => csvCell((r as any)[h])).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    Object.assign(document.createElement('a'), { href: url, download: 'recutting-allocations.csv' }).click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <PageHeader title="Allocation History" loading={loading} onRefresh={() => load()}>
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
            <span className="text-xs font-semibold text-neutral-600">Category</span>
            <select value={filters.category} onChange={set('category')} className={`${FIELD} mt-1`}>
              <option value="">Any</option>
              {GARMENT_CATEGORIES.map((c) => <option key={c} value={c}>{(CATEGORY_LABEL as Record<string, string>)[c]}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-neutral-600">Cut unit</span>
            <select value={filters.unit} onChange={set('unit')} className={`${FIELD} mt-1`}>
              <option value="">Any</option>
              <option value="MTR">Meters</option>
              <option value="PCS">Pieces</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-neutral-600">Status</span>
            <select value={filters.status} onChange={set('status')} className={`${FIELD} mt-1`}>
              <option value="">Any</option>
              {Object.entries(ALLOCATION_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button type="submit" className={`${BTN_PRIMARY} flex-1`}>Apply</button>
            <button
              type="button"
              onClick={() => {
                setFilters(EMPTY);
                load(EMPTY);
              }}
              className={BTN_QUIET}
            >
              Reset
            </button>
          </div>
        </form>

        {Object.keys(totals).length > 0 && (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {GARMENT_CATEGORIES.filter((c) => totals[c]).map((c) => (
              <div key={c} className="bg-white border border-neutral-200 rounded-2xl p-4 text-xs space-y-1">
                <CategoryBadge category={c} />
                <p className="text-neutral-600 tabular-nums">Allocated {fmtTotals(totals[c].allocated)}</p>
                <p className="text-neutral-600 tabular-nums">Cut {fmtTotals(totals[c].cut)}</p>
                <p className="text-neutral-900 font-semibold tabular-nums">Issued {fmtTotals(totals[c].issued)}</p>
              </div>
            ))}
          </section>
        )}

        <Panel title={openOnly ? 'Open Allocations' : 'Allocations'} count={rows.length}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className={THEAD}>
                <tr>
                  <th className="py-3 px-4">Allocation</th>
                  <th className="py-3 px-3">Category / Style</th>
                  <th className="py-3 px-3">Production Sheet</th>
                  <th className="py-3 px-3">Incoming Challan</th>
                  <th className="py-3 px-3">Fabric / Colour</th>
                  <th className="py-3 px-3 text-right">Allocated</th>
                  <th className="py-3 px-3 text-right">Cut</th>
                  <th className="py-3 px-3 text-right">Issued</th>
                  <th className="py-3 px-3 text-right">Ready</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Stitching Challans</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {!loading && rows.length === 0 && <EmptyRow colSpan={11} text="No allocations match these filters" />}
                {rows.map((a) => (
                  <tr key={a.id} className="hover:bg-neutral-50/60 align-top">
                    <td className="py-3 px-4">
                      <Link href={`/recutting/my-work/allocation?itemId=${a.workItemId}`} className="font-mono text-xs font-semibold text-brand-800 hover:underline">
                        {a.allocationNumber}
                      </Link>
                      <span className="block text-[11px] text-neutral-500">{fmtDate(a.createdAt, true)}</span>
                      <span className="block text-[11px] text-neutral-500">{a.createdBy?.fullName || ''}</span>
                    </td>
                    <td className="py-3 px-3">
                      <CategoryBadge category={a.category} otherName={a.otherName} />
                      <span className="block text-xs text-neutral-800 mt-1">{a.styleRef || '—'}</span>
                    </td>
                    <td className="py-3 px-3 text-xs">
                      <span className="font-mono font-semibold">{sheetRef(a.workItem?.program)}</span>
                      <span className="block text-[11px] text-neutral-500">{a.workItem?.program?.designNumber || ''}</span>
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-brand-800">
                      {a.workItem?.inboundChallan ? (
                        <Link href={`/challans/${a.workItem.inboundChallan.id}`} className="hover:underline">{a.workItem.inboundChallan.challanNumber}</Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-3 text-xs">
                      <span className="font-semibold text-neutral-900">{a.workItem?.fabricName}</span>
                      <span className="block text-neutral-600">{a.workItem?.colour || '—'}</span>
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(a.allocatedQuantity, a.allocatedUom)}</td>
                    <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(a.cutQuantity, a.cutUom)}</td>
                    <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(a.transferredQuantity, a.cutUom)}</td>
                    <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap font-semibold">{fmtQty(readyForStitching(a), a.cutUom)}</td>
                    <td className="py-3 px-3">
                      <AllocationStatusBadge status={allocationStatusOf(a)} />
                      {a.cancelReason && <span className="block text-[11px] text-danger-700 mt-0.5">{a.cancelReason}</span>}
                    </td>
                    <td className="py-3 px-3 text-xs">
                      {(a.transfers || []).length === 0
                        ? '—'
                        : a.transfers.map((t: any) => (
                            <span key={t.id} className="block whitespace-nowrap">
                              <Link href={`/challans/${t.challan?.id}`} className="font-mono text-brand-800 hover:underline">{t.challan?.challanNumber}</Link>
                              <span className="text-neutral-500"> {fmtQty(t.quantity, t.uom)}</span>
                            </span>
                          ))}
                    </td>
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

export function RecuttingAllocationHistory() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <HistoryContent />
    </Suspense>
  );
}
