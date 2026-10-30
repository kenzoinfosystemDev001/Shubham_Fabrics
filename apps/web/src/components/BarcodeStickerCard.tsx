'use client';

import React, { useState } from 'react';
import { departmentName } from '@/lib/workflow-views';
import { 
  Download, 
  Printer, 
  Barcode as BarcodeIcon, 
  Check, 
  ExternalLink,
  ShieldCheck,
  Tag,
  Sparkles
} from 'lucide-react';
import { 
  BarcodeStickerParams, 
  generateBarcodeStickerSvg, 
  downloadBarcodeStickerPng, 
  downloadBarcodeStickerSvg, 
  printBarcodeSticker 
} from '@/lib/barcode';

interface BarcodeStickerCardProps {
  params: BarcodeStickerParams;
  title?: string;
  compact?: boolean;
}

export default function BarcodeStickerCard({
  params,
  title = 'Department Barcode Dispatch Tag',
  compact = false
}: BarcodeStickerCardProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  const svgMarkup = generateBarcodeStickerSvg(params);

  const handleDownloadPng = async () => {
    try {
      setDownloading(true);
      await downloadBarcodeStickerPng(params);
      setDownloadSuccess('PNG Downloaded');
      setTimeout(() => setDownloadSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to download barcode PNG:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadSvg = () => {
    try {
      downloadBarcodeStickerSvg(params);
      setDownloadSuccess('SVG Downloaded');
      setTimeout(() => setDownloadSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to download barcode SVG:', err);
    }
  };

  const handlePrint = () => {
    printBarcodeSticker(params);
  };

  const deptDisplay = params.departmentName || params.fromDepartment || 'PRODUCTION';

  return (
    <div className="bg-white border-2 border-neutral-300 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
      {/* CARD HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-600 text-accent-700 flex items-center justify-center shrink-0 shadow-2xs">
            <BarcodeIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-accent-800 bg-accent-50 px-2 py-0.5 rounded border border-accent-200">
                DEPT: {deptDisplay}
              </span>
              <span className="text-[10px] font-mono font-bold text-neutral-500">
                Code-128
              </span>
            </div>
            <h4 className="text-sm font-bold text-neutral-900 mt-0.5">
              {title}
            </h4>
          </div>
        </div>

        {/* ACTION BUTTONS (DOWNLOADABLE SEPARATELY) */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleDownloadPng}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold shadow-2xs transition cursor-pointer"
            title="Download standalone high-resolution barcode sticker as PNG"
          >
            {downloadSuccess === 'PNG Downloaded' ? (
              <Check className="w-3.5 h-3.5 text-accent-700" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>{downloadSuccess === 'PNG Downloaded' ? 'Saved PNG!' : 'Download Barcode (PNG)'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadSvg}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 rounded-lg text-xs font-bold transition cursor-pointer"
            title="Download vector SVG"
          >
            <Download className="w-3.5 h-3.5 text-neutral-600" />
            <span>SVG</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold shadow-2xs transition cursor-pointer"
            title="Print 4x2.5 thermal sticker label directly"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Sticker</span>
          </button>
        </div>
      </div>

      {/* METADATA HIGHLIGHT BAR */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs p-3 bg-neutral-50 rounded-xl border border-neutral-200">
        <div>
          <span className="text-[10px] uppercase font-bold text-neutral-500 block">Design Number (Sheet)</span>
          <strong className="text-sm font-mono font-black text-neutral-900 block truncate">
            {params.designNumber || 'STANDARD'}
          </strong>
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-neutral-500 block">Department</span>
          <strong className="text-xs font-bold text-brand-900 block truncate">
            {deptDisplay}
          </strong>
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-neutral-500 block">Movement</span>
          <span className="text-xs font-mono font-bold text-neutral-700 block truncate">
            {params.fromDepartment && params.toDepartment ? `${departmentName(params.fromDepartment)} → ${departmentName(params.toDepartment)}` : 'INTER-DEPT'}
          </span>
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-neutral-500 block">Dispatched Pieces</span>
          <strong className="text-sm font-mono font-black text-accent-800 block">
            {params.totalQuantity || '—'} {params.uom ?? 'PCS'}
          </strong>
        </div>
      </div>

      {/* LIVE SCANNABLE SVG BARCODE STICKER PREVIEW */}
      <div className="flex justify-center p-2 sm:p-4 bg-neutral-100/70 rounded-xl border border-neutral-200 overflow-x-auto">
        <div 
          className="shadow-sm rounded-xl overflow-hidden bg-white max-w-full"
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
        />
      </div>
    </div>
  );
}
