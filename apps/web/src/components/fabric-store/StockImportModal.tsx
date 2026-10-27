'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, PenLine, UploadCloud, X } from 'lucide-react';
import { MAX_IMPORT_FILE_BYTES } from '@/lib/stock-import-rules.mjs';

/*
 * "Upload Stock Sheet" for Fabric Store Inward Stock: choose an Excel file and its rows are added to
 * Inward Stock straight away. Incomplete rows and rows already in stock are skipped and listed.
 */

interface ImportResult {
  fileName: string;
  added: number;
  totals: { MTR: number; PCS: number };
  skipped: Array<{ rowNo: number; source: string; itemName: string | null; reason: string }>;
  notes: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called after rows were added, with a one-line summary. */
  onImported: (message: string) => void;
  /** Opens the manual New Fabric Arrival form. */
  onManualEntry: () => void;
}

const today = () => new Date().toISOString().split('T')[0];
const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 3 });

export default function StockImportModal({ open, onClose, onImported, onManualEntry }: Props) {
  const [entryType, setEntryType] = useState<'UNDYED' | 'DYED'>('UNDYED');
  const [receivingDate, setReceivingDate] = useState(today);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setEntryType('UNDYED');
      setReceivingDate(today());
      setFile(null);
      setError('');
      setResult(null);
    }
  }, [open]);

  if (!open) return null;

  const choose = (f: File | undefined | null) => {
    setError('');
    setResult(null);
    if (!f) return;
    if (!/\.(xlsx|xls)$/i.test(f.name)) return setError('Choose an Excel file (.xlsx or .xls).');
    if (f.size > MAX_IMPORT_FILE_BYTES) return setError('The file is larger than 10 MB. Split the workbook and upload each part.');
    setFile(f);
  };

  const upload = async () => {
    if (!file) return setError('Choose an Excel file first.');
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('entryType', entryType);
      form.append('receivingDate', receivingDate);
      const res = await fetch('/api/fabric-store/inward/import', { method: 'POST', body: form });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body) throw new Error(body?.error || `The stock sheet could not be added (error ${res.status}).`);
      setResult(body);
      setFile(null);
      if (body.added > 0) {
        onImported(`${body.added} inward entr${body.added === 1 ? 'y' : 'ies'} added from ${body.fileName}${body.skipped.length ? `, ${body.skipped.length} row${body.skipped.length === 1 ? '' : 's'} skipped` : ''}.`);
      }
    } catch (e: any) {
      setError(e.message || 'The stock sheet could not be added.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-neutral-900/60 backdrop-blur-xs sm:p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="stock-import-title" className="bg-white sm:rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-xl flex flex-col max-h-[100dvh] sm:max-h-[94vh] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-neutral-200 bg-gradient-to-r from-brand-50 via-white to-accent-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </span>
            <div>
              <h2 id="stock-import-title" className="text-sm font-bold text-neutral-900">Upload Stock Sheet</h2>
              <p className="text-[11px] text-neutral-500">Excel rows are added to Inward Stock straight away</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="p-2 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-white disabled:opacity-40">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div role="alert" className="p-3 bg-danger-50 border border-danger-200 rounded-xl text-xs text-danger-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-danger-600 shrink-0 mt-px" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className={`p-3.5 rounded-xl border text-sm flex items-start gap-2.5 ${result.added ? 'border-accent-300 bg-accent-50' : 'border-neutral-200 bg-neutral-50'}`}>
                <CheckCircle2 className={`w-5 h-5 shrink-0 ${result.added ? 'text-accent-700' : 'text-neutral-400'}`} />
                <div>
                  <p className="font-bold text-neutral-900">
                    {result.added} entr{result.added === 1 ? 'y' : 'ies'} added to Inward Stock
                  </p>
                  <p className="text-xs text-neutral-600 mt-0.5">
                    {[result.totals.MTR ? `${fmt(result.totals.MTR)} MTR` : '', result.totals.PCS ? `${fmt(result.totals.PCS)} PCS` : ''].filter(Boolean).join(' · ') || 'Nothing new to add.'}
                    {result.added > 0 && ' · Total stock is updated.'}
                  </p>
                </div>
              </div>
              {result.skipped.length > 0 && (
                <div className="rounded-xl border border-danger-200 bg-danger-50/60 p-3.5">
                  <p className="text-xs font-bold text-danger-900 mb-1.5">
                    {result.skipped.length} row{result.skipped.length === 1 ? '' : 's'} skipped — fix them in the sheet and upload again, or add them by hand
                  </p>
                  <ul className="space-y-1 text-xs text-danger-900 max-h-48 overflow-y-auto">
                    {result.skipped.map((s) => (
                      <li key={`${s.source}-${s.rowNo}`}>
                        {s.source}{s.itemName ? ` · ${s.itemName}` : ''}: {s.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.notes.length > 0 && <p className="text-[11px] text-neutral-500">{result.notes.join(' ')}</p>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wide text-neutral-500 mb-1">Fabric type</span>
              <div className="grid grid-cols-2 p-0.5 bg-white border border-neutral-200 rounded-lg">
                {(['UNDYED', 'DYED'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setEntryType(t)}
                    aria-pressed={entryType === t}
                    className={`h-8 rounded-md text-xs font-bold transition ${entryType === t ? (t === 'UNDYED' ? 'bg-accent-300 text-neutral-900' : 'bg-brand-600 text-white') : 'text-neutral-500 hover:text-neutral-900'}`}
                  >
                    {t === 'UNDYED' ? 'Undyed' : 'Dyed'}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-wide text-neutral-500 mb-1">Receiving date</span>
              <input type="date" value={receivingDate} onChange={(e) => setReceivingDate(e.target.value)} className="w-full h-9 px-2.5 border border-neutral-300 rounded-lg text-xs font-semibold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </label>
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() => input.current?.click()}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              choose(e.dataTransfer.files?.[0]);
            }}
            className={`cursor-pointer rounded-2xl border-2 border-dashed px-5 py-8 text-center transition ${dragging ? 'border-brand-500 bg-brand-50' : 'border-neutral-300 bg-neutral-50/60 hover:border-brand-400 hover:bg-brand-50/40'}`}
          >
            <input
              ref={input}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="sr-only"
              onChange={(e) => {
                choose(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <UploadCloud className="w-8 h-8 mx-auto text-brand-600" />
            <p className="mt-2 text-sm font-bold text-neutral-900">{file ? file.name : 'Drop an Excel file here, or click to choose'}</p>
            <p className="mt-1 text-[11px] text-neutral-500">.xlsx or .xls · up to 10 MB · columns such as Item Name, Colour, Qty, Unit, Bill/Ch. No, Bill/Ch. Date, Receiving Date, Price Per Unit, Box/Than Qty, HSN Code, Tax %, Party Name, Biller State/City</p>
          </div>

          <p className="text-[11px] text-neutral-500">
            Each row becomes its own inward entry with its own unit (MTR or PCS, never converted). Rows with a missing fabric, quantity, unit, challan no. or date, and rows already in Inward Stock, are skipped and listed.
          </p>
        </div>

        <div className="px-5 py-3 border-t border-neutral-200 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              onManualEntry();
            }}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            <PenLine className="w-3.5 h-3.5" /> Enter by hand instead
          </button>
          <button
            type="button"
            onClick={upload}
            disabled={!file || busy}
            className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
            {busy ? 'Adding to Inward Stock…' : 'Upload & Add to Inward Stock'}
          </button>
        </div>
      </div>
    </div>
  );
}
