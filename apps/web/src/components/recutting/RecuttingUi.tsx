'use client';

import React from 'react';
import { fmtQty } from '@/components/workflow/WorkflowUi';
import { ALLOCATION_STATUS_LABEL, CATEGORY_LABEL } from '@/lib/recutting.mjs';

// Recutting building blocks: the four garment categories stay visually distinct everywhere.

export const CATEGORY_TONE: Record<string, { badge: string; section: string }> = {
  TOP: { badge: 'bg-brand-600 text-white', section: 'border-l-brand-500' },
  BOTTOM: { badge: 'bg-accent-300 text-neutral-900', section: 'border-l-accent-500' },
  DUPATTA: { badge: 'bg-neutral-800 text-white', section: 'border-l-neutral-700' },
  OTHERS: { badge: 'bg-white text-neutral-800 border border-neutral-400', section: 'border-l-neutral-300' },
};

export function CategoryBadge({ category, otherName }: { category: string; otherName?: string | null }) {
  const label = (CATEGORY_LABEL as Record<string, string>)[category] || category;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap ${CATEGORY_TONE[category]?.badge || 'bg-neutral-100 text-neutral-700'}`}>
      {label}
      {category === 'OTHERS' && otherName ? `: ${otherName}` : ''}
    </span>
  );
}

/** Category and style of a garment line (Stitching onward); nothing for plain fabric lines. */
export function GarmentTag({ item }: { item: any }) {
  if (!item?.garmentCategory) return null;
  return (
    <span className="flex flex-wrap items-center gap-1 mt-1">
      <CategoryBadge category={item.garmentCategory} otherName={item.sourceAllocation?.otherName} />
      {item.styleRef && <span className="text-[11px] font-semibold text-neutral-800">{item.styleRef}</span>}
    </span>
  );
}

const STATUS_TONE: Record<string, string> = {
  ALLOCATED: 'bg-neutral-100 text-neutral-800',
  CUT: 'bg-brand-50 text-brand-800',
  PARTIALLY_TRANSFERRED: 'bg-accent-50 text-neutral-900',
  TRANSFERRED: 'bg-accent-100 text-neutral-900',
  CANCELLED: 'bg-danger-50 text-danger-700',
};

export function AllocationStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${STATUS_TONE[status] || 'bg-neutral-100 text-neutral-700'}`}>
      {(ALLOCATION_STATUS_LABEL as Record<string, string>)[status] || status}
    </span>
  );
}

/** Quantities per unit, e.g. "120 MTR · 40 PCS" (never one combined number). */
export function fmtTotals(totals?: Record<string, number> | null) {
  const parts = Object.entries(totals || {}).filter(([, q]) => q > 0).map(([u, q]) => fmtQty(q, u));
  return parts.length ? parts.join(' · ') : '—';
}

/** Style suggestions from the Production Sheet (never invented). */
export function sheetStyles(program: any): string[] {
  return Array.from(new Set([program?.styleCode, program?.mainStyle, program?.subStyle].filter((s) => typeof s === 'string' && s.trim()))) as string[];
}
