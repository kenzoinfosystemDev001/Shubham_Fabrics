'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Kanban, 
  RefreshCw, 
  FilePlus, 
  Send, 
  Clock, 
  CheckCircle2, 
  Layers, 
  ArrowRight, 
  Calendar,
  AlertCircle
} from 'lucide-react';
import { api } from '@/lib/api';

export default function ProgrammingFloorBoardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [programs, setPrograms] = useState<any[]>([]);
  const [challans, setChallans] = useState<any[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [programsData, challansData] = await Promise.all([
        api.getPrograms().catch(() => []),
        api.getChallans().catch(() => []),
      ]);
      setPrograms(programsData || []);
      setChallans(challansData || []);
    } catch (err) {
      console.error('Failed to load floor board data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('subham_mes_user');
      if (!savedUser) {
        router.push('/login');
        return;
      }
    }
    loadData();
  }, [router]);

  // Group programs by status lane
  const draftLane = programs.filter(p => p.status === 'DRAFT');
  const inProgressLane = programs.filter(p => p.status === 'IN_PROGRESS' || p.status === 'SUBMITTED');
  const readyLane = programs.filter(p => p.status === 'READY_FOR_ISSUE' || p.status === 'APPROVED');
  const issuedLane = programs.filter(p => p.status === 'ISSUED' || p.status === 'IN_PRODUCTION' || p.status === 'COMPLETED');

  return (
    <div className="min-h-screen bg-[#F8FAFC] pl-0 md:pl-64 pb-16">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A66E22] block">
            SHUBHAM FABRICS MES · OPERATIONS BOARD
          </span>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Kanban className="w-5 h-5 text-[#163767]" />
            <span>Programming Department Floor Board</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition"
            title="Refresh Board"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          
          <Link
            href="/my-work/create-production-sheet"
            className="flex items-center gap-2 px-3.5 py-2 bg-[#163767] hover:bg-[#0F264A] text-white text-xs font-semibold rounded-md shadow-xs transition"
          >
            <FilePlus className="w-4 h-4" />
            <span>New Production Sheet</span>
          </Link>
        </div>
      </header>

      {/* PIPELINE SUMMARY STATS */}
      <div className="px-4 sm:px-8 pt-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-white border border-slate-200/90 rounded-xl shadow-xs">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total In Pipeline</span>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{programs.length} Sheets</p>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Drafts / Authoring</span>
            <p className="text-xl font-bold text-amber-600 mt-0.5">{draftLane.length} Sheets</p>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Awaiting Challan Issue</span>
            <p className="text-xl font-bold text-indigo-600 mt-0.5">{readyLane.length} Sheets</p>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Dispatched Downstream</span>
            <p className="text-xl font-bold text-emerald-600 mt-0.5">{issuedLane.length} Sheets</p>
          </div>
        </div>
      </div>

      {/* 4-COLUMN KANBAN SWIMLANES */}
      <main className="px-4 sm:px-8 pt-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          
          {/* COLUMN 1: DRAFT */}
          <div className="bg-slate-100/70 border border-slate-200 rounded-xl p-3 flex flex-col min-h-[400px] md:h-[calc(100vh-230px)]">
            <div className="flex items-center justify-between pb-3 px-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Draft Sheets
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white text-slate-700 shadow-xs">
                {draftLane.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pt-3 pr-1">
              {draftLane.map((prog) => (
                <div
                  key={prog.id}
                  className="bg-white border border-slate-200 hover:border-amber-400 rounded-lg p-3.5 shadow-xs transition space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-slate-900">
                      {prog.programSerialNo || prog.programNumber}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">
                      {prog.deliveryDate ? new Date(prog.deliveryDate).toLocaleDateString() : ''}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-800 truncate">
                      {prog.clientName || prog.buyerName || 'Standard Client'}
                    </h4>
                    <p className="text-[11px] text-slate-500 truncate">
                      {prog.mainStyle || prog.styleCode} · {prog.fabricName || 'Cotton'}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="font-mono font-semibold text-slate-600">
                      {prog.colorQuantity || prog.targetQuantity} PCS
                    </span>
                    <Link
                      href={`/programs/${prog.id}`}
                      className="text-blue-700 hover:underline font-semibold"
                    >
                      Edit Sheet →
                    </Link>
                  </div>
                </div>
              ))}
              {draftLane.length === 0 && (
                <p className="text-center text-xs text-slate-400 py-8">No draft sheets</p>
              )}
            </div>
          </div>

          {/* COLUMN 2: IN PROGRESS */}
          <div className="bg-slate-100/70 border border-slate-200 rounded-xl p-3 flex flex-col h-[calc(100vh-230px)]">
            <div className="flex items-center justify-between pb-3 px-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  In Progress
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white text-slate-700 shadow-xs">
                {inProgressLane.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pt-3 pr-1">
              {inProgressLane.map((prog) => (
                <div
                  key={prog.id}
                  className="bg-white border border-slate-200 hover:border-blue-400 rounded-lg p-3.5 shadow-xs transition space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-slate-900">
                      {prog.programSerialNo || prog.programNumber}
                    </span>
                    {prog.wilcomDesignNumber && (
                      <span className="text-[10px] font-mono font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">
                        W: {prog.wilcomDesignNumber}
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-800 truncate">
                      {prog.clientName || prog.buyerName}
                    </h4>
                    <p className="text-[11px] text-slate-500 truncate">
                      {prog.mainStyle || prog.styleCode} ({prog.fabricColor || 'Natural'})
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="font-mono font-semibold text-slate-600">
                      {prog.colorQuantity || prog.targetQuantity} PCS
                    </span>
                    <Link
                      href={`/programs/${prog.id}`}
                      className="text-blue-700 hover:underline font-semibold"
                    >
                      View Details →
                    </Link>
                  </div>
                </div>
              ))}
              {inProgressLane.length === 0 && (
                <p className="text-center text-xs text-slate-400 py-8">No sheets in progress</p>
              )}
            </div>
          </div>

          {/* COLUMN 3: READY FOR ISSUE */}
          <div className="bg-indigo-50/40 border border-indigo-200 rounded-xl p-3 flex flex-col h-[calc(100vh-230px)]">
            <div className="flex items-center justify-between pb-3 px-2 border-b border-indigo-200">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse"></span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-950">
                  Ready for Issue
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white text-indigo-900 shadow-xs">
                {readyLane.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pt-3 pr-1">
              {readyLane.map((prog) => (
                <div
                  key={prog.id}
                  className="bg-white border-2 border-indigo-200 hover:border-indigo-500 rounded-lg p-3.5 shadow-xs transition space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-indigo-950">
                      {prog.programSerialNo || prog.programNumber}
                    </span>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                      APPROVED
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-900 truncate">
                      {prog.clientName || prog.buyerName}
                    </h4>
                    <p className="text-[11px] text-slate-600 truncate">
                      {prog.mainStyle || prog.styleCode} · {prog.fabricName || 'Cotton'}
                    </p>
                  </div>

                  {prog.fabricDyeingRequired && (
                    <div className="text-[10px] font-semibold text-rose-700 bg-rose-50 p-1.5 rounded">
                      Dyeing required prior to Embroidery
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-slate-800">
                      {prog.colorQuantity || prog.targetQuantity} PCS
                    </span>
                    <Link
                      href={`/my-work/issue-challan?programId=${prog.id}`}
                      className="px-2.5 py-1 bg-indigo-700 hover:bg-indigo-800 text-white text-[11px] font-semibold rounded shadow-xs transition flex items-center gap-1"
                    >
                      <Send className="w-3 h-3" />
                      <span>Issue Challan</span>
                    </Link>
                  </div>
                </div>
              ))}
              {readyLane.length === 0 && (
                <p className="text-center text-xs text-slate-400 py-8">No sheets pending issue</p>
              )}
            </div>
          </div>

          {/* COLUMN 4: ISSUED & ACTIVE */}
          <div className="bg-emerald-50/40 border border-emerald-200 rounded-xl p-3 flex flex-col h-[calc(100vh-230px)]">
            <div className="flex items-center justify-between pb-3 px-2 border-b border-emerald-200">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-950">
                  Issued &amp; Active
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white text-emerald-900 shadow-xs">
                {issuedLane.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pt-3 pr-1">
              {issuedLane.map((prog) => (
                <div
                  key={prog.id}
                  className="bg-white border border-slate-200 hover:border-emerald-500 rounded-lg p-3.5 shadow-xs transition space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-slate-900">
                      {prog.programSerialNo || prog.programNumber}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      DISPATCHED
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-800 truncate">
                      {prog.clientName || prog.buyerName}
                    </h4>
                    <p className="text-[11px] text-slate-500 truncate">
                      {prog.mainStyle || prog.styleCode}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Challan Dispatched</span>
                    </span>
                    <Link
                      href={`/programs/${prog.id}`}
                      className="text-slate-600 hover:text-slate-900 font-semibold"
                    >
                      View →
                    </Link>
                  </div>
                </div>
              ))}
              {issuedLane.length === 0 && (
                <p className="text-center text-xs text-slate-400 py-8">No issued programs yet</p>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
