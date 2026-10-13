'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  History,
  Search,
  Filter,
  RefreshCw,
  Printer,
  Download,
  Eye,
  Send,
  Calendar,
  Layers,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Tag,
  ArrowRight,
  ChevronRight,
  Truck,
  Droplet,
  Scissors,
  X
} from 'lucide-react';
import { api } from '@/lib/api';
import {
  downloadProductionSheetHtml,
  printProductionSheet,
} from '@/lib/download-production-sheet';

export default function ProductionHistoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [programs, setPrograms] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedDyeing, setSelectedDyeing] = useState('ALL');
  const [selectedPriority, setSelectedPriority] = useState('ALL');
  const [expandedProgramId, setExpandedProgramId] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/programs');
      if (!res.ok) throw new Error('Failed to fetch programs');
      const data = await res.json();
      setPrograms(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load production history:', err);
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
    fetchHistory();
  }, [router]);

  // Client-side instant filter across all fields
  const filteredPrograms = useMemo(() => {
    return programs.filter((p) => {
      // Status filter
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'IN_PRODUCTION' && !(p.status === 'ISSUED' || p.status === 'IN_PRODUCTION')) {
          return false;
        }
        if (selectedStatus === 'READY' && !(p.status === 'READY_FOR_ISSUE' || p.status === 'APPROVED')) {
          return false;
        }
        if (selectedStatus === 'DRAFT' && p.status !== 'DRAFT') {
          return false;
        }
        if (selectedStatus === 'COMPLETED' && p.status !== 'COMPLETED') {
          return false;
        }
      }

      // Dyeing requirement filter
      if (selectedDyeing !== 'ALL') {
        const req = Boolean(p.fabricDyeingRequired);
        if (selectedDyeing === 'YES' && !req) return false;
        if (selectedDyeing === 'NO' && req) return false;
      }

      // Priority filter
      if (selectedPriority !== 'ALL') {
        const priority = (p.priority || p.clientPriority || 'NORMAL').toUpperCase();
        if (priority !== selectedPriority) return false;
      }

      // Text Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const serial = (p.programSerialNo || p.programNumber || '').toLowerCase();
        const client = (p.clientName || p.buyerName || '').toLowerCase();
        const design = (p.designNumber || p.designName || '').toLowerCase();
        const wilcom = (p.wilcomDesignNumber || '').toLowerCase();
        const style = (p.mainStyle || p.styleCode || '').toLowerCase();
        const fabric = (p.fabricName || '').toLowerCase();
        const color = (p.fabricColor || '').toLowerCase();
        const pattern = (p.pattern || '').toLowerCase();

        // Also search in associated challan numbers
        const challanMatch = (p.challans || []).some((c: any) =>
          (c.challanNumber || '').toLowerCase().includes(q)
        );

        const textMatch =
          serial.includes(q) ||
          client.includes(q) ||
          design.includes(q) ||
          wilcom.includes(q) ||
          style.includes(q) ||
          fabric.includes(q) ||
          color.includes(q) ||
          pattern.includes(q) ||
          challanMatch;

        if (!textMatch) return false;
      }

      return true;
    });
  }, [programs, searchQuery, selectedStatus, selectedDyeing, selectedPriority]);

  // Overall metrics
  const totalPrograms = programs.length;
  const inProductionCount = programs.filter(
    (p) => p.status === 'ISSUED' || p.status === 'IN_PRODUCTION'
  ).length;
  const completedCount = programs.filter((p) => p.status === 'COMPLETED').length;
  const dyeingCount = programs.filter((p) => p.fabricDyeingRequired).length;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pl-0 md:pl-64 pb-16">
      {/* HEADER BAR */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A66E22] block">
            PROGRAMMING DEPARTMENT · ARCHIVE &amp; TRACEABILITY
          </span>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-amber-600" />
            <span>Production History</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchHistory}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition"
            title="Reload History"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <Link
            href="/my-work/create-production-sheet"
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#163767] hover:bg-[#0F264A] text-white text-xs font-semibold rounded-md shadow-xs transition"
          >
            <span>+ New Sheet</span>
          </Link>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        
        {/* TOP SUMMARY STATS */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Total Production Records
            </span>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalPrograms}</p>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Lifetime technical sheets</span>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">
              Active In Plant
            </span>
            <p className="text-2xl font-bold text-blue-600 mt-1">{inProductionCount}</p>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Store / Dyeing / QC1</span>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 block">
              Dyeing Route
            </span>
            <p className="text-2xl font-bold text-purple-600 mt-1">{dyeingCount}</p>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Required dyeing process</span>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">
              Completed Orders
            </span>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{completedCount}</p>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Fully audited &amp; closed</span>
          </div>
        </section>

        {/* SEARCH AND FILTER BAR */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            {/* SEARCH INPUT */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#163767]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* STATUS FILTER */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">Status:</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium focus:bg-white focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="READY">Ready for Issue</option>
                <option value="IN_PRODUCTION">In Production / Issued</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>

            {/* DYEING FILTER */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">Dyeing:</span>
              <select
                value={selectedDyeing}
                onChange={(e) => setSelectedDyeing(e.target.value)}
                className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium focus:bg-white focus:outline-none"
              >
                <option value="ALL">All</option>
                <option value="YES">Yes (Dyeing)</option>
                <option value="NO">No (Embroidery)</option>
              </select>
            </div>

            {/* PRIORITY FILTER */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">Priority:</span>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium focus:bg-white focus:outline-none"
              >
                <option value="ALL">All</option>
                <option value="URGENT">Urgent</option>
                <option value="HIGH">High</option>
                <option value="NORMAL">Normal</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>
              Showing <strong className="text-slate-800">{filteredPrograms.length}</strong> of{' '}
              <strong className="text-slate-800">{programs.length}</strong> production history records
            </span>
            {(searchQuery || selectedStatus !== 'ALL' || selectedDyeing !== 'ALL' || selectedPriority !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedStatus('ALL');
                  setSelectedDyeing('ALL');
                  setSelectedPriority('ALL');
                }}
                className="text-blue-700 hover:underline font-semibold"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* RESULTS TABLE */}
        <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-16 text-center text-xs text-slate-400">Loading production history archive…</div>
          ) : filteredPrograms.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <Layers className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">No matching production records found</p>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                Try searching with different terms (Serial number, Wilcom design number, buyer, or fabric).
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredPrograms.map((prog) => {
                const isExpanded = expandedProgramId === prog.id;
                const challans = prog.challans || [];
                const isDraft = prog.status === 'DRAFT';
                const isReady = prog.status === 'READY_FOR_ISSUE' || prog.status === 'APPROVED';
                const isIssued = prog.status === 'ISSUED' || prog.status === 'IN_PRODUCTION';
                const hasDyeing = Boolean(prog.fabricDyeingRequired);

                return (
                  <div key={prog.id} className="transition hover:bg-slate-50/50">
                    {/* PRIMARY ROW */}
                    <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      
                      {/* IDENTIFIERS & DESIGN PREVIEW */}
                      <div className="flex items-start sm:items-center gap-3.5">
                        {/* IMAGE / THUMBNAIL */}
                        <div className="w-14 h-14 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                          {prog.wilcomDesignPhoto || prog.baseDesignPhoto ? (
                            <img
                              src={prog.wilcomDesignPhoto || prog.baseDesignPhoto}
                              alt={prog.designNumber || 'Design'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <FileText className="w-6 h-6 text-slate-400" />
                          )}
                        </div>

                        {/* CORE SPEC INFO */}
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-sm text-slate-900">
                              {prog.programSerialNo || prog.programNumber}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                isDraft
                                  ? 'bg-amber-100 text-amber-800'
                                  : isReady
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : isIssued
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {prog.status}
                            </span>
                            {hasDyeing ? (
                              <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
                                Dyeing Required
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                                Direct Embroidery
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-slate-700 mt-1 flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-900">
                              {prog.clientName || prog.buyerName || 'Direct Client'}
                            </span>
                            <span className="text-slate-300">·</span>
                            <span>
                              Design: <strong className="text-slate-800">{prog.designNumber || prog.designName || 'Standard'}</strong>
                            </span>
                            {prog.wilcomDesignNumber && (
                              <span className="font-mono text-purple-700 font-semibold text-[11px]">
                                (Wilcom: {prog.wilcomDesignNumber})
                              </span>
                            )}
                            <span className="text-slate-300">·</span>
                            <span>
                              Style: <strong className="text-slate-800">{prog.mainStyle || prog.styleCode || '—'}</strong>
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>
                              Fabric: <strong className="text-slate-700">{prog.fabricName || 'Standard'}</strong>
                            </span>
                            <span>·</span>
                            <span>
                              Color: <strong className="text-slate-700">{prog.fabricColor || 'Natural'}</strong>
                            </span>
                            <span>·</span>
                            <span>
                              Qty:{' '}
                              <strong className="text-slate-900 font-mono">
                                {prog.colorQuantity || prog.targetQuantity} {prog.quantityMeasurement || 'PCS'}
                              </strong>
                            </span>
                            <span>·</span>
                            <span>
                              Delivery:{' '}
                              <strong className="text-slate-700">
                                {prog.deliveryDate ? new Date(prog.deliveryDate).toLocaleDateString() : '—'}
                              </strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* ACTIONS & CHALLANS BADGE */}
                      <div className="flex items-center gap-2 flex-wrap lg:justify-end">
                        {/* LIFECYCLE CHALLANS TOGGLE */}
                        <button
                          type="button"
                          onClick={() => setExpandedProgramId(isExpanded ? null : prog.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition"
                        >
                          <Truck className="w-3.5 h-3.5 text-blue-600" />
                          <span>Challans ({challans.length})</span>
                          <ChevronRight
                            className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                              isExpanded ? 'rotate-90' : ''
                            }`}
                          />
                        </button>

                        {/* PRINT */}
                        <button
                          type="button"
                          onClick={() => printProductionSheet(prog)}
                          title="Print Production Sheet (A4)"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-slate-200 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-900 transition"
                        >
                          <Printer className="w-3.5 h-3.5 text-slate-500" />
                          <span>Print</span>
                        </button>

                        {/* DOWNLOAD */}
                        <button
                          type="button"
                          onClick={() => downloadProductionSheetHtml(prog)}
                          title="Download Sheet (.html / PDF)"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-slate-200 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-900 transition"
                        >
                          <Download className="w-3.5 h-3.5 text-slate-500" />
                          <span>Download</span>
                        </button>

                        {/* ISSUE CHALLAN (IF READY) */}
                        {isReady && (
                          <Link
                            href={`/my-work/issue-challan?programId=${prog.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Issue Challan</span>
                          </Link>
                        )}

                        {/* VIEW FULL DETAILS */}
                        <Link
                          href={`/programs/${prog.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-md bg-slate-800 hover:bg-slate-900 text-white shadow-xs transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Sheet</span>
                        </Link>
                      </div>
                    </div>

                    {/* EXPANDABLE CHALLANS LIFECYCLE TRAIL */}
                    {isExpanded && (
                      <div className="bg-slate-50 border-t border-slate-200/80 p-4 text-xs">
                        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200">
                          <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-slate-500" />
                            <span>Challans Lifecycle Trail for {prog.programSerialNo || prog.programNumber}</span>
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Flow: Programming $\rightarrow$ Fabric Store $\rightarrow$ Dyeing $\rightarrow$ QC1
                          </span>
                        </div>

                        {challans.length === 0 ? (
                          <div className="p-4 text-center text-slate-400 bg-white border border-slate-200 rounded-lg">
                            No dispatch challans have been created for this production sheet yet.
                            {isReady && (
                              <div className="mt-2">
                                <Link
                                  href={`/my-work/issue-challan?programId=${prog.id}`}
                                  className="text-blue-700 hover:underline font-semibold"
                                >
                                  Click here to issue the first Challan $\rightarrow$
                                </Link>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {challans.map((c: any) => (
                              <div
                                key={c.id}
                                className="bg-white border border-slate-200 rounded-lg p-3 space-y-1.5 shadow-2xs hover:border-blue-300 transition"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-mono font-bold text-slate-900 text-xs">
                                    {c.challanNumber}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                                    {c.status}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-600 flex items-center justify-between">
                                  <span>Route:</span>
                                  <span className="font-medium text-slate-800">
                                    {c.sourceDepartment} $\rightarrow$ {c.destinationDepartment}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-600 flex items-center justify-between">
                                  <span>Quantity:</span>
                                  <span className="font-mono font-semibold text-slate-800">
                                    {c.totalQuantity || '—'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-600 flex items-center justify-between">
                                  <span>Date:</span>
                                  <span>{c.challanDate ? new Date(c.challanDate).toLocaleDateString() : '—'}</span>
                                </div>
                                <div className="pt-1.5 border-t border-slate-100 flex items-center justify-end">
                                  <Link
                                    href={`/challans/${c.id}`}
                                    className="text-[11px] font-bold text-blue-700 hover:text-blue-900 transition flex items-center gap-1"
                                  >
                                    <span>View Challan Details</span>
                                    <ArrowRight className="w-3 h-3" />
                                  </Link>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
