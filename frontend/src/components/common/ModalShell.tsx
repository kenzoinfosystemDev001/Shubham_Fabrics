'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// A dialog that always fits the visible screen: a fixed header and footer, and a body that scrolls on its own when
// the content is taller than the screen (any zoom, any device). Rendered at the document root, so no parent's
// overflow or stacking can clip it. While it is open the page behind does not scroll; Escape closes it unless `busy`.

export function ModalShell({
  title,
  titleId,
  onClose,
  busy,
  footer,
  bodyRef,
  children,
}: {
  title: React.ReactNode;
  titleId: string;
  onClose: () => void;
  /** While true (e.g. deleting), Escape and the close button do nothing. */
  busy?: boolean;
  footer: React.ReactNode;
  bodyRef?: React.Ref<HTMLDivElement>;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const body = document.body;
    const previous = body.style.overflow;
    body.style.overflow = 'hidden';
    return () => {
      body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 p-2 sm:p-4 text-left print:hidden" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="w-full max-w-lg max-h-[calc(100vh-1rem)] max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] flex flex-col bg-white rounded-2xl shadow-xl border border-neutral-200 overflow-hidden">
        <div className="shrink-0 px-4 sm:px-5 py-3 sm:py-4 border-b border-neutral-200 flex items-center justify-between gap-3">
          <h3 id={titleId} className="min-w-0 text-sm font-bold text-neutral-900 flex items-center gap-2 break-words">
            {title}
          </h3>
          <button type="button" onClick={onClose} disabled={busy} className="shrink-0 p-1.5 text-neutral-500 hover:bg-neutral-100 rounded-lg disabled:opacity-50" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div ref={bodyRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain p-4 sm:p-5 space-y-4 text-xs break-words">
          {children}
        </div>
        <div className="shrink-0 px-4 sm:px-5 py-3 sm:py-4 border-t border-neutral-200 flex justify-end gap-2">{footer}</div>
      </div>
    </div>,
    document.body,
  );
}
