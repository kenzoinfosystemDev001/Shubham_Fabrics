'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  PackageCheck,
  Send,
  Boxes,
  Layers,
  ArrowRight,
  RefreshCw,
  Eye,
  AlertTriangle,
  ArrowDownToLine,
  Kanban,
} from 'lucide-react';
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';

export default function FabricStoreDashboard() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/fabric-store/dashboard');
      if (!res.ok) throw new Error('Failed to fetch dashboard data');
      const json = await res.json();
      setData(json.data);
    } catch (err: any) {
      setError(err.message || 'Error loading dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('subham_mes_user');
        const parsed = raw ? JSON.parse(raw) : null;
        const isProgramming =
          (parsed?.departmentCode === 'PROGRAMMING' ||
            parsed?.role === 'PROGRAMMER' ||
            parsed?.role === 'PROGRAMMING_INCHARGE') &&
          parsed?.role !== 'ADMIN' &&
          parsed?.role !== 'SUPER_ADMIN';
        if (isProgramming) {
          router.push('/');
          return;
        }
      } catch {}
    }
    loadData();
  }, [router]);

  const kpis = data?.kpis || {};
  const incomingChallans = data?.incomingChallans || [];
  const recentIssues = data?.recentIssues || [];

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-amber-100 text-amber-800',
      ISSUED: 'bg-blue-100 text-blue-800',
      RECEIVED: 'bg-purple-100 text-purple-800',
      IN_TRANSIT: 'bg-indigo-100 text-indigo-800',
      COMPLETED: 'bg-emerald-100 text-emerald-800',
    };
    return (
      <span
        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
          colors[status] || 'bg-slate-100 text-slate-700'
        }`}
      >
        {status?.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#F0FAF9]">
      {/* TOP HEADER (REAL DB BACKGROUND) */}
      <header
        style={{
          backgroundImage: `linear-gradient(to right, rgba(15, 23, 42, 0.85), rgba(15, 23, 42, 0.70)), url('${DEPARTMENT_NAV_BG_IMAGE}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        className="border-b border-slate-700/80 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md text-white"
      >
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-400 block drop-shadow-sm">
            SHUBHAM FABRICS MES · FABRIC STORE
          </span>
          <h1 className="text-xl font-bold text-white drop-shadow-sm">Fabric Store Department Dashboard</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-lg border border-slate-700/60 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/fabric-store/inventory/inward"
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition"
          >
            <ArrowDownToLine className="w-4 h-4" />
            <span>Inward Stock</span>
          </Link>
          <Link
            href="/fabric-store/inventory/outward"
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-xs transition"
          >
            <Send className="w-4 h-4" />
            <span>Outward Stock</span>
          </Link>
          <Link
            href="/fabric-store/my-work/challan-to-dyeing"
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
          >
            <Send className="w-4 h-4" />
            <span>Store &rarr; Dyeing</span>
          </Link>
          <Link
            href="/fabric-store/my-work/challan-to-embroidery"
            className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
          >
            <Send className="w-4 h-4" />
            <span>Store &rarr; Embroidery</span>
          </Link>
        </div>
      </header>

      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* CORE FABRIC STORE MODULE TILES (HANDWRITTEN SPECIFICATION) */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Link
            href="/fabric-store/inventory/inward"
            className="bg-white p-4 rounded-xl border border-emerald-200 hover:border-emerald-400 hover:shadow-md transition group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                1. INWARD STOCK
              </span>
              <ArrowDownToLine className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition" />
            </div>
            <h3 className="text-sm font-black text-slate-900 mt-2">Any New Fabric Arriving</h3>
            <p className="text-[11px] text-slate-500 mt-1">
              Log mill bills, receiving date, bill quantity in MTR or PCS.
            </p>
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 mt-3">
              <span>Open Inward Table</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          <Link
            href="/fabric-store/inventory/outward"
            className="bg-white p-4 rounded-xl border border-amber-200 hover:border-amber-400 hover:shadow-md transition group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">
                2. OUTWARD STOCK
              </span>
              <Send className="w-4 h-4 text-amber-600 group-hover:scale-110 transition" />
            </div>
            <h3 className="text-sm font-black text-slate-900 mt-2">Dispatches &amp; Challans</h3>
            <p className="text-[11px] text-slate-500 mt-1">
              Auto-updated when Challan is created to Dyeing or Embroidery.
            </p>
            <div className="flex items-center gap-1 text-[11px] font-bold text-amber-700 mt-3">
              <span>Open Outward Table</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          <Link
            href="/fabric-store/inventory/total-stock"
            className="bg-white p-4 rounded-xl border border-teal-200 hover:border-teal-400 hover:shadow-md transition group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-teal-700">
                TOTAL STOCK
              </span>
              <Boxes className="w-4 h-4 text-teal-600 group-hover:scale-110 transition" />
            </div>
            <h3 className="text-sm font-black text-slate-900 mt-2">KORA &amp; Dyed Balance</h3>
            <p className="text-[11px] text-slate-500 mt-1">
              Real-time In-Store Balance: Inward minus Outward dispatches.
            </p>
            <div className="flex items-center gap-1 text-[11px] font-bold text-teal-700 mt-3">
              <span>View Stock Balance</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          <Link
            href="/fabric-store/inventory/defected-shelf"
            className="bg-white p-4 rounded-xl border border-rose-200 hover:border-rose-400 hover:shadow-md transition group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-700">
                DEFECTIVE SHELF
              </span>
              <AlertTriangle className="w-4 h-4 text-rose-600 group-hover:scale-110 transition" />
            </div>
            <h3 className="text-sm font-black text-slate-900 mt-2">DEF-SHELF-STORE</h3>
            <p className="text-[11px] text-slate-500 mt-1">
              Isolated weaving slub &amp; tear defect fabric pieces quarantined.
            </p>
            <div className="flex items-center gap-1 text-[11px] font-bold text-rose-700 mt-3">
              <span>Inspect Quarantined</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        </section>

        {/* KPI CARDS */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Rolls', value: kpis.totalRolls ?? '—', color: 'text-slate-900', sub: 'All rolls on record' },
            { label: 'In Stock', value: kpis.rollsInStock ?? '—', color: 'text-teal-700', sub: 'Available in store' },
            { label: 'Issued to Production', value: kpis.rollsIssued ?? '—', color: 'text-blue-600', sub: 'Dispatched to lines' },
            { label: 'Incoming Challans', value: kpis.incomingChallansCount ?? '—', color: 'text-emerald-700', sub: 'Received in store' },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">{kpi.label}</span>
              <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>
                {loading ? <span className="text-slate-300">…</span> : kpi.value}
              </p>
              <span className="text-[10px] text-slate-500 mt-0.5 block">{kpi.sub}</span>
            </div>
          ))}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Incoming Challans */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-200/80 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Incoming Production Challans</h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">Challans addressed to Fabric Store department</p>
                </div>
                <Link
                  href="/fabric-store/my-work/incoming-challans"
                  className="text-xs font-semibold text-teal-700 hover:text-teal-900"
                >
                  View All →
                </Link>
              </div>

              {loading ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading incoming challans…</div>
              ) : incomingChallans.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <PackageCheck className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700">No incoming challans at this time</p>
                  <p className="text-[11px] text-slate-500">Challans dispatched to Fabric Store will appear here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-4">Challan No.</th>
                        <th className="py-2.5 px-4">Origin</th>
                        <th className="py-2.5 px-4">Program / Buyer</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4 text-right">Issue Next Challan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {incomingChallans.map((ch: any) => {
                        const prog = ch.program;
                        const progId = ch.programId || prog?.id;
                        return (
                          <tr key={ch.id} className="hover:bg-slate-50/60 transition">
                            <td className="py-3 px-4 font-mono font-bold text-teal-800">
                              <Link href={`/challans/${ch.id}`} className="hover:underline">
                                {ch.challanNumber}
                              </Link>
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-800">
                              {ch.fromDepartment}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-mono font-semibold block">
                                {prog?.programNumber || prog?.programSerialNo || '—'}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {[prog?.clientName || prog?.buyerName, prog?.mainStyle || prog?.styleCode].filter(Boolean).join(' · ')}
                              </span>
                            </td>
                            <td className="py-3 px-4">{statusBadge(ch.status)}</td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                {prog?.fabricDyeingRequired ? (
                                  <>
                                    <Link
                                      href={`/fabric-store/my-work/challan-to-dyeing?programId=${progId || ''}`}
                                      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-1 rounded transition"
                                    >
                                      <Send className="w-3 h-3 text-indigo-600" />
                                      <span>Store to Dyeing</span>
                                    </Link>
                                    <Link
                                      href={`/fabric-store/my-work/challan-to-embroidery?programId=${progId || ''}`}
                                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded transition"
                                    >
                                      <Send className="w-3 h-3 text-emerald-600" />
                                      <span>Store to Embroidery</span>
                                    </Link>
                                  </>
                                ) : (
                                  <>
                                    <Link
                                      href={`/fabric-store/my-work/challan-to-embroidery?programId=${progId || ''}`}
                                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded transition"
                                    >
                                      <Send className="w-3 h-3 text-emerald-600" />
                                      <span>Store to Embroidery</span>
                                    </Link>
                                    <Link
                                      href={`/fabric-store/my-work/challan-to-dyeing?programId=${progId || ''}`}
                                      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-1 rounded transition"
                                    >
                                      <Send className="w-3 h-3 text-indigo-600" />
                                      <span>Store to Dyeing</span>
                                    </Link>
                                  </>
                                )}
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

            {/* Recent Issues */}
            <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-200/80 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Recent Production Issues</h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">Fabric issued to production departments</p>
                </div>
              </div>
              {loading ? (
                <div className="p-6 text-center text-xs text-slate-400">Loading…</div>
              ) : recentIssues.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">No material issued yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-4">Entry #</th>
                        <th className="py-2.5 px-4">Roll</th>
                        <th className="py-2.5 px-4">Fabric</th>
                        <th className="py-2.5 px-4">Meters</th>
                        <th className="py-2.5 px-4">By</th>
                        <th className="py-2.5 px-4">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {recentIssues.map((entry: any) => (
                        <tr key={entry.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-2.5 px-4 font-mono text-[11px] text-blue-800">{entry.entryNumber}</td>
                          <td className="py-2.5 px-4 font-mono text-[11px]">{entry.roll?.rollNumber}</td>
                          <td className="py-2.5 px-4 text-[11px]">{entry.batch?.fabricDescription}</td>
                          <td className="py-2.5 px-4 font-mono font-semibold">{parseFloat(entry.quantity).toFixed(2)} m</td>
                          <td className="py-2.5 px-4 text-[11px]">{entry.transactedBy?.fullName}</td>
                          <td className="py-2.5 px-4 text-[10px] text-slate-500">
                            {new Date(entry.transactedAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-700 block">PRIMARY ACTIONS</span>
              <h3 className="text-sm font-bold text-slate-900">Fabric Store</h3>
              <div className="pt-2 space-y-2">
                {[
                  { href: '/fabric-store/my-work/incoming-challans', icon: PackageCheck, label: 'Incoming Challans', color: 'teal' },
                  { href: '/fabric-store/my-work/challan-to-dyeing', icon: Send, label: 'Store to Dyeing', color: 'indigo' },
                  { href: '/fabric-store/my-work/challan-to-embroidery', icon: Send, label: 'Store to Embroidery', color: 'emerald' },
                  { href: '/fabric-store/inventory/stock', icon: Boxes, label: 'Stock Overview', color: 'slate' },
                  { href: '/fabric-store/inventory/defected-shelf', icon: AlertTriangle, label: 'Defected Shelf', color: 'rose' },
                ].map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border text-xs font-semibold transition ${
                      action.color === 'teal' ? 'bg-teal-50/70 hover:bg-teal-100/70 border-teal-200/60 text-teal-950' :
                      action.color === 'indigo' ? 'bg-indigo-50/70 hover:bg-indigo-100/70 border-indigo-200/60 text-indigo-950' :
                      action.color === 'emerald' ? 'bg-emerald-50/70 hover:bg-emerald-100/70 border-emerald-200/60 text-emerald-950' :
                      'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <action.icon className="w-4 h-4" />
                      <span>{action.label}</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
