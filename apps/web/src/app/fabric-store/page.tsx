'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  PackageCheck,
  ClipboardCheck,
  ArrowUpFromLine,
  RefreshCw,
  Layers,
  AlertTriangle,
  TrendingUp,
  ShieldCheck,
  ArrowRight,
  Package,
  Send,
} from 'lucide-react';

export default function FabricStoreDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/fabric-store/dashboard');
      if (!res.ok) throw new Error('Failed to load dashboard data');
      const json = await res.json();
      setData(json.data);
    } catch (err: any) {
      setError(err.message);
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
      try {
        const parsed = JSON.parse(savedUser);
        const isProgramming = (parsed.departmentCode === 'PROGRAMMING' || parsed.role === 'PROGRAMMER' || parsed.role === 'PROGRAMMING_INCHARGE') &&
          parsed.role !== 'ADMIN' && parsed.role !== 'SUPER_ADMIN';
        if (isProgramming) {
          router.push('/');
          return;
        }
      } catch {}
    }
    loadData();
  }, [router]);

  const kpis = data?.kpis || {};
  const recentGRNs = data?.recentGRNs || [];
  const recentIssues = data?.recentIssues || [];

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-amber-100 text-amber-800',
      CONFIRMED: 'bg-blue-100 text-blue-800',
      QC_PENDING: 'bg-orange-100 text-orange-800',
      QC_COMPLETE: 'bg-indigo-100 text-indigo-800',
      CLOSED: 'bg-emerald-100 text-emerald-800',
    };
    return (
      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${colors[status] || 'bg-slate-100 text-slate-700'}`}>
        {status?.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#F0FAF9]">
      {/* TOP HEADER */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-8 py-4 flex items-center justify-between shadow-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-700 block">
            SHUBHAM FABRICS MES · FABRIC STORE
          </span>
          <h1 className="text-xl font-bold text-slate-900">Fabric Store Department Dashboard</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/fabric-store/my-work/material-receipt/create"
            className="flex items-center gap-2 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-md shadow-xs transition"
          >
            <PackageCheck className="w-4 h-4" />
            <span>New GRN</span>
          </Link>
          <Link
            href="/fabric-store/my-work/qc-inspections"
            className="flex items-center gap-2 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-md shadow-xs transition"
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>QC Queue</span>
          </Link>
          <Link
            href="/fabric-store/my-work/material-issue"
            className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-xs transition"
          >
            <ArrowUpFromLine className="w-4 h-4" />
            <span>Issue Material</span>
          </Link>
          <Link
            href="/fabric-store/my-work/issue-challan"
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-md shadow-xs transition"
          >
            <Send className="w-4 h-4" />
            <span>Issue Challan</span>
          </Link>
        </div>
      </header>

      <main className="p-8 max-w-7xl mx-auto space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* KPI CARDS */}
        <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'Total Rolls', value: kpis.totalRolls ?? '—', color: 'text-slate-900', sub: 'All rolls on record' },
            { label: 'In Stock', value: kpis.rollsInStock ?? '—', color: 'text-teal-700', sub: 'Available' },
            { label: 'On QC Hold', value: kpis.rollsOnHold ?? '—', color: 'text-amber-600', sub: 'Pending release' },
            { label: 'Issued', value: kpis.rollsIssued ?? '—', color: 'text-blue-600', sub: 'To production' },
            { label: 'Pending QC', value: kpis.pendingQC ?? '—', color: 'text-orange-600', sub: 'Needs inspection' },
            { label: "Today's Receipts", value: kpis.todayReceipts ?? '—', color: 'text-indigo-600', sub: 'GRNs today' },
            { label: "Today's Issues", value: kpis.todayIssues ?? '—', color: 'text-emerald-700', sub: 'Issues today' },
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
          {/* Recent GRNs */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-200/80 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Recent Goods Receipt Notes (GRN)</h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">Latest fabric receipts from suppliers</p>
                </div>
                <Link href="/fabric-store/my-work/material-receipt" className="text-xs font-semibold text-teal-700 hover:text-teal-900">
                  View All →
                </Link>
              </div>
              {loading ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading GRNs…</div>
              ) : recentGRNs.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <Layers className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700">No GRNs created yet</p>
                  <p className="text-[11px] text-slate-500">Start by receiving fabric from a supplier.</p>
                  <Link
                    href="/fabric-store/my-work/material-receipt/create"
                    className="inline-flex items-center gap-2 px-3.5 py-2 bg-teal-700 text-white text-xs font-semibold rounded-md shadow-xs"
                  >
                    <PackageCheck className="w-3.5 h-3.5" />
                    <span>Create First GRN</span>
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-4">GRN Number</th>
                        <th className="py-2.5 px-4">Batch</th>
                        <th className="py-2.5 px-4">Supplier</th>
                        <th className="py-2.5 px-4">Rolls</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4">Received By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {recentGRNs.map((grn: any) => (
                        <tr key={grn.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-3 px-4 font-mono font-bold text-teal-800">
                            {grn.grnNumber}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono text-[11px] block">{grn.batch?.batchNumber}</span>
                            <span className="text-[10px] text-slate-500">{grn.batch?.fabricType} · {grn.batch?.fabricDescription}</span>
                          </td>
                          <td className="py-3 px-4">{grn.supplierName}</td>
                          <td className="py-3 px-4 font-mono font-semibold">{grn.totalRollsReceived}</td>
                          <td className="py-3 px-4">{statusBadge(grn.status)}</td>
                          <td className="py-3 px-4 text-[11px]">{grn.receivedBy?.fullName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Recent Issues */}
            <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-200/80 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Recent Material Issues</h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">Fabric issued to production departments</p>
                </div>
                <Link href="/fabric-store/my-work/material-issue" className="text-xs font-semibold text-blue-700 hover:text-blue-900">
                  View All →
                </Link>
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
                  { href: '/fabric-store/my-work/material-receipt/create', icon: PackageCheck, label: 'Receive Fabric (GRN)', color: 'teal' },
                  { href: '/fabric-store/my-work/qc-inspections', icon: ClipboardCheck, label: 'Conduct QC', color: 'amber' },
                  { href: '/fabric-store/my-work/material-issue', icon: ArrowUpFromLine, label: 'Issue Material', color: 'blue' },
                  { href: '/fabric-store/my-work/issue-challan', icon: Send, label: 'Issue Challan (Dyeing / Embroidery)', color: 'emerald' },
                  { href: '/fabric-store/inventory/defected-shelf', icon: AlertTriangle, label: 'Defected Shelf (Quarantine)', color: 'rose' },
                  { href: '/fabric-store/inventory/stock', icon: Layers, label: 'View Inventory', color: 'slate' },
                ].map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border text-xs font-semibold transition ${
                      action.color === 'teal' ? 'bg-teal-50/70 hover:bg-teal-100/70 border-teal-200/60 text-teal-950' :
                      action.color === 'amber' ? 'bg-amber-50/70 hover:bg-amber-100/70 border-amber-200/60 text-amber-950' :
                      action.color === 'blue' ? 'bg-blue-50/70 hover:bg-blue-100/70 border-blue-200/60 text-blue-950' :
                      action.color === 'emerald' ? 'bg-emerald-50/70 hover:bg-emerald-100/70 border-emerald-200/60 text-emerald-950' :
                      action.color === 'rose' ? 'bg-rose-50/70 hover:bg-rose-100/70 border-rose-200/60 text-rose-950' :
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

            {/* Alerts */}
            {!loading && kpis.pendingQC > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-bold text-amber-800">QC ATTENTION REQUIRED</span>
                </div>
                <p className="text-xs text-amber-700">
                  <strong>{kpis.pendingQC}</strong> roll(s) are waiting for QC inspection.
                </p>
                <Link
                  href="/fabric-store/my-work/qc-inspections"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 hover:text-amber-900"
                >
                  Conduct QC Inspection →
                </Link>
              </div>
            )}

            <div className="bg-[#F0FAF9] border border-teal-200/60 rounded-xl p-4 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-700 block">STORE STANDARD NOTICE</span>
              <h4 className="text-xs font-bold text-slate-900">Material Flow Protocol</h4>
              <p className="text-xs text-slate-600 leading-relaxed font-serif">
                All fabric received must be GRN-tagged, QC inspected, and location-assigned before issue. Rejected rolls must be written off — they cannot be issued. Stock ledger entries are immutable.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
