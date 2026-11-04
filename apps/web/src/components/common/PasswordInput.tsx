'use client';

import React, { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

// Password / PIN input with a Show / Hide button inside its right edge. Hidden by default; each field keeps its own
// visibility, and showing it only changes how this input displays (what is typed and sent is unchanged). Every other
// input prop (value / defaultValue, required, disabled, placeholder, autoComplete ...) passes straight through.
// The caller's className must leave room on the right for the button (pr-10 or more). `children` is drawn inside the
// same positioned wrapper, for decorations such as a leading icon.

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  wrapperClassName?: string;
  children?: React.ReactNode;
};

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { wrapperClassName, children, disabled, ...inputProps },
  ref,
) {
  const [visible, setVisible] = useState(false);
  const label = visible ? 'Hide password' : 'Show password';
  return (
    <div className={`relative ${wrapperClassName || ''}`}>
      <input ref={ref} {...inputProps} disabled={disabled} type={visible ? 'text' : 'password'} />
      {children}
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        disabled={disabled}
        title={label}
        aria-label={label}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex items-center px-3 rounded-r-[inherit] text-neutral-500 hover:text-neutral-900 focus:outline-none focus-visible:text-brand-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
      >
        {visible ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
      </button>
    </div>
  );
});
