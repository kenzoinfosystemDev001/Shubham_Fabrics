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
} from 'lucide-react';

interface InwardItem {
  id: string;
  sNo: number;
  entryType: 'KORA' | 'DYED' | string;
  itemName: string;
  color?: string | null;
  billNo: string;
  billDate: string;
  receivingDate: string;
  billQty: number;
  unit: 'MTR' | 'PCS' | string;
  supplierName?: string | null;
  remarks?: string | null;
  createdAt: string;
}

const createEmptyFormData = () => ({
  billNo: '',
  billDate: new Date().toISOString().split('T')[0],
  receivingDate: new Date().toISOString().split('T')[0],
  supplierName: '',
  remarks: '',
});

// One bill can bring several fabrics / colours; every line keeps its own unit (MTR or PCS).
interface InwardLine {
  key: string;
  entryType: 'UNDYED' | 'DYED';
  itemName: string;
  color: string;
  billQty: string;
  unit: 'MTR' | 'PCS';
}

const createEmptyLine = (base?: Partial<InwardLine>): InwardLine => ({
  key: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  entryType: base?.entryType || 'UNDYED',
  itemName: base?.itemName || '',
  color: '',
  billQty: '',
  unit: base?.unit || 'MTR',
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
    undyedPcs: 0,
    dyedPcs: 0,
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
  const [lines, setLines] = useState<InwardLine[]>(() => [createEmptyLine()]);

  const updateLine = (key: string, patch: Partial<InwardLine>) => {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

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

  useEffect(() => {
    loadData();
  }, [typeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleCreateInward = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      if (!formData.billNo) {
        throw new Error('Please fill all required fields (Bill No.).');
      }
      const incompleteIndex = lines.findIndex((line) => !line.itemName.trim() || !(Number(line.billQty) > 0));
      if (incompleteIndex >= 0) {
        throw new Error(`Line ${incompleteIndex + 1}: enter the Item Name and a Bill Qty greater than 0.`);
      }

      const payloadLines = lines.map(({ key, ...line }) => ({ ...line, itemName: line.itemName.trim(), color: line.color.trim() }));
      const res = await fetch(
        editingItemId ? `/api/fabric-store/inward/${editingItemId}` : '/api/fabric-store/inward',
        {
          method: editingItemId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editingItemId ? { ...formData, ...payloadLines[0] } : { ...formData, items: payloadLines }),
        }
      );

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Failed to ${editingItemId ? 'update' : 'save'} inward stock`);
      }

      setSuccessMsg(
        lines.length > 1
          ? `${lines.length} inward lines for bill "${formData.billNo}" saved successfully!`
          : `Inward record for "${lines[0].itemName}" ${editingItemId ? 'updated' : 'saved'} successfully!`
      );
      setModalOpen(false);
      setEditingItemId(null);
      setFormData(createEmptyFormData());
      setLines([createEmptyLine()]);
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
      billNo: item.billNo,
      billDate: new Date(item.billDate).toISOString().split('T')[0],
      receivingDate: new Date(item.receivingDate).toISOString().split('T')[0],
      supplierName: item.supplierName || '',
      remarks: item.remarks || '',
    });
    setLines([{
      key: item.id,
      entryType: item.entryType === 'DYED' ? 'DYED' : 'UNDYED',
      itemName: item.itemName,
      color: item.color || '',
      billQty: String(item.billQty),
      unit: item.unit === 'PCS' ? 'PCS' : 'MTR',
    }]);
    setModalOpen(true);
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
    <div className="min-h-screen bg-ink-50 pb-16">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-8 py-3.5 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700">
                FABRIC STORE
              </span>
              <span className="text-slate-300">/</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                INVENTORY
              </span>
            </div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ArrowDownToLine className="w-5 h-5 text-emerald-600" />
              <span>Inward Stock</span>
            </h1>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Any new fabric arrives in store that should be in Inward stock
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                setEditingItemId(null);
                setFormError('');
                setFormData(createEmptyFormData());
                setLines([createEmptyLine()]);
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-lavender-600 hover:bg-lavender-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Fabric Arrival</span>
            </button>
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
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
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2.5 shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}

        {/* SUMMARY TILES */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              TOTAL INWARD (METERS)
            </span>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {summary.totalMeters.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              <span className="text-xs font-semibold text-slate-500 ml-1">MTR</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              {summary.totalEntries} arrival records received
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
                1. UNDYED RECEIVED
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-900">
                UNDYED
              </span>
            </div>
            <div className="text-2xl font-black text-amber-900 mt-1">
              {(summary.undyedMeters || summary.koraMeters || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              <span className="text-xs font-semibold text-amber-700 ml-1">MTR</span>
            </div>
            <span className="text-[10px] text-amber-700/80 mt-0.5 block">
              {(summary.undyedPcs || 0).toLocaleString('en-IN')} PCS &middot; raw undyed fabric for dyeing
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block">
                2. DYED RECEIVED
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-purple-100 text-purple-900">
                DYED
              </span>
            </div>
            <div className="text-2xl font-black text-purple-900 mt-1">
              {summary.dyedMeters.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              <span className="text-xs font-semibold text-purple-700 ml-1">MTR</span>
            </div>
            <span className="text-[10px] text-purple-700/80 mt-0.5 block">
              {(summary.dyedPcs || 0).toLocaleString('en-IN')} PCS &middot; pre-dyed / direct store lots
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 block">
              TOTAL INWARD (PIECES)
            </span>
            <div className="text-2xl font-black text-teal-900 mt-1">
              {summary.totalPcs.toLocaleString('en-IN')}
              <span className="text-xs font-semibold text-teal-700 ml-1">PCS</span>
            </div>
            <span className="text-[10px] text-teal-700/80 mt-0.5 block">
              Piece-unit based fabric items
            </span>
          </div>
        </div>

        {/* CONTROLS: FILTER BUTTONS & SEARCH */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Type:</span>
            </span>
            <button
              type="button"
              onClick={() => setTypeFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                typeFilter === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              All Inward
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('UNDYED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                typeFilter === 'UNDYED'
                  ? 'bg-lavender-700 text-white'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
              }`}
            >
              1. UNDYED
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('DYED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                typeFilter === 'DYED'
                  ? 'bg-purple-700 text-white'
                  : 'bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200'
              }`}
            >
              2. DYED
            </button>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Item, Colour, Bill No..."
                className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs w-48 sm:w-64 focus:outline-none focus:ring-1 focus:ring-lavender-600 bg-white"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg border border-slate-300 transition"
            >
              Search
            </button>
          </form>
        </div>

        {/* INWARD STOCK TABLE (Matches user's handwritten fields exactly) */}
        <div className="bg-white rounded-xl border-[1.5px] border-black shadow-xs overflow-hidden">
          <div className="px-5 py-3 border-b-[1.5px] border-black bg-slate-50 flex items-center justify-between">
            <span className="font-black text-xs uppercase tracking-wider text-slate-900">
              INWARD STOCK TABLE ({items.length} ENTRIES)
            </span>
            <span className="text-[11px] font-semibold text-slate-500">
              Real-time store receiving ledger
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-100 border-b-[1.5px] border-black text-slate-800">
                  <th className="border-r-[1.5px] border-black px-3 py-2 font-black text-center w-14">
                    S.NO
                  </th>
                  <th className="border-r-[1.5px] border-black px-3 py-2 font-black w-28 text-center">
                    ENTRY TYPE
                  </th>
                  <th className="border-r-[1.5px] border-black px-4 py-2 font-black">
                    ITEM NAME
                  </th>
                  <th className="border-r-[1.5px] border-black px-3 py-2 font-black w-28">
                    COLOUR
                  </th>
                  <th className="border-r-[1.5px] border-black px-3 py-2 font-black w-32">
                    BILL NO.
                  </th>
                  <th className="border-r-[1.5px] border-black px-3 py-2 font-black w-28 text-center">
                    BILL DATE
                  </th>
                  <th className="border-r-[1.5px] border-black px-3 py-2 font-black w-32 text-center">
                    RECEIVING DATE
                  </th>
                  <th className="border-r-[1.5px] border-black px-4 py-2 font-black w-36 text-right">
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
              <tbody className="divide-y divide-slate-200">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-slate-500 space-y-2">
                      <ArrowDownToLine className="w-8 h-8 mx-auto text-slate-300" />
                      <div className="text-sm font-bold text-slate-700">No inward records found</div>
                      <p className="text-xs text-slate-400">
                        Click &ldquo;+ New Fabric Arrival&rdquo; above to log the first arriving fabric lot.
                      </p>
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => (
                    <tr key={item.id} className="hover:bg-teal-50/40 transition h-10">
                      <td className="border-r-[1.5px] border-black px-3 py-2 text-center font-bold font-mono text-slate-700">
                        {item.sNo ?? index + 1}
                      </td>
                      <td className="border-r-[1.5px] border-black px-3 py-2 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-black tracking-wider uppercase ${
                            item.entryType === 'UNDYED' || item.entryType === 'KORA'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-purple-100 text-purple-900 border border-purple-300'
                          }`}
                        >
                          {item.entryType === 'UNDYED' || item.entryType === 'KORA' ? 'UNDYED' : 'DYED'}
                        </span>
                      </td>
                      <td className="border-r-[1.5px] border-black px-4 py-2 font-bold text-slate-900">
                        {item.itemName}
                      </td>
                      <td className="border-r-[1.5px] border-black px-3 py-2 font-semibold text-slate-800">
                        {item.color || <span className="text-slate-400 font-normal">—</span>}
                      </td>
                      <td className="border-r-[1.5px] border-black px-3 py-2 font-mono font-bold text-slate-800">
                        {item.billNo}
                      </td>
                      <td className="border-r-[1.5px] border-black px-3 py-2 text-center font-medium text-slate-700">
                        {formatDate(item.billDate)}
                      </td>
                      <td className="border-r-[1.5px] border-black px-3 py-2 text-center font-bold text-teal-900">
                        {formatDate(item.receivingDate)}
                      </td>
                      <td className="border-r-[1.5px] border-black px-4 py-2 text-right font-black text-sm text-slate-900">
                        {Number(item.billQty).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        <span className="text-xs font-bold text-slate-500 ml-1">
                          {item.unit || 'MTR'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-600 text-xs">
                        <div className="font-semibold text-slate-800">{item.supplierName || '—'}</div>
                        {item.remarks && <div className="text-[11px] text-slate-500 truncate max-w-xs">{item.remarks}</div>}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleEditInward(item)}
                          aria-label={`Edit inward record ${item.billNo}`}
                          title="Edit inward record"
                          className="inline-flex items-center gap-1 rounded-md border border-teal-200 px-2 py-1 text-[11px] font-bold text-teal-800 hover:bg-teal-50 transition"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowDownToLine className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-sm text-slate-900 uppercase tracking-wide">
                  {editingItemId ? 'Edit Inward Entry' : 'New Fabric Arrival (Inward Entry)'}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateInward} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Bill No, Bill Date & Receiving Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    BILL NO. *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.billNo}
                    onChange={(e) => setFormData((prev) => ({ ...prev, billNo: e.target.value }))}
                    placeholder="e.g. INV-90214"
                    className="w-full h-10 px-3 border-[1.5px] border-black rounded-lg text-xs font-bold text-black focus:outline-none focus:ring-1 focus:ring-lavender-600 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    BILL DATE *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.billDate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, billDate: e.target.value }))}
                    className="w-full h-10 px-3 border-[1.5px] border-black rounded-lg text-xs font-bold text-black focus:outline-none focus:ring-1 focus:ring-lavender-600 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    RECEIVING DATE *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.receivingDate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, receivingDate: e.target.value }))}
                    className="w-full h-10 px-3 border-[1.5px] border-black rounded-lg text-xs font-bold text-black focus:outline-none focus:ring-1 focus:ring-lavender-600 bg-white"
                  />
                </div>
              </div>

              {/* Fabric lines: type, fabric, colour, quantity and unit per line */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black uppercase text-slate-700">
                    FABRIC RECEIVED *
                  </label>
                  {!editingItemId && (
                    <button
                      type="button"
                      onClick={() => setLines((prev) => [...prev, createEmptyLine(prev[prev.length - 1])])}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-lg transition cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Fabric / Colour</span>
                    </button>
                  )}
                </div>
                <div className="border-[1.5px] border-black rounded-lg overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-700">
                      <tr>
                        <th className="px-2 py-1.5 text-left w-32">Entry Type</th>
                        <th className="px-2 py-1.5 text-left">Item Name *</th>
                        <th className="px-2 py-1.5 text-left w-28">Colour</th>
                        <th className="px-2 py-1.5 text-left w-28">Bill Qty *</th>
                        <th className="px-2 py-1.5 text-left w-24">Unit *</th>
                        {!editingItemId && lines.length > 1 && <th className="px-2 py-1.5 w-8" />}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {lines.map((line, index) => (
                        <tr key={line.key}>
                          <td className="px-2 py-1.5">
                            <select
                              value={line.entryType}
                              onChange={(e) => updateLine(line.key, { entryType: e.target.value as InwardLine['entryType'] })}
                              aria-label={`Line ${index + 1} entry type`}
                              className="w-full h-9 px-2 border border-slate-300 rounded-lg text-xs font-bold bg-white"
                            >
                              <option value="UNDYED">UNDYED</option>
                              <option value="DYED">DYED</option>
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="text"
                              required
                              value={line.itemName}
                              onChange={(e) => updateLine(line.key, { itemName: e.target.value })}
                              aria-label={`Line ${index + 1} item name`}
                              placeholder="e.g. Cotton 60x60 Cambric"
                              className="w-full h-9 px-2 border border-slate-300 rounded-lg text-xs font-bold text-black bg-white"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="text"
                              value={line.color}
                              onChange={(e) => updateLine(line.key, { color: e.target.value })}
                              aria-label={`Line ${index + 1} colour`}
                              placeholder="e.g. White"
                              className="w-full h-9 px-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              step="0.01"
                              required
                              min="0.01"
                              value={line.billQty}
                              onChange={(e) => updateLine(line.key, { billQty: e.target.value })}
                              aria-label={`Line ${index + 1} bill quantity`}
                              placeholder="0.00"
                              className="w-full h-9 px-2 border border-slate-300 rounded-lg text-xs font-black text-black bg-white"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <select
                              value={line.unit}
                              onChange={(e) => updateLine(line.key, { unit: e.target.value as InwardLine['unit'] })}
                              aria-label={`Line ${index + 1} unit`}
                              className="w-full h-9 px-2 border border-slate-300 rounded-lg text-xs font-bold bg-white"
                            >
                              <option value="MTR">MTR</option>
                              <option value="PCS">PCS</option>
                            </select>
                          </td>
                          {!editingItemId && lines.length > 1 && (
                            <td className="px-1 py-1.5 text-center">
                              <button
                                type="button"
                                onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                                aria-label={`Remove line ${index + 1}`}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-slate-500">
                  Meters and pieces are stocked separately. Enter the colour so challans deduct from the right colour&apos;s stock.
                </p>
              </div>

              {/* Supplier Name */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                  SUPPLIER / MILL NAME
                </label>
                <input
                  type="text"
                  value={formData.supplierName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, supplierName: e.target.value }))}
                  placeholder="e.g. Vardhman Textiles, Arvind Mills"
                  className="w-full h-10 px-3 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-lavender-600 bg-white"
                />
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                  REMARKS / NOTE
                </label>
                <textarea
                  rows={2}
                  value={formData.remarks}
                  onChange={(e) => setFormData((prev) => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Optional notes, lot details, quality check remarks..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-sans text-slate-800 focus:outline-none focus:ring-1 focus:ring-lavender-600 bg-white resize-none"
                />
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-lavender-600 hover:bg-lavender-700 text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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
