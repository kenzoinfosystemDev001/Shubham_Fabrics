'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, Download, FileSpreadsheet, RefreshCw, Upload } from 'lucide-react';
import { ImportStatusBadge, formatQuantities, formatWhen } from '@/components/fabric-store/stock-import/shared';
import { IMPORT_LIMITS } from '@/lib/fabric-stock-import/workbook-guard.mjs';

interface HistoryRow {
  id: string;
  status: string;
  fileName: string;
  receiptNumber: string | null;
  createdAt: string;
  postedAt: string | null;
  failureReason: string | null;
  uploadedBy: { fullName: string | null; username: string } | null;
  postedBy: { fullName: string | null; username: string } | null;
  summary: { totalRows: number; errorRows: number; warningRows: number; byUnit: Record<string, number> } | null;
}

const PAGE_SIZE = 20;
// Excel, CSV, PDF bills and photos / scans; the server reads the fabric lines from each.
const ACCEPTED_EXTENSIONS = ['xlsx', 'xls', 'ods', 'csv', 'tsv', 'txt', 'pdf', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tif', 'tiff'];
const ACCEPT_ATTRIBUTE = ACCEPTED_EXTENSIONS.map((e) => `.${e}`).join(',');

export default function FabricStockImportPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadHistory = async (target = page) => {
    try {
      setLoading(true);
      setHistoryError(null);
      const res = await fetch(`/api/fabric-store/stock-imports?page=${target}&pageSize=${PAGE_SIZE}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not load import history');
      setHistory(json.data);
      setTotal(json.total);
    } catch (err: any) {
      setHistoryError(err.message || 'Could not load import history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const chooseFile = (next: File | null) => {
    setUploadError(null);
    const ext = next?.name.toLowerCase().split('.').pop() || '';
    if (next && !ACCEPTED_EXTENSIONS.includes(ext)) {
      setUploadError('Choose an Excel file (.xlsx, .xls), a CSV, a PDF, or a photo (JPG, PNG) of the bill or stock sheet.');
      setFile(null);
      return;
    }
    if (next && next.size > IMPORT_LIMITS.maxFileBytes) {
      setUploadError(`The file is larger than ${IMPORT_LIMITS.maxFileBytes / 1048576} MB. Split it into smaller workbooks.`);
      setFile(null);
      return;
    }
    setFile(next);
  };

  const upload = async () => {
    if (!file) return;
    try {
      setUploading(true);
      setUploadError(null);
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/fabric-store/stock-imports', { method: 'POST', body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUploadError(json.error || 'The workbook could not be uploaded.');
        if (json.details?.importId) loadHistory(1);
        return;
      }
      router.push(`/fabric-store/inventory/import/${json.id}`);
    } catch {
      setUploadError('Network problem while uploading. Nothing was imported; try again.');
    } finally {
      setUploading(false);
    }
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="min-h-screen bg-brand-50 pb-16">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-30 px-4 sm:px-8 py-3.5 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/fabric-store/inventory/inward" className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-md" title="Back to Inward Stock">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-brand-700">Fabric Store / Inventory</div>
              <h1 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-brand-700" />
                Import Fabric Stock
              </h1>
              <p className="text-[11px] text-neutral-500">Receive fabric from a bill or stock sheet (Excel, CSV, PDF or photo). Stock changes only after review and confirmation.</p>
            </div>
          </div>
          <a
            href="/api/fabric-store/stock-imports/template"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-brand-300 text-brand-800 hover:bg-brand-50 rounded-lg text-xs font-bold"
          >
            <Download className="w-3.5 h-3.5" />
            Download Excel template
          </a>
        </div>
      </header>

      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        <section className="bg-white rounded-xl border border-neutral-200 p-5 space-y-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-neutral-900">1. Select file</h2>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT_ATTRIBUTE}
              onChange={(e) => chooseFile(e.target.files?.[0] || null)}
              className="text-xs file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border file:border-neutral-300 file:bg-neutral-50 file:text-xs file:font-semibold file:text-neutral-800 hover:file:bg-neutral-100"
            />
            <button
              type="button"
              onClick={upload}
              disabled={!file || uploading}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold disabled:opacity-50"
            >
              {uploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {uploading ? 'Uploading and reading...' : 'Upload and read file'}
            </button>
          </div>
          {file && !uploadError && (
            <p className="text-[11px] text-neutral-600">
              {file.name} · {(file.size / 1024).toFixed(0)} KB
            </p>
          )}
          {uploadError && (
            <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-xs text-danger-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-danger-600 shrink-0 mt-0.5" />
              <span>{uploadError}</span>
            </div>
          )}
          <p className="text-[10px] text-neutral-500">
            Excel (.xlsx, .xls), CSV, PDF or a photo of the bill, up to {IMPORT_LIMITS.maxFileBytes / 1048576} MB and {IMPORT_LIMITS.maxRowsPerSheet} lines.
            Fabric, quantity and unit, type, colour, supplier, bill no., bill date and received date are read from the file automatically; check them before confirming.
          </p>
        </section>

        <section className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-wider text-neutral-900">Import history</h2>
            <button type="button" onClick={() => loadHistory(page)} className="p-1.5 text-neutral-500 hover:text-neutral-900 rounded-md" title="Refresh">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {historyError ? (
            <p className="px-5 py-6 text-xs text-danger-700">{historyError}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-neutral-100 text-[10px] uppercase tracking-wider text-neutral-600">
                  <tr>
                    <th className="px-4 py-2">Uploaded</th>
                    <th className="px-4 py-2">File</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2 text-right">Rows</th>
                    <th className="px-4 py-2">Quantity</th>
                    <th className="px-4 py-2">Receipt</th>
                    <th className="px-4 py-2">By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">
                        {loading ? 'Loading...' : 'No imports yet. Download the template, fill it and upload it above.'}
                      </td>
                    </tr>
                  ) : (
                    history.map((row) => (
                      <tr key={row.id} className="hover:bg-neutral-50 cursor-pointer" onClick={() => router.push(`/fabric-store/inventory/import/${row.id}`)}>
                        <td className="px-4 py-2 whitespace-nowrap">{formatWhen(row.createdAt)}</td>
                        <td className="px-4 py-2 max-w-[220px] truncate" title={row.fileName}>{row.fileName}</td>
                        <td className="px-4 py-2">
                          <ImportStatusBadge status={row.status} />
                          {row.failureReason && <div className="text-[10px] text-danger-700 mt-0.5 max-w-[260px] truncate" title={row.failureReason}>{row.failureReason}</div>}
                        </td>
                        <td className="px-4 py-2 text-right font-mono">
                          {row.summary ? (
                            <>
                              {row.summary.totalRows}
                              {row.summary.errorRows > 0 && <span className="text-danger-700"> · {row.summary.errorRows} err</span>}
                            </>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-2 font-mono">{row.summary ? formatQuantities(row.summary.byUnit) : '—'}</td>
                        <td className="px-4 py-2 font-mono font-bold text-brand-800">{row.receiptNumber || '—'}</td>
                        <td className="px-4 py-2">{row.postedBy?.fullName || row.uploadedBy?.fullName || row.uploadedBy?.username || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          {pages > 1 && (
            <div className="px-5 py-2 border-t border-neutral-200 flex items-center justify-end gap-2 text-xs">
              <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-2 py-1 border border-neutral-300 rounded disabled:opacity-40">Previous</button>
              <span>Page {page} of {pages}</span>
              <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className="px-2 py-1 border border-neutral-300 rounded disabled:opacity-40">Next</button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
