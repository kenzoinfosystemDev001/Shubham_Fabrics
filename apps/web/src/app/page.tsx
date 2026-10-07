'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  FilePlus, 
  Send, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  ArrowRight, 
  RefreshCw,
  Calendar,
  Layers,
  Sparkles,
  Printer,
  Download
} from 'lucide-react';
import { api } from '@/lib/api';
import { 
  downloadProductionSheetHtml, 
  printProductionSheet 
} from '@/lib/download-production-sheet';

export default function ProgrammingDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [programs, setPrograms] = useState<any[]>([]);
  const [challans, setChallans] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);

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
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('subham_mes_user');
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          const isStore = (parsed.departmentCode === 'STORE' || parsed.role === 'FABRIC_STORE') && 
            parsed.role !== 'ADMIN' && parsed.role !== 'SUPER_ADMIN';
          if (isStore) {
            router.push('/fabric-store');
            return;
          }
          setCurrentUser(parsed);
        } catch {}
      } else {
        router.push('/login');
        return;
      }
    }
    loadData();
  }, [router]);

  // Calculations from real transactional records
  const totalSheets = programs.length;
  const draftSheets = programs.filter(p => p.status === 'DRAFT').length;
  const inProgressSheets = programs.filter(p => p.status === 'IN_PROGRESS' || p.status === 'SUBMITTED').length;
  const readySheets = programs.filter(p => p.status === 'READY_FOR_ISSUE' || p.status === 'APPROVED').length;
  const issuedSheets = programs.filter(p => p.status === 'ISSUED' || p.status === 'IN_PRODUCTION' || p.status === 'COMPLETED').length;

  const totalChallans = challans.length;
  const pendingChallans = challans.filter(c => c.status === 'DRAFT' || c.status === 'SUBMITTED').length;
  const issuedChallans = challans.filter(c => c.status === 'ISSUED' || c.status === 'RECEIVED' || c.status === 'IN_PROCESS' || c.status === 'COMPLETED').length;

  // Approaching delivery date (within 7 days)
  const now = new Date();
  const upcomingDeadlines = programs.filter(p => {
    if (!p.deliveryDate) return false;
    const diffDays = (new Date(p.deliveryDate).getTime() - now.getTime()) / (1000 * 3600 * 24);
    return diffDays >= 0 && diffDays <= 7 && p.status !== 'COMPLETED';
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] pl-64">
      {/* TOP HEADER BAR */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-8 py-4 flex items-center justify-between shadow-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A66E22] block">
            SHUBHAM FABRICS MES · OPERATIONS
          </span>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            Programming Department Dashboard
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          
          <Link
            href="/my-work/create-production-sheet"
            className="flex items-center gap-2 px-3.5 py-2 bg-[#163767] hover:bg-[#0F264A] text-white text-xs font-semibold rounded-md shadow-xs transition"
          >
            <FilePlus className="w-4 h-4" />
            <span>Create Production Sheet</span>
          </Link>
          
          <Link
            href="/my-work/issue-challan"
            className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-xs transition"
          >
            <Send className="w-4 h-4" />
            <span>Issue Challan</span>
          </Link>
        </div>
      </header>

      {/* DASHBOARD CONTENT */}
      <main className="p-8 max-w-7xl mx-auto space-y-6">
        
        {/* KPI METRICS OVERVIEW */}
        <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {/* Total Sheets */}
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Total Sheets
            </span>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalSheets}</p>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Recorded programs</span>
          </div>

          {/* Draft */}
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 block">
              Draft
            </span>
            <p className="text-2xl font-bold text-amber-600 mt-1">{draftSheets}</p>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Under preparation</span>
          </div>

          {/* In Progress */}
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">
              In Progress
            </span>
            <p className="text-2xl font-bold text-blue-600 mt-1">{inProgressSheets}</p>
            <span className="text-[10px] text-slate-500 mt-0.5 block">CAD & specs sync</span>
          </div>

          {/* Ready For Issue */}
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block">
              Ready for Issue
            </span>
            <p className="text-2xl font-bold text-indigo-600 mt-1">{readySheets}</p>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Awaiting Challan</span>
          </div>

          {/* Issued */}
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">
              Issued
            </span>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{issuedSheets}</p>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Passed downstream</span>
          </div>

          {/* Challans Issued */}
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
              Challans Issued
            </span>
            <p className="text-2xl font-bold text-slate-900 mt-1">{issuedChallans}</p>
            <span className="text-[10px] text-slate-500 mt-0.5 block">{pendingChallans} draft/pending</span>
          </div>

          {/* Delivery Warning */}
          <div className="bg-white border border-amber-200 rounded-lg p-3.5 shadow-xs bg-amber-50/30">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">
              Deadlines (≤7d)
            </span>
            <p className="text-2xl font-bold text-rose-600 mt-1">{upcomingDeadlines.length}</p>
            <span className="text-[10px] text-amber-700 mt-0.5 block">High attention</span>
          </div>
        </section>

        {/* TWO-COLUMN WORKSPACE SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT 2-COLS: RECENT PRODUCTION SHEETS */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* PRODUCTION SHEETS TABLE */}
            <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-200/80 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Production Sheets / Production Programs
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Official technical production specifications authored by Programming
                  </p>
                </div>
                <Link
                  href="/my-work/create-production-sheet"
                  className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1"
                >
                  <span>+ New Sheet</span>
                </Link>
              </div>

              {loading ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading production sheets…</div>
              ) : programs.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <Layers className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700">No Production Sheets created yet</p>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    Start by authoring the first official Production Sheet for Shubham Fabrics.
                  </p>
                  <Link
                    href="/my-work/create-production-sheet"
                    className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#163767] text-white text-xs font-semibold rounded-md shadow-xs"
                  >
                    <FilePlus className="w-3.5 h-3.5" />
                    <span>Create Production Sheet</span>
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-4">Serial / Program #</th>
                        <th className="py-2.5 px-4">Client</th>
                        <th className="py-2.5 px-4">Design / Wilcom</th>
                        <th className="py-2.5 px-4">Style &amp; Fabric</th>
                        <th className="py-2.5 px-4">Quantity</th>
                        <th className="py-2.5 px-4">Delivery</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {programs.slice(0, 10).map((prog) => {
                        const isDraft = prog.status === 'DRAFT';
                        const isReady = prog.status === 'READY_FOR_ISSUE' || prog.status === 'APPROVED';
                        const isIssued = prog.status === 'ISSUED' || prog.status === 'IN_PRODUCTION';

                        return (
                          <tr key={prog.id} className="hover:bg-slate-50/60 transition">
                            <td className="py-3 px-4 font-mono font-bold text-slate-900">
                              {prog.programSerialNo || prog.programNumber}
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-900">
                              {prog.clientName || prog.buyerName || '—'}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-semibold block text-slate-900">
                                {prog.designNumber || prog.designName || 'Standard'}
                              </span>
                              {prog.wilcomDesignNumber && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  W: {prog.wilcomDesignNumber}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span className="block font-medium text-slate-800">
                                {prog.mainStyle || prog.styleCode || '—'}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {prog.fabricName || 'Cotton'} · {prog.fabricColor || 'Natural'}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono font-semibold">
                              {prog.colorQuantity || prog.targetQuantity} {prog.quantityMeasurement || 'PCS'}
                            </td>
                            <td className="py-3 px-4 text-[11px]">
                              {prog.deliveryDate ? new Date(prog.deliveryDate).toLocaleDateString() : '—'}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
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
                            </td>
                            <td className="py-3 px-4 text-right space-x-1.5">
                              <button
                                type="button"
                                onClick={() => printProductionSheet(prog)}
                                title="Print Production Sheet (A4)"
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-blue-900 bg-slate-100 hover:bg-blue-50 px-2 py-1 rounded transition cursor-pointer"
                              >
                                <Printer className="w-3 h-3 text-slate-500" />
                                <span>Print</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => downloadProductionSheetHtml(prog)}
                                title="Download File (.html / PDF)"
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-emerald-900 bg-slate-100 hover:bg-emerald-50 px-2 py-1 rounded transition cursor-pointer"
                              >
                                <Download className="w-3 h-3 text-slate-500" />
                                <span>Download</span>
                              </button>
                              {isReady && (
                                <Link
                                  href={`/my-work/issue-challan?programId=${prog.id}`}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition"
                                >
                                  <span>Issue Challan</span>
                                </Link>
                              )}
                              <Link
                                href={`/programs/${prog.id}`}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition"
                              >
                                <span>View</span>
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* RECENT CHALLANS TABLE */}
            <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-200/80 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Recent Challans Issued
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Physical material &amp; program transfer records dispatched from Programming
                  </p>
                </div>
                <Link
                  href="/my-work/issue-challan"
                  className="text-xs font-semibold text-blue-700 hover:text-blue-900"
                >
                  + Issue Challan
                </Link>
              </div>

              {challans.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No Challans recorded yet. Issue a Challan from an approved Production Sheet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-4">Challan Number</th>
                        <th className="py-2.5 px-4">Program</th>
                        <th className="py-2.5 px-4">From</th>
                        <th className="py-2.5 px-4">To Department</th>
                        <th className="py-2.5 px-4">Quantity</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4">Issued At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {challans.slice(0, 5).map((ch) => (
                        <tr key={ch.id} className="hover:bg-slate-50/60">
                          <td className="py-3 px-4 font-mono font-bold text-[#163767]">
                            <Link href={`/challans/${ch.id}`} className="hover:underline">
                              {ch.challanNumber}
                            </Link>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600">
                            {ch.program?.programNumber || '—'}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-800">
                            {ch.fromDepartment}
                          </td>
                          <td className="py-3 px-4 font-semibold text-blue-900">
                            {ch.toDepartment}
                          </td>
                          <td className="py-3 px-4 font-mono">
                            {ch.items?.[0]?.quantity || '—'} {ch.items?.[0]?.uom || ''}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800">
                              {ch.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-[11px] text-slate-500">
                            {ch.createdAt ? new Date(ch.createdAt).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>

          {/* RIGHT COLUMN: ACTIONS, DEADLINES & RECENT ACTIVITY */}
          <div className="space-y-6">
            
            {/* QUICK ACTIONS CARD */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A66E22] block">
                PRIMARY WORKSPACE ACTIONS
              </span>
              <h3 className="text-sm font-bold text-slate-900">
                Programming Department
              </h3>

              <div className="pt-2 space-y-2">
                <Link
                  href="/my-work/create-production-sheet"
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200/60 text-blue-950 font-semibold text-xs transition"
                >
                  <div className="flex items-center gap-2.5">
                    <FilePlus className="w-4 h-4 text-blue-700" />
                    <span>Create Production Sheet</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-blue-600" />
                </Link>

                <Link
                  href="/my-work/issue-challan"
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-200/60 text-emerald-950 font-semibold text-xs transition"
                >
                  <div className="flex items-center gap-2.5">
                    <Send className="w-4 h-4 text-emerald-700" />
                    <span>Issue Challan</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-600" />
                </Link>

                <Link
                  href="/floor-board"
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 font-semibold text-xs transition"
                >
                  <div className="flex items-center gap-2.5">
                    <Layers className="w-4 h-4 text-slate-600" />
                    <span>View Floor Board</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                </Link>
              </div>
            </div>

            {/* UPCOMING DELIVERY DEADLINES */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-600" />
                  <span>Approaching Deadlines</span>
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                  {upcomingDeadlines.length} Due Soon
                </span>
              </div>

              {upcomingDeadlines.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">
                  No programs approaching critical deadline.
                </p>
              ) : (
                <div className="space-y-2 pt-1">
                  {upcomingDeadlines.slice(0, 4).map((p) => (
                    <div
                      key={p.id}
                      className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/40 text-xs flex items-center justify-between"
                    >
                      <div>
                        <span className="font-mono font-bold text-slate-900 block">
                          {p.programSerialNo || p.programNumber}
                        </span>
                        <span className="text-[11px] text-slate-600 block">
                          {p.clientName || p.buyerName} · {p.mainStyle || p.styleCode}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-rose-700 block">
                          {new Date(p.deliveryDate).toLocaleDateString()}
                        </span>
                        <span className="text-[10px] text-amber-700 font-semibold">
                          Due soon
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SPECIFICATION GUIDELINES */}
            <div className="bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl p-5 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A66E22] block">
                PRODUCTION STANDARD NOTICE
              </span>
              <h4 className="text-xs font-bold text-slate-900">
                Department Gate Enforcement
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed font-serif">
                Production Sheets issued by Programming initiate the material routing for Shubham Fabrics. Ensure all Wilcom numbers, pattern parameters, and dyeing requirements are audited before issuing Challans.
              </p>
            </div>

          </div>

        </div>

      </main>
    </div>
  );
}