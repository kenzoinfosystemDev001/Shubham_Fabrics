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
  Notice,
  PageHeader,
  Panel,
  PriorityBadge,
  StatusBadge,
  THEAD,
  fetchJson,
  fmtQty,
  sheetRef,
} from '@/components/dyeing/DyeingUi';

type Counts = {
  pendingInwardChallans: number;
  fabricReceived: number;
  dyeingInProgress: number;
  readyForQc: number;
  challansIssuedToQc: number;
  deadlineAlerts: number;
  overdueWork: number;
};

const unitText = (totals?: Record<string, number>) =>
  totals && Object.keys(totals).length ? Object.entries(totals).map(([u, q]) => fmtQty(q, u)).join(' · ') : null;

export default function DyeingDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alertsKey, setAlertsKey] = useState(0);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const body = await fetchJson('/api/dyeing/dashboard');
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

  const c: Counts | undefined = data?.counts;
  const cards: Array<{ label: string; value?: number; href: string; sub?: string | null; danger?: boolean }> = [
    { label: 'Pending Inward Challans', value: c?.pendingInwardChallans, href: '/dyeing/my-work/incoming' },
    { label: 'Fabric Received', value: c?.fabricReceived, href: '/dyeing/my-work/received?status=RECEIVED', sub: unitText(data?.quantities?.received) },
    { label: 'Dyeing In Progress', value: c?.dyeingInProgress, href: '/dyeing/my-work/process?status=IN_DYEING,PARTIALLY_DYED' },
    { label: 'Ready for QC', value: c?.readyForQc, href: '/dyeing/my-work/issue-challan', sub: unitText(data?.quantities?.readyForQc) },
    { label: 'Challans Issued to QC', value: c?.challansIssuedToQc, href: '/dyeing/history?view=outgoing' },
    { label: 'Deadline Alerts', value: c?.deadlineAlerts, href: '#deadline-alerts', danger: (c?.deadlineAlerts || 0) > 0 },
    { label: 'Overdue Work', value: c?.overdueWork, href: '/dyeing/my-work/process?overdue=1', danger: (c?.overdueWork || 0) > 0 },
  ];
  const tasks: any[] = data?.pendingTasks || [];

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <PageHeader title="Dyeing" loading={loading} onRefresh={load}>
        <Link href="/dyeing/my-work/incoming" className={BTN_SECONDARY}>
          Incoming Challans
        </Link>
        <Link href="/dyeing/my-work/issue-challan" className={BTN_PRIMARY}>
          Issue Challan to Dyeing QC
        </Link>
      </PageHeader>

      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {error && <Notice kind="error" onClose={() => setError(null)}>{error}</Notice>}

        <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {cards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className={`group bg-white border rounded-2xl px-4 py-3.5 shadow-xs transition hover:shadow-sm ${
                card.danger ? 'border-danger-300 hover:border-danger-500' : 'border-neutral-200 hover:border-brand-300'
              }`}
            >
              <p className={`text-2xl font-bold tabular-nums leading-none ${card.danger ? 'text-danger-600' : 'text-neutral-900'}`}>
                {loading && !c ? '…' : card.value ?? 0}
              </p>
              <p className="text-xs font-medium text-neutral-500 mt-2">{card.label}</p>
              {card.sub && <p className="text-[11px] text-neutral-500 tabular-nums mt-0.5">{card.sub}</p>}
            </Link>
          ))}
        </section>

        <div id="deadline-alerts" className="scroll-mt-24">
          <DeadlineAlertsPanel department="DYEING" refreshKey={alertsKey} />
        </div>

        <Panel
          title="Pending Work"
          count={tasks.length}
          actions={
            <Link href="/dyeing/my-work/process" className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900">
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
                  <th className="py-3 px-3">Required Colour</th>
                  <th className="py-3 px-3 text-right">Received</th>
                  <th className="py-3 px-3 text-right">Processed</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Priority</th>
                  <th className="py-3 px-3">Deadline</th>
                  <th className="py-3 px-3"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {!loading && tasks.length === 0 && <EmptyRow colSpan={10} text="No open Dyeing work" />}
                {tasks.map((t) => (
                  <tr key={t.id} className="hover:bg-neutral-50/60">
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs font-semibold">{sheetRef(t.program)}</span>
                      <span className="block text-[11px] text-neutral-500">{t.program?.designNumber || ''}</span>
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-brand-800">{t.challanNumber || '—'}</td>
                    <td className="py-3 px-3 font-semibold">{t.fabricName}</td>
                    <td className="py-3 px-3 text-brand-900">{t.targetColor || '—'}</td>
                    <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{t.status === 'AWAITING_RECEIPT' ? '—' : fmtQty(t.received, t.uom)}</td>
                    <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(t.dyed, t.uom)}</td>
                    <td className="py-3 px-3"><StatusBadge status={t.status} /></td>
                    <td className="py-3 px-3"><PriorityBadge priority={t.priority} /></td>
                    <td className="py-3 px-3 text-xs whitespace-nowrap"><DeadlineText program={t.program} /></td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        href={t.status === 'AWAITING_RECEIPT' ? '/dyeing/my-work/incoming' : `/dyeing/my-work/process?orderId=${t.id}`}
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
