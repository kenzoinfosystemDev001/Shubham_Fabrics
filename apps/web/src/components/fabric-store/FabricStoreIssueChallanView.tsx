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

interface ChallanItemRow {
  id: string;
  colour: string;
  colorCode: string;
  fabric: string;
  width: string;
  measurement: string;
}

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

  // Loading & base data
  const [loading, setLoading] = useState(true);
  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>(preselectedProgramId || '');

  // Form Fields as per handwritten specification
  const [challanNumber, setChallanNumber] = useState('');
  const [challanDate, setChallanDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [sourceDept] = useState('Fabric Store');
  const [destDept] = useState(destinationDepartment === 'DYEING' ? 'Dyeing' : 'Embroidery');
  const [priority, setPriority] = useState('NORMAL');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [designNumber, setDesignNumber] = useState('');
  const [serialNumber, setSerialNumber] = useState('');

  // Dynamic table items: Color / Fabric / Measurement (Table form)
  const [items, setItems] = useState<ChallanItemRow[]>([
    {
      id: 'row-1',
      colour: '',
      colorCode: '',
      fabric: '',
      width: '',
      measurement: '',
    },
  ]);

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

      // Sort programs: if target is DYEING, put dyeing-required programs first
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

      // Check current user from localStorage for incharge name
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

      // Pre-select program if requested or select first
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

  // Synchronize form fields when a Production Sheet / Serial Number is selected
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

    // Auto-populate table row from the Production Sheet specifications
    const initialItem: ChallanItemRow = {
      id: 'row-1',
      colour: prog.fabricColor || prog.colours?.[0]?.colorName || '',
      colorCode: prog.colours?.[0]?.colourCode || prog.colours?.[0]?.colorCode || '',
      fabric: prog.fabricName || prog.fabrics?.[0]?.fabricName || '',
      width: prog.fabricWidth || (prog.fabricWidthInches ? `${prog.fabricWidthInches}"` : '') || '',
      measurement: String(
        prog.fabricIssuedToDyeing ||
        prog.fabricSentToDyeing ||
        prog.targetQuantity ||
        prog.colorQuantity ||
        ''
      ),
    };

    setItems([initialItem]);
  };

  const selectedProgram = programs.find((p) => p.id === selectedProgramId);

  // Table row actions
  const handleAddItem = () => {
    const newRow: ChallanItemRow = {
      id: `row-${Date.now()}`,
      colour: '',
      colorCode: '',
      fabric: selectedProgram?.fabricName || '',
      width: selectedProgram?.fabricWidth || (selectedProgram?.fabricWidthInches ? `${selectedProgram.fabricWidthInches}"` : '') || '',
      measurement: '',
    };
    setItems((prev) => [...prev, newRow]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) {
      // Keep at least one row, just clear its fields
      setItems([
        {
          id: 'row-1',
          colour: '',
          colorCode: '',
          fabric: '',
          width: '',
          measurement: '',
        },
      ]);
      return;
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateItem = (id: string, field: keyof ChallanItemRow, value: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

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
      (it) => it.fabric.trim() || it.colour.trim() || parseFloat(it.measurement) > 0
    );

    if (validItems.length === 0) {
      setError('Please enter at least one item in the Color / Fabric / Measurement table.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      // Map table items to ChallanItem database schema
      const challanItems = validItems.map((item) => ({
        itemDescription: `${item.fabric || 'Fabric'} — ${item.colour || 'Standard'}`,
        unitType: 'ROLL',
        quantity: parseFloat(item.measurement) || 1,
        uom: selectedProgram.quantityMeasurement || 'MTR',
        fabricCode: item.fabric || selectedProgram.fabricName || 'FABRIC',
        colour: item.colour || null,
        remarks: [
          item.colorCode ? `Color Code: ${item.colorCode}` : null,
          item.width ? `Width: ${item.width}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      }));

      const inchargeInfo = [
        storeInchargeName ? `Store Incharge: ${storeInchargeName}` : null,
        storeInchargeContact ? `Contact: ${storeInchargeContact}` : null,
        designNumber ? `Design #: ${designNumber}` : null,
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
    } catch (err: any) {
      setError(err.message || 'Error submitting challan');
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
                  The Production Sheet and Challan items have been transferred to the Dyeing department worklist.
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
                href="/dyeing/my-work"
                className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-50 hover:bg-teal-100 border border-teal-300 text-teal-900 text-xs font-bold rounded-lg transition"
              >
                <Eye className="w-3.5 h-3.5 text-teal-700" />
                <span>View in Dyeing Worklist →</span>
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

              {/* 9. COLOR / FABRIC / MEASUREMENT (Table form) */}
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Color / Fabric / Measurement (Table form)
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 rounded-lg text-xs font-bold transition shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>add item</span>
                  </button>
                </div>

                {/* TABLE CONTAINER */}
                <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">Colour</th>
                        <th className="py-2.5 px-3">Colour code</th>
                        <th className="py-2.5 px-3">Fabric</th>
                        <th className="py-2.5 px-3">Width</th>
                        <th className="py-2.5 px-3">Measurement</th>
                        <th className="py-2.5 px-2 text-center w-12">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition">
                          <td className="py-2 px-2.5">
                            <input
                              type="text"
                              value={item.colour}
                              onChange={(e) => handleUpdateItem(item.id, 'colour', e.target.value)}
                              className="w-full text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:outline-hidden focus:ring-1 focus:ring-teal-600 focus:border-teal-600 transition"
                            />
                          </td>
                          <td className="py-2 px-2.5">
                            <input
                              type="text"
                              value={item.colorCode}
                              onChange={(e) => handleUpdateItem(item.id, 'colorCode', e.target.value)}
                              className="w-full text-xs font-mono border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:outline-hidden focus:ring-1 focus:ring-teal-600 focus:border-teal-600 transition"
                            />
                          </td>
                          <td className="py-2 px-2.5">
                            <input
                              type="text"
                              value={item.fabric}
                              onChange={(e) => handleUpdateItem(item.id, 'fabric', e.target.value)}
                              className="w-full text-xs font-medium border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:outline-hidden focus:ring-1 focus:ring-teal-600 focus:border-teal-600 transition"
                            />
                          </td>
                          <td className="py-2 px-2.5">
                            <input
                              type="text"
                              value={item.width}
                              onChange={(e) => handleUpdateItem(item.id, 'width', e.target.value)}
                              className="w-full text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:outline-hidden focus:ring-1 focus:ring-teal-600 focus:border-teal-600 transition"
                            />
                          </td>
                          <td className="py-2 px-2.5">
                            <input
                              type="text"
                              value={item.measurement}
                              onChange={(e) => handleUpdateItem(item.id, 'measurement', e.target.value)}
                              className="w-full text-xs font-mono font-bold border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:outline-hidden focus:ring-1 focus:ring-teal-600 focus:border-teal-600 transition"
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                              title="Delete row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
                      placeholder="Name"
                      className="w-full text-xs font-medium border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600 focus:border-transparent transition"
                    />
                    <input
                      type="text"
                      value={storeInchargeContact}
                      onChange={(e) => setStoreInchargeContact(e.target.value)}
                      placeholder="Contact Number"
                      className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600 focus:border-transparent transition"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 11. SUBMIT BUTTON */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Submitting will send this Challan and Production Sheet to the Dyeing department.
              </span>

              <button
                type="submit"
                disabled={submitting || !selectedProgram}
                className="inline-flex items-center gap-2 px-7 py-3 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? 'Submitting...' : 'Submit'}</span>
              </button>
            </div>
          </form>
        )}

        {/* ============================================================== */}
        {/* MODAL: MASTER PRODUCTION SHEET TRAVELER                       */}
        {/* ============================================================== */}
        {showSheetModal && selectedProgram && (
          <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b pb-3 border-slate-200">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-teal-700" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Production Sheet Traveler &middot; {selectedProgram.programNumber || selectedProgram.programSerialNo}
                    </h3>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => printProductionSheet(selectedProgram)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadProductionSheetHtml(selectedProgram)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSheetModal(false)}
                    className="p-1 text-slate-400 hover:text-slate-700 text-lg font-bold ml-2"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* MODAL SHEET CONTENT */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3.5 text-xs">
                <div className="flex justify-between items-start border-b-2 border-slate-800 pb-2.5">
                  <div>
                    <h2 className="text-base font-black text-slate-900">
                      SHUBHAM FABRICS INDIA PVT. LTD.
                    </h2>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">
                      Production Sheet
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-sm font-bold text-teal-800 block">
                      {selectedProgram.programNumber || selectedProgram.programSerialNo}
                    </span>
                    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-800">
                      {selectedProgram.status || 'ACTIVE'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="p-2 bg-slate-50 rounded">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Buyer / Client</span>
                    <strong className="text-slate-900">{selectedProgram.clientName || selectedProgram.buyerName || '—'}</strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Main Style</span>
                    <strong className="text-slate-900">{selectedProgram.mainStyle || selectedProgram.styleCode || '—'}</strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Wilcom Design #</span>
                    <strong className="font-mono text-teal-900">{selectedProgram.wilcomDesignNumber || '—'}</strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Fabric Quality</span>
                    <strong className="text-slate-900">{selectedProgram.fabricName || '—'}</strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Fabric Color</span>
                    <strong className="text-slate-900">{selectedProgram.fabricColor || '—'}</strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Dyeing Required</span>
                    <strong className={selectedProgram.fabricDyeingRequired ? 'text-blue-700' : 'text-emerald-700'}>
                      {selectedProgram.fabricDyeingRequired ? 'YES' : 'NO'}
                    </strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Target Qty</span>
                    <strong className="font-mono text-slate-900">
                      {selectedProgram.colorQuantity || selectedProgram.targetQuantity || 0} PCS
                    </strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Average Consumption</span>
                    <span className="font-mono text-slate-700">
                      {selectedProgram.fabricAverage ? `${selectedProgram.fabricAverage} ${selectedProgram.fabricAverageType || 'Mtr/Pc'}` : '—'}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Delivery Target Date</span>
                    <span className="font-mono text-slate-700">
                      {selectedProgram.deliveryDate ? new Date(selectedProgram.deliveryDate).toLocaleDateString() : '—'}
                    </span>
                  </div>
                </div>

                {selectedProgram.comments && (
                  <div className="p-2.5 bg-amber-50 rounded border border-amber-200">
                    <span className="text-[10px] text-amber-900 font-bold uppercase block mb-0.5">
                      Comments / Notes
                    </span>
                    <p className="text-xs text-amber-950 font-medium">
                      {selectedProgram.comments}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setShowSheetModal(false)}
                  className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
