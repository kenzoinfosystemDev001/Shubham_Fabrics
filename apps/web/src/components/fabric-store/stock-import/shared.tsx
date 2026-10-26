'use client';

import React from 'react';

const STATUS_STYLE: Record<string, string> = {
  POSTED: 'bg-brand-50 text-brand-800 border-brand-200',
  READY_FOR_CONFIRMATION: 'bg-accent-100 text-accent-800 border-accent-500',
  NEEDS_CORRECTION: 'bg-accent-400 text-neutral-900 border-accent-600',
  PARSED: 'bg-white text-neutral-700 border-neutral-300',
  FAILED: 'bg-danger-50 text-danger-700 border-danger-300',
  CANCELLED: 'bg-neutral-100 text-neutral-600 border-neutral-200',
};

const STATUS_LABEL: Record<string, string> = {
  UPLOADED: 'Uploaded',
  PARSING: 'Reading',
  PARSED: 'Needs mapping',
  VALIDATING: 'Validating',
  NEEDS_CORRECTION: 'Needs correction',
  READY_FOR_CONFIRMATION: 'Ready to confirm',
  POSTING: 'Posting',
  POSTED: 'Posted',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
};

export function ImportStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${STATUS_STYLE[status] || 'bg-white text-neutral-700 border-neutral-300'}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 3 });

/** "295 MTR · 40 PCS": one figure per unit, never summed across units. */
export function formatQuantities(byUnit: Record<string, number> | null | undefined): string {
  const entries = Object.entries(byUnit || {});
  return entries.length ? entries.map(([unit, qty]) => `${fmt(qty)} ${unit}`).join(' · ') : '—';
}

export function formatWhen(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export { fmt as formatNumber };
