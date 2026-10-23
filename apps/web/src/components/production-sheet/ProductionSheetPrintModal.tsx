'use client';

import React, { useState } from 'react';
import { 
  Printer, 
  Download, 
  X, 
  FileText,
} from 'lucide-react';
import { 
  downloadProductionSheetHtml, 
  printProductionSheet,
  extractSubStylesAndGrid,
  calculateProductionMeasurementTotal,
  formatSizeExpressionTotal,
  SWATCH_CLIP_PATH,
  GarmentCategory
} from '@/lib/download-production-sheet';
import { getCurrentUser, canViewClientCode } from '@/lib/rbac';
import { useProgramDocument } from '@/hooks/useProgramDocument';

interface ProductionSheetPrintModalProps {
  program?: any;
  sheetData?: any;
  isOpen: boolean;
  onClose: () => void;
  initialTab?: GarmentCategory;
  onViewChallan?: () => void;
}

export function ProductionSheetPrintModal({
  program: propProgram,
  sheetData,
  isOpen,
  onClose,
  initialTab = 'TOP',
  onViewChallan,
}: ProductionSheetPrintModalProps) {
  const sourceProgram = propProgram || sheetData;
  const { program, loading, error } = useProgramDocument(sourceProgram, isOpen);
  const [activeTab, setActiveTab] = useState<GarmentCategory>(initialTab);

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

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
  const componentCategories: GarmentCategory[] = components
    ? Object.keys(components)
    : ['TOP', 'BOTTOM', 'DUPATTA', 'OTHER'];
  const activeTabName = components?.[activeTab]?.styleName || (activeTab === 'OTHER' ? 'INPUT' : activeTab);
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

  // 14 rows total to mirror the authentic physical factory sheet
  const TOTAL_GRID_ROWS = 14;
  const gridRows: {
    color: string;
    pcs: string | number;
    mtr: string | number;
    subStyle?: string;
    subStyles?: string[];
    size?: string;
    sizes: Record<string, string>;
  }[] = [];

  for (let i = 0; i < TOTAL_GRID_ROWS; i++) {
    if (i < productionGrid.length) {
      const item = productionGrid[i];
      let itemSubStyles = Array.isArray(item.subStyles) ? item.subStyles : [];
      if (itemSubStyles.length === 0 && item.subStyle) {
        itemSubStyles = String(item.subStyle).split(',').map((s) => s.trim()).filter(Boolean);
      }
      const itemSubStyleStr = itemSubStyles.length > 0 ? itemSubStyles.join(', ') : (item.subStyle || '');

      gridRows.push({
        color: item.color || '',
        pcs: item.pcs !== undefined ? item.pcs : '',
        mtr: item.mtr !== undefined ? item.mtr : '',
        subStyle: itemSubStyleStr,
        subStyles: itemSubStyles,
        size: item.size || item.sizes?.['SIZE'] || '',
        sizes: item.sizes || {},
      });
    } else {
      gridRows.push({
        color: '',
        pcs: '',
        mtr: '',
        subStyle: '',
        subStyles: [],
        size: '',
        sizes: {},
      });
    }
  }

  const totalMtr = productionGrid.reduce((sum, row) => sum + (Number(row.mtr) || 0), 0);
  const totalPcs = productionGrid.reduce((sum, row) => sum + (Number(row.pcs) || 0), 0);
  const totalMeasurement = calculateProductionMeasurementTotal(productionGrid);

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

          <div className="flex items-center gap-2 flex-wrap">
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
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer disabled:cursor-wait"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print {activeTab} Sheet</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#163767] hover:bg-[#0F264A] disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer disabled:cursor-wait"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download {activeTab} Sheet</span>
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

        {(loading || error) && (
          <div className={`px-5 py-2 text-xs ${error ? 'bg-rose-50 text-rose-800' : 'bg-blue-50 text-blue-800'}`}>
            {error || 'Loading complete production sheet details…'}
          </div>
        )}

        {/* COMPONENT TAB SELECTOR */}
        <div className="px-5 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5">
            {componentCategories.map((cat) => {
              const isEnabled = components ? components[cat]?.enabled !== false : (cat === 'TOP');
              const isForwarded = forwardedComponents.includes(cat);
              const categoryName = components?.[cat]?.styleName || (cat === 'OTHER' ? 'INPUT' : cat);
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
                  <span>{categoryName} Sheet</span>
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
                PRODUCTION SHEET &middot; {activeTabName}
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
                      <th rowSpan={2} className="border-[1.5px] border-black p-1.5 font-black text-left w-24 uppercase">COLOR</th>
                      <th colSpan={2} className="border-[1.5px] border-black p-1.5 font-black uppercase">QTY</th>
                      <th rowSpan={2} className="border-[1.5px] border-black p-1.5 font-black uppercase">
                        SUB STYLE
                      </th>
                      <th rowSpan={2} className="border-[1.5px] border-black p-1.5 font-black w-20 uppercase">SIZE</th>
                    </tr>
                    <tr className="bg-slate-50">
                      <th className="border-[1.5px] border-black p-1 font-black w-16 bg-slate-100">MTR</th>
                      <th className="border-[1.5px] border-black p-1 font-black w-14 bg-slate-100">PCS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gridRows.map((row, rIdx) => {
                      const rowSubStyles = row.subStyles && row.subStyles.length > 0
                        ? row.subStyles
                        : row.subStyle
                          ? row.subStyle.split(',').map((s) => s.trim()).filter(Boolean)
                          : [];

                      return (
                        <tr key={rIdx} className="h-6">
                          <td className="border-[1.5px] border-black p-1 text-left font-bold truncate">
                            {row.color}
                          </td>
                          <td className="border-[1.5px] border-black p-1 font-bold bg-slate-50/50">
                            {row.mtr !== '' ? row.mtr : ''}
                          </td>
                          <td className="border-[1.5px] border-black p-1 font-bold bg-slate-50/50">
                            {row.pcs !== '' ? row.pcs : ''}
                          </td>
                          <td className="border-[1.5px] border-black p-1 text-center font-bold">
                            {rowSubStyles.length > 0 ? (
                              <div className="flex flex-wrap items-center justify-center gap-1">
                                {rowSubStyles.map((sub, sIdx) => (
                                  <span
                                    key={sIdx}
                                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-blue-50 border border-blue-200 text-blue-900 shadow-2xs"
                                  >
                                    {sub}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 font-normal italic text-[11px]">—</span>
                            )}
                          </td>
                          <td className="border-[1.5px] border-black p-1 font-bold text-center">
                            {rowSubStyles.length > 1 && row.sizes && Object.keys(row.sizes).length > 0 ? (
                              <div className="flex flex-col items-center justify-center gap-0.5 text-xs">
                                {rowSubStyles.map((sub) => {
                                  const sz = row.sizes?.[sub];
                                  return (
                                    <div key={sub} className="flex items-center gap-1 text-[10px]">
                                      <span className="font-semibold text-slate-500 uppercase">{sub}:</span>
                                      <span className="font-black text-black">{sz || '—'}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <span>{row.size || (rowSubStyles[0] ? row.sizes?.[rowSubStyles[0]] : '') || ''}</span>
                            )}
                            {calculateProductionMeasurementTotal([row]) !== null && (
                              <div className="mt-0.5 text-[10px] font-black text-emerald-700">
                                TOTAL {formatSizeExpressionTotal(calculateProductionMeasurementTotal([row])!)}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-black border-t-2 border-black">
                      <td className="border-[1.5px] border-black p-1 text-left uppercase">{activeTabName} TOTALS:</td>
                      <td className="border-[1.5px] border-black p-1 text-center text-emerald-800">{totalMtr > 0 ? totalMtr.toFixed(2) : '—'}</td>
                      <td className="border-[1.5px] border-black p-1 text-center text-[#163767]">{totalPcs > 0 ? totalPcs : '—'}</td>
                      <td colSpan={2} className="border-[1.5px] border-black p-1 text-right text-[10px]">
                        TOTAL MEASUREMENT: {totalMeasurement !== null ? formatSizeExpressionTotal(totalMeasurement) : '—'}
                        {totalMtrAverage > 0 && <span className="ml-3 text-slate-500 italic">Fabric consumption @ {totalMtrAverage.toFixed(2)} Mtr/Pc</span>}
                      </td>
                    </tr>
                  </tfoot>
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
