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
  Shirt,
  ArrowRight,
  Package,
  Layers,
  Calendar,
  X,
  Clock,
  ShieldCheck,
  Scissors,
} from 'lucide-react';
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';
import { DocumentActionButtons } from '@/components/common/DocumentActionButtons';

export default function StitchingIncomingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [challans, setChallans] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'ISSUED' | 'RECEIVED'>('ALL');

  // Receive modal state
  const [selectedChallan, setSelectedChallan] = useState<any>(null);
  const [receiveQuantity, setReceiveQuantity] = useState<number | ''>('');
  const [receiveRemarks, setReceiveRemarks] = useState('');
  const [markOnHold, setMarkOnHold] = useState(false);
  const [submittingReceive, setSubmittingReceive] = useState(false);
  const [receiveError, setReceiveError] = useState('');
  const [receiveSuccess, setReceiveSuccess] = useState('');

  // Production sheet preview modal state
  const [previewProgram, setPreviewProgram] = useState<any>(null);

  const loadData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError('');
      const res = await fetch('/api/stitching/incoming');
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
    setReceiveRemarks('Physical count verified against Recutting Challan. Ready for assembly line.');
    setMarkOnHold(false);
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
      const res = await fetch(`/api/stitching/challans/${selectedChallan.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receivedQuantity: qty,
          remarks: receiveRemarks,
          onHold: qty < totalIssued || markOnHold,
          markOnHold: markOnHold,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Failed to receive challan');
      }

      setReceiveSuccess(`Challan ${selectedChallan.challanNumber} received successfully!`);
      setTimeout(() => {
        closeReceiveModal();
        loadData(false);
      }, 1200);
    } catch (err: any) {
      setReceiveError(err.message || 'Error executing receipt');
    } finally {
      setSubmittingReceive(false);
    }
  };

  const filteredChallans = challans.filter((ch) => {
    if (activeTab === 'ISSUED' && ch.status !== 'ISSUED') return false;
    if (activeTab === 'RECEIVED' && ch.status === 'ISSUED') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNumber = ch.challanNumber?.toLowerCase().includes(q);
      const matchProgram = ch.program?.programNumber?.toLowerCase().includes(q);
      const matchStyle = ch.program?.styleCode?.toLowerCase().includes(q);
      const matchClient = ch.program?.clientName?.toLowerCase().includes(q);
      return matchNumber || matchProgram || matchStyle || matchClient;
    }

    return true;
  });

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col">
      {/* HEADER */}
      <div
        style={{
          backgroundImage: `linear-gradient(to right, rgba(15, 23, 42, 0.95), rgba(15, 23, 42, 0.85)), url('${DEPARTMENT_NAV_BG_IMAGE}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        className="border-b border-slate-800 p-6 shadow-md"
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
              <ArrowDownLeft className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white">Incoming Challans Terminal</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Verify cut panels from Recutting Department, check piece counts, and admit into Stitching queue
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadData(true)}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700 disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <Link
              href="/stitching/my-work"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-md"
            >
              <Shirt className="w-3.5 h-3.5" />
              <span>Go to Stitching Floor</span>
            </Link>
          </div>
        </div>
      </div>

      {/* FILTER BAR & LIST */}
      <div className="max-w-7xl mx-auto w-full p-4 md:p-6 space-y-4 flex-1">
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* CONTROLS */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
          {/* TABS */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              All Incoming ({challans.length})
            </button>
            <button
              onClick={() => setActiveTab('ISSUED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'ISSUED'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Awaiting Physical Receipt ({challans.filter((c) => c.status === 'ISSUED').length})
            </button>
            <button
              onClick={() => setActiveTab('RECEIVED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'RECEIVED'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Accepted & In Process ({challans.filter((c) => c.status !== 'ISSUED').length})
            </button>
          </div>

          {/* SEARCH */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search challan, style, program..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* CHALLANS GRID */}
        {loading && challans.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
            Loading incoming challans...
          </div>
        ) : filteredChallans.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800">
            <CheckCircle2 className="w-8 h-8 text-emerald-400/60 mx-auto mb-2" />
            <p className="text-sm font-semibold text-white">No incoming challans found</p>
            <p className="text-xs text-slate-400 mt-1">There are currently no challans matching the selected filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredChallans.map((ch) => {
              const isIssued = ch.status === 'ISSUED';
              const totalPieces = ch.items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0), 0);

              return (
                <div
                  key={ch.id}
                  className={`p-4 rounded-xl bg-slate-900/70 border transition flex flex-col justify-between gap-4 ${
                    isIssued
                      ? 'border-amber-500/40 hover:border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.05)]'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-3">
                    {/* CARD HEADER */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-mono font-bold text-white block">{ch.challanNumber}</span>
                        <span className="text-[11px] text-slate-400">
                          From: <strong className="text-slate-200">{ch.fromDepartment}</strong>
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          isIssued
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : ch.status === 'IN_PROCESS'
                            ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        }`}
                      >
                        {isIssued ? 'AWAITING RECEIPT' : ch.status}
                      </span>
                    </div>

                    {/* PROGRAM INFO */}
                    <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Program:</span>
                        <span className="font-semibold text-white">{ch.program?.programNumber || 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Style Code:</span>
                        <span className="font-semibold text-indigo-300">{ch.program?.styleCode || 'Standard'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Client:</span>
                        <span className="text-slate-300">{ch.program?.clientName || 'Confidential'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Wilcom Design:</span>
                        <span className="font-mono text-amber-300">{ch.program?.wilcomDesignNumber || ch.program?.designNumber || '-'}</span>
                      </div>
                    </div>

                    {/* QUANTITY SUMMARY */}
                    <div className="flex items-center justify-between px-1 text-xs">
                      <span className="text-slate-400">Transfer Quantity:</span>
                      <span className="text-base font-black text-white">
                        {totalPieces.toLocaleString()} <span className="text-xs font-normal text-slate-400">pcs</span>
                      </span>
                    </div>

                    {ch.remarks && (
                      <p className="text-[11px] text-slate-400 italic line-clamp-2 px-1">
                        &ldquo;{ch.remarks}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* ACTION FOOTER */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
                    <DocumentActionButtons
                      challan={ch}
                      program={ch.program}
                      size="xs"
                    />

                    {isIssued ? (
                      <button
                        onClick={() => openReceiveModal(ch)}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-sm flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Confirm Receipt</span>
                      </button>
                    ) : (
                      <Link
                        href={`/stitching/workspace/${ch.id}`}
                        className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-sm flex items-center gap-1.5"
                      >
                        <Shirt className="w-3.5 h-3.5" />
                        <span>Open Workspace</span>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* PHYSICAL RECEIPT MODAL */}
      {selectedChallan && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Physical Receipt Verification</h3>
                  <p className="text-xs text-slate-400">Challan: {selectedChallan.challanNumber}</p>
                </div>
              </div>
              <button
                onClick={closeReceiveModal}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {receiveError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{receiveError}</span>
              </div>
            )}

            {receiveSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{receiveSuccess}</span>
              </div>
            )}

            <form onSubmit={handleReceiveSubmit} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Style / Design:</span>
                  <span className="font-semibold text-white">
                    {selectedChallan.program?.styleCode || 'Standard'} &bull; {selectedChallan.program?.designNumber || '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Source Department:</span>
                  <span className="font-semibold text-indigo-300">{selectedChallan.fromDepartment}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Issued Piece Count:</span>
                  <span className="font-black text-amber-400 text-sm">
                    {selectedChallan.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0)} pcs
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Actual Received Physical Count (Pcs) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedChallan.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0)}
                  value={receiveQuantity}
                  onChange={(e) => setReceiveQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-emerald-500"
                  required
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Ensure physical bundle counting matches the delivery Challan exactly.
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Receipt Remarks / Notes</label>
                <textarea
                  rows={2}
                  value={receiveRemarks}
                  onChange={(e) => setReceiveRemarks(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  placeholder="Notes on cut panel bundle condition, sizes, or notes..."
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="markOnHold"
                  checked={markOnHold}
                  onChange={(e) => setMarkOnHold(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                />
                <label htmlFor="markOnHold" className="text-slate-400 text-xs cursor-pointer">
                  Mark job ON HOLD for inspection (do not move directly into ready queue)
                </label>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeReceiveModal}
                  disabled={submittingReceive}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReceive}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submittingReceive ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Accepting...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Confirm Physical Receipt</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TECH SHEET PREVIEW MODAL */}
      {previewProgram && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Production Sheet Specification</h3>
              </div>
              <button
                onClick={() => setPreviewProgram(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <div>
                  <span className="text-slate-400 block">Program Serial:</span>
                  <span className="font-bold text-white font-mono">{previewProgram.programNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Style Code:</span>
                  <span className="font-bold text-indigo-300">{previewProgram.styleCode || 'Standard'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Target Quantity:</span>
                  <span className="font-bold text-white">{previewProgram.targetQuantity || 'N/A'} {previewProgram.quantityMeasurement || 'PCS'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Fabric Name:</span>
                  <span className="font-bold text-slate-200">{previewProgram.fabricName || 'Cotton / Poly'}</span>
                </div>
              </div>

              {previewProgram.wilcomDesign && (
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="text-slate-400 font-semibold block mb-1">Wilcom Embroidery Specs:</span>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Design No:</span>
                    <span className="font-mono text-amber-300">{previewProgram.wilcomDesign.wilcomDesignNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Stitches:</span>
                    <span className="text-white font-mono">{previewProgram.wilcomDesign.stitchCount?.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setPreviewProgram(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
