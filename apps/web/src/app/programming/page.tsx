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
import { formatTotals, totalsByUnit } from '@/lib/challan-units.mjs';

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

  const stats = [
    { label: 'Total Sheets', value: totalSheets, tone: 'text-neutral-900' },
    { label: 'Draft', value: draftSheets, tone: 'text-neutral-900' },
    { label: 'In Progress', value: inProgressSheets, tone: 'text-brand-700' },
    { label: 'Ready to Issue', value: readySheets, tone: 'text-brand-700' },
    { label: 'Issued', value: issuedSheets, tone: 'text-neutral-900' },
    { label: 'Challans Issued', value: issuedChallans, tone: 'text-neutral-900' },
    { label: 'Due in 7 Days', value: upcomingDeadlines.length, tone: upcomingDeadlines.length > 0 ? 'text-danger-600' : 'text-neutral-900' },
  ];

  const panel = 'bg-white border border-neutral-200 rounded-2xl shadow-xs overflow-hidden';
  const thead = 'bg-neutral-50 border-b border-neutral-200 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 whitespace-nowrap';
  const countPill = 'text-[11px] font-semibold tabular-nums bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full';

  return (
    <div className="min-h-screen bg-neutral-50 pl-0 md:pl-64">
      {/* HEADER */}
      <header className="bg-white/90 backdrop-blur border-b border-neutral-200 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-neutral-900">Programming</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition"
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/my-work/issue-challan"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-brand-50 text-brand-800 border border-brand-300 text-xs font-semibold rounded-lg transition"
          >
            <Send className="w-4 h-4" />
            <span>Issue Challan</span>
          </Link>
          <Link
            href="/my-work/create-production-sheet"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
          >
            <FilePlus className="w-4 h-4" />
            <span>Create Production Sheet</span>
          </Link>
        </div>
      </header>

      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {/* STATS */}
        <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-white border border-neutral-200 rounded-2xl px-4 py-3.5 shadow-xs">
              <p className={`text-2xl font-bold tabular-nums leading-none ${stat.tone}`}>{loading ? '…' : stat.value}</p>
              <p className="text-xs font-medium text-neutral-500 mt-2 truncate">{stat.label}</p>
            </div>
          ))}
        </section>

        {/* PRODUCTION SHEETS */}
        <section className={panel}>
          <div className="px-5 py-4 border-b border-neutral-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold text-neutral-900">Production Sheets</h2>
              <span className={countPill}>
                {searchQuery.trim() ? `${filteredPrograms.length} / ${programs.length}` : programs.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 md:w-72">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search sheets"
                  aria-label="Search production sheets"
                  className="h-9 w-full pl-9 pr-8 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-neutral-400 hover:text-neutral-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <Link
                href="/production-history"
                className="h-9 inline-flex items-center gap-1.5 px-3 text-xs font-semibold text-neutral-700 hover:text-neutral-900 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-lg transition shrink-0"
              >
                <History className="w-3.5 h-3.5" />
                <span>History</span>
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-xs text-neutral-500">Loading…</div>
          ) : programs.length === 0 ? (
            <div className="p-12 text-center">
              <Layers className="w-8 h-8 text-neutral-300 mx-auto" />
              <p className="text-sm font-medium text-neutral-500 mt-3">No production sheets yet</p>
            </div>
          ) : filteredPrograms.length === 0 ? (
            <div className="p-12 text-center">
              <Search className="w-8 h-8 text-neutral-300 mx-auto" />
              <p className="text-sm font-medium text-neutral-500 mt-3">No matching sheets</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={thead}>
                  <tr>
                    <th className="py-3 px-4">Serial / Program #</th>
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-4">Design / Wilcom</th>
                    <th className="py-3 px-4">Style &amp; Fabric</th>
                    <th className="py-3 px-4">Quantity</th>
                    <th className="py-3 px-4">Delivery</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">
                      <span className="sr-only">Actions</span>
                    </th>
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
                            {String(prog.status || '').replace(/_/g, ' ')}
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
        </section>

        {/* RECENT CHALLANS */}
        <section className={panel}>
          <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold text-neutral-900">Recent Challans</h2>
              <span className={countPill}>{challans.length}</span>
            </div>
            <Link href="/challans" className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900">
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {challans.length === 0 ? (
            <div className="p-10 text-center text-sm font-medium text-neutral-500">No challans yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={thead}>
                  <tr>
                    <th className="py-3 px-4">Challan No.</th>
                    <th className="py-3 px-4">Program Sheet</th>
                    <th className="py-3 px-4">Route</th>
                    <th className="py-3 px-4">Quantity</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Issued</th>
                    <th className="py-3 px-4 text-right">
                      <span className="sr-only">Actions</span>
                    </th>
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
                        {formatTotals(totalsByUnit(ch.items || []), '—')}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-brand-50 text-brand-800 border border-brand-200">
                          {String(ch.status || '').replace(/_/g, ' ')}
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
        </section>
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