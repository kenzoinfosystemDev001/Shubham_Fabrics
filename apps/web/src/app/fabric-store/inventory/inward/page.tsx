'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowDownToLine,
  Plus,
  RefreshCw,
  Search,
  Layers,
  Calendar,
  FileText,
  Building2,
  CheckCircle2,
  AlertCircle,
  X,
  Boxes,
  Pencil,
  UploadCloud,
} from 'lucide-react';
import StockImportModal from '@/components/fabric-store/StockImportModal';

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
  const [importOpen, setImportOpen] = useState(false);
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

  const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

  const summaryCards = [
    { label: 'Total Inward', value: summary.totalMeters, unit: 'MTR', tone: 'bg-brand-50 text-brand-700', icon: ArrowDownToLine, note: `${summary.totalEntries} entries` },
    { label: 'Undyed', value: summary.undyedMeters || summary.koraMeters || 0, unit: 'MTR', tone: 'bg-accent-100 text-neutral-900', icon: Layers },
    { label: 'Dyed', value: summary.dyedMeters, unit: 'MTR', tone: 'bg-brand-50 text-brand-700', icon: Layers },
    { label: 'Pieces', value: summary.totalPcs, unit: 'PCS', tone: 'bg-neutral-100 text-neutral-700', icon: Boxes },
  ];

  const tabs = [
    { id: 'ALL', label: 'All' },
    { id: 'UNDYED', label: 'Undyed' },
    { id: 'DYED', label: 'Dyed' },
  ] as const;

  const th = 'py-3 px-4 whitespace-nowrap';

  const openNewArrival = () => {
    setEditingItemId(null);
    setFormError('');
    setFormData(createEmptyFormData());
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-canvas pb-16">
      {/* HEADER */}
      <header className="bg-white/90 backdrop-blur border-b border-neutral-200 sticky top-0 z-30 px-4 sm:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-neutral-900">Inward Stock</h1>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition"
              title="Refresh"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-accent-300 hover:bg-accent-400 text-neutral-900 text-xs font-semibold rounded-lg shadow-xs border border-accent-500/40 transition cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Stock Sheet</span>
            </button>
            <button
              onClick={openNewArrival}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Fabric Arrival</span>
            </button>
          </div>
        </div>
      </header>

      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {/* SUCCESS NOTIFICATION */}
        {successMsg && (
          <div className="px-4 py-3 bg-white border border-accent-300 rounded-xl text-sm text-neutral-900 flex items-center gap-2.5 shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-accent-700 shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
        )}

        {/* SUMMARY */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {summaryCards.map((card) => (
            <div key={card.label} className="bg-white border border-neutral-200 rounded-2xl p-4 sm:p-5 shadow-xs">
              <div className="flex items-center gap-2.5">
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${card.tone}`}>
                  <card.icon className="w-4 h-4" />
                </span>
                <span className="text-xs font-semibold text-neutral-600">{card.label}</span>
              </div>
              <p className="mt-3 text-2xl font-bold text-neutral-900 tabular-nums leading-none">
                {fmt(card.value)}
                <span className="text-xs font-semibold text-neutral-500 ml-1">{card.unit}</span>
              </p>
              {card.note && <p className="mt-2 text-[11px] text-neutral-500">{card.note}</p>}
            </div>
          ))}
        </section>

        {/* INWARD TABLE */}
        <section className="bg-white border border-neutral-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold text-neutral-900">Entries</h2>
              <span className="text-[11px] font-semibold tabular-nums bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">
                {items.length}
              </span>
              <div role="tablist" aria-label="Type" className="inline-flex p-0.5 bg-neutral-100 rounded-lg ml-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={typeFilter === tab.id}
                    onClick={() => setTypeFilter(tab.id)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                      typeFilter === tab.id ? 'bg-white text-brand-800 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search fabric, colour or bill no."
                aria-label="Search inward entries"
                className="h-9 w-full md:w-72 pl-9 pr-3 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition"
              />
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className={`${th} w-12`}>#</th>
                  <th className={th}>Type</th>
                  <th className={th}>Fabric</th>
                  <th className={th}>Colour</th>
                  <th className={th}>Bill No.</th>
                  <th className={th}>Bill Date</th>
                  <th className={th}>Received</th>
                  <th className={`${th} text-right`}>Quantity</th>
                  <th className={th}>Supplier</th>
                  <th className={th}>
                    <span className="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-14 text-center">
                      <ArrowDownToLine className="w-8 h-8 mx-auto text-neutral-300" />
                      <p className="text-sm font-medium text-neutral-500 mt-3">{loading ? 'Loading…' : 'No inward entries yet'}</p>
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => {
                    const isUndyed = item.entryType === 'UNDYED' || item.entryType === 'KORA';
                    return (
                      <tr key={item.id} className="hover:bg-neutral-50/60 transition">
                        <td className="py-3 px-4 text-xs font-semibold text-neutral-400 tabular-nums">{item.sNo ?? index + 1}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                              isUndyed ? 'bg-accent-100 text-neutral-900' : 'bg-brand-50 text-brand-800'
                            }`}
                          >
                            {isUndyed ? 'Undyed' : 'Dyed'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-neutral-900">{item.itemName}</td>
                        <td className="py-3 px-4 text-neutral-700">{item.colour || <span className="text-neutral-400">—</span>}</td>
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-neutral-900">{item.billNo}</td>
                        <td className="py-3 px-4 text-xs text-neutral-500 whitespace-nowrap">{formatDate(item.billDate)}</td>
                        <td className="py-3 px-4 text-xs text-neutral-700 whitespace-nowrap">{formatDate(item.receivingDate)}</td>
                        <td className="py-3 px-4 text-right tabular-nums whitespace-nowrap">
                          <span className="font-bold text-neutral-900">{fmt(Number(item.billQty))}</span>{' '}
                          <span className="text-[11px] font-semibold text-neutral-400">{item.unit || 'MTR'}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-neutral-900">{item.supplierName || <span className="text-neutral-400">—</span>}</div>
                          {item.remarks && <div className="text-[11px] text-neutral-500 truncate max-w-[14rem]">{item.remarks}</div>}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleEditInward(item)}
                            aria-label={`Edit inward record ${item.billNo}`}
                            title="Edit"
                            className="p-2 text-neutral-400 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <StockImportModal
        open={importOpen}
        onClose={() => {
          setImportOpen(false);
          loadData();
        }}
        onImported={(message) => {
          setSuccessMsg(message);
          loadData();
          setTimeout(() => setSuccessMsg(''), 6000);
        }}
        onManualEntry={openNewArrival}
      />

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
