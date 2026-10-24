'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  FileText,
  Search,
  Filter,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Layers,
  Calendar,
  User,
  ExternalLink,
  X,
  Printer,
  Download,
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  PauseCircle,
  Send,
  Droplet,
  Boxes,
  Archive,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import { DepartmentStockView } from '@/components/DepartmentStockView';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';
import { 
  downloadProductionSheetHtml, 
  printProductionSheet 
} from '@/lib/download-production-sheet';
import { 
  downloadChallanHtml, 
  printChallan 
} from '@/lib/download-challan';
import { DocumentActionButtons } from '@/components/common/DocumentActionButtons';

interface QC1Challan {
  id: string;
  challanNumber: string;
  challanType: string;
  parentChallanId: string | null;
  parentChallanNumber: string | null;
  fromDepartment: string;
  toDepartment: string;
  status: string;
  priority: string;
  issuedDate: string | null;
  receivedDate: string | null;
  completedDate: string | null;
  createdAt: string;
  remarks: string | null;
  dyeingIncharge: string;
  receivedBy: string | null;
  programId: string;
  productionSheetNumber: string;
  programNumber: string;
  wilcomDesignNumber: string | null;
  clientName: string;
  fabric: string;
  fabricType: string | null;
  color: string;
  totalSentQuantity: number;
  inspectedQuantity: number;
  pendingInspectionQuantity: number;
  passedQuantity: number;
  failedQuantity: number;
  reworkQuantity: number;
  holdQuantity: number;
  uom: string;
  deliveryDate: string | null;
  items: any[];
  program: any;
  latestInspection?: any;
  inspectionHistory?: any[];
}

export default function QC1MyWorkPage() {
  const searchParams = useSearchParams();
  const highlightChallanId = searchParams.get('challanId');

  const [challans, setChallans] = useState<QC1Challan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Navigation Tabs: 'inspection' | 'stock' | 'defective-shelf'
  const [activeTab, setActiveTab] = useState<'inspection' | 'stock' | 'defective-shelf'>('inspection');
  const [qc1Defects, setQc1Defects] = useState<any[]>([]);
  const [loadingDefects, setLoadingDefects] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [selectedSheetForModal, setSelectedSheetForModal] = useState<any | null>(null);
  const [selectedChallanForView, setSelectedChallanForView] = useState<QC1Challan | null>(null);
  const [selectedChallanForInspect, setSelectedChallanForInspect] = useState<QC1Challan | null>(null);

  // Inspection Form State
  const [inspectionForm, setInspectionForm] = useState({
    quantityInspected: '',
    quantityPassed: '',
    quantityFailed: '',
    quantityRework: '',
    quantityHold: '0',
    result: 'PASS' as 'PASS' | 'REWORK' | 'REJECT',
    observedColor: '',
    defectType: 'SHADE_VARIATION',
    defectRemarks: '',
    reworkReason: '',
    holdReason: '',
    remarks: '',
  });

  const [submittingInspection, setSubmittingInspection] = useState(false);
  const [inspectionError, setInspectionError] = useState<string | null>(null);
  const [inspectionSuccess, setInspectionSuccess] = useState<any | null>(null);

  // Receiving state
  const [receivingId, setReceivingId] = useState<string | null>(null);

  // Fetch QC1 Defective Shelf Records
  const loadQc1Defects = async () => {
    try {
      setLoadingDefects(true);
      const res = await fetch('/api/defective-shelves?department=QC1');
      const json = await res.json();
      if (json.success && json.data?.challans) {
        setQc1Defects(json.data.challans);
      }
    } catch (err) {
      console.error('Error fetching QC1 defects:', err);
    } finally {
      setLoadingDefects(false);
    }
  };

  // Fetch QC1 Challans
  const loadChallans = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (priorityFilter !== 'ALL') params.set('priority', priorityFilter);
      if (searchTerm.trim()) params.set('search', searchTerm.trim());

      const res = await fetch(`/api/qc1/challans?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to load QC1 incoming challans.');
      }
      const json = await res.json();
      const list = json.data || [];
      setChallans(list);

      // If challanId param provided, auto-open inspection or view
      if (highlightChallanId) {
        const found = list.find((c: QC1Challan) => c.id === highlightChallanId);
        if (found) {
          if (found.status === 'RECEIVED' || found.status === 'UNDER_INSPECTION') {
            openInspectionModal(found);
          } else {
            setSelectedChallanForView(found);
          }
        }
      }
    } catch (err: any) {
      console.error('Error fetching QC1 challans:', err);
      setError(err.message || 'Error connecting to database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('subham_mes_user');
      if (savedUser) {
        try { setCurrentUser(JSON.parse(savedUser)); } catch {}
      }
    }
    loadChallans();
    loadQc1Defects();
  }, [statusFilter, priorityFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadChallans();
  };

  // Receive Material Handler
  const handleReceiveChallan = async (challan: QC1Challan) => {
    try {
      setReceivingId(challan.id);
      const res = await fetch(`/api/qc1/challans/${challan.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverId: currentUser?.id,
          notes: 'Received at QC1 inspection table',
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to receive Challan.');
      }
      await loadChallans();
    } catch (err: any) {
      alert(err.message || 'Error receiving Challan');
    } finally {
      setReceivingId(null);
    }
  };

  // Open Inspection Modal
  const openInspectionModal = (challan: QC1Challan) => {
    setSelectedChallanForInspect(challan);
    setInspectionError(null);
    setInspectionSuccess(null);
    const initialQty = challan.totalSentQuantity || 0;
    setInspectionForm({
      quantityInspected: String(initialQty),
      quantityPassed: String(initialQty),
      quantityFailed: '0',
      quantityRework: '0',
      quantityHold: '0',
      result: 'PASS',
      observedColor: challan.color || '',
      defectType: 'SHADE_VARIATION',
      defectRemarks: '',
      reworkReason: '',
      holdReason: '',
      remarks: '',
    });
  };

  // Submit Inspection Handler
  const handleInspectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChallanForInspect) return;

    setSubmittingInspection(true);
    setInspectionError(null);

    const qInspected = Number(inspectionForm.quantityInspected);
    const qPassed = Number(inspectionForm.quantityPassed || 0);
    const qFailed = Number(inspectionForm.quantityFailed || 0);
    const qRework = Number(inspectionForm.quantityRework || 0);
    const qHold = Number(inspectionForm.quantityHold || 0);

    // Frontend validation guard
    if (isNaN(qInspected) || qInspected <= 0) {
      setInspectionError('Quantity Inspected must be greater than 0.');
      setSubmittingInspection(false);
      return;
    }

    if (qInspected > selectedChallanForInspect.totalSentQuantity) {
      setInspectionError(
        `Quantity Inspected (${qInspected}) cannot exceed Quantity Received from Dyeing (${selectedChallanForInspect.totalSentQuantity}).`
      );
      setSubmittingInspection(false);
      return;
    }

    const sumCategories = qPassed + qFailed + qRework;
    if (sumCategories > qInspected + 0.001) {
      setInspectionError(
        `Sum of Passed (${qPassed}) + Failed (${qFailed}) + Rework (${qRework}) = ${sumCategories}, which exceeds Quantity Inspected (${qInspected}).`
      );
      setSubmittingInspection(false);
      return;
    }

    // Rule 4: Mandatory remarks for all decisions
    const effectiveRemarks = (inspectionForm.remarks || inspectionForm.defectRemarks || inspectionForm.reworkReason).trim();
    if (!effectiveRemarks) {
      setInspectionError('A remark from the QC Incharge is strictly required for every decision (PASS, REWORK, or REJECT).');
      setSubmittingInspection(false);
      return;
    }

    if (inspectionForm.result === 'PASS' && qPassed <= 0) {
      setInspectionError('Result is set to PASS, but Passed Quantity is 0. Please enter the quantity approved for Embroidery.');
      setSubmittingInspection(false);
      return;
    }

    if (inspectionForm.result === 'REJECT' && qFailed <= 0) {
      setInspectionError('Result is set to REJECT, but Rejected quantity is 0. Please enter the defective quantity for the Fabric Store Defective Shelf.');
      setSubmittingInspection(false);
      return;
    }

    if (inspectionForm.result === 'REWORK' && qRework <= 0) {
      setInspectionError('Result is set to REWORK, but Rework quantity is 0. Please enter the quantity to return to Dyeing.');
      setSubmittingInspection(false);
      return;
    }

    try {
      const payload = {
        quantityInspected: qInspected,
        quantityPassed: qPassed,
        quantityFailed: qFailed,
        quantityRework: qRework,
        quantityHold: qHold,
        result: inspectionForm.result,
        observedColor: inspectionForm.observedColor,
        defectRemarks: inspectionForm.defectRemarks,
        reworkReason: inspectionForm.reworkReason,
        holdReason: inspectionForm.holdReason,
        remarks: inspectionForm.remarks,
        inspectorId: currentUser?.id,
        defects:
          qFailed > 0 || qRework > 0
            ? [
                {
                  defectType: inspectionForm.defectType,
                  count: Math.round(qFailed + qRework),
                  severity: inspectionForm.result === 'REJECT' ? 'CRITICAL' : 'MAJOR',
                },
              ]
            : [],
      };

      const res = await fetch(`/api/qc1/challans/${selectedChallanForInspect.id}/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Failed to record QC1 inspection.');
      }

      setInspectionSuccess(resJson.data);
      setSubmittingInspection(false);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      loadChallans();
    } catch (err: any) {
      console.error('Inspection submit error:', err);
      setInspectionError(err.message || 'Error submitting inspection.');
    } finally {
      setSubmittingInspection(false);
    }
  };

  // Helper to render Barcode SVG
  const renderBarcodeSvg = (code: string) => {
    const bars = Array.from({ length: 36 }).map((_, i) => {
      const width = (i * 3 + code.length) % 3 === 0 ? 3 : (i % 2 === 0 ? 1.5 : 2);
      const x = 10 + i * 4.5;
      return `<rect x="${x}" y="2" width="${width}" height="28" fill="#000000" />`;
    }).join('');

    return (
      <div className="flex flex-col items-center">
        <svg
          viewBox="0 0 180 34"
          className="h-9 w-auto max-w-[160px]"
          dangerouslySetInnerHTML={{ __html: bars }}
        />
        <span className="font-mono text-[9px] tracking-widest text-neutral-600 uppercase font-semibold">
          {code}
        </span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-neutral-50 pb-16">
      {/* TOP HEADER */}
      <header className="bg-white border-b border-neutral-200/80 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-700 block">
            SHUBHAM FABRICS MES · QUALITY INSPECTION GATE
          </span>
          <h1 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-accent-700" />
            <span>Dyeing QC — My Work Workspace</span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={loadChallans}
            disabled={loading}
            className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <Link
            href="/qc1"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 text-xs font-semibold rounded-lg transition"
          >
            <Layers className="w-4 h-4 text-neutral-600" />
            <span>Dashboard</span>
          </Link>

          <Link
            href="/qc1/floor-board"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 text-xs font-semibold rounded-lg transition"
          >
            <span>Floor Board</span>
          </Link>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {/* ============================================================== */}
        {/* NAVIGATION TABS: Inspection Queue | Stock | Defective Shelf    */}
        {/* ============================================================== */}
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('inspection')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'inspection'
                ? 'bg-accent-500 text-neutral-900 shadow-xs'
                : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Inspection Queue ({challans.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('stock')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'stock'
                ? 'bg-accent-500 text-neutral-900 shadow-xs'
                : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Dyeing QC Stock &amp; Material Balance</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('defective-shelf')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'defective-shelf'
                ? 'bg-danger-700 text-white shadow-xs'
                : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-danger-600" />
            <span>Defective Shelf (DEF-SHELF-QC1) ({qc1Defects.length})</span>
          </button>
        </div>

        {/* ERROR */}
        {error && (
          <div className="p-4 bg-danger-50 border border-danger-200 rounded-xl flex items-center gap-3 text-danger-800 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-danger-600" />
            <span>{error}</span>
            <button onClick={loadChallans} className="ml-auto underline font-bold">
              Retry
            </button>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 1: INSPECTION QUEUE                                       */}
        {/* ============================================================== */}
        {activeTab === 'inspection' && (
          <div className="space-y-4">
            {/* FILTER & SEARCH BAR */}
            <div className="bg-white border border-neutral-200 rounded-xl p-3 shadow-xs">
              <form
                onSubmit={handleSearchSubmit}
                className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
              >
                {/* SEARCH */}
                <div className="relative flex-1 max-w-md">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    type="text"
                    placeholder="Search by Challan #, Production Sheet #, Fabric, Color, Client..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500/40 transition"
                  />
                </div>

                {/* STATUS & PRIORITY DROPDOWNS */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-neutral-500" />
                    <span className="text-[11px] font-bold uppercase text-neutral-500">Status:</span>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs text-neutral-900 focus:outline-none focus:ring-1 focus:ring-brand-500/40"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="ISSUED">Sent to QC1 (Pending Receipt)</option>
                      <option value="RECEIVED">Received by QC1</option>
                      <option value="UNDER_INSPECTION">Under Inspection</option>
                      <option value="QC_APPROVED">Passed (QC Approved)</option>
                      <option value="QC_REJECTED">Failed (Rejected)</option>
                      <option value="REWORK_REQUESTED">Rework (To Dyeing)</option>
                      <option value="ON_HOLD">On Hold</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold uppercase text-neutral-500">Priority:</span>
                    <select
                      value={priorityFilter}
                      onChange={(e) => setPriorityFilter(e.target.value)}
                      className="bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs text-neutral-900 focus:outline-none focus:ring-1 focus:ring-brand-500/40"
                    >
                      <option value="ALL">All Priorities</option>
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>
                </div>
              </form>
            </div>
        {/* WORKSPACE BANNER */}
        <div className="bg-white border border-neutral-200/90 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-accent-700" />
              <span>Incoming Material for QC1 Inspection</span>
            </h2>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono shrink-0">
            <div className="text-right">
              <span className="text-[10px] text-neutral-500 uppercase block font-sans font-bold">Total Lots</span>
              <span className="text-base font-bold text-neutral-900">{challans.length}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-neutral-500 uppercase block font-sans font-bold">Pending QC</span>
              <span className="text-base font-bold text-accent-800">
                {challans.filter((c) => ['ISSUED', 'RECEIVED', 'UNDER_INSPECTION'].includes(c.status)).length}
              </span>
            </div>
          </div>
        </div>

        {/* EMPTY STATE */}
        {!loading && challans.length === 0 && (
          <div className="bg-white border border-neutral-200/90 rounded-xl p-12 text-center space-y-3 shadow-xs">
            <CheckCircle2 className="w-12 h-12 text-neutral-700 mx-auto" />
            <h3 className="text-base font-bold text-neutral-900">
              No material currently waiting for QC1 inspection.
            </h3>
            <div className="pt-2">
              <Link
                href="/dyeing/my-work"
                className="text-xs text-brand-700 hover:text-brand-900 font-semibold inline-flex items-center gap-1"
              >
                <span>View Dyeing Department Work</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* TABLE OF QC1 WORK ITEMS */}
        {challans.length > 0 && (
          <div className="bg-white border border-neutral-200/90 rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-700 font-semibold border-b border-neutral-200">
                  <tr>
                    <th className="py-3 px-4">Production Sheet #</th>
                    <th className="py-3 px-4">Dyeing Challan #</th>
                    <th className="py-3 px-4">Client / Style</th>
                    <th className="py-3 px-4">Fabric &amp; Color</th>
                    <th className="py-3 px-4 text-right">Sent (Dyeing)</th>
                    <th className="py-3 px-4 text-right">Pending QC</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Dyeing Incharge</th>
                    <th className="py-3 px-4">QC1 Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-neutral-900">
                  {challans.map((challan) => {
                    const isIssued = challan.status === 'ISSUED';
                    const isReceived = challan.status === 'RECEIVED';
                    const isUnderInspection = challan.status === 'UNDER_INSPECTION';
                    const isApproved = challan.status === 'QC_APPROVED';
                    const isRejected = challan.status === 'QC_REJECTED';
                    const isRework = challan.status === 'REWORK_REQUESTED';
                    const isHold = challan.status === 'ON_HOLD';

                    return (
                      <tr key={challan.id} className="hover:bg-neutral-50/70 transition">
                        {/* Production Sheet Number */}
                        <td className="py-3 px-4">
                          <button
                            onClick={() => setSelectedSheetForModal(challan.program)}
                            className="font-mono font-bold text-neutral-900 hover:text-accent-800 text-left block flex items-center gap-1 group"
                          >
                            <span>{challan.productionSheetNumber}</span>
                            <ExternalLink className="w-3 h-3 text-neutral-500 group-hover:text-accent-800 opacity-0 group-hover:opacity-100 transition" />
                          </button>
                          <span className="text-[10px] text-neutral-500 block">
                            Prog: {challan.programNumber}
                          </span>
                        </td>

                        {/* Dyeing Challan Number & Barcode */}
                        <td className="py-3 px-4">
                          <button
                            onClick={() => setSelectedChallanForView(challan)}
                            className="font-mono font-bold text-brand-900 hover:underline block text-left"
                          >
                            {challan.challanNumber}
                          </button>
                          {challan.issuedDate && (
                            <span className="text-[10px] text-neutral-500 block">
                              Issued: {new Date(challan.issuedDate).toLocaleDateString()}
                            </span>
                          )}
                        </td>

                        {/* Client / Style */}
                        <td className="py-3 px-4">
                          <span className="font-semibold text-neutral-900 block truncate max-w-[140px]">
                            {challan.clientName}
                          </span>
                          <span className="text-[10px] text-neutral-500 block truncate max-w-[140px]">
                            {challan.program?.styleCode || challan.program?.mainStyle || 'Standard'}
                          </span>
                        </td>

                        {/* Fabric & Color */}
                        <td className="py-3 px-4">
                          <span className="font-medium text-neutral-900 block truncate max-w-[150px]">
                            {challan.fabric}
                          </span>
                          <div className="flex items-center gap-1 text-[10px] text-neutral-500">
                            <span>Color:</span>
                            <span className="font-semibold text-neutral-900">{challan.color}</span>
                          </div>
                        </td>

                        {/* Quantity Sent by Dyeing */}
                        <td className="py-3 px-4 text-right font-mono font-bold text-neutral-900">
                          {challan.totalSentQuantity} <span className="text-[10px] text-neutral-500">{challan.uom}</span>
                        </td>

                        {/* Quantity Pending Inspection */}
                        <td className="py-3 px-4 text-right font-mono">
                          {challan.pendingInspectionQuantity > 0 ? (
                            <span className="font-bold text-accent-800">
                              {challan.pendingInspectionQuantity} <span className="text-[10px]">{challan.uom}</span>
                            </span>
                          ) : (
                            <span className="text-accent-800 font-semibold text-[11px]">
                              0 (Inspected)
                            </span>
                          )}
                        </td>

                        {/* Priority */}
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              challan.priority === 'URGENT'
                                ? 'bg-danger-100 text-danger-800'
                                : challan.priority === 'HIGH'
                                ? 'bg-accent-100 text-accent-800'
                                : 'bg-neutral-100 text-neutral-700'
                            }`}
                          >
                            {challan.priority}
                          </span>
                        </td>

                        {/* Dyeing Incharge */}
                        <td className="py-3 px-4 text-neutral-700">
                          <span className="font-medium block truncate max-w-[120px]">
                            {challan.dyeingIncharge}
                          </span>
                          <span className="text-[10px] text-neutral-500 block">Dyeing Dept</span>
                        </td>

                        {/* QC1 Status */}
                        <td className="py-3 px-4">
                          {isIssued && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-accent-100 text-accent-800">
                              Sent to QC1
                            </span>
                          )}
                          {isReceived && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-brand-100 text-brand-900">
                              Received
                            </span>
                          )}
                          {isUnderInspection && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-brand-100 text-brand-900 animate-pulse">
                              Inspecting
                            </span>
                          )}
                          {isApproved && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-accent-100 text-accent-800">
                              PASS (Next Dept)
                            </span>
                          )}
                          {isRejected && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-danger-100 text-danger-900">
                              REJECT (Store Shelf)
                            </span>
                          )}
                          {isRework && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-brand-100 text-brand-900">
                              REWORK (To Dyeing)
                            </span>
                          )}
                          {isHold && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-neutral-200 text-neutral-900">
                              On Hold
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                            {/* COMPLETE DOCUMENT ACTIONS: PRODUCTION SHEET, CHALLAN & WILCOM */}
                            <DocumentActionButtons program={challan.program} challan={challan} size="xs" />

                            {/* RECEIVE MATERIAL BUTTON (If status === 'ISSUED') */}
                            {isIssued && (
                              <button
                                onClick={() => handleReceiveChallan(challan)}
                                disabled={receivingId === challan.id}
                                className="flex items-center gap-1 px-2.5 py-1 bg-brand-700 hover:bg-brand-800 text-white rounded text-xs font-semibold shadow-xs transition cursor-pointer"
                              >
                                {receivingId === challan.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Send className="w-3.5 h-3.5" />
                                )}
                                <span>Receive</span>
                              </button>
                            )}

                            {/* START / RECORD INSPECTION (If status === 'RECEIVED' or 'UNDER_INSPECTION') */}
                            {(isReceived || isUnderInspection) && (
                              <button
                                onClick={() => openInspectionModal(challan)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-accent-500 hover:bg-accent-600 text-neutral-900 rounded text-xs font-semibold shadow-xs transition cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Inspect</span>
                              </button>
                            )}

                            {/* INSPECTION COMPLETED: VIEW DETAILS */}
                            {(isApproved || isRejected || isRework || isHold) && (
                              <button
                                onClick={() => setSelectedChallanForView(challan)}
                                className="px-2 py-1 text-neutral-600 hover:bg-neutral-100 rounded text-[11px] font-semibold border border-neutral-200 transition"
                              >
                                Verified
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: QC1 DEPARTMENT STOCK VIEW                              */}
        {/* ============================================================== */}
        {activeTab === 'stock' && (
          <DepartmentStockView department="QC1" />
        )}

        {/* ============================================================== */}
        {/* TAB 3: QC1 DEFECTIVE SHELF (DEF-SHELF-QC1)                     */}
        {/* ============================================================== */}
        {activeTab === 'defective-shelf' && (
          <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-neutral-200 gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-danger-600 block">
                  DEPARTMENT ISOLATION SHELF
                </span>
                <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2 mt-0.5">
                  <Archive className="w-5 h-5 text-danger-600" />
                  <span>Dyeing QC Defective Shelf (DEF-SHELF-QC1)</span>
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Segregated rolls, cuts, and patches rejected during shade matching and knitting inspection. Automatically synced with Fabric Store Master Defective Shelf (DEF-SHELF-CENTRAL).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500 font-mono">
                  Shelf Code: <strong className="text-danger-700 bg-danger-50 px-2.5 py-1 rounded border border-danger-200">DEF-SHELF-QC1</strong>
                </span>
                <button
                  onClick={loadQc1Defects}
                  disabled={loadingDefects}
                  className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-md border border-neutral-200 transition cursor-pointer"
                  title="Refresh Defective Shelf"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingDefects ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* STAT CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-danger-50/70 border border-danger-200 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-danger-800">
                  Total QC1 Defective Cut
                </span>
                <div className="text-2xl font-mono font-bold text-danger-900">
                  {qc1Defects.reduce((acc, c) => acc + (Number(c.defectivePieces) || 0), 0)} MTR / PCS
                </div>
                <span className="text-[10px] text-danger-600">
                  Quarantined from downstream Embroidery handover
                </span>
              </div>

              <div className="p-4 bg-brand-50/70 border border-brand-200 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-800">
                  Fabric Store Master Sync
                </span>
                <div className="text-base font-bold text-brand-900 flex items-center gap-1.5 mt-1">
                  <CheckCircle2 className="w-4 h-4 text-accent-700" />
                  <span>Auto-Synced with Central Store</span>
                </div>
                <span className="text-[10px] text-brand-700">
                  Visible in Fabric Store DEF-SHELF-CENTRAL
                </span>
              </div>

              <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                  Quarantined Incidents
                </span>
                <div className="text-2xl font-mono font-bold text-neutral-900">
                  {qc1Defects.length} Lots
                </div>
                <span className="text-[10px] text-neutral-500">
                  Recorded with defect classification
                </span>
              </div>
            </div>

            {/* DEFECTIVE ITEMS TABLE */}
            {qc1Defects.length === 0 ? (
              <div className="p-10 border border-dashed border-neutral-200 rounded-xl text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-accent-700 mx-auto" />
                <h4 className="text-xs font-bold text-neutral-900">No defective pieces on DEF-SHELF-QC1</h4>
                <p className="text-[11px] text-neutral-500 max-w-sm mx-auto">
                  When fabric inspections identify shade mismatch, patchy dyeing, or knitting holes, defective cuts are isolated here and synchronized with the Fabric Store master shelf.
                </p>
              </div>
            ) : (
              <div className="border border-neutral-200 rounded-xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-50 text-neutral-700 font-semibold border-b border-neutral-200">
                      <tr>
                        <th className="py-2.5 px-3">Challan #</th>
                        <th className="py-2.5 px-3">Production Sheet #</th>
                        <th className="py-2.5 px-3">Fabric &amp; Color</th>
                        <th className="py-2.5 px-3">Defect Reason</th>
                        <th className="py-2.5 px-3 text-right">Defective Cut</th>
                        <th className="py-2.5 px-3">Isolation Shelf</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3 text-center">Store Sync</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {qc1Defects.map((def, idx) => (
                        <tr key={def.id || idx} className="hover:bg-neutral-50/70 transition">
                          <td className="py-2.5 px-3 font-mono font-bold text-neutral-900">
                            {def.challanNumber}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-accent-800">
                            {def.program?.programSerialNo || def.program?.programNumber || '—'}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-medium text-neutral-900 block">
                              {def.program?.fabricName || def.fabric || 'Dyed Fabric'}
                            </span>
                            <span className="text-[10px] text-neutral-500">
                              {def.program?.fabricColor || def.color || 'Standard'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="inline-block px-2 py-0.5 rounded bg-danger-50 text-danger-800 border border-danger-200 font-medium text-[11px]">
                              {def.defectReason || def.remarks || 'Shade Variation'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-danger-700">
                            {def.defectivePieces || def.failedQuantity || 0} {def.fabricUnit || 'MTR'}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-neutral-600">
                            {def.defectiveShelfLocation || 'DEF-SHELF-QC1'}
                          </td>
                          <td className="py-2.5 px-3 text-neutral-500 text-[11px]">
                            {new Date(def.createdAt || def.issuedDate || Date.now()).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-accent-800 bg-accent-50 px-2 py-0.5 rounded border border-accent-200">
                              <CheckCircle2 className="w-3 h-3 text-accent-700" />
                              <span>Master Synced</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 1: PRODUCTION SHEET TRAVELER                                        */}
        {/* ========================================================================= */}
        {selectedSheetForModal && (
          <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-neutral-200">
              {/* Header */}
              <div className="sticky top-0 bg-white text-neutral-900 p-4 sm:p-5 flex items-center justify-between z-10">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-700 block">
                    PRODUCTION SHEET · MASTER DOCUMENT
                  </span>
                  <h3 className="text-lg font-bold font-mono">
                    {selectedSheetForModal.programSerialNo || selectedSheetForModal.programNumber}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedSheetForModal(null)}
                  className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sections as strictly required by prompt Section 8 */}
              <div className="p-6 space-y-6 text-xs text-neutral-900">
                {/* 1. PRODUCTION INFORMATION */}
                <div className="border border-neutral-200 rounded-xl p-4 bg-neutral-50/50">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-3">
                    1. Production Information
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <span className="text-neutral-500 text-[10px] block">Sheet Serial #</span>
                      <span className="font-mono font-bold text-neutral-900">
                        {selectedSheetForModal.programSerialNo || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500 text-[10px] block">Program Number</span>
                      <span className="font-mono font-bold text-neutral-900">
                        {selectedSheetForModal.programNumber || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500 text-[10px] block">Wilcom Design #</span>
                      <span className="font-mono font-bold text-brand-900">
                        {selectedSheetForModal.wilcomDesignNumber || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500 text-[10px] block">Client Name</span>
                      <span className="font-bold text-neutral-900">
                        {selectedSheetForModal.clientName || selectedSheetForModal.buyerName || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500 text-[10px] block">Priority</span>
                      <span className="font-semibold text-neutral-900">
                        {selectedSheetForModal.priority || 'NORMAL'}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500 text-[10px] block">Main Style</span>
                      <span className="font-medium text-neutral-900">
                        {selectedSheetForModal.mainStyle || selectedSheetForModal.styleCode || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500 text-[10px] block">Sub Style</span>
                      <span className="font-medium text-neutral-900">
                        {selectedSheetForModal.subStyle || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500 text-[10px] block">Pattern</span>
                      <span className="font-medium text-neutral-900">
                        {selectedSheetForModal.pattern || '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. FABRIC INFORMATION */}
                <div className="border border-neutral-200 rounded-xl p-4 bg-neutral-50/50">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-3">
                    2. Fabric Information
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <span className="text-neutral-500 text-[10px] block">Main Fabric</span>
                      <span className="font-bold text-neutral-900">
                        {selectedSheetForModal.fabricName || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500 text-[10px] block">Fabric Type</span>
                      <span className="font-medium text-neutral-900">
                        {selectedSheetForModal.fabricType || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500 text-[10px] block">Fabric Width</span>
                      <span className="font-medium text-neutral-900">
                        {selectedSheetForModal.fabricWidth || (selectedSheetForModal.fabricWidthInches ? `${selectedSheetForModal.fabricWidthInches} Inches` : '—')}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500 text-[10px] block">Fabric Color</span>
                      <span className="font-bold text-accent-800">
                        {selectedSheetForModal.fabricColor || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500 text-[10px] block">Fabric Average</span>
                      <span className="font-medium text-neutral-900">
                        {selectedSheetForModal.fabricAverage || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500 text-[10px] block">Average Type</span>
                      <span className="font-medium text-neutral-900">
                        {selectedSheetForModal.fabricAverageType || 'Meters/Piece'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. DYEING INFORMATION */}
                <div className="border border-neutral-200 rounded-xl p-4 bg-neutral-50/50">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-3">
                    3. Dyeing Information
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <span className="text-neutral-500 text-[10px] block">Dyeing Required</span>
                      <span className="font-bold text-neutral-900">
                        {selectedSheetForModal.fabricDyeingRequired ? 'YES' : 'NO'}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500 text-[10px] block">Sent to Dyeing</span>
                      <span className="font-mono font-bold text-neutral-900">
                        {selectedSheetForModal.fabricSentToDyeing || selectedSheetForModal.fabricIssuedToDyeing || '0'} {selectedSheetForModal.quantityMeasurement || 'MTR'}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500 text-[10px] block">Target Color</span>
                      <span className="font-medium text-neutral-900">
                        {selectedSheetForModal.fabricColor || 'Standard'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. QUANTITY INFORMATION */}
                <div className="border border-neutral-200 rounded-xl p-4 bg-neutral-50/50">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-3">
                    4. Quantity Information
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <span className="text-neutral-500 text-[10px] block">Target Order Quantity</span>
                      <span className="font-mono font-bold text-neutral-900 text-sm">
                        {selectedSheetForModal.targetQuantity} {selectedSheetForModal.quantityMeasurement || 'PCS'}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500 text-[10px] block">Color Quantity</span>
                      <span className="font-mono font-bold text-neutral-900">
                        {selectedSheetForModal.colorQuantity || selectedSheetForModal.targetQuantity}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500 text-[10px] block">UOM</span>
                      <span className="font-medium text-neutral-900">
                        {selectedSheetForModal.quantityMeasurement || 'PCS'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 5. DELIVERY INFORMATION */}
                <div className="border border-neutral-200 rounded-xl p-4 bg-neutral-50/50">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-3">
                    5. Delivery Information
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <span className="text-neutral-500 text-[10px] block">Design Date</span>
                      <span className="font-medium text-neutral-900">
                        {selectedSheetForModal.productionDesignDate ? new Date(selectedSheetForModal.productionDesignDate).toLocaleDateString() : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500 text-[10px] block">Production End Date</span>
                      <span className="font-medium text-neutral-900">
                        {selectedSheetForModal.productionEndDate ? new Date(selectedSheetForModal.productionEndDate).toLocaleDateString() : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500 text-[10px] block">Delivery Date</span>
                      <span className="font-bold text-brand-900">
                        {selectedSheetForModal.deliveryDate ? new Date(selectedSheetForModal.deliveryDate).toLocaleDateString() : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-neutral-200 bg-neutral-50 rounded-b-2xl flex items-center justify-end">
                <button
                  onClick={() => setSelectedSheetForModal(null)}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold"
                >
                  Close Production Sheet
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 2: DYEING → QC1 CHALLAN DOCUMENT (VIEW, PRINT, DOWNLOAD)            */}
        {/* ========================================================================= */}
        {selectedChallanForView && (
          <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-neutral-200">
              {/* Document Actions Bar */}
              <div className="sticky top-0 bg-white text-neutral-900 p-4 sm:p-5 flex items-center justify-between z-10 print:hidden">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-accent-700" />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-700 block leading-tight">
                      DYEING → QC1 CHALLAN
                    </span>
                    <span className="font-mono text-sm font-bold">
                      {selectedChallanForView.challanNumber}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold transition"
                    title="Print Document"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print</span>
                  </button>

                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold transition"
                    title="Download PDF"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </button>

                  <button
                    onClick={() => setSelectedChallanForView(null)}
                    className="p-1.5 text-neutral-500 hover:text-neutral-900 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* PRINTABLE VOUCHER */}
              <div className="p-6 sm:p-8 space-y-6 text-neutral-900" id="qc1-challan-voucher">
                {/* Voucher Header */}
                <div className="flex items-start justify-between pb-4 border-b-2 border-neutral-200">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg border border-neutral-300 p-0.5 flex items-center justify-center shrink-0">
                      <img src="/shubham-logo.jpg" alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold tracking-[0.2em] text-accent-800 block">
                        SHUBHAM FABRICS INDIA PVT. LTD.
                      </span>
                      <h2 className="text-lg font-serif font-black text-neutral-900 tracking-wide mt-0.5">
                        DYEING → QC1 CHALLAN
                      </h2>
                      <p className="text-[11px] text-neutral-500">
                        Inter-department manufacturing transfer &amp; quality check dispatch slip
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    {renderBarcodeSvg(selectedChallanForView.challanNumber)}
                    <span className="text-[10px] text-neutral-500 block mt-1">
                      Date: {selectedChallanForView.issuedDate ? new Date(selectedChallanForView.issuedDate).toLocaleDateString() : new Date().toLocaleDateString()}
                    </span>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-neutral-100 text-neutral-900">
                      PRIORITY: {selectedChallanForView.priority}
                    </span>
                  </div>
                </div>

                {/* Routing & Genealogy Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-xs">
                  <div>
                    <span className="text-neutral-500 block text-[10px] font-bold uppercase">From Department</span>
                    <span className="font-bold text-neutral-900 text-sm">DYEING</span>
                    <span className="text-[10px] text-neutral-500 block">Processing Unit</span>
                  </div>

                  <div>
                    <span className="text-neutral-500 block text-[10px] font-bold uppercase">To Department</span>
                    <span className="font-bold text-accent-800 text-sm">QC1</span>
                    <span className="text-[10px] text-neutral-500 block">Quality Inspection</span>
                  </div>

                  <div>
                    <span className="text-neutral-500 block text-[10px] font-bold uppercase">Production Sheet</span>
                    <span className="font-mono font-bold text-neutral-900 text-sm">
                      {selectedChallanForView.productionSheetNumber}
                    </span>
                    <span className="text-[10px] text-neutral-500 block truncate">
                      {selectedChallanForView.clientName}
                    </span>
                    {selectedChallanForView.program && (
                      <div className="mt-1 flex items-center gap-1.5 print:hidden">
                        <button
                          type="button"
                          onClick={() => setSelectedSheetForModal(selectedChallanForView.program)}
                          className="text-[10px] font-bold text-brand-700 hover:text-brand-900 underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <Eye className="w-2.5 h-2.5" />
                          <span>View Sheet</span>
                        </button>
                        <span className="text-neutral-700">·</span>
                        <button
                          type="button"
                          onClick={() => printProductionSheet(selectedChallanForView.program)}
                          className="text-[10px] font-bold text-brand-700 hover:text-brand-900 underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <Printer className="w-2.5 h-2.5" />
                          <span>Print</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <span className="text-neutral-500 block text-[10px] font-bold uppercase">Dyeing Incharge</span>
                    <span className="font-semibold text-neutral-900 text-sm">
                      {selectedChallanForView.dyeingIncharge}
                    </span>
                    <span className="text-[10px] text-accent-800 block">✓ Digitally Dispatched</span>
                  </div>
                </div>

                {/* Items Transfer Table */}
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-700 mb-2">
                    Dispatched Material Items for Inspection
                  </h4>
                  <div className="border border-neutral-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-100 text-neutral-700 font-semibold border-b border-neutral-200">
                        <tr>
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Item Description</th>
                          <th className="py-2.5 px-3">Fabric Type</th>
                          <th className="py-2.5 px-3">Color</th>
                          <th className="py-2.5 px-3 text-right">Quantity</th>
                          <th className="py-2.5 px-3">UOM</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {(selectedChallanForView.items || []).map((it: any, idx: number) => (
                          <tr key={it.id || idx}>
                            <td className="py-2.5 px-3 font-mono text-neutral-500">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-medium text-neutral-900">{it.itemDescription}</td>
                            <td className="py-2.5 px-3 text-neutral-600">{it.fabricCode || 'KNIT'}</td>
                            <td className="py-2.5 px-3 font-semibold text-neutral-900">{it.colour || selectedChallanForView.color}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-neutral-900">{it.quantity}</td>
                            <td className="py-2.5 px-3">{it.uom || 'MTR'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>


                {/* Physical Signature Blocks */}
                <div className="pt-8 border-t border-neutral-200 grid grid-cols-2 gap-8 text-xs">
                  <div className="border-t border-dashed border-neutral-300 pt-2 text-center">
                    <span className="font-bold text-neutral-900 block">Dyeing Department</span>
                    <span className="text-[10px] text-neutral-500">Authorized Issuer: {selectedChallanForView.dyeingIncharge}</span>
                  </div>
                  <div className="border-t border-dashed border-neutral-300 pt-2 text-center">
                    <span className="font-bold text-neutral-900 block">QC1 Quality Department</span>
                    <span className="text-[10px] text-neutral-500">
                      Receiver / Quality Inspector Stamp &amp; Signature
                    </span>
                  </div>
                </div>
              </div>

              {/* Close Button Footer */}
              <div className="p-4 border-t border-neutral-200 bg-neutral-50 rounded-b-2xl flex items-center justify-between print:hidden">
                <Link
                  href={`/challans/${selectedChallanForView.id}`}
                  className="text-xs text-brand-700 hover:text-brand-900 font-semibold flex items-center gap-1"
                >
                  <span>Open Full-Screen Challan Voucher</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>

                <button
                  onClick={() => setSelectedChallanForView(null)}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold"
                >
                  Close Document
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 3: QC1 QUALITY INSPECTION FORM                                      */}
        {/* ========================================================================= */}
        {selectedChallanForInspect && (
          <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-neutral-200">
              <form onSubmit={handleInspectionSubmit}>
                {/* Header */}
                <div className="sticky top-0 bg-white text-neutral-900 p-4 sm:p-5 flex items-center justify-between z-10">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-700 block">
                      QC1 · QUALITY INSPECTION ENTRY
                    </span>
                    <h3 className="text-base font-bold">
                      Inspect Lot: {selectedChallanForInspect.challanNumber}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedChallanForInspect(null)}
                    className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Form Body */}
                <div className="p-6 space-y-5 text-xs text-neutral-900">
                  {/* SUCCESS BANNER */}
                  {inspectionSuccess && (
                    <div className="p-4 bg-accent-50 border border-accent-300 rounded-xl space-y-3">
                      <div className="flex items-center gap-2 text-accent-800 font-bold text-sm">
                        <CheckCircle2 className="w-5 h-5 text-accent-700" />
                        <span>QC1 Inspection Successfully Recorded!</span>
                      </div>
                      <p className="text-accent-800 text-xs">
                        Inspection Outcome: <strong className="uppercase">{inspectionSuccess.inspection?.status}</strong>.
                        Metrics, defect logs, and production balances have been transactionally committed to the database.
                      </p>

                      {/* PASS ROUTING CONFIRMATION */}
                      {(inspectionSuccess.inspection?.status === 'PASS' || (Number(inspectionSuccess.productionTransaction?.goodQuantity || 0) > 0)) && (
                        <div className="p-3 bg-accent-100/70 border border-accent-300 rounded-lg text-accent-800 text-xs">
                          <span className="font-bold flex items-center gap-1.5 text-accent-800">
                            <CheckCircle2 className="w-4 h-4 text-accent-800" />
                            Material Passed QC1 Inspection → Dispatched to Next Department
                          </span>
                          <p className="text-[11px] text-accent-800 mt-0.5">
                            Passed Yardage: <strong>{inspectionSuccess.productionTransaction?.goodQuantity || 0} {selectedChallanForInspect.uom}</strong>. The lot is approved for downstream manufacturing (Cutting Floor).
                          </p>
                        </div>
                      )}

                      {/* REWORK ROUTING CONFIRMATION (TO DYEING) */}
                      {inspectionSuccess.reworkReturnChallan && (
                        <div className="p-3 bg-brand-50 border border-brand-300 rounded-lg text-brand-900 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold flex items-center gap-1.5 text-brand-900">
                              <RotateCcw className="w-4 h-4 text-brand-700" />
                              Rework Return Challan Generated → Dispatched to Dyeing Department
                            </span>
                            <Link
                              href={`/challans/${inspectionSuccess.reworkReturnChallan.id}`}
                              target="_blank"
                              className="text-[11px] underline font-bold text-brand-800 hover:text-brand-900 flex items-center gap-1"
                            >
                              <span>Print Challan</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          </div>
                          <span className="font-mono font-bold text-sm text-brand-900 block mt-1">
                            {inspectionSuccess.reworkReturnChallan.challanNumber}
                          </span>
                          <p className="text-[11px] text-brand-700 mt-0.5">
                            Rework Yardage: <strong>{inspectionSuccess.productionTransaction?.reworkQuantity || 0} {selectedChallanForInspect.uom}</strong>. This Challan is routed back to the <strong>Dyeing Department</strong> for re-dyeing and shade alteration.
                          </p>
                        </div>
                      )}

                      {/* REJECT ROUTING CONFIRMATION (TO STORE DEFECTIVE SHELF) */}
                      {inspectionSuccess.rejectReturnChallan && (
                        <div className="p-3 bg-danger-50 border border-danger-300 rounded-lg text-danger-900 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold flex items-center gap-1.5 text-danger-900">
                              <ShieldAlert className="w-4 h-4 text-danger-700" />
                              Defective Return Challan Generated → Dispatched to Fabric Store (Defective Shelf)
                            </span>
                            <Link
                              href={`/challans/${inspectionSuccess.rejectReturnChallan.id}`}
                              target="_blank"
                              className="text-[11px] underline font-bold text-danger-800 hover:text-danger-900 flex items-center gap-1"
                            >
                              <span>Print Challan</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          </div>
                          <span className="font-mono font-bold text-sm text-danger-900 block mt-1">
                            {inspectionSuccess.rejectReturnChallan.challanNumber}
                          </span>
                          <p className="text-[11px] text-danger-700 mt-0.5">
                            Defective Yardage: <strong>{inspectionSuccess.productionTransaction?.rejectQuantity || 0} {selectedChallanForInspect.uom}</strong>. This material is officially transferred to the <strong>defective shelf in the Fabric Store</strong>.
                          </p>
                        </div>
                      )}

                      <div className="pt-2 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => setSelectedChallanForInspect(null)}
                          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                        >
                          Close &amp; Return to Workspace
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ERROR BANNER */}
                  {inspectionError && (
                    <div className="p-3 bg-danger-50 border border-danger-200 text-danger-800 rounded-xl flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-danger-600" />
                      <span>{inspectionError}</span>
                    </div>
                  )}

                  {!inspectionSuccess && (
                    <>
                      {/* SEE CHALLAN + PRODUCTION SHEET ACTION BAR AS PER HANDWRITTEN SPEC */}
                      <div className="p-3 bg-neutral-100 border border-neutral-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-accent-800" />
                          <span className="text-xs font-bold text-neutral-900">
                            See Challan + Production sheet
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedChallanForView(selectedChallanForInspect)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-neutral-50 border border-neutral-300 text-neutral-900 rounded-lg text-xs font-bold transition shadow-2xs"
                          >
                            <FileText className="w-3.5 h-3.5 text-brand-600" />
                            <span>See Challan Slip</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedSheetForModal(selectedChallanForInspect.program)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 border border-brand-300 text-brand-900 rounded-lg text-xs font-bold transition shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5 text-brand-700" />
                            <span>See Production Sheet</span>
                          </button>
                        </div>
                      </div>

                      {/* SECTION 1: AUTO-LOADED PRODUCTION DETAILS */}
                      <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
                          Production Information
                        </span>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div>
                            <span className="text-neutral-500 text-[10px] block">Production Sheet</span>
                            <span className="font-mono font-bold text-neutral-900">
                              {selectedChallanForInspect.productionSheetNumber}
                            </span>
                          </div>

                          <div>
                            <span className="text-neutral-500 text-[10px] block">Dyeing Challan</span>
                            <span className="font-mono font-bold text-brand-900">
                              {selectedChallanForInspect.challanNumber}
                            </span>
                          </div>

                          <div>
                            <span className="text-neutral-500 text-[10px] block">Fabric</span>
                            <span className="font-semibold text-neutral-900 truncate block">
                              {selectedChallanForInspect.fabric}
                            </span>
                          </div>

                          <div>
                            <span className="text-neutral-500 text-[10px] block">Expected Color</span>
                            <span className="font-bold text-neutral-900">
                              {selectedChallanForInspect.color}
                            </span>
                          </div>

                          <div>
                            <span className="text-neutral-500 text-[10px] block">Quantity Received</span>
                            <span className="font-mono font-bold text-neutral-900 text-sm">
                              {selectedChallanForInspect.totalSentQuantity} {selectedChallanForInspect.uom}
                            </span>
                          </div>

                          <div>
                            <span className="text-neutral-500 text-[10px] block">Dyeing Incharge</span>
                            <span className="font-medium text-neutral-900">
                              {selectedChallanForInspect.dyeingIncharge}
                            </span>
                          </div>

                          <div>
                            <span className="text-neutral-500 text-[10px] block">Inspection Date</span>
                            <span className="font-medium text-neutral-900">
                              {new Date().toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {selectedChallanForInspect.remarks?.includes('Shrinkage:') && (
                          <div className="mt-2.5 p-2.5 bg-accent-50 border border-accent-200/90 rounded-lg flex items-center justify-between text-xs">
                            <span className="text-accent-800 font-semibold flex items-center gap-2">
                              <span>Dyeing Process Shrinkage:</span>
                              <span className="font-mono font-bold text-accent-800">
                                {selectedChallanForInspect.remarks.match(/Shrinkage:\s*([^\s·|]+)\s*MTR/i)?.[0] || 'Reported'}
                              </span>
                            </span>
                            <span className="text-[10px] text-accent-800 bg-accent-100/90 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                              Verified in Net Meters ({selectedChallanForInspect.totalSentQuantity} {selectedChallanForInspect.uom})
                            </span>
                          </div>
                        )}
                      </div>

                      {/* SECTION 2: QUANTITY BREAKDOWN INPUTS */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-700">
                            Inspection Yardage Breakdown ({selectedChallanForInspect.uom})
                          </h4>
                          <span className="text-[10px] text-neutral-500 font-mono">
                            Available: {selectedChallanForInspect.totalSentQuantity} {selectedChallanForInspect.uom}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {/* Quantity Inspected */}
                          <div className="col-span-2 sm:col-span-1">
                            <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                              Quantity Inspected *
                            </label>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              max={selectedChallanForInspect.totalSentQuantity}
                              value={inspectionForm.quantityInspected}
                              onChange={(e) => {
                                const val = e.target.value;
                                setInspectionForm({
                                  ...inspectionForm,
                                  quantityInspected: val,
                                  quantityPassed: inspectionForm.result === 'PASS' ? val : '0',
                                  quantityFailed: inspectionForm.result === 'REJECT' ? val : '0',
                                  quantityRework: inspectionForm.result === 'REWORK' ? val : '0',
                                });
                              }}
                              className="w-full px-3 py-2 border border-neutral-300 rounded-lg font-mono font-bold text-sm text-neutral-900 focus:ring-1 focus:ring-brand-500/40 focus:outline-none"
                              required
                            />
                          </div>

                          {/* Passed Quantity */}
                          <div>
                            <label className="block text-[11px] font-bold text-accent-800 mb-1 flex items-center justify-between">
                              <span>Passed Qty</span>
                              <span className="text-[9px] text-accent-800 bg-accent-100 px-1 py-0.2 rounded">Embroidery</span>
                            </label>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={inspectionForm.quantityPassed}
                              onChange={(e) =>
                                setInspectionForm({ ...inspectionForm, quantityPassed: e.target.value })
                              }
                              className="w-full px-3 py-2 border border-accent-300 rounded-lg font-mono font-bold text-sm text-accent-800 bg-accent-50/20 focus:ring-1 focus:ring-brand-500/40 focus:outline-none"
                            />
                          </div>

                          {/* Rework Quantity */}
                          <div>
                            <label className="block text-[11px] font-bold text-brand-800 mb-1 flex items-center justify-between">
                              <span>Rework Qty</span>
                              <span className="text-[9px] text-brand-700 bg-brand-100 px-1 py-0.2 rounded">To Dyeing</span>
                            </label>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={inspectionForm.quantityRework}
                              onChange={(e) =>
                                setInspectionForm({ ...inspectionForm, quantityRework: e.target.value })
                              }
                              className="w-full px-3 py-2 border border-brand-300 rounded-lg font-mono font-bold text-sm text-brand-900 bg-brand-50/20 focus:ring-1 focus:ring-brand-500 focus:outline-none"
                            />
                          </div>

                          {/* Rejected Quantity */}
                          <div>
                            <label className="block text-[11px] font-bold text-danger-800 mb-1 flex items-center justify-between">
                              <span>Rejected Qty</span>
                              <span className="text-[9px] text-danger-700 bg-danger-100 px-1 py-0.2 rounded">Defective Shelf</span>
                            </label>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={inspectionForm.quantityFailed}
                              onChange={(e) =>
                                setInspectionForm({ ...inspectionForm, quantityFailed: e.target.value })
                              }
                              className="w-full px-3 py-2 border border-danger-300 rounded-lg font-mono font-bold text-sm text-danger-900 bg-danger-50/20 focus:ring-1 focus:ring-danger-500 focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Physical Length & Shrinkage Verification */}
                        <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              id="shrinkageVerifyCheck"
                              defaultChecked
                              className="w-4 h-4 text-accent-700 rounded border-neutral-300 focus:ring-brand-500/40 cursor-pointer"
                            />
                            <label htmlFor="shrinkageVerifyCheck" className="text-xs font-semibold text-neutral-900 cursor-pointer">
                              Verify Process Shrinkage &amp; Physical Roll Meterage
                            </label>
                          </div>
                          <span className="text-[10px] font-bold text-accent-800 bg-accent-100 px-2 py-0.5 rounded">
                            Audited: {selectedChallanForInspect.totalSentQuantity} {selectedChallanForInspect.uom}
                          </span>
                        </div>
                      </div>

                      {/* SECTION 3: THREE DECISION PATHWAYS (PASS / REWORK / REJECT) AS PER HANDWRITTEN DIAGRAM */}
                      <div className="space-y-3 pt-2 border-t border-neutral-200">
                        <label className="block text-xs font-bold text-neutral-900 uppercase tracking-wide">
                          Inspection Decision
                        </label>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {/* 1. PASS */}
                          <button
                            type="button"
                            onClick={() => {
                              const total = inspectionForm.quantityInspected || '0';
                              setInspectionForm({
                                ...inspectionForm,
                                result: 'PASS',
                                quantityPassed: total,
                                quantityFailed: '0',
                                quantityRework: '0',
                                quantityHold: '0',
                              });
                            }}
                            className={`p-4 rounded-xl border-2 text-left transition flex flex-col justify-between ${
                              inspectionForm.result === 'PASS'
                                ? 'border-accent-500 bg-accent-50/80 text-accent-800 font-bold shadow-xs ring-2 ring-accent-500/30'
                                : 'border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-black tracking-wide flex items-center gap-1.5 text-accent-800">
                                  <CheckCircle2 className="w-4 h-4 text-accent-700 shrink-0" />
                                  1. PASS
                                </span>
                              </div>
                              <p className="text-xs text-accent-800 font-semibold mt-1">
                                Dispatches to Embroidery Department
                              </p>
                              <span className="text-[10px] text-accent-800 block mt-0.5">
                                Generates QC1 → Embroidery Dispatch Challan
                              </span>
                            </div>
                          </button>

                          {/* 2. REWORK */}
                          <button
                            type="button"
                            onClick={() => {
                              const total = inspectionForm.quantityInspected || '0';
                              setInspectionForm({
                                ...inspectionForm,
                                result: 'REWORK',
                                quantityRework: total,
                                quantityPassed: '0',
                                quantityFailed: '0',
                                quantityHold: '0',
                              });
                            }}
                            className={`p-4 rounded-xl border-2 text-left transition flex flex-col justify-between ${
                              inspectionForm.result === 'REWORK'
                                ? 'border-brand-500 bg-brand-50/80 text-brand-900 font-bold shadow-xs ring-2 ring-brand-500/30'
                                : 'border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-black tracking-wide flex items-center gap-1.5 text-brand-800">
                                  <RotateCcw className="w-4 h-4 text-brand-600 shrink-0" />
                                  2. REWORK
                                </span>
                              </div>
                              <p className="text-xs text-brand-900 font-semibold mt-1">
                                Returns material to Dyeing
                              </p>
                              <span className="text-[10px] text-brand-700 block mt-0.5">
                                Must re-undergo QC1 inspection before reaching Embroidery
                              </span>
                            </div>
                          </button>

                          {/* 3. REJECT */}
                          <button
                            type="button"
                            onClick={() => {
                              const total = inspectionForm.quantityInspected || '0';
                              setInspectionForm({
                                ...inspectionForm,
                                result: 'REJECT',
                                quantityFailed: total,
                                quantityPassed: '0',
                                quantityRework: '0',
                                quantityHold: '0',
                              });
                            }}
                            className={`p-4 rounded-xl border-2 text-left transition flex flex-col justify-between ${
                              inspectionForm.result === 'REJECT'
                                ? 'border-danger-500 bg-danger-50/80 text-danger-900 font-bold shadow-xs ring-2 ring-danger-500/30'
                                : 'border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-black tracking-wide flex items-center gap-1.5 text-danger-800">
                                  <ShieldAlert className="w-4 h-4 text-danger-600 shrink-0" />
                                  3. REJECT
                                </span>
                              </div>
                              <p className="text-xs text-danger-900 font-semibold mt-1">
                                Fabric Store Defective Shelf
                              </p>
                              <span className="text-[10px] text-danger-700 block mt-0.5">
                                Barred from Embroidery approved stock
                              </span>
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* REMARKS INPUT FOR CHOSEN OUTCOME */}
                      <div className="space-y-1.5 pt-1">
                        <label className="block text-xs font-bold text-neutral-900">
                          QC Incharge Remark <span className="text-danger-600">*</span>
                        </label>
                        <textarea
                          rows={2}
                          value={inspectionForm.remarks}
                          onChange={(e) =>
                            setInspectionForm({ ...inspectionForm, remarks: e.target.value })
                          }
                          required
                          placeholder=""
                          className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs focus:ring-1 focus:ring-brand-500/40 focus:outline-none"
                        />
                      </div>

                      {/* QC1 - INCHARGE (NAME / CONTACT) AS PER HANDWRITTEN SPEC */}
                      <div className="pt-3 border-t border-neutral-200">
                        <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                          QC1 - Incharge (Name / Contact)
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={currentUser?.fullName || currentUser?.username || ''}
                            onChange={(e) => {}}
                            placeholder=""
                            className="w-full text-xs font-medium border border-neutral-300 rounded-lg px-3 py-2 bg-white"
                          />
                          <input
                            type="text"
                            defaultValue=""
                            placeholder=""
                            className="w-full text-xs font-mono border border-neutral-300 rounded-lg px-3 py-2 bg-white"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Footer Buttons */}
                {!inspectionSuccess && (
                  <div className="p-4 border-t border-neutral-200 bg-neutral-50 rounded-b-2xl flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setSelectedChallanForInspect(null)}
                      className="px-4 py-2 border border-neutral-300 text-neutral-700 hover:bg-neutral-100 rounded-lg text-xs font-semibold"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={submittingInspection}
                      className="flex items-center gap-1.5 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                    >
                      {submittingInspection ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-accent-700" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>{submittingInspection ? 'Submitting Inspection...' : 'Submit Inspection'}</span>
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>
        )}
      </main>

      {/* ACCOMPANYING PRODUCTION SHEET PREVIEW & PRINT MODAL */}
      {selectedSheetForModal && (
        <ProductionSheetPrintModal
          program={selectedSheetForModal}
          isOpen={Boolean(selectedSheetForModal)}
          onClose={() => setSelectedSheetForModal(null)}
        />
      )}
    </div>
  );
}
