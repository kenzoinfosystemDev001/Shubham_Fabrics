'use client';

import React, { useId } from 'react';

export const CHALLAN_NUMBER_MAX_LENGTH = 64;

/** Client-side check mirroring the server rule: required, trimmed, at most 64 characters. */
export function getChallanNumberError(value: string, label = 'Challan Number'): string | null {
  const trimmed = value.trim();
  if (!trimmed) return `${label} is required. Enter the challan number manually.`;
  if (trimmed.length > CHALLAN_NUMBER_MAX_LENGTH) return `${label} must be ${CHALLAN_NUMBER_MAX_LENGTH} characters or fewer.`;
  return null;
}

interface ChallanNumberInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  /** Error text to show under the field (e.g. a duplicate-number response from the server). */
  error?: string | null;
  disabled?: boolean;
  className?: string;
  /** Dark variant for slate-900 modal panels. */
  tone?: 'light' | 'dark';
}

/**
 * Manually entered challan number. Always starts blank — the system never
 * generates or pre-fills challan numbers.
 */
export function ChallanNumberInput({
  value,
  onChange,
  label = 'Challan Number',
  error,
  disabled = false,
  className = '',
  tone = 'light',
}: ChallanNumberInputProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const dark = tone === 'dark';

  return (
    <div className={className}>
      <label htmlFor={id} className={`block text-xs font-bold mb-1 ${dark ? 'text-slate-200' : 'text-slate-700'}`}>
        {label} <span className="text-rose-500">*</span>
      </label>
      <input
        id={id}
        type="text"
        required
        autoComplete="off"
        maxLength={CHALLAN_NUMBER_MAX_LENGTH}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        placeholder="Enter challan number"
        className={`w-full px-3 py-2 rounded-lg text-xs font-mono font-bold focus:outline-none focus:ring-2 transition ${
          dark
            ? 'bg-slate-950 text-white placeholder:text-slate-500'
            : 'bg-white text-slate-900 placeholder:text-slate-400 placeholder:font-normal'
        } ${
          error
            ? 'border border-rose-500 focus:ring-lavender-500/40'
            : dark
              ? 'border border-slate-600 focus:ring-lavender-300/40'
              : 'border border-slate-300 focus:ring-lavender-500/20'
        }`}
      />
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-[11px] font-semibold text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
