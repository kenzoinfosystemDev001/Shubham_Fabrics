'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { DeadlineAlertsPanel } from '@/components/alerts/DeadlineAlertsPanel';
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  DeadlineText,
  EmptyRow,
  FabricStatusBadge,
  Notice,
  PageHeader,
  Panel,
  PriorityBadge,
  THEAD,
  WorkStatusBadge,
  fetchJson,
  fmtQty,
  sheetRef,
} from '@/components/workflow/WorkflowUi';
import { receivedBasis } from '@/lib/work-items.mjs';
import { departmentName, transferPath, workPath, type ProductionCard, type WorkflowView } from '@/lib/workflow-views';
import { GarmentTag } from '@/components/recutting/RecuttingUi';

/** Quantities per unit, e.g. "120 MTR · 40 PCS" (never one combined number). */
function unitTotals(totals?: Record<string, number>) {
  const parts = Object.entries(totals || {}).filter(([, q]) => q > 0).map(([u, q]) => fmtQty(q, u));
  return parts.length ? parts.join(' · ') : undefined;
}

export function WorkDashboard({ flow }: { flow: WorkflowView }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alertsKey, setAlertsKey] = useState(0);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const body = await fetchJson(`${flow.api}/dashboard`);
      setData(body.data);
      setAlertsKey((k) => k + 1);
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

  const c = data?.counts;
  const work = `${flow.base}/my-work`;
  type Card = { label: string; value?: number | string; href: string; danger?: boolean; sub?: string };
  const alertCards: Card[] = [
    { label: 'Deadline Alerts', value: c?.deadlineAlerts, href: '#deadline-alerts', danger: (c?.deadlineAlerts || 0) > 0 },
    { label: 'Overdue Work', value: c?.overdue, href: `${workPath(flow)}?overdue=1`, danger: (c?.overdue || 0) > 0 },
  ];
  const qcCards: Card[] = [
    { label: 'Pending Inward Challans', value: c?.pendingInward, href: `${work}/incoming` },
    { label: 'Material Received', value: c?.held, href: `${work}/received` },
    { label: 'Pending Inspection', value: c?.pendingInspection, href: `${workPath(flow)}?inspection=pending` },
    { label: 'Inspection In Progress', value: c?.inspectionInProgress, href: `${workPath(flow)}?inspection=progress` },
    { label: `Passed, Ready for ${flow.next}`, value: c?.readyForNext, href: transferPath(flow, 'PASS') },
    { label: 'Rejected Material', value: c?.rejectedPending, href: transferPath(flow, 'REJECT'), danger: (c?.rejectedPending || 0) > 0 },
    { label: 'Rework Pending', value: c?.reworkPending, href: transferPath(flow, 'REWORK') },
    ...alertCards,
  ];
  const qty = data?.quantities;
  const out = data?.outcomes;
  // Final QC: quantities per unit for what inspection decided (all time) and what is waiting now.
  const qtyCard = (label: string, totals: Record<string, number> | undefined, href: string, danger = false): Card => ({
    label,
    value: unitTotals(totals) || 0,
    href,
    danger: danger && Boolean(unitTotals(totals)),
  });
  const qcTotalCards: Card[] = [
    { label: 'Pending Receipts', value: c?.pendingInward, sub: unitTotals(qty?.awaitingReceipt), href: `${work}/incoming` },
    { label: 'Received Garments', value: c?.held, sub: unitTotals(qty?.received), href: `${work}/received` },
    { label: 'Pending Inspection', value: c?.pendingInspection, sub: unitTotals(qty?.uninspected), href: `${workPath(flow)}?inspection=pending` },
    { label: 'Inspection In Progress', value: c?.inspectionInProgress, href: `${workPath(flow)}?inspection=progress` },
    qtyCard('Passed Quantity', out?.passed, `${work}/passed`),
    qtyCard('Rejected Quantity', out?.rejected, transferPath(flow, 'REJECT'), (c?.rejectedPending || 0) > 0),
    qtyCard('Rework Quantity', out?.rework, transferPath(flow, 'REWORK')),
    { label: `Ready for ${flow.next}`, value: c?.readyForNext, sub: unitTotals(qty?.ready), href: transferPath(flow, 'PASS') },
    qtyCard(`Dispatched to ${flow.next}`, out?.dispatched, `${work}/outgoing`),
    alertCards[1],
    alertCards[0],
  ];
  // Production departments choose their cards (flow.cards) from this catalog.
  const catalog: Record<ProductionCard, Card> = {
    pendingInward: { label: 'Pending Inward Challans', value: c?.pendingInward, href: `${work}/incoming` },
    received: { label: flow.garments ? 'Garments Received' : 'Material Received', value: c?.held, sub: unitTotals(qty?.received), href: `${work}/received` },
    pending: { label: `Pending ${flow.label}`, value: c?.fabricReceived, href: `${workPath(flow)}?status=RECEIVED` },
    inProgress: { label: `${flow.label} In Progress`, value: c?.inProgress, sub: unitTotals(qty?.inProgress), href: `${workPath(flow)}?status=IN_PROGRESS` },
    partial: { label: 'Partially Completed Work', value: c?.partiallyCompleted, href: `${workPath(flow)}?status=stage:PARTIALLY_COMPLETED` },
    completed: { label: `Completed ${flow.label}`, value: c?.completed, sub: unitTotals(qty?.completed), href: `${workPath(flow)}?status=COMPLETED` },
    ready: { label: `Ready for ${flow.next}`, value: c?.readyForNext, sub: unitTotals(qty?.ready), href: `${work}/issue-challan` },
    issued: { label: `Challans Issued to ${flow.next}`, value: c?.challansIssued, href: flow.outgoingPage ? `${flow.base}/my-work/outgoing` : `${flow.base}/history?view=outgoing` },
    alerts: alertCards[0],
    overdue: alertCards[1],
  };
  const productionKeys: ProductionCard[] = flow.cards || ['pendingInward', 'received', 'pending', 'inProgress', 'completed', 'ready', 'issued', 'alerts', 'overdue'];
  const productionCards: Card[] = productionKeys.map((k) => ({ ...catalog[k], label: flow.cardLabels?.[k] || catalog[k].label }));
  const cards: Card[] = flow.qc ? (flow.qcTotals ? qcTotalCards : qcCards) : flow.production ? productionCards : [
    { label: flow.pendingCard ? 'Pending Inward Challans' : 'Pending Inward', value: c?.pendingInward, href: `${work}/incoming` },
    ...(flow.pendingCard
      ? [
          { label: flow.material ? 'Material Received' : 'Fabric Received', value: c?.held, href: `${work}/received` },
          { label: `Pending ${flow.label}`, value: c?.fabricReceived, href: `${work}/process?status=RECEIVED` },
        ]
      : [{ label: flow.material ? 'Material Received' : 'Fabric Received', value: c?.fabricReceived, href: `${work}/received?status=RECEIVED` }]),
    { label: `${flow.label} In Progress`, value: c?.inProgress, href: `${work}/process?status=IN_PROGRESS` },
    { label: `Ready for ${flow.next}`, value: c?.readyForNext, href: `${work}/issue-challan` },
    ...alertCards,
  ];
  const tasks: any[] = data?.tasks || [];

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <PageHeader title={flow.label} loading={loading} onRefresh={load}>
        <Link href={`${work}/incoming`} className={BTN_SECONDARY}>
          Incoming Challans
        </Link>
        <Link href={`${work}/issue-challan`} className={BTN_PRIMARY}>
          Issue Challan to {flow.next}
        </Link>
      </PageHeader>

      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {error && <Notice kind="error" onClose={() => setError(null)}>{error}</Notice>}

        <section className={`grid grid-cols-2 sm:grid-cols-4 gap-3 ${cards.length > 7 ? 'lg:grid-cols-5 2xl:grid-cols-9' : cards.length > 6 ? 'lg:grid-cols-7' : 'lg:grid-cols-6'}`}>
          {cards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className={`group bg-white border rounded-2xl px-4 py-3.5 shadow-xs transition hover:shadow-sm ${
                card.danger ? 'border-danger-300 hover:border-danger-500' : 'border-neutral-200 hover:border-brand-300'
              }`}
            >
              <p className={`${typeof card.value === 'string' ? 'text-lg leading-tight' : 'text-2xl leading-none'} font-bold tabular-nums ${card.danger ? 'text-danger-600' : 'text-neutral-900'}`}>
                {loading && !c ? '…' : card.value ?? 0}
              </p>
              <p className="text-xs font-medium text-neutral-500 mt-2">{card.label}</p>
              {card.sub && <p className="text-[11px] text-neutral-500 tabular-nums mt-0.5">{card.sub}</p>}
            </Link>
          ))}
        </section>

        <div id="deadline-alerts" className="scroll-mt-24">
          <DeadlineAlertsPanel department={flow.code} refreshKey={alertsKey} />
        </div>

        <Panel
          title="Pending Work"
          count={tasks.length}
          actions={
            <Link href={`${work}/process`} className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900">
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className={THEAD}>
                <tr>
                  <th className="py-3 px-4">Production Sheet</th>
                  <th className="py-3 px-3">Challan</th>
                  <th className="py-3 px-3">Fabric</th>
                  <th className="py-3 px-3">Colour</th>
                  <th className="py-3 px-3">Dyed / Undyed</th>
                  <th className="py-3 px-3 text-right">Received</th>
                  <th className="py-3 px-3 text-right">{flow.qc ? 'Inspected' : 'Processed'}</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Priority</th>
                  <th className="py-3 px-3">Deadline</th>
                  <th className="py-3 px-3"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {!loading && tasks.length === 0 && <EmptyRow colSpan={11} text={`No open ${flow.label} work`} />}
                {tasks.map((t) => (
                  <tr key={t.id} className="hover:bg-neutral-50/60">
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs font-semibold">{sheetRef(t.program)}</span>
                      <span className="block text-[11px] text-neutral-500">{t.program?.designNumber || ''}</span>
                    </td>
                    <td className="py-3 px-3 text-xs">
                      <span className="font-mono text-brand-800">{t.inboundChallan?.challanNumber || '—'}</span>
                      <span className="block text-[11px] text-neutral-500">{departmentName(t.sourceDepartment)}</span>
                    </td>
                    <td className="py-3 px-3 font-semibold">{t.fabricName}<GarmentTag item={t} /></td>
                    <td className="py-3 px-3 text-neutral-700">{t.colour || '—'}</td>
                    <td className="py-3 px-3"><FabricStatusBadge status={t.fabricProcessingStatus} /></td>
                    <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{t.status === 'AWAITING_RECEIPT' ? '—' : fmtQty(receivedBasis(t), t.uom)}</td>
                    <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(t.processedQuantity, t.uom)}</td>
                    <td className="py-3 px-3"><WorkStatusBadge status={t.status} next={flow.next} qc={Boolean(flow.qc)} dispatch={flow.dispatchWords} /></td>
                    <td className="py-3 px-3"><PriorityBadge priority={t.priority} /></td>
                    <td className="py-3 px-3 text-xs whitespace-nowrap"><DeadlineText program={t.program} /></td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        href={t.status === 'AWAITING_RECEIPT' ? `${work}/incoming` : `${workPath(flow)}?itemId=${t.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900 whitespace-nowrap"
                      >
                        <span>{t.status === 'AWAITING_RECEIPT' ? 'Receive' : 'Open'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
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
