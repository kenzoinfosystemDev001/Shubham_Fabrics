'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CalendarClock } from 'lucide-react';

interface AlertRow {
  id: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO' | string;
  alertType: string;
  daysRemaining: number;
  remainingLabel: string;
  productionSheetId: string | null;
  designNumber: string | null;
  challanNumber: string | null;
  taskLabel: string;
  deadlineAt: string;
  workStatus: string;
  workHref: string;
  dismissed: boolean;
}

interface MissingDeadlineRow {
  entityId: string;
  taskLabel: string;
  productionSheetId: string | null;
  challanNumber: string | null;
  workHref: string;
}

interface AlertsPayload {
  enabled: boolean;
  alerts: AlertRow[];
  visibleCount: number;
  overdueCount: number;
  missingDeadline: MissingDeadlineRow[];
}

/** Severity chip. Tomato for overdue / due today, Lavender for near, Chartreuse (dark text) for upcoming. */
function SeverityChip({ alert }: { alert: AlertRow }) {
  const base = 'inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide border';
  if (alert.daysRemaining < 0) return <span className={`${base} bg-danger-600 text-white border-danger-600`}>Overdue</span>;
  if (alert.daysRemaining === 0) return <span className={`${base} bg-danger-50 text-danger-800 border-danger-200`}>Due today</span>;
  if (alert.severity === 'WARNING') return <span className={`${base} bg-brand-100 text-brand-900 border-brand-200`}>Due soon</span>;
  return <span className={`${base} bg-accent-100 text-neutral-900 border-accent-300`}>Upcoming</span>;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

const statusLabel = (status: string) => status.replace(/_/g, ' ');

/**
 * Compact deadline-alert list for a department dashboard. Department-agnostic: pass the
 * department code; the server decides whether alerts are enabled and who may see them.
 */
export function DeadlineAlertsPanel({ department, refreshKey = 0 }: { department: string; refreshKey?: number }) {
  const [data, setData] = useState<AlertsPayload | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showMissing, setShowMissing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      const res = await fetch(`/api/alerts?department=${encodeURIComponent(department)}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not load deadline alerts.');
      setData(json.data);
    } catch (err: any) {
      setError(err.message || 'Could not load deadline alerts.');
    }
  }, [department]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const dismiss = async (id: string) => {
    try {
      setBusyId(id);
      const res = await fetch(`/api/alerts/${encodeURIComponent(id)}/dismiss`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not dismiss the alert.');
      await load();
    } catch (err: any) {
      setError(err.message || 'Could not dismiss the alert.');
    } finally {
      setBusyId(null);
    }
  };

  // Nothing until the first answer, so departments without alerts enabled never flash a card.
  if (!data && !error) return null;
  if (data && !data.enabled) return null;

  const alerts = data?.alerts || [];
  const missing = data?.missingDeadline || [];
  const overdue = data?.overdueCount || 0;

  return (
    <section aria-labelledby={`deadline-alerts-${department}`} className="bg-white border border-neutral-200 rounded-xl shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-neutral-100">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-brand-700" aria-hidden />
          <h2 id={`deadline-alerts-${department}`} className="text-sm font-bold text-neutral-900">
            Deadline Alerts
          </h2>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
              overdue > 0 ? 'bg-danger-600 text-white' : 'bg-brand-100 text-brand-900'
            }`}
            aria-label={`${data?.visibleCount ?? 0} active alerts`}
          >
            {data?.visibleCount ?? 0}
          </span>
          {overdue > 0 && <span className="text-[11px] font-semibold text-danger-700">{overdue} overdue</span>}
        </div>
        {missing.length > 0 && (
          <button
            type="button"
            onClick={() => setShowMissing((v) => !v)}
            className="text-[11px] font-semibold text-neutral-600 hover:text-neutral-900 underline underline-offset-2"
            aria-expanded={showMissing}
          >
            {missing.length} open job{missing.length === 1 ? '' : 's'} without a delivery date
          </button>
        )}
      </div>

      {showMissing && missing.length > 0 && (
        <ul className="px-4 py-2 border-b border-neutral-100 bg-neutral-50 text-[11px] text-neutral-700 flex flex-wrap gap-x-4 gap-y-1">
          {missing.map((m) => (
            <li key={m.entityId}>
              <Link href={m.workHref} className="font-semibold text-brand-700 hover:text-brand-900">
                {m.productionSheetId || m.taskLabel}
              </Link>
              {m.challanNumber ? <span className="text-neutral-500"> · {m.challanNumber}</span> : null}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="px-4 py-2 text-[11px] text-danger-700 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" aria-hidden />
          {error}
        </p>
      )}

      {!data ? null : alerts.length === 0 ? (
        <p className="px-4 py-4 text-xs text-neutral-500">No deadline alerts.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 text-[10px] uppercase tracking-wide text-neutral-600">
              <tr>
                <th scope="col" className="px-3 py-1.5 font-semibold">Severity</th>
                <th scope="col" className="px-3 py-1.5 font-semibold">Sheet / Design</th>
                <th scope="col" className="px-3 py-1.5 font-semibold">Challan</th>
                <th scope="col" className="px-3 py-1.5 font-semibold">Task</th>
                <th scope="col" className="px-3 py-1.5 font-semibold">Delivery</th>
                <th scope="col" className="px-3 py-1.5 font-semibold">Time left</th>
                <th scope="col" className="px-3 py-1.5 font-semibold">Status</th>
                <th scope="col" className="px-3 py-1.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {alerts.map((a) => {
                const isOverdue = a.daysRemaining < 0;
                return (
                  <tr key={a.id} className={isOverdue ? 'bg-danger-50/60' : undefined}>
                    <td className="px-3 py-1.5"><SeverityChip alert={a} /></td>
                    <td className="px-3 py-1.5 font-mono font-semibold text-neutral-900 whitespace-nowrap">
                      {a.productionSheetId || '—'}
                      {a.designNumber ? <span className="block font-sans font-normal text-[10px] text-neutral-600">{a.designNumber}</span> : null}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-neutral-800 whitespace-nowrap">{a.challanNumber || '—'}</td>
                    <td className="px-3 py-1.5 text-neutral-800 whitespace-nowrap">{a.taskLabel}</td>
                    <td className="px-3 py-1.5 text-neutral-800 whitespace-nowrap">{formatDate(a.deadlineAt)}</td>
                    <td className={`px-3 py-1.5 whitespace-nowrap font-semibold ${a.daysRemaining <= 0 ? 'text-danger-700' : 'text-neutral-900'}`}>
                      {a.remainingLabel}
                    </td>
                    <td className="px-3 py-1.5 text-neutral-700 whitespace-nowrap">{statusLabel(a.workStatus)}</td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap">
                      <Link href={a.workHref} className="font-semibold text-brand-700 hover:text-brand-900 mr-3">
                        View Work
                      </Link>
                      {a.dismissed ? (
                        <span className="text-[11px] text-neutral-600">Acknowledged</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => dismiss(a.id)}
                          disabled={busyId === a.id}
                          className="rounded border border-neutral-300 px-2 py-0.5 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                          title={isOverdue ? 'Hide the reminder for you; it stays listed while overdue' : 'Hide this alert for you only'}
                        >
                          Dismiss
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
