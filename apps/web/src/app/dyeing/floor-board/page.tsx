'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Notice, PageHeader, PriorityBadge, fetchJson, fmtDate, fmtQty, isOverdue, sheetRef } from '@/components/dyeing/DyeingUi';

const STAGE_HINT: Record<string, string> = {
  AWAITING_RECEIPT: 'Expected',
  RECEIVED: 'Received',
  PENDING_DYEING: 'Received',
  IN_PROGRESS: 'Still to dye',
  COMPLETED: 'Ready for QC',
  PARTIALLY_TRANSFERRED: 'Sent to QC',
  FULLY_TRANSFERRED: 'Sent to QC',
};

export default function DyeingFloorBoardPage() {
  const [stages, setStages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const body = await fetchJson('/api/dyeing/floor-board');
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
  }, []);

  return (
    <div className="min-h-screen bg-canvas pb-10">
      <PageHeader title="Floor Board" loading={loading} onRefresh={load}>
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
                      href={stage.key === 'AWAITING_RECEIPT' ? '/dyeing/my-work/incoming' : `/dyeing/my-work/process?orderId=${item.id}`}
                      className="block bg-white border border-neutral-200 hover:border-brand-300 rounded-xl p-3 shadow-xs transition"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-neutral-900">{sheetRef(item.program)}</span>
                        <PriorityBadge priority={item.priority} />
                      </div>
                      <p className="mt-1 text-sm font-semibold text-neutral-900">{item.fabricName}</p>
                      <p className="text-xs text-brand-900">
                        {item.targetColor || '—'}
                        {item.dyedColor && item.dyedColor !== item.targetColor ? ` · dyed ${item.dyedColor}` : ''}
                      </p>
                      <div className="mt-2 flex items-end justify-between gap-2">
                        <div>
                          <p className="text-[11px] text-neutral-500">{STAGE_HINT[stage.key]}</p>
                          <p className="text-sm font-bold tabular-nums text-neutral-900">{fmtQty(item.quantity, item.uom)}</p>
                        </div>
                        <div className="text-right text-[11px]">
                          <p className="text-neutral-500 font-mono">{item.challan?.challanNumber || '—'}</p>
                          <p className={isOverdue(item.program) ? 'font-semibold text-danger-700' : 'text-neutral-500'}>
                            Due {fmtDate(item.program?.deliveryDate)}
                          </p>
                        </div>
                      </div>
                      {item.qcChallans?.length > 0 && (
                        <p className="mt-1.5 text-[11px] text-neutral-500 font-mono truncate">QC: {item.qcChallans.map((c: any) => c.challanNumber).join(', ')}</p>
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
