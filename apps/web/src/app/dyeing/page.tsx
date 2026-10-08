'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Droplet,
  RefreshCw,
  Briefcase,
  Kanban,
  CheckCircle2,
  Clock,
  Send,
  AlertCircle,
  Calendar,
  Layers,
  User,
  ArrowRight,
  TrendingUp,
  FileText
} from 'lucide-react';
import { api } from '@/lib/api';

export default function DyeingDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/dyeing/dashboard');
      if (!res.ok) {
        throw new Error('Failed to load dyeing dashboard data');
      }
      const json = await res.json();
      setData(json.data);
    } catch (err: any) {
      console.error('Error loading dyeing dashboard:', err);
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
    received: 0,
    inDyeing: 0,
    partiallyDyed: 0,
    dyed: 0,
    readyForQc1: 0,
    sentToQc1: 0,
    totalRequiredQuantity: 0,
    totalDyedQuantity: 0,
    totalUndyedQuantity: 0,
    totalSentToQc1Quantity: 0,
  };

  const colorBreakdown = data?.colorBreakdown || [];
  const dyeingIncharges = data?.dyeingIncharges || [];
  const priorityWork = data?.priorityWork || [];
  const upcomingDelivery = data?.upcomingDelivery || [];
  const recentActivity = data?.recentActivity || [];

  const inchargeName =
    currentUser?.fullName ||
    currentUser?.username ||
    dyeingIncharges[0]?.fullName ||
    dyeingIncharges[0]?.username ||
    'Dyeing Incharge';

  return (
    <div className="min-h-screen bg-[#FDFBF7] pb-16">
      {/* TOP HEADER */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-700 block">
            SHUBHAM FABRICS MES · PRODUCTION COMMAND
          </span>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Droplet className="w-5 h-5 text-purple-600" />
            <span>Dyeing Department Dashboard</span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition"
            title="Refresh Dashboard"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <Link
            href="/dyeing/floor-board"
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition"
          >
            <Kanban className="w-4 h-4 text-slate-600" />
            <span>Floor Board</span>
          </Link>

          <Link
            href="/dyeing/my-work"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold rounded-lg shadow-xs transition"
          >
            <Briefcase className="w-4 h-4" />
            <span>My Work Queue</span>
          </Link>
        </div>
      </header>

      {/* ERROR ALERT */}
      {error && (
        <div className="px-4 sm:px-8 pt-4 max-w-7xl mx-auto">
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* RESPONSIBLE INCHARGE BANNER */}
      <div className="px-4 sm:px-8 pt-6 max-w-7xl mx-auto">
        <div className="bg-white border border-purple-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block">
                Responsible Station Incharge
              </span>
              <p className="text-sm font-bold text-slate-900 leading-tight">{inchargeName}</p>
              <span className="text-[11px] text-slate-500">Dyeing Operations &amp; QC1 Dispatch Authorization</span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Neon DB Link
            </span>
          </div>
        </div>
      </div>

      {/* MAIN QUANTITY VISIBILITY STRIP (REQUIRED, DYED, UNDYED/REMAINING, SENT TO QC1) */}
      <div className="px-4 sm:px-8 pt-6 max-w-7xl mx-auto">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                Operational Quantity Reconciliation
              </h2>
              <p className="text-xs text-slate-500">
                Live shop-floor balance of materials received from Fabric Store through QC1 dispatch
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded border border-purple-200">
              {kpis.totalWork} Orders Tracked
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* REQUIRED */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                1. Required Quantity
              </span>
              <p className="text-2xl font-black font-mono text-slate-900 mt-1">
                {kpis.totalRequiredQuantity.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </p>
              <span className="text-[11px] text-slate-500 mt-0.5 block">From Fabric Store challans</span>
            </div>

            {/* DYED */}
            <div className="bg-purple-50/60 border border-purple-200/80 rounded-xl p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block">
                2. Quantity Dyed
              </span>
              <p className="text-2xl font-black font-mono text-purple-800 mt-1">
                {kpis.totalDyedQuantity.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </p>
              <span className="text-[11px] text-purple-600 mt-0.5 block">Processed through vats</span>
            </div>

            {/* UNDYED / REMAINING */}
            <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
                3. Undyed / Remaining
              </span>
              <p className="text-2xl font-black font-mono text-amber-800 mt-1">
                {kpis.totalUndyedQuantity.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </p>
              <span className="text-[11px] text-amber-600 mt-0.5 block">Awaiting process</span>
            </div>

            {/* SENT TO QC1 */}
            <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                4. Sent to QC1
              </span>
              <p className="text-2xl font-black font-mono text-emerald-800 mt-1">
                {kpis.totalSentToQc1Quantity.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </p>
              <span className="text-[11px] text-emerald-600 mt-0.5 block">Dispatched on challans</span>
            </div>
          </div>
        </div>
      </div>

      {/* WORKFLOW STATUS KPI BREAKDOWN */}
      <div className="px-4 sm:px-8 pt-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">Received</span>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{kpis.received}</p>
            <span className="text-[10px] text-slate-400 block mt-0.5">Pending start</span>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block">In Dyeing</span>
            <p className="text-2xl font-bold text-indigo-700 mt-0.5">{kpis.inDyeing}</p>
            <span className="text-[10px] text-slate-400 block mt-0.5">Active in machine</span>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 block">Partially Dyed</span>
            <p className="text-2xl font-bold text-amber-700 mt-0.5">{kpis.partiallyDyed}</p>
            <span className="text-[10px] text-slate-400 block mt-0.5">Mid-batch</span>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 block">Fully Dyed</span>
            <p className="text-2xl font-bold text-purple-700 mt-0.5">{kpis.dyed}</p>
            <span className="text-[10px] text-slate-400 block mt-0.5">Completed batch</span>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 block">Ready for QC1</span>
            <p className="text-2xl font-bold text-teal-700 mt-0.5">{kpis.readyForQc1}</p>
            <span className="text-[10px] text-slate-400 block mt-0.5">Available to dispatch</span>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">Sent to QC1</span>
            <p className="text-2xl font-bold text-emerald-700 mt-0.5">{kpis.sentToQc1}</p>
            <span className="text-[10px] text-slate-400 block mt-0.5">Challan issued</span>
          </div>
        </div>
      </div>

      {/* COLOR TRACKING TABLE */}
      <div className="px-4 sm:px-8 pt-6 max-w-7xl mx-auto">
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Droplet className="w-4 h-4 text-purple-600" />
                <span>Color-Wise Production Status</span>
              </h2>
              <p className="text-xs text-slate-500">
                Detailed breakdown of dyed, remaining, and dispatched quantities by fabric shade
              </p>
            </div>
            <Link
              href="/dyeing/my-work"
              className="text-xs font-bold text-purple-700 hover:text-purple-900 flex items-center gap-1"
            >
              <span>Manage Work</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {colorBreakdown.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No color production records currently registered.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[10px] border-b border-slate-200">
                    <th className="py-3 px-4 font-bold">Color / Shade</th>
                    <th className="py-3 px-4 font-bold text-center">Active Orders</th>
                    <th className="py-3 px-4 font-bold text-right">Required Quantity</th>
                    <th className="py-3 px-4 font-bold text-right text-purple-800">Dyed Quantity</th>
                    <th className="py-3 px-4 font-bold text-right text-amber-800">Undyed / Remaining</th>
                    <th className="py-3 px-4 font-bold text-right text-emerald-800">Sent to QC1</th>
                    <th className="py-3 px-4 font-bold text-center">Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {colorBreakdown.map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full border border-slate-300 shrink-0"
                            style={{ backgroundColor: item.colorCode || '#9333EA' }}
                          />
                          <span className="font-bold text-slate-900">{item.colorName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-700">
                        {item.ordersCount}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                        {item.required.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-purple-700 bg-purple-50/30">
                        {item.dyed.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-700 bg-amber-50/30">
                        {item.undyed.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 bg-emerald-50/30">
                        {item.sentToQc1.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-[10px] text-slate-500 uppercase">
                        {item.uom}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* TWO COLUMN GRID: PRIORITY WORK & RECENT DYEING ACTIVITY */}
      <div className="px-4 sm:px-8 pt-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* PRIORITY WORK */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Priority Dyeing Work</span>
              </h2>
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                High / Urgent Orders
              </span>
            </div>

            <div className="p-4 flex-1 space-y-3">
              {priorityWork.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No high-priority dyeing orders pending.
                </div>
              ) : (
                priorityWork.map((ord: any) => (
                  <div
                    key={ord.id}
                    className="p-3 bg-slate-50 border border-slate-200/90 rounded-lg flex items-center justify-between gap-3 hover:border-purple-300 transition"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-bold text-xs text-purple-900">{ord.orderNumber}</span>
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                          {ord.priority}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500">
                          Prog: {ord.program?.programSerialNo || ord.program?.programNumber}
                        </span>
                      </div>
                      <div className="text-xs text-slate-800 font-medium">
                        {ord.fabricName} &middot; <span className="font-bold text-purple-700">{ord.targetColor}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        Required: {ord.requiredQuantity} {ord.uom} | Dyed: {ord.dyedQuantity} {ord.uom}
                      </div>
                    </div>

                    <Link
                      href="/dyeing/my-work"
                      className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-purple-700 hover:text-white rounded-md text-xs font-semibold text-slate-700 transition shrink-0"
                    >
                      Process
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* RECENT ACTIVITY */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Recent Dyeing Activity</span>
              </h2>
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Production Log
              </span>
            </div>

            <div className="p-4 flex-1 space-y-3">
              {recentActivity.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No recorded dyeing transactions yet.
                </div>
              ) : (
                recentActivity.map((tx: any) => (
                  <div
                    key={tx.id}
                    className="p-3 bg-slate-50 border border-slate-200/90 rounded-lg flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">{tx.notes || tx.operationName}</div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        Prog: {tx.program?.programNumber || '—'} &middot; Qty: {tx.goodQuantity} {tx.unitOfMeasure}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[11px] text-slate-500 block font-medium">
                        {tx.operator?.fullName || 'Operator'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(tx.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
