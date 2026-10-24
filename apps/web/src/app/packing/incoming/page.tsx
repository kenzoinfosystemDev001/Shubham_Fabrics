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
import { TransferDocuments } from '@/components/common/TransferDocuments';

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
    <div className="min-h-screen bg-canvas px-4 py-8 text-neutral-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* HEADER */}
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent-400/10 text-accent-700 border border-accent-500/30">
                <Clock3 className="w-3.5 h-3.5" />
                Physical Inward Gate
              </span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold text-neutral-900 tracking-tight">
              Incoming Garments (from Final QC)
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Acknowledge and verify physical piece counts handed over by Final QC before packing into cartons.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => void loadIncoming()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 py-2 text-xs font-semibold text-neutral-900 transition hover:bg-neutral-200 hover:text-neutral-900 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-accent-700' : ''}`} />
              <span>Refresh</span>
            </button>
            <Link
              href="/packing/workspace"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-700 shadow-sm"
            >
              <Package className="w-4 h-4" />
              <span>Packing Workspace</span>
            </Link>
          </div>
        </header>

        {successToast && (
          <div className="rounded-xl border border-accent-500/40 bg-accent-400/10 p-4 text-sm text-accent-700 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-accent-700" />
            <p className="font-semibold">{successToast}</p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-danger-500/40 bg-danger-500/10 p-4 text-sm text-danger-600 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-danger-600" />
            <p className="font-semibold">{error}</p>
          </div>
        )}

        {/* FILTERS & SEARCH */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-neutral-200">
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
                    ? 'bg-accent-400 text-neutral-900 shadow-sm'
                    : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="Search Challan #, Prog #, Style..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-canvas border border-neutral-200 rounded-lg pl-9 pr-3 py-2 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-brand-500 transition"
            />
          </div>
        </div>

        {/* CHALLAN LIST TABLE */}
        <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-700">
              <thead className="bg-white text-[11px] font-bold uppercase tracking-wider text-neutral-500 border-b border-neutral-200">
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
              <tbody className="divide-y divide-neutral-200">
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
                      <tr key={ch.id} className="hover:bg-neutral-100 transition">
                        {/* Challan / Date */}
                        <td className="px-4 py-3.5 align-top">
                          <span className="font-mono font-bold text-accent-700 text-sm block">
                            {ch.challanNumber}
                          </span>
                          <span className="text-[10px] text-neutral-500 block mt-0.5">
                            {new Date(ch.createdAt).toLocaleString(undefined, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </span>
                          {ch.issuedBy?.fullName && (
                            <span className="text-[10px] text-neutral-500 flex items-center gap-1 mt-1">
                              <User className="w-3 h-3 text-neutral-500" />
                              {ch.issuedBy.fullName}
                            </span>
                          )}
                        </td>

                        {/* Program & Style */}
                        <td className="px-4 py-3.5 align-top">
                          <span className="font-bold text-neutral-900 block">
                            Prog #{ch.program?.programNumber || 'N/A'}
                          </span>
                          <span className="text-xs text-neutral-700 font-mono block">
                            {ch.program?.styleCode || 'N/A'}
                          </span>
                          <span className="text-[11px] text-neutral-500 block truncate max-w-[200px]">
                            {ch.program?.buyerName || ch.program?.clientName || 'N/A'}
                          </span>
                          {/* Production sheet & this received challan */}
                          <TransferDocuments challan={ch} size="xs" className="mt-1" />
                        </td>

                        {/* From Department */}
                        <td className="px-4 py-3.5 align-top">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-accent-700 border border-neutral-200">
                            {ch.fromDepartment}
                          </span>
                          <span className="text-[10px] text-neutral-500 block mt-1">
                            &rarr; {ch.toDepartment}
                          </span>
                        </td>

                        {/* Items breakdown */}
                        <td className="px-4 py-3.5 align-top">
                          <div className="flex flex-wrap gap-1 max-w-xs justify-center">
                            {ch.items.map((item, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded bg-canvas text-neutral-700 border border-neutral-200 text-[10px] font-mono"
                              >
                                {item.size ? `${item.size}: ` : ''}
                                <strong className="text-neutral-900">{item.quantity}</strong> {item.uom}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Total Pieces */}
                        <td className="px-4 py-3.5 align-top text-right font-mono">
                          <span className="text-base font-black text-neutral-900 block">
                            {totalPieces.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-neutral-500 uppercase">pcs</span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5 align-top text-center">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isIssued
                                ? 'bg-accent-400/20 text-accent-700 border border-accent-500/40'
                                : isReceived
                                ? 'bg-accent-400/20 text-accent-700 border border-accent-500/40'
                                : isInProcess
                                ? 'bg-brand-500/20 text-brand-600 border border-brand-500/40'
                                : isCompleted
                                ? 'bg-brand-500/20 text-brand-600 border border-brand-500/40'
                                : isOnHold
                                ? 'bg-danger-500/20 text-danger-600 border border-danger-500/40'
                                : 'bg-neutral-100 text-neutral-500'
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
                                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 text-xs font-bold transition shadow-xs"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Acknowledge Receipt</span>
                              </button>
                            )}

                            {(isReceived || isInProcess) && (
                              <Link
                                href={`/packing/workspace/${ch.id}`}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 text-xs font-bold transition shadow-xs"
                              >
                                <Package className="w-3.5 h-3.5" />
                                <span>Pack Cartons</span>
                                <ArrowRight className="w-3 h-3" />
                              </Link>
                            )}

                            {isCompleted && (
                              <Link
                                href={`/packing/workspace/${ch.id}`}
                                className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 px-2.5 py-1.5 text-xs font-semibold transition"
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
                    <td colSpan={7} className="px-4 py-12 text-center text-neutral-500">
                      {loading ? (
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-accent-700" />
                          <span>Loading incoming transfers...</span>
                        </div>
                      ) : (
                        <div>
                          <Package className="w-8 h-8 mx-auto text-neutral-600 mb-2" />
                          <p className="font-semibold text-neutral-500">No incoming transfers found</p>
                          <p className="text-xs text-neutral-500 mt-1">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/70 backdrop-blur-xs p-4">
            <div className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-700">
                    Physical Handover Verification
                  </span>
                  <h3 className="text-lg font-bold text-neutral-900">
                    Acknowledge Piece Receipt: {activeChallan.challanNumber}
                  </h3>
                </div>
                <button
                  onClick={closeReceiveModal}
                  className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                >
                  ✕
                </button>
              </div>

              <TransferDocuments challan={activeChallan} size="xs" autoLoad />

              {/* Source Info */}
              <div className="rounded-lg bg-canvas p-3 border border-neutral-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Program / Style:</span>
                  <span className="font-bold text-neutral-900">
                    Prog #{activeChallan.program?.programNumber || 'N/A'} ({activeChallan.program?.styleCode || 'N/A'})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">From Department:</span>
                  <span className="font-bold text-accent-700">{activeChallan.fromDepartment}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Expected Physical Count:</span>
                  <span className="font-mono font-bold text-accent-700">{expectedTotal} pcs</span>
                </div>
              </div>

              {modalError && (
                <div className="rounded-lg border border-danger-500/40 bg-danger-500/10 p-3 text-xs text-danger-600">
                  {modalError}
                </div>
              )}

              {/* Input: Received Qty */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-900 block">
                  Actual Count Received on Floor (Pieces)
                </label>
                <input
                  type="number"
                  min={0}
                  value={receivedQtyInput}
                  onChange={(e) => setReceivedQtyInput(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full rounded-lg border border-neutral-200 bg-canvas px-3 py-2 text-sm font-mono font-bold text-neutral-900 focus:border-brand-500 focus:outline-none"
                />
                {shortage > 0 && (
                  <p className="text-xs text-accent-700 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Shortage detected: {shortage} piece(s) missing from sender's challan.
                  </p>
                )}
                {shortage < 0 && (
                  <p className="text-xs text-brand-600 flex items-center gap-1">
                    Excess detected: {Math.abs(shortage)} piece(s) more than challan quantity.
                  </p>
                )}
              </div>

              {/* Remarks */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-900 block">
                  Receipt Remarks / Discrepancy Notes
                </label>
                <textarea
                  rows={2}
                  value={remarksInput}
                  onChange={(e) => setRemarksInput(e.target.value)}
                  placeholder="e.g., Verified OK, or 2 pcs stained/damaged in transit..."
                  className="w-full rounded-lg border border-neutral-200 bg-canvas px-3 py-2 text-xs text-neutral-900 placeholder-neutral-400 focus:border-brand-500 focus:outline-none"
                />
              </div>

              {/* Hold Checkbox */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="markOnHold"
                  checked={markOnHold}
                  onChange={(e) => setMarkOnHold(e.target.checked)}
                  className="rounded border-neutral-200 bg-canvas text-accent-700 focus:ring-0"
                />
                <label htmlFor="markOnHold" className="text-xs text-neutral-700 cursor-pointer">
                  Place this handover <strong className="text-danger-600">ON HOLD</strong> (requires supervisor review before packing)
                </label>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={closeReceiveModal}
                  disabled={submitting}
                  className="rounded-lg border border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReceive}
                  disabled={submitting}
                  className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 text-xs font-bold transition shadow-sm disabled:opacity-50 flex items-center gap-2"
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
