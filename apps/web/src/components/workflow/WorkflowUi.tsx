'use client';

import React, { useState } from 'react';
import { FileText, RefreshCw } from 'lucide-react';
import { DocumentActionButtons } from '@/components/common/DocumentActionButtons';
import { qcStatusLabel, workStatusLabel } from '@/lib/work-items.mjs';
import { generateRawBarcodeSvg } from '@/lib/barcode';

// Shared building blocks for department workflow screens (Dyeing, Embroidery, Thread Cutting ...).

/** Quantity with its unit; meters keep two decimals, pieces none. */
export function fmtQty(value: number | null | undefined, unit?: string | null) {
  const n = Number(value) || 0;
  const digits = unit === 'PCS' ? 0 : 2;
  return `${n.toLocaleString('en-IN', { maximumFractionDigits: digits })} ${unit || ''}`.trim();
}

export function fmtDate(value: string | Date | null | undefined, withTime = false) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return withTime
    ? d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** The challan a work line came in on, as typed on that challan (e.g. "Challan 100"); '' when unknown. */
export function challanRef(item: any) {
  const n = item?.inboundChallan?.challanNumber;
  return n ? `Challan ${n}` : '';
}

export function sheetRef(program: any) {
  return program?.programSerialNo || program?.programNumber || '—';
}

export function isOverdue(program: any) {
  return Boolean(program?.deliveryDate && new Date(program.deliveryDate) < new Date());
}

const WORK_TONE: Record<string, string> = {
  AWAITING_RECEIPT: 'bg-neutral-100 text-neutral-700',
  RECEIVED: 'bg-neutral-100 text-neutral-900',
  IN_PROGRESS: 'bg-brand-50 text-brand-800',
  COMPLETED: 'bg-brand-100 text-brand-900',
  READY_FOR_TRANSFER: 'bg-accent-100 text-neutral-900',
  PARTIALLY_TRANSFERRED: 'bg-accent-50 text-neutral-900',
  TRANSFERRED: 'bg-neutral-100 text-neutral-500',
};

/** Status of a department work item; `next` names the receiving department ("Ready for …"); `qc` uses inspection names. */
export function WorkStatusBadge({
  status,
  next,
  qc,
  label,
  dispatch,
}: {
  status: string;
  next?: string;
  qc?: boolean;
  label?: string;
  /** Transfers read as "Partially Dispatched" / "Dispatched to <next>". */
  dispatch?: boolean;
}) {
  const dispatched = dispatch ? (status === 'PARTIALLY_TRANSFERRED' ? 'Partially Dispatched' : status === 'TRANSFERRED' ? `Dispatched to ${next}` : null) : null;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${WORK_TONE[status] || 'bg-neutral-100 text-neutral-700'}`}>
      {label || dispatched || (qc ? qcStatusLabel(status) : workStatusLabel(status, next))}
    </span>
  );
}

/** Dyed / Undyed, always shown the same way so the two are never confused. */
export function FabricStatusBadge({ status }: { status?: string | null }) {
  if (status !== 'DYED' && status !== 'UNDYED') return <span className="text-neutral-400">—</span>;
  return status === 'DYED' ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-brand-600 text-white whitespace-nowrap">Dyed</span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-white text-neutral-800 border border-neutral-400 whitespace-nowrap">Undyed</span>
  );
}

export function PriorityBadge({ priority }: { priority?: string | null }) {
  if (!priority || priority === 'NORMAL') return <span className="text-xs text-neutral-500">Normal</span>;
  const tone = priority === 'URGENT' ? 'bg-danger-50 text-danger-700' : priority === 'HIGH' ? 'bg-brand-50 text-brand-800' : 'bg-neutral-100 text-neutral-600';
  return <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold ${tone}`}>{priority.charAt(0) + priority.slice(1).toLowerCase()}</span>;
}

export function DeadlineText({ program }: { program: any }) {
  if (!program?.deliveryDate) return <span className="text-neutral-400">—</span>;
  return <span className={isOverdue(program) ? 'font-semibold text-danger-700' : 'text-neutral-700'}>{fmtDate(program.deliveryDate)}</span>;
}

export function PageHeader({
  title,
  loading,
  onRefresh,
  children,
}: {
  title: string;
  loading?: boolean;
  onRefresh?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <header className="bg-white/90 backdrop-blur border-b border-neutral-200 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <h1 className="text-xl font-bold text-neutral-900">{title}</h1>
      <div className="flex flex-wrap items-center gap-2">
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition"
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
        {children}
      </div>
    </header>
  );
}

export function Panel({
  title,
  count,
  actions,
  children,
}: {
  title: string;
  count?: number;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-neutral-200 rounded-2xl shadow-xs overflow-hidden">
      <div className="px-5 py-4 border-b border-neutral-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-neutral-900">{title}</h2>
          {count !== undefined && (
            <span className="text-[11px] font-semibold tabular-nums bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">{count}</span>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export const THEAD = 'bg-neutral-50 border-b border-neutral-200 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 whitespace-nowrap';
export const FIELD =
  'h-9 w-full px-3 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition';
export const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-xs transition disabled:opacity-50 cursor-pointer';
export const BTN_SECONDARY =
  'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white hover:bg-brand-50 text-brand-800 border border-brand-300 text-xs font-semibold rounded-lg transition disabled:opacity-50 cursor-pointer';
export const BTN_QUIET =
  'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-200 text-xs font-semibold rounded-lg transition disabled:opacity-50 cursor-pointer';

export function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-sm font-medium text-neutral-500">
        {text}
      </td>
    </tr>
  );
}

export function Notice({ kind, children, onClose }: { kind: 'error' | 'success'; children: React.ReactNode; onClose?: () => void }) {
  const tone = kind === 'error' ? 'bg-danger-50 border-danger-200 text-danger-800' : 'bg-white border-accent-300 text-neutral-900';
  return (
    <div className={`px-4 py-3 border rounded-xl text-sm flex items-start justify-between gap-3 ${tone}`} role={kind === 'error' ? 'alert' : 'status'}>
      <div>{children}</div>
      {onClose && (
        <button onClick={onClose} className="text-xs font-semibold opacity-70 hover:opacity-100" aria-label="Dismiss">
          Close
        </button>
      )}
    </div>
  );
}

/**
 * View / print / download for the Production Sheet and a challan. List endpoints only carry summary
 * fields, so the full records are loaded on first use.
 */
export function DocumentsButton({ programId, challanId }: { programId?: string | null; challanId?: string | null }) {
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [program, setProgram] = useState<any>(null);
  const [challan, setChallan] = useState<any>(null);

  const load = async () => {
    setState('loading');
    try {
      const [p, c] = await Promise.all([
        programId ? fetch(`/api/programs/${programId}`).then((r) => (r.ok ? r.json() : null)) : null,
        challanId ? fetch(`/api/challans/${challanId}`).then((r) => (r.ok ? r.json() : null)) : null,
      ]);
      if (!p && !c) throw new Error('not found');
      setProgram(p);
      setChallan(c);
      setState('ready');
    } catch {
      setState('error');
    }
  };

  if (state === 'ready') return <DocumentActionButtons program={program} challan={challan} size="xs" />;
  return (
    <button type="button" onClick={load} disabled={state === 'loading'} className={BTN_QUIET} title="View, print or download documents">
      <FileText className="w-3.5 h-3.5" />
      <span>{state === 'loading' ? 'Loading…' : state === 'error' ? 'Retry' : 'Documents'}</span>
    </button>
  );
}

/** Code-128 barcode of a challan number (same encoding as the printed challan). */
export function ChallanBarcode({ value }: { value: string }) {
  return (
    <div
      className="inline-block bg-white border border-neutral-200 rounded-lg p-1.5"
      aria-label={`Barcode ${value}`}
      dangerouslySetInnerHTML={{ __html: generateRawBarcodeSvg(value, value, 220, 60) }}
    />
  );
}

/** JSON response or a readable error. */
export async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error || `Request failed (${res.status})`), { body, status: res.status });
  return body;
}
