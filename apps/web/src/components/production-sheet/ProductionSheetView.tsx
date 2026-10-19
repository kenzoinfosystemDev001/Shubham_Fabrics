'use client';

import React, { useState } from 'react';
import { 
  Printer, 
  Download, 
  Eye, 
  FileText,
  Layers,
  Palette
} from 'lucide-react';
import { 
  GarmentCategory,
  extractSubStylesAndGrid,
  SWATCH_CLIP_PATH,
  printProductionSheet,
  downloadProductionSheetHtml
} from '@/lib/download-production-sheet';

interface ProductionSheetViewProps {
  program: any;
  activeCategory: GarmentCategory;
  onCategoryChange: (category: GarmentCategory) => void;
  onOpenPrintModal?: () => void;
  isClientCodeVisible?: boolean;
}

export function ProductionSheetView({
  program,
  activeCategory,
  onCategoryChange,
  onOpenPrintModal,
  isClientCodeVisible = false,
}: ProductionSheetViewProps) {
  let meta: any = null;
  if (program?.metadataJson) {
    try {
      meta = typeof program.metadataJson === 'string' ? JSON.parse(program.metadataJson) : program.metadataJson;
    } catch {}
  }

  const components = meta?.components || null;
  const forwardedComponents: string[] = Array.isArray(meta?.forwardedComponents) ? meta.forwardedComponents : ['TOP'];

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
  } = extractSubStylesAndGrid(program, activeCategory);

  const subStyleColumns = subStylesWithAverages.map((s) => s.name);

  // 14 rows total to match the physical factory sheet
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

  const totalPcs = productionGrid.reduce((acc, row) => acc + (Number(row.pcs) || 0), 0);
  const totalMtr = productionGrid.reduce((acc, row) => acc + (Number(row.mtr) || 0), 0);

  return (
    <div className="space-y-4">
      {/* HEADER & ACTIONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/15 pb-3">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-black bg-slate-100 px-2 py-0.5 rounded border border-black/20">
            PRODUCTION SHEET &middot; TRAVELER #{program.programSerialNo || program.programNumber}
          </span>
          <h3 className="text-sm font-black text-black mt-1 uppercase tracking-wide flex items-center gap-2">
            <span>{activeCategory} Production Sheet Breakdown</span>
            {isClientCodeVisible && program.clientCode && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-950 text-[10px] font-mono font-black border border-amber-300 normal-case">
                🔒 Client Code: {program.clientCode}
              </span>
            )}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => printProductionSheet(program, activeCategory)}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded shadow-2xs transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print {activeCategory}</span>
          </button>
          <button
            type="button"
            onClick={() => void downloadProductionSheetHtml(program, activeCategory)}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-black text-white text-xs font-bold rounded shadow-2xs transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>
          {onOpenPrintModal && (
            <button
              type="button"
              onClick={onOpenPrintModal}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-300 text-slate-800 text-xs font-bold rounded hover:bg-slate-50 transition cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Print Modal</span>
            </button>
          )}
        </div>
      </div>

      {/* COMPONENT TAB SELECTOR */}
      <div className="flex items-center gap-2 pb-2 border-b border-black/10 overflow-x-auto">
        {(['TOP', 'BOTTOM', 'DUPATTA'] as GarmentCategory[]).map((cat) => {
          const isEnabled = components ? components[cat]?.enabled !== false : (cat === 'TOP');
          const isForwarded = forwardedComponents.includes(cat);
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onCategoryChange(cat)}
              className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeCategory === cat
                  ? 'bg-[#163767] text-white shadow-2xs'
                  : isEnabled
                    ? 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-300'
                    : 'bg-slate-50 text-slate-400 border border-slate-200'
              }`}
            >
              <span>{cat} Sheet</span>
              {isForwarded && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Forwarded Component" />
              )}
            </button>
          );
        })}
      </div>

      {/* SUB-STYLES & INDIVIDUAL CONSUMPTION AVERAGE TABLE */}
      <div className="space-y-1">
        <div className="font-black text-xs uppercase tracking-wider text-slate-800">
          {activeCategory} AVERAGE CONSUMPTION (METERS PER PIECE)
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

      {/* 14-ROW COLOR BREAKDOWN MATRIX */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-black text-xs uppercase tracking-wider text-slate-800">
            {activeCategory} PRODUCTION BREAKDOWN GRID
          </span>
          <span className="text-[11px] font-bold text-slate-500">
            {productionGrid.length} Active Colors Recorded
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse border-[1.5px] border-black text-center text-xs">
            <thead>
              <tr className="bg-slate-50">
                <th className="border-[1.5px] border-black p-1.5 font-black text-left w-28 uppercase">COLOR</th>
                {subStyleColumns.map((colName, cIdx) => (
                  <th key={cIdx} className="border-[1.5px] border-black p-1.5 font-black uppercase">
                    {colName}
                  </th>
                ))}
                <th className="border-[1.5px] border-black p-1.5 font-black w-16 bg-slate-100">PCS</th>
                <th className="border-[1.5px] border-black p-1.5 font-black w-16 bg-slate-100">MTR</th>
              </tr>
            </thead>
            <tbody>
              {gridRows.map((row, rIdx) => {
                const hasData = Boolean(row.color || row.pcs !== '' || row.mtr !== '');
                return (
                  <tr key={rIdx} className={`h-6 ${hasData ? 'font-medium' : 'bg-slate-50/20'}`}>
                    <td className="border-[1.5px] border-black p-1 text-left font-bold truncate">
                      {row.color}
                    </td>
                    {subStyleColumns.map((colName, cIdx) => (
                      <td key={cIdx} className="border-[1.5px] border-black p-1">
                        {row.sizes[colName] || (cIdx === 0 && row.subStyle === colName ? row.size : '') || ''}
                      </td>
                    ))}
                    <td className="border-[1.5px] border-black p-1 font-bold bg-slate-50/40">
                      {row.pcs !== '' ? row.pcs : ''}
                    </td>
                    <td className="border-[1.5px] border-black p-1 font-bold bg-slate-50/40">
                      {row.mtr !== '' ? row.mtr : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="h-7 bg-slate-100 font-black border-t-2 border-black">
                <td className="border-[1.5px] border-black p-1 text-left uppercase">
                  TOTAL
                </td>
                {subStyleColumns.map((_, cIdx) => (
                  <td key={cIdx} className="border-[1.5px] border-black p-1" />
                ))}
                <td className="border-[1.5px] border-black p-1 font-black text-blue-950">
                  {totalPcs > 0 ? totalPcs : '—'}
                </td>
                <td className="border-[1.5px] border-black p-1 font-black text-blue-950">
                  {totalMtr > 0 ? totalMtr.toFixed(2) : '—'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* FABRIC SWATCH ATTACHMENTS */}
      {swatches.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-black/10">
          <div className="flex items-center gap-1.5">
            <Palette className="w-4 h-4 text-slate-700" />
            <span className="font-black text-xs uppercase tracking-wider text-slate-800">
              Fabric Swatches ({swatches.length})
            </span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {swatches.map((swatch, sIdx) => (
              <div key={sIdx} className="p-2 border border-black rounded bg-white text-center space-y-1 shadow-2xs">
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

      {/* NOTES & REMARKS */}
      {(noteText || remarksText) && (
        <div className="p-3 bg-amber-50/70 border border-amber-300 rounded-lg text-xs space-y-1 text-amber-950">
          {noteText && (
            <div>
              <span className="font-bold">NOTE: </span>
              <span>{noteText}</span>
            </div>
          )}
          {remarksText && (
            <div>
              <span className="font-bold">REMARKS: </span>
              <span>{remarksText}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
