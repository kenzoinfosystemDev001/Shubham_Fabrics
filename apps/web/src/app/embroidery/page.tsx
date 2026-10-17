'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Scissors,
  RefreshCw,
  Briefcase,
  Kanban,
  CheckCircle2,
  Clock,
  Send,
  AlertCircle,
  Layers,
  ArrowRight,
  Sparkles,
  FileText,
  PackageCheck
} from 'lucide-react';
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';

export default function EmbroideryDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/embroidery/dashboard');
      const json = await res.json();
      setData(json.data);
    } catch (err: any) {
      console.error('Error loading embroidery dashboard:', err);
      setError(err.message || 'Error connecting to database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const stats = data?.stats || {
    totalChallans: 0,
    pendingTransfer: 0,
    activeInStitch: 0,
    completed: 0,
    activeWilcomDesigns: 0,
  };

  const challans = data?.challans || [];
  const programs = data?.programs || [];

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
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
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-fuchsia-400 block drop-shadow-sm">
            SHUBHAM FABRICS MES · EMBROIDERY SECTION
          </span>
          <h1 className="text-xl font-bold text-white flex items-center gap-2.5 drop-shadow-sm">
            <Sparkles className="w-5 h-5 text-fuchsia-400" />
            <span>Embroidery Department Dashboard</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-lg border border-slate-700/60 transition"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <Link
            href="/embroidery/my-work"
            className="flex items-center gap-2 px-3.5 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
          >
            <Briefcase className="w-4 h-4" />
            <span>Create Challan to Thread Cutting</span>
          </Link>

          <Link
            href="/embroidery/incoming-challans"
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
          >
            <Layers className="w-4 h-4" />
            <span>Incoming Challans (Store &amp; Dyeing)</span>
          </Link>

          <Link
            href="/embroidery/floor-board"
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800/90 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg border border-slate-700 transition"
          >
            <Kanban className="w-4 h-4 text-amber-400" />
            <span>Floor Board</span>
          </Link>
        </div>
      </header>

      {/* DASHBOARD CONTENT */}
      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {/* KPI CARDS */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Incoming Challans
            </span>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stats.totalChallans}</p>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Store (Undyed) &amp; Dyeing QC1</span>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 block">
              Pending Acceptance
            </span>
            <p className="text-2xl font-bold text-amber-600 mt-1">{stats.pendingTransfer}</p>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Awaiting receipt verification</span>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-600 block">
              Active in Machines
            </span>
            <p className="text-2xl font-bold text-fuchsia-600 mt-1">{stats.activeInStitch}</p>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Multi-head frames active</span>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">
              Wilcom Patterns
            </span>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.activeWilcomDesigns}</p>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Approved design files</span>
          </div>
        </section>

        {/* INCOMING CHALLANS FROM STORE & DYEING */}
        <section className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <PackageCheck className="w-4 h-4 text-fuchsia-600" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Incoming Challans from Fabric Store &amp; QC 1 Departments
              </h2>
            </div>
            <Link
              href="/embroidery/incoming-challans"
              className="text-xs font-semibold text-fuchsia-600 hover:text-fuchsia-800 flex items-center gap-1 transition"
            >
              <span>Checking of Incoming Challans</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {challans.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              <Scissors className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-slate-700">No incoming challans currently staged for Embroidery</p>
              <p className="text-slate-400 mt-1">Challans issued from Fabric Store (Pre-Dyed) or QC 1 (Post-Dyeing Passed) will appear here automatically with their Production Sheet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-semibold uppercase text-[10px]">
                    <th className="py-3 px-4">Challan No</th>
                    <th className="py-3 px-4">Program / Design</th>
                    <th className="py-3 px-4">Wilcom Design</th>
                    <th className="py-3 px-4">From Department</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {challans.slice(0, 8).map((ch: any) => (
                    <tr key={ch.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        {ch.challanNumber}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800 block">
                          {ch.program?.mainStyle || ch.program?.clientName || 'General Embroidery'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {ch.program?.programNumber || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-fuchsia-700 bg-fuchsia-50 px-2 py-0.5 rounded border border-fuchsia-200 text-[11px] font-semibold">
                          {ch.program?.wilcomDesignNumber || ch.program?.embroideryDesign || 'WILCOM-STD'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {ch.fromDepartment === 'STORE' ? 'Store Department' : ch.fromDepartment}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                          {ch.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/embroidery/my-work`}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100 rounded border border-fuchsia-200 transition"
                        >
                          Process
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* WILCOM EMBROIDERY SPECIFICATIONS CATALOG */}
        <section className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Scissors className="w-4 h-4 text-fuchsia-600" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Production Sheets with Technical Embroidery Specs
              </h2>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {programs.slice(0, 6).map((prog: any) => (
              <div
                key={prog.id}
                className="p-4 rounded-xl border border-slate-200/90 hover:border-fuchsia-300 bg-slate-50/50 hover:bg-fuchsia-50/20 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-bold text-slate-900">
                      {prog.programNumber}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-fuchsia-100 text-fuchsia-800 font-semibold">
                      {prog.wilcomDesignNumber || 'W-STD'}
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-slate-800 line-clamp-1">
                    {prog.clientName || prog.buyerName || 'Client Order'} · {prog.mainStyle || 'Style'}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                    Embroidery: <span className="text-slate-700 font-medium">{prog.embroideryDesign || 'Standard logo'}</span>
                  </p>
                  {prog.embroideryDesignSize && (
                    <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                      Frame/Size: {prog.embroideryDesignSize}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">
                    Target: <strong className="text-slate-800">{prog.targetQuantity || '—'} pcs</strong>
                  </span>
                  <Link
                    href={`/programs/${prog.id}`}
                    className="text-[11px] font-semibold text-fuchsia-600 hover:text-fuchsia-800 flex items-center gap-1"
                  >
                    Traveler Card <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
