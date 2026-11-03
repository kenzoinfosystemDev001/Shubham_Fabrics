'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { BTN_PRIMARY, BTN_QUIET, FIELD, Notice, fetchJson, fmtDate, fmtQty } from '@/components/workflow/WorkflowUi';
import { HOLD_REASONS } from '@/lib/holds.mjs';

// Change a Dyeing QC decision (POST /api/qc1/challans/:id/decision). Dyeing QC decides PASS or REWORK and can hold
// quantity back; REWORK and HOLD can be swapped. The recorded option is shown ticked: untick it, tick the correct
// one, enter the quantity and the reason, confirm. Rework already received by Dyeing can no longer change.

type Decision = 'REWORK' | 'HOLD';
const OPTIONS: Decision[] = ['REWORK', 'HOLD'];

export function Qc1DecisionModal({ challanId, onClose, onSaved }: { challanId: string; onClose: () => void; onSaved: (message: string) => void }) {
  const [state, setState] = useState<any>(null);
  const [unit, setUnit] = useState('');
  const [from, setFrom] = useState<Decision | null>(null);
  const [selected, setSelected] = useState<Decision[]>([]);
  const [quantity, setQuantity] = useState('');
  const [reworkReason, setReworkReason] = useState('');
  const [holdReason, setHoldReason] = useState('');
  const [holdReasonOther, setHoldReasonOther] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const body = await fetchJson(`/api/qc1/challans/${challanId}/decision`);
      setState(body.data);
      const first = body.data.units.find((u: any) => u.reworkChangeable > 0 || u.held > 0) || body.data.units[0];
      if (first) pick(first.unit, first.reworkChangeable > 0 ? 'REWORK' : first.held > 0 ? 'HOLD' : null, body.data);
    } catch (e: any) {
      setError(e.message);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challanId]);

  const row = state?.units.find((u: any) => u.unit === unit);
  const max = !row || !from ? 0 : from === 'REWORK' ? row.reworkChangeable : row.held;
  const to = selected.length === 1 && selected[0] !== from ? selected[0] : null;

  function pick(u: string, d: Decision | null, s = state) {
    const r = s?.units.find((x: any) => x.unit === u);
    setUnit(u);
    setFrom(d);
    setSelected(d ? [d] : []);
    setQuantity(r && d ? String(d === 'REWORK' ? r.reworkChangeable : r.held) : '');
    setConfirming(false);
  }

  const toggle = (d: Decision) => setSelected((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]));

  const check = () => {
    if (!from) return 'This unit has no REWORK that can still change and nothing on HOLD.';
    if (!to) return selected.length > 1 ? 'Select only one decision for this quantity.' : 'Untick the recorded decision and tick the correct one.';
    const q = Number(quantity);
    if (!(q > 0)) return 'Enter the quantity whose decision changes.';
    if (q > max) return `At most ${fmtQty(max, unit)} can change.`;
    if (to === 'HOLD' && !holdReason) return 'Select the Hold Reason.';
    if (to === 'HOLD' && holdReason === 'OTHER' && !holdReasonOther.trim()) return 'Enter the reason for Other.';
    if (to === 'REWORK' && !reworkReason.trim()) return 'Enter the rework reason.';
    if (!correctionReason.trim()) return 'Enter the reason for this correction.';
    return null;
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = await fetchJson(`/api/qc1/challans/${challanId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit, from, to, quantity, correctionReason, remarks, reworkReason, holdReason, holdReasonOther }),
      });
      onSaved(body.message);
    } catch (e: any) {
      setError(e.message);
      setConfirming(false);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-neutral-900/50 p-3 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 w-full max-w-xl">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-neutral-900">Change Dyeing QC decision</h3>
            <p className="text-xs text-neutral-500 font-mono">{state?.challanNumber || ''}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-neutral-500 hover:bg-neutral-100 rounded-lg" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {error && <Notice kind="error" onClose={() => setError(null)}>{error}</Notice>}
          {!state && !error && <p className="text-sm text-neutral-500">Loading…</p>}
          {state && (
            <>
              <div className="grid grid-cols-1 gap-2">
                {state.units.map((u: any) => (
                  <div key={u.unit} className={`rounded-lg border px-3 py-2 text-xs ${u.unit === unit ? 'border-brand-300 bg-brand-50/50' : 'border-neutral-200'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold">{u.unit}</span>
                      <span className="tabular-nums text-neutral-700">
                        REWORK {fmtQty(u.rework, u.unit)} (can change {fmtQty(u.reworkChangeable, u.unit)}) · HOLD {fmtQty(u.held, u.unit)}
                      </span>
                    </div>
                    <div className="mt-1 flex gap-3">
                      {u.reworkChangeable > 0 && (
                        <button type="button" onClick={() => pick(u.unit, 'REWORK')} className="font-semibold text-brand-700 hover:underline">Change REWORK</button>
                      )}
                      {u.held > 0 && (
                        <button type="button" onClick={() => pick(u.unit, 'HOLD')} className="font-semibold text-brand-700 hover:underline">Change HOLD</button>
                      )}
                      {u.rework > u.reworkChangeable && (
                        <span className="text-neutral-500">{fmtQty(u.rework - u.reworkChangeable, u.unit)} of the rework is already with Dyeing.</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {from && (
                <div className="space-y-2.5 pt-1">
                  <div>
                    <span className="text-[11px] font-semibold text-neutral-600">Decision (untick the old one, tick the correct one)</span>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {OPTIONS.map((d) => (
                        <label key={d} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer select-none ${selected.includes(d) ? 'border-brand-500 bg-brand-50 text-brand-900' : 'border-neutral-300 text-neutral-700'}`}>
                          <input type="checkbox" checked={selected.includes(d)} onChange={() => toggle(d)} className="accent-brand-600" />
                          {d}
                          {d === from && <span className="text-[10px] font-semibold text-neutral-500">(recorded)</span>}
                        </label>
                      ))}
                    </div>
                    <p className="mt-1 text-[11px] text-neutral-500">
                      Original decision: <span className="font-semibold">{from}</span> · New decision: <span className="font-semibold">{to || '—'}</span> · Dyeing QC does not reject (lost fabric is shrinkage).
                    </p>
                  </div>
                  <label className="block">
                    <span className="text-[11px] font-semibold text-neutral-600">Affected quantity (up to {fmtQty(max, unit)})</span>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <input type="number" min="0" max={max} step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={`${FIELD} text-right tabular-nums`} />
                      <span className="text-xs text-neutral-500">{unit}</span>
                    </div>
                  </label>
                  {to === 'HOLD' && (
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
                  {to === 'REWORK' && (
                    <>
                      <label className="block">
                        <span className="text-[11px] font-semibold text-neutral-600">Rework reason *</span>
                        <input value={reworkReason} onChange={(e) => setReworkReason(e.target.value)} maxLength={300} className={`${FIELD} mt-0.5`} />
                      </label>
                      <p className="text-[11px] text-neutral-500">The quantity goes to Dyeing for rework straight away; no challan is needed.</p>
                    </>
                  )}
                  <label className="block">
                    <span className="text-[11px] font-semibold text-neutral-600">Correction reason *</span>
                    <input value={correctionReason} onChange={(e) => setCorrectionReason(e.target.value)} maxLength={300} className={`${FIELD} mt-0.5`} />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-semibold text-neutral-600">Remarks</span>
                    <input value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={500} className={`${FIELD} mt-0.5`} />
                  </label>
                  {confirming ? (
                    <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 space-y-2" role="alertdialog">
                      <p className="text-xs text-neutral-800">
                        Are you sure you want to change {fmtQty(Number(quantity), unit)} of this fabric&apos;s QC decision from {from} to {to}? The {from === 'REWORK' ? 'rework' : 'hold'} quantity will be reduced and the {to === 'REWORK' ? 'rework' : 'hold'} quantity will be updated automatically.
                      </p>
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setConfirming(false)} disabled={saving} className={BTN_QUIET}>Cancel</button>
                        <button type="button" onClick={save} disabled={saving} className={BTN_PRIMARY}>{saving ? 'Saving…' : 'Confirm & Save'}</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={onClose} className={BTN_QUIET}>Cancel</button>
                      <button
                        type="button"
                        onClick={() => {
                          const problem = check();
                          setError(problem);
                          if (!problem) setConfirming(true);
                        }}
                        className={BTN_PRIMARY}
                      >
                        Save
                      </button>
                    </div>
                  )}
                </div>
              )}

              {state.history.length > 0 && (
                <div className="pt-2">
                  <h4 className="text-xs font-semibold text-neutral-600 mb-1.5">Decision changes</h4>
                  <ul className="space-y-1.5 text-xs">
                    {state.history.map((h: any) => (
                      <li key={h.id} className="border border-neutral-200 rounded-lg px-2.5 py-2">
                        <div className="flex justify-between gap-3">
                          <span className="font-semibold">{fmtQty(h.quantity, h.unit)} {h.from} → {h.to}</span>
                          <span className="text-neutral-500">{fmtDate(h.at, true)} · {h.by || '—'}</span>
                        </div>
                        <p className="text-neutral-700">Reason: {h.correctionReason}{h.returnChallans?.length ? ` · Return challan ${h.returnChallans.join(', ')}` : ''}{h.reworkRecords?.length ? ` · ${h.reworkRecords.join(', ')}` : ''}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
