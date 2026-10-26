'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowDownToLine,
  Plus,
  RefreshCw,
  Search,
  Filter,
  Layers,
  Calendar,
  FileText,
  Building2,
  CheckCircle2,
  AlertCircle,
  X,
  Boxes,
  Pencil,
  FileSpreadsheet,
} from 'lucide-react';

interface InwardItem {
  id: string;
  sNo: number;
  entryType: 'KORA' | 'DYED' | string;
  itemName: string;
  billNo: string;
  billDate: string;
  receivingDate: string;
  billQty: number;
  unit: 'MTR' | 'PCS' | string;
  colour?: string | null;
  supplierName?: string | null;
  remarks?: string | null;
  createdAt: string;
}

interface InwardLine {
  key: string;
  itemName: string;
  colour: string;
  billQty: string;
  unit: 'MTR' | 'PCS';
}

const createInwardLine = (seed: Partial<InwardLine> = {}): InwardLine => ({
  key: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  itemName: '',
  colour: '',
  billQty: '',
  unit: 'MTR',
  ...seed,
});

const createEmptyFormData = () => ({
  entryType: 'UNDYED',
  billNo: '',
  billDate: new Date().toISOString().split('T')[0],
  receivingDate: new Date().toISOString().split('T')[0],
  supplierName: '',
  remarks: '',
  lines: [createInwardLine()],
});

export default function InwardStockPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<InwardItem[]>([]);
  const [summary, setSummary] = useState({
    totalEntries: 0,
    totalMeters: 0,
    totalPcs: 0,
    undyedMeters: 0,
    koraMeters: 0,
    dyedMeters: 0,
  });

  const [typeFilter, setTypeFilter] = useState<'ALL' | 'UNDYED' | 'DYED' | 'KORA'>('ALL');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form State
  const [formData, setFormData] = useState(createEmptyFormData);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (typeFilter !== 'ALL') params.set('entryType', typeFilter);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/fabric-store/inward?${params.toString()}`);
      const json = await res.json();
      if (res.ok) {
        setItems(json.data || []);
        if (json.summary) setSummary(json.summary);
      }
    } catch (err) {
      console.error('Failed to load inward stock:', err);
    } finally {
      setLoading(false);
    }
  };

  // A receipt link opens this page filtered to that import (?search=FSR-...).
  const [searchReady, setSearchReady] = useState(false);
  useEffect(() => {
    try {
      const initial = new URLSearchParams(window.location.search).get('search');
      if (initial) setSearch(initial);
    } catch {}
    setSearchReady(true);
  }, []);

  useEffect(() => {
    if (searchReady) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, searchReady]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleCreateInward = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      if (!formData.billNo.trim()) {
        throw new Error('Bill No. is required.');
      }
      const lines = formData.lines.filter((line) => line.itemName.trim() || line.colour.trim() || line.billQty);
      if (lines.length === 0) {
        throw new Error('Add at least one fabric line.');
      }
      const invalidLine = lines.findIndex((line) => !line.itemName.trim() || !(Number(line.billQty) > 0));
      if (invalidLine >= 0) {
        throw new Error(`Line ${invalidLine + 1}: enter the fabric name and a quantity greater than zero.`);
      }

      const { lines: _lines, ...header } = formData;
      const payloadLines = lines.map(({ itemName, colour, billQty, unit }) => ({
        itemName: itemName.trim(),
        colour: colour.trim() || null,
        billQty: Number(billQty),
        unit,
      }));
      const res = await fetch(
        editingItemId ? `/api/fabric-store/inward/${editingItemId}` : '/api/fabric-store/inward',
        {
          method: editingItemId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editingItemId ? { ...header, ...payloadLines[0] } : { ...header, lines: payloadLines }),
        }
      );

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Failed to ${editingItemId ? 'update' : 'save'} inward stock`);
      }

      setSuccessMsg(
        editingItemId
          ? `Inward record for "${payloadLines[0].itemName}" updated.`
          : `Bill ${formData.billNo.trim()}: ${payloadLines.length} inward line${payloadLines.length === 1 ? '' : 's'} saved.`
      );
      setModalOpen(false);
      setEditingItemId(null);
      setFormData(createEmptyFormData());
      loadData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setFormError(err.message || 'Error creating inward record');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditInward = (item: InwardItem) => {
    setEditingItemId(item.id);
    setFormError('');
    setFormData({
      entryType: item.entryType === 'DYED' ? 'DYED' : 'UNDYED',
      billNo: item.billNo,
      billDate: new Date(item.billDate).toISOString().split('T')[0],
      receivingDate: new Date(item.receivingDate).toISOString().split('T')[0],
      supplierName: item.supplierName || '',
      remarks: item.remarks || '',
      lines: [
        createInwardLine({
          itemName: item.itemName,
          colour: item.colour || '',
          billQty: String(item.billQty),
          unit: item.unit === 'PCS' ? 'PCS' : 'MTR',
        }),
      ],
    });
    setModalOpen(true);
  };

  const updateLine = (key: string, patch: Partial<InwardLine>) => {
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    }));
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingItemId(null);
    setFormError('');
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-brand-50 pb-16">
      {/* HEADER */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-30 px-4 sm:px-8 py-3.5 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700">
                FABRIC STORE
              </span>
              <span className="text-neutral-700">/</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                INVENTORY
              </span>
            </div>
            <h1 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
              <ArrowDownToLine className="w-5 h-5 text-accent-700" />
              <span>Inward Stock</span>
            </h1>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Any new fabric arrives in store that should be in Inward stock
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/fabric-store/inventory/import"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-brand-300 text-brand-800 hover:bg-brand-50 rounded-lg text-xs font-bold"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Import Fabric Stock</span>
            </Link>
            <button
              onClick={() => {
                setEditingItemId(null);
                setFormError('');
                setFormData(createEmptyFormData());
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Fabric Arrival</span>
            </button>
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition"
              title="Refresh Inward Stock"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {/* SUCCESS NOTIFICATION */}
        {successMsg && (
          <div className="p-3.5 bg-accent-50 border border-accent-200 rounded-xl text-xs text-accent-800 flex items-center gap-2.5 shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-accent-700 shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}

        {/* SUMMARY TILES */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
              TOTAL INWARD (METERS)
            </span>
            <div className="text-2xl font-black text-neutral-900 mt-1">
              {summary.totalMeters.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              <span className="text-xs font-semibold text-neutral-500 ml-1">MTR</span>
            </div>
            <span className="text-[10px] text-neutral-500 mt-0.5 block">
              {summary.totalEntries} arrival records received
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-700 block">
                1. UNDYED RECEIVED
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-accent-100 text-accent-800">
                UNDYED
              </span>
            </div>
            <div className="text-2xl font-black text-neutral-900 mt-1">
              {(summary.undyedMeters || summary.koraMeters || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              <span className="text-xs font-semibold text-accent-800 ml-1">MTR</span>
            </div>
            <span className="text-[10px] text-accent-800 mt-0.5 block">
              Raw undyed fabric for dyeing
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700 block">
                2. DYED RECEIVED
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-brand-100 text-brand-900">
                DYED
              </span>
            </div>
            <div className="text-2xl font-black text-brand-900 mt-1">
              {summary.dyedMeters.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              <span className="text-xs font-semibold text-brand-700 ml-1">MTR</span>
            </div>
            <span className="text-[10px] text-brand-700 mt-0.5 block">
              Pre-dyed / direct store lots
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700 block">
              TOTAL INWARD (PIECES)
            </span>
            <div className="text-2xl font-black text-brand-900 mt-1">
              {summary.totalPcs.toLocaleString('en-IN')}
              <span className="text-xs font-semibold text-brand-700 ml-1">PCS</span>
            </div>
            <span className="text-[10px] text-brand-700 mt-0.5 block">
              Piece-unit based fabric items
            </span>
          </div>
        </div>

        {/* CONTROLS: FILTER BUTTONS & SEARCH */}
        <div className="bg-white p-3.5 rounded-xl border border-neutral-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-neutral-500 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Type:</span>
            </span>
            <button
              type="button"
              onClick={() => setTypeFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                typeFilter === 'ALL'
                  ? 'bg-brand-600 text-white'
                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
              }`}
            >
              All Inward
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('UNDYED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                typeFilter === 'UNDYED'
                  ? 'bg-accent-500 text-neutral-900'
                  : 'bg-accent-50 hover:bg-accent-100 text-accent-800 border border-accent-200'
              }`}
            >
              1. UNDYED
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('DYED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                typeFilter === 'DYED'
                  ? 'bg-brand-700 text-white'
                  : 'bg-brand-50 hover:bg-brand-100 text-brand-900 border border-brand-200'
              }`}
            >
              2. DYED
            </button>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Item, Colour, Bill No..."
                className="pl-8 pr-3 py-1.5 border border-neutral-300 rounded-lg text-xs w-48 sm:w-64 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 text-xs font-bold rounded-lg border border-neutral-300 transition"
            >
              Search
            </button>
          </form>
        </div>

        {/* INWARD STOCK TABLE (Matches user's handwritten fields exactly) */}
        <div className="bg-white rounded-xl border-[1.5px] border-neutral-200 shadow-xs overflow-hidden">
          <div className="px-5 py-3 border-b-[1.5px] border-neutral-200 bg-neutral-50 flex items-center justify-between">
            <span className="font-black text-xs uppercase tracking-wider text-neutral-900">
              INWARD STOCK TABLE ({items.length} ENTRIES)
            </span>
            <span className="text-[11px] font-semibold text-neutral-500">
              Real-time store receiving ledger
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-neutral-100 border-b-[1.5px] border-neutral-200 text-neutral-900">
                  <th className="border-r-[1.5px] border-neutral-200 px-3 py-2 font-black text-center w-14">
                    S.NO
                  </th>
                  <th className="border-r-[1.5px] border-neutral-200 px-3 py-2 font-black w-28 text-center">
                    ENTRY TYPE
                  </th>
                  <th className="border-r-[1.5px] border-neutral-200 px-4 py-2 font-black">
                    ITEM NAME
                  </th>
                  <th className="border-r-[1.5px] border-neutral-200 px-3 py-2 font-black w-28">
                    COLOUR
                  </th>
                  <th className="border-r-[1.5px] border-neutral-200 px-3 py-2 font-black w-32">
                    BILL NO.
                  </th>
                  <th className="border-r-[1.5px] border-neutral-200 px-3 py-2 font-black w-28 text-center">
                    BILL DATE
                  </th>
                  <th className="border-r-[1.5px] border-neutral-200 px-3 py-2 font-black w-32 text-center">
                    RECEIVING DATE
                  </th>
                  <th className="border-r-[1.5px] border-neutral-200 px-4 py-2 font-black w-36 text-right">
                    BILL QTY (MTR/PCS)
                  </th>
                  <th className="px-4 py-2 font-black">
                    SUPPLIER / REMARKS
                  </th>
                  <th className="px-3 py-2 font-black text-center w-20">
                    ACTION
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-neutral-500 space-y-2">
                      <ArrowDownToLine className="w-8 h-8 mx-auto text-neutral-700" />
                      <div className="text-sm font-bold text-neutral-700">No inward records found</div>
                      <p className="text-xs text-neutral-500">
                        Click &ldquo;+ New Fabric Arrival&rdquo; above to log the first arriving fabric lot.
                      </p>
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => (
                    <tr key={item.id} className="hover:bg-brand-50/40 transition h-10">
                      <td className="border-r-[1.5px] border-neutral-200 px-3 py-2 text-center font-bold font-mono text-neutral-700">
                        {item.sNo ?? index + 1}
                      </td>
                      <td className="border-r-[1.5px] border-neutral-200 px-3 py-2 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-black tracking-wider uppercase ${
                            item.entryType === 'UNDYED' || item.entryType === 'KORA'
                              ? 'bg-accent-100 text-accent-800 border border-accent-300'
                              : 'bg-brand-100 text-brand-900 border border-brand-300'
                          }`}
                        >
                          {item.entryType === 'UNDYED' || item.entryType === 'KORA' ? 'UNDYED' : 'DYED'}
                        </span>
                      </td>
                      <td className="border-r-[1.5px] border-neutral-200 px-4 py-2 font-bold text-neutral-900">
                        {item.itemName}
                      </td>
                      <td className="border-r-[1.5px] border-neutral-200 px-3 py-2 text-neutral-900">
                        {item.colour || <span className="text-neutral-500 italic">Not recorded</span>}
                      </td>
                      <td className="border-r-[1.5px] border-neutral-200 px-3 py-2 font-mono font-bold text-neutral-900">
                        {item.billNo}
                      </td>
                      <td className="border-r-[1.5px] border-neutral-200 px-3 py-2 text-center font-medium text-neutral-700">
                        {formatDate(item.billDate)}
                      </td>
                      <td className="border-r-[1.5px] border-neutral-200 px-3 py-2 text-center font-bold text-brand-900">
                        {formatDate(item.receivingDate)}
                      </td>
                      <td className="border-r-[1.5px] border-neutral-200 px-4 py-2 text-right font-black text-sm text-neutral-900">
                        {Number(item.billQty).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        <span className="text-xs font-bold text-neutral-500 ml-1">
                          {item.unit || 'MTR'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-neutral-600 text-xs">
                        <div className="font-semibold text-neutral-900">{item.supplierName || '—'}</div>
                        {item.remarks && <div className="text-[11px] text-neutral-500 truncate max-w-xs">{item.remarks}</div>}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleEditInward(item)}
                          aria-label={`Edit inward record ${item.billNo}`}
                          title="Edit inward record"
                          className="inline-flex items-center gap-1 rounded-md border border-brand-200 px-2 py-1 text-[11px] font-bold text-brand-800 hover:bg-brand-50 transition"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* MODAL: CREATE OR EDIT FABRIC ARRIVAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 backdrop-blur-xs p-3 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-neutral-300 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowDownToLine className="w-5 h-5 text-accent-700" />
                <h3 className="font-black text-sm text-neutral-900 uppercase tracking-wide">
                  {editingItemId ? 'Edit Inward Entry' : 'New Fabric Arrival (Inward Entry)'}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-neutral-500 hover:text-neutral-700 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateInward} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-xs text-danger-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-danger-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Entry Type */}
              <div>
                <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                  ENTRY TYPE *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, entryType: 'UNDYED' }))}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border text-center transition cursor-pointer ${
                      formData.entryType === 'UNDYED' || formData.entryType === 'KORA'
                        ? 'bg-accent-50 border-accent-500 text-accent-800 font-black ring-1 ring-accent-500'
                        : 'bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    1. UNDYED FABRIC
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, entryType: 'DYED' }))}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border text-center transition cursor-pointer ${
                      formData.entryType === 'DYED'
                        ? 'bg-brand-50 border-brand-500 text-brand-900 font-black ring-1 ring-brand-500'
                        : 'bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    2. DYED FABRIC
                  </button>
                </div>
              </div>

              {/* Bill No & Bill Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                    BILL NO. *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.billNo}
                    onChange={(e) => setFormData((prev) => ({ ...prev, billNo: e.target.value }))}
                    placeholder="e.g. INV-90214"
                    className="w-full h-10 px-3 border-[1.5px] border-neutral-200 rounded-lg text-xs font-bold text-neutral-900 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                    BILL DATE *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.billDate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, billDate: e.target.value }))}
                    className="w-full h-10 px-3 border-[1.5px] border-neutral-200 rounded-lg text-xs font-bold text-neutral-900 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                  />
                </div>
              </div>

              {/* Receiving Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                    RECEIVING DATE *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.receivingDate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, receivingDate: e.target.value }))}
                    className="w-full h-10 px-3 border-[1.5px] border-neutral-200 rounded-lg text-xs font-bold text-neutral-900 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                  />
                </div>
              </div>

              {/* Fabric lines: each keeps its own colour, quantity and unit; MTR and PCS are never combined */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-black uppercase text-neutral-700">
                    FABRIC LINES *
                  </label>
                  {!editingItemId && (
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, lines: [...prev.lines, createInwardLine({ unit: prev.lines[prev.lines.length - 1]?.unit || 'MTR' })] }))}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-brand-200 text-[11px] font-bold text-brand-800 hover:bg-brand-50 transition"
                    >
                      <Plus className="w-3 h-3" />
                      Add line
                    </button>
                  )}
                </div>
                <div className="border border-neutral-200 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-[1fr_7rem_6rem_5.5rem_2rem] gap-2 px-2 py-1.5 bg-neutral-50 text-[10px] font-black uppercase text-neutral-500">
                    <span>Item name (fabric)</span>
                    <span>Colour</span>
                    <span className="text-right">Qty</span>
                    <span>Unit</span>
                    <span />
                  </div>
                  {formData.lines.map((line, idx) => (
                    <div key={line.key} className="grid grid-cols-[1fr_7rem_6rem_5.5rem_2rem] gap-2 px-2 py-1.5 border-t border-neutral-200 items-center">
                      <input
                        type="text"
                        value={line.itemName}
                        onChange={(e) => updateLine(line.key, { itemName: e.target.value })}
                        placeholder="e.g. Cotton 60x60 Cambric"
                        aria-label={`Line ${idx + 1} item name`}
                        className="h-8 px-2 border border-neutral-300 rounded-md text-xs font-bold text-neutral-900 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                      />
                      <input
                        type="text"
                        value={line.colour}
                        onChange={(e) => updateLine(line.key, { colour: e.target.value })}
                        placeholder="e.g. Off White"
                        aria-label={`Line ${idx + 1} colour`}
                        className="h-8 px-2 border border-neutral-300 rounded-md text-xs text-neutral-900 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={line.billQty}
                        onChange={(e) => updateLine(line.key, { billQty: e.target.value })}
                        placeholder="0.00"
                        aria-label={`Line ${idx + 1} quantity`}
                        className="h-8 px-2 border border-neutral-300 rounded-md text-xs font-black text-right text-neutral-900 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                      />
                      <select
                        value={line.unit}
                        onChange={(e) => updateLine(line.key, { unit: e.target.value === 'PCS' ? 'PCS' : 'MTR' })}
                        aria-label={`Line ${idx + 1} unit`}
                        className="h-8 px-1.5 border border-neutral-300 rounded-md text-xs font-bold text-neutral-900 bg-white focus:outline-none"
                      >
                        <option value="MTR">MTR</option>
                        <option value="PCS">PCS</option>
                      </select>
                      <button
                        type="button"
                        disabled={formData.lines.length === 1}
                        onClick={() => setFormData((prev) => ({ ...prev, lines: prev.lines.filter((l) => l.key !== line.key) }))}
                        title="Remove line"
                        aria-label={`Remove line ${idx + 1}`}
                        className="h-8 w-8 flex items-center justify-center rounded-md text-neutral-500 hover:text-danger-700 hover:bg-danger-50 disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-neutral-500 mt-1">
                  Meters and pieces are stocked separately and never converted.
                </p>
              </div>

              {/* Supplier Name */}
              <div>
                <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                  SUPPLIER / MILL NAME
                </label>
                <input
                  type="text"
                  value={formData.supplierName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, supplierName: e.target.value }))}
                  placeholder="e.g. Vardhman Textiles, Arvind Mills"
                  className="w-full h-10 px-3 border border-neutral-300 rounded-lg text-xs font-bold text-neutral-900 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                />
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                  REMARKS / NOTE
                </label>
                <textarea
                  rows={2}
                  value={formData.remarks}
                  onChange={(e) => setFormData((prev) => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Optional notes, lot details, quality check remarks..."
                  className="w-full p-2.5 border border-neutral-300 rounded-lg text-xs font-sans text-neutral-900 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white resize-none"
                />
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-neutral-300 text-neutral-700 text-xs font-semibold rounded-lg hover:bg-neutral-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submitting
                    ? editingItemId
                      ? 'Updating...'
                      : 'Saving...'
                    : editingItemId
                      ? 'Save Changes'
                      : 'Confirm Inward Arrival'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
