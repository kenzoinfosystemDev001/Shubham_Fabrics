'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { CategoryBadge } from '@/components/recutting/RecuttingUi';
import {
  BTN_PRIMARY,
  ChallanBarcode,
  DocumentsButton,
  EmptyRow,
  FIELD,
  FabricStatusBadge,
  Notice,
  PageHeader,
  Panel,
  PriorityBadge,
  THEAD,
  fetchJson,
  fmtDate,
  fmtQty,
  sheetRef,
} from '@/components/workflow/WorkflowUi';
import { transferPath, type WorkflowView } from '@/lib/workflow-views';
import { FinishedGarmentList, GarmentThumb, useGarmentImages } from '@/components/workflow/FinishedGarments';
import { groupGarments, imageFor } from '@/lib/finished-garments.mjs';

/** Challans this department has issued to the next one, with their lines and source references. */
export function WorkOutgoing({ flow }: { flow: WorkflowView }) {
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  // Finished garments (Finishing onward) are listed by name and image, without colour or quantity.
  const finished = Boolean(flow.finishedGoods);
  const { images } = useGarmentImages(finished ? rows.map((c) => c.programId) : []);
  const columns = finished ? 7 : 8;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (search.trim()) q.set('search', search.trim());
      const body = await fetchJson(`${flow.api}/transfer-challans?${q}`);
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
    <div className="min-h-screen bg-canvas pb-16">
      <PageHeader title="Outgoing Challans" loading={loading} onRefresh={load}>
        <Link href={transferPath(flow, 'PASS')} className={BTN_PRIMARY}>
          Issue Challan to {flow.next}
        </Link>
      </PageHeader>

      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {error && <Notice kind="error" onClose={() => setError(null)}>{error}</Notice>}
        <Panel
          title={`Challans to ${flow.next}`}
          count={rows.length}
          actions={
            <form
              onSubmit={(e) => {
                e.preventDefault();
                load();
              }}
              className="relative"
            >
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Challan or serial" aria-label="Search challans" className={`${FIELD} pl-9 md:w-64`} />
            </form>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className={THEAD}>
                <tr>
                  <th className="py-3 px-4">Challan</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Production Sheet</th>
                  <th className="py-3 px-3">{finished ? 'Finished garments' : 'Items'}</th>
                  {!finished && <th className="py-3 px-3 text-right">Quantity</th>}
                  <th className="py-3 px-3">Priority</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3"><span className="sr-only">Documents</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {!loading && rows.length === 0 && <EmptyRow colSpan={columns} text={`No challans issued to ${flow.next} yet`} />}
                {rows.map((c) => {
                  const open = expanded === c.id;
                  const totals: Record<string, number> = {};
                  for (const i of c.items || []) totals[i.uom] = (totals[i.uom] || 0) + (Number(i.quantity) || 0);
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
                        {finished ? (
                          <td className="py-3 px-3 text-xs">
                            {groupGarments((c.items || []).map((i: any) => ({ ...i, programId: c.programId }))).map((g) => (
                              <span key={g.key} className="flex items-center gap-2 whitespace-nowrap py-0.5">
                                <GarmentThumb image={imageFor(images, g.items[0])} name={g.name} size="sm" />
                                <span className="font-semibold text-neutral-900">{g.name}</span>
                              </span>
                            ))}
                          </td>
                        ) : (
                        <>
                        <td className="py-3 px-3 text-xs">
                          {(c.items || []).map((i: any) => (
                            <span key={i.id} className="flex items-center gap-1.5 whitespace-nowrap py-0.5">
                              {i.garmentCategory && <CategoryBadge category={i.garmentCategory} />}
                              {i.styleRef && <span className="text-neutral-800">{i.styleRef}</span>}
                              <span className="text-neutral-500">{i.colour || '—'} · {fmtQty(i.quantity, i.uom)}</span>
                            </span>
                          ))}
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">
                          {Object.entries(totals).map(([u, q]) => fmtQty(q, u)).join(' · ') || '—'}
                        </td>
                        </>
                        )}
                        <td className="py-3 px-3"><PriorityBadge priority={c.priority} /></td>
                        <td className="py-3 px-3 text-xs">{String(c.status || '').replace(/_/g, ' ')}</td>
                        <td className="py-3 px-3 text-right"><DocumentsButton programId={c.programId} challanId={c.id} /></td>
                      </tr>
                      {open && (
                        <tr className="bg-neutral-50/60">
                          <td colSpan={columns} className="px-4 sm:px-6 py-4">
                            <div className="flex flex-col lg:flex-row gap-5">
                              <ChallanBarcode value={c.challanNumber} />
                              {finished ? (
                                <div className="flex-1 bg-white border border-neutral-200 rounded-xl">
                                  <FinishedGarmentList items={c.items || []} programId={c.programId} images={images} />
                                  {c.remarks && <p className="px-4 pb-3 text-[11px] text-neutral-600">Remarks: {c.remarks}</p>}
                                </div>
                              ) : (
                              <div className="flex-1 overflow-x-auto">
                                <table className="w-full text-left text-xs bg-white border border-neutral-200 rounded-xl overflow-hidden">
                                  <thead className={THEAD}>
                                    <tr>
                                      <th className="py-2.5 px-3">Category / Style</th>
                                      <th className="py-2.5 px-3">Colour</th>
                                      <th className="py-2.5 px-3">Fabric</th>
                                      <th className="py-2.5 px-3">Dyed / Undyed</th>
                                      <th className="py-2.5 px-3 text-right">Quantity</th>
                                      <th className="py-2.5 px-3">{flow.label} line</th>
                                      <th className="py-2.5 px-3">Incoming</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-neutral-100">
                                    {(c.items || []).map((i: any) => {
                                      const t = (c.workTransfers || []).find((x: any) => x.challanItemId === i.id);
                                      return (
                                        <tr key={i.id}>
                                          <td className="py-2.5 px-3">
                                            {i.garmentCategory ? <CategoryBadge category={i.garmentCategory} /> : '—'}
                                            {i.styleRef && <span className="block mt-0.5">{i.styleRef}</span>}
                                          </td>
                                          <td className="py-2.5 px-3">{i.colour || '—'}</td>
                                          <td className="py-2.5 px-3 font-semibold">{i.fabricCode || i.itemDescription}</td>
                                          <td className="py-2.5 px-3"><FabricStatusBadge status={i.fabricProcessingStatus} /></td>
                                          <td className="py-2.5 px-3 text-right tabular-nums">{fmtQty(i.quantity, i.uom)}</td>
                                          <td className="py-2.5 px-3 font-mono">{t?.workItem?.itemNumber || '—'}</td>
                                          <td className="py-2.5 px-3 font-mono">{t?.workItem?.inboundChallan?.challanNumber || c.parentChallan?.challanNumber || '—'}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                                {c.remarks && <p className="mt-2 text-[11px] text-neutral-600">Remarks: {c.remarks}</p>}
                              </div>
                              )}
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
