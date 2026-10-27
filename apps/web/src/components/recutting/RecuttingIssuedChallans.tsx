'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { BTN_PRIMARY, ChallanBarcode, DocumentsButton, EmptyRow, FIELD, FabricStatusBadge, Notice, PageHeader, Panel, THEAD, fetchJson, fmtDate, fmtQty, sheetRef } from '@/components/workflow/WorkflowUi';
import { CategoryBadge } from '@/components/recutting/RecuttingUi';
import { CATEGORY_LABEL, GARMENT_CATEGORIES } from '@/lib/recutting.mjs';
import { formatTotals, totalsByUnit } from '@/lib/challan-units.mjs';

export function RecuttingIssuedChallans() {
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (search.trim()) q.set('search', search.trim());
      if (category) q.set('category', category);
      const body = await fetchJson(`/api/recutting/stitching-challans?${q}`);
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
  }, [category]);

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <PageHeader title="Issued Challans" loading={loading} onRefresh={load}>
        <Link href="/recutting/my-work/issue-challan" className={BTN_PRIMARY}>
          Generate Stitching Challan
        </Link>
      </PageHeader>

      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {error && <Notice kind="error" onClose={() => setError(null)}>{error}</Notice>}
        <Panel
          title="Challans to Stitching"
          count={rows.length}
          actions={
            <>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${FIELD} md:w-44`} aria-label="Category">
                <option value="">All categories</option>
                {GARMENT_CATEGORIES.map((c) => <option key={c} value={c}>{(CATEGORY_LABEL as Record<string, string>)[c]}</option>)}
              </select>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  load();
                }}
                className="relative"
              >
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Challan, sheet, design or style" aria-label="Search challans" className={`${FIELD} pl-9 md:w-64`} />
              </form>
            </>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className={THEAD}>
                <tr>
                  <th className="py-3 px-4">Challan</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Production Sheet</th>
                  <th className="py-3 px-3">Items</th>
                  <th className="py-3 px-3 text-right">Quantity</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3"><span className="sr-only">Documents</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {!loading && rows.length === 0 && <EmptyRow colSpan={7} text="No challans issued to Stitching yet" />}
                {rows.map((c) => {
                  const open = expanded === c.id;
                  return (
                    <React.Fragment key={c.id}>
                      <tr className="hover:bg-neutral-50/60 align-top">
                        <td className="py-3 px-4">
                          <button onClick={() => setExpanded(open ? null : c.id)} className="font-mono text-xs font-bold text-brand-800 hover:underline" aria-expanded={open}>
                            {c.challanNumber}
                          </button>
                          <span className="block text-[11px] text-neutral-500">{c.issuedBy?.fullName || ''}</span>
                        </td>
                        <td className="py-3 px-3 text-xs text-neutral-600 whitespace-nowrap">{fmtDate(c.issuedDate || c.createdAt)}</td>
                        <td className="py-3 px-3 text-xs">
                          <span className="font-mono font-semibold">{sheetRef(c.program)}</span>
                          <span className="block text-[11px] text-neutral-500">{c.program?.designNumber || ''}</span>
                        </td>
                        <td className="py-3 px-3 text-xs">
                          {(c.items || []).map((i: any) => (
                            <span key={i.id} className="flex items-center gap-1.5 whitespace-nowrap py-0.5">
                              {i.garmentCategory && <CategoryBadge category={i.garmentCategory} />}
                              <span className="text-neutral-800">{i.styleRef || '—'}</span>
                              <span className="text-neutral-500">· {i.colour || '—'} · {fmtQty(i.quantity, i.uom)}</span>
                            </span>
                          ))}
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">
                          {formatTotals(totalsByUnit(c.items || []), '—')}
                        </td>
                        <td className="py-3 px-3 text-xs">{String(c.status || '').replace(/_/g, ' ')}</td>
                        <td className="py-3 px-3 text-right"><DocumentsButton programId={c.programId} challanId={c.id} /></td>
                      </tr>
                      {open && (
                        <tr className="bg-neutral-50/60">
                          <td colSpan={7} className="px-4 sm:px-6 py-4">
                            <div className="flex flex-col lg:flex-row gap-5">
                              <ChallanBarcode value={c.challanNumber} />
                              <div className="flex-1 overflow-x-auto">
                                <table className="w-full text-left text-xs bg-white border border-neutral-200 rounded-xl overflow-hidden">
                                  <thead className={THEAD}>
                                    <tr>
                                      <th className="py-2.5 px-3">Category</th>
                                      <th className="py-2.5 px-3">Style</th>
                                      <th className="py-2.5 px-3">Colour</th>
                                      <th className="py-2.5 px-3">Fabric</th>
                                      <th className="py-2.5 px-3">Dyed / Undyed</th>
                                      <th className="py-2.5 px-3 text-right">Quantity</th>
                                      <th className="py-2.5 px-3">Allocation</th>
                                      <th className="py-2.5 px-3">Incoming</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-neutral-100">
                                    {(c.items || []).map((i: any) => {
                                      const t = (c.workTransfers || []).find((x: any) => x.challanItemId === i.id);
                                      return (
                                        <tr key={i.id}>
                                          <td className="py-2.5 px-3">{i.garmentCategory ? <CategoryBadge category={i.garmentCategory} otherName={t?.allocation?.otherName} /> : '—'}</td>
                                          <td className="py-2.5 px-3">{i.styleRef || '—'}</td>
                                          <td className="py-2.5 px-3">{i.colour || '—'}</td>
                                          <td className="py-2.5 px-3 font-semibold">{i.fabricCode || i.itemDescription}</td>
                                          <td className="py-2.5 px-3"><FabricStatusBadge status={i.fabricProcessingStatus} /></td>
                                          <td className="py-2.5 px-3 text-right tabular-nums">{fmtQty(i.quantity, i.uom)}</td>
                                          <td className="py-2.5 px-3 font-mono">{t?.allocation?.allocationNumber || '—'}</td>
                                          <td className="py-2.5 px-3 font-mono">{t?.workItem?.inboundChallan?.challanNumber || c.parentChallan?.challanNumber || '—'}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                                {c.remarks && <p className="mt-2 text-[11px] text-neutral-600">Remarks: {c.remarks}</p>}
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
    </div>
  );
}
