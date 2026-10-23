'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Clock3,
  Search,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Package,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
  FileText,
  User,
  Filter,
} from 'lucide-react';
import { api } from '@/lib/api';

interface IncomingChallan {
  id: string;
  challanNumber: string;
  fromDepartment: string;
  toDepartment: string;
  status: string;
  createdAt: string;
  receivedAt?: string;
  remarks?: string;
  program?: {
    id: string;
    programNumber?: string;
    programSerialNo?: string;
    styleCode?: string;
    designNumber?: string;
    clientName?: string;
    buyerName?: string;
    fabricName?: string;
    targetQuantity?: number;
    quantityMeasurement?: string;
  };
  items: Array<{
    id?: string;
    itemType?: string;
    description?: string;
    size?: string;
    color?: string;
    quantity: number;
    uom: string;
  }>;
  issuedBy?: { fullName?: string; username?: string };
  receivedBy?: { fullName?: string; username?: string };
  events?: Array<{
    eventType: string;
    eventStatus: string;
    message: string;
    createdAt: string;
  }>;
}

export default function PackingIncomingPage() {
  const [challans, setChallans] = useState<IncomingChallan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Receive Modal State
  const [activeChallan, setActiveChallan] = useState<IncomingChallan | null>(null);
  const [receivedQtyInput, setReceivedQtyInput] = useState<number>(0);
  const [remarksInput, setRemarksInput] = useState('');
  const [markOnHold, setMarkOnHold] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [successToast, setSuccessToast] = useState('');

  const loadIncoming = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setLoading(true);
      setError('');
      const params: any = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await api.getPackingIncoming(params);
      if (res?.success && Array.isArray(res.data)) {
        setChallans(res.data);
      } else {
        const query = new URLSearchParams(params).toString();
        const fallbackRes = await fetch(`/api/packing/incoming?${query}`, { cache: 'no-store' });
        const json = await fallbackRes.json();
        if (json.success && Array.isArray(json.data)) {
          setChallans(json.data);
        } else {
          throw new Error(json.error || 'Failed to load incoming challans');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error loading incoming transfers');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    void loadIncoming();
  }, [loadIncoming]);

  const openReceiveModal = (ch: IncomingChallan) => {
    const totalPcs = ch.items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
    setActiveChallan(ch);
    setReceivedQtyInput(totalPcs);
    setRemarksInput('');
    setMarkOnHold(false);
    setModalError('');
  };

  const closeReceiveModal = () => {
    setActiveChallan(null);
    setModalError('');
  };

  const handleConfirmReceive = async () => {
    if (!activeChallan) return;
    setSubmitting(true);
    setModalError('');
    try {
      const res = await api.receivePackingChallan(activeChallan.id, {
        receivedQuantity: receivedQtyInput,
        remarks: remarksInput,
        markOnHold,
      });

      if (!res?.success) {
        throw new Error(res?.error || 'Failed to acknowledge receipt');
      }

      setSuccessToast(`Challan ${activeChallan.challanNumber} received successfully!`);
      closeReceiveModal();
      void loadIncoming(true);
      setTimeout(() => setSuccessToast(''), 4000);
    } catch (err: any) {
      setModalError(err.message || 'Failed to acknowledge piece receipt');
    } finally {
      setSubmitting(false);
    }
  };

  const expectedTotal = activeChallan
    ? activeChallan.items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0)
    : 0;
  const shortage = expectedTotal - receivedQtyInput;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* HEADER */}
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <Clock3 className="w-3.5 h-3.5" />
                Physical Inward Gate
              </span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold text-white tracking-tight">
              Incoming Garments (from Final QC)
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Acknowledge and verify physical piece counts handed over by Final QC before packing into cartons.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => void loadIncoming()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
              <span>Refresh</span>
            </button>
            <Link
              href="/packing/workspace"
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-amber-400 shadow-md shadow-amber-500/20"
            >
              <Package className="w-4 h-4" />
              <span>Packing Workspace</span>
            </Link>
          </div>
        </header>

        {successToast && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-300 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            <p className="font-semibold">{successToast}</p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-300 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
            <p className="font-semibold">{error}</p>
          </div>
        )}

        {/* FILTERS & SEARCH */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'ALL', label: 'All Transfers' },
              { id: 'ISSUED', label: 'Awaiting Inward' },
              { id: 'RECEIVED', label: 'Ready to Pack' },
              { id: 'IN_PROCESS', label: 'In Progress' },
              { id: 'COMPLETED', label: 'Completed' },
              { id: 'ON_HOLD', label: 'On Hold' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  statusFilter === tab.id
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Challan #, Prog #, Style..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
            />
          </div>
        </div>

        {/* CHALLAN LIST TABLE */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3.5">Challan / Date</th>
                  <th className="px-4 py-3.5">Program & Style</th>
                  <th className="px-4 py-3.5">From Department</th>
                  <th className="px-4 py-3.5 text-center">Items & Breakdown</th>
                  <th className="px-4 py-3.5 text-right">Pieces</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {challans.length > 0 ? (
                  challans.map((ch) => {
                    const totalPieces = ch.items.reduce(
                      (sum, it) => sum + (Number(it.quantity) || 0),
                      0
                    );
                    const isIssued = ch.status === 'ISSUED';
                    const isReceived = ch.status === 'RECEIVED';
                    const isInProcess = ch.status === 'IN_PROCESS';
                    const isCompleted = ch.status === 'COMPLETED';
                    const isOnHold = ch.status === 'ON_HOLD';

                    return (
                      <tr key={ch.id} className="hover:bg-slate-800/30 transition">
                        {/* Challan / Date */}
                        <td className="px-4 py-3.5 align-top">
                          <span className="font-mono font-bold text-amber-400 text-sm block">
                            {ch.challanNumber}
                          </span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            {new Date(ch.createdAt).toLocaleString(undefined, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </span>
                          {ch.issuedBy?.fullName && (
                            <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                              <User className="w-3 h-3 text-slate-500" />
                              {ch.issuedBy.fullName}
                            </span>
                          )}
                        </td>

                        {/* Program & Style */}
                        <td className="px-4 py-3.5 align-top">
                          <span className="font-bold text-white block">
                            Prog #{ch.program?.programNumber || 'N/A'}
                          </span>
                          <span className="text-xs text-slate-300 font-mono block">
                            {ch.program?.styleCode || 'N/A'}
                          </span>
                          <span className="text-[11px] text-slate-400 block truncate max-w-[200px]">
                            {ch.program?.buyerName || ch.program?.clientName || 'N/A'}
                          </span>
                          {ch.program?.id && (
                            <Link
                              href={`/programs/${ch.program.id}`}
                              target="_blank"
                              className="inline-flex items-center gap-1 text-[10px] text-amber-400/80 hover:text-amber-300 mt-1"
                            >
                              <FileText className="w-3 h-3" />
                              View Production Sheet
                              <ExternalLink className="w-2.5 h-2.5" />
                            </Link>
                          )}
                        </td>

                        {/* From Department */}
                        <td className="px-4 py-3.5 align-top">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-emerald-400 border border-slate-700">
                            {ch.fromDepartment}
                          </span>
                          <span className="text-[10px] text-slate-500 block mt-1">
                            &rarr; {ch.toDepartment}
                          </span>
                        </td>

                        {/* Items breakdown */}
                        <td className="px-4 py-3.5 align-top">
                          <div className="flex flex-wrap gap-1 max-w-xs justify-center">
                            {ch.items.map((item, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800 text-[10px] font-mono"
                              >
                                {item.size ? `${item.size}: ` : ''}
                                <strong className="text-white">{item.quantity}</strong> {item.uom}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Total Pieces */}
                        <td className="px-4 py-3.5 align-top text-right font-mono">
                          <span className="text-base font-black text-white block">
                            {totalPieces.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-400 uppercase">pcs</span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5 align-top text-center">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isIssued
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : isReceived
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : isInProcess
                                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                                : isCompleted
                                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                                : isOnHold
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {ch.status.replace(/_/g, ' ')}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 align-top text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isIssued && (
                              <button
                                onClick={() => openReceiveModal(ch)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1.5 text-xs font-bold transition shadow-xs"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Acknowledge Receipt</span>
                              </button>
                            )}

                            {(isReceived || isInProcess) && (
                              <Link
                                href={`/packing/workspace/${ch.id}`}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3 py-1.5 text-xs font-bold transition shadow-xs"
                              >
                                <Package className="w-3.5 h-3.5" />
                                <span>Pack Cartons</span>
                                <ArrowRight className="w-3 h-3" />
                              </Link>
                            )}

                            {isCompleted && (
                              <Link
                                href={`/packing/workspace/${ch.id}`}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1.5 text-xs font-semibold transition"
                              >
                                <span>View Handover</span>
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                      {loading ? (
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                          <span>Loading incoming transfers...</span>
                        </div>
                      ) : (
                        <div>
                          <Package className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                          <p className="font-semibold text-slate-400">No incoming transfers found</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {statusFilter !== 'ALL'
                              ? `No transfers with status "${statusFilter}"`
                              : 'No Challans issued to Packing yet.'}
                          </p>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ACKNOWLEDGE RECEIPT MODAL */}
        {activeChallan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
            <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                    Physical Handover Verification
                  </span>
                  <h3 className="text-lg font-bold text-white">
                    Acknowledge Piece Receipt: {activeChallan.challanNumber}
                  </h3>
                </div>
                <button
                  onClick={closeReceiveModal}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {/* Source Info */}
              <div className="rounded-lg bg-slate-950 p-3 border border-slate-800 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Program / Style:</span>
                  <span className="font-bold text-white">
                    Prog #{activeChallan.program?.programNumber || 'N/A'} ({activeChallan.program?.styleCode || 'N/A'})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">From Department:</span>
                  <span className="font-bold text-emerald-400">{activeChallan.fromDepartment}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Expected Physical Count:</span>
                  <span className="font-mono font-bold text-amber-400">{expectedTotal} pcs</span>
                </div>
              </div>

              {modalError && (
                <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
                  {modalError}
                </div>
              )}

              {/* Input: Received Qty */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-200 block">
                  Actual Count Received on Floor (Pieces)
                </label>
                <input
                  type="number"
                  min={0}
                  value={receivedQtyInput}
                  onChange={(e) => setReceivedQtyInput(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-mono font-bold text-white focus:border-amber-400 focus:outline-none"
                />
                {shortage > 0 && (
                  <p className="text-xs text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Shortage detected: {shortage} piece(s) missing from sender's challan.
                  </p>
                )}
                {shortage < 0 && (
                  <p className="text-xs text-sky-400 flex items-center gap-1">
                    Excess detected: {Math.abs(shortage)} piece(s) more than challan quantity.
                  </p>
                )}
              </div>

              {/* Remarks */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-200 block">
                  Receipt Remarks / Discrepancy Notes
                </label>
                <textarea
                  rows={2}
                  value={remarksInput}
                  onChange={(e) => setRemarksInput(e.target.value)}
                  placeholder="e.g., Verified OK, or 2 pcs stained/damaged in transit..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                />
              </div>

              {/* Hold Checkbox */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="markOnHold"
                  checked={markOnHold}
                  onChange={(e) => setMarkOnHold(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-0"
                />
                <label htmlFor="markOnHold" className="text-xs text-slate-300 cursor-pointer">
                  Place this handover <strong className="text-rose-400">ON HOLD</strong> (requires supervisor review before packing)
                </label>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={closeReceiveModal}
                  disabled={submitting}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReceive}
                  disabled={submitting}
                  className="rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 px-5 py-2 text-xs font-bold transition shadow-md shadow-amber-500/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{markOnHold ? 'Mark On Hold' : 'Confirm Piece Receipt'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
