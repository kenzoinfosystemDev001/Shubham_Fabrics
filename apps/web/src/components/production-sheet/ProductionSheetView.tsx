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
  calculateProductionMeasurementTotal,
  formatSizeExpressionTotal,
  SWATCH_CLIP_PATH,
  printProductionSheet,
  downloadProductionSheetHtml,
  productionSheetCategoriesForViewer,
  sumSubStyleRowQuantities,
  getSubStyleUnits,
  getTotalPcsAverage,
} from '@/lib/download-production-sheet';
import { useProgramDocument } from '@/hooks/useProgramDocument';

interface ProductionSheetViewProps {
  program: any;
  activeCategory: GarmentCategory;
  onCategoryChange: (category: GarmentCategory) => void;
  onOpenPrintModal?: () => void;
  isClientCodeVisible?: boolean;
}

export function ProductionSheetView({
  program: sourceProgram,
  activeCategory,
  onCategoryChange,
  onOpenPrintModal,
  isClientCodeVisible = false,
}: ProductionSheetViewProps) {
  const { program, loading, error } = useProgramDocument(sourceProgram);
  let meta: any = null;
  if (program?.metadataJson) {
    try {
      meta = typeof program.metadataJson === 'string' ? JSON.parse(program.metadataJson) : program.metadataJson;
    } catch {}
  }

  const components = meta?.components || null;
  const componentCategories: GarmentCategory[] = productionSheetCategoriesForViewer(program);
  const activeCategoryName = components?.[activeCategory]?.styleName || (activeCategory === 'OTHER' ? 'INPUT' : activeCategory);
  const forwardedComponents: string[] = Array.isArray(meta?.forwardedComponents) ? meta.forwardedComponents : ['TOP'];

  const {
    subStylesWithAverages,
    productionGrid,
    swatches,
    topName,
    pattern,
    noteText,
    noteQtyMtr,
    noteQtyPcs,
    remarksText,
    totalMtrAverage,
    fabricName,
    fabricWidth,
  } = extractSubStylesAndGrid(program, activeCategory);

  const subStyleColumns = subStylesWithAverages.map((s) => s.name);
  const averageUnits = getSubStyleUnits(subStylesWithAverages);
  const totalPcsAverage = getTotalPcsAverage(subStylesWithAverages);

  // 14 rows total to match the physical factory sheet
  const TOTAL_GRID_ROWS = 14;
  const gridRows: {
    color: string;
    pcs: string | number;
    mtr: string | number;
    subStyle?: string;
    subStyles?: string[];
    size?: string;
    sizes: Record<string, string>;
    measurement?: string;
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
        measurement: item.measurement || '',
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

  const totalPcs = productionGrid.reduce((acc, row) => acc + (Number(row.pcs) || 0), 0);
  const totalMtr = productionGrid.reduce((acc, row) => acc + (Number(row.mtr) || 0), 0);
  const totalMeasurement = calculateProductionMeasurementTotal(productionGrid);

  return (
    <div className="space-y-4">
      {(loading || error) && (
        <div className={`rounded-md px-3 py-2 text-xs ${error ? 'bg-danger-50 text-danger-800' : 'bg-brand-50 text-brand-800'}`}>
          {error || 'Loading complete production sheet details…'}
        </div>
      )}
      {/* HEADER & ACTIONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 pb-3">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200">
            PRODUCTION SHEET &middot; TRAVELER #{program.programSerialNo || program.programNumber}
          </span>
          <h3 className="text-sm font-black text-neutral-900 mt-1 uppercase tracking-wide flex items-center gap-2">
            <span>{activeCategoryName} Production Sheet Breakdown</span>
            {isClientCodeVisible && program.clientCode && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-accent-100 text-accent-800 text-[10px] font-mono font-black border border-accent-300 normal-case">
                Client Code: {program.clientCode}
              </span>
            )}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => printProductionSheet(program, activeCategory)}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded shadow-2xs transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print {activeCategory}</span>
          </button>
          <button
            type="button"
            onClick={() => void downloadProductionSheetHtml(program, activeCategory)}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded shadow-2xs transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>
          {onOpenPrintModal && (
            <button
              type="button"
              onClick={onOpenPrintModal}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-neutral-300 text-neutral-900 text-xs font-bold rounded hover:bg-neutral-50 transition cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Print Modal</span>
            </button>
          )}
        </div>
      </div>

      {/* COMPONENT TAB SELECTOR */}
      <div className="flex items-center gap-2 pb-2 border-b border-neutral-200 overflow-x-auto">
        {componentCategories.map((cat) => {
          const isEnabled = components ? components[cat]?.enabled !== false : (cat === 'TOP');
          const isForwarded = forwardedComponents.includes(cat);
          const categoryName = components?.[cat]?.styleName || (cat === 'OTHER' ? 'INPUT' : cat);
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onCategoryChange(cat)}
              className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeCategory === cat
                  ? 'bg-brand-600 text-white shadow-2xs'
                  : isEnabled
                    ? 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200 border border-neutral-300'
                    : 'bg-neutral-50 text-neutral-500 border border-neutral-200'
              }`}
            >
              <span>{categoryName} Sheet</span>
              {isForwarded && (
                <span className="w-1.5 h-1.5 rounded-full bg-accent-400" title="Forwarded Component" />
              )}
            </button>
          );
        })}
      </div>

      {/* SUB-STYLES & INDIVIDUAL CONSUMPTION AVERAGE TABLE */}
      <div className="space-y-1">
        <div className="font-black text-xs uppercase tracking-wider text-neutral-900">
          {activeCategoryName} AVERAGE CONSUMPTION (METERS PER PIECE)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border-[1.5px] border-neutral-200 text-center text-xs">
            <thead>
              <tr className="bg-neutral-50">
                {subStylesWithAverages.map((s, idx) => (
                  <th key={idx} className="border-[1.5px] border-neutral-200 p-1.5 font-black text-[11px] uppercase tracking-wider">
                    {s.name}
                  </th>
                ))}
                {averageUnits.hasMtr && (
                  <th className="border-[1.5px] border-neutral-200 p-1.5 font-black text-[11px] uppercase tracking-wider bg-neutral-100">
                    TOTAL MTR
                  </th>
                )}
                {averageUnits.hasPcs && (
                  <th className="border-[1.5px] border-neutral-200 p-1.5 font-black text-[11px] uppercase tracking-wider bg-neutral-100">
                    TOTAL PCS
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              <tr className="h-7 font-bold text-xs">
                {subStylesWithAverages.map((s, idx) => (
                  <td key={idx} className="border-[1.5px] border-neutral-200 p-1 align-top">
                    {s.unit === 'PCS'
                      ? (sumSubStyleRowQuantities(s.rows) !== null ? `${sumSubStyleRowQuantities(s.rows)} PCS` : '—')
                      : (s.average ? Number(s.average).toFixed(2) : '—')}
                    {Array.isArray(s.rows) && s.rows.some((row) => String(row.part).trim() || String(row.mtr).trim()) && (
                      <div className="mt-1 space-y-0.5 text-[10px] font-semibold text-neutral-600">
                        {s.rows.map((row, rIdx) => (
                          <div key={rIdx} className="flex justify-between gap-2">
                            <span className="text-left">{row.part || '—'}</span>
                            <span>
                              {String(row.mtr).trim()
                                ? (s.unit === 'PCS' ? `${Number(row.mtr)} PCS` : Number(row.mtr).toFixed(2))
                                : '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                ))}
                {averageUnits.hasMtr && (
                  <td className="border-[1.5px] border-neutral-200 p-1 font-black bg-neutral-100 text-brand-900">
                    {totalMtrAverage > 0 ? totalMtrAverage.toFixed(2) : '—'}
                  </td>
                )}
                {averageUnits.hasPcs && (
                  <td className="border-[1.5px] border-neutral-200 p-1 font-black bg-neutral-100 text-brand-900">
                    {totalPcsAverage > 0 ? totalPcsAverage : '—'}
                  </td>
                )}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 14-ROW COLOR BREAKDOWN MATRIX */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-black text-xs uppercase tracking-wider text-neutral-900">
            {activeCategoryName} PRODUCTION BREAKDOWN GRID
          </span>
          <span className="text-[11px] font-bold text-neutral-500">
            {productionGrid.length} Active Colors Recorded
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse border-[1.5px] border-neutral-200 text-center text-xs">
            <thead>
              <tr className="bg-neutral-50">
                <th rowSpan={2} className="border-[1.5px] border-neutral-200 p-1.5 font-black text-left w-28 uppercase">COLOR</th>
                <th colSpan={2} className="border-[1.5px] border-neutral-200 p-1.5 font-black uppercase">QTY</th>
                <th rowSpan={2} className="border-[1.5px] border-neutral-200 p-1.5 font-black uppercase">
                  SUB STYLE
                </th>
                <th rowSpan={2} className="border-[1.5px] border-neutral-200 p-1.5 font-black w-24 uppercase">SIZE</th>
                <th rowSpan={2} className="border-[1.5px] border-neutral-200 p-1.5 font-black w-24 uppercase">MEASUREMENT</th>
              </tr>
              <tr className="bg-neutral-50">
                <th className="border-[1.5px] border-neutral-200 p-1 font-black w-20 bg-neutral-100">MTR</th>
                <th className="border-[1.5px] border-neutral-200 p-1 font-black w-16 bg-neutral-100">PCS</th>
              </tr>
            </thead>
            <tbody>
              {gridRows.map((row, rIdx) => {
                const hasData = Boolean(row.color || row.pcs !== '' || row.mtr !== '');
                const rowSubStyles = row.subStyles && row.subStyles.length > 0
                  ? row.subStyles
                  : row.subStyle
                    ? row.subStyle.split(',').map((s) => s.trim()).filter(Boolean)
                    : [];

                return (
                  <tr key={rIdx} className={`h-7 ${hasData ? 'font-medium' : 'bg-neutral-50/20'}`}>
                    <td className="border-[1.5px] border-neutral-200 p-1 text-left font-bold truncate">
                      {row.color}
                    </td>
                    <td className="border-[1.5px] border-neutral-200 p-1 font-bold bg-neutral-50/40">
                      {row.mtr !== '' ? row.mtr : ''}
                    </td>
                    <td className="border-[1.5px] border-neutral-200 p-1 font-bold bg-neutral-50/40">
                      {row.pcs !== '' ? row.pcs : ''}
                    </td>
                    <td className="border-[1.5px] border-neutral-200 p-1 text-center font-bold">
                      {rowSubStyles.length > 0 ? (
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          {rowSubStyles.map((sub, sIdx) => (
                            <span
                              key={sIdx}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-brand-50 border border-brand-200 text-brand-900 shadow-2xs"
                            >
                              {sub}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-neutral-500 font-normal italic text-[11px]">—</span>
                      )}
                    </td>
                    <td className="border-[1.5px] border-neutral-200 p-1 font-bold text-center">
                      {rowSubStyles.length > 1 && row.sizes && Object.keys(row.sizes).length > 0 ? (
                        <div className="flex flex-col items-center justify-center gap-0.5 text-xs">
                          {rowSubStyles.map((sub) => {
                            const sz = row.sizes?.[sub];
                            return (
                              <div key={sub} className="flex items-center gap-1 text-[11px]">
                                <span className="font-semibold text-neutral-500 uppercase">{sub}:</span>
                                <span className="font-black text-neutral-900">{sz || '—'}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                      <span>{row.size || (rowSubStyles[0] ? row.sizes?.[rowSubStyles[0]] : '') || '—'}</span>
                      )}
                      {calculateProductionMeasurementTotal([row]) !== null && (
                        <div className="mt-0.5 text-[10px] font-black text-accent-800">
                          TOTAL {formatSizeExpressionTotal(calculateProductionMeasurementTotal([row])!)}
                        </div>
                      )}
                    </td>
                    <td className="border-[1.5px] border-neutral-200 p-1 font-bold text-center">
                      {row.measurement || ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="h-7 bg-neutral-100 font-black border-t-2 border-neutral-200">
                <td className="border-[1.5px] border-neutral-200 p-1 text-left uppercase">
                  {activeCategoryName} TOTALS:
                </td>
                <td className="border-[1.5px] border-neutral-200 p-1 font-black text-accent-800 text-center">
                  {totalMtr > 0 ? totalMtr.toFixed(2) : '—'}
                </td>
                <td className="border-[1.5px] border-neutral-200 p-1 font-black text-brand-600 text-center">
                  {totalPcs > 0 ? totalPcs : '—'}
                </td>
                <td colSpan={3} className="border-[1.5px] border-neutral-200 p-1 text-right text-[10px] pr-3">
                  <span className="font-black not-italic text-neutral-900">
                    TOTAL MEASUREMENT: {totalMeasurement !== null ? formatSizeExpressionTotal(totalMeasurement) : '—'}
                  </span>
                  {totalMtrAverage > 0 && (
                    <span className="ml-3 text-neutral-500 italic">
                      Fabric consumption @ {totalMtrAverage.toFixed(2)} Mtr/Pc
                    </span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* FABRIC SWATCH ATTACHMENTS */}
      {swatches.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-neutral-200">
          <div className="flex items-center gap-1.5">
            <Palette className="w-4 h-4 text-neutral-700" />
            <span className="font-black text-xs uppercase tracking-wider text-neutral-900">
              Fabric Swatches ({swatches.length})
            </span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {swatches.map((swatch, sIdx) => (
              <div key={sIdx} className="p-2 border border-neutral-200 rounded bg-white text-center space-y-1 shadow-2xs">
                <div
                  className="w-full h-8 rounded border border-neutral-200"
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
      {(noteText || noteQtyMtr || noteQtyPcs || remarksText) && (
        <div className="p-3 bg-accent-50/70 border border-accent-300 rounded-lg text-xs space-y-1 text-accent-800">
          {noteText && (
            <div>
              <span className="font-bold">NOTE: </span>
              <span>{noteText}</span>
            </div>
          )}
          {(noteQtyMtr || noteQtyPcs) && (
            <div className="flex flex-wrap gap-x-4">
              {noteQtyMtr && (
                <span><span className="font-bold">QTY (MTR): </span>{noteQtyMtr}</span>
              )}
              {noteQtyPcs && (
                <span><span className="font-bold">QTY (PCS): </span>{noteQtyPcs}</span>
              )}
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
