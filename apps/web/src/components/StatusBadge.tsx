'use client';

import React from 'react';

interface StatusBadgeProps {
  status: string;
  type?: 'challan' | 'program' | 'priority' | 'quality';
}

export function StatusBadge({ status, type = 'challan' }: StatusBadgeProps) {
  let colorClass = 'bg-slate-800 text-slate-300 border-slate-700';

  const s = (status || '').toUpperCase();

  if (s === 'APPROVED' || s === 'COMPLETED' || s === 'PASSED' || s === 'QC_APPROVED' || s === 'CLOSED') {
    colorClass = 'bg-emerald-950/80 text-emerald-400 border-emerald-800';
  } else if (s === 'IN_PRODUCTION' || s === 'IN_PROCESS' || s === 'RECEIVED' || s === 'ISSUED') {
    colorClass = 'bg-blue-950/80 text-blue-400 border-blue-800';
  } else if (s === 'QC_PENDING' || s === 'SUBMITTED' || s === 'NORMAL' || s === 'MEDIUM') {
    colorClass = 'bg-amber-950/80 text-amber-400 border-amber-800';
  } else if (s === 'REWORK' || s === 'HIGH' || s === 'URGENT') {
    colorClass = 'bg-orange-950/80 text-orange-400 border-orange-800';
  } else if (s === 'FAILED' || s === 'REJECTED' || s === 'CANCELLED' || s === 'ON_HOLD') {
    colorClass = 'bg-rose-950/80 text-rose-400 border-rose-800';
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium border ${colorClass}`}>
      {status}
    </span>
  );
}
