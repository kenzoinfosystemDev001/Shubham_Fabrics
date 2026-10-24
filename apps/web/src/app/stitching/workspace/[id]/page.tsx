'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Shirt,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  Sparkles,
  Layers,
  Printer,
  Check,
  ShieldCheck,
  Send,
  Plus,
  Minus,
  Pause,
  Play,
} from 'lucide-react';
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';

export default function StitchingFocusWorkspacePage({
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
  const [defectReason, setDefectReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');

  // Tech Sheet
  const [showTechSheet, setShowTechSheet] = useState(false);

  const loadJob = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`/api/stitching/jobs/${jobId}`);
      if (!res.ok) throw new Error('Failed to load stitching job');
      const json = await res.json();
      const data = json.data;
      setJob(data);

      const totalQty = data.fabricIn || data.items?.reduce(
        (sum: number, it: any) => sum + (Number(it.quantity) || 0),
        0
      ) || 0;

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

  const totalInput = job?.fabricIn || job?.items?.reduce(
    (sum: number, it: any) => sum + (Number(it.quantity) || 0),
    0
  ) || 0;

  const currentReconciled = Number(goodCount) + Number(reworkCount) + Number(rejectCount);
  const balanceRemaining = Math.max(0, totalInput - currentReconciled);
  const isBalanced = currentReconciled <= totalInput;

  const handleStartStitching = async () => {
    try {
      setSaving(true);
      const res = await fetch(`/api/stitching/jobs/${jobId}/start`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to start stitching');
      await loadJob();
    } catch (err: any) {
      alert(err.message || 'Error starting stitching');
    } finally {
      setSaving(false);
    }
  };

  const handlePause = async () => {
    try {
      setSaving(true);
      const res = await fetch(`/api/stitching/jobs/${jobId}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Operator break / Needle adjustment' }),
      });
      if (!res.ok) throw new Error('Failed to pause stitching');
      await loadJob();
    } catch (err: any) {
      alert(err.message || 'Error pausing stitching');
    } finally {
      setSaving(false);
    }
  };

  const handleResume = async () => {
    try {
      setSaving(true);
      const res = await fetch(`/api/stitching/jobs/${jobId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error('Failed to resume stitching');
      await loadJob();
    } catch (err: any) {
      alert(err.message || 'Error resuming stitching');
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteSubmit = async () => {
    const totalAccounted = goodCount + reworkCount + rejectCount + balanceRemaining;
    if (totalAccounted !== totalInput) {
      alert(`Mismatch! Total accounted must equal ${totalInput}.`);
      return;
    }

    try {
      setSaving(true);
      setSaveSuccess('');
      const res = await fetch(`/api/stitching/jobs/${jobId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputQuantity: totalInput,
          goodQuantity: goodCount,
          reworkQuantity: reworkCount,
          rejectQuantity: rejectCount,
          balanceQuantity: balanceRemaining,
          operatorNotes: operatorNotes || 'Line focus mode output reconciliation.',
          defectReason: rejectCount > 0 ? defectReason : undefined,
          autoInspect: true, // auto-mark ready for handover from focus mode
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Failed to complete job');
      }

      setSaveSuccess('Output reconciled successfully! Redirecting to Workstation...');
      setTimeout(() => {
        router.push('/stitching/my-work');
      }, 1200);
    } catch (err: any) {
      alert(err.message || 'Error completing stitching');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-ink-950 text-slate-100 flex items-center justify-center p-4">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-ink-950 text-slate-100 p-8 flex flex-col items-center justify-center">
        <AlertCircle className="w-12 h-12 text-rose-400 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Job Not Found</h2>
        <p className="text-sm text-slate-400 mb-6">{error || 'Could not load job'}</p>
        <Link
          href="/stitching/my-work"
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-semibold text-xs transition"
        >
          Return to Workstation
        </Link>
      </div>
    );
  }

  const isInProcess = job.status === 'IN_PROCESS';
  const isOnHold = job.status === 'ON_HOLD';

  return (
    <div className="min-h-screen bg-ink-950 text-slate-100 flex flex-col">
      {/* HEADER */}
      <div
        style={{
          backgroundImage: `linear-gradient(to right, rgba(37, 35, 42, 0.95), rgba(37, 35, 42, 0.85)), url('${DEPARTMENT_NAV_BG_IMAGE}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        className="border-b border-slate-800 p-4 md:p-6 shadow-md"
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/stitching/my-work"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-indigo-400">{job.challanNumber}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {job.status.replace(/_/g, ' ')}
                </span>
              </div>
              <h1 className="text-lg md:text-xl font-black text-white mt-0.5">
                {job.program?.styleCode || 'Garment Assembly'} &bull; {job.program?.programNumber || 'Program'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTechSheet(true)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span>Tech Specs</span>
            </button>
          </div>
        </div>
      </div>

      {/* FOCUS BODY */}
      <div className="max-w-5xl mx-auto w-full p-4 md:p-6 space-y-6 flex-1">
        {saveSuccess && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{saveSuccess}</span>
          </div>
        )}

        {/* PROGRESS BANNER */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Target Assembly Progress:</span>
            <span className="font-mono font-bold text-white">
              {currentReconciled} / {totalInput} pcs ({totalInput > 0 ? Math.round((currentReconciled / totalInput) * 100) : 0}%)
            </span>
          </div>

          <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800 flex">
            <div
              style={{ width: `${totalInput > 0 ? (goodCount / totalInput) * 100 : 0}%` }}
              className="bg-emerald-500 transition-all duration-300"
            />
            <div
              style={{ width: `${totalInput > 0 ? (reworkCount / totalInput) * 100 : 0}%` }}
              className="bg-amber-500 transition-all duration-300"
            />
            <div
              style={{ width: `${totalInput > 0 ? (rejectCount / totalInput) * 100 : 0}%` }}
              className="bg-rose-500 transition-all duration-300"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Good Garments: <strong>{goodCount}</strong></span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Re-stitch: <strong>{reworkCount}</strong></span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              <span>Reject: <strong>{rejectCount}</strong></span>
            </span>
            <span>Balance WIP: <strong>{balanceRemaining}</strong></span>
          </div>
        </div>

        {/* 3 HIGH-SPEED TALLY COUNTERS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* GOOD COUNT */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-emerald-500/40 flex flex-col justify-between items-center text-center space-y-4">
            <div>
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block mb-1">Good Finished Garments</span>
              <div className="text-5xl font-black text-white font-mono">{goodCount}</div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setGoodCount((c) => Math.max(0, c - 1))}
                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-bold text-lg"
              >
                <Minus className="w-5 h-5" />
              </button>
              <button
                onClick={() => setGoodCount((c) => Math.min(totalInput, c + 1))}
                className="w-14 h-10 rounded-xl bg-lavender-600 hover:bg-emerald-500 text-white flex items-center justify-center font-bold text-lg shadow-md"
              >
                +1
              </button>
              <button
                onClick={() => setGoodCount((c) => Math.min(totalInput, c + 5))}
                className="px-3 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 flex items-center justify-center font-bold text-xs"
              >
                +5
              </button>
              <button
                onClick={() => setGoodCount((c) => Math.min(totalInput, c + 10))}
                className="px-3 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 flex items-center justify-center font-bold text-xs"
              >
                +10
              </button>
            </div>
          </div>

          {/* RE-STITCH COUNT */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-amber-500/40 flex flex-col justify-between items-center text-center space-y-4">
            <div>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block mb-1">Re-stitch / Rework</span>
              <div className="text-5xl font-black text-white font-mono">{reworkCount}</div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setReworkCount((c) => Math.max(0, c - 1))}
                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-bold text-lg"
              >
                <Minus className="w-5 h-5" />
              </button>
              <button
                onClick={() => setReworkCount((c) => c + 1)}
                className="w-14 h-10 rounded-xl bg-lavender-600 hover:bg-amber-500 text-white flex items-center justify-center font-bold text-lg shadow-md"
              >
                +1
              </button>
            </div>
          </div>

          {/* REJECT COUNT */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-rose-500/40 flex flex-col justify-between items-center text-center space-y-4">
            <div>
              <span className="text-xs font-bold text-rose-400 uppercase tracking-wider block mb-1">Reject / Scrap</span>
              <div className="text-5xl font-black text-white font-mono">{rejectCount}</div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setRejectCount((c) => Math.max(0, c - 1))}
                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-bold text-lg"
              >
                <Minus className="w-5 h-5" />
              </button>
              <button
                onClick={() => setRejectCount((c) => c + 1)}
                className="w-14 h-10 rounded-xl bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center font-bold text-lg shadow-md"
              >
                +1
              </button>
            </div>
          </div>
        </div>

        {/* NOTES & CONTROLS */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Shift / Operator Notes</label>
              <input
                type="text"
                value={operatorNotes}
                onChange={(e) => setOperatorNotes(e.target.value)}
                placeholder="Line observations, needle change, thread batch..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
              />
            </div>

            {rejectCount > 0 && (
              <div>
                <label className="block text-xs font-semibold text-rose-300 mb-1">Scrap Reason</label>
                <input
                  type="text"
                  value={defectReason}
                  onChange={(e) => setDefectReason(e.target.value)}
                  required={rejectCount > 0}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                />
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isInProcess && (
                <button
                  onClick={handlePause}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 text-xs font-semibold border border-amber-500/40 transition flex items-center gap-1.5"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause Line</span>
                </button>
              )}

              {isOnHold && (
                <button
                  onClick={handleResume}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Resume Line</span>
                </button>
              )}

              {job.status === 'RECEIVED' && (
                <button
                  onClick={handleStartStitching}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
                >
                  <Shirt className="w-3.5 h-3.5" />
                  <span>Start Line</span>
                </button>
              )}
            </div>

            <button
              onClick={handleCompleteSubmit}
              disabled={saving || !isBalanced}
              className="px-6 py-2.5 rounded-xl bg-lavender-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg flex items-center gap-2 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{saving ? 'Reconciling...' : 'Confirm Output & Complete'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* TECH SHEET PRINT MODAL */}
      {showTechSheet && job?.program && (
        <ProductionSheetPrintModal
          isOpen={showTechSheet}
          onClose={() => setShowTechSheet(false)}
          program={job.program}
        />
      )}
    </div>
  );
}
