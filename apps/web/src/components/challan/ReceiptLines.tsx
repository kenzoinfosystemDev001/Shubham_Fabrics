'use client';

import React from 'react';
import { averageText, lineQuantitiesByUnit, secondUnitOf, unitOf } from '@/lib/challan-units.mjs';
import { userChallanRemarks } from '@/lib/challan-remarks.mjs';
import { FIELD, THEAD, fmtQty } from '@/components/workflow/WorkflowUi';
import { departmentName } from '@/lib/workflow-views';

// Item-wise receiving table shared by every department's incoming challans: each fabric / colour with what it
// carries in MTR and in PCS (never added together), the sender's Average and Remarks, and separate totals.

type Unit = 'MTR' | 'PCS';
const UNITS: Unit[] = ['MTR', 'PCS'];

/** One challan line on a receiving screen. `line` is the ChallanItem; the rest override its texts. */
export interface ReceiptRow {
  key: string;
  line: any;
  fabricName?: string | null;
  colour?: string | null;
  /** Already recorded receipt (after Receive), per unit; absent while awaiting receipt. */
  received?: Partial<Record<Unit, number | null>> | null;
}

/** Entered received quantities per row and unit ('' = not entered). */
export type ReceiptValues = Record<string, Partial<Record<Unit, string>>>;

const cell = (q: number | null | undefined, unit: Unit) => (q === null || q === undefined ? '—' : fmtQty(q, unit));

/** The line's main unit (its quantity moves stock) and its second unit, if it carries one. */
export function receiptUnits(line: any): { main: Unit | null; second: Unit | null } {
  const main = unitOf(line?.uom);
  return { main: main === 'MTR' || main === 'PCS' ? main : null, second: secondUnitOf(line) as Unit | null };
}

/** Starting values for a receive form: what was sent in each unit, or blank when the receiver must count. */
export function initialReceiptValues(rows: ReceiptRow[], blank = false): ReceiptValues {
  return Object.fromEntries(
    rows.map((r) => {
      const sent = lineQuantitiesByUnit(r.line);
      return [r.key, Object.fromEntries(UNITS.filter((u) => sent[u] !== null).map((u) => [u, blank ? '' : String(sent[u])]))];
    }),
  );
}

function Totals({ label, totals }: { label: string; totals: Record<Unit, number> }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{label}</span>
      {UNITS.map((u) => (
        <span key={u} className="inline-flex items-baseline gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-50 border border-neutral-200">
          <span className="text-[11px] font-semibold text-neutral-500">Total {u}</span>
          <span className="text-sm font-bold tabular-nums text-neutral-900">{fmtQty(totals[u], u)}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * The receiving table. With `values` / `onChange` it takes the received quantity of every unit a line carries
 * (main unit required, second unit optional); otherwise it shows what was sent, and what was received if known.
 */
export function ReceiptLinesTable({
  challan,
  rows,
  values,
  onChange,
  extraHeader,
  extraCell,
}: {
  challan: any;
  rows: ReceiptRow[];
  values?: ReceiptValues;
  onChange?: (key: string, unit: Unit, value: string) => void;
  /** Extra trailing column (e.g. receipt remarks input). */
  extraHeader?: React.ReactNode;
  extraCell?: (row: ReceiptRow) => React.ReactNode;
}) {
  const editing = Boolean(values && onChange);
  const showReceived = editing || rows.some((r) => r.received);
  const sentTotals: Record<Unit, number> = { MTR: 0, PCS: 0 };
  const receivedTotals: Record<Unit, number> = { MTR: 0, PCS: 0 };
  for (const r of rows) {
    const sent = lineQuantitiesByUnit(r.line);
    for (const u of UNITS) {
      sentTotals[u] += sent[u] || 0;
      const got = editing ? Number(values?.[r.key]?.[u]) : r.received?.[u];
      receivedTotals[u] += Number.isFinite(Number(got)) ? Number(got) || 0 : 0;
    }
  }
  const p = challan?.program;
  // The production sheet's design number only: designName holds the embroidery (Wilcom) design, not this.
  const design = p?.designNumber || '—';
  const serial = p?.programSerialNo || p?.programNumber || '—';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Totals label="Sent" totals={sentTotals} />
        {showReceived && <Totals label="Received" totals={receivedTotals} />}
      </div>
      <div className="overflow-x-auto border border-neutral-200 rounded-xl">
        <table className="w-full text-left text-xs">
          <thead className={THEAD}>
            <tr>
              <th className="py-2.5 px-3">Design No.</th>
              <th className="py-2.5 px-3">Serial No.</th>
              <th className="py-2.5 px-3">Challan No.</th>
              <th className="py-2.5 px-3">Fabric</th>
              <th className="py-2.5 px-3">Colour</th>
              <th className="py-2.5 px-3">Shade</th>
              <th className="py-2.5 px-3 text-right">Qty (MTR)</th>
              <th className="py-2.5 px-3 text-right">Qty (PCS)</th>
              <th className="py-2.5 px-3">Average</th>
              <th className="py-2.5 px-3">Remarks</th>
              <th className="py-2.5 px-3">From</th>
              {showReceived && <th className="py-2.5 px-3 w-32">Received MTR</th>}
              {showReceived && <th className="py-2.5 px-3 w-32">Received PCS</th>}
              {extraHeader && <th className="py-2.5 px-3">{extraHeader}</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((r) => {
              const sent = lineQuantitiesByUnit(r.line);
              const { main } = receiptUnits(r.line);
              return (
                <tr key={r.key} className="align-top">
                  <td className="py-2.5 px-3 font-semibold text-neutral-900">{design}</td>
                  <td className="py-2.5 px-3 font-mono">{serial}</td>
                  <td className="py-2.5 px-3 font-mono">{challan?.challanNumber || '—'}</td>
                  <td className="py-2.5 px-3 font-semibold text-neutral-900">{r.fabricName || r.line?.fabricCode || r.line?.itemDescription || '—'}</td>
                  <td className="py-2.5 px-3">{r.colour || r.line?.colour || '—'}</td>
                  <td className="py-2.5 px-3">{r.line?.shade || '—'}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{cell(sent.MTR, 'MTR')}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{cell(sent.PCS, 'PCS')}</td>
                  <td className="py-2.5 px-3 whitespace-nowrap">{averageText(r.line)}</td>
                  <td className="py-2.5 px-3 max-w-[220px] text-neutral-600">{userChallanRemarks(r.line?.remarks) || '—'}</td>
                  <td className="py-2.5 px-3 whitespace-nowrap">{departmentName(challan?.fromDepartment)}</td>
                  {showReceived &&
                    UNITS.map((u) => (
                      <td key={u} className="py-2.5 px-3">
                        {sent[u] === null ? (
                          <span className="text-neutral-400">—</span>
                        ) : editing ? (
                          <input
                            type="number"
                            min="0"
                            step={u === 'PCS' ? '1' : 'any'}
                            required={u === main}
                            value={values?.[r.key]?.[u] ?? ''}
                            onChange={(e) => onChange?.(r.key, u, e.target.value)}
                            className={`${FIELD} text-right tabular-nums`}
                            aria-label={`Received ${u} for ${r.fabricName || r.line?.itemDescription || 'line'}`}
                          />
                        ) : (
                          <span className="block text-right tabular-nums">{cell(r.received?.[u], u)}</span>
                        )}
                      </td>
                    ))}
                  {extraCell && <td className="py-2.5 px-3">{extraCell(r)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** What a received record holds per unit: its received quantity in its own unit and its second quantity. */
export function receivedByUnit(record: { status?: string; receivedQuantity?: number | null; uom?: string; receivedUnitQuantity?: number | null; receivedUnitQuantityUom?: string | null }) {
  if (!record || record.status === 'AWAITING_RECEIPT') return null;
  const out: Partial<Record<Unit, number | null>> = {};
  const main = unitOf(record.uom);
  if (main === 'MTR' || main === 'PCS') out[main] = record.receivedQuantity ?? null;
  const second = unitOf(record.receivedUnitQuantityUom);
  if ((second === 'MTR' || second === 'PCS') && second !== main) out[second] = record.receivedUnitQuantity ?? null;
  return out;
}

/**
 * Confirmation before a whole challan is received in one step (Dyeing QC, Fabric Store): every fabric and colour
 * with its MTR and PCS, and the separate totals, shown before Receive Challan is enabled.
 */
export function ReceiveChallanConfirm({
  challan,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  challan: any;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const rows: ReceiptRow[] = (challan?.items || []).map((line: any) => ({ key: line.id, line }));
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-neutral-900/50 p-3 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 w-full max-w-6xl">
        <div className="px-5 py-4 border-b border-neutral-200">
          <h3 className="text-sm font-bold text-neutral-900">Receive Challan {challan?.challanNumber}</h3>
          <p className="text-xs text-neutral-500">from {departmentName(challan?.fromDepartment)} · check every fabric and colour before receiving</p>
        </div>
        <div className="p-5 space-y-3">
          {error && <div className="px-4 py-3 border rounded-xl text-sm bg-danger-50 border-danger-200 text-danger-800" role="alert">{error}</div>}
          {rows.length === 0 ? (
            <p className="text-sm text-neutral-500">This challan has no item lines.</p>
          ) : (
            <ReceiptLinesTable challan={challan} rows={rows} />
          )}
        </div>
        <div className="px-5 py-4 border-t border-neutral-200 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-200 text-xs font-semibold rounded-lg transition cursor-pointer">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            {busy ? 'Receiving…' : 'Receive Challan'}
          </button>
        </div>
      </div>
    </div>
  );
}
