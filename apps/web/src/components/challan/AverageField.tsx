'use client';

import React from 'react';
import { FIELD } from '@/components/workflow/WorkflowUi';

export type AverageUnit = 'MTR' | 'PCS' | '';

/** A blank Average needs no unit; an entered one must say MTR or PCS (never pre-selected, never converted). */
export function averageError(average: string, averageUnit: AverageUnit): string | null {
  if (average.trim() === '') return null;
  if (!(Number(average) >= 0)) return 'Average must be 0 or more';
  return averageUnit ? null : 'choose MTR or PCS for the Average';
}

/** The optional Average of a challan entry with its own MTR / PCS choice (Items: Size | Average | Unit | Remarks). */
export function AverageField({
  average,
  averageUnit,
  onChange,
  disabled,
}: {
  average: string;
  averageUnit: AverageUnit;
  onChange: (patch: { average?: string; averageUnit?: AverageUnit }) => void;
  disabled?: boolean;
}) {
  const needsUnit = average.trim() !== '' && !averageUnit;
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min="0"
        step="any"
        value={average}
        onChange={(e) => onChange({ average: e.target.value })}
        disabled={disabled}
        className={`${FIELD} tabular-nums min-w-0`}
        aria-label="Average"
      />
      <div
        role="radiogroup"
        aria-label="Average unit"
        title={needsUnit ? 'Select MTR or PCS for the Average' : undefined}
        className={`inline-flex h-9 p-0.5 rounded-lg shrink-0 ${needsUnit ? 'bg-danger-50 ring-1 ring-danger-300' : 'bg-neutral-100'}`}
      >
        {(['MTR', 'PCS'] as const).map((unit) => (
          <button
            key={unit}
            type="button"
            role="radio"
            aria-checked={averageUnit === unit}
            title={unit === 'MTR' ? 'Meters' : 'Pieces'}
            onClick={() => onChange({ averageUnit: unit })}
            disabled={disabled}
            className={`px-2 rounded-md text-[11px] font-semibold transition cursor-pointer disabled:cursor-not-allowed ${
              averageUnit === unit ? 'bg-white text-brand-800 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            {unit}
          </button>
        ))}
      </div>
    </div>
  );
}
