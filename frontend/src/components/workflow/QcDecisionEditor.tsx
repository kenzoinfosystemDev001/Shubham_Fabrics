'use client';

import React, { useEffect, useState } from 'react';
import { BTN_PRIMARY, BTN_QUIET, FIELD, Notice, fetchJson, fmtDate, fmtQty } from '@/components/workflow/WorkflowUi';
import { HOLD_REASONS } from '@/lib/holds.mjs';
import type { WorkflowView } from '@/lib/workflow-views';

// Change a QC decision (POST <api>/items/:id/decision): the recorded option is shown ticked; untick it, tick the
// correct one (REJECT, REWORK or HOLD), enter how much of the quantity changes and why, confirm, and the server moves
// that quantity from the old decision to the new one. Ticking the same option again only updates reason and remarks.

type Decision = 'REJECT' | 'REWORK' | 'HOLD';
const OPTIONS: Decision[] = ['REJECT', 'REWORK', 'HOLD'];
const NOUN: Record<Decision, string> = { REJECT: 'rejected', REWORK: 'rework', HOLD: 'hold' };

export function QcDecisionEditor({
  flow,
  item,
  from,
  batch,
  max,
  onCancel,
  onSaved,
}: {
  flow: WorkflowView;
  item: any;
  /** The decision being changed. */
  from: Decision;
  /** The inspection batch it was recorded on (REJECT / REWORK); none for HOLD. */
  batch?: any;
  /** Most that can change: the batch's quantity of `from` not yet sent, or what is on HOLD. */
  max: number;
  onCancel: () => void;
  onSaved: (item: any, message: string) => void;
}) {
  const [selected, setSelected] = useState<Decision[]>([from]);
  const [quantity, setQuantity] = useState(String(max));
  const [reason, setReason] = useState('');
  const [holdReason, setHoldReason] = useState('');
  const [holdReasonOther, setHoldReasonOther] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [remarks, setRemarks] = useState(batch?.remarks || '');
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const to = selected.length === 1 ? selected[0] : null;
  const same = to === from;
  const reasonOf = (d: Decision) => (d === 'REJECT' ? batch?.rejectReason : d === 'REWORK' ? batch?.reworkReason : null) || '';
  useEffect(() => {
    if (to && to !== 'HOLD') setReason(reasonOf(to));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to]);

  const toggle = (d: Decision) => setSelected((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]));

  const check = (): string | null => {
    if (!to) return selected.length === 0 ? 'Select the correct decision.' : 'Select only one decision for this quantity.';
    if (same && from === 'HOLD') return 'Select a different decision for the held quantity.';
    const q = Number(quantity);
    if (!same && (!Number.isFinite(q) || q <= 0)) return 'Enter the quantity whose decision changes.';
    if (!same && q > max) return `At most ${fmtQty(max, item.uom)} can change.`;
    if (to === 'HOLD' && !same && !holdReason) return 'Select the Hold Reason.';
    if (to === 'HOLD' && holdReason === 'OTHER' && !holdReasonOther.trim()) return 'Enter the reason for Other.';
    if (to !== 'HOLD' && !reason.trim()) return `Enter the ${to === 'REJECT' ? 'defect' : 'rework'} reason.`;
    if (!correctionReason.trim()) return 'Enter the reason for this correction.';
    return null;
  };

  const review = () => {
    const problem = check();
    setError(problem);
    if (!problem) setConfirming(true);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = await fetchJson(`${flow.api}/items/${item.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to,
          quantity: same ? 0 : quantity,
          inspectionId: batch?.id,
          reason: to !== 'HOLD' ? reason : undefined,
          holdReason: to === 'HOLD' ? holdReason : undefined,
          holdReasonOther: to === 'HOLD' ? holdReasonOther : undefined,
          correctionReason,
          remarks,
        }),
      });
      onSaved(body.data, body.message);
    } catch (err: any) {
      setError(err.message);
      setConfirming(false);
      setSaving(false);
    }
  };

  const q = Number(quantity) || 0;
  return (
    <div className="mt-2 pt-2 border-t border-neutral-100 space-y-2.5">
      {error && <Notice kind="error">{error}</Notice>}
      <div>
        <span className="text-[11px] font-semibold text-neutral-600">Decision (untick the old one, tick the correct one)</span>
        <div className="mt-1 flex flex-wrap gap-2">
          {OPTIONS.map((d) => {
            const on = selected.includes(d);
            return (
              <label
                key={d}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer select-none ${
                  on ? (d === 'REJECT' ? 'border-danger-500 bg-danger-50 text-danger-800' : 'border-brand-500 bg-brand-50 text-brand-900') : 'border-neutral-300 bg-white text-neutral-700'
                }`}
              >
                <input type="checkbox" checked={on} onChange={() => toggle(d)} className="accent-brand-600" />
                {d}
                {d === from && <span className="text-[10px] font-semibold text-neutral-500">(recorded)</span>}
              </label>
            );
          })}
        </div>
        <p className="mt-1 text-[11px] text-neutral-500">
          Original decision: <span className="font-semibold">{from}</span> · New decision: <span className="font-semibold">{to || '—'}</span>
        </p>
      </div>

      {!same && (
        <label className="block">
          <span className="text-[11px] font-semibold text-neutral-600">Affected quantity (up to {fmtQty(max, item.uom)})</span>
          <div className="mt-0.5 flex items-center gap-1.5">
            <input type="number" min="0" max={max} step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={`${FIELD} text-right tabular-nums`} />
            <span className="text-xs text-neutral-500">{item.uom}</span>
          </div>
        </label>
      )}
      {to && to !== 'HOLD' && (
        <label className="block">
          <span className="text-[11px] font-semibold text-neutral-600">{to === 'REJECT' ? 'Defect reason' : 'Rework reason'} *</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className={`${FIELD} mt-0.5`} />
        </label>
      )}
      {to === 'HOLD' && !same && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[11px] font-semibold text-neutral-600">Hold reason *</span>
            <select value={holdReason} onChange={(e) => setHoldReason(e.target.value)} className={`${FIELD} mt-0.5`}>
              <option value="">Select reason…</option>
              {HOLD_REASONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
            </select>
          </label>
          {holdReason === 'OTHER' && (
            <label className="block">
              <span className="text-[11px] font-semibold text-neutral-600">Other reason *</span>
              <input value={holdReasonOther} onChange={(e) => setHoldReasonOther(e.target.value)} maxLength={200} className={`${FIELD} mt-0.5`} />
            </label>
          )}
        </div>
      )}
      <label className="block">
        <span className="text-[11px] font-semibold text-neutral-600">Correction reason *</span>
        <input value={correctionReason} onChange={(e) => setCorrectionReason(e.target.value)} maxLength={300} placeholder="Why the decision is being corrected" className={`${FIELD} mt-0.5`} />
      </label>
      <label className="block">
        <span className="text-[11px] font-semibold text-neutral-600">Remarks</span>
        <input value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={500} className={`${FIELD} mt-0.5`} />
      </label>

      {confirming ? (
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 space-y-2" role="alertdialog" aria-live="assertive">
          <p className="text-xs text-neutral-800">
            {same
              ? `Save the updated reason and remarks for this ${from} decision?`
              : `Are you sure you want to change ${fmtQty(q, item.uom)} of this fabric's QC decision from ${from} to ${to}? The ${NOUN[from]} quantity will be reduced and the ${NOUN[to!]} quantity will be updated automatically.`}
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setConfirming(false)} disabled={saving} className={BTN_QUIET}>Cancel</button>
            <button type="button" onClick={save} disabled={saving} className={BTN_PRIMARY}>{saving ? 'Saving…' : 'Confirm & Save'}</button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className={BTN_QUIET}>Cancel</button>
          <button type="button" onClick={review} className={BTN_PRIMARY}>Save</button>
        </div>
      )}
    </div>
  );
}

/** Every decision change of a line (GET <api>/items/:id/decision), newest first. */
export function QcDecisionHistory({ flow, itemId, refreshKey }: { flow: WorkflowView; itemId: string; refreshKey: unknown }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    let live = true;
    fetchJson(`${flow.api}/items/${itemId}/decision`)
      .then((b) => live && setRows(b.data || []))
      .catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, [flow.api, itemId, refreshKey]);
  if (rows.length === 0) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold text-neutral-600 mb-2">Decision changes</h4>
      <ul className="space-y-1.5 text-xs">
        {rows.map((r) => (
          <li key={r.id} className="border border-neutral-200 rounded-lg px-2.5 py-2">
            <div className="flex justify-between gap-3">
              <span className="font-semibold">
                {r.from === r.to ? `${r.from}: reason / remarks updated` : `${fmtQty(r.quantity, r.unit)} ${r.from} → ${r.to}`}
              </span>
              <span className="text-neutral-500">{fmtDate(r.at, true)} · {r.by || '—'}</span>
            </div>
            <p className="text-neutral-700">Reason: {r.correctionReason || '—'}{r.reason ? ` · ${r.to === 'REJECT' ? 'Defect' : r.to === 'REWORK' ? 'Rework' : 'Note'}: ${r.reason}` : ''}</p>
            {r.remarks && <p className="text-neutral-500">{r.remarks}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
