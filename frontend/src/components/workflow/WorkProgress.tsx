'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CategoryBadge, GarmentTag } from '@/components/recutting/RecuttingUi';
import { DeadlineText, EmptyRow, Notice, PageHeader, Panel, THEAD, WorkStatusBadge, fetchJson, fmtQty, sheetRef } from '@/components/workflow/WorkflowUi';
import { CATEGORY_LABEL } from '@/lib/recutting.mjs';
import { awaitingTakeIn, inProduction, receivedBasis, workStatusLabel } from '@/lib/work-items.mjs';
import { workPath, type WorkflowView } from '@/lib/workflow-views';

const OPEN = 'RECEIVED,IN_PROGRESS,COMPLETED,READY_FOR_TRANSFER,PARTIALLY_TRANSFERRED';
const GROUPS = [
  { id: 'category', label: 'Category' },
  { id: 'style', label: 'Style' },
  { id: 'sheet', label: 'Production Sheet' },
  { id: 'challan', label: 'Incoming Challan' },
  { id: 'status', label: 'Status' },
] as const;
type GroupBy = (typeof GROUPS)[number]['id'];

const MEASURES = [
  { key: 'received', label: 'Received' },
  { key: 'taken', label: 'Taken in' },
  { key: 'floor', label: 'On floor' },
  { key: 'completed', label: 'Completed' },
  { key: 'defective', label: 'Defective' },
  { key: 'sent', label: 'Sent' },
] as const;

function measuresOf(i: any): Record<string, number> {
  return {
    received: receivedBasis(i),
    taken: Number(i.takenQuantity) || 0,
    floor: inProduction(i),
    completed: Number(i.processedQuantity) || 0,
    defective: Number(i.defectQuantity) || 0,
    sent: Number(i.transferredQuantity) || 0,
  };
}

/** Production progress grouped by category, style, sheet, challan or status; totals stay per unit. */
export function WorkProgress({ flow }: { flow: WorkflowView }) {
  const [items, setItems] = useState<any[]>([]);
  const [groupBy, setGroupBy] = useState<GroupBy>('category');
  const [includeDone, setIncludeDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const body = await fetchJson(`${flow.api}/items?status=${includeDone ? `${OPEN},TRANSFERRED` : OPEN}`);
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
  }, [includeDone]);

  const keyOf = (i: any): [string, React.ReactNode] => {
    switch (groupBy) {
      case 'category':
        return [i.garmentCategory || '-', i.garmentCategory ? <CategoryBadge category={i.garmentCategory} /> : 'No category'];
      case 'style':
        return [`${i.garmentCategory || ''}|${i.styleRef || ''}`, <span className="flex items-center gap-2">{i.garmentCategory && <CategoryBadge category={i.garmentCategory} />}{i.styleRef || 'No style'}</span>];
      case 'sheet':
        return [i.program?.id || '-', <span className="font-mono">{sheetRef(i.program)}{i.program?.designNumber ? ` · ${i.program.designNumber}` : ''}</span>];
      case 'challan':
        return [i.inboundChallan?.id || '-', <span className="font-mono">{i.inboundChallan?.challanNumber || '—'}</span>];
      default:
        return [i.status, workStatusLabel(i.status, flow.next)];
    }
  };

  const groups = useMemo(() => {
    const map = new Map<string, { title: React.ReactNode; items: any[]; totals: Record<string, Record<string, number>> }>();
    for (const i of items) {
      const [key, title] = keyOf(i);
      const g = map.get(key) || { title, items: [], totals: {} };
      g.items.push(i);
      const m = measuresOf(i);
      for (const [k, v] of Object.entries(m)) {
        g.totals[k] ||= {};
        g.totals[k][i.uom] = (g.totals[k][i.uom] || 0) + v;
      }
      map.set(key, g);
    }
    const order = Object.keys(CATEGORY_LABEL);
    return Array.from(map.entries()).sort(([a], [b]) => (groupBy === 'category' ? order.indexOf(a) - order.indexOf(b) : String(a).localeCompare(String(b))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, groupBy]);

  const unitText = (byUnit?: Record<string, number>) =>
    Object.entries(byUnit || {}).filter(([, q]) => q > 0).map(([u, q]) => fmtQty(q, u)).join(' · ') || '—';

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <PageHeader title="Production Progress" loading={loading} onRefresh={load}>
        <label className="flex items-center gap-2 text-xs font-semibold text-neutral-700">
          <input type="checkbox" checked={includeDone} onChange={(e) => setIncludeDone(e.target.checked)} className="accent-brand-600" />
          Include fully transferred
        </label>
      </PageHeader>

      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {error && <Notice kind="error" onClose={() => setError(null)}>{error}</Notice>}

        <div role="tablist" className="inline-flex flex-wrap p-0.5 bg-neutral-100 rounded-lg">
          {GROUPS.map((g) => (
            <button
              key={g.id}
              role="tab"
              aria-selected={groupBy === g.id}
              onClick={() => setGroupBy(g.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                groupBy === g.id ? 'bg-white text-brand-800 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              By {g.label}
            </button>
          ))}
        </div>

        {!loading && groups.length === 0 && (
          <Panel title="Production">
            <table className="w-full"><tbody><EmptyRow colSpan={1} text={`No ${flow.label} work in progress`} /></tbody></table>
          </Panel>
        )}

        {groups.map(([key, g]) => (
          <section key={key} className="bg-white border border-neutral-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="px-5 py-3 border-b border-neutral-200 flex flex-col lg:flex-row lg:items-center justify-between gap-2">
              <div className="flex items-center gap-3 text-sm font-bold text-neutral-900">
                {g.title}
                <span className="text-[11px] font-semibold tabular-nums bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">{g.items.length}</span>
              </div>
              <dl className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                {MEASURES.map((m) => (
                  <div key={m.key} className="flex gap-1">
                    <dt className="text-neutral-500">{m.label}</dt>
                    <dd className={`font-semibold tabular-nums ${m.key === 'defective' ? 'text-danger-700' : 'text-neutral-900'}`}>{unitText(g.totals[m.key])}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className={THEAD}>
                  <tr>
                    <th className="py-2.5 px-4">Challan</th>
                    <th className="py-2.5 px-3">Fabric / Colour</th>
                    <th className="py-2.5 px-3 text-right">Received</th>
                    <th className="py-2.5 px-3 text-right">Not taken in</th>
                    <th className="py-2.5 px-3 text-right">On floor</th>
                    <th className="py-2.5 px-3 text-right">Completed</th>
                    <th className="py-2.5 px-3 text-right">Defective</th>
                    <th className="py-2.5 px-3 text-right">Sent</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Deadline</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {g.items.map((i) => (
                    <tr key={i.id} className="hover:bg-neutral-50/60">
                      <td className="py-2.5 px-4">
                        <Link href={`${workPath(flow)}?itemId=${i.id}`} className="font-mono text-xs font-semibold text-brand-800 hover:underline">{i.inboundChallan?.challanNumber || '—'}</Link>
                        <span className="block font-mono text-[11px] text-neutral-500">{sheetRef(i.program)}</span>
                      </td>
                      <td className="py-2.5 px-3 text-xs">
                        <span className="font-semibold text-neutral-900">{i.fabricName}</span>
                        <span className="block text-neutral-600">{i.colour || '—'}</span>
                        {groupBy !== 'category' && groupBy !== 'style' && <GarmentTag item={i} />}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(receivedBasis(i), i.uom)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(awaitingTakeIn(i), i.uom)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(inProduction(i), i.uom)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap font-semibold">{fmtQty(i.processedQuantity, i.uom)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap text-danger-700">{fmtQty(i.defectQuantity, i.uom)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(i.transferredQuantity, i.uom)}</td>
                      <td className="py-2.5 px-3">
                        <WorkStatusBadge
                          status={i.status}
                          next={flow.next}
                          dispatch={flow.dispatchWords}
                          label={i.status === 'IN_PROGRESS' && i.processedQuantity > 0 ? 'Partially Completed' : undefined}
                        />
                      </td>
                      <td className="py-2.5 px-3 text-xs whitespace-nowrap"><DeadlineText program={i.program} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
