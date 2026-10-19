'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Send,
  RefreshCw,
  Search,
  Filter,
  FileText,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  Plus,
  CheckCircle2,
  X,
  ExternalLink,
} from 'lucide-react';

interface OutwardItem {
  id: string;
  sNo: number;
  source: 'CHALLAN' | 'MANUAL';
  date: string;
  challanNumber: string;
  challanId?: string | null;
  designNumber: string;
  itemName: string;
  issueQty: number;
  unit: string;
  avgPerPcs?: number | null;
  issuePcsQty?: number | null;
  byOrderName: string;
  remarks: string;
  destination: string;
  fabricType: 'KORA' | 'DYED' | string;
  status: string;
}

export default function OutwardStockPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<OutwardItem[]>([]);
  const [summary, setSummary] = useState({
    totalEntries: 0,
    totalMeters: 0,
    totalPcs: 0,
    koraMeters: 0,
    dyedMeters: 0,
  });

  const [typeFilter, setTypeFilter] = useState<'ALL' | 'KORA' | 'DYED'>('ALL');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form State for Manual Outward
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    challanNumber: '',
    designNumber: '',
    itemName: '',
    issueQty: '',
    unit: 'MTR',
    avgPerPcs: '',
    issuePcsQty: '',
    byOrderName: '',
    destination: 'OTHER',
    fabricType: 'DYED',
    remarks: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (typeFilter !== 'ALL') params.set('fabricType', typeFilter);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/fabric-store/outward?${params.toString()}`);
      const json = await res.json();
      if (res.ok) {
        setItems(json.data || []);
        if (json.summary) setSummary(json.summary);
      }
    } catch (err) {
      console.error('Failed to load outward stock:', err);
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

  const handleCreateManualOutward = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      if (!formData.itemName || !formData.issueQty) {
        throw new Error('Item Name and Issue Qty are required.');
      }

      const res = await fetch('/api/fabric-store/outward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to record outward issue');
      }

      setSuccessMsg('Manual outward fabric issue recorded successfully!');
      setModalOpen(false);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        challanNumber: '',
        designNumber: '',
        itemName: '',
        issueQty: '',
        unit: 'MTR',
        avgPerPcs: '',
        issuePcsQty: '',
        byOrderName: '',
        destination: 'OTHER',
        fabricType: 'DYED',
        remarks: '',
      });
      loadData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setFormError(err.message || 'Error recording outward issue');
    } finally {
      setSubmitting(false);
    }
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
    <div className="min-h-screen bg-[#F0FAF9] pb-16">
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
              <Send className="w-5 h-5 text-amber-600" />
              <span>Outward Stock</span>
            </h1>
            <p className="text-[11px] text-slate-500 mt-0.5">
              The outward will update on challan created &middot; Dispatches to Dyeing, Embroidery &amp; other units
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/fabric-store/my-work/challan-to-dyeing"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Issue to Dyeing</span>
            </Link>
            <Link
              href="/fabric-store/my-work/challan-to-embroidery"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-xs transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Issue to Embroidery</span>
            </Link>
            <button
              onClick={() => {
                setFormError('');
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold shadow-2xs transition"
            >
              <Plus className="w-3.5 h-3.5 text-slate-500" />
              <span>Manual Outward</span>
            </button>
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
              title="Refresh Outward Stock"
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
              TOTAL OUTWARD (METERS)
            </span>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {summary.totalMeters.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              <span className="text-xs font-semibold text-slate-500 ml-1">MTR</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              {summary.totalEntries} outward dispatches tracked
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
              KORA OUTWARD TO DYEING
            </span>
            <div className="text-2xl font-black text-amber-900 mt-1">
              {summary.koraMeters.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              <span className="text-xs font-semibold text-amber-700 ml-1">MTR</span>
            </div>
            <span className="text-[10px] text-amber-700/80 mt-0.5 block">
              Grey fabric sent to Dyeing House
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block">
              DYED OUTWARD TO EMBROIDERY
            </span>
            <div className="text-2xl font-black text-purple-900 mt-1">
              {summary.dyedMeters.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              <span className="text-xs font-semibold text-purple-700 ml-1">MTR</span>
            </div>
            <span className="text-[10px] text-purple-700/80 mt-0.5 block">
              Processed fabric issued for embroidery
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 block">
              TOTAL OUTWARD (PIECES)
            </span>
            <div className="text-2xl font-black text-teal-900 mt-1">
              {summary.totalPcs.toLocaleString('en-IN')}
              <span className="text-xs font-semibold text-teal-700 ml-1">PCS</span>
            </div>
            <span className="text-[10px] text-teal-700/80 mt-0.5 block">
              Calculated garment component capacity
            </span>
          </div>
        </div>

        {/* CONTROLS: FILTER BUTTONS & SEARCH */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Category:</span>
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
              All Outward
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('KORA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                typeFilter === 'KORA'
                  ? 'bg-amber-700 text-white'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
              }`}
            >
              Kora (Store &rarr; Dyeing)
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
              Dyed (Store &rarr; Embroidery)
            </button>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Challan, Design, Order..."
                className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs w-48 sm:w-64 focus:outline-none focus:ring-1 focus:ring-teal-600 bg-white"
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

        {/* OUTWARD STOCK TABLE (Matches user's handwritten fields exactly) */}
        <div className="bg-white rounded-xl border-[1.5px] border-black shadow-xs overflow-hidden">
          <div className="px-5 py-3 border-b-[1.5px] border-black bg-slate-50 flex items-center justify-between">
            <span className="font-black text-xs uppercase tracking-wider text-slate-900">
              OUTWARD STOCK TABLE ({items.length} DISPATCHES)
            </span>
            <span className="text-[11px] font-semibold text-slate-500">
              Auto-synced with issued Challans
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-100 border-b-[1.5px] border-black text-slate-800">
                  <th className="border-r-[1.5px] border-black px-2.5 py-2 font-black text-center w-12">
                    S.NO
                  </th>
                  <th className="border-r-[1.5px] border-black px-3 py-2 font-black text-center w-24">
                    DATE
                  </th>
                  <th className="border-r-[1.5px] border-black px-3 py-2 font-black w-32">
                    CHALLAN NO.
                  </th>
                  <th className="border-r-[1.5px] border-black px-3 py-2 font-black w-28">
                    DESIGN NO
                  </th>
                  <th className="border-r-[1.5px] border-black px-3 py-2 font-black">
                    ITEM NAME
                  </th>
                  <th className="border-r-[1.5px] border-black px-3 py-2 font-black text-right w-24">
                    ISSUE QTY
                  </th>
                  <th className="border-r-[1.5px] border-black px-3 py-2 font-black text-right w-24">
                    AVG. PER PCS
                  </th>
                  <th className="border-r-[1.5px] border-black px-3 py-2 font-black text-right w-28">
                    ISSUE PCS QTY
                  </th>
                  <th className="border-r-[1.5px] border-black px-3 py-2 font-black w-36">
                    BY ORDER NAME
                  </th>
                  <th className="px-3 py-2 font-black">
                    REMARKS
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-slate-500 space-y-2">
                      <Send className="w-8 h-8 mx-auto text-slate-300" />
                      <div className="text-sm font-bold text-slate-700">No outward records found</div>
                      <p className="text-xs text-slate-400">
                        When you issue a Challan to Dyeing or Embroidery, it will automatically populate this table.
                      </p>
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => (
                    <tr key={item.id} className="hover:bg-amber-50/40 transition h-10">
                      <td className="border-r-[1.5px] border-black px-2.5 py-2 text-center font-bold font-mono text-slate-700">
                        {item.sNo ?? index + 1}
                      </td>
                      <td className="border-r-[1.5px] border-black px-3 py-2 text-center font-medium text-slate-700 whitespace-nowrap">
                        {formatDate(item.date)}
                      </td>
                      <td className="border-r-[1.5px] border-black px-3 py-2 font-mono font-black text-indigo-900">
                        {item.challanNumber}
                      </td>
                      <td className="border-r-[1.5px] border-black px-3 py-2 font-mono font-bold text-slate-900">
                        {item.designNumber}
                      </td>
                      <td className="border-r-[1.5px] border-black px-3 py-2 font-bold text-slate-900">
                        <div className="truncate max-w-[200px]" title={item.itemName}>
                          {item.itemName}
                        </div>
                      </td>
                      <td className="border-r-[1.5px] border-black px-3 py-2 text-right font-black text-sm text-slate-900">
                        {Number(item.issueQty).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        <span className="text-[10px] font-bold text-slate-500 ml-1">
                          {item.unit || 'MTR'}
                        </span>
                      </td>
                      <td className="border-r-[1.5px] border-black px-3 py-2 text-right font-bold text-slate-700">
                        {item.avgPerPcs ? `${Number(item.avgPerPcs).toFixed(2)} m/pc` : '—'}
                      </td>
                      <td className="border-r-[1.5px] border-black px-3 py-2 text-right font-black text-sm text-teal-900">
                        {item.issuePcsQty ? Number(item.issuePcsQty).toLocaleString('en-IN') : '—'}
                        {item.issuePcsQty ? <span className="text-[10px] font-bold text-slate-500 ml-0.5">PCS</span> : null}
                      </td>
                      <td className="border-r-[1.5px] border-black px-3 py-2 font-semibold text-slate-800">
                        <div className="truncate max-w-[140px]" title={item.byOrderName}>
                          {item.byOrderName}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-600 text-xs">
                        <div className="truncate max-w-xs font-medium text-slate-700" title={item.remarks}>
                          {item.remarks}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* MODAL: MANUAL OUTWARD ISSUE */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-amber-600" />
                <h3 className="font-black text-sm text-slate-900 uppercase tracking-wide">
                  Record Manual Outward Fabric Issue
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateManualOutward} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                  <span>{formError}</span>
                </div>
              )}

              {/* Date & Challan No */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    DATE *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                    className="w-full h-10 px-3 border-[1.5px] border-black rounded-lg text-xs font-bold text-black focus:outline-none focus:ring-1 focus:ring-teal-600 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    CHALLAN NO. (OPTIONAL)
                  </label>
                  <input
                    type="text"
                    value={formData.challanNumber}
                    onChange={(e) => setFormData((prev) => ({ ...prev, challanNumber: e.target.value }))}
                    placeholder="e.g. CH-STR-2026-0001"
                    className="w-full h-10 px-3 border-[1.5px] border-black rounded-lg text-xs font-bold text-black focus:outline-none focus:ring-1 focus:ring-teal-600 bg-white"
                  />
                </div>
              </div>

              {/* Design No & Item Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    DESIGN NO
                  </label>
                  <input
                    type="text"
                    value={formData.designNumber}
                    onChange={(e) => setFormData((prev) => ({ ...prev, designNumber: e.target.value }))}
                    placeholder="e.g. DES-9021"
                    className="w-full h-10 px-3 border-[1.5px] border-black rounded-lg text-xs font-bold text-black focus:outline-none focus:ring-1 focus:ring-teal-600 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    ITEM NAME *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.itemName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, itemName: e.target.value }))}
                    placeholder="e.g. Cotton 60x60 Cambric"
                    className="w-full h-10 px-3 border-[1.5px] border-black rounded-lg text-xs font-bold text-black focus:outline-none focus:ring-1 focus:ring-teal-600 bg-white"
                  />
                </div>
              </div>

              {/* Issue Qty & Avg Per Pcs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    ISSUE QTY *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="0.1"
                      value={formData.issueQty}
                      onChange={(e) => setFormData((prev) => ({ ...prev, issueQty: e.target.value }))}
                      placeholder="0.00"
                      className="w-full h-10 px-3 border-[1.5px] border-black rounded-lg text-xs font-black text-black focus:outline-none focus:ring-1 focus:ring-teal-600 bg-white"
                    />
                    <select
                      value={formData.unit}
                      onChange={(e) => setFormData((prev) => ({ ...prev, unit: e.target.value }))}
                      className="h-10 px-2.5 border-[1.5px] border-black rounded-lg text-xs font-bold text-black bg-white focus:outline-none"
                    >
                      <option value="MTR">MTR</option>
                      <option value="PCS">PCS</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    AVG. PER PCS (MTR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.avgPerPcs}
                    onChange={(e) => setFormData((prev) => ({ ...prev, avgPerPcs: e.target.value }))}
                    placeholder="e.g. 2.45"
                    className="w-full h-10 px-3 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-600 bg-white"
                  />
                </div>
              </div>

              {/* Issue Pcs Qty & By Order Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    ISSUE PCS QTY
                  </label>
                  <input
                    type="number"
                    value={formData.issuePcsQty}
                    onChange={(e) => setFormData((prev) => ({ ...prev, issuePcsQty: e.target.value }))}
                    placeholder="e.g. 400"
                    className="w-full h-10 px-3 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-600 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    BY ORDER NAME
                  </label>
                  <input
                    type="text"
                    value={formData.byOrderName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, byOrderName: e.target.value }))}
                    placeholder="e.g. Global Haute Couture"
                    className="w-full h-10 px-3 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-600 bg-white"
                  />
                </div>
              </div>

              {/* Destination & Fabric Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    DESTINATION
                  </label>
                  <select
                    value={formData.destination}
                    onChange={(e) => setFormData((prev) => ({ ...prev, destination: e.target.value }))}
                    className="w-full h-10 px-3 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 bg-white focus:outline-none"
                  >
                    <option value="DYEING">Dyeing House</option>
                    <option value="EMBROIDERY">Embroidery Unit</option>
                    <option value="CUTTING">Cutting Unit</option>
                    <option value="OTHER">Other Unit / Sampling</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    FABRIC TYPE
                  </label>
                  <select
                    value={formData.fabricType}
                    onChange={(e) => setFormData((prev) => ({ ...prev, fabricType: e.target.value }))}
                    className="w-full h-10 px-3 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 bg-white focus:outline-none"
                  >
                    <option value="DYED">Dyed Fabric</option>
                    <option value="KORA">KORA (Undyed)</option>
                  </select>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                  REMARKS
                </label>
                <textarea
                  rows={2}
                  value={formData.remarks}
                  onChange={(e) => setFormData((prev) => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Optional outward notes..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-sans text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-600 bg-white resize-none"
                />
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Recording...' : 'Record Outward Issue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
