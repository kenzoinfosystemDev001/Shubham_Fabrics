'use client';

import React, { useState } from 'react';
import { Plus, Trash2, Undo2, X } from 'lucide-react';
import { BTN_PRIMARY, BTN_QUIET, FIELD, Notice, THEAD, fetchJson } from '@/components/workflow/WorkflowUi';
import { AverageField, QuantityUnitField, type QtyUnit } from '@/components/challan/AverageField';
import { unitOf } from '@/lib/challan-units.mjs';
import { userChallanRemarks } from '@/lib/challan-remarks.mjs';

// Corrects an issued challan (POST /api/challans/:id/edit): the same challan is updated, its number never changes.
// Details can always be corrected; quantities, units and removing a line only until the receiving department has
// received that line; adding lines only while nothing on the challan is received (and only on challans whose lines
// are not issued from another department line). `challan.editOptions` (from GET /api/challans/:id) says what is
// open; the server checks every save again and explains anything it refuses. A reason is required, and the
// changes are shown for confirmation before saving.

const NOT_RECEIVED = ['DRAFT', 'ISSUED', 'SUBMITTED', 'IN_TRANSIT'];
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const unit = (v: unknown): QtyUnit => {
  const u = unitOf(v);
  return u === 'MTR' || u === 'PCS' ? u : '';
};

interface LineForm {
  id: string;
  /** Added in this edit (not saved yet). */
  isNew?: boolean;
  itemDescription: string;
  fabricCode: string;
  colour: string;
  shade: string;
  requiredColour: string;
  size: string;
  quantity: string;
  uom: QtyUnit;
  average: string;
  averageUnit: QtyUnit;
  unitQuantity: string;
  unitQuantityUom: QtyUnit;
  /** This line's own fabric width. */
  width: string;
  remarks: string;
}

interface EditOptions {
  canEdit: boolean;
  quantitiesOpen: boolean;
  receivedLineIds: string[];
  canRemoveLines: boolean;
  canAddLines: boolean;
}

let newLineSeq = 0;
const blankLine = (template?: LineForm): LineForm => ({
  id: `new-${++newLineSeq}`,
  isNew: true,
  itemDescription: '',
  fabricCode: template?.fabricCode || '',
  colour: '',
  shade: '',
  requiredColour: '',
  size: '',
  quantity: '',
  uom: template?.uom || '',
  average: '',
  averageUnit: '',
  unitQuantity: '',
  unitQuantityUom: '',
  width: template?.width || '',
  remarks: '',
});

export function EditChallanDialog({ challan, onClose, onSaved }: { challan: any; onClose: () => void; onSaved: (message: string) => void }) {
  const options: EditOptions = challan.editOptions || {
    canEdit: true,
    quantitiesOpen: NOT_RECEIVED.includes(String(challan.status || '').toUpperCase()),
    receivedLineIds: [],
    canRemoveLines: false,
    canAddLines: false,
  };
  const received = new Set(options.receivedLineIds || []);
  const lineOpen = (l: LineForm) => l.isNew || (options.quantitiesOpen && !received.has(l.id));

  const [issuedDate, setIssuedDate] = useState(str(challan.issuedDate || challan.createdAt).slice(0, 10));
  const [priority, setPriority] = useState(str(challan.priority || 'NORMAL'));
  const [inchargeName, setInchargeName] = useState(str(challan.inchargeName));
  const [remarks, setRemarks] = useState(userChallanRemarks(challan.remarks) || '');
  const [editReason, setEditReason] = useState('');
  const [lines, setLines] = useState<LineForm[]>(() =>
    (challan.items || []).map((i: any) => ({
      id: i.id,
      itemDescription: str(i.itemDescription),
      fabricCode: str(i.fabricCode),
      colour: str(i.colour),
      shade: str(i.shade),
      requiredColour: str(i.requiredColour),
      size: str(i.size),
      quantity: str(i.quantity),
      uom: unit(i.uom),
      average: str(i.average),
      averageUnit: unit(i.averageUnit),
      unitQuantity: str(i.unitQuantity),
      unitQuantityUom: unit(i.unitQuantityUom),
      width: str(i.width),
      remarks: userChallanRemarks(i.remarks) || '',
    })),
  );
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The changes waiting for confirmation (set by Review Changes).
  const [review, setReview] = useState<{ body: any; summary: string[] } | null>(null);
  const update = (id: string, patch: Partial<LineForm>) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const toggleRemove = (l: LineForm) => {
    if (l.isNew) {
      setLines((ls) => ls.filter((x) => x.id !== l.id));
      return;
    }
    setRemoved((s) => {
      const next = new Set(s);
      if (next.has(l.id)) next.delete(l.id);
      else next.add(l.id);
      return next;
    });
  };
  const keptCount = lines.filter((l) => !removed.has(l.id)).length;

  // Builds the request (only what changed) and the summary shown for confirmation.
  const prepare = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!editReason.trim()) {
      setError('Enter the reason for this correction.');
      return;
    }
    if (keptCount < 1) {
      setError('A challan needs at least one line. Cancel the challan instead.');
      return;
    }
    const original = new Map((challan.items || []).map((i: any) => [i.id, i]));
    const summary: string[] = [];
    const items = lines
      .filter((l) => !l.isNew && !removed.has(l.id))
      .map((l) => {
        const o: any = original.get(l.id);
        const out: any = { id: l.id };
        for (const k of ['itemDescription', 'fabricCode', 'colour', 'shade', 'requiredColour', 'size', 'width'] as const) if (l[k] !== str(o[k])) out[k] = l[k];
        if (l.remarks !== (userChallanRemarks(o.remarks) || '')) out.remarks = l.remarks;
        if (l.average !== str(o.average) || l.averageUnit !== unit(o.averageUnit)) Object.assign(out, { average: l.average, averageUnit: l.averageUnit });
        if (l.unitQuantity !== str(o.unitQuantity) || l.unitQuantityUom !== unit(o.unitQuantityUom)) Object.assign(out, { unitQuantity: l.unitQuantity, unitQuantityUom: l.unitQuantityUom });
        if (lineOpen(l) && (Number(l.quantity) !== Number(o.quantity) || l.uom !== unit(o.uom))) {
          Object.assign(out, { quantity: l.quantity, uom: l.uom });
          summary.push(`${o.fabricCode || o.itemDescription}: quantity ${o.quantity} ${unit(o.uom) || o.uom} → ${l.quantity} ${l.uom}`);
        }
        const other = Object.keys(out).filter((k) => !['id', 'quantity', 'uom'].includes(k));
        if (other.length) summary.push(`${o.fabricCode || o.itemDescription}: ${other.length} detail${other.length === 1 ? '' : 's'} corrected`);
        return out;
      })
      .filter((x) => Object.keys(x).length > 1);
    const removeItemIds = Array.from(removed);
    for (const rid of removeItemIds) {
      const o: any = original.get(rid);
      summary.push(`Remove line: ${o.fabricCode || o.itemDescription} (${o.quantity} ${unit(o.uom) || o.uom})`);
    }
    const newItems = lines
      .filter((l) => l.isNew)
      .map((l) => {
        summary.push(`Add line: ${l.fabricCode || l.itemDescription || 'New line'} (${l.quantity || 0} ${l.uom})`);
        const { id: _id, isNew: _isNew, ...rest } = l;
        return rest;
      });
    const headerChanges: Record<string, string> = {};
    if (issuedDate !== str(challan.issuedDate || challan.createdAt).slice(0, 10)) headerChanges.issuedDate = issuedDate;
    if (priority !== str(challan.priority || 'NORMAL')) headerChanges.priority = priority;
    if (inchargeName !== str(challan.inchargeName)) headerChanges.inchargeName = inchargeName;
    if (remarks !== (userChallanRemarks(challan.remarks) || '')) headerChanges.remarks = remarks;
    const headerLabels: Record<string, string> = { issuedDate: 'Challan date', priority: 'Priority', inchargeName: 'Incharge name', remarks: 'Challan remarks' };
    for (const k of Object.keys(headerChanges)) summary.unshift(`${headerLabels[k]} changed`);
    if (!summary.length) {
      setError('Nothing was changed.');
      return;
    }
    setReview({
      body: { expectedUpdatedAt: challan.updatedAt, ...headerChanges, editReason: editReason.trim(), items, removeItemIds, newItems },
      summary,
    });
  };

  const save = async () => {
    if (!review) return;
    setSaving(true);
    setError(null);
    try {
      const body = await fetchJson(`/api/challans/${challan.id}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(review.body),
      });
      onSaved(body.message);
    } catch (err: any) {
      setError(err.message);
      setReview(null);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-neutral-900/50 p-3 overflow-y-auto print:hidden" role="dialog" aria-modal="true">
      <form onSubmit={prepare} className="bg-white rounded-2xl shadow-xl border border-neutral-200 w-full max-w-7xl">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-neutral-900">Edit Challan {challan.challanNumber}</h3>
            <p className="text-xs text-neutral-500">
              {options.quantitiesOpen
                ? 'Not yet received: details, quantities and units can be corrected. Linked stock and department lines are updated with it.'
                : 'Already received: details can be corrected; quantities stay as received.'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-neutral-500 hover:bg-neutral-100 rounded-lg" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {error && <Notice kind="error">{error}</Notice>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <label className="block">
              <span className="text-xs font-semibold text-neutral-600">Challan Number</span>
              <input value={str(challan.challanNumber)} readOnly disabled title="The challan number never changes" className={`${FIELD} mt-1 font-mono bg-neutral-50`} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-neutral-600">Challan date</span>
              <input type="date" value={issuedDate} onChange={(e) => setIssuedDate(e.target.value)} required className={`${FIELD} mt-1`} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-neutral-600">Priority</span>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className={`${FIELD} mt-1`}>
                {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((p) => (
                  <option key={p} value={p}>
                    {p.charAt(0) + p.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-neutral-600">Incharge name</span>
              <input value={inchargeName} onChange={(e) => setInchargeName(e.target.value)} maxLength={120} className={`${FIELD} mt-1`} />
            </label>
          </div>
          <div className="overflow-x-auto border border-neutral-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className={THEAD}>
                <tr>
                  <th className="py-2.5 px-3">Fabric</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Colour</th>
                  <th className="py-2.5 px-3">Shade</th>
                  <th className="py-2.5 px-3">Dye Colour</th>
                  <th className="py-2.5 px-3">Size</th>
                  <th className="py-2.5 px-3 min-w-[190px]">Quantity</th>
                  <th className="py-2.5 px-3 min-w-[190px]">Average</th>
                  <th className="py-2.5 px-3 min-w-[190px]">Unit</th>
                  <th className="py-2.5 px-3 min-w-[120px]">Width</th>
                  <th className="py-2.5 px-3 min-w-[160px]">Remarks</th>
                  <th className="py-2.5 px-3"><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {lines.map((l) => {
                  const isRemoved = removed.has(l.id);
                  const open = lineOpen(l);
                  const canRemove = l.isNew || (options.canRemoveLines && !received.has(l.id));
                  return (
                    <tr key={l.id} className={`align-top ${isRemoved ? 'bg-danger-50/60 opacity-60' : l.isNew ? 'bg-accent-50/50' : ''}`}>
                      <td className="py-2 px-3"><input value={l.fabricCode} onChange={(e) => update(l.id, { fabricCode: e.target.value })} disabled={isRemoved} className={FIELD} aria-label="Fabric" /></td>
                      <td className="py-2 px-3"><input value={l.itemDescription} onChange={(e) => update(l.id, { itemDescription: e.target.value })} required={!isRemoved && !l.isNew} disabled={isRemoved} className={`${FIELD} min-w-[180px]`} aria-label="Description" /></td>
                      <td className="py-2 px-3"><input value={l.colour} onChange={(e) => update(l.id, { colour: e.target.value })} disabled={isRemoved} className={FIELD} aria-label="Colour" /></td>
                      <td className="py-2 px-3"><input value={l.shade} onChange={(e) => update(l.id, { shade: e.target.value })} disabled={isRemoved} className={FIELD} aria-label="Shade" /></td>
                      <td className="py-2 px-3"><input value={l.requiredColour} onChange={(e) => update(l.id, { requiredColour: e.target.value })} disabled={isRemoved} className={FIELD} aria-label="Dye colour" /></td>
                      <td className="py-2 px-3"><input value={l.size} onChange={(e) => update(l.id, { size: e.target.value })} disabled={isRemoved} className={`${FIELD} w-20`} aria-label="Size" /></td>
                      <td className="py-2 px-3">
                        <QuantityUnitField
                          label="Quantity"
                          value={l.quantity}
                          unit={l.uom}
                          onValue={(quantity) => update(l.id, { quantity })}
                          onUnit={open && !isRemoved ? (uom) => update(l.id, { uom }) : undefined}
                          required={!isRemoved}
                          disabled={!open || isRemoved}
                          min="0.001"
                          lockedTitle="Already received: the quantity stays as received"
                          inputClassName={`${FIELD} text-right`}
                        />
                      </td>
                      <td className="py-2 px-3">
                        <AverageField average={l.average} averageUnit={l.averageUnit} onChange={(patch) => update(l.id, patch)} />
                      </td>
                      <td className="py-2 px-3">
                        <QuantityUnitField
                          label="Unit quantity"
                          value={l.unitQuantity}
                          unit={l.unitQuantityUom}
                          onValue={(unitQuantity) => update(l.id, { unitQuantity })}
                          onUnit={(unitQuantityUom) => update(l.id, { unitQuantityUom })}
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input value={l.width} onChange={(e) => update(l.id, { width: e.target.value })} disabled={isRemoved} maxLength={40} placeholder="e.g. 44 Inch" className={FIELD} aria-label="Fabric width" />
                      </td>
                      <td className="py-2 px-3"><input value={l.remarks} onChange={(e) => update(l.id, { remarks: e.target.value })} disabled={isRemoved} maxLength={500} className={FIELD} aria-label="Remarks" /></td>
                      <td className="py-2 px-3">
                        {canRemove ? (
                          <button
                            type="button"
                            onClick={() => toggleRemove(l)}
                            className={`p-1.5 rounded-lg ${isRemoved ? 'text-neutral-700 hover:bg-neutral-100' : 'text-danger-600 hover:bg-danger-50'}`}
                            title={isRemoved ? 'Keep this line' : 'Remove this line'}
                            aria-label={isRemoved ? 'Keep this line' : 'Remove this line'}
                          >
                            {isRemoved ? <Undo2 className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {options.canAddLines ? (
            <button type="button" onClick={() => setLines((ls) => [...ls, blankLine(ls[ls.length - 1])])} className={`${BTN_QUIET} inline-flex items-center gap-1.5`}>
              <Plus className="w-3.5 h-3.5" />
              <span>Add line</span>
            </button>
          ) : options.quantitiesOpen ? (
            <p className="text-[11px] text-neutral-500">Lines cannot be added to this challan (its lines are issued from another department line, or part of it is received). Issue a new challan for extra quantity.</p>
          ) : null}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-semibold text-neutral-600">Challan remarks</span>
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={1000} rows={2} className={`${FIELD} mt-1 h-auto py-2`} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-neutral-600">
                Reason for the correction <span className="text-danger-600">*</span>
              </span>
              <textarea value={editReason} onChange={(e) => setEditReason(e.target.value)} maxLength={500} rows={2} required placeholder="e.g. wrong quantity entered" className={`${FIELD} mt-1 h-auto py-2`} />
            </label>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-neutral-200 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={BTN_QUIET}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={BTN_PRIMARY}>
            Review Changes
          </button>
        </div>
      </form>

      {review && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-900/50 p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-edit-title">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-xl p-5 space-y-4">
            <div>
              <h3 id="confirm-edit-title" className="text-sm font-bold text-neutral-900">Save changes to challan {challan.challanNumber}?</h3>
              <p className="text-[11px] text-neutral-500 mt-0.5">The same challan is updated; its number stays {challan.challanNumber}.</p>
            </div>
            <ul className="space-y-1 text-xs text-neutral-800 max-h-64 overflow-y-auto list-disc pl-5">
              {review.summary.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
            <p className="text-xs text-neutral-700">
              <span className="font-semibold">Reason:</span> {review.body.editReason}
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setReview(null)} disabled={saving} className={BTN_QUIET}>
                Back
              </button>
              <button type="button" onClick={save} disabled={saving} className={BTN_PRIMARY}>
                {saving ? 'Saving…' : 'Confirm & Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
