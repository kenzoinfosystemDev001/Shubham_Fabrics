'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Edit3,
  ExternalLink,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  X,
} from 'lucide-react';

const REASON_SUGGESTIONS = [
  'Fabric damage',
  'Color mismatch',
  'Embroidery defect',
  'Thread cutting defect',
  'Stitching defect',
  'Washing defect',
  'Measurement issue',
  'Finishing defect',
  'Steam press damage',
  'Final inspection failure',
  'Packing damage',
  'Shade variation',
  'Print defect',
  'Weaving defect',
  'Hole / tear',
  'Oil stain',
  'Skipped stitch',
];

const DEPARTMENT_DISPLAY: Record<string, string> = {
  DYEING: 'Dyeing',
  DYEING_QC: 'Dyeing QC',
  EMBROIDERY: 'Embroidery',
  THREAD_CUTTING: 'Thread Cutting',
  THREADCUT_QC: 'Threadcut QC',
  WASHING: 'Washing',
  WASHING_QC: 'Washing QC',
  RECUTTING: 'Recutting',
  STITCHING: 'Stitching',
  FINISHING: 'Finishing',
  STEAM_PRESS: 'Steam Press',
  FINAL_QC: 'Final QC',
  PACKING: 'Packing',
};

const EMPTY_FORM = {
  productionSheetNumber: '',
  challanReference: '',
  color: '',
  fabricType: '',
  quantity: '',
  quantityUnit: 'PCS' as 'PCS' | 'MTR',
  reason: '',
  itemDescription: '',
};

interface DefectRecord {
  id: string;
  defectCode: string;
  productionSheetNumber?: string;
  challanId?: string;
  departmentCode: string;
  shelfCode?: string;
  color?: string;
  fabricType?: string;
  quantityUnit?: string;
  responsibleIncharge?: string;
  itemDescription?: string;
  quantity: number;
  reason: string;
  status: string;
  createdAt: string;
  program?: {
    id: string;
    programNumber?: string;
    programSerialNo?: string;
    mainStyle?: string;
    clientName?: string;
    fabricName?: string;
    fabricType?: string;
    fabricColor?: string;
  };
  challan?: {
    id: string;
    challanNumber: string;
    fabricUnit?: string;
    items?: Array<{ uom?: string; colour?: string }>;
  };
  detectedBy?: { fullName?: string; username?: string };
}

interface DepartmentDefectiveShelfWidgetProps {
  department: string;
  shelfCode: string;
  accentColor?: 'rose' | 'purple' | 'indigo' | 'fuchsia' | 'amber' | 'teal' | 'cyan' | 'sky' | 'emerald';
  readOnly?: boolean;
}

export function DepartmentDefectiveShelfWidget({
  department,
  shelfCode,
  accentColor = 'rose',
  readOnly = false,
}: DepartmentDefectiveShelfWidgetProps) {
  const [records, setRecords] = useState<DefectRecord[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [archiveModal, setArchiveModal] = useState<{ record: DefectRecord; reason: string } | null>(null);

  const departmentName = DEPARTMENT_DISPLAY[department] || department;

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/defective-shelves', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Could not load defective shelf.');
      const allRecords: DefectRecord[] = json.data.defectRecords || [];
      setRecords(
        allRecords.filter((r) => {
          const code = String(r.departmentCode || '').toUpperCase();
          return (
            code === department.toUpperCase() ||
            (department === 'WASHING_QC' && (code === 'WASHING_QC' || code === 'WASHING_QC'))
          );
        })
      );
    } catch (err: any) {
      setError(err.message || 'Could not load defective shelf.');
    } finally {
      setLoading(false);
    }
  }, [department]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) =>
      [
        r.defectCode,
        r.productionSheetNumber,
        r.program?.programSerialNo,
        r.program?.programNumber,
        r.challan?.challanNumber,
        r.color,
        r.fabricType,
        r.reason,
        r.itemDescription,
        r.responsibleIncharge,
      ].some((f) => String(f || '').toLowerCase().includes(q))
    );
  }, [query, records]);

  const updateField = (key: keyof typeof EMPTY_FORM, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
    setError('');
    setNotice('');
  };

  const beginEdit = (record: DefectRecord) => {
    setEditingId(record.id);
    setForm({
      productionSheetNumber:
        record.productionSheetNumber ||
        record.program?.programSerialNo ||
        record.program?.programNumber ||
        '',
      challanReference: record.challan?.challanNumber || '',
      color: record.color || record.program?.fabricColor || '',
      fabricType:
        record.fabricType || record.program?.fabricType || record.program?.fabricName || '',
      quantity: String(record.quantity ?? ''),
      quantityUnit: ((record.challan?.fabricUnit ||
        record.challan?.items?.[0]?.uom ||
        record.quantityUnit ||
        'PCS') as 'PCS' | 'MTR'),
      reason: record.reason || '',
      itemDescription: record.itemDescription || '',
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.reason.trim()) {
      setError('Reason for defect is mandatory before submitting.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const url = editingId
        ? `/api/defective-shelves/${editingId}`
        : '/api/defective-shelves';
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, departmentCode: department, quantity: Number(form.quantity) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not save the defective entry.');
      setNotice(
        editingId
          ? 'Defective shelf entry updated. Audit trail recorded.'
          : `Material recorded on ${departmentName} Defective Shelf (${shelfCode}). Fabric Store will see this in the centralized dashboard.`
      );
      resetForm();
      await loadRecords();
    } catch (err: any) {
      setError(err.message || 'Could not save the defective entry.');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!archiveModal?.reason.trim()) return;
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/defective-shelves/${archiveModal.record.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removalReason: archiveModal.reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not archive this entry.');
      setNotice(
        'Entry archived with an audit record. No stock or production quantity was changed.'
      );
      if (editingId === archiveModal.record.id) resetForm();
      setArchiveModal(null);
      await loadRecords();
    } catch (err: any) {
      setError(err.message || 'Could not archive this entry.');
    }
  };

  const badgeClass = `bg-${accentColor}-100 text-${accentColor}-900 border-${accentColor}-300`;
  const pillClass = `bg-${accentColor}-50 border-${accentColor}-200 text-${accentColor}-800`;

  const totalPcs = records
    .filter((r) => (r.quantityUnit || 'PCS') === 'PCS')
    .reduce((s, r) => s + Number(r.quantity || 0), 0);
  const totalMtr = records
    .filter((r) => (r.quantityUnit || '') === 'MTR')
    .reduce((s, r) => s + Number(r.quantity || 0), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-600 block">
            DEPARTMENT DEFECTIVE SHELF
          </span>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Archive className="w-5 h-5 text-rose-600" />
            <span>{departmentName} Defective Shelf</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Defective material recorded here is quarantined and visible in the Fabric Store&apos;s
            Central Defective Shelf Dashboard (DEF-SHELF-CENTRAL).
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-mono text-[11px] font-bold px-2.5 py-1 rounded border ${badgeClass}`}>
            {shelfCode}
          </span>
          <button
            onClick={loadRecords}
            disabled={loading}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition"
            title="Refresh shelf"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {!readOnly && (
            <button
              onClick={() => {
                setShowForm(!showForm);
                setEditingId(null);
                setForm(EMPTY_FORM);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-lg transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Record Defect
            </button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">Active Entries</span>
          <p className="text-xl font-mono font-bold text-rose-900">{records.length}</p>
          <span className="text-[10px] text-rose-600">on this shelf</span>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">Defective PCS</span>
          <p className="text-xl font-mono font-bold text-slate-900">{totalPcs}</p>
          <span className="text-[10px] text-slate-500">pieces quarantined</span>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">Defective MTR</span>
          <p className="text-xl font-mono font-bold text-slate-900">{totalMtr.toFixed(2)}</p>
          <span className="text-[10px] text-slate-500">meters quarantined</span>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block">Central Store Sync</span>
          <p className="text-xs font-bold text-purple-900 flex items-center gap-1 mt-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Auto-synced
          </p>
          <span className="text-[10px] text-purple-600">DEF-SHELF-CENTRAL</span>
        </div>
      </div>

      {/* Notices */}
      {(error || notice) && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm flex items-start gap-2 ${
            error
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {error ? (
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          )}
          <span className="flex-1">{error || notice}</span>
          <button
            onClick={() => {
              setError('');
              setNotice('');
            }}
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Entry Form */}
      {!readOnly && showForm && (
        <section className="bg-white border border-rose-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 bg-rose-50 border-b border-rose-200">
            {editingId ? (
              <Edit3 className="w-4 h-4 text-amber-600" />
            ) : (
              <Plus className="w-4 h-4 text-rose-700" />
            )}
            <h3 className="text-sm font-bold text-slate-900">
              {editingId ? 'Edit Defective Entry' : 'Record Defective Material'}
            </h3>
            <span className="ml-auto font-mono text-[10px] text-slate-500">{shelfCode}</span>
            <button onClick={resetForm} className="text-slate-400 hover:text-slate-700 p-1 rounded ml-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs font-semibold text-slate-700">
              Production Sheet / Serial No *
              <input
                required
                value={form.productionSheetNumber}
                onChange={(e) => updateField('productionSheetNumber', e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-lavender-500 focus:ring-1 focus:ring-lavender-200"
                placeholder="e.g. PROG-2026-0001 or serial"
              />
            </label>

            <label className="text-xs font-semibold text-slate-700">
              Related Challan (optional)
              <input
                value={form.challanReference}
                onChange={(e) => updateField('challanReference', e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-lavender-500"
                placeholder="Challan number if applicable"
              />
            </label>

            <label className="text-xs font-semibold text-slate-700">
              Color / Shade *
              <input
                required
                value={form.color}
                onChange={(e) => updateField('color', e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-lavender-500"
                placeholder="e.g. Navy Blue"
              />
            </label>

            <label className="text-xs font-semibold text-slate-700">
              Fabric / Garment Type *
              <input
                required
                value={form.fabricType}
                onChange={(e) => updateField('fabricType', e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-lavender-500"
                placeholder="e.g. Polo T-Shirt / Kora Fabric"
              />
            </label>

            <label className="text-xs font-semibold text-slate-700">
              Defective Quantity *
              <div className="mt-1 flex gap-2">
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.quantity}
                  onChange={(e) => updateField('quantity', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono outline-none focus:border-lavender-500"
                  placeholder="0"
                />
                <select
                  value={form.quantityUnit}
                  onChange={(e) => updateField('quantityUnit', e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
                >
                  <option value="PCS">PCS</option>
                  <option value="MTR">MTR</option>
                </select>
              </div>
            </label>

            <label className="text-xs font-semibold text-slate-700 md:col-span-2 xl:col-span-3">
              Reason for Defect *{' '}
              <span className="text-rose-600 text-[10px] font-normal">
                (mandatory — type or select from suggestions)
              </span>
              <input
                required
                list="dds-reason-suggestions"
                value={form.reason}
                onChange={(e) => updateField('reason', e.target.value)}
                className="mt-1 w-full rounded-lg border border-rose-300 bg-rose-50/30 px-3 py-2 text-xs outline-none focus:border-lavender-600 focus:ring-1 focus:ring-lavender-200"
                placeholder="Enter actual defect reason or select from list…"
              />
              <datalist id="dds-reason-suggestions">
                {REASON_SUGGESTIONS.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </label>

            <label className="text-xs font-semibold text-slate-700 md:col-span-2 xl:col-span-4">
              Item Description (optional)
              <input
                value={form.itemDescription}
                onChange={(e) => updateField('itemDescription', e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-lavender-500"
                placeholder="Additional notes on the defective material"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2 md:col-span-2 xl:col-span-4 pt-1 border-t border-slate-100">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-lg transition disabled:opacity-50"
              >
                {editingId ? <Pencil className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                {saving ? 'Saving…' : editingId ? 'Update Entry' : 'Send to Defective Shelf'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel Edit
                </button>
              )}
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Incharge &amp; timestamp auto-recorded. Visible in Fabric Store Central Dashboard.
              </span>
            </div>
          </form>
        </section>
      )}

      {/* Shelf Records Table */}
      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              Active Shelf Entries
              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[11px] font-bold">
                {records.length}
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Material on this shelf is quarantined — not added back to production stock.
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sheet, challan, color, reason…"
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-lavender-400"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-400">Loading shelf entries…</div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <p className="text-sm font-semibold text-slate-800">
              {query ? 'No entries match your search' : 'No active defective entries'}
            </p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {query
                ? 'Try different keywords.'
                : `Defective material recorded by ${departmentName} will appear here.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3.5">Ref / Code</th>
                  <th className="py-3 px-3.5">Sheet / Challan</th>
                  <th className="py-3 px-3.5">Color / Fabric</th>
                  <th className="py-3 px-3.5 text-center">Defective Qty</th>
                  <th className="py-3 px-3.5">Shelf</th>
                  <th className="py-3 px-3.5">Reason for Defect</th>
                  <th className="py-3 px-3.5">Reported By</th>
                  <th className="py-3 px-3.5">Date &amp; Time</th>
                  {!readOnly && <th className="py-3 px-3.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((record) => {
                  const qty = Number(record.quantity) || 0;
                  const unit =
                    record.challan?.fabricUnit ||
                    record.challan?.items?.[0]?.uom ||
                    record.quantityUnit ||
                    'PCS';
                  const sheet =
                    record.productionSheetNumber ||
                    record.program?.programSerialNo ||
                    record.program?.programNumber;
                  const color = record.color || record.program?.fabricColor;
                  const fabric =
                    record.fabricType || record.program?.fabricType || record.program?.fabricName;

                  return (
                    <tr key={record.id} className="hover:bg-rose-50/20 transition align-top">
                      <td className="py-3.5 px-3.5">
                        <div className="font-mono text-[10px] font-bold text-slate-700">
                          {record.defectCode}
                        </div>
                      </td>
                      <td className="py-3.5 px-3.5">
                        <div className="font-mono font-bold text-slate-900 text-[11px]">
                          {sheet || '—'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {record.challan?.challanNumber || ''}
                        </div>
                      </td>
                      <td className="py-3.5 px-3.5">
                        <div className="font-semibold text-slate-800">{color || '—'}</div>
                        <div className="text-[10px] text-slate-500">
                          {fabric || record.itemDescription || '—'}
                        </div>
                      </td>
                      <td className="py-3.5 px-3.5 text-center">
                        <span className="font-mono font-bold text-rose-700">
                          {qty} {unit}
                        </span>
                      </td>
                      <td className="py-3.5 px-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${pillClass}`}
                        >
                          <Archive className="w-3 h-3" />
                          {record.shelfCode || shelfCode}
                        </span>
                      </td>
                      <td className="py-3.5 px-3.5 max-w-[180px]">
                        <div className="font-medium text-slate-900 text-[11px] leading-snug whitespace-normal">
                          {record.reason || '—'}
                        </div>
                      </td>
                      <td className="py-3.5 px-3.5 text-[11px] text-slate-600">
                        {record.responsibleIncharge || record.detectedBy?.fullName || '—'}
                      </td>
                      <td className="py-3.5 px-3.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {new Date(record.createdAt).toLocaleString('en-IN')}
                      </td>
                      {!readOnly && (
                        <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex gap-1.5">
                            {record.challan?.id && (
                              <Link
                                href={`/challans/${record.challan.id}`}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold"
                                title="View challan"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            )}
                            <button
                              onClick={() => beginEdit(record)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 border border-slate-200 rounded text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              <Pencil className="w-3 h-3" />
                              Edit
                            </button>
                            <button
                              onClick={() => setArchiveModal({ record, reason: '' })}
                              className="inline-flex items-center gap-1 px-2.5 py-1 border border-rose-200 rounded text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                            >
                              <Trash2 className="w-3 h-3" />
                              Archive
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-4 py-3 border-t border-slate-100 bg-amber-50/60 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-[10px] text-amber-800">
            Archiving an entry keeps the defect record intact and writes a full audit log. No stock
            quantities are reversed automatically — material disposition requires an authorized
            workflow.
          </p>
        </div>
      </section>

      {/* Archive Confirmation Modal */}
      {archiveModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-600" />
                <h3 className="text-sm font-bold text-slate-900">Archive Defective Entry</h3>
              </div>
              <button
                onClick={() => setArchiveModal(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              You are removing <strong>{archiveModal.record.defectCode}</strong> from the active
              shelf. The original defect record will be preserved with an audit entry. No stock
              quantities will change.
            </p>

            <label className="block text-xs font-semibold text-slate-700">
              Reason for removal *
              <textarea
                required
                rows={2}
                value={archiveModal.reason}
                onChange={(e) => setArchiveModal({ ...archiveModal, reason: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-lavender-500 resize-none"
                placeholder="e.g. Moved to rework, scrapped, returned to supplier…"
              />
            </label>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setArchiveModal(null)}
                className="px-4 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                disabled={!archiveModal.reason.trim()}
                onClick={handleArchive}
                className="px-4 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-bold transition disabled:opacity-40"
              >
                Archive Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
