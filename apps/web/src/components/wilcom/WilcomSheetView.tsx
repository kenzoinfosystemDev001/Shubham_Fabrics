'use client';

import React, { useState } from 'react';
import { 
  Sparkles, 
  Eye, 
  Printer, 
  Download, 
  X 
} from 'lucide-react';
import { WilcomEntry, GarmentCategory, printWilcomForm, downloadWilcomFormHtml } from '@/lib/download-wilcom';

interface WilcomSheetViewProps {
  program: any;
  wilcomEntries: WilcomEntry[];
  rootWilcomPhoto?: string;
  onOpenPrintModal?: () => void;
  showActions?: boolean;
}

export function WilcomSheetView({
  program,
  wilcomEntries,
  rootWilcomPhoto = '',
  onOpenPrintModal,
  showActions = true,
}: WilcomSheetViewProps) {
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);

  const displayEntries: WilcomEntry[] = wilcomEntries.length > 0
    ? wilcomEntries.map((e, idx) => ({
        ...e,
        photoUrl: e.photoUrl || (idx === 0 ? rootWilcomPhoto : '') || '',
      }))
    : rootWilcomPhoto || program?.wilcomDesignNumber
      ? [
          {
            id: 'wilcom-auto-1',
            category: 'TOP',
            styleName: program?.topName || program?.mainStyle || 'Primary Top Style',
            wilcomDesignNumber: program?.wilcomDesignNumber || program?.embroideryDesign || 'WLC-01',
            photoUrl: rootWilcomPhoto,
            remarks: program?.remarks || '',
          },
        ]
      : [];

  return (
    <div className="space-y-4">
      {/* HEADER & ACTION BAR */}
      {showActions && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-200/80 pb-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-900 bg-purple-100 px-2 py-0.5 rounded border border-purple-300">
              WILCOM SPECIFICATIONS &middot; {displayEntries.length} {displayEntries.length === 1 ? 'DESIGN' : 'DESIGNS'}
            </span>
            <h4 className="text-sm font-black text-slate-900 mt-1 uppercase tracking-wide">
              Embroidery Artwork &amp; Design Numbers
            </h4>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => printWilcomForm(program)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded shadow-2xs transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Wilcom Form</span>
            </button>
            <button
              type="button"
              onClick={() => void downloadWilcomFormHtml(program)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-black text-white text-xs font-bold rounded shadow-2xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Form</span>
            </button>
            {onOpenPrintModal && (
              <button
                type="button"
                onClick={onOpenPrintModal}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-purple-300 text-purple-900 text-xs font-bold rounded hover:bg-purple-50 transition cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview Modal</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ENTRIES GRID */}
      {displayEntries.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayEntries.map((entry, idx) => {
            const photo = entry.photoUrl;
            return (
              <div 
                key={entry.id || idx} 
                className="p-4 border-[1.5px] border-purple-900 rounded-lg bg-white space-y-3 shadow-2xs"
              >
                <div className="flex items-center justify-between border-b border-purple-100 pb-2">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                    entry.category === 'TOP'
                      ? 'bg-blue-100 text-blue-900 border border-blue-300'
                      : entry.category === 'BOTTOM'
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : 'bg-purple-100 text-purple-900 border border-purple-300'
                  }`}>
                    {entry.category || 'EMBROIDERY'}
                  </span>
                  <span className="font-mono font-black text-xs text-purple-950">
                    WILCOM #{entry.wilcomDesignNumber || 'N/A'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-4 items-start">
                  <div className="w-[140px] h-[140px] border border-purple-200 rounded-md bg-purple-50/40 flex items-center justify-center overflow-hidden shrink-0">
                    {photo ? (
                      <img
                        src={photo}
                        alt={entry.wilcomDesignNumber || 'Wilcom Artwork'}
                        className="w-full h-full object-contain cursor-pointer hover:scale-105 transition"
                        onClick={() => setViewingPhoto(photo)}
                        title="Click to view full photo"
                      />
                    ) : (
                      <span className="text-[10px] text-slate-400 font-bold text-center p-2">
                        No Reference Photo
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="font-bold text-slate-900 text-sm">
                      {entry.styleName || 'Garment Style'}
                    </div>
                    {entry.remarks && (
                      <p className="text-slate-600 text-[11px] leading-relaxed">
                        {entry.remarks}
                      </p>
                    )}
                    {photo && (
                      <button
                        type="button"
                        onClick={() => setViewingPhoto(photo)}
                        className="text-[11px] font-bold text-purple-700 hover:text-purple-900 flex items-center gap-1 mt-2 cursor-pointer hover:underline"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Full Photo</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 text-center border-2 border-dashed border-slate-300 rounded-lg text-slate-500 text-xs space-y-1">
          <Sparkles className="w-6 h-6 text-purple-400 mx-auto mb-1" />
          <p className="font-bold text-slate-700">No Wilcom embroidery designs recorded for this production order.</p>
        </div>
      )}

      {/* FULL-SIZE PHOTO LIGHTBOX MODAL */}
      {viewingPhoto && (
        <div
          className="fixed inset-0 z-60 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setViewingPhoto(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-xl p-3 shadow-2xl flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setViewingPhoto(null)}
              className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-black shadow-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={viewingPhoto}
              alt="Enlarged Wilcom Reference"
              className="max-h-[82vh] max-w-full object-contain rounded-lg"
            />
            <div className="mt-2 text-xs font-bold text-slate-700">
              Wilcom Artwork Reference Photo
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
