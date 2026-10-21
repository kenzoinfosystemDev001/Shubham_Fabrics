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
  Sparkles,
  ArrowRight,
  Package,
  Layers,
  Calendar,
  X,
  Clock,
  ShieldCheck,
  Wind,
  Flame,
} from 'lucide-react';
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';

export default function SteamPressIncomingPage() {
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
      const res = await fetch('/api/steam-press/incoming');
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
  }, []);

  const openReceiveModal = (challan: any) => {
    setSelectedChallan(challan);
    const totalQty = challan.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
    setReceiveQuantity(totalQty);
    setReceiveRemarks('');
    setMarkOnHold(false);
    setReceiveError('');
    setReceiveSuccess('');
  };

  const handleConfirmReceive = async () => {
    if (!selectedChallan) return;
    try {
      setSubmittingReceive(true);
      setReceiveError('');

      const totalIssued = selectedChallan.items.reduce(
        (s: number, it: any) => s + (Number(it.quantity) || 0),
        0
      );

      const qty = Number(receiveQuantity);
      if (isNaN(qty) || qty <= 0) {
        throw new Error('Please enter a valid received quantity greater than 0.');
      }

      if (qty > totalIssued) {
        throw new Error(`Received quantity (${qty}) cannot exceed issued quantity (${totalIssued}).`);
      }

      const res = await fetch(`/api/steam-press/challans/${selectedChallan.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receivedQuantity: qty,
          remarks: receiveRemarks,
          markOnHold: markOnHold,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to acknowledge receipt.');
      }

      setReceiveSuccess(`Challan ${selectedChallan.challanNumber} received successfully!`);
      setTimeout(() => {
        setSelectedChallan(null);
        loadData(false);
      }, 1000);
    } catch (err: any) {
      setReceiveError(err.message || 'Error acknowledging receipt');
    } finally {
      setSubmittingReceive(false);
    }
  };

  // Filter Challans
  const filteredChallans = challans.filter((ch) => {
    if (activeTab === 'ISSUED' && ch.status !== 'ISSUED') return false;
    if (activeTab === 'RECEIVED' && ch.status === 'ISSUED') return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const challanNum = (ch.challanNumber || '').toLowerCase();
    const progNum = (ch.program?.programNumber || '').toLowerCase();
    const style = (ch.program?.styleCode || '').toLowerCase();
    const client = (ch.program?.clientName || '').toLowerCase();
    return (
      challanNum.includes(q) ||
      progNum.includes(q) ||
      style.includes(q) ||
      client.includes(q)
    );
  });

  return (
    <div
      className="min-h-screen text-slate-100 flex flex-col"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(15, 23, 42, 0.94), rgba(10, 15, 29, 0.98)), url('${DEPARTMENT_NAV_BG_IMAGE}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* HEADER */}
      <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md px-6 py-4 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
              <Wind className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Inward Challans (Finishing Handover)
              </h1>
              <p className="text-xs text-slate-400">
                Acknowledge physical bundle receipts, count verification, and transfer to steam pressing queue
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadData(true)}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-300 hover:text-white transition disabled:opacity-50"
              title="Refresh Inward Challans"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            <Link
              href="/steam-press/my-work"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-900/30 transition"
            >
              <Flame className="w-4 h-4" />
              <span>Pressing Workstation</span>
            </Link>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6 space-y-6">
        {/* CONTROLS BAR: SEARCH & TABS */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 backdrop-blur-xs">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950/60 border border-slate-800 rounded-lg">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                activeTab === 'ALL'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Inward ({challans.length})
            </button>
            <button
              onClick={() => setActiveTab('ISSUED')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                activeTab === 'ISSUED'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Pending Receipt ({challans.filter((c) => c.status === 'ISSUED').length})
            </button>
            <button
              onClick={() => setActiveTab('RECEIVED')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                activeTab === 'RECEIVED'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              In Steam Press Queue ({challans.filter((c) => c.status !== 'ISSUED').length})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search by Challan, Program, Style, Client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/60 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300 text-xs"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* ERROR DISPLAY */}
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* CHALLANS TABLE / GRID */}
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-xs flex flex-col items-center justify-center">
            <RefreshCw className="w-8 h-8 animate-spin text-cyan-400 mb-3" />
            <span>Loading incoming Challans...</span>
          </div>
        ) : filteredChallans.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 backdrop-blur-xs">
            <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white mb-1">No Inward Challans Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchQuery
                ? 'No matching challans for your search query.'
                : 'There are currently no challans routed to the Steam Press Department.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredChallans.map((ch) => {
              const totalPieces = ch.items.reduce(
                (sum: number, it: any) => sum + (Number(it.quantity) || 0),
                0
              );
              const isIssued = ch.status === 'ISSUED';
              const isReceived = ch.status === 'RECEIVED';
              const isInProcess = ch.status === 'IN_PROCESS';
              const isCompleted = ch.status === 'COMPLETED';
              const isReady = ch.status === 'READY_FOR_HANDOVER';
              const isHold = ch.status === 'ON_HOLD';

              return (
                <div
                  key={ch.id}
                  className={`rounded-2xl border bg-slate-900/70 p-5 flex flex-col justify-between space-y-4 backdrop-blur-xs transition shadow-sm ${
                    isIssued
                      ? 'border-cyan-500/40 hover:border-cyan-400/70'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Top Bar: Challan & Status Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-cyan-300 block">
                        {ch.challanNumber}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        From: <span className="font-semibold text-slate-300">{ch.fromDepartment || 'FINISHING'}</span>
                      </span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${
                        isIssued
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
                          : isReceived
                          ? 'bg-teal-500/10 text-teal-300 border-teal-500/30'
                          : isInProcess
                          ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                          : isCompleted || isReady
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                          : isHold
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      {ch.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {/* Program & Style Summary */}
                  <div className="space-y-1.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Program Sheet:</span>
                      <button
                        onClick={() => setPreviewProgram(ch.program)}
                        className="font-mono font-bold text-cyan-400 hover:underline flex items-center gap-1"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>{ch.program?.programNumber || 'N/A'}</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Style:</span>
                      <span className="font-semibold text-slate-200">
                        {ch.program?.styleCode || 'Standard Style'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Client / Buyer:</span>
                      <span className="text-slate-300 truncate max-w-[150px]">
                        {ch.program?.clientName || 'Standard Client'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/60">
                      <span className="text-slate-400 font-semibold">Total Handover:</span>
                      <span className="font-mono text-sm font-bold text-cyan-300">
                        {totalPieces} <span className="text-[10px] font-normal text-slate-400">PCS</span>
                      </span>
                    </div>
                  </div>

                  {/* Items breakdown pill */}
                  <div className="text-[11px] text-slate-400 space-y-1">
                    <span className="block font-medium text-slate-500 uppercase tracking-wider text-[9px]">
                      Bundle Contents ({ch.items.length} line items):
                    </span>
                    <div className="max-h-20 overflow-y-auto space-y-1 pr-1">
                      {ch.items.map((it: any, idx: number) => (
                        <div
                          key={it.id || idx}
                          className="flex items-center justify-between bg-slate-950/40 px-2 py-1 rounded border border-slate-800/50 text-[11px]"
                        >
                          <span className="text-slate-300 truncate mr-2">
                            {it.itemDescription || 'Garments'}
                          </span>
                          <span className="font-mono font-bold text-white shrink-0">
                            {it.quantity} {it.uom || 'PCS'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Footer Action */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(ch.createdAt).toLocaleDateString()}
                    </span>

                    {isIssued ? (
                      <button
                        onClick={() => openReceiveModal(ch)}
                        className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-900/30 transition flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Acknowledge Receipt</span>
                      </button>
                    ) : (
                      <Link
                        href={`/steam-press/my-work?jobId=${ch.id}`}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5"
                      >
                        <span>Open Workstation</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* PHYSICAL RECEIPT MODAL */}
        {selectedChallan && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Wind className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-base font-bold text-white">
                    Inward Receipt Verification
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedChallan(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {receiveSuccess ? (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{receiveSuccess}</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Challan Number:</span>
                      <span className="font-mono font-bold text-cyan-300">
                        {selectedChallan.challanNumber}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Origin Department:</span>
                      <span className="font-semibold text-slate-200">
                        {selectedChallan.fromDepartment || 'FINISHING'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Issued Quantity:</span>
                      <span className="font-mono font-bold text-white">
                        {selectedChallan.items.reduce(
                          (s: number, it: any) => s + (Number(it.quantity) || 0),
                          0
                        )}{' '}
                        PCS
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Physically Counted & Received Quantity (PCS) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={selectedChallan.items.reduce(
                        (s: number, it: any) => s + (Number(it.quantity) || 0),
                        0
                      )}
                      value={receiveQuantity}
                      onChange={(e) =>
                        setReceiveQuantity(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white font-mono font-bold focus:outline-none focus:border-cyan-400"
                    />
                    {Number(receiveQuantity) <
                      selectedChallan.items.reduce(
                        (s: number, it: any) => s + (Number(it.quantity) || 0),
                        0
                      ) && (
                      <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Discrepancy detected: short by{' '}
                        {selectedChallan.items.reduce(
                          (s: number, it: any) => s + (Number(it.quantity) || 0),
                          0
                        ) - Number(receiveQuantity)}{' '}
                        pcs.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="markHold"
                      checked={markOnHold}
                      onChange={(e) => setMarkOnHold(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-0"
                    />
                    <label htmlFor="markHold" className="text-xs text-slate-300">
                      Flag bundle on hold (requires supervisor or finishing clarification)
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Inward Remarks / Inspection Notes
                    </label>
                    <textarea
                      rows={2}
                      value={receiveRemarks}
                      onChange={(e) => setReceiveRemarks(e.target.value)}
                      placeholder="e.g., Bundle count verified, tags intact, ready for steam pressing"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-400 resize-none"
                    />
                  </div>

                  {receiveError && (
                    <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{receiveError}</span>
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
                    <button
                      onClick={() => setSelectedChallan(null)}
                      className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmReceive}
                      disabled={submittingReceive}
                      className="px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold shadow-md shadow-cyan-900/30 transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{submittingReceive ? 'Verifying...' : 'Confirm Inward'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PRODUCTION SHEET PREVIEW MODAL */}
        {previewProgram && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl relative max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-base font-bold text-white">Production Sheet Specifications</h3>
                </div>
                <button
                  onClick={() => setPreviewProgram(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Program Number:</span>
                    <span className="font-mono font-bold text-white">{previewProgram.programNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Style Code:</span>
                    <span className="font-bold text-cyan-300">{previewProgram.styleCode || 'Standard'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Client / Buyer:</span>
                    <span className="text-slate-200">{previewProgram.buyerName || previewProgram.clientName || 'Standard'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Target Quantity:</span>
                    <span className="font-mono font-bold text-white">{previewProgram.targetQuantity || 'N/A'}</span>
                  </div>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-1.5">
                  <span className="text-slate-400 font-semibold block">Steam Press Quality Guidelines:</span>
                  <ul className="list-disc pl-4 space-y-1 text-slate-300">
                    <li>Maintain boiler steam pressure at 3.5 - 4.5 bar and plate temperature appropriate for fabric composition.</li>
                    <li>Avoid prolonged direct contact on delicate embroidery or sequins to prevent scorching, glazing, or melting.</li>
                    <li>Ensure vacuum extraction table is engaged post-pressing to rapidly dissipate residual moisture.</li>
                    <li>Verify crisp crease alignment on sleeves, side seams, and hems without shine marks.</li>
                  </ul>
                </div>
              </div>

              <div className="pt-2 flex justify-end border-t border-slate-800">
                <button
                  onClick={() => setPreviewProgram(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
