'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ImageOff, PackageCheck, Play, Send, Undo2, Upload, X } from 'lucide-react';
import { newSubmissionKey } from '@/components/challan/ChallanNumberField';
import { FabricPhotos } from '@/components/workflow/FabricPhotos';
import {
  BTN_PRIMARY,
  BTN_QUIET,
  BTN_SECONDARY,
  DeadlineText,
  DocumentsButton,
  FIELD,
  Notice,
  PriorityBadge,
  THEAD,
  fetchJson,
  fmtDate,
  sheetRef,
} from '@/components/workflow/WorkflowUi';
import { ALLOCATION_STATUS_LABEL, INVENTORY_STATUS_LABEL, LEDGER_LABEL } from '@/lib/inventory.mjs';
import { CATEGORY_LABEL, GARMENT_CATEGORIES } from '@/lib/recutting.mjs';

// Shared pieces of the Inventory Department screens (Packing is a module of Inventory). Finished
// garments only, always in pieces: no fabric, meters or fabric measurement anywhere here.

export const API = '/api/inventory';
export const CATEGORY_OPTIONS = GARMENT_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }));

export function pcs(value: number | null | undefined) {
  return `${(Number(value) || 0).toLocaleString('en-IN')} PCS`;
}

export const todayInput = () => new Date().toISOString().slice(0, 10);

/** Name of the signed-in user (the responsible staff member shown on forms). */
export function useSignedInName() {
  const [name, setName] = useState('');
  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('subham_mes_user') || 'null');
      setName(u?.fullName || u?.username || '');
    } catch {}
  }, []);
  return name;
}

/** The complete-garment image, aspect ratio kept; a clear empty state when there is none. */
export function GarmentImage({ image, alt, size = 'sm' }: { image?: { id: string; version: number } | null; alt: string; size?: 'sm' | 'md' | 'lg' }) {
  const [failed, setFailed] = useState(false);
  const box = size === 'lg' ? 'w-full aspect-[3/4]' : size === 'md' ? 'w-24 h-32' : 'w-12 h-16';
  if (!image || failed) {
    return (
      <div className={`${box} shrink-0 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 flex flex-col items-center justify-center text-center text-neutral-400 p-1`}>
        <ImageOff className={size === 'sm' ? 'w-4 h-4' : 'w-6 h-6'} aria-hidden="true" />
        {size !== 'sm' && <span className="mt-1 text-[11px] leading-tight">{failed ? 'Image could not be loaded' : 'No garment image available'}</span>}
        {size === 'sm' && <span className="sr-only">No garment image available</span>}
      </div>
    );
  }
  return (
    <div className={`${box} shrink-0 rounded-lg border border-neutral-200 bg-white overflow-hidden flex items-center justify-center`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${API}/garment-images/${image.id}?v=${image.version}`} alt={alt} className="max-w-full max-h-full object-contain" loading="lazy" onError={() => setFailed(true)} />
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  AWAITING_RECEIPT: 'bg-neutral-100 text-neutral-700',
  NOTHING_RECEIVED: 'bg-neutral-100 text-neutral-500',
  READY: 'bg-accent-100 text-neutral-900',
  SENT: 'bg-brand-50 text-brand-800',
  PARTIAL: 'bg-brand-100 text-brand-900',
  PACKED: 'bg-brand-600 text-white',
  SENT_FOR_PACKING: 'bg-brand-50 text-brand-800',
  PACKING_IN_PROGRESS: 'bg-brand-100 text-brand-900',
  PARTIALLY_PACKED: 'bg-brand-100 text-brand-900',
  PACKING_COMPLETED: 'bg-brand-600 text-white',
  CANCELLED: 'bg-neutral-100 text-neutral-500',
};

export function InventoryStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${STATUS_TONE[status] || 'bg-neutral-100 text-neutral-700'}`}>
      {(INVENTORY_STATUS_LABEL as Record<string, string>)[status] || status}
    </span>
  );
}

export function AllocationStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${STATUS_TONE[status] || 'bg-neutral-100 text-neutral-700'}`}>
      {(ALLOCATION_STATUS_LABEL as Record<string, string>)[status] || status}
    </span>
  );
}

export function ledgerLabel(type: string) {
  return (LEDGER_LABEL as Record<string, string>)[type] || type.replace(/_/g, ' ').toLowerCase();
}

/** Design number, serial and Production Sheet of a record. */
export function DesignCell({ program }: { program: any }) {
  return (
    <div className="text-xs">
      <span className="font-semibold text-neutral-900">{program?.designNumber || program?.wilcomDesignNumber || '—'}</span>
      <span className="block font-mono text-[11px] text-neutral-500">{program?.programSerialNo || '—'}</span>
      {program?.id ? (
        <Link href={`/programs/${program.id}`} className="block font-mono text-[11px] text-brand-700 hover:underline">{sheetRef(program)}</Link>
      ) : null}
    </div>
  );
}

export function GarmentCell({ record }: { record: any }) {
  return (
    <div className="text-xs">
      <span className="font-semibold text-neutral-900">{record.garmentCategory ? CATEGORY_LABEL[record.garmentCategory as keyof typeof CATEGORY_LABEL] || record.garmentCategory : 'Garment'}</span>
      {record.styleRef && <span className="block text-neutral-700">{record.styleRef}</span>}
      <span className="block text-neutral-500">{record.colour || '—'}</span>
    </div>
  );
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <div className="px-5 py-3 border-t border-neutral-200 flex items-center justify-between text-xs text-neutral-600">
      <span>
        {(page - 1) * pageSize + 1}–{Math.min(total, page * pageSize)} of {total}
      </span>
      <div className="flex gap-2">
        <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} className={BTN_QUIET}>Previous</button>
        <button type="button" onClick={() => onPage(page + 1)} disabled={page >= pages} className={BTN_QUIET}>Next</button>
      </div>
    </div>
  );
}

function Modal({ title, subtitle, onClose, children, footer, wide }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-neutral-900/50 p-3 overflow-y-auto" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`bg-white rounded-2xl shadow-xl border border-neutral-200 w-full ${wide ? 'max-w-3xl' : 'max-w-xl'}`}>
        <div className="px-5 py-4 border-b border-neutral-200 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-neutral-900">{title}</h3>
            {subtitle && <p className="text-xs text-neutral-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-neutral-500 hover:bg-neutral-100 rounded-lg" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
        <div className="px-5 py-4 border-t border-neutral-200 flex flex-wrap justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}

function Fact({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className={`${strong ? 'font-bold text-neutral-900' : 'font-semibold text-neutral-800'} tabular-nums`}>{value}</dd>
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs font-semibold text-neutral-600">{label}</span>
      <div className="mt-1 h-9 px-3 flex items-center bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-700 truncate">{value}</div>
    </div>
  );
}

/** Send for Packing: linked details from the record, quantity and date entered, then confirmed. */
export function SendForPackingDialog({ record, onClose, onDone }: { record: any; onClose: () => void; onDone: (message: string) => void }) {
  const staff = useSignedInName();
  const [quantity, setQuantity] = useState('');
  const [packingDate, setPackingDate] = useState(todayInput);
  const [priority, setPriority] = useState('');
  const [remarks, setRemarks] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [key] = useState(newSubmissionKey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const s = record.stock;
  const q = Number(quantity);
  const invalid = !quantity ? 'Enter the quantity to send.' : !Number.isInteger(q) || q <= 0 ? 'Enter a whole number of pieces greater than zero.' : q > s.available ? `Only ${pcs(s.available)} is available.` : null;

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = await fetchJson(`${API}/packing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idempotencyKey: key, workItemId: record.id, quantity: q, packingDate, priority: priority || record.priority, remarks }),
      });
      onDone(`${body.data.packingNumber}: ${pcs(q)} of ${record.garment} sent for packing.`);
    } catch (e: any) {
      setError(e.message);
      setConfirming(false);
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Send for Packing"
      subtitle={[record.inboundChallan?.challanNumber ? `Challan ${record.inboundChallan.challanNumber}` : '', record.garment].filter(Boolean).join(' · ')}
      onClose={onClose}
      wide
      footer={
        confirming ? (
          <>
            <button type="button" onClick={() => setConfirming(false)} className={BTN_QUIET} disabled={saving}>Back</button>
            <button type="button" onClick={submit} className={BTN_PRIMARY} disabled={saving}>
              <Send className="w-3.5 h-3.5" />
              <span>{saving ? 'Sending…' : `Confirm: send ${pcs(q)}`}</span>
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={onClose} className={BTN_QUIET}>Cancel</button>
            <button type="button" onClick={() => (invalid ? setError(invalid) : (setError(null), setConfirming(true)))} className={BTN_PRIMARY}>
              Review
            </button>
          </>
        )
      }
    >
      {error && <Notice kind="error">{error}</Notice>}
      <div className="flex gap-4">
        <GarmentImage image={record.image} alt={record.garment} size="md" />
        <dl className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
          <Fact label="Design" value={record.program?.designNumber || record.program?.wilcomDesignNumber || '—'} />
          <Fact label="Serial" value={record.program?.programSerialNo || '—'} />
          <Fact label="Category" value={record.garmentCategory ? CATEGORY_LABEL[record.garmentCategory as keyof typeof CATEGORY_LABEL] : '—'} />
          <Fact label="Colour" value={record.colour || '—'} />
          <Fact label="Total received" value={pcs(s.received)} />
          <Fact label="Available" value={pcs(s.available)} strong />
          <Fact label="Previously sent" value={pcs(s.sent)} />
          <Fact label="Already packed" value={pcs(s.packed)} />
          <Fact label="Remaining to pack" value={pcs(s.remaining)} />
        </dl>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ReadOnly label="Packing reference" value="Assigned when saved (PKG-YYYY-NNNN)" />
        <ReadOnly label="Challan" value={record.inboundChallan?.challanNumber || '—'} />
        <ReadOnly label="Final QC challan" value={record.inboundChallan?.challanNumber || '—'} />
        <ReadOnly label="Responsible staff" value={staff || '—'} />
        <label className="block">
          <span className="text-xs font-semibold text-neutral-600">Quantity to send (PCS)</span>
          <input type="number" min="1" step="1" max={s.available} value={quantity} onChange={(e) => setQuantity(e.target.value)} disabled={confirming} className={`${FIELD} mt-1 text-right tabular-nums`} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-neutral-600">Packing date</span>
          <input type="date" value={packingDate} onChange={(e) => setPackingDate(e.target.value)} disabled={confirming} required className={`${FIELD} mt-1`} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-neutral-600">Priority</span>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} disabled={confirming} className={`${FIELD} mt-1`}>
            <option value="">Same as the record ({String(record.priority || 'NORMAL').toLowerCase()})</option>
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-neutral-600">Remarks</span>
          <input value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={500} disabled={confirming} className={`${FIELD} mt-1`} />
        </label>
      </div>
      {confirming && (
        <Notice kind="success">
          Send {pcs(q)} of {record.garment} for packing on {fmtDate(packingDate)}. {pcs(s.available - q)} will stay available.
        </Notice>
      )}
    </Modal>
  );
}

const ACTION_COPY = {
  START: { title: 'Start Packing', button: 'Confirm: start packing' },
  PACK: { title: 'Record Packed Garments', button: 'Confirm packed quantity' },
  RETURN: { title: 'Return Unpacked Garments', button: 'Confirm return to inventory' },
} as const;

/** Start packing, record packed pieces, or return unpacked pieces — each confirmed before it is saved. */
export function PackingActionDialog({ allocation, action, onClose, onDone }: { allocation: any; action: keyof typeof ACTION_COPY; onClose: () => void; onDone: (message: string) => void }) {
  const [quantity, setQuantity] = useState('');
  const [remarks, setRemarks] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [key] = useState(newSubmissionKey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const q = Number(quantity);
  const needsQty = action !== 'START';
  const invalid = !needsQty
    ? null
    : !quantity
    ? 'Enter the quantity.'
    : !Number.isInteger(q) || q <= 0
    ? 'Enter a whole number of pieces greater than zero.'
    : q > allocation.open
    ? `Only ${pcs(allocation.open)} is still open on ${allocation.packingNumber}.`
    : action === 'RETURN' && !remarks.trim()
    ? 'Enter the reason for returning these garments.'
    : null;

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await fetchJson(`${API}/packing/${allocation.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idempotencyKey: key, action, quantity: needsQty ? q : undefined, remarks }),
      });
      onDone(
        action === 'START'
          ? `${allocation.packingNumber}: packing started.`
          : action === 'PACK'
          ? `${allocation.packingNumber}: ${pcs(q)} packed.`
          : `${allocation.packingNumber}: ${pcs(q)} returned to inventory.`,
      );
    } catch (e: any) {
      setError(e.message);
      setConfirming(false);
      setSaving(false);
    }
  };

  return (
    <Modal
      title={ACTION_COPY[action].title}
      subtitle={`${allocation.packingNumber} · ${allocation.record?.garment || ''}`}
      onClose={onClose}
      footer={
        confirming || !needsQty ? (
          <>
            <button type="button" onClick={() => (needsQty ? setConfirming(false) : onClose())} className={BTN_QUIET} disabled={saving}>{needsQty ? 'Back' : 'Cancel'}</button>
            <button type="button" onClick={submit} className={BTN_PRIMARY} disabled={saving}>{saving ? 'Saving…' : ACTION_COPY[action].button}</button>
          </>
        ) : (
          <>
            <button type="button" onClick={onClose} className={BTN_QUIET}>Cancel</button>
            <button type="button" onClick={() => (invalid ? setError(invalid) : (setError(null), setConfirming(true)))} className={BTN_PRIMARY}>Review</button>
          </>
        )
      }
    >
      {error && <Notice kind="error">{error}</Notice>}
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm">
        <Fact label="Sent for packing" value={pcs(allocation.quantity)} />
        <Fact label="Packed" value={pcs(allocation.packedQuantity)} />
        <Fact label="Returned" value={pcs(allocation.returnedQuantity)} />
        <Fact label="Still to pack" value={pcs(allocation.open)} strong />
      </dl>
      {needsQty && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs font-semibold text-neutral-600">{action === 'PACK' ? 'Pieces packed now (PCS)' : 'Pieces to return (PCS)'}</span>
            <input type="number" min="1" step="1" max={allocation.open} value={quantity} onChange={(e) => setQuantity(e.target.value)} disabled={confirming} className={`${FIELD} mt-1 text-right tabular-nums`} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-neutral-600">{action === 'RETURN' ? 'Reason (required)' : 'Remarks'}</span>
            <input value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={500} disabled={confirming} className={`${FIELD} mt-1`} />
          </label>
        </div>
      )}
      {!needsQty && <p className="text-sm text-neutral-700">Mark {allocation.packingNumber} ({pcs(allocation.open)}) as being packed now.</p>}
      {confirming && needsQty && (
        <Notice kind="success">
          {action === 'PACK'
            ? `Record ${pcs(q)} packed on ${allocation.packingNumber}. ${pcs(allocation.open - q)} will still be open${allocation.open - q === 0 ? ' and packing will be completed' : ''}.`
            : `Return ${pcs(q)} unpacked from ${allocation.packingNumber} to available inventory.`}
        </Notice>
      )}
    </Modal>
  );
}

/** Buttons for one packing reference, by what it allows now. */
export function PackingActions({ allocation, onAction }: { allocation: any; onAction: (action: 'START' | 'PACK' | 'RETURN') => void }) {
  if (allocation.open <= 0) return null;
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {allocation.status === 'SENT_FOR_PACKING' && (
        <button type="button" onClick={() => onAction('START')} className={BTN_QUIET}>
          <Play className="w-3.5 h-3.5" />
          <span>Start</span>
        </button>
      )}
      <button type="button" onClick={() => onAction('PACK')} className={BTN_SECONDARY}>
        <PackageCheck className="w-3.5 h-3.5" />
        <span>Record Packed</span>
      </button>
      <button type="button" onClick={() => onAction('RETURN')} className={BTN_QUIET}>
        <Undo2 className="w-3.5 h-3.5" />
        <span>Return</span>
      </button>
    </div>
  );
}

/** Upload or replace the complete-garment image of this record's design and category (and style). */
function ImageUploader({ record, onUploaded }: { record: any; onUploaded: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set('programId', record.programId);
      form.set('garmentCategory', record.garmentCategory || '');
      form.set('styleRef', record.styleRef || '');
      form.set('file', file);
      await fetchJson(`${API}/garment-images`, { method: 'POST', body: form });
      onUploaded();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  return (
    <div className="space-y-1.5">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label="Garment image file"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      <button type="button" onClick={() => input.current?.click()} disabled={busy} className={`${BTN_QUIET} w-full`}>
        <Upload className="w-3.5 h-3.5" />
        <span>{busy ? 'Uploading…' : record.image ? 'Replace garment image' : 'Upload garment image'}</span>
      </button>
      <p className="text-[11px] text-neutral-500">
        JPG, PNG or WebP up to 2 MB. Applies to {sheetRef(record.program)} · {record.garmentCategory ? CATEGORY_LABEL[record.garmentCategory as keyof typeof CATEGORY_LABEL] : 'this garment'}
        {record.styleRef ? ` · ${record.styleRef}` : ''}.
      </p>
      {error && <p className="text-[11px] font-semibold text-danger-700">{error}</p>}
    </div>
  );
}

/** Full details of one record: image, documents, quantities, packing references and transactions. */
export function RecordDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged?: () => void }) {
  const [record, setRecord] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [acting, setActing] = useState<{ allocation: any; action: 'START' | 'PACK' | 'RETURN' } | null>(null);

  const load = async () => {
    try {
      const body = await fetchJson(`${API}/items/${id}`);
      setRecord(body.data);
    } catch (e: any) {
      setError(e.message);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const changed = (message: string) => {
    setNotice(message);
    setSending(false);
    setActing(null);
    load();
    onChanged?.();
  };
  const s = record?.stock;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-neutral-900/40" role="dialog" aria-modal="true" aria-label="Garment details">
      <div className="bg-white w-full max-w-3xl h-full overflow-y-auto shadow-xl border-l border-neutral-200">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-start justify-between gap-3 sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-sm font-bold text-neutral-900">{record?.garment || 'Garment'}</h3>
            <p className="text-xs text-neutral-500 font-mono">{record?.inboundChallan?.challanNumber ? `Challan ${record.inboundChallan.challanNumber}` : ''}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-neutral-500 hover:bg-neutral-100 rounded-lg" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-5">
          {error && <Notice kind="error" onClose={() => setError(null)}>{error}</Notice>}
          {notice && <Notice kind="success" onClose={() => setNotice(null)}>{notice}</Notice>}
          {!record && !error && <p className="text-sm text-neutral-500">Loading…</p>}
          {record && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-5">
                <div className="space-y-2">
                  <GarmentImage image={record.image} alt={record.garment} size="lg" />
                  <ImageUploader record={record} onUploaded={() => changed('Garment image saved.')} />
                </div>
                <div className="space-y-4">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <Fact label="Design" value={record.program?.designNumber || record.program?.wilcomDesignNumber || '—'} />
                    <Fact label="Serial" value={record.program?.programSerialNo || '—'} />
                    <Fact label="Production Sheet" value={sheetRef(record.program)} />
                    <Fact label="Category / Style" value={[record.garmentCategory ? CATEGORY_LABEL[record.garmentCategory as keyof typeof CATEGORY_LABEL] : null, record.styleRef].filter(Boolean).join(' · ') || '—'} />
                    <Fact label="Colour" value={record.colour || '—'} />
                    <Fact label="Status" value={<InventoryStatusBadge status={record.status} />} />
                    <Fact
                      label="Final QC challan"
                      value={record.inboundChallan ? <Link href={`/challans/${record.inboundChallan.id}`} className="font-mono text-brand-800 hover:underline">{record.inboundChallan.challanNumber}</Link> : '—'}
                    />
                    <Fact label="Department incharge" value={record.inboundChallan?.issuedBy?.fullName || '—'} />
                    <Fact label="Received" value={`${fmtDate(record.receivedAt, true)}${record.receivedBy ? ` · ${record.receivedBy.fullName}` : ''}`} />
                    <Fact label="Priority / Delivery" value={<span className="inline-flex items-center gap-2"><PriorityBadge priority={record.priority} /><DeadlineText program={record.program} /></span>} />
                  </dl>
                  {record.receiptRemarks && <p className="text-xs text-danger-700">Receipt: {record.receiptRemarks}</p>}
                  <div className="flex flex-wrap items-center gap-2">
                    <DocumentsButton programId={record.programId} challanId={record.inboundChallan?.id} />
                    {s.available > 0 && (
                      <button type="button" onClick={() => setSending(true)} className={BTN_PRIMARY}>
                        <Send className="w-3.5 h-3.5" />
                        <span>Send for Packing</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <dl className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-sm border border-neutral-200 rounded-xl p-3">
                <Fact label="Dispatched" value={pcs(record.dispatchedQuantity)} />
                <Fact label="Received" value={pcs(s.received)} />
                <Fact label="Available" value={pcs(s.available)} strong />
                <Fact label="In packing" value={pcs(s.inPacking)} />
                <Fact label="Packed" value={pcs(s.packed)} />
                <Fact label="Remaining" value={pcs(s.remaining)} />
              </dl>

              {/* Fabric photos from Embroidery, Threadcut QC and Stitching for this Production Sheet. */}
              <FabricPhotos workItemId={record.id} />

              <section>
                <h4 className="text-xs font-semibold text-neutral-600 mb-2">Packing References</h4>
                <div className="overflow-x-auto border border-neutral-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className={THEAD}>
                      <tr>
                        <th className="py-2.5 px-3">Reference</th>
                        <th className="py-2.5 px-3">Packing date</th>
                        <th className="py-2.5 px-3 text-right">Sent</th>
                        <th className="py-2.5 px-3 text-right">Packed</th>
                        <th className="py-2.5 px-3 text-right">Returned</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {record.allocations.length === 0 && (
                        <tr><td colSpan={7} className="px-3 py-6 text-center text-neutral-500">Not sent for packing yet</td></tr>
                      )}
                      {record.allocations.map((a: any) => (
                        <tr key={a.id} className="align-top">
                          <td className="py-2.5 px-3 font-mono font-semibold">
                            {a.packingNumber}
                            <span className="block font-sans text-[11px] text-neutral-500">{a.createdBy?.fullName || ''}</span>
                          </td>
                          <td className="py-2.5 px-3">{fmtDate(a.packingDate)}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums">{pcs(a.quantity)}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums">{pcs(a.packedQuantity)}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums">{pcs(a.returnedQuantity)}</td>
                          <td className="py-2.5 px-3"><AllocationStatusBadge status={a.status} /></td>
                          <td className="py-2.5 px-3"><PackingActions allocation={a} onAction={(action) => setActing({ allocation: { ...a, record }, action })} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <h4 className="text-xs font-semibold text-neutral-600 mb-2">Transactions</h4>
                <ul className="space-y-1.5 text-xs">
                  {record.transactions.map((t: any) => (
                    <li key={t.id} className="flex flex-wrap justify-between gap-2 border border-neutral-200 rounded-lg px-3 py-2">
                      <span>
                        <span className="font-semibold text-neutral-900">{ledgerLabel(t.entryType)}</span>
                        {t.quantity !== 0 && <span className="tabular-nums text-neutral-700"> · {t.quantity > 0 && t.entryType !== 'PACKED' ? '+' : ''}{pcs(t.quantity)}</span>}
                        {t.notes && <span className="block text-neutral-500">{t.notes}</span>}
                      </span>
                      <span className="text-neutral-500 whitespace-nowrap">{fmtDate(t.createdAt, true)} · {t.actor?.fullName || '—'}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>
      </div>
      {sending && record && <SendForPackingDialog record={record} onClose={() => setSending(false)} onDone={changed} />}
      {acting && <PackingActionDialog allocation={acting.allocation} action={acting.action} onClose={() => setActing(null)} onDone={changed} />}
    </div>
  );
}

/** Garment category select used by the filters. */
export function CategorySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${FIELD} mt-1`}>
      <option value="">Any</option>
      {CATEGORY_OPTIONS.map((c) => (
        <option key={c.value} value={c.value}>{c.label}</option>
      ))}
    </select>
  );
}
