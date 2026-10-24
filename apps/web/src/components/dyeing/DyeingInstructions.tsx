'use client';

import React from 'react';
import { Droplet } from 'lucide-react';

export interface DyeingInstructionLine {
  id?: string;
  itemDescription?: string | null;
  fabricCode?: string | null;
  colour?: string | null;
  shade?: string | null;
  requiredDyeColor?: string | null;
  requiredDyeQuantity?: number | null;
  quantity?: number | string | null;
  uom?: string | null;
}

interface DyeingInstructionsProps {
  challanNumber?: string | null;
  productionSheetNumber?: string | null;
  fabricType?: string | null;
  lines: DyeingInstructionLine[];
  /** Highlights the line a particular dyeing order was created from. */
  highlightLineId?: string | null;
  className?: string;
}

/**
 * Dyeing Instructions for an incoming Fabric Store challan: one row per required colour
 * with its own quantity and unit. The current fabric shade and the required dyeing colour
 * are shown in separate columns and are never substituted for one another.
 */
export function DyeingInstructions({
  challanNumber,
  productionSheetNumber,
  fabricType,
  lines,
  highlightLineId,
  className = '',
}: DyeingInstructionsProps) {
  const hasLegacyLines = lines.some((line) => !line.requiredDyeColor);

  return (
    <section className={`border border-purple-200 rounded-xl bg-white overflow-hidden ${className}`} aria-label="Dyeing Instructions">
      <div className="px-4 py-2.5 bg-purple-50 border-b border-purple-200 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
          <Droplet className="w-3.5 h-3.5 text-purple-700" />
          Dyeing Instructions
        </h4>
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-600">
          {challanNumber && <span>Challan: <strong className="text-slate-900">{challanNumber}</strong></span>}
          {productionSheetNumber && <span>Sheet: <strong className="text-slate-900">{productionSheetNumber}</strong></span>}
        </div>
      </div>

      {lines.length === 0 ? (
        <p className="px-4 py-4 text-xs text-slate-500 italic">No line items were recorded on this challan.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-2 px-3 w-8">#</th>
                <th className="py-2 px-3">Fabric</th>
                <th className="py-2 px-3">Fabric Type</th>
                <th className="py-2 px-3">Current Fabric Color / Shade</th>
                <th className="py-2 px-3">Required Dyeing Color</th>
                <th className="py-2 px-3 text-right">Qty to Dye</th>
                <th className="py-2 px-3 text-right">Qty Issued</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((line, index) => {
                const unit = line.uom || '';
                const issued = Number(line.quantity) || 0;
                const toDye = line.requiredDyeQuantity ?? (line.requiredDyeColor ? issued : null);
                return (
                  <tr key={line.id || index} className={line.id && line.id === highlightLineId ? 'bg-purple-50/70' : ''}>
                    <td className="py-2 px-3 font-mono text-slate-400">{index + 1}</td>
                    <td className="py-2 px-3 font-semibold text-slate-900">{line.fabricCode || line.itemDescription || '—'}</td>
                    <td className="py-2 px-3 text-slate-700">{fabricType || '—'}</td>
                    <td className="py-2 px-3 text-slate-800">{line.colour || '—'}</td>
                    <td className="py-2 px-3">
                      {line.requiredDyeColor ? (
                        <span className="font-bold text-purple-900">{line.requiredDyeColor}</span>
                      ) : (
                        <span className="text-amber-800 italic">
                          Not recorded separately{line.shade ? ` (challan shade field: ${line.shade})` : ''}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-purple-900">
                      {toDye !== null ? `${toDye} ${unit}` : '—'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700">{issued} {unit}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {hasLegacyLines && lines.length > 0 && (
        <p className="px-4 py-2 border-t border-amber-200 bg-amber-50 text-[11px] text-amber-900">
          This challan was issued before the required dyeing colour was stored separately. Confirm the colour with the Fabric Store before dyeing.
        </p>
      )}
    </section>
  );
}
