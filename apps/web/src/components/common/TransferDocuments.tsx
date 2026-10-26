'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { FileText, Loader2, RotateCw } from 'lucide-react';
import { DocumentActionButtons } from '@/components/common/DocumentActionButtons';

interface TransferDocumentsProps {
  /** The received challan. Falls back to `challan.id`. */
  challanId?: string | null;
  /** Already-loaded challan row (only its id is needed; the documents are fetched fresh). */
  challan?: any;
  size?: 'xs' | 'sm' | 'md';
  showLabels?: boolean;
  /** Fetch immediately instead of waiting for a click (use for single-challan detail panes). */
  autoLoad?: boolean;
  className?: string;
}

type TransferDocs = { challan: any; program: any | null };
type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; docs: TransferDocs }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string };

// Successful loads are shared between every list and pane showing the same challan.
const docsCache = new Map<string, TransferDocs>();

async function fetchTransferDocs(challanId: string): Promise<LoadState> {
  const cached = docsCache.get(challanId);
  if (cached) return { status: 'ready', docs: cached };
  try {
    const res = await fetch(`/api/challans/${encodeURIComponent(challanId)}/documents`, { cache: 'no-store' });
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      return { status: 'unavailable', message: 'Documents not available' };
    }
    if (!res.ok) return { status: 'error', message: 'Could not load documents' };
    const docs = (await res.json()) as TransferDocs;
    docsCache.set(challanId, docs);
    return { status: 'ready', docs };
  } catch {
    return { status: 'error', message: 'Could not load documents' };
  }
}

/**
 * Production Sheet, Challan and Wilcom actions for ONE received transfer: the challan row itself
 * and the original sheet of the program it carries, loaded from /api/challans/[id]/documents
 * on first click so lists don't fetch per row.
 */
export function TransferDocuments({
  challanId,
  challan,
  size = 'xs',
  showLabels = true,
  autoLoad = false,
  className = '',
}: TransferDocumentsProps) {
  const id: string | undefined = challanId || challan?.id || undefined;
  const [state, setState] = useState<LoadState>(() => {
    const cached = id ? docsCache.get(id) : undefined;
    return cached ? { status: 'ready', docs: cached } : { status: 'idle' };
  });

  const load = useCallback(async () => {
    if (!id) return;
    setState({ status: 'loading' });
    setState(await fetchTransferDocs(id));
  }, [id]);

  useEffect(() => {
    const cached = id ? docsCache.get(id) : undefined;
    if (cached) setState({ status: 'ready', docs: cached });
    else if (autoLoad && id) void load();
    else setState({ status: 'idle' });
  }, [id, autoLoad, load]);

  const textClass = size === 'md' ? 'text-xs' : 'text-[10px]';
  const iconSize = size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3';

  if (!id) {
    return <span className={`${textClass} text-neutral-500 ${className}`}>Documents not available</span>;
  }

  if (state.status === 'idle' || state.status === 'loading') {
    return (
      <button
        type="button"
        onClick={() => void load()}
        disabled={state.status === 'loading'}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-brand-200 bg-brand-50 ${textClass} font-bold text-brand-900 hover:bg-brand-100 disabled:opacity-60 transition cursor-pointer ${className}`}
        title="View, print or download the production sheet and this challan"
      >
        {state.status === 'loading' ? <Loader2 className={`${iconSize} animate-spin`} /> : <FileText className={iconSize} />}
        <span>Documents</span>
      </button>
    );
  }

  if (state.status === 'unavailable') {
    return <span className={`${textClass} text-neutral-500 ${className}`}>{state.message}</span>;
  }

  if (state.status === 'error') {
    return (
      <span className={`inline-flex items-center gap-1 ${textClass} text-danger-700 ${className}`}>
        {state.message}
        <button type="button" onClick={() => void load()} className="p-0.5 rounded hover:bg-danger-50 cursor-pointer" title="Retry">
          <RotateCw className={iconSize} />
        </button>
      </span>
    );
  }

  const { docs } = state;
  return (
    <span className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
      <DocumentActionButtons program={docs.program || undefined} challan={docs.challan} size={size} showLabels={showLabels} />
      {!docs.program && <span className={`${textClass} text-neutral-500`}>Production sheet not available</span>}
    </span>
  );
}
