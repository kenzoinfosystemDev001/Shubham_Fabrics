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
  Scissors,
  PackageCheck,
  Archive,
  TrendingDown,
  Kanban,
  Waves,
  Send,
  Sparkles,
  Droplets,
  Check,
  Scale
} from 'lucide-react';
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';
import { DocumentActionButtons } from '@/components/common/DocumentActionButtons';
import { ChallanNumberInput, getChallanNumberError } from '@/components/challan/ChallanNumberInput';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';
import { downloadChallanHtml, printChallan } from '@/lib/download-challan';
import { downloadProductionSheetHtml, printProductionSheet } from '@/lib/download-production-sheet';
import { DepartmentDefectiveShelfWidget } from '@/components/DepartmentDefectiveShelfWidget';

interface WashingQCChallan {
  id: string;
  challanNumber: string;
  challanType: string;
  fromDepartment: string;
  toDepartment: string;
  status: string;
  priority: string;
  issuedDate: string | null;
  receivedDate: string | null;
  createdAt: string;
  remarks: string | null;
  programId: string;
  program?: {
    id: string;
    programNumber: string;
    programSerialNo?: string | null;
    clientName?: string | null;
    buyerName?: string | null;
    styleCode?: string | null;
    mainStyle?: string | null;
    fabricName?: string | null;
    fabricType?: string | null;
    fabricColor?: string | null;
    targetQuantity?: number | null;
    deliveryDate?: string | null;
    wilcomDesignNumber?: string | null;
  };
  items: any[];
  issuedBy?: { fullName: string; username: string };
  receivedBy?: { fullName: string; username: string };
  inspections?: any[];
}

export default function WashingQCMyWorkPage() {
  const searchParams = useSearchParams();
  const highlightChallanId = searchParams.get('challanId');

  const [activeTab, setActiveTab] = useState<
    'INCOMING' | 'DEFECTED_SHELF' | 'REWORK_HISTORY' | 'PRODUCTION_SHEETS'
  >('INCOMING');
  const [challans, setChallans] = useState<WashingQCChallan[]>([]);
  const [defectiveReturns, setDefectiveReturns] = useState<any[]>([]);
  const [reworkReturns, setReworkReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals & Inspection Form
  const [selectedChallanForInspect, setSelectedChallanForInspect] = useState<WashingQCChallan | null>(null);
  const [selectedChallanForView, setSelectedChallanForView] = useState<WashingQCChallan | null>(null);
  const [selectedSheetForView, setSelectedSheetForView] = useState<any | null>(null);
  const [issuingToFinishing, setIssuingToFinishing] = useState<WashingQCChallan | null>(null);
  const [finishingChallanModal, setFinishingChallanModal] = useState<any | null>(null);
  const [inspectionResultModal, setInspectionResultModal] = useState<any | null>(null);

  // Inspection Form State
  const [inspectionForm, setInspectionForm] = useState({
    quantityInspected: '',
    quantityPassed: '',
    quantityFailed: '0',
    quantityRework: '0',
    quantityHold: '0',
    result: 'PASS',
    defectRemarks: '',
    reworkReason: '',
    holdReason: '',
    remarks: '',
    defects: [] as Array<{
      defectCode: string;
      defectType: string;
      severity: string;
      quantity: number;
      location: string;
      remarks: string;
    }>,
    parameters: [
      {
        parameterName: 'Wash Quality & Cleanliness',
        standardValue: 'No dirt, wash marks, oil stains, or surfactant residue',
        observedValue: 'Clean & Uniform',
        passed: true,
        remarks: 'Washed cleanly',
      },
      {
        parameterName: 'Hand Feel & Fabric Softness',
        standardValue: 'Soft, conditioned hand-feel per buyer standard',
        observedValue: 'Soft Handfeel Passed',
        passed: true,
        remarks: 'Optimal softener absorption',
      },
      {
        parameterName: 'Shrinkage & Dimensional Tolerance',
        standardValue: 'Length & Width within +/- 3.0%',
        observedValue: 'Within 2.0% tolerance',
        passed: true,
        remarks: 'Tumble dry shrinkage controlled',
      },
      {
        parameterName: 'Color Fastness & Bleed',
        standardValue: 'No color bleeding or cross-staining on trims/panels',
        observedValue: 'Fastness Grade 4+',
        passed: true,
        remarks: 'No bleeding detected',
      },
      {
        parameterName: 'Seam & Stitch Integrity Post-Wash',
        standardValue: 'No seam puckering, broken threads, or edge fraying',
        observedValue: 'Seams Intact & Flat',
        passed: true,
        remarks: 'No seam distortion',
      },
      {
        parameterName: 'Neutralization & pH / Odor',
        standardValue: 'No residual chemical or sour odor, pH neutral (6.5-7.5)',
        observedValue: 'Neutral Fresh Scent',
        passed: true,
        remarks: 'Neutralized and dried thoroughly',
      },
    ],
  });

  const [submittingAction, setSubmittingAction] = useState(false);
  // Manually entered challan numbers (never generated by the system)
  const [passChallanNumber, setPassChallanNumber] = useState('');
  const [reworkChallanNumber, setReworkChallanNumber] = useState('');
  const [challanNumberErrors, setChallanNumberErrors] = useState<{ pass?: string | null; rework?: string | null }>({});
  const [handoverChallanNumber, setHandoverChallanNumber] = useState('');
  const [handoverChallanNumberError, setHandoverChallanNumberError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const loadData = async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);

      const [cRes, dRes] = await Promise.all([
        fetch('/api/washing-qc/challans'),
        fetch('/api/washing-qc/dashboard'),
      ]);

      if (!cRes.ok || !dRes.ok) {
        throw new Error('Failed to load Washing QC data');
      }

      const cData = await cRes.json();
      const dData = await dRes.json();

      setChallans(cData.data || []);
      setDefectiveReturns(dData.data?.defectiveReturns || []);
      setReworkReturns(dData.data?.reworkReturns || []);
      setLastSyncTime(new Date());
    } catch (err: any) {
      console.error('Error fetching Washing QC data:', err);
      setError(err.message || 'Error connecting to database');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('subham_mes_user');
      if (savedUser) {
        try {
          setCurrentUser(JSON.parse(savedUser));
        } catch {}
      }
    }

    const tabParam = searchParams.get('tab');
    if (tabParam === 'DEFECTED_SHELF') setActiveTab('DEFECTED_SHELF');
    else if (tabParam === 'REWORK_HISTORY') setActiveTab('REWORK_HISTORY');
    else if (tabParam === 'PRODUCTION_SHEETS') setActiveTab('PRODUCTION_SHEETS');
    else setActiveTab('INCOMING');

    loadData(true);

    // Live Real-Time Auto-Syncing every 4 seconds
    const interval = setInterval(() => {
      loadData(false);
    }, 4000);

    return () => clearInterval(interval);
  }, [searchParams]);

  // Auto-select highlight challan if URL contains ?challanId=...
  useEffect(() => {
    if (highlightChallanId && challans.length > 0) {
      const found = challans.find((c) => c.id === highlightChallanId);
      if (found) {
        if (found.status === 'ISSUED') {
          handleReceiveChallan(found);
        } else if (found.status === 'RECEIVED' || found.status === 'UNDER_INSPECTION') {
          handleOpenInspectModal(found);
        }
      }
    }
  }, [highlightChallanId, challans]);

  // Action: Receive Challan
  const handleReceiveChallan = async (challan: WashingQCChallan) => {
    try {
      setSubmittingAction(true);
      const res = await fetch(`/api/washing-qc/challans/${challan.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverId: currentUser?.id,
          notes: 'Received at Washing QC terminal for verification.',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to receive challan.');
      }

      showToast(`Challan ${challan.challanNumber} received successfully!`);
      loadData(false);
    } catch (err: any) {
      alert(`Error receiving challan: ${err.message}`);
    } finally {
      setSubmittingAction(false);
    }
  };

  // Action: Open Inspect Modal
  const handleOpenInspectModal = async (challan: WashingQCChallan) => {
    // If not yet under inspection, start inspection
    if (challan.status === 'RECEIVED') {
      try {
        await fetch(`/api/washing-qc/challans/${challan.id}/start-inspection`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inspectorId: currentUser?.id,
            notes: 'Inspection commenced on inspection table.',
          }),
        });
      } catch {}
    }

    const totalQty = challan.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);

    setInspectionForm({
      quantityInspected: String(totalQty),
      quantityPassed: String(totalQty),
      quantityFailed: '0',
      quantityRework: '0',
      quantityHold: '0',
      result: 'PASS',
      defectRemarks: '',
      reworkReason: '',
      holdReason: '',
      remarks: 'All pieces inspected post-wash. Dimensions, hand-feel & cleanliness approved.',
      defects: [],
      parameters: [
        {
          parameterName: 'Wash Quality & Cleanliness',
          standardValue: 'No dirt, wash marks, oil stains, or surfactant residue',
          observedValue: 'Clean & Uniform',
          passed: true,
          remarks: 'Washed cleanly',
        },
        {
          parameterName: 'Hand Feel & Fabric Softness',
          standardValue: 'Soft, conditioned hand-feel per buyer standard',
          observedValue: 'Soft Handfeel Passed',
          passed: true,
          remarks: 'Optimal softener absorption',
        },
        {
          parameterName: 'Shrinkage & Dimensional Tolerance',
          standardValue: 'Length & Width within +/- 3.0%',
          observedValue: 'Within 2.0% tolerance',
          passed: true,
          remarks: 'Tumble dry shrinkage controlled',
        },
        {
          parameterName: 'Color Fastness & Bleed',
          standardValue: 'No color bleeding or cross-staining on trims/panels',
          observedValue: 'Fastness Grade 4+',
          passed: true,
          remarks: 'No bleeding detected',
        },
        {
          parameterName: 'Seam & Stitch Integrity Post-Wash',
          standardValue: 'No seam puckering, broken threads, or edge fraying',
          observedValue: 'Seams Intact & Flat',
          passed: true,
          remarks: 'No seam distortion',
        },
        {
          parameterName: 'Neutralization & pH / Odor',
          standardValue: 'No residual chemical or sour odor, pH neutral (6.5-7.5)',
          observedValue: 'Neutral Fresh Scent',
          passed: true,
          remarks: 'Neutralized and dried thoroughly',
        },
      ],
    });

    setPassChallanNumber('');
    setReworkChallanNumber('');
    setChallanNumberErrors({});
    setSelectedChallanForInspect(challan);
  };

  // Auto-calculate Passed Qty when Inspected, Failed, Rework, Hold change
  const handleQuantityChange = (field: string, val: string) => {
    setInspectionForm((prev) => {
      const next = { ...prev, [field]: val };
      const qInspected = Number(field === 'quantityInspected' ? val : next.quantityInspected) || 0;
      const qFailed = Number(field === 'quantityFailed' ? val : next.quantityFailed) || 0;
      const qRework = Number(field === 'quantityRework' ? val : next.quantityRework) || 0;
      const qHold = Number(field === 'quantityHold' ? val : next.quantityHold) || 0;

      const remainingPassed = Math.max(0, qInspected - qFailed - qRework - qHold);
      next.quantityPassed = String(remainingPassed);

      // Auto-update result enum
      if (qFailed > 0 && remainingPassed === 0 && qRework === 0) {
        next.result = 'REJECT';
      } else if (qRework > 0 && remainingPassed === 0 && qFailed === 0) {
        next.result = 'REWORK';
      } else if (qHold > 0 && remainingPassed === 0) {
        next.result = 'HOLD';
      } else {
        next.result = 'PASS';
      }

      return next;
    });
  };

  // Add Defect Row
  const handleAddDefect = () => {
    setInspectionForm((prev) => ({
      ...prev,
      defects: [
        ...prev.defects,
        {
          defectCode: 'WASH_STAINS',
          defectType: 'Wash Stains / Chemical Marks',
          severity: 'MAJOR',
          quantity: 1,
          location: 'Front Panel',
          remarks: 'Residual stain from wash cycle',
        },
      ],
    }));
  };

  const handleRemoveDefect = (idx: number) => {
    setInspectionForm((prev) => ({
      ...prev,
      defects: prev.defects.filter((_, i) => i !== idx),
    }));
  };

  // Submit Inspection
  const handleSubmitInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChallanForInspect || submittingAction) return;

    const qPassed = Number(inspectionForm.quantityPassed) || 0;
    const qRework = Number(inspectionForm.quantityRework) || 0;
    const needsPassChallan = inspectionForm.result === 'PASS' && qPassed > 0;
    const needsReworkChallan = qRework > 0;
    const numberErrors = {
      pass: needsPassChallan ? getChallanNumberError(passChallanNumber, 'Challan Number (passed material to Recutting)') : null,
      rework: needsReworkChallan ? getChallanNumberError(reworkChallanNumber, 'Challan Number (rework return)') : null,
    };
    if (!numberErrors.pass && !numberErrors.rework && needsPassChallan && needsReworkChallan
      && passChallanNumber.trim().toLowerCase() === reworkChallanNumber.trim().toLowerCase()) {
      numberErrors.rework = 'Rework challan number must be different from the pass challan number.';
    }
    setChallanNumberErrors(numberErrors);
    if (numberErrors.pass || numberErrors.rework) return;

    try {
      setSubmittingAction(true);

      const payload = {
        quantityInspected: Number(inspectionForm.quantityInspected),
        quantityPassed: Number(inspectionForm.quantityPassed),
        quantityFailed: Number(inspectionForm.quantityFailed),
        quantityRework: Number(inspectionForm.quantityRework),
        quantityHold: Number(inspectionForm.quantityHold),
        result: inspectionForm.result,
        defectRemarks: inspectionForm.defectRemarks,
        reworkReason: inspectionForm.reworkReason,
        holdReason: inspectionForm.holdReason,
        remarks: inspectionForm.remarks,
        parameters: inspectionForm.parameters,
        defects: inspectionForm.defects,
        passChallanNumber: needsPassChallan ? passChallanNumber.trim() : undefined,
        reworkChallanNumber: needsReworkChallan ? reworkChallanNumber.trim() : undefined,
        inspectorId: currentUser?.id,
      };

      const res = await fetch(`/api/washing-qc/challans/${selectedChallanForInspect.id}/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok && data.field === 'challanNumber') {
        const message = String(data.error || '');
        setChallanNumberErrors(/rework/i.test(message) ? { rework: message } : needsPassChallan ? { pass: message } : { rework: message });
        return;
      }
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit inspection.');
      }

      setSelectedChallanForInspect(null);
      setInspectionResultModal(data);
      showToast(`Verification completed! Status: ${data.data.status}`);
      loadData(false);
    } catch (err: any) {
      alert(`Error submitting inspection: ${err.message}`);
    } finally {
      setSubmittingAction(false);
    }
  };

  // Action: Issue Handover Challan to Finishing
  const openIssueToFinishing = (challan: WashingQCChallan) => {
    setIssuingToFinishing(challan);
    setHandoverChallanNumber('');
    setHandoverChallanNumberError(null);
  };

  const handleIssueToFinishing = async (challan: WashingQCChallan) => {
    if (submittingAction) return;
    const numberError = getChallanNumberError(handoverChallanNumber);
    setHandoverChallanNumberError(numberError);
    if (numberError) return;
    const challanNumber = handoverChallanNumber.trim();
    try {
      setSubmittingAction(true);
      const goodQty = challan.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
      const barcode = challan.items?.[0]?.barcode || `QCW-${new Date().getFullYear()}-0001`;

      const res = await fetch('/api/challans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challanNumber,
          challanType: 'REGULAR',
          programId: challan.programId,
          fromDepartment: 'WASHING_QC',
          toDepartment: 'RECUTTING',
          priority: challan.priority || 'NORMAL',
          remarks: `Washing QC Passed pieces handover to Recutting Section for embroidery precision cutting. Barcode: ${barcode}`,
          items: [
            {
              itemDescription: `${challan.program?.fabricName || 'Garment Pieces'} - Washing QC Passed & Verified for Recutting`,
              fabricCode: 'PIECE',
              colour: challan.program?.fabricColor || 'Standard',
              quantity: goodQty,
              uom: 'PCS',
              unitType: 'PCS',
              barcode: barcode,
              remarks: `Washing QC verification passed. Approved for Embroidery Recutting.`,
            },
          ],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.field === 'challanNumber') {
          setHandoverChallanNumberError(data.error);
          return;
        }
        throw new Error(data.error || 'Failed to issue challan to Finishing.');
      }
      // POST /api/challans returns the created challan itself.
      const created = data.data || data;

      // Mark original as HANDED_OVER / CLOSED
      await fetch(`/api/challans/${challan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'HANDED_OVER' }),
      }).catch(() => {});

      setIssuingToFinishing(null);
      setHandoverChallanNumber('');
      setFinishingChallanModal(created);
      showToast(`Challan ${created.challanNumber} issued to Finishing Section successfully!`);
      loadData(false);
    } catch (err: any) {
      alert(`Error issuing to Finishing: ${err.message}`);
    } finally {
      setSubmittingAction(false);
    }
  };

  // Filtered Challans
  const filteredChallans = useMemo(() => {
    return challans.filter((c) => {
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'PENDING' && ['ISSUED', 'RECEIVED'].includes(c.status)) ||
        (statusFilter === 'IN_PROCESS' && c.status === 'UNDER_INSPECTION') ||
        (statusFilter === 'APPROVED' && ['QC_APPROVED', 'COMPLETED', 'HANDED_OVER'].includes(c.status)) ||
        (statusFilter === 'REWORK' && ['REWORK_REQUESTED', 'REWORK'].includes(c.status)) ||
        (statusFilter === 'REJECTED' && c.status === 'QC_REJECTED');

      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.challanNumber.toLowerCase().includes(q) ||
        (c.program?.programNumber || '').toLowerCase().includes(q) ||
        (c.program?.programSerialNo || '').toLowerCase().includes(q) ||
        (c.program?.clientName || '').toLowerCase().includes(q) ||
        (c.program?.styleCode || '').toLowerCase().includes(q);

      return matchesStatus && matchesSearch;
    });
  }, [challans, statusFilter, searchTerm]);

  return (
    <div className="min-h-screen bg-ink-50 pb-16">
      {/* HEADER BANNER */}
      <header
        style={{
          backgroundImage: `linear-gradient(to right, rgba(37, 35, 42, 0.88), rgba(37, 35, 42, 0.72)), url('${DEPARTMENT_NAV_BG_IMAGE}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        className="border-b border-slate-700/80 sticky top-0 z-30 px-4 sm:px-8 py-4 shadow-md text-white"
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                WASHING QC TERMINAL
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Real-Time Sync
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mt-1 flex items-center gap-2">
              <Waves className="w-6 h-6 text-cyan-400" />
              <span>Washing QC Operational Work Center</span>
            </h1>
            <p className="text-xs text-slate-300 mt-0.5">
              Receive washed lots, verify shrinkage & wash quality parameters, isolate defective pieces, and issue handovers to Finishing.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadData(true)}
              disabled={loading}
              className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
              title="Refresh Work Center"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Sync</span>
            </button>

            <Link
              href="/washing-qc/issue-challan"
              className="px-3.5 py-1.5 bg-lavender-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Issue Challan</span>
            </Link>

            <Link
              href="/washing-qc/floor-board"
              className="px-3.5 py-1.5 bg-cyan-700 hover:bg-cyan-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Floor Board</span>
            </Link>
          </div>
        </div>
      </header>

      {/* TOAST MESSAGE */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-900 text-emerald-100 border border-emerald-700 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-xs animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="font-semibold">{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-emerald-300 hover:text-white ml-2">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => loadData(true)} className="text-rose-700 font-bold underline">
              Retry
            </button>
          </div>
        )}

        {/* WORKCENTER TABS */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('INCOMING')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeTab === 'INCOMING'
                ? 'bg-lavender-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Waves className="w-4 h-4" />
            <span>Incoming Washed Lots</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'INCOMING' ? 'bg-lavender-700 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {challans.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('DEFECTED_SHELF')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeTab === 'DEFECTED_SHELF'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Archive className="w-4 h-4" />
            <span>Defective Shelf (DEF-SHELF-WASHING-QC)</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'DEFECTED_SHELF' ? 'bg-rose-700 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {defectiveReturns.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('REWORK_HISTORY')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeTab === 'REWORK_HISTORY'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Re-Wash Log</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'REWORK_HISTORY' ? 'bg-orange-700 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {reworkReturns.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('PRODUCTION_SHEETS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeTab === 'PRODUCTION_SHEETS'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Production Sheets</span>
          </button>
        </div>

        {/* TAB 1: INCOMING CHALLANS WORKCENTER */}
        {activeTab === 'INCOMING' && (
          <div className="space-y-4">
            {/* SEARCH & FILTERS BAR */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by Challan #, Program Serial #, Style Code, or Client..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-lavender-500/20 focus:border-lavender-500 transition"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
                <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                {['ALL', 'PENDING', 'IN_PROCESS', 'APPROVED', 'REWORK', 'REJECTED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                      statusFilter === st
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* CHALLANS TABLE */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-[11px] font-semibold border-b border-slate-200">
                      <th className="py-3 px-4">Challan #</th>
                      <th className="py-3 px-4">From</th>
                      <th className="py-3 px-4">Program / Style</th>
                      <th className="py-3 px-4">Client</th>
                      <th className="py-3 px-4">Fabric & Color</th>
                      <th className="py-3 px-4">Quantity</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredChallans.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          <CheckCircle2 className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                          <p className="font-medium text-xs">No challans matching the criteria.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredChallans.map((c) => {
                        const totalQty = c.items?.reduce((s, it) => s + (Number(it.quantity) || 0), 0) || 0;
                        const isPending = c.status === 'ISSUED';
                        const isReceived = c.status === 'RECEIVED';
                        const isUnderInspection = c.status === 'UNDER_INSPECTION';
                        const isApproved = ['QC_APPROVED', 'COMPLETED'].includes(c.status);

                        return (
                          <tr key={c.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-3 px-4 font-mono font-bold text-slate-900">
                              {c.challanNumber}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                {c.fromDepartment}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-bold text-slate-800 block">
                                {c.program?.programSerialNo || c.program?.programNumber || '—'}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                Style: {c.program?.styleCode || 'Standard'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {c.program?.clientName || 'Standard Client'}
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              <span>{c.program?.fabricName || 'Garment Pieces'}</span>
                              <span className="block text-[10px] text-slate-400">
                                {c.program?.fabricColor || 'Standard'}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-slate-900">
                              {totalQty} PCS
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  c.status === 'QC_APPROVED'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : c.status === 'UNDER_INSPECTION'
                                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                    : c.status === 'RECEIVED'
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                    : c.status === 'QC_REJECTED'
                                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                    : c.status === 'REWORK_REQUESTED'
                                    ? 'bg-orange-100 text-orange-800 border border-orange-200'
                                    : 'bg-slate-100 text-slate-800 border border-slate-200'
                                }`}
                              >
                                {c.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex flex-col items-end gap-1.5">
                                {/* WORKFLOW BUTTONS */}
                                <div className="flex items-center gap-1.5">
                                  {/* RECEIVE BUTTON */}
                                  {isPending && (
                                    <button
                                      onClick={() => handleReceiveChallan(c)}
                                      disabled={submittingAction}
                                      className="px-2.5 py-1 bg-lavender-600 hover:bg-lavender-700 text-white rounded text-[11px] font-bold flex items-center gap-1 transition shadow-2xs"
                                    >
                                      <Check className="w-3 h-3" />
                                      <span>Receive</span>
                                    </button>
                                  )}

                                  {/* INSPECT / VERIFY BUTTON */}
                                  {(isReceived || isUnderInspection) && (
                                    <button
                                      onClick={() => handleOpenInspectModal(c)}
                                      className="px-2.5 py-1 bg-lavender-600 hover:bg-lavender-700 text-white rounded text-[11px] font-bold flex items-center gap-1 transition shadow-2xs"
                                    >
                                      <ShieldCheck className="w-3 h-3" />
                                      <span>Verify Work</span>
                                    </button>
                                  )}

                                  {/* HANDOVER TO FINISHING BUTTON */}
                                  {isApproved && (
                                    <button
                                      onClick={() => openIssueToFinishing(c)}
                                      disabled={submittingAction}
                                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold flex items-center gap-1 transition shadow-2xs"
                                      title="Issue Handover Challan to Finishing"
                                    >
                                      <PackageCheck className="w-3 h-3" />
                                      <span>To Finishing</span>
                                    </button>
                                  )}
                                </div>

                                <DocumentActionButtons
                                  challan={c}
                                  program={c.program}
                                  size="xs"
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DEFECTED SHELF (DEF-SHELF-WASHING-QC) */}
        {activeTab === 'DEFECTED_SHELF' && (
          <div className="space-y-4">
            <DepartmentDefectiveShelfWidget
              department="WASHING_QC"
              shelfCode="DEF-SHELF-WASHING-QC"
              accentColor="teal"
            />
          </div>
        )}

        {/* TAB 3: REWORK LOG */}
        {activeTab === 'REWORK_HISTORY' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-orange-200 p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-orange-100">
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-orange-600" />
                  <div>
                    <h3 className="text-sm font-bold text-orange-900">
                      Returned to Washing for Re-Wash / Treatment
                    </h3>
                    <p className="text-xs text-slate-500">
                      Lots requiring re-washing, re-softening, or chemical re-neutralization
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-orange-700 bg-orange-50 px-2 py-1 rounded">
                  {reworkReturns.length} Re-Wash Challans
                </span>
              </div>

              {reworkReturns.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                  <p className="text-xs font-medium">Zero re-wash handoffs issued. All wash runs passed first-time.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 pt-2">
                  {reworkReturns.map((c) => {
                    const qty = c.items?.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0) || 0;
                    return (
                      <div key={c.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900">{c.challanNumber}</span>
                            <span className="text-orange-700 font-bold bg-orange-50 px-1.5 py-0.2 rounded text-[10px]">
                              TO: WASHING
                            </span>
                          </div>
                          <p className="text-slate-600 text-[11px]">{c.remarks}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-orange-700 text-sm">{qty} PCS</span>
                          <button
                            type="button"
                            onClick={() => downloadChallanHtml(c)}
                            className="px-2 py-0.5 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded text-[10px] font-semibold flex items-center gap-1"
                            title="Download Challan HTML"
                          >
                            <Download className="w-2.5 h-2.5" />
                            <span>Challan</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => printChallan(c)}
                            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-semibold flex items-center gap-1"
                            title="Print Challan Slip"
                          >
                            <Printer className="w-2.5 h-2.5" />
                            <span>Print</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: PRODUCTION SHEETS */}
        {activeTab === 'PRODUCTION_SHEETS' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Programs / Production Sheets</h3>
            <p className="text-xs text-slate-500 mb-4">
              Access complete tech specs, Wilcom embroidery numbers, target delivery dates, and color tolerances.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {Array.from(new Set(challans.map((c) => c.program).filter(Boolean))).map((prog: any) => (
                <div key={prog.id} className="p-3 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-slate-900">
                      {prog.programSerialNo || prog.programNumber}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                      {prog.styleCode || 'Style'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 mt-2">
                    <p className="font-medium text-slate-800">{prog.clientName}</p>
                    <p className="text-[11px] text-slate-500">{prog.fabricName} ({prog.fabricColor})</p>
                  </div>
                  <div className="flex items-center gap-1.5 mt-3">
                    <DocumentActionButtons
                      program={prog}
                      size="xs"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* INSPECTION / VERIFICATION MODAL */}
      {selectedChallanForInspect && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full my-8 overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold">
                    Verify Washed Garments — Challan #{selectedChallanForInspect.challanNumber}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Program: {selectedChallanForInspect.program?.programSerialNo || selectedChallanForInspect.program?.programNumber || '—'}
                    {' · '}Client: {selectedChallanForInspect.program?.clientName || 'Standard Client'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedChallanForInspect.program && (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectedSheetForView(selectedChallanForInspect.program)}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold flex items-center gap-1 transition"
                      title="View Official Production Sheet"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Sheet</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadProductionSheetHtml(selectedChallanForInspect.program)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 rounded text-xs font-semibold flex items-center gap-1 transition"
                      title="Download Production Sheet HTML"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => printProductionSheet(selectedChallanForInspect.program)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded text-xs font-semibold flex items-center gap-1 transition"
                      title="Print Production Sheet Traveler"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print</span>
                    </button>
                  </>
                )}
                <button
                  onClick={() => setSelectedChallanForInspect(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitInspection} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Quantities Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Inspected Qty (PCS) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={inspectionForm.quantityInspected}
                    onChange={(e) => handleQuantityChange('quantityInspected', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono font-bold text-xs bg-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-emerald-700 block mb-1">
                    Passed Qty (PCS) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    readOnly
                    value={inspectionForm.quantityPassed}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-emerald-300 font-mono font-bold text-xs bg-emerald-50 text-emerald-900"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-orange-700 block mb-1">
                    Re-Wash (PCS)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={inspectionForm.quantityRework}
                    onChange={(e) => handleQuantityChange('quantityRework', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-orange-300 font-mono font-bold text-xs bg-white text-orange-900"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-rose-700 block mb-1">
                    Scrap / Reject (PCS)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={inspectionForm.quantityFailed}
                    onChange={(e) => handleQuantityChange('quantityFailed', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-rose-300 font-mono font-bold text-xs bg-white text-rose-900"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-amber-700 block mb-1">
                    Hold (PCS)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={inspectionForm.quantityHold}
                    onChange={(e) => handleQuantityChange('quantityHold', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-amber-300 font-mono font-bold text-xs bg-white text-amber-900"
                  />
                </div>
              </div>

              {/* Wash Verification Parameters Checklist */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-emerald-600" />
                  <span>Wash Quality Parameters & Verification Checklist</span>
                </span>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
                  {inspectionForm.parameters.map((param, idx) => (
                    <div key={idx} className="p-3 bg-white hover:bg-slate-50 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-slate-900 block">{param.parameterName}</span>
                        <span className="text-[11px] text-slate-500 block">{param.standardValue}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          value={param.observedValue}
                          onChange={(e) => {
                            const val = e.target.value;
                            setInspectionForm((prev) => {
                              const newP = [...prev.parameters];
                              newP[idx].observedValue = val;
                              return { ...prev, parameters: newP };
                            });
                          }}
                          className="px-2 py-1 rounded border border-slate-200 text-xs w-40 font-mono"
                          placeholder="Observed..."
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setInspectionForm((prev) => {
                              const newP = [...prev.parameters];
                              newP[idx].passed = !newP[idx].passed;
                              return { ...prev, parameters: newP };
                            });
                          }}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold transition ${
                            param.passed
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}
                        >
                          {param.passed ? '✓ PASS' : '✕ FAIL'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Defect Reasons if Failed or Rework */}
              {(Number(inspectionForm.quantityFailed) > 0 || Number(inspectionForm.quantityRework) > 0) && (
                <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-rose-600" />
                      <span>Defect Attribution & Quarantining</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleAddDefect}
                      className="px-2 py-1 bg-rose-600 text-white rounded text-[11px] font-bold hover:bg-rose-700"
                    >
                      + Add Defect
                    </button>
                  </div>

                  {Number(inspectionForm.quantityFailed) > 0 && (
                    <div>
                      <label className="text-[11px] font-bold text-rose-900 block mb-1">
                        Scrap / Defect Remarks * (Sent to DEF-SHELF-WASHING-QC)
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Severe shrinkage exceeding 5%, bleach spot on front right chest"
                        value={inspectionForm.defectRemarks}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, defectRemarks: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-rose-300 text-xs bg-white"
                      />
                    </div>
                  )}

                  {Number(inspectionForm.quantityRework) > 0 && (
                    <div>
                      <label className="text-[11px] font-bold text-orange-900 block mb-1">
                        Re-Wash Instructions * (Sent back to Washing)
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Fabric still stiff, add 20% extra silicone softener and re-tumble dry"
                        value={inspectionForm.reworkReason}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, reworkReason: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-orange-300 text-xs bg-white"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* CHALLAN NUMBERS FOR THE CHALLANS THIS DECISION ISSUES (MANUAL ENTRY) */}
              {((inspectionForm.result === 'PASS' && Number(inspectionForm.quantityPassed || 0) > 0) ||
                Number(inspectionForm.quantityRework || 0) > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {inspectionForm.result === 'PASS' && Number(inspectionForm.quantityPassed || 0) > 0 && (
                    <ChallanNumberInput
                      label="Challan Number — passed material to Recutting"
                      value={passChallanNumber}
                      onChange={(value) => {
                        setPassChallanNumber(value);
                        setChallanNumberErrors((prev) => ({ ...prev, pass: null }));
                      }}
                      error={challanNumberErrors.pass}
                      disabled={submittingAction}
                    />
                  )}
                  {Number(inspectionForm.quantityRework || 0) > 0 && (
                    <ChallanNumberInput
                      label={`Challan Number — rework return to ${selectedChallanForInspect.fromDepartment || 'Washing'}`}
                      value={reworkChallanNumber}
                      onChange={(value) => {
                        setReworkChallanNumber(value);
                        setChallanNumberErrors((prev) => ({ ...prev, rework: null }));
                      }}
                      error={challanNumberErrors.rework}
                      disabled={submittingAction}
                    />
                  )}
                </div>
              )}

              {/* General Remarks */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  General Verification Notes
                </label>
                <textarea
                  rows={2}
                  value={inspectionForm.remarks}
                  onChange={(e) => setInspectionForm({ ...inspectionForm, remarks: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-lavender-500/20 focus:outline-none"
                />
              </div>

              {/* Form Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedChallanForInspect(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-5 py-2 bg-lavender-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm Verification & Pass</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HANDOVER CHALLAN NUMBER ENTRY */}
      {issuingToFinishing && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleIssueToFinishing(issuingToFinishing);
            }}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95"
          >
            <div>
              <h3 className="text-sm font-bold text-slate-900">Issue Handover Challan</h3>
              <p className="text-xs text-slate-500 font-mono">
                Sheet {issuingToFinishing.program?.programSerialNo || issuingToFinishing.program?.programNumber || '—'} · From {issuingToFinishing.challanNumber}
              </p>
            </div>
            <ChallanNumberInput
              value={handoverChallanNumber}
              onChange={(value) => {
                setHandoverChallanNumber(value);
                setHandoverChallanNumberError(null);
              }}
              error={handoverChallanNumberError}
              disabled={submittingAction}
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIssuingToFinishing(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingAction}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
              >
                {submittingAction ? 'Issuing…' : 'Issue Challan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FINISHING HANDOVER MODAL */}
      {finishingChallanModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Handover Challan Issued to Finishing!
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {finishingChallanModal.challanNumber}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">From Station:</span>
                <span className="font-bold text-slate-900">WASHING QC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">To Station:</span>
                <span className="font-bold text-emerald-700">FINISHING SECTION</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Passed Quantity:</span>
                <span className="font-bold font-mono text-slate-900">
                  {finishingChallanModal.items?.[0]?.quantity || 0} PCS
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => downloadChallanHtml(finishingChallanModal)}
                className="flex-1 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>Download Challan</span>
              </button>
              <button
                type="button"
                onClick={() => printChallan(finishingChallanModal)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print Challan</span>
              </button>
            </div>

            <button
              onClick={() => setFinishingChallanModal(null)}
              className="w-full py-2.5 bg-lavender-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              Done & Continue
            </button>
          </div>
        </div>
      )}

      {/* TECH SHEET PRINT MODAL */}
      {selectedSheetForView && (
        <ProductionSheetPrintModal
          isOpen={true}
          onClose={() => setSelectedSheetForView(null)}
          program={selectedSheetForView}
        />
      )}
    </div>
  );
}
