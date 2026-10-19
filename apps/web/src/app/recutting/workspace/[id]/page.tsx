'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Scissors,
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
} from 'lucide-react';
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';

export default function RecuttingFocusWorkspacePage({
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
  const [defectCode, setDefectCode] = useState('CUT_OFF_SPEC');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');

  // Tech Sheet
  const [showTechSheet, setShowTechSheet] = useState(false);

  const loadJob = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`/api/recutting/jobs/${jobId}`);
      if (!res.ok) throw new Error('Failed to load cutting job');
      const json = await res.json();
      const data = json.data;
      setJob(data);

      const totalQty = data.items?.reduce(
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

  const totalInput = job?.items?.reduce(
    (sum: number, it: any) => sum + (Number(it.quantity) || 0),
    0
  ) || 0;

  const currentReconciled = Number(goodCount) + Number(reworkCount) + Number(rejectCount);
  const balanceRemaining = Math.max(0, totalInput - currentReconciled);
  const isBalanced = currentReconciled <= totalInput;

  const handleStartCutting = async () => {
    try {
      setSaving(true);
      const res = await fetch(`/api/recutting/jobs/${jobId}/start`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to start cutting');
      await loadJob();
    } catch (err: any) {
      alert(err.message || 'Error starting cutting');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOutput = async () => {
    if (goodCount + reworkCount + rejectCount > totalInput) {
      alert('Total outputs cannot exceed input quantity.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      const res = await fetch(`/api/recutting/jobs/${jobId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputQuantity: totalInput,
          goodQuantity: goodCount,
          reworkQuantity: reworkCount,
          rejectQuantity: rejectCount,
          balanceQuantity: balanceRemaining,
          operatorNotes,
          defectCode: rejectCount > 0 ? defectCode : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save output');

      setSaveSuccess('Recutting progress saved and reconciled successfully!');
      await loadJob();
      setTimeout(() => setSaveSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Error saving output');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-8">
        <div className="text-center text-slate-500">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-rose-600" />
          <p className="text-sm font-semibold">Loading Cutting Station Focus Mode...</p>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] p-8 max-w-xl mx-auto text-center">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
        <h2 className="text-base font-bold text-slate-800">Job Not Found</h2>
        <p className="text-xs text-slate-500 mt-1">The requested challan could not be located.</p>
        <Link
          href="/recutting/my-work"
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Work Queue</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 pb-16">
      {/* TOP FOCUS BAR */}
      <header className="border-b border-slate-800 bg-slate-950/80 sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/recutting/my-work"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Back to Queue"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                FOCUS WORKSPACE
              </span>
              <span className="text-xs font-mono font-bold text-white">{job.challanNumber}</span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs font-bold text-slate-300">
                {job.program?.programNumber || 'Program'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {job.program && (
            <button
              onClick={() => setShowTechSheet(true)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-sky-400" />
              <span>Tech Sheet</span>
            </button>
          )}
          <Link
            href="/recutting/issue-challan"
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Handover</span>
          </Link>
        </div>
      </header>

      {/* FOCUS BODY */}
      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-6">
        {error && (
          <div className="p-4 bg-rose-950/50 border border-rose-800 text-rose-300 text-sm rounded-xl flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {saveSuccess && (
          <div className="p-4 bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-sm rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{saveSuccess}</span>
          </div>
        )}

        {/* TOP SPECIFICATION BANNER */}
        <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Buyer / Client</span>
            <div className="text-base font-extrabold text-white mt-0.5">
              {job.program?.buyerName || job.program?.clientName || 'General Client'}
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Wilcom Design #</span>
            <div className="text-base font-mono font-black text-rose-400 mt-0.5">
              {job.program?.wilcomDesignNumber || job.program?.designNumber || 'N/A'}
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Fabric & Shade</span>
            <div className="text-base font-bold text-slate-200 mt-0.5">
              {job.program?.fabricName || 'Fabric'} ({job.program?.fabricColor || 'Natural'})
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Input Quantity</span>
            <div className="text-base font-black text-white mt-0.5">
              {totalInput.toLocaleString()} PCS
            </div>
          </div>
        </section>

        {/* CUTTING OPERATOR CONTROLS */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* GOOD PIECES COUNTER */}
          <div className="bg-slate-900/90 border border-emerald-500/40 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-emerald-400">
                <span className="text-xs font-bold uppercase tracking-wider">Good Cut Panels</span>
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Precision cuts passed seam allowance and symmetry check.
              </p>
            </div>

            <div className="my-6 text-center">
              <span className="text-5xl font-black text-emerald-400 font-mono">{goodCount}</span>
              <span className="text-xs font-bold text-slate-400 ml-1">PCS</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setGoodCount(Math.max(0, goodCount - 1))}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold flex items-center justify-center"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setGoodCount(goodCount + 1)}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* RETRIM / REWORK COUNTER */}
          <div className="bg-slate-900/90 border border-amber-500/40 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-amber-400">
                <span className="text-xs font-bold uppercase tracking-wider">Retrim / Secondary Trim</span>
                <Clock className="w-5 h-5" />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Panels needing secondary thread shearing or edge re-trim.
              </p>
            </div>

            <div className="my-6 text-center">
              <span className="text-5xl font-black text-amber-400 font-mono">{reworkCount}</span>
              <span className="text-xs font-bold text-slate-400 ml-1">PCS</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setReworkCount(Math.max(0, reworkCount - 1))}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold flex items-center justify-center"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setReworkCount(reworkCount + 1)}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold flex items-center justify-center"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* REJECT / SCRAP COUNTER */}
          <div className="bg-slate-900/90 border border-rose-500/40 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-rose-400">
                <span className="text-xs font-bold uppercase tracking-wider">Reject / Scrap</span>
                <Scissors className="w-5 h-5" />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Damaged fabric, cut into Wilcom motif, or off-spec.
              </p>
            </div>

            <div className="my-6 text-center">
              <span className="text-5xl font-black text-rose-400 font-mono">{rejectCount}</span>
              <span className="text-xs font-bold text-slate-400 ml-1">PCS</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRejectCount(Math.max(0, rejectCount - 1))}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold flex items-center justify-center"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setRejectCount(rejectCount + 1)}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold flex items-center justify-center"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* SUMMARY BAR & ACTION BUTTONS */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs space-y-1">
            <div className="text-slate-400">
              Total Input: <strong className="text-white">{totalInput} PCS</strong> | Reconciled:{' '}
              <strong className="text-white">{currentReconciled} PCS</strong> | Balance:{' '}
              <strong className="text-amber-400">{balanceRemaining} PCS</strong>
            </div>
            <div className="text-[11px] text-slate-500">
              Current Status: <strong className="text-rose-400">{job.status}</strong>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {job.status === 'RECEIVED' && (
              <button
                type="button"
                onClick={handleStartCutting}
                disabled={saving}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md transition"
              >
                Start Precision Cutting
              </button>
            )}

            <button
              type="button"
              onClick={handleSaveOutput}
              disabled={saving}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-2"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Save & Reconcile Output</span>
                </>
              )}
            </button>
          </div>
        </section>
      </main>

      {/* TECH SHEET MODAL */}
      {showTechSheet && job.program && (
        <ProductionSheetPrintModal
          isOpen={true}
          onClose={() => setShowTechSheet(false)}
          program={job.program}
        />
      )}
    </div>
  );
}
