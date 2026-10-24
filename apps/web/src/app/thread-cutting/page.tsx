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
  FileText,
  PackageCheck,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  Percent,
  AlertTriangle,
  Archive,
  ExternalLink,
} from 'lucide-react';

export default function ThreadCuttingDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/thread-cutting/dashboard');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error || 'Failed to load data');
      }
    } catch (err: any) {
      console.error('Error loading thread cutting dashboard:', err);
      setError(err.message || 'Error connecting to database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const stats = data?.stats || {
    totalIncoming: 0,
    pendingAcceptance: 0,
    inProgressTrimming: 0,
    readyForQc2: 0,
    totalOutgoingQc2: 0,
    totalDefectReturns: 0,
    totalPiecesIn: 0,
    totalPiecesOut: 0,
    totalDefectivePieces: 0,
  };

  const incomingChallans = data?.incomingChallans || [];
  const outgoingChallans = data?.outgoingChallans || [];
  const defectReturnChallans = data?.defectReturnChallans || [];

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* TOP HEADER WITH REAL DB BACKGROUND */}
      <header
        className="bg-white border-b border-neutral-200 sticky top-0 z-30 px-4 sm:px-8 py-4 shadow-md text-neutral-900"
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-600 block drop-shadow-sm">
              SHUBHAM FABRICS MES · PRODUCTION FINISHING
            </span>
            <h1 className="text-xl font-bold text-neutral-900 flex items-center gap-2.5 drop-shadow-sm">
              <Scissors className="w-5 h-5 text-brand-600" />
              <span>Thread Cutting Department Dashboard</span>
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <Link
              href="/thread-cutting/my-work"
              className="flex items-center gap-2 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
            >
              <Briefcase className="w-4 h-4" />
              <span>Thread Cutting My Work</span>
            </Link>

            <Link
              href="/thread-cutting/floor-board"
              className="flex items-center gap-2 px-3.5 py-2 bg-neutral-50 hover:bg-neutral-100 text-neutral-900 text-xs font-semibold rounded-lg border border-neutral-200 transition"
            >
              <Kanban className="w-4 h-4 text-accent-700" />
              <span>Floor Board</span>
            </Link>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {/* KPI CARDS (MATCHING USER DIAGRAM WORKFLOW & DEFECT ISOLATION) */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <div className="bg-white border border-neutral-200/90 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                Pieces In (Embroidery)
              </span>
              <span className="w-2 h-2 rounded-full bg-brand-500"></span>
            </div>
            <p className="text-2xl font-bold text-neutral-900 font-mono mt-1">{stats.totalPiecesIn} PCS</p>
            <span className="text-[10px] text-neutral-500 mt-0.5 block">
              {stats.totalIncoming} Challans received
            </span>
          </div>

          <div className="bg-white border border-neutral-200/90 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-700">
                In Thread Trimming
              </span>
              <span className="w-2 h-2 rounded-full bg-accent-400 animate-pulse"></span>
            </div>
            <p className="text-2xl font-bold text-neutral-900 font-mono mt-1">{stats.inProgressTrimming}</p>
            <span className="text-[10px] text-neutral-500 mt-0.5 block">Active work orders on tables</span>
          </div>

          <div className="bg-white border border-neutral-200/90 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-700">
                Pieces Out (To Thread Cut QC)
              </span>
              <span className="w-2 h-2 rounded-full bg-accent-400"></span>
            </div>
            <p className="text-2xl font-bold text-neutral-900 font-mono mt-1">{stats.totalPiecesOut} PCS</p>
            <span className="text-[10px] text-neutral-500 mt-0.5 block">
              {stats.totalOutgoingQc2} Challans to Thread Cut QC
            </span>
          </div>

          <div className="bg-white border border-danger-200 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-danger-600">
                Defective Pieces
              </span>
              <AlertTriangle className="w-3.5 h-3.5 text-danger-600" />
            </div>
            <p className="text-2xl font-bold text-danger-700 font-mono mt-1">{stats.totalDefectivePieces} PCS</p>
            <span className="text-[10px] text-danger-600 font-medium mt-0.5 block">
              {stats.totalDefectReturns} Returns to Defective Shelf
            </span>
          </div>

          <div className="bg-white border border-neutral-200/90 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600">
                Trimming Yield
              </span>
              <Percent className="w-3.5 h-3.5 text-brand-600" />
            </div>
            <p className="text-2xl font-bold text-neutral-900 font-mono mt-1">
              {stats.totalPiecesIn > 0
                ? `${Math.min(100, Math.round((stats.totalPiecesOut / stats.totalPiecesIn) * 100))}%`
                : '100%'}
            </p>
            <span className="text-[10px] text-neutral-500 mt-0.5 block">Good pieces pass rate</span>
          </div>
        </section>

        {/* SECTION 1: INCOMING CHALLANS FROM EMBROIDERY (AS HIGHLIGHTED IN USER DRAWING) */}
        <section className="bg-white border border-neutral-200/90 rounded-2xl shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <PackageCheck className="w-4 h-4 text-brand-600" />
              <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wide">
                Incoming Challans from Embroidery Department
              </h2>
            </div>
            <Link
              href="/thread-cutting/my-work"
              className="text-xs font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1 transition"
            >
              <span>Manage in My Work</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="p-8 text-center text-neutral-500 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-brand-600 mb-1" />
              Loading incoming challans...
            </div>
          ) : incomingChallans.length === 0 ? (
            <div className="p-8 text-center text-neutral-500 text-xs space-y-1">
              <Scissors className="w-8 h-8 mx-auto text-neutral-700 mb-2" />
              <p className="font-semibold text-neutral-700">No incoming challans currently staged from Embroidery</p>
              <p className="text-neutral-500">
                When Embroidery issues a challan to Thread Cutting, it will automatically populate here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-50/80 border-b border-neutral-200/80 text-neutral-500 font-semibold uppercase text-[10px]">
                    <th className="py-3 px-4">Challan No</th>
                    <th className="py-3 px-4">Program / Serial #</th>
                    <th className="py-3 px-4">Wilcom Design #</th>
                    <th className="py-3 px-4">Pieces In</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {incomingChallans.map((ch: any) => {
                    const totalPieces = (ch.items || []).reduce(
                      (acc: number, it: any) => acc + (Number(it.quantity) || 0),
                      0
                    );

                    return (
                      <tr key={ch.id} className="hover:bg-neutral-50/50 transition">
                        <td className="py-3 px-4 font-mono font-bold text-neutral-900">
                          {ch.challanNumber}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-neutral-900 block">
                            {ch.program?.mainStyle || ch.program?.clientName || 'General Style'}
                          </span>
                          <span className="text-[10px] text-neutral-500 font-mono">
                            {ch.program?.programSerialNo || ch.program?.programNumber || '—'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200 text-[11px] font-semibold">
                            {ch.program?.wilcomDesignNumber || 'WILCOM-DES-01'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-neutral-900">
                          {totalPieces} PCS
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                              ch.status === 'RECEIVED'
                                ? 'bg-accent-100 text-accent-800'
                                : ch.status === 'IN_PROGRESS'
                                ? 'bg-brand-100 text-brand-800'
                                : 'bg-accent-100 text-accent-800'
                            }`}
                          >
                            {ch.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            href="/thread-cutting/my-work"
                            className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-800 font-semibold text-xs"
                          >
                            <span>Inspect &amp; Process</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* SECTION 2: RECENT CHALLANS TO QC2 */}
        <section className="bg-white border border-neutral-200/90 rounded-2xl shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-accent-700" />
              <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wide">
                Recent Dispatches to Thread Cut QC
              </h2>
            </div>
            <Link
              href="/thread-cutting/my-work"
              className="text-xs font-semibold text-accent-700 hover:text-accent-800 flex items-center gap-1 transition"
            >
              <span>Create New Thread Cut QC Challan</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {outgoingChallans.length === 0 ? (
            <div className="p-8 text-center text-neutral-500 text-xs">
              <p className="font-semibold text-neutral-700">No outgoing challans issued to Thread Cut QC yet.</p>
              <p className="text-neutral-500 mt-1">
                Completed trimming panels can be dispatched to Thread Cut QC using the Challan form in My Work.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-50/80 border-b border-neutral-200/80 text-neutral-500 font-semibold uppercase text-[10px]">
                    <th className="py-3 px-4">Challan No</th>
                    <th className="py-3 px-4">Destination</th>
                    <th className="py-3 px-4">Pieces Out</th>
                    <th className="py-3 px-4">Issued Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {outgoingChallans.map((ch: any) => {
                    const totalPieces = (ch.items || []).reduce(
                      (acc: number, it: any) => acc + (Number(it.quantity) || 0),
                      0
                    );

                    return (
                      <tr key={ch.id} className="hover:bg-neutral-50/50 transition">
                        <td className="py-3 px-4 font-mono font-bold text-neutral-900">
                          {ch.challanNumber}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-accent-800 bg-accent-50 px-2 py-0.5 rounded border border-accent-200 text-[11px]">
                            QC2 (Quality Check 2)
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-neutral-900">
                          {totalPieces} PCS
                        </td>
                        <td className="py-3 px-4 font-mono text-neutral-500">
                          {new Date(ch.createdAt).toLocaleDateString('en-GB')}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase bg-accent-100 text-accent-800">
                            {ch.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            href={`/challans/${ch.id}`}
                            className="inline-flex items-center gap-1 text-neutral-700 hover:text-neutral-900 font-semibold text-xs"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>View Challan</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* SECTION 3: DEFECTIVE RETURNS TO FABRIC STORE DEFECTIVE SHELF */}
        <section className="bg-white border border-danger-200/90 rounded-2xl shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-danger-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-danger-50/50">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-danger-600" />
              <div>
                <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wide flex items-center gap-2">
                  <span>Defective Panel Returns to Fabric Store</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-danger-100 text-danger-800">
                    DEFECTIVE SHELF
                  </span>
                </h2>
                <p className="text-xs text-neutral-500">
                  Defective pieces segregated during thread trimming and dispatched to the raw material store defective shelf.
                </p>
              </div>
            </div>

            <Link
              href="/fabric-store/inventory/defected-shelf"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-danger-50 hover:bg-danger-100 text-danger-800 border border-danger-200 rounded-lg text-xs font-semibold transition"
            >
              <Archive className="w-3.5 h-3.5 text-danger-600" />
              <span>Fabric Store Defective Shelf</span>
              <ExternalLink className="w-3 h-3 text-danger-600" />
            </Link>
          </div>

          {defectReturnChallans.length === 0 ? (
            <div className="p-8 text-center text-neutral-500 text-xs">
              <CheckCircle2 className="w-8 h-8 text-accent-700 mx-auto mb-1.5" />
              <p className="font-semibold text-neutral-700">No defective returns recorded</p>
              <p className="text-neutral-500">All current trimmed panels have proceeded without store returns.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-50/80 border-b border-neutral-200/80 text-neutral-500 font-semibold uppercase text-[10px]">
                    <th className="py-3 px-4">Return Challan No</th>
                    <th className="py-3 px-4">Program / Style</th>
                    <th className="py-3 px-4 text-center">Defective Pcs</th>
                    <th className="py-3 px-4">Target Shelf Location</th>
                    <th className="py-3 px-4">Comments &amp; Reason</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {defectReturnChallans.map((ch: any) => {
                    const totalPieces = (ch.items || []).reduce(
                      (acc: number, it: any) => acc + (Number(it.quantity) || 0),
                      0
                    );

                    return (
                      <tr key={ch.id} className="hover:bg-danger-50/30 transition">
                        <td className="py-3 px-4 font-mono font-bold text-neutral-900">
                          {ch.challanNumber}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-neutral-900 block">
                            {ch.program?.mainStyle || ch.program?.clientName || 'General Style'}
                          </span>
                          <span className="font-mono text-[10px] text-brand-700">
                            {ch.program?.wilcomDesignNumber || 'WILCOM-DES'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-danger-700 text-center text-sm">
                          {totalPieces} PCS
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-danger-50 border border-danger-200 text-danger-800 font-mono text-[10px] font-bold">
                            DEF-SHELF-01 (Fabric Store)
                          </span>
                        </td>
                        <td className="py-3 px-4 max-w-sm text-neutral-700">
                          <p className="line-clamp-2 text-[11px]">
                            {ch.remarks || ch.items?.[0]?.remarks || 'Defective return to Fabric Store'}
                          </p>
                        </td>
                        <td className="py-3 px-4 font-mono text-neutral-500">
                          {new Date(ch.createdAt).toLocaleDateString('en-GB')}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            href={`/challans/${ch.id}`}
                            className="inline-flex items-center gap-1 text-neutral-700 hover:text-neutral-900 font-semibold text-xs"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>View Challan</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
