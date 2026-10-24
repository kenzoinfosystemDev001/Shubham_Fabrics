'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowDownToLine,
  CheckCircle2,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldAlert,
  Play,
  Pause,
} from 'lucide-react';

type FinalCheckSection = 'incoming' | 'queue' | 'issue-challan' | 'floor-board' | 'reports';
type WorkflowAction = 'receive' | 'start' | 'hold' | 'resume' | 'inspect' | 'handover';

interface Item {
  quantity: number;
  uom?: string;
  itemDescription?: string;
}

interface FinalCheckJob {
  id: string;
  challanNumber: string;
  status: string;
  fromDepartment: string;
  toDepartment: string;
  fabricIn?: number | null;
  fabricOut?: number | null;
  availableToHandover?: number;
  createdAt?: string;
  receivedDate?: string | null;
  issuedDate?: string | null;
  remarks?: string | null;
  items: Item[];
  productionLogs?: Array<{ balanceQuantity: number }>;
  program?: {
    programNumber?: string;
    styleCode?: string;
    buyerName?: string;
    clientName?: string;
  };
  childChallans?: Array<{ items: Item[] }>;
}

interface ReportsData {
  summary: {
    totalInput: number;
    totalAccepted: number;
    totalRework: number;
    totalRejected: number;
    firstPassYield: string;
    totalTransactions: number;
    totalDefectRecords: number;
    totalChallans: number;
    periodDays: number;
  };
  defectPareto: Array<{ reason: string; count: number }>;
  styleWiseMetrics: Array<{
    style: string;
    input: number;
    accepted: number;
    rework: number;
    rejected: number;
    yield: string;
  }>;
  transactions: Array<{
    recordedAt: string;
    operationName: string;
    inputQuantity: number;
    goodQuantity: number;
    reworkQuantity: number;
    rejectQuantity: number;
    challan?: { challanNumber: string };
    program?: { styleCode?: string; programNumber?: string };
  }>;
}

interface InspectionForm {
  acceptedQuantity: string;
  reworkQuantity: string;
  rejectedQuantity: string;
  pendingQuantity: string;
  defectReason: string;
  reworkReason: string;
  notes: string;
  appearanceCheck: 'PASS' | 'FAIL';
  measurementCheck: 'PASS' | 'FAIL';
  labelCheck: 'PASS' | 'FAIL';
  stitchingQuality: 'PASS' | 'FAIL';
  packagingReadiness: 'PASS' | 'FAIL';
}

const SECTION_DETAILS: Record<FinalCheckSection, { title: string; description: string }> = {
  incoming: {
    title: 'Incoming Challans',
    description: 'Verify physical receipt of garments handed over to Final QC.',
  },
  queue: {
    title: 'Final QC My Work',
    description: 'Receive challans, start inspections, and manage active Final QC jobs.',
  },
  'issue-challan': {
    title: 'Issue Challan',
    description: 'Transfer accepted garments to Packing with full challan traceability.',
  },
  'floor-board': {
    title: 'Final QC Floor Board',
    description: 'Live status of incoming jobs through inspection and downstream handover.',
  },
  reports: {
    title: 'Quality Summary',
    description: 'Final QC yield, defect trends, and recorded inspection transactions.',
  },
};

const INITIAL_INSPECTION: InspectionForm = {
  acceptedQuantity: '',
  reworkQuantity: '0',
  rejectedQuantity: '0',
  pendingQuantity: '0',
  defectReason: '',
  reworkReason: '',
  notes: '',
  appearanceCheck: 'PASS',
  measurementCheck: 'PASS',
  labelCheck: 'PASS',
  stitchingQuality: 'PASS',
  packagingReadiness: 'PASS',
};

function quantityOf(job: FinalCheckJob) {
  return job.items.reduce((total, item) => total + (Number(item.quantity) || 0), 0);
}

// The session travels in the httpOnly cookie, so no Authorization header is needed.
function authorizationHeaders(): HeadersInit {
  return {};
}

export function FinalCheckWorkspace({ section }: { section: FinalCheckSection }) {
  const [jobs, setJobs] = useState<FinalCheckJob[]>([]);
  const [reports, setReports] = useState<ReportsData | null>(null);
  const [lanes, setLanes] = useState<Record<string, FinalCheckJob[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [actionJob, setActionJob] = useState<FinalCheckJob | null>(null);
  const [action, setAction] = useState<WorkflowAction | null>(null);
  const [busyAction, setBusyAction] = useState(false);
  const [formError, setFormError] = useState('');
  const [receivedQuantity, setReceivedQuantity] = useState('');
  const [handoverQuantity, setHandoverQuantity] = useState('');
  const [holdReason, setHoldReason] = useState('');
  const [inspection, setInspection] = useState<InspectionForm>(INITIAL_INSPECTION);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const loadSection = useCallback(async (quiet = false) => {
    if (document.visibilityState === 'hidden' && quiet) return;
    if (quiet) setRefreshing(true);
    else setLoading(true);

    try {
      setError('');
      const query = new URLSearchParams();
      if (statusFilter !== 'ALL') query.set('status', statusFilter);
      if (debouncedSearch) query.set('search', debouncedSearch);
      const queryString = query.size ? `?${query.toString()}` : '';

      if (section === 'reports') {
        const response = await fetch('/api/final-check/reports?days=30', {
          cache: 'no-store',
          headers: authorizationHeaders(),
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Could not load Final QC reports.');
        }
        setReports(result.data);
      } else if (section === 'floor-board') {
        const response = await fetch('/api/final-check/floor-board', {
          cache: 'no-store',
          headers: authorizationHeaders(),
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Could not load the Final QC floor board.');
        }
        setLanes(result.data?.lanes || {});
      } else {
        const endpoint = section === 'incoming'
          ? 'incoming'
          : section === 'issue-challan'
            ? 'issue-challan'
            : 'queue';
        const response = await fetch(`/api/final-check/${endpoint}${queryString}`, {
          cache: 'no-store',
          headers: authorizationHeaders(),
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || `Could not load the Final QC ${endpoint}.`);
        }
        setJobs(Array.isArray(result.data) ? result.data : []);
      }
      setLastUpdated(new Date());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load Final QC data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [section, debouncedSearch, statusFilter]);

  useEffect(() => {
    void loadSection();
    const interval = window.setInterval(() => void loadSection(true), 5000);
    const refreshOnFocus = () => {
      if (document.visibilityState === 'visible') void loadSection(true);
    };
    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnFocus);
    };
  }, [loadSection]);

  const openAction = (job: FinalCheckJob, nextAction: WorkflowAction) => {
    setActionJob(job);
    setAction(nextAction);
    setFormError('');
    setReceivedQuantity(String(quantityOf(job)));
    setHandoverQuantity(String(Math.max(0, Number(job.availableToHandover ?? job.fabricOut ?? job.fabricIn ?? quantityOf(job)))));
    setHoldReason('');
    const total = Number(job.productionLogs?.[0]?.balanceQuantity ?? job.fabricIn ?? quantityOf(job));
    setInspection({ ...INITIAL_INSPECTION, acceptedQuantity: String(total) });
  };

  const closeAction = () => {
    if (busyAction) return;
    setActionJob(null);
    setAction(null);
    setFormError('');
  };

  const submitAction = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!actionJob || !action) return;
    setBusyAction(true);
    setFormError('');
    setNotice('');

    try {
      let endpoint = '';
      let body: Record<string, unknown> = {};

      switch (action) {
        case 'receive':
          endpoint = `/api/final-check/challans/${actionJob.id}/receive`;
          body = { ...body, receivedQuantity: Number(receivedQuantity), remarks: 'Physical receipt verified by Final QC.' };
          break;
        case 'start':
          endpoint = `/api/final-check/jobs/${actionJob.id}/start`;
          body = { ...body, tableNumber: 'Final QC Inspection Table 1' };
          break;
        case 'hold':
          endpoint = `/api/final-check/jobs/${actionJob.id}/hold`;
          body = { ...body, reason: holdReason.trim() || 'Quality review required' };
          break;
        case 'resume':
          endpoint = `/api/final-check/jobs/${actionJob.id}/resume`;
          body = { ...body, notes: 'Resumed by Final QC operator.' };
          break;
        case 'inspect': {
          endpoint = `/api/final-check/jobs/${actionJob.id}/inspect`;
          const inputQuantity = Number(actionJob.productionLogs?.[0]?.balanceQuantity ?? actionJob.fabricIn ?? quantityOf(actionJob));
          const acceptedQuantity = Number(inspection.acceptedQuantity);
          const reworkQuantity = Number(inspection.reworkQuantity);
          const rejectedQuantity = Number(inspection.rejectedQuantity);
          const pendingQuantity = Number(inspection.pendingQuantity);
          if ([acceptedQuantity, reworkQuantity, rejectedQuantity, pendingQuantity].some((value) => !Number.isFinite(value) || value < 0)) {
            throw new Error('All inspection quantities must be valid non-negative numbers.');
          }
          if (acceptedQuantity + reworkQuantity + rejectedQuantity + pendingQuantity !== inputQuantity) {
            throw new Error(`Quantities must total ${inputQuantity} pcs to match the challan input.`);
          }
          if (rejectedQuantity > 0 && !inspection.defectReason.trim()) {
            throw new Error('Add a defect reason for rejected garments.');
          }
          if (reworkQuantity > 0 && !inspection.reworkReason.trim()) {
            throw new Error('Add a rework reason for garments sent for rework.');
          }
          const checksPassed = [
            inspection.appearanceCheck,
            inspection.measurementCheck,
            inspection.labelCheck,
            inspection.stitchingQuality,
            inspection.packagingReadiness,
          ].every((check) => check === 'PASS');
          body = {
            ...body,
            inputQuantity,
            acceptedQuantity,
            reworkQuantity,
            rejectedQuantity,
            pendingQuantity,
            overallResult: checksPassed ? 'PASS' : 'FAIL',
            autoInspect: checksPassed && pendingQuantity === 0,
            appearanceCheck: inspection.appearanceCheck,
            measurementCheck: inspection.measurementCheck,
            labelCheck: inspection.labelCheck,
            stitchingQuality: inspection.stitchingQuality,
            packagingReadiness: inspection.packagingReadiness,
            defectReason: inspection.defectReason,
            reworkReason: inspection.reworkReason,
            notes: inspection.notes,
          };
          break;
        }
        case 'handover':
          endpoint = '/api/final-check/issue-challan';
          body = {
            parentChallanId: actionJob.id,
            items: [{ quantity: Number(handoverQuantity), uom: actionJob.items[0]?.uom || 'PCS' }],
          };
          break;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authorizationHeaders() },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok || result.success === false) {
        throw new Error(result.error || result.message || 'Final QC action could not be completed.');
      }
      setNotice(result.message || `${action[0].toUpperCase()}${action.slice(1)} completed for ${actionJob.challanNumber}.`);
      setActionJob(null);
      setAction(null);
      await loadSection(true);
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : 'Final QC action could not be completed.');
    } finally {
      setBusyAction(false);
    }
  };

  const displayedJobs = useMemo(() => {
    if (section === 'floor-board') return Object.values(lanes).flat();
    return jobs;
  }, [jobs, lanes, section]);

  const jobActions = (job: FinalCheckJob) => {
    const buttons: Array<{ label: string; action: WorkflowAction; icon: React.ComponentType<{ className?: string }> }> = [];
    if (['incoming', 'queue', 'floor-board'].includes(section) && job.status === 'ISSUED') {
      buttons.push({ label: 'Receive', action: 'receive', icon: PackageCheck });
    }
    if (['queue', 'floor-board'].includes(section)) {
      if (job.status === 'RECEIVED') buttons.push({ label: 'Start inspection', action: 'start', icon: Play });
      if (job.status === 'ON_HOLD') buttons.push({ label: 'Resume', action: 'resume', icon: Play });
      if (job.status === 'IN_PROCESS') {
        buttons.push({ label: 'Record inspection', action: 'inspect', icon: CheckCircle2 });
        buttons.push({ label: 'Hold', action: 'hold', icon: Pause });
      }
    }
    if (
      section === 'issue-challan' &&
      ['QC_APPROVED', 'QC_REJECTED', 'REWORK_REQUESTED', 'COMPLETED', 'READY_FOR_HANDOVER', 'READY_FOR_DISPATCH'].includes(job.status) &&
      Number(job.availableToHandover ?? job.fabricOut ?? 0) > 0
    ) {
      buttons.push({ label: 'Issue to Packing', action: 'handover', icon: ArrowDownToLine });
    }
    return buttons;
  };

  const renderJob = (job: FinalCheckJob) => {
    const actions = jobActions(job);
    const qty = quantityOf(job);
    return (
      <article key={job.id} className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-neutral-900">{job.challanNumber}</h3>
              <span className="rounded-full border border-accent-500/20 bg-accent-400/10 px-2.5 py-1 text-[10px] font-semibold text-accent-700">
                {job.status.replaceAll('_', ' ')}
              </span>
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              {job.program?.programNumber || 'Program unavailable'} · {job.program?.styleCode || 'Style unavailable'} · From {job.fromDepartment}
            </p>
            <p className="mt-1 text-xs text-neutral-500">{qty.toLocaleString()} pcs · {job.program?.buyerName || job.program?.clientName || 'Buyer not set'}</p>
          </div>
          {actions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {actions.map(({ label, action: nextAction, icon: Icon }) => (
                <button
                  type="button"
                  key={nextAction}
                  onClick={() => openAction(job, nextAction)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-accent-500/30 bg-accent-400/10 px-3 py-2 text-xs font-semibold text-accent-700 transition hover:bg-accent-400/20"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </article>
    );
  };

  const details = SECTION_DETAILS[section];
  const laneEntries = Object.entries(lanes);

  return (
    <div className="min-h-screen bg-canvas px-4 py-8 text-neutral-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-700">Final Quality Control</p>
            <h1 className="mt-1 text-3xl font-bold text-neutral-900">{details.title}</h1>
            <p className="mt-2 text-sm text-neutral-500">{details.description}</p>
            {lastUpdated && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-neutral-500">
                <Activity className="h-3 w-3 text-accent-700" />
                Database synced {lastUpdated.toLocaleTimeString()} · auto-refresh every 5 seconds
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void loadSection()}
            disabled={loading || refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 transition hover:border-accent-500/50 hover:text-neutral-900 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading || refreshing ? 'animate-spin' : ''}`} />
            Refresh now
          </button>
        </header>

        {error && (
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-danger-500/30 bg-danger-500/10 p-4 text-sm text-danger-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">{error}</div>
            <button type="button" onClick={() => void loadSection()} className="font-semibold underline">Retry</button>
          </div>
        )}
        {notice && (
          <div role="status" className="flex items-center gap-3 rounded-xl border border-accent-500/30 bg-accent-400/10 p-4 text-sm text-accent-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice('')} className="ml-auto text-accent-700">Dismiss</button>
          </div>
        )}

        {section === 'reports' ? reports ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ['Input inspected', reports.summary.totalInput, 'pcs'],
                ['Accepted', reports.summary.totalAccepted, 'pcs'],
                ['First-pass yield', reports.summary.firstPassYield, '%'],
                ['Defect records', reports.summary.totalDefectRecords, 'records'],
              ].map(([label, value, suffix]) => (
                <article key={String(label)} className="rounded-2xl border border-neutral-200 bg-white p-5">
                  <p className="text-sm text-neutral-500">{label}</p>
                  <p className="mt-3 text-3xl font-bold text-neutral-900">{value}</p>
                  <p className="mt-1 text-xs text-neutral-500">{suffix} · last {reports.summary.periodDays} days</p>
                </article>
              ))}
            </section>
            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-neutral-200 bg-white p-5">
                <h2 className="font-semibold text-neutral-900">Top defect reasons</h2>
                {reports.defectPareto.length ? (
                  <div className="mt-4 space-y-3">
                    {reports.defectPareto.map((defect) => (
                      <div key={defect.reason} className="flex items-center justify-between gap-3 border-b border-neutral-200 pb-2 text-sm">
                        <span className="text-neutral-700">{defect.reason}</span>
                        <span className="font-semibold text-accent-700">{defect.count}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="mt-4 text-sm text-neutral-500">No Final QC defects recorded in this period.</p>}
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-5">
                <h2 className="font-semibold text-neutral-900">Yield by style</h2>
                {reports.styleWiseMetrics.length ? (
                  <div className="mt-4 space-y-3">
                    {reports.styleWiseMetrics.map((style) => (
                      <div key={style.style} className="flex items-center justify-between gap-3 border-b border-neutral-200 pb-2 text-sm">
                        <span className="min-w-0 truncate text-neutral-700">{style.style}</span>
                        <span className="shrink-0 text-accent-700">{style.yield}% · {style.input} pcs</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="mt-4 text-sm text-neutral-500">No style metrics recorded in this period.</p>}
              </div>
            </section>
            <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
              <div className="border-b border-neutral-200 px-5 py-4">
                <h2 className="font-semibold text-neutral-900">Recent inspection transactions</h2>
              </div>
              {reports.transactions.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left text-sm">
                    <thead className="bg-white text-xs uppercase tracking-wide text-neutral-500">
                      <tr><th className="px-5 py-3">Recorded</th><th className="px-5 py-3">Challan</th><th className="px-5 py-3">Style</th><th className="px-5 py-3">Input</th><th className="px-5 py-3">Accepted</th><th className="px-5 py-3">Rework</th><th className="px-5 py-3">Rejected</th></tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {reports.transactions.map((tx, index) => (
                        <tr key={`${tx.challan?.challanNumber || 'tx'}-${tx.recordedAt}-${index}`} className="text-neutral-700">
                          <td className="px-5 py-3">{new Date(tx.recordedAt).toLocaleString()}</td>
                          <td className="px-5 py-3">{tx.challan?.challanNumber || '—'}</td>
                          <td className="px-5 py-3">{tx.program?.styleCode || '—'}</td>
                          <td className="px-5 py-3">{tx.inputQuantity}</td>
                          <td className="px-5 py-3 text-accent-700">{tx.goodQuantity}</td>
                          <td className="px-5 py-3 text-accent-700">{tx.reworkQuantity}</td>
                          <td className="px-5 py-3 text-danger-600">{tx.rejectQuantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="p-5 text-sm text-neutral-500">No Final QC transactions recorded yet.</p>}
            </section>
          </>
        ) : loading ? (
          <div className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500">Loading Final QC reports…</div>
        ) : (
          <div className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500">No report data is available. Refresh to try again.</div>
        ) : section === 'floor-board' ? (
          <section className="grid gap-4 xl:grid-cols-4">
            {laneEntries.map(([laneName, laneJobs]) => (
              <div key={laneName} className="min-h-52 rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-neutral-900">{laneName.replaceAll('_', ' ')}</h2>
                  <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-700">{laneJobs.length}</span>
                </div>
                <div className="space-y-3">
                  {laneJobs.map(renderJob)}
                  {!laneJobs.length && <p className="text-xs text-neutral-500">No jobs in this lane.</p>}
                </div>
              </div>
            ))}
            {loading && !displayedJobs.length && <p className="text-sm text-neutral-500">Loading live floor board…</p>}
          </section>
        ) : (
          <>
            <section className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-3 sm:flex-row">
              <label className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search challan, program, style, or buyer"
                  className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-9 pr-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-500 focus:border-brand-500"
                />
              </label>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-brand-500"
                aria-label="Filter by status"
              >
                <option value="ALL">All statuses</option>
                {(section === 'incoming'
                  ? ['ISSUED', 'RECEIVED', 'IN_PROCESS', 'ON_HOLD', 'QC_APPROVED', 'QC_REJECTED', 'REWORK_REQUESTED', 'COMPLETED', 'READY_FOR_HANDOVER', 'HANDED_OVER']
                  : ['ISSUED', 'RECEIVED', 'IN_PROCESS', 'ON_HOLD', 'QC_APPROVED', 'QC_REJECTED', 'REWORK_REQUESTED', 'COMPLETED', 'READY_FOR_HANDOVER', 'READY_FOR_DISPATCH', 'HANDED_OVER']
                ).map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
              </select>
            </section>
            {loading && !jobs.length ? (
              <div className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500">Loading Final QC data…</div>
            ) : displayedJobs.length ? (
              <section className="space-y-3">{displayedJobs.map(renderJob)}</section>
            ) : (
              <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center">
                <PackageCheck className="mx-auto h-8 w-8 text-neutral-600" />
                <p className="mt-3 text-sm font-medium text-neutral-700">No challans match this view.</p>
                <p className="mt-1 text-xs text-neutral-500">New handovers from Steam Press or other departments will appear here automatically.</p>
              </div>
            )}
          </>
        )}

        {actionJob && action && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-neutral-900/70 p-4" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeAction();
          }}>
            <section role="dialog" aria-modal="true" aria-labelledby="workflow-action-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl">
              <h2 id="workflow-action-title" className="text-lg font-bold text-neutral-900">
                {action === 'receive' && 'Confirm physical receipt'}
                {action === 'start' && 'Start Final QC inspection'}
                {action === 'hold' && 'Place job on hold'}
                {action === 'resume' && 'Resume Final QC job'}
                {action === 'inspect' && 'Record inspection result'}
                {action === 'handover' && 'Hand over accepted garments'}
              </h2>
              <p className="mt-1 text-xs text-neutral-500">{actionJob.challanNumber} · {quantityOf(actionJob)} pcs</p>
              {formError && <p role="alert" className="mt-4 rounded-lg border border-danger-500/30 bg-danger-500/10 p-3 text-xs text-danger-800">{formError}</p>}

              <form onSubmit={submitAction} className="mt-5 space-y-4">
                {action === 'receive' && (
                  <label className="block text-sm text-neutral-700">
                    Physically received quantity
                    <input type="number" min="1" max={quantityOf(actionJob)} required value={receivedQuantity} onChange={(event) => setReceivedQuantity(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-200 bg-canvas px-3 py-2 text-neutral-900" />
                  </label>
                )}
                {action === 'hold' && (
                  <label className="block text-sm text-neutral-700">
                    Hold reason
                    <input value={holdReason} onChange={(event) => setHoldReason(event.target.value)} placeholder="Reason for placing the job on hold" className="mt-1 w-full rounded-lg border border-neutral-200 bg-canvas px-3 py-2 text-neutral-900 placeholder:text-neutral-500" />
                  </label>
                )}
                {action === 'inspect' && (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {([
                        ['acceptedQuantity', 'Accepted'],
                        ['reworkQuantity', 'Rework'],
                        ['rejectedQuantity', 'Rejected'],
                        ['pendingQuantity', 'Hold / pending'],
                      ] as const).map(([key, label]) => (
                        <label key={key} className="text-xs font-medium text-neutral-700">
                          {label}
                          <input type="number" min="0" step="1" required value={inspection[key]} onChange={(event) => setInspection((current) => ({ ...current, [key]: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-200 bg-canvas px-3 py-2 text-sm text-neutral-900" />
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-neutral-500">All quantities must add up to {Number(actionJob.productionLogs?.[0]?.balanceQuantity ?? actionJob.fabricIn ?? quantityOf(actionJob))} pcs.</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {([
                        ['stitchingQuality', 'Stitching quality'],
                        ['measurementCheck', 'Measurements'],
                        ['appearanceCheck', 'Appearance'],
                        ['labelCheck', 'Labels'],
                        ['packagingReadiness', 'Packaging readiness'],
                      ] as const).map(([key, label]) => (
                        <label key={key} className="text-xs font-medium text-neutral-700">
                          {label}
                          <select value={inspection[key]} onChange={(event) => setInspection((current) => ({ ...current, [key]: event.target.value as 'PASS' | 'FAIL' }))} className="mt-1 w-full rounded-lg border border-neutral-200 bg-canvas px-3 py-2 text-sm text-neutral-900">
                            <option value="PASS">Pass</option>
                            <option value="FAIL">Fail</option>
                          </select>
                        </label>
                      ))}
                    </div>
                    <label className="block text-xs font-medium text-neutral-700">
                      Defect reason (required when rejected quantity is above zero)
                      <input value={inspection.defectReason} onChange={(event) => setInspection((current) => ({ ...current, defectReason: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-200 bg-canvas px-3 py-2 text-sm text-neutral-900" />
                    </label>
                    <label className="block text-xs font-medium text-neutral-700">
                      Rework reason (required when rework quantity is above zero)
                      <input value={inspection.reworkReason} onChange={(event) => setInspection((current) => ({ ...current, reworkReason: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-200 bg-canvas px-3 py-2 text-sm text-neutral-900" />
                    </label>
                    <label className="block text-xs font-medium text-neutral-700">
                      Inspection notes
                      <textarea value={inspection.notes} onChange={(event) => setInspection((current) => ({ ...current, notes: event.target.value }))} rows={3} className="mt-1 w-full rounded-lg border border-neutral-200 bg-canvas px-3 py-2 text-sm text-neutral-900" />
                    </label>
                  </>
                )}
                {action === 'handover' && (
                  <>
                    <p className="rounded-lg border border-accent-500/20 bg-accent-400/5 p-3 text-xs text-neutral-700">
                      Destination: <strong className="text-accent-700">Packing</strong>. Quantity may not exceed accepted balance not yet handed over.
                    </p>
                    <label className="block text-sm text-neutral-700">
                      Accepted quantity to transfer
                      <input type="number" min="1" max={Number(actionJob.availableToHandover ?? actionJob.fabricOut ?? 0)} required value={handoverQuantity} onChange={(event) => setHandoverQuantity(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-200 bg-canvas px-3 py-2 text-neutral-900" />
                    </label>
                  </>
                )}
                {['start', 'resume'].includes(action) && (
                  <p className="text-sm text-neutral-700">This updates the challan status and records the action in the department event history.</p>
                )}
                <div className="flex justify-end gap-2 border-t border-neutral-200 pt-4">
                  <button type="button" onClick={closeAction} disabled={busyAction} className="rounded-lg border border-neutral-200 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-50">Cancel</button>
                  <button type="submit" disabled={busyAction} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                    {busyAction ? 'Saving…' : 'Confirm'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
