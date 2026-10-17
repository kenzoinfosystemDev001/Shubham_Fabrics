'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  RefreshCw,
  Briefcase,
  Kanban,
  Clock,
  Send,
  AlertCircle,
  Calendar,
  Layers,
  User,
  ArrowRight,
  TrendingUp,
  FileText,
  ShieldAlert,
  RotateCcw,
  PauseCircle,
  PackageCheck
} from 'lucide-react';
import { api } from '@/lib/api';
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';

export default function QC1Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/qc1/dashboard');
      if (!res.ok) {
        throw new Error('Failed to load QC1 dashboard data');
      }
      const json = await res.json();
      setData(json.data);
    } catch (err: any) {
      console.error('Error loading QC1 dashboard:', err);
      setError(err.message || 'Error connecting to database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('subham_mes_user');
      if (savedUser) {
        try {
          setCurrentUser(JSON.parse(savedUser));
        } catch {}
      }
    }
    loadData();
  }, []);

  const kpis = data?.kpis || {
    totalWork: 0,
    awaitingReceiving: 0,
    received: 0,
    awaitingInspection: 0,
    underInspection: 0,
    completed: 0,
    passed: 0,
    failed: 0,
    rework: 0,
    hold: 0,
    totalQuantityReceived: 0,
    totalQuantityInspected: 0,
    passedQuantity: 0,
    failedQuantity: 0,
    reworkQuantity: 0,
    holdQuantity: 0,
  };

  const priorityWork = data?.priorityWork || [];
  const upcomingDelivery = data?.upcomingDelivery || [];
  const recentActivity = data?.recentActivity || [];

  const inspectorName =
    currentUser?.fullName ||
    currentUser?.username ||
    'Dyeing QC Inspector';

  return (
    <div className="min-h-screen bg-[#FDFBF7] pb-16">
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
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 block drop-shadow-sm">
            SHUBHAM FABRICS MES · QUALITY ASSURANCE
          </span>
          <h1 className="text-xl font-bold text-white flex items-center gap-2 drop-shadow-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>Dyeing QC Dashboard</span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-lg border border-slate-700/60 transition"
            title="Refresh Dashboard"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <Link
            href="/qc1/floor-board"
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800/90 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg border border-slate-700 transition"
          >
            <Kanban className="w-4 h-4 text-emerald-300" />
            <span>Floor Board</span>
          </Link>

          <Link
            href="/qc1/my-work"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
          >
            <Briefcase className="w-4 h-4" />
            <span>My Work</span>
          </Link>
        </div>
      </header>

      {/* ERROR BANNER */}
      {error && (
        <div className="mx-4 sm:mx-8 mt-4 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
          <button onClick={loadData} className="ml-auto underline font-bold">
            Retry
          </button>
        </div>
      )}

      <main className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
        {/* OPERATIONAL SUMMARY CARDS: 7 PRIMARY STAGES */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Dyeing QC Operational Status Summary
              </h2>
              <p className="text-[11px] text-slate-500">
                Active workflow stage metrics for dyed fabric inspection
              </p>
            </div>
            <span className="text-[11px] font-mono font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              Inspector: {inspectorName}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {/* 1. RECEIVED */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Received
              </span>
              <div className="text-2xl font-mono font-bold text-slate-900 mt-1">
                {kpis.received}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                At Inspection Gate
              </span>
            </div>

            {/* 2. AWAITING INSPECTION */}
            <div className="bg-white border border-amber-200/90 rounded-xl p-3.5 shadow-xs bg-amber-50/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
                Awaiting QC
              </span>
              <div className="text-2xl font-mono font-bold text-amber-900 mt-1">
                {kpis.awaitingInspection}
              </div>
              <span className="text-[10px] text-amber-700/80 mt-1 block">
                Issued + Received
              </span>
            </div>

            {/* 3. UNDER INSPECTION */}
            <div className="bg-white border border-blue-200/90 rounded-xl p-3.5 shadow-xs bg-blue-50/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
                Under Inspection
              </span>
              <div className="text-2xl font-mono font-bold text-blue-900 mt-1">
                {kpis.underInspection}
              </div>
              <span className="text-[10px] text-blue-700/80 mt-1 block">
                On Inspection Table
              </span>
            </div>

            {/* 4. PASSED */}
            <div className="bg-white border border-emerald-200/90 rounded-xl p-3.5 shadow-xs bg-emerald-50/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                PASS (Next Dept)
              </span>
              <div className="text-2xl font-mono font-bold text-emerald-900 mt-1">
                {kpis.passed}
              </div>
              <span className="text-[10px] text-emerald-700/80 mt-1 block">
                Approved Quality
              </span>
            </div>

            {/* 5. FAILED / REJECTED */}
            <div className="bg-white border border-rose-200/90 rounded-xl p-3.5 shadow-xs bg-rose-50/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">
                REJECT (Store Shelf)
              </span>
              <div className="text-2xl font-mono font-bold text-rose-900 mt-1">
                {kpis.failed}
              </div>
              <span className="text-[10px] text-rose-700/80 mt-1 block">
                To Defective Shelf
              </span>
            </div>

            {/* 6. REWORK */}
            <div className="bg-white border border-purple-200/90 rounded-xl p-3.5 shadow-xs bg-purple-50/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block">
                REWORK (To Dyeing)
              </span>
              <div className="text-2xl font-mono font-bold text-purple-900 mt-1">
                {kpis.rework}
              </div>
              <span className="text-[10px] text-purple-700/80 mt-1 block">
                Returned to Dyeing
              </span>
            </div>

            {/* 7. HOLD */}
            <div className="bg-white border border-slate-300 rounded-xl p-3.5 shadow-xs bg-slate-50/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
                On Hold
              </span>
              <div className="text-2xl font-mono font-bold text-slate-900 mt-1">
                {kpis.hold}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Pending Review
              </span>
            </div>
          </div>
        </div>

        {/* QUANTITIES ACCOUNTING DASHBOARD */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                <span>Fabric Yardage Accounting &amp; Quality Balances</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Exact physical meterage audited from Dyeing challans and verified inspection balances
              </p>
            </div>
            <Link
              href="/qc1/my-work"
              className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-1"
            >
              <span>Inspect Incoming</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Total Received
              </span>
              <span className="text-lg font-mono font-bold text-slate-900 block mt-1">
                {kpis.totalQuantityReceived.toLocaleString()} <span className="text-xs font-normal text-slate-500">MTR</span>
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                From Dyeing Challans
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
                Total Inspected
              </span>
              <span className="text-lg font-mono font-bold text-blue-900 block mt-1">
                {kpis.totalQuantityInspected.toLocaleString()} <span className="text-xs font-normal text-slate-500">MTR</span>
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                Audited by Inspectors
              </span>
            </div>

            <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                Passed Yardage
              </span>
              <span className="text-lg font-mono font-bold text-emerald-950 block mt-1">
                {kpis.passedQuantity.toLocaleString()} <span className="text-xs font-normal text-emerald-700">MTR</span>
              </span>
              <span className="text-[10px] text-emerald-700 block mt-0.5">
                Approved Quality
              </span>
            </div>

            <div className="p-3 bg-rose-50/60 rounded-lg border border-rose-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 block">
                Rejected (Defective Shelf)
              </span>
              <span className="text-lg font-mono font-bold text-rose-950 block mt-1">
                {kpis.failedQuantity.toLocaleString()} <span className="text-xs font-normal text-rose-700">MTR</span>
              </span>
              <span className="text-[10px] text-rose-700 block mt-0.5">
                To Fabric Store Shelf
              </span>
            </div>

            <div className="p-3 bg-purple-50/60 rounded-lg border border-purple-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800 block">
                Rework (To Dyeing)
              </span>
              <span className="text-lg font-mono font-bold text-purple-950 block mt-1">
                {kpis.reworkQuantity.toLocaleString()} <span className="text-xs font-normal text-purple-700">MTR</span>
              </span>
              <span className="text-[10px] text-purple-700 block mt-0.5">
                Returned to Dyeing
              </span>
            </div>

            <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                Hold Yardage
              </span>
              <span className="text-lg font-mono font-bold text-amber-950 block mt-1">
                {kpis.holdQuantity.toLocaleString()} <span className="text-xs font-normal text-amber-700">MTR</span>
              </span>
              <span className="text-[10px] text-amber-700 block mt-0.5">
                Pending Investigation
              </span>
            </div>
          </div>
        </div>

        {/* 2-COLUMN OPERATIONAL QUEUES: PRIORITY WORK & UPCOMING DELIVERY */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* PRIORITY WORK */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Priority Work Pending Inspection
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-500">
                {priorityWork.length} Items
              </span>
            </div>

            {priorityWork.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No urgent priority lots currently waiting for QC1 inspection.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {priorityWork.map((item: any) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">
                          {item.challanNumber}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-rose-100 text-rose-800">
                          {item.priority}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        Sheet: <span className="font-medium text-slate-700">{item.productionSheetNumber}</span> · {item.fabric} ({item.color})
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono font-bold text-slate-900 block">
                        {item.quantity} {item.uom}
                      </span>
                      <span className="text-[10px] text-slate-500 uppercase font-medium">
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* UPCOMING DELIVERY SCHEDULE */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Target Delivery Schedule
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-500">
                {upcomingDelivery.length} Lots
              </span>
            </div>

            {upcomingDelivery.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No upcoming delivery deadlines tied to pending QC1 lots.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {upcomingDelivery.map((item: any) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">
                          {item.productionSheetNumber}
                        </span>
                        <span className="text-[11px] text-slate-600 truncate">
                          ({item.clientName})
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Challan: <span className="font-mono">{item.challanNumber}</span> · {item.quantity} {item.uom}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-semibold text-blue-900 block">
                        {item.deliveryDate ? new Date(item.deliveryDate).toLocaleDateString() : '—'}
                      </span>
                      <span className="text-[10px] text-slate-500 uppercase">
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RECENT QC1 ACTIVITY AUDIT LOG */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Recent QC1 Inspection Activity
              </h3>
            </div>
            <span className="text-[11px] text-slate-500">
              Live Audit Trail
            </span>
          </div>

          {recentActivity.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <PackageCheck className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-medium text-slate-600">
                No quality inspection records currently completed.
              </p>
              <p className="text-[11px] text-slate-400">
                When QC1 inspectors record inspection results, verified transaction entries will log here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Date/Time</th>
                    <th className="py-2.5 px-3">Production Sheet</th>
                    <th className="py-2.5 px-3">Inspector</th>
                    <th className="py-2.5 px-3 text-right">Inspected</th>
                    <th className="py-2.5 px-3 text-right">Passed</th>
                    <th className="py-2.5 px-3 text-right">Rework</th>
                    <th className="py-2.5 px-3 text-right">Failed</th>
                    <th className="py-2.5 px-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {recentActivity.map((tx: any) => (
                    <tr key={tx.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-mono text-slate-500">
                        {tx.recordedAt ? new Date(tx.recordedAt).toLocaleString() : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-medium text-slate-900">
                        {tx.productionSheetNumber}
                      </td>
                      <td className="py-2.5 px-3 font-medium">
                        {tx.inspector}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        {tx.inputQuantity} {tx.unitOfMeasure}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                        {tx.goodQuantity} {tx.unitOfMeasure}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-purple-700">
                        {tx.reworkQuantity || 0} {tx.unitOfMeasure}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">
                        {tx.rejectQuantity || 0} {tx.unitOfMeasure}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 truncate max-w-xs">
                        {tx.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
