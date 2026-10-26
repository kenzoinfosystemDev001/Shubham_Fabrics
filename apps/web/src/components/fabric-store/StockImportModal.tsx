'use client';

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  History,
  Image as ImageIcon,
  Loader2,
  PenLine,
  Plus,
  RotateCcw,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  MAX_IMPORT_FILE_BYTES,
  inwardDuplicateKey,
  parseQuantity,
  repeatedRows,
  reviewRow,
} from '@/lib/stock-import-rules.mjs';

/*
 * "Upload Stock Sheet" for Fabric Store Inward Stock: upload a photo, scan or Excel file, review and
 * correct every row it read, then add the rows to stock. Nothing is saved until "Confirm & Add".
 */

type Confidence = 'high' | 'medium' | 'low';
type Unit = '' | 'MTR' | 'PCS';
type Step = 'pick' | 'uploading' | 'reading' | 'review' | 'saving' | 'done';

interface ImportSummary {
  id: string;
  source: 'IMAGE' | 'EXCEL' | string;
  fileName: string;
  fileSize: number;
  status: string;
  rowCount: number;
  uploadedBy: string;
  uploadedAt: string;
  confirmedBy: string | null;
  confirmedAt: string | null;
  addedCount: number;
  skippedCount: number;
  fileUrl: string;
}

interface ServerRow {
  rowNo: number;
  source: string;
  itemName: string | null;
  fabricCode: string | null;
  colour: string | null;
  dyeColour: string | null;
  quantity: number | null;
  quantityText: string | null;
  unit: 'MTR' | 'PCS' | null;
  unitText: string | null;
  supplierName: string | null;
  billNo: string | null;
  billDate: string | null;
  billDateText: string | null;
  remarks: string | null;
  confidence: Record<string, Confidence>;
  unreadable?: string[];
}

interface ReviewRow {
  key: string;
  rowNo: number;
  source: string;
  itemName: string;
  fabricCode: string;
  colour: string;
  dyeColour: string;
  quantity: string;
  unit: Unit;
  billNo: string;
  billDate: string;
  supplierName: string;
  remarks: string;
  confidence: Record<string, Confidence>;
  unreadable: string[];
  quantityText: string | null;
  unitText: string | null;
  billDateText: string | null;
  allowDuplicate: boolean;
}

interface Header {
  entryType: 'UNDYED' | 'DYED';
  receivingDate: string;
  billNo: string;
  billDate: string;
  supplierName: string;
}

interface ConfirmResult {
  replayed?: boolean;
  added: Array<{ rowNo: number; sNo: number; itemName: string; colour: string | null; billQty: number; unit: string }>;
  skipped: Array<{ rowNo: number; itemName: string; reason: string }>;
  totals: { MTR: number; PCS: number };
}

type RowField = 'itemName' | 'fabricCode' | 'colour' | 'dyeColour' | 'quantity' | 'unit' | 'billNo' | 'billDate' | 'supplierName' | 'remarks';

const PAGE_SIZE = 50;
const today = () => new Date().toISOString().split('T')[0];
const newKey = () => `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const confirmToken = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 3 });
const fileSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

const ACCEPT = '.jpg,.jpeg,.png,.xlsx,.xls,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';

function toReviewRow(row: ServerRow): ReviewRow {
  return {
    key: newKey(),
    rowNo: row.rowNo,
    source: row.source,
    itemName: row.itemName ?? '',
    fabricCode: row.fabricCode ?? '',
    colour: row.colour ?? '',
    dyeColour: row.dyeColour ?? '',
    quantity: row.quantity !== null && row.quantity !== undefined ? String(row.quantity) : '',
    unit: row.unit ?? '',
    billNo: row.billNo ?? '',
    billDate: row.billDate ?? '',
    supplierName: row.supplierName ?? '',
    remarks: row.remarks ?? '',
    confidence: row.confidence || {},
    unreadable: row.unreadable || [],
    quantityText: row.quantityText,
    unitText: row.unitText,
    billDateText: row.billDateText,
    allowDuplicate: false,
  };
}

/** The row in the shape the shared rules check (numbers parsed, header values filled in). */
function ruleRow(row: ReviewRow) {
  const qty = parseQuantity(row.quantity);
  return {
    rowNo: row.rowNo,
    itemName: row.itemName,
    fabricCode: row.fabricCode,
    colour: row.colour,
    quantity: qty.value,
    quantityText: row.quantity.trim() || row.quantityText,
    unit: row.unit || null,
    unitText: row.unit ? null : row.unitText,
    billNo: row.billNo,
    billDate: row.billDate || null,
    billDateText: row.billDate ? null : row.billDateText,
    confidence: row.confidence,
    unreadable: row.unreadable,
  };
}

function duplicateKeyOf(row: ReviewRow, header: Header) {
  return inwardDuplicateKey({
    billNo: row.billNo.trim() || header.billNo.trim(),
    itemName: row.itemName.trim(),
    colour: row.colour.trim() || null,
    billQty: parseQuantity(row.quantity).value ?? '',
    unit: row.unit,
  });
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called after rows were added, with a one-line summary. */
  onImported: (message: string) => void;
  /** Opens the manual New Fabric Arrival form. */
  onManualEntry: () => void;
}

export default function StockImportModal({ open, onClose, onImported, onManualEntry }: Props) {
  const [step, setStep] = useState<Step>('pick');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [errorDetails, setErrorDetails] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [pickedFile, setPickedFile] = useState<File | null>(null);

  const [record, setRecord] = useState<ImportSummary | null>(null);
  const [duplicateOf, setDuplicateOf] = useState<ImportSummary | null>(null);
  const [duplicateAck, setDuplicateAck] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [existing, setExisting] = useState<Map<string, number>>(new Map());
  const [header, setHeader] = useState<Header>({ entryType: 'UNDYED', receivingDate: today(), billNo: '', billDate: '', supplierName: '' });
  const [headerConfidence, setHeaderConfidence] = useState<Record<string, Confidence>>({});
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [page, setPage] = useState(0);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [result, setResult] = useState<ConfirmResult | null>(null);
  const confirmKeyRef = useRef('');
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const [history, setHistory] = useState<ImportSummary[] | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const reset = useCallback(() => {
    xhrRef.current?.abort();
    setStep('pick');
    setProgress(0);
    setError('');
    setErrorDetails([]);
    setPickedFile(null);
    setRecord(null);
    setDuplicateOf(null);
    setDuplicateAck(false);
    setNotes([]);
    setExisting(new Map());
    setHeader({ entryType: 'UNDYED', receivingDate: today(), billNo: '', billDate: '', supplierName: '' });
    setHeaderConfidence({});
    setRows([]);
    setPage(0);
    setOnlyProblems(false);
    setResult(null);
    confirmKeyRef.current = '';
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/fabric-store/inward/import');
      const json = await res.json();
      if (res.ok) setHistory(json.data || []);
    } catch {
      /* the history is optional */
    }
  }, []);

  useEffect(() => {
    if (open) {
      reset();
      loadHistory();
    }
  }, [open, reset, loadHistory]);

  // ---- Upload -------------------------------------------------------------

  const upload = (file: File) => {
    setError('');
    setErrorDetails([]);
    const ext = file.name.toLowerCase().split('.').pop() || '';
    if (!['jpg', 'jpeg', 'png', 'xlsx', 'xls'].includes(ext)) {
      setError('Choose a JPG, JPEG or PNG photo/scan, or an Excel file (.xlsx or .xls).');
      return;
    }
    if (file.size === 0) {
      setError('This file is empty.');
      return;
    }
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setError(`This file is ${fileSize(file.size)}; the limit is 10 MB. Upload a smaller photo or split the workbook.`);
      return;
    }
    setPickedFile(file);
    setStep('uploading');
    setProgress(0);

    const form = new FormData();
    form.append('file', file);
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open('POST', '/api/fabric-store/inward/import');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.upload.onload = () => setStep('reading');
    xhr.onerror = () => {
      setStep('pick');
      setError('The upload did not reach the server. Check the connection and try again.');
    };
    xhr.ontimeout = xhr.onerror;
    xhr.onload = () => {
      let json: any = null;
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        /* handled below */
      }
      if (xhr.status < 200 || xhr.status >= 300 || !json) {
        setStep('pick');
        setError(json?.error || `The file could not be read (error ${xhr.status}). Try again.`);
        loadHistory();
        return;
      }
      const reviewRows: ReviewRow[] = (json.rows || []).map(toReviewRow);
      const h = json.header || {};
      setRecord(json.import);
      setDuplicateOf(json.duplicateOf || null);
      setNotes(json.notes || []);
      setExisting(new Map((json.existing || []).map((e: { key: string; sNo: number }) => [e.key, e.sNo])));
      setHeader((prev) => ({ ...prev, billNo: h.billNo || '', billDate: h.billDate || '', supplierName: h.supplierName || '' }));
      setHeaderConfidence(h.confidence || {});
      // Rows that only repeat the header value keep it in the header.
      setRows(
        reviewRows.map((row) => ({
          ...row,
          billNo: row.billNo === (h.billNo || '') ? '' : row.billNo,
          billDate: row.billDate === (h.billDate || '') ? '' : row.billDate,
          supplierName: row.supplierName === (h.supplierName || '') ? '' : row.supplierName,
        })),
      );
      confirmKeyRef.current = confirmToken();
      setStep('review');
      loadHistory();
    };
    xhr.send(form);
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) upload(file);
  };

  // ---- Review state -------------------------------------------------------

  const updateRow = useCallback((key: string, field: RowField, value: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        // Once a person has typed the value, it is no longer "hard to read".
        const { [field]: _checked, ...confidence } = row.confidence;
        return { ...row, [field]: value, confidence, unreadable: row.unreadable.filter((f) => f !== field) };
      }),
    );
  }, []);

  const markChecked = useCallback((key: string) => {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, confidence: {}, unreadable: [] } : row)));
  }, []);

  const setAllowDuplicate = useCallback((key: string, value: boolean) => {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, allowDuplicate: value } : row)));
  }, []);

  const removeRow = useCallback((key: string) => {
    setRows((prev) => prev.filter((row) => row.key !== key));
  }, []);

  const addRow = () => {
    setRows((prev) => {
      const last = prev[prev.length - 1];
      const rowNo = prev.reduce((max, row) => Math.max(max, row.rowNo), 0) + 1;
      const row: ReviewRow = {
        ...toReviewRow({
          rowNo,
          source: 'Added by hand',
          itemName: null,
          fabricCode: null,
          colour: null,
          dyeColour: null,
          quantity: null,
          quantityText: null,
          unit: null,
          unitText: null,
          supplierName: null,
          billNo: null,
          billDate: null,
          billDateText: null,
          remarks: null,
          confidence: {},
        }),
        // A new colour of the same fabric is the usual reason to add a row.
        itemName: last?.itemName || '',
        fabricCode: last?.fabricCode || '',
        unit: last?.unit || '',
      };
      const next = [...prev, row];
      setOnlyProblems(false);
      setPage(Math.floor((next.length - 1) / PAGE_SIZE));
      return next;
    });
  };

  const checks = useMemo(() => {
    const headerForRules = { billNo: header.billNo.trim(), billDate: header.billDate || null };
    const repeats = repeatedRows(rows.map(ruleRow), headerForRules);
    const byKey = new Map<string, { blocking: string[]; warnings: string[]; inStock: number | null; repeatOf: number | null }>();
    let blockingRows = 0;
    let warningRows = 0;
    let inStockRows = 0;
    for (const row of rows) {
      const { blocking, warnings } = reviewRow(ruleRow(row), headerForRules);
      const inStock = existing.get(duplicateKeyOf(row, header)) ?? null;
      const repeatOf = repeats.get(row.rowNo) ?? null;
      if (repeatOf !== null) warnings.push(`Looks the same as row ${repeatOf}. Keep both only if both were really received.`);
      if (blocking.length) blockingRows += 1;
      else if (warnings.length) warningRows += 1;
      if (inStock !== null && !row.allowDuplicate) inStockRows += 1;
      byKey.set(row.key, { blocking, warnings, inStock, repeatOf });
    }
    return { byKey, blockingRows, warningRows, inStockRows };
  }, [rows, header, existing]);

  const visibleRows = useMemo(() => {
    const list = onlyProblems
      ? rows.filter((row) => {
          const c = checks.byKey.get(row.key);
          return c && (c.blocking.length || c.warnings.length || c.inStock !== null);
        })
      : rows;
    return list;
  }, [rows, onlyProblems, checks]);
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = visibleRows.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  const toAdd = rows.length - checks.inStockRows;
  const canConfirm =
    step === 'review' && rows.length > 0 && checks.blockingRows === 0 && toAdd > 0 && (!duplicateOf || duplicateAck) && Boolean(header.receivingDate);

  // ---- Confirm ------------------------------------------------------------

  const confirm = async () => {
    if (!record || !canConfirm) return;
    setError('');
    setErrorDetails([]);
    setStep('saving');
    try {
      const res = await fetch(`/api/fabric-store/inward/import/${record.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmKey: confirmKeyRef.current,
          entryType: header.entryType,
          receivingDate: header.receivingDate,
          header: { billNo: header.billNo.trim(), billDate: header.billDate, supplierName: header.supplierName.trim() },
          rows: rows.map((row) => ({
            rowNo: row.rowNo,
            itemName: row.itemName.trim(),
            fabricCode: row.fabricCode.trim(),
            colour: row.colour.trim(),
            dyeColour: row.dyeColour.trim(),
            quantity: parseQuantity(row.quantity).value,
            unit: row.unit,
            billNo: row.billNo.trim(),
            billDate: row.billDate,
            supplierName: row.supplierName.trim(),
            remarks: row.remarks.trim(),
            allowDuplicate: row.allowDuplicate,
          })),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) {
        setStep('review');
        setError(json?.error || `The rows could not be added (error ${res.status}). Nothing was saved; try again.`);
        setErrorDetails(Array.isArray(json?.details) ? json.details : []);
        return;
      }
      setResult(json);
      setStep('done');
      loadHistory();
      const parts = [`${json.added.length} inward entr${json.added.length === 1 ? 'y' : 'ies'} added from ${record.fileName}`];
      if (json.skipped.length) parts.push(`${json.skipped.length} skipped`);
      onImported(parts.join(', ') + '.');
    } catch {
      // The request may or may not have reached the server; the same key makes a retry safe.
      setStep('review');
      setError('The connection dropped while saving. Press Confirm again; rows already added will not be added twice.');
    }
  };

  const discard = async () => {
    if (record && step === 'review') {
      await fetch(`/api/fabric-store/inward/import/${record.id}`, { method: 'DELETE' }).catch(() => null);
    }
    reset();
    loadHistory();
  };

  const close = () => {
    if (step === 'review' && rows.length > 0 && !window.confirm('Close without adding these rows? What was read stays in the upload history, but nothing is added to stock.')) return;
    if (step === 'saving') return;
    xhrRef.current?.abort();
    onClose();
  };

  if (!open) return null;

  const busy = step === 'uploading' || step === 'reading' || step === 'saving';
  const isPhoto = pickedFile ? /\.(jpe?g|png)$/i.test(pickedFile.name) : record?.source === 'IMAGE';

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-neutral-900/60 backdrop-blur-xs sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-import-title"
        className="bg-white sm:rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-7xl flex flex-col max-h-[100dvh] sm:max-h-[94vh] overflow-hidden"
      >
        {/* Title */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-neutral-200 bg-gradient-to-r from-brand-50 via-white to-accent-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <UploadCloud className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h2 id="stock-import-title" className="text-sm font-bold text-neutral-900">
                Upload Stock Sheet
              </h2>
              <p className="text-[11px] text-neutral-500 truncate">
                {record ? `${record.fileName} · ${fileSize(record.fileSize)}` : 'Photo, scan or Excel → review → add to Inward Stock'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {step === 'pick' && (
              <button
                type="button"
                onClick={() => setHistoryOpen((v) => !v)}
                aria-expanded={historyOpen}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  historyOpen ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Upload history</span>
              </button>
            )}
            <button type="button" onClick={close} disabled={step === 'saving'} aria-label="Close" className="p-2 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-white disabled:opacity-40">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <StepBar step={step} />

        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="mx-4 sm:mx-6 mt-4 p-3 bg-danger-50 border border-danger-200 rounded-xl text-xs text-danger-800" role="alert">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-danger-600 shrink-0 mt-px" />
                <div className="space-y-1">
                  <p className="font-semibold">{error}</p>
                  {errorDetails.length > 0 && (
                    <ul className="list-disc pl-4 space-y-0.5">
                      {errorDetails.slice(0, 12).map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                      {errorDetails.length > 12 && <li>…and {errorDetails.length - 12} more</li>}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* PICK */}
          {step === 'pick' && (
            <div className="p-4 sm:p-6 space-y-5">
              {historyOpen ? (
                <UploadHistory history={history} />
              ) : (
                <>
                  <label
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) upload(file);
                    }}
                    className={`block cursor-pointer rounded-2xl border-2 border-dashed px-6 py-10 sm:py-14 text-center transition ${
                      dragging ? 'border-brand-500 bg-brand-50' : 'border-neutral-300 bg-neutral-50/60 hover:border-brand-400 hover:bg-brand-50/40'
                    }`}
                  >
                    <input type="file" accept={ACCEPT} onChange={onFileInput} className="sr-only" />
                    <span className="mx-auto w-14 h-14 rounded-2xl bg-white border border-brand-200 shadow-sm flex items-center justify-center">
                      <UploadCloud className="w-7 h-7 text-brand-600" />
                    </span>
                    <p className="mt-4 text-sm font-bold text-neutral-900">Drop a stock sheet here, or click to choose</p>
                    <p className="mt-1 text-xs text-neutral-500">JPG, JPEG or PNG photo / scan · Excel .xlsx or .xls · up to 10 MB</p>
                  </label>

                  <div className="grid sm:grid-cols-3 gap-3">
                    <label className="sm:hidden flex items-center justify-center gap-2 h-11 rounded-xl bg-brand-600 text-white text-sm font-semibold cursor-pointer">
                      <input type="file" accept="image/jpeg,image/png" capture="environment" onChange={onFileInput} className="sr-only" />
                      <ImageIcon className="w-4 h-4" />
                      Take a photo
                    </label>
                    <Tip icon={ImageIcon} title="Photos & scans" text="Whole page, flat, in good light. Handwriting is read too; every value is shown for checking." />
                    <Tip icon={FileSpreadsheet} title="Excel" text="Read directly, no OCR. The first rows should name the columns (Fabric, Colour, Qty, Unit…)." />
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onManualEntry();
                      }}
                      className="text-left rounded-xl border border-neutral-200 p-3.5 hover:border-brand-300 hover:bg-brand-50/40 transition"
                    >
                      <span className="flex items-center gap-2 text-xs font-bold text-neutral-900">
                        <PenLine className="w-4 h-4 text-brand-600" /> Enter by hand instead
                      </span>
                      <span className="block mt-1 text-[11px] text-neutral-500">Opens the New Fabric Arrival form.</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* UPLOADING / READING / SAVING */}
          {busy && (
            <div className="p-8 sm:p-14 flex flex-col items-center text-center">
              <Loader2 className="w-10 h-10 text-brand-600 animate-spin" />
              <p className="mt-4 text-sm font-bold text-neutral-900">
                {step === 'uploading' ? 'Uploading…' : step === 'reading' ? (isPhoto ? 'Reading the photo…' : 'Reading the workbook…') : 'Adding rows to Inward Stock…'}
              </p>
              <p className="mt-1 text-xs text-neutral-500 max-w-sm">
                {step === 'uploading'
                  ? pickedFile?.name
                  : step === 'reading'
                    ? isPhoto
                      ? 'Handwritten pages can take a minute. Nothing is added to stock until you confirm.'
                      : 'Nothing is added to stock until you confirm.'
                    : 'All rows are saved together; if anything fails, nothing is saved.'}
              </p>
              <div className="mt-5 w-full max-w-xs h-2 rounded-full bg-neutral-100 overflow-hidden" aria-hidden>
                {step === 'uploading' ? (
                  <div className="h-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} />
                ) : (
                  <div className="h-full w-1/3 bg-gradient-to-r from-brand-500 to-accent-400 rounded-full animate-[importbar_1.2s_ease-in-out_infinite]" />
                )}
              </div>
              {step === 'uploading' && <p className="mt-2 text-[11px] font-semibold tabular-nums text-neutral-500">{progress}%</p>}
              <style>{`@keyframes importbar{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
            </div>
          )}

          {/* REVIEW */}
          {step === 'review' && record && (
            <div className="p-4 sm:p-6 space-y-4">
              {duplicateOf && (
                <div className="p-3.5 rounded-xl border border-danger-300 bg-danger-50 text-xs text-danger-900">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-danger-600 shrink-0 mt-px" />
                    <div className="space-y-2">
                      <p>
                        <span className="font-bold">This exact file was uploaded before</span> — {duplicateOf.fileName}, by {duplicateOf.uploadedBy} on {when(duplicateOf.uploadedAt)}
                        {duplicateOf.status === 'CONFIRMED'
                          ? `, and ${duplicateOf.addedCount} row${duplicateOf.addedCount === 1 ? ' was' : 's were'} added to stock on ${when(duplicateOf.confirmedAt)}.`
                          : ' (not added to stock yet).'}
                      </p>
                      <label className="flex items-center gap-2 font-semibold cursor-pointer">
                        <input type="checkbox" checked={duplicateAck} onChange={(e) => setDuplicateAck(e.target.checked)} className="w-4 h-4 accent-danger-600" />
                        This is a new delivery — add these rows anyway
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {notes.length > 0 && (
                <ul className="p-3 rounded-xl border border-accent-300 bg-accent-50 text-xs text-neutral-800 space-y-1">
                  {notes.map((note) => (
                    <li key={note} className="flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-neutral-700 shrink-0 mt-px" />
                      {note}
                    </li>
                  ))}
                </ul>
              )}

              {/* Header */}
              <section className="rounded-2xl border border-neutral-200 bg-neutral-50/60 p-3.5 sm:p-4">
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                  <div className="col-span-2 lg:col-span-1">
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-neutral-500 mb-1">Fabric type *</span>
                    <div className="grid grid-cols-2 p-0.5 bg-white border border-neutral-200 rounded-lg">
                      {(['UNDYED', 'DYED'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setHeader((h) => ({ ...h, entryType: t }))}
                          aria-pressed={header.entryType === t}
                          className={`h-8 rounded-md text-xs font-bold transition ${
                            header.entryType === t ? (t === 'UNDYED' ? 'bg-accent-300 text-neutral-900' : 'bg-brand-600 text-white') : 'text-neutral-500 hover:text-neutral-900'
                          }`}
                        >
                          {t === 'UNDYED' ? 'Undyed' : 'Dyed'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <HeaderInput label="Receiving date *" type="date" value={header.receivingDate} onChange={(v) => setHeader((h) => ({ ...h, receivingDate: v }))} />
                  <HeaderInput
                    label="Challan / bill no."
                    value={header.billNo}
                    confidence={headerConfidence.billNo}
                    onChange={(v) => {
                      setHeader((h) => ({ ...h, billNo: v }));
                      setHeaderConfidence(({ billNo: _b, ...rest }) => rest);
                    }}
                    placeholder="For all rows"
                  />
                  <HeaderInput
                    label="Challan / bill date"
                    type="date"
                    value={header.billDate}
                    confidence={headerConfidence.billDate}
                    onChange={(v) => {
                      setHeader((h) => ({ ...h, billDate: v }));
                      setHeaderConfidence(({ billDate: _b, ...rest }) => rest);
                    }}
                  />
                  <div className="col-span-2">
                    <HeaderInput
                      label="Supplier / mill"
                      value={header.supplierName}
                      confidence={headerConfidence.supplierName}
                      onChange={(v) => {
                        setHeader((h) => ({ ...h, supplierName: v }));
                        setHeaderConfidence(({ supplierName: _s, ...rest }) => rest);
                      }}
                      placeholder="For all rows"
                    />
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-neutral-500">Bill no., date and supplier apply to every row that leaves them empty. Each row is saved as its own entry with its own unit; meters and pieces are never converted.</p>
              </section>

              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-neutral-900">{rows.length} row{rows.length === 1 ? '' : 's'}</span>
                {checks.blockingRows > 0 && <Chip tone="danger">{checks.blockingRows} need fixing</Chip>}
                {checks.warningRows > 0 && <Chip tone="accent">{checks.warningRows} to check</Chip>}
                {checks.inStockRows > 0 && <Chip tone="neutral">{checks.inStockRows} already in stock — will be skipped</Chip>}
                {checks.blockingRows === 0 && checks.warningRows === 0 && rows.length > 0 && <Chip tone="ok">All rows look complete</Chip>}
                <div className="ml-auto flex items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={onlyProblems}
                      onChange={(e) => {
                        setOnlyProblems(e.target.checked);
                        setPage(0);
                      }}
                      className="w-4 h-4 accent-brand-600"
                    />
                    Only rows to check
                  </label>
                  <button type="button" onClick={addRow} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-brand-200 bg-white text-xs font-bold text-brand-800 hover:bg-brand-50">
                    <Plus className="w-3.5 h-3.5" /> Add row
                  </button>
                </div>
              </div>

              {/* Rows */}
              <div className="rounded-2xl border border-neutral-200 overflow-hidden">
                <div className="hidden lg:grid grid-cols-[2.5rem_minmax(9rem,1.6fr)_6rem_minmax(6rem,1fr)_minmax(6rem,1fr)_6rem_5.5rem_7rem_8.5rem_minmax(7rem,1fr)_minmax(6rem,1fr)_4.5rem] gap-2 px-3 py-2 bg-neutral-50 border-b border-neutral-200 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                  <span>#</span>
                  <span>Fabric *</span>
                  <span>Code</span>
                  <span>Colour</span>
                  <span>Dye to</span>
                  <span className="text-right">Qty *</span>
                  <span>Unit *</span>
                  <span>Bill no.</span>
                  <span>Bill date</span>
                  <span>Supplier</span>
                  <span>Remarks</span>
                  <span />
                </div>
                {pageRows.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-neutral-500">{onlyProblems ? 'No rows need checking.' : 'No rows. Add one, or upload another file.'}</p>
                ) : (
                  <div className="divide-y divide-neutral-100">
                    {pageRows.map((row) => (
                      <RowEditor
                        key={row.key}
                        row={row}
                        header={header}
                        check={checks.byKey.get(row.key)!}
                        onChange={updateRow}
                        onRemove={removeRow}
                        onChecked={markChecked}
                        onAllowDuplicate={setAllowDuplicate}
                      />
                    ))}
                  </div>
                )}
              </div>

              {pageCount > 1 && (
                <div className="flex items-center justify-center gap-2 text-xs">
                  <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="p-1.5 rounded-lg border border-neutral-200 disabled:opacity-40" aria-label="Previous page">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-semibold tabular-nums text-neutral-700">
                    Rows {currentPage * PAGE_SIZE + 1}–{Math.min(visibleRows.length, (currentPage + 1) * PAGE_SIZE)} of {visibleRows.length}
                  </span>
                  <button type="button" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)} className="p-1.5 rounded-lg border border-neutral-200 disabled:opacity-40" aria-label="Next page">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* DONE */}
          {step === 'done' && result && (
            <div className="p-4 sm:p-8 space-y-5">
              <div className="flex flex-col items-center text-center">
                <span className="w-14 h-14 rounded-2xl bg-accent-300 flex items-center justify-center shadow-sm">
                  <CheckCircle2 className="w-8 h-8 text-neutral-900" />
                </span>
                <h3 className="mt-3 text-base font-bold text-neutral-900">
                  {result.added.length} entr{result.added.length === 1 ? 'y' : 'ies'} added to Inward Stock
                </h3>
                <p className="text-xs text-neutral-500">
                  {result.replayed ? 'These rows had already been added; nothing was added twice. ' : ''}
                  Total stock is updated.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 max-w-xl mx-auto">
                <Stat label="Added" value={String(result.added.length)} tone="bg-brand-50 text-brand-800" />
                <Stat label="Skipped" value={String(result.skipped.length)} tone={result.skipped.length ? 'bg-danger-50 text-danger-800' : 'bg-neutral-100 text-neutral-700'} />
                <Stat label="Received" value={[result.totals.MTR ? `${fmt(result.totals.MTR)} MTR` : '', result.totals.PCS ? `${fmt(result.totals.PCS)} PCS` : ''].filter(Boolean).join(' · ') || '—'} tone="bg-accent-100 text-neutral-900" />
              </div>
              {result.skipped.length > 0 && (
                <div className="max-w-2xl mx-auto rounded-xl border border-danger-200 bg-danger-50/60 p-3.5">
                  <p className="text-xs font-bold text-danger-900 mb-1.5">Skipped rows</p>
                  <ul className="space-y-1 text-xs text-danger-900">
                    {result.skipped.map((s) => (
                      <li key={s.rowNo}>
                        Row {s.rowNo} · {s.itemName}: {s.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {(step === 'review' || step === 'done') && (
          <div className="px-4 sm:px-6 py-3 border-t border-neutral-200 bg-white flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2">
            {step === 'review' ? (
              <>
                <button type="button" onClick={discard} className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50">
                  <RotateCcw className="w-3.5 h-3.5" /> Discard & upload another
                </button>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  {!canConfirm && rows.length > 0 && (
                    <span className="text-[11px] font-semibold text-danger-700 text-center">
                      {checks.blockingRows > 0
                        ? `Fix ${checks.blockingRows} row${checks.blockingRows === 1 ? '' : 's'} marked in red first.`
                        : duplicateOf && !duplicateAck
                          ? 'Tick “This is a new delivery” to add this file again.'
                          : toAdd === 0
                            ? 'Every row is already in stock.'
                            : ''}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={confirm}
                    disabled={!canConfirm}
                    className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Confirm & Add to Inward Stock ({toAdd})
                  </button>
                </div>
              </>
            ) : (
              <>
                <button type="button" onClick={reset} className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50">
                  <UploadCloud className="w-3.5 h-3.5" /> Upload another
                </button>
                <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold">
                  View Inward Stock
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

const STEPS: Array<{ id: Step[]; label: string }> = [
  { id: ['pick', 'uploading'], label: 'Upload' },
  { id: ['reading'], label: 'Read' },
  { id: ['review'], label: 'Review' },
  { id: ['saving', 'done'], label: 'Add to stock' },
];

function StepBar({ step }: { step: Step }) {
  const active = STEPS.findIndex((s) => s.id.includes(step));
  return (
    <ol className="flex items-center gap-1 sm:gap-2 px-4 sm:px-6 py-2 border-b border-neutral-100 bg-white text-[11px] font-semibold overflow-x-auto">
      {STEPS.map((s, i) => (
        <li key={s.label} className="flex items-center gap-1 sm:gap-2 shrink-0">
          <span
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              i < active || step === 'done' ? 'bg-accent-300 text-neutral-900' : i === active ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-400'
            }`}
          >
            {i + 1}
          </span>
          <span className={i === active ? 'text-neutral-900' : 'text-neutral-400'}>{s.label}</span>
          {i < STEPS.length - 1 && <span className="w-4 sm:w-8 h-px bg-neutral-200" />}
        </li>
      ))}
    </ol>
  );
}

function Tip({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text: string }) {
  return (
    <div className="hidden sm:block rounded-xl border border-neutral-200 p-3.5">
      <span className="flex items-center gap-2 text-xs font-bold text-neutral-900">
        <Icon className="w-4 h-4 text-brand-600" /> {title}
      </span>
      <span className="block mt-1 text-[11px] text-neutral-500">{text}</span>
    </div>
  );
}

function Chip({ tone, children }: { tone: 'danger' | 'accent' | 'neutral' | 'ok'; children: React.ReactNode }) {
  const tones = {
    danger: 'bg-danger-50 text-danger-800 border-danger-200',
    accent: 'bg-accent-100 text-neutral-900 border-accent-300',
    neutral: 'bg-neutral-100 text-neutral-700 border-neutral-200',
    ok: 'bg-brand-50 text-brand-800 border-brand-200',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`rounded-xl p-3 text-center ${tone}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-sm sm:text-base font-bold tabular-nums">{value}</p>
    </div>
  );
}

const confidenceClass = (level?: Confidence) =>
  level === 'low'
    ? 'border-danger-400 bg-danger-50 focus:ring-danger-400'
    : level === 'medium'
      ? 'border-accent-500 bg-accent-50 focus:ring-accent-500'
      : 'border-neutral-300 bg-white focus:ring-brand-500';

const confidenceTitle = (level?: Confidence) =>
  level === 'low' ? 'Hard to read — check against the paper' : level === 'medium' ? 'Read with some doubt — check it' : undefined;

function HeaderInput({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  confidence,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  confidence?: Confidence;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold uppercase tracking-wide text-neutral-500 mb-1">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        title={confidenceTitle(confidence)}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full h-9 px-2.5 border rounded-lg text-xs font-semibold text-neutral-900 focus:outline-none focus:ring-2 ${confidenceClass(confidence)}`}
      />
    </label>
  );
}

interface RowCheck {
  blocking: string[];
  warnings: string[];
  inStock: number | null;
  repeatOf: number | null;
}

const RowEditor = memo(function RowEditor({
  row,
  header,
  check,
  onChange,
  onRemove,
  onChecked,
  onAllowDuplicate,
}: {
  row: ReviewRow;
  header: Header;
  check: RowCheck;
  onChange: (key: string, field: RowField, value: string) => void;
  onRemove: (key: string) => void;
  onChecked: (key: string) => void;
  onAllowDuplicate: (key: string, value: boolean) => void;
}) {
  const input = (field: RowField, opts: { placeholder?: string; type?: string; className?: string; label: string; inputMode?: 'decimal' } ) => (
    <label className={`block min-w-0 ${opts.className || ''}`}>
      <span className="lg:sr-only block text-[10px] font-bold uppercase tracking-wide text-neutral-500 mb-0.5">{opts.label}</span>
      <input
        type={opts.type || 'text'}
        inputMode={opts.inputMode}
        value={row[field]}
        placeholder={opts.placeholder}
        title={confidenceTitle(row.confidence[field])}
        aria-label={`Row ${row.rowNo} ${opts.label}`}
        aria-invalid={row.confidence[field] === 'low' || undefined}
        onChange={(e) => onChange(row.key, field, e.target.value)}
        className={`w-full h-8 px-2 border rounded-md text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 ${confidenceClass(row.confidence[field])}`}
      />
    </label>
  );
  const hasLowConfidence = Object.values(row.confidence).some((c) => c !== 'high') || row.unreadable.length > 0;
  const status = check.blocking.length ? 'danger' : check.inStock !== null && !row.allowDuplicate ? 'skip' : check.warnings.length ? 'warn' : 'ok';
  const bar = { danger: 'border-l-danger-500', skip: 'border-l-neutral-300', warn: 'border-l-accent-500', ok: 'border-l-brand-300' }[status];

  return (
    <div className={`px-3 py-2.5 border-l-4 ${bar} ${status === 'skip' ? 'bg-neutral-50/80' : ''}`}>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-[2.5rem_minmax(9rem,1.6fr)_6rem_minmax(6rem,1fr)_minmax(6rem,1fr)_6rem_5.5rem_7rem_8.5rem_minmax(7rem,1fr)_minmax(6rem,1fr)_4.5rem] gap-2 items-end lg:items-center">
        <div className="col-span-2 sm:col-span-4 lg:col-span-1 flex items-center justify-between lg:block">
          <span className="text-xs font-bold tabular-nums text-neutral-500" title={row.source}>
            {row.rowNo}
          </span>
          <span className="lg:hidden text-[10px] text-neutral-400">{row.source}</span>
        </div>
        {input('itemName', { label: 'Fabric', placeholder: 'Fabric name', className: 'col-span-2 lg:col-span-1' })}
        {input('fabricCode', { label: 'Code', placeholder: '—' })}
        {input('colour', { label: 'Colour', placeholder: '—' })}
        {input('dyeColour', { label: 'Dye to', placeholder: '—' })}
        <label className="block min-w-0">
          <span className="lg:sr-only block text-[10px] font-bold uppercase tracking-wide text-neutral-500 mb-0.5">Qty</span>
          <input
            type="text"
            inputMode="decimal"
            value={row.quantity}
            placeholder={row.quantityText && !row.quantity ? `read: ${row.quantityText}` : '0'}
            title={confidenceTitle(row.confidence.quantity)}
            aria-label={`Row ${row.rowNo} quantity`}
            onChange={(e) => onChange(row.key, 'quantity', e.target.value)}
            className={`w-full h-8 px-2 border rounded-md text-xs font-bold text-right tabular-nums text-neutral-900 placeholder:font-normal placeholder:text-neutral-400 focus:outline-none focus:ring-2 ${confidenceClass(row.confidence.quantity)}`}
          />
        </label>
        <label className="block min-w-0">
          <span className="lg:sr-only block text-[10px] font-bold uppercase tracking-wide text-neutral-500 mb-0.5">Unit</span>
          <select
            value={row.unit}
            aria-label={`Row ${row.rowNo} unit`}
            title={confidenceTitle(row.confidence.unit)}
            onChange={(e) => onChange(row.key, 'unit', e.target.value)}
            className={`w-full h-8 px-1.5 border rounded-md text-xs font-bold text-neutral-900 focus:outline-none focus:ring-2 ${!row.unit ? 'border-danger-400 bg-danger-50' : confidenceClass(row.confidence.unit)}`}
          >
            <option value="">Choose</option>
            <option value="MTR">MTR</option>
            <option value="PCS">PCS</option>
          </select>
        </label>
        {input('billNo', { label: 'Bill no.', placeholder: header.billNo || '—' })}
        {input('billDate', { label: 'Bill date', type: 'date' })}
        {input('supplierName', { label: 'Supplier', placeholder: header.supplierName || '—', className: 'col-span-2 sm:col-span-1' })}
        {input('remarks', { label: 'Remarks', placeholder: '—', className: 'col-span-2 sm:col-span-1' })}
        <div className="col-span-2 sm:col-span-4 lg:col-span-1 flex items-center justify-end gap-1">
          {hasLowConfidence && (
            <button type="button" onClick={() => onChecked(row.key)} title="I checked this row against the paper" aria-label={`Mark row ${row.rowNo} as checked`} className="p-1.5 rounded-md text-brand-700 hover:bg-brand-50">
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
          <button type="button" onClick={() => onRemove(row.key)} title="Remove row" aria-label={`Remove row ${row.rowNo}`} className="p-1.5 rounded-md text-neutral-400 hover:text-danger-700 hover:bg-danger-50">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {(check.blocking.length > 0 || check.warnings.length > 0 || check.inStock !== null) && (
        <div className="mt-1.5 lg:pl-[2.75rem] flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
          {check.blocking.map((m) => (
            <span key={m} className="inline-flex items-center gap-1 font-semibold text-danger-700">
              <AlertCircle className="w-3 h-3" />
              {m}
            </span>
          ))}
          {check.warnings.map((m) => (
            <span key={m} className="inline-flex items-center gap-1 text-neutral-700">
              <AlertTriangle className="w-3 h-3 text-neutral-600" />
              {m}
            </span>
          ))}
          {check.inStock !== null && (
            <label className="inline-flex items-center gap-1.5 font-semibold text-neutral-700 cursor-pointer">
              <span>Already in Inward Stock (entry #{check.inStock}) — {row.allowDuplicate ? 'will be added again' : 'will be skipped'}.</span>
              <input type="checkbox" checked={row.allowDuplicate} onChange={(e) => onAllowDuplicate(row.key, e.target.checked)} className="w-3.5 h-3.5 accent-danger-600" />
              <span>Add anyway</span>
            </label>
          )}
        </div>
      )}
    </div>
  );
});

function UploadHistory({ history }: { history: ImportSummary[] | null }) {
  if (history === null) return <p className="py-10 text-center text-sm text-neutral-500">Loading upload history…</p>;
  if (history.length === 0) return <p className="py-10 text-center text-sm text-neutral-500">No stock sheets uploaded yet.</p>;
  const statusChip = (status: string) =>
    status === 'CONFIRMED' ? (
      <Chip tone="ok">Added</Chip>
    ) : status === 'EXTRACTED' ? (
      <Chip tone="accent">Not confirmed</Chip>
    ) : status === 'FAILED' ? (
      <Chip tone="danger">Unreadable</Chip>
    ) : (
      <Chip tone="neutral">Discarded</Chip>
    );
  return (
    <div className="rounded-2xl border border-neutral-200 divide-y divide-neutral-100">
      {history.map((item) => (
        <div key={item.id} className="px-3.5 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <span className="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
            {item.source === 'EXCEL' ? <FileSpreadsheet className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-neutral-900 truncate">{item.fileName}</p>
            <p className="text-[11px] text-neutral-500">
              {item.uploadedBy} · {when(item.uploadedAt)} · {fileSize(item.fileSize)} · {item.rowCount} row{item.rowCount === 1 ? '' : 's'} read
              {item.status === 'CONFIRMED' && ` · confirmed by ${item.confirmedBy} on ${when(item.confirmedAt)}: ${item.addedCount} added, ${item.skippedCount} skipped`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {statusChip(item.status)}
            <a href={item.fileUrl} className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-neutral-200 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50" title="Download the original file">
              <Download className="w-3.5 h-3.5" /> File
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
