'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Wind,
  Flame,
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
} from 'lucide-react';
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';

export default function SteamPressFocusWorkspacePage({
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
      const res = await fetch(`/api/steam-press/jobs/${jobId}`);
      if (!res.ok) throw new Error('Failed to load steam press job');
      const json = await res.json();
      const data = json.data;
      setJob(data);

      const totalQty =
        data.fabricIn ||
        data.items?.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0), 0) ||
        0;

      setGoodCount(data.fabricOut ?? totalQty);
      setReworkCount(data.reworkQty ?? 0);
      setRejectCount(data.rejectQty ?? 0);
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

  const handleStartPressing = async () => {
    try {
      setSaving(true);
      const res = await fetch(`/api/steam-press/jobs/${jobId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workstationNumber: 'Focus Table 1', operatorName: 'Floor Operator' }),
      });
      if (!res.ok) throw new Error('Failed to start pressing');
      await loadJob();
    } catch (err: any) {
      alert(err.message || 'Error starting pressing');
    } finally {
      setSaving(false);
    }
  };

  const handlePauseJob = async () => {
    const reason = prompt('Enter pause reason:');
    if (!reason) return;
    try {
      setSaving(true);
      const res = await fetch(`/api/steam-press/jobs/${jobId}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error('Failed to pause');
      await loadJob();
    } catch (err: any) {
      alert(err.message || 'Error pausing');
    } finally {
      setSaving(false);
    }
  };

  const handleResumeJob = async () => {
    try {
      setSaving(true);
      const res = await fetch(`/api/steam-press/jobs/${jobId}/resume`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to resume');
      await loadJob();
    } catch (err: any) {
      alert(err.message || 'Error resuming');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveReconciliation = async (autoInspect = false) => {
    try {
      setSaving(true);
      setSaveSuccess('');

      if (currentReconciled > totalInput) {
        throw new Error(`Total pieces (${currentReconciled}) exceed input received (${totalInput}).`);
      }

      const res = await fetch(`/api/steam-press/jobs/${jobId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goodQuantity: Number(goodCount),
          reworkQuantity: Number(reworkCount),
          rejectQuantity: Number(rejectCount),
          balanceQuantity: balanceRemaining,
          defectReason: Number(rejectCount) > 0 ? defectReason : undefined,
          notes: operatorNotes || 'Completed in Focus Workspace',
          autoInspect: autoInspect,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save output');

      setSaveSuccess('Output saved and reconciled successfully!');
      await loadJob();
      setTimeout(() => setSaveSuccess(''), 3000);
    } catch (err: any) {
      alert(err.message || 'Error saving reconciliation');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 p-8">
        <div className="max-w-md mx-auto p-6 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-white">Job Not Found</h2>
          <p className="text-xs text-slate-400">{error || 'Unable to load specified job record.'}</p>
          <Link
            href="/steam-press/my-work"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Workstation</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen text-slate-100 flex flex-col"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(37, 35, 42, 0.95), rgba(24, 22, 28, 0.98)), url('${DEPARTMENT_NAV_BG_IMAGE}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* HEADER */}
      <header className="border-b border-slate-800 bg-slate-950/70 backdrop-blur-md px-6 py-4 sticky top-0 z-30 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/steam-press/my-work"
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition"
              title="Back to Floor"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold text-cyan-300">
                  {job.challanNumber}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider bg-cyan-500/10 text-cyan-300 border-cyan-500/30">
                  {job.status.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Style: <span className="text-white font-semibold">{job.program?.styleCode || 'Standard'}</span> | Program:{' '}
                <span className="font-mono text-slate-300">{job.program?.programNumber || 'N/A'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {job.program && (
              <button
                onClick={() => setShowTechSheet(true)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs text-slate-300 flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                <span>Tech Sheet</span>
              </button>
            )}

            {job.status === 'RECEIVED' && (
              <button
                onClick={handleStartPressing}
                disabled={saving}
                className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition flex items-center gap-1.5"
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Start Pressing</span>
              </button>
            )}

            {job.status === 'IN_PROCESS' && (
              <button
                onClick={handlePauseJob}
                disabled={saving}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold border border-amber-500/30 transition flex items-center gap-1.5"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>Pause</span>
              </button>
            )}

            {job.status === 'ON_HOLD' && (
              <button
                onClick={handleResumeJob}
                disabled={saving}
                className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Resume</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* MAIN FOCUS CONTENT */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-6 space-y-6">
        {saveSuccess && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{saveSuccess}</span>
          </div>
        )}

        {/* INPUT VS OUTPUT SUMMARY BANNER */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-xs text-slate-400 block">Total Inward Received</span>
              <span className="font-mono text-2xl font-bold text-white">{totalInput} PCS</span>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div>
              <span className="text-xs text-slate-400 block">Reconciled Sum</span>
              <span
                className={`font-mono text-2xl font-bold ${
                  currentReconciled === totalInput
                    ? 'text-emerald-400'
                    : currentReconciled < totalInput
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {currentReconciled} PCS
              </span>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div>
              <span className="text-xs text-slate-400 block">Unprocessed WIP Balance</span>
              <span className="font-mono text-2xl font-bold text-slate-300">{balanceRemaining} PCS</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSaveReconciliation(false)}
              disabled={saving || !isBalanced}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition flex items-center gap-2 disabled:opacity-50"
            >
              <span>Save Progress</span>
            </button>
            <button
              onClick={() => handleSaveReconciliation(true)}
              disabled={saving || !isBalanced}
              className="px-5 py-2 rounded-xl bg-lavender-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/50 transition flex items-center gap-2 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Complete & Authorize Release</span>
            </button>
          </div>
        </div>

        {/* RAPID TALLY COUNTER CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* GOOD PRESSED */}
          <div className="bg-slate-900/80 border border-emerald-500/40 rounded-2xl p-6 backdrop-blur-md space-y-4 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Good Pressed Output
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                Standard
              </span>
            </div>

            <div className="text-center py-4">
              <input
                type="number"
                min="0"
                value={goodCount}
                onChange={(e) => setGoodCount(Math.max(0, Number(e.target.value)))}
                className="w-full text-center font-mono text-5xl font-black bg-transparent text-emerald-300 focus:outline-none"
              />
              <span className="text-xs text-slate-500 block mt-1">PIECES</span>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setGoodCount((c) => Math.max(0, c - 1))}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold transition"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                onClick={() => setGoodCount((c) => c + 1)}
                className="px-4 py-2 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-300 text-sm font-bold transition"
              >
                +1
              </button>
              <button
                onClick={() => setGoodCount((c) => c + 5)}
                className="px-4 py-2 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-300 text-sm font-bold transition"
              >
                +5
              </button>
              <button
                onClick={() => setGoodCount((c) => c + 10)}
                className="px-4 py-2 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-300 text-sm font-bold transition"
              >
                +10
              </button>
            </div>
          </div>

          {/* REWORK (RE-PRESS) */}
          <div className="bg-slate-900/80 border border-amber-500/40 rounded-2xl p-6 backdrop-blur-md space-y-4 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Re-press Rework
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                Minor Crease/Damp
              </span>
            </div>

            <div className="text-center py-4">
              <input
                type="number"
                min="0"
                value={reworkCount}
                onChange={(e) => setReworkCount(Math.max(0, Number(e.target.value)))}
                className="w-full text-center font-mono text-5xl font-black bg-transparent text-amber-300 focus:outline-none"
              />
              <span className="text-xs text-slate-500 block mt-1">PIECES</span>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setReworkCount((c) => Math.max(0, c - 1))}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold transition"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                onClick={() => setReworkCount((c) => c + 1)}
                className="px-4 py-2 rounded-xl bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/40 text-amber-300 text-sm font-bold transition"
              >
                +1
              </button>
              <button
                onClick={() => setReworkCount((c) => c + 5)}
                className="px-4 py-2 rounded-xl bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/40 text-amber-300 text-sm font-bold transition"
              >
                +5
              </button>
            </div>
          </div>

          {/* REJECT (SCORCH / SCRAP) */}
          <div className="bg-slate-900/80 border border-rose-500/40 rounded-2xl p-6 backdrop-blur-md space-y-4 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                Scorch Scrap Reject
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20">
                Permanent Scorch
              </span>
            </div>

            <div className="text-center py-4">
              <input
                type="number"
                min="0"
                value={rejectCount}
                onChange={(e) => setRejectCount(Math.max(0, Number(e.target.value)))}
                className="w-full text-center font-mono text-5xl font-black bg-transparent text-rose-300 focus:outline-none"
              />
              <span className="text-xs text-slate-500 block mt-1">PIECES</span>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setRejectCount((c) => Math.max(0, c - 1))}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold transition"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                onClick={() => setRejectCount((c) => c + 1)}
                className="px-4 py-2 rounded-xl bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/40 text-rose-300 text-sm font-bold transition"
              >
                +1
              </button>
              <button
                onClick={() => setRejectCount((c) => c + 5)}
                className="px-4 py-2 rounded-xl bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/40 text-rose-300 text-sm font-bold transition"
              >
                +5
              </button>
            </div>
          </div>
        </div>

        {/* DEFECT CATEGORIZATION & NOTES */}
        {Number(rejectCount) > 0 && (
          <div className="bg-slate-900/80 border border-rose-500/30 rounded-2xl p-4 backdrop-blur-md space-y-3">
            <span className="text-xs font-semibold text-rose-300 block">
              Primary Scrap Reason (Defect Logging)
            </span>
            <input
              type="text"
              list="steam-press-defect-reasons"
              value={defectReason}
              onChange={(e) => setDefectReason(e.target.value)}
              required={Number(rejectCount) > 0}
              placeholder="Enter the actual defect reason"
              className="w-full max-w-md px-3 py-2 bg-slate-950 border border-rose-500/40 rounded-lg text-xs text-white focus:outline-none"
            />
            <datalist id="steam-press-defect-reasons">
              <option value="Scorch mark / glaze shine" />
              <option value="Melted embroidery / sequin deformation" />
              <option value="Water drip mineral stain" />
              <option value="Wrinkle set / permanent fold defect" />
            </datalist>
          </div>
        )}

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 backdrop-blur-md space-y-2">
          <span className="text-xs font-semibold text-slate-300 block">Operator Observation Notes</span>
          <textarea
            rows={2}
            value={operatorNotes}
            onChange={(e) => setOperatorNotes(e.target.value)}
            placeholder="Record any notes regarding boiler pressure, steam vacuum, or specific fabric observations..."
            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-lavender-400 resize-none"
          />
        </div>

        {/* PRODUCTION SHEET MODAL */}
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
