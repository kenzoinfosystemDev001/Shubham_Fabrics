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
import { HOLD_EVENT_LABEL, HOLD_REASONS } from '@/lib/holds.mjs';
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
  const [rows, setRows] = useState<any[]>([]);
  const [receivedLabel, setReceivedLabel] = useState('Total Received');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [releasing, setReleasing] = useState<any>(null);
  const [viewing, setViewing] = useState<string | null>(null);

  useEffect(() => setAdmin(isAdminUser(getCurrentUser())), []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ department, view });
      if (search.trim()) q.set('search', search.trim());
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
  }, [department, view]);

  const open = rows.filter((r) => r.active);
  const onHold = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const r of open) totals[r.unit] = (totals[r.unit] || 0) + (Number(r.remainingQuantity) || 0);
    return totals;
  }, [open]);
  const allDepartments = department === 'ALL';
  const columns = 21;

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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-neutral-200 rounded-2xl p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Open HOLD records</span>
            <span className="block text-2xl font-bold text-neutral-900 tabular-nums">{open.length}</span>
          </div>
          <div className="bg-white border border-neutral-200 rounded-2xl p-4 sm:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Remaining on HOLD (MTR and PCS kept apart)</span>
            <span className="block text-2xl font-bold text-neutral-900 tabular-nums">{formatTotals(onHold, '0')}</span>
          </div>
        </div>

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
                  placeholder="Design, serial, challan, fabric…"
                  className={`${FIELD} pl-9 w-64`}
                  aria-label="Search HOLD records"
                />
              </form>
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
                  <th className="py-2.5 px-3">Fabric</th>
                  <th className="py-2.5 px-3">Colour</th>
                  <th className="py-2.5 px-3">Size / Measurement</th>
                  <th className="py-2.5 px-3 text-right">{receivedLabel}</th>
                  <th className="py-2.5 px-3 text-right">Already Forwarded</th>
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
                    <td className="py-2.5 px-3 text-neutral-900">{h.fabricName}</td>
                    <td className="py-2.5 px-3">{h.colour || '—'}</td>
                    <td className="py-2.5 px-3">{h.size || '—'}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(h.receivedQuantity, h.unit)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(h.forwardedQuantity, h.unit)}</td>
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
          Forwarding held quantity on the department&apos;s normal challan screen lowers the HOLD automatically; the HOLD closes once nothing of it is left.
        </p>
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
        body: JSON.stringify({ department, lineKey: line.key, quantity, unit: line.unit, reason, reasonOther, remarks }),
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
            <span className="text-xs font-semibold text-neutral-600">1. Select the line (only quantity not yet forwarded can be held)</span>
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
              <Info label="Fabric">{line.fabricName}</Info>
              <Info label="Colour">{line.colour}</Info>
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

function ReleaseDialog({ hold, onClose, onDone }: { hold: any; onClose: () => void; onDone: (message: string) => void }) {
  const [quantity, setQuantity] = useState(String(hold.remainingQuantity));
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = await fetchJson(`/api/holds/${hold.id}/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity, remarks }),
      });
      onDone(body.message);
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <Modal title="Release HOLD" subtitle={`${hold.holdNumber} · ${hold.designNumber} · ${hold.serialNumber}`} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="p-5 space-y-4">
          {error && <Notice kind="error">{error}</Notice>}
          <div className="grid grid-cols-2 gap-3 bg-neutral-50 border border-neutral-200 rounded-xl p-4">
            <Info label="Fabric">{hold.fabricName}</Info>
            <Info label="Colour">{hold.colour}</Info>
            <Info label="Hold Reason">{hold.reasonText}</Info>
            <Info label="Remaining on HOLD">{fmtQty(hold.remainingQuantity, hold.unit)}</Info>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-neutral-600">Release quantity *</span>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number"
                min="0"
                max={hold.remainingQuantity}
                step={hold.unit === 'PCS' ? '1' : 'any'}
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={`${FIELD} text-right tabular-nums`}
              />
              <span className="text-sm font-semibold text-neutral-700 w-10">{hold.unit}</span>
            </div>
            <span className="block mt-1 text-[11px] text-neutral-500">Released quantity returns to the department&apos;s normal work; the original reason and history are kept.</span>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-neutral-600">Remarks</span>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={1000} rows={3} className={`${FIELD} mt-1 h-auto py-2`} />
          </label>
        </div>
        <div className="px-5 py-4 border-t border-neutral-200 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={BTN_QUIET}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={BTN_PRIMARY}>
            {saving ? 'Saving…' : 'Release'}
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
              <Info label="Fabric">{hold.fabricName}</Info>
              <Info label="Colour">{hold.colour}</Info>
              <Info label="Size / Measurement">{hold.size}</Info>
              <Info label="Unit">{hold.unit}</Info>
              <Info label="Total Received">{fmtQty(hold.receivedQuantity, hold.unit)}</Info>
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
