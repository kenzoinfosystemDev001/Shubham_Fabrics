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
      DRAFT: 'bg-accent-100 text-accent-800',
      ISSUED: 'bg-brand-100 text-brand-800',
      RECEIVED: 'bg-brand-100 text-brand-800',
      IN_TRANSIT: 'bg-brand-100 text-brand-800',
      COMPLETED: 'bg-accent-100 text-accent-800',
    };
    return (
      <span
        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
          colors[status] || 'bg-neutral-100 text-neutral-700'
        }`}
      >
        {status?.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-brand-50">
      {/* TOP HEADER (REAL DB BACKGROUND) */}
      <header
        className="bg-white border-b border-neutral-200 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md text-neutral-900"
      >
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-600 block drop-shadow-sm">
            SHUBHAM FABRICS MES · FABRIC STORE
          </span>
          <h1 className="text-xl font-bold text-neutral-900 drop-shadow-sm">Fabric Store Department Dashboard</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/fabric-store/inventory/inward"
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-lg shadow-xs transition"
          >
            <ArrowDownToLine className="w-4 h-4" />
            <span>Inward Stock</span>
          </Link>
          <Link
            href="/fabric-store/inventory/outward"
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-lg shadow-xs transition"
          >
            <Send className="w-4 h-4" />
            <span>Outward Stock</span>
          </Link>
          <Link
            href="/fabric-store/my-work/challan-to-dyeing"
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
          >
            <Send className="w-4 h-4" />
            <span>Store &rarr; Dyeing</span>
          </Link>
          <Link
            href="/fabric-store/my-work/challan-to-embroidery"
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
          >
            <Send className="w-4 h-4" />
            <span>Store &rarr; Embroidery</span>
          </Link>
        </div>
      </header>

      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {error && (
          <div className="bg-danger-50 border border-danger-200 rounded-lg p-4 text-sm text-danger-800">
            {error}
          </div>
        )}

        {/* CORE FABRIC STORE MODULE TILES (HANDWRITTEN SPECIFICATION) */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Link
            href="/fabric-store/inventory/inward"
            className="bg-white p-4 rounded-xl border border-accent-200 hover:border-accent-500 hover:shadow-md transition group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-700">
                1. INWARD STOCK
              </span>
              <ArrowDownToLine className="w-4 h-4 text-accent-700 group-hover:scale-110 transition" />
            </div>
            <h3 className="text-sm font-black text-neutral-900 mt-2">Any New Fabric Arriving</h3>
            <p className="text-[11px] text-neutral-500 mt-1">
              Log mill bills, receiving date, bill quantity in MTR or PCS.
            </p>
            <div className="flex items-center gap-1 text-[11px] font-bold text-accent-800 mt-3">
              <span>Open Inward Table</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          <Link
            href="/fabric-store/inventory/outward"
            className="bg-white p-4 rounded-xl border border-accent-200 hover:border-accent-500 hover:shadow-md transition group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-700">
                2. OUTWARD STOCK
              </span>
              <Send className="w-4 h-4 text-accent-700 group-hover:scale-110 transition" />
            </div>
            <h3 className="text-sm font-black text-neutral-900 mt-2">Dispatches &amp; Challans</h3>
            <p className="text-[11px] text-neutral-500 mt-1">
              Auto-updated when Challan is created to Dyeing or Embroidery.
            </p>
            <div className="flex items-center gap-1 text-[11px] font-bold text-accent-800 mt-3">
              <span>Open Outward Table</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          <Link
            href="/fabric-store/inventory/total-stock"
            className="bg-white p-4 rounded-xl border border-brand-200 hover:border-brand-500 hover:shadow-md transition group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-brand-700">
                TOTAL STOCK
              </span>
              <Boxes className="w-4 h-4 text-brand-600 group-hover:scale-110 transition" />
            </div>
            <h3 className="text-sm font-black text-neutral-900 mt-2">DYED &amp; UNDYED Balance</h3>
            <p className="text-[11px] text-neutral-500 mt-1">
              Real-time In-Store Balance: Inward minus Outward dispatches.
            </p>
            <div className="flex items-center gap-1 text-[11px] font-bold text-brand-700 mt-3">
              <span>View Stock Balance</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          <Link
            href="/fabric-store/inventory/defected-shelf"
            className="bg-white p-4 rounded-xl border border-danger-200 hover:border-danger-500 hover:shadow-md transition group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-danger-700">
                DEFECTIVE SHELF
              </span>
              <AlertTriangle className="w-4 h-4 text-danger-600 group-hover:scale-110 transition" />
            </div>
            <h3 className="text-sm font-black text-neutral-900 mt-2">DEF-SHELF-STORE</h3>
            <p className="text-[11px] text-neutral-500 mt-1">
              Isolated weaving slub &amp; tear defect fabric pieces quarantined.
            </p>
            <div className="flex items-center gap-1 text-[11px] font-bold text-danger-700 mt-3">
              <span>Inspect Quarantined</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        </section>

        {/* KPI CARDS */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Rolls', value: kpis.totalRolls ?? '—', color: 'text-neutral-900', sub: 'All rolls on record' },
            { label: 'In Stock', value: kpis.rollsInStock ?? '—', color: 'text-brand-700', sub: 'Available in store' },
            { label: 'Issued to Production', value: kpis.rollsIssued ?? '—', color: 'text-brand-600', sub: 'Dispatched to lines' },
            { label: 'Incoming Challans', value: kpis.incomingChallansCount ?? '—', color: 'text-accent-800', sub: 'Received in store' },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white border border-neutral-200/90 rounded-lg p-3.5 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">{kpi.label}</span>
              <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>
                {loading ? <span className="text-neutral-700">…</span> : kpi.value}
              </p>
              <span className="text-[10px] text-neutral-500 mt-0.5 block">{kpi.sub}</span>
            </div>
          ))}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Incoming Challans */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-neutral-200/90 rounded-xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-neutral-200/80 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-neutral-900">Incoming Production Challans</h2>
                  <p className="text-[11px] text-neutral-500 mt-0.5">Challans addressed to Fabric Store department</p>
                </div>
                <Link
                  href="/fabric-store/my-work/incoming-challans"
                  className="text-xs font-semibold text-brand-700 hover:text-brand-900"
                >
                  View All →
                </Link>
              </div>

              {loading ? (
                <div className="p-8 text-center text-xs text-neutral-500">Loading incoming challans…</div>
              ) : incomingChallans.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <PackageCheck className="w-10 h-10 text-neutral-700 mx-auto" />
                  <p className="text-xs font-semibold text-neutral-700">No incoming challans at this time</p>
                  <p className="text-[11px] text-neutral-500">Challans dispatched to Fabric Store will appear here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-50/80 text-neutral-600 font-semibold border-b border-neutral-200">
                      <tr>
                        <th className="py-2.5 px-4">Challan No.</th>
                        <th className="py-2.5 px-4">Origin</th>
                        <th className="py-2.5 px-4">Program / Buyer</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4 text-right">Issue Next Challan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 text-neutral-700">
                      {incomingChallans.map((ch: any) => {
                        const prog = ch.program;
                        const progId = ch.programId || prog?.id;
                        return (
                          <tr key={ch.id} className="hover:bg-neutral-50/60 transition">
                            <td className="py-3 px-4 font-mono font-bold text-brand-800">
                              <Link href={`/challans/${ch.id}`} className="hover:underline">
                                {ch.challanNumber}
                              </Link>
                            </td>
                            <td className="py-3 px-4 font-semibold text-neutral-900">
                              {ch.fromDepartment}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-mono font-semibold block">
                                {prog?.programNumber || prog?.programSerialNo || '—'}
                              </span>
                              <span className="text-[10px] text-neutral-500">
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
                                      className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-800 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-2 py-1 rounded transition"
                                    >
                                      <Send className="w-3 h-3 text-brand-600" />
                                      <span>Store to Dyeing</span>
                                    </Link>
                                    <Link
                                      href={`/fabric-store/my-work/challan-to-embroidery?programId=${progId || ''}`}
                                      className="inline-flex items-center gap-1 text-[11px] font-bold text-accent-800 bg-accent-50 hover:bg-accent-100 border border-accent-200 px-2 py-1 rounded transition"
                                    >
                                      <Send className="w-3 h-3 text-accent-700" />
                                      <span>Store to Embroidery</span>
                                    </Link>
                                  </>
                                ) : (
                                  <>
                                    <Link
                                      href={`/fabric-store/my-work/challan-to-embroidery?programId=${progId || ''}`}
                                      className="inline-flex items-center gap-1 text-[11px] font-bold text-accent-800 bg-accent-50 hover:bg-accent-100 border border-accent-200 px-2 py-1 rounded transition"
                                    >
                                      <Send className="w-3 h-3 text-accent-700" />
                                      <span>Store to Embroidery</span>
                                    </Link>
                                    <Link
                                      href={`/fabric-store/my-work/challan-to-dyeing?programId=${progId || ''}`}
                                      className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-800 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-2 py-1 rounded transition"
                                    >
                                      <Send className="w-3 h-3 text-brand-600" />
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
            <div className="bg-white border border-neutral-200/90 rounded-xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-neutral-200/80 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-neutral-900">Recent Production Issues</h2>
                  <p className="text-[11px] text-neutral-500 mt-0.5">Fabric issued to production departments</p>
                </div>
              </div>
              {loading ? (
                <div className="p-6 text-center text-xs text-neutral-500">Loading…</div>
              ) : recentIssues.length === 0 ? (
                <div className="p-8 text-center text-xs text-neutral-500">No material issued yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-50/80 text-neutral-600 font-semibold border-b border-neutral-200">
                      <tr>
                        <th className="py-2.5 px-4">Entry #</th>
                        <th className="py-2.5 px-4">Roll</th>
                        <th className="py-2.5 px-4">Fabric</th>
                        <th className="py-2.5 px-4">Meters</th>
                        <th className="py-2.5 px-4">By</th>
                        <th className="py-2.5 px-4">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 text-neutral-700">
                      {recentIssues.map((entry: any) => (
                        <tr key={entry.id} className="hover:bg-neutral-50/60 transition">
                          <td className="py-2.5 px-4 font-mono text-[11px] text-brand-800">{entry.entryNumber}</td>
                          <td className="py-2.5 px-4 font-mono text-[11px]">{entry.roll?.rollNumber}</td>
                          <td className="py-2.5 px-4 text-[11px]">{entry.batch?.fabricDescription}</td>
                          <td className="py-2.5 px-4 font-mono font-semibold">{parseFloat(entry.quantity).toFixed(2)} m</td>
                          <td className="py-2.5 px-4 text-[11px]">{entry.transactedBy?.fullName}</td>
                          <td className="py-2.5 px-4 text-[10px] text-neutral-500">
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
            <div className="bg-white border border-neutral-200/90 rounded-xl p-5 shadow-xs space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-700 block">PRIMARY ACTIONS</span>
              <h3 className="text-sm font-bold text-neutral-900">Fabric Store</h3>
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
                      action.color === 'teal' ? 'bg-brand-50/70 hover:bg-brand-100/70 border-brand-200/60 text-brand-900' :
                      action.color === 'indigo' ? 'bg-brand-50/70 hover:bg-brand-100/70 border-brand-200/60 text-brand-900' :
                      action.color === 'emerald' ? 'bg-accent-50/70 hover:bg-accent-100/70 border-accent-200/60 text-accent-800' :
                      'bg-neutral-50 hover:bg-neutral-100 border-neutral-200 text-neutral-900'
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
