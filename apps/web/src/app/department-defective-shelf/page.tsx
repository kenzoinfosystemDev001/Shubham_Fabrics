'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Archive, ArrowLeft, CheckCircle2, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { getCurrentUser, isAdminUser, isFabricStoreUser } from '@/lib/rbac';

const REASON_SUGGESTIONS = [
  'Fabric damage',
  'Color mismatch',
  'Embroidery defect',
  'Thread cutting defect',
  'Washing defect',
  'Measurement issue',
  'Stitching defect',
  'Finishing defect',
  'Steam press damage',
  'Final inspection failure',
  'Packing damage',
];

const DEPARTMENT_NAMES: Record<string, string> = {
  DYEING: 'Dyeing', DYEING_QC: 'Dyeing QC', EMBROIDERY: 'Embroidery', THREAD_CUTTING: 'Thread Cutting',
  THREADCUT_QC: 'Threadcut QC', WASHING: 'Washing', WASHING_QC: 'Washing QC', RECUTTING: 'Recutting', STITCHING: 'Stitching',
  FINISHING: 'Finishing', STEAM_PRESS: 'Steam Press', FINAL_QC: 'Final QC', PACKING: 'Packing',
};

const EMPTY_FORM = {
  productionSheetNumber: '',
  challanReference: '',
  color: '',
  fabricType: '',
  quantity: '',
  quantityUnit: 'PCS',
  reason: '',
  itemDescription: '',
};

export default function DepartmentDefectiveShelfPage() {
  const router = useRouter();
  const [department, setDepartment] = useState('');
  const [records, setRecords] = useState<any[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/defective-shelves', { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || 'Could not load this department shelf.');
      setDepartment(json.data.filterDepartment);
      setRecords(json.data.defectRecords || []);
    } catch (loadError: any) {
      setError(loadError.message || 'Could not load this department shelf.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const user = getCurrentUser();
    if (user && (isAdminUser(user) || isFabricStoreUser(user))) {
      router.replace('/fabric-store/inventory/defected-shelf');
      return;
    }
    if (!user || String(user.departmentCode || '').toUpperCase() === 'PROGRAMMING') {
      router.replace('/login');
      return;
    }
    loadRecords();
  }, [loadRecords, router]);

  const filteredRecords = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return records;
    return records.filter((record) => [
      record.defectCode,
      record.productionSheetNumber,
      record.program?.programSerialNo,
      record.program?.programNumber,
      record.challan?.challanNumber,
      record.color,
      record.fabricType,
      record.reason,
      record.itemDescription,
      record.responsibleIncharge,
    ].some((field) => String(field || '').toLowerCase().includes(value)));
  }, [query, records]);

  const updateField = (key: keyof typeof EMPTY_FORM, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(editingId ? `/api/defective-shelves/${editingId}` : '/api/defective-shelves', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, quantity: Number(form.quantity), departmentCode: department }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Could not save the defective entry.');
      setNotice(editingId ? 'Defective shelf entry updated.' : 'Defective material recorded on this department shelf.');
      setForm(EMPTY_FORM);
      setEditingId(null);
      await loadRecords();
    } catch (saveError: any) {
      setError(saveError.message || 'Could not save the defective entry.');
    } finally {
      setSaving(false);
    }
  };

  const beginEdit = (record: any) => {
    setEditingId(record.id);
    setForm({
      productionSheetNumber: record.productionSheetNumber || record.program?.programSerialNo || record.program?.programNumber || '',
      challanReference: record.challan?.challanNumber || '',
      color: record.color || record.program?.fabricColor || '',
      fabricType: record.fabricType || record.program?.fabricType || record.program?.fabricName || '',
      quantity: String(record.quantity ?? ''),
      quantityUnit: record.challan?.fabricUnit || record.challan?.items?.[0]?.uom || record.quantityUnit || 'PCS',
      reason: record.reason || '',
      itemDescription: record.itemDescription || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const archiveEntry = async (record: any) => {
    const removalReason = window.prompt('Reason for removing this record from the active shelf:')?.trim();
    if (!removalReason) return;
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/defective-shelves/${record.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removalReason }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Could not archive this entry.');
      setNotice('Entry archived with an audit record. No stock or production quantity was changed.');
      if (editingId === record.id) {
        setEditingId(null);
        setForm(EMPTY_FORM);
      }
      await loadRecords();
    } catch (archiveError: any) {
      setError(archiveError.message || 'Could not archive this entry.');
    }
  };

  return (
    <main className="min-h-screen bg-ink-50 px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
          <div>
            {department === 'PACKING' ? (
              <span className="mb-2 inline-flex items-center gap-1 text-xs text-slate-500">Packing Department</span>
            ) : (
              <Link href={department ? `/${department.toLowerCase().replace('_', '-')}` : '/'} className="mb-2 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to department
              </Link>
            )}
            <div className="flex items-center gap-2 text-rose-800">
              <Archive className="h-5 w-5" />
              <h1 className="text-xl font-bold text-slate-900">{DEPARTMENT_NAMES[department] || 'Department'} Defective Shelf</h1>
            </div>
            <p className="mt-1 text-xs text-slate-500">Entries are visible to Fabric Store in its centralized dashboard and remain quarantined until an authorized disposition.</p>
          </div>
          <button onClick={loadRecords} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </header>

        {(error || notice) && <div className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{error || notice}</div>}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            {editingId ? <Pencil className="h-4 w-4 text-amber-600" /> : <Plus className="h-4 w-4 text-teal-700" />}
            <h2 className="text-sm font-bold text-slate-900">{editingId ? 'Edit defective entry' : 'Record defective material'}</h2>
            <span className="ml-auto font-mono text-[10px] text-slate-500">{department ? `DEF-SHELF-${department.replace('_', '-')}` : ''}</span>
          </div>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs font-semibold text-slate-700">Production Sheet / Serial Number *
              <input required value={form.productionSheetNumber} onChange={(event) => updateField('productionSheetNumber', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-lavender-600" placeholder="Enter sheet number" />
            </label>
            <label className="text-xs font-semibold text-slate-700">Related challan
              <input value={form.challanReference} onChange={(event) => updateField('challanReference', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-lavender-600" placeholder="Optional challan number" />
            </label>
            <label className="text-xs font-semibold text-slate-700">Color *
              <input required value={form.color} onChange={(event) => updateField('color', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-lavender-600" placeholder="Color / shade" />
            </label>
            <label className="text-xs font-semibold text-slate-700">Fabric type *
              <input required value={form.fabricType} onChange={(event) => updateField('fabricType', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-lavender-600" placeholder="Fabric / garment type" />
            </label>
            <label className="text-xs font-semibold text-slate-700">Defective quantity *
              <div className="mt-1 flex gap-2">
                <input required type="number" min="0.01" step="0.01" value={form.quantity} onChange={(event) => updateField('quantity', event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-lavender-600" placeholder="0" />
                <select value={form.quantityUnit} onChange={(event) => updateField('quantityUnit', event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"><option value="PCS">PCS</option><option value="MTR">MTR</option></select>
              </div>
            </label>
            <label className="text-xs font-semibold text-slate-700 md:col-span-2 xl:col-span-3">Reason for defect *
              <input required list="defect-reason-suggestions" value={form.reason} onChange={(event) => updateField('reason', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-lavender-600" placeholder="Enter the actual defect reason" />
              <datalist id="defect-reason-suggestions">{REASON_SUGGESTIONS.map((reason) => <option key={reason} value={reason} />)}</datalist>
            </label>
            <label className="text-xs font-semibold text-slate-700 md:col-span-2 xl:col-span-4">Item description
              <input value={form.itemDescription} onChange={(event) => updateField('itemDescription', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-lavender-600" placeholder="Optional fabric or garment details" />
            </label>
            <div className="flex items-center gap-2 md:col-span-2 xl:col-span-4">
              <button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-xs font-bold text-white hover:bg-teal-800 disabled:opacity-50">{editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{saving ? 'Saving…' : editingId ? 'Save changes' : 'Send to defective shelf'}</button>
              {editingId && <button type="button" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); }} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700">Cancel edit</button>}
              <span className="text-[11px] text-slate-500">The incharge and timestamp are recorded automatically.</span>
            </div>
          </form>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Active shelf entries <span className="ml-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-800">{records.length}</span></h2>
              <p className="mt-1 text-xs text-slate-500">This log does not add the material back to usable stock or production.</p>
            </div>
            <div className="relative w-full sm:w-80"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-xs outline-none focus:border-lavender-600" placeholder="Search sheet, challan, color, reason" /></div>
          </div>
          {loading ? <div className="p-12 text-center text-sm text-slate-500">Loading shelf entries…</div> : filteredRecords.length === 0 ? (
            <div className="p-12 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" /><p className="mt-3 text-sm font-semibold text-slate-800">No active defective entries</p><p className="mt-1 text-xs text-slate-500">Defective items recorded by this department will appear here.</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th className="p-3">Sheet / Challan</th><th className="p-3">Color / Fabric</th><th className="p-3">Quantity</th><th className="p-3">Reason</th><th className="p-3">Reported by</th><th className="p-3">Date &amp; time</th><th className="p-3 text-right">Actions</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.map((record) => <tr key={record.id} className="align-top hover:bg-slate-50">
                    <td className="p-3"><div className="font-mono font-bold text-slate-900">{record.productionSheetNumber || record.program?.programSerialNo || record.program?.programNumber}</div><div className="mt-1 text-[10px] text-slate-500">{record.challan?.challanNumber || record.defectCode}</div></td>
                    <td className="p-3"><div className="font-semibold text-slate-800">{record.color || record.program?.fabricColor || '—'}</div><div className="text-[10px] text-slate-500">{record.fabricType || record.program?.fabricType || record.program?.fabricName || record.itemDescription}</div></td>
                    <td className="p-3 whitespace-nowrap font-mono font-bold text-rose-800">{record.quantity} {record.challan?.fabricUnit || record.challan?.items?.[0]?.uom || record.quantityUnit || 'PCS'}</td>
                    <td className="max-w-xs whitespace-normal p-3 text-slate-700">{record.reason}</td>
                    <td className="p-3 text-slate-600">{record.responsibleIncharge || record.detectedBy?.fullName || '—'}</td>
                    <td className="p-3 whitespace-nowrap text-slate-600">{new Date(record.createdAt).toLocaleString('en-IN')}</td>
                    <td className="p-3 text-right"><div className="inline-flex gap-2"><button onClick={() => beginEdit(record)} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-slate-100"><Pencil className="h-3.5 w-3.5" /> Edit</button><button onClick={() => archiveEntry(record)} className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2.5 py-1.5 font-semibold text-rose-700 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /> Archive</button></div></td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Archiving a shelf entry keeps the original defective record and writes an audit entry. Material disposition and stock adjustment remain separate authorized workflows.</p>
      </div>
    </main>
  );
}
