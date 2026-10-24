'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Scissors,
  Send,
  FileText,
  CheckCircle2,
  Layers,
  Sparkles,
  Eye,
  Plus,
  Trash2,
  Calendar,
  Clock,
  Printer,
  Download,
  Search,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  X,
  PackageCheck,
  ArrowRight,
  TrendingDown,
  Percent,
  AlertTriangle,
  ShieldAlert,
  Archive,
  PackageX,
  RotateCcw,
  Boxes,
} from 'lucide-react';
import { DepartmentStockView } from '@/components/DepartmentStockView';
import { DepartmentDefectiveShelfWidget } from '@/components/DepartmentDefectiveShelfWidget';
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';
import BarcodeStickerCard from '@/components/BarcodeStickerCard';
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

interface ItemRow {
  fabricMeasurementPcs: string; // Color / Fabric / Measurement (PCS)
  colorCodeWidth: string; // Color code / width
  quantity: number;
  remarks: string;
}

export default function ThreadCuttingMyWorkPage() {
  const [activeTab, setActiveTab] = useState<
    'INCOMING_EMBROIDERY' | 'CREATE_THREADCUT_QC_CHALLAN' | 'STOCK' | 'DEFECT_RETURNS'
  >('INCOMING_EMBROIDERY');

  // Incoming Tracking State ("Incoming Challan from Embroidery -> Pieces in, Pieces out, Remarks")
  const [incomingChallans, setIncomingChallans] = useState<any[]>([]);
  const [defectReturnChallans, setDefectReturnChallans] = useState<any[]>([]);
  const [selectedIncoming, setSelectedIncoming] = useState<any | null>(null);
  const [piecesIn, setPiecesIn] = useState<number>(0);
  const [piecesOut, setPiecesOut] = useState<number>(0);
  const [piecesDefected, setPiecesDefected] = useState<number>(0);
  const [defectReason, setDefectReason] = useState<string>('');
  const [customDefectReason, setCustomDefectReason] = useState<string>('');
  const [defectComments, setDefectComments] = useState<string>('');
  const [defectiveShelfLocation, setDefectiveShelfLocation] = useState<string>(
    'DEF-SHELF-THREAD-CUTTING (Thread Cutting Trimming Shelf)'
  );
  const [incomingRemarks, setIncomingRemarks] = useState<string>('');
  const [updatingPieceCount, setUpdatingPieceCount] = useState(false);
  const [submittingDefectReturn, setSubmittingDefectReturn] = useState(false);
  const [createdDefectModal, setCreatedDefectModal] = useState<any | null>(null);

  // Form State: "Challan from Thread Cutting to Threadcut QC (Quality check 2)"
  const [challanNumber, setChallanNumber] = useState('');
  const [challanDate, setChallanDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [sourceDept] = useState('Thread Cutting Department');
  const [destinationDept] = useState('Threadcut QC');
  const [priority, setPriority] = useState<'NORMAL' | 'URGENT' | 'HIGH'>('NORMAL');
  const [deliveryDate, setDeliveryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  });
  const [designNumber, setDesignNumber] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [inchargeName, setInchargeName] = useState('Thread Cutting Incharge');

  // Dynamic Table Items for Threadcut QC Challan
  const [items, setItems] = useState<ItemRow[]>([
    {
      fabricMeasurementPcs: 'Dyed Cotton / Embroidered Front Panel / 120 PCS',
      colorCodeWidth: 'CC-NV-01 / 58 INCH',
      quantity: 120,
      remarks: 'Threads trimmed & cleaned. Ready for Threadcut QC inspection.',
    },
  ]);

  // Master Programs & Modals
  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<any | null>(null);
  const [showSheetPickerModal, setShowSheetPickerModal] = useState(false);
  const [showSheetDetailModal, setShowSheetDetailModal] = useState<any | null>(null);
  const [createdChallanModal, setCreatedChallanModal] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      // 1. Fetch dashboard data
      const res = await fetch('/api/thread-cutting/dashboard');
      const json = await res.json();
      if (json.success) {
        setIncomingChallans(json.data.incomingChallans || []);
        setDefectReturnChallans(json.data.defectReturnChallans || []);
        setPrograms(json.data.programs || []);

        if (json.data.incomingChallans?.length > 0 && !selectedIncoming) {
          selectIncomingChallan(json.data.incomingChallans[0]);
        }
      }

      // The challan number to Threadcut QC is entered manually.
    } catch (err) {
      console.error('Error loading Thread Cutting work data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectIncomingChallan = (ch: any) => {
    setSelectedIncoming(ch);
    const totalPcs = (ch.items || []).reduce(
      (acc: number, it: any) => acc + (Number(it.quantity) || 0),
      0
    );
    // Pieces OUT from the previous department (Embroidery) is the IN for Thread Cutting!
    const effectiveIn =
      ch.fabricOut !== null && ch.fabricOut !== undefined
        ? Number(ch.fabricOut)
        : totalPcs > 0
          ? totalPcs
          : Number(ch.fabricIn) || 0;
    setPiecesIn(effectiveIn);
    // Pieces out defaults to pieces in unless defected
    setPiecesOut(effectiveIn);
    setPiecesDefected(0);
    setDefectReason('');
    setCustomDefectReason('');
    setDefectComments('');
    setIncomingRemarks(ch.remarks || 'Received from Embroidery. Thread trimming underway.');

    // Pre-populate Threadcut QC challan fields from this incoming assignment
    setSerialNumber(ch.program?.programSerialNo || ch.program?.programNumber || '');
    setDesignNumber(ch.program?.wilcomDesignNumber || 'WILCOM-DES-01');
    if (ch.program) {
      setSelectedProgram(ch.program);
    }

    if (ch.items && ch.items.length > 0) {
      setItems(
        ch.items.map((it: any) => ({
          fabricMeasurementPcs: `${it.itemDescription || 'Embroidered Panel'} / ${it.quantity} PCS`,
          colorCodeWidth: `${it.fabricCode || 'STD-WIDTH'} / 58"`,
          quantity: Number(it.quantity) || 1,
          remarks: 'Thread cutting completed, ready for Threadcut QC',
        }))
      );
    }
  };

  const applyProgramToForm = (prog: any) => {
    setSelectedProgram(prog);
    setSerialNumber(prog.programSerialNo || prog.programNumber || '');
    setDesignNumber(prog.wilcomDesignNumber || 'WILCOM-DES-01');

    setItems([
      {
        fabricMeasurementPcs: `${prog.fabricColor ? 'Dyed ' + prog.fabricColor : 'Dyed Panel'} / ${prog.mainStyle || 'Style'} / ${prog.targetQuantity || 100} PCS`,
        colorCodeWidth: `${prog.wilcomDesignNumber || 'WLC-01'} / 58 INCH`,
        quantity: prog.targetQuantity || 100,
        remarks: `Thread trimmed per Sheet #${prog.programSerialNo || prog.programNumber}`,
      },
    ]);
  };

  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        fabricMeasurementPcs: '',
        colorCodeWidth: '',
        quantity: '' as any,
        remarks: '',
      },
    ]);
  };

  const removeItemRow = (idx: number) => {
    if (items.length <= 1) {
      alert('A minimum of one item row is required in the Challan.');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateItemRow = (idx: number, field: keyof ItemRow, val: any) => {
    setItems((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: val } : row))
    );
  };

  const [receivingId, setReceivingId] = useState<string | null>(null);

  const handleQuickReceive = async (ch: any) => {
    try {
      setReceivingId(ch.id);
      const totalPcs = (ch.items || []).reduce(
        (acc: number, it: any) => acc + (Number(it.quantity) || 0),
        0
      );
      const effectiveIn =
        ch.fabricOut !== null && ch.fabricOut !== undefined
          ? Number(ch.fabricOut)
          : totalPcs > 0
            ? totalPcs
            : Number(ch.fabricIn) || 0;

      const res = await fetch(`/api/challans/${ch.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'RECEIVED',
          fabricIn: effectiveIn,
          fabricUnit: 'PCS',
          notes: 'Material received onto Thread Cutting floor. Floor stock updated.',
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to receive material');
      }
      setToastMsg(`Challan ${ch.challanNumber} received successfully! Thread Cutting stock updated.`);
      setTimeout(() => setToastMsg(null), 4500);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Error receiving challan');
    } finally {
      setReceivingId(null);
    }
  };

  // Handle incoming challan piece tracking update
  const handleSaveIncomingTracking = async () => {
    if (!selectedIncoming) return;
    const resolvedReason = defectReason === 'Other' ? customDefectReason.trim() : defectReason.trim();
    if (piecesDefected > 0 && !resolvedReason) {
      alert('Please enter a specific reason for the defect.');
      return;
    }
    try {
      setUpdatingPieceCount(true);
      const res = await fetch(`/api/challans/${selectedIncoming.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'RECEIVED',
          fabricIn: piecesIn,
          fabricOut: piecesOut,
          fabricUnit: 'PCS',
          defectivePieces: piecesDefected,
          defectiveShelfLocation: 'DEF-SHELF-THREAD-CUTTING',
          defectReason: piecesDefected > 0 ? resolvedReason : null,
          notes: `Thread Cutting Progress: Pieces In: ${piecesIn} PCS | Pieces Out: ${piecesOut} PCS | Defective: ${piecesDefected} PCS | Remarks: ${incomingRemarks}`,
        }),
      });
      const responseBody = await res.json();
      if (!res.ok) throw new Error(responseBody.error || 'Failed to save Thread Cutting progress.');

      setToastMsg(
        `Saved piece tracking for Challan ${selectedIncoming.challanNumber}: In ${piecesIn} PCS, Out ${piecesOut} PCS, Defective ${piecesDefected} PCS quarantined on the local shelf.`
      );
      setTimeout(() => setToastMsg(null), 4500);
      await loadData();
    } catch (err: any) {
      console.error(err);
      alert('Failed to update tracking: ' + err.message);
    } finally {
      setUpdatingPieceCount(false);
    }
  };

  // Switch to Threadcut QC tab with verified good pieces
  const handleProceedToThreadcutQC = () => {
    setActiveTab('CREATE_THREADCUT_QC_CHALLAN');
    if (items.length > 0 && piecesOut > 0) {
      setItems((prev) =>
        prev.map((it, idx) => (idx === 0 ? { ...it, quantity: piecesOut } : it))
      );
    }
  };

  // Record defective pieces on the incoming challan's Thread Cutting shelf entry.
  const handleSendToDefectiveShelf = async () => {
    if (!selectedIncoming) {
      alert('Please select an incoming Embroidery challan first.');
      return;
    }
    if (piecesDefected <= 0) {
      alert('Please specify the count of defective pieces (> 0).');
      return;
    }

    const resolvedReason =
      defectReason === 'Other'
        ? customDefectReason.trim() || 'Custom Defect'
        : defectReason;

    if (!resolvedReason.trim() || (defectReason === 'Other' && !customDefectReason.trim())) {
      alert('Please enter a specific reason for the defect.');
      return;
    }

    try {
      setSubmittingDefectReturn(true);
      const res = await fetch(`/api/challans/${selectedIncoming.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'RECEIVED',
          fabricIn: Number(piecesIn),
          fabricOut: Number(piecesOut),
          fabricUnit: 'PCS',
          defectivePieces: Number(piecesDefected),
          defectiveShelfLocation: defectiveShelfLocation,
          defectReason: resolvedReason,
          notes: `Thread Cutting defect recorded on local shelf: ${piecesDefected} PCS | Reason: ${resolvedReason}${defectComments.trim() ? ` | Comments: ${defectComments.trim()}` : ''}`,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to record defect on the Thread Cutting shelf');
      }

      setCreatedDefectModal(json);
      setToastMsg(
        `${piecesDefected} PCS recorded on the Thread Cutting Defective Shelf. Fabric Store can view the same entry centrally.`
      );
      setTimeout(() => setToastMsg(null), 6000);
      loadData();
    } catch (err: any) {
      console.error('Error recording Thread Cutting defect:', err);
      alert('Error: ' + err.message);
    } finally {
      setSubmittingDefectReturn(false);
    }
  };

  // Submit Challan from Thread Cutting to Threadcut QC
  const handleSubmitThreadcutQCChallan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challanNumber.trim()) {
      alert('Please enter a valid Challan Number.');
      return;
    }
    if (items.length === 0) {
      alert('Please add at least one item to the Challan.');
      return;
    }

    try {
      setSubmitting(true);
      const totalPcsToThreadcutQc = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
      const resolvedDefectReason =
        defectReason === 'Other'
          ? customDefectReason.trim() || 'Custom Defect'
          : defectReason;

      if (piecesDefected > 0 && selectedIncoming) {
        if (!resolvedDefectReason.trim()) throw new Error('Please enter a specific reason for the defect.');
        const defectRes = await fetch(`/api/challans/${selectedIncoming?.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'RECEIVED',
            fabricIn: piecesIn,
            fabricOut: piecesOut,
            fabricUnit: 'PCS',
            defectivePieces: piecesDefected,
            defectiveShelfLocation,
            defectReason: resolvedDefectReason,
            notes: `Thread Cutting defect recorded on local shelf: ${piecesDefected} PCS | Reason: ${resolvedDefectReason}`,
          }),
        });
        const defectJson = await defectRes.json();
        if (!defectRes.ok) throw new Error(defectJson.error || 'Failed to record defects on the Thread Cutting shelf.');
      }

      const payload = {
        challanNumber: challanNumber.trim(),
        challanType: 'INTER_DEPARTMENT',
        fromDepartment: 'THREAD_CUTTING',
        toDepartment: 'THREADCUT_QC',
        parentChallanId: selectedIncoming?.id || null,
        priority: priority,
        issuedDate: challanDate,
        programId: selectedProgram?.id || serialNumber,
        fabricIn: piecesIn,
        defectivePieces: selectedIncoming ? 0 : piecesDefected,
        defectiveShelfLocation: selectedIncoming ? null : defectiveShelfLocation,
        defectReason: selectedIncoming || piecesDefected <= 0 ? null : resolvedDefectReason,
        fabricOut: totalPcsToThreadcutQc,
        fabricUnit: 'PCS',
        detectedFromDepartment: selectedIncoming?.fromDepartment || 'EMBROIDERY',
        detectedFromChallanId: selectedIncoming?.id || null,
        remarks: `Thread Cutting Handover to Threadcut QC | Dispatched for Checking: ${totalPcsToThreadcutQc} PCS (Inspection Basis: ${totalPcsToThreadcutQc} PCS) | Design: ${designNumber} | Sheet: ${serialNumber} | Incharge: ${inchargeName} | Defective pieces recorded on the Thread Cutting shelf: ${piecesDefected} PCS${piecesDefected > 0 ? ` (${resolvedDefectReason})` : ''}`,
        fabricType: selectedProgram?.fabricType || selectedProgram?.fabricName || selectedIncoming?.program?.fabricType || selectedIncoming?.program?.fabricName || undefined,
        items: items.map((it) => ({
          itemDescription: it.fabricMeasurementPcs,
          colour: selectedProgram?.fabricColor || selectedIncoming?.items?.[0]?.colour || selectedIncoming?.program?.fabricColor || 'Dyed',
          fabricCode: it.colorCodeWidth,
          quantity: Number(it.quantity) || 1,
          uom: 'PCS', // Strictly PCS as circled in diagram
          remarks: it.remarks || `Threadcut QC Inspection Lot: ${it.quantity} PCS`,
        })),
      };

      const res = await fetch('/api/challans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to issue challan to Threadcut QC');
      }

      setCreatedChallanModal(json);
      setChallanNumber('');
      setToastMsg(`Challan ${json.challanNumber} to Threadcut QC created successfully!`);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      setTimeout(() => setToastMsg(null), 5000);
      loadData();
    } catch (err: any) {
      console.error(err);
      alert('Error creating challan: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink-50">
      {/* HEADER WITH REAL DB BACKGROUND */}
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
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400 block drop-shadow-sm">
              SHUBHAM FABRICS MES · THREAD CUTTING DEPARTMENT
            </span>
            <h1 className="text-xl font-bold text-white flex items-center gap-2.5 drop-shadow-sm">
              <Scissors className="w-5 h-5 text-cyan-400" />
              <span>Thread Cutting · My Work</span>
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-lg border border-slate-700/60 transition"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <Link
              href="/thread-cutting"
              className="px-3 py-2 bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* TOAST ALERT */}
      {toastMsg && (
        <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-4">
          <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs font-semibold flex items-center gap-2 shadow-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{toastMsg}</span>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {/* TABS:
            1. Incoming Challan from Embroidery (Pieces In, Pieces Out, Local Defective Shelf)
            2. Challan from Thread Cutting to Threadcut QC (Quality check 2)
            3. Record Defects on Thread Cutting Shelf */}
        <div className="bg-white border border-slate-200 rounded-2xl p-2 shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('INCOMING_EMBROIDERY')}
              className={`p-3.5 rounded-xl border font-bold text-xs flex items-center justify-between transition cursor-pointer ${
                activeTab === 'INCOMING_EMBROIDERY'
                  ? 'bg-cyan-50/90 border-cyan-400 text-cyan-950 shadow-xs'
                  : 'bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <PackageCheck className="w-4 h-4 text-cyan-600" />
                <span className="uppercase tracking-wide">Incoming Embroidery</span>
              </div>
              <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-cyan-100 text-cyan-800 font-bold">
                {incomingChallans.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('CREATE_THREADCUT_QC_CHALLAN')}
              className={`p-3.5 rounded-xl border font-bold text-xs flex items-center justify-between transition cursor-pointer ${
                activeTab === 'CREATE_THREADCUT_QC_CHALLAN'
                  ? 'bg-emerald-50/90 border-emerald-400 text-emerald-950 shadow-xs'
                  : 'bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Send className="w-4 h-4 text-emerald-600" />
                <span className="uppercase tracking-wide">Challan to Threadcut QC</span>
              </div>
              <span className="text-[10px] uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                Handover Gate
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('STOCK')}
              className={`p-3.5 rounded-xl border font-bold text-xs flex items-center justify-between transition cursor-pointer ${
                activeTab === 'STOCK'
                  ? 'bg-purple-50/90 border-purple-400 text-purple-950 shadow-xs'
                  : 'bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Boxes className="w-4 h-4 text-purple-600" />
                <span className="uppercase tracking-wide">Stock &amp; Balance</span>
              </div>
              <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold">
                Audited
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('DEFECT_RETURNS')}
              className={`p-3.5 rounded-xl border font-bold text-xs flex items-center justify-between transition cursor-pointer ${
                activeTab === 'DEFECT_RETURNS'
                  ? 'bg-rose-50/90 border-rose-400 text-rose-950 shadow-xs'
                  : 'bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span className="uppercase tracking-wide">Defective Shelf</span>
              </div>
              <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold">
                DEF-SHELF-THREAD-CUTTING
              </span>
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* SECTION 1: INCOMING CHALLAN FROM EMBROIDERY (AS DRAWN IN SKETCH) */}
        {/* ============================================================== */}
        {activeTab === 'INCOMING_EMBROIDERY' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT LIST: INCOMING EMBROIDERY CHALLANS */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center justify-between pb-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Embroidery Transfers
                </h3>
                <span className="text-xs text-slate-500 font-mono">
                  {incomingChallans.length} Staged
                </span>
              </div>

              {incomingChallans.length === 0 ? (
                <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl text-slate-500 text-xs">
                  <Scissors className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-700">No incoming Embroidery challans</p>
                  <p className="text-slate-400 mt-1">
                    When Embroidery issues a challan with destination Thread Cutting, it will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[680px] overflow-y-auto">
                  {incomingChallans.map((ch: any) => {
                    const isSelected = selectedIncoming?.id === ch.id;
                    const totalPcs = (ch.items || []).reduce(
                      (acc: number, it: any) => acc + (Number(it.quantity) || 0),
                      0
                    );

                    return (
                      <div
                        key={ch.id}
                        onClick={() => selectIncomingChallan(ch)}
                        className={`p-4 rounded-xl border cursor-pointer transition ${
                          isSelected
                            ? 'bg-cyan-50/70 border-cyan-400 shadow-sm'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono text-xs font-bold text-slate-900">
                            {ch.challanNumber}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {ch.status !== 'RECEIVED' && ch.status !== 'IN_PROGRESS' && ch.status !== 'COMPLETED' ? (
                              <button
                                type="button"
                                disabled={receivingId === ch.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuickReceive(ch);
                                }}
                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-lavender-600 hover:bg-lavender-700 text-white shadow-2xs transition cursor-pointer"
                                title="Click to receive material into Thread Cutting floor stock"
                              >
                                {receivingId === ch.id ? 'Receiving...' : 'Receive'}
                              </button>
                            ) : (
                              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800 border border-cyan-200">
                                {ch.status}
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-xs font-semibold text-slate-800 line-clamp-1">
                          {ch.program?.mainStyle || ch.program?.clientName || 'General Embroidery'}
                        </p>

                        <div className="mt-2 flex items-center justify-between text-[11px]">
                          <span className="font-mono text-fuchsia-700 font-bold">
                            {ch.program?.wilcomDesignNumber || 'WILCOM-STD'}
                          </span>
                          <span className="font-mono font-bold text-slate-900">
                            {totalPcs} PCS
                          </span>
                        </div>

                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                          <span>Sheet: {ch.program?.programSerialNo || ch.program?.programNumber || '—'}</span>
                          <span>{new Date(ch.createdAt).toLocaleDateString('en-GB')}</span>
                        </div>

                        {/* COMPLETE DOCUMENT ACTIONS: PRODUCTION SHEET, CHALLAN & WILCOM */}
                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
                          <DocumentActionButtons program={ch.program} challan={ch} size="xs" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RIGHT PANEL: PIECES IN, PIECES OUT, REMARKS TRACKING (FROM USER SKETCH) */}
            <div className="lg:col-span-7">
              {selectedIncoming ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                  {/* HEADER */}
                  <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-600 block">
                        ACTIVE TRIMMING LOT FROM EMBROIDERY
                      </span>
                      <h2 className="text-lg font-bold text-slate-900 font-mono mt-0.5">
                        {selectedIncoming.challanNumber}
                      </h2>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* CHALLAN SUITE */}
                      <Link
                        href={`/challans/${selectedIncoming.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                        <span>Slip</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => downloadChallanHtml(selectedIncoming)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition cursor-pointer"
                        title="Download Challan HTML"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Challan</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => printChallan(selectedIncoming)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                        title="Print Challan Slip"
                      >
                        <Printer className="w-3.5 h-3.5 text-slate-500" />
                        <span>Print Challan</span>
                      </button>

                      {/* PRODUCTION SHEET SUITE */}
                      {selectedIncoming.program && (
                        <>
                          <button
                            type="button"
                            onClick={() => setShowSheetDetailModal(selectedIncoming.program)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-900 rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5 text-blue-600" />
                            <span>View Sheet</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadProductionSheetHtml(selectedIncoming.program)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-sky-50 border border-sky-200 hover:bg-sky-100 text-sky-700 rounded-lg text-xs font-bold transition cursor-pointer"
                            title="Download Production Sheet HTML"
                          >
                            <Download className="w-3.5 h-3.5 text-sky-600" />
                            <span>Download Sheet</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => printProductionSheet(selectedIncoming.program)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                            title="Print Production Sheet Traveler"
                          >
                            <Printer className="w-3.5 h-3.5 text-slate-600" />
                            <span>Print Sheet</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* MASTER PRODUCTION SHEET CARD */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-emerald-700" />
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                          Accompanying Production Sheet (Traveled from Embroidery)
                        </span>
                      </div>
                      {selectedIncoming.program && (
                        <div className="flex items-center gap-2 print:hidden">
                          <button
                            type="button"
                            onClick={() => setShowSheetDetailModal(selectedIncoming.program)}
                            className="text-xs font-bold text-indigo-700 hover:text-indigo-900 underline flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Preview</span>
                          </button>
                          <span className="text-slate-300">·</span>
                          <button
                            type="button"
                            onClick={() => printProductionSheet(selectedIncoming.program)}
                            className="text-xs font-bold text-blue-700 hover:text-blue-900 underline flex items-center gap-1 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Print</span>
                          </button>
                          <span className="text-slate-300">·</span>
                          <button
                            type="button"
                            onClick={() => downloadProductionSheetHtml(selectedIncoming.program)}
                            className="text-xs font-bold text-slate-700 hover:text-slate-900 underline flex items-center gap-1 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">
                          Master Sheet Serial #
                        </span>
                        <strong className="font-mono text-slate-900">
                          {selectedIncoming.program?.programSerialNo || selectedIncoming.program?.programNumber || '—'}
                        </strong>
                      </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">
                        Wilcom Design #
                      </span>
                      <strong className="font-mono text-fuchsia-700">
                        {selectedIncoming.program?.wilcomDesignNumber || 'WILCOM-STD'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">
                        Client / Style
                      </span>
                      <strong className="text-slate-900 truncate block">
                        {selectedIncoming.program?.clientName || 'Standard'} / {selectedIncoming.program?.mainStyle || 'Style'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">
                        Priority
                      </span>
                      <strong className="text-amber-700 uppercase font-mono">
                        {selectedIncoming.priority || 'NORMAL'}
                      </strong>
                    </div>
                  </div>
                </div>

                  {/* USER SKETCH HIGHLIGHT:
                      - Pieces in (From Embroidery)
                      - Pieces out (Ready for Threadcut QC)
                      - Defective Pieces (Thread Cutting shelf with reason)
                      - Remarks */}
                  <div className="p-5 bg-cyan-50/50 border border-cyan-200 rounded-2xl space-y-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-cyan-950 flex items-center gap-2">
                        <Scissors className="w-4 h-4 text-cyan-600" />
                        <span>Thread Cutting Piece Reconciliation &amp; Defect Control</span>
                      </span>
                      <span className="text-[10px] font-mono text-cyan-700 font-bold bg-cyan-100 px-2 py-0.5 rounded">
                        PIECE RECONCILIATION
                      </span>
                    </div>

                    {/* 3-COLUMN INPUTS */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      {/* 1. Pieces in (From Embroidery) */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                          1. Pieces in (Embroidery) *
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            value={piecesIn}
                            onChange={(e) => setPiecesIn(Number(e.target.value))}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-mono text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-lavender-600"
                          />
                          <span className="absolute right-3.5 top-2.5 text-xs font-bold text-slate-400">
                            PCS
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 mt-0.5 block">
                          Verified panels received from Embroidery.
                        </span>
                      </div>

                      {/* 2. Pieces out (Ready for Threadcut QC) */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                          2. Pieces out (Good to Threadcut QC) *
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            value={piecesOut}
                            onChange={(e) => setPiecesOut(Number(e.target.value))}
                            className="w-full px-3.5 py-2.5 bg-white border border-emerald-300 rounded-xl font-mono text-base font-bold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-lavender-600"
                          />
                          <span className="absolute right-3.5 top-2.5 text-xs font-bold text-slate-400">
                            PCS
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 mt-0.5 block">
                          Clean trimmed pieces ready for Threadcut QC.
                        </span>
                      </div>

                      {/* 3. Defective Pieces (Thread Cutting local shelf) */}
                      <div>
                        <label className="text-[11px] font-bold text-rose-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                          <span>3. Defective Pieces *</span>
                          <span className="text-[9px] px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded font-bold">
                            THREAD CUTTING SHELF
                          </span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            value={piecesDefected}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setPiecesDefected(val);
                              // Auto-suggest piecesOut if balance exceeds piecesIn
                              if (val + piecesOut > piecesIn && piecesIn >= val) {
                                setPiecesOut(piecesIn - val);
                              }
                            }}
                            className="w-full px-3.5 py-2.5 bg-rose-50/60 border border-rose-300 rounded-xl font-mono text-base font-bold text-rose-700 focus:outline-none focus:ring-2 focus:ring-lavender-600"
                          />
                          <span className="absolute right-3.5 top-2.5 text-xs font-bold text-rose-400">
                            PCS
                          </span>
                        </div>
                        <span className="text-[10px] text-rose-600 font-semibold mt-0.5 block">
                          Stays quarantined on the local shelf and appears in the Fabric Store central dashboard.
                        </span>
                      </div>
                    </div>

                    {/* PIECE RECONCILIATION SUMMARY BANNER */}
                    <div className="p-3 bg-white border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Formula:
                        </span>
                        <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                          {piecesIn} In = {piecesOut} Good + {piecesDefected} Defective
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {piecesIn === piecesOut + piecesDefected ? (
                          <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>100% Balanced Lot (Zero Unaccounted Pieces)</span>
                          </span>
                        ) : piecesIn > piecesOut + piecesDefected ? (
                          <div className="flex items-center gap-2">
                            <span className="text-amber-700 font-bold">
                              ⚠️ {piecesIn - (piecesOut + piecesDefected)} Pieces Unaccounted
                            </span>
                            <button
                              type="button"
                              onClick={() => setPiecesOut(Math.max(0, piecesIn - piecesDefected))}
                              className="text-[10px] underline font-bold text-cyan-700 hover:text-cyan-900 cursor-pointer"
                            >
                              Auto-Balance
                            </button>
                          </div>
                        ) : (
                          <span className="text-rose-600 font-bold">
                            ⚠️ Total Outputs Exceed In by {(piecesOut + piecesDefected) - piecesIn} PCS
                          </span>
                        )}
                      </div>
                    </div>

                    {/* GENERAL REMARKS */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Thread Trimming Process Remarks
                      </label>
                      <textarea
                        rows={2}
                        value={incomingRemarks}
                        onChange={(e) => setIncomingRemarks(e.target.value)}
                        placeholder=""
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-lavender-600"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={updatingPieceCount}
                        onClick={handleSaveIncomingTracking}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-xs transition"
                      >
                        {updatingPieceCount ? 'Saving...' : 'Save Tracking Progress'}
                      </button>
                    </div>

                    {/* ============================================================== */}
                    {/* OPTION: RECORD DEFECT ON THREAD CUTTING SHELF */}
                    {/* ============================================================== */}
                    <div className="p-4 bg-rose-50/90 border-2 border-rose-300 rounded-2xl space-y-4 shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rose-200 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0">
                            <AlertTriangle className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-rose-950 flex items-center gap-2">
                              <span>Record on Thread Cutting Defective Shelf</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-200 text-rose-900 font-mono">
                                WITH COMMENTS &amp; REASON
                              </span>
                            </h4>
                            <p className="text-[11px] text-slate-600">
                              Isolate damaged or defective panels on this department's shelf. No stock transfer is created.
                            </p>
                          </div>
                        </div>

                        <span className="text-[10px] font-mono font-bold bg-white text-rose-800 border border-rose-200 px-2.5 py-1 rounded-lg self-start sm:self-auto">
                          LOCAL SHELF: THREAD CUTTING - VISIBLE TO FABRIC STORE
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        {/* Defect Reason */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Defect Reason *
                          </label>
                          <select
                            value={defectReason}
                            onChange={(e) => setDefectReason(e.target.value)}
                            required={piecesDefected > 0}
                            className="w-full px-3 py-2 bg-white border border-rose-300 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-lavender-500"
                          >
                            <option value="">Select a reason</option>
                            <option value="Broken Stitch / Needle Holes">Broken Stitch / Needle Holes</option>
                            <option value="Embroidery Distortion / Misalignment">Embroidery Distortion / Misalignment</option>
                            <option value="Fabric Tear / Blade Cut Damage">Fabric Tear / Blade Cut Damage</option>
                            <option value="Machine Oil / Grease Stains">Machine Oil / Grease Stains</option>
                            <option value="Thread Tension Snags / Loose Loops">Thread Tension Snags / Loose Loops</option>
                            <option value="Color Shading / Fabric Weave Defect">Color Shading / Fabric Weave Defect</option>
                            <option value="Other">Other Defect (Specify below)</option>
                          </select>
                        </div>

                        {/* Defective Shelf Target Location */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Defective Shelf Target Location
                          </label>
                          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-mono text-rose-800">
                            DEF-SHELF-THREAD-CUTTING · Central Store can view this entry
                          </div>
                        </div>
                      </div>

                      {defectReason === 'Other' && (
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Custom Defect Reason Details *
                          </label>
                          <input
                            type="text"
                            value={customDefectReason}
                            onChange={(e) => setCustomDefectReason(e.target.value)}
                            required={piecesDefected > 0 && defectReason === 'Other'}
                            placeholder=""
                            className="w-full px-3 py-2 bg-white border border-rose-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-lavender-500"
                          />
                        </div>
                      )}

                      {/* Defect Comments & Reason Explanation */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Defect Comments &amp; Detailed Explanation (optional)
                        </label>
                        <textarea
                          rows={2}
                          value={defectComments}
                          onChange={(e) => setDefectComments(e.target.value)}
                          placeholder=""
                          className="w-full px-3 py-2 bg-white border border-rose-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-lavender-500"
                        />
                      </div>

                      {/* ACTION BUTTON TO RECORD ON THE LOCAL SHELF */}
                      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-rose-200">
                        <div className="text-[11px] font-medium text-slate-600">
                          {piecesDefected > 0 ? (
                            <span className="text-rose-800 font-bold flex items-center gap-1.5">
                              <ShieldAlert className="w-4 h-4 text-rose-600" />
                              <span>
                                {piecesDefected} defective pieces ready to record on the local shelf.
                              </span>
                            </span>
                          ) : (
                            <span className="text-slate-500">
                              Specify defective pieces count in Input #3 above to record them on this shelf.
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={submittingDefectReturn}
                          onClick={handleSendToDefectiveShelf}
                          className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold shadow-xs transition cursor-pointer ${
                            piecesDefected > 0
                              ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-md'
                              : 'bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300'
                          }`}
                        >
                          {submittingDefectReturn ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {submittingDefectReturn
                              ? 'Recording on Defective Shelf...'
                              : `Record ${piecesDefected > 0 ? piecesDefected : ''} Defective Pieces`}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* QUICK BUTTON TO ISSUE TO Threadcut QC */}
                  <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                    <span className="text-xs text-slate-500">
                      Finished thread cutting and resolved defects? Proceed to generate handover Challan for Threadcut QC.
                    </span>
                    <button
                      type="button"
                      onClick={handleProceedToThreadcutQC}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-lavender-600 hover:bg-lavender-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
                    >
                      <span>Proceed to Challan to Threadcut QC ({piecesOut} Good PCS)</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 text-xs">
                  Select an incoming Embroidery challan on the left to track pieces in, pieces out, and remarks.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION 2: CHALLAN FROM THREAD CUTTING TO Threadcut QC (EXACT USER DIAGRAM BOX) */}
        {/* ========================================================================= */}
        {activeTab === 'CREATE_THREADCUT_QC_CHALLAN' && (
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
            <form onSubmit={handleSubmitThreadcutQCChallan} className="p-6 sm:p-8 space-y-6">
              {/* TOP HEADER: TITLE & [Show production sheet] BUTTON */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-200 gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600 block">
                    QUALITY GATE HANDOVER
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mt-0.5">
                    <span>Challan from Thread Cutting to Threadcut QC</span>
                  </h2>
                </div>

                {/* (Show production sheet) BUTTON AS PROMINENTLY DRAWN IN SKETCH */}
                <button
                  type="button"
                  onClick={() => setShowSheetPickerModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
                >
                  <Eye className="w-4 h-4" />
                  <span>(Show production sheet)</span>
                </button>
              </div>

              {/* ACTIVE PRODUCTION SHEET BANNER */}
              {selectedProgram && (
                <div className="p-4 bg-teal-50/70 border border-teal-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-teal-600 text-white flex items-center justify-center font-mono font-bold text-sm shrink-0">
                      PS
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-teal-800 tracking-wider block">
                        Accompanying Production Sheet (Travels With This Challan to Threadcut QC)
                      </span>
                      <strong className="text-slate-900 text-sm font-mono">
                        {selectedProgram.programSerialNo || selectedProgram.programNumber}
                      </strong>
                      <span className="text-slate-600 ml-2">
                        · {selectedProgram.clientName || selectedProgram.buyerName || 'Client'} · Style: {selectedProgram.mainStyle || 'Style'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowSheetDetailModal(selectedProgram)}
                      className="text-xs font-bold text-teal-700 hover:text-teal-900 bg-teal-100 hover:bg-teal-200 px-3 py-1.5 rounded-lg transition"
                    >
                      View Sheet
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSheetPickerModal(true)}
                      className="text-xs text-slate-600 hover:text-slate-900 bg-white border border-slate-300 px-2.5 py-1.5 rounded-lg transition"
                    >
                      Change Sheet
                    </button>
                  </div>
                </div>
              )}

              {/* Threadcut QC CHECKING HANDOVER PIECE ACCOUNTING BANNER */}
              <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-200/80 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-lavender-600 text-white flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-950 flex items-center gap-2">
                        <span>Pieces Dispatched for Threadcut QC Quality Checking</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900">
                          CHECKING BASIS
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-600">
                        This Challan explicitly specifies how many pieces are going to Threadcut QC. Threadcut QC will conduct checking according to this exact piece count.
                      </p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right bg-white px-3.5 py-1.5 rounded-xl border border-emerald-200 self-start sm:self-auto">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Pieces Going to Threadcut QC</span>
                    <strong className="text-lg font-mono font-black text-emerald-700">
                      {items.reduce((s, it) => s + (Number(it.quantity) || 0), 0)} PCS
                    </strong>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-0.5">
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] uppercase text-slate-400 font-bold block">1. Pieces In (Embroidery)</span>
                    <span className="font-mono font-bold text-slate-800 text-sm">{piecesIn} PCS</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Total received from Embroidery</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-rose-200">
                    <span className="text-[10px] uppercase text-rose-600 font-bold block">2. Defective Segregated (Local Shelf)</span>
                    <span className="font-mono font-bold text-rose-700 text-sm">{piecesDefected} PCS</span>
                    <span className="text-[10px] text-rose-600 block mt-0.5">Quarantined on Thread Cutting Shelf</span>
                  </div>
                  <div className="p-2.5 bg-emerald-100/70 rounded-xl border border-emerald-300">
                    <span className="text-[10px] uppercase text-emerald-800 font-bold block">3. Dispatched to Threadcut QC for Checking</span>
                    <span className="font-mono font-bold text-emerald-900 text-sm">
                      {items.reduce((s, it) => s + (Number(it.quantity) || 0), 0)} PCS
                    </span>
                    <span className="text-[10px] text-emerald-800 block mt-0.5 font-medium">Mandatory Threadcut QC Checking Basis</span>
                  </div>
                </div>
              </div>

              {/* PRIMARY FORM FIELDS CORRESPONDING EXACTLY TO HANDWRITTEN DIAGRAM:
                  - Challan Number
                  - Challan Date
                  - Source (Thread Cutting)
                  - Destination (Threadcut QC)
                  - priority
                  - Delivery Date
                  - Design Number
                  - Serial Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                {/* 1. Challan Number */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Challan Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={challanNumber}
                    onChange={(e) => setChallanNumber(e.target.value)}
                    maxLength={64}
                    autoComplete="off"
                    placeholder="Enter challan number"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-lavender-600 transition"
                  />
                </div>

                {/* 2. Challan Date */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Challan Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={challanDate}
                    onChange={(e) => setChallanDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-lavender-600 transition"
                  />
                </div>

                {/* 3. Source (Thread Cutting) */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Source (Thread Cutting)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={sourceDept}
                    className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl font-bold text-slate-700 cursor-not-allowed"
                  />
                </div>

                {/* 4. Destination (Threadcut QC) */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Destination (Threadcut QC)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={destinationDept}
                    className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl font-bold text-emerald-700 cursor-not-allowed"
                  />
                </div>

                {/* 5. Priority */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e: any) => setPriority(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-lavender-600 transition"
                  >
                    <option value="NORMAL">Normal Priority</option>
                    <option value="URGENT">Urgent (Express QC)</option>
                    <option value="HIGH">High Priority</option>
                  </select>
                </div>

                {/* 6. Delivery Date */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Delivery Date
                  </label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-lavender-600 transition"
                  />
                </div>

                {/* 7. Design Number */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Design Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={designNumber}
                    onChange={(e) => setDesignNumber(e.target.value)}
                    placeholder=""
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-mono font-bold text-fuchsia-800 focus:outline-none focus:ring-2 focus:ring-lavender-600 transition"
                  />
                </div>

                {/* 8. Serial Number */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Serial Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    placeholder=""
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-lavender-600 transition"
                  />
                </div>
              </div>

              {/* TABLE FORM:
                  - Color / Fabric / Measurement (PCS) (CIRCLED PCS)
                  - Color code / width
                  - [add item] BUTTON */}
              <div className="space-y-3 pt-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                      <span>Panels for Threadcut QC Inspection (Table Form)</span>
                      <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                        Unit: PCS (Pieces)
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Specify panel measurements, color code, and pieces to be inspected by Threadcut QC Quality Incharge.
                    </p>
                  </div>

                  {/* (add item) BUTTON AS DRAWN */}
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg text-xs border border-slate-300 transition"
                  >
                    <Plus className="w-3.5 h-3.5 text-slate-600" />
                    <span>add item</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold text-[10px] uppercase">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                        <th className="py-2.5 px-3">
                          Color / Fabric / Measurement (PCS) *
                        </th>
                        <th className="py-2.5 px-3">
                          Color code / width *
                        </th>
                        <th className="py-2.5 px-3 w-32">Pieces (PCS) *</th>
                        <th className="py-2.5 px-3">Remarks</th>
                        <th className="py-2.5 px-3 w-12 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60 transition">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-bold font-mono">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              required
                              value={row.fabricMeasurementPcs}
                              onChange={(e) => updateItemRow(idx, 'fabricMeasurementPcs', e.target.value)}
                              onFocus={(e) => e.target.select()}
                              placeholder=""
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-lavender-600"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              required
                              value={row.colorCodeWidth}
                              onChange={(e) => updateItemRow(idx, 'colorCodeWidth', e.target.value)}
                              onFocus={(e) => e.target.select()}
                              placeholder=""
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-lavender-600"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="relative">
                              <input
                                type="number"
                                min="1"
                                required
                                value={row.quantity}
                                onChange={(e) => updateItemRow(idx, 'quantity', e.target.value)}
                                onFocus={(e) => e.target.select()}
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-lavender-600 pr-10"
                              />
                              <span className="absolute right-2 top-1.5 text-[10px] font-bold text-slate-400">
                                PCS
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={row.remarks}
                              onChange={(e) => updateItemRow(idx, 'remarks', e.target.value)}
                              onFocus={(e) => e.target.select()}
                              placeholder=""
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-lavender-600"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => removeItemRow(idx)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition"
                              title="Delete row"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-emerald-50/80 border-t-2 border-emerald-300 font-bold text-xs text-slate-800">
                      <tr>
                        <td colSpan={3} className="py-2.5 px-3 text-right uppercase text-[11px] text-emerald-950 font-bold tracking-wider">
                          Total Dispatched Pieces for Threadcut QC Checking:
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono text-sm font-black text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-300 block text-right pr-6">
                            {items.reduce((s, it) => s + (Number(it.quantity) || 0), 0)} PCS
                          </span>
                        </td>
                        <td colSpan={2} className="py-2.5 px-3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* FOOTER:
                  - Thread Cutting Incharge
                  - [Submit] BUTTON */}
              <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="w-full sm:w-80">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Thread Cutting Incharge *
                  </label>
                  <input
                    type="text"
                    required
                    value={inchargeName}
                    onChange={(e) => setInchargeName(e.target.value)}
                    placeholder=""
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-lavender-600 transition"
                  />
                </div>

                {/* Submit BUTTON */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto px-8 py-3 bg-lavender-600 hover:bg-lavender-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {submitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-200" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>{submitting ? 'Issuing to Threadcut QC...' : 'Submit Challan to Threadcut QC'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION 3: THREAD CUTTING DEFECTIVE SHELF (DEF-SHELF-THREAD-CUTTING)       */}
        {/* ========================================================================= */}
        {activeTab === 'DEFECT_RETURNS' && (
          <DepartmentDefectiveShelfWidget
            department="THREAD_CUTTING"
            shelfCode="DEF-SHELF-THREAD-CUTTING"
            accentColor="cyan"
          />
        )}

        {/* ========================================================================= */}
        {/* SECTION 4: THREAD CUTTING DEPARTMENT STOCK & MATERIAL BALANCE             */}
        {/* ========================================================================= */}
        {activeTab === 'STOCK' && (
          <DepartmentStockView
            department="THREAD_CUTTING"
            createChallanUrl="/thread-cutting/my-work"
          />
        )}
      </main>

      {/* MODAL: "Show production sheet" SELECTION */}
      {showSheetPickerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden space-y-4 p-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 block">
                  Select Master Record (Rule 1)
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  Show Production Sheet for Thread Cutting
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSheetPickerModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Select a Production Sheet to automatically populate Design Number, Serial Number, and Panel Piece counts.
            </p>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {programs.map((prog) => (
                <div
                  key={prog.id}
                  onClick={() => {
                    applyProgramToForm(prog);
                    setShowSheetPickerModal(false);
                  }}
                  className="p-3.5 border border-slate-200 rounded-xl hover:border-teal-400 hover:bg-teal-50/40 cursor-pointer transition flex items-center justify-between"
                >
                  <div>
                    <span className="font-mono text-xs font-bold text-teal-800">
                      Sheet #{prog.programSerialNo || prog.programNumber}
                    </span>
                    <h5 className="text-xs font-semibold text-slate-900 mt-0.5">
                      {prog.clientName || prog.buyerName || 'Client'} · {prog.mainStyle || 'Style'}
                    </h5>
                    <span className="text-[11px] text-fuchsia-700 font-mono">
                      Wilcom: {prog.wilcomDesignNumber || 'WILCOM-STD'}
                    </span>
                  </div>

                  <span className="px-3 py-1 bg-teal-600 text-white rounded-lg text-xs font-bold shadow-2xs">
                    Select Sheet
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowSheetPickerModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VIEW PRODUCTION SHEET DETAILS */}
      {showSheetDetailModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden space-y-4 p-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 block">
                  Master Record Details
                </span>
                <h3 className="text-base font-bold text-slate-900 font-mono">
                  Sheet #{showSheetDetailModal.programSerialNo || showSheetDetailModal.programNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSheetDetailModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <div>
                <span className="text-slate-400 text-[10px] block">Buyer</span>
                <strong className="text-slate-800">{showSheetDetailModal.clientName || showSheetDetailModal.buyerName || 'Standard'}</strong>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Style</span>
                <strong className="text-slate-800">{showSheetDetailModal.mainStyle || 'Standard'}</strong>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Wilcom Design #</span>
                <strong className="text-fuchsia-700 font-mono">{showSheetDetailModal.wilcomDesignNumber || 'WILCOM-STD'}</strong>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Target Quantity</span>
                <strong className="text-slate-800 font-mono">{showSheetDetailModal.targetQuantity || 0} PCS</strong>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowSheetDetailModal(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CHALLAN ISSUED SUCCESSFULLY WITH BARCODE */}
      {createdChallanModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden space-y-5 p-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Challan Issued to Threadcut QC Successfully!
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCreatedChallanModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                Threadcut QC Gate Handover Dispatch (Rule 2)
              </span>
              <div className="grid grid-cols-2 gap-2 text-slate-800">
                <div>
                  <span className="text-slate-500 text-[10px] block">Challan Number</span>
                  <strong className="font-mono text-sm text-slate-900">{createdChallanModal.challanNumber}</strong>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Destination</span>
                  <strong className="text-slate-900">Threadcut QC (Quality Check 2)</strong>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Design Number</span>
                  <strong className="font-mono text-fuchsia-700">{designNumber}</strong>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Total Pieces (PCS)</span>
                  <strong className="text-slate-900 font-mono">
                    {items.reduce((s, it) => s + (Number(it.quantity) || 0), 0)} PCS
                  </strong>
                </div>
              </div>
            </div>

            {/* STANDALONE DOWNLOADABLE BARCODE STICKER (WITH DESIGN NUMBER & DEPARTMENT) */}
            <BarcodeStickerCard
              params={{
                challanNumber: createdChallanModal.challanNumber,
                designNumber: designNumber || 'STANDARD DESIGN',
                departmentName: 'THREAD CUTTING',
                fromDepartment: 'THREAD_CUTTING',
                toDepartment: 'THREADCUT_QC',
                programSerialNo: selectedProgram?.programSerialNo || selectedProgram?.programNumber || '—',
                clientName: selectedProgram?.clientName || selectedProgram?.buyerName || 'Standard Client',
                mainStyle: selectedProgram?.mainStyle || 'Style',
                totalQuantity: items.reduce((s, it) => s + (Number(it.quantity) || 0), 0),
                uom: 'PCS',
                date: new Date().toLocaleDateString('en-IN')
              }}
              title="Threadcut QC Handover Barcode Sticker Tag"
            />

            <div className="pt-2 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setCreatedChallanModal(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Issue Another Challan
              </button>
              <button
                type="button"
                onClick={() => downloadChallanHtml(createdChallanModal)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-lg text-xs font-bold transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Challan</span>
              </button>
              <button
                type="button"
                onClick={() => printChallan(createdChallanModal)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Challan</span>
              </button>
              <Link
                href={`/challans/${createdChallanModal.id}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-bold shadow-xs transition"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Full Challan Slip</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DEFECT RETURN DISPATCHED TO FABRIC STORE DEFECTIVE SHELF */}
      {createdDefectModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-xl w-full bg-white rounded-2xl shadow-2xl border-2 border-rose-300 overflow-hidden space-y-5 p-6 my-8">
            <div className="flex items-center justify-between border-b border-rose-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Defect Entry Saved
                  </h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">
                    THREAD CUTTING SHELF - VISIBLE TO FABRIC STORE
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreatedDefectModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 text-slate-800">
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">
                    Source Production Challan #
                  </span>
                  <strong className="font-mono text-sm text-slate-900">
                    {createdDefectModal.challanNumber}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">
                    Reporting Department
                  </span>
                  <strong className="text-slate-900">
                    Thread Cutting
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">
                    Target Shelf Location
                  </span>
                  <strong className="text-rose-800 font-mono">
                    {defectiveShelfLocation}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">
                    Defective Quantity
                  </span>
                  <strong className="text-rose-700 font-mono text-sm">
                    {piecesDefected} PCS
                  </strong>
                </div>
              </div>

              <div className="pt-2 border-t border-rose-200">
                <span className="text-slate-500 text-[10px] uppercase font-bold block">
                  Defect Reason &amp; Comments Recorded:
                </span>
                <p className="text-slate-800 mt-0.5 italic">
                  &quot;{defectReason === 'Other' ? customDefectReason : defectReason} — {defectComments}&quot;
                </p>
              </div>
            </div>

            {/* BARCODE PREVIEW */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
                  Source Challan Barcode
              </span>
              <div className="font-mono font-bold tracking-[0.25em] text-base text-slate-800 py-1.5 border-y border-dashed border-slate-300">
                *{createdDefectModal.challanNumber}*
              </div>
              <span className="text-[10px] text-slate-500">
                The defective quantity remains quarantined on the Thread Cutting shelf.
              </span>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setCreatedDefectModal(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Done
              </button>
              <Link
                href="/department-defective-shelf"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-xs font-bold transition"
              >
                <Archive className="w-3.5 h-3.5 text-rose-600" />
                <span>Go to My Department Defective Shelf</span>
              </Link>
              <button
                type="button"
                onClick={() => downloadChallanHtml(createdDefectModal)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-xs font-bold transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Source Challan</span>
              </button>
              <button
                type="button"
                onClick={() => printChallan(createdDefectModal)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Source Challan</span>
              </button>
              <Link
                href={`/challans/${createdDefectModal.id}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-bold shadow-xs transition"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Challan Slip</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ACCOMPANYING PRODUCTION SHEET PREVIEW & PRINT MODAL */}
      {showSheetDetailModal && (
        <ProductionSheetPrintModal
          program={showSheetDetailModal}
          isOpen={Boolean(showSheetDetailModal)}
          onClose={() => setShowSheetDetailModal(null)}
        />
      )}
    </div>
  );
}
