'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Package,
  Boxes,
  Barcode,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react';
import { api } from '@/lib/api';

export default function PackingWorkspaceIndexPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scanInput, setScanInput] = useState('');

  const loadJobs = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.getPackingQueue({ status: 'ACTIVE' });
      if (res?.success && Array.isArray(res.data)) {
        setJobs(res.data);
      } else {
        const fallbackRes = await fetch('/api/packing/queue?status=ACTIVE', { cache: 'no-store' });
        const json = await fallbackRes.json();
        if (json.success && Array.isArray(json.data)) {
          setJobs(json.data);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load packing workstation jobs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = scanInput.trim().toUpperCase();
    if (!query) return;

    // Look for matching challan in active jobs
    const match = jobs.find(
      (j) =>
        j.challanNumber.toUpperCase() === query ||
        j.program?.programNumber?.toUpperCase() === query ||
        j.program?.styleCode?.toUpperCase() === query
    );

    if (match) {
      router.push(`/packing/workspace/${match.id}`);
    } else {
      setError(`No active job found matching "${query}". Check Incoming queue if not received yet.`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* HEADER */}
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <Package className="w-3.5 h-3.5" />
                Packing Floor Workstation
              </span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold text-white tracking-tight">
              Packing Execution Terminal
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Select an active production batch or scan a Challan barcode to generate cartons and update finished goods stock.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/packing/incoming"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 hover:text-white"
            >
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Incoming Transfers</span>
            </Link>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-300 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
            <p className="font-semibold">{error}</p>
          </div>
        )}

        {/* SCAN / QUICK SEARCH BAR */}
        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/30 via-slate-900 to-amber-950/20 p-6 shadow-xl">
          <form onSubmit={handleScanSubmit} className="flex flex-col sm:flex-row items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shrink-0">
              <Barcode className="w-8 h-8" />
            </div>
            <div className="flex-1 w-full">
              <label className="text-xs font-bold uppercase tracking-wider text-amber-400 block mb-1">
                Scan Challan Barcode or Enter Program Number
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  placeholder="e.g., CH-2026-..., PRG-..., or Style Code..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-500 font-mono font-bold focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full sm:w-auto mt-2 sm:mt-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-3 text-xs transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
            >
              <span>Open Workstation</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* ACTIVE READY JOBS */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Boxes className="w-4 h-4 text-emerald-400" />
              Active Jobs Ready for Packaging ({jobs.length})
            </h2>
            <button
              onClick={() => void loadJobs()}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {jobs.length > 0 ? (
              jobs.map((job) => {
                const pct = job.totalReceivedPieces > 0
                  ? Math.min(100, Math.round((job.totalPackedPieces / job.totalReceivedPieces) * 100))
                  : 0;

                return (
                  <div
                    key={job.id}
                    className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col justify-between hover:border-amber-500/40 transition shadow-lg group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-black text-amber-400">
                          {job.challanNumber}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          {job.remainingPieces} pcs to pack
                        </span>
                      </div>

                      <div>
                        <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition">
                          Prog #{job.program?.programNumber || 'N/A'}
                        </h3>
                        <p className="text-xs text-slate-300 font-mono mt-0.5">
                          Style: <strong className="text-white">{job.program?.styleCode || 'N/A'}</strong>
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {job.program?.buyerName || job.program?.clientName || 'Shubham Fabrics'}
                        </p>
                      </div>

                      <div className="rounded-lg bg-slate-950 p-3 border border-slate-800 space-y-1.5 font-mono text-xs">
                        <div className="flex justify-between text-slate-400">
                          <span>Received:</span>
                          <span className="text-white font-bold">{job.totalReceivedPieces} pcs</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Packed:</span>
                          <span className="text-emerald-400 font-bold">{job.totalPackedPieces} pcs</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Cartons:</span>
                          <span className="text-indigo-400 font-bold">{job.cartonCount}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-800">
                      <Link
                        href={`/packing/workspace/${job.id}`}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 py-2.5 px-3 text-xs font-bold transition shadow-xs"
                      >
                        <Package className="w-4 h-4" />
                        <span>Open Packing Terminal</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full py-16 text-center text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800">
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                    <span>Loading available packing jobs...</span>
                  </div>
                ) : (
                  <div>
                    <Package className="w-10 h-10 mx-auto text-slate-600 mb-3" />
                    <p className="font-semibold text-slate-300">No active packing jobs available</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Check your incoming transfers to receive pieces from Final QC.
                    </p>
                    <Link
                      href="/packing/incoming"
                      className="inline-flex items-center gap-1.5 mt-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 px-3.5 py-1.5 text-xs font-bold border border-slate-700 transition"
                    >
                      Receive From Final QC &rarr;
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
