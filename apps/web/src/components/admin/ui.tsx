'use client';

import React, { useEffect, useId, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';

/* Shared building blocks for the Admin console. Colours come from the MES theme tokens:
 * lavender = primary, chartreuse = positive / secondary highlight, tomato = destructive / critical. */

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="text-lg font-bold text-ink-900">{title}</h1>
        {description && <p className="text-xs text-ink-500 mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`bg-white border border-ink-200 rounded-xl ${className}`}>{children}</section>;
}

export function FilterBar({ children, onReset }: { children: React.ReactNode; onReset?: () => void }) {
  return (
    <Panel className="p-3 mb-4">
      <div className="flex flex-wrap items-end gap-2.5">
        {children}
        {onReset && (
          <button type="button" onClick={onReset} className="mes-btn-secondary h-9">
            Reset
          </button>
        )}
      </div>
    </Panel>
  );
}

export function Field({ label, children, className = '' }: { label: string; children: (id: string) => React.ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-[10px] font-bold uppercase tracking-wider text-ink-600">
        {label}
      </label>
      {children(id)}
    </div>
  );
}

export function TextInput({ label, value, onChange, placeholder, type = 'text', className = 'w-44' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string;
}) {
  return (
    <Field label={label} className={className}>
      {(id) => <input id={id} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="mes-input" />}
    </Field>
  );
}

export function SelectInput({ label, value, onChange, options, className = 'w-44', allLabel = 'All' }: {
  label: string; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }>; className?: string; allLabel?: string | null;
}) {
  return (
    <Field label={label} className={className}>
      {(id) => (
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="mes-input">
          {allLabel !== null && <option value="">{allLabel}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string | null; onRetry?: () => void }) {
  if (!message) return null;
  return (
    <div role="alert" className="mb-4 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-tomato-50 border border-tomato-200 text-xs text-tomato-800">
      <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">{message}</span>
      {onRetry && <button type="button" onClick={onRetry} className="font-bold underline">Retry</button>}
    </div>
  );
}

export function Notice({ message, onClose }: { message: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [message, onClose]);
  if (!message) return null;
  return (
    <div role="status" className="fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-lg bg-ink-900 text-white text-xs font-semibold shadow-lg">
      {message}
    </div>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-6 text-xs text-ink-500">
      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
      {label}
    </div>
  );
}

export function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-xs text-ink-500">{label}</td>
    </tr>
  );
}

/** Compact table shell with consistent header styling. */
export function DataTable({ head, children, loading }: { head: React.ReactNode; children: React.ReactNode; loading?: boolean }) {
  return (
    <Panel className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className={`w-full text-left text-xs ${loading ? 'opacity-60' : ''}`}>
          <thead className="bg-ink-50 text-ink-600 text-[10px] font-bold uppercase tracking-wider border-b border-ink-200">
            <tr>{head}</tr>
          </thead>
          <tbody className="divide-y divide-ink-100 text-ink-800">{children}</tbody>
        </table>
      </div>
    </Panel>
  );
}

export const Th = ({ children, className = '' }: { children?: React.ReactNode; className?: string }) => (
  <th scope="col" className={`py-2.5 px-3 whitespace-nowrap ${className}`}>{children}</th>
);
export const Td = ({ children, className = '' }: { children?: React.ReactNode; className?: string }) => (
  <td className={`py-2.5 px-3 align-top ${className}`}>{children}</td>
);

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between gap-2 px-1 py-3 text-xs text-ink-600">
      <span>
        {total === 0 ? 'No records' : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
      </span>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} className="mes-btn-secondary h-8 px-2" aria-label="Previous page">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="px-2 font-semibold">{page} / {pages}</span>
        <button type="button" onClick={() => onPage(page + 1)} disabled={page >= pages} className="mes-btn-secondary h-8 px-2" aria-label="Next page">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  // positive / finished
  COMPLETED: 'bg-chartreuse-100 text-chartreuse-800 border-chartreuse-300',
  CLOSED: 'bg-chartreuse-100 text-chartreuse-800 border-chartreuse-300',
  QC_APPROVED: 'bg-chartreuse-100 text-chartreuse-800 border-chartreuse-300',
  HANDED_OVER: 'bg-chartreuse-100 text-chartreuse-800 border-chartreuse-300',
  PASS: 'bg-chartreuse-100 text-chartreuse-800 border-chartreuse-300',
  ACTIVE: 'bg-lavender-50 text-lavender-800 border-lavender-200',
  RESOLVED: 'bg-ink-100 text-ink-700 border-ink-200',
  SUPERSEDED: 'bg-ink-100 text-ink-700 border-ink-200',
  // critical
  CANCELLED: 'bg-tomato-50 text-tomato-700 border-tomato-200',
  REJECTED: 'bg-tomato-50 text-tomato-700 border-tomato-200',
  QC_REJECTED: 'bg-tomato-50 text-tomato-700 border-tomato-200',
  REJECT: 'bg-tomato-50 text-tomato-700 border-tomato-200',
  INACTIVE: 'bg-tomato-50 text-tomato-700 border-tomato-200',
  OVERDUE: 'bg-tomato-500 text-white border-tomato-500',
  CRITICAL: 'bg-tomato-500 text-white border-tomato-500',
};

export function StatusBadge({ status, label }: { status: string | null | undefined; label?: string }) {
  const key = String(status || '').toUpperCase();
  const tone = STATUS_TONE[key] || 'bg-lavender-50 text-lavender-800 border-lavender-200';
  return (
    <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${tone}`}>
      {label || key.replace(/_/g, ' ') || '—'}
    </span>
  );
}

/** Quantities per unit, e.g. "120 MTR · 45 PCS". Never adds different units together. */
export function QtyByUnit({ totals, empty = '0' }: { totals: Record<string, number> | null | undefined; empty?: string }) {
  const entries = Object.entries(totals || {}).filter(([, v]) => v !== 0);
  if (entries.length === 0) return <span>{empty}</span>;
  return (
    <span className="whitespace-nowrap">
      {entries.map(([unit, qty], i) => (
        <span key={unit}>
          {i > 0 && <span className="text-ink-400"> · </span>}
          {qty.toLocaleString('en-IN', { maximumFractionDigits: 2 })} <span className="text-[0.75em] font-semibold text-ink-500">{unit}</span>
        </span>
      ))}
    </span>
  );
}

/**
 * Confirmation for destructive or corrective actions. Can require a written reason and a
 * typed confirmation phrase; the reason is passed to onConfirm for the audit log.
 */
export function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirm', danger = false, requireReason = false, requirePhrase, busy = false, error, onConfirm, onCancel,
}: {
  open: boolean; title: string; message: React.ReactNode; confirmLabel?: string; danger?: boolean; requireReason?: boolean; requirePhrase?: string;
  busy?: boolean; error?: string | null; onConfirm: (reason: string) => void; onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const [phrase, setPhrase] = useState('');
  const reasonId = useId();
  const phraseId = useId();
  useEffect(() => {
    if (open) {
      setReason('');
      setPhrase('');
    }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);
  if (!open) return null;
  const ready = (!requireReason || reason.trim().length >= 5) && (!requirePhrase || phrase.trim() === requirePhrase);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/60" role="dialog" aria-modal="true" aria-labelledby={`${reasonId}-title`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (ready && !busy) onConfirm(reason.trim());
        }}
        className="w-full max-w-md bg-white rounded-xl border border-ink-200 shadow-xl p-5 space-y-3"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={`${reasonId}-title`} className="text-sm font-bold text-ink-900">{title}</h2>
          <button type="button" onClick={onCancel} disabled={busy} className="p-1 rounded text-ink-500 hover:bg-ink-100" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="text-xs text-ink-700 space-y-2">{message}</div>
        {requireReason && (
          <div className="space-y-1">
            <label htmlFor={reasonId} className="text-[10px] font-bold uppercase tracking-wider text-ink-600">Reason (kept in the audit log)</label>
            <textarea id={reasonId} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="mes-input h-auto py-2" required minLength={5} />
          </div>
        )}
        {requirePhrase && (
          <div className="space-y-1">
            <label htmlFor={phraseId} className="text-[10px] font-bold uppercase tracking-wider text-ink-600">
              Type <span className="font-mono text-tomato-700">{requirePhrase}</span> to confirm
            </label>
            <input id={phraseId} value={phrase} onChange={(e) => setPhrase(e.target.value)} className="mes-input font-mono" autoComplete="off" />
          </div>
        )}
        {error && <p role="alert" className="text-xs font-semibold text-tomato-700">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCancel} disabled={busy} className="mes-btn-secondary">Cancel</button>
          <button type="submit" disabled={!ready || busy} className={danger ? 'mes-btn-danger' : 'mes-btn-primary'}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
