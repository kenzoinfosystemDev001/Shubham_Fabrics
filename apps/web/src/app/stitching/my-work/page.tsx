'use client';

import React, { useState, useEffect, Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Shirt,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  ArrowRight,
  ShieldCheck,
  Send,
  Sparkles,
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
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';

function StitchingWorkstationContent() {
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
  const [lineNumber, setLineNumber] = useState('Line 1');
  const [machineNumber, setMachineNumber] = useState('M-01');
  const [operatorName, setOperatorName] = useState('Stitching Operator');

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
  const [completeDefectReason, setCompleteDefectReason] = useState('Sewing needle cut / seam slippage');
  const [autoInspect, setAutoInspect] = useState(false);

  // Quality Inspection Modal
  const [showInspectModal, setShowInspectModal] = useState(false);
  const [submittingInspect, setSubmittingInspect] = useState(false);
  const [inspectError, setInspectError] = useState('');
  const [inspectChecks, setInspectChecks] = useState({
    seamStrength: 'PASS',
    spiCheck: 'PASS',
    tensionCheck: 'PASS',
    fitCheck: 'PASS',
    motifSymmetry: 'PASS',
    overallResult: 'PASS',
  });
  const [inspectNotes, setInspectNotes] = useState('All seam allowances, stitches per inch, and motif placement verified.');

  // Pause / Resume states
  const [submittingPause, setSubmittingPause] = useState(false);
  const [submittingResume, setSubmittingResume] = useState(false);

  const loadJobs = async (selectId?: string) => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/stitching/queue');
      if (!res.ok) throw new Error('Failed to load stitching jobs');
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
      console.error('Error loading stitching jobs:', err);
      setError(err.message || 'Error connecting to server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs(initialJobId || undefined);
    const interval = setInterval(() => {
      fetch('/api/stitching/queue')
        .then((r) => r.json())
        .then((json) => {
          if (json.data) {
            setJobs(json.data);
            if (selectedJob) {
              const updated = json.data.find((j: any) => j.id === selectedJob.id);
              if (updated) setSelectedJob(updated);
            }
          }
        })
        .catch(() => {});
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const totalInputOfSelected = useMemo(() => {
    if (!selectedJob) return 0;
    return selectedJob.fabricIn || selectedJob.items?.reduce(
      (sum: number, it: any) => sum + (Number(it.quantity) || 0),
      0
    ) || 0;
  }, [selectedJob]);

  // Open Start Modal
  const openStartModal = () => {
    setShowStartModal(true);
  };

  const handleStartSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;
    try {
      setSubmittingStart(true);
      const res = await fetch(`/api/stitching/jobs/${selectedJob.id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineNumber,
          machineNumber,
          operatorName,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to start stitching job');

      setShowStartModal(false);
      await loadJobs(selectedJob.id);
    } catch (err: any) {
      alert(err.message || 'Failed to start stitching');
    } finally {
      setSubmittingStart(false);
    }
  };

  // Handle Pause
  const handlePause = async () => {
    if (!selectedJob) return;
    const reason = prompt('Please specify pause reason (e.g., Thread break, Line maintenance, Break):', 'Break / Needle adjustment');
    if (!reason) return;
    try {
      setSubmittingPause(true);
      const res = await fetch(`/api/stitching/jobs/${selectedJob.id}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to pause stitching job');
      await loadJobs(selectedJob.id);
    } catch (err: any) {
      alert(err.message || 'Failed to pause job');
    } finally {
      setSubmittingPause(false);
    }
  };

  // Handle Resume
  const handleResume = async () => {
    if (!selectedJob) return;
    try {
      setSubmittingResume(true);
      const res = await fetch(`/api/stitching/jobs/${selectedJob.id}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to resume stitching job');
      await loadJobs(selectedJob.id);
    } catch (err: any) {
      alert(err.message || 'Failed to resume job');
    } finally {
      setSubmittingResume(false);
    }
  };

  // Open Complete Modal
  const openCompleteModal = () => {
    if (!selectedJob) return;
    const input = totalInputOfSelected;
    setCompleteInputQty(input);
    setCompleteGoodQty(input);
    setCompleteReworkQty(0);
    setCompleteRejectQty(0);
    setCompleteBalanceQty(0);
    setCompleteNotes('Assembly completed according to technical specifications and size chart.');
    setAutoInspect(false);
    setCompleteError('');
    setShowCompleteModal(true);
  };

  // Math reconciliation check: Input = Good + Rework + Reject + Balance
  const reconciledSum =
    Number(completeGoodQty) +
    Number(completeReworkQty) +
    Number(completeRejectQty) +
    Number(completeBalanceQty);
  const reconciliationDiff = Number(completeInputQty) - reconciledSum;
  const isBalanced = reconciliationDiff === 0 && Number(completeGoodQty) >= 0;

  // Submit Complete
  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    if (!isBalanced) {
      setCompleteError(
        `Quantity imbalance detected. Input (${completeInputQty}) must exactly equal Good (${completeGoodQty}) + Re-stitch (${completeReworkQty}) + Scrap (${completeRejectQty}) + Balance (${completeBalanceQty}). Difference: ${reconciliationDiff}`
      );
      return;
    }

    try {
      setSubmittingComplete(true);
      setCompleteError('');

      const res = await fetch(`/api/stitching/jobs/${selectedJob.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputQuantity: completeInputQty,
          goodQuantity: completeGoodQty,
          reworkQuantity: completeReworkQty,
          rejectQuantity: completeRejectQty,
          balanceQuantity: completeBalanceQty,
          operatorNotes: completeNotes,
          defectReason: completeRejectQty > 0 ? completeDefectReason : undefined,
          autoInspect: autoInspect,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to complete stitching job');

      setShowCompleteModal(false);
      await loadJobs(selectedJob.id);
    } catch (err: any) {
      setCompleteError(err.message || 'Failed to record completion');
    } finally {
      setSubmittingComplete(false);
    }
  };

  // Open Quality Inspect Modal
  const openInspectModal = () => {
    if (!selectedJob) return;
    setInspectChecks({
      seamStrength: 'PASS',
      spiCheck: 'PASS',
      tensionCheck: 'PASS',
      fitCheck: 'PASS',
      motifSymmetry: 'PASS',
      overallResult: 'PASS',
    });
    setInspectNotes('In-line & End-line inspection completed. Seam strength, SPI 10-12, and symmetry meet QA standard.');
    setInspectError('');
    setShowInspectModal(true);
  };

  // Submit Quality Inspection
  const handleInspectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    try {
      setSubmittingInspect(true);
      setInspectError('');

      const res = await fetch(`/api/stitching/jobs/${selectedJob.id}/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...inspectChecks,
          notes: inspectNotes,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to record inspection');

      setShowInspectModal(false);
      await loadJobs(selectedJob.id);
    } catch (err: any) {
      setInspectError(err.message || 'Failed to record inspection');
    } finally {
      setSubmittingInspect(false);
    }
  };

  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      if (activeTab === 'RECEIVED' && j.status !== 'RECEIVED') return false;
      if (activeTab === 'IN_PROCESS' && j.status !== 'IN_PROCESS') return false;
      if (activeTab === 'COMPLETED' && j.status !== 'COMPLETED') return false;
      if (activeTab === 'READY_FOR_HANDOVER' && (j.status !== 'READY_FOR_HANDOVER' && j.status !== 'READY_FOR_FINISHING')) return false;
      if (activeTab === 'ON_HOLD' && j.status !== 'ON_HOLD') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNumber = j.challanNumber?.toLowerCase().includes(q);
        const matchProgram = j.program?.programNumber?.toLowerCase().includes(q);
        const matchStyle = j.program?.styleCode?.toLowerCase().includes(q);
        const matchClient = j.program?.clientName?.toLowerCase().includes(q);
        return matchNumber || matchProgram || matchStyle || matchClient;
      }
      return true;
    });
  }, [jobs, activeTab, searchQuery]);

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col">
      {/* HEADER HERO */}
      <div
        style={{
          backgroundImage: `linear-gradient(to right, rgba(15, 23, 42, 0.95), rgba(15, 23, 42, 0.85)), url('${DEPARTMENT_NAV_BG_IMAGE}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        className="border-b border-slate-800 p-6 shadow-md"
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
              <Shirt className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white">Stitching Floor Workstation</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Line Allocation, Real-time Garment Assembly, End-line Quality Inspection & Downstream Transfer
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadJobs(selectedJob?.id)}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700 disabled:opacity-50"
              title="Refresh Work Queue"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <Link
              href="/stitching/issue-challan"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-md"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Issue Handover Challan</span>
            </Link>
          </div>
        </div>
      </div>

      {/* WORKSTATION DUAL PANEL */}
      <div className="max-w-7xl mx-auto w-full p-4 md:p-6 flex-1 flex flex-col lg:flex-row gap-6">
        {/* LEFT COLUMN: JOB QUEUE */}
        <div className="w-full lg:w-96 flex flex-col gap-3 shrink-0">
          {/* SEARCH & STATUS TABS */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search style, program, challan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex flex-wrap gap-1">
              {['ALL', 'RECEIVED', 'IN_PROCESS', 'COMPLETED', 'READY_FOR_HANDOVER'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition ${
                    activeTab === tab
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  {tab.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* JOB LIST */}
          <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
            {loading && jobs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">Loading queue...</div>
            ) : filteredJobs.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-slate-900/40 border border-dashed border-slate-800 text-xs text-slate-400">
                No stitching jobs in this category.
              </div>
            ) : (
              filteredJobs.map((j) => {
                const isSelected = selectedJob?.id === j.id;
                const totalPcs = j.fabricIn || j.items?.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
                return (
                  <div
                    key={j.id}
                    onClick={() => setSelectedJob(j)}
                    className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between gap-2.5 ${
                      isSelected
                        ? 'bg-indigo-950/30 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.15)]'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-mono font-bold text-white block">{j.challanNumber}</span>
                        <span className="text-[11px] text-slate-400">
                          {j.program?.programNumber || 'Program'} &bull; <strong className="text-indigo-300">{j.program?.styleCode || 'Standard'}</strong>
                        </span>
                      </div>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                          j.status === 'IN_PROCESS'
                            ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                            : j.status === 'COMPLETED'
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                            : j.status === 'READY_FOR_HANDOVER'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                        }`}
                      >
                        {j.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Input: <strong className="text-white">{totalPcs}</strong> pcs</span>
                      {j.fabricOut ? (
                        <span className="text-emerald-400 font-semibold">Done: {j.fabricOut}</span>
                      ) : (
                        <span className="text-slate-500">Pending</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: ACTIVE JOB WORKBENCH */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {selectedJob ? (
            <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-md space-y-6 flex-1 flex flex-col justify-between">
              <div className="space-y-6">
                {/* WORKBENCH TOP BAR */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-bold text-indigo-400">{selectedJob.challanNumber}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {selectedJob.priority || 'NORMAL'} PRIORITY
                      </span>
                    </div>
                    <h2 className="text-lg font-black text-white mt-1">
                      {selectedJob.program?.styleCode || 'Garment Assembly'} &bull; {selectedJob.program?.programNumber || 'Program'}
                    </h2>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setTechSheetProgram(selectedJob.program);
                        setShowTechSheet(true);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Production Sheet</span>
                    </button>

                    <Link
                      href={`/stitching/workspace/${selectedJob.id}`}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 text-xs font-semibold border border-indigo-500/40 transition flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Focus Mode</span>
                    </Link>
                  </div>
                </div>

                {/* SPECIFICATIONS GRID */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-[11px] text-slate-400 block mb-0.5">Buyer / Client</span>
                    <span className="text-xs font-bold text-white truncate block">
                      {selectedJob.program?.clientName || selectedJob.program?.buyerName || 'Confidential'}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-[11px] text-slate-400 block mb-0.5">Design / Wilcom No</span>
                    <span className="text-xs font-mono font-bold text-amber-300 truncate block">
                      {selectedJob.program?.wilcomDesignNumber || selectedJob.program?.designNumber || '-'}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-[11px] text-slate-400 block mb-0.5">Fabric & Color</span>
                    <span className="text-xs font-bold text-slate-200 truncate block">
                      {selectedJob.program?.fabricName || 'Cotton'} &bull; {selectedJob.program?.color || 'Std'}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-[11px] text-slate-400 block mb-0.5">Verified Input Pcs</span>
                    <span className="text-sm font-black text-indigo-400 block">
                      {totalInputOfSelected} pcs
                    </span>
                  </div>
                </div>

                {/* STATUS & RECONCILIATION SUMMARY */}
                <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-300">Current Job Lifecycle:</span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {selectedJob.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    {selectedJob.fabricOut ? (
                      <span className="text-xs text-emerald-400 font-semibold">
                        Reconciled Output: {selectedJob.fabricOut} Good Garments
                      </span>
                    ) : null}
                  </div>

                  {selectedJob.remarks && (
                    <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs text-slate-300 italic">
                      &ldquo;{selectedJob.remarks}&rdquo;
                    </div>
                  )}
                </div>

                {/* TRANSFER ITEMS BREAKDOWN */}
                <div>
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Received Garment Components / Bundles
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400">
                        <tr>
                          <th className="p-2.5 font-semibold">Description</th>
                          <th className="p-2.5 font-semibold">Component Code</th>
                          <th className="p-2.5 font-semibold text-right">Quantity</th>
                          <th className="p-2.5 font-semibold">UOM</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-200">
                        {selectedJob.items?.map((it: any) => (
                          <tr key={it.id}>
                            <td className="p-2.5 font-semibold">{it.itemDescription}</td>
                            <td className="p-2.5 font-mono text-slate-400">{it.fabricCode || 'PANEL'}</td>
                            <td className="p-2.5 text-right font-bold text-white">{it.quantity}</td>
                            <td className="p-2.5 text-slate-400">{it.uom || 'PCS'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* ACTION FOOTER BASED ON STATUS */}
              <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {selectedJob.status === 'IN_PROCESS' && (
                    <button
                      onClick={handlePause}
                      disabled={submittingPause}
                      className="px-3.5 py-2 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 text-xs font-semibold border border-amber-500/40 transition flex items-center gap-1.5"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      <span>{submittingPause ? 'Pausing...' : 'Pause Stitching'}</span>
                    </button>
                  )}

                  {selectedJob.status === 'ON_HOLD' && (
                    <button
                      onClick={handleResume}
                      disabled={submittingResume}
                      className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>{submittingResume ? 'Resuming...' : 'Resume Stitching'}</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* If RECEIVED -> Allocate Line & Start */}
                  {selectedJob.status === 'RECEIVED' && (
                    <button
                      onClick={openStartModal}
                      className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shadow-md flex items-center gap-1.5"
                    >
                      <Shirt className="w-4 h-4" />
                      <span>Allocate Line & Start Assembly</span>
                    </button>
                  )}

                  {/* If IN_PROCESS -> Complete Output Reconciliation */}
                  {selectedJob.status === 'IN_PROCESS' && (
                    <button
                      onClick={openCompleteModal}
                      className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-md flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Record Production Output</span>
                    </button>
                  )}

                  {/* If COMPLETED -> Perform Quality Inspection */}
                  {selectedJob.status === 'COMPLETED' && (
                    <button
                      onClick={openInspectModal}
                      className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition shadow-md flex items-center gap-1.5"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>End-Line Quality Inspection</span>
                    </button>
                  )}

                  {/* If READY_FOR_HANDOVER -> Issue Outgoing Challan */}
                  {(selectedJob.status === 'READY_FOR_HANDOVER' || selectedJob.status === 'READY_FOR_FINISHING') && (
                    <Link
                      href={`/stitching/issue-challan?jobId=${selectedJob.id}`}
                      className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-md flex items-center gap-1.5"
                    >
                      <Send className="w-4 h-4" />
                      <span>Issue Finishing Handover Challan</span>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-slate-400">
              Select a job from the queue to view details and operate.
            </div>
          )}
        </div>
      </div>

      {/* START / ALLOCATION MODAL */}
      {showStartModal && selectedJob && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Shirt className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Allocate Assembly Line</h3>
              </div>
              <button
                onClick={() => setShowStartModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStartSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Production Line</label>
                <select
                  value={lineNumber}
                  onChange={(e) => setLineNumber(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-semibold"
                >
                  {['Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5', 'Line 6', 'Line 7', 'Line 8'].map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Lead Sewing Machine ID</label>
                <input
                  type="text"
                  value={machineNumber}
                  onChange={(e) => setMachineNumber(e.target.value)}
                  placeholder="e.g. M-01 / Juki DDL-9000C"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Line Supervisor / Operator Name</label>
                <input
                  type="text"
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  required
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowStartModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingStart}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  {submittingStart ? 'Starting...' : 'Confirm & Start Stitching'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OUTPUT RECONCILIATION MODAL */}
      {showCompleteModal && selectedJob && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Output Reconciliation & Accounting</h3>
              </div>
              <button
                onClick={() => setShowCompleteModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {completeError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{completeError}</span>
              </div>
            )}

            <form onSubmit={handleCompleteSubmit} className="space-y-4 text-xs">
              {/* RECONCILIATION STATUS BADGE */}
              <div
                className={`p-3 rounded-xl border flex items-center justify-between ${
                  isBalanced
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                <div>
                  <span className="font-bold block">
                    {isBalanced ? '✓ Quantities Strictly Reconciled' : '⚠ Quantity Imbalance Detected'}
                  </span>
                  <span className="text-[11px] opacity-80">
                    Input: {completeInputQty} = Good ({completeGoodQty}) + Re-stitch ({completeReworkQty}) + Scrap ({completeRejectQty}) + WIP ({completeBalanceQty})
                  </span>
                </div>
                <span className="font-mono font-black text-sm">
                  {reconciliationDiff === 0 ? '0 Diff' : `${reconciliationDiff > 0 ? '+' : ''}${reconciliationDiff} Diff`}
                </span>
              </div>

              {/* INPUT FIELDS */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Good Finished Garments *</label>
                  <input
                    type="number"
                    min="0"
                    max={completeInputQty}
                    value={completeGoodQty}
                    onChange={(e) => setCompleteGoodQty(Number(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-bold text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-amber-300 font-semibold mb-1">Re-stitch / Rework</label>
                  <input
                    type="number"
                    min="0"
                    value={completeReworkQty}
                    onChange={(e) => setCompleteReworkQty(Number(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-bold text-sm"
                  />
                </div>

                <div>
                  <label className="block text-rose-300 font-semibold mb-1">Reject / Scrap</label>
                  <input
                    type="number"
                    min="0"
                    value={completeRejectQty}
                    onChange={(e) => setCompleteRejectQty(Number(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-bold text-sm"
                  />
                </div>

                <div>
                  <label className="block text-blue-300 font-semibold mb-1">Balance / Work In Progress</label>
                  <input
                    type="number"
                    min="0"
                    value={completeBalanceQty}
                    onChange={(e) => setCompleteBalanceQty(Number(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-bold text-sm"
                  />
                </div>
              </div>

              {completeRejectQty > 0 && (
                <div>
                  <label className="block text-rose-300 font-semibold mb-1">Scrap Reason / Defect Category *</label>
                  <input
                    type="text"
                    value={completeDefectReason}
                    onChange={(e) => setCompleteDefectReason(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                    placeholder="e.g. Needle cut / Oil stain / Seam burst"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Operator / Shift Notes</label>
                <textarea
                  rows={2}
                  value={completeNotes}
                  onChange={(e) => setCompleteNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="autoInspect"
                  checked={autoInspect}
                  onChange={(e) => setAutoInspect(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-600 focus:ring-0"
                />
                <label htmlFor="autoInspect" className="text-slate-400 text-xs cursor-pointer">
                  Auto-pass In-Line Inspection (mark directly READY FOR HANDOVER)
                </label>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCompleteModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isBalanced || submittingComplete}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:opacity-50"
                >
                  {submittingComplete ? 'Reconciling...' : 'Confirm Output'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUALITY INSPECTION MODAL */}
      {showInspectModal && selectedJob && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">End-Line Quality Verification</h3>
              </div>
              <button
                onClick={() => setShowInspectModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {inspectError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{inspectError}</span>
              </div>
            )}

            <form onSubmit={handleInspectSubmit} className="space-y-3 text-xs">
              <div className="space-y-2 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                {[
                  { key: 'seamStrength', label: 'Seam Strength & Durability' },
                  { key: 'spiCheck', label: 'Stitches Per Inch (10-12 SPI)' },
                  { key: 'tensionCheck', label: 'Thread Tension & Skip Stitches' },
                  { key: 'fitCheck', label: 'Garment Fit & Measurements' },
                  { key: 'motifSymmetry', label: 'Embroidered Motif Symmetry' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-slate-300">{label}:</span>
                    <select
                      value={(inspectChecks as any)[key]}
                      onChange={(e) => setInspectChecks({ ...inspectChecks, [key]: e.target.value })}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-[11px]"
                    >
                      <option value="PASS">PASS</option>
                      <option value="FAIL">FAIL</option>
                    </select>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Inspector Notes</label>
                <textarea
                  rows={2}
                  value={inspectNotes}
                  onChange={(e) => setInspectNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowInspectModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingInspect}
                  className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold"
                >
                  {submittingInspect ? 'Submitting...' : 'Approve for Handover'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TECH SHEET PRINT MODAL */}
      {showTechSheet && techSheetProgram && (
        <ProductionSheetPrintModal
          isOpen={showTechSheet}
          onClose={() => setShowTechSheet(false)}
          program={techSheetProgram}
        />
      )}
    </div>
  );
}

export default function StitchingWorkstationPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading workstation...</div>}>
      <StitchingWorkstationContent />
    </Suspense>
  );
}
