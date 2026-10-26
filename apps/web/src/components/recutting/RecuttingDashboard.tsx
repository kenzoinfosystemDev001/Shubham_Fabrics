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
import { CATEGORY_TONE, fmtTotals } from '@/components/recutting/RecuttingUi';
import { CATEGORY_LABEL, GARMENT_CATEGORIES } from '@/lib/recutting.mjs';
import { receivedBasis } from '@/lib/work-items.mjs';

const W = '/recutting/my-work';

export function RecuttingDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alertsKey, setAlertsKey] = useState(0);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const body = await fetchJson('/api/recutting/dashboard');
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
  }, []);

  const c = data?.counts;
  const q = data?.quantities;
  const cats = data?.categories || {};
  type Card = { label: string; value?: number; sub?: string; href: string; danger?: boolean; tone?: string };
  const cards: Card[] = [
    { label: 'Pending Inward Challans', value: c?.pendingInward, href: `${W}/incoming` },
    { label: 'Fabric Received', value: c?.fabricReceived, sub: fmtTotals(q?.received), href: `${W}/received` },
    { label: 'Pending Allocation', value: c?.pendingAllocation, sub: `Unallocated ${fmtTotals(q?.unallocated)}`, href: `${W}/allocation?filter=pending` },
    { label: 'Allocation In Progress', value: c?.allocationInProgress, href: `${W}/allocation?filter=progress` },
    ...GARMENT_CATEGORIES.map((cat) => ({
      label: `${(CATEGORY_LABEL as Record<string, string>)[cat]} Allocation`,
      value: cats[cat]?.count,
      sub: `Allocated ${fmtTotals(cats[cat]?.allocated)} · Cut ${fmtTotals(cats[cat]?.cut)}`,
      href: `${W}/allocation-history?category=${cat}&open=1`,
      tone: CATEGORY_TONE[cat]?.section,
    })),
    { label: 'Ready for Stitching', value: c?.readyForStitching, sub: fmtTotals(q?.ready), href: `${W}/issue-challan` },
    { label: 'Stitching Challans Issued', value: c?.challansIssued, href: `${W}/issued-challans` },
    { label: 'Deadline Alerts', value: c?.deadlineAlerts, href: '#deadline-alerts', danger: (c?.deadlineAlerts || 0) > 0 },
    { label: 'Overdue Work', value: c?.overdue, href: `${W}/allocation?overdue=1&filter=all`, danger: (c?.overdue || 0) > 0 },
  ];
  const tasks: any[] = data?.tasks || [];

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <PageHeader title="Recutting" loading={loading} onRefresh={load}>
        <Link href={`${W}/allocation`} className={BTN_SECONDARY}>
          Fabric Allocation
        </Link>
        <Link href={`${W}/issue-challan`} className={BTN_PRIMARY}>
          Generate Stitching Challan
        </Link>
      </PageHeader>

      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {error && <Notice kind="error" onClose={() => setError(null)}>{error}</Notice>}

        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {cards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className={`bg-white border rounded-2xl px-4 py-3.5 shadow-xs transition hover:shadow-sm ${card.tone ? `border-l-4 ${card.tone}` : ''} ${
                card.danger ? 'border-danger-300 hover:border-danger-500' : 'border-neutral-200 hover:border-brand-300'
              }`}
            >
              <p className={`text-2xl font-bold tabular-nums leading-none ${card.danger ? 'text-danger-600' : 'text-neutral-900'}`}>
                {loading && !c ? '…' : card.value ?? 0}
              </p>
              <p className="text-xs font-medium text-neutral-500 mt-2">{card.label}</p>
              {card.sub && <p className="text-[11px] text-neutral-500 tabular-nums mt-0.5 leading-snug">{card.sub}</p>}
            </Link>
          ))}
        </section>

        <div id="deadline-alerts" className="scroll-mt-24">
          <DeadlineAlertsPanel department="RECUTTING" refreshKey={alertsKey} />
        </div>

        <Panel
          title="Pending Work"
          count={tasks.length}
          actions={
            <Link href={`${W}/allocation?filter=all`} className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900">
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
                  <th className="py-3 px-3 text-right">Unallocated</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Priority</th>
                  <th className="py-3 px-3">Deadline</th>
                  <th className="py-3 px-3"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {!loading && tasks.length === 0 && <EmptyRow colSpan={11} text="No open Recutting work" />}
                {tasks.map((t) => (
                  <tr key={t.id} className="hover:bg-neutral-50/60">
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs font-semibold">{sheetRef(t.program)}</span>
                      <span className="block text-[11px] text-neutral-500">{t.program?.designNumber || ''}</span>
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-brand-800">{t.inboundChallan?.challanNumber || '—'}</td>
                    <td className="py-3 px-3 font-semibold">{t.fabricName}</td>
                    <td className="py-3 px-3 text-neutral-700">{t.colour || '—'}</td>
                    <td className="py-3 px-3"><FabricStatusBadge status={t.fabricProcessingStatus} /></td>
                    <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{t.status === 'AWAITING_RECEIPT' ? '—' : fmtQty(receivedBasis(t), t.uom)}</td>
                    <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{t.status === 'AWAITING_RECEIPT' ? '—' : fmtQty(t.unallocated, t.uom)}</td>
                    <td className="py-3 px-3"><WorkStatusBadge status={t.status} next="Stitching" /></td>
                    <td className="py-3 px-3"><PriorityBadge priority={t.priority} /></td>
                    <td className="py-3 px-3 text-xs whitespace-nowrap"><DeadlineText program={t.program} /></td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        href={t.status === 'AWAITING_RECEIPT' ? `${W}/incoming` : `${W}/allocation?itemId=${t.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900 whitespace-nowrap"
                      >
                        <span>{t.status === 'AWAITING_RECEIPT' ? 'Receive' : 'Allocate'}</span>
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
