'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Kanban,
  RefreshCw,
  Scissors,
  CheckCircle2,
  Clock,
  Briefcase,
  Layers,
  ArrowRight,
  PackageCheck,
  ShieldCheck,
  Send
} from 'lucide-react';
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';

export default function ThreadCuttingFloorBoardPage() {
  const [loading, setLoading] = useState(true);
  const [incomingChallans, setIncomingChallans] = useState<any[]>([]);
  const [outgoingChallans, setOutgoingChallans] = useState<any[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/thread-cutting/dashboard');
      const json = await res.json();
      if (json.success) {
        setIncomingChallans(json.data.incomingChallans || []);
        setOutgoingChallans(json.data.outgoingChallans || []);
      }
    } catch (err) {
      console.error('Error loading floorboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const stagedFromEmbroidery = incomingChallans.filter(
    (c) => c.status === 'ISSUED' || c.status === 'DRAFT'
  );
  const activeInTrimming = incomingChallans.filter(
    (c) => c.status === 'RECEIVED' || c.status === 'IN_PROGRESS'
  );
  const trimmingCompleted = incomingChallans.filter(
    (c) => c.status === 'COMPLETED'
  );
  const dispatchedToQc2 = outgoingChallans;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
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
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400 block drop-shadow-sm">
              SHUBHAM FABRICS MES · FLOOR BOARD
            </span>
            <h1 className="text-xl font-bold text-white flex items-center gap-2.5 drop-shadow-sm">
              <Kanban className="w-5 h-5 text-amber-400" />
              <span>Thread Cutting Floor Board</span>
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-lg border border-slate-700/60 transition"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <Link
              href="/thread-cutting/my-work"
              className="flex items-center gap-2 px-3.5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
            >
              <Briefcase className="w-4 h-4" />
              <span>My Work</span>
            </Link>

            <Link
              href="/thread-cutting"
              className="px-3 py-2 bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* KANBAN BOARD CONTENT */}
      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* COLUMN 1: INCOMING FROM EMBROIDERY */}
          <div className="bg-slate-100/90 border border-slate-200 rounded-2xl p-4 flex flex-col space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  1. From Embroidery
                </h3>
              </div>
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-white text-cyan-800 border border-slate-200">
                {stagedFromEmbroidery.length}
              </span>
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto">
              {stagedFromEmbroidery.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs bg-white/60 rounded-xl border border-dashed border-slate-200">
                  No pending arrivals
                </div>
              ) : (
                stagedFromEmbroidery.map((ch: any) => (
                  <div key={ch.id} className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate-900">{ch.challanNumber}</span>
                      <span className="text-[10px] font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded">
                        STAGED
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 line-clamp-1">
                      {ch.program?.mainStyle || 'Garment Panel'}
                    </p>
                    <div className="flex justify-between items-center text-[11px] pt-1 border-t border-slate-100">
                      <span className="font-mono text-fuchsia-700 font-bold">{ch.program?.wilcomDesignNumber || 'WLC'}</span>
                      <span className="font-mono font-bold text-slate-900">
                        {(ch.items || []).reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0)} PCS
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* COLUMN 2: ACTIVE THREAD TRIMMING */}
          <div className="bg-slate-100/90 border border-slate-200 rounded-2xl p-4 flex flex-col space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  2. In Trimming
                </h3>
              </div>
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-white text-amber-800 border border-slate-200">
                {activeInTrimming.length}
              </span>
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto">
              {activeInTrimming.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs bg-white/60 rounded-xl border border-dashed border-slate-200">
                  No lots currently in trimming
                </div>
              ) : (
                activeInTrimming.map((ch: any) => (
                  <div key={ch.id} className="p-3.5 bg-white rounded-xl border border-amber-300 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate-900">{ch.challanNumber}</span>
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                        TRIMMING
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 line-clamp-1">
                      {ch.program?.mainStyle || 'Embroidered Panel'}
                    </p>
                    <div className="flex justify-between items-center text-[11px] pt-1 border-t border-slate-100">
                      <span className="font-mono text-fuchsia-700 font-bold">{ch.program?.wilcomDesignNumber || 'WLC'}</span>
                      <span className="font-mono font-bold text-slate-900">
                        {(ch.items || []).reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0)} PCS
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* COLUMN 3: PIECES RECONCILED / READY */}
          <div className="bg-slate-100/90 border border-slate-200 rounded-2xl p-4 flex flex-col space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  3. Count Verified
                </h3>
              </div>
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-white text-blue-800 border border-slate-200">
                {trimmingCompleted.length}
              </span>
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto">
              {trimmingCompleted.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs bg-white/60 rounded-xl border border-dashed border-slate-200">
                  Lots appear here once pieces are counted
                </div>
              ) : (
                trimmingCompleted.map((ch: any) => (
                  <div key={ch.id} className="p-3.5 bg-white rounded-xl border border-blue-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate-900">{ch.challanNumber}</span>
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                        VERIFIED
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 line-clamp-1">
                      {ch.program?.mainStyle || 'Finished Panels'}
                    </p>
                    <div className="flex justify-between items-center text-[11px] pt-1 border-t border-slate-100">
                      <span className="font-mono text-fuchsia-700 font-bold">{ch.program?.wilcomDesignNumber || 'WLC'}</span>
                      <span className="font-mono font-bold text-slate-900">
                        {(ch.items || []).reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0)} PCS
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* COLUMN 4: DISPATCHED TO QC2 */}
          <div className="bg-slate-100/90 border border-slate-200 rounded-2xl p-4 flex flex-col space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  4. Dispatched to QC2
                </h3>
              </div>
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-white text-emerald-800 border border-slate-200">
                {dispatchedToQc2.length}
              </span>
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto">
              {dispatchedToQc2.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs bg-white/60 rounded-xl border border-dashed border-slate-200">
                  No challans dispatched to QC2 yet
                </div>
              ) : (
                dispatchedToQc2.map((ch: any) => (
                  <div key={ch.id} className="p-3.5 bg-white rounded-xl border border-emerald-300 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate-900">{ch.challanNumber}</span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        AT QC2
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 line-clamp-1">
                      {ch.program?.mainStyle || 'Trimmed Panels'}
                    </p>
                    <div className="flex justify-between items-center text-[11px] pt-1 border-t border-slate-100">
                      <span className="font-mono text-emerald-700 font-bold">To: QC2</span>
                      <span className="font-mono font-bold text-slate-900">
                        {(ch.items || []).reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0)} PCS
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
