'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Pencil, Plus, RefreshCw, Search, X } from 'lucide-react';
import { downloadSheet } from '@/lib/download-sheet';
import { printWhenReady } from '@/lib/print-window';

// Shrinkage records of dyed fabric (one per Dyeing -> Dyeing QC challan line). Dyeing QC adds and edits them;
// the Fabric Store sees the same records read-only. Information only: stock is not changed.

interface ShrinkageRow {
  id: string;
  challanNumber: string;
  designNumber: string;
  serialNumber: string;
  fabric: string;
  colour: string;
  originalQty: number;
  originalUnit: string;
  shrinkageQty: number;
  shrinkageUnit: string;
  remainingQty: number | null;
  remarks: string;
  source: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

interface Candidate {
  challanItemId: string;
  challanNumber: string;
  designNumber: string;
  serialNumber: string;
  fabric: string;
  colour: string;
  quantity: number;
  uom: string;
}

type Filters = { search: string; design: string; serial: string; from: string; to: string };
const EMPTY_FILTERS: Filters = { search: '', design: '', serial: '', from: '', to: '' };

const qty = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(Math.round(n * 1000) / 1000));
const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const remainingText = (r: { remainingQty: number | null; originalUnit: string }) =>
  r.remainingQty === null ? 'Units differ' : `${qty(r.remainingQty)} ${r.originalUnit}`;
const escapeHtml = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** Remaining preview for the form: only when both quantities are in the same unit. */
function previewRemaining(originalQty: number, originalUnit: string, shrinkage: string, shrinkageUnit: string) {
  if (shrinkage === '' || !Number.isFinite(Number(shrinkage))) return '';
  if (originalUnit !== shrinkageUnit) return 'Units differ: not calculated';
  return `${qty(originalQty - Number(shrinkage))} ${originalUnit}`;
}

/** Same checks as the server, so mistakes show before saving. */
function formError(originalQty: number, originalUnit: string, shrinkage: string, shrinkageUnit: string) {
  if (shrinkage.trim() === '' || !Number.isFinite(Number(shrinkage))) return 'Enter the shrinkage quantity.';
  if (Number(shrinkage) < 0) return 'Shrinkage cannot be negative.';
  if (shrinkageUnit !== 'MTR' && shrinkageUnit !== 'PCS') return 'Choose the shrinkage unit (MTR or PCS).';
  if (shrinkageUnit === originalUnit && Number(shrinkage) > originalQty + 0.001) {
    return `Shrinkage cannot be more than the original quantity (${qty(originalQty)} ${originalUnit}).`;
  }
  return null;
}

export function ShrinkageRecords({ editable, departmentLabel }: { editable: boolean; departmentLabel: string }) {
  const [rows, setRows] = useState<ShrinkageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [setupMessage, setSetupMessage] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);

  // Add / edit form
  const [editing, setEditing] = useState<ShrinkageRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [form, setForm] = useState({ shrinkageQty: '', shrinkageUnit: '', remarks: '' });
  const [saving, setSaving] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const queryString = (f: Filters) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(f)) if (value.trim()) params.set(key, value.trim());
    return params.toString();
  };

  const load = async (f: Filters = applied) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/shrinkage?${queryString(f)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load shrinkage records.');
      setRows(json.data || []);
      setSetupMessage(json.setupRequired || null);
    } catch (err: any) {
      setError(err.message || 'Failed to load shrinkage records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(EMPTY_FILTERS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = (e?: React.FormEvent) => {
    e?.preventDefault();
    setApplied(filters);
    load(filters);
  };
  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    load(EMPTY_FILTERS);
  };

  const loadCandidates = async (search = candidateSearch) => {
    try {
      setLoadingCandidates(true);
      const res = await fetch(`/api/shrinkage/candidates?search=${encodeURIComponent(search.trim())}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load fabric lines.');
      setCandidates(json.data || []);
    } catch (err: any) {
      setFormMessage(err.message || 'Failed to load fabric lines.');
    } finally {
      setLoadingCandidates(false);
    }
  };

  const openAdd = () => {
    setAdding(true);
    setEditing(null);
    setSelected(null);
    setCandidateSearch('');
    setForm({ shrinkageQty: '', shrinkageUnit: '', remarks: '' });
    setFormMessage(null);
    loadCandidates('');
  };
  const openEdit = (row: ShrinkageRow) => {
    setEditing(row);
    setAdding(false);
    setForm({ shrinkageQty: qty(row.shrinkageQty), shrinkageUnit: row.shrinkageUnit, remarks: row.remarks });
    setFormMessage(null);
  };
  const closeForm = () => {
    setEditing(null);
    setAdding(false);
    setSelected(null);
  };

  // The line the form is about: the record being edited, or the line picked to add.
  const formLine = editing
    ? { originalQty: editing.originalQty, originalUnit: editing.originalUnit }
    : selected
      ? { originalQty: selected.quantity, originalUnit: String(selected.uom || '').toUpperCase() }
      : null;

  const save = async () => {
    if (!formLine) return;
    const message = formError(formLine.originalQty, formLine.originalUnit, form.shrinkageQty, form.shrinkageUnit);
    if (message) {
      setFormMessage(message);
      return;
    }
    try {
      setSaving(true);
      setFormMessage(null);
      const body = { shrinkageQty: Number(form.shrinkageQty), shrinkageUnit: form.shrinkageUnit, remarks: form.remarks };
      const res = editing
        ? await fetch(`/api/shrinkage/${editing.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/shrinkage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...body, challanItemId: selected?.challanItemId }),
          });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save shrinkage.');
      closeForm();
      await load();
    } catch (err: any) {
      setFormMessage(err.message || 'Failed to save shrinkage.');
    } finally {
      setSaving(false);
    }
  };

  const sheetRows = useMemo(
    () =>
      rows.map((r) => ({
        'Design No': r.designNumber,
        'Serial No': r.serialNumber,
        Challan: r.challanNumber,
        Fabric: r.fabric,
        Colour: r.colour,
        'Original Qty': r.originalQty,
        'Original Unit': r.originalUnit,
        'Shrinkage Qty': r.shrinkageQty,
        'Shrinkage Unit': r.shrinkageUnit,
        'Remaining Qty': r.remainingQty === null ? 'Units differ' : r.remainingQty,
        Remarks: r.remarks,
        'Updated By': r.updatedBy,
        'Updated Date/Time': dateTime(r.updatedAt),
      })),
    [rows],
  );

  const filterNote = () => {
    const parts = [
      applied.search && `Search: ${applied.search}`,
      applied.design && `Design: ${applied.design}`,
      applied.serial && `Serial: ${applied.serial}`,
      applied.from && `From: ${applied.from}`,
      applied.to && `To: ${applied.to}`,
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'All records';
  };

  const downloadExcel = () => {
    if (rows.length === 0) return;
    downloadSheet(`shrinkage-${new Date().toISOString().slice(0, 10)}.xlsx`, 'Shrinkage', sheetRows);
  };

  const downloadPdf = () => {
    if (rows.length === 0) return;
    const win = window.open('', '_blank');
    if (!win) return;
    const headers = Object.keys(sheetRows[0]);
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Shrinkage</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  body { font-family: Arial, sans-serif; color: #111; margin: 0; }
  h1 { font-size: 16px; margin: 0 0 2px; }
  p { font-size: 10px; margin: 0 0 8px; color: #444; }
  table { width: 100%; border-collapse: collapse; font-size: 9px; }
  th, td { border: 1px solid #999; padding: 3px 4px; text-align: left; vertical-align: top; }
  th { background: #eee; }
</style></head><body>
<h1>Shubham Fabrics — Shrinkage (${escapeHtml(departmentLabel)})</h1>
<p>${escapeHtml(filterNote())} · ${rows.length} record(s) · Printed ${escapeHtml(dateTime(new Date().toISOString()))}</p>
<table><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
<tbody>${sheetRows
      .map((r) => `<tr>${headers.map((h) => `<td>${escapeHtml((r as Record<string, unknown>)[h])}</td>`).join('')}</tr>`)
      .join('')}</tbody></table></body></html>`);
    win.document.close();
    printWhenReady(win);
  };

  const inputClass =
    'w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs text-neutral-900 bg-white focus:ring-1 focus:ring-brand-500/40 focus:outline-none';

  return (
    <div className="min-h-screen bg-neutral-50 pb-16">
      <header className="bg-white border-b border-neutral-200/80 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Shrinkage</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {editable
              ? 'Shrinkage of dyed fabric received from Dyeing. The Fabric Store sees these records.'
              : 'Shrinkage recorded by Dyeing QC (view only). Stock is not changed by it.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => load()}
            className="px-3 py-2 border border-neutral-200 bg-white hover:bg-neutral-50 rounded-lg text-xs font-semibold text-neutral-800 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={downloadExcel}
            disabled={rows.length === 0}
            className="px-3 py-2 border border-neutral-200 bg-white hover:bg-neutral-50 rounded-lg text-xs font-semibold text-neutral-800 flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Download Excel
          </button>
          <button
            type="button"
            onClick={downloadPdf}
            disabled={rows.length === 0}
            className="px-3 py-2 border border-neutral-200 bg-white hover:bg-neutral-50 rounded-lg text-xs font-semibold text-neutral-800 flex items-center gap-1.5 disabled:opacity-50"
          >
            <FileText className="w-3.5 h-3.5" />
            Download PDF
          </button>
          {editable && (
            <button
              type="button"
              onClick={openAdd}
              disabled={Boolean(setupMessage)}
              className="px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Shrinkage
            </button>
          )}
        </div>
      </header>

      <div className="px-4 sm:px-8 pt-5 space-y-4">
        {/* FILTERS */}
        <form onSubmit={applyFilters} className="bg-white border border-neutral-200 rounded-xl p-3 grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
          <div className="col-span-2">
            <label className="block text-[11px] font-bold text-neutral-700 mb-1">Search</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Design, serial, fabric, challan"
                className={`${inputClass} pl-8`}
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-neutral-700 mb-1">Design No</label>
            <input value={filters.design} onChange={(e) => setFilters({ ...filters, design: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-neutral-700 mb-1">Serial No</label>
            <input value={filters.serial} onChange={(e) => setFilters({ ...filters, serial: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-neutral-700 mb-1">Updated From</label>
            <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-neutral-700 mb-1">Updated To</label>
            <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className={inputClass} />
          </div>
          <div className="col-span-2 md:col-span-6 flex justify-end gap-2">
            <button type="button" onClick={clearFilters} className="px-3 py-1.5 border border-neutral-200 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-50">
              Clear
            </button>
            <button type="submit" className="px-3 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-semibold hover:bg-neutral-800">
              Apply Filters
            </button>
          </div>
        </form>

        {setupMessage && (
          <div className="p-3 bg-brand-50 border border-brand-200 text-brand-900 rounded-xl text-xs font-semibold">{setupMessage}</div>
        )}
        {error && <div className="p-3 bg-danger-50 border border-danger-200 text-danger-800 rounded-xl text-xs">{error}</div>}

        {/* TABLE */}
        <div className="bg-white border border-neutral-200 rounded-xl overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-neutral-50 text-neutral-700">
              <tr>
                {['Design No', 'Serial No', 'Challan', 'Fabric', 'Original Qty', 'Shrinkage', 'Remaining Qty', 'Remarks', 'Updated By', 'Updated Date/Time'].map(
                  (h) => (
                    <th key={h} className="px-3 py-2.5 text-left font-bold whitespace-nowrap border-b border-neutral-200">
                      {h}
                    </th>
                  ),
                )}
                {editable && <th className="px-3 py-2.5 border-b border-neutral-200" />}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={editable ? 11 : 10} className="px-3 py-8 text-center text-neutral-500">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={editable ? 11 : 10} className="px-3 py-8 text-center text-neutral-500">
                    No shrinkage records{filterNote() !== 'All records' ? ' match these filters' : ' yet'}.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-neutral-100 hover:bg-neutral-50/60">
                    <td className="px-3 py-2 font-semibold text-neutral-900">{r.designNumber || '—'}</td>
                    <td className="px-3 py-2 font-mono">{r.serialNumber || '—'}</td>
                    <td className="px-3 py-2 font-mono">{r.challanNumber}</td>
                    <td className="px-3 py-2">
                      {r.fabric || '—'}
                      {r.colour && <span className="block text-[10px] text-neutral-500">{r.colour}</span>}
                    </td>
                    <td className="px-3 py-2 font-mono whitespace-nowrap">
                      {qty(r.originalQty)} {r.originalUnit}
                    </td>
                    <td className="px-3 py-2 font-mono font-bold text-brand-800 whitespace-nowrap">
                      {qty(r.shrinkageQty)} {r.shrinkageUnit}
                    </td>
                    <td className="px-3 py-2 font-mono whitespace-nowrap">{remainingText(r)}</td>
                    <td className="px-3 py-2 max-w-[220px] break-words">{r.remarks || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.updatedBy || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{dateTime(r.updatedAt)}</td>
                    {editable && (
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          className="px-2 py-1 border border-neutral-200 rounded-md text-[11px] font-semibold text-neutral-800 hover:bg-neutral-50 flex items-center gap-1"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && rows.length > 0 && <p className="text-[11px] text-neutral-500">{rows.length} record(s)</p>}
      </div>

      {/* ADD / EDIT FORM */}
      {editable && (adding || editing) && (
        <div className="fixed inset-0 z-50 bg-neutral-900/60 flex items-center justify-center p-4" onClick={closeForm}>
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
              <h2 className="text-sm font-bold text-neutral-900">{editing ? 'Edit Shrinkage' : 'Add Shrinkage'}</h2>
              <button type="button" onClick={closeForm} className="p-1 rounded-md hover:bg-neutral-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Pick the fabric line (add only) */}
              {adding && !selected && (
                <div className="space-y-2">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      loadCandidates();
                    }}
                    className="flex gap-2"
                  >
                    <input
                      value={candidateSearch}
                      onChange={(e) => setCandidateSearch(e.target.value)}
                      placeholder="Search design, serial, fabric, challan"
                      className={inputClass}
                    />
                    <button type="submit" className="px-3 py-2 bg-neutral-900 text-white rounded-lg text-xs font-semibold">
                      Search
                    </button>
                  </form>
                  <div className="border border-neutral-200 rounded-lg max-h-72 overflow-y-auto divide-y divide-neutral-100">
                    {loadingCandidates ? (
                      <p className="p-3 text-xs text-neutral-500">Loading…</p>
                    ) : candidates.length === 0 ? (
                      <p className="p-3 text-xs text-neutral-500">No received fabric lines without a shrinkage record.</p>
                    ) : (
                      candidates.map((c) => (
                        <button
                          key={c.challanItemId}
                          type="button"
                          onClick={() => {
                            setSelected(c);
                            setForm({ shrinkageQty: '', shrinkageUnit: String(c.uom || '').toUpperCase(), remarks: '' });
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-brand-50/60 text-xs"
                        >
                          <span className="font-semibold text-neutral-900">{c.designNumber || '—'}</span>
                          <span className="text-neutral-500"> · Serial {c.serialNumber || '—'} · {c.challanNumber}</span>
                          <span className="block text-neutral-700">
                            {c.fabric || 'Fabric'}
                            {c.colour ? ` · ${c.colour}` : ''} · {qty(c.quantity)} {c.uom}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* The line and the shrinkage form */}
              {formLine && (
                <>
                  <div className="grid grid-cols-2 gap-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg p-3">
                    <div>
                      <span className="text-neutral-500 block">Design No</span>
                      <span className="font-semibold">{(editing || selected)?.designNumber || '—'}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block">Serial No</span>
                      <span className="font-semibold">{(editing || selected)?.serialNumber || '—'}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block">Fabric</span>
                      <span className="font-semibold">{(editing || selected)?.fabric || '—'}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block">Original Qty</span>
                      <span className="font-semibold font-mono">
                        {qty(formLine.originalQty)} {formLine.originalUnit}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-700 mb-1">Shrinkage Qty *</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={form.shrinkageQty}
                        onChange={(e) => setForm({ ...form, shrinkageQty: e.target.value })}
                        className={`${inputClass} font-mono font-bold`}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-700 mb-1">Shrinkage Unit *</label>
                      <div className="flex gap-2">
                        {['MTR', 'PCS'].map((u) => (
                          <button
                            key={u}
                            type="button"
                            onClick={() => setForm({ ...form, shrinkageUnit: u })}
                            className={`flex-1 px-3 py-2 rounded-lg border text-xs font-bold ${
                              form.shrinkageUnit === u ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-neutral-300 text-neutral-700'
                            }`}
                          >
                            {u}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-neutral-700">
                    Remaining Qty:{' '}
                    <strong className="font-mono">
                      {previewRemaining(formLine.originalQty, formLine.originalUnit, form.shrinkageQty, form.shrinkageUnit) || '—'}
                    </strong>
                  </p>
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-700 mb-1">Remarks</label>
                    <textarea rows={2} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} className={inputClass} />
                  </div>
                </>
              )}

              {formMessage && <div className="p-2.5 bg-danger-50 border border-danger-200 text-danger-800 rounded-lg text-xs">{formMessage}</div>}
            </div>

            <div className="px-5 py-3 border-t border-neutral-200 flex justify-between gap-2">
              <div>
                {adding && selected && (
                  <button type="button" onClick={() => setSelected(null)} className="px-3 py-2 text-xs font-semibold text-neutral-700 hover:underline">
                    Choose another line
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={closeForm} className="px-4 py-2 border border-neutral-200 rounded-lg text-xs font-semibold text-neutral-700">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={!formLine || saving}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {saving ? 'Saving…' : editing ? 'Update' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
