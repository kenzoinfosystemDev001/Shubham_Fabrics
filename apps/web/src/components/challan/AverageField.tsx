'use client';

import React from 'react';
import { FIELD } from '@/components/workflow/WorkflowUi';

// Items of challans from Programming to Recutting: Size | Average | Unit | Remarks, where Size, Average and
// Unit are each a quantity with its own MTR / PCS. Units are never pre-selected and never converted.

export type QtyUnit = 'MTR' | 'PCS' | '';
export type AverageUnit = QtyUnit;

/** Why a quantity + unit pair cannot be saved, or null. Blank is fine unless required; a value needs its unit. */
export function quantityPairError(value: string, unit: QtyUnit, label: string, required = false): string | null {
  if (value.trim() === '') return required ? `enter the ${label}` : null;
  if (!(Number(value) >= 0) || (required && !(Number(value) > 0))) return `${label} must be ${required ? 'greater than 0' : '0 or more'}`;
  return unit ? null : `choose MTR or PCS for the ${label}`;
}

/** The optional Average check used by the forms. */
export function averageError(average: string, averageUnit: QtyUnit): string | null {
  return quantityPairError(average, averageUnit, 'Average');
}

/**
 * MTR / PCS selector. Without onChange it only shows a fixed unit (e.g. a stock line's own unit, which is
 * never converted), the other option greyed out.
 */
export function UnitToggle({
  value,
  onChange,
  label,
  invalid,
  disabled,
  lockedTitle,
}: {
  value: QtyUnit;
  onChange?: (unit: 'MTR' | 'PCS') => void;
  label: string;
  invalid?: boolean;
  disabled?: boolean;
  lockedTitle?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      title={invalid ? `Select MTR or PCS for the ${label.replace(/ unit$/i, '')}` : undefined}
      className={`inline-flex h-9 p-0.5 rounded-lg shrink-0 ${invalid ? 'bg-danger-50 ring-1 ring-danger-300' : 'bg-neutral-100'}`}
    >
      {(['MTR', 'PCS'] as const).map((unit) => {
        const active = value === unit;
        const tone = active ? 'bg-white text-brand-800 shadow-xs' : onChange ? 'text-neutral-500 hover:text-neutral-900' : 'text-neutral-400';
        return onChange ? (
          <button
            key={unit}
            type="button"
            role="radio"
            aria-checked={active}
            title={unit === 'MTR' ? 'Meters' : 'Pieces'}
            onClick={() => onChange(unit)}
            disabled={disabled}
            className={`px-2 rounded-md text-[11px] font-semibold transition cursor-pointer disabled:cursor-not-allowed ${tone}`}
          >
            {unit}
          </button>
        ) : (
          <span
            key={unit}
            role="radio"
            aria-checked={active}
            aria-disabled={!active}
            title={lockedTitle}
            className={`px-2 flex items-center rounded-md text-[11px] font-semibold ${tone}`}
          >
            {unit}
          </span>
        );
      })}
    </div>
  );
}

/** A quantity input with its own MTR / PCS selector (Size, Average or Unit of a challan entry). */
export function QuantityUnitField({
  label,
  value,
  unit,
  onValue,
  onUnit,
  required,
  disabled,
  min = '0',
  max,
  lockedTitle,
  inputClassName = FIELD,
}: {
  label: string;
  value: string;
  unit: QtyUnit;
  onValue: (value: string) => void;
  /** Leave out to show a fixed unit that cannot be changed. */
  onUnit?: (unit: 'MTR' | 'PCS') => void;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: number;
  lockedTitle?: string;
  inputClassName?: string;
}) {
  const needsUnit = !unit && (required || value.trim() !== '');
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        step="any"
        min={min}
        max={max}
        required={required}
        value={value}
        onChange={(e) => onValue(e.target.value)}
        onFocus={(e) => e.target.select()}
        disabled={disabled}
        className={`${inputClassName} tabular-nums min-w-0 disabled:bg-neutral-50`}
        aria-label={label}
      />
      <UnitToggle value={unit} onChange={onUnit} label={`${label} unit`} invalid={needsUnit && !disabled} disabled={disabled} lockedTitle={lockedTitle} />
    </div>
  );
}

/** The optional Average of a challan entry with its own MTR / PCS choice. */
export function AverageField({
  average,
  averageUnit,
  onChange,
  disabled,
}: {
  average: string;
  averageUnit: QtyUnit;
  onChange: (patch: { average?: string; averageUnit?: QtyUnit }) => void;
  disabled?: boolean;
}) {
  return (
    <QuantityUnitField
      label="Average"
      value={average}
      unit={averageUnit}
      onValue={(v) => onChange({ average: v })}
      onUnit={(u) => onChange({ averageUnit: u })}
      disabled={disabled}
    />
  );
}
