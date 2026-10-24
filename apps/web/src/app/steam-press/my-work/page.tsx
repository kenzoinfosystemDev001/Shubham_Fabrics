'use client';

import React, { useState, useEffect, Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Wind,
  Flame,
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
  Pause,
  Play,
  Maximize2,
  Archive,
} from 'lucide-react';
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';
import { DocumentActionButtons } from '@/components/common/DocumentActionButtons';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';
import { DepartmentDefectiveShelfWidget } from '@/components/DepartmentDefectiveShelfWidget';

function SteamPressWorkstationContent() {
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
  const [operatorName, setOperatorName] = useState('Steam Press Specialist');
  const [operationType, setOperationType] = useState('STEAM_PRESSING_STANDARD');

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
    creaseSharpness: 'PASS',
    shineGlazeCheck: 'PASS',
    wrinkleFree: 'PASS',
    moistureCheck: 'PASS',
    overallResult: 'PASS',
  });
  const [inspectNotes, setInspectNotes] = useState('Garments steam pressed cleanly, crisp creases, zero glaze or moisture.');

  // Pause / Resume states
  const [submittingPause, setSubmittingPause] = useState(false);
  const [submittingResume, setSubmittingResume] = useState(false);

  const loadJobs = async (selectId?: string) => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/steam-press/queue');
      if (!res.ok) throw new Error('Failed to load Steam Press jobs');
      const json = await res.json();
      const list = json.data || [];
      setJobs(list);

      const targetId = selectId || selectedJob?.id || initialJobId;
      if (targetId) {
        const found = list.find((j: any) => j.id === targetId);
        if (found) setSelectedJob(found);
        else if (list.length > 0) setSelectedJob(list[0]);
        else setSelectedJob(null);
      } else if (list.length > 0) {
        setSelectedJob(list[0]);
      } else {
        setSelectedJob(null);
      }
    } catch (err: any) {
      console.error('Error loading Steam Press jobs:', err);
      setError(err.message || 'Error connecting to server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, [initialJobId]);

  // Filter Jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      if (activeTab === 'QUEUE' && j.status !== 'RECEIVED') return false;
      if (activeTab === 'PRESSING' && j.status !== 'IN_PROCESS') return false;
      if (activeTab === 'COMPLETED' && j.status !== 'COMPLETED') return false;
      if (activeTab === 'READY' && j.status !== 'READY_FOR_HANDOVER') return false;
      if (activeTab === 'HOLD' && j.status !== 'ON_HOLD') return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const challanNum = (j.challanNumber || '').toLowerCase();
      const progNum = (j.program?.programNumber || '').toLowerCase();
      const style = (j.program?.styleCode || '').toLowerCase();
      const client = (j.program?.clientName || '').toLowerCase();
      return (
        challanNum.includes(q) ||
        progNum.includes(q) ||
        style.includes(q) ||
        client.includes(q)
      );
    });
  }, [jobs, activeTab, searchQuery]);

  const openStartModal = (job: any) => {
    setSelectedJob(job);
    setWorkstationNumber('Table 1');
    setOperatorName('Steam Press Specialist');
    setOperationType('STEAM_PRESSING_STANDARD');
    setShowStartModal(true);
  };

  const handleStartJob = async () => {
    if (!selectedJob) return;
    try {
      setSubmittingStart(true);
      const res = await fetch(`/api/steam-press/jobs/${selectedJob.id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workstationNumber,
          operatorName,
          operationType,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to start pressing job');

      setShowStartModal(false);
      await loadJobs(selectedJob.id);
    } catch (err: any) {
      alert(err.message || 'Error starting job');
    } finally {
      setSubmittingStart(false);
    }
  };

  const handlePauseJob = async () => {
    if (!selectedJob) return;
    const reason = prompt('Enter reason for pausing steam pressing (e.g. boiler maintenance, fabric clarification):');
    if (!reason) return;
    try {
      setSubmittingPause(true);
      const res = await fetch(`/api/steam-press/jobs/${selectedJob.id}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to pause job');
      await loadJobs(selectedJob.id);
    } catch (err: any) {
      alert(err.message || 'Error pausing job');
    } finally {
      setSubmittingPause(false);
    }
  };

  const handleResumeJob = async () => {
    if (!selectedJob) return;
    try {
      setSubmittingResume(true);
      const res = await fetch(`/api/steam-press/jobs/${selectedJob.id}/resume`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to resume job');
      await loadJobs(selectedJob.id);
    } catch (err: any) {
      alert(err.message || 'Error resuming job');
    } finally {
      setSubmittingResume(false);
    }
  };

  const openCompleteModal = (job: any) => {
    setSelectedJob(job);
    const totalInput =
      job.fabricIn ||
      job.items?.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0), 0) ||
      0;
    setCompleteInputQty(totalInput);
    setCompleteGoodQty(totalInput);
    setCompleteReworkQty(0);
    setCompleteRejectQty(0);
    setCompleteBalanceQty(0);
    setCompleteNotes('All pieces steam pressed to high standard and wrinkle-free.');
    setCompleteDefectReason('');
    setAutoInspect(true);
    setCompleteError('');
    setShowCompleteModal(true);
  };

  // Reconcile balance calculation
  const totalReconciled =
    Number(completeGoodQty) +
    Number(completeReworkQty) +
    Number(completeRejectQty) +
    Number(completeBalanceQty);
  const isCompleteBalanced = totalReconciled === Number(completeInputQty);

  const handleCompleteJob = async () => {
    if (!selectedJob) return;
    try {
      setSubmittingComplete(true);
      setCompleteError('');

      if (Number(completeGoodQty) < 0 || Number(completeReworkQty) < 0 || Number(completeRejectQty) < 0) {
        throw new Error('Quantities cannot be negative.');
      }

      if (!isCompleteBalanced) {
        throw new Error(
          `Reconciliation mismatch: Good (${completeGoodQty}) + Rework (${completeReworkQty}) + Reject (${completeRejectQty}) + Balance (${completeBalanceQty}) = ${totalReconciled} does not equal Input (${completeInputQty}).`
        );
      }

      const res = await fetch(`/api/steam-press/jobs/${selectedJob.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goodQuantity: Number(completeGoodQty),
          reworkQuantity: Number(completeReworkQty),
          rejectQuantity: Number(completeRejectQty),
          balanceQuantity: Number(completeBalanceQty),
          defectReason: Number(completeRejectQty) > 0 ? completeDefectReason : undefined,
          notes: completeNotes,
          autoInspect: autoInspect,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to complete steam pressing');

      setShowCompleteModal(false);
      await loadJobs(selectedJob.id);
    } catch (err: any) {
      setCompleteError(err.message || 'Error completing pressing');
    } finally {
      setSubmittingComplete(false);
    }
  };

  const openInspectModal = (job: any) => {
    setSelectedJob(job);
    setInspectChecks({
      creaseSharpness: 'PASS',
      shineGlazeCheck: 'PASS',
      wrinkleFree: 'PASS',
      moistureCheck: 'PASS',
      overallResult: 'PASS',
    });
    setInspectNotes('Creases sharp, fabric completely flat and wrinkle-free, zero glaze.');
    setInspectError('');
    setShowInspectModal(true);
  };

  const handleInspectJob = async () => {
    if (!selectedJob) return;
    try {
      setSubmittingInspect(true);
      setInspectError('');

      const res = await fetch(`/api/steam-press/jobs/${selectedJob.id}/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inspectionChecks: inspectChecks,
          notes: inspectNotes,
          overallResult: inspectChecks.overallResult,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to submit quality audit');

      setShowInspectModal(false);
      await loadJobs(selectedJob.id);
    } catch (err: any) {
      setInspectError(err.message || 'Error submitting audit');
    } finally {
      setSubmittingInspect(false);
    }
  };

  const openTechSheet = (program: any) => {
    setTechSheetProgram(program);
    setShowTechSheet(true);
  };

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
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
              <Wind className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Steam Press Workstation Floor
              </h1>
              <p className="text-xs text-slate-400">
                Execute high-temperature pressing, crease setting, moisture extraction, and hand over to Final QC
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab(activeTab === 'DEFECTIVE_SHELF' ? 'ALL' : 'DEFECTIVE_SHELF')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition border ${
                activeTab === 'DEFECTIVE_SHELF'
                  ? 'bg-rose-600 text-white border-rose-500 shadow-md'
                  : 'bg-slate-900 text-rose-300 hover:text-white hover:bg-slate-800 border-slate-700/80'
              }`}
            >
              <Archive className="w-4 h-4" />
              <span>{activeTab === 'DEFECTIVE_SHELF' ? 'Back to Pressing Floor' : 'Defective Shelf (DEF-SHELF-STEAM-PRESS)'}</span>
            </button>

            <button
              onClick={() => loadJobs()}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-300 hover:text-white transition disabled:opacity-50"
              title="Refresh Workstation"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            <Link
              href="/steam-press/issue-challan"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-900/30 transition"
            >
              <Send className="w-4 h-4" />
              <span>Issue Handover Challan</span>
            </Link>
          </div>
        </div>
      </header>

      {/* MAIN TWO-COLUMN WORKSTATION LAYOUT */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6 space-y-4">
        {/* TABS & SEARCH BAR */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-slate-900/60 border border-slate-800 rounded-xl p-3 backdrop-blur-xs">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto p-1 bg-slate-950/60 border border-slate-800 rounded-lg text-xs">
            {[
              { id: 'ALL', label: 'All Jobs', count: jobs.length },
              { id: 'QUEUE', label: 'Queue', count: jobs.filter((j) => j.status === 'RECEIVED').length },
              { id: 'PRESSING', label: 'Pressing', count: jobs.filter((j) => j.status === 'IN_PROCESS').length },
              { id: 'COMPLETED', label: 'Done', count: jobs.filter((j) => j.status === 'COMPLETED').length },
              { id: 'READY', label: 'Ready Handover', count: jobs.filter((j) => j.status === 'READY_FOR_HANDOVER').length },
              { id: 'HOLD', label: 'Hold', count: jobs.filter((j) => j.status === 'ON_HOLD').length },
              { id: 'DEFECTIVE_SHELF', label: 'Defective Shelf', count: undefined },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-2.5 py-1 rounded-md font-semibold whitespace-nowrap transition ${
                  activeTab === tab.id
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}{tab.count !== undefined ? ` (${tab.count})` : ''}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search challan, program, style, client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-lavender-400 transition"
            />
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* WORKSTATION GRID OR DEFECTIVE SHELF */}
        {activeTab === 'DEFECTIVE_SHELF' ? (
          <DepartmentDefectiveShelfWidget
            department="STEAM_PRESS"
            shelfCode="DEF-SHELF-STEAM-PRESS"
            accentColor="cyan"
          />
        ) : (
          /* WORKSTATION GRID: 1/3 LIST, 2/3 ACTIVE JOB DETAIL */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: JOB QUEUE LIST (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Active Queue ({filteredJobs.length})
              </span>
              <span className="text-[11px] text-slate-500">Select to inspect or process</span>
            </div>

            {loading ? (
              <div className="py-20 text-center text-slate-400 text-xs flex flex-col items-center justify-center bg-slate-900/40 rounded-xl border border-slate-800">
                <RefreshCw className="w-6 h-6 animate-spin text-cyan-400 mb-2" />
                <span>Loading pressing floor jobs...</span>
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs bg-slate-900/40 rounded-xl border border-slate-800">
                <Package className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p>No jobs found in this category.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[720px] overflow-y-auto pr-1">
                {filteredJobs.map((job) => {
                  const isSelected = selectedJob?.id === job.id;
                  const totalPcs =
                    job.fabricIn ||
                    job.items?.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0) ||
                    0;
                  const goodPcs = job.fabricOut ?? 0;

                  return (
                    <div
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between space-y-2.5 backdrop-blur-xs ${
                        isSelected
                          ? 'bg-slate-900/90 border-cyan-500 shadow-md shadow-cyan-950/50 ring-1 ring-cyan-500/50'
                          : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/70'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-mono text-xs font-bold text-cyan-300 block">
                            {job.challanNumber}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {job.program?.styleCode || 'Standard Style'}
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider ${
                            job.status === 'RECEIVED'
                              ? 'bg-teal-500/10 text-teal-300 border-teal-500/30'
                              : job.status === 'IN_PROCESS'
                              ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30 animate-pulse'
                              : job.status === 'COMPLETED' || job.status === 'READY_FOR_HANDOVER'
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                              : job.status === 'ON_HOLD'
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          {job.status.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-300 bg-slate-950/50 px-2.5 py-1.5 rounded-lg border border-slate-800/60">
                        <span className="text-[11px] text-slate-400">
                          Prog: <span className="font-mono font-bold text-white">{job.program?.programNumber || 'N/A'}</span>
                        </span>
                        <span className="font-mono font-bold text-cyan-300 text-xs">
                          {goodPcs > 0 ? `${goodPcs} / ` : ''}{totalPcs} PCS
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT: SELECTED JOB DETAILS & WORKSPACE CONTROLS (7 cols) */}
          <div className="lg:col-span-7">
            {selectedJob ? (
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-md space-y-6 shadow-xl">
                {/* Header: Challan and Action Buttons */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-lg font-bold text-cyan-300">
                        {selectedJob.challanNumber}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${
                          selectedJob.status === 'RECEIVED'
                            ? 'bg-teal-500/10 text-teal-300 border-teal-500/30'
                            : selectedJob.status === 'IN_PROCESS'
                            ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                            : selectedJob.status === 'COMPLETED' || selectedJob.status === 'READY_FOR_HANDOVER'
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }`}
                      >
                        {selectedJob.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 mt-1 block">
                      Received from{' '}
                      <span className="text-slate-200 font-semibold">{selectedJob.fromDepartment || 'FINISHING'}</span> on{' '}
                      {new Date(selectedJob.updatedAt || selectedJob.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Production Sheet + the challan received from the previous department */}
                    <DocumentActionButtons program={selectedJob.program} challan={selectedJob} size="sm" />

                    {/* Dedicated Focus Workspace Link */}
                    <Link
                      href={`/steam-press/workspace/${selectedJob.id}`}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold border border-cyan-500/40 transition flex items-center gap-1.5 shadow-sm"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Focus Mode</span>
                    </Link>
                  </div>
                </div>

                {/* SPECIFICATION CARD */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Program Number:</span>
                    <span className="font-mono font-bold text-white text-xs">
                      {selectedJob.program?.programNumber || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Style Code:</span>
                    <span className="font-bold text-cyan-300 text-xs">
                      {selectedJob.program?.styleCode || 'Standard'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Design Number:</span>
                    <span className="text-slate-200 text-xs">
                      {selectedJob.program?.designNumber || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Client / Buyer:</span>
                    <span className="text-slate-200 text-xs truncate block">
                      {selectedJob.program?.clientName || 'Standard Client'}
                    </span>
                  </div>
                </div>

                {/* QUANTITY RECONCILIATION SUMMARY */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                    <span className="text-[10px] text-slate-400 block">Input Received</span>
                    <span className="font-mono text-lg font-bold text-white">
                      {selectedJob.fabricIn ||
                        selectedJob.items?.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0) ||
                        0}{' '}
                      <span className="text-xs font-normal text-slate-400">PCS</span>
                    </span>
                  </div>
                  <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-3">
                    <span className="text-[10px] text-emerald-400 block">Good Pressed</span>
                    <span className="font-mono text-lg font-bold text-emerald-300">
                      {selectedJob.fabricOut ?? 0}{' '}
                      <span className="text-xs font-normal text-slate-400">PCS</span>
                    </span>
                  </div>
                  <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-3">
                    <span className="text-[10px] text-amber-400 block">Re-press Rework</span>
                    <span className="font-mono text-lg font-bold text-amber-300">
                      {selectedJob.reworkQty ?? 0}{' '}
                      <span className="text-xs font-normal text-slate-400">PCS</span>
                    </span>
                  </div>
                  <div className="bg-rose-950/20 border border-rose-800/40 rounded-xl p-3">
                    <span className="text-[10px] text-rose-400 block">Scorch Scrap</span>
                    <span className="font-mono text-lg font-bold text-rose-300">
                      {selectedJob.rejectQty ?? 0}{' '}
                      <span className="text-xs font-normal text-slate-400">PCS</span>
                    </span>
                  </div>
                </div>

                {/* WORKFLOW STAGE ACTIONS */}
                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
                  <span className="text-xs font-semibold text-slate-300 block uppercase tracking-wider">
                    Station Controls & Workflow Transition:
                  </span>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* If RECEIVED: Button to Start Pressing */}
                    {selectedJob.status === 'RECEIVED' && (
                      <button
                        onClick={() => openStartModal(selectedJob)}
                        className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-900/30 transition flex items-center gap-2"
                      >
                        <Flame className="w-4 h-4" />
                        <span>Start Pressing (Allocate Table)</span>
                      </button>
                    )}

                    {/* If IN_PROCESS: Complete or Pause */}
                    {selectedJob.status === 'IN_PROCESS' && (
                      <>
                        <button
                          onClick={() => openCompleteModal(selectedJob)}
                          className="px-4 py-2 rounded-lg bg-lavender-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-900/30 transition flex items-center gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Reconcile & Complete</span>
                        </button>

                        <button
                          onClick={handlePauseJob}
                          disabled={submittingPause}
                          className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold border border-amber-500/30 transition flex items-center gap-1.5"
                        >
                          <Pause className="w-4 h-4" />
                          <span>Pause Job</span>
                        </button>
                      </>
                    )}

                    {/* If ON_HOLD: Resume */}
                    {selectedJob.status === 'ON_HOLD' && (
                      <button
                        onClick={handleResumeJob}
                        disabled={submittingResume}
                        className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-900/30 transition flex items-center gap-2"
                      >
                        <Play className="w-4 h-4" />
                        <span>Resume Pressing</span>
                      </button>
                    )}

                    {/* If COMPLETED: Quality Audit */}
                    {selectedJob.status === 'COMPLETED' && (
                      <button
                        onClick={() => openInspectModal(selectedJob)}
                        className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-md shadow-teal-900/30 transition flex items-center gap-2"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Quality & Appearance Audit</span>
                      </button>
                    )}

                    {/* If READY_FOR_HANDOVER or COMPLETED: Issue Challan */}
                    {(selectedJob.status === 'READY_FOR_HANDOVER' || selectedJob.status === 'COMPLETED') && (
                      <Link
                        href={`/steam-press/issue-challan?jobId=${selectedJob.id}`}
                        className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-900/30 transition flex items-center gap-2"
                      >
                        <Send className="w-4 h-4" />
                        <span>Issue Handover Challan to Final QC</span>
                      </Link>
                    )}
                  </div>
                </div>

                {/* ACTIVITY LOG & EVENTS */}
                {selectedJob.events && selectedJob.events.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-800/80">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Recent Activity & Audit Trail:
                    </span>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {selectedJob.events.map((ev: any) => (
                        <div
                          key={ev.id}
                          className="flex items-start justify-between bg-slate-950/40 p-2 rounded-lg border border-slate-800/50 text-[11px]"
                        >
                          <div>
                            <span className="font-semibold text-slate-300 mr-2">{ev.action}</span>
                            <span className="text-slate-400">{ev.details || ''}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 whitespace-nowrap">
                            {new Date(ev.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-16 text-center text-slate-400">
                <Wind className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white mb-1">No Job Selected</h3>
                <p className="text-xs text-slate-400">
                  Select a job card from the left panel to inspect specifications or execute pressing.
                </p>
              </div>
            )}
          </div>
        </div>
        )}

        {/* START / ALLOCATION MODAL */}
        {showStartModal && selectedJob && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-base font-bold text-white">Start Steam Pressing</h3>
                </div>
                <button
                  onClick={() => setShowStartModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Pressing Table / Station ID
                  </label>
                  <input
                    type="text"
                    value={workstationNumber}
                    onChange={(e) => setWorkstationNumber(e.target.value)}
                    placeholder="e.g. Table 1, Table 2, Vacuum Station A"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-lavender-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Operator / Presser Name
                  </label>
                  <input
                    type="text"
                    value={operatorName}
                    onChange={(e) => setOperatorName(e.target.value)}
                    placeholder="e.g. Steam Press Specialist"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-lavender-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Pressing Operation Type
                  </label>
                  <select
                    value={operationType}
                    onChange={(e) => setOperationType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-lavender-400"
                  >
                    <option value="STEAM_PRESSING_STANDARD">Standard Steam Pressing & Vacuum Extract</option>
                    <option value="STEAM_PRESSING_HEAVY">Heavy Fabric Crease Setting</option>
                    <option value="DELICATE_EMBROIDERY_PRESS">Delicate Embroidery & Sequin Press</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-800">
                <button
                  onClick={() => setShowStartModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartJob}
                  disabled={submittingStart}
                  className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-900/30 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Flame className="w-4 h-4" />
                  <span>{submittingStart ? 'Starting...' : 'Confirm & Start'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* OUTPUT RECONCILIATION MODAL */}
        {showCompleteModal && selectedJob && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-base font-bold text-white">Pressing Output Reconciliation</h3>
                </div>
                <button
                  onClick={() => setShowCompleteModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Quantities Form */}
              <div className="space-y-3">
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Total Input Quantity:</span>
                  <span className="font-mono font-bold text-white text-sm">{completeInputQty} PCS</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-emerald-400 mb-1">
                      Good Pressed (PCS) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={completeGoodQty}
                      onChange={(e) => setCompleteGoodQty(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/40 rounded-lg text-xs text-white font-mono font-bold focus:outline-none focus:border-lavender-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-amber-400 mb-1">
                      Re-press Rework (PCS)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={completeReworkQty}
                      onChange={(e) => setCompleteReworkQty(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-950 border border-amber-500/40 rounded-lg text-xs text-white font-mono font-bold focus:outline-none focus:border-lavender-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-rose-400 mb-1">
                      Scorch / Glaze Scrap (PCS)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={completeRejectQty}
                      onChange={(e) => setCompleteRejectQty(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-950 border border-rose-500/40 rounded-lg text-xs text-white font-mono font-bold focus:outline-none focus:border-lavender-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      WIP Balance Remaining
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={completeBalanceQty}
                      onChange={(e) => setCompleteBalanceQty(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono font-bold focus:outline-none focus:border-lavender-400"
                    />
                  </div>
                </div>

                {/* Reconciliation balance indicator */}
                <div
                  className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                    isCompleteBalanced
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  <span>Reconciled Sum: {totalReconciled} / {completeInputQty} PCS</span>
                  <span className="font-bold">
                    {isCompleteBalanced ? '✓ 100% Balanced' : `⚠ Discrepancy (${totalReconciled - completeInputQty})`}
                  </span>
                </div>

                {Number(completeRejectQty) > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-rose-300 mb-1">
                      Scrap / Defect Primary Reason
                    </label>
                    <input
                      type="text"
                      list="steam-press-completion-defect-reasons"
                      value={completeDefectReason}
                      onChange={(e) => setCompleteDefectReason(e.target.value)}
                      required={Number(completeRejectQty) > 0}
                      placeholder="Enter the actual defect reason"
                      className="w-full px-3 py-2 bg-slate-950 border border-rose-500/40 rounded-lg text-xs text-white focus:outline-none focus:border-lavender-400"
                    />
                    <datalist id="steam-press-completion-defect-reasons">
                      <option value="Scorch mark / glaze shine" />
                      <option value="Melted embroidery / sequin deformation" />
                      <option value="Water drip mineral stain" />
                      <option value="Wrinkle set / permanent fold defect" />
                    </datalist>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Pressing Notes / Summary
                  </label>
                  <textarea
                    rows={2}
                    value={completeNotes}
                    onChange={(e) => setCompleteNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-lavender-400 resize-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="autoInspect"
                    checked={autoInspect}
                    onChange={(e) => setAutoInspect(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-0"
                  />
                  <label htmlFor="autoInspect" className="text-xs text-slate-300">
                    Auto-advance to Ready for Handover (Quality Verified)
                  </label>
                </div>

                {completeError && (
                  <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{completeError}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-800">
                <button
                  onClick={() => setShowCompleteModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCompleteJob}
                  disabled={submittingComplete || !isCompleteBalanced}
                  className="px-5 py-2 rounded-lg bg-lavender-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-900/30 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{submittingComplete ? 'Saving...' : 'Confirm Output'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* QUALITY INSPECTION MODAL */}
        {showInspectModal && selectedJob && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-teal-400" />
                  <h3 className="text-base font-bold text-white">Quality & Appearance Audit</h3>
                </div>
                <button
                  onClick={() => setShowInspectModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="space-y-2">
                  {[
                    { key: 'creaseSharpness', label: 'Crease Sharpness & Alignment' },
                    { key: 'shineGlazeCheck', label: 'Zero Shine / Scorch Glaze' },
                    { key: 'wrinkleFree', label: 'Wrinkle-Free Smooth Body' },
                    { key: 'moistureCheck', label: 'Dryness & Zero Residual Dampness' },
                  ].map((chk) => (
                    <div
                      key={chk.key}
                      className="flex items-center justify-between p-2.5 bg-slate-950/60 rounded-lg border border-slate-800"
                    >
                      <span className="text-slate-300 font-medium">{chk.label}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setInspectChecks((prev) => ({ ...prev, [chk.key]: 'PASS' }))}
                          className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                            (inspectChecks as any)[chk.key] === 'PASS'
                              ? 'bg-lavender-600 text-white'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          PASS
                        </button>
                        <button
                          type="button"
                          onClick={() => setInspectChecks((prev) => ({ ...prev, [chk.key]: 'FAIL' }))}
                          className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                            (inspectChecks as any)[chk.key] === 'FAIL'
                              ? 'bg-rose-600 text-white'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          FAIL
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Inspection Remarks
                  </label>
                  <textarea
                    rows={2}
                    value={inspectNotes}
                    onChange={(e) => setInspectNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-lavender-400 resize-none"
                  />
                </div>

                {inspectError && (
                  <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{inspectError}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-800">
                <button
                  onClick={() => setShowInspectModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInspectJob}
                  disabled={submittingInspect}
                  className="px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-md shadow-teal-900/30 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{submittingInspect ? 'Saving...' : 'Authorize Release'}</span>
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

export default function SteamPressWorkstationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">
          <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
        </div>
      }
    >
      <SteamPressWorkstationContent />
    </Suspense>
  );
}
