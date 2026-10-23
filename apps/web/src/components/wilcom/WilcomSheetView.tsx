'use client';

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Eye, 
  Printer, 
  Download, 
  X,
  Upload,
  Image as ImageIcon
} from 'lucide-react';
import {
  WilcomEntry,
  GarmentCategory,
  printWilcomForm,
  downloadWilcomFormHtml,
  compressImageForUpload,
  extractRootWilcomPhoto
} from '@/lib/download-wilcom';
import { useProgramDocument } from '@/hooks/useProgramDocument';

interface WilcomSheetViewProps {
  program: any;
  wilcomEntries: WilcomEntry[];
  rootWilcomPhoto?: string;
  onOpenPrintModal?: () => void;
  showActions?: boolean;
  onProgramUpdate?: (updated: any) => void;
}

export function WilcomSheetView({
  program: sourceProgram,
  wilcomEntries: propWilcomEntries,
  rootWilcomPhoto: propRootWilcomPhoto = '',
  onOpenPrintModal,
  showActions = true,
  onProgramUpdate,
}: WilcomSheetViewProps) {
  const { program, loading, error } = useProgramDocument(sourceProgram);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  let meta: any = null;
  if (program?.metadataJson) {
    try {
      meta = typeof program.metadataJson === 'string' ? JSON.parse(program.metadataJson) : program.metadataJson;
    } catch {}
  }

  const rootWilcomPhoto =
    propRootWilcomPhoto ||
    extractRootWilcomPhoto(program, meta);

  const serialNo = program?.programSerialNo || program?.programNumber || '—';
  const designNo = program?.designNumber || program?.designName || '—';
  const mainStyleVal = program?.mainStyle || program?.topName || meta?.mainStyle || meta?.topName || '—';
  const styleVal = program?.subStyle || program?.styleCode || meta?.subStyle || meta?.style || '—';

  const buildInitialEntries = (): WilcomEntry[] => {
    let entries: WilcomEntry[] = [];
    if (Array.isArray(propWilcomEntries) && propWilcomEntries.length > 0) {
      entries = propWilcomEntries;
    } else if (Array.isArray(program?.wilcomEntries) && program.wilcomEntries.length > 0) {
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

    return entries.map((e, idx) => ({
      ...e,
      photoUrl: e.photoUrl || (idx === 0 ? rootWilcomPhoto : '') || rootWilcomPhoto || '',
    }));
  };

  const [entries, setEntries] = useState<WilcomEntry[]>(buildInitialEntries);

  useEffect(() => {
    setEntries(buildInitialEntries());
  }, [program, propWilcomEntries, rootWilcomPhoto]);

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>, targetEntryId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('Photo must be less than 15MB');
      return;
    }

    setUploading(true);
    try {
      const newPhotoUrl = await compressImageForUpload(file);
      if (!newPhotoUrl) {
        throw new Error('Could not process image');
      }

      let updatedEntries: WilcomEntry[] = [];
      if (entries.length === 0) {
        updatedEntries = [
          {
            id: 'wilcom-auto-1',
            category: 'TOP',
            styleName: styleVal !== '—' ? styleVal : (mainStyleVal !== '—' ? mainStyleVal : 'Style'),
            wilcomDesignNumber: program?.wilcomDesignNumber || program?.embroideryDesign || (designNo !== '—' ? designNo : 'WLC-01'),
            photoUrl: newPhotoUrl,
            remarks: program?.remarks || program?.comments || '',
          },
        ];
      } else {
        updatedEntries = entries.map((item, idx) => {
          if (targetEntryId ? item.id === targetEntryId : idx === 0) {
            return { ...item, photoUrl: newPhotoUrl };
          }
          return item;
        });
      }
      setEntries(updatedEntries);

      // Mutate in-memory program references immediately
      if (program) {
        program.wilcomDesignPhoto = newPhotoUrl;
        program.wilcomEntries = updatedEntries;
      }
      if (onProgramUpdate) {
        onProgramUpdate({
          wilcomDesignPhoto: newPhotoUrl,
          wilcomEntries: updatedEntries,
        });
      }

      // Auto-save to database if program ID is present
      const progId = program?.id || program?.programNumber || program?.programSerialNo;
      if (progId) {
        try {
          await fetch(`/api/programs/${progId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              wilcomDesignPhoto: newPhotoUrl,
              wilcomEntries: updatedEntries,
            }),
          });
        } catch (err) {
          console.warn('Auto-save of uploaded wilcom photo failed:', err);
        }
      }
    } catch (err: any) {
      alert(err.message || 'Failed to read image file');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handlePrint = () => {
    const activePhoto = entries.find((e) => e.photoUrl)?.photoUrl || entries[0]?.photoUrl || rootWilcomPhoto;
    const prepared = {
      ...program,
      wilcomEntries: entries,
      wilcomDesignPhoto: activePhoto,
    };
    printWilcomForm(prepared, 'ALL');
  };

  const handleDownload = () => {
    const activePhoto = entries.find((e) => e.photoUrl)?.photoUrl || entries[0]?.photoUrl || rootWilcomPhoto;
    const prepared = {
      ...program,
      wilcomEntries: entries,
      wilcomDesignPhoto: activePhoto,
    };
    void downloadWilcomFormHtml(prepared, 'ALL');
  };

  const displayEntries = entries;

  return (
    <div className="space-y-4">
      {(loading || error) && (
        <div className={`rounded-md px-3 py-2 text-xs ${error ? 'bg-rose-50 text-rose-800' : 'bg-blue-50 text-blue-800'}`}>
          {error || 'Loading Wilcom artwork and production details…'}
        </div>
      )}
      {/* HEADER & ACTION BAR */}
      {showActions && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              Wilcom Specifications &middot; {displayEntries.length} {displayEntries.length === 1 ? 'Design' : 'Designs'}
            </span>
            <h4 className="text-sm font-bold text-slate-900 mt-1 tracking-tight">
              Embroidery Artwork &amp; Design Numbers
            </h4>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#163767] hover:bg-[#0F264A] text-white text-xs font-semibold rounded-lg shadow-2xs transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Wilcom Sheet</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-black text-white text-xs font-semibold rounded-lg shadow-2xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Wilcom Sheet</span>
            </button>
            {onOpenPrintModal && (
              <button
                type="button"
                onClick={onOpenPrintModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 transition cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview</span>
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
                className="p-4 border border-slate-200 rounded-xl bg-white space-y-3 shadow-2xs hover:border-slate-300 transition"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                    entry.category === 'TOP'
                      ? 'bg-blue-50 text-blue-900 border border-blue-200'
                      : entry.category === 'BOTTOM'
                        ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                        : entry.category === 'DUPATTA'
                          ? 'bg-amber-50 text-amber-900 border border-amber-200'
                          : 'bg-slate-100 text-slate-800 border border-slate-200'
                  }`}>
                    WILCOM {entry.category}
                  </span>
                  <span className="min-w-0 max-w-full sm:max-w-[58%] break-all text-right font-mono text-[11px] leading-tight font-bold text-slate-900">
                    {entry.wilcomDesignNumber || '—'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-4 items-start">
                  <div className="w-[140px] h-[140px] border border-slate-200 rounded-lg bg-slate-50 flex flex-col items-center justify-center overflow-hidden shrink-0 relative group">
                    {photo ? (
                      <>
                        <img
                          src={photo}
                          alt={entry.wilcomDesignNumber || 'Wilcom Artwork'}
                          className="w-full h-full object-contain cursor-pointer hover:scale-105 transition"
                          onClick={() => setViewingPhoto(photo)}
                          title="Click to view full photo"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setViewingPhoto(photo)}
                            className="p-1.5 bg-white/90 hover:bg-white text-slate-800 rounded-full shadow-xs cursor-pointer"
                            title="View full size"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <label className="p-1.5 bg-white/90 hover:bg-white text-slate-800 rounded-full shadow-xs cursor-pointer" title="Change photo">
                            <Upload className="w-3.5 h-3.5" />
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleUploadPhoto(e, entry.id)}
                            />
                          </label>
                        </div>
                      </>
                    ) : (
                      <div className="text-center p-2.5 flex flex-col items-center justify-center gap-1.5">
                        <ImageIcon className="w-6 h-6 text-slate-300" />
                        <span className="text-[10px] text-slate-400 font-semibold">
                          No Artwork Photo
                        </span>
                        <label className="inline-flex items-center gap-1 px-2 py-0.5 bg-white hover:bg-slate-100 text-[#163767] border border-slate-300 rounded text-[10px] font-bold shadow-2xs cursor-pointer transition">
                          <Upload className="w-3 h-3" />
                          <span>{uploading ? '...' : 'Upload'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleUploadPhoto(e, entry.id)}
                            disabled={uploading}
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Design Number:</span>
                      <span className="font-mono font-bold text-slate-900 text-xs">{designNo}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Serial Number:</span>
                      <span className="font-mono font-bold text-slate-900 text-xs">{serialNo}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Main Style:</span>
                      <span className="font-bold text-slate-800 text-xs">{mainStyleVal}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Style:</span>
                      <span className="font-semibold text-slate-800 text-xs">{entry.styleName || styleVal}</span>
                    </div>
                    {photo && (
                      <div className="flex items-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => setViewingPhoto(photo)}
                          className="text-[11px] font-semibold text-[#163767] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Full Photo</span>
                        </button>
                        <label className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:underline flex items-center gap-1 cursor-pointer">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Change Photo</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleUploadPhoto(e, entry.id)}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl bg-white text-slate-400 text-xs">
          No Wilcom designs recorded.
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
          </div>
        </div>
      )}
    </div>
  );
}
