'use client';

import React from 'react';

interface StatusBadgeProps {
  status: string;
  type?: 'challan' | 'program' | 'priority' | 'quality';
}

// Theme mapping: done = lavender, in progress = chartreuse, needs attention = solid
// chartreuse, failed/rejected = tomato, everything else (pending, on hold) = neutral.
export function StatusBadge({ status, type = 'challan' }: StatusBadgeProps) {
  let colorClass = 'bg-white text-neutral-700 border-neutral-300';

  const s = (status || '').toUpperCase();

  if (s === 'APPROVED' || s === 'COMPLETED' || s === 'PASSED' || s === 'QC_APPROVED' || s === 'CLOSED') {
    colorClass = 'bg-brand-50 text-brand-800 border-brand-200';
  } else if (s === 'IN_PRODUCTION' || s === 'IN_PROCESS' || s === 'RECEIVED' || s === 'ISSUED') {
    colorClass = 'bg-accent-100 text-accent-800 border-accent-500';
  } else if (s === 'QC_PENDING' || s === 'SUBMITTED' || s === 'NORMAL' || s === 'MEDIUM') {
    colorClass = 'bg-white text-neutral-700 border-neutral-300';
  } else if (s === 'REWORK' || s === 'HIGH' || s === 'URGENT') {
    colorClass = 'bg-accent-400 text-neutral-900 border-accent-600';
  } else if (s === 'FAILED' || s === 'REJECTED') {
    colorClass = 'bg-danger-50 text-danger-700 border-danger-300';
  } else if (s === 'CANCELLED' || s === 'ON_HOLD') {
    colorClass = 'bg-neutral-100 text-neutral-600 border-neutral-200';
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium border ${colorClass}`}>
      {status}
    </span>
  );
}
