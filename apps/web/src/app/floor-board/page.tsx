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
  AlertCircle,
  Eye,
  Download,
  Printer,
  FileText
} from 'lucide-react';
import { api } from '@/lib/api';
import { DocumentActionButtons } from '@/components/common/DocumentActionButtons';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';
import { downloadProductionSheetHtml, printProductionSheet } from '@/lib/download-production-sheet';

export default function ProgrammingFloorBoardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [programs, setPrograms] = useState<any[]>([]);
  const [challans, setChallans] = useState<any[]>([]);
  const [selectedSheetForView, setSelectedSheetForView] = useState<any | null>(null);

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
    <div className="min-h-screen bg-neutral-50 pl-0 md:pl-64 pb-16">
      {/* HEADER */}
      <header className="bg-white border-b border-neutral-200/80 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-700 block">
            SHUBHAM FABRICS MES · OPERATIONS BOARD
          </span>
          <h1 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
            <Kanban className="w-5 h-5 text-brand-600" />
            <span>Programming Department Floor Board</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition"
            title="Refresh Board"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          
          <Link
            href="/my-work/create-production-sheet"
            className="flex items-center gap-2 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-md shadow-xs transition"
          >
            <FilePlus className="w-4 h-4" />
            <span>New Production Sheet</span>
          </Link>
        </div>
      </header>

      {/* PIPELINE SUMMARY STATS */}
      <div className="px-4 sm:px-8 pt-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-white border border-neutral-200/90 rounded-xl shadow-xs">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Total In Pipeline</span>
            <p className="text-xl font-bold text-neutral-900 mt-0.5">{programs.length} Sheets</p>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-700">Drafts / Authoring</span>
            <p className="text-xl font-bold text-neutral-900 mt-0.5">{draftLane.length} Sheets</p>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600">Awaiting Challan Issue</span>
            <p className="text-xl font-bold text-brand-600 mt-0.5">{readyLane.length} Sheets</p>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-700">Dispatched Downstream</span>
            <p className="text-xl font-bold text-neutral-900 mt-0.5">{issuedLane.length} Sheets</p>
          </div>
        </div>
      </div>

      {/* 4-COLUMN KANBAN SWIMLANES */}
      <main className="px-4 sm:px-8 pt-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          
          {/* COLUMN 1: DRAFT */}
          <div className="bg-neutral-100/70 border border-neutral-200 rounded-xl p-3 flex flex-col min-h-[400px] md:h-[calc(100vh-230px)]">
            <div className="flex items-center justify-between pb-3 px-2 border-b border-neutral-200">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-accent-400"></span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900">
                  Draft Sheets
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white text-neutral-700 shadow-xs">
                {draftLane.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pt-3 pr-1">
              {draftLane.map((prog) => (
                <div
                  key={prog.id}
                  className="bg-white border border-neutral-200 hover:border-accent-500 rounded-lg p-3.5 shadow-xs transition space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-neutral-900">
                      {prog.programSerialNo || prog.programNumber}
                    </span>
                    <span className="text-[10px] font-semibold text-neutral-500">
                      {prog.deliveryDate ? new Date(prog.deliveryDate).toLocaleDateString() : ''}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-neutral-900 truncate">
                      {prog.clientName || prog.buyerName || 'Standard Client'}
                    </h4>
                    <p className="text-[11px] text-neutral-500 truncate">
                      {prog.mainStyle || prog.styleCode} · {prog.fabricName || 'Cotton'}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px]">
                    <span className="font-mono font-semibold text-neutral-600">
                      {prog.colorQuantity || prog.targetQuantity} PCS
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setSelectedSheetForView(prog)}
                        className="p-1 hover:bg-brand-50 text-brand-700 rounded transition"
                        title="View Production Sheet"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadProductionSheetHtml(prog)}
                        className="p-1 hover:bg-brand-50 text-brand-700 rounded transition"
                        title="Download Production Sheet HTML"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => printProductionSheet(prog)}
                        className="p-1 hover:bg-neutral-100 text-neutral-700 rounded transition"
                        title="Print Production Sheet"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      <Link
                        href={`/programs/${prog.id}`}
                        className="text-brand-700 hover:underline font-semibold ml-1"
                      >
                        Edit →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
              {draftLane.length === 0 && (
                <p className="text-center text-xs text-neutral-500 py-8">No draft sheets</p>
              )}
            </div>
          </div>

          {/* COLUMN 2: IN PROGRESS */}
          <div className="bg-neutral-100/70 border border-neutral-200 rounded-xl p-3 flex flex-col min-h-[400px] md:h-[calc(100vh-230px)]">
            <div className="flex items-center justify-between pb-3 px-2 border-b border-neutral-200">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-500"></span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900">
                  In Progress
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white text-neutral-700 shadow-xs">
                {inProgressLane.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pt-3 pr-1">
              {inProgressLane.map((prog) => (
                <div
                  key={prog.id}
                  className="bg-white border border-neutral-200 hover:border-brand-500 rounded-lg p-3.5 shadow-xs transition space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-neutral-900">
                      {prog.programSerialNo || prog.programNumber}
                    </span>
                    {prog.wilcomDesignNumber && (
                      <span className="text-[10px] font-mono font-semibold text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded">
                        W: {prog.wilcomDesignNumber}
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-neutral-900 truncate">
                      {prog.clientName || prog.buyerName}
                    </h4>
                    <p className="text-[11px] text-neutral-500 truncate">
                      {prog.mainStyle || prog.styleCode} ({prog.fabricColor || 'Natural'})
                    </p>
                  </div>

                  <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] flex-wrap gap-1">
                    <span className="font-mono font-semibold text-neutral-600">
                      {prog.colorQuantity || prog.targetQuantity} PCS
                    </span>
                    <DocumentActionButtons
                      program={prog}
                      challan={challans.find((c) => c.programId === prog.id)}
                      size="xs"
                    />
                  </div>
                </div>
              ))}
              {inProgressLane.length === 0 && (
                <p className="text-center text-xs text-neutral-500 py-8">No sheets in progress</p>
              )}
            </div>
          </div>

          {/* COLUMN 3: READY FOR ISSUE */}
          <div className="bg-brand-50/40 border border-brand-200 rounded-xl p-3 flex flex-col min-h-[400px] md:h-[calc(100vh-230px)]">
            <div className="flex items-center justify-between pb-3 px-2 border-b border-brand-200">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-600 animate-pulse"></span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-brand-900">
                  Ready for Issue
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white text-brand-900 shadow-xs">
                {readyLane.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pt-3 pr-1">
              {readyLane.map((prog) => (
                <div
                  key={prog.id}
                  className="bg-white border-2 border-brand-200 hover:border-brand-500 rounded-lg p-3.5 shadow-xs transition space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-brand-900">
                      {prog.programSerialNo || prog.programNumber}
                    </span>
                    <span className="text-[10px] font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded">
                      APPROVED
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-neutral-900 truncate">
                      {prog.clientName || prog.buyerName}
                    </h4>
                    <p className="text-[11px] text-neutral-600 truncate">
                      {prog.mainStyle || prog.styleCode} · {prog.fabricName || 'Cotton'}
                    </p>
                  </div>

                  {prog.fabricDyeingRequired && (
                    <div className="text-[10px] font-semibold text-danger-700 bg-danger-50 p-1.5 rounded">
                      Dyeing required prior to Embroidery
                    </div>
                  )}

                  <div className="pt-2 border-t border-neutral-100 flex items-center justify-between flex-wrap gap-1">
                    <span className="font-mono font-bold text-xs text-neutral-900">
                      {prog.colorQuantity || prog.targetQuantity} PCS
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <DocumentActionButtons
                        program={prog}
                        challan={challans.find((c) => c.programId === prog.id)}
                        size="xs"
                      />
                      <Link
                        href={`/my-work/issue-challan?programId=${prog.id}`}
                        className="px-2 py-0.5 bg-brand-700 hover:bg-brand-800 text-white text-[11px] font-semibold rounded shadow-xs transition flex items-center gap-1"
                      >
                        <Send className="w-3 h-3" />
                        <span>Issue</span>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
              {readyLane.length === 0 && (
                <p className="text-center text-xs text-neutral-500 py-8">No sheets pending issue</p>
              )}
            </div>
          </div>

          {/* COLUMN 4: ISSUED & ACTIVE */}
          <div className="bg-accent-50/40 border border-accent-200 rounded-xl p-3 flex flex-col min-h-[400px] md:h-[calc(100vh-230px)]">
            <div className="flex items-center justify-between pb-3 px-2 border-b border-accent-200">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-accent-400"></span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                  Issued &amp; Active
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white text-accent-800 shadow-xs">
                {issuedLane.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pt-3 pr-1">
              {issuedLane.map((prog) => (
                <div
                  key={prog.id}
                  className="bg-white border border-neutral-200 hover:border-accent-500 rounded-lg p-3.5 shadow-xs transition space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-neutral-900">
                      {prog.programSerialNo || prog.programNumber}
                    </span>
                    <span className="text-[10px] font-bold text-accent-800 bg-accent-50 px-2 py-0.5 rounded">
                      DISPATCHED
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-neutral-900 truncate">
                      {prog.clientName || prog.buyerName}
                    </h4>
                    <p className="text-[11px] text-neutral-500 truncate">
                      {prog.mainStyle || prog.styleCode}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] flex-wrap gap-1">
                    <DocumentActionButtons
                      program={prog}
                      challan={challans.find((c) => c.programId === prog.id)}
                      size="xs"
                    />
                    <Link
                      href={`/programs/${prog.id}`}
                      className="text-neutral-600 hover:text-neutral-900 font-semibold"
                    >
                      View →
                    </Link>
                  </div>
                </div>
              ))}
              {issuedLane.length === 0 && (
                <p className="text-center text-xs text-neutral-500 py-8">No issued programs yet</p>
              )}
            </div>
          </div>

        </div>
      </main>
      {/* PRODUCTION SHEET PRINT MODAL */}
      {selectedSheetForView && (
        <ProductionSheetPrintModal
          isOpen={true}
          onClose={() => setSelectedSheetForView(null)}
          program={selectedSheetForView}
        />
      )}
    </div>
  );
}
