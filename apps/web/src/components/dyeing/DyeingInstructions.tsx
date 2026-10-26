'use client';

import React from 'react';
import { Droplets } from 'lucide-react';
import { mapChallanItemsToDyeingLines } from '@/lib/dyeing-instructions.mjs';

interface DyeingInstructionsProps {
  /** The inbound Fabric Store challan with its items. */
  challan?: { id?: string; challanNumber?: string; fabricUnit?: string | null; items?: any[] } | null;
  /** The production sheet the challan belongs to. */
  program?: { id?: string; programNumber?: string; programSerialNo?: string | null; fabricName?: string | null; fabricType?: string | null } | null;
  /** The actual shade recorded by Dyeing, shown apart from the required colours. */
  dyedColor?: string | null;
}

const fmt = (value: number) => value.toLocaleString('en-IN', { maximumFractionDigits: 2 });

/**
 * Every line of the challan Fabric Store issued to Dyeing: the fabric as it is now, the colour it
 * must be dyed to, and its own quantity and unit. Lines recorded before required colours were
 * captured show "Not specified" rather than a guessed colour.
 */
export function DyeingInstructions({ challan, program, dyedColor }: DyeingInstructionsProps) {
  const lines = mapChallanItemsToDyeingLines(challan ? { ...challan, program } : null);

  return (
    <div className="border border-brand-200 rounded-lg bg-white overflow-hidden">
      <div className="px-3 py-1.5 bg-brand-50 border-b border-brand-200 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px]">
        <span className="inline-flex items-center gap-1 font-bold uppercase tracking-wider text-brand-900">
          <Droplets className="w-3 h-3" />
          Dyeing Instructions
        </span>
        <span className="text-neutral-600 font-mono">
          Sheet {program?.programSerialNo || program?.programNumber || '—'}
        </span>
        <span className="text-neutral-600 font-mono">Challan {challan?.challanNumber || '—'}</span>
        <span className="ml-auto text-neutral-600">
          Actual shade: <strong className="text-neutral-900">{dyedColor || 'Not recorded yet'}</strong>
        </span>
      </div>
      {lines.length === 0 ? (
        <p className="px-3 py-2 text-[11px] text-neutral-500">
          {challan ? 'This challan has no item lines.' : 'No inbound challan linked to this order.'}
        </p>
      ) : (
        <table className="w-full text-[11px]">
          <thead className="text-[10px] uppercase tracking-wider text-neutral-500">
            <tr className="border-b border-neutral-200">
              <th className="px-3 py-1 text-left font-bold w-8">#</th>
              <th className="px-3 py-1 text-left font-bold">Fabric</th>
              <th className="px-3 py-1 text-left font-bold">Current colour / shade</th>
              <th className="px-3 py-1 text-left font-bold">Required colour</th>
              <th className="px-3 py-1 text-right font-bold">Quantity</th>
              <th className="px-3 py-1 text-right font-bold">To dye</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {lines.map((line) => (
              <tr key={line.itemId || line.lineNo}>
                <td className="px-3 py-1 font-mono text-neutral-500">{line.lineNo}</td>
                <td className="px-3 py-1 text-neutral-900">
                  <span className="font-semibold">{line.fabric}</span>
                  {line.fabricType && <span className="text-neutral-500"> · {line.fabricType}</span>}
                </td>
                <td className="px-3 py-1 text-neutral-900">
                  {[line.currentColour, line.currentShade].filter(Boolean).join(' / ') || (
                    <span className="text-neutral-500 italic">Not specified</span>
                  )}
                </td>
                <td className="px-3 py-1">
                  {line.requiredColour ? (
                    <span className="font-bold text-brand-900">{line.requiredColour}</span>
                  ) : (
                    <span className="text-neutral-500 italic">Not specified</span>
                  )}
                </td>
                <td className="px-3 py-1 text-right font-mono font-semibold text-neutral-900 whitespace-nowrap">
                  {fmt(line.quantity)} {line.unit}
                </td>
                <td className="px-3 py-1 text-right font-mono text-neutral-700 whitespace-nowrap">
                  {line.requiredQuantity !== null ? `${fmt(line.requiredQuantity)} ${line.unit}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
