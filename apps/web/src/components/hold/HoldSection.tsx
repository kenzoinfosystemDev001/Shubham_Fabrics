'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { PauseCircle } from 'lucide-react';
import { BTN_PRIMARY, FIELD, Notice, fetchJson, fmtDate, fmtQty } from '@/components/workflow/WorkflowUi';
import { HOLD_REASONS } from '@/lib/holds.mjs';

// Hold Quantity section of a department's processing form (Dyeing to Inventory). It sits inside the form but
// saves on its own (POST /api/holds); the form's Save never sends HOLD fields. The server validates the
// quantity against what the line still has, in the line's own unit, and allows one open HOLD per line.

const UNITS = ['MTR', 'PCS'] as const;

/** Keeps Enter in a HOLD field from submitting the surrounding processing form. */
const noSubmit = (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') e.preventDefault();
};

export function HoldSection({ department, sourceId, holdPage }: { department: string; sourceId: string; holdPage: string }) {
  const [rows, setRows] = useState<Array<{ line: any; hold: any }>>([]);
  const [loading, setLoading] = useState(true);
  const [unit, setUnit] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [reasonOther, setReasonOther] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const body = await fetchJson(`/api/holds/source?department=${encodeURIComponent(department)}&sourceId=${encodeURIComponent(sourceId)}`);
      const data = body.data || [];
      setRows(data);
      setUnit((u) => (data.some((r: any) => r.line.unit === u) ? u : data.find((r: any) => !r.hold)?.line.unit || data[0]?.line.unit || ''));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department, sourceId]);

  const row = rows.find((r) => r.line.unit === unit) || null;
  const line = row?.line;
  const openHolds = rows.filter((r) => r.hold);

  const save = async () => {
    setError(null);
    setMessage(null);
    if (!line) return setError('Select the unit (MTR or PCS).');
    if (!(Number(quantity) > 0)) return setError('Enter a HOLD quantity greater than zero.');
    if (!reason) return setError('Select the Hold Reason.');
    if (reason === 'OTHER' && !reasonOther.trim()) return setError('Enter the reason for Other.');
    setSaving(true);
    try {
      const body = await fetchJson('/api/holds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department, lineKey: line.key, quantity, unit, reason, reasonOther, remarks }),
      });
      setMessage(body.message);
      setQuantity('');
      setReason('');
      setReasonOther('');
      setRemarks('');
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <fieldset className="rounded-xl border border-neutral-200 p-3 space-y-3" onKeyDown={noSubmit}>
      <legend className="px-1 text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
        <PauseCircle className="w-3.5 h-3.5" />
        Hold Quantity
      </legend>
      {error && <Notice kind="error" onClose={() => setError(null)}>{error}</Notice>}
      {message && <Notice kind="success" onClose={() => setMessage(null)}>{message}</Notice>}
      {loading && rows.length === 0 && <p className="text-xs text-neutral-500">Loading…</p>}

      {openHolds.map(({ hold }) => (
        <div key={hold.id} className="rounded-lg bg-accent-100/60 border border-neutral-200 px-3 py-2 text-xs text-neutral-800 flex flex-wrap items-center justify-between gap-2">
          <span>
            <span className="font-mono font-semibold">{hold.holdNumber}</span> · <span className="font-semibold tabular-nums">{fmtQty(hold.remainingQuantity, hold.unit)}</span> on HOLD ·{' '}
            {hold.reasonText} · {hold.statusLabel} · {fmtDate(hold.heldAt, true)}
          </span>
          <Link href={holdPage} className="font-semibold text-brand-800 hover:underline">
            Release / view on HOLD page
          </Link>
        </div>
      ))}

      {!loading && rows.length === 0 && <p className="text-xs text-neutral-500">This line cannot be placed on HOLD yet (nothing received).</p>}

      {line && !row?.hold && (
        line.outstanding > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="block">
                <span className="text-xs font-semibold text-neutral-600">Hold quantity *</span>
                <input
                  type="number"
                  min="0"
                  max={line.outstanding}
                  step={unit === 'PCS' ? '1' : 'any'}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className={`${FIELD} mt-1 text-right tabular-nums`}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-neutral-600">Unit *</span>
                <select value={unit} onChange={(e) => setUnit(e.target.value)} className={`${FIELD} mt-1`}>
                  {UNITS.map((u) => {
                    const r = rows.find((x) => x.line.unit === u);
                    return (
                      <option key={u} value={u} disabled={!r}>
                        {u}{r ? '' : ' (not on this line)'}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-neutral-600">Hold reason *</span>
                <select value={reason} onChange={(e) => setReason(e.target.value)} className={`${FIELD} mt-1`}>
                  <option value="">Select reason…</option>
                  {HOLD_REASONS.map((r) => (
                    <option key={r.code} value={r.code}>{r.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-[11px] text-neutral-500">
              Up to {fmtQty(line.outstanding, line.unit)} (received {fmtQty(line.received, line.unit)}, forwarded {fmtQty(line.forwarded, line.unit)}
              {line.writtenOff > 0 ? `, written off ${fmtQty(line.writtenOff, line.unit)}` : ''}). Challan {line.challanNumber || '—'}.
            </p>
            {reason === 'OTHER' && (
              <label className="block">
                <span className="text-xs font-semibold text-neutral-600">Other reason *</span>
                <input value={reasonOther} onChange={(e) => setReasonOther(e.target.value)} maxLength={200} className={`${FIELD} mt-1`} />
              </label>
            )}
            <label className="block">
              <span className="text-xs font-semibold text-neutral-600">Hold remarks</span>
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={1000} rows={2} className={`${FIELD} h-auto py-2 mt-1`} />
            </label>
            <div className="flex justify-end">
              <button type="button" onClick={save} disabled={saving} className={BTN_PRIMARY}>
                {saving ? 'Saving…' : 'Save HOLD'}
              </button>
            </div>
          </>
        ) : (
          <p className="text-xs text-neutral-500">Nothing of this line is left in the department to hold.</p>
        )
      )}
    </fieldset>
  );
}
