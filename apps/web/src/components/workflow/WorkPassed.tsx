'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Search } from 'lucide-react';
import {
  BTN_PRIMARY,
  DeadlineText,
  EmptyRow,
  FIELD,
  Notice,
  PageHeader,
  Panel,
  THEAD,
  WorkStatusBadge,
  fetchJson,
  fmtQty,
  challanRef,
  sheetRef,
} from '@/components/workflow/WorkflowUi';
import { readyToTransfer, receivedBasis } from '@/lib/work-items.mjs';
import { transferPath, type WorkflowView } from '@/lib/workflow-views';
import { GarmentTag } from '@/components/recutting/RecuttingUi';

const FILTERS = [
  { id: 'waiting', label: 'Awaiting Dispatch' },
  { id: 'all', label: 'All Passed' },
];

/** QC lines with passed quantity: how much passed, how much has left for the next department, and what is still waiting. */
export function WorkPassed({ flow }: { flow: WorkflowView }) {
  const [filter, setFilter] = useState('waiting');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ outcome: 'PASS' });
      if (filter === 'waiting') q.set('ready', '1');
      if (search.trim()) q.set('search', search.trim());
      const body = await fetchJson(`${flow.api}/items?${q}`);
      setItems(body.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <PageHeader title="Passed Items" loading={loading} onRefresh={load}>
        <Link href={transferPath(flow, 'PASS')} className={BTN_PRIMARY}>
          Issue Challan to {flow.next}
        </Link>
      </PageHeader>

      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {error && <Notice kind="error" onClose={() => setError(null)}>{error}</Notice>}
        <Panel
          title={`Passed in ${flow.label}`}
          count={items.length}
          actions={
            <>
              <div role="tablist" className="inline-flex p-0.5 bg-neutral-100 rounded-lg">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    role="tab"
                    aria-selected={filter === f.id}
                    onClick={() => setFilter(f.id)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                      filter === f.id ? 'bg-white text-brand-800 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
                    }`}
                  >
                    {f.label}
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
                  placeholder="Sheet, challan, fabric or colour"
                  aria-label="Search passed items"
                  className={`${FIELD} pl-9 md:w-72`}
                />
              </form>
            </>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className={THEAD}>
                <tr>
                  <th className="py-3 px-4">Production Sheet</th>
                  <th className="py-3 px-3">Incoming Challan</th>
                  <th className="py-3 px-3">Design / Serial</th>
                  <th className="py-3 px-3">Fabric</th>
                  <th className="py-3 px-3">Colour</th>
                  <th className="py-3 px-3 text-right">Received</th>
                  <th className="py-3 px-3 text-right">Passed</th>
                  <th className="py-3 px-3 text-right">Dispatched to {flow.next}</th>
                  <th className="py-3 px-3 text-right">Awaiting Dispatch</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Deadline</th>
                  <th className="py-3 px-3"><span className="sr-only">Dispatch</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {!loading && items.length === 0 && <EmptyRow colSpan={12} text={filter === 'waiting' ? `Nothing passed is waiting for ${flow.next}` : 'Nothing has passed inspection yet'} />}
                {items.map((i) => {
                  const ready = readyToTransfer(i);
                  return (
                    <tr key={i.id} className="hover:bg-neutral-50/60">
                      <td className="py-3 px-4">
                        <Link href={`/programs/${i.program?.id}`} className="font-mono text-xs font-semibold text-neutral-900 hover:underline">
                          {sheetRef(i.program)}
                        </Link>
                        <span className="block font-mono text-[11px] text-neutral-500">{challanRef(i)}</span>
                      </td>
                      <td className="py-3 px-3 text-xs">
                        {i.inboundChallan ? (
                          <Link href={`/challans/${i.inboundChallan.id}`} className="font-mono text-brand-800 hover:underline">
                            {i.inboundChallan.challanNumber}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-3 text-xs text-neutral-700">
                        {i.program?.designNumber || i.program?.wilcomDesignNumber || '—'}
                        <span className="block font-mono text-[11px] text-neutral-500">{i.program?.programSerialNo || '—'}</span>
                      </td>
                      <td className="py-3 px-3 font-semibold text-neutral-900">{i.fabricName}<GarmentTag item={i} /></td>
                      <td className="py-3 px-3 text-neutral-700">{i.colour || '—'}</td>
                      <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(receivedBasis(i), i.uom)}</td>
                      <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap font-semibold text-brand-800">{fmtQty(i.passedQuantity, i.uom)}</td>
                      <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(i.transferredQuantity, i.uom)}</td>
                      <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap font-semibold">{fmtQty(ready, i.uom)}</td>
                      <td className="py-3 px-3"><WorkStatusBadge status={i.status} qc /></td>
                      <td className="py-3 px-3 text-xs whitespace-nowrap"><DeadlineText program={i.program} /></td>
                      <td className="py-3 px-3 text-right">
                        {ready > 0 && (
                          <Link
                            href={`${transferPath(flow, 'PASS')}?programId=${i.programId}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900 whitespace-nowrap"
                          >
                            <span>Dispatch</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        )}
                      </td>
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
