'use client';

import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  Download, 
  X, 
  Sparkles,
  Eye,
  Image as ImageIcon
} from 'lucide-react';
import { 
  WilcomEntry, 
  GarmentCategory,
  printWilcomForm, 
  downloadWilcomFormHtml,
  extractRootWilcomPhoto
} from '@/lib/download-wilcom';
import { FileText } from 'lucide-react';
import { useProgramDocument } from '@/hooks/useProgramDocument';

interface WilcomPrintModalProps {
  program?: any;
  sheetData?: any;
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: GarmentCategory | 'ALL';
  onViewSheet?: () => void;
  onViewChallan?: () => void;
  onProgramUpdate?: (updated: any) => void;
}

export function WilcomPrintModal({
  program: propProgram,
  sheetData,
  isOpen,
  onClose,
  initialCategory = 'ALL',
  onViewSheet,
  onViewChallan,
}: WilcomPrintModalProps) {
  const sourceProgram = propProgram || sheetData;
  const { program, loading, error } = useProgramDocument(sourceProgram, isOpen);
  const [filterCategory, setFilterCategory] = useState<GarmentCategory | 'ALL'>(initialCategory);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);

  let meta: any = null;
  if (program?.metadataJson) {
    try {
      meta = typeof program.metadataJson === 'string' ? JSON.parse(program.metadataJson) : program.metadataJson;
    } catch {}
  }

  const rootWilcomPhoto = extractRootWilcomPhoto(program, meta);

  const serialNo = program?.programSerialNo || program?.programNumber || '—';
  const designNo = program?.designNumber || program?.designName || '—';
  const mainStyleVal = program?.mainStyle || program?.topName || meta?.mainStyle || meta?.topName || '—';
  const styleVal = program?.subStyle || program?.styleCode || meta?.subStyle || meta?.style || '—';

  // Build initial entries
  const buildInitialEntries = (): WilcomEntry[] => {
    let entries: WilcomEntry[] = [];
    if (Array.isArray(program?.wilcomEntries) && program.wilcomEntries.length > 0) {
      entries = program.wilcomEntries;
    } else if (Array.isArray(meta?.wilcomEntries) && meta.wilcomEntries.length > 0) {
      entries = meta.wilcomEntries;
    }

    if (entries.length === 0) {
      return [
        {
          id: 'wilcom-auto-1',
          category: 'TOP',
          styleName: styleVal !== '—' ? styleVal : (mainStyleVal !== '—' ? mainStyleVal : 'Style'),
          wilcomDesignNumber: program?.wilcomDesignNumber || program?.embroideryDesign || (designNo !== '—' ? designNo : 'WLC-01'),
          photoUrl: rootWilcomPhoto,
          remarks: program?.remarks || program?.comments || '',
        },
      ];
    }

    return entries.map((e: any) => ({
      ...e,
      photoUrl: e.photoUrl || e.photo || e.imageUrl || e.image || rootWilcomPhoto || '',
    }));
  };

  const [entries, setEntries] = useState<WilcomEntry[]>(buildInitialEntries);

  useEffect(() => {
    if (program) {
      setEntries(buildInitialEntries());
    }
  }, [program, rootWilcomPhoto]);

  useEffect(() => {
    if (initialCategory) {
      setFilterCategory(initialCategory);
    }
  }, [initialCategory]);

  if (!isOpen || !program) return null;

  const normFilter = String(filterCategory || 'ALL').trim().toUpperCase();
  const filtered = (normFilter === 'ALL' || !normFilter)
    ? entries
    : entries.filter((e) => {
        const cat = String(e.category || '').trim().toUpperCase();
        return cat === normFilter || cat.includes(normFilter) || normFilter.includes(cat);
      });
  const filteredEntries = filtered.length > 0 ? filtered : entries;

  const handlePrint = () => {
    const activePhoto = entries.find((e) => e.photoUrl)?.photoUrl || entries[0]?.photoUrl || rootWilcomPhoto;
    const prepared = {
      ...program,
      wilcomEntries: entries,
      wilcomDesignPhoto: activePhoto
    };
    printWilcomForm(prepared, filterCategory);
  };

  const handleDownload = () => {
    const activePhoto = entries.find((e) => e.photoUrl)?.photoUrl || entries[0]?.photoUrl || rootWilcomPhoto;
    const prepared = {
      ...program,
      wilcomEntries: entries,
      wilcomDesignPhoto: activePhoto
    };
    void downloadWilcomFormHtml(prepared, filterCategory);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[96vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* MODAL HEADER */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[#163767] shadow-2xs">
              <Sparkles className="w-5 h-5 text-[#163767]" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Wilcom {filterCategory === 'ALL' ? '' : `${filterCategory} `}Specifications
              </div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Design {designNo}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onViewSheet && (
              <button
                type="button"
                onClick={onViewSheet}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg text-xs font-bold border border-blue-200 transition cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-blue-700" />
                <span>View Sheet</span>
              </button>
            )}
            {onViewChallan && (
              <button
                type="button"
                onClick={onViewChallan}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold border border-emerald-200 transition cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-700" />
                <span>View Challan</span>
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#163767] hover:bg-[#0F264A] disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer disabled:cursor-wait"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Wilcom {filterCategory === 'ALL' ? '' : `${filterCategory} `}Sheet</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-black disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer disabled:cursor-wait"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Wilcom {filterCategory === 'ALL' ? '' : `${filterCategory} `}Sheet</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {(loading || error) && (
          <div className={`px-6 py-2 text-xs ${error ? 'bg-rose-50 text-rose-800' : 'bg-blue-50 text-blue-800'}`}>
            {error || 'Loading Wilcom artwork and production details…'}
          </div>
        )}

        {/* CATEGORY FILTER BAR */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 mr-1">Filter:</span>
            {(() => {
              const standardCats = ['ALL', 'TOP', 'BOTTOM', 'DUPATTA'];
              const customCats = entries
                .map((e) => e.category)
                .filter((c) => c && !['TOP', 'BOTTOM', 'DUPATTA'].includes(c));
              const uniqueCategories = Array.from(new Set([...standardCats, ...customCats]));

              return uniqueCategories.map((cat) => {
                const count = cat === 'ALL'
                  ? entries.length
                  : entries.filter((e) => e.category === cat).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFilterCategory(cat)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                      filterCategory === cat
                        ? 'bg-[#163767] text-white shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <span>{cat === 'ALL' ? 'All' : cat}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      filterCategory === cat
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              });
            })()}
          </div>

          <div className="text-xs text-slate-500 font-medium">
            {filteredEntries.length} {filteredEntries.length === 1 ? 'Design' : 'Designs'}
          </div>
        </div>

        {/* PREVIEW CONTAINER */}
        <div className="p-4 sm:p-6 overflow-y-auto bg-slate-100/80 flex-1">
          <div className="max-w-[760px] mx-auto bg-white p-6 sm:p-8 rounded-xl shadow-xs border border-slate-300 text-slate-900 font-sans space-y-4">
            
            {/* Header */}
            <div className="text-center border-b-2 border-slate-900 pb-3">
              <div className="text-sm font-black tracking-wider uppercase text-slate-800">
                SHUBHAM FABRICS INDIA PVT. LTD.
              </div>
              <div className="text-lg font-black tracking-widest uppercase text-[#163767] mt-1">
                WILCOM {filterCategory === 'ALL' ? '' : `${filterCategory} `}EMBROIDERY SPECIFICATIONS
              </div>
            </div>

            {/* Order Meta Bar - STRICTLY Style, Main Style, Design Number, and Serial Number */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">DESIGN NO.</span>
                <span className="font-bold text-slate-900 font-mono text-sm">{designNo}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">SERIAL NO.</span>
                <span className="font-bold text-slate-900 font-mono text-sm">{serialNo}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">MAIN STYLE</span>
                <span className="font-bold text-slate-900">{mainStyleVal}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">STYLE</span>
                <span className="font-bold text-slate-900">{styleVal}</span>
              </div>
            </div>

            {/* Entries Display */}
            {filteredEntries.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-slate-300 rounded-lg text-slate-500 space-y-2">
                <Sparkles className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="font-bold text-sm text-slate-700">No Wilcom Designs for this selection</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredEntries.map((entry, idx) => (
                  <div key={entry.id || idx} className="border border-slate-200 rounded-xl p-4 bg-white space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase text-white ${
                          entry.category === 'TOP'
                            ? 'bg-[#163767]'
                            : entry.category === 'BOTTOM'
                              ? 'bg-emerald-700'
                              : entry.category === 'DUPATTA'
                                ? 'bg-amber-700'
                                : 'bg-slate-700'
                        }`}>
                          WILCOM {entry.category}
                        </span>
                        <span className="font-semibold text-xs text-slate-900">
                          {entry.styleName || styleVal || mainStyleVal}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-xs px-2 py-0.5 bg-slate-100 text-slate-900 rounded border border-slate-200">
                        {entry.wilcomDesignNumber || designNo || 'N/A'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-4 items-start">
                      {/* Photo Preview */}
                      <div className="w-[160px] h-[160px] border border-slate-200 rounded-lg bg-slate-50 flex flex-col items-center justify-center overflow-hidden shrink-0 relative group">
                        {entry.photoUrl ? (
                          <>
                            <img
                              src={entry.photoUrl}
                              alt={entry.wilcomDesignNumber || 'Wilcom Artwork'}
                              className="w-full h-full object-contain cursor-pointer hover:scale-105 transition"
                              onClick={() => setViewingPhoto(entry.photoUrl || null)}
                              title="Click to view full photo"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => setViewingPhoto(entry.photoUrl || null)}
                                className="p-1.5 bg-white/90 hover:bg-white text-slate-800 rounded-full shadow-xs cursor-pointer"
                                title="View full size"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="text-center p-3 flex flex-col items-center justify-center gap-2">
                            <ImageIcon className="w-6 h-6 text-slate-300" />
                            <span className="text-[10px] text-slate-400 font-semibold">
                              No Artwork Photo
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Details Box - strictly Design No, Serial No, Main Style, Style */}
                      <div className="space-y-2 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[11px]">Design Number:</span>
                          <span className="font-mono font-bold text-slate-900 text-sm">{designNo}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Serial Number:</span>
                          <span className="font-mono font-bold text-slate-900 text-sm">{serialNo}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Main Style:</span>
                          <span className="font-bold text-slate-800">{mainStyleVal}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Style:</span>
                          <span className="font-semibold text-slate-800">{entry.styleName || styleVal}</span>
                        </div>
                        {entry.photoUrl && (
                          <div className="flex items-center gap-3 pt-1">
                            <button
                              type="button"
                              onClick={() => setViewingPhoto(entry.photoUrl || null)}
                              className="text-[11px] font-semibold text-[#163767] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Full Photo</span>
                            </button>
                          </div>
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
          </div>
        </div>
      )}
    </div>
  );
}
