'use client';

import React, { useState, useEffect } from 'react';
import { departmentName } from '@/lib/workflow-views';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  PackageCheck,
  Send,
  Boxes,
  Layers,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  ArrowDownToLine,
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

  const stats = [
    { label: 'Total Rolls', value: kpis.totalRolls, icon: Layers, tone: 'bg-neutral-100 text-neutral-700' },
    { label: 'In Stock', value: kpis.rollsInStock, icon: Boxes, tone: 'bg-brand-50 text-brand-700' },
    { label: 'Issued to Production', value: kpis.rollsIssued, icon: Send, tone: 'bg-brand-50 text-brand-700' },
    { label: 'Incoming Challans', value: kpis.incomingChallansCount, icon: PackageCheck, tone: 'bg-accent-100 text-neutral-900' },
  ];

  const shortcuts = [
    { href: '/fabric-store/inventory/inward', label: 'Inward Stock', icon: ArrowDownToLine },
    { href: '/fabric-store/inventory/outward', label: 'Outward Stock', icon: Send },
    { href: '/fabric-store/inventory/total-stock', label: 'Total Stock', icon: Boxes },
    { href: '/fabric-store/inventory/stock', label: 'Stock Overview', icon: Layers },
    { href: '/fabric-store/inventory/defected-shelf', label: 'Defective Shelf', icon: AlertTriangle, danger: true },
  ];

  const panel = 'bg-white border border-neutral-200 rounded-2xl shadow-xs overflow-hidden';
  const panelHeader = 'px-5 py-4 border-b border-neutral-200 flex items-center justify-between';

  return (
    <div className="min-h-screen bg-canvas">
      {/* HEADER */}
      <header className="bg-white/90 backdrop-blur border-b border-neutral-200 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-neutral-900">Fabric Store</h1>
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
            href="/fabric-store/my-work/challan-to-dyeing"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
          >
            <Send className="w-4 h-4" />
            <span>Store &rarr; Dyeing</span>
          </Link>
          <Link
            href="/fabric-store/my-work/challan-to-embroidery"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-brand-50 text-brand-800 border border-brand-300 text-xs font-semibold rounded-lg transition"
          >
            <Send className="w-4 h-4" />
            <span>Store &rarr; Embroidery</span>
          </Link>
        </div>
      </header>

      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {error && (
          <div className="bg-danger-50 border border-danger-200 rounded-xl p-4 text-sm text-danger-800">{error}</div>
        )}

        {/* STATS */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-white border border-neutral-200 rounded-2xl p-4 sm:p-5 shadow-xs flex items-center gap-4">
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${stat.tone}`}>
                <stat.icon className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-neutral-900 leading-none tabular-nums">
                  {loading ? <span className="text-neutral-400">…</span> : stat.value ?? '—'}
                </p>
                <p className="text-xs font-medium text-neutral-500 mt-1.5 truncate">{stat.label}</p>
              </div>
            </div>
          ))}
        </section>

        {/* SHORTCUTS */}
        <nav aria-label="Fabric store sections" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {shortcuts.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group bg-white border border-neutral-200 hover:border-brand-300 hover:shadow-sm rounded-xl px-4 py-3 flex items-center gap-3 transition"
            >
              <item.icon className={`w-4 h-4 shrink-0 ${item.danger ? 'text-danger-600' : 'text-brand-600'}`} />
              <span className="flex-1 text-sm font-semibold text-neutral-900 truncate">{item.label}</span>
              <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-brand-600 transition" />
            </Link>
          ))}
        </nav>

        {/* INCOMING CHALLANS */}
        <section className={panel}>
          <div className={panelHeader}>
            <h2 className="text-sm font-bold text-neutral-900">Incoming Challans</h2>
            <Link
              href="/fabric-store/my-work/incoming-challans"
              className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="p-10 text-center text-xs text-neutral-500">Loading…</div>
          ) : incomingChallans.length === 0 ? (
            <div className="p-12 text-center">
              <PackageCheck className="w-8 h-8 text-neutral-300 mx-auto" />
              <p className="text-sm font-medium text-neutral-500 mt-3">No incoming challans</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-[11px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-neutral-200">
                  <tr>
                    <th className="py-3 px-4">Challan No.</th>
                    <th className="py-3 px-4">Origin</th>
                    <th className="py-3 px-4">Program / Buyer</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Issue Next Challan</th>
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
                          {departmentName(ch.fromDepartment)}
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
        </section>

        {/* RECENT ISSUES */}
        <section className={panel}>
          <div className={panelHeader}>
            <h2 className="text-sm font-bold text-neutral-900">Recent Issues</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-xs text-neutral-500">Loading…</div>
          ) : recentIssues.length === 0 ? (
            <div className="p-10 text-center text-sm font-medium text-neutral-500">No material issued yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-[11px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-neutral-200">
                  <tr>
                    <th className="py-3 px-4">Entry #</th>
                    <th className="py-3 px-4">Roll</th>
                    <th className="py-3 px-4">Fabric</th>
                    <th className="py-3 px-4">Meters</th>
                    <th className="py-3 px-4">By</th>
                    <th className="py-3 px-4">Date</th>
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
        </section>
      </main>
    </div>
  );
}
