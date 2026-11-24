'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { BTN_QUIET, EmptyRow, FIELD, Notice, PageHeader, Panel, THEAD, fetchJson, fmtDate, fmtQty } from '@/components/workflow/WorkflowUi';
import { departmentName } from '@/lib/workflow-views';
import { REWORK_STAGES, REWORK_STAGE_LABEL } from '@/lib/rework.mjs';
import { formatTotals } from '@/lib/challan-units.mjs';

// A rework department's Rework section: QC REWORK decisions routed here without a challan, each with its original
// Production Sheet, challan line and fabric. The rework is recorded on the department's normal work page and
// forwarded on its normal Issue Challan screen, which is the only place a challan is created for it.

const STAGE_TONE: Record<string, string> = {
  PENDING: 'bg-neutral-100 text-neutral-700 border-neutral-200',
  IN_PROGRESS: 'bg-brand-50 text-brand-800 border-brand-200',
  COMPLETED: 'bg-brand-100 text-brand-900 border-brand-300',
  READY: 'bg-accent-100 text-accent-800 border-accent-300',
  PARTLY_FORWARDED: 'bg-accent-50 text-accent-800 border-accent-200',
  FORWARDED: 'bg-accent-100 text-neutral-900 border-accent-300',
  RECEIVED_NEXT: 'bg-neutral-50 text-neutral-600 border-neutral-200',
};
const NOT_YET_RECEIVED = ['DRAFT', 'ISSUED', 'SUBMITTED', 'IN_TRANSIT'];

export function ReworkTasks({
  department,
  title = 'Rework',
  workPath,
  forwardPath,
}: {
  department: string;
  title?: string;
  /** Page where the rework is recorded (the department's process page). */
  workPath: string;
  /** The department's Issue Challan page, where finished rework is forwarded. */
  forwardPath: string;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'open' | 'all'>('open');
  const [stage, setStage] = useState('');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const body = await fetchJson(`/api/rework-tasks?department=${department}`);
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

  const q = search.trim().toLowerCase();
  const shown = useMemo(
    () =>
      rows.filter(
        (r) =>
          (view === 'all' || r.stage !== 'RECEIVED_NEXT') &&
          (!stage || r.stage === stage) &&
          (!q ||
            [r.number, r.productionSheet, r.serialNumber, r.designNumber, r.originalChallanNumber, r.fabricName, r.colour, r.reason, ...r.forwardings.map((f: any) => f.challanNumber)].some((v) =>
              String(v || '').toLowerCase().includes(q),
            )),
      ),
    [rows, view, stage, q],
  );
  // Per stage: how many tasks and their quantity still to forward, each unit apart.
  const byStage = useMemo(() => {
    const out: Record<string, { count: number; remaining: Record<string, number> }> = {};
    for (const r of rows) {
      const s = (out[r.stage] ||= { count: 0, remaining: {} });
      s.count += 1;
      if (r.remainingQuantity > 0) s.remaining[r.unit] = Math.round(((s.remaining[r.unit] || 0) + r.remainingQuantity) * 1000) / 1000;
    }
    return out;
  }, [rows]);

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <PageHeader title={title} loading={loading} onRefresh={load} />
      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {error && <Notice kind="error" onClose={() => setError(null)}>{error}</Notice>}
        <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {REWORK_STAGES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStage(stage === s ? '' : s);
                if (s === 'RECEIVED_NEXT') setView('all');
              }}
              className={`text-left bg-white border rounded-2xl px-4 py-3 shadow-xs transition hover:shadow-sm ${stage === s ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-neutral-200'}`}
            >
              <p className="text-2xl font-bold tabular-nums leading-none text-neutral-900">{loading && !rows.length ? '…' : byStage[s]?.count ?? 0}</p>
              <p className="text-xs font-medium text-neutral-500 mt-2">{(REWORK_STAGE_LABEL as Record<string, string>)[s]}</p>
              {byStage[s] && Object.keys(byStage[s].remaining).length > 0 && (
                <p className="text-[11px] text-neutral-500 tabular-nums mt-0.5">To forward {formatTotals(byStage[s].remaining, '—')}</p>
              )}
            </button>
          ))}
        </section>

        <Panel
          title="Rework Tasks"
          count={shown.length}
          actions={
            <>
              <select value={view} onChange={(e) => setView(e.target.value as 'open' | 'all')} aria-label="Show" className={`${FIELD} w-40`}>
                <option value="open">Open</option>
                <option value="all">All, including received</option>
              </select>
              <select value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Stage" className={`${FIELD} w-52`}>
                <option value="">Every stage</option>
                {REWORK_STAGES.map((s) => (
                  <option key={s} value={s}>{(REWORK_STAGE_LABEL as Record<string, string>)[s]}</option>
                ))}
              </select>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Sheet, design, challan, fabric" aria-label="Search rework" className={`${FIELD} w-56`} />
            </>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className={THEAD}>
                <tr>
                  <th className="py-3 px-4">Rework Task</th>
                  <th className="py-3 px-3">Production Sheet</th>
                  <th className="py-3 px-3">Original Challan</th>
                  <th className="py-3 px-3">From</th>
                  <th className="py-3 px-3">Fabric · Colour</th>
                  <th className="py-3 px-3 text-right">Rework</th>
                  <th className="py-3 px-3 text-right">Done</th>
                  <th className="py-3 px-3 text-right">Forwarded</th>
                  <th className="py-3 px-3 text-right">To Forward</th>
                  <th className="py-3 px-3">Stage</th>
                  <th className="py-3 px-3">Reason</th>
                  <th className="py-3 px-3">Forwarding Challans</th>
                  <th className="py-3 px-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {!loading && shown.length === 0 && <EmptyRow colSpan={13} text={rows.length ? 'No rework matches the filters' : 'No rework has been sent here'} />}
                {shown.map((r) => {
                  const canForward = r.remainingQuantity > 0 && r.completedQuantity > r.forwardedQuantity;
                  return (
                    <tr key={r.id} className="align-top hover:bg-neutral-50/60">
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs font-semibold">{r.number}</span>
                        <span className="block text-[11px] text-neutral-500 whitespace-nowrap">{fmtDate(r.decidedAt, true)}</span>
                        {r.decidedBy && <span className="block text-[11px] text-neutral-500">by {r.decidedBy}</span>}
                      </td>
                      <td className="py-3 px-3 text-xs">
                        <span className="font-mono font-semibold">{r.productionSheet || '—'}</span>
                        <span className="block text-neutral-500">Serial {r.serialNumber || '—'} · Design {r.designNumber || '—'}</span>
                        {r.productionType && <span className="block text-neutral-500">{r.productionType}{r.styleRef ? ` · ${r.styleRef}` : ''}</span>}
                      </td>
                      <td className="py-3 px-3 text-xs">
                        {r.originalChallanId ? (
                          <Link href={`/challans/${r.originalChallanId}`} className="font-mono font-semibold text-brand-800 hover:text-brand-900">{r.originalChallanNumber}</Link>
                        ) : '—'}
                        {r.originalChallanItemId && <span className="block text-[10px] font-mono text-neutral-400" title={r.originalChallanItemId}>Item {String(r.originalChallanItemId).slice(0, 8)}</span>}
                      </td>
                      <td className="py-3 px-3 text-xs text-neutral-700">
                        {departmentName(r.sourceDepartment)}
                        <span className="block text-[11px] text-neutral-500">{r.sourceLabel}</span>
                      </td>
                      <td className="py-3 px-3 text-xs">
                        <span className="font-semibold text-neutral-900">{r.fabricName}</span>
                        <span className="block text-neutral-500">{[r.colour, r.shade].filter(Boolean).join(' · ') || '—'}</span>
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap font-semibold">{fmtQty(r.reworkQuantity, r.unit)}</td>
                      <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(r.completedQuantity, r.unit)}</td>
                      <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(r.forwardedQuantity, r.unit)}</td>
                      <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap font-semibold">
                        {fmtQty(r.remainingQuantity, r.unit)}
                        {r.heldQuantity > 0 && <span className="block text-[11px] font-normal text-danger-700">HOLD {fmtQty(r.heldQuantity, r.unit)}</span>}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${STAGE_TONE[r.stage] || STAGE_TONE.PENDING}`}>{r.stageLabel}</span>
                      </td>
                      <td className="py-3 px-3 text-xs text-neutral-700 max-w-[200px]">{r.reason || '—'}</td>
                      <td className="py-3 px-3 text-xs">
                        {r.forwardings.length === 0 && <span className="text-neutral-400">None yet</span>}
                        {r.forwardings.map((f: any) => (
                          <span key={`${f.challanId}-${f.at}`} className="block whitespace-nowrap">
                            <Link href={`/challans/${f.challanId}`} className="font-mono font-semibold text-brand-800 hover:text-brand-900">{f.challanNumber}</Link>
                            <span className="text-neutral-500"> · {fmtQty(f.quantity, f.unit)} → {f.toDepartment} · {NOT_YET_RECEIVED.includes(f.status) ? 'Not received yet' : `Received${f.receivedDate ? ` ${fmtDate(f.receivedDate)}` : ''}`}</span>
                          </span>
                        ))}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap space-y-1.5">
                        {r.remainingQuantity > 0 && r.completedQuantity < r.reworkQuantity && (
                          <Link href={workPath} className={BTN_QUIET}>Record Rework</Link>
                        )}
                        {canForward && (
                          <Link href={forwardPath} className="flex items-center justify-end gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900">
                            <span>Forward to {r.nextDepartment || 'next'}</span>
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
