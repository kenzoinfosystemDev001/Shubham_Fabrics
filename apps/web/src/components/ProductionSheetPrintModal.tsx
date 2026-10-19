'use client';

import React, { useState } from 'react';
import { 
  Printer, 
  Download, 
  X, 
  FileText,
  Layers,
  Sparkles
} from 'lucide-react';
import { 
  downloadProductionSheetHtml, 
  printProductionSheet,
  downloadWilcomFormHtml,
  printWilcomForm,
  extractSubStylesAndGrid,
  SWATCH_CLIP_PATH,
  GarmentCategory,
  WilcomEntry
} from '@/lib/download-production-sheet';
import { getCurrentUser, canViewClientCode } from '@/lib/rbac';

interface ProductionSheetPrintModalProps {
  program?: any;
  sheetData?: any;
  isOpen: boolean;
  onClose: () => void;
}

export function ProductionSheetPrintModal({
  program: propProgram,
  sheetData,
  isOpen,
  onClose,
}: ProductionSheetPrintModalProps) {
  const program = propProgram || sheetData;
  const [activeTab, setActiveTab] = useState<'TOP' | 'BOTTOM' | 'DUPATTA' | 'WILCOM'>('TOP');

  if (!isOpen || !program) return null;

  const currentUser = typeof window !== 'undefined' ? getCurrentUser() : null;
  const canSeeClientCode = canViewClientCode(currentUser) && Boolean(program.clientCode);

  let meta: any = null;
  if (program.metadataJson) {
    try {
      meta = typeof program.metadataJson === 'string' ? JSON.parse(program.metadataJson) : program.metadataJson;
    } catch {}
  }

  const components = meta?.components || null;
  const forwardedComponents: string[] = Array.isArray(meta?.forwardedComponents) ? meta.forwardedComponents : ['TOP'];
  const wilcomEntries: WilcomEntry[] = Array.isArray(meta?.wilcomEntries) ? meta.wilcomEntries : [];

  const serialNo = program.programSerialNo || program.programNumber || '';
  const designNo = program.designNumber || program.designName || '';
  const dateVal = program.startDate || program.programDate 
    ? new Date(program.startDate || program.programDate).toLocaleDateString('en-GB') 
    : new Date().toLocaleDateString('en-GB');

  const activeCategory: GarmentCategory = activeTab === 'WILCOM' ? 'TOP' : activeTab;

  const {
    subStylesWithAverages,
    productionGrid,
    swatches,
    topName,
    noteText,
    totalMtrAverage,
    fabricName,
    fabricWidth,
  } = extractSubStylesAndGrid(program, activeCategory);

  const subStyleColumns = subStylesWithAverages.map((s) => s.name);

  // 14 rows total to mirror the authentic physical sheet
  const TOTAL_GRID_ROWS = 14;
  const gridRows: {
    color: string;
    pcs: string | number;
    mtr: string | number;
    size?: string;
    sizes: Record<string, string>;
  }[] = [];

  for (let i = 0; i < TOTAL_GRID_ROWS; i++) {
    if (i < productionGrid.length) {
      gridRows.push({
        color: productionGrid[i].color || '',
        pcs: productionGrid[i].pcs !== undefined ? productionGrid[i].pcs : '',
        mtr: productionGrid[i].mtr !== undefined ? productionGrid[i].mtr : '',
        size: productionGrid[i].size || productionGrid[i].sizes?.['SIZE'] || '',
        sizes: productionGrid[i].sizes || {},
      });
    } else {
      gridRows.push({
        color: '',
        pcs: '',
        mtr: '',
        size: '',
        sizes: {},
      });
    }
  }

  const handlePrint = () => {
    if (activeTab === 'WILCOM') {
      printWilcomForm(program);
    } else {
      printProductionSheet(program, activeTab);
    }
  };

  const handleDownload = () => {
    if (activeTab === 'WILCOM') {
      void downloadWilcomFormHtml(program);
    } else {
      void downloadProductionSheetHtml(program, activeTab);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[96vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* MODAL HEADER */}
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-900 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Production Sheet &middot; {serialNo}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{activeTab === 'WILCOM' ? 'Print Wilcom Form' : `Print ${activeTab} Sheet`}</span>
            </button>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#163767] hover:bg-[#0F264A] text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{activeTab === 'WILCOM' ? 'Download Wilcom' : `Download ${activeTab}`}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* COMPONENT & WILCOM TAB SELECTOR */}
        <div className="px-5 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5">
            {(['TOP', 'BOTTOM', 'DUPATTA'] as GarmentCategory[]).map((cat) => {
              const isEnabled = components ? components[cat]?.enabled !== false : (cat === 'TOP');
              const isForwarded = forwardedComponents.includes(cat);
              return (
                <button
                  key={cat}
                  onClick={() => setActiveTab(cat)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeTab === cat
                      ? 'bg-[#163767] text-white shadow-xs'
                      : isEnabled
                        ? 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-200'
                        : 'bg-slate-100 text-slate-400 border border-slate-200'
                  }`}
                >
                  <span>{cat} Sheet</span>
                  {isForwarded && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Selected for forwarding" />
                  )}
                </button>
              );
            })}

            <button
              onClick={() => setActiveTab('WILCOM')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'WILCOM'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'bg-white text-purple-900 hover:bg-purple-50 border border-purple-200'
              }`}
            >
              <Sparkles className="w-3 h-3 text-purple-500" />
              <span>Wilcom Form</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-purple-100 text-purple-900 border border-purple-200">
                {wilcomEntries.length}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => printProductionSheet(program, 'ALL')}
              className="text-[11px] font-semibold text-blue-700 hover:underline px-2 py-1 rounded hover:bg-blue-50"
            >
              Print All Forwarded
            </button>
          </div>
        </div>

        {/* MODAL BODY */}

        {/* MODAL BODY: DOCUMENT PREVIEW */}
        <div className="p-4 sm:p-6 overflow-y-auto bg-slate-100 flex-1">
          {activeTab === 'WILCOM' ? (
            /* WILCOM EMBROIDERY SPECIFICATION PREVIEW */
            <div className="max-w-[760px] mx-auto bg-white p-6 sm:p-8 rounded shadow-sm border-2 border-black text-black font-sans space-y-4">
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
                  <span className="font-black text-slate-900">{designNo || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">SERIAL NO.</span>
                  <span className="font-black text-slate-900">{serialNo || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">DATE</span>
                  <span className="font-black text-slate-900">{dateVal}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">CLIENT</span>
                  <span className="font-black text-slate-900">{program.clientName || program.buyerName || 'Standard Client'}</span>
                </div>
              </div>

              {/* Wilcom Entries List */}
              {wilcomEntries.length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-slate-300 rounded-lg text-slate-500 space-y-2">
                  <Sparkles className="w-8 h-8 text-purple-400 mx-auto" />
                  <p className="font-bold text-sm text-slate-700">No Wilcom Designs Recorded Yet</p>
                  <p className="text-xs text-slate-500">
                    Use the Wilcom Form Management stage on the creation page to attach embroidery design numbers and photos.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {wilcomEntries.map((entry, idx) => (
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
                          <span className="font-black text-sm text-slate-900">
                            Entry #{idx + 1} &middot; {entry.styleName || 'Garment Style'}
                          </span>
                        </div>
                        <div className="font-mono font-black text-sm text-purple-950 bg-purple-100 px-2 py-0.5 rounded border border-purple-300">
                          WILCOM #: {entry.wilcomDesignNumber || 'N/A'}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-4 items-start">
                        <div className="w-[140px] h-[140px] border border-slate-300 rounded bg-slate-50 flex items-center justify-center overflow-hidden">
                          {entry.photoUrl ? (
                            <img src={entry.photoUrl} alt={entry.wilcomDesignNumber} className="w-full h-full object-contain" />
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400 text-center p-2">
                              No Reference Photo
                            </span>
                          )}
                        </div>

                        <div className="space-y-2 text-xs">
                          <div className="flex gap-2">
                            <span className="font-bold text-slate-500 w-24">Category:</span>
                            <span className="font-semibold text-slate-900">{entry.category} Garment Component</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="font-bold text-slate-500 w-24">Style Details:</span>
                            <span className="font-bold text-slate-900">{entry.styleName || 'Standard Style'}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="font-bold text-slate-500 w-24">Design Number:</span>
                            <span className="font-mono font-black text-purple-900">{entry.wilcomDesignNumber || '—'}</span>
                          </div>
                          {entry.remarks && (
                            <div className="flex gap-2">
                              <span className="font-bold text-slate-500 w-24">Remarks:</span>
                              <span className="text-slate-800 font-medium">{entry.remarks}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* COMPONENT SPEC SHEET PREVIEW */
            <div className="max-w-[760px] mx-auto bg-white p-6 sm:p-8 rounded shadow-sm border-2 border-black text-black font-sans space-y-4">
              
              {/* HEADER: PRODUCTION SHEET */}
              <div className="text-center font-black text-2xl tracking-[0.25em] uppercase text-black border-b border-black/10 pb-2">
                PRODUCTION SHEET &mdash; {activeTab}
              </div>

              {/* TOP META ROW */}
              <div className="flex justify-between items-start gap-4">
                {/* Left Column: DESIGN NO. & COMPONENT LABEL */}
                <div className="w-1/2 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-xs tracking-wider whitespace-nowrap">DESIGN NO.</span>
                    <div className="border-[1.5px] border-black px-3 py-1 h-7 min-w-[130px] flex items-center font-bold text-xs bg-white">
                      {designNo}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <span className="font-black text-xs tracking-wider whitespace-nowrap">{activeTab}:-</span>
                    <div className="border-b-[1.5px] border-black px-2 pb-0.5 min-w-[180px] flex-1 font-bold text-xs">
                      {topName}
                    </div>
                  </div>

                  {canSeeClientCode && (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="font-black text-xs tracking-wider whitespace-nowrap text-amber-900">CLIENT CODE:</span>
                      <div className="border-[1.5px] border-black px-2.5 py-0.5 h-6.5 min-w-[110px] flex items-center font-mono font-black text-xs bg-amber-50 text-amber-950">
                        {program.clientCode}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column: DATE: & SERIAL NO. */}
                <div className="w-1/2 space-y-2 flex flex-col items-end">
                  <div className="flex items-center justify-end gap-2">
                    <span className="font-black text-xs tracking-wider whitespace-nowrap">DATE:</span>
                    <div className="border-[1.5px] border-black px-3 py-1 h-7 min-w-[130px] flex items-center justify-center font-bold text-xs bg-white">
                      {dateVal}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <span className="font-black text-xs tracking-wider whitespace-nowrap">SERIAL NO.</span>
                    <div className="border-[1.5px] border-black px-3 py-1 h-7 min-w-[100px] flex items-center justify-center font-black text-base bg-white">
                      {serialNo}
                    </div>
                  </div>
                </div>
              </div>

              {/* FABRIC & WIDTH TABLE */}
              <div className="pt-1">
                <table className="w-full border-collapse border-[1.5px] border-black text-xs">
                  <tbody>
                    <tr>
                      <td className="border-[1.5px] border-black px-3 py-1.5 font-black uppercase w-28 bg-white">
                        FABRIC
                      </td>
                      <td className="border-[1.5px] border-black px-3 py-1.5 font-bold">
                        {fabricName}
                      </td>
                    </tr>
                    <tr>
                      <td className="border-[1.5px] border-black px-3 py-1.5 font-black uppercase w-28 bg-white">
                        WIDTH
                      </td>
                      <td className="border-[1.5px] border-black px-3 py-1.5 font-bold">
                        {fabricWidth}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* AVERAGE TABLE (SUB STYLES & AVERAGES) */}
              <div>
                <div className="font-black text-xs uppercase tracking-wider mb-1">
                  AVERAGE
                </div>
                <table className="w-full border-collapse border-[1.5px] border-black text-center text-xs">
                  <thead>
                    <tr className="bg-white">
                      {subStylesWithAverages.map((s, idx) => (
                        <th key={idx} className="border-[1.5px] border-black p-1.5 font-black text-[11px] tracking-wider uppercase">
                          {s.name}
                        </th>
                      ))}
                      <th className="border-[1.5px] border-black p-1.5 font-black text-[11px] tracking-wider uppercase">
                        TOTAL MTR
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="h-6 font-bold text-xs">
                      {subStylesWithAverages.map((s, idx) => (
                        <td key={idx} className="border-[1.5px] border-black p-1">
                          {s.average ? Number(s.average).toFixed(2) : ''}
                        </td>
                      ))}
                      <td className="border-[1.5px] border-black p-1 font-black">
                        {totalMtrAverage > 0 ? totalMtrAverage.toFixed(2) : ''}
                      </td>
                    </tr>
                    <tr className="h-5">
                      {subStylesWithAverages.map((_, idx) => (
                        <td key={idx} className="border-[1.5px] border-black"></td>
                      ))}
                      <td className="border-[1.5px] border-black"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* MAIN COLOR & SIZE BREAKDOWN GRID */}
              <table className="w-full border-collapse border-[1.5px] border-black text-center text-xs">
                <thead>
                  <tr className="bg-white">
                    <th rowSpan={2} className="border-[1.5px] border-black p-1 font-black text-xs tracking-wider uppercase w-28">
                      COLOR
                    </th>
                    <th colSpan={2} className="border-[1.5px] border-black p-1 font-black text-xs tracking-wider uppercase">
                      QTY
                    </th>
                    <th rowSpan={2} className="border-[1.5px] border-black p-1 font-black text-xs tracking-wider uppercase">
                      SIZE
                    </th>
                  </tr>
                  <tr className="bg-white">
                    <th className="border-[1.5px] border-black p-1 font-black text-[11px] w-14">PCS</th>
                    <th className="border-[1.5px] border-black p-1 font-black text-[11px] w-16">MTR</th>
                  </tr>
                </thead>
                <tbody>
                  {gridRows.map((row, rIdx) => (
                    <tr key={rIdx} className="h-6">
                      <td className="border-[1.5px] border-black px-2 py-0.5 text-left font-black text-xs">
                        {row.color}
                      </td>
                      <td className="border-[1.5px] border-black px-1 py-0.5 font-bold text-xs">
                        {row.pcs !== '' && row.pcs !== undefined ? row.pcs : ''}
                      </td>
                      <td className="border-[1.5px] border-black px-1 py-0.5 font-bold text-xs">
                        {row.mtr !== '' && row.mtr !== undefined ? row.mtr : ''}
                      </td>
                      <td className="border-[1.5px] border-black px-2 py-0.5 font-bold text-xs">
                        {row.size || row.sizes?.['SIZE'] || ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* FOOTER: NOTE, SWATCHES, SIGNATURE */}
              <div className="flex justify-between items-end pt-2">
                <div className="w-3/5 space-y-2">
                  <div className="font-black text-xs tracking-wider uppercase">NOTE:-</div>
                  {noteText && (
                    <div className="text-xs text-slate-800 leading-snug">
                      {noteText}
                    </div>
                  )}

                  {/* COLOR SWATCH SAMPLES */}
                  <div className="pt-2">
                    <div className="font-black text-[11px] tracking-wider uppercase text-[#163767] mb-1.5">
                      COLOR SWATCHES:
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      {swatches && swatches.length > 0 ? (
                        swatches.map((swatch, idx) => (
                          <div key={idx} className="flex flex-col items-center gap-1">
                            <div
                              className="relative w-10 h-10 shadow-xs"
                              style={{
                                backgroundColor: swatch.color || '#e2e8f0',
                                clipPath: SWATCH_CLIP_PATH,
                              }}
                            >
                              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-[2px] bg-slate-700 shadow-2xs" />
                            </div>
                            {swatch.name && (
                              <span
                                className="text-[8.5px] font-bold text-slate-700 max-w-[55px] truncate text-center"
                                title={swatch.name}
                              >
                                {swatch.name}
                              </span>
                            )}
                          </div>
                        ))
                      ) : (
                        [1, 2, 3, 4].map((i) => (
                          <div key={i} className="flex flex-col items-center gap-1">
                            <div className="w-10 h-10 border-[1.5px] border-dashed border-slate-400 bg-slate-50 relative flex items-center justify-center">
                              <span className="w-3.5 h-[2px] bg-slate-400 opacity-60" />
                            </div>
                            <span className="text-[8px] font-medium text-slate-400">Attach Swatch</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="w-1/3 text-center">
                  <div className="font-black text-xs tracking-wider uppercase mb-8">SIGNATURE</div>
                  <div className="border-b-[1.5px] border-black w-full mx-auto" />
                </div>
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
}
