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
    'INCOMING_EMBROIDERY' | 'CREATE_QC2_CHALLAN' | 'STOCK' | 'DEFECT_RETURNS'
  >('INCOMING_EMBROIDERY');

  // Incoming Tracking State ("Incoming Challan from Embroidery -> Pieces in, Pieces out, Remarks")
  const [incomingChallans, setIncomingChallans] = useState<any[]>([]);
  const [defectReturnChallans, setDefectReturnChallans] = useState<any[]>([]);
  const [selectedIncoming, setSelectedIncoming] = useState<any | null>(null);
  const [piecesIn, setPiecesIn] = useState<number>(0);
  const [piecesOut, setPiecesOut] = useState<number>(0);
  const [piecesDefected, setPiecesDefected] = useState<number>(0);
  const [defectReason, setDefectReason] = useState<string>('Broken Stitch / Needle Holes');
  const [customDefectReason, setCustomDefectReason] = useState<string>('');
  const [defectComments, setDefectComments] = useState<string>('');
  const [defectiveShelfLocation, setDefectiveShelfLocation] = useState<string>(
    'DEF-SHELF-THREAD-CUTTING (Thread Cutting Trimming Shelf)'
  );
  const [incomingRemarks, setIncomingRemarks] = useState<string>('');
  const [updatingPieceCount, setUpdatingPieceCount] = useState(false);
  const [submittingDefectReturn, setSubmittingDefectReturn] = useState(false);
  const [createdDefectModal, setCreatedDefectModal] = useState<any | null>(null);

  // Form State: "Challan from Thread Cutting to QC2 (Quality check 2)"
  const [challanNumber, setChallanNumber] = useState('');
  const [challanDate, setChallanDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [sourceDept] = useState('Thread Cutting Department');
  const [destinationDept] = useState('Thread Cut QC');
  const [priority, setPriority] = useState<'NORMAL' | 'URGENT' | 'HIGH'>('NORMAL');
  const [deliveryDate, setDeliveryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  });
  const [designNumber, setDesignNumber] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [inchargeName, setInchargeName] = useState('Thread Cutting Incharge');

  // Dynamic Table Items for QC2 Challan
  const [items, setItems] = useState<ItemRow[]>([
    {
      fabricMeasurementPcs: 'Dyed Cotton / Embroidered Front Panel / 120 PCS',
      colorCodeWidth: 'CC-NV-01 / 58 INCH',
      quantity: 120,
      remarks: 'Threads trimmed & cleaned. Ready for QC2 inspection.',
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

      // 2. Next Challan Number for QC2
      const numRes = await fetch('/api/challans/next-number?department=THREAD_CUTTING');
      const numData = await numRes.json();
      if (numData.nextNumber) {
        setChallanNumber(numData.nextNumber.replace('CH-THREAD_CUTTING-', 'CH-THC-QC2-'));
      } else {
        const year = new Date().getFullYear();
        setChallanNumber(`CH-THC-QC2-${year}-${String(Date.now()).slice(-5)}`);
      }
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
    setDefectReason('Broken Stitch / Needle Holes');
    setCustomDefectReason('');
    setDefectComments('');
    setIncomingRemarks(ch.remarks || 'Received from Embroidery. Thread trimming underway.');

    // Pre-populate QC2 challan fields from this incoming assignment
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
          remarks: 'Thread cutting completed, ready for QC2',
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
          defectReason: defectReason === 'Other' ? customDefectReason : defectReason,
          notes: `Thread Cutting Progress: Pieces In: ${piecesIn} PCS | Pieces Out: ${piecesOut} PCS | Defective: ${piecesDefected} PCS | Remarks: ${incomingRemarks}`,
        }),
      });

      if (res.ok) {
        setToastMsg(
          `Saved piece tracking for Challan ${selectedIncoming.challanNumber}: In ${piecesIn} PCS, Out ${piecesOut} PCS, Defective ${piecesDefected} PCS! Stock updated.`
        );
        setTimeout(() => setToastMsg(null), 4500);
        await loadData();
      }
    } catch (err: any) {
      console.error(err);
      alert('Failed to update tracking: ' + err.message);
    } finally {
      setUpdatingPieceCount(false);
    }
  };

  // Switch to QC2 tab with verified good pieces
  const handleProceedToQC2 = () => {
    setActiveTab('CREATE_QC2_CHALLAN');
    if (items.length > 0 && piecesOut > 0) {
      setItems((prev) =>
        prev.map((it, idx) => (idx === 0 ? { ...it, quantity: piecesOut } : it))
      );
    }
  };

  // Handover defective pieces to Fabric Store Defective Shelf
  const handleSendToDefectiveShelf = async () => {
    if (!selectedIncoming) {
      alert('Please select an incoming Embroidery challan first.');
      return;
    }
    if (piecesDefected <= 0) {
      alert('Please specify the count of defective pieces (> 0) to return.');
      return;
    }

    const resolvedReason =
      defectReason === 'Other'
        ? customDefectReason.trim() || 'Custom Defect'
        : defectReason;

    if (!defectComments.trim()) {
      alert('Please provide defect comments and reasons before returning to the Fabric Store defective shelf.');
      return;
    }

    try {
      setSubmittingDefectReturn(true);
      const year = new Date().getFullYear();
      const returnChallanNumber = `CH-THC-DEF-${year}-${String(Date.now()).slice(-5)}`;

      const payload = {
        challanNumber: returnChallanNumber,
        challanType: 'DEFECT_RETURN',
        fromDepartment: 'THREAD_CUTTING',
        toDepartment: 'STORE',
        parentChallanId: selectedIncoming.id,
        priority: 'URGENT',
        issuedDate: new Date().toISOString().split('T')[0],
        programId: selectedIncoming.program?.id || selectedIncoming.programId,
        fabricIn: Number(piecesDefected),
        defectivePieces: Number(piecesDefected),
        fabricOut: 0,
        fabricUnit: 'PCS',
        defectiveShelfLocation: defectiveShelfLocation,
        defectReason: resolvedReason,
        detectedFromDepartment: selectedIncoming.fromDepartment || 'EMBROIDERY',
        detectedFromChallanId: selectedIncoming.id,
        remarks: `Defective Return to Fabric Store Defective Shelf | Reason: ${resolvedReason} | Shelf: ${defectiveShelfLocation} | Comments: ${defectComments.trim()}`,
        items: [
          {
            itemDescription: `Defective Embroidered Panel (${resolvedReason}) - Returned from Thread Cutting`,
            colour: 'Dyed',
            fabricCode: selectedIncoming.program?.wilcomDesignNumber || 'STD-PANEL',
            quantity: Number(piecesDefected),
            uom: 'PCS',
            remarks: `Defect Reason: ${resolvedReason} | Comments: ${defectComments.trim()} | Shelf: ${defectiveShelfLocation}`,
          },
        ],
      };

      const res = await fetch('/api/challans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to dispatch defect return to Fabric Store');
      }

      // Update incoming Embroidery challan progress notes
      await fetch(`/api/challans/${selectedIncoming.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'IN_PROGRESS',
          notes: `Thread Cutting Progress: In: ${piecesIn} PCS | Out: ${piecesOut} PCS | Returned ${piecesDefected} PCS to Fabric Store Defective Shelf (${json.challanNumber}) | Reason: ${resolvedReason} | Comments: ${defectComments.trim()}`,
        }),
      }).catch((e) => console.warn('Status patch warning:', e));

      setCreatedDefectModal(json);
      setToastMsg(
        `Defect Challan ${json.challanNumber} (${piecesDefected} PCS) dispatched to Fabric Store Defective Shelf successfully!`
      );
      setTimeout(() => setToastMsg(null), 6000);
      loadData();
    } catch (err: any) {
      console.error('Error dispatching to defective shelf:', err);
      alert('Error: ' + err.message);
    } finally {
      setSubmittingDefectReturn(false);
    }
  };

  // Submit Challan from Thread Cutting to QC2
  const handleSubmitQC2Challan = async (e: React.FormEvent) => {
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
      const totalPcsToQc2 = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
      const resolvedDefectReason =
        defectReason === 'Other'
          ? customDefectReason.trim() || 'Custom Defect'
          : defectReason;

      const payload = {
        challanNumber: challanNumber.trim(),
        challanType: 'INTER_DEPARTMENT',
        fromDepartment: 'THREAD_CUTTING',
        toDepartment: 'QC2',
        parentChallanId: selectedIncoming?.id || null,
        priority: priority,
        issuedDate: challanDate,
        programId: selectedProgram?.id || serialNumber,
        fabricIn: piecesIn,
        defectivePieces: piecesDefected,
        defectiveShelfLocation: defectiveShelfLocation,
        defectReason: piecesDefected > 0 ? resolvedDefectReason : null,
        fabricOut: totalPcsToQc2,
        fabricUnit: 'PCS',
        detectedFromDepartment: selectedIncoming?.fromDepartment || 'EMBROIDERY',
        detectedFromChallanId: selectedIncoming?.id || null,
        remarks: `Thread Cutting Handover to QC2 | Dispatched for Checking: ${totalPcsToQc2} PCS (Inspection Basis: ${totalPcsToQc2} PCS) | Design: ${designNumber} | Sheet: ${serialNumber} | Incharge: ${inchargeName} | Lot Accounting: In: ${piecesIn} PCS, Defective Cut to Shelf: ${piecesDefected} PCS (${defectiveShelfLocation}), Dispatched to QC2: ${totalPcsToQc2} PCS`,
        items: items.map((it) => ({
          itemDescription: it.fabricMeasurementPcs,
          colour: 'Dyed',
          fabricCode: it.colorCodeWidth,
          quantity: Number(it.quantity) || 1,
          uom: 'PCS', // Strictly PCS as circled in diagram
          remarks: it.remarks || `QC2 Inspection Lot: ${it.quantity} PCS`,
        })),
      };

      const res = await fetch('/api/challans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to issue challan to QC2');
      }

      setCreatedChallanModal(json);
      setToastMsg(`Challan ${json.challanNumber} to QC2 created successfully!`);
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
    <div className="min-h-screen bg-neutral-50">
      {/* HEADER WITH REAL DB BACKGROUND */}
      <header
        className="bg-white border-b border-neutral-200 sticky top-0 z-30 px-4 sm:px-8 py-4 shadow-md text-neutral-900"
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-600 block drop-shadow-sm">
              SHUBHAM FABRICS MES · THREAD CUTTING DEPARTMENT
            </span>
            <h1 className="text-xl font-bold text-neutral-900 flex items-center gap-2.5 drop-shadow-sm">
              <Scissors className="w-5 h-5 text-brand-600" />
              <span>Thread Cutting · My Work</span>
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <Link
              href="/thread-cutting"
              className="px-3 py-2 bg-neutral-50 hover:bg-neutral-100 text-neutral-700 text-xs font-semibold rounded-lg border border-neutral-200 transition"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* TOAST ALERT */}
      {toastMsg && (
        <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-4">
          <div className="p-3.5 bg-accent-50 border border-accent-300 rounded-xl text-accent-800 text-xs font-semibold flex items-center gap-2 shadow-xs">
            <CheckCircle2 className="w-5 h-5 text-accent-700 shrink-0" />
            <span>{toastMsg}</span>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {/* TABS:
            1. Incoming Challan from Embroidery (Pieces In, Pieces Out, Defective Return)
            2. Challan from Thread Cutting to QC2 (Quality check 2)
            3. Defective Returns to Fabric Store Defective Shelf */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-2 shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('INCOMING_EMBROIDERY')}
              className={`p-3.5 rounded-xl border font-bold text-xs flex items-center justify-between transition cursor-pointer ${
                activeTab === 'INCOMING_EMBROIDERY'
                  ? 'bg-brand-50/90 border-brand-500 text-brand-900 shadow-xs'
                  : 'bg-neutral-50/60 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <PackageCheck className="w-4 h-4 text-brand-600" />
                <span className="uppercase tracking-wide">Incoming Embroidery</span>
              </div>
              <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-brand-100 text-brand-800 font-bold">
                {incomingChallans.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('CREATE_QC2_CHALLAN')}
              className={`p-3.5 rounded-xl border font-bold text-xs flex items-center justify-between transition cursor-pointer ${
                activeTab === 'CREATE_QC2_CHALLAN'
                  ? 'bg-accent-50/90 border-accent-500 text-accent-800 shadow-xs'
                  : 'bg-neutral-50/60 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Send className="w-4 h-4 text-accent-700" />
                <span className="uppercase tracking-wide">Challan to Thread Cut QC</span>
              </div>
              <span className="text-[10px] uppercase px-2.5 py-0.5 rounded-full bg-accent-100 text-accent-800 font-bold">
                Handover Gate
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('STOCK')}
              className={`p-3.5 rounded-xl border font-bold text-xs flex items-center justify-between transition cursor-pointer ${
                activeTab === 'STOCK'
                  ? 'bg-brand-50/90 border-brand-500 text-brand-900 shadow-xs'
                  : 'bg-neutral-50/60 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Boxes className="w-4 h-4 text-brand-600" />
                <span className="uppercase tracking-wide">Stock &amp; Balance</span>
              </div>
              <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-brand-100 text-brand-800 font-bold">
                Audited
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('DEFECT_RETURNS')}
              className={`p-3.5 rounded-xl border font-bold text-xs flex items-center justify-between transition cursor-pointer ${
                activeTab === 'DEFECT_RETURNS'
                  ? 'bg-danger-50/90 border-danger-500 text-danger-900 shadow-xs'
                  : 'bg-neutral-50/60 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-danger-600" />
                <span className="uppercase tracking-wide">Defective Shelf</span>
              </div>
              <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-danger-100 text-danger-800 font-bold">
                {defectReturnChallans.length} Returns
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
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900">
                  Embroidery Transfers
                </h3>
                <span className="text-xs text-neutral-500 font-mono">
                  {incomingChallans.length} Staged
                </span>
              </div>

              {incomingChallans.length === 0 ? (
                <div className="p-8 text-center bg-white border border-neutral-200 rounded-2xl text-neutral-500 text-xs">
                  <Scissors className="w-8 h-8 mx-auto text-neutral-700 mb-2" />
                  <p className="font-semibold text-neutral-700">No incoming Embroidery challans</p>
                  <p className="text-neutral-500 mt-1">
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
                            ? 'bg-brand-50/70 border-brand-500 shadow-sm'
                            : 'bg-white border-neutral-200 hover:border-neutral-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono text-xs font-bold text-neutral-900">
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
                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-accent-400 hover:bg-accent-500 text-neutral-900 shadow-2xs transition cursor-pointer"
                                title="Click to receive material into Thread Cutting floor stock"
                              >
                                {receivingId === ch.id ? 'Receiving...' : 'Receive'}
                              </button>
                            ) : (
                              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-brand-100 text-brand-800 border border-brand-200">
                                {ch.status}
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-xs font-semibold text-neutral-900 line-clamp-1">
                          {ch.program?.mainStyle || ch.program?.clientName || 'General Embroidery'}
                        </p>

                        <div className="mt-2 flex items-center justify-between text-[11px]">
                          <span className="font-mono text-brand-700 font-bold">
                            {ch.program?.wilcomDesignNumber || 'WILCOM-STD'}
                          </span>
                          <span className="font-mono font-bold text-neutral-900">
                            {totalPcs} PCS
                          </span>
                        </div>

                        <div className="mt-2 pt-2 border-t border-neutral-100 flex items-center justify-between text-[10px] text-neutral-500 font-mono">
                          <span>Sheet: {ch.program?.programSerialNo || ch.program?.programNumber || '—'}</span>
                          <span>{new Date(ch.createdAt).toLocaleDateString('en-GB')}</span>
                        </div>

                        {/* COMPLETE DOCUMENT ACTIONS: PRODUCTION SHEET, CHALLAN & WILCOM */}
                        <div className="mt-2 pt-2 border-t border-neutral-100 flex items-center justify-between gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
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
                <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-6">
                  {/* HEADER */}
                  <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 block">
                        ACTIVE TRIMMING LOT FROM EMBROIDERY
                      </span>
                      <h2 className="text-lg font-bold text-neutral-900 font-mono mt-0.5">
                        {selectedIncoming.challanNumber}
                      </h2>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* CHALLAN SUITE */}
                      <Link
                        href={`/challans/${selectedIncoming.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-semibold transition"
                      >
                        <Eye className="w-3.5 h-3.5 text-neutral-500" />
                        <span>Slip</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => downloadChallanHtml(selectedIncoming)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 rounded-lg text-xs font-bold transition cursor-pointer"
                        title="Download Challan HTML"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Challan</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => printChallan(selectedIncoming)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-semibold transition"
                        title="Print Challan Slip"
                      >
                        <Printer className="w-3.5 h-3.5 text-neutral-500" />
                        <span>Print Challan</span>
                      </button>

                      {/* PRODUCTION SHEET SUITE */}
                      {selectedIncoming.program && (
                        <>
                          <button
                            type="button"
                            onClick={() => setShowSheetDetailModal(selectedIncoming.program)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-brand-50 border border-brand-200 hover:bg-brand-100 text-brand-900 rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5 text-brand-600" />
                            <span>View Sheet</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadProductionSheetHtml(selectedIncoming.program)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-brand-50 border border-brand-200 hover:bg-brand-100 text-brand-700 rounded-lg text-xs font-bold transition cursor-pointer"
                            title="Download Production Sheet HTML"
                          >
                            <Download className="w-3.5 h-3.5 text-brand-600" />
                            <span>Download Sheet</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => printProductionSheet(selectedIncoming.program)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-semibold transition"
                            title="Print Production Sheet Traveler"
                          >
                            <Printer className="w-3.5 h-3.5 text-neutral-600" />
                            <span>Print Sheet</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* MASTER PRODUCTION SHEET CARD */}
                  <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between border-b border-neutral-200/80 pb-2">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-accent-800" />
                        <span className="text-xs font-bold text-neutral-900 uppercase tracking-wide">
                          Accompanying Production Sheet (Traveled from Embroidery)
                        </span>
                      </div>
                      {selectedIncoming.program && (
                        <div className="flex items-center gap-2 print:hidden">
                          <button
                            type="button"
                            onClick={() => setShowSheetDetailModal(selectedIncoming.program)}
                            className="text-xs font-bold text-brand-700 hover:text-brand-900 underline flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Preview</span>
                          </button>
                          <span className="text-neutral-700">·</span>
                          <button
                            type="button"
                            onClick={() => printProductionSheet(selectedIncoming.program)}
                            className="text-xs font-bold text-brand-700 hover:text-brand-900 underline flex items-center gap-1 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Print</span>
                          </button>
                          <span className="text-neutral-700">·</span>
                          <button
                            type="button"
                            onClick={() => downloadProductionSheetHtml(selectedIncoming.program)}
                            className="text-xs font-bold text-neutral-700 hover:text-neutral-900 underline flex items-center gap-1 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                      <div>
                        <span className="text-neutral-500 text-[10px] uppercase font-bold block">
                          Master Sheet Serial #
                        </span>
                        <strong className="font-mono text-neutral-900">
                          {selectedIncoming.program?.programSerialNo || selectedIncoming.program?.programNumber || '—'}
                        </strong>
                      </div>
                    <div>
                      <span className="text-neutral-500 text-[10px] uppercase font-bold block">
                        Wilcom Design #
                      </span>
                      <strong className="font-mono text-brand-700">
                        {selectedIncoming.program?.wilcomDesignNumber || 'WILCOM-STD'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-neutral-500 text-[10px] uppercase font-bold block">
                        Client / Style
                      </span>
                      <strong className="text-neutral-900 truncate block">
                        {selectedIncoming.program?.clientName || 'Standard'} / {selectedIncoming.program?.mainStyle || 'Style'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-neutral-500 text-[10px] uppercase font-bold block">
                        Priority
                      </span>
                      <strong className="text-accent-800 uppercase font-mono">
                        {selectedIncoming.priority || 'NORMAL'}
                      </strong>
                    </div>
                  </div>
                </div>

                  {/* USER SKETCH HIGHLIGHT:
                      - Pieces in (From Embroidery)
                      - Pieces out (Ready for QC2)
                      - Defective Pieces (To Fabric Store Defective Shelf with comments & reason)
                      - Remarks */}
                  <div className="p-5 bg-brand-50/50 border border-brand-200 rounded-2xl space-y-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-brand-900 flex items-center gap-2">
                        <Scissors className="w-4 h-4 text-brand-600" />
                        <span>Thread Cutting Piece Reconciliation &amp; Defect Control</span>
                      </span>
                      <span className="text-[10px] font-mono text-brand-700 font-bold bg-brand-100 px-2 py-0.5 rounded">
                        PIECE RECONCILIATION
                      </span>
                    </div>

                    {/* 3-COLUMN INPUTS */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      {/* 1. Pieces in (From Embroidery) */}
                      <div>
                        <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-wider mb-1">
                          1. Pieces in (Embroidery) *
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            value={piecesIn}
                            onChange={(e) => setPiecesIn(Number(e.target.value))}
                            className="w-full px-3.5 py-2.5 bg-white border border-neutral-300 rounded-xl font-mono text-base font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                          />
                          <span className="absolute right-3.5 top-2.5 text-xs font-bold text-neutral-500">
                            PCS
                          </span>
                        </div>
                        <span className="text-[10px] text-neutral-500 mt-0.5 block">
                          Verified panels received from Embroidery.
                        </span>
                      </div>

                      {/* 2. Pieces out (Ready for QC2) */}
                      <div>
                        <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-wider mb-1">
                          2. Pieces out (Good to QC2) *
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            value={piecesOut}
                            onChange={(e) => setPiecesOut(Number(e.target.value))}
                            className="w-full px-3.5 py-2.5 bg-white border border-accent-300 rounded-xl font-mono text-base font-bold text-accent-800 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                          />
                          <span className="absolute right-3.5 top-2.5 text-xs font-bold text-neutral-500">
                            PCS
                          </span>
                        </div>
                        <span className="text-[10px] text-neutral-500 mt-0.5 block">
                          Clean trimmed pieces ready for QC2.
                        </span>
                      </div>

                      {/* 3. Defective Pieces (To Fabric Store Defective Shelf) */}
                      <div>
                        <label className="block text-[11px] font-bold text-danger-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                          <span>3. Defective Pieces *</span>
                          <span className="text-[9px] px-1.5 py-0.5 bg-danger-100 text-danger-800 rounded font-bold">
                            STORE RETURN
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
                            className="w-full px-3.5 py-2.5 bg-danger-50/60 border border-danger-300 rounded-xl font-mono text-base font-bold text-danger-700 focus:outline-none focus:ring-2 focus:ring-danger-500"
                          />
                          <span className="absolute right-3.5 top-2.5 text-xs font-bold text-danger-600">
                            PCS
                          </span>
                        </div>
                        <span className="text-[10px] text-danger-600 font-semibold mt-0.5 block">
                          Goes to Fabric Store Defective Shelf.
                        </span>
                      </div>
                    </div>

                    {/* PIECE RECONCILIATION SUMMARY BANNER */}
                    <div className="p-3 bg-white border border-neutral-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                          Formula:
                        </span>
                        <span className="font-mono font-bold text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded">
                          {piecesIn} In = {piecesOut} Good + {piecesDefected} Defective
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {piecesIn === piecesOut + piecesDefected ? (
                          <span className="text-accent-800 font-bold flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-accent-700" />
                            <span>100% Balanced Lot (Zero Unaccounted Pieces)</span>
                          </span>
                        ) : piecesIn > piecesOut + piecesDefected ? (
                          <div className="flex items-center gap-2">
                            <span className="text-accent-800 font-bold">
                              {piecesIn - (piecesOut + piecesDefected)} Pieces Unaccounted
                            </span>
                            <button
                              type="button"
                              onClick={() => setPiecesOut(Math.max(0, piecesIn - piecesDefected))}
                              className="text-[10px] underline font-bold text-brand-700 hover:text-brand-900 cursor-pointer"
                            >
                              Auto-Balance
                            </button>
                          </div>
                        ) : (
                          <span className="text-danger-600 font-bold">
                            Total Outputs Exceed In by {(piecesOut + piecesDefected) - piecesIn} PCS
                          </span>
                        )}
                      </div>
                    </div>

                    {/* GENERAL REMARKS */}
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-wider mb-1">
                        Thread Trimming Process Remarks
                      </label>
                      <textarea
                        rows={2}
                        value={incomingRemarks}
                        onChange={(e) => setIncomingRemarks(e.target.value)}
                        placeholder=""
                        className="w-full px-3.5 py-2 bg-white border border-neutral-300 rounded-xl text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={updatingPieceCount}
                        onClick={handleSaveIncomingTracking}
                        className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
                      >
                        {updatingPieceCount ? 'Saving...' : 'Save Tracking Progress'}
                      </button>
                    </div>

                    {/* ============================================================== */}
                    {/* OPTION: RETURN TO FABRIC STORE DEFECTIVE SHELF (WITH COMMENTS & REASON) */}
                    {/* ============================================================== */}
                    <div className="p-4 bg-danger-50/90 border-2 border-danger-300 rounded-2xl space-y-4 shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-danger-200 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-danger-600 text-white flex items-center justify-center shrink-0">
                            <AlertTriangle className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-danger-900 flex items-center gap-2">
                              <span>Return to Fabric Store Defective Shelf</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-danger-200 text-danger-900 font-mono">
                                WITH COMMENTS &amp; REASON
                              </span>
                            </h4>
                            <p className="text-[11px] text-neutral-600">
                              Isolate damaged or defective panels and dispatch back to Fabric Store quarantined shelf.
                            </p>
                          </div>
                        </div>

                        <span className="text-[10px] font-mono font-bold bg-white text-danger-800 border border-danger-200 px-2.5 py-1 rounded-lg self-start sm:self-auto">
                          DESTINATION: FABRIC STORE
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        {/* Defect Reason */}
                        <div>
                          <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-wider mb-1">
                            Defect Reason *
                          </label>
                          <select
                            value={defectReason}
                            onChange={(e) => setDefectReason(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-danger-300 rounded-xl font-semibold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-danger-500"
                          >
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
                          <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-wider mb-1">
                            Defective Shelf Target Location
                          </label>
                          <select
                            value={defectiveShelfLocation}
                            onChange={(e) => setDefectiveShelfLocation(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-danger-300 rounded-xl text-neutral-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-danger-500 cursor-pointer"
                          >
                            <option value="DEF-SHELF-THREAD-CUTTING (Thread Cutting Trimming Shelf)">
                              DEF-SHELF-THREAD-CUTTING (Thread Cutting Station Shelf)
                            </option>
                            <option value="DEF-SHELF-CENTRAL (Fabric Store Master Defective Shelf)">
                              DEF-SHELF-CENTRAL (Fabric Store Master Defective Shelf)
                            </option>
                            <option value="DEF-SHELF-STORE (Fabric Store Quarantined Shelf)">
                              DEF-SHELF-STORE (Fabric Store Quarantined Shelf)
                            </option>
                          </select>
                        </div>
                      </div>

                      {defectReason === 'Other' && (
                        <div>
                          <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-wider mb-1">
                            Custom Defect Reason Details *
                          </label>
                          <input
                            type="text"
                            value={customDefectReason}
                            onChange={(e) => setCustomDefectReason(e.target.value)}
                            placeholder=""
                            className="w-full px-3 py-2 bg-white border border-danger-300 rounded-xl text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-danger-500"
                          />
                        </div>
                      )}

                      {/* Defect Comments & Reason Explanation */}
                      <div>
                        <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-wider mb-1">
                          Defect Comments &amp; Detailed Explanation *
                        </label>
                        <textarea
                          rows={2}
                          value={defectComments}
                          onChange={(e) => setDefectComments(e.target.value)}
                          placeholder=""
                          className="w-full px-3 py-2 bg-white border border-danger-300 rounded-xl text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-danger-500"
                        />
                      </div>

                      {/* ACTION BUTTON TO RETURN TO FABRIC STORE DEFECTIVE SHELF */}
                      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-danger-200">
                        <div className="text-[11px] font-medium text-neutral-600">
                          {piecesDefected > 0 ? (
                            <span className="text-danger-800 font-bold flex items-center gap-1.5">
                              <ShieldAlert className="w-4 h-4 text-danger-600" />
                              <span>
                                {piecesDefected} Defective Pieces ready to return to Fabric Store Defective Shelf.
                              </span>
                            </span>
                          ) : (
                            <span className="text-neutral-500">
                              Specify defective pieces count in Input #3 above to dispatch return.
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={submittingDefectReturn}
                          onClick={handleSendToDefectiveShelf}
                          className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold shadow-xs transition cursor-pointer ${
                            piecesDefected > 0
                              ? 'bg-danger-600 hover:bg-danger-700 text-white shadow-sm'
                              : 'bg-danger-100 hover:bg-danger-200 text-danger-800 border border-danger-300'
                          }`}
                        >
                          {submittingDefectReturn ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {submittingDefectReturn
                              ? 'Dispatching to Defective Shelf...'
                              : `Return ${piecesDefected > 0 ? piecesDefected : ''} Defective Pieces to Fabric Store Shelf`}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* QUICK BUTTON TO ISSUE TO QC2 */}
                  <div className="pt-2 flex items-center justify-between border-t border-neutral-100">
                    <span className="text-xs text-neutral-500">
                      Finished thread cutting and resolved defects? Proceed to generate handover Challan for QC2.
                    </span>
                    <button
                      type="button"
                      onClick={handleProceedToQC2}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
                    >
                      <span>Proceed to Challan to QC2 ({piecesOut} Good PCS)</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-neutral-200 rounded-2xl p-12 text-center text-neutral-500 text-xs">
                  Select an incoming Embroidery challan on the left to track pieces in, pieces out, and remarks.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION 2: CHALLAN FROM THREAD CUTTING TO QC2 (EXACT USER DIAGRAM BOX) */}
        {/* ========================================================================= */}
        {activeTab === 'CREATE_QC2_CHALLAN' && (
          <div className="bg-white border border-neutral-200/90 rounded-2xl shadow-sm overflow-hidden">
            <form onSubmit={handleSubmitQC2Challan} className="p-6 sm:p-8 space-y-6">
              {/* TOP HEADER: TITLE & [Show production sheet] BUTTON */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-neutral-200 gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-700 block">
                    QUALITY GATE HANDOVER
                  </span>
                  <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2 mt-0.5">
                    <span>Challan from Thread Cutting to Thread Cut QC</span>
                  </h2>
                </div>

                {/* (Show production sheet) BUTTON AS PROMINENTLY DRAWN IN SKETCH */}
                <button
                  type="button"
                  onClick={() => setShowSheetPickerModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
                >
                  <Eye className="w-4 h-4" />
                  <span>(Show production sheet)</span>
                </button>
              </div>

              {/* ACTIVE PRODUCTION SHEET BANNER */}
              {selectedProgram && (
                <div className="p-4 bg-brand-50/70 border border-brand-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-brand-600 text-white flex items-center justify-center font-mono font-bold text-sm shrink-0">
                      PS
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-brand-800 tracking-wider block">
                        Accompanying Production Sheet (Travels With This Challan to QC2)
                      </span>
                      <strong className="text-neutral-900 text-sm font-mono">
                        {selectedProgram.programSerialNo || selectedProgram.programNumber}
                      </strong>
                      <span className="text-neutral-600 ml-2">
                        · {selectedProgram.clientName || selectedProgram.buyerName || 'Client'} · Style: {selectedProgram.mainStyle || 'Style'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowSheetDetailModal(selectedProgram)}
                      className="text-xs font-bold text-brand-700 hover:text-brand-900 bg-brand-100 hover:bg-brand-200 px-3 py-1.5 rounded-lg transition"
                    >
                      View Sheet
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSheetPickerModal(true)}
                      className="text-xs text-neutral-600 hover:text-neutral-900 bg-white border border-neutral-300 px-2.5 py-1.5 rounded-lg transition"
                    >
                      Change Sheet
                    </button>
                  </div>
                </div>
              )}

              {/* QC2 CHECKING HANDOVER PIECE ACCOUNTING BANNER */}
              <div className="p-4 bg-accent-50 border-2 border-accent-300 rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-accent-200/80 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-accent-400 text-neutral-900 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700 flex items-center gap-2">
                        <span>Pieces Dispatched for QC2 Quality Checking</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent-200 text-accent-800">
                          CHECKING BASIS
                        </span>
                      </h4>
                      <p className="text-[11px] text-neutral-600">
                        This Challan explicitly specifies how many pieces are going to QC2. QC2 will conduct checking according to this exact piece count.
                      </p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right bg-white px-3.5 py-1.5 rounded-xl border border-accent-200 self-start sm:self-auto">
                    <span className="text-[10px] uppercase font-bold text-neutral-500 block">Total Pieces Going to QC2</span>
                    <strong className="text-lg font-mono font-black text-neutral-900">
                      {items.reduce((s, it) => s + (Number(it.quantity) || 0), 0)} PCS
                    </strong>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-0.5">
                  <div className="p-2.5 bg-white rounded-xl border border-neutral-200">
                    <span className="text-[10px] uppercase text-neutral-500 font-bold block">1. Pieces In (Embroidery)</span>
                    <span className="font-mono font-bold text-neutral-900 text-sm">{piecesIn} PCS</span>
                    <span className="text-[10px] text-neutral-500 block mt-0.5">Total received from Embroidery</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-danger-200">
                    <span className="text-[10px] uppercase text-danger-600 font-bold block">2. Defective Segregated (To Store)</span>
                    <span className="font-mono font-bold text-danger-700 text-sm">{piecesDefected} PCS</span>
                    <span className="text-[10px] text-danger-600 block mt-0.5">Sent to Fabric Store Defective Shelf</span>
                  </div>
                  <div className="p-2.5 bg-accent-100/70 rounded-xl border border-accent-300">
                    <span className="text-[10px] uppercase text-accent-800 font-bold block">3. Dispatched to QC2 for Checking</span>
                    <span className="font-mono font-bold text-accent-800 text-sm">
                      {items.reduce((s, it) => s + (Number(it.quantity) || 0), 0)} PCS
                    </span>
                    <span className="text-[10px] text-accent-800 block mt-0.5 font-medium">Mandatory QC2 Checking Basis</span>
                  </div>
                </div>
              </div>

              {/* PRIMARY FORM FIELDS CORRESPONDING EXACTLY TO HANDWRITTEN DIAGRAM:
                  - Challan Number
                  - Challan Date
                  - Source (Thread Cutting)
                  - Destination (QC2)
                  - priority
                  - Delivery Date
                  - Design Number
                  - Serial Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                {/* 1. Challan Number */}
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-wider mb-1">
                    Challan Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={challanNumber}
                    onChange={(e) => setChallanNumber(e.target.value)}
                    placeholder=""
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl font-mono font-bold text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/40 transition"
                  />
                </div>

                {/* 2. Challan Date */}
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-wider mb-1">
                    Challan Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={challanDate}
                    onChange={(e) => setChallanDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-neutral-300 rounded-xl font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-500/40 transition"
                  />
                </div>

                {/* 3. Source (Thread Cutting) */}
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-wider mb-1">
                    Source (Thread Cutting)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={sourceDept}
                    className="w-full px-3.5 py-2.5 bg-neutral-100 border border-neutral-300 rounded-xl font-bold text-neutral-700 cursor-not-allowed"
                  />
                </div>

                {/* 4. Destination (QC2) */}
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-wider mb-1">
                    Destination (QC2)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={destinationDept}
                    className="w-full px-3.5 py-2.5 bg-neutral-100 border border-neutral-300 rounded-xl font-bold text-accent-800 cursor-not-allowed"
                  />
                </div>

                {/* 5. Priority */}
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-wider mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e: any) => setPriority(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-neutral-300 rounded-xl font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-500/40 transition"
                  >
                    <option value="NORMAL">Normal Priority</option>
                    <option value="URGENT">Urgent (Express QC)</option>
                    <option value="HIGH">High Priority</option>
                  </select>
                </div>

                {/* 6. Delivery Date */}
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-wider mb-1">
                    Delivery Date
                  </label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-neutral-300 rounded-xl font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-500/40 transition"
                  />
                </div>

                {/* 7. Design Number */}
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-wider mb-1">
                    Design Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={designNumber}
                    onChange={(e) => setDesignNumber(e.target.value)}
                    placeholder=""
                    className="w-full px-3.5 py-2.5 bg-white border border-neutral-300 rounded-xl font-mono font-bold text-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-500/40 transition"
                  />
                </div>

                {/* 8. Serial Number */}
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-wider mb-1">
                    Serial Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    placeholder=""
                    className="w-full px-3.5 py-2.5 bg-white border border-neutral-300 rounded-xl font-mono font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-500/40 transition"
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
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 flex items-center gap-2">
                      <span>Panels for QC2 Inspection (Table Form)</span>
                      <span className="text-[10px] font-mono font-bold text-accent-800 bg-accent-100 px-2 py-0.5 rounded">
                        Unit: PCS (Pieces)
                      </span>
                    </h3>
                    <p className="text-[11px] text-neutral-500">
                      Specify panel measurements, color code, and pieces to be inspected by QC2 Quality Incharge.
                    </p>
                  </div>

                  {/* (add item) BUTTON AS DRAWN */}
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 font-bold rounded-lg text-xs border border-neutral-300 transition"
                  >
                    <Plus className="w-3.5 h-3.5 text-neutral-600" />
                    <span>add item</span>
                  </button>
                </div>

                <div className="border border-neutral-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-100/80 border-b border-neutral-200 text-neutral-600 font-bold text-[10px] uppercase">
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
                    <tbody className="divide-y divide-neutral-100">
                      {items.map((row, idx) => (
                        <tr key={idx} className="hover:bg-neutral-50/60 transition">
                          <td className="py-2.5 px-3 text-center text-neutral-500 font-bold font-mono">
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
                              className="w-full px-2.5 py-1.5 bg-white border border-neutral-300 rounded-lg text-xs text-neutral-900 focus:outline-none focus:ring-1 focus:ring-brand-500/40"
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
                              className="w-full px-2.5 py-1.5 bg-white border border-neutral-300 rounded-lg text-xs font-mono text-neutral-900 focus:outline-none focus:ring-1 focus:ring-brand-500/40"
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
                                className="w-full px-2.5 py-1.5 bg-white border border-neutral-300 rounded-lg text-xs font-mono font-bold text-neutral-900 focus:outline-none focus:ring-1 focus:ring-brand-500/40 pr-10"
                              />
                              <span className="absolute right-2 top-1.5 text-[10px] font-bold text-neutral-500">
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
                              className="w-full px-2.5 py-1.5 bg-white border border-neutral-300 rounded-lg text-xs text-neutral-700 focus:outline-none focus:ring-1 focus:ring-brand-500/40"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => removeItemRow(idx)}
                              className="p-1.5 text-neutral-500 hover:text-danger-600 rounded-md hover:bg-danger-50 transition"
                              title="Delete row"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-accent-50/80 border-t-2 border-accent-300 font-bold text-xs text-neutral-900">
                      <tr>
                        <td colSpan={3} className="py-2.5 px-3 text-right uppercase text-[11px] text-neutral-700 font-bold tracking-wider">
                          Total Dispatched Pieces for QC2 Checking:
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono text-sm font-black text-accent-800 bg-white px-2 py-0.5 rounded border border-accent-300 block text-right pr-6">
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
              <div className="pt-4 border-t border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="w-full sm:w-80">
                  <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-wider mb-1">
                    Thread Cutting Incharge *
                  </label>
                  <input
                    type="text"
                    required
                    value={inchargeName}
                    onChange={(e) => setInchargeName(e.target.value)}
                    placeholder=""
                    className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-300 rounded-xl font-semibold text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/40 transition"
                  />
                </div>

                {/* Submit BUTTON */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto px-8 py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-sm hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {submitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-accent-700" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>{submitting ? 'Issuing to QC2...' : 'Submit Challan to QC2'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION 3: DEFECTIVE RETURNS TO FABRIC STORE DEFECTIVE SHELF */}
        {/* ========================================================================= */}
        {activeTab === 'DEFECT_RETURNS' && (
          <div className="bg-white border border-neutral-200/90 rounded-2xl shadow-sm overflow-hidden p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-neutral-200 gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-danger-600 block">
                  FABRIC STORE DEFECTIVE SHELF DISPATCH AUDIT
                </span>
                <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2 mt-0.5">
                  <AlertTriangle className="w-5 h-5 text-danger-600" />
                  <span>Defective Panel Returns to Fabric Store</span>
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Complete audit log of all defective pieces returned from Thread Cutting to the Fabric Store defective shelf with reasons and comments.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/fabric-store/inventory/defected-shelf"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-danger-50 hover:bg-danger-100 text-danger-800 border border-danger-200 rounded-xl text-xs font-bold transition"
                >
                  <Archive className="w-3.5 h-3.5 text-danger-600" />
                  <span>View Fabric Store Defective Shelf</span>
                  <ExternalLink className="w-3 h-3 text-danger-600" />
                </Link>
              </div>
            </div>

            {defectReturnChallans.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-neutral-200 rounded-2xl text-neutral-500 text-xs space-y-2">
                <ShieldCheck className="w-8 h-8 mx-auto text-accent-700" />
                <p className="font-semibold text-neutral-700">No defective returns recorded yet</p>
                <p className="text-neutral-500">
                  When defective pieces are returned from the Embroidery incoming lot, their return challans, reasons, and comments will be archived here.
                </p>
              </div>
            ) : (
              <div className="border border-neutral-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-100/80 border-b border-neutral-200 text-neutral-600 font-bold text-[10px] uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Return Challan #</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Program / Style</th>
                      <th className="py-2.5 px-3 text-center">Defective Pcs</th>
                      <th className="py-2.5 px-3">Target Shelf Location</th>
                      <th className="py-2.5 px-3">Defect Reason &amp; Comments</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {defectReturnChallans.map((ch: any) => {
                      const totalPcs = (ch.items || []).reduce(
                        (sum: number, it: any) => sum + (Number(it.quantity) || 0),
                        0
                      );

                      return (
                        <tr key={ch.id} className="hover:bg-danger-50/30 transition">
                          <td className="py-3 px-3 font-mono font-bold text-neutral-900">
                            {ch.challanNumber}
                          </td>
                          <td className="py-3 px-3 text-neutral-600 text-[11px] font-mono">
                            {new Date(ch.createdAt).toLocaleDateString('en-GB')}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-semibold text-neutral-900 block">
                              {ch.program?.mainStyle || ch.program?.clientName || 'General Embroidery'}
                            </span>
                            <span className="font-mono text-[10px] text-brand-700">
                              {ch.program?.wilcomDesignNumber || 'WILCOM-DES'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-danger-700 text-sm">
                            {totalPcs} PCS
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded bg-neutral-100 border border-neutral-200 text-neutral-700 font-mono text-[10px]">
                              DEF-SHELF-01 (Fabric Store)
                            </span>
                          </td>
                          <td className="py-3 px-3 text-neutral-700 max-w-xs">
                            <p className="line-clamp-2 text-[11px]">
                              {ch.remarks || ch.items?.[0]?.remarks || 'Defective return to Fabric Store'}
                            </p>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <Link
                              href={`/challans/${ch.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 rounded-lg text-xs font-semibold transition"
                            >
                              <FileText className="w-3 h-3 text-neutral-600" />
                              <span>View</span>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
        <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden space-y-4 p-6 my-8">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 block">
                  Select Master Record (Rule 1)
                </span>
                <h3 className="text-base font-bold text-neutral-900">
                  Show Production Sheet for Thread Cutting
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSheetPickerModal(false)}
                className="p-1 rounded-lg text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-neutral-500">
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
                  className="p-3.5 border border-neutral-200 rounded-xl hover:border-brand-500 hover:bg-brand-50/40 cursor-pointer transition flex items-center justify-between"
                >
                  <div>
                    <span className="font-mono text-xs font-bold text-brand-800">
                      Sheet #{prog.programSerialNo || prog.programNumber}
                    </span>
                    <h5 className="text-xs font-semibold text-neutral-900 mt-0.5">
                      {prog.clientName || prog.buyerName || 'Client'} · {prog.mainStyle || 'Style'}
                    </h5>
                    <span className="text-[11px] text-brand-700 font-mono">
                      Wilcom: {prog.wilcomDesignNumber || 'WILCOM-STD'}
                    </span>
                  </div>

                  <span className="px-3 py-1 bg-brand-600 text-white rounded-lg text-xs font-bold shadow-2xs">
                    Select Sheet
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end border-t border-neutral-200">
              <button
                type="button"
                onClick={() => setShowSheetPickerModal(false)}
                className="px-4 py-2 border border-neutral-300 rounded-lg text-xs font-bold text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VIEW PRODUCTION SHEET DETAILS */}
      {showSheetDetailModal && (
        <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden space-y-4 p-6 my-8">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 block">
                  Master Record Details
                </span>
                <h3 className="text-base font-bold text-neutral-900 font-mono">
                  Sheet #{showSheetDetailModal.programSerialNo || showSheetDetailModal.programNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSheetDetailModal(null)}
                className="p-1 rounded-lg text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs">
              <div>
                <span className="text-neutral-500 text-[10px] block">Buyer</span>
                <strong className="text-neutral-900">{showSheetDetailModal.clientName || showSheetDetailModal.buyerName || 'Standard'}</strong>
              </div>
              <div>
                <span className="text-neutral-500 text-[10px] block">Style</span>
                <strong className="text-neutral-900">{showSheetDetailModal.mainStyle || 'Standard'}</strong>
              </div>
              <div>
                <span className="text-neutral-500 text-[10px] block">Wilcom Design #</span>
                <strong className="text-brand-700 font-mono">{showSheetDetailModal.wilcomDesignNumber || 'WILCOM-STD'}</strong>
              </div>
              <div>
                <span className="text-neutral-500 text-[10px] block">Target Quantity</span>
                <strong className="text-neutral-900 font-mono">{showSheetDetailModal.targetQuantity || 0} PCS</strong>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-neutral-200">
              <button
                type="button"
                onClick={() => setShowSheetDetailModal(null)}
                className="px-4 py-2 border border-neutral-300 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CHALLAN ISSUED SUCCESSFULLY WITH BARCODE */}
      {createdChallanModal && (
        <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden space-y-5 p-6 my-8">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-accent-700" />
                <h3 className="text-base font-bold text-neutral-900">
                  Challan Issued to QC2 Successfully!
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCreatedChallanModal(null)}
                className="p-1 rounded-lg text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-accent-50 border border-accent-200 rounded-xl space-y-2 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-700 block">
                QC2 Gate Handover Dispatch (Rule 2)
              </span>
              <div className="grid grid-cols-2 gap-2 text-neutral-900">
                <div>
                  <span className="text-neutral-500 text-[10px] block">Challan Number</span>
                  <strong className="font-mono text-sm text-neutral-900">{createdChallanModal.challanNumber}</strong>
                </div>
                <div>
                  <span className="text-neutral-500 text-[10px] block">Destination</span>
                  <strong className="text-neutral-900">QC2 (Quality Check 2)</strong>
                </div>
                <div>
                  <span className="text-neutral-500 text-[10px] block">Design Number</span>
                  <strong className="font-mono text-brand-700">{designNumber}</strong>
                </div>
                <div>
                  <span className="text-neutral-500 text-[10px] block">Total Pieces (PCS)</span>
                  <strong className="text-neutral-900 font-mono">
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
                toDepartment: 'QC2',
                programSerialNo: selectedProgram?.programSerialNo || selectedProgram?.programNumber || '—',
                clientName: selectedProgram?.clientName || selectedProgram?.buyerName || 'Standard Client',
                mainStyle: selectedProgram?.mainStyle || 'Style',
                totalQuantity: items.reduce((s, it) => s + (Number(it.quantity) || 0), 0),
                uom: 'PCS',
                date: new Date().toLocaleDateString('en-IN')
              }}
              title="QC2 Handover Barcode Sticker Tag"
            />

            <div className="pt-2 flex flex-wrap items-center justify-end gap-2 border-t border-neutral-200">
              <button
                type="button"
                onClick={() => setCreatedChallanModal(null)}
                className="px-4 py-2 border border-neutral-300 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Issue Another Challan
              </button>
              <button
                type="button"
                onClick={() => downloadChallanHtml(createdChallanModal)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-50 hover:bg-brand-100 text-brand-800 border border-brand-200 rounded-lg text-xs font-bold transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Challan</span>
              </button>
              <button
                type="button"
                onClick={() => printChallan(createdChallanModal)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-bold transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Challan</span>
              </button>
              <Link
                href={`/challans/${createdChallanModal.id}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
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
        <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-xl w-full bg-white rounded-2xl shadow-2xl border-2 border-danger-300 overflow-hidden space-y-5 p-6 my-8">
            <div className="flex items-center justify-between border-b border-danger-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-danger-600 text-white flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    Defective Pieces Dispatched to Fabric Store!
                  </h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-danger-600">
                    FABRIC STORE DEFECTIVE SHELF ISOLATION
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreatedDefectModal(null)}
                className="p-1 rounded-lg text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-danger-50 border border-danger-200 rounded-xl space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 text-neutral-900">
                <div>
                  <span className="text-neutral-500 text-[10px] uppercase font-bold block">
                    Defect Return Challan #
                  </span>
                  <strong className="font-mono text-sm text-neutral-900">
                    {createdDefectModal.challanNumber}
                  </strong>
                </div>
                <div>
                  <span className="text-neutral-500 text-[10px] uppercase font-bold block">
                    Destination Department
                  </span>
                  <strong className="text-neutral-900">
                    Raw Material &amp; Fabric Store
                  </strong>
                </div>
                <div>
                  <span className="text-neutral-500 text-[10px] uppercase font-bold block">
                    Target Shelf Location
                  </span>
                  <strong className="text-danger-800 font-mono">
                    {defectiveShelfLocation}
                  </strong>
                </div>
                <div>
                  <span className="text-neutral-500 text-[10px] uppercase font-bold block">
                    Defective Quantity
                  </span>
                  <strong className="text-danger-700 font-mono text-sm">
                    {piecesDefected} PCS
                  </strong>
                </div>
              </div>

              <div className="pt-2 border-t border-danger-200">
                <span className="text-neutral-500 text-[10px] uppercase font-bold block">
                  Defect Reason &amp; Comments Recorded:
                </span>
                <p className="text-neutral-900 mt-0.5 italic">
                  &quot;{defectReason === 'Other' ? customDefectReason : defectReason} — {defectComments}&quot;
                </p>
              </div>
            </div>

            {/* BARCODE PREVIEW */}
            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-center space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 block">
                Quarantine Identification Barcode
              </span>
              <div className="font-mono font-bold tracking-[0.25em] text-base text-neutral-900 py-1.5 border-y border-dashed border-neutral-300">
                *{createdDefectModal.challanNumber}*
              </div>
              <span className="text-[10px] text-neutral-500">
                Fabric Store Incharge can scan this upon receiving to verify defective piece count.
              </span>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-end gap-2 border-t border-neutral-200">
              <button
                type="button"
                onClick={() => setCreatedDefectModal(null)}
                className="px-4 py-2 border border-neutral-300 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Done
              </button>
              <Link
                href="/fabric-store/inventory/defected-shelf"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-danger-50 hover:bg-danger-100 text-danger-800 border border-danger-200 rounded-lg text-xs font-bold transition"
              >
                <Archive className="w-3.5 h-3.5 text-danger-600" />
                <span>Go to Fabric Store Defective Shelf</span>
              </Link>
              <button
                type="button"
                onClick={() => downloadChallanHtml(createdDefectModal)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-danger-50 hover:bg-danger-100 text-danger-800 border border-danger-200 rounded-lg text-xs font-bold transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Return Challan</span>
              </button>
              <button
                type="button"
                onClick={() => printChallan(createdDefectModal)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-bold transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Return Challan</span>
              </button>
              <Link
                href={`/challans/${createdDefectModal.id}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
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
