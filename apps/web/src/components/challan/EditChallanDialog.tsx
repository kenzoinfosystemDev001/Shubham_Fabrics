'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { BTN_PRIMARY, BTN_QUIET, FIELD, Notice, THEAD, fetchJson } from '@/components/workflow/WorkflowUi';
import { AverageField, QuantityUnitField, type QtyUnit } from '@/components/challan/AverageField';
import { unitOf } from '@/lib/challan-units.mjs';
import { userChallanRemarks } from '@/lib/challan-remarks.mjs';

// Corrects an issued challan (POST /api/challans/:id/edit). Details can always be corrected; quantities and
// units only until the receiving department has received the challan (the server checks and explains).

const NOT_RECEIVED = ['DRAFT', 'ISSUED', 'SUBMITTED', 'IN_TRANSIT'];
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const unit = (v: unknown): QtyUnit => {
  const u = unitOf(v);
  return u === 'MTR' || u === 'PCS' ? u : '';
};

interface LineForm {
  id: string;
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

export function EditChallanDialog({ challan, onClose, onSaved }: { challan: any; onClose: () => void; onSaved: (message: string) => void }) {
  const quantitiesOpen = NOT_RECEIVED.includes(String(challan.status || '').toUpperCase());
  const [challanNumber, setChallanNumber] = useState(str(challan.challanNumber));
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = (id: string, patch: Partial<LineForm>) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      // Only what changed is sent, so untouched lines and system remarks stay exactly as they were.
      const original = new Map((challan.items || []).map((i: any) => [i.id, i]));
      const items = lines
        .map((l) => {
          const o: any = original.get(l.id);
          const out: any = { id: l.id };
          for (const k of ['itemDescription', 'fabricCode', 'colour', 'shade', 'requiredColour', 'size', 'width'] as const) if (l[k] !== str(o[k])) out[k] = l[k];
          if (l.remarks !== (userChallanRemarks(o.remarks) || '')) out.remarks = l.remarks;
          if (l.average !== str(o.average) || l.averageUnit !== unit(o.averageUnit)) Object.assign(out, { average: l.average, averageUnit: l.averageUnit });
          if (l.unitQuantity !== str(o.unitQuantity) || l.unitQuantityUom !== unit(o.unitQuantityUom)) Object.assign(out, { unitQuantity: l.unitQuantity, unitQuantityUom: l.unitQuantityUom });
          if (quantitiesOpen && (Number(l.quantity) !== Number(o.quantity) || l.uom !== unit(o.uom))) Object.assign(out, { quantity: l.quantity, uom: l.uom });
          return out;
        })
        .filter((x) => Object.keys(x).length > 1);
      const body = await fetchJson(`/api/challans/${challan.id}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedUpdatedAt: challan.updatedAt,
          ...(challanNumber.trim() !== str(challan.challanNumber) ? { challanNumber: challanNumber.trim() } : {}),
          ...(issuedDate !== str(challan.issuedDate || challan.createdAt).slice(0, 10) ? { issuedDate } : {}),
          ...(priority !== str(challan.priority || 'NORMAL') ? { priority } : {}),
          ...(inchargeName !== str(challan.inchargeName) ? { inchargeName } : {}),
          ...(remarks !== (userChallanRemarks(challan.remarks) || '') ? { remarks } : {}),
          editReason,
          items,
        }),
      });
      onSaved(body.message);
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-neutral-900/50 p-3 overflow-y-auto print:hidden" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="bg-white rounded-2xl shadow-xl border border-neutral-200 w-full max-w-7xl">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-neutral-900">Edit Challan {challan.challanNumber}</h3>
            <p className="text-xs text-neutral-500">
              {quantitiesOpen
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
              <input value={challanNumber} onChange={(e) => setChallanNumber(e.target.value)} required maxLength={60} className={`${FIELD} mt-1 font-mono`} />
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
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {lines.map((l) => (
                  <tr key={l.id} className="align-top">
                    <td className="py-2 px-3"><input value={l.fabricCode} onChange={(e) => update(l.id, { fabricCode: e.target.value })} className={FIELD} aria-label="Fabric" /></td>
                    <td className="py-2 px-3"><input value={l.itemDescription} onChange={(e) => update(l.id, { itemDescription: e.target.value })} required className={`${FIELD} min-w-[180px]`} aria-label="Description" /></td>
                    <td className="py-2 px-3"><input value={l.colour} onChange={(e) => update(l.id, { colour: e.target.value })} className={FIELD} aria-label="Colour" /></td>
                    <td className="py-2 px-3"><input value={l.shade} onChange={(e) => update(l.id, { shade: e.target.value })} className={FIELD} aria-label="Shade" /></td>
                    <td className="py-2 px-3"><input value={l.requiredColour} onChange={(e) => update(l.id, { requiredColour: e.target.value })} className={FIELD} aria-label="Dye colour" /></td>
                    <td className="py-2 px-3"><input value={l.size} onChange={(e) => update(l.id, { size: e.target.value })} className={`${FIELD} w-20`} aria-label="Size" /></td>
                    <td className="py-2 px-3">
                      <QuantityUnitField
                        label="Quantity"
                        value={l.quantity}
                        unit={l.uom}
                        onValue={(quantity) => update(l.id, { quantity })}
                        onUnit={quantitiesOpen ? (uom) => update(l.id, { uom }) : undefined}
                        required
                        disabled={!quantitiesOpen}
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
                      <input value={l.width} onChange={(e) => update(l.id, { width: e.target.value })} maxLength={40} placeholder="e.g. 44 Inch" className={FIELD} aria-label="Fabric width" />
                    </td>
                    <td className="py-2 px-3"><input value={l.remarks} onChange={(e) => update(l.id, { remarks: e.target.value })} maxLength={500} className={FIELD} aria-label="Remarks" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-semibold text-neutral-600">Challan remarks</span>
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={1000} rows={2} className={`${FIELD} mt-1 h-auto py-2`} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-neutral-600">Reason for the correction</span>
              <textarea value={editReason} onChange={(e) => setEditReason(e.target.value)} maxLength={500} rows={2} placeholder="e.g. wrong colour entered" className={`${FIELD} mt-1 h-auto py-2`} />
            </label>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-neutral-200 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={BTN_QUIET}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={BTN_PRIMARY}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
