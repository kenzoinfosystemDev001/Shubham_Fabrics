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
  Download,
  Search,
  History,
  X,
  Lock,
  Check
} from 'lucide-react';
import { api } from '@/lib/api';
import { DocumentActionButtons } from '@/components/common/DocumentActionButtons';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';

import { isAdminUser, isProgrammingUser } from '@/lib/rbac';

export default function ProgrammingDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [programs, setPrograms] = useState<any[]>([]);
  const [challans, setChallans] = useState<any[]>([]);
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, any>>({});
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSheetModal, setSelectedSheetModal] = useState<any | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [programsData, challansData, availRes] = await Promise.all([
        api.getPrograms().catch(() => []),
        api.getChallans().catch(() => []),
        fetch('/api/fabric-store/check-availability').then(r => r.json()).catch(() => null),
      ]);
      setPrograms(programsData || []);
      setChallans(challansData || []);
      if (availRes && Array.isArray(availRes.data)) {
        const map: Record<string, any> = {};
        for (const item of availRes.data) {
          if (item.programId) map[item.programId] = item;
          if (item.programNumber) map[item.programNumber] = item;
        }
        setAvailabilityMap(map);
      }
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
          if (!isAdminUser(parsed) && !isProgrammingUser(parsed)) {
            const dest =
              parsed.departmentCode === 'STORE' || parsed.role === 'FABRIC_STORE'
                ? '/fabric-store'
                : parsed.departmentCode === 'DYEING'
                ? '/dyeing'
                : parsed.departmentCode === 'QC1'
                ? '/qc1'
                : parsed.departmentCode === 'EMBROIDERY'
                ? '/embroidery'
                : '/login';
            router.replace(dest);
            return;
          }
          setCurrentUser(parsed);
        } catch {
          router.replace('/login');
          return;
        }
      } else {
        router.replace('/login');
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

  // Client-side quick search
  const filteredPrograms = programs.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const serial = (p.programSerialNo || p.programNumber || '').toLowerCase();
    const client = (p.clientName || p.buyerName || '').toLowerCase();
    const design = (p.designNumber || p.designName || '').toLowerCase();
    const wilcom = (p.wilcomDesignNumber || '').toLowerCase();
    const style = (p.mainStyle || p.styleCode || '').toLowerCase();
    const subStyle = (p.subStyle || (Array.isArray(p.subStyles) ? p.subStyles.join(' ') : '')).toLowerCase();
    const fabric = (p.fabricName || '').toLowerCase();
    const color = (p.fabricColor || '').toLowerCase();
    return (
      serial.includes(q) ||
      client.includes(q) ||
      design.includes(q) ||
      wilcom.includes(q) ||
      style.includes(q) ||
      subStyle.includes(q) ||
      fabric.includes(q) ||
      color.includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-neutral-50 pl-0 md:pl-64">
      {/* TOP HEADER BAR (REAL DB BACKGROUND) */}
      <header
        className="bg-white border-b border-neutral-200 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md text-neutral-900"
      >
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-700 block drop-shadow-sm">
            SHUBHAM FABRICS MES · OPERATIONS
          </span>
          <h1 className="text-xl font-bold text-neutral-900 flex items-center gap-2.5 drop-shadow-sm">
            Programming Department Dashboard
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          
          <Link
            href="/my-work/create-production-sheet"
            className="flex items-center gap-2 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-lg shadow-sm transition"
          >
            <FilePlus className="w-4 h-4" />
            <span>Create Production Sheet</span>
          </Link>
          
          <Link
            href="/my-work/issue-challan"
            className="flex items-center gap-2 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
          >
            <Send className="w-4 h-4" />
            <span>Issue Challan</span>
          </Link>
        </div>
      </header>

      {/* DASHBOARD CONTENT */}
      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        
        {/* KPI METRICS OVERVIEW */}
        <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {/* Total Sheets */}
          <div className="bg-white border border-neutral-200/90 rounded-lg p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
              Total Sheets
            </span>
            <p className="text-2xl font-bold text-neutral-900 mt-1">{totalSheets}</p>
            <span className="text-[10px] text-neutral-500 mt-0.5 block">Recorded programs</span>
          </div>

          {/* Draft */}
          <div className="bg-white border border-neutral-200/90 rounded-lg p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-700 block">
              Draft
            </span>
            <p className="text-2xl font-bold text-neutral-900 mt-1">{draftSheets}</p>
            <span className="text-[10px] text-neutral-500 mt-0.5 block">Under preparation</span>
          </div>

          {/* In Progress */}
          <div className="bg-white border border-neutral-200/90 rounded-lg p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 block">
              In Progress
            </span>
            <p className="text-2xl font-bold text-brand-600 mt-1">{inProgressSheets}</p>
            <span className="text-[10px] text-neutral-500 mt-0.5 block">CAD & specs sync</span>
          </div>

          {/* Ready For Issue */}
          <div className="bg-white border border-neutral-200/90 rounded-lg p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 block">
              Ready for Issue
            </span>
            <p className="text-2xl font-bold text-brand-600 mt-1">{readySheets}</p>
            <span className="text-[10px] text-neutral-500 mt-0.5 block">Awaiting Challan</span>
          </div>

          {/* Issued */}
          <div className="bg-white border border-neutral-200/90 rounded-lg p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-700 block">
              Issued
            </span>
            <p className="text-2xl font-bold text-neutral-900 mt-1">{issuedSheets}</p>
            <span className="text-[10px] text-neutral-500 mt-0.5 block">Passed downstream</span>
          </div>

          {/* Challans Issued */}
          <div className="bg-white border border-neutral-200/90 rounded-lg p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-600 block">
              Challans Issued
            </span>
            <p className="text-2xl font-bold text-neutral-900 mt-1">{issuedChallans}</p>
            <span className="text-[10px] text-neutral-500 mt-0.5 block">{pendingChallans} draft/pending</span>
          </div>

          {/* Delivery Warning */}
          <div className="bg-white border border-accent-200 rounded-lg p-3.5 shadow-xs bg-accent-50/30">
            <span className="text-[10px] font-bold uppercase tracking-wider text-danger-700 block">
              Deadlines (≤7d)
            </span>
            <p className="text-2xl font-bold text-danger-600 mt-1">{upcomingDeadlines.length}</p>
            <span className="text-[10px] text-accent-800 mt-0.5 block">High attention</span>
          </div>
        </section>

        {/* TWO-COLUMN WORKSPACE SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT 2-COLS: RECENT PRODUCTION SHEETS */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* PRODUCTION SHEETS TABLE */}
            <div className="bg-white border border-neutral-200/90 rounded-xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-neutral-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                    <span>Production Sheets / Production Programs</span>
                  </h2>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Official technical production specifications authored by Programming
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href="/production-history"
                    className="text-xs font-semibold text-neutral-700 hover:text-brand-900 bg-neutral-100 hover:bg-neutral-200 px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition"
                  >
                    <History className="w-3.5 h-3.5 text-accent-700" />
                    <span>Production History Archive</span>
                  </Link>
                  <Link
                    href="/my-work/create-production-sheet"
                    className="text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 px-2.5 py-1.5 rounded-md flex items-center gap-1 transition shadow-xs"
                  >
                    <span>+ New Sheet</span>
                  </Link>
                </div>
              </div>

              {/* SEARCH FILTER BAR */}
              <div className="p-3 bg-neutral-50/80 border-b border-neutral-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-8 py-1.5 bg-white border border-neutral-200 rounded-md text-xs text-neutral-900 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="text-[11px] text-neutral-500 flex items-center justify-between sm:justify-end gap-3">
                  <span>
                    Showing <strong className="text-neutral-900">{filteredPrograms.length}</strong> of{' '}
                    <strong className="text-neutral-900">{programs.length}</strong> sheets
                  </span>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="text-brand-700 hover:underline font-semibold"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {loading ? (
                <div className="p-8 text-center text-xs text-neutral-500">Loading production sheets…</div>
              ) : programs.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <Layers className="w-10 h-10 text-neutral-700 mx-auto" />
                  <p className="text-xs font-semibold text-neutral-700">No Production Sheets created yet</p>
                  <p className="text-[11px] text-neutral-500 max-w-sm mx-auto">
                    Start by authoring the first official Production Sheet for Shubham Fabrics.
                  </p>
                  <Link
                    href="/my-work/create-production-sheet"
                    className="inline-flex items-center gap-2 px-3.5 py-2 bg-brand-600 text-white text-xs font-semibold rounded-md shadow-xs"
                  >
                    <FilePlus className="w-3.5 h-3.5" />
                    <span>Create Production Sheet</span>
                  </Link>
                </div>
              ) : filteredPrograms.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <Search className="w-8 h-8 text-neutral-700 mx-auto" />
                  <p className="text-xs font-semibold text-neutral-700">No matching production sheets found</p>
                  <p className="text-[11px] text-neutral-500">
                    Try another search term or click &quot;Clear&quot; to reset.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-50/80 text-neutral-600 font-semibold border-b border-neutral-200">
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
                    <tbody className="divide-y divide-neutral-100 text-neutral-700">
                      {filteredPrograms.slice(0, 15).map((prog) => {
                        const isDraft = prog.status === 'DRAFT';
                        const isReady = prog.status === 'READY_FOR_ISSUE' || prog.status === 'APPROVED';
                        const isIssued = prog.status === 'ISSUED' || prog.status === 'IN_PRODUCTION';

                        return (
                          <tr key={prog.id} className="hover:bg-neutral-50/60 transition">
                            <td className="py-3 px-4 font-mono font-bold text-neutral-900">
                              {prog.programSerialNo || prog.programNumber}
                            </td>
                            <td className="py-3 px-4 font-medium text-neutral-900">
                              <div>{prog.clientName || prog.buyerName || '—'}</div>
                              {prog.clientCode && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-accent-800 bg-accent-50 px-1.5 py-0.5 rounded border border-accent-200 mt-0.5">
                                  <span>{prog.clientCode}</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-semibold block text-neutral-900">
                                {prog.designNumber || prog.designName || 'Standard'}
                              </span>
                              {prog.wilcomDesignNumber && (
                                <span className="text-[10px] text-neutral-500 font-mono">
                                  W: {prog.wilcomDesignNumber}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span className="block font-medium text-neutral-900">
                                {prog.mainStyle || prog.styleCode || '—'}
                              </span>
                              {prog.subStyle && (
                                <span className="text-[10px] text-accent-800 font-semibold block truncate max-w-[180px]" title={prog.subStyle}>
                                  Sub: {prog.subStyle}
                                </span>
                              )}
                              <span className="text-[10px] text-neutral-500 block">
                                {prog.fabricName || 'Cotton'}
                              </span>
                              {prog.items && prog.items.length > 1 ? (
                                <span className="inline-flex items-center gap-1 text-[10px] text-brand-700 font-semibold bg-brand-50 px-1.5 py-0.5 rounded mt-0.5">
                                  {prog.items.length} Items &middot; {Array.from(new Set(prog.items.map((it: any) => String(it.color || '').trim()).filter(Boolean))).length} Colors
                                </span>
                              ) : (
                                <span className="text-[10px] text-neutral-500">
                                  {prog.fabricColor || 'Natural'}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono font-semibold">
                              <div>{prog.colorQuantity || prog.targetQuantity} {prog.quantityMeasurement || 'PCS'}</div>
                              {prog.items && prog.items.length > 1 && (
                                <span className="text-[10px] text-neutral-500 block font-normal">
                                  {prog.items.length} colorways
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-[11px]">
                              {prog.deliveryDate ? new Date(prog.deliveryDate).toLocaleDateString() : '—'}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  isDraft
                                    ? 'bg-accent-100 text-accent-800'
                                    : isReady
                                    ? 'bg-brand-100 text-brand-800'
                                    : isIssued
                                    ? 'bg-accent-100 text-accent-800'
                                    : 'bg-brand-100 text-brand-800'
                                }`}
                              >
                                {prog.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                <DocumentActionButtons
                                  program={prog}
                                  size="xs"
                                />
                                {isReady && (
                                  <Link
                                    href={`/my-work/issue-challan?programId=${prog.id}`}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-700 hover:text-brand-900 bg-brand-50 hover:bg-brand-100 px-2 py-1 rounded transition"
                                  >
                                    <span>Issue Challan</span>
                                  </Link>
                                )}
                                <Link
                                  href={`/programs/${prog.id}`}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 px-2 py-1 rounded transition"
                                >
                                  <span>Details</span>
                                </Link>
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

            {/* RECENT CHALLANS TABLE */}
            <div className="bg-white border border-neutral-200/90 rounded-xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-neutral-200/80 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-neutral-900">
                    Recent Challans Issued
                  </h2>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Physical material &amp; program transfer records dispatched from Programming
                  </p>
                </div>
                <Link
                  href="/my-work/issue-challan"
                  className="text-xs font-semibold text-brand-700 hover:text-brand-900"
                >
                  + Issue Challan
                </Link>
              </div>

              {challans.length === 0 ? (
                <div className="p-8 text-center text-xs text-neutral-500">
                  No Challans recorded yet. Issue a Challan from an approved Production Sheet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-50/80 text-neutral-600 font-semibold border-b border-neutral-200">
                      <tr>
                        <th className="py-2.5 px-4">Challan Number</th>
                        <th className="py-2.5 px-4">Program Sheet</th>
                        <th className="py-2.5 px-4">Route</th>
                        <th className="py-2.5 px-4">Quantity</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4">Issued At</th>
                        <th className="py-2.5 px-4 text-right">Actions (Challan &amp; Sheet)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 text-neutral-700">
                      {challans.slice(0, 10).map((ch) => (
                        <tr key={ch.id} className="hover:bg-neutral-50/60 transition">
                          <td className="py-3 px-4 font-mono font-bold text-brand-600">
                            <Link href={`/challans/${ch.id}`} className="hover:underline flex items-center gap-1">
                              <span>{ch.challanNumber}</span>
                            </Link>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono font-semibold text-neutral-900 block">
                              {ch.program?.programSerialNo || ch.program?.programNumber || '—'}
                            </span>
                            {ch.program?.designNumber && (
                              <span className="text-[10px] text-neutral-500 block truncate max-w-[140px]">
                                Design: {ch.program.designNumber}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1 text-[11px] font-semibold">
                              <span className="text-neutral-900">{ch.fromDepartment}</span>
                              <span className="text-neutral-500">→</span>
                              <span className="text-brand-900">{ch.toDepartment}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-neutral-900 font-medium">
                            {ch.items?.[0]?.quantity || '—'} {ch.items?.[0]?.uom || ''}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-brand-50 text-brand-800 border border-brand-200">
                              {ch.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-[11px] text-neutral-500">
                            {ch.createdAt ? new Date(ch.createdAt).toLocaleDateString() : '—'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1 flex-wrap">
                              <DocumentActionButtons
                                challan={ch}
                                program={ch.program}
                                size="xs"
                              />
                            </div>
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
            <div className="bg-white border border-neutral-200/90 rounded-xl p-5 shadow-xs space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-700 block">
                PRIMARY WORKSPACE ACTIONS
              </span>
              <h3 className="text-sm font-bold text-neutral-900">
                Programming Department
              </h3>

              <div className="pt-2 space-y-2">
                <Link
                  href="/my-work/create-production-sheet"
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-brand-50/70 hover:bg-brand-100/70 border border-brand-200/60 text-brand-900 font-semibold text-xs transition"
                >
                  <div className="flex items-center gap-2.5">
                    <FilePlus className="w-4 h-4 text-brand-700" />
                    <span>Create Production Sheet</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-brand-600" />
                </Link>

                <Link
                  href="/my-work/issue-challan"
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-accent-50/70 hover:bg-accent-100/70 border border-accent-200/60 text-accent-800 font-semibold text-xs transition"
                >
                  <div className="flex items-center gap-2.5">
                    <Send className="w-4 h-4 text-accent-800" />
                    <span>Issue Challan</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-accent-700" />
                </Link>

                <Link
                  href="/floor-board"
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-neutral-900 font-semibold text-xs transition"
                >
                  <div className="flex items-center gap-2.5">
                    <Layers className="w-4 h-4 text-neutral-600" />
                    <span>View Floor Board</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-neutral-500" />
                </Link>
              </div>
            </div>

          </div>

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