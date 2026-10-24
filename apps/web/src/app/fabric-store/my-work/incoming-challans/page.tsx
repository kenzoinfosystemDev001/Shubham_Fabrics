'use client';

import React, { useState, useEffect } from 'react';
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
  Lock,
  Check,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  PackagePlus,
} from 'lucide-react';
import { DocumentActionButtons } from '@/components/common/DocumentActionButtons';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';

export default function IncomingChallansPage() {
  const [loading, setLoading] = useState(true);
  const [challans, setChallans] = useState<any[]>([]);
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, any>>({});
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
            if (item.programNumber) map[item.programNumber] = item;
          }
        }
        setAvailabilityMap(map);
      }

      // Filter: addressed to store and active
      setChallans(data.filter((c: any) => 
        (c.toDepartment === 'STORE' || c.toDepartmentCode === 'STORE') && 
        ['ISSUED', 'SUBMITTED', 'DRAFT', 'RECEIVED'].includes(c.status)
      ));
    } catch {
      setChallans([]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickVerify = async (programId: string, isAvailable: boolean) => {
    try {
      setActionInProgress(programId);
      const res = await fetch('/api/fabric-store/check-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programId, isAvailable }),
      });
      if (res.ok) {
        await loadChallans();
      }
    } catch (err) {
      console.error('Failed to update fabric availability:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  useEffect(() => {
    loadChallans();
  }, []);

  const handleMarkReceived = async (challanId: string) => {
    try {
      setActionInProgress(challanId);
      const res = await fetch(`/api/challans/${challanId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'RECEIVED' }),
      });
      if (res.ok) {
        await loadChallans();
      }
    } catch (err) {
      console.error('Failed to mark challan received:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-slate-100 text-slate-700 border-slate-200',
      SUBMITTED: 'bg-amber-100 text-amber-800 border-amber-200',
      ISSUED: 'bg-blue-100 text-blue-800 border-blue-200',
      RECEIVED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    };
    return (
      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${colors[status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-ink-50 pb-16">
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-700 block">FABRIC STORE · MY WORK</span>
          <h1 className="text-xl font-bold text-slate-900">Incoming Challans</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadChallans}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <main className="p-4 sm:p-8 max-w-6xl mx-auto space-y-4">
        <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200/80 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Challans Addressed to Fabric Store</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Challans dispatched from Programming or other departments to Fabric Store</p>
            </div>
            <span className="text-xs font-bold text-slate-500">
              {challans.length} {challans.length === 1 ? 'Challan' : 'Challans'}
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading challans…</div>
          ) : challans.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <ArrowDownToLine className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">No incoming challans at this time</p>
              <p className="text-[11px] text-slate-500">Challans issued from Programming to Fabric Store will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
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
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {challans.map((ch: any) => {
                    const isFromProgramming = ch.fromDepartment === 'PROGRAMMING';
                    const progId = ch.programId || ch.program?.id;
                    const progNum = ch.program?.programSerialNo || ch.program?.programNumber || '—';
                    const client = ch.program?.clientName || ch.program?.buyerName || '';
                    const style = ch.program?.mainStyle || ch.program?.styleCode || '';
                    const avail = progId ? availabilityMap[progId] : null;
                    const isFabricInStore = avail ? avail.isAvailable : false;

                    return (
                      <tr key={ch.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4">
                          <Link 
                            href={`/challans/${ch.id}`}
                            className="font-mono font-bold text-teal-800 hover:underline flex items-center gap-1.5"
                          >
                            <span>{ch.challanNumber}</span>
                          </Link>
                        </td>

                        <td className="py-3 px-4">
                          {isFromProgramming ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                              PROGRAMMING
                            </span>
                          ) : (
                            <span className="font-semibold text-slate-800">{ch.fromDepartment}</span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-mono font-semibold text-slate-900 block">{progNum}</span>
                          {(client || style) && (
                            <span className="text-[10px] text-slate-500 block truncate max-w-[180px]">
                              {[client, style].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-[11px] text-slate-600">
                          {new Date(ch.createdAt).toLocaleDateString()}
                        </td>

                        <td className="py-3 px-4 text-[11px] text-slate-800 max-w-[220px]">
                          <span className="line-clamp-2">{ch.items?.[0]?.itemDescription || '—'}</span>
                          {ch.items?.[0]?.quantity && (
                            <span className="text-[10px] font-mono text-slate-500 block mt-0.5">
                              Qty: {ch.items[0].quantity} {ch.items[0].uom || 'PCS'}
                            </span>
                          )}
                        </td>

                        {/* FABRIC IN STORE STATUS */}
                        <td className="py-3 px-4">
                          {avail ? (
                            isFabricInStore ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span>In Store ({avail.totalStoreStockMeters} M)</span>
                                </span>
                                <button
                                  type="button"
                                  disabled={actionInProgress === progId}
                                  onClick={() => handleQuickVerify(progId, false)}
                                  className="block text-[9px] text-rose-600 hover:underline font-medium cursor-pointer"
                                  title="Mark Out of Stock / Hold"
                                >
                                  Hold Sheet
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                                  <Lock className="w-3 h-3 text-rose-600" />
                                  <span>Not in Store</span>
                                </span>
                                <button
                                  type="button"
                                  disabled={actionInProgress === progId}
                                  onClick={() => handleQuickVerify(progId, true)}
                                  className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-100/90 hover:bg-emerald-200 border border-emerald-300 px-1.5 py-0.5 rounded transition cursor-pointer"
                                  title="Store incharge confirms fabric received in store"
                                >
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span>{actionInProgress === progId ? '…' : 'Confirm Stock'}</span>
                                </button>
                              </div>
                            )
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Checking…</span>
                          )}
                        </td>

                        <td className="py-3 px-4">{statusBadge(ch.status)}</td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {/* Receive button if status is not yet RECEIVED */}
                            {ch.status !== 'RECEIVED' && (
                              <button
                                type="button"
                                disabled={actionInProgress === ch.id}
                                onClick={() => handleMarkReceived(ch.id)}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded transition cursor-pointer"
                                title="Mark as received in Fabric Store"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>{actionInProgress === ch.id ? 'Saving…' : 'Receive'}</span>
                              </button>
                            )}

                            {/* NEXT DEPARTMENT MOVEMENT BUTTONS (GATED BY FABRIC AVAILABILITY) */}
                            {isFabricInStore ? (
                              ch.program?.fabricDyeingRequired ? (
                                <>
                                  <Link
                                    href={`/fabric-store/my-work/challan-to-dyeing?programId=${progId || ''}`}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-800 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-1 rounded transition"
                                    title="Issue next challan to Dyeing Department"
                                  >
                                    <Send className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>Store to Dyeing</span>
                                  </Link>
                                  <Link
                                    href={`/fabric-store/my-work/challan-to-embroidery?programId=${progId || ''}`}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded transition"
                                    title="Issue next challan to Embroidery Department"
                                  >
                                    <Send className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Store to Embroidery</span>
                                  </Link>
                                </>
                              ) : (
                                <>
                                  <Link
                                    href={`/fabric-store/my-work/challan-to-embroidery?programId=${progId || ''}`}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded transition"
                                    title="Issue next challan to Embroidery Department"
                                  >
                                    <Send className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Store to Embroidery</span>
                                  </Link>
                                  <Link
                                    href={`/fabric-store/my-work/challan-to-dyeing?programId=${progId || ''}`}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-800 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-1 rounded transition"
                                    title="Issue next challan to Dyeing Department"
                                  >
                                    <Send className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>Store to Dyeing</span>
                                  </Link>
                                </>
                              )
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 bg-slate-100 border border-slate-200 px-2 py-1 rounded cursor-not-allowed opacity-80"
                                title="Fabric is not available in Fabric Store. Production sheet cannot move to next department until fabric arrives."
                              >
                                <Lock className="w-3 h-3 text-slate-400" />
                                <span>Held (Need Fabric)</span>
                              </span>
                            )}

                            <DocumentActionButtons
                              challan={ch}
                              program={ch.program}
                              size="xs"
                            />
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
      <ProductionSheetPrintModal
        program={selectedSheetModal}
        isOpen={!!selectedSheetModal}
        onClose={() => setSelectedSheetModal(null)}
      />
    </div>
  );
}
