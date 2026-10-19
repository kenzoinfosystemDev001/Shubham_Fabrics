'use client';

import React, { useState } from 'react';
import { 
  Printer, 
  Download, 
  X, 
  FileText,
  Layers
} from 'lucide-react';
import { 
  downloadProductionSheetHtml, 
  printProductionSheet,
  extractSubStylesAndGrid,
  SWATCH_CLIP_PATH,
  GarmentCategory
} from '@/lib/download-production-sheet';
import { getCurrentUser, canViewClientCode } from '@/lib/rbac';

interface ProductionSheetPrintModalProps {
  program?: any;
  sheetData?: any;
  isOpen: boolean;
  onClose: () => void;
  initialTab?: GarmentCategory;
}

export function ProductionSheetPrintModal({
  program: propProgram,
  sheetData,
  isOpen,
  onClose,
  initialTab = 'TOP',
}: ProductionSheetPrintModalProps) {
  const program = propProgram || sheetData;
  const [activeTab, setActiveTab] = useState<GarmentCategory>(initialTab);

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

  const serialNo = program.programSerialNo || program.programNumber || '';
  const designNo = program.designNumber || program.designName || '';
  const dateVal = program.startDate || program.programDate 
    ? new Date(program.startDate || program.programDate).toLocaleDateString('en-GB') 
    : new Date().toLocaleDateString('en-GB');

  const {
    subStylesWithAverages,
    productionGrid,
    swatches,
    topName,
    pattern,
    noteText,
    remarksText,
    totalMtrAverage,
    fabricName,
    fabricWidth,
  } = extractSubStylesAndGrid(program, activeTab);

  const subStyleColumns = subStylesWithAverages.map((s) => s.name);

  // 14 rows total to mirror the authentic physical factory sheet
  const TOTAL_GRID_ROWS = 14;
  const gridRows: {
    color: string;
    pcs: string | number;
    mtr: string | number;
    subStyle?: string;
    size?: string;
    sizes: Record<string, string>;
  }[] = [];

  for (let i = 0; i < TOTAL_GRID_ROWS; i++) {
    if (i < productionGrid.length) {
      gridRows.push({
        color: productionGrid[i].color || '',
        pcs: productionGrid[i].pcs !== undefined ? productionGrid[i].pcs : '',
        mtr: productionGrid[i].mtr !== undefined ? productionGrid[i].mtr : '',
        subStyle: productionGrid[i].subStyle || '',
        size: productionGrid[i].size || productionGrid[i].sizes?.['SIZE'] || '',
        sizes: productionGrid[i].sizes || {},
      });
    } else {
      gridRows.push({
        color: '',
        pcs: '',
        mtr: '',
        subStyle: '',
        size: '',
        sizes: {},
      });
    }
  }

  const handlePrint = () => {
    printProductionSheet(program, activeTab);
  };

  const handleDownload = () => {
    void downloadProductionSheetHtml(program, activeTab);
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
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-800">
                Production Sheet Specification Form
              </div>
              <h2 className="text-base font-bold text-slate-900">
                Traveler #{serialNo} &middot; {designNo}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print {activeTab} Sheet</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#163767] hover:bg-[#0F264A] text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download {activeTab}</span>
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

        {/* COMPONENT TAB SELECTOR */}
        <div className="px-5 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5">
            {(['TOP', 'BOTTOM', 'DUPATTA', 'OTHER'] as GarmentCategory[]).map((cat) => {
              const isEnabled = components ? components[cat]?.enabled !== false : (cat === 'TOP');
              const isForwarded = forwardedComponents.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
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
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => printProductionSheet(program, 'ALL')}
              className="text-[11px] font-semibold text-blue-700 hover:underline px-2 py-1 rounded hover:bg-blue-50 cursor-pointer"
            >
              Print All Forwarded
            </button>
          </div>
        </div>

        {/* MODAL BODY: DOCUMENT PREVIEW */}
        <div className="p-4 sm:p-6 overflow-y-auto bg-slate-100 flex-1">
          <div className="max-w-[760px] mx-auto bg-white p-6 sm:p-8 rounded shadow-sm border-2 border-black text-black font-sans space-y-4">
            
            {/* Header: Company Name & Category */}
            <div className="text-center border-b-2 border-black pb-3">
              <div className="text-sm font-black tracking-wider uppercase text-slate-800">
                SHUBHAM FABRICS INDIA PVT. LTD.
              </div>
              <div className="text-xl font-black tracking-widest uppercase text-blue-950 mt-1">
                PRODUCTION SHEET &middot; {activeTab}
              </div>
            </div>

            {/* Order Meta Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-300 rounded text-xs">
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
                <span className="font-black text-slate-900">
                  {program.clientName || program.buyerName || 'Standard Client'}
                  {canSeeClientCode && (
                    <span className="ml-1 text-[10px] font-mono text-amber-900 font-bold">
                      ({program.clientCode})
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Style & Fabric Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border border-black p-2.5 bg-white">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">STYLE</span>
                <span className="font-bold text-slate-900">{topName || program.mainStyle || 'Standard'}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">PATTERN</span>
                <span className="font-bold text-slate-900">{pattern || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">FABRIC</span>
                <span className="font-bold text-slate-900">{fabricName || 'Cotton'}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">FABRIC WIDTH</span>
                <span className="font-bold text-slate-900">{fabricWidth || '58"'}</span>
              </div>
            </div>

            {/* Sub-Style Averages Table */}
            <div className="space-y-1">
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-800">
                AVERAGE CONSUMPTION (METERS / PIECE)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border-[1.5px] border-black text-center text-xs">
                  <thead>
                    <tr className="bg-slate-50">
                      {subStylesWithAverages.map((s, idx) => (
                        <th key={idx} className="border-[1.5px] border-black p-1.5 font-black text-[11px] uppercase tracking-wider">
                          {s.name}
                        </th>
                      ))}
                      <th className="border-[1.5px] border-black p-1.5 font-black text-[11px] uppercase tracking-wider bg-slate-100">
                        TOTAL MTR
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="h-7 font-bold text-xs">
                      {subStylesWithAverages.map((s, idx) => (
                        <td key={idx} className="border-[1.5px] border-black p-1">
                          {s.average ? Number(s.average).toFixed(2) : '—'}
                        </td>
                      ))}
                      <td className="border-[1.5px] border-black p-1 font-black bg-slate-100 text-blue-950">
                        {totalMtrAverage > 0 ? totalMtrAverage.toFixed(2) : '—'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Main Production Grid (14 Rows) */}
            <div className="space-y-1">
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-800">
                COLOR &amp; QUANTITY BREAKDOWN
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border-[1.5px] border-black text-xs text-center">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="border-[1.5px] border-black p-1.5 font-black text-left w-24">COLOR</th>
                      {subStyleColumns.map((colName, cIdx) => (
                        <th key={cIdx} className="border-[1.5px] border-black p-1.5 font-black uppercase">
                          {colName}
                        </th>
                      ))}
                      <th className="border-[1.5px] border-black p-1.5 font-black w-14 bg-slate-100">PCS</th>
                      <th className="border-[1.5px] border-black p-1.5 font-black w-14 bg-slate-100">MTR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gridRows.map((row, rIdx) => (
                      <tr key={rIdx} className="h-6">
                        <td className="border-[1.5px] border-black p-1 text-left font-bold truncate">
                          {row.color}
                        </td>
                        {subStyleColumns.map((colName, cIdx) => (
                          <td key={cIdx} className="border-[1.5px] border-black p-1 font-semibold">
                            {row.sizes[colName] || (cIdx === 0 && row.subStyle === colName ? row.size : '') || ''}
                          </td>
                        ))}
                        <td className="border-[1.5px] border-black p-1 font-bold bg-slate-50/50">
                          {row.pcs !== '' ? row.pcs : ''}
                        </td>
                        <td className="border-[1.5px] border-black p-1 font-bold bg-slate-50/50">
                          {row.mtr !== '' ? row.mtr : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Swatches Section */}
            {swatches.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 block">
                  FABRIC SWATCH ATTACHMENTS
                </span>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {swatches.map((swatch, sIdx) => (
                    <div key={sIdx} className="p-2 border border-black rounded text-center space-y-1">
                      <div
                        className="w-full h-8 rounded border border-black/30"
                        style={{
                          backgroundColor: swatch.color,
                          clipPath: SWATCH_CLIP_PATH,
                        }}
                      />
                      <span className="text-[10px] font-bold truncate block">{swatch.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes & Remarks */}
            {(noteText || remarksText) && (
              <div className="p-3 bg-amber-50/60 border border-amber-200 rounded text-xs space-y-1">
                {noteText && (
                  <div>
                    <span className="font-bold text-amber-950">NOTE: </span>
                    <span className="text-amber-900">{noteText}</span>
                  </div>
                )}
                {remarksText && (
                  <div>
                    <span className="font-bold text-amber-950">REMARKS: </span>
                    <span className="text-amber-900">{remarksText}</span>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
