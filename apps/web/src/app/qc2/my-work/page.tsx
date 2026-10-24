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
  Send
} from 'lucide-react';
import { DocumentActionButtons } from '@/components/common/DocumentActionButtons';
import { TransferDocuments } from '@/components/common/TransferDocuments';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';
import BarcodeStickerCard from '@/components/BarcodeStickerCard';
import { ChallanNumberField, challanNumberClientError, newSubmissionKey } from '@/components/challan/ChallanNumberField';

type Qc2ChallanNumberField = 'reworkChallanNumber' | 'rejectChallanNumber';
const EMPTY_QC2_CHALLAN_NUMBERS: Record<Qc2ChallanNumberField, string> = {
  reworkChallanNumber: '',
  rejectChallanNumber: '',
};

/** Challans the QC2 inspect route will create for these quantities (mirrors the server rule). */
function qc2NeededChallanNumbers(form: { quantityRework: string; quantityFailed: string }) {
  const needed: Array<{ field: Qc2ChallanNumberField; label: string }> = [];
  if (Number(form.quantityRework || 0) > 0) needed.push({ field: 'reworkChallanNumber', label: 'Rework challan number' });
  if (Number(form.quantityFailed || 0) > 0) needed.push({ field: 'rejectChallanNumber', label: 'Defective shelf challan number' });
  return needed;
}

interface QC2Challan {
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

export default function QC2MyWorkPage() {
  const searchParams = useSearchParams();
  const highlightChallanId = searchParams.get('challanId');

  const [activeTab, setActiveTab] = useState<
    'INCOMING' | 'DEFECTED_SHELF' | 'REWORK_HISTORY' | 'PRODUCTION_SHEETS'
  >('INCOMING');
  const [challans, setChallans] = useState<QC2Challan[]>([]);
  const [defectiveReturns, setDefectiveReturns] = useState<any[]>([]);
  const [reworkReturns, setReworkReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals & Inspection Form
  const [selectedChallanForInspect, setSelectedChallanForInspect] = useState<QC2Challan | null>(null);
  const [selectedChallanForView, setSelectedChallanForView] = useState<QC2Challan | null>(null);
  const [selectedSheetForView, setSelectedSheetForView] = useState<any | null>(null);
  const [issuingToWashing, setIssuingToWashing] = useState<QC2Challan | null>(null);
  const [washingChallanModal, setWashingChallanModal] = useState<any | null>(null);
  const [inspectionResultModal, setInspectionResultModal] = useState<any | null>(null);

  // Inspection Form State
  const [inspectionForm, setInspectionForm] = useState({
    quantityInspected: '',
    quantityPassed: '',
    quantityFailed: '',
    quantityRework: '',
    quantityHold: '0',
    result: 'PASS' as 'PASS' | 'REWORK' | 'REJECT',
    defectType: 'NEEDLE_HOLES',
    defectRemarks: '',
    reworkReason: '',
    remarks: '',
  });

  // Selected Defect Checkboxes
  const [selectedDefects, setSelectedDefects] = useState<Record<string, number>>({});
  const [submittingInspection, setSubmittingInspection] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [challanNumbers, setChallanNumbers] = useState(EMPTY_QC2_CHALLAN_NUMBERS);
  const [challanNumberErrors, setChallanNumberErrors] = useState<Partial<Record<Qc2ChallanNumberField, string>>>({});

  // Issue-to-Washing form (manual challan number)
  const [washingChallanNumber, setWashingChallanNumber] = useState('');
  const [washingChallanNumberError, setWashingChallanNumberError] = useState<string | null>(null);
  const [washingIssueError, setWashingIssueError] = useState<string | null>(null);
  const [washingIdempotencyKey, setWashingIdempotencyKey] = useState('');
  const [submittingWashingIssue, setSubmittingWashingIssue] = useState(false);

  const openIssueToWashing = (challan: QC2Challan) => {
    setIssuingToWashing(challan);
    setWashingChallanNumber('');
    setWashingChallanNumberError(null);
    setWashingIssueError(null);
    setWashingIdempotencyKey(newSubmissionKey());
  };

  const DEFECT_CATEGORIES = [
    { id: 'NEEDLE_HOLES', label: 'Needle Holes / Piercing' },
    { id: 'BROKEN_STITCH', label: 'Broken / Skipped Stitch' },
    { id: 'LOOSE_THREADS', label: 'Untrimmed / Loose Threads' },
    { id: 'SIZE_DEVIATION', label: 'Measurement / Size Off' },
    { id: 'EMB_MISALIGN', label: 'Embroidery Misalignment' },
    { id: 'STAIN_DIRT', label: 'Oil / Stains / Dirt' },
    { id: 'FABRIC_DEFECT', label: 'Fabric Hole / Tear' },
    { id: 'OTHER_DEFECT', label: 'Other Defect' },
  ];

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [challansRes, dashboardRes] = await Promise.all([
        fetch('/api/qc2/challans').catch(() => null),
        fetch('/api/qc2/dashboard').catch(() => null),
      ]);

      if (challansRes && challansRes.ok) {
        const json = await challansRes.json();
        const list = Array.isArray(json) ? json : json.data || [];
        setChallans(list);

        // Auto open inspection if query param passed
        if (highlightChallanId) {
          const match = list.find((c: QC2Challan) => c.id === highlightChallanId);
          if (match) {
            handleOpenInspection(match);
          }
        }
      }

      if (dashboardRes && dashboardRes.ok) {
        const dJson = await dashboardRes.json();
        setDefectiveReturns(dJson.data?.defectiveReturns || []);
        setReworkReturns(dJson.data?.reworkReturns || []);
      }
    } catch (err: any) {
      console.error('Failed to load QC2 work:', err);
      setError(err.message || 'Error connecting to server');
    } finally {
      setLoading(false);
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
    loadData();
  }, [highlightChallanId]);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'PRODUCTION_SHEETS') {
      setActiveTab('PRODUCTION_SHEETS');
    }
  }, [searchParams]);

  const handleIssueToWashing = async (challan: QC2Challan) => {
    const numberError = challanNumberClientError(washingChallanNumber, 'Washing challan number');
    if (numberError) {
      setWashingChallanNumberError(numberError);
      return;
    }
    setSubmittingWashingIssue(true);
    setWashingIssueError(null);
    try {
      const goodQty = challan.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
      const res = await fetch('/api/challans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challanNumber: washingChallanNumber.trim(),
          idempotencyKey: washingIdempotencyKey,
          challanType: 'REGULAR',
          programId: challan.programId,
          fromDepartment: 'QC2',
          toDepartment: 'WASHING',
          priority: challan.priority || 'NORMAL',
          remarks: `QC2 Approved Handover to Washing Department for Sheet ${challan.program?.programSerialNo || challan.program?.programNumber || '—'}`,
          items: [
            {
              itemDescription: `${challan.program?.fabricName || 'Garment Pieces'} - Washed Handover`,
              fabricCode: 'PIECE',
              colour: challan.program?.fabricColor || 'Standard',
              quantity: goodQty,
              uom: 'PCS',
              remarks: 'QC2 Inspected & Approved. Ready for Washing & Drying cycle.',
            },
          ],
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIssuingToWashing(null);
        setWashingChallanNumber('');
        setWashingChallanModal(data.data);
        setToastMessage(`Challan ${data.data.challanNumber} issued to Washing Department successfully!`);
        loadData();
      } else {
        if (data.field === 'challanNumber') {
          setWashingChallanNumberError(data.error || 'Invalid challan number.');
          return;
        }
        throw new Error(data.error || 'Failed to issue challan to Washing');
      }
    } catch (err: any) {
      setWashingIssueError(`Error issuing to Washing: ${err.message}`);
    } finally {
      setSubmittingWashingIssue(false);
    }
  };

  // Handle Receive Challan
  const handleReceiveChallan = async (challan: QC2Challan) => {
    try {
      const res = await fetch(`/api/qc2/challans/${challan.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverId: currentUser?.id,
          notes: 'Received from Thread Cutting Section for QC2 check',
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to receive challan');
      }

      setToastMessage(`Challan ${challan.challanNumber} received successfully at QC2!`);
      setTimeout(() => setToastMessage(null), 5000);
      loadData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  // Open Inspection Terminal
  const handleOpenInspection = async (challan: QC2Challan) => {
    // If status is ISSUED, prompt to receive first
    if (challan.status === 'ISSUED') {
      await handleReceiveChallan(challan);
    }

    // If status is RECEIVED, call start-inspection
    if (challan.status === 'RECEIVED' || challan.status === 'ISSUED') {
      try {
        await fetch(`/api/qc2/challans/${challan.id}/start-inspection`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inspectorId: currentUser?.id }),
        });
      } catch (e) {
        console.warn('Start inspection trigger note:', e);
      }
    }

    const totalQty = challan.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
    setSelectedChallanForInspect(challan);
    setInspectionForm({
      quantityInspected: String(totalQty),
      quantityPassed: String(totalQty),
      quantityFailed: '0',
      quantityRework: '0',
      quantityHold: '0',
      result: 'PASS',
      defectType: 'NEEDLE_HOLES',
      defectRemarks: '',
      reworkReason: '',
      remarks: '',
    });
    setSelectedDefects({});
    setChallanNumbers(EMPTY_QC2_CHALLAN_NUMBERS);
    setChallanNumberErrors({});
  };

  // Handle live recalculation when user changes Passed or Failed
  const handleQuantityChange = (field: string, val: string) => {
    const num = Number(val) || 0;
    const current = { ...inspectionForm, [field]: val };
    const total = Number(current.quantityInspected) || 0;

    if (field === 'quantityPassed') {
      const remainder = Math.max(0, total - num);
      if (current.result === 'REJECT') {
        current.quantityFailed = String(remainder);
        current.quantityRework = '0';
      } else if (current.result === 'REWORK') {
        current.quantityRework = String(remainder);
        current.quantityFailed = '0';
      }
    } else if (field === 'quantityFailed') {
      const failed = num;
      const rework = Number(current.quantityRework) || 0;
      current.quantityPassed = String(Math.max(0, total - failed - rework));
      if (failed > 0 && Number(current.quantityPassed) === 0) {
        current.result = 'REJECT';
      }
    } else if (field === 'quantityRework') {
      const rework = num;
      const failed = Number(current.quantityFailed) || 0;
      current.quantityPassed = String(Math.max(0, total - failed - rework));
      if (rework > 0 && Number(current.quantityPassed) === 0) {
        current.result = 'REWORK';
      }
    }

    setInspectionForm(current);
  };

  // Defect checkbox / counter change
  const handleDefectCountChange = (defectId: string, count: number) => {
    setSelectedDefects((prev) => {
      const updated = { ...prev };
      if (count <= 0) {
        delete updated[defectId];
      } else {
        updated[defectId] = count;
      }
      return updated;
    });
  };

  // Submit Inspection to Backend
  const handleSubmitInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChallanForInspect) return;

    const qInspected = Number(inspectionForm.quantityInspected) || 0;
    const qPassed = Number(inspectionForm.quantityPassed) || 0;
    const qFailed = Number(inspectionForm.quantityFailed) || 0;
    const qRework = Number(inspectionForm.quantityRework) || 0;
    const qHold = Number(inspectionForm.quantityHold) || 0;

    if (qInspected <= 0) {
      alert('Inspected quantity must be greater than 0.');
      return;
    }

    if (qPassed + qFailed + qRework + qHold !== qInspected) {
      alert(
        `Quantity reconciliation mismatch: Passed (${qPassed}) + Failed (${qFailed}) + Rework (${qRework}) + Hold (${qHold}) = ${
          qPassed + qFailed + qRework + qHold
        }, but Inspected is ${qInspected}.`
      );
      return;
    }

    if (qFailed > 0 && !inspectionForm.defectRemarks.trim()) {
      alert('Please provide defect remarks for the pieces being sent directly to the Defected Shelf.');
      return;
    }

    if (qRework > 0 && !inspectionForm.reworkReason.trim()) {
      alert('Please specify the rework reason for pieces returned to Thread Cutting.');
      return;
    }

    // Manual challan numbers for each challan this inspection will create
    const neededNumbers = qc2NeededChallanNumbers(inspectionForm);
    const numberErrors: Partial<Record<Qc2ChallanNumberField, string>> = {};
    for (const { field, label } of neededNumbers) {
      const msg = challanNumberClientError(challanNumbers[field], label);
      if (msg) numberErrors[field] = msg;
    }
    setChallanNumberErrors(numberErrors);
    if (Object.keys(numberErrors).length > 0) return;
    const typedNumbers: Partial<Record<Qc2ChallanNumberField, string>> = {};
    for (const { field } of neededNumbers) typedNumbers[field] = challanNumbers[field].trim();

    try {
      setSubmittingInspection(true);

      const defectsPayload = Object.entries(selectedDefects).map(([k, v]) => ({
        defectType: k,
        count: v,
        severity: 'MAJOR',
      }));

      const payload = {
        quantityInspected: qInspected,
        quantityPassed: qPassed,
        quantityFailed: qFailed,
        quantityRework: qRework,
        quantityHold: qHold,
        result: inspectionForm.result,
        defects: defectsPayload,
        defectRemarks: inspectionForm.defectRemarks,
        reworkReason: inspectionForm.reworkReason,
        remarks: inspectionForm.remarks,
        inspectorId: currentUser?.id,
        ...typedNumbers,
      };

      const res = await fetch(`/api/qc2/challans/${selectedChallanForInspect.id}/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        if (json.field && json.field in EMPTY_QC2_CHALLAN_NUMBERS) {
          setChallanNumberErrors({ [json.field as Qc2ChallanNumberField]: json.error });
          return;
        }
        throw new Error(json.error || 'Failed to submit inspection');
      }

      setChallanNumbers(EMPTY_QC2_CHALLAN_NUMBERS);
      setChallanNumberErrors({});
      setSelectedChallanForInspect(null);
      setInspectionResultModal(json.data);
      loadData();
    } catch (err: any) {
      console.error(err);
      alert('Error: ' + err.message);
    } finally {
      setSubmittingInspection(false);
    }
  };

  // Filtered Challans
  const filteredChallans = useMemo(() => {
    return challans.filter((c) => {
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'PENDING' && ['ISSUED', 'RECEIVED'].includes(c.status)) ||
        (statusFilter === 'UNDER_INSPECTION' && c.status === 'UNDER_INSPECTION') ||
        (statusFilter === 'APPROVED' && (c.status === 'QC_APPROVED' || c.status === 'COMPLETED')) ||
        (statusFilter === 'REJECTED' && c.status === 'QC_REJECTED') ||
        (statusFilter === 'REWORK' && c.status === 'REWORK_REQUESTED');

      const matchesSearch =
        !searchTerm ||
        c.challanNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.program?.programNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.program?.programSerialNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.program?.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.program?.styleCode?.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesStatus && matchesSearch;
    });
  }, [challans, statusFilter, searchTerm]);

  return (
    <div className="min-h-screen bg-neutral-50 pb-16">
      {/* HEADER */}
      <header
        className="bg-white border-b border-neutral-200 sticky top-0 z-30 px-4 sm:px-8 py-4 shadow-md text-neutral-900"
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-700 block drop-shadow-sm">
              SHUBHAM FABRICS MES · QC2 INSPECTION WORKSTATION
            </span>
            <h1 className="text-xl font-bold text-neutral-900 flex items-center gap-2.5 drop-shadow-sm">
              <CheckCircle2 className="w-5 h-5 text-accent-700" />
              <span>QC2 · My Work &amp; Inspection Station</span>
            </h1>
            <p className="text-xs text-neutral-700 mt-0.5">
              Incoming from Thread Cutting · Physical Garment Piece Inspection &amp; Rejection to Defected Shelf
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition"
              title="Refresh Queue"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <Link
              href="/qc2"
              className="flex items-center gap-1.5 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 rounded-lg text-xs font-semibold border border-neutral-200 transition"
            >
              <span>Dashboard</span>
            </Link>

            <Link
              href="/qc2/issue-challan"
              className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
            >
              <Send className="w-4 h-4" />
              <span>Issue Challan</span>
            </Link>

            <Link
              href="/qc2/floor-board"
              className="flex items-center gap-1.5 px-3 py-2 bg-accent-400/20 text-accent-700 border border-accent-500/40 hover:bg-accent-400/30 rounded-lg text-xs font-semibold transition"
            >
              <Kanban className="w-4 h-4" />
              <span>Floor Board</span>
            </Link>
          </div>
        </div>
      </header>

      {/* TOAST MESSAGE */}
      {toastMessage && (
        <div className="max-w-7xl mx-auto px-4 sm:px-8 mt-4 animate-in fade-in">
          <div className="p-3 bg-accent-50 border border-accent-300 text-accent-800 rounded-xl text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-accent-700 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* TABS NAVIGATION */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 mt-6">
        <div className="flex items-center gap-2 border-b border-neutral-200 pb-2">
          <button
            onClick={() => setActiveTab('INCOMING')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === 'INCOMING'
                ? 'bg-accent-400 text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:bg-neutral-200/60'
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Incoming from Thread Cutting</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeTab === 'INCOMING' ? 'bg-accent-500 text-neutral-900' : 'bg-neutral-200 text-neutral-700'
              }`}
            >
              {challans.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('DEFECTED_SHELF')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === 'DEFECTED_SHELF'
                ? 'bg-danger-600 text-white shadow-xs'
                : 'text-neutral-600 hover:bg-neutral-200/60'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Defected Shelf Dispatches (DEF-SHELF-01)</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeTab === 'DEFECTED_SHELF' ? 'bg-danger-800 text-white' : 'bg-neutral-200 text-neutral-700'
              }`}
            >
              {defectiveReturns.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('REWORK_HISTORY')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === 'REWORK_HISTORY'
                ? 'bg-accent-400 text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:bg-neutral-200/60'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Rework Returns to Thread Cutting</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeTab === 'REWORK_HISTORY' ? 'bg-accent-500 text-neutral-900' : 'bg-neutral-200 text-neutral-700'
              }`}
            >
              {reworkReturns.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('PRODUCTION_SHEETS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === 'PRODUCTION_SHEETS'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'text-neutral-600 hover:bg-neutral-200/60'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Production Sheets</span>
          </button>
        </div>
      </div>

      {/* CONTENT FOR TAB 1: INCOMING CHALLANS */}
      {activeTab === 'INCOMING' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-8 mt-5 space-y-4">
          {/* SEARCH & FILTERS BAR */}
          <div className="bg-white p-3.5 rounded-xl border border-neutral-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search Challan #, Sheet #, Client, Style..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
              />
              <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500 font-semibold">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs font-medium border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500/40 bg-white"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending (Issued / Received)</option>
                <option value="UNDER_INSPECTION">Under Inspection</option>
                <option value="APPROVED">Approved / Passed</option>
                <option value="REJECTED">Rejected (Defected Shelf)</option>
                <option value="REWORK">Rework</option>
              </select>
            </div>
          </div>

          {/* CHALLANS TABLE */}
          <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[760px]">
                <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4 font-bold">Challan Number</th>
                    <th className="py-3 px-4 font-bold">Sheet / Program #</th>
                    <th className="py-3 px-4 font-bold">Client / Style</th>
                    <th className="py-3 px-4 font-bold">Quantity</th>
                    <th className="py-3 px-4 font-bold">Status</th>
                    <th className="py-3 px-4 font-bold">Sender &amp; Date</th>
                    <th className="py-3 px-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredChallans.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-neutral-500">
                        No challans match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredChallans.map((c) => {
                      const totalQty = c.items.reduce(
                        (s, it) => s + (Number(it.quantity) || 0),
                        0
                      );
                      const uom = c.items[0]?.uom || 'PCS';
                      return (
                        <tr key={c.id} className="hover:bg-neutral-50/70 transition">
                          <td className="py-3 px-4 font-mono font-bold text-accent-800">
                            {c.challanNumber}
                          </td>
                          <td className="py-3 px-4 font-mono text-neutral-700 font-semibold">
                            {c.program?.programSerialNo || c.program?.programNumber || '—'}
                          </td>
                          <td className="py-3 px-4 text-neutral-700">
                            <span className="font-semibold block truncate">
                              {c.program?.clientName || c.program?.buyerName || 'Standard Client'}
                            </span>
                            <span className="text-[10px] text-neutral-500 block truncate">
                              {c.program?.mainStyle || c.program?.styleCode || 'General Lot'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-neutral-900">
                            {totalQty.toLocaleString()} {uom}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                c.status === 'QC_APPROVED'
                                  ? 'bg-accent-100 text-accent-800'
                                  : c.status === 'QC_REJECTED'
                                  ? 'bg-danger-100 text-danger-800'
                                  : c.status === 'REWORK_REQUESTED'
                                  ? 'bg-accent-100 text-accent-800'
                                  : c.status === 'UNDER_INSPECTION'
                                  ? 'bg-brand-100 text-brand-800'
                                  : c.status === 'RECEIVED'
                                  ? 'bg-brand-100 text-brand-800'
                                  : 'bg-neutral-100 text-neutral-700'
                              }`}
                            >
                              {c.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-neutral-500 font-mono text-[11px]">
                            {new Date(c.createdAt).toLocaleDateString('en-IN')}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {c.status === 'ISSUED' && (
                                <button
                                  onClick={() => handleReceiveChallan(c)}
                                  className="px-2.5 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded text-[11px] font-semibold transition shadow-2xs"
                                >
                                  Receive
                                </button>
                              )}

                              {['ISSUED', 'RECEIVED', 'UNDER_INSPECTION'].includes(c.status) && (
                                <button
                                  onClick={() => handleOpenInspection(c)}
                                  className="px-2.5 py-1 bg-accent-400 hover:bg-accent-500 text-neutral-900 rounded text-[11px] font-semibold transition shadow-2xs flex items-center gap-1"
                                >
                                  <span>Inspect</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              )}

                              {c.status === 'QC_APPROVED' && (
                                <button
                                  onClick={() => openIssueToWashing(c)}
                                  className="px-2.5 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded text-[11px] font-semibold transition shadow-2xs flex items-center gap-1"
                                  title="Issue Handover Challan to Washing Department"
                                >
                                  <Waves className="w-3 h-3" />
                                  <span>To Washing</span>
                                </button>
                              )}

                              <TransferDocuments challan={c} size="xs" />
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

      {/* CONTENT FOR TAB 2: DEFECTED SHELF DISPATCHES */}
      {activeTab === 'DEFECTED_SHELF' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-8 mt-5 space-y-4">
          <div className="bg-danger-50/60 border border-danger-200 p-4 rounded-xl flex items-center justify-between text-xs text-danger-900">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-danger-600 shrink-0" />
              <div>
                <strong className="block font-bold">Direct Defected Shelf Handoff Rules</strong>
                <span>
                  Any lot or piece rejected at QC2 is immediately transferred with a DEFECTIVE_RETURN challan to the Fabric Store Defected Shelf (DEF-SHELF-01).
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4 font-bold">Return Slip #</th>
                    <th className="py-3 px-4 font-bold">Sheet #</th>
                    <th className="py-3 px-4 font-bold">Quantity Quarantined</th>
                    <th className="py-3 px-4 font-bold">Shelf Target</th>
                    <th className="py-3 px-4 font-bold">Defect Remarks</th>
                    <th className="py-3 px-4 font-bold">Date Dispatched</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {defectiveReturns.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-neutral-500">
                        No rejected lots sent to defective shelf yet.
                      </td>
                    </tr>
                  ) : (
                    defectiveReturns.map((dr) => {
                      const qty = dr.items.reduce(
                        (s: number, it: any) => s + (Number(it.quantity) || 0),
                        0
                      );
                      return (
                        <tr key={dr.id} className="hover:bg-danger-50/20 transition">
                          <td className="py-3 px-4 font-mono font-bold text-danger-900">
                            {dr.challanNumber}
                          </td>
                          <td className="py-3 px-4 font-mono text-neutral-700">
                            {dr.program?.programSerialNo || dr.program?.programNumber || '—'}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-danger-700">
                            {qty} PCS
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-danger-100 text-danger-800">
                              DEF-SHELF-01
                            </span>
                          </td>
                          <td className="py-3 px-4 text-neutral-600 text-[11px] truncate max-w-sm">
                            {dr.remarks || 'QC2 Rejection'}
                          </td>
                          <td className="py-3 px-4 font-mono text-neutral-500 text-[11px]">
                            {new Date(dr.createdAt).toLocaleDateString('en-IN')}
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

      {/* CONTENT FOR TAB 3: REWORK RETURNS */}
      {activeTab === 'REWORK_HISTORY' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-8 mt-5 space-y-4">
          <div className="bg-accent-50/60 border border-accent-200 p-4 rounded-xl flex items-center justify-between text-xs text-accent-800">
            <div className="flex items-center gap-3">
              <RotateCcw className="w-5 h-5 text-accent-700 shrink-0" />
              <div>
                <strong className="block font-bold">Rework Returns to Thread Cutting</strong>
                <span>
                  Pieces with loose threads or minor sewing imperfections are returned to Thread Cutting for alteration and re-checking.
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4 font-bold">Rework Slip #</th>
                    <th className="py-3 px-4 font-bold">Sheet #</th>
                    <th className="py-3 px-4 font-bold">Quantity for Rework</th>
                    <th className="py-3 px-4 font-bold">Reason</th>
                    <th className="py-3 px-4 font-bold">Date Dispatched</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {reworkReturns.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-neutral-500">
                        No rework returns recorded yet.
                      </td>
                    </tr>
                  ) : (
                    reworkReturns.map((rr) => {
                      const qty = rr.items.reduce(
                        (s: number, it: any) => s + (Number(it.quantity) || 0),
                        0
                      );
                      return (
                        <tr key={rr.id} className="hover:bg-accent-50/20 transition">
                          <td className="py-3 px-4 font-mono font-bold text-accent-800">
                            {rr.challanNumber}
                          </td>
                          <td className="py-3 px-4 font-mono text-neutral-700">
                            {rr.program?.programSerialNo || rr.program?.programNumber || '—'}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-accent-800">
                            {qty} PCS
                          </td>
                          <td className="py-3 px-4 text-neutral-600 text-[11px] truncate max-w-sm">
                            {rr.remarks || 'Thread Alteration'}
                          </td>
                          <td className="py-3 px-4 font-mono text-neutral-500 text-[11px]">
                            {new Date(rr.createdAt).toLocaleDateString('en-IN')}
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

      {/* CONTENT FOR TAB 4: PRODUCTION SHEETS (QC2 TRAVELERS) */}
      {activeTab === 'PRODUCTION_SHEETS' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-8 mt-5 space-y-4">
          <div className="bg-white rounded-xl border border-neutral-200/90 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-neutral-200/80 bg-neutral-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-brand-600" />
                  <span>QC2 Garment Production Sheets &amp; Travelers</span>
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Full production specifications, client styles, target quantities, and embroidery details for active QC2 lots.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50/80 text-neutral-600 font-semibold border-b border-neutral-200 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4 font-bold">Sheet #</th>
                    <th className="py-3 px-4 font-bold">Client / Buyer</th>
                    <th className="py-3 px-4 font-bold">Style / Design</th>
                    <th className="py-3 px-4 font-bold">Fabric &amp; Color</th>
                    <th className="py-3 px-4 font-bold">Target Qty</th>
                    <th className="py-3 px-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {challans.filter((c) => c.program).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-neutral-500">
                        No production sheets linked to current QC2 challans.
                      </td>
                    </tr>
                  ) : (
                    // Deduplicate programs
                    Array.from(
                      new Map(
                        challans
                          .filter((c) => c.program)
                          .map((c) => [c.program!.id, c.program!])
                      ).values()
                    ).map((prg: any) => (
                      <tr key={prg.id} className="hover:bg-neutral-50/50 transition">
                        <td className="py-3 px-4 font-mono font-bold text-brand-900">
                          {prg.programSerialNo || prg.programNumber}
                        </td>
                        <td className="py-3 px-4 font-semibold text-neutral-900">
                          {prg.clientName || prg.buyerName || 'Standard Client'}
                        </td>
                        <td className="py-3 px-4 text-neutral-700">
                          {prg.mainStyle || prg.styleCode || '—'}
                          {prg.wilcomDesignNumber && (
                            <span className="text-[10px] text-neutral-500 font-mono block">
                              Wilcom: {prg.wilcomDesignNumber}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-neutral-600">
                          {prg.fabricName || '—'} · {prg.fabricColor || '—'}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-neutral-900">
                          {prg.targetQuantity || '—'} PCS
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <DocumentActionButtons
                              program={prg}
                              size="xs"
                            />
                            <Link
                              href={`/programs/${prg.id}`}
                              className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded transition"
                              title="Open Full Page"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* INSPECTION TERMINAL MODAL */}
      {selectedChallanForInspect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-neutral-900/70 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden my-auto max-h-[92vh] flex flex-col text-neutral-900">
            {/* MODAL HEADER */}
            <div className="p-4 sm:p-5 bg-white text-neutral-900 flex items-center justify-between border-b border-neutral-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-400 flex items-center justify-center shadow-sm">
                  <CheckCircle2 className="w-5 h-5 text-neutral-900" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">QC2 Garment Inspection Terminal</h3>
                  <p className="text-xs text-accent-700 font-mono">
                    Challan: {selectedChallanForInspect.challanNumber} · Sheet:{' '}
                    {selectedChallanForInspect.program?.programSerialNo ||
                      selectedChallanForInspect.program?.programNumber ||
                      '—'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedSheetForView(selectedChallanForInspect.program)}
                  className="px-2.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
                  title="View Official Production Sheet"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Production Sheet</span>
                </button>
                <button
                  onClick={() => setSelectedChallanForInspect(null)}
                  className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* LOT SUMMARY STRIP */}
            <div className="bg-neutral-50 px-5 py-3 border-b border-neutral-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-neutral-500 uppercase font-bold block">Client</span>
                <span className="font-semibold text-neutral-900 truncate block">
                  {selectedChallanForInspect.program?.clientName || 'Standard Client'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-neutral-500 uppercase font-bold block">Style / Design</span>
                <span className="font-semibold text-neutral-900 truncate block">
                  {selectedChallanForInspect.program?.mainStyle ||
                    selectedChallanForInspect.program?.styleCode ||
                    '—'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-neutral-500 uppercase font-bold block">Source Dept</span>
                <span className="font-semibold text-brand-800 block">Thread Cutting</span>
              </div>
              <div>
                <span className="text-[10px] text-neutral-500 uppercase font-bold block">Lot Total</span>
                <span className="font-mono font-bold text-accent-800 block">
                  {inspectionForm.quantityInspected} PCS
                </span>
              </div>
            </div>

            {/* MODAL FORM BODY */}
            <form onSubmit={handleSubmitInspection} className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* QUANTITIES GRID */}
              <div>
                <label className="block text-xs font-bold text-neutral-900 uppercase tracking-wider mb-2">
                  1. Piece Accounting &amp; Verification (PCS)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="text-[11px] font-semibold text-neutral-600 block mb-1">
                      Total Inspected
                    </span>
                    <input
                      type="number"
                      required
                      min="1"
                      value={inspectionForm.quantityInspected}
                      onChange={(e) => handleQuantityChange('quantityInspected', e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs font-mono font-bold text-neutral-900 focus:ring-2 focus:ring-brand-500/40 focus:outline-none"
                    />
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-accent-800 block mb-1">
                      Passed (Good)
                    </span>
                    <input
                      type="number"
                      required
                      min="0"
                      value={inspectionForm.quantityPassed}
                      onChange={(e) => handleQuantityChange('quantityPassed', e.target.value)}
                      className="w-full px-3 py-2 border border-accent-300 bg-accent-50/30 rounded-lg text-xs font-mono font-bold text-accent-800 focus:ring-2 focus:ring-brand-500/40 focus:outline-none"
                    />
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-danger-800 block mb-1">
                      Defective (Reject)
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={inspectionForm.quantityFailed}
                      onChange={(e) => handleQuantityChange('quantityFailed', e.target.value)}
                      className="w-full px-3 py-2 border border-danger-300 bg-danger-50/30 rounded-lg text-xs font-mono font-bold text-danger-700 focus:ring-2 focus:ring-danger-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-accent-800 block mb-1">
                      Rework (Trimming)
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={inspectionForm.quantityRework}
                      onChange={(e) => handleQuantityChange('quantityRework', e.target.value)}
                      className="w-full px-3 py-2 border border-accent-300 bg-accent-50/30 rounded-lg text-xs font-mono font-bold text-accent-800 focus:ring-2 focus:ring-brand-500/40 focus:outline-none"
                    />
                  </div>
                </div>

                {/* USER NOTICE: REJECTION TO DEFECTED SHELF */}
                {Number(inspectionForm.quantityFailed) > 0 && (
                  <div className="mt-2.5 p-2.5 rounded-lg bg-danger-50 border border-danger-200 text-xs text-danger-900 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-danger-600 shrink-0" />
                    <span>
                      <strong>Automated Action:</strong> {inspectionForm.quantityFailed} defective pieces will be dispatched directly to <strong className="font-mono">Fabric Store Defected Shelf (DEF-SHELF-01)</strong>.
                    </span>
                  </div>
                )}
              </div>

              {/* DEFECT CATEGORIES CHECKLIST */}
              {Number(inspectionForm.quantityFailed) > 0 && (
                <div>
                  <label className="block text-xs font-bold text-neutral-900 uppercase tracking-wider mb-2">
                    2. Defect Classification Checklist
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {DEFECT_CATEGORIES.map((cat) => {
                      const count = selectedDefects[cat.id] || 0;
                      return (
                        <div
                          key={cat.id}
                          className={`p-2 rounded-lg border text-xs cursor-pointer transition flex flex-col justify-between ${
                            count > 0
                              ? 'border-danger-500 bg-danger-50/60 text-danger-900 font-semibold'
                              : 'border-neutral-200 hover:border-neutral-300 text-neutral-700'
                          }`}
                        >
                          <div className="truncate text-[11px] mb-1.5">{cat.label}</div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleDefectCountChange(cat.id, Math.max(0, count - 1))}
                              className="w-5 h-5 rounded bg-neutral-200 hover:bg-neutral-300 flex items-center justify-center text-xs font-bold text-neutral-700"
                            >
                              -
                            </button>
                            <span className="font-mono font-bold text-xs w-6 text-center">{count}</span>
                            <button
                              type="button"
                              onClick={() => handleDefectCountChange(cat.id, count + 1)}
                              className="w-5 h-5 rounded bg-danger-600 text-white hover:bg-danger-700 flex items-center justify-center text-xs font-bold"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* DEFECT REMARKS */}
              {Number(inspectionForm.quantityFailed) > 0 && (
                <div>
                  <label className="block text-xs font-bold text-danger-800 mb-1">
                    Defect Remarks &amp; Quarantine Notes (Required for Defected Shelf) *
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Describe specific needle holes, broken stitches, unfixable fabric flaws..."
                    value={inspectionForm.defectRemarks}
                    onChange={(e) => setInspectionForm({ ...inspectionForm, defectRemarks: e.target.value })}
                    className="w-full px-3 py-2 border border-danger-300 rounded-lg text-xs focus:ring-2 focus:ring-danger-500 focus:outline-none"
                  />
                </div>
              )}

              {/* REWORK REASON */}
              {Number(inspectionForm.quantityRework) > 0 && (
                <div>
                  <label className="block text-xs font-bold text-accent-800 mb-1">
                    Rework Instructions for Thread Cutting Section *
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Specify threads needing re-trimming or needle points to clean..."
                    value={inspectionForm.reworkReason}
                    onChange={(e) => setInspectionForm({ ...inspectionForm, reworkReason: e.target.value })}
                    className="w-full px-3 py-2 border border-accent-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500/40 focus:outline-none"
                  />
                </div>
              )}

              {/* MANUAL CHALLAN NUMBERS FOR GENERATED CHALLANS */}
              {qc2NeededChallanNumbers(inspectionForm).length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {qc2NeededChallanNumbers(inspectionForm).map(({ field, label }) => (
                    <ChallanNumberField
                      key={field}
                      compact
                      label={label}
                      value={challanNumbers[field]}
                      onChange={(v) => {
                        setChallanNumbers((prev) => ({ ...prev, [field]: v }));
                        setChallanNumberErrors((prev) => ({ ...prev, [field]: undefined }));
                      }}
                      error={challanNumberErrors[field]}
                    />
                  ))}
                </div>
              )}

              {/* OVERALL REMARKS */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  General QC2 Observation Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dimensions verified. Thread trims cleared. Passed inspection."
                  value={inspectionForm.remarks}
                  onChange={(e) => setInspectionForm({ ...inspectionForm, remarks: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500/40 focus:outline-none"
                />
              </div>

              {/* ACTIONS */}
              <div className="pt-3 border-t border-neutral-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedChallanForInspect(null)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold text-xs rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingInspection}
                  className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submittingInspection ? (
                    <span>Submitting Inspection...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Complete QC2 Inspection</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INSPECTION RESULT SUCCESS MODAL */}
      {inspectionResultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-neutral-200 text-neutral-900 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-accent-100 text-accent-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">QC2 Inspection Completed!</h3>
                <p className="text-xs text-neutral-500">
                  Result: <strong className="text-accent-800">{inspectionResultModal.result}</strong>
                </p>
              </div>
            </div>

            <div className="bg-neutral-50 rounded-xl p-3 space-y-2 text-xs border border-neutral-200">
              <div className="flex items-center justify-between">
                <span className="text-neutral-600">Passed (Good PCS):</span>
                <span className="font-mono font-bold text-accent-800">
                  {inspectionResultModal.quantityPassed} PCS
                </span>
              </div>
              {inspectionResultModal.quantityFailed > 0 && (
                <div className="flex items-center justify-between border-t border-neutral-200 pt-1.5">
                  <span className="text-danger-700 font-semibold">Defective Shelf Return:</span>
                  <span className="font-mono font-bold text-danger-700">
                    {inspectionResultModal.defectiveReturnChallan || 'Dispatched to DEF-SHELF-01'}
                  </span>
                </div>
              )}
              {inspectionResultModal.quantityRework > 0 && (
                <div className="flex items-center justify-between border-t border-neutral-200 pt-1.5">
                  <span className="text-accent-800 font-semibold">Rework Return (TC):</span>
                  <span className="font-mono font-bold text-accent-800">
                    {inspectionResultModal.reworkReturnChallan || 'Dispatched to TC'}
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={() => setInspectionResultModal(null)}
              className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* VIEW CHALLAN SLIP MODAL */}
      {selectedChallanForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/70 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl border border-neutral-200 text-neutral-900 space-y-4 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
              <div>
                <h3 className="text-base font-bold text-neutral-900">
                  Challan #{selectedChallanForView.challanNumber}
                </h3>
                <span className="text-xs text-neutral-500 font-mono">
                  From: Thread Cutting → To: QC2
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedSheetForView(selectedChallanForView.program)}
                  className="px-2.5 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-xs transition"
                  title="View Official Production Sheet"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Production Sheet</span>
                </button>
                <button
                  onClick={() => setSelectedChallanForView(null)}
                  className="p-1 rounded text-neutral-500 hover:text-neutral-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-neutral-500">Sheet #:</span>
                <span className="font-mono font-bold text-neutral-900">
                  {selectedChallanForView.program?.programSerialNo ||
                    selectedChallanForView.program?.programNumber ||
                    '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Client:</span>
                <span className="font-semibold text-neutral-900">
                  {selectedChallanForView.program?.clientName || 'Standard Client'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Style:</span>
                <span className="font-semibold text-neutral-900">
                  {selectedChallanForView.program?.mainStyle ||
                    selectedChallanForView.program?.styleCode ||
                    'General Lot'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Status:</span>
                <span className="font-bold text-accent-800">{selectedChallanForView.status}</span>
              </div>
              <div className="border-t border-neutral-200 pt-2">
                <span className="text-[11px] font-bold text-neutral-700 block mb-1">Items:</span>
                {selectedChallanForView.items.map((it: any, idx: number) => (
                  <div key={idx} className="flex justify-between py-1 bg-neutral-50 px-2 rounded mb-1">
                    <span>{it.itemDescription}</span>
                    <span className="font-mono font-bold">
                      {it.quantity} {it.uom || 'PCS'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-200 flex justify-end">
              <button
                onClick={() => setSelectedChallanForView(null)}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold text-xs rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ISSUE HANDOVER CHALLAN TO WASHING */}
      {issuingToWashing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/70 backdrop-blur-xs animate-in fade-in">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleIssueToWashing(issuingToWashing);
            }}
            className="relative w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl border border-neutral-200 text-neutral-900 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <Waves className="w-4 h-4 text-brand-700" />
                Issue to Washing
              </h3>
              <button
                type="button"
                onClick={() => setIssuingToWashing(null)}
                className="p-1 rounded text-neutral-500 hover:text-neutral-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-neutral-600">
              Sheet{' '}
              <span className="font-mono font-bold">
                {issuingToWashing.program?.programSerialNo || issuingToWashing.program?.programNumber || '—'}
              </span>{' '}
              ·{' '}
              {issuingToWashing.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0)} PCS
            </p>
            <ChallanNumberField
              compact
              label="Washing challan number"
              value={washingChallanNumber}
              onChange={(v) => {
                setWashingChallanNumber(v);
                setWashingChallanNumberError(null);
              }}
              error={washingChallanNumberError}
            />
            {washingIssueError && (
              <p className="text-[11px] font-semibold text-danger-700">{washingIssueError}</p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIssuingToWashing(null)}
                className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold text-xs rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingWashingIssue}
                className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-lg shadow-xs transition disabled:opacity-50"
              >
                {submittingWashingIssue ? 'Issuing...' : 'Issue Challan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: CHALLAN ISSUED TO WASHING SUCCESSFULLY */}
      {washingChallanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/70 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl border border-neutral-200 text-neutral-900 space-y-4 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center text-brand-700">
                  <Waves className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    Handover Challan Issued to Washing!
                  </h3>
                  <p className="text-xs text-neutral-500 font-mono">
                    {washingChallanModal.challanNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setWashingChallanModal(null)}
                className="p-1 rounded text-neutral-500 hover:text-neutral-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-brand-50/60 p-3 rounded-xl border border-brand-100 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-neutral-600">From Department:</span>
                  <span className="font-semibold text-neutral-900">QC2 Department</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">To Department:</span>
                  <span className="font-bold text-brand-700">WASHING DEPARTMENT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Pieces Dispatched:</span>
                  <span className="font-mono font-bold text-neutral-900">
                    {washingChallanModal.items?.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0) || '—'} PCS
                  </span>
                </div>
              </div>

              {/* BARCODE STICKER TAG */}
              <BarcodeStickerCard
                params={{
                  challanNumber: washingChallanModal.challanNumber,
                  designNumber:
                    washingChallanModal.program?.wilcomDesignNumber ||
                    washingChallanModal.program?.programSerialNo ||
                    'WASH-TAG',
                  departmentName: 'QC2 Handover to Washing',
                  fromDepartment: 'QC2',
                  toDepartment: 'WASHING',
                  programSerialNo: washingChallanModal.program?.programSerialNo,
                  clientName: washingChallanModal.program?.clientName,
                  mainStyle:
                    washingChallanModal.program?.mainStyle ||
                    washingChallanModal.program?.styleCode,
                  totalQuantity:
                    washingChallanModal.items?.reduce(
                      (s: number, it: any) => s + (Number(it.quantity) || 0),
                      0
                    ) || 0,
                  uom: 'PCS',
                }}
                title="Washing Handover Barcode Tag"
              />
            </div>

            <div className="pt-3 border-t border-neutral-200 flex items-center justify-end gap-2">
              <Link
                href={`/challans/${washingChallanModal.id}`}
                className="px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>View Full Challan Slip</span>
              </Link>
              <button
                onClick={() => setWashingChallanModal(null)}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold text-xs rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRODUCTION SHEET PRINT / TRAVELER MODAL */}
      {selectedSheetForView && (
        <ProductionSheetPrintModal
          program={selectedSheetForView}
          isOpen={!!selectedSheetForView}
          onClose={() => setSelectedSheetForView(null)}
        />
      )}
    </div>
  );
}
