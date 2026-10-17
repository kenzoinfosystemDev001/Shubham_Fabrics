'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Send,
  FileText,
  Printer,
  Download,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Eye,
  ArrowLeft,
  Plus,
  Trash2,
  Calendar,
  Building2,
  Phone,
  User,
  Hash,
  Sparkles,
} from 'lucide-react';
import {
  downloadProductionSheetHtml,
  printProductionSheet,
} from '@/lib/download-production-sheet';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';

import {
  ColorFabricMeasurementTable,
  ChallanItemData,
  createBlankChallanItem,
  DepartmentInOutTracking,
} from '@/components/ColorFabricMeasurementTable';

interface FabricStoreIssueChallanViewProps {
  fixedTarget?: 'DYEING' | 'EMBROIDERY';
}

export function FabricStoreIssueChallanView({ fixedTarget }: FabricStoreIssueChallanViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProgramId = searchParams?.get('programId');
  const queryTo = searchParams?.get('to')?.toUpperCase();

  const destinationDepartment: 'DYEING' | 'EMBROIDERY' =
    fixedTarget ||
    (queryTo === 'EMBROIDERY' ? 'EMBROIDERY' : 'DYEING');

  const challanContext = destinationDepartment === 'DYEING' ? 'STORE_DYEING' : 'STORE_EMBROIDERY';

  // Loading & base data
  const [loading, setLoading] = useState(true);
  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>(preselectedProgramId || '');

  // Form Fields
  const [challanNumber, setChallanNumber] = useState('');
  const [challanDate, setChallanDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [sourceDept] = useState('Fabric Store');
  const [destDept] = useState(destinationDepartment === 'DYEING' ? 'Dyeing' : 'Embroidery');
  const [priority, setPriority] = useState('NORMAL');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [designNumber, setDesignNumber] = useState('');
  const [serialNumber, setSerialNumber] = useState('');

  // In / Out Tracking across departments
  const [storeTracking, setStoreTracking] = useState<DepartmentInOutTracking>({
    fabricIn: 0,
    fabricOut: 0,
    fabricUnit: 'MTR',
    defectivePieces: 0,
    defectiveShelfLocation: 'DEF-SHELF-STORE (Fabric Store Quarantined Shelf)',
    defectReason: 'Weaving Slub / Fabric Tear',
    detectedFromDept: 'PROGRAMMING',
    detectedFromChallanId: null,
    detectedFromChallanNumber: null,
  });

  // Reusable Color / Fabric / Measurement items (Default blank)
  const [items, setItems] = useState<ChallanItemData[]>(() => [createBlankChallanItem(challanContext)]);

  // Store Incharge (Name / Contact)
  const [storeInchargeName, setStoreInchargeName] = useState('Fabric Store Incharge');
  const [storeInchargeContact, setStoreInchargeContact] = useState('');

  // UI States
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showSheetModal, setShowSheetModal] = useState(false);
  const [issuedChallan, setIssuedChallan] = useState<any>(null);

  // Load Programs & Next Challan Number
  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      const [progRes, numRes] = await Promise.all([
        fetch('/api/programs'),
        fetch('/api/challans/next-number?department=STORE'),
      ]);

      const progData = await progRes.json();
      const numData = await numRes.json();

      let progList: any[] = Array.isArray(progData) ? progData : [];

      if (destinationDepartment === 'DYEING') {
        progList = [...progList].sort((a, b) => {
          if (a.fabricDyeingRequired === b.fabricDyeingRequired) return 0;
          return a.fabricDyeingRequired ? -1 : 1;
        });
      }

      setPrograms(progList);
      if (numData?.nextNumber) {
        setChallanNumber(numData.nextNumber);
      }

      if (typeof window !== 'undefined') {
        try {
          const savedUser = localStorage.getItem('subham_mes_user');
          if (savedUser) {
            const parsed = JSON.parse(savedUser);
            if (parsed.fullName) setStoreInchargeName(parsed.fullName);
            if (parsed.phone || parsed.contact) setStoreInchargeContact(parsed.phone || parsed.contact);
          }
        } catch {}
      }

      const targetProg = preselectedProgramId
        ? progList.find((p) => p.id === preselectedProgramId)
        : progList[0];

      if (targetProg) {
        handleProgramSelect(targetProg);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load initial data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [preselectedProgramId, destinationDepartment]);

  // Synchronize form reference fields when a Production Sheet / Serial Number is selected
  // All business entry fields remain blank as per Master Prompt rules
  const handleProgramSelect = (prog: any) => {
    if (!prog) return;
    setSelectedProgramId(prog.id);
    setSerialNumber(prog.programSerialNo || prog.programNumber || '');
    setDesignNumber(prog.designNumber || prog.wilcomDesignNumber || prog.styleCode || '');
    setPriority(prog.priority || 'NORMAL');

    if (prog.deliveryDate) {
      const dt = new Date(prog.deliveryDate).toISOString().split('T')[0];
      setDeliveryDate(dt);
    } else {
      setDeliveryDate('');
    }

    const targetQ = Number(prog.targetQuantity || prog.fabricIssuedToDyeing || 0);
    setStoreTracking((prev) => ({
      ...prev,
      fabricIn: targetQ,
      fabricOut: Math.max(0, targetQ - prev.defectivePieces),
      fabricUnit: prog.quantityMeasurement === 'PCS' ? 'PCS' : 'MTR',
      detectedFromDept: 'PROGRAMMING',
    }));
  };

  const selectedProgram = programs.find((p) => p.id === selectedProgramId);

  // Submit Challan Store to Dyeing
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProgram) {
      setError('Please select a Serial Number / Production Sheet.');
      return;
    }

    if (!challanNumber.trim()) {
      setError('Please provide a Challan Number.');
      return;
    }

    // Filter valid items
    const validItems = items.filter(
      (it) => it.fabric.trim() || it.color.trim() || parseFloat(String(it.measurement)) > 0
    );

    if (validItems.length === 0) {
      setError('Please enter at least one item in the Color / Fabric / Measurement table.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      // Map ColorFabricMeasurementTable items to ChallanItem database schema
      const challanItems = validItems.map((item) => ({
        itemDescription: `${item.fabric || 'Fabric'} — ${item.color || 'Standard'}`,
        unitType: 'ROLL',
        quantity: parseFloat(String(item.measurement)) || storeTracking.fabricOut || 1,
        uom: item.unit || storeTracking.fabricUnit || selectedProgram.quantityMeasurement || 'MTR',
        fabricCode: item.fabric || selectedProgram.fabricName || 'FABRIC',
        colour: item.color || null,
        shade: item.requiredDyeColor || null,
        requiredDyeQuantity: item.requiredDyeQuantity || null,
        fabricProcessingStatus: destinationDepartment === 'EMBROIDERY' ? 'Undyed' : undefined,
        rollNumber: item.rollNumber || null,
        remarks: item.remarks || null,
      }));

      const inchargeInfo = [
        storeInchargeName ? `Store Incharge: ${storeInchargeName}` : null,
        storeInchargeContact ? `Contact: ${storeInchargeContact}` : null,
        designNumber ? `Design #: ${designNumber}` : null,
        `Accounting: In: ${storeTracking.fabricIn} ${storeTracking.fabricUnit} | Defective Cut: ${storeTracking.defectivePieces} ${storeTracking.fabricUnit} (${storeTracking.defectiveShelfLocation}) | Leftover Out to ${destinationDepartment}: ${storeTracking.fabricOut} ${storeTracking.fabricUnit}`,
      ]
        .filter(Boolean)
        .join(' · ');

      const payload = {
        challanNumber: challanNumber.trim(),
        challanType: destinationDepartment === 'DYEING' ? 'STORE_TO_DYEING' : 'STORE_TO_EMBROIDERY',
        programId: selectedProgram.id,
        fromDepartment: 'STORE',
        toDepartment: destinationDepartment,
        priority: priority || 'NORMAL',
        issuedDate: challanDate,
        fabricIn: storeTracking.fabricIn,
        defectivePieces: storeTracking.defectivePieces,
        defectiveShelfLocation: storeTracking.defectiveShelfLocation,
        defectReason: storeTracking.defectReason,
        fabricOut: storeTracking.fabricOut,
        fabricUnit: storeTracking.fabricUnit,
        detectedFromDepartment: storeTracking.detectedFromDept || 'PROGRAMMING',
        remarks: inchargeInfo,
        items: challanItems,
      };

      const res = await fetch('/api/challans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to dispatch challan to Dyeing');
      }

      setIssuedChallan({
        ...data,
        program: selectedProgram,
        destinationDepartment,
        storeInchargeName,
        storeInchargeContact,
        tableItems: validItems,
      });
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err: any) {
      setError(err.message || 'Error submitting challan');
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setIssuedChallan(null);
    setError('');
    loadData();
  };

  return (
    <div className="min-h-screen bg-[#F0FAF9] pb-24">
      {/* TOP NAVIGATION / HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-8 py-3.5 shadow-2xs">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/fabric-store"
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition"
              title="Back to Fabric Store"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700">
                  FABRIC STORE
                </span>
                <span className="text-slate-300">/</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  MY WORK
                </span>
              </div>
              <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Send className="w-4 h-4 text-indigo-600" />
                <span>Challan Store to {destDept}</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {selectedProgram && (
              <button
                type="button"
                onClick={() => setShowSheetModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 rounded-lg text-xs font-bold transition shadow-2xs"
              >
                <FileText className="w-3.5 h-3.5 text-teal-700" />
                <span>Show Production Sheet</span>
              </button>
            )}
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <main className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
        {/* ERROR NOTIFICATION */}
        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* ============================================================== */}
        {/* SUCCESS CONFIRMATION STATE                                     */}
        {/* ============================================================== */}
        {issuedChallan ? (
          <div className="bg-white border border-emerald-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 block">
                  CHALLAN DISPATCHED &amp; SYNCED
                </span>
                <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                  Challan {issuedChallan.challanNumber} Dispatched to {issuedChallan.destinationDepartment === 'DYEING' ? 'Dyeing' : 'Embroidery'} Department
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  The Production Sheet and Challan items have been transferred to the {destDept} department worklist.
                </p>
              </div>
            </div>

            {/* SUMMARY GRID */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 p-4 bg-slate-50 border border-slate-200/80 rounded-xl text-xs">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Challan Number</span>
                <strong className="font-mono text-slate-900 text-sm">{issuedChallan.challanNumber}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Serial Number</span>
                <strong className="font-mono text-teal-800 text-sm">
                  {issuedChallan.program?.programSerialNo || issuedChallan.program?.programNumber || '—'}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Design Number</span>
                <strong className="text-slate-900">{designNumber || '—'}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Priority</span>
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 uppercase">
                  {priority}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Source</span>
                <strong className="text-slate-900">{sourceDept}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Destination</span>
                <strong className="text-slate-900">{destDept}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Store Incharge</span>
                <strong className="text-slate-900">{storeInchargeName || '—'}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Contact</span>
                <span className="text-slate-700">{storeInchargeContact || '—'}</span>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100">
              <Link
                href={`/challans/${issuedChallan.id}`}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold rounded-lg shadow-xs transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>View &amp; Print Challan Slip</span>
              </Link>
              <button
                type="button"
                onClick={() => printProductionSheet(issuedChallan.program)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Production Sheet</span>
              </button>
              <button
                type="button"
                onClick={() => downloadProductionSheetHtml(issuedChallan.program)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xs transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download HTML</span>
              </button>
              <Link
                href={destinationDepartment === 'DYEING' ? '/dyeing/my-work' : '/embroidery/my-work'}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-50 hover:bg-teal-100 border border-teal-300 text-teal-900 text-xs font-bold rounded-lg transition"
              >
                <Eye className="w-3.5 h-3.5 text-teal-700" />
                <span>View in {destDept} Worklist →</span>
              </Link>
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow-xs transition ml-auto"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Issue Another Challan</span>
              </button>
            </div>
          </div>
        ) : (
          /* ============================================================== */
          /* FORM: (Challan Store to Dyeing)                                */
          /* Exact field layout specified in handwritten sketch             */
          /* ============================================================== */
          <form onSubmit={handleSubmit} className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
            {/* CARD TITLE & "Show Production sheet" BUTTON */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-xl font-bold font-serif text-slate-900">
                  (Challan Store to {destDept})
                </h2>
                <span className="text-xs text-slate-500">
                  Dispatch production lots and master traveler from Fabric Store to Dyeing department
                </span>
              </div>

              {selectedProgram ? (
                <button
                  type="button"
                  onClick={() => setShowSheetModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
                >
                  <FileText className="w-4 h-4" />
                  <span>Show Production sheet</span>
                </button>
              ) : (
                <span className="text-xs text-slate-400 italic">
                  Select Serial Number to preview Production Sheet
                </span>
              )}
            </div>

            {/* LINE BY LINE FORM FIELDS */}
            <div className="space-y-4">
              {/* 1. CHALLAN NUMBER */}
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                <label className="text-xs font-bold text-slate-700 sm:text-right sm:pr-4">
                  Challan Number <span className="text-rose-500">*</span>
                </label>
                <div className="sm:col-span-2 max-w-lg">
                  <input
                    type="text"
                    value={challanNumber}
                    onChange={(e) => setChallanNumber(e.target.value)}
                    required
                    className="w-full text-xs font-mono font-bold text-slate-900 border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600 focus:border-transparent transition"
                  />
                </div>
              </div>

              {/* 2. CHALLAN DATE */}
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                <label className="text-xs font-bold text-slate-700 sm:text-right sm:pr-4">
                  Challan Date <span className="text-rose-500">*</span>
                </label>
                <div className="sm:col-span-2 max-w-lg">
                  <input
                    type="date"
                    value={challanDate}
                    onChange={(e) => setChallanDate(e.target.value)}
                    required
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600 focus:border-transparent transition"
                  />
                </div>
              </div>

              {/* 3. SOURCE (Fabric store) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                <label className="text-xs font-bold text-slate-700 sm:text-right sm:pr-4">
                  Source (Fabric store)
                </label>
                <div className="sm:col-span-2 max-w-lg">
                  <div className="w-full text-xs font-semibold text-slate-800 border border-slate-200 rounded-lg px-3 py-2 bg-slate-100 flex items-center justify-between">
                    <span>{sourceDept}</span>
                    <span className="text-[10px] font-bold text-teal-800 bg-teal-100 px-2 py-0.5 rounded uppercase">
                      STORE
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. DESTINATION (Dyeing) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                <label className="text-xs font-bold text-slate-700 sm:text-right sm:pr-4">
                  Destination (Dyeing)
                </label>
                <div className="sm:col-span-2 max-w-lg">
                  <div className="w-full text-xs font-semibold text-slate-800 border border-slate-200 rounded-lg px-3 py-2 bg-slate-100 flex items-center justify-between">
                    <span>{destDept}</span>
                    <span className="text-[10px] font-bold text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded uppercase">
                      DYEING
                    </span>
                  </div>
                </div>
              </div>

              {/* 5. PRIORITY */}
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                <label className="text-xs font-bold text-slate-700 sm:text-right sm:pr-4">
                  Priority
                </label>
                <div className="sm:col-span-2 max-w-lg">
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full text-xs font-semibold border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600 focus:border-transparent transition cursor-pointer"
                  >
                    <option value="NORMAL">NORMAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
              </div>

              {/* 6. DELIVERY DATE */}
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                <label className="text-xs font-bold text-slate-700 sm:text-right sm:pr-4">
                  Delivery Date
                </label>
                <div className="sm:col-span-2 max-w-lg">
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600 focus:border-transparent transition"
                  />
                </div>
              </div>

              {/* 7. DESIGN NUMBER */}
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                <label className="text-xs font-bold text-slate-700 sm:text-right sm:pr-4">
                  Design Number
                </label>
                <div className="sm:col-span-2 max-w-lg">
                  <input
                    type="text"
                    value={designNumber}
                    onChange={(e) => setDesignNumber(e.target.value)}
                    className="w-full text-xs font-mono font-medium text-slate-900 border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600 focus:border-transparent transition"
                  />
                </div>
              </div>

              {/* 8. SERIAL NUMBER (Production Sheet Selector) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                <label className="text-xs font-bold text-slate-700 sm:text-right sm:pr-4">
                  Serial Number <span className="text-rose-500">*</span>
                </label>
                <div className="sm:col-span-2 max-w-lg">
                  <select
                    value={selectedProgramId}
                    onChange={(e) => {
                      const prog = programs.find((p) => p.id === e.target.value);
                      if (prog) handleProgramSelect(prog);
                    }}
                    required
                    className="w-full text-xs font-mono font-bold text-slate-900 border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600 focus:border-transparent transition cursor-pointer"
                  >
                    <option value="">Select Production Sheet Serial Number</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.programSerialNo || p.programNumber} — {p.clientName || p.buyerName || 'Buyer'} ({p.mainStyle || p.styleCode || 'Style'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 9. COLOR / FABRIC / MEASUREMENT (Universal Challan Item Component with In/Cut/Out Tracking) */}
              <div className="pt-3 border-t border-slate-200">
                <ColorFabricMeasurementTable
                  items={items}
                  onChange={setItems}
                  context={challanContext}
                  programId={selectedProgram?.id}
                  currentDepartment="STORE"
                  tracking={storeTracking}
                  onTrackingChange={setStoreTracking}
                  showInOutController={true}
                />
              </div>

              {/* 10. STORE INCHARGE (Name / Contact) */}
              <div className="pt-3 border-t border-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                  <label className="text-xs font-bold text-slate-700 sm:text-right sm:pr-4">
                    Store Incharge (Name / Contact)
                  </label>
                  <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg">
                    <input
                      type="text"
                      value={storeInchargeName}
                      onChange={(e) => setStoreInchargeName(e.target.value)}
                      placeholder=""
                      className="w-full text-xs font-medium border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600 focus:border-transparent transition"
                    />
                    <input
                      type="text"
                      value={storeInchargeContact}
                      onChange={(e) => setStoreInchargeContact(e.target.value)}
                      placeholder=""
                      className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600 focus:border-transparent transition"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 11. SUBMIT BUTTON */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-7 py-3 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                {submitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-teal-200" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>{submitting ? 'Submitting Challan...' : 'Submit Challan to Dyeing'}</span>
              </button>
            </div>
          </form>
        )}

        {/* ============================================================== */}
        {/* MODAL: MASTER PRODUCTION SHEET TRAVELER                       */}
        {/* ============================================================== */}
        <ProductionSheetPrintModal
          program={selectedProgram}
          isOpen={showSheetModal}
          onClose={() => setShowSheetModal(false)}
        />
      </main>
    </div>
  );
}
