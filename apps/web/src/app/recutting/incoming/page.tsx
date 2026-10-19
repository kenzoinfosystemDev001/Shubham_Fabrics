'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowDownLeft,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  Scissors,
  ArrowRight,
  Package,
  Layers,
  Calendar,
  X,
  Clock,
  ShieldCheck,
  Eye,
  Download,
  Printer,
} from 'lucide-react';
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';
import { 
  downloadProductionSheetHtml, 
  printProductionSheet 
} from '@/lib/download-production-sheet';
import { 
  downloadChallanHtml, 
  printChallan 
} from '@/lib/download-challan';

export default function RecuttingIncomingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [challans, setChallans] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'ISSUED' | 'RECEIVED'>('ALL');
  const [viewSheetProgram, setViewSheetProgram] = useState<any | null>(null);

  // Receive modal state
  const [selectedChallan, setSelectedChallan] = useState<any>(null);
  const [receiveQuantity, setReceiveQuantity] = useState<number | ''>('');
  const [receiveRemarks, setReceiveRemarks] = useState('');
  const [submittingReceive, setSubmittingReceive] = useState(false);
  const [receiveError, setReceiveError] = useState('');
  const [receiveSuccess, setReceiveSuccess] = useState('');

  const loadData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError('');
      const res = await fetch('/api/recutting/incoming');
      if (!res.ok) throw new Error('Failed to load incoming challans');
      const json = await res.json();
      setChallans(json.data || []);
    } catch (err: any) {
      console.error('Error loading incoming challans:', err);
      setError(err.message || 'Error connecting to server');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);
    const interval = setInterval(() => {
      loadData(false);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const openReceiveModal = (ch: any) => {
    setSelectedChallan(ch);
    const totalQty = ch.items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0), 0);
    setReceiveQuantity(totalQty);
    setReceiveRemarks('Physical count verified against QC Washing Challan. Ready for precision panel cutting.');
    setReceiveError('');
    setReceiveSuccess('');
  };

  const closeReceiveModal = () => {
    setSelectedChallan(null);
    setReceiveError('');
    setReceiveSuccess('');
  };

  const handleReceiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChallan) return;

    const totalIssued = selectedChallan.items.reduce(
      (sum: number, it: any) => sum + (Number(it.quantity) || 0),
      0
    );

    const qty = Number(receiveQuantity);
    if (!qty || qty <= 0) {
      setReceiveError('Received quantity must be greater than zero.');
      return;
    }

    if (qty > totalIssued) {
      setReceiveError(`Received quantity (${qty}) cannot exceed issued quantity (${totalIssued}).`);
      return;
    }

    try {
      setSubmittingReceive(true);
      setReceiveError('');

      const res = await fetch(`/api/recutting/challans/${selectedChallan.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receivedQuantity: qty,
          remarks: receiveRemarks,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to receive challan');
      }

      setReceiveSuccess(`Challan ${selectedChallan.challanNumber} received successfully!`);
      setTimeout(() => {
        closeReceiveModal();
        loadData(false);
      }, 1200);
    } catch (err: any) {
      setReceiveError(err.message || 'Error submitting receipt');
    } finally {
      setSubmittingReceive(false);
    }
  };

  const filteredChallans = challans.filter((c) => {
    if (activeTab === 'ISSUED' && c.status !== 'ISSUED') return false;
    if (activeTab === 'RECEIVED' && c.status !== 'RECEIVED') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNumber = c.challanNumber?.toLowerCase().includes(q);
      const matchProgram = c.program?.programNumber?.toLowerCase().includes(q);
      const matchDesign = c.program?.designNumber?.toLowerCase().includes(q) || c.program?.wilcomDesignNumber?.toLowerCase().includes(q);
      const matchClient = c.program?.clientName?.toLowerCase().includes(q) || c.program?.buyerName?.toLowerCase().includes(q);
      return matchNumber || matchProgram || matchDesign || matchClient;
    }
    return true;
  });

  const issuedCount = challans.filter((c) => c.status === 'ISSUED').length;
  const receivedCount = challans.filter((c) => c.status === 'RECEIVED').length;

  return (
    <div className="min-h-screen bg-[#FDFBF7] pb-16">
      {/* HEADER */}
      <header
        style={{
          backgroundImage: `linear-gradient(to right, rgba(15, 23, 42, 0.88), rgba(15, 23, 42, 0.72)), url('${DEPARTMENT_NAV_BG_IMAGE}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        className="border-b border-slate-700/80 sticky top-0 z-30 px-4 sm:px-8 py-4 shadow-md text-white"
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                QC WASHING INTAKE
              </span>
              <span className="text-xs text-slate-300 font-medium">
                Physical Receipt & Material Intake
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mt-1 flex items-center gap-2">
              <ArrowDownLeft className="w-6 h-6 text-amber-400" />
              <span>Incoming Challans from QC Washing</span>
            </h1>
            <p className="text-xs text-slate-300 mt-0.5">
              Verify incoming pieces from QC Washing before opening cutting workstations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadData(true)}
              disabled={loading}
              className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <Link
              href="/recutting/my-work"
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>Open Cutting Queue</span>
            </Link>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              onClick={() => loadData(true)}
              className="px-3 py-1 bg-rose-600 text-white text-xs font-semibold rounded"
            >
              Retry
            </button>
          </div>
        )}

        {/* TABS & SEARCH CONTROLS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${
                activeTab === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({challans.length})
            </button>
            <button
              onClick={() => setActiveTab('ISSUED')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${
                activeTab === 'ISSUED'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Awaiting Receipt ({issuedCount})
            </button>
            <button
              onClick={() => setActiveTab('RECEIVED')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${
                activeTab === 'RECEIVED'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Received ({receivedCount})
            </button>
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search challan, program, buyer, design..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
        </div>

        {/* INCOMING CHALLANS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredChallans.length === 0 ? (
            <div className="col-span-full bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold text-slate-600">No incoming challans found</p>
              <p className="text-xs text-slate-400 mt-1">
                {activeTab === 'ISSUED'
                  ? 'No pending transfers awaiting receipt from QC Washing.'
                  : 'Adjust filters or check again when new challans are issued.'}
              </p>
            </div>
          ) : (
            filteredChallans.map((ch) => {
              const totalQty = ch.items.reduce(
                (sum: number, it: any) => sum + (Number(it.quantity) || 0),
                0
              );
              const isIssued = ch.status === 'ISSUED';
              const isReceived = ch.status === 'RECEIVED';

              return (
                <div
                  key={ch.id}
                  className={`bg-white rounded-xl border transition shadow-xs flex flex-col justify-between overflow-hidden ${
                    isIssued
                      ? 'border-amber-300 hover:border-amber-400'
                      : 'border-slate-200 hover:border-rose-400'
                  }`}
                >
                  <div className="p-4">
                    {/* Header: Challan # & Status badge */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                        {ch.challanNumber}
                      </span>
                      {isIssued && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                          Awaiting Receipt
                        </span>
                      )}
                      {isReceived && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Received
                        </span>
                      )}
                      {!isIssued && !isReceived && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {ch.status}
                        </span>
                      )}
                    </div>

                    {/* Program & Design */}
                    <div className="mt-3">
                      <div className="text-xs font-extrabold text-slate-900">
                        {ch.program?.programNumber || 'No Program Sheet'}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        Buyer: <strong className="text-slate-800">{ch.program?.buyerName || ch.program?.clientName || 'N/A'}</strong>
                      </div>
                    </div>

                    {/* Specifications */}
                    <div className="mt-3 p-2.5 bg-slate-50 rounded-lg border border-slate-100 space-y-1 text-[11px] text-slate-600">
                      <div className="flex justify-between">
                        <span>Design #:</span>
                        <strong className="text-slate-800">{ch.program?.designNumber || 'N/A'}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Wilcom #:</span>
                        <strong className="text-slate-800">{ch.program?.wilcomDesignNumber || 'N/A'}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Fabric:</span>
                        <strong className="text-slate-800">{ch.program?.fabricName || 'Embroidered Cloth'}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Issued From:</span>
                        <strong className="text-slate-800">{ch.fromDepartment || 'QC WASHING'}</strong>
                      </div>
                    </div>

                    {/* Quantity summary */}
                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="text-xs font-semibold text-slate-500">Total Material:</span>
                      <span className="text-base font-black text-slate-900">
                        {totalQty.toLocaleString()} {ch.items[0]?.uom || 'PCS'}
                      </span>
                    </div>
                  </div>

                  {/* Actions toolbar */}
                  <div className="p-3 bg-slate-50/80 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/challans/${ch.id}`}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold flex items-center gap-1"
                          title="View Challan Slip"
                        >
                          <Eye className="w-3 h-3 text-slate-500" />
                          <span>Slip</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => downloadChallanHtml(ch)}
                          className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[11px] font-semibold flex items-center gap-1"
                          title="Download Challan HTML"
                        >
                          <Download className="w-3 h-3" />
                          <span>Challan</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => printChallan(ch)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold flex items-center gap-1"
                          title="Print Challan Slip"
                        >
                          <Printer className="w-3 h-3 text-slate-500" />
                          <span>Print</span>
                        </button>
                      </div>

                      {ch.program && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setViewSheetProgram(ch.program)}
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[11px] font-semibold flex items-center gap-1"
                            title="View Production Sheet"
                          >
                            <FileText className="w-3 h-3 text-blue-600" />
                            <span>Sheet</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadProductionSheetHtml(ch.program)}
                            className="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded text-[11px] font-semibold flex items-center gap-1"
                            title="Download Production Sheet HTML"
                          >
                            <Download className="w-3 h-3 text-sky-600" />
                            <span>Sheet</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => printProductionSheet(ch.program)}
                            className="px-2 py-1 bg-blue-100/70 hover:bg-blue-200/70 text-blue-800 rounded text-[11px] font-semibold flex items-center gap-1"
                            title="Print Production Sheet Traveler"
                          >
                            <Printer className="w-3 h-3 text-blue-600" />
                            <span>Sheet</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="pt-1 border-t border-slate-200/60">
                      {isIssued ? (
                        <button
                          onClick={() => openReceiveModal(ch)}
                          className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5"
                        >
                          <ArrowDownLeft className="w-3.5 h-3.5" />
                          <span>Perform Physical Check & Receive</span>
                        </button>
                      ) : (
                        <Link
                          href={`/recutting/my-work?jobId=${ch.id}`}
                          className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5"
                        >
                          <Scissors className="w-3.5 h-3.5" />
                          <span>Open Cutting Workstation</span>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* RECEIVE MODAL */}
      {selectedChallan && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold tracking-wide">
                  Receive Material into Recutting
                </h3>
              </div>
              <button
                onClick={closeReceiveModal}
                disabled={submittingReceive}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleReceiveSubmit} className="p-5 space-y-4">
              {receiveError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{receiveError}</span>
                </div>
              )}

              {receiveSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{receiveSuccess}</span>
                </div>
              )}

              {/* Challan overview */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Challan Number:</span>
                  <span className="font-mono font-bold text-slate-900">{selectedChallan.challanNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Program Sheet:</span>
                  <span className="font-bold text-slate-800">{selectedChallan.program?.programNumber || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Design / Wilcom:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedChallan.program?.designNumber || 'N/A'} ({selectedChallan.program?.wilcomDesignNumber || 'N/A'})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Issued Quantity:</span>
                  <span className="font-extrabold text-slate-900">
                    {selectedChallan.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0)} PCS
                  </span>
                </div>
              </div>

              {/* Input: Received Quantity */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Physically Verified Received Quantity (PCS) *
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedChallan.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0)}
                  value={receiveQuantity}
                  onChange={(e) => setReceiveQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 font-semibold"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Must match the count of washed embroidered panels/pieces physically counted.
                </span>
              </div>

              {/* Input: Remarks */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Physical Verification Notes / Remarks
                </label>
                <textarea
                  rows={2}
                  value={receiveRemarks}
                  onChange={(e) => setReceiveRemarks(e.target.value)}
                  placeholder="Note condition, cleanliness, or bundle tag checks..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {/* Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeReceiveModal}
                  disabled={submittingReceive}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReceive}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submittingReceive ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying & Receiving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Confirm Receipt</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* PRODUCTION SHEET PRINT MODAL */}
      {viewSheetProgram && (
        <ProductionSheetPrintModal
          isOpen={true}
          onClose={() => setViewSheetProgram(null)}
          program={viewSheetProgram}
        />
      )}
    </div>
  );
}
