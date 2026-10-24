'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlarmClock, ArrowRight, BellOff, RefreshCw } from 'lucide-react';

interface AlertItem {
  id: string;
  stage: string;
  severity: string;
  deadlineDate: string;
  remaining: string;
  challanNumber: string | null;
  productionSheetNumber: string | null;
  designNumber: string | null;
  process: string;
  status: string;
  viewUrl: string;
}

interface AlertView {
  enabled: boolean;
  alerts?: AlertItem[];
  dismissed?: Array<{ id: string; stage: string; alertStatus: string; dismissedAt: string; challanNumber: string | null; process: string | null; viewUrl: string | null }>;
  overdueWork?: Array<{ taskId: string; challanNumber: string | null; process: string; remaining: string; viewUrl: string }>;
  missingDeadlineCount?: number;
}

const STAGE_LABEL = (stage: string) =>
  stage === 'OVERDUE' ? 'Overdue' : stage === 'DUE_TODAY' ? 'Due today' : `${stage.replace(/^D/, '')} day${stage === 'D1' ? '' : 's'}`;

// Tomato for overdue / due today, chartreuse for the last reminder, lavender for earlier ones.
const SEVERITY_BADGE: Record<string, string> = {
  CRITICAL: 'bg-tomato-500 text-white',
  HIGH: 'bg-chartreuse-300 text-ink-900',
  UPCOMING: 'bg-lavender-100 text-lavender-800',
};

const formatDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

/** Compact deadline alerts for one department. Renders nothing when the department is not enabled. */
export function DeadlineAlertsPanel({ department }: { department: string }) {
  const [view, setView] = useState<AlertView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/alerts?department=${encodeURIComponent(department)}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        setView({ enabled: false });
        return;
      }
      if (!res.ok) throw new Error(json.error || 'Failed to load deadline alerts');
      setView(json.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load deadline alerts');
    } finally {
      setLoading(false);
    }
  }, [department]);

  useEffect(() => {
    void load();
  }, [load]);

  const dismiss = async (id: string) => {
    try {
      setDismissing(id);
      const res = await fetch(`/api/alerts/${encodeURIComponent(id)}/dismiss`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to dismiss alert');
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to dismiss alert');
    } finally {
      setDismissing(null);
    }
  };

  if (view && !view.enabled) return null;

  const alerts = view?.alerts || [];
  const activeOverdueUrls = new Set(alerts.filter((a) => a.stage === 'OVERDUE').map((a) => a.viewUrl));
  // Overdue work whose alert this user dismissed: still flagged as overdue.
  const dismissedOverdue = (view?.overdueWork || []).filter((w) => !activeOverdueUrls.has(w.viewUrl));
  const overdueCount = view?.overdueWork?.length || 0;
  const dueTodayCount = alerts.filter((a) => a.stage === 'DUE_TODAY').length;

  return (
    <section aria-label="Deadline alerts" className="bg-white border border-ink-200 rounded-xl shadow-xs overflow-hidden">
      <div className="px-4 py-3 border-b border-ink-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlarmClock className="w-4 h-4 text-lavender-600" aria-hidden="true" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-900">Deadline Alerts</h3>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-lavender-100 text-lavender-800">{alerts.length}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
          {overdueCount > 0 && <span className="px-2 py-0.5 rounded bg-tomato-50 text-tomato-700 border border-tomato-200">Overdue {overdueCount}</span>}
          {dueTodayCount > 0 && <span className="px-2 py-0.5 rounded bg-tomato-50 text-tomato-700 border border-tomato-200">Due today {dueTodayCount}</span>}
          {(view?.missingDeadlineCount || 0) > 0 && (
            <span className="px-2 py-0.5 rounded bg-ink-100 text-ink-700 border border-ink-200" title="Open work whose challan has no delivery date">
              No delivery date {view?.missingDeadlineCount}
            </span>
          )}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Refresh deadline alerts"
            className="p-1 rounded text-ink-500 hover:text-ink-900 hover:bg-ink-100 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && <p role="alert" className="px-4 py-2 text-xs text-tomato-700 bg-tomato-50 border-b border-tomato-200">{error}</p>}

      {loading && !view ? (
        <p className="px-4 py-4 text-xs text-ink-500">Loading alerts…</p>
      ) : alerts.length === 0 ? (
        <p className="px-4 py-4 text-xs text-ink-500">No active deadline alerts.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-ink-50 text-ink-600 text-[10px] font-bold uppercase tracking-wider">
              <tr>
                <th className="py-2 px-3">Alert</th>
                <th className="py-2 px-3">Sheet / Design</th>
                <th className="py-2 px-3">Challan</th>
                <th className="py-2 px-3">Task</th>
                <th className="py-2 px-3">Delivery</th>
                <th className="py-2 px-3">Remaining</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {alerts.map((alert) => (
                <tr key={alert.id} className={alert.stage === 'OVERDUE' ? 'bg-tomato-50/40' : ''}>
                  <td className="py-2 px-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${SEVERITY_BADGE[alert.severity] || SEVERITY_BADGE.UPCOMING}`}>
                      {STAGE_LABEL(alert.stage)}
                    </span>
                  </td>
                  <td className="py-2 px-3 font-mono font-semibold text-ink-900">
                    {alert.productionSheetNumber || '—'}
                    {alert.designNumber && <span className="block text-[10px] font-sans font-normal text-ink-500">{alert.designNumber}</span>}
                  </td>
                  <td className="py-2 px-3 font-mono text-ink-800">{alert.challanNumber || '—'}</td>
                  <td className="py-2 px-3 text-ink-800">{alert.process}</td>
                  <td className="py-2 px-3 whitespace-nowrap text-ink-800">{formatDate(alert.deadlineDate)}</td>
                  <td className={`py-2 px-3 whitespace-nowrap font-semibold ${alert.stage === 'OVERDUE' ? 'text-tomato-700' : 'text-ink-800'}`}>{alert.remaining}</td>
                  <td className="py-2 px-3 text-[10px] font-bold uppercase text-ink-600">{alert.status.replace(/_/g, ' ')}</td>
                  <td className="py-2 px-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link
                        href={alert.viewUrl}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-lavender-600 hover:bg-lavender-700 text-white text-[10px] font-bold"
                      >
                        View Work <ArrowRight className="w-3 h-3" aria-hidden="true" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => void dismiss(alert.id)}
                        disabled={dismissing === alert.id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-ink-200 text-ink-700 hover:bg-ink-50 text-[10px] font-bold disabled:opacity-50"
                        aria-label={`Dismiss alert for ${alert.challanNumber || alert.process}`}
                      >
                        <BellOff className="w-3 h-3" aria-hidden="true" /> Dismiss
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dismissedOverdue.length > 0 && (
        <div className="px-4 py-2 border-t border-tomato-200 bg-tomato-50 text-[11px] text-tomato-800 flex flex-wrap gap-x-3 gap-y-1">
          <span className="font-bold">Still overdue (dismissed):</span>
          {dismissedOverdue.map((w) => (
            <Link key={w.taskId} href={w.viewUrl} className="underline font-semibold">
              {w.challanNumber || w.process} · {w.remaining}
            </Link>
          ))}
        </div>
      )}

      {(view?.dismissed?.length || 0) > 0 && (
        <div className="border-t border-ink-200">
          <button
            type="button"
            onClick={() => setShowDismissed((v) => !v)}
            aria-expanded={showDismissed}
            className="w-full px-4 py-2 text-left text-[11px] font-semibold text-ink-600 hover:bg-ink-50"
          >
            {showDismissed ? 'Hide' : 'Show'} dismissed ({view?.dismissed?.length})
          </button>
          {showDismissed && (
            <ul className="px-4 pb-3 space-y-1 text-[11px] text-ink-700">
              {view?.dismissed?.map((d) => (
                <li key={d.id} className="flex flex-wrap gap-x-2">
                  <span className="font-bold">{STAGE_LABEL(d.stage)}</span>
                  <span className="font-mono">{d.challanNumber || '—'}</span>
                  <span>{d.process || 'Closed task'}</span>
                  <span className="text-ink-500">dismissed {new Date(d.dismissedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  {d.alertStatus !== 'ACTIVE' && <span className="text-ink-500">({d.alertStatus.toLowerCase()})</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
