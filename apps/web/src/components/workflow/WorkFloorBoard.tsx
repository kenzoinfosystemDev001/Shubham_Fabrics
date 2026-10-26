'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { FabricStatusBadge, Notice, PageHeader, PriorityBadge, fetchJson, fmtDate, fmtQty, isOverdue, sheetRef } from '@/components/workflow/WorkflowUi';
import { departmentName, transferPath, workPath, type WorkflowView } from '@/lib/workflow-views';
import { GarmentTag } from '@/components/recutting/RecuttingUi';

/** What the quantity on a card means in each stage (matches the floor-board API). */
const STAGE_HINT: Record<string, string> = {
  AWAITING_RECEIPT: 'Expected',
  RECEIVED: 'Received',
  PENDING: 'To process',
  IN_PROGRESS: 'To process',
  PARTIALLY_COMPLETED: 'Still to process',
  READY: 'Ready to transfer',
  PARTIALLY_TRANSFERRED: 'Transferred',
  FULLY_TRANSFERRED: 'Transferred',
  // QC departments
  AWAITING_INSPECTION: 'To inspect',
  INSPECTING: 'Still to inspect',
  PASSED: 'Passed, not sent',
  REJECTED: 'Rejected, not sent',
  REWORK: 'Rework, not returned',
  COMPLETED: 'Inspected',
};

export function WorkFloorBoard({ flow }: { flow: WorkflowView }) {
  const stageHref = (key: string, itemId: string) =>
    key === 'AWAITING_RECEIPT'
      ? `${flow.base}/my-work/incoming`
      : key === 'PASSED'
      ? transferPath(flow, 'PASS')
      : key === 'REJECTED'
      ? transferPath(flow, 'REJECT')
      : key === 'REWORK'
      ? transferPath(flow, 'REWORK')
      : `${workPath(flow)}?itemId=${itemId}`;
  const [stages, setStages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const body = await fetchJson(`${flow.api}/floor-board`);
      setStages(body.data?.stages || []);
      setUpdatedAt(body.data?.generatedAt || null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A QC line can sit in several stages; count each line once.
  const overdue = new Set(
    stages
      .filter((s) => s.key !== 'FULLY_TRANSFERRED' && s.key !== 'COMPLETED')
      .flatMap((s) => s.items.filter((i: any) => isOverdue(i.program)).map((i: any) => i.id)),
  ).size;

  return (
    <div className="min-h-screen bg-canvas pb-10">
      <PageHeader title="Floor Board" loading={loading} onRefresh={load}>
        {overdue > 0 && (
          <Link href={`${workPath(flow)}?overdue=1`} className="text-xs font-semibold text-danger-700 bg-danger-50 border border-danger-200 px-2.5 py-1 rounded-lg">
            {overdue} overdue
          </Link>
        )}
        {updatedAt && <span className="text-xs text-neutral-500">Updated {fmtDate(updatedAt, true)}</span>}
      </PageHeader>

      <main className="p-4 sm:p-8 space-y-4">
        {error && <Notice kind="error" onClose={() => setError(null)}>{error}</Notice>}
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
          {stages.map((stage) => {
            const totals: Record<string, number> = {};
            for (const item of stage.items) totals[item.uom] = (totals[item.uom] || 0) + (item.quantity || 0);
            return (
              <section key={stage.key} className="snap-start shrink-0 w-72 flex flex-col bg-white/70 backdrop-blur border border-neutral-200 rounded-2xl">
                <header className="px-4 py-3 border-b border-neutral-200">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-bold text-neutral-900">{stage.label}</h2>
                    <span className="text-[11px] font-semibold tabular-nums bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">{stage.items.length}</span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500 tabular-nums">
                    {Object.entries(totals).map(([u, q]) => fmtQty(q, u)).join(' · ') || '—'}
                  </p>
                </header>
                <div className="p-3 space-y-2 overflow-y-auto max-h-[70vh]">
                  {stage.items.length === 0 && <p className="py-6 text-center text-xs text-neutral-400">Nothing here</p>}
                  {stage.items.map((item: any) => (
                    <Link
                      key={item.id}
                      href={item.href || stageHref(stage.key, item.id)}
                      className="block bg-white border border-neutral-200 hover:border-brand-300 rounded-xl p-3 shadow-xs transition"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-neutral-900">{sheetRef(item.program)}</span>
                        <PriorityBadge priority={item.priority} />
                      </div>
                      <p className="mt-1 text-sm font-semibold text-neutral-900">{item.label || item.fabricName}</p>
                      {!item.label && <GarmentTag item={item} />}
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <span className="text-xs text-neutral-700 truncate">
                          {item.label ? `${item.fabricName} · ` : ''}
                          {item.colour || '—'}
                        </span>
                        <FabricStatusBadge status={item.fabricProcessingStatus} />
                      </div>
                      <div className="mt-2 flex items-end justify-between gap-2">
                        <div>
                          <p className="text-[11px] text-neutral-500">{item.hint || STAGE_HINT[stage.key]}</p>
                          <p className="text-sm font-bold tabular-nums text-neutral-900">{fmtQty(item.quantity, item.uom)}</p>
                        </div>
                        <div className="text-right text-[11px]">
                          <p className="text-neutral-500 font-mono">{item.challan?.challanNumber || '—'}</p>
                          <p className="text-neutral-500">{departmentName(item.sourceDepartment)}</p>
                          <p className={isOverdue(item.program) ? 'font-semibold text-danger-700' : 'text-neutral-500'}>
                            Due {fmtDate(item.program?.deliveryDate)}
                          </p>
                        </div>
                      </div>
                      {item.outChallans?.length > 0 && (
                        <p className="mt-1.5 text-[11px] text-neutral-500 font-mono truncate">
                          Out: {item.outChallans.map((c: any) => c.challanNumber).join(', ')}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
