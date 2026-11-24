'use client';

import React from 'react';

interface ChallanNumberFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  /** Server or client validation message for this field (empty / duplicate number). */
  error?: string | null;
  id?: string;
  disabled?: boolean;
  className?: string;
  /** Compact single-line layout for modals and inline panels. */
  compact?: boolean;
  hint?: string;
  /** Keep the label for screen readers only (forms that render their own label column). */
  hideLabel?: boolean;
}

/**
 * Challan number typed by the issuing department. It starts blank, is required, and is saved
 * exactly as entered; the server rejects empty and already-used numbers.
 */
export function ChallanNumberField({
  value,
  onChange,
  label = 'Challan Number',
  error,
  id,
  disabled,
  className = '',
  compact = false,
  hint = 'Enter the number written on the physical challan.',
  hideLabel = false,
}: ChallanNumberFieldProps) {
  const inputId = id || `challan-number-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className={className}>
      <label htmlFor={inputId} className={`${hideLabel ? 'sr-only' : 'block'} font-bold text-neutral-700 ${compact ? 'text-[11px] mb-0.5' : 'text-xs mb-1'}`}>
        {label} <span className="text-danger-600">*</span>
      </label>
      <div className="relative">
        <input
          id={inputId}
          type="text"
          required
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder=""
          autoComplete="off"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={`w-full px-3 ${compact ? 'py-1.5' : 'py-2'} text-xs font-mono font-bold text-neutral-900 border rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-transparent transition disabled:bg-neutral-100 ${
            error ? 'border-danger-500' : 'border-neutral-300'
          }`}
        />
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="mt-1 text-[11px] font-semibold text-danger-700">
          {error}
        </p>
      ) : hint && !compact ? (
        <p className="mt-1 text-[10px] text-neutral-500">{hint}</p>
      ) : null}
    </div>
  );
}

/** Client-side check matching the server rule; returns an error message or null. */
export function challanNumberClientError(value: string, label = 'Challan Number'): string | null {
  return value.trim() ? null : `${label} is required.`;
}

/**
 * Idempotency key for one challan form fill. crypto.randomUUID is missing on plain-HTTP LAN
 * origins, so fall back to time + randomness there.
 */
export function newSubmissionKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
