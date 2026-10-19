'use client';

import React, { useState, useEffect, Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Scissors,
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
  Eye,
  Download,
} from 'lucide-react';
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';
import { 
  downloadProductionSheetHtml, 
  printProductionSheet 
} from '@/lib/download-production-sheet';
import { 
  downloadChallanHtml, 
  printChallan 
} from '@/lib/download-challan';

function RecuttingWorkstationContent() {
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
  const [completeDefectCode, setCompleteDefectCode] = useState('CUT_OFF_SPEC');
  const [components, setComponents] = useState<{ component: string; quantity: number }[]>([
    { component: 'FRONT PANEL', quantity: 0 },
    { component: 'BACK PANEL', quantity: 0 },
  ]);

  // Verification Modal
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [submittingVerify, setSubmittingVerify] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [verifyChecks, setVerifyChecks] = useState({
    symmetry: true,
    seamAllowance: true,
    notches: true,
    cleanEdges: true,
  });
  const [verifyOutcome, setVerifyOutcome] = useState<'APPROVED' | 'HOLD'>('APPROVED');
  const [verifyNotes, setVerifyNotes] = useState('');

  // Starting a job
  const [submittingStart, setSubmittingStart] = useState(false);

  const loadJobs = async (selectId?: string) => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/recutting/queue');
      if (!res.ok) throw new Error('Failed to load cutting jobs');
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
      console.error('Error loading cutting jobs:', err);
      setError(err.message || 'Error connecting to server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs(initialJobId || undefined);
    const interval = setInterval(() => {
      // background silent refresh
      fetch('/api/recutting/queue')
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
    return selectedJob.items?.reduce(
      (sum: number, it: any) => sum + (Number(it.quantity) || 0),
      0
    ) || 0;
  }, [selectedJob]);

  // Handle start cutting
  const handleStartCutting = async () => {
    if (!selectedJob) return;
    try {
      setSubmittingStart(true);
      const res = await fetch(`/api/recutting/jobs/${selectedJob.id}/start`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to start cutting job');

      // Update state
      await loadJobs(selectedJob.id);
    } catch (err: any) {
      alert(err.message || 'Failed to start cutting');
    } finally {
      setSubmittingStart(false);
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
    setCompleteNotes('Precision cutting completed according to Wilcom pattern and seam allowances.');
    setComponents([
      { component: 'FRONT PANEL', quantity: Math.floor(input / 2) || input },
      { component: 'BACK PANEL', quantity: Math.floor(input / 2) || 0 },
    ]);
    setCompleteError('');
    setShowCompleteModal(true);
  };

  // Math reconciliation check
  const reconciledSum = Number(completeGoodQty) + Number(completeReworkQty) + Number(completeRejectQty) + Number(completeBalanceQty);
  const reconciliationDiff = Number(completeInputQty) - reconciledSum;
  const isBalanced = reconciliationDiff === 0 && Number(completeGoodQty) >= 0;

  // Submit Complete
  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    if (!isBalanced) {
      setCompleteError(
        `Quantity imbalance detected. Input (${completeInputQty}) must exactly equal Good (${completeGoodQty}) + Rework (${completeReworkQty}) + Scrap (${completeRejectQty}) + Balance (${completeBalanceQty}). Difference: ${reconciliationDiff}`
      );
      return;
    }

    try {
      setSubmittingComplete(true);
      setCompleteError('');

      const res = await fetch(`/api/recutting/jobs/${selectedJob.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputQuantity: completeInputQty,
          goodQuantity: completeGoodQty,
          reworkQuantity: completeReworkQty,
          rejectQuantity: completeRejectQty,
          balanceQuantity: completeBalanceQty,
          operatorNotes: completeNotes,
          defectCode: completeRejectQty > 0 ? completeDefectCode : undefined,
          componentBreakdown: components,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to log output');

      setShowCompleteModal(false);
      await loadJobs(selectedJob.id);
    } catch (err: any) {
      setCompleteError(err.message || 'Error completing recutting job');
    } finally {
      setSubmittingComplete(false);
    }
  };

  // Open Verify Modal
  const openVerifyModal = () => {
    if (!selectedJob) return;
    setVerifyChecks({
      symmetry: true,
      seamAllowance: true,
      notches: true,
      cleanEdges: true,
    });
    setVerifyOutcome('APPROVED');
    setVerifyNotes('Pre-stitching dimensions, symmetry, and notch markings verified. Approved for stitching handover.');
    setVerifyError('');
    setShowVerifyModal(true);
  };

  // Submit Verify
  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    try {
      setSubmittingVerify(true);
      setVerifyError('');

      const res = await fetch(`/api/recutting/jobs/${selectedJob.id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome: verifyOutcome,
          symmetryChecked: verifyChecks.symmetry,
          seamAllowanceChecked: verifyChecks.seamAllowance,
          notchesChecked: verifyChecks.notches,
          cleanEdgesChecked: verifyChecks.cleanEdges,
          notes: verifyNotes,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to verify job');

      setShowVerifyModal(false);
      await loadJobs(selectedJob.id);
    } catch (err: any) {
      setVerifyError(err.message || 'Error recording verification');
    } finally {
      setSubmittingVerify(false);
    }
  };

  // Open Production Sheet print modal
  const openTechSheet = (program: any) => {
    setTechSheetProgram(program);
    setShowTechSheet(true);
  };

  // Filtered jobs
  const filteredJobs = jobs.filter((job) => {
    if (activeTab === 'READY_FOR_CUTTING' && job.status !== 'RECEIVED') return false;
    if (activeTab === 'IN_PROCESS' && job.status !== 'IN_PROCESS') return false;
    if (activeTab === 'COMPLETED' && job.status !== 'COMPLETED') return false;
    if (activeTab === 'READY_FOR_STITCHING' && job.status !== 'READY_FOR_STITCHING') return false;
    if (activeTab === 'HANDED_OVER' && job.status !== 'HANDED_OVER') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchChallan = job.challanNumber?.toLowerCase().includes(q);
      const matchProgram = job.program?.programNumber?.toLowerCase().includes(q);
      const matchDesign =
        job.program?.designNumber?.toLowerCase().includes(q) ||
        job.program?.wilcomDesignNumber?.toLowerCase().includes(q);
      const matchBuyer =
        job.program?.buyerName?.toLowerCase().includes(q) ||
        job.program?.clientName?.toLowerCase().includes(q);
      return matchChallan || matchProgram || matchDesign || matchBuyer;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[#FDFBF7] pb-16">
      {/* HEADER */}
      <header
        style={{
          backgroundImage: `linear-gradient(to right, rgba(15, 23, 42, 0.88), rgba(15, 23, 42, 0.72)), url('${DEPARTMENT_NAV_BG_IMAGE}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        className="border-b border-slate-700/80 sticky top-0 z-30 px-4 sm:px-8 py-4 shadow-md text-white"
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                RECUTTING WORKSTATION
              </span>
              <span className="flex items-center gap-1.5 text-xs text-rose-300 font-medium">
                <Scissors className="w-3.5 h-3.5" />
                Precision Panel Cutting & Output Reconciliation
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mt-1 flex items-center gap-2">
              <span>Recutting Work Queue & Operation Terminal</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadJobs()}
              disabled={loading}
              className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <Link
              href="/recutting/incoming"
              className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
            >
              <Package className="w-3.5 h-3.5 text-amber-400" />
              <span>Incoming Intake</span>
            </Link>
            <Link
              href="/recutting/issue-challan"
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Stitching Handover</span>
            </Link>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-4">
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              onClick={() => loadJobs()}
              className="px-3 py-1 bg-rose-600 text-white text-xs font-semibold rounded"
            >
              Retry
            </button>
          </div>
        )}

        {/* TABS & SEARCH */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md whitespace-nowrap transition ${
                activeTab === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Jobs ({jobs.length})
            </button>
            <button
              onClick={() => setActiveTab('READY_FOR_CUTTING')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md whitespace-nowrap transition ${
                activeTab === 'READY_FOR_CUTTING' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ready for Cutting ({jobs.filter((j) => j.status === 'RECEIVED').length})
            </button>
            <button
              onClick={() => setActiveTab('IN_PROCESS')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md whitespace-nowrap transition ${
                activeTab === 'IN_PROCESS' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              In Cutting ({jobs.filter((j) => j.status === 'IN_PROCESS').length})
            </button>
            <button
              onClick={() => setActiveTab('COMPLETED')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md whitespace-nowrap transition ${
                activeTab === 'COMPLETED' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Awaiting Verification ({jobs.filter((j) => j.status === 'COMPLETED').length})
            </button>
            <button
              onClick={() => setActiveTab('READY_FOR_STITCHING')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md whitespace-nowrap transition ${
                activeTab === 'READY_FOR_STITCHING' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ready for Stitching ({jobs.filter((j) => j.status === 'READY_FOR_STITCHING').length})
            </button>
            <button
              onClick={() => setActiveTab('PRODUCTION_SHEETS')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md whitespace-nowrap transition ${
                activeTab === 'PRODUCTION_SHEETS' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Production Sheets
            </button>
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search challan, program, buyer, design..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
        </div>

        {/* IF TAB IS PRODUCTION SHEETS */}
        {activeTab === 'PRODUCTION_SHEETS' ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-sky-600" />
                  <span>Production Sheets for Recutting</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Authoritative design specifications, Wilcom file parameters, and cutting guidelines.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {jobs
                .filter((j) => !!j.program)
                .map((j) => (
                  <div
                    key={j.id}
                    className="p-4 rounded-xl border border-slate-200 hover:border-sky-400 transition bg-slate-50/50 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-bold text-sky-800 bg-sky-100 px-2 py-0.5 rounded">
                          {j.program?.programNumber}
                        </span>
                        <span className="text-slate-400">{j.program?.styleCode || 'STYLE'}</span>
                      </div>
                      <div className="mt-2 text-sm font-bold text-slate-800">
                        {j.program?.buyerName || j.program?.clientName || 'General Client'}
                      </div>
                      <div className="mt-2 space-y-1 text-xs text-slate-600">
                        <div>Design: <strong>{j.program?.designNumber || 'N/A'}</strong></div>
                        <div>Wilcom: <strong>{j.program?.wilcomDesignNumber || 'N/A'}</strong></div>
                        <div>Fabric: <strong>{j.program?.fabricName || 'Embroidered Cloth'}</strong></div>
                        <div>Order Qty: <strong>{j.program?.quantity || 'N/A'} {j.program?.uom || 'PCS'}</strong></div>
                      </div>
                    </div>

                    <button
                      onClick={() => openTechSheet(j.program)}
                      className="mt-4 w-full py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>View & Print Tech Sheet</span>
                    </button>
                  </div>
                ))}
            </div>
          </div>
        ) : (
          /* SPLIT LAYOUT: QUEUE LIST ON LEFT, ACTIVE WORKSTATION ON RIGHT */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT: JOB QUEUE LIST (5 cols) */}
            <div className="lg:col-span-5 space-y-3">
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Jobs in Work Queue ({filteredJobs.length})
                  </span>
                  <span className="text-[11px] text-slate-400">Click to load workstation</span>
                </div>

                <div className="divide-y divide-slate-100 max-h-[750px] overflow-y-auto">
                  {filteredJobs.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      <Scissors className="w-8 h-8 mx-auto mb-2 opacity-40 text-rose-400" />
                      <p className="text-xs font-semibold text-slate-600">No jobs match this filter</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Receive incoming challans or change status filter tab above.
                      </p>
                    </div>
                  ) : (
                    filteredJobs.map((job) => {
                      const isSelected = selectedJob?.id === job.id;
                      const pcs = job.items?.reduce(
                        (sum: number, it: any) => sum + (Number(it.quantity) || 0),
                        0
                      );

                      return (
                        <div
                          key={job.id}
                          onClick={() => setSelectedJob(job)}
                          className={`p-4 cursor-pointer transition flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'bg-rose-50/70 border-l-4 border-rose-500 pl-3'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                                {job.challanNumber}
                              </span>
                              {job.status === 'RECEIVED' && (
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                                  Ready
                                </span>
                              )}
                              {job.status === 'IN_PROCESS' && (
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                                  In Cutting
                                </span>
                              )}
                              {job.status === 'COMPLETED' && (
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                                  Verify
                                </span>
                              )}
                              {job.status === 'READY_FOR_STITCHING' && (
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                  Approved
                                </span>
                              )}
                              {job.status === 'HANDED_OVER' && (
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                  Dispatched
                                </span>
                              )}
                            </div>

                            <div className="text-xs font-bold text-slate-800 mt-1 truncate">
                              {job.program?.programNumber || 'No Program'}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              Design: {job.program?.designNumber || job.program?.wilcomDesignNumber || 'N/A'} • {job.program?.clientName || job.program?.buyerName || 'N/A'}
                            </div>

                            {/* 1-CLICK ACTIONS */}
                            <div className="mt-2 flex items-center gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
                              <Link
                                href={`/challans/${job.id}`}
                                className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-semibold flex items-center gap-0.5"
                                title="View Challan Slip"
                              >
                                <Eye className="w-2.5 h-2.5" />
                                <span>Slip</span>
                              </Link>
                              <button
                                type="button"
                                onClick={() => downloadChallanHtml(job)}
                                className="px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[10px] font-semibold flex items-center gap-0.5"
                                title="Download Challan HTML"
                              >
                                <Download className="w-2.5 h-2.5" />
                                <span>Challan</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => printChallan(job)}
                                className="px-1.5 py-0.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded text-[10px] font-semibold flex items-center gap-0.5"
                                title="Print Challan Slip"
                              >
                                <Printer className="w-2.5 h-2.5" />
                                <span>Print</span>
                              </button>

                              {job.program && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openTechSheet(job.program)}
                                    className="px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[10px] font-semibold flex items-center gap-0.5"
                                    title="View Production Sheet"
                                  >
                                    <FileText className="w-2.5 h-2.5" />
                                    <span>Sheet</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => downloadProductionSheetHtml(job.program)}
                                    className="px-1.5 py-0.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded text-[10px] font-semibold flex items-center gap-0.5"
                                    title="Download Production Sheet HTML"
                                  >
                                    <Download className="w-2.5 h-2.5" />
                                    <span>Sheet</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => printProductionSheet(job.program)}
                                    className="px-1.5 py-0.5 bg-blue-100/70 hover:bg-blue-200/70 text-blue-800 rounded text-[10px] font-semibold flex items-center gap-0.5"
                                    title="Print Production Sheet Traveler"
                                  >
                                    <Printer className="w-2.5 h-2.5" />
                                    <span>Sheet</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-xs font-black text-slate-900">{pcs.toLocaleString()} PCS</div>
                            <ChevronRight
                              className={`w-4 h-4 ml-auto mt-1 ${
                                isSelected ? 'text-rose-600' : 'text-slate-300'
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT: ACTIVE JOB WORKSTATION (7 cols) */}
            <div className="lg:col-span-7">
              {!selectedJob ? (
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-12 text-center text-slate-400">
                  <Scissors className="w-12 h-12 mx-auto mb-3 opacity-30 text-rose-500" />
                  <h3 className="text-sm font-bold text-slate-700">Select a Job to Open Cutting Workstation</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Choose any job from the queue on the left to start cutting or reconcile output.
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-6 p-6">
                  {/* Job Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-extrabold text-sm bg-slate-900 text-white px-2.5 py-0.5 rounded">
                          {selectedJob.challanNumber}
                        </span>
                        {selectedJob.status === 'RECEIVED' && (
                          <span className="text-xs font-bold uppercase px-2.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                            Ready for Cutting
                          </span>
                        )}
                        {selectedJob.status === 'IN_PROCESS' && (
                          <span className="text-xs font-bold uppercase px-2.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 animate-spin" />
                            Cutting in Progress
                          </span>
                        )}
                        {selectedJob.status === 'COMPLETED' && (
                          <span className="text-xs font-bold uppercase px-2.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                            Awaiting Pre-Stitching Check
                          </span>
                        )}
                        {selectedJob.status === 'READY_FOR_STITCHING' && (
                          <span className="text-xs font-bold uppercase px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Ready for Stitching Handover
                          </span>
                        )}
                        {selectedJob.status === 'HANDED_OVER' && (
                          <span className="text-xs font-bold uppercase px-2.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                            Handed Over to Stitching
                          </span>
                        )}
                      </div>
                      <div className="text-base font-black text-slate-900 mt-1">
                        {selectedJob.program?.programNumber || 'Program Specification'}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* CHALLAN SUITE */}
                      <Link
                        href={`/challans/${selectedJob.id}`}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition flex items-center gap-1 border border-slate-200"
                        title="View Full Challan Slip"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-600" />
                        <span>Slip</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => downloadChallanHtml(selectedJob)}
                        className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition flex items-center gap-1 border border-indigo-200 cursor-pointer"
                        title="Download Challan HTML"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Challan</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => printChallan(selectedJob)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1 border border-slate-200 cursor-pointer"
                        title="Print Challan Slip"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print</span>
                      </button>

                      {/* PRODUCTION SHEET SUITE */}
                      {selectedJob.program && (
                        <>
                          <button
                            type="button"
                            onClick={() => openTechSheet(selectedJob.program)}
                            className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg text-xs font-bold transition flex items-center gap-1 border border-blue-200 cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5 text-blue-600" />
                            <span>View Sheet</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadProductionSheetHtml(selectedJob.program)}
                            className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg text-xs font-bold transition flex items-center gap-1 border border-sky-200 cursor-pointer"
                            title="Download Production Sheet HTML"
                          >
                            <Download className="w-3.5 h-3.5 text-sky-600" />
                            <span>Download Sheet</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => printProductionSheet(selectedJob.program)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1 border border-slate-200 cursor-pointer"
                            title="Print Production Sheet Traveler"
                          >
                            <Printer className="w-3.5 h-3.5 text-slate-600" />
                            <span>Print Sheet</span>
                          </button>
                        </>
                      )}
                      <Link
                        href={`/recutting/workspace/${selectedJob.id}`}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border border-rose-200"
                      >
                        <Scissors className="w-3.5 h-3.5" />
                        <span>Focus Mode</span>
                      </Link>
                    </div>
                  </div>

                  {/* Production Sheet Specifications Card */}
                  <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 text-xs">
                    <div className="font-bold text-slate-800 uppercase tracking-wide text-[11px] mb-2 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-rose-600" />
                      <span>Production Sheet & Embroidery Specifications</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Buyer / Client</span>
                        <strong className="text-slate-800">{selectedJob.program?.buyerName || selectedJob.program?.clientName || 'N/A'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Design Number</span>
                        <strong className="text-slate-800">{selectedJob.program?.designNumber || 'N/A'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Wilcom File #</span>
                        <strong className="text-rose-700 font-mono font-bold">
                          {selectedJob.program?.wilcomDesignNumber || 'N/A'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Fabric & Color</span>
                        <strong className="text-slate-800">
                          {selectedJob.program?.fabricName || 'Cloth'} ({selectedJob.program?.fabricColor || 'Natural'})
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Precision Cutting Guidelines */}
                  <div className="p-4 bg-rose-50/50 rounded-xl border border-rose-200 text-xs space-y-2">
                    <div className="font-bold text-rose-900 uppercase tracking-wide text-[11px] flex items-center gap-1.5">
                      <Scissors className="w-3.5 h-3.5 text-rose-600" />
                      <span>Operator Precision Guidelines</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-slate-700 text-[11px]">
                      <li>Cut strictly along the outer seam allowance defined in the Wilcom pattern.</li>
                      <li>Preserve all notch alignment markers for the Stitching Department.</li>
                      <li>Inspect panels for post-wash shrinkage and center motif symmetry before cutting.</li>
                      <li>Reject or flag pieces with asymmetric cut-off or frayed embroidery outlines.</li>
                    </ul>
                  </div>

                  {/* Quantity & Items Breakdown */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                      Material Quantities (Challan Items)
                    </h4>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="px-3 py-2">Item Description</th>
                            <th className="px-3 py-2">Fabric / Code</th>
                            <th className="px-3 py-2 text-right">Quantity</th>
                            <th className="px-3 py-2">UOM</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedJob.items?.map((it: any) => (
                            <tr key={it.id}>
                              <td className="px-3 py-2 font-medium text-slate-900">{it.itemDescription}</td>
                              <td className="px-3 py-2 text-slate-500">{it.fabricCode || '-'}</td>
                              <td className="px-3 py-2 text-right font-bold text-slate-900">{it.quantity}</td>
                              <td className="px-3 py-2 text-slate-500">{it.uom || it.unitType || 'PCS'}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                          <tr>
                            <td colSpan={2} className="px-3 py-2 text-slate-700">Total Material In</td>
                            <td className="px-3 py-2 text-right text-rose-700 font-black">
                              {totalInputOfSelected.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-slate-600">PCS</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* STATE ACTION CONTROLS */}
                  <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-xs text-slate-500">
                      Current Job State: <strong className="text-slate-800">{selectedJob.status}</strong>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      {selectedJob.status === 'RECEIVED' && (
                        <button
                          onClick={handleStartCutting}
                          disabled={submittingStart}
                          className="w-full sm:w-auto px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center gap-2"
                        >
                          <Scissors className="w-4 h-4" />
                          <span>{submittingStart ? 'Starting...' : 'Start Precision Cutting'}</span>
                        </button>
                      )}

                      {selectedJob.status === 'IN_PROCESS' && (
                        <button
                          onClick={openCompleteModal}
                          className="w-full sm:w-auto px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Log Output & Reconcile Cut Pieces</span>
                        </button>
                      )}

                      {selectedJob.status === 'COMPLETED' && (
                        <button
                          onClick={openVerifyModal}
                          className="w-full sm:w-auto px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center gap-2"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>Perform Pre-Stitching Quality Check</span>
                        </button>
                      )}

                      {selectedJob.status === 'READY_FOR_STITCHING' && (
                        <Link
                          href={`/recutting/issue-challan?sourceChallanId=${selectedJob.id}`}
                          className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center gap-2"
                        >
                          <Send className="w-4 h-4" />
                          <span>Issue Challan to Stitching Department</span>
                        </Link>
                      )}

                      {selectedJob.status === 'HANDED_OVER' && (
                        <span className="text-xs font-bold text-slate-500 px-3 py-1 bg-slate-100 rounded-lg">
                          Transferred to Stitching
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* OUTPUT RECONCILIATION MODAL */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scissors className="w-5 h-5 text-rose-400" />
                <h3 className="text-sm font-bold">
                  Output Reconciliation & Accounting
                </h3>
              </div>
              <button
                onClick={() => setShowCompleteModal(false)}
                disabled={submittingComplete}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCompleteSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              {completeError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{completeError}</span>
                </div>
              )}

              {/* Mathematical Equation Overview */}
              <div
                className={`p-3.5 rounded-xl border text-xs ${
                  isBalanced
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-rose-50 border-rose-300 text-rose-900'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span>Reconciliation Equation: Input = Good + Retrim + Scrap + Balance</span>
                  {isBalanced ? (
                    <span className="flex items-center gap-1 text-emerald-700">
                      <Check className="w-4 h-4" /> Balanced (0 Diff)
                    </span>
                  ) : (
                    <span className="text-rose-700 font-extrabold">
                      Imbalance: {reconciliationDiff > 0 ? `+${reconciliationDiff}` : reconciliationDiff} PCS
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[11px] opacity-80">
                  Total Input: {completeInputQty} PCS | Sum of Outputs: {reconciledSum} PCS
                </div>
              </div>

              {/* Input quantities grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Good Cut (PCS) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={completeInputQty}
                    value={completeGoodQty}
                    onChange={(e) => setCompleteGoodQty(Number(e.target.value) || 0)}
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-bold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Retrim / Rework (PCS)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={completeInputQty}
                    value={completeReworkQty}
                    onChange={(e) => setCompleteReworkQty(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-bold text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Scrap / Reject (PCS)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={completeInputQty}
                    value={completeRejectQty}
                    onChange={(e) => setCompleteRejectQty(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-bold text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Uncut Balance (PCS)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={completeInputQty}
                    value={completeBalanceQty}
                    onChange={(e) => setCompleteBalanceQty(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
                  />
                </div>
              </div>

              {/* Defect Code (if reject > 0) */}
              {completeRejectQty > 0 && (
                <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-200">
                  <label className="block text-xs font-bold text-rose-900 mb-1">
                    Scrap Reason / Defect Code *
                  </label>
                  <select
                    value={completeDefectCode}
                    onChange={(e) => setCompleteDefectCode(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-rose-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                  >
                    <option value="CUT_OFF_SPEC">Cut Off Specification / Under Seam Allowance</option>
                    <option value="PATTERN_DISTORTION">Wilcom Motif Distortion / Uneven Border</option>
                    <option value="FABRIC_DAMAGE">Fabric Snag / Shears Blade Damage</option>
                    <option value="ASYMMETRIC_CUT">Asymmetric Panel Alignment</option>
                    <option value="PULL_DEFECT">Thread Pull / Embroidery unraveling</option>
                  </select>
                </div>
              )}

              {/* Component breakdown */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Cut Components Breakdown (Optional)
                </label>
                <div className="space-y-2">
                  {components.map((comp, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={comp.component}
                        onChange={(e) => {
                          const copy = [...components];
                          copy[idx].component = e.target.value;
                          setComponents(copy);
                        }}
                        placeholder="Component name (e.g. FRONT PANEL)"
                        className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg uppercase"
                      />
                      <input
                        type="number"
                        min="0"
                        value={comp.quantity}
                        onChange={(e) => {
                          const copy = [...components];
                          copy[idx].quantity = Number(e.target.value) || 0;
                          setComponents(copy);
                        }}
                        placeholder="Qty"
                        className="w-24 px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => setComponents(components.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setComponents([...components, { component: 'MOTIF PIECE', quantity: 0 }])}
                    className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Component</span>
                  </button>
                </div>
              </div>

              {/* Operator Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Operator Notes
                </label>
                <textarea
                  rows={2}
                  value={completeNotes}
                  onChange={(e) => setCompleteNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCompleteModal(false)}
                  disabled={submittingComplete}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingComplete || !isBalanced}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submittingComplete ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Reconciling & Saving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Confirm & Reconcile</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRE-STITCHING VERIFICATION MODAL */}
      {showVerifyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm font-bold">
                  Pre-Stitching Quality Verification
                </h3>
              </div>
              <button
                onClick={() => setShowVerifyModal(false)}
                disabled={submittingVerify}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleVerifySubmit} className="p-5 space-y-4">
              {verifyError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{verifyError}</span>
                </div>
              )}

              <div className="space-y-3">
                <label className="flex items-center gap-2.5 text-xs text-slate-800 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={verifyChecks.symmetry}
                    onChange={(e) => setVerifyChecks({ ...verifyChecks, symmetry: e.target.checked })}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                  <span>Motif alignment and bilateral symmetry verified</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-slate-800 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={verifyChecks.seamAllowance}
                    onChange={(e) => setVerifyChecks({ ...verifyChecks, seamAllowance: e.target.checked })}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                  <span>Seam allowances preserved per Wilcom technical pattern</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-slate-800 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={verifyChecks.notches}
                    onChange={(e) => setVerifyChecks({ ...verifyChecks, notches: e.target.checked })}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                  <span>Assembly notches and center alignment markers intact</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-slate-800 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={verifyChecks.cleanEdges}
                    onChange={(e) => setVerifyChecks({ ...verifyChecks, cleanEdges: e.target.checked })}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                  <span>Edges cleanly sheared with no fabric unraveling or thread tails</span>
                </label>
              </div>

              {/* Verification Outcome */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Verification Decision *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setVerifyOutcome('APPROVED')}
                    className={`py-2 text-xs font-bold rounded-lg border transition ${
                      verifyOutcome === 'APPROVED'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Approve for Stitching
                  </button>
                  <button
                    type="button"
                    onClick={() => setVerifyOutcome('HOLD')}
                    className={`py-2 text-xs font-bold rounded-lg border transition ${
                      verifyOutcome === 'HOLD'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Place on Hold (Rework)
                  </button>
                </div>
              </div>

              {/* Verification Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Verification Remarks
                </label>
                <textarea
                  rows={2}
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowVerifyModal(false)}
                  disabled={submittingVerify}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingVerify}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submittingVerify ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Recording...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Save Verification</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TECH SHEET / PRODUCTION SHEET VIEWER MODAL */}
      {showTechSheet && techSheetProgram && (
        <ProductionSheetPrintModal
          isOpen={true}
          onClose={() => {
            setShowTechSheet(false);
            setTechSheetProgram(null);
          }}
          program={techSheetProgram}
        />
      )}
    </div>
  );
}

export default function RecuttingWorkstationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-8">
          <div className="text-center text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-rose-600" />
            <p className="text-xs font-semibold">Loading Recutting Workstation...</p>
          </div>
        </div>
      }
    >
      <RecuttingWorkstationContent />
    </Suspense>
  );
}
