'use client';

import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';

/**
 * A bar at the top of an issue-challan screen: one button per Production Sheet the user is working
 * with. Each opens the full sheet (view, print, download) while the challan is being filled.
 */
export function ProductionSheetQuickView({
  sheets,
  title = 'Production Sheet',
  emptyText = 'No Production Sheet to show yet.',
}: {
  sheets: any[];
  title?: string;
  emptyText?: string;
}) {
  const [open, setOpen] = useState<any | null>(null);
  const unique = Array.from(new Map((sheets || []).filter((s) => s?.id).map((s) => [s.id, s])).values());

  return (
    <section className="bg-white border border-brand-200 rounded-2xl shadow-xs px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-center gap-2 shrink-0">
        <span className="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center">
          <FileText className="w-4 h-4" />
        </span>
        <div>
          <h2 className="text-sm font-bold text-neutral-900">{title}</h2>
          <p className="text-[11px] text-neutral-500">Open the sheet while filling the challan.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 sm:ml-auto">
        {unique.length === 0 && <span className="text-xs text-neutral-500">{emptyText}</span>}
        {unique.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setOpen(s)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-800 border border-brand-300 rounded-lg text-xs font-bold transition cursor-pointer"
            title="View, print or download this Production Sheet"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="font-mono">{s.programSerialNo || s.programNumber || 'Sheet'}</span>
            {s.designNumber && <span className="font-normal text-brand-700">· {s.designNumber}</span>}
          </button>
        ))}
      </div>
      {open && <ProductionSheetPrintModal program={open} isOpen={Boolean(open)} onClose={() => setOpen(null)} />}
    </section>
  );
}
