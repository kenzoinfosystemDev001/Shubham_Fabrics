'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Image as ImageIcon,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { ImportStatusBadge, formatNumber, formatQuantities, formatWhen } from '@/components/fabric-store/stock-import/shared';
import { newSubmissionKey } from '@/components/challan/ChallanNumberField';
import { IMPORT_FIELDS, FIELD_BY_KEY, columnLetter, suggestMapping } from '@/lib/fabric-stock-import/columns.mjs';

type Cell = null | string | number | boolean | { d: string } | { formulaWithoutResult: true } | { err: string };
type Message = { field: string; message: string };
type RowResult = {
  rowNumber: number;
  status: 'VALID' | 'WARNING' | 'ERROR' | 'SKIPPED';
  values: Record<string, any>;
  errors: Message[];
  warnings: Message[];
  fabric: { name: string; isNew: boolean; mappedFrom?: string } | null;
  rollKey: string | null;
};
type ImportView = {
  id: string;
  status: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
  uploadedBy: { fullName: string | null; username: string } | null;
  postedBy: { fullName: string | null; username: string } | null;
  postedAt: string | null;
  receiptNumber: string | null;
  failureReason: string | null;
  documents: Array<{ id: string; sheetName: string | null; mimeType: string; size: number; ocrStatus: string }>;
  sheets: Array<{ name: string; hidden: boolean; rowCount: number; columnCount: number; detectedHeaderRow: number | null; imageCount: number; preview: Array<{ rowNumber: number; cells: Cell[] }> }>;
  selectedSheet: string | null;
  headerRow: number | null;
  mapping: Record<string, number>;
  corrections: Record<string, Record<string, string>>;
  resolutions: Record<string, { action: 'MAP'; target: string } | { action: 'ACCEPT_NEW' }>;
  validation: null | {
    rows: RowResult[];
    summary: any;
    fileErrors: string[];
    unresolvedFabrics: Array<{ key: string; name: string; rows: number[]; candidates: string[] }>;
    knownFabricNames: string[];
  };
  payloadHash: string | null;
  result: any;
  permissions?: { canApprove: boolean };
};

const EDITABLE = ['PARSED', 'NEEDS_CORRECTION', 'READY_FOR_CONFIRMATION'];
const PAGE_SIZE = 50;

function cellText(cell: Cell): string {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'object') {
    if ('d' in cell) return cell.d;
    if ('err' in cell) return cell.err;
    return '(formula, no value)';
  }
  return String(cell);
}

async function call(url: string, init?: RequestInit) {
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  } catch {
    throw new Error('Network problem. Your import is saved; try again.');
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(json.error || `Request failed (${res.status})`) as Error & { code?: string; status?: number };
    error.code = json.code;
    error.status = res.status;
    throw error;
  }
  return json;
}

export default function StockImportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [view, setView] = useState<ImportView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showMapping, setShowMapping] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setView(await call(`/api/fabric-store/stock-imports/${id}`));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const run = async (label: string, url: string, init: RequestInit) => {
    try {
      setBusy(label);
      setError(null);
      const next = await call(url, init);
      setView(next.import || next);
      return next;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setBusy(null);
    }
  };

  if (loading && !view) {
    return <div className="min-h-screen bg-brand-50 flex items-center justify-center text-xs text-neutral-500">Loading import...</div>;
  }
  if (!view) {
    return (
      <div className="min-h-screen bg-brand-50 p-8 text-xs text-danger-700">
        {error || 'Import not found.'} <Link href="/fabric-store/inventory/import" className="underline">Back to imports</Link>
      </div>
    );
  }

  const editable = EDITABLE.includes(view.status);
  const mappingOpen = editable && (view.status === 'PARSED' || !view.validation || showMapping);
  const step = view.status === 'POSTED' ? 5 : view.status === 'READY_FOR_CONFIRMATION' ? 4 : view.validation ? 3 : 2;

  return (
    <div className="min-h-screen bg-brand-50 pb-16">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-30 px-4 sm:px-8 py-3 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/fabric-store/inventory/import" className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-md" title="All imports">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-brand-700">Import Fabric Stock</div>
              <h1 className="text-sm font-bold text-neutral-900 flex items-center gap-2 min-w-0">
                <FileSpreadsheet className="w-4 h-4 text-brand-700 shrink-0" />
                <span className="truncate">{view.fileName}</span>
                <ImportStatusBadge status={view.status} />
              </h1>
              <p className="text-[10px] text-neutral-500">
                Uploaded {formatWhen(view.createdAt)} by {view.uploadedBy?.fullName || view.uploadedBy?.username || '—'} · {(view.fileSize / 1024).toFixed(0)} KB
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href={`/api/fabric-store/stock-imports/${id}/file`} className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-neutral-300 rounded-md text-[11px] font-semibold text-neutral-800 hover:bg-neutral-50">
              <Download className="w-3.5 h-3.5" /> Original file
            </a>
            {view.validation && (
              <a href={`/api/fabric-store/stock-imports/${id}/report`} className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-neutral-300 rounded-md text-[11px] font-semibold text-neutral-800 hover:bg-neutral-50">
                <Download className="w-3.5 h-3.5" /> Validation report
              </a>
            )}
            {editable && (
              <button
                type="button"
                disabled={!!busy}
                onClick={() => {
                  if (window.confirm('Cancel this import? Nothing has been posted; the import is kept in history as cancelled.')) {
                    run('cancel', `/api/fabric-store/stock-imports/${id}/cancel`, { method: 'POST' });
                  }
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-danger-300 text-danger-700 rounded-md text-[11px] font-semibold hover:bg-danger-50"
              >
                <X className="w-3.5 h-3.5" /> Cancel import
              </button>
            )}
          </div>
        </div>
        <ol className="max-w-7xl mx-auto mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold uppercase tracking-wider">
          {['Select file', 'Worksheet & columns', 'Review & fix', 'Confirm inward', 'Receipt'].map((label, i) => (
            <li
              key={label}
              className={`px-2 py-0.5 rounded border ${i + 1 < step ? 'bg-brand-50 border-brand-200 text-brand-800' : i + 1 === step ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-neutral-200 text-neutral-500'}`}
            >
              {i + 1}. {label}
            </li>
          ))}
        </ol>
      </header>

      <main className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
        {error && (
          <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-xs text-danger-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-danger-600 shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
            <button type="button" onClick={() => setError(null)} className="text-danger-700" aria-label="Dismiss"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}
        {busy && (
          <div className="p-2 bg-white border border-neutral-200 rounded-lg text-[11px] text-neutral-600 flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {busy === 'post' ? 'Posting to stock...' : 'Working...'}
          </div>
        )}

        {view.status === 'FAILED' && (
          <Panel title="This workbook could not be read">
            <p className="text-xs text-danger-700">{view.failureReason}</p>
            <p className="text-[11px] text-neutral-600 mt-1">Nothing was posted. Fix the file and upload it again from the import page.</p>
          </Panel>
        )}
        {view.status === 'CANCELLED' && (
          <Panel title="Import cancelled">
            <p className="text-xs text-neutral-600">This import was cancelled. Nothing was posted to stock.</p>
          </Panel>
        )}

        {view.documents.length > 0 && <DocumentsPanel view={view} />}

        {mappingOpen && (
          <MappingPanel
            view={view}
            busy={!!busy}
            onApply={(body) =>
              run('configure', `/api/fabric-store/stock-imports/${id}/configure`, { method: 'POST', body: JSON.stringify(body) }).then((next) => {
                if (next) setShowMapping(false);
              })
            }
            onClose={view.validation ? () => setShowMapping(false) : undefined}
          />
        )}

        {view.validation && view.status !== 'POSTED' && view.status !== 'CANCELLED' && (
          <ReviewPanel
            view={view}
            busy={!!busy}
            editable={editable}
            onEditMapping={() => setShowMapping(true)}
            onRevalidate={() => run('validate', `/api/fabric-store/stock-imports/${id}/validate`, { method: 'POST' })}
            onCorrect={(rowNumber, field, value) =>
              run('correct', `/api/fabric-store/stock-imports/${id}/rows`, { method: 'PATCH', body: JSON.stringify({ rowNumber, field, value }) })
            }
            onResolve={(name, action, target) =>
              run('resolve', `/api/fabric-store/stock-imports/${id}/fabrics`, { method: 'POST', body: JSON.stringify({ name, action, target }) })
            }
          />
        )}

        {view.status === 'READY_FOR_CONFIRMATION' && view.validation && (
          <ConfirmPanel
            view={view}
            busy={!!busy}
            onConfirm={async (acknowledgeWarnings) => {
              const storageKey = `fabric-stock-import-confirm-${id}`;
              let key: string | null = null;
              try {
                key = sessionStorage.getItem(storageKey);
                if (!key) {
                  key = newSubmissionKey();
                  sessionStorage.setItem(storageKey, key);
                }
              } catch {
                key = key || newSubmissionKey();
              }
              await run('post', `/api/fabric-store/stock-imports/${id}/confirm`, {
                method: 'POST',
                headers: { 'Idempotency-Key': key },
                body: JSON.stringify({ idempotencyKey: key, payloadHash: view.payloadHash, acknowledgeWarnings }),
              });
            }}
          />
        )}

        {view.status === 'POSTED' && view.result && <ReceiptPanel view={view} />}
      </main>
    </div>
  );
}

function Panel({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-neutral-200 bg-neutral-50 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[11px] font-black uppercase tracking-wider text-neutral-900">{title}</h2>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function DocumentsPanel({ view }: { view: ImportView }) {
  return (
    <Panel title={`Documents in the workbook (${view.documents.length})`}>
      <p className="text-[11px] text-neutral-600 mb-2">
        Images found in the workbook are kept with this import as evidence. They are not read automatically: compare quantities with the rows below yourself.
      </p>
      <div className="flex flex-wrap gap-2">
        {view.documents.map((doc, i) => (
          <a
            key={doc.id}
            href={`/api/fabric-store/stock-imports/${view.id}/documents/${doc.id}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-neutral-300 rounded-md text-[11px] text-neutral-800 hover:bg-neutral-50"
          >
            <ImageIcon className="w-3.5 h-3.5 text-brand-700" />
            Image {i + 1}{doc.sheetName ? ` · ${doc.sheetName}` : ''} · {(doc.size / 1024).toFixed(0)} KB
          </a>
        ))}
      </div>
    </Panel>
  );
}

function MappingPanel({
  view,
  busy,
  onApply,
  onClose,
}: {
  view: ImportView;
  busy: boolean;
  onApply: (body: { sheetName: string; headerRow: number; mapping: Record<string, number> }) => void;
  onClose?: () => void;
}) {
  const usableSheets = view.sheets.filter((s) => s.rowCount > 0);
  const [sheetName, setSheetName] = useState(view.selectedSheet || usableSheets.find((s) => s.detectedHeaderRow)?.name || usableSheets[0]?.name || '');
  const sheet = view.sheets.find((s) => s.name === sheetName) || null;
  const [headerRow, setHeaderRow] = useState<number | null>(view.headerRow ?? sheet?.detectedHeaderRow ?? sheet?.preview[0]?.rowNumber ?? null);
  const header = sheet?.preview.find((r) => r.rowNumber === headerRow) || null;
  const suggestion = useMemo(() => (header ? suggestMapping(header.cells) : null), [header]);
  const [mapping, setMapping] = useState<Record<string, number | ''>>(() =>
    Object.keys(view.mapping).length && view.selectedSheet === sheetName && view.headerRow === headerRow ? view.mapping : suggestion?.mapping || {},
  );

  const resetFor = (nextSheet: string, nextHeader: number | null) => {
    const s = view.sheets.find((x) => x.name === nextSheet);
    const h = s?.preview.find((r) => r.rowNumber === nextHeader);
    setMapping(h ? suggestMapping(h.cells).mapping : {});
  };

  const columns = header ? header.cells.map((cell, index) => ({ index, label: `${columnLetter(index)} · ${cellText(cell) || '(blank)'}` })) : [];
  const used = new Map<number, string>();
  for (const [field, index] of Object.entries(mapping)) if (index !== '') used.set(Number(index), field);
  const missing = IMPORT_FIELDS.filter((f) => f.required && (mapping[f.key] === undefined || mapping[f.key] === ''));

  return (
    <Panel
      title="Worksheet and column mapping"
      actions={onClose && <button type="button" onClick={onClose} className="text-[11px] text-neutral-600 hover:text-neutral-900">Close</button>}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <label className="space-y-1">
          <span className="block font-bold text-neutral-700">Worksheet</span>
          <select
            value={sheetName}
            onChange={(e) => {
              const next = view.sheets.find((s) => s.name === e.target.value);
              setSheetName(e.target.value);
              const h = next?.detectedHeaderRow ?? next?.preview[0]?.rowNumber ?? null;
              setHeaderRow(h);
              resetFor(e.target.value, h);
            }}
            className="w-full border border-neutral-300 rounded-md px-2 py-1.5 bg-white"
          >
            {view.sheets.map((s) => (
              <option key={s.name} value={s.name} disabled={s.rowCount === 0}>
                {s.name} · {s.rowCount} rows{s.hidden ? ' · hidden' : ''}{s.imageCount ? ` · ${s.imageCount} images` : ''}{s.rowCount === 0 ? ' · empty' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block font-bold text-neutral-700">Header row</span>
          <select
            value={headerRow ?? ''}
            onChange={(e) => {
              const h = Number(e.target.value);
              setHeaderRow(h);
              resetFor(sheetName, h);
            }}
            className="w-full border border-neutral-300 rounded-md px-2 py-1.5 bg-white"
          >
            {(sheet?.preview || []).map((r) => (
              <option key={r.rowNumber} value={r.rowNumber}>
                Row {r.rowNumber}{r.rowNumber === sheet?.detectedHeaderRow ? ' (detected)' : ''}: {r.cells.map(cellText).filter(Boolean).slice(0, 4).join(', ')}
              </option>
            ))}
          </select>
        </label>
        <div className="text-[11px] text-neutral-600 self-end">
          Rows below the header row are imported. Only exact header names are mapped automatically; check every mapping.
        </div>
      </div>

      {suggestion && suggestion.ambiguities.length > 0 && (
        <div className="mt-3 p-2.5 bg-accent-50 border border-accent-300 rounded-md text-[11px] text-neutral-900 space-y-0.5">
          {suggestion.ambiguities.map((a) => <div key={a.field}>{a.message}</div>)}
        </div>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-neutral-500 border-b border-neutral-200">
            <tr>
              <th className="py-1.5 pr-3 text-left">MES field</th>
              <th className="py-1.5 pr-3 text-left">Workbook column</th>
              <th className="py-1.5 text-left">Why</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {IMPORT_FIELDS.map((field) => {
              const value = mapping[field.key] ?? '';
              const col = value === '' ? null : suggestion?.columns[Number(value)];
              return (
                <tr key={field.key}>
                  <td className="py-1.5 pr-3 font-semibold text-neutral-900 whitespace-nowrap">
                    {field.label} {field.required && <span className="text-danger-600">*</span>}
                  </td>
                  <td className="py-1.5 pr-3">
                    <select
                      value={value}
                      onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value === '' ? '' : Number(e.target.value) })}
                      className={`w-full max-w-xs border rounded-md px-2 py-1 bg-white ${field.required && value === '' ? 'border-danger-400' : 'border-neutral-300'}`}
                    >
                      <option value="">{field.required ? 'Choose column (required)' : 'Not in this file'}</option>
                      {columns.map((c) => (
                        <option key={c.index} value={c.index} disabled={used.has(c.index) && used.get(c.index) !== field.key}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1.5 text-[11px] text-neutral-500">
                    {col?.field === field.key ? col.reason : value !== '' ? 'Chosen by you' : field.help}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sheet && (
        <details className="mt-3">
          <summary className="text-[11px] font-semibold text-neutral-700 cursor-pointer">Preview first rows of "{sheet.name}"</summary>
          <div className="mt-2 overflow-x-auto border border-neutral-200 rounded-md">
            <table className="text-[11px]">
              <tbody>
                {sheet.preview.map((r) => (
                  <tr key={r.rowNumber} className={r.rowNumber === headerRow ? 'bg-brand-50 font-bold' : ''}>
                    <td className="px-2 py-1 text-neutral-500 font-mono border-r border-neutral-200">{r.rowNumber}</td>
                    {r.cells.map((c, i) => <td key={i} className="px-2 py-1 whitespace-nowrap max-w-[160px] truncate">{cellText(c)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[11px] text-danger-700">{missing.length ? `Map: ${missing.map((f) => f.label).join(', ')}` : ''}</span>
        <button
          type="button"
          disabled={busy || !sheetName || !headerRow || missing.length > 0}
          onClick={() => {
            const clean: Record<string, number> = {};
            for (const [k, v] of Object.entries(mapping)) if (v !== '') clean[k] = Number(v);
            onApply({ sheetName, headerRow: headerRow!, mapping: clean });
          }}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold disabled:opacity-50"
        >
          Apply mapping and validate
        </button>
      </div>
    </Panel>
  );
}

const STATUS_ROW_STYLE: Record<string, string> = {
  ERROR: 'bg-danger-50 text-danger-800 border-danger-200',
  WARNING: 'bg-accent-100 text-neutral-900 border-accent-500',
  VALID: 'bg-brand-50 text-brand-800 border-brand-200',
  SKIPPED: 'bg-neutral-100 text-neutral-500 border-neutral-200',
};

function ReviewPanel({
  view,
  busy,
  editable,
  onEditMapping,
  onRevalidate,
  onCorrect,
  onResolve,
}: {
  view: ImportView;
  busy: boolean;
  editable: boolean;
  onEditMapping: () => void;
  onRevalidate: () => void;
  onCorrect: (rowNumber: number, field: string, value: string | null) => void;
  onResolve: (name: string, action: 'MAP' | 'ACCEPT_NEW' | 'CLEAR', target?: string) => void;
}) {
  const v = view.validation!;
  const s = v.summary;
  const [filter, setFilter] = useState<'ALL' | 'ERROR' | 'WARNING' | 'VALID' | 'SKIPPED'>(s.errorRows > 0 ? 'ERROR' : 'ALL');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'row' | 'fabric' | 'quantity'>('row');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<number | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = v.rows.filter((r) => (filter === 'ALL' ? r.status !== 'SKIPPED' : r.status === filter));
    if (q) {
      list = list.filter((r) =>
        [r.rowNumber, r.values.fabricName, r.fabric?.name, r.values.colour, r.values.rollNumber, r.values.supplierName, r.values.billNo]
          .some((x) => String(x ?? '').toLowerCase().includes(q)),
      );
    }
    const sorted = [...list];
    if (sort === 'fabric') sorted.sort((a, b) => String(a.fabric?.name || a.values.fabricName || '').localeCompare(String(b.fabric?.name || b.values.fabricName || '')));
    if (sort === 'quantity') sorted.sort((a, b) => (Number(b.values.quantity) || 0) - (Number(a.values.quantity) || 0));
    return sorted;
  }, [v.rows, filter, query, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const shown = rows.slice((Math.min(page, pages) - 1) * PAGE_SIZE, Math.min(page, pages) * PAGE_SIZE);
  const canApprove = view.permissions?.canApprove;

  return (
    <>
      <Panel
        title="Review"
        actions={
          editable && (
            <div className="flex gap-2">
              <button type="button" onClick={onEditMapping} disabled={busy} className="text-[11px] font-semibold text-brand-800 hover:underline">Change mapping</button>
              <button type="button" onClick={onRevalidate} disabled={busy} className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-800 hover:underline">
                <RefreshCw className="w-3 h-3" /> Revalidate against current stock
              </button>
            </div>
          )
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
          <Tile label="Rows" value={s.totalRows} />
          <Tile label="Valid" value={s.validRows} />
          <Tile label="Warnings" value={s.warningRows} tone={s.warningRows ? 'warn' : undefined} />
          <Tile label="Errors" value={s.errorRows} tone={s.errorRows ? 'error' : undefined} />
          <Tile label="Possible duplicates" value={s.duplicateRows} tone={s.duplicateRows ? 'warn' : undefined} />
          <Tile label="New rolls" value={s.newRolls} />
          <Tile label="Lines without roll" value={s.rowsWithoutRoll} />
          <Tile label="To post" value={formatQuantities(s.byUnit)} />
        </div>
        {v.fileErrors.length > 0 && (
          <div className="mt-3 p-2.5 bg-danger-50 border border-danger-200 rounded-md text-xs text-danger-800">{v.fileErrors.join(' ')}</div>
        )}
        {s.errorRows > 0 && (
          <p className="mt-3 text-[11px] text-danger-700">
            All or nothing: this import cannot be confirmed while any row has an error. Fix the row, map the fabric, or correct the file and upload it again.
          </p>
        )}
      </Panel>

      {v.unresolvedFabrics.length > 0 && (
        <Panel title={`Fabric names not in stock (${v.unresolvedFabrics.length})`}>
          <p className="text-[11px] text-neutral-600 mb-2">
            These names have never been received in Fabric Store. Map each to an existing fabric, or{canApprove ? '' : ' ask a Fabric Store incharge to'} accept it as a new fabric. Nothing is matched by guesswork.
          </p>
          <div className="space-y-2">
            {v.unresolvedFabrics.map((f) => (
              <FabricResolver key={f.key} fabric={f} knownFabrics={v.knownFabricNames} canApprove={!!canApprove} busy={busy || !editable} onResolve={onResolve} />
            ))}
          </div>
        </Panel>
      )}

      {Object.keys(view.resolutions).length > 0 && (
        <Panel title="Fabric decisions">
          <ul className="text-[11px] space-y-1">
            {Object.entries(view.resolutions).map(([key, r]) => (
              <li key={key} className="flex items-center gap-2">
                <span className="font-mono text-neutral-700">{key}</span>
                <span className="text-neutral-900">{r.action === 'MAP' ? `mapped to ${r.target}` : 'accepted as a new fabric'}</span>
                {editable && (
                  <button type="button" disabled={busy} onClick={() => onResolve(key, 'CLEAR')} className="text-danger-700 hover:underline">Undo</button>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="Rows">
        <div className="flex flex-wrap items-center gap-2 mb-2 text-xs">
          {(['ALL', 'ERROR', 'WARNING', 'VALID', 'SKIPPED'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => { setFilter(f); setPage(1); }}
              className={`px-2.5 py-1 rounded-md border text-[11px] font-semibold ${filter === f ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-neutral-300 text-neutral-700'}`}
            >
              {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
              {f === 'ERROR' ? ` (${s.errorRows})` : f === 'WARNING' ? ` (${s.warningRows})` : f === 'VALID' ? ` (${s.validRows})` : f === 'SKIPPED' ? ` (${s.skippedRows})` : ''}
            </button>
          ))}
          <div className="relative ml-auto">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder="Search row, fabric, roll, bill"
              className="pl-7 pr-2 py-1 border border-neutral-300 rounded-md text-xs w-56"
            />
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="border border-neutral-300 rounded-md px-2 py-1 text-xs bg-white">
            <option value="row">Sort by row</option>
            <option value="fabric">Sort by fabric</option>
            <option value="quantity">Sort by quantity</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead className="bg-neutral-100 text-[10px] uppercase tracking-wider text-neutral-600">
              <tr>
                <th className="px-2 py-1.5 text-left">Row</th>
                <th className="px-2 py-1.5 text-left">Status</th>
                <th className="px-2 py-1.5 text-left">Fabric</th>
                <th className="px-2 py-1.5 text-left">Type</th>
                <th className="px-2 py-1.5 text-left">Colour</th>
                <th className="px-2 py-1.5 text-right">Qty</th>
                <th className="px-2 py-1.5 text-left">Unit</th>
                <th className="px-2 py-1.5 text-left">Roll</th>
                <th className="px-2 py-1.5 text-left">Supplier</th>
                <th className="px-2 py-1.5 text-left">Bill</th>
                <th className="px-2 py-1.5 text-left">Received</th>
                <th className="px-2 py-1.5 text-left">Issues</th>
                <th className="px-2 py-1.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {shown.length === 0 && (
                <tr><td colSpan={13} className="px-2 py-6 text-center text-neutral-500">No rows match.</td></tr>
              )}
              {shown.map((r) => (
                <React.Fragment key={r.rowNumber}>
                  <tr className="align-top">
                    <td className="px-2 py-1.5 font-mono text-neutral-600">{r.rowNumber}</td>
                    <td className="px-2 py-1.5">
                      <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${STATUS_ROW_STYLE[r.status]}`}>{r.status}</span>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="font-semibold text-neutral-900">{r.fabric?.name || r.values.fabricName || '—'}</div>
                      {r.fabric?.isNew && <div className="text-[10px] text-brand-700">New fabric</div>}
                      {r.fabric?.mappedFrom && <div className="text-[10px] text-neutral-500">listed as {r.fabric.mappedFrom}</div>}
                    </td>
                    <td className="px-2 py-1.5">{r.values.fabricType || '—'}</td>
                    <td className="px-2 py-1.5">{r.values.colour || '—'}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{typeof r.values.quantity === 'number' ? formatNumber(r.values.quantity) : '—'}</td>
                    <td className="px-2 py-1.5 font-mono">{r.values.unit || '—'}</td>
                    <td className="px-2 py-1.5 font-mono">{r.values.rollNumber || '—'}</td>
                    <td className="px-2 py-1.5">{r.values.supplierName || '—'}</td>
                    <td className="px-2 py-1.5 font-mono">{r.values.billNo || '—'}</td>
                    <td className="px-2 py-1.5 font-mono whitespace-nowrap">{r.values.receivedDate || '—'}</td>
                    <td className="px-2 py-1.5 max-w-[320px]">
                      {r.errors.map((e, i) => <div key={`e${i}`} className="text-danger-700">{e.message}</div>)}
                      {r.warnings.map((w, i) => <div key={`w${i}`} className="text-neutral-700">{w.message}</div>)}
                      {view.corrections[String(r.rowNumber)] && (
                        <div className="text-[10px] text-brand-700">Corrected: {Object.keys(view.corrections[String(r.rowNumber)]).map((k) => FIELD_BY_KEY[k]?.label || k).join(', ')}</div>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      {editable && r.status !== 'SKIPPED' && (
                        <button type="button" onClick={() => setEditing(editing === r.rowNumber ? null : r.rowNumber)} className="text-brand-800 font-semibold hover:underline">
                          {editing === r.rowNumber ? 'Close' : 'Fix'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {editing === r.rowNumber && (
                    <tr>
                      <td colSpan={13} className="px-2 pb-2">
                        <RowEditor
                          row={r}
                          corrections={view.corrections[String(r.rowNumber)] || {}}
                          busy={busy}
                          onSave={(field, value) => onCorrect(r.rowNumber, field, value)}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="mt-2 flex items-center justify-end gap-2 text-xs">
            <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-2 py-1 border border-neutral-300 rounded disabled:opacity-40">Previous</button>
            <span>Page {Math.min(page, pages)} of {pages} · {rows.length} rows</span>
            <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className="px-2 py-1 border border-neutral-300 rounded disabled:opacity-40">Next</button>
          </div>
        )}
      </Panel>
    </>
  );
}

function Tile({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'warn' | 'error' }) {
  const style = tone === 'error' ? 'border-danger-300 bg-danger-50' : tone === 'warn' ? 'border-accent-500 bg-accent-50' : 'border-neutral-200 bg-white';
  return (
    <div className={`p-2 rounded-md border ${style}`}>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">{label}</div>
      <div className="text-sm font-black text-neutral-900 font-mono">{value}</div>
    </div>
  );
}

function FabricResolver({
  fabric,
  knownFabrics,
  canApprove,
  busy,
  onResolve,
}: {
  fabric: { key: string; name: string; rows: number[]; candidates: string[] };
  knownFabrics: string[];
  canApprove: boolean;
  busy: boolean;
  onResolve: (name: string, action: 'MAP' | 'ACCEPT_NEW' | 'CLEAR', target?: string) => void;
}) {
  const [target, setTarget] = useState(fabric.candidates[0] || '');
  const options = [...fabric.candidates, ...knownFabrics.filter((n) => !fabric.candidates.includes(n))];
  return (
    <div className="flex flex-col md:flex-row md:items-center gap-2 p-2 border border-neutral-200 rounded-md text-xs">
      <div className="flex-1">
        <span className="font-bold text-neutral-900">{fabric.name}</span>
        <span className="text-neutral-500"> · rows {fabric.rows.slice(0, 10).join(', ')}{fabric.rows.length > 10 ? '...' : ''}</span>
      </div>
      <select value={target} onChange={(e) => setTarget(e.target.value)} className="border border-neutral-300 rounded-md px-2 py-1 bg-white max-w-xs">
        <option value="">Choose fabric in stock</option>
        {fabric.candidates.length > 0 && <optgroup label="Similar names">{fabric.candidates.map((n) => <option key={`c-${n}`} value={n}>{n}</option>)}</optgroup>}
        <optgroup label="All fabrics in stock">{options.filter((n) => !fabric.candidates.includes(n)).map((n) => <option key={n} value={n}>{n}</option>)}</optgroup>
      </select>
      <button type="button" disabled={busy || !target} onClick={() => onResolve(fabric.name, 'MAP', target)} className="px-2.5 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded-md font-semibold disabled:opacity-50">
        Map
      </button>
      <button
        type="button"
        disabled={busy || !canApprove}
        title={canApprove ? 'Record this as a new fabric in Fabric Store stock' : 'Only a Fabric Store incharge can accept a new fabric'}
        onClick={() => {
          if (window.confirm(`Accept "${fabric.name}" as a new fabric? It will appear as its own item in Fabric Store stock once posted.`)) onResolve(fabric.name, 'ACCEPT_NEW');
        }}
        className="px-2.5 py-1 border border-brand-300 text-brand-800 rounded-md font-semibold hover:bg-brand-50 disabled:opacity-50"
      >
        Accept as new fabric
      </button>
    </div>
  );
}

function RowEditor({
  row,
  corrections,
  busy,
  onSave,
}: {
  row: RowResult;
  corrections: Record<string, string>;
  busy: boolean;
  onSave: (field: string, value: string | null) => void;
}) {
  const firstField = row.errors[0]?.field || row.warnings[0]?.field || 'quantity';
  const [field, setField] = useState(FIELD_BY_KEY[firstField] ? firstField : 'quantity');
  const current = corrections[field] ?? (row.values[field] ?? '');
  const [value, setValue] = useState(String(current));
  useEffect(() => setValue(String(corrections[field] ?? row.values[field] ?? '')), [field, corrections, row.values]);
  return (
    <div className="flex flex-col md:flex-row md:items-end gap-2 p-2 bg-neutral-50 border border-neutral-200 rounded-md text-xs">
      <label className="space-y-0.5">
        <span className="block text-[10px] font-bold text-neutral-600">Field</span>
        <select value={field} onChange={(e) => setField(e.target.value)} className="border border-neutral-300 rounded-md px-2 py-1 bg-white">
          {IMPORT_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
      </label>
      <label className="space-y-0.5 flex-1">
        <span className="block text-[10px] font-bold text-neutral-600">Value for this import (the uploaded file is not changed)</span>
        <input value={value} onChange={(e) => setValue(e.target.value)} className="w-full border border-neutral-300 rounded-md px-2 py-1" placeholder={FIELD_BY_KEY[field]?.example} />
      </label>
      <button type="button" disabled={busy} onClick={() => onSave(field, value)} className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-md font-semibold disabled:opacity-50">
        Save and revalidate
      </button>
      {corrections[field] !== undefined && (
        <button type="button" disabled={busy} onClick={() => onSave(field, null)} className="px-3 py-1.5 border border-neutral-300 rounded-md font-semibold">
          Use file value
        </button>
      )}
    </div>
  );
}

function ConfirmPanel({ view, busy, onConfirm }: { view: ImportView; busy: boolean; onConfirm: (acknowledgeWarnings: boolean) => void }) {
  const s = view.validation!.summary;
  const [ack, setAck] = useState(false);
  const canApprove = view.permissions?.canApprove;
  return (
    <Panel title="Confirm stock inward">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="space-y-1">
          <div><span className="text-neutral-500">Workbook:</span> <strong>{view.fileName}</strong></div>
          <div><span className="text-neutral-500">Worksheet:</span> <strong>{view.selectedSheet}</strong> (header row {view.headerRow})</div>
          <div><span className="text-neutral-500">Destination:</span> <strong>Fabric Store</strong></div>
          <div><span className="text-neutral-500">Rows to post:</span> <strong>{s.postableRows}</strong> · rolls {s.newRolls} · lines without roll {s.rowsWithoutRoll}</div>
          <div><span className="text-neutral-500">Existing stock records changed:</span> <strong>none</strong> (each row becomes a new inward entry)</div>
          {s.newFabrics.length > 0 && <div><span className="text-neutral-500">New fabrics:</span> <strong>{s.newFabrics.join(', ')}</strong></div>}
          <div className="pt-1 text-sm"><span className="text-neutral-500 text-xs">Stock increase:</span> <strong className="font-mono">{formatQuantities(s.byUnit)}</strong></div>
        </div>
        <div>
          <table className="w-full text-[11px]">
            <thead className="text-[10px] uppercase text-neutral-500 border-b border-neutral-200">
              <tr><th className="text-left py-1">Fabric</th><th className="text-left py-1">Type</th><th className="text-left py-1">Colour</th><th className="text-right py-1">Quantity</th><th className="text-right py-1">Rows</th></tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {s.byFabric.map((f: any) => (
                <tr key={`${f.fabric}|${f.fabricType}|${f.colour}|${f.unit}`}>
                  <td className="py-1 font-semibold">{f.fabric}{f.isNew ? ' (new)' : ''}</td>
                  <td className="py-1">{f.fabricType}</td>
                  <td className="py-1">{f.colour || '—'}</td>
                  <td className="py-1 text-right font-mono">{formatNumber(f.quantity)} {f.unit}</td>
                  <td className="py-1 text-right font-mono">{f.rows}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {s.requiresWarningAcknowledgement && (
        <label className="mt-3 flex items-start gap-2 text-xs p-2 bg-accent-50 border border-accent-300 rounded-md">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5" />
          <span>I have checked the {s.warningRows} rows with warnings (possible repeated bills or lines) and they are correct.</span>
        </label>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-neutral-600">
          {canApprove ? 'Stock is added only when you confirm. Confirming twice never adds stock twice.' : 'Only a Fabric Store incharge can confirm stock inward.'}
        </span>
        <button
          type="button"
          disabled={busy || !canApprove || (s.requiresWarningAcknowledgement && !ack)}
          onClick={() => onConfirm(ack)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-xs font-bold disabled:opacity-50"
        >
          <Check className="w-3.5 h-3.5" />
          Confirm and post {s.postableRows} rows ({formatQuantities(s.byUnit)})
        </button>
      </div>
    </Panel>
  );
}

function ReceiptPanel({ view }: { view: ImportView }) {
  const r = view.result;
  return (
    <Panel title={`Inward receipt ${r.receiptNumber}`}>
      <div className="flex items-start gap-3">
        <CheckCircle2 className="w-6 h-6 text-brand-700 shrink-0" />
        <div className="space-y-1 text-xs flex-1">
          <div className="text-sm font-bold text-neutral-900">Posted to Fabric Store stock</div>
          <div><span className="text-neutral-500">Posted:</span> {formatWhen(r.postedAt)} by {r.postedBy?.name || view.postedBy?.fullName || '—'}</div>
          <div><span className="text-neutral-500">Rows posted:</span> {r.rowsPosted} · rolls created {r.rollsCreated} · ledger movements {r.ledgerEntryIds.length}</div>
          <div><span className="text-neutral-500">Quantity:</span> <strong className="font-mono">{formatQuantities(r.totalsByUnit)}</strong></div>
          {r.newFabrics?.length > 0 && <div><span className="text-neutral-500">New fabrics:</span> {r.newFabrics.join(', ')}</div>}
          <div><span className="text-neutral-500">Destination:</span> Fabric Store</div>
        </div>
      </div>
      <table className="mt-3 w-full text-[11px]">
        <thead className="text-[10px] uppercase text-neutral-500 border-b border-neutral-200">
          <tr><th className="text-left py-1">Fabric</th><th className="text-left py-1">Type</th><th className="text-left py-1">Colour</th><th className="text-right py-1">Quantity</th><th className="text-right py-1">Rows</th></tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {r.totalsByFabric.map((f: any) => (
            <tr key={`${f.fabric}|${f.fabricType}|${f.colour}|${f.unit}`}>
              <td className="py-1 font-semibold">{f.fabric}</td>
              <td className="py-1">{f.fabricType}</td>
              <td className="py-1">{f.colour || '—'}</td>
              <td className="py-1 text-right font-mono">{formatNumber(f.quantity)} {f.unit}</td>
              <td className="py-1 text-right font-mono">{f.rows}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <Link href={`/fabric-store/inventory/inward?search=${encodeURIComponent(r.receiptNumber)}`} className="px-3 py-1.5 border border-brand-300 text-brand-800 rounded-md font-semibold hover:bg-brand-50">
          View inward entries
        </Link>
        <Link href="/fabric-store/inventory/total-stock" className="px-3 py-1.5 border border-brand-300 text-brand-800 rounded-md font-semibold hover:bg-brand-50">
          View updated Total Stock
        </Link>
        <a href={`/api/fabric-store/stock-imports/${view.id}/report`} className="px-3 py-1.5 border border-neutral-300 rounded-md font-semibold hover:bg-neutral-50">
          Validation report
        </a>
        <Link href="/fabric-store/inventory/import" className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-md font-semibold">
          New import
        </Link>
      </div>
      {view.status === 'POSTED' && (
        <p className="mt-2 text-[10px] text-neutral-500 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> To correct a posted row, edit that entry in Inward Stock; the ledger records only the difference.
        </p>
      )}
    </Panel>
  );
}
