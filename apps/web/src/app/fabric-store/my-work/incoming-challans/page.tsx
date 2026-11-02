'use client';

import React, { useState, useEffect } from 'react';
import { departmentName } from '@/lib/workflow-views';
import Link from 'next/link';
import { 
  RefreshCw, 
  ArrowDownToLine, 
  CheckCircle2, 
  Layers, 
  FileText, 
  Send, 
  ArrowUpFromLine, 
  Eye,
  Printer,
  Download,
  Check,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  PackagePlus,
} from 'lucide-react';
import { TransferDocuments } from '@/components/common/TransferDocuments';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';
import { ReceiveChallanConfirm } from '@/components/challan/ReceiptLines';
import { formatTotals, totalsByUnit } from '@/lib/challan-units.mjs';

export default function IncomingChallansPage() {
  const [loading, setLoading] = useState(true);
  const [challans, setChallans] = useState<any[]>([]);
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, any>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [selectedSheetModal, setSelectedSheetModal] = useState<any | null>(null);

  const loadChallans = async () => {
    try {
      setLoading(true);
      // Load challans where toDepartment = STORE and live Fabric Store availability
      const [res, availRes] = await Promise.all([
        fetch('/api/challans?toDepartment=STORE'),
        fetch('/api/fabric-store/check-availability').catch(() => null),
      ]);
      const json = await res.json();
      const data = Array.isArray(json) ? json : json.data || [];

      if (availRes && availRes.ok) {
        const availJson = await availRes.json();
        const map: Record<string, any> = {};
        if (Array.isArray(availJson.data)) {
          for (const item of availJson.data) {
            if (item.programId) map[item.programId] = item;
          }
        }
        setAvailabilityMap(map);
      }

      // Filter: addressed to store and active (cancelled ones stay listed as CANCELLED)
      setChallans(data.filter((c: any) =>
        (c.toDepartment === 'STORE' || c.toDepartmentCode === 'STORE') &&
        ['ISSUED', 'SUBMITTED', 'DRAFT', 'RECEIVED', 'CANCELLED'].includes(c.status)
      ));
    } catch {
      setChallans([]);
    } finally {
      setLoading(false);
    }
  };

  // Confirm Stock: the fabric is in the store. It only marks the stock confirmed; the next challan is sent with
  // the Store to Dyeing / Store to Embroidery buttons.
  const handleConfirmStock = async (programId: string) => {
    setActionError(null);
    try {
      setActionInProgress(programId);
      const res = await fetch('/api/fabric-store/check-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programId, isAvailable: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setActionError(body.error || 'Could not confirm the stock.');
        return;
      }
      await loadChallans();
    } catch {
      setActionError('Could not confirm the stock.');
    } finally {
      setActionInProgress(null);
    }
  };

  // Not in Stock: the challan is cancelled with a reason (Programming sees it as CANCELLED).
  const DEFAULT_CANCEL_REASON = 'Fabric is not available in the store';
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState(DEFAULT_CANCEL_REASON);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const openCancel = (ch: any) => {
    setCancelReason(DEFAULT_CANCEL_REASON);
    setCancelError(null);
    setCancelTarget(ch);
  };
  const handleNotInStock = async () => {
    const ch = cancelTarget;
    const reason = cancelReason.trim();
    if (!ch) return;
    if (!reason) {
      setCancelError('Enter the reason for cancelling.');
      return;
    }
    setCancelError(null);
    try {
      setActionInProgress(ch.id);
      const res = await fetch(`/api/challans/${ch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED', remarks: `Cancelled by Fabric Store: ${reason}` }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setCancelError(body.error || 'Could not cancel the challan.');
        return;
      }
      setCancelTarget(null);
      await loadChallans();
    } catch {
      setCancelError('Could not cancel the challan.');
    } finally {
      setActionInProgress(null);
    }
  };

  useEffect(() => {
    loadChallans();
  }, []);

  // Receive: the challan's fabrics with MTR and PCS are shown first, then received.
  const [confirmReceive, setConfirmReceive] = useState<any | null>(null);
  const [receiveError, setReceiveError] = useState<string | null>(null);
  const handleMarkReceived = async (challanId: string) => {
    setReceiveError(null);
    try {
      setActionInProgress(challanId);
      const res = await fetch(`/api/challans/${challanId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'RECEIVED' }),
      });
      if (res.ok) {
        setConfirmReceive(null);
        await loadChallans();
      } else {
        const body = await res.json().catch(() => ({}));
        setReceiveError(body.error || 'Failed to receive the challan.');
      }
    } catch (err) {
      console.error('Failed to mark challan received:', err);
      setReceiveError('Failed to receive the challan.');
    } finally {
      setActionInProgress(null);
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-neutral-100 text-neutral-700 border-neutral-200',
      SUBMITTED: 'bg-accent-100 text-accent-800 border-accent-200',
      ISSUED: 'bg-brand-100 text-brand-800 border-brand-200',
      RECEIVED: 'bg-accent-100 text-accent-800 border-accent-200',
      CANCELLED: 'bg-danger-50 text-danger-700 border-danger-200',
    };
    return (
      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${colors[status] || 'bg-neutral-100 text-neutral-700 border-neutral-200'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-brand-50 pb-16">
      <header className="bg-white border-b border-neutral-200/80 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-700 block">FABRIC STORE · MY WORK</span>
          <h1 className="text-xl font-bold text-neutral-900">Incoming Challans</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadChallans}
            disabled={loading}
            className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <main className="p-4 sm:p-8 max-w-6xl mx-auto space-y-4">
        {actionError && (
          <div role="alert" className="px-4 py-2.5 rounded-lg border border-danger-200 bg-danger-50 text-xs font-semibold text-danger-700">
            {actionError}
          </div>
        )}
        <div className="bg-white border border-neutral-200/90 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-neutral-200/80 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-neutral-900">Challans Addressed to Fabric Store</h2>
              <p className="text-[11px] text-neutral-500 mt-0.5">Challans dispatched from Programming or other departments to Fabric Store</p>
            </div>
            <span className="text-xs font-bold text-neutral-500">
              {challans.length} {challans.length === 1 ? 'Challan' : 'Challans'}
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs text-neutral-500">Loading challans…</div>
          ) : challans.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <ArrowDownToLine className="w-10 h-10 text-neutral-700 mx-auto" />
              <p className="text-xs font-semibold text-neutral-700">No incoming challans at this time</p>
              <p className="text-[11px] text-neutral-500">Challans issued from Programming to Fabric Store will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50/80 text-neutral-600 font-semibold border-b border-neutral-200">
                  <tr>
                    <th className="py-2.5 px-4">Challan No.</th>
                    <th className="py-2.5 px-4">Origin</th>
                    <th className="py-2.5 px-4">Program / Client</th>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Description</th>
                    <th className="py-2.5 px-4">Fabric in Store</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-neutral-700">
                  {challans.map((ch: any) => {
                    const isFromProgramming = ch.fromDepartment === 'PROGRAMMING';
                    const progId = ch.programId || ch.program?.id;
                    const progNum = ch.program?.programSerialNo || ch.program?.programNumber || '—';
                    const client = ch.program?.clientName || ch.program?.buyerName || '';
                    const style = ch.program?.mainStyle || ch.program?.styleCode || '';
                    const isCancelled = ch.status === 'CANCELLED';
                    const stockConfirmed = Boolean(progId && availabilityMap[progId]?.isAvailable);

                    return (
                      <tr key={ch.id} className="hover:bg-neutral-50/70 transition">
                        <td className="py-3 px-4">
                          <Link 
                            href={`/challans/${ch.id}`}
                            className="font-mono font-bold text-brand-800 hover:underline flex items-center gap-1.5"
                          >
                            <span>{ch.challanNumber}</span>
                          </Link>
                        </td>

                        <td className="py-3 px-4">
                          {isFromProgramming ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-brand-50 text-brand-800 border border-brand-200">
                              PROGRAMMING
                            </span>
                          ) : (
                            <span className="font-semibold text-neutral-900">{departmentName(ch.fromDepartment)}</span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-mono font-semibold text-neutral-900 block">{progNum}</span>
                          {(client || style) && (
                            <span className="text-[10px] text-neutral-500 block truncate max-w-[180px]">
                              {[client, style].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-[11px] text-neutral-600">
                          {new Date(ch.createdAt).toLocaleDateString()}
                        </td>

                        <td className="py-3 px-4 text-[11px] text-neutral-900 max-w-[220px]">
                          <span className="line-clamp-2">{ch.items?.[0]?.itemDescription || '—'}</span>
                          {(ch.items || []).length > 0 && (
                            <span className="text-[10px] font-mono text-neutral-500 block mt-0.5">
                              Qty: {formatTotals(totalsByUnit(ch.items), '')}
                            </span>
                          )}
                        </td>

                        {/* FABRIC IN STORE: Confirm Stock, or Not in Stock (cancels the challan) */}
                        <td className="py-3 px-4">
                          {isCancelled ? (
                            <span className="text-[10px] text-neutral-500">—</span>
                          ) : (
                            <div className="flex flex-col items-start gap-1">
                              {stockConfirmed ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-accent-800 bg-accent-50 border border-accent-200 px-2 py-0.5 rounded-full">
                                  <Check className="w-3 h-3 text-accent-700" />
                                  <span>Stock Confirmed</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={!progId || actionInProgress === progId}
                                  onClick={() => handleConfirmStock(progId)}
                                  className="inline-flex items-center gap-1 text-[10px] font-bold text-accent-800 bg-accent-100/90 hover:bg-accent-200 border border-accent-300 px-2 py-0.5 rounded transition cursor-pointer disabled:opacity-60"
                                  title="Fabric is in the store"
                                >
                                  <Check className="w-3 h-3 text-accent-700" />
                                  <span>{actionInProgress === progId ? '…' : 'Confirm Stock'}</span>
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={actionInProgress === ch.id}
                                onClick={() => openCancel(ch)}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-danger-700 bg-danger-50 hover:bg-danger-100 border border-danger-200 px-2 py-0.5 rounded transition cursor-pointer disabled:opacity-60"
                                title="Fabric is not in the store: cancel this challan"
                              >
                                <XCircle className="w-3 h-3 text-danger-600" />
                                <span>{actionInProgress === ch.id ? 'Cancelling…' : 'Not in Stock'}</span>
                              </button>
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          {statusBadge(ch.status)}
                          {isCancelled && ch.remarks && (
                            <span className="block text-[10px] text-danger-700 mt-1 max-w-[180px]">{ch.remarks}</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {/* Receive button if status is not yet RECEIVED */}
                            {ch.status !== 'RECEIVED' && !isCancelled && (
                              <button
                                type="button"
                                disabled={actionInProgress === ch.id}
                                onClick={() => {
                                  setReceiveError(null);
                                  setConfirmReceive(ch);
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-accent-800 hover:text-accent-800 bg-accent-50 hover:bg-accent-100 border border-accent-200 px-2 py-1 rounded transition cursor-pointer"
                                title="Mark as received in Fabric Store"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-accent-700" />
                                <span>{actionInProgress === ch.id ? 'Saving…' : 'Receive'}</span>
                              </button>
                            )}

                            {/* NEXT DEPARTMENT MOVEMENT BUTTONS */}
                            {isCancelled ? null : ch.program?.fabricDyeingRequired ? (
                                <>
                                  <Link
                                    href={`/fabric-store/my-work/challan-to-dyeing?programId=${progId || ''}`}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-800 hover:text-brand-900 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-2 py-1 rounded transition"
                                    title="Issue next challan to Dyeing Department"
                                  >
                                    <Send className="w-3.5 h-3.5 text-brand-600" />
                                    <span>Store to Dyeing</span>
                                  </Link>
                                  <Link
                                    href={`/fabric-store/my-work/challan-to-embroidery?programId=${progId || ''}`}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-accent-800 hover:text-accent-800 bg-accent-50 hover:bg-accent-100 border border-accent-200 px-2 py-1 rounded transition"
                                    title="Issue next challan to Embroidery Department"
                                  >
                                    <Send className="w-3.5 h-3.5 text-accent-700" />
                                    <span>Store to Embroidery</span>
                                  </Link>
                                </>
                              ) : (
                                <>
                                  <Link
                                    href={`/fabric-store/my-work/challan-to-embroidery?programId=${progId || ''}`}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-accent-800 hover:text-accent-800 bg-accent-50 hover:bg-accent-100 border border-accent-200 px-2 py-1 rounded transition"
                                    title="Issue next challan to Embroidery Department"
                                  >
                                    <Send className="w-3.5 h-3.5 text-accent-700" />
                                    <span>Store to Embroidery</span>
                                  </Link>
                                  <Link
                                    href={`/fabric-store/my-work/challan-to-dyeing?programId=${progId || ''}`}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-800 hover:text-brand-900 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-2 py-1 rounded transition"
                                    title="Issue next challan to Dyeing Department"
                                  >
                                    <Send className="w-3.5 h-3.5 text-brand-600" />
                                    <span>Store to Dyeing</span>
                                  </Link>
                                </>
                              )}

                            <TransferDocuments challan={ch} size="xs" />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Production Sheet Print & Download Modal */}
      {confirmReceive && (
        <ReceiveChallanConfirm
          challan={confirmReceive}
          busy={actionInProgress === confirmReceive.id}
          error={receiveError}
          onConfirm={() => handleMarkReceived(confirmReceive.id)}
          onClose={() => setConfirmReceive(null)}
        />
      )}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 p-4" role="dialog" aria-modal="true" aria-labelledby="cancel-challan-title">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-5 space-y-4">
            <div>
              <h3 id="cancel-challan-title" className="text-sm font-bold text-neutral-900">Cancel challan {cancelTarget.challanNumber}</h3>
              <p className="text-[11px] text-neutral-500 mt-0.5">The challan is cancelled and Programming sees it as CANCELLED with this reason.</p>
            </div>
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold text-neutral-700">Reason <span className="text-danger-600">*</span></span>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                autoFocus
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </label>
            {cancelError && <p role="alert" className="text-[11px] font-semibold text-danger-700">{cancelError}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                disabled={actionInProgress === cancelTarget.id}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-700 border border-neutral-300 hover:bg-neutral-50"
              >
                Keep Challan
              </button>
              <button
                type="button"
                onClick={handleNotInStock}
                disabled={actionInProgress === cancelTarget.id}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-danger-600 hover:bg-danger-700 disabled:opacity-60"
              >
                {actionInProgress === cancelTarget.id ? 'Cancelling…' : 'Cancel Challan'}
              </button>
            </div>
          </div>
        </div>
      )}
      <ProductionSheetPrintModal
        program={selectedSheetModal}
        isOpen={!!selectedSheetModal}
        onClose={() => setSelectedSheetModal(null)}
      />
    </div>
  );
}
