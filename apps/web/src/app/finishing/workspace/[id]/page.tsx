'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  Layers,
  Printer,
  Check,
  ShieldCheck,
  Send,
  Plus,
  Minus,
  Pause,
  Play,
  Scissors,
} from 'lucide-react';
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';

export default function FinishingFocusWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const jobId = resolvedParams.id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<any>(null);
  const [error, setError] = useState('');

  // Counters
  const [goodCount, setGoodCount] = useState(0);
  const [reworkCount, setReworkCount] = useState(0);
  const [rejectCount, setRejectCount] = useState(0);
  const [operatorNotes, setOperatorNotes] = useState('');
  const [defectReason, setDefectReason] = useState('Fabric cut / scissor nip');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');

  // Tech Sheet
  const [showTechSheet, setShowTechSheet] = useState(false);

  const loadJob = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`/api/finishing/jobs/${jobId}`);
      if (!res.ok) throw new Error('Failed to load finishing job');
      const json = await res.json();
      const data = json.data;
      setJob(data);

      const totalQty =
        data.fabricIn ||
        data.items?.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0), 0) ||
        0;

      setGoodCount(data.fabricOut ?? totalQty);
      setReworkCount(0);
      setRejectCount(0);
    } catch (err: any) {
      console.error('Error loading job:', err);
      setError(err.message || 'Error connecting to server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJob();
  }, [jobId]);

  const totalInput =
    job?.fabricIn ||
    job?.items?.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0), 0) ||
    0;

  const currentReconciled = Number(goodCount) + Number(reworkCount) + Number(rejectCount);
  const balanceRemaining = Math.max(0, totalInput - currentReconciled);
  const isBalanced = currentReconciled <= totalInput;

  const handleStartFinishing = async () => {
    try {
      setSaving(true);
      const res = await fetch(`/api/finishing/jobs/${jobId}/start`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to start finishing');
      await loadJob();
    } catch (err: any) {
      alert(err.message || 'Error starting finishing');
    } finally {
      setSaving(false);
    }
  };

  const handlePause = async () => {
    try {
      setSaving(true);
      const res = await fetch(`/api/finishing/jobs/${jobId}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Operator break / Table change' }),
      });
      if (!res.ok) throw new Error('Failed to pause finishing');
      await loadJob();
    } catch (err: any) {
      alert(err.message || 'Error pausing finishing');
    } finally {
      setSaving(false);
    }
  };

  const handleResume = async () => {
    try {
      setSaving(true);
      const res = await fetch(`/api/finishing/jobs/${jobId}/resume`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to resume finishing');
      await loadJob();
    } catch (err: any) {
      alert(err.message || 'Error resuming finishing');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOutput = async (autoRelease = false) => {
    try {
      setSaving(true);
      setSaveSuccess('');

      const res = await fetch(`/api/finishing/jobs/${jobId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputQuantity: totalInput,
          goodQuantity: goodCount,
          reworkQuantity: reworkCount,
          rejectQuantity: rejectCount,
          balanceQuantity: balanceRemaining,
          operatorNotes: operatorNotes || 'Recorded from finishing focus workspace station.',
          defectReason: defectReason,
          autoInspect: autoRelease,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save finishing output');

      setSaveSuccess(autoRelease ? 'Job released and ready for Handover!' : 'Finishing output saved successfully!');
      await loadJob();
    } catch (err: any) {
      alert(err.message || 'Error saving output');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-teal-400">
        <RefreshCw className="w-8 h-8 animate-spin mb-3" />
        <span className="text-xs text-slate-400">Loading workstation...</span>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-300">
        <AlertCircle className="w-12 h-12 text-rose-400 mb-3" />
        <h2 className="text-lg font-bold text-white mb-2">Failed to Load Job</h2>
        <p className="text-xs text-slate-400 mb-4">{error || 'Job not found'}</p>
        <Link
          href="/finishing/my-work"
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
        >
          Return to Finishing Floor
        </Link>
      </div>
    );
  }

  const isReady = job.status === 'READY_FOR_HANDOVER';
  const isInProcess = job.status === 'IN_PROCESS';
  const isReceived = job.status === 'RECEIVED';
  const isPaused = job.status === 'ON_HOLD';

  return (
    <div
      className="min-h-screen text-slate-100 flex flex-col"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(15, 23, 42, 0.94), rgba(10, 15, 29, 0.98)), url('${DEPARTMENT_NAV_BG_IMAGE}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* TOP HEADER */}
      <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md px-6 py-4 sticky top-0 z-30 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/finishing/my-work"
              className="p-2 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white transition"
              title="Back to Floor"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold text-white">
                  {job.challanNumber}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    isReady
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : isInProcess
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      : isReceived
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : isPaused
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {job.status.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Style: <strong className="text-teal-300">{job.program?.styleCode || 'Standard'}</strong> • Program:{' '}
                <strong className="text-slate-300 font-mono">{job.program?.programNumber || 'N/A'}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {job.program && (
              <button
                onClick={() => setShowTechSheet(true)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <FileText className="w-3.5 h-3.5 text-teal-400" />
                <span className="hidden sm:inline">Production Sheet</span>
              </button>
            )}

            {isReady && (
              <Link
                href={`/finishing/issue-challan?jobId=${job.id}`}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-900/30 flex items-center gap-1.5 transition"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Issue Challan</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* WORKSPACE BODY */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-6 space-y-6">
        {saveSuccess && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-emerald-300 text-xs">
            <CheckCircle2 className="w-4 h-4" />
            <span>{saveSuccess}</span>
          </div>
        )}

        {/* TOP STATUS & CONTROLS STRIP */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 backdrop-blur-xs">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Finishing Focus Mode Station</h2>
              <p className="text-xs text-slate-400">
                Total Bundle Input: <strong className="text-white font-mono">{totalInput} PCS</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isReceived && (
              <button
                onClick={handleStartFinishing}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-md shadow-teal-900/30 flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>Begin Finishing</span>
              </button>
            )}

            {isInProcess && (
              <button
                onClick={handlePause}
                disabled={saving}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Pause className="w-4 h-4" />
                <span>Pause</span>
              </button>
            )}

            {isPaused && (
              <button
                onClick={handleResume}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-900/30 flex items-center gap-1.5 transition"
              >
                <Play className="w-4 h-4" />
                <span>Resume</span>
              </button>
            )}
          </div>
        </div>

        {/* THREE COUNTER CARDS: GOOD, REWORK, REJECT */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 1. Good Finished Garments */}
          <div className="bg-slate-900/70 border border-emerald-500/40 rounded-2xl p-6 flex flex-col justify-between space-y-4 shadow-lg backdrop-blur-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Good Finished Garments
              </span>
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>

            <div className="text-center py-4">
              <span className="text-5xl font-black text-white font-mono">{goodCount}</span>
              <span className="block text-xs text-slate-400 mt-1">Ready for next department</span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => setGoodCount((c) => Math.max(0, c - 1))}
                className="py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm transition flex items-center justify-center"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                onClick={() => setGoodCount((c) => c + 1)}
                className="py-2.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 font-bold text-sm transition border border-emerald-500/40"
              >
                +1
              </button>
              <button
                onClick={() => setGoodCount((c) => c + 5)}
                className="py-2.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 font-bold text-sm transition border border-emerald-500/40"
              >
                +5
              </button>
              <button
                onClick={() => setGoodCount(totalInput - reworkCount - rejectCount)}
                className="py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
                title="Fill all remaining balance"
              >
                ALL
              </button>
            </div>
          </div>

          {/* 2. Rework / Re-trim */}
          <div className="bg-slate-900/70 border border-amber-500/40 rounded-2xl p-6 flex flex-col justify-between space-y-4 shadow-lg backdrop-blur-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                Rework (Re-trim / Clean)
              </span>
              <Scissors className="w-5 h-5 text-amber-400" />
            </div>

            <div className="text-center py-4">
              <span className="text-5xl font-black text-white font-mono">{reworkCount}</span>
              <span className="block text-xs text-slate-400 mt-1">Requires touch-up cleaning</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setReworkCount((c) => Math.max(0, c - 1))}
                className="py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm transition flex items-center justify-center"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                onClick={() => setReworkCount((c) => c + 1)}
                className="py-2.5 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 font-bold text-sm transition border border-amber-500/40"
              >
                +1
              </button>
              <button
                onClick={() => setReworkCount((c) => c + 5)}
                className="py-2.5 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 font-bold text-sm transition border border-amber-500/40"
              >
                +5
              </button>
            </div>
          </div>

          {/* 3. Reject / Scrap */}
          <div className="bg-slate-900/70 border border-rose-500/40 rounded-2xl p-6 flex flex-col justify-between space-y-4 shadow-lg backdrop-blur-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                Reject / Scrapped
              </span>
              <AlertCircle className="w-5 h-5 text-rose-400" />
            </div>

            <div className="text-center py-4">
              <span className="text-5xl font-black text-white font-mono">{rejectCount}</span>
              <span className="block text-xs text-slate-400 mt-1">Irreparable defects / scrap</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setRejectCount((c) => Math.max(0, c - 1))}
                className="py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm transition flex items-center justify-center"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                onClick={() => setRejectCount((c) => c + 1)}
                className="py-2.5 rounded-lg bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 font-bold text-sm transition border border-rose-500/40"
              >
                +1
              </button>
              <button
                onClick={() => setRejectCount((c) => c + 5)}
                className="py-2.5 rounded-lg bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 font-bold text-sm transition border border-rose-500/40"
              >
                +5
              </button>
            </div>
          </div>
        </div>

        {/* QUANTITY RECONCILIATION SUMMARY */}
        <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-4 backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-300">Accounting Balance:</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-white">{currentReconciled}</span>
              <span className="text-slate-500">/</span>
              <span className="font-mono text-sm font-bold text-slate-400">{totalInput} PCS</span>
            </div>
            {balanceRemaining > 0 && (
              <span className="text-xs text-amber-400 font-medium">
                ({balanceRemaining} pcs balance remaining in queue)
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSaveOutput(false)}
              disabled={saving || !isBalanced}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition disabled:opacity-50"
            >
              Save Progress
            </button>
            <button
              onClick={() => handleSaveOutput(true)}
              disabled={saving || !isBalanced || goodCount <= 0}
              className="px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-md shadow-teal-900/30 transition disabled:opacity-50 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Complete & Release for Handover</span>
            </button>
          </div>
        </div>

        {/* PRODUCTION SHEET PRINT MODAL */}
        {showTechSheet && job.program && (
          <ProductionSheetPrintModal
            isOpen={true}
            program={job.program}
            onClose={() => setShowTechSheet(false)}
          />
        )}
      </main>
    </div>
  );
}
