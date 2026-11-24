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
  /** Dark variant for neutral-900 modal panels. */
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
      <label htmlFor={id} className={`block text-xs font-bold mb-1 ${dark ? 'text-neutral-200' : 'text-neutral-700'}`}>
        {label} <span className="text-danger-500">*</span>
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
        placeholder=""
        className={`w-full px-3 py-2 rounded-lg text-xs font-mono font-bold focus:outline-none focus:ring-2 transition ${
          dark
            ? 'bg-neutral-900 text-white placeholder:text-neutral-500'
            : 'bg-white text-neutral-900 placeholder:text-neutral-400 placeholder:font-normal'
        } ${
          error
            ? 'border border-danger-500 focus:ring-brand-500/40'
            : dark
              ? 'border border-neutral-600 focus:ring-brand-300/40'
              : 'border border-neutral-300 focus:ring-brand-500/20'
        }`}
      />
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-[11px] font-semibold text-danger-600">
          {error}
        </p>
      )}
    </div>
  );
}
