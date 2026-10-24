'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ClipboardList,
  Search,
  Package,
  Boxes,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
} from 'lucide-react';
import { api } from '@/lib/api';

interface PackingQueueJob {
  id: string;
  challanNumber: string;
  fromDepartment: string;
  status: string;
  createdAt: string;
  receivedAt?: string;
  totalReceivedPieces: number;
  totalPackedPieces: number;
  remainingPieces: number;
  cartonCount: number;
  program?: {
    id: string;
    programNumber?: string;
    styleCode?: string;
    clientName?: string;
    buyerName?: string;
    fabricName?: string;
  };
  items: Array<{
    size?: string;
    color?: string;
    quantity: number;
    uom: string;
  }>;
}

export default function PackingQueuePage() {
  const [jobs, setJobs] = useState<PackingQueueJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [searchQuery, setSearchQuery] = useState('');

  const loadQueue = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setLoading(true);
      setError('');
      const params: any = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await api.getPackingQueue(params);
      if (res?.success && Array.isArray(res.data)) {
        setJobs(res.data);
      } else {
        const query = new URLSearchParams(params).toString();
        const fallbackRes = await fetch(`/api/packing/queue?${query}`, { cache: 'no-store' });
        const json = await fallbackRes.json();
        if (json.success && Array.isArray(json.data)) {
          setJobs(json.data);
        } else {
          throw new Error(json.error || 'Failed to load packing queue');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load active packing queue');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  return (
    <div className="min-h-screen bg-canvas px-4 py-8 text-neutral-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* HEADER */}
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-600 border border-brand-500/30">
                <ClipboardList className="w-3.5 h-3.5" />
                Floor Worklist
              </span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold text-neutral-900 tracking-tight">
              Packing Queue
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Active production jobs received on the floor ready for boxing, barcode assignment, and Finished Goods transfer.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => void loadQueue()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 py-2 text-xs font-semibold text-neutral-900 transition hover:bg-neutral-200 hover:text-neutral-900 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-accent-700' : ''}`} />
              <span>Refresh</span>
            </button>
            <Link
              href="/packing/incoming"
              className="inline-flex items-center gap-2 rounded-lg border border-accent-500/40 bg-accent-400/10 px-3.5 py-2 text-xs font-bold text-accent-700 transition hover:bg-accent-400/20"
            >
              <Clock className="w-4 h-4" />
              <span>Inward Transfers</span>
            </Link>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-danger-500/40 bg-danger-500/10 p-4 text-sm text-danger-600 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-danger-600" />
            <p className="font-semibold">{error}</p>
          </div>
        )}

        {/* FILTERS */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-neutral-200">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'ACTIVE', label: 'Active Jobs (Ready / In Progress)' },
              { id: 'RECEIVED', label: 'Ready to Pack' },
              { id: 'IN_PROCESS', label: 'In Progress' },
              { id: 'COMPLETED', label: 'Completed' },
              { id: 'ALL', label: 'All Jobs' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  statusFilter === tab.id
                    ? 'bg-accent-400 text-neutral-900 shadow-sm'
                    : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="Search Challan #, Prog #, Style..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-canvas border border-neutral-200 rounded-lg pl-9 pr-3 py-2 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-brand-500 transition"
            />
          </div>
        </div>

        {/* JOBS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {jobs.length > 0 ? (
            jobs.map((job) => {
              const pct = job.totalReceivedPieces > 0
                ? Math.min(100, Math.round((job.totalPackedPieces / job.totalReceivedPieces) * 100))
                : 0;
              const isCompleted = job.remainingPieces === 0 && job.totalPackedPieces > 0;

              return (
                <div
                  key={job.id}
                  className="rounded-xl border border-neutral-200 bg-white p-5 flex flex-col justify-between hover:border-neutral-200 transition shadow-sm"
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-black text-accent-700 bg-accent-400/10 px-2 py-0.5 rounded border border-accent-500/30">
                        {job.challanNumber}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          isCompleted
                            ? 'bg-brand-500/20 text-brand-600 border border-brand-500/40'
                            : job.status === 'IN_PROCESS'
                            ? 'bg-brand-500/20 text-brand-600 border border-brand-500/40'
                            : 'bg-accent-400/20 text-accent-700 border border-accent-500/40'
                        }`}
                      >
                        {isCompleted ? 'FULLY PACKED' : job.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    {/* Program Info */}
                    <div>
                      <h3 className="text-sm font-bold text-neutral-900">
                        Prog #{job.program?.programNumber || 'N/A'}
                      </h3>
                      <p className="text-xs text-neutral-700 font-mono mt-0.5">
                        Style: <strong className="text-neutral-900">{job.program?.styleCode || 'N/A'}</strong>
                      </p>
                      <p className="text-[11px] text-neutral-500 truncate">
                        {job.program?.buyerName || job.program?.clientName || 'Shubham Fabrics'}
                      </p>
                    </div>

                    {/* Quantity Progress Bar */}
                    <div className="rounded-lg bg-canvas p-3 border border-neutral-200 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-neutral-500">Packaging Progress:</span>
                        <span className="font-bold text-neutral-900">{pct}%</span>
                      </div>
                      <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            isCompleted ? 'bg-brand-500' : 'bg-accent-400'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono">
                        <div>
                          <span className="text-[10px] text-neutral-500 block uppercase">Received</span>
                          <span className="text-xs font-bold text-neutral-700">{job.totalReceivedPieces}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-neutral-500 block uppercase">Packed</span>
                          <span className="text-xs font-bold text-accent-700">{job.totalPackedPieces}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-neutral-500 block uppercase">Remaining</span>
                          <span className="text-xs font-bold text-accent-700">{job.remainingPieces}</span>
                        </div>
                      </div>
                    </div>

                    {/* Cartons Counter */}
                    <div className="flex items-center justify-between text-xs text-neutral-500 px-1">
                      <span className="flex items-center gap-1.5">
                        <Boxes className="w-4 h-4 text-accent-700" />
                        Cartons created: <strong className="text-neutral-900">{job.cartonCount}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="pt-4 mt-4 border-t border-neutral-200">
                    <Link
                      href={`/packing/workspace/${job.id}`}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white py-2 px-3 text-xs font-bold transition shadow-xs"
                    >
                      <Package className="w-4 h-4" />
                      <span>{isCompleted ? 'View Packing Details' : 'Continue Packing'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full py-16 text-center text-neutral-500 bg-white rounded-xl border border-neutral-200">
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-accent-700" />
                  <span>Loading packing queue...</span>
                </div>
              ) : (
                <div>
                  <Package className="w-10 h-10 mx-auto text-neutral-600 mb-3" />
                  <p className="font-semibold text-neutral-700">No packing jobs in this queue view</p>
                  <p className="text-xs text-neutral-500 mt-1">
                    Receive incoming pieces from Final QC to start packing.
                  </p>
                  <Link
                    href="/packing/incoming"
                    className="inline-flex items-center gap-1.5 mt-4 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-accent-700 px-3.5 py-1.5 text-xs font-bold border border-neutral-200 transition"
                  >
                    Go to Incoming Transfers &rarr;
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
