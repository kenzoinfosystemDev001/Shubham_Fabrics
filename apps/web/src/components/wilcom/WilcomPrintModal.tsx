'use client';

import React, { useState } from 'react';
import { 
  Printer, 
  Download, 
  X, 
  Sparkles,
  Eye,
  Layers
} from 'lucide-react';
import { 
  WilcomEntry, 
  GarmentCategory,
  printWilcomForm, 
  downloadWilcomFormHtml 
} from '@/lib/download-wilcom';
import { getCurrentUser, canViewClientCode } from '@/lib/rbac';

interface WilcomPrintModalProps {
  program?: any;
  sheetData?: any;
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: GarmentCategory | 'ALL';
}

export function WilcomPrintModal({
  program: propProgram,
  sheetData,
  isOpen,
  onClose,
  initialCategory = 'ALL',
}: WilcomPrintModalProps) {
  const program = propProgram || sheetData;
  const [filterCategory, setFilterCategory] = useState<GarmentCategory | 'ALL'>(initialCategory);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);

  if (!isOpen || !program) return null;

  const currentUser = typeof window !== 'undefined' ? getCurrentUser() : null;
  const canSeeClientCode = canViewClientCode(currentUser) && Boolean(program.clientCode);

  let meta: any = null;
  if (program.metadataJson) {
    try {
      meta = typeof program.metadataJson === 'string' ? JSON.parse(program.metadataJson) : program.metadataJson;
    } catch {}
  }

  const rootWilcomPhoto = program.wilcomDesignPhoto || meta?.wilcomDesignPhoto || program.baseDesignPhoto || '';
  let wilcomEntries: WilcomEntry[] = Array.isArray(meta?.wilcomEntries) ? meta.wilcomEntries : [];

  if (wilcomEntries.length === 0 && (program.wilcomDesignNumber || rootWilcomPhoto || program.embroideryDesign)) {
    wilcomEntries = [
      {
        id: 'wilcom-auto-1',
        category: 'TOP',
        styleName: program.topName || program.mainStyle || 'Primary Top Style',
        wilcomDesignNumber: program.wilcomDesignNumber || program.embroideryDesign || 'WLC-01',
        photoUrl: rootWilcomPhoto,
        remarks: program.remarks || program.comments || '',
      },
    ];
  } else if (wilcomEntries.length > 0) {
    wilcomEntries = wilcomEntries.map((e: any, idx: number) => ({
      ...e,
      photoUrl: e.photoUrl || e.photo || e.imageUrl || e.image || (idx === 0 ? rootWilcomPhoto : '') || '',
    }));
  }

  const filteredEntries = filterCategory === 'ALL'
    ? wilcomEntries
    : wilcomEntries.filter((e) => e.category === filterCategory);

  const serialNo = program.programSerialNo || program.programNumber || '—';
  const designNo = program.designNumber || program.designName || '—';
  const dateVal = program.startDate || program.programDate 
    ? new Date(program.startDate || program.programDate).toLocaleDateString('en-GB') 
    : new Date().toLocaleDateString('en-GB');

  const handlePrint = () => {
    printWilcomForm(program, filterCategory);
  };

  const handleDownload = () => {
    void downloadWilcomFormHtml(program, filterCategory);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[96vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* MODAL HEADER */}
        <div className="px-5 py-3 border-b border-purple-200 flex items-center justify-between bg-purple-50/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 text-purple-900 rounded-lg">
              <Sparkles className="w-5 h-5 text-purple-700" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-purple-700">
                Wilcom Embroidery Specification Form
              </div>
              <h2 className="text-base font-bold text-slate-900">
                Traveler #{serialNo} &middot; Design {designNo}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Wilcom Form</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-black text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Form</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CATEGORY FILTER BAR */}
        <div className="px-5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 mr-1">Filter:</span>
            {(['ALL', 'TOP', 'BOTTOM', 'DUPATTA', 'OTHER'] as const).map((cat) => {
              const count = cat === 'ALL' 
                ? wilcomEntries.length 
                : wilcomEntries.filter((e) => e.category === cat).length;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFilterCategory(cat)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    filterCategory === cat
                      ? 'bg-purple-700 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-200'
                  }`}
                >
                  <span>{cat === 'ALL' ? 'All Wilcom Designs' : cat}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    filterCategory === cat 
                      ? 'bg-purple-800 text-purple-100' 
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Total {filteredEntries.length} {filteredEntries.length === 1 ? 'Design' : 'Designs'}
          </div>
        </div>

        {/* PREVIEW CONTAINER */}
        <div className="p-4 sm:p-6 overflow-y-auto bg-slate-100 flex-1">
          <div className="max-w-[760px] mx-auto bg-white p-6 sm:p-8 rounded shadow-sm border-2 border-black text-black font-sans space-y-4">
            
            {/* Header */}
            <div className="text-center border-b-2 border-black pb-3">
              <div className="text-sm font-black tracking-wider uppercase text-slate-800">
                SHUBHAM FABRICS INDIA PVT. LTD.
              </div>
              <div className="text-xl font-black tracking-widest uppercase text-purple-900 mt-1">
                WILCOM EMBROIDERY SPECIFICATION FORM
              </div>
            </div>

            {/* Order Meta Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-purple-50 border border-purple-200 rounded text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">DESIGN NO.</span>
                <span className="font-black text-slate-900">{designNo}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">SERIAL NO.</span>
                <span className="font-black text-slate-900">{serialNo}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">DATE</span>
                <span className="font-black text-slate-900">{dateVal}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">CLIENT</span>
                <span className="font-black text-slate-900">
                  {program.clientName || program.buyerName || 'Standard Client'}
                  {canSeeClientCode && (
                    <span className="ml-1 text-[10px] font-mono text-purple-800">
                      ({program.clientCode})
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Entries Display */}
            {filteredEntries.length === 0 ? (
              <div className="p-12 text-center border-2 border-dashed border-slate-300 rounded-lg text-slate-500 space-y-2">
                <Sparkles className="w-8 h-8 text-purple-400 mx-auto" />
                <p className="font-bold text-sm text-slate-700">No Wilcom Designs for this selection</p>
                <p className="text-xs text-slate-500">
                  Add embroidery design numbers and photos in the Wilcom management section.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredEntries.map((entry, idx) => (
                  <div key={entry.id || idx} className="border-2 border-black rounded p-4 bg-white space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded text-[11px] font-black uppercase text-white ${
                          entry.category === 'TOP'
                            ? 'bg-blue-600'
                            : entry.category === 'BOTTOM'
                              ? 'bg-emerald-600'
                              : 'bg-amber-600'
                        }`}>
                          {entry.category}
                        </span>
                        <span className="font-bold text-xs text-slate-900">
                          Entry #{idx + 1} &middot; {entry.styleName || 'Garment Style'}
                        </span>
                      </div>
                      <span className="font-mono font-black text-xs px-2 py-0.5 bg-purple-100 text-purple-950 rounded border border-purple-200">
                        WILCOM #{entry.wilcomDesignNumber || 'N/A'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-4 items-start">
                      <div className="w-[160px] h-[160px] border-2 border-slate-300 rounded bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                        {entry.photoUrl ? (
                          <img
                            src={entry.photoUrl}
                            alt={entry.wilcomDesignNumber}
                            className="w-full h-full object-contain cursor-pointer hover:scale-105 transition"
                            onClick={() => setViewingPhoto(entry.photoUrl || null)}
                            title="Click to view full photo"
                          />
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold text-center p-2">
                            No Reference Artwork
                          </span>
                        )}
                      </div>

                      <div className="space-y-2 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[11px]">Component Category:</span>
                          <span className="font-bold text-slate-800">{entry.category} Component</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Style Name:</span>
                          <span className="font-semibold text-slate-800">{entry.styleName || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Wilcom Design Number:</span>
                          <span className="font-mono font-black text-purple-950 text-sm">{entry.wilcomDesignNumber}</span>
                        </div>
                        {entry.remarks && (
                          <div>
                            <span className="text-slate-400 block text-[11px]">Special Instructions:</span>
                            <span className="text-slate-700 italic">{entry.remarks}</span>
                          </div>
                        )}
                        {entry.photoUrl && (
                          <button
                            type="button"
                            onClick={() => setViewingPhoto(entry.photoUrl || null)}
                            className="text-[11px] font-bold text-purple-700 hover:text-purple-900 flex items-center gap-1 pt-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Enlarge Artwork Photo</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

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
