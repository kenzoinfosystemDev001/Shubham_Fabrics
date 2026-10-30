'use client';

import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { EmptyRow, FIELD, Panel, THEAD, fmtDate, sheetRef } from '@/components/workflow/WorkflowUi';
import { NO_INCOMING_CHALLAN, sheetLabel } from '@/lib/challan-sheets.mjs';
import { formatTotals } from '@/lib/challan-units.mjs';

export interface IncomingOption {
  id: string;
  challan: any;
  sheets: any[];
  lines: any[];
  available: Record<string, number>;
}

const DEPT_NAME: Record<string, string> = {
  STORE: 'Fabric Store',
  DYEING: 'Dyeing',
  QC1: 'Dyeing QC',
  QC2: 'Threadcut QC',
  QC3: 'Washing QC',
  THREAD_CUTTING: 'Thread Cutting',
  STEAM_PRESS: 'Steam Press',
  FINAL_CHECK: 'Final QC',
};
const deptName = (code?: string | null) => (code ? DEPT_NAME[code] || code.charAt(0) + code.slice(1).toLowerCase().replace(/_/g, ' ') : '—');

/**
 * Step 1 of issuing a challan: the user selects the incoming challan(s) the material is issued from.
 * Only challans with something still available are offered; nothing is selected automatically.
 */
export function IncomingChallanPicker({
  options,
  selected,
  onChange,
  loading,
  availableLabel = 'Available',
}: {
  options: IncomingOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  loading?: boolean;
  availableLabel?: string;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      !q
        ? options
        : options.filter((o) =>
            [
              o.challan?.challanNumber,
              deptName(o.challan?.fromDepartment),
              ...o.sheets.flatMap((s) => [s.programSerialNo, s.programNumber, s.designNumber, s.wilcomDesignNumber]),
              ...o.lines.flatMap((l) => [l.fabricName, l.colour, l.dyedColor, l.targetColor, l.itemNumber, l.orderNumber]),
            ].some((v) => String(v || '').toLowerCase().includes(q)),
          ),
    [options, q],
  );
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <Panel
      title="1. Select incoming challan"
      count={options.length}
      actions={
        <label className="relative block w-56 sm:w-72">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Challan, sheet, design, fabric, colour"
            aria-label="Search incoming challans"
            className={`${FIELD} pl-9`}
          />
        </label>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className={THEAD}>
            <tr>
              <th className="py-3 px-4 w-10"><span className="sr-only">Select</span></th>
              <th className="py-3 px-3">Incoming Challan</th>
              <th className="py-3 px-3">Date</th>
              <th className="py-3 px-3">From</th>
              <th className="py-3 px-3">Production Sheets</th>
              <th className="py-3 px-3 text-right">Lines</th>
              <th className="py-3 px-3 text-right">{availableLabel}</th>
              <th className="py-3 px-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {shown.length === 0 && (
              <EmptyRow colSpan={8} text={loading ? 'Loading…' : q ? 'No incoming challan matches the search' : 'No incoming challan has anything left to issue'} />
            )}
            {shown.map((o) => {
              const checked = selected.includes(o.id);
              const legacy = o.id === NO_INCOMING_CHALLAN;
              return (
                <tr key={o.id} onClick={() => toggle(o.id)} className={`cursor-pointer ${checked ? 'bg-brand-50/70' : 'hover:bg-neutral-50/60'}`}>
                  <td className="py-2.5 px-4">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(o.id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select incoming challan ${legacy ? 'without a recorded number' : o.challan?.challanNumber}`}
                      className="w-4 h-4 accent-brand-600 cursor-pointer"
                    />
                  </td>
                  <td className="py-2.5 px-3 font-mono text-xs font-bold text-brand-800">
                    {legacy ? <span className="font-sans font-semibold text-neutral-500">Not recorded (older lines)</span> : o.challan?.challanNumber || '—'}
                  </td>
                  <td className="py-2.5 px-3 text-xs text-neutral-600 whitespace-nowrap">{fmtDate(o.challan?.issuedDate || o.challan?.createdAt)}</td>
                  <td className="py-2.5 px-3 text-xs text-neutral-700">{deptName(o.challan?.fromDepartment)}</td>
                  <td className="py-2.5 px-3 font-mono text-xs">
                    {o.sheets.map((s) => sheetRef(s)).join(', ') || '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-xs">{o.lines.length}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap font-semibold">{formatTotals(o.available, '—')}</td>
                  <td className="py-2.5 px-3 text-xs">{String(o.challan?.status || '—').replace(/_/g, ' ')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/**
 * Lines grouped by Production Sheet with per-unit totals per sheet and overall. Meters and pieces are
 * never added together.
 */
export function SheetBreakdown({
  title = 'Production Sheet breakdown',
  rows,
}: {
  title?: string;
  rows: Array<{ key: string; program: any; fabric: string; colour?: string | null; quantity: number; uom: string; source?: string | null }>;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, { program: any; rows: typeof rows; totals: Record<string, number> }>();
    for (const r of rows) {
      const id = r.program?.id || 'none';
      if (!map.has(id)) map.set(id, { program: r.program, rows: [], totals: {} });
      const g = map.get(id)!;
      g.rows.push(r);
      g.totals[r.uom] = Math.round(((g.totals[r.uom] || 0) + r.quantity) * 1000) / 1000;
    }
    return Array.from(map.values());
  }, [rows]);
  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const g of groups) for (const [u, q] of Object.entries(g.totals)) t[u] = Math.round(((t[u] || 0) + q) * 1000) / 1000;
    return t;
  }, [groups]);
  if (rows.length === 0) return null;

  return (
    <Panel title={title} count={groups.length}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className={THEAD}>
            <tr>
              <th className="py-3 px-4">Production Sheet</th>
              <th className="py-3 px-3">Fabric</th>
              <th className="py-3 px-3">Colour</th>
              <th className="py-3 px-3">Source Challan</th>
              <th className="py-3 px-3 text-right">Quantity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {groups.map((g) => (
              <React.Fragment key={g.program?.id || 'none'}>
                {g.rows.map((r, i) => (
                  <tr key={r.key}>
                    <td className="py-2 px-4 font-mono text-xs font-semibold text-neutral-900">{i === 0 ? sheetLabel(g.program) : ''}</td>
                    <td className="py-2 px-3 text-neutral-900">{r.fabric}</td>
                    <td className="py-2 px-3 text-neutral-700">{r.colour || '—'}</td>
                    <td className="py-2 px-3 font-mono text-xs text-neutral-600">{r.source || '—'}</td>
                    <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap">{formatTotals({ [r.uom]: r.quantity }, `0 ${r.uom}`)}</td>
                  </tr>
                ))}
                <tr className="bg-neutral-50/70">
                  <td colSpan={4} className="py-2 px-4 text-xs font-semibold text-neutral-600">Sheet {sheetLabel(g.program)} total</td>
                  <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap text-xs font-semibold">{formatTotals(g.totals)}</td>
                </tr>
              </React.Fragment>
            ))}
            <tr className="bg-brand-50/60">
              <td colSpan={4} className="py-2.5 px-4 text-xs font-bold text-brand-900">Challan total</td>
              <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap font-bold text-brand-900">{formatTotals(totals)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
