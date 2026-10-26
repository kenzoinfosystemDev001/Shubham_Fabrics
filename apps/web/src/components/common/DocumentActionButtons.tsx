'use client';

import React, { useState } from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  Sparkles,
} from 'lucide-react';
import { 
  downloadProductionSheetHtml, 
  printProductionSheet,
  productionSheetCategoriesForViewer,
} from '@/lib/download-production-sheet';
import { 
  downloadChallanHtml, 
  printChallan 
} from '@/lib/download-challan';
import { 
  downloadWilcomFormHtml, 
  printWilcomForm 
} from '@/lib/download-wilcom';
import { ProductionSheetPrintModal } from '@/components/production-sheet/ProductionSheetPrintModal';
import { ChallanPrintModal } from '@/components/challan/ChallanPrintModal';
import { WilcomPrintModal } from '@/components/wilcom/WilcomPrintModal';

interface DocumentActionButtonsProps {
  program?: any;
  challan?: any;
  size?: 'xs' | 'sm' | 'md';
  showLabels?: boolean;
  className?: string;
}

export function DocumentActionButtons({
  program,
  challan,
  size = 'sm',
  showLabels = true,
  className = '',
}: DocumentActionButtonsProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isChallanOpen, setIsChallanOpen] = useState(false);
  const [isWilcomOpen, setIsWilcomOpen] = useState(false);
  // Every Wilcom sheet of the production (the preview can still filter by category).
  const wilcomCategory = 'ALL';

  const activeProgram = program || challan?.program;
  const activeChallan = challan;
  // A production can have any number of Production Sheets; the count is known once the full sheet is loaded.
  const sheetCount = activeProgram?.metadataJson
    ? productionSheetCategoriesForViewer(activeProgram).length
    : typeof activeProgram?.sheetCount === 'number'
    ? activeProgram.sheetCount
    : null;

  if (!activeProgram && !activeChallan) {
    return null;
  }

  const iconSize = size === 'xs' ? 'w-3 h-3' : size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const textClass = size === 'xs' ? 'text-[10px]' : size === 'sm' ? 'text-[11px]' : 'text-xs';
  const padClass = size === 'xs' ? 'px-1.5 py-0.5' : size === 'sm' ? 'px-2 py-1' : 'px-2.5 py-1.5';

  return (
    <>
      <div className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
        
        {/* 1. PRODUCTION SHEET ACTIONS */}
        {activeProgram && (
          <div className="inline-flex items-center bg-brand-50/80 border border-brand-200/90 rounded-md overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => setIsSheetOpen(true)}
              className={`inline-flex items-center gap-1 ${padClass} ${textClass} font-bold text-brand-900 hover:bg-brand-100 transition cursor-pointer`}
              title="View the Production Sheets"
            >
              <FileText className={`${iconSize} text-brand-700`} />
              {showLabels && <span>{sheetCount && sheetCount > 1 ? `Sheets (${sheetCount})` : 'Sheet'}</span>}
            </button>
            <button
              type="button"
              onClick={() => void downloadProductionSheetHtml(activeProgram)}
              className={`p-1 text-brand-700 hover:text-brand-900 hover:bg-brand-100 border-l border-brand-200/80 transition cursor-pointer`}
              title="Download all Production Sheets (HTML/PDF)"
            >
              <Download className={iconSize} />
            </button>
            <button
              type="button"
              onClick={() => printProductionSheet(activeProgram)}
              className={`p-1 text-brand-700 hover:text-brand-900 hover:bg-brand-100 border-l border-brand-200/80 transition cursor-pointer`}
              title="Print all Production Sheets (A4)"
            >
              <Printer className={iconSize} />
            </button>
          </div>
        )}

        {/* 2. CHALLAN ACTIONS */}
        {activeChallan && (
          <div className="inline-flex items-center bg-accent-50/80 border border-accent-200/90 rounded-md overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => setIsChallanOpen(true)}
              className={`inline-flex items-center gap-1 ${padClass} ${textClass} font-bold text-accent-800 hover:bg-accent-100 transition cursor-pointer`}
              title="View Department Transfer Challan Slip"
            >
              <FileText className={`${iconSize} text-accent-800`} />
              {showLabels && <span>Challan</span>}
            </button>
            <button
              type="button"
              onClick={() => void downloadChallanHtml(activeChallan)}
              className={`p-1 text-accent-800 hover:text-accent-800 hover:bg-accent-100 border-l border-accent-200/80 transition cursor-pointer`}
              title="Download Department Transfer Challan Form with Barcode"
            >
              <Download className={iconSize} />
            </button>
            <button
              type="button"
              onClick={() => printChallan(activeChallan)}
              className={`p-1 text-accent-800 hover:text-accent-800 hover:bg-accent-100 border-l border-accent-200/80 transition cursor-pointer`}
              title="Print Department Transfer Challan Slip"
            >
              <Printer className={iconSize} />
            </button>
          </div>
        )}

        {/* 3. WILCOM SPECIFICATION ACTIONS */}
        {activeProgram && (
          <div className="inline-flex items-center bg-brand-50/80 border border-brand-200/90 rounded-md overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => setIsWilcomOpen(true)}
              className={`inline-flex items-center gap-1 ${padClass} ${textClass} font-bold text-brand-900 hover:bg-brand-100 transition cursor-pointer`}
              title="View Wilcom Embroidery Specification Form"
            >
              <Sparkles className={`${iconSize} text-brand-700`} />
              {showLabels && <span>Wilcom</span>}
            </button>
            <button
              type="button"
              onClick={() => void downloadWilcomFormHtml(activeProgram)}
              className={`p-1 text-brand-700 hover:text-brand-900 hover:bg-brand-100 border-l border-brand-200/80 transition cursor-pointer`}
              title="Download all Wilcom sheets with design artwork"
            >
              <Download className={iconSize} />
            </button>
            <button
              type="button"
              onClick={() => printWilcomForm(activeProgram)}
              className={`p-1 text-brand-700 hover:text-brand-900 hover:bg-brand-100 border-l border-brand-200/80 transition cursor-pointer`}
              title="Print all Wilcom sheets (A4)"
            >
              <Printer className={iconSize} />
            </button>
          </div>
        )}

      </div>

      {/* DOCUMENT PREVIEW MODALS WITH FULL CROSS-NAVIGATION */}
      {activeProgram && (
        <ProductionSheetPrintModal
          program={activeProgram}
          isOpen={isSheetOpen}
          onClose={() => setIsSheetOpen(false)}
          onViewChallan={activeChallan ? () => {
            setIsSheetOpen(false);
            setIsChallanOpen(true);
          } : undefined}
        />
      )}

      {activeChallan && (
        <ChallanPrintModal
          challan={activeChallan}
          isOpen={isChallanOpen}
          onClose={() => setIsChallanOpen(false)}
          onViewSheet={activeProgram ? () => {
            setIsChallanOpen(false);
            setIsSheetOpen(true);
          } : undefined}
          onViewWilcom={activeProgram ? () => {
            setIsChallanOpen(false);
            setIsWilcomOpen(true);
          } : undefined}
        />
      )}

      {activeProgram && (
        <WilcomPrintModal
          program={activeProgram}
          isOpen={isWilcomOpen}
          onClose={() => setIsWilcomOpen(false)}
          initialCategory={wilcomCategory}
          onViewSheet={() => {
            setIsWilcomOpen(false);
            setIsSheetOpen(true);
          }}
          onViewChallan={activeChallan ? () => {
            setIsWilcomOpen(false);
            setIsChallanOpen(true);
          } : undefined}
        />
      )}
    </>
  );
}
