'use client';

import React, { useState, useEffect, Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Sparkles,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  ArrowRight,
  ShieldCheck,
  Send,
  Layers,
  ChevronRight,
  User,
  Calendar,
  X,
  Plus,
  Trash2,
  Printer,
  Check,
  RotateCcw,
  Package,
  Scissors,
  Pause,
  Play,
  Archive,
} from 'lucide-react';
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';
import { DocumentActionButtons } from '@/components/common/DocumentActionButtons';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';
import { DepartmentDefectiveShelfWidget } from '@/components/DepartmentDefectiveShelfWidget';

function FinishingWorkstationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialJobId = searchParams.get('jobId');
  const initialTab = searchParams.get('tab') || 'ALL';

  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [activeView, setActiveView] = useState<'WORKBENCH' | 'DEFECTIVE_SHELF'>('WORKBENCH');

  // Modals
  const [showTechSheet, setShowTechSheet] = useState(false);
  const [techSheetProgram, setTechSheetProgram] = useState<any>(null);

  // Start / Allocation Modal
  const [showStartModal, setShowStartModal] = useState(false);
  const [submittingStart, setSubmittingStart] = useState(false);
  const [workstationNumber, setWorkstationNumber] = useState('Table 1');
  const [operatorName, setOperatorName] = useState('Finishing Specialist');
  const [operationType, setOperationType] = useState('THREAD_TRIMMING_AND_CLEANING');

  // Complete / Output Reconciliation Modal
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [submittingComplete, setSubmittingComplete] = useState(false);
  const [completeError, setCompleteError] = useState('');
  const [completeInputQty, setCompleteInputQty] = useState(0);
  const [completeGoodQty, setCompleteGoodQty] = useState(0);
  const [completeReworkQty, setCompleteReworkQty] = useState(0);
  const [completeRejectQty, setCompleteRejectQty] = useState(0);
  const [completeBalanceQty, setCompleteBalanceQty] = useState(0);
  const [completeNotes, setCompleteNotes] = useState('');
  const [completeDefectReason, setCompleteDefectReason] = useState('');
  const [autoInspect, setAutoInspect] = useState(false);

  // Quality Inspection Modal
  const [showInspectModal, setShowInspectModal] = useState(false);
  const [submittingInspect, setSubmittingInspect] = useState(false);
  const [inspectError, setInspectError] = useState('');
  const [inspectChecks, setInspectChecks] = useState({
    trimmingCleanliness: 'PASS',
    spotCleaning: 'PASS',
    pressingQuality: 'PASS',
    measurementCheck: 'PASS',
    overallResult: 'PASS',
  });
  const [inspectNotes, setInspectNotes] = useState('Thread tails trimmed cleanly, no stain spots, crease pressing verified.');

  // Pause / Resume states
  const [submittingPause, setSubmittingPause] = useState(false);
  const [submittingResume, setSubmittingResume] = useState(false);

  const loadJobs = async (selectId?: string) => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/finishing/queue');
      if (!res.ok) throw new Error('Failed to load Finishing jobs');
      const json = await res.json();
      const list = json.data || [];
      setJobs(list);

      const targetId = selectId || selectedJob?.id || initialJobId;
      if (targetId) {
        const found = list.find((j: any) => j.id === targetId);
        if (found) {
          setSelectedJob(found);
        } else if (list.length > 0) {
          setSelectedJob(list[0]);
        }
      } else if (list.length > 0) {
        setSelectedJob(list[0]);
      }
    } catch (err: any) {
      console.error('Error loading Finishing jobs:', err);
      setError(err.message || 'Error connecting to server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const openStartModal = (job: any) => {
    setSelectedJob(job);
    setShowStartModal(true);
  };

  const handleConfirmStart = async () => {
    if (!selectedJob) return;
    try {
      setSubmittingStart(true);
      const res = await fetch(`/api/finishing/jobs/${selectedJob.id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workstationNumber,
          operatorName,
          operationType,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to start job');
      }

      setShowStartModal(false);
      await loadJobs(selectedJob.id);
    } catch (err: any) {
      alert(err.message || 'Failed to start job');
    } finally {
      setSubmittingStart(false);
    }
  };

  const openCompleteModal = (job: any) => {
    setSelectedJob(job);
    const totalPcs = job.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
    const input = job.fabricIn || totalPcs;
    setCompleteInputQty(input);
    setCompleteGoodQty(input);
    setCompleteReworkQty(0);
    setCompleteRejectQty(0);
    setCompleteBalanceQty(0);
    setCompleteNotes('All garments thread trimmed, spot cleaned, pressed and inspected.');
    setCompleteDefectReason('');
    setAutoInspect(true);
    setCompleteError('');
    setShowCompleteModal(true);
  };

  const handleConfirmComplete = async () => {
    if (!selectedJob) return;
    try {
      setSubmittingComplete(true);
      setCompleteError('');

      const totalAccounted =
        Number(completeGoodQty) +
        Number(completeReworkQty) +
        Number(completeRejectQty) +
        Number(completeBalanceQty);

      if (totalAccounted !== Number(completeInputQty)) {
        throw new Error(
          `Reconciliation mismatch: Good (${completeGoodQty}) + Rework (${completeReworkQty}) + Reject (${completeRejectQty}) + Balance (${completeBalanceQty}) = ${totalAccounted}, which does not match Input (${completeInputQty}).`
        );
      }

      const res = await fetch(`/api/finishing/jobs/${selectedJob.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputQuantity: completeInputQty,
          goodQuantity: completeGoodQty,
          reworkQuantity: completeReworkQty,
          rejectQuantity: completeRejectQty,
          balanceQuantity: completeBalanceQty,
          operatorNotes: completeNotes,
          defectReason: completeDefectReason,
          autoInspect: autoInspect,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to complete finishing job');
      }

      setShowCompleteModal(false);
      await loadJobs(selectedJob.id);
    } catch (err: any) {
      setCompleteError(err.message || 'Error recording finishing output');
    } finally {
      setSubmittingComplete(false);
    }
  };

  const openInspectModal = (job: any) => {
    setSelectedJob(job);
    setInspectChecks({
      trimmingCleanliness: 'PASS',
      spotCleaning: 'PASS',
      pressingQuality: 'PASS',
      measurementCheck: 'PASS',
      overallResult: 'PASS',
    });
    setInspectNotes('Thread tails trimmed cleanly, no stain spots, crease pressing verified.');
    setInspectError('');
    setShowInspectModal(true);
  };

  const handleConfirmInspect = async () => {
    if (!selectedJob) return;
    try {
      setSubmittingInspect(true);
      setInspectError('');

      const res = await fetch(`/api/finishing/jobs/${selectedJob.id}/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...inspectChecks,
          notes: inspectNotes,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to record inspection');
      }

      setShowInspectModal(false);
      await loadJobs(selectedJob.id);
    } catch (err: any) {
      setInspectError(err.message || 'Error recording inspection');
    } finally {
      setSubmittingInspect(false);
    }
  };

  const handlePauseJob = async (job: any) => {
    const reason = prompt('Enter reason for pausing this job:', 'Spot cleaning drying / table handover');
    if (!reason) return;
    try {
      setSubmittingPause(true);
      const res = await fetch(`/api/finishing/jobs/${job.id}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to pause job');
      }
      await loadJobs(job.id);
    } catch (err: any) {
      alert(err.message || 'Failed to pause job');
    } finally {
      setSubmittingPause(false);
    }
  };

  const handleResumeJob = async (job: any) => {
    try {
      setSubmittingResume(true);
      const res = await fetch(`/api/finishing/jobs/${job.id}/resume`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to resume job');
      }
      await loadJobs(job.id);
    } catch (err: any) {
      alert(err.message || 'Failed to resume job');
    } finally {
      setSubmittingResume(false);
    }
  };

  // Filter Jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (activeTab === 'READY_TO_START' && job.status !== 'RECEIVED') return false;
      if (activeTab === 'IN_PROGRESS' && job.status !== 'IN_PROCESS' && job.status !== 'ON_HOLD') return false;
      if (activeTab === 'INSPECTION' && job.status !== 'COMPLETED') return false;
      if (activeTab === 'READY_FOR_HANDOVER' && job.status !== 'READY_FOR_HANDOVER') return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const challanNum = (job.challanNumber || '').toLowerCase();
      const progNum = (job.program?.programNumber || '').toLowerCase();
      const style = (job.program?.styleCode || '').toLowerCase();
      const client = (job.program?.clientName || '').toLowerCase();
      return challanNum.includes(q) || progNum.includes(q) || style.includes(q) || client.includes(q);
    });
  }, [jobs, activeTab, searchQuery]);

  return (
    <div
      className="min-h-screen text-slate-100 flex flex-col"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(37, 35, 42, 0.94), rgba(24, 22, 28, 0.98)), url('${DEPARTMENT_NAV_BG_IMAGE}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* HEADER */}
      <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md px-6 py-4 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 shadow-inner">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Finishing Floor & Workstation
              </h1>
              <p className="text-xs text-slate-400">
                Live queue, station allocation, trimming, spot cleaning, pressing, and output accounting
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveView(activeView === 'DEFECTIVE_SHELF' ? 'WORKBENCH' : 'DEFECTIVE_SHELF')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition border ${
                activeView === 'DEFECTIVE_SHELF'
                  ? 'bg-rose-600 text-white border-rose-500 shadow-md'
                  : 'bg-slate-900 text-rose-300 hover:text-white hover:bg-slate-800 border-slate-700/80'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              <span>{activeView === 'DEFECTIVE_SHELF' ? 'Back to Workstation' : 'Defective Shelf (DEF-SHELF-FINISHING)'}</span>
            </button>

            <button
              onClick={() => loadJobs()}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-300 hover:text-white transition disabled:opacity-50"
              title="Refresh Queue"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-teal-400' : ''}`} />
            </button>
            <Link
              href="/finishing/issue-challan"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-md shadow-teal-900/30 transition"
            >
              <Send className="w-4 h-4" />
              <span>Issue Handover Challan</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ERROR DISPLAY */}
      {error && (
        <div className="max-w-7xl mx-auto w-full px-6 pt-4">
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6">
        {activeView === 'DEFECTIVE_SHELF' ? (
          <DepartmentDefectiveShelfWidget
            department="FINISHING"
            shelfCode="DEF-SHELF-FINISHING"
            accentColor="rose"
          />
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* LEFT PANE: JOBS LIST */}
        <div className="w-full lg:w-5/12 flex flex-col space-y-4">
          {/* SEARCH & FILTER TABS */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-3.5 space-y-3 backdrop-blur-xs">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search style, program, challan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-lavender-400"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] scrollbar-none">
              <button
                onClick={() => setActiveTab('ALL')}
                className={`px-2.5 py-1.5 rounded-lg font-semibold shrink-0 transition ${
                  activeTab === 'ALL'
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({jobs.length})
              </button>
              <button
                onClick={() => setActiveTab('READY_TO_START')}
                className={`px-2.5 py-1.5 rounded-lg font-semibold shrink-0 transition ${
                  activeTab === 'READY_TO_START'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Queue ({jobs.filter((j) => j.status === 'RECEIVED').length})
              </button>
              <button
                onClick={() => setActiveTab('IN_PROGRESS')}
                className={`px-2.5 py-1.5 rounded-lg font-semibold shrink-0 transition ${
                  activeTab === 'IN_PROGRESS'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                In Finishing ({jobs.filter((j) => j.status === 'IN_PROCESS' || j.status === 'ON_HOLD').length})
              </button>
              <button
                onClick={() => setActiveTab('INSPECTION')}
                className={`px-2.5 py-1.5 rounded-lg font-semibold shrink-0 transition ${
                  activeTab === 'INSPECTION'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Inspection ({jobs.filter((j) => j.status === 'COMPLETED').length})
              </button>
              <button
                onClick={() => setActiveTab('READY_FOR_HANDOVER')}
                className={`px-2.5 py-1.5 rounded-lg font-semibold shrink-0 transition ${
                  activeTab === 'READY_FOR_HANDOVER'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Ready ({jobs.filter((j) => j.status === 'READY_FOR_HANDOVER').length})
              </button>
            </div>
          </div>

          {/* JOB CARDS SCROLLABLE */}
          <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[calc(100vh-250px)] pr-1">
            {loading ? (
              <div className="py-20 text-center text-slate-400 text-xs flex flex-col items-center">
                <RefreshCw className="w-6 h-6 animate-spin text-teal-400 mb-2" />
                <span>Loading queue...</span>
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-xs">
                No jobs found in this category.
              </div>
            ) : (
              filteredJobs.map((job) => {
                const isSelected = selectedJob?.id === job.id;
                const totalPieces = job.items.reduce(
                  (sum: number, it: any) => sum + (Number(it.quantity) || 0),
                  0
                );

                return (
                  <div
                    key={job.id}
                    onClick={() => setSelectedJob(job)}
                    className={`p-4 rounded-xl border cursor-pointer transition flex flex-col space-y-2 backdrop-blur-xs ${
                      isSelected
                        ? 'bg-teal-950/40 border-teal-500/80 shadow-md ring-1 ring-teal-500/30'
                        : 'bg-slate-900/70 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-white">
                        {job.challanNumber}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                          job.status === 'RECEIVED'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : job.status === 'IN_PROCESS'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                            : job.status === 'COMPLETED'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                            : job.status === 'READY_FOR_HANDOVER'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : job.status === 'ON_HOLD'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {job.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="text-xs text-slate-300 font-semibold flex items-center justify-between">
                      <span>{job.program?.styleCode || 'Standard Style'}</span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {job.program?.programNumber || 'N/A'}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/60">
                      <span>
                        Bundle: <strong className="text-white font-mono">{totalPieces} pcs</strong>
                      </span>
                      {job.fabricOut ? (
                        <span className="text-emerald-400 font-semibold font-mono">
                          Good: {job.fabricOut} pcs
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANE: SELECTED JOB DETAIL & ACTIONS */}
        <div className="w-full lg:w-7/12 flex flex-col space-y-4">
          {!selectedJob ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 backdrop-blur-xs flex flex-col items-center justify-center min-h-[400px]">
              <Sparkles className="w-12 h-12 text-slate-600 mb-3" />
              <h3 className="text-base font-bold text-white">Select a Finishing Job</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Choose a job from the left panel to inspect specifications, assign workstations, record finished counts, or issue outgoing challans.
              </p>
            </div>
          ) : (
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-6 backdrop-blur-xs">
              {/* TOP SUMMARY BAR */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-800 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-bold text-white">
                      {selectedJob.challanNumber}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        selectedJob.status === 'RECEIVED'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : selectedJob.status === 'IN_PROCESS'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                          : selectedJob.status === 'COMPLETED'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                          : selectedJob.status === 'READY_FOR_HANDOVER'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : selectedJob.status === 'ON_HOLD'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {selectedJob.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Transferred from: <strong className="text-slate-300">{selectedJob.fromDepartment || 'STITCHING'}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {/* Production Sheet + the challan received from the previous department */}
                  <DocumentActionButtons program={selectedJob.program} challan={selectedJob} size="sm" />

                  <Link
                    href={`/finishing/workspace/${selectedJob.id}`}
                    className="px-3 py-1.5 rounded-lg bg-teal-600/30 hover:bg-teal-600/50 text-teal-200 border border-teal-500/40 text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    <span>Focus Mode</span>
                  </Link>
                </div>
              </div>

              {/* SPECIFICATION CARD */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px]">PROGRAM</span>
                  <span className="font-mono font-bold text-white">
                    {selectedJob.program?.programNumber || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">STYLE CODE</span>
                  <span className="font-bold text-teal-300">
                    {selectedJob.program?.styleCode || 'Standard'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">BUYER / CLIENT</span>
                  <span className="text-slate-200 truncate block">
                    {selectedJob.program?.buyerName || selectedJob.program?.clientName || 'Direct'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">BUNDLE PIECES</span>
                  <span className="font-mono font-bold text-white text-sm">
                    {selectedJob.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0)} PCS
                  </span>
                </div>
              </div>

              {/* ITEMS BREAKDOWN */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 tracking-wide uppercase">
                  Bundle Garments Breakdown
                </h4>
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3">Color</th>
                        <th className="py-2.5 px-3 text-right">Quantity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {selectedJob.items.map((it: any) => (
                        <tr key={it.id}>
                          <td className="py-2 px-3 font-medium text-white">{it.itemDescription}</td>
                          <td className="py-2 px-3 text-slate-400">{it.colour || 'Standard'}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-white">
                            {it.quantity} {it.uom || 'PCS'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* OPERATION ACTIONS BAR */}
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-slate-300 tracking-wide uppercase">
                  Finishing Operation Controls
                </h4>

                <div className="flex items-center gap-3 flex-wrap">
                  {selectedJob.status === 'RECEIVED' && (
                    <button
                      onClick={() => openStartModal(selectedJob)}
                      className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-md shadow-teal-900/30 transition flex items-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Start Finishing & Assign Table</span>
                    </button>
                  )}

                  {selectedJob.status === 'IN_PROCESS' && (
                    <>
                      <button
                        onClick={() => openCompleteModal(selectedJob)}
                        className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-md shadow-teal-900/30 transition flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Record Finishing Output</span>
                      </button>

                      <button
                        onClick={() => handlePauseJob(selectedJob)}
                        disabled={submittingPause}
                        className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-semibold transition flex items-center gap-2"
                      >
                        <Pause className="w-4 h-4" />
                        <span>Pause Job</span>
                      </button>
                    </>
                  )}

                  {selectedJob.status === 'ON_HOLD' && (
                    <button
                      onClick={() => handleResumeJob(selectedJob)}
                      disabled={submittingResume}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-900/30 transition flex items-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      <span>Resume Finishing</span>
                    </button>
                  )}

                  {selectedJob.status === 'COMPLETED' && (
                    <button
                      onClick={() => openInspectModal(selectedJob)}
                      className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-900/30 transition flex items-center gap-2"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Perform Quality Audit & Release</span>
                    </button>
                  )}

                  {selectedJob.status === 'READY_FOR_HANDOVER' && (
                    <Link
                      href={`/finishing/issue-challan?jobId=${selectedJob.id}`}
                      className="px-4 py-2 rounded-lg bg-lavender-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-900/30 transition flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      <span>Issue Outgoing Challan</span>
                    </Link>
                  )}
                </div>
              </div>

              {/* AUDIT EVENTS TRAIL */}
              {selectedJob.events && selectedJob.events.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 tracking-wide uppercase">
                    Audit Trail & Events
                  </h4>
                  <div className="space-y-1.5 text-[11px] text-slate-400">
                    {selectedJob.events.slice(0, 5).map((ev: any) => (
                      <div
                        key={ev.id}
                        className="p-2 rounded-lg bg-slate-950/40 border border-slate-800/60 flex items-center justify-between"
                      >
                        <span className="text-slate-300 font-medium">
                          {ev.action}: {ev.notes}
                        </span>
                        <span className="font-mono text-slate-500 text-[10px]">
                          {new Date(ev.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      )}

        {/* START FINISHING MODAL */}
        {showStartModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-teal-400" />
                  <h3 className="text-base font-bold text-white">Start Finishing Job</h3>
                </div>
                <button
                  onClick={() => setShowStartModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Workstation / Table #</label>
                  <input
                    type="text"
                    value={workstationNumber}
                    onChange={(e) => setWorkstationNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Finishing Specialist / Trimmer</label>
                  <input
                    type="text"
                    value={operatorName}
                    onChange={(e) => setOperatorName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Primary Operation</label>
                  <select
                    value={operationType}
                    onChange={(e) => setOperationType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  >
                    <option value="THREAD_TRIMMING_AND_CLEANING">Thread Trimming & Spot Cleaning</option>
                    <option value="FORM_PRESSING_AND_CREASE">Form Pressing & Crease Setting</option>
                    <option value="COMPLETE_GARMENT_FINISHING">Complete Garment Finishing (Trim + Clean + Press)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-800">
                <button
                  onClick={() => setShowStartModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmStart}
                  disabled={submittingStart}
                  className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition disabled:opacity-50"
                >
                  {submittingStart ? 'Starting...' : 'Confirm & Begin'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* OUTPUT RECONCILIATION MODAL */}
        {showCompleteModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-teal-400" />
                  <h3 className="text-base font-bold text-white">Record Finishing Output</h3>
                </div>
                <button
                  onClick={() => setShowCompleteModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex justify-between">
                  <span className="text-slate-400">Total Input Garments:</span>
                  <span className="font-mono font-bold text-white text-sm">
                    {completeInputQty} PCS
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-emerald-400 mb-1">
                      Good Finished Garments *
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={completeGoodQty}
                      onChange={(e) => setCompleteGoodQty(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-amber-400 mb-1">
                      Rework / Re-trim
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={completeReworkQty}
                      onChange={(e) => setCompleteReworkQty(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-rose-400 mb-1">
                      Reject / Scrap
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={completeRejectQty}
                      onChange={(e) => setCompleteRejectQty(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-400 mb-1">
                      Balance in Finishing
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={completeBalanceQty}
                      onChange={(e) => setCompleteBalanceQty(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono font-bold"
                    />
                  </div>
                </div>

                {/* Mathematical Check */}
                <div
                  className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                    Number(completeGoodQty) +
                      Number(completeReworkQty) +
                      Number(completeRejectQty) +
                      Number(completeBalanceQty) ===
                    Number(completeInputQty)
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  <span>Reconciled Sum:</span>
                  <span className="font-mono font-bold">
                    {Number(completeGoodQty) +
                      Number(completeReworkQty) +
                      Number(completeRejectQty) +
                      Number(completeBalanceQty)}{' '}
                    / {completeInputQty} PCS
                  </span>
                </div>

                {completeRejectQty > 0 && (
                  <div>
                    <label className="block font-semibold text-rose-400 mb-1">
                      Reject Reason / Defect Classification
                    </label>
                    <input
                      type="text"
                      list="finishing-defect-reasons"
                      value={completeDefectReason}
                      onChange={(e) => setCompleteDefectReason(e.target.value)}
                      required={Number(completeRejectQty) > 0}
                      placeholder="Enter the actual defect reason"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                    />
                    <datalist id="finishing-defect-reasons">
                      <option value="Fabric cut / scissor nip" />
                      <option value="Permanent chemical/oil stain" />
                      <option value="Iron scorch burn / glazed fabric" />
                      <option value="Severe embroidery thread unravel" />
                    </datalist>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="autoInspectFinishing"
                    checked={autoInspect}
                    onChange={(e) => setAutoInspect(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950 text-teal-500"
                  />
                  <label htmlFor="autoInspectFinishing" className="text-slate-300">
                    Auto-pass Finishing QC (Ready for Handover directly)
                  </label>
                </div>

                {completeError && (
                  <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{completeError}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-800">
                <button
                  onClick={() => setShowCompleteModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmComplete}
                  disabled={submittingComplete}
                  className="px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition disabled:opacity-50"
                >
                  {submittingComplete ? 'Saving...' : 'Confirm Output'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* QUALITY INSPECTION MODAL */}
        {showInspectModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-purple-400" />
                  <h3 className="text-base font-bold text-white">Finishing Quality Audit</h3>
                </div>
                <button
                  onClick={() => setShowInspectModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="space-y-2">
                  {[
                    { key: 'trimmingCleanliness', label: 'Thread Trimming Cleanliness (<2mm, no uncut ends)' },
                    { key: 'spotCleaning', label: 'Spot & Stain Cleaning (No oil, chalk, dirt marks)' },
                    { key: 'pressingQuality', label: 'Iron & Crease Quality (Wrinkle-free, no glaze/burns)' },
                    { key: 'measurementCheck', label: 'Dimensions & Sizing Verification (Within tolerance)' },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between p-2.5 bg-slate-950/60 border border-slate-800 rounded-lg"
                    >
                      <span className="text-slate-300 font-medium">{item.label}</span>
                      <select
                        value={(inspectChecks as any)[item.key]}
                        onChange={(e) =>
                          setInspectChecks({ ...inspectChecks, [item.key]: e.target.value })
                        }
                        className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white"
                      >
                        <option value="PASS">PASS</option>
                        <option value="FAIL">FAIL</option>
                      </select>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Inspector Notes</label>
                  <textarea
                    rows={2}
                    value={inspectNotes}
                    onChange={(e) => setInspectNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white resize-none"
                  />
                </div>

                {inspectError && (
                  <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{inspectError}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-800">
                <button
                  onClick={() => setShowInspectModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmInspect}
                  disabled={submittingInspect}
                  className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition disabled:opacity-50"
                >
                  {submittingInspect ? 'Saving...' : 'Release for Handover'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PRODUCTION SHEET PRINT MODAL */}
        {showTechSheet && techSheetProgram && (
          <ProductionSheetPrintModal
            isOpen={true}
            program={techSheetProgram}
            onClose={() => {
              setShowTechSheet(false);
              setTechSheetProgram(null);
            }}
          />
        )}
      </main>
    </div>
  );
}

export default function FinishingWorkstationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-teal-400">
          <RefreshCw className="w-8 h-8 animate-spin" />
        </div>
      }
    >
      <FinishingWorkstationContent />
    </Suspense>
  );
}
