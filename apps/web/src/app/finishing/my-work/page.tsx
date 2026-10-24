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
} from 'lucide-react';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';

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
  const [completeDefectReason, setCompleteDefectReason] = useState('Fabric cut / scissor nip');
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
    setCompleteDefectReason('Fabric cut / scissor nip');
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
      className="min-h-screen text-neutral-900 flex flex-col"
      
    >
      {/* HEADER */}
      <header className="border-b border-neutral-200 bg-white backdrop-blur-md px-6 py-4 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-600 shadow-inner">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-neutral-900 flex items-center gap-2">
                Finishing Floor & Workstation
              </h1>
              <p className="text-xs text-neutral-500">
                Live queue, station allocation, trimming, spot cleaning, pressing, and output accounting
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadJobs()}
              disabled={loading}
              className="p-2 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-700 hover:text-neutral-900 transition disabled:opacity-50"
              title="Refresh Queue"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-600' : ''}`} />
            </button>
            <Link
              href="/finishing/issue-challan"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm transition"
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
          <div className="p-3 bg-danger-500/10 border border-danger-500/30 rounded-xl flex items-center gap-3 text-danger-600 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* MAIN DUAL-PANE CONTAINER */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6 flex flex-col lg:flex-row gap-6">
        {/* LEFT PANE: JOBS LIST */}
        <div className="w-full lg:w-5/12 flex flex-col space-y-4">
          {/* SEARCH & FILTER TABS */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-3.5 space-y-3 backdrop-blur-xs">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-500" />
              <input
                type="text"
                placeholder="Search style, program, challan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-neutral-200 rounded-lg text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-brand-500"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] scrollbar-none">
              <button
                onClick={() => setActiveTab('ALL')}
                className={`px-2.5 py-1.5 rounded-lg font-semibold shrink-0 transition ${
                  activeTab === 'ALL'
                    ? 'bg-brand-500/20 text-brand-600 border border-brand-500/40'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                All ({jobs.length})
              </button>
              <button
                onClick={() => setActiveTab('READY_TO_START')}
                className={`px-2.5 py-1.5 rounded-lg font-semibold shrink-0 transition ${
                  activeTab === 'READY_TO_START'
                    ? 'bg-accent-400/20 text-accent-700 border border-accent-500/40'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                Queue ({jobs.filter((j) => j.status === 'RECEIVED').length})
              </button>
              <button
                onClick={() => setActiveTab('IN_PROGRESS')}
                className={`px-2.5 py-1.5 rounded-lg font-semibold shrink-0 transition ${
                  activeTab === 'IN_PROGRESS'
                    ? 'bg-brand-500/20 text-brand-600 border border-brand-500/40'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                In Finishing ({jobs.filter((j) => j.status === 'IN_PROCESS' || j.status === 'ON_HOLD').length})
              </button>
              <button
                onClick={() => setActiveTab('INSPECTION')}
                className={`px-2.5 py-1.5 rounded-lg font-semibold shrink-0 transition ${
                  activeTab === 'INSPECTION'
                    ? 'bg-brand-500/20 text-brand-600 border border-brand-500/40'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                Inspection ({jobs.filter((j) => j.status === 'COMPLETED').length})
              </button>
              <button
                onClick={() => setActiveTab('READY_FOR_HANDOVER')}
                className={`px-2.5 py-1.5 rounded-lg font-semibold shrink-0 transition ${
                  activeTab === 'READY_FOR_HANDOVER'
                    ? 'bg-accent-400/20 text-accent-700 border border-accent-500/40'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                Ready ({jobs.filter((j) => j.status === 'READY_FOR_HANDOVER').length})
              </button>
            </div>
          </div>

          {/* JOB CARDS SCROLLABLE */}
          <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[calc(100vh-250px)] pr-1">
            {loading ? (
              <div className="py-20 text-center text-neutral-500 text-xs flex flex-col items-center">
                <RefreshCw className="w-6 h-6 animate-spin text-brand-600 mb-2" />
                <span>Loading queue...</span>
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="bg-white border border-neutral-200 rounded-2xl p-8 text-center text-neutral-500 text-xs">
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
                        ? 'bg-brand-50 border-brand-500/80 shadow-sm ring-1 ring-brand-500/30'
                        : 'bg-white border-neutral-200 hover:border-neutral-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-neutral-900">
                        {job.challanNumber}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                          job.status === 'RECEIVED'
                            ? 'bg-accent-400/20 text-accent-700 border border-accent-500/40'
                            : job.status === 'IN_PROCESS'
                            ? 'bg-brand-500/20 text-brand-600 border border-brand-500/40'
                            : job.status === 'COMPLETED'
                            ? 'bg-brand-500/20 text-brand-600 border border-brand-500/40'
                            : job.status === 'READY_FOR_HANDOVER'
                            ? 'bg-accent-400/20 text-accent-700 border border-accent-500/40'
                            : job.status === 'ON_HOLD'
                            ? 'bg-danger-500/20 text-danger-600 border border-danger-500/40'
                            : 'bg-neutral-100 text-neutral-700'
                        }`}
                      >
                        {job.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="text-xs text-neutral-700 font-semibold flex items-center justify-between">
                      <span>{job.program?.styleCode || 'Standard Style'}</span>
                      <span className="text-[11px] font-mono text-neutral-500">
                        {job.program?.programNumber || 'N/A'}
                      </span>
                    </div>

                    <div className="text-[11px] text-neutral-500 flex items-center justify-between pt-1 border-t border-neutral-200">
                      <span>
                        Bundle: <strong className="text-neutral-900 font-mono">{totalPieces} pcs</strong>
                      </span>
                      {job.fabricOut ? (
                        <span className="text-accent-700 font-semibold font-mono">
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
            <div className="bg-white border border-neutral-200 rounded-2xl p-12 text-center text-neutral-500 backdrop-blur-xs flex flex-col items-center justify-center min-h-[400px]">
              <Sparkles className="w-12 h-12 text-neutral-600 mb-3" />
              <h3 className="text-base font-bold text-neutral-900">Select a Finishing Job</h3>
              <p className="text-xs text-neutral-500 max-w-sm mt-1">
                Choose a job from the left panel to inspect specifications, assign workstations, record finished counts, or issue outgoing challans.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-6 backdrop-blur-xs">
              {/* TOP SUMMARY BAR */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-neutral-200 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-bold text-neutral-900">
                      {selectedJob.challanNumber}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        selectedJob.status === 'RECEIVED'
                          ? 'bg-accent-400/20 text-accent-700 border border-accent-500/40'
                          : selectedJob.status === 'IN_PROCESS'
                          ? 'bg-brand-500/20 text-brand-600 border border-brand-500/40'
                          : selectedJob.status === 'COMPLETED'
                          ? 'bg-brand-500/20 text-brand-600 border border-brand-500/40'
                          : selectedJob.status === 'READY_FOR_HANDOVER'
                          ? 'bg-accent-400/20 text-accent-700 border border-accent-500/40'
                          : selectedJob.status === 'ON_HOLD'
                          ? 'bg-danger-500/20 text-danger-600 border border-danger-500/40'
                          : 'bg-neutral-100 text-neutral-700'
                      }`}
                    >
                      {selectedJob.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Transferred from: <strong className="text-neutral-700">{selectedJob.fromDepartment || 'STITCHING'}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {selectedJob.program && (
                    <button
                      onClick={() => {
                        setTechSheetProgram(selectedJob.program);
                        setShowTechSheet(true);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-900 text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                      <FileText className="w-3.5 h-3.5 text-brand-600" />
                      <span>Production Sheet</span>
                    </button>
                  )}

                  <Link
                    href={`/finishing/workspace/${selectedJob.id}`}
                    className="px-3 py-1.5 rounded-lg bg-brand-500/30 hover:bg-brand-500/50 text-brand-800 border border-brand-500/40 text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    <span>Focus Mode</span>
                  </Link>
                </div>
              </div>

              {/* SPECIFICATION CARD */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-neutral-200 text-xs">
                <div>
                  <span className="text-neutral-500 block text-[10px]">PROGRAM</span>
                  <span className="font-mono font-bold text-neutral-900">
                    {selectedJob.program?.programNumber || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[10px]">STYLE CODE</span>
                  <span className="font-bold text-brand-600">
                    {selectedJob.program?.styleCode || 'Standard'}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[10px]">BUYER / CLIENT</span>
                  <span className="text-neutral-900 truncate block">
                    {selectedJob.program?.buyerName || selectedJob.program?.clientName || 'Direct'}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[10px]">BUNDLE PIECES</span>
                  <span className="font-mono font-bold text-neutral-900 text-sm">
                    {selectedJob.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0)} PCS
                  </span>
                </div>
              </div>

              {/* ITEMS BREAKDOWN */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-neutral-700 tracking-wide uppercase">
                  Bundle Garments Breakdown
                </h4>
                <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-neutral-200 text-neutral-500 font-semibold">
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3">Color</th>
                        <th className="py-2.5 px-3 text-right">Quantity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 text-neutral-700">
                      {selectedJob.items.map((it: any) => (
                        <tr key={it.id}>
                          <td className="py-2 px-3 font-medium text-neutral-900">{it.itemDescription}</td>
                          <td className="py-2 px-3 text-neutral-500">{it.colour || 'Standard'}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-neutral-900">
                            {it.quantity} {it.uom || 'PCS'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* OPERATION ACTIONS BAR */}
              <div className="p-4 bg-white border border-neutral-200 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-neutral-700 tracking-wide uppercase">
                  Finishing Operation Controls
                </h4>

                <div className="flex items-center gap-3 flex-wrap">
                  {selectedJob.status === 'RECEIVED' && (
                    <button
                      onClick={() => openStartModal(selectedJob)}
                      className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm transition flex items-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Start Finishing & Assign Table</span>
                    </button>
                  )}

                  {selectedJob.status === 'IN_PROCESS' && (
                    <>
                      <button
                        onClick={() => openCompleteModal(selectedJob)}
                        className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm transition flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Record Finishing Output</span>
                      </button>

                      <button
                        onClick={() => handlePauseJob(selectedJob)}
                        disabled={submittingPause}
                        className="px-3.5 py-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-accent-700 border border-accent-500/30 text-xs font-semibold transition flex items-center gap-2"
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
                      className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm transition flex items-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      <span>Resume Finishing</span>
                    </button>
                  )}

                  {selectedJob.status === 'COMPLETED' && (
                    <button
                      onClick={() => openInspectModal(selectedJob)}
                      className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm transition flex items-center gap-2"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Perform Quality Audit & Release</span>
                    </button>
                  )}

                  {selectedJob.status === 'READY_FOR_HANDOVER' && (
                    <Link
                      href={`/finishing/issue-challan?jobId=${selectedJob.id}`}
                      className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm transition flex items-center gap-2"
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
                  <h4 className="text-xs font-bold text-neutral-500 tracking-wide uppercase">
                    Audit Trail & Events
                  </h4>
                  <div className="space-y-1.5 text-[11px] text-neutral-500">
                    {selectedJob.events.slice(0, 5).map((ev: any) => (
                      <div
                        key={ev.id}
                        className="p-2 rounded-lg bg-white border border-neutral-200 flex items-center justify-between"
                      >
                        <span className="text-neutral-700 font-medium">
                          {ev.action}: {ev.notes}
                        </span>
                        <span className="font-mono text-neutral-500 text-[10px]">
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

        {/* START FINISHING MODAL */}
        {showStartModal && (
          <div className="fixed inset-0 z-50 bg-neutral-900/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-neutral-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-brand-600" />
                  <h3 className="text-base font-bold text-neutral-900">Start Finishing Job</h3>
                </div>
                <button
                  onClick={() => setShowStartModal(false)}
                  className="p-1 rounded-lg text-neutral-500 hover:text-neutral-900"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Workstation / Table #</label>
                  <input
                    type="text"
                    value={workstationNumber}
                    onChange={(e) => setWorkstationNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-canvas border border-neutral-200 rounded-lg text-neutral-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Finishing Specialist / Trimmer</label>
                  <input
                    type="text"
                    value={operatorName}
                    onChange={(e) => setOperatorName(e.target.value)}
                    className="w-full px-3 py-2 bg-canvas border border-neutral-200 rounded-lg text-neutral-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Primary Operation</label>
                  <select
                    value={operationType}
                    onChange={(e) => setOperationType(e.target.value)}
                    className="w-full px-3 py-2 bg-canvas border border-neutral-200 rounded-lg text-neutral-900"
                  >
                    <option value="THREAD_TRIMMING_AND_CLEANING">Thread Trimming & Spot Cleaning</option>
                    <option value="FORM_PRESSING_AND_CREASE">Form Pressing & Crease Setting</option>
                    <option value="COMPLETE_GARMENT_FINISHING">Complete Garment Finishing (Trim + Clean + Press)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-neutral-200">
                <button
                  onClick={() => setShowStartModal(false)}
                  className="px-4 py-2 rounded-lg bg-neutral-100 text-neutral-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmStart}
                  disabled={submittingStart}
                  className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition disabled:opacity-50"
                >
                  {submittingStart ? 'Starting...' : 'Confirm & Begin'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* OUTPUT RECONCILIATION MODAL */}
        {showCompleteModal && (
          <div className="fixed inset-0 z-50 bg-neutral-900/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-neutral-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-brand-600" />
                  <h3 className="text-base font-bold text-neutral-900">Record Finishing Output</h3>
                </div>
                <button
                  onClick={() => setShowCompleteModal(false)}
                  className="p-1 rounded-lg text-neutral-500 hover:text-neutral-900"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="p-3 bg-white rounded-xl border border-neutral-200 flex justify-between">
                  <span className="text-neutral-500">Total Input Garments:</span>
                  <span className="font-mono font-bold text-neutral-900 text-sm">
                    {completeInputQty} PCS
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-accent-700 mb-1">
                      Good Finished Garments *
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={completeGoodQty}
                      onChange={(e) => setCompleteGoodQty(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-canvas border border-neutral-200 rounded-lg text-neutral-900 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-accent-700 mb-1">
                      Rework / Re-trim
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={completeReworkQty}
                      onChange={(e) => setCompleteReworkQty(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-canvas border border-neutral-200 rounded-lg text-neutral-900 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-danger-600 mb-1">
                      Reject / Scrap
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={completeRejectQty}
                      onChange={(e) => setCompleteRejectQty(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-canvas border border-neutral-200 rounded-lg text-neutral-900 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-neutral-500 mb-1">
                      Balance in Finishing
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={completeBalanceQty}
                      onChange={(e) => setCompleteBalanceQty(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-canvas border border-neutral-200 rounded-lg text-neutral-900 font-mono font-bold"
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
                      ? 'bg-accent-400/10 border-accent-500/30 text-accent-700'
                      : 'bg-danger-500/10 border-danger-500/30 text-danger-600'
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
                    <label className="block font-semibold text-danger-600 mb-1">
                      Reject Reason / Defect Classification
                    </label>
                    <select
                      value={completeDefectReason}
                      onChange={(e) => setCompleteDefectReason(e.target.value)}
                      className="w-full px-3 py-2 bg-canvas border border-neutral-200 rounded-lg text-neutral-900"
                    >
                      <option value="Fabric cut / scissor nip">Fabric cut / scissor nip</option>
                      <option value="Permanent chemical/oil stain">Permanent chemical/oil stain</option>
                      <option value="Iron scorch burn / glazed fabric">Iron scorch burn / glazed fabric</option>
                      <option value="Severe embroidery thread unravel">Severe embroidery thread unravel</option>
                    </select>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="autoInspectFinishing"
                    checked={autoInspect}
                    onChange={(e) => setAutoInspect(e.target.checked)}
                    className="rounded border-neutral-200 bg-canvas text-brand-600"
                  />
                  <label htmlFor="autoInspectFinishing" className="text-neutral-700">
                    Auto-pass Finishing QC (Ready for Handover directly)
                  </label>
                </div>

                {completeError && (
                  <div className="p-2.5 bg-danger-500/10 border border-danger-500/30 rounded-lg text-danger-600 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{completeError}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-neutral-200">
                <button
                  onClick={() => setShowCompleteModal(false)}
                  className="px-4 py-2 rounded-lg bg-neutral-100 text-neutral-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmComplete}
                  disabled={submittingComplete}
                  className="px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition disabled:opacity-50"
                >
                  {submittingComplete ? 'Saving...' : 'Confirm Output'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* QUALITY INSPECTION MODAL */}
        {showInspectModal && (
          <div className="fixed inset-0 z-50 bg-neutral-900/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-neutral-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-brand-600" />
                  <h3 className="text-base font-bold text-neutral-900">Finishing Quality Audit</h3>
                </div>
                <button
                  onClick={() => setShowInspectModal(false)}
                  className="p-1 rounded-lg text-neutral-500 hover:text-neutral-900"
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
                      className="flex items-center justify-between p-2.5 bg-white border border-neutral-200 rounded-lg"
                    >
                      <span className="text-neutral-700 font-medium">{item.label}</span>
                      <select
                        value={(inspectChecks as any)[item.key]}
                        onChange={(e) =>
                          setInspectChecks({ ...inspectChecks, [item.key]: e.target.value })
                        }
                        className="px-2 py-1 bg-white border border-neutral-200 rounded text-xs text-neutral-900"
                      >
                        <option value="PASS">PASS</option>
                        <option value="FAIL">FAIL</option>
                      </select>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Inspector Notes</label>
                  <textarea
                    rows={2}
                    value={inspectNotes}
                    onChange={(e) => setInspectNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-canvas border border-neutral-200 rounded-lg text-neutral-900 resize-none"
                  />
                </div>

                {inspectError && (
                  <div className="p-2.5 bg-danger-500/10 border border-danger-500/30 rounded-lg text-danger-600 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{inspectError}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-neutral-200">
                <button
                  onClick={() => setShowInspectModal(false)}
                  className="px-4 py-2 rounded-lg bg-neutral-100 text-neutral-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmInspect}
                  disabled={submittingInspect}
                  className="px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition disabled:opacity-50"
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
        <div className="min-h-screen bg-canvas flex items-center justify-center text-brand-600">
          <RefreshCw className="w-8 h-8 animate-spin" />
        </div>
      }
    >
      <FinishingWorkstationContent />
    </Suspense>
  );
}
