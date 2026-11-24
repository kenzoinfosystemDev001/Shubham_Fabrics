'use client';

import React from 'react';
import { DYEING_STATUS_LABEL } from '@/lib/dyeing-workflow.mjs';

// Dyeing screens use the shared workflow building blocks plus the Dyeing-specific pieces below.
// (Client modules cannot use `export *`, so the shared names are listed.)
export {
  fmtQty,
  fmtDate,
  sheetRef,
  isOverdue,
  PriorityBadge,
  DeadlineText,
  PageHeader,
  Panel,
  THEAD,
  FIELD,
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_QUIET,
  EmptyRow,
  Notice,
  DocumentsButton,
  ChallanBarcode,
  fetchJson,
} from '@/components/workflow/WorkflowUi';

/** Colour of the fabric before dyeing, from the order's Store -> Dyeing challan line. */
export function baseColour(order: any): string | null {
  const item = order?.inboundChallan?.items?.find((i: any) => i.id === order.inboundChallanItemId);
  return item?.colour || item?.shade || null;
}

const STATUS_TONE: Record<string, string> = {
  AWAITING_RECEIPT: 'bg-neutral-100 text-neutral-700',
  RECEIVED: 'bg-neutral-100 text-neutral-900',
  IN_DYEING: 'bg-brand-50 text-brand-800',
  PARTIALLY_DYED: 'bg-brand-50 text-brand-800',
  DYED: 'bg-brand-100 text-brand-900',
  READY_FOR_QC1: 'bg-accent-100 text-neutral-900',
  PARTIALLY_SENT_TO_QC1: 'bg-accent-50 text-neutral-900',
  SENT_TO_QC1: 'bg-neutral-100 text-neutral-500',
};

export function StatusBadge({ status }: { status: string }) {
  const label = (DYEING_STATUS_LABEL as Record<string, string>)[status] || String(status || '').replace(/_/g, ' ');
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${STATUS_TONE[status] || 'bg-neutral-100 text-neutral-700'}`}>
      {label}
    </span>
  );
}
