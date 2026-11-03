'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Eye, PauseCircle, PlayCircle, Search, Send, X } from 'lucide-react';
import {
  BTN_PRIMARY,
  BTN_QUIET,
  EmptyRow,
  FIELD,
  Notice,
  PageHeader,
  Panel,
  THEAD,
  fetchJson,
  fmtDate,
  fmtQty,
} from '@/components/workflow/WorkflowUi';
import { HOLD_EVENT_LABEL, HOLD_REASONS, HOLD_STATUS_LABEL } from '@/lib/holds.mjs';
import { formatTotals } from '@/lib/challan-units.mjs';
import { departmentName } from '@/lib/workflow-views';
import { getCurrentUser, isAdminUser } from '@/lib/rbac';

// HOLD page shared by the production departments (Dyeing to Inventory). Quantities stay in each line's own unit.

/** Department codes in floor order, for the administrator's department filter. */
const HOLD_DEPARTMENT_CODES = [
  'DYEING', 'QC1', 'EMBROIDERY', 'THREAD_CUTTING', 'QC2', 'WASHING', 'QC3',
  'RECUTTING', 'STITCHING', 'FINISHING', 'STEAM_PRESS', 'FINAL_CHECK', 'INVENTORY',
];

type View = 'open' | 'closed' | 'all';

const STATUS_TONE: Record<string, string> = {
  ON_HOLD: 'bg-accent-100 text-neutral-900',
  PARTIALLY_RELEASED: 'bg-brand-50 text-brand-800',
  PARTIALLY_FORWARDED: 'bg-brand-50 text-brand-800',
  RELEASED: 'bg-neutral-100 text-neutral-600',
  FORWARDED: 'bg-neutral-100 text-neutral-600',
  CLEARED: 'bg-neutral-100 text-neutral-500',
};

function HoldStatusBadge({ hold }: { hold: any }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${STATUS_TONE[hold.status] || 'bg-neutral-100 text-neutral-700'}`}>
      {hold.statusLabel}
    </span>
  );
}

const RELEASE_TONE: Record<string, string> = {
  RELEASED: 'bg-neutral-100 text-neutral-700',
  FORWARDED: 'bg-brand-50 text-brand-800',
  RECEIVED: 'bg-accent-100 text-neutral-900',
  CHALLAN_CANCELLED: 'bg-danger-50 text-danger-700',
  CHALLAN_DELETED: 'bg-danger-50 text-danger-700',
};

function ReleaseStatusBadge({ release }: { release: any }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${RELEASE_TONE[release.status] || 'bg-neutral-100 text-neutral-700'}`}>
      {release.statusLabel}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-4">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{label}</span>
      <span className="block text-xl font-bold text-neutral-900 tabular-nums">{value}</span>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{label}</span>
      <span className="block text-sm text-neutral-900">{children || '—'}</span>
    </div>
  );
}

function Modal({ title, subtitle, onClose, children, wide }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-neutral-900/50 p-3 overflow-y-auto" role="dialog" aria-modal="true">
      <div className={`bg-white rounded-2xl shadow-xl border border-neutral-200 w-full ${wide ? 'max-w-4xl' : 'max-w-xl'}`}>
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-neutral-900">{title}</h3>
            {subtitle && <p className="text-xs text-neutral-500 font-mono truncate">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-neutral-500 hover:bg-neutral-100 rounded-lg" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** HOLD records of one department; administrators may switch to any department or all of them. */
export function DepartmentHold({ departmentCode }: { departmentCode: string }) {
  const [admin, setAdmin] = useState(false);
  const [department, setDepartment] = useState(departmentCode);
  const [view, setView] = useState<View>('open');
  const [search, setSearch] = useState('');
  // Server-side filters besides the search (design, serial, challan, fabric, colour).
  const [filters, setFilters] = useState({ reason: '', unit: '', status: '', from: '', to: '' });
  const [rows, setRows] = useState<any[]>([]);
  const [receivedLabel, setReceivedLabel] = useState('Total Received');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [releasing, setReleasing] = useState<any>(null);
  const [viewing, setViewing] = useState<string | null>(null);

  useEffect(() => setAdmin(isAdminUser(getCurrentUser())), []);

  // HOLD Release History and the HOLD totals (held, released, forwarded), from the release records.
  const [releases, setReleases] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [releaseSearch, setReleaseSearch] = useState('');

  const loadReleases = async () => {
    try {
      const q = new URLSearchParams({ department });
      if (releaseSearch.trim()) q.set('search', releaseSearch.trim());
      const body = await fetchJson(`/api/holds/releases?${q}`);
      setReleases(body.data || []);
      setSummary(body.summary || null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    loadReleases();
    try {
      // A chosen status is shown whether it is open or closed.
      const q = new URLSearchParams({ department, view: filters.status ? 'all' : view });
      if (search.trim()) q.set('search', search.trim());
      for (const [k, v] of Object.entries(filters)) if (v) q.set(k, v);
      const body = await fetchJson(`/api/holds?${q}`);
      setRows(body.data || []);
      setReceivedLabel(body.departments?.length === 1 ? body.departments[0].receivedLabel : 'Total Received');
    } catch (e: any) {
      setError(e.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department, view, filters]);

  const open = rows.filter((r) => r.active);
  const onHold = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const r of open) totals[r.unit] = (totals[r.unit] || 0) + (Number(r.remainingQuantity) || 0);
    return totals;
  }, [open]);
  const allDepartments = department === 'ALL';
  const columns = 26;
  const totals = summary?.total;

  const done = (text: string) => {
    setPlacing(false);
    setReleasing(null);
    setMessage(text);
    load();
  };

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <PageHeader title={`HOLD · ${allDepartments ? 'All Departments' : departmentName(department)}`} loading={loading} onRefresh={load}>
        {admin && (
          <select value={department} onChange={(e) => setDepartment(e.target.value)} className={`${FIELD} w-auto`} aria-label="Department">
            <option value="ALL">All departments</option>
            {HOLD_DEPARTMENT_CODES.map((code) => (
              <option key={code} value={code}>
                {departmentName(code)}
              </option>
            ))}
          </select>
        )}
        <button type="button" onClick={() => setPlacing(true)} disabled={allDepartments} className={BTN_PRIMARY} title={allDepartments ? 'Choose a department to place fabric on HOLD' : undefined}>
          <PauseCircle className="w-4 h-4" />
          Place on HOLD
        </button>
      </PageHeader>

      <main className="p-4 sm:p-8 max-w-[1600px] mx-auto space-y-6">
        {error && <Notice kind="error" onClose={() => setError(null)}>{error}</Notice>}
        {message && <Notice kind="success" onClose={() => setMessage(null)}>{message}</Notice>}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Open HOLD records" value={totals ? totals.openHolds : open.length} />
          <Stat label="Pending on HOLD (MTR / PCS)" value={formatTotals(totals ? totals.held : onHold, '0')} />
          <Stat label="Released from HOLD (MTR / PCS)" value={formatTotals(totals?.released || {}, '0')} />
          <Stat label="Forwarded from HOLD on new challans" value={formatTotals(totals?.forwarded || {}, '0')} />
        </div>

        {allDepartments && summary?.departments?.length > 0 && (
          <Panel title="HOLD by Department" count={summary.departments.length}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={THEAD}>
                  <tr>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3 text-right">Open HOLDs</th>
                    <th className="py-2.5 px-3 text-right">Pending on HOLD</th>
                    <th className="py-2.5 px-3 text-right">Released</th>
                    <th className="py-2.5 px-3 text-right">Forwarded from HOLD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {summary.departments.map((d: any) => (
                    <tr key={d.code}>
                      <td className="py-2.5 px-3 font-semibold text-neutral-900">
                        <button type="button" onClick={() => setDepartment(d.code)} className="text-brand-700 hover:underline">{d.name}</button>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{d.openHolds}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{formatTotals(d.held, '0')}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{formatTotals(d.released, '0')}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{formatTotals(d.forwarded, '0')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        <Panel
          title="HOLD Records"
          count={rows.length}
          actions={
            <>
              <div className="inline-flex rounded-lg border border-neutral-200 overflow-hidden" role="tablist">
                {(['open', 'closed', 'all'] as View[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="tab"
                    aria-selected={view === v}
                    onClick={() => setView(v)}
                    className={`px-3 py-1.5 text-xs font-semibold ${view === v ? 'bg-brand-600 text-white' : 'bg-white text-neutral-700 hover:bg-neutral-50'}`}
                  >
                    {v === 'open' ? 'On HOLD' : v === 'closed' ? 'Released / Forwarded' : 'All'}
                  </button>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  load();
                }}
                className="relative"
              >
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Design no., serial no., challan no., fabric…"
                  className={`${FIELD} pl-9 w-64`}
                  aria-label="Search HOLD records"
                />
              </form>
              <select value={filters.reason} onChange={(e) => setFilters({ ...filters, reason: e.target.value })} className={`${FIELD} w-auto`} aria-label="Hold reason">
                <option value="">All reasons</option>
                {HOLD_REASONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
              </select>
              <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className={`${FIELD} w-auto`} aria-label="Status">
                <option value="">All statuses</option>
                {Object.entries(HOLD_STATUS_LABEL).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </select>
              <select value={filters.unit} onChange={(e) => setFilters({ ...filters, unit: e.target.value })} className={`${FIELD} w-auto`} aria-label="Unit">
                <option value="">MTR & PCS</option>
                <option value="MTR">MTR</option>
                <option value="PCS">PCS</option>
              </select>
              <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className={`${FIELD} w-auto`} aria-label="Held from" title="Held from" />
              <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className={`${FIELD} w-auto`} aria-label="Held to" title="Held to" />
            </>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={THEAD}>
                <tr>
                  <th className="py-2.5 px-3">HOLD No.</th>
                  <th className="py-2.5 px-3">Design No.</th>
                  <th className="py-2.5 px-3">Serial No.</th>
                  <th className="py-2.5 px-3">Production Sheet</th>
                  <th className="py-2.5 px-3">Challan No.</th>
                  <th className="py-2.5 px-3">Challan Date</th>
                  <th className="py-2.5 px-3">From</th>
                  <th className="py-2.5 px-3">Fabric</th>
                  <th className="py-2.5 px-3">Colour</th>
                  <th className="py-2.5 px-3">Production Type</th>
                  <th className="py-2.5 px-3">Size / Measurement</th>
                  <th className="py-2.5 px-3 text-right">{receivedLabel}</th>
                  <th className="py-2.5 px-3 text-right">Already Processed</th>
                  <th className="py-2.5 px-3 text-right">Already Forwarded</th>
                  <th className="py-2.5 px-3 text-right">Released</th>
                  <th className="py-2.5 px-3 text-right">Remaining HOLD</th>
                  <th className="py-2.5 px-3">Unit</th>
                  <th className="py-2.5 px-3">Hold Reason</th>
                  <th className="py-2.5 px-3">Remarks</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Hold Date & Time</th>
                  <th className="py-2.5 px-3">Held By</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right" colSpan={3}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {!loading && rows.length === 0 && (
                  <EmptyRow colSpan={columns} text={view === 'open' ? 'Nothing is on HOLD.' : 'No HOLD records found.'} />
                )}
                {rows.map((h) => (
                  <tr key={h.id} className="align-top hover:bg-neutral-50/60">
                    <td className="py-2.5 px-3 font-mono font-semibold text-neutral-900 whitespace-nowrap">{h.holdNumber}</td>
                    <td className="py-2.5 px-3 font-semibold text-neutral-900">{h.designNumber}</td>
                    <td className="py-2.5 px-3 font-mono">{h.serialNumber}</td>
                    <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                      <Link href={`/programs/${h.programId}`} className="text-brand-700 hover:underline">{h.productionSheetNumber}</Link>
                    </td>
                    <td className="py-2.5 px-3 font-mono">{h.challanNumber || '—'}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">{h.challanDate ? fmtDate(h.challanDate) : '—'}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">{h.sendingDepartmentName || '—'}</td>
                    <td className="py-2.5 px-3 text-neutral-900">{h.fabricName}</td>
                    <td className="py-2.5 px-3">{h.colour || '—'}{h.requiredColour ? <span className="block text-[10px] text-neutral-500">Required: {h.requiredColour}</span> : null}</td>
                    <td className="py-2.5 px-3">{h.productionType || '—'}</td>
                    <td className="py-2.5 px-3">{h.size || '—'}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(h.receivedQuantity, h.unit)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{h.processedQuantity != null ? fmtQty(h.processedQuantity, h.unit) : '—'}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(h.forwardedQuantity, h.unit)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                      {h.releasedQuantity > 0 ? (
                        <button type="button" onClick={() => setViewing(h.id)} className="text-brand-700 hover:underline" title="View release history">{fmtQty(h.releasedQuantity, h.unit)}</button>
                      ) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap font-bold text-neutral-900">{fmtQty(h.remainingQuantity, h.unit)}</td>
                    <td className="py-2.5 px-3 font-semibold">{h.unit}</td>
                    <td className="py-2.5 px-3 min-w-[140px]">{h.reasonText}</td>
                    <td className="py-2.5 px-3 min-w-[160px] text-neutral-600">{h.remarks || '—'}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">{h.departmentName}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">{fmtDate(h.heldAt, true)}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">{h.heldByName}</td>
                    <td className="py-2.5 px-3"><HoldStatusBadge hold={h} /></td>
                    <td className="py-2.5 pl-3 pr-1 text-right">
                      <button type="button" onClick={() => setViewing(h.id)} className={BTN_QUIET} title="View details and history">
                        <Eye className="w-3.5 h-3.5" />
                        View
                      </button>
                    </td>
                    <td className="py-2.5 px-1 text-right">
                      {h.active && (
                        <button type="button" onClick={() => setReleasing(h)} className={BTN_QUIET} title="Release quantity from HOLD">
                          <PlayCircle className="w-3.5 h-3.5" />
                          Release
                        </button>
                      )}
                    </td>
                    <td className="py-2.5 pl-1 pr-3 text-right">
                      {h.active && h.forwardPath && (
                        <Link href={h.forwardPath} className={BTN_QUIET} title="Forward the remaining quantity on the department's own screen">
                          <Send className="w-3.5 h-3.5" />
                          Forward
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <p className="text-xs text-neutral-500">
          Quantity on HOLD is blocked: it cannot be processed, inspected or forwarded until it is released here. Release it to the department&apos;s available quantity, or release and forward it on a new challan linked to its original challan and this HOLD.
        </p>

        <Panel
          title="HOLD Release History"
          count={releases.length}
          actions={
            <form
              onSubmit={(e) => {
                e.preventDefault();
                loadReleases();
              }}
              className="relative"
            >
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={releaseSearch}
                onChange={(e) => setReleaseSearch(e.target.value)}
                placeholder="Challan, design, serial, HOLD no…"
                className={`${FIELD} pl-9 w-64`}
                aria-label="Search HOLD release history"
              />
            </form>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={THEAD}>
                <tr>
                  <th className="py-2.5 px-3">HOLD No.</th>
                  <th className="py-2.5 px-3">Original Challan</th>
                  <th className="py-2.5 px-3">New Challan</th>
                  <th className="py-2.5 px-3">Design No.</th>
                  <th className="py-2.5 px-3">Serial No.</th>
                  <th className="py-2.5 px-3">Production Sheet</th>
                  <th className="py-2.5 px-3">Fabric / Colour</th>
                  <th className="py-2.5 px-3 text-right">Released Quantity</th>
                  <th className="py-2.5 px-3">Unit</th>
                  <th className="py-2.5 px-3">Destination</th>
                  {allDepartments && <th className="py-2.5 px-3">Department</th>}
                  <th className="py-2.5 px-3">Released By</th>
                  <th className="py-2.5 px-3">Release Date</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {releases.length === 0 && <EmptyRow colSpan={allDepartments ? 14 : 13} text="Nothing has been released from HOLD yet." />}
                {releases.map((r) => (
                  <tr key={r.id} className="align-top hover:bg-neutral-50/60">
                    <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                      <button type="button" onClick={() => setViewing(r.holdId)} className="font-semibold text-brand-700 hover:underline">{r.holdNumber}</button>
                    </td>
                    <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                      {r.originalChallanId ? <Link href={`/challans/${r.originalChallanId}`} className="text-brand-700 hover:underline">{r.originalChallanNumber}</Link> : r.originalChallanNumber || '—'}
                    </td>
                    <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                      {r.newChallanId ? <Link href={`/challans/${r.newChallanId}`} className="font-semibold text-brand-700 hover:underline">{r.newChallanNumber}</Link> : r.newChallanNumber || '—'}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-neutral-900">{r.designNumber}</td>
                    <td className="py-2.5 px-3 font-mono">{r.serialNumber}</td>
                    <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                      <Link href={`/programs/${r.programId}`} className="text-brand-700 hover:underline">{r.productionSheetNumber}</Link>
                    </td>
                    <td className="py-2.5 px-3">
                      {r.fabricName}
                      <span className="block text-neutral-500">{r.colour || '—'}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-bold text-neutral-900">{fmtQty(r.quantity)}</td>
                    <td className="py-2.5 px-3 font-semibold">{r.unit}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">{r.mode === 'FORWARD' ? r.destinationName : `${r.departmentName} (available)`}</td>
                    {allDepartments && <td className="py-2.5 px-3 whitespace-nowrap">{r.departmentName}</td>}
                    <td className="py-2.5 px-3 whitespace-nowrap">{r.releasedByName}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">{fmtDate(r.createdAt, true)}</td>
                    <td className="py-2.5 px-3"><ReleaseStatusBadge release={r} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </main>

      {placing && <PlaceHoldDialog department={department} onClose={() => setPlacing(false)} onDone={done} />}
      {releasing && <ReleaseDialog hold={releasing} onClose={() => setReleasing(null)} onDone={done} />}
      {viewing && <HoldDetailDialog id={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function PlaceHoldDialog({ department, onClose, onDone }: { department: string; onClose: () => void; onDone: (message: string) => void }) {
  const [lines, setLines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [lineKey, setLineKey] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [reasonOther, setReasonOther] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submissionKey] = useState(newSubmissionKey);

  useEffect(() => {
    fetchJson(`/api/holds/candidates?department=${encodeURIComponent(department)}`)
      .then((body) => setLines(body.data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [department]);

  const line = lines.find((l) => l.key === lineKey) || null;
  const q = filter.trim().toLowerCase();
  const shown = q
    ? lines.filter((l) => [l.designNumber, l.serialNumber, l.productionSheetNumber, l.challanNumber, l.fabricName, l.colour].some((v) => String(v || '').toLowerCase().includes(q)))
    : lines;

  const choose = (l: any) => {
    setLineKey(l.key);
    // The remaining (unforwarded) quantity is what goes on HOLD unless a smaller quantity is entered.
    setQuantity(String(l.outstanding));
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!line) return setError('Select the line to place on HOLD.');
    if (!reason) return setError('Select the Hold Reason.');
    if (reason === 'OTHER' && !reasonOther.trim()) return setError('Enter the reason for Other.');
    setSaving(true);
    setError(null);
    try {
      const body = await fetchJson('/api/holds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department, lineKey: line.key, quantity, unit: line.unit, reason, reasonOther, remarks, idempotencyKey: submissionKey }),
      });
      onDone(body.message);
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <Modal title="Place on HOLD" subtitle={departmentName(department)} onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="p-5 space-y-4">
          {error && <Notice kind="error">{error}</Notice>}
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-neutral-600">1. Select the line (only quantity not yet forwarded and not already on HOLD can be held)</span>
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter…" className={`${FIELD} w-48`} aria-label="Filter lines" />
          </div>
          <div className="overflow-auto max-h-72 border border-neutral-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className={`${THEAD} sticky top-0`}>
                <tr>
                  <th className="py-2 px-3" />
                  <th className="py-2 px-3">Design / Serial</th>
                  <th className="py-2 px-3">Challan</th>
                  <th className="py-2 px-3">Fabric / Colour</th>
                  <th className="py-2 px-3 text-right">Received</th>
                  <th className="py-2 px-3 text-right">Forwarded</th>
                  <th className="py-2 px-3 text-right">Can Hold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading && <EmptyRow colSpan={7} text="Loading…" />}
                {!loading && shown.length === 0 && <EmptyRow colSpan={7} text="No line has quantity left to hold (lines already on HOLD are not listed)." />}
                {shown.map((l) => (
                  <tr key={l.key} onClick={() => choose(l)} className={`cursor-pointer ${l.key === lineKey ? 'bg-brand-50' : 'hover:bg-neutral-50'}`}>
                    <td className="py-2 px-3">
                      <input type="radio" name="hold-line" checked={l.key === lineKey} onChange={() => choose(l)} aria-label={`Select ${l.fabricName} ${l.serialNumber}`} />
                    </td>
                    <td className="py-2 px-3">
                      <span className="font-semibold text-neutral-900">{l.designNumber}</span>
                      <span className="block font-mono text-neutral-500">{l.serialNumber}</span>
                    </td>
                    <td className="py-2 px-3 font-mono">{l.challanNumber || '—'}</td>
                    <td className="py-2 px-3">
                      {l.fabricName}
                      <span className="block text-neutral-500">{[l.colour, l.size].filter(Boolean).join(' · ') || '—'}</span>
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(l.received, l.unit)}</td>
                    <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(l.forwarded, l.unit)}</td>
                    <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap font-semibold">{fmtQty(l.outstanding, l.unit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {line && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-neutral-50 border border-neutral-200 rounded-xl p-4">
              <Info label="Design No.">{line.designNumber}</Info>
              <Info label="Serial No.">{line.serialNumber}</Info>
              <Info label="Production Sheet">{line.productionSheetNumber}</Info>
              <Info label="Challan No.">{line.challanNumber}</Info>
              <Info label="Challan Date">{line.challanDate ? fmtDate(line.challanDate) : null}</Info>
              <Info label="From">{line.sendingDepartmentName}</Info>
              <Info label="Fabric">{line.fabricName}</Info>
              <Info label="Colour">{line.colour}</Info>
              <Info label="Required Colour">{line.requiredColour}</Info>
              <Info label="Production Type">{line.productionType}</Info>
              <Info label="Already Processed">{fmtQty(line.processed, line.unit)}</Info>
              <Info label="Already on HOLD">{line.onHold > 0 ? fmtQty(line.onHold, line.unit) : null}</Info>
              <Info label="Size / Measurement">{line.size}</Info>
              <Info label="Unit">{line.unit}</Info>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-semibold text-neutral-600">2. HOLD quantity *</span>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  min="0"
                  step={line?.unit === 'PCS' ? '1' : 'any'}
                  max={line?.outstanding}
                  required
                  disabled={!line}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className={`${FIELD} text-right tabular-nums`}
                />
                <span className="text-sm font-semibold text-neutral-700 w-10">{line?.unit || ''}</span>
              </div>
              {line && <span className="block mt-1 text-[11px] text-neutral-500">Up to {fmtQty(line.outstanding, line.unit)} (received {fmtQty(line.received, line.unit)}, forwarded {fmtQty(line.forwarded, line.unit)}).</span>}
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-neutral-600">3. Hold Reason *</span>
              <select value={reason} onChange={(e) => setReason(e.target.value)} required className={`${FIELD} mt-1`}>
                <option value="">Select reason…</option>
                {HOLD_REASONS.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {reason === 'OTHER' && (
            <label className="block">
              <span className="text-xs font-semibold text-neutral-600">Specific reason *</span>
              <input value={reasonOther} onChange={(e) => setReasonOther(e.target.value)} required maxLength={200} className={`${FIELD} mt-1`} />
            </label>
          )}
          <label className="block">
            <span className="text-xs font-semibold text-neutral-600">Additional remarks</span>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={1000} rows={3} className={`${FIELD} mt-1 h-auto py-2`} />
          </label>
        </div>
        <div className="px-5 py-4 border-t border-neutral-200 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={BTN_QUIET}>
            Cancel
          </button>
          <button type="submit" disabled={saving || !line} className={BTN_PRIMARY}>
            {saving ? 'Saving…' : 'Place on HOLD'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** A key for one submission of a form: a double click or retry sends the same key, so it is applied once. */
const newSubmissionKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Release HOLD: back to the department's available quantity, or released and forwarded on a new challan to the
 * department's next step. Every original detail comes from the HOLD's exact challan line; nothing is typed again.
 */
function ReleaseDialog({ hold: row, onClose, onDone }: { hold: any; onClose: () => void; onDone: (message: string) => void }) {
  const [hold, setHold] = useState<any>(null);
  const [mode, setMode] = useState<'AVAILABLE' | 'FORWARD'>('AVAILABLE');
  const [quantity, setQuantity] = useState(String(row.remainingQuantity));
  const [challanNumber, setChallanNumber] = useState('');
  const [issuedDate, setIssuedDate] = useState(today());
  const [dyedColour, setDyedColour] = useState(row.colour || '');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submissionKey] = useState(newSubmissionKey);

  useEffect(() => {
    fetchJson(`/api/holds/${row.id}`)
      .then((body) => {
        setHold(body.data);
        setQuantity(String(body.data.remainingQuantity));
        if (body.data.forwardTo) setMode('FORWARD');
      })
      .catch((e) => setError(e.message));
  }, [row.id]);

  const h = hold || row;
  const forward = mode === 'FORWARD';
  const qty = Number(quantity);
  const left = Number.isFinite(qty) ? Math.max(0, Math.round((Number(h.remainingQuantity) - qty) * 1000) / 1000) : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forward && !challanNumber.trim()) return setError('Enter the Challan Number for the new challan.');
    setSaving(true);
    setError(null);
    try {
      const body = await fetchJson(`/api/holds/${row.id}/${forward ? 'release-forward' : 'release'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          forward
            ? { quantity, challanNumber: challanNumber.trim(), issuedDate, dyedColour, remarks, idempotencyKey: submissionKey }
            : { quantity, remarks, idempotencyKey: submissionKey },
        ),
      });
      onDone(body.message);
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <Modal title="Release HOLD" subtitle={`${h.holdNumber} · ${h.departmentName}`} onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="p-5 space-y-4">
          {error && <Notice kind="error">{error}</Notice>}
          <div>
            <span className="block text-xs font-semibold text-neutral-600 mb-2">Original production details (from the exact challan line held)</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-neutral-50 border border-neutral-200 rounded-xl p-4">
              <Info label="Original Challan No.">{h.challanNumber}</Info>
              <Info label="Original Challan ID"><span className="font-mono text-[11px] break-all">{h.challanId}</span></Info>
              <Info label="Original Challan Date">{h.challanDate ? fmtDate(h.challanDate) : null}</Info>
              <Info label="Original Sending Department">{h.sendingDepartmentName}</Info>
              <Info label="Design No.">{h.designNumber}</Info>
              <Info label="Serial No.">{h.serialNumber}</Info>
              <Info label="Production Sheet">{h.productionSheetNumber}</Info>
              <Info label="Production Sheet ID"><span className="font-mono text-[11px] break-all">{h.programId}</span></Info>
              <Info label="Production Type">{h.productionType}</Info>
              <Info label="Fabric">{h.fabricName}</Info>
              <Info label="Colour">{h.colour}</Info>
              <Info label="Shade">{hold?.original?.shade}</Info>
              <Info label="Original Received Quantity">{fmtQty(h.receivedQuantity, h.unit)}</Info>
              <Info label="Previously Held">{fmtQty(h.holdQuantity, h.unit)}</Info>
              <Info label="Already Released">{fmtQty(h.releasedQuantity, h.unit)}</Info>
              <Info label="Available on HOLD"><span className="font-bold">{fmtQty(h.remainingQuantity, h.unit)}</span></Info>
              <Info label="Unit">{h.unit}</Info>
              <Info label="Current Holding Department">{h.departmentName}</Info>
              <Info label="Hold Reason">{h.reasonText}</Info>
              <Info label="Original Challan Line ID"><span className="font-mono text-[11px] break-all">{hold?.original?.challanItemId}</span></Info>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Release type">
            {([
              ['AVAILABLE', 'Release to Available Stock', `Back to ${h.departmentName}'s available quantity for its normal work.`],
              ['FORWARD', 'Release and Forward', h.forwardTo ? `Released and sent to ${h.forwardTo.name} on a new challan, linked to this HOLD and the original challan.` : hold?.forwardBlockedReason || 'Checking…'],
            ] as const).map(([value, label, text]) => {
              const disabled = value === 'FORWARD' && !h.forwardTo;
              return (
                <label key={value} className={`flex gap-3 rounded-xl border p-3 ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${mode === value ? 'border-brand-500 bg-brand-50' : 'border-neutral-200 bg-white'}`}>
                  <input type="radio" name="release-mode" value={value} checked={mode === value} disabled={disabled} onChange={() => setMode(value)} className="mt-0.5" />
                  <span>
                    <span className="block text-sm font-semibold text-neutral-900">{label}</span>
                    <span className="block text-xs text-neutral-600">{text}</span>
                  </span>
                </label>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-semibold text-neutral-600">{forward ? 'Quantity to release and forward *' : 'Release quantity *'}</span>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  min="0"
                  max={h.remainingQuantity}
                  step={h.unit === 'PCS' ? '1' : 'any'}
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className={`${FIELD} text-right tabular-nums`}
                />
                <span className="text-sm font-semibold text-neutral-700 w-10">{h.unit}</span>
              </div>
              <span className="block mt-1 text-[11px] text-neutral-500">
                Up to {fmtQty(h.remainingQuantity, h.unit)}.{left !== null ? ` ${fmtQty(left, h.unit)} stays on HOLD.` : ''}
              </span>
            </label>
            {forward && h.forwardTo && (
              <label className="block">
                <span className="text-xs font-semibold text-neutral-600">Destination department *</span>
                <select value={h.forwardTo.code} disabled className={`${FIELD} mt-1`} aria-label="Destination department">
                  <option value={h.forwardTo.code}>{h.forwardTo.name}</option>
                </select>
                <span className="block mt-1 text-[11px] text-neutral-500">The next step of {h.departmentName} in the existing workflow.</span>
              </label>
            )}
          </div>

          {forward && h.forwardTo && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="block">
                <span className="text-xs font-semibold text-neutral-600">New Challan Number *</span>
                <input value={challanNumber} onChange={(e) => setChallanNumber(e.target.value)} required maxLength={64} className={`${FIELD} mt-1 font-mono`} />
                <span className="block mt-1 text-[11px] text-neutral-500">The same numbering as {h.departmentName}&apos;s challans; a number already used is refused.</span>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-neutral-600">Challan Date *</span>
                <input type="date" value={issuedDate} onChange={(e) => setIssuedDate(e.target.value)} required className={`${FIELD} mt-1`} />
              </label>
              {h.departmentCode === 'DYEING' && (
                <label className="block">
                  <span className="text-xs font-semibold text-neutral-600">Actual dyed colour</span>
                  <input value={dyedColour} onChange={(e) => setDyedColour(e.target.value)} maxLength={100} className={`${FIELD} mt-1`} />
                  <span className="block mt-1 text-[11px] text-neutral-500">Used only when no dyed colour is recorded on the line yet.</span>
                </label>
              )}
            </div>
          )}
          {forward && h.forwardTo && (
            <p className="text-[11px] text-neutral-600 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2">
              The released quantity is recorded as processed in {h.departmentName} and leaves on the new challan in {h.unit} only. The challan carries the
              original Design No., Serial No., Production Sheet, fabric and colour, and appears in {h.forwardTo.name}&apos;s Incoming Challans, marked as a HOLD release of {h.challanNumber || 'the original challan'}.
            </p>
          )}

          <label className="block">
            <span className="text-xs font-semibold text-neutral-600">Remarks</span>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={1000} rows={2} className={`${FIELD} mt-1 h-auto py-2`} />
          </label>
        </div>
        <div className="px-5 py-4 border-t border-neutral-200 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={BTN_QUIET}>
            Cancel
          </button>
          <button type="submit" disabled={saving || !hold} className={BTN_PRIMARY}>
            {saving ? 'Saving…' : forward ? 'Release and Issue Challan' : 'Release'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function HoldDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const [hold, setHold] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson(`/api/holds/${id}`)
      .then((body) => setHold(body.data))
      .catch((e) => setError(e.message));
  }, [id]);

  return (
    <Modal title={hold ? `HOLD ${hold.holdNumber}` : 'HOLD details'} subtitle={hold ? `${hold.departmentName} · ${hold.statusLabel}` : undefined} onClose={onClose} wide>
      <div className="p-5 space-y-5">
        {error && <Notice kind="error">{error}</Notice>}
        {!hold && !error && <p className="text-sm text-neutral-500">Loading…</p>}
        {hold && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Info label="Design No.">{hold.designNumber}</Info>
              <Info label="Serial No.">{hold.serialNumber}</Info>
              <Info label="Production Sheet">{hold.productionSheetNumber}</Info>
              <Info label="Challan No.">{hold.challanNumber}</Info>
              <Info label="Challan Date">{hold.challanDate ? fmtDate(hold.challanDate) : null}</Info>
              <Info label="Sending Department">{hold.sendingDepartmentName}</Info>
              <Info label="Held In">{hold.departmentName}</Info>
              <Info label="Fabric">{hold.fabricName}</Info>
              <Info label="Colour">{hold.colour}</Info>
              <Info label="Required Colour">{hold.requiredColour}</Info>
              <Info label="Production Type">{hold.productionType}</Info>
              <Info label="Size / Measurement">{hold.size}</Info>
              <Info label="Unit">{hold.unit}</Info>
              <Info label="Total Received">{fmtQty(hold.receivedQuantity, hold.unit)}</Info>
              <Info label="Processed at HOLD">{hold.processedAtHold != null ? fmtQty(hold.processedAtHold, hold.unit) : null}</Info>
              <Info label="Already Forwarded">{fmtQty(hold.forwardedQuantity, hold.unit)}</Info>
              <Info label="Forwarded at HOLD">{fmtQty(hold.forwardedAtHold, hold.unit)}</Info>
              <Info label="Placed on HOLD">{fmtQty(hold.holdQuantity, hold.unit)}</Info>
              <Info label="Released">{fmtQty(hold.releasedQuantity, hold.unit)}</Info>
              <Info label="Forwarded since HOLD">{fmtQty(hold.forwardedSinceHold, hold.unit)}</Info>
              <Info label="Remaining HOLD">{fmtQty(hold.remainingQuantity, hold.unit)}</Info>
              <Info label="Status"><HoldStatusBadge hold={hold} /></Info>
              <Info label="Hold Reason">{hold.reasonText}</Info>
              <Info label="Held By">{hold.heldByName}</Info>
              <Info label="Hold Date & Time">{fmtDate(hold.heldAt, true)}</Info>
              <Info label="Closed">{hold.closedAt ? fmtDate(hold.closedAt, true) : '—'}</Info>
            </div>
            {hold.remarks && (
              <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-sm text-neutral-700">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Additional remarks</span>
                {hold.remarks}
              </div>
            )}
            <div>
              <h4 className="text-xs font-bold text-neutral-900 mb-2">Movement</h4>
              <ol className="relative border-l-2 border-brand-200 ml-2 space-y-3">
                {hold.movement.map((m: any, i: number) => (
                  <li key={i} className="relative pl-4">
                    <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-brand-600" aria-hidden />
                    <span className="block text-xs font-bold text-neutral-900">{m.step}</span>
                    <span className="block text-xs text-neutral-700">{m.detail}</span>
                    <span className="block text-[11px] text-neutral-500">{m.at ? fmtDate(m.at, true) : '—'}</span>
                  </li>
                ))}
              </ol>
            </div>
            {hold.releases.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-neutral-900 mb-2">Releases</h4>
                <div className="overflow-x-auto border border-neutral-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className={THEAD}>
                      <tr>
                        <th className="py-2 px-3">Date & Time</th>
                        <th className="py-2 px-3 text-right">Quantity</th>
                        <th className="py-2 px-3">New Challan</th>
                        <th className="py-2 px-3">Destination</th>
                        <th className="py-2 px-3">Received</th>
                        <th className="py-2 px-3 text-right">Left on HOLD</th>
                        <th className="py-2 px-3">By</th>
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {hold.releases.map((r: any) => (
                        <tr key={r.id}>
                          <td className="py-2 px-3 whitespace-nowrap">{fmtDate(r.createdAt, true)}</td>
                          <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap font-semibold">{fmtQty(r.quantity, r.unit)}</td>
                          <td className="py-2 px-3 font-mono">
                            {r.newChallanId ? <Link href={`/challans/${r.newChallanId}`} className="text-brand-700 hover:underline">{r.newChallanNumber}</Link> : r.newChallanNumber || '—'}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">{r.mode === 'FORWARD' ? r.destinationName : 'Available in department'}</td>
                          <td className="py-2 px-3 whitespace-nowrap">{r.receivedAt ? `${fmtDate(r.receivedAt, true)}${r.receivedByName ? ` · ${r.receivedByName}` : ''}` : '—'}</td>
                          <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(r.remainingAfter, r.unit)}</td>
                          <td className="py-2 px-3 whitespace-nowrap">{r.releasedByName}</td>
                          <td className="py-2 px-3"><ReleaseStatusBadge release={r} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div>
              <h4 className="text-xs font-bold text-neutral-900 mb-2">History</h4>
              <div className="overflow-x-auto border border-neutral-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className={THEAD}>
                    <tr>
                      <th className="py-2 px-3">Date & Time</th>
                      <th className="py-2 px-3">Action</th>
                      <th className="py-2 px-3 text-right">Quantity</th>
                      <th className="py-2 px-3 text-right">Left on HOLD</th>
                      <th className="py-2 px-3">By</th>
                      <th className="py-2 px-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {hold.history.map((e: any) => (
                      <tr key={e.id}>
                        <td className="py-2 px-3 whitespace-nowrap">{fmtDate(e.createdAt, true)}</td>
                        <td className="py-2 px-3 font-semibold">{(HOLD_EVENT_LABEL as Record<string, string>)[e.action] || e.action}</td>
                        <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap">{e.quantity ? fmtQty(e.quantity, e.unit) : '—'}</td>
                        <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap">{e.remainingAfter === null ? '—' : fmtQty(e.remainingAfter, hold.unit)}</td>
                        <td className="py-2 px-3 whitespace-nowrap">{e.actorName}</td>
                        <td className="py-2 px-3 text-neutral-600">{e.remarks || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
