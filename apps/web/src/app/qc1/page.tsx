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
    <div className="min-h-screen bg-neutral-50 pb-16">
      {/* TOP HEADER (REAL DB BACKGROUND) */}
      <header
        className="bg-white border-b border-neutral-200 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md text-neutral-900"
      >
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-700 block drop-shadow-sm">
            SHUBHAM FABRICS MES · QUALITY ASSURANCE
          </span>
          <h1 className="text-xl font-bold text-neutral-900 flex items-center gap-2 drop-shadow-sm">
            <CheckCircle2 className="w-5 h-5 text-accent-700" />
            <span>Dyeing QC Dashboard</span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition"
            title="Refresh Dashboard"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <Link
            href="/qc1/floor-board"
            className="flex items-center gap-1.5 px-3 py-2 bg-neutral-50 hover:bg-neutral-100 text-neutral-900 text-xs font-semibold rounded-lg border border-neutral-200 transition"
          >
            <Kanban className="w-4 h-4 text-accent-700" />
            <span>Floor Board</span>
          </Link>

          <Link
            href="/qc1/my-work"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
          >
            <Briefcase className="w-4 h-4" />
            <span>My Work</span>
          </Link>
        </div>
      </header>

      {/* ERROR BANNER */}
      {error && (
        <div className="mx-4 sm:mx-8 mt-4 p-4 bg-danger-50 border border-danger-200 rounded-xl flex items-center gap-3 text-danger-800 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-danger-600" />
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
              <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Dyeing QC Operational Status Summary
              </h2>
              <p className="text-[11px] text-neutral-500">
                Active workflow stage metrics for dyed fabric inspection
              </p>
            </div>
            <span className="text-[11px] font-mono font-medium text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
              Inspector: {inspectorName}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {/* 1. RECEIVED */}
            <div className="bg-white border border-neutral-200/90 rounded-xl p-3.5 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
                Received
              </span>
              <div className="text-2xl font-mono font-bold text-neutral-900 mt-1">
                {kpis.received}
              </div>
              <span className="text-[10px] text-neutral-500 mt-1 block">
                At Inspection Gate
              </span>
            </div>

            {/* 2. AWAITING INSPECTION */}
            <div className="bg-white border border-accent-200/90 rounded-xl p-3.5 shadow-xs bg-accent-50/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-700 block">
                Awaiting QC
              </span>
              <div className="text-2xl font-mono font-bold text-neutral-900 mt-1">
                {kpis.awaitingInspection}
              </div>
              <span className="text-[10px] text-accent-800 mt-1 block">
                Issued + Received
              </span>
            </div>

            {/* 3. UNDER INSPECTION */}
            <div className="bg-white border border-brand-200/90 rounded-xl p-3.5 shadow-xs bg-brand-50/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700 block">
                Under Inspection
              </span>
              <div className="text-2xl font-mono font-bold text-brand-900 mt-1">
                {kpis.underInspection}
              </div>
              <span className="text-[10px] text-brand-700 mt-1 block">
                On Inspection Table
              </span>
            </div>

            {/* 4. PASSED */}
            <div className="bg-white border border-accent-200/90 rounded-xl p-3.5 shadow-xs bg-accent-50/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-700 block">
                PASS (Next Dept)
              </span>
              <div className="text-2xl font-mono font-bold text-neutral-900 mt-1">
                {kpis.passed}
              </div>
              <span className="text-[10px] text-accent-800 mt-1 block">
                Approved Quality
              </span>
            </div>

            {/* 5. FAILED / REJECTED */}
            <div className="bg-white border border-danger-200/90 rounded-xl p-3.5 shadow-xs bg-danger-50/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-danger-700 block">
                REJECT (Store Shelf)
              </span>
              <div className="text-2xl font-mono font-bold text-danger-900 mt-1">
                {kpis.failed}
              </div>
              <span className="text-[10px] text-danger-700 mt-1 block">
                To Defective Shelf
              </span>
            </div>

            {/* 6. REWORK */}
            <div className="bg-white border border-brand-200/90 rounded-xl p-3.5 shadow-xs bg-brand-50/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700 block">
                REWORK (To Dyeing)
              </span>
              <div className="text-2xl font-mono font-bold text-brand-900 mt-1">
                {kpis.rework}
              </div>
              <span className="text-[10px] text-brand-700 mt-1 block">
                Returned to Dyeing
              </span>
            </div>

            {/* 7. HOLD */}
            <div className="bg-white border border-neutral-300 rounded-xl p-3.5 shadow-xs bg-neutral-50/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-600 block">
                On Hold
              </span>
              <div className="text-2xl font-mono font-bold text-neutral-900 mt-1">
                {kpis.hold}
              </div>
              <span className="text-[10px] text-neutral-500 mt-1 block">
                Pending Review
              </span>
            </div>
          </div>
        </div>

        {/* QUANTITIES ACCOUNTING DASHBOARD */}
        <div className="bg-white border border-neutral-200/90 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-4">
            <div>
              <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-accent-700" />
                <span>Fabric Yardage Accounting &amp; Quality Balances</span>
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Exact physical meterage audited from Dyeing challans and verified inspection balances
              </p>
            </div>
            <Link
              href="/qc1/my-work"
              className="text-xs text-accent-800 hover:text-accent-800 font-semibold flex items-center gap-1"
            >
              <span>Inspect Incoming</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
                Total Received
              </span>
              <span className="text-lg font-mono font-bold text-neutral-900 block mt-1">
                {kpis.totalQuantityReceived.toLocaleString()} <span className="text-xs font-normal text-neutral-500">MTR</span>
              </span>
              <span className="text-[10px] text-neutral-500 block mt-0.5">
                From Dyeing Challans
              </span>
            </div>

            <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700 block">
                Total Inspected
              </span>
              <span className="text-lg font-mono font-bold text-brand-900 block mt-1">
                {kpis.totalQuantityInspected.toLocaleString()} <span className="text-xs font-normal text-neutral-500">MTR</span>
              </span>
              <span className="text-[10px] text-neutral-500 block mt-0.5">
                Audited by Inspectors
              </span>
            </div>

            <div className="p-3 bg-accent-50/60 rounded-lg border border-accent-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-700 block">
                Passed Yardage
              </span>
              <span className="text-lg font-mono font-bold text-neutral-900 block mt-1">
                {kpis.passedQuantity.toLocaleString()} <span className="text-xs font-normal text-accent-800">MTR</span>
              </span>
              <span className="text-[10px] text-accent-800 block mt-0.5">
                Approved Quality
              </span>
            </div>

            <div className="p-3 bg-danger-50/60 rounded-lg border border-danger-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-danger-800 block">
                Rejected (Defective Shelf)
              </span>
              <span className="text-lg font-mono font-bold text-danger-900 block mt-1">
                {kpis.failedQuantity.toLocaleString()} <span className="text-xs font-normal text-danger-700">MTR</span>
              </span>
              <span className="text-[10px] text-danger-700 block mt-0.5">
                To Fabric Store Shelf
              </span>
            </div>

            <div className="p-3 bg-brand-50/60 rounded-lg border border-brand-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-800 block">
                Rework (To Dyeing)
              </span>
              <span className="text-lg font-mono font-bold text-brand-900 block mt-1">
                {kpis.reworkQuantity.toLocaleString()} <span className="text-xs font-normal text-brand-700">MTR</span>
              </span>
              <span className="text-[10px] text-brand-700 block mt-0.5">
                Returned to Dyeing
              </span>
            </div>

            <div className="p-3 bg-accent-50/60 rounded-lg border border-accent-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-700 block">
                Hold Yardage
              </span>
              <span className="text-lg font-mono font-bold text-neutral-900 block mt-1">
                {kpis.holdQuantity.toLocaleString()} <span className="text-xs font-normal text-accent-800">MTR</span>
              </span>
              <span className="text-[10px] text-accent-800 block mt-0.5">
                Pending Investigation
              </span>
            </div>
          </div>
        </div>

        {/* 2-COLUMN OPERATIONAL QUEUES: PRIORITY WORK & UPCOMING DELIVERY */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* PRIORITY WORK */}
          <div className="bg-white border border-neutral-200/90 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-danger-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900">
                  Priority Work Pending Inspection
                </h3>
              </div>
              <span className="text-[10px] font-mono text-neutral-500">
                {priorityWork.length} Items
              </span>
            </div>

            {priorityWork.length === 0 ? (
              <div className="py-8 text-center text-neutral-500 text-xs">
                No urgent priority lots currently waiting for QC1 inspection.
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 text-xs">
                {priorityWork.map((item: any) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-neutral-900">
                          {item.challanNumber}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-danger-100 text-danger-800">
                          {item.priority}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                        Sheet: <span className="font-medium text-neutral-700">{item.productionSheetNumber}</span> · {item.fabric} ({item.color})
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono font-bold text-neutral-900 block">
                        {item.quantity} {item.uom}
                      </span>
                      <span className="text-[10px] text-neutral-500 uppercase font-medium">
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* UPCOMING DELIVERY SCHEDULE */}
          <div className="bg-white border border-neutral-200/90 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-brand-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900">
                  Target Delivery Schedule
                </h3>
              </div>
              <span className="text-[10px] font-mono text-neutral-500">
                {upcomingDelivery.length} Lots
              </span>
            </div>

            {upcomingDelivery.length === 0 ? (
              <div className="py-8 text-center text-neutral-500 text-xs">
                No upcoming delivery deadlines tied to pending QC1 lots.
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 text-xs">
                {upcomingDelivery.map((item: any) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-neutral-900">
                          {item.productionSheetNumber}
                        </span>
                        <span className="text-[11px] text-neutral-600 truncate">
                          ({item.clientName})
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        Challan: <span className="font-mono">{item.challanNumber}</span> · {item.quantity} {item.uom}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-semibold text-brand-900 block">
                        {item.deliveryDate ? new Date(item.deliveryDate).toLocaleDateString() : '—'}
                      </span>
                      <span className="text-[10px] text-neutral-500 uppercase">
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
        <div className="bg-white border border-neutral-200/90 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-accent-700" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900">
                Recent QC1 Inspection Activity
              </h3>
            </div>
            <span className="text-[11px] text-neutral-500">
              Live Audit Trail
            </span>
          </div>

          {recentActivity.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <PackageCheck className="w-8 h-8 text-neutral-700 mx-auto" />
              <p className="text-xs font-medium text-neutral-600">
                No quality inspection records currently completed.
              </p>
              <p className="text-[11px] text-neutral-500">
                When QC1 inspectors record inspection results, verified transaction entries will log here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600 font-semibold border-b border-neutral-200">
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
                <tbody className="divide-y divide-neutral-100 text-neutral-700">
                  {recentActivity.map((tx: any) => (
                    <tr key={tx.id} className="hover:bg-neutral-50/50">
                      <td className="py-2.5 px-3 font-mono text-neutral-500">
                        {tx.recordedAt ? new Date(tx.recordedAt).toLocaleString() : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-medium text-neutral-900">
                        {tx.productionSheetNumber}
                      </td>
                      <td className="py-2.5 px-3 font-medium">
                        {tx.inspector}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        {tx.inputQuantity} {tx.unitOfMeasure}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-accent-800">
                        {tx.goodQuantity} {tx.unitOfMeasure}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-brand-700">
                        {tx.reworkQuantity || 0} {tx.unitOfMeasure}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-danger-700">
                        {tx.rejectQuantity || 0} {tx.unitOfMeasure}
                      </td>
                      <td className="py-2.5 px-3 text-neutral-600 truncate max-w-xs">
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
