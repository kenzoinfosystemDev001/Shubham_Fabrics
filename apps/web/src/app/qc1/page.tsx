'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  RefreshCw,
  Briefcase,
  Kanban,
  AlertCircle,
  PackageCheck,
} from 'lucide-react';
import { api } from '@/lib/api';
import { DeadlineAlertsPanel } from '@/components/alerts/DeadlineAlertsPanel';

export default function QC1Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/qc1/dashboard');
      if (!res.ok) {
        throw new Error('Failed to load QC1 dashboard data');
      }
      const json = await res.json();
      setData(json.data);
    } catch (err: any) {
      console.error('Error loading QC1 dashboard:', err);
      setError(err.message || 'Error connecting to database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('subham_mes_user');
      if (savedUser) {
        try {
          setCurrentUser(JSON.parse(savedUser));
        } catch {}
      }
    }
    loadData();
  }, []);

  const kpis = data?.kpis || {
    totalWork: 0,
    awaitingReceiving: 0,
    received: 0,
    awaitingInspection: 0,
    underInspection: 0,
    completed: 0,
    passed: 0,
    failed: 0,
    rework: 0,
    hold: 0,
    totalQuantityReceived: 0,
    totalQuantityInspected: 0,
    passedQuantity: 0,
    failedQuantity: 0,
    reworkQuantity: 0,
    holdQuantity: 0,
  };

  const priorityWork = data?.priorityWork || [];
  const upcomingDelivery = data?.upcomingDelivery || [];
  const recentActivity = data?.recentActivity || [];

  const inspectorName =
    currentUser?.fullName ||
    currentUser?.username ||
    'Dyeing QC Inspector';

  const statusStats = [
    { label: 'Received', value: kpis.received, tone: 'text-neutral-900' },
    { label: 'Awaiting QC', value: kpis.awaitingInspection, tone: 'text-neutral-900' },
    { label: 'Under Inspection', value: kpis.underInspection, tone: 'text-brand-700' },
    { label: 'Passed', value: kpis.passed, tone: 'text-neutral-900' },
    { label: 'Rejected', value: kpis.failed, tone: 'text-danger-700' },
    { label: 'Rework', value: kpis.rework, tone: 'text-brand-700' },
    { label: 'On Hold', value: kpis.hold, tone: 'text-neutral-900' },
  ];

  const quantityStats = [
    { label: 'Total Received', value: kpis.totalQuantityReceivedText ?? kpis.totalQuantityReceived, tone: 'text-neutral-900' },
    { label: 'Total Inspected', value: kpis.totalQuantityInspectedText ?? kpis.totalQuantityInspected, tone: 'text-brand-700' },
    { label: 'Passed', value: kpis.passedQuantityText ?? kpis.passedQuantity, tone: 'text-neutral-900' },
    { label: 'Rejected', value: kpis.failedQuantityText ?? kpis.failedQuantity, tone: 'text-danger-700' },
    { label: 'Rework', value: kpis.reworkQuantityText ?? kpis.reworkQuantity, tone: 'text-brand-700' },
    { label: 'On Hold', value: kpis.holdQuantityText ?? kpis.holdQuantity, tone: 'text-neutral-900' },
  ];

  const fmtStatus = (s: any) => String(s ?? '').replace(/_/g, ' ');

  const panel = 'bg-white border border-neutral-200 rounded-2xl shadow-xs overflow-hidden';
  const panelHeader = 'px-5 py-4 border-b border-neutral-200 flex items-center justify-between gap-3';
  const countPill = 'text-[11px] font-semibold tabular-nums bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full';
  const statCard = 'bg-white border border-neutral-200 rounded-2xl px-4 py-3.5 shadow-xs';

  return (
    <div className="min-h-screen bg-canvas pb-16">
      {/* HEADER */}
      <header className="bg-white/90 backdrop-blur border-b border-neutral-200 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-neutral-900">Dyeing QC</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition"
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/qc1/floor-board"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-brand-50 text-brand-800 border border-brand-300 text-xs font-semibold rounded-lg transition"
          >
            <Kanban className="w-4 h-4" />
            <span>Floor Board</span>
          </Link>
          <Link
            href="/qc1/my-work"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
          >
            <Briefcase className="w-4 h-4" />
            <span>My Work</span>
          </Link>
        </div>
      </header>

      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {error && (
          <div className="p-4 bg-danger-50 border border-danger-200 rounded-xl flex items-center gap-3 text-danger-800 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 text-danger-600" />
            <span>{error}</span>
            <button onClick={loadData} className="ml-auto underline font-semibold">
              Retry
            </button>
          </div>
        )}

        <DeadlineAlertsPanel department="QC1" />

        {/* LOT STATUS */}
        <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {statusStats.map((s) => (
            <div key={s.label} className={statCard}>
              <p className={`text-2xl font-bold tabular-nums leading-none ${s.tone}`}>{s.value}</p>
              <p className="text-xs font-medium text-neutral-500 mt-2">{s.label}</p>
            </div>
          ))}
        </section>

        {/* QUANTITIES (MTR) */}
        <section className={panel}>
          <div className={panelHeader}>
            <h2 className="text-sm font-bold text-neutral-900">Quantities (MTR)</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            {quantityStats.map((s) => (
              <div key={s.label} className="px-5 py-4">
                <p className={`text-xl font-bold tabular-nums leading-none ${s.tone}`}>
                  {typeof s.value === 'string' ? s.value : Number(s.value || 0).toLocaleString()}
                </p>
                <p className="text-xs font-medium text-neutral-500 mt-2">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* PRIORITY WORK + DELIVERY SCHEDULE */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className={panel}>
            <div className={panelHeader}>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-neutral-900">Priority Work</h2>
                <span className={countPill}>{priorityWork.length}</span>
              </div>
            </div>

            {priorityWork.length === 0 ? (
              <div className="p-10 text-center text-sm font-medium text-neutral-500">No priority lots waiting</div>
            ) : (
              <ul className="divide-y divide-neutral-100 text-xs">
                {priorityWork.map((item: any) => (
                  <li key={item.id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-neutral-50/60 transition">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-neutral-900">{item.challanNumber}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-danger-100 text-danger-800">
                          {fmtStatus(item.priority)}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                        Sheet: <span className="font-medium text-neutral-700">{item.productionSheetNumber}</span> · {item.fabric} ({item.color})
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono font-semibold text-neutral-900 block tabular-nums">
                        {item.quantityText ?? `${item.quantity} ${item.uom}`}
                      </span>
                      <span className="text-[10px] text-neutral-500 uppercase font-medium">{fmtStatus(item.status)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={panel}>
            <div className={panelHeader}>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-neutral-900">Delivery Schedule</h2>
                <span className={countPill}>{upcomingDelivery.length}</span>
              </div>
            </div>

            {upcomingDelivery.length === 0 ? (
              <div className="p-10 text-center text-sm font-medium text-neutral-500">No upcoming deliveries</div>
            ) : (
              <ul className="divide-y divide-neutral-100 text-xs">
                {upcomingDelivery.map((item: any) => (
                  <li key={item.id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-neutral-50/60 transition">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-bold text-neutral-900">{item.productionSheetNumber}</span>
                        <span className="text-[11px] text-neutral-600 truncate">({item.clientName})</span>
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        Challan: <span className="font-mono">{item.challanNumber}</span> · {item.quantityText ?? `${item.quantity} ${item.uom}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-semibold text-brand-900 block tabular-nums">
                        {item.deliveryDate ? new Date(item.deliveryDate).toLocaleDateString() : '—'}
                      </span>
                      <span className="text-[10px] text-neutral-500 uppercase">{fmtStatus(item.status)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* RECENT ACTIVITY */}
        <section className={panel}>
          <div className={panelHeader}>
            <h2 className="text-sm font-bold text-neutral-900">Recent Inspections</h2>
          </div>

          {recentActivity.length === 0 ? (
            <div className="p-10 text-center">
              <PackageCheck className="w-8 h-8 text-neutral-300 mx-auto" />
              <p className="text-sm font-medium text-neutral-500 mt-3">No inspections recorded yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 border-b border-neutral-200 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 whitespace-nowrap">
                  <tr>
                    <th className="py-3 px-4">Date/Time</th>
                    <th className="py-3 px-4">Production Sheet</th>
                    <th className="py-3 px-4">Inspector</th>
                    <th className="py-3 px-4 text-right">Inspected</th>
                    <th className="py-3 px-4 text-right">Passed</th>
                    <th className="py-3 px-4 text-right">Rework</th>
                    <th className="py-3 px-4 text-right">Failed</th>
                    <th className="py-3 px-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-neutral-700">
                  {recentActivity.map((tx: any) => (
                    <tr key={tx.id} className="hover:bg-neutral-50/60 transition">
                      <td className="py-3 px-4 font-mono text-neutral-500 whitespace-nowrap">
                        {tx.recordedAt ? new Date(tx.recordedAt).toLocaleString() : '—'}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-neutral-900">{tx.productionSheetNumber}</td>
                      <td className="py-3 px-4 font-medium">{tx.inspector}</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums">
                        {tx.inputQuantity} {tx.unitOfMeasure}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-neutral-900">
                        {tx.goodQuantity} {tx.unitOfMeasure}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-brand-700">
                        {tx.reworkQuantity || 0} {tx.unitOfMeasure}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-danger-700">
                        {tx.rejectQuantity || 0} {tx.unitOfMeasure}
                      </td>
                      <td className="py-3 px-4 text-neutral-600 truncate max-w-xs">{tx.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
