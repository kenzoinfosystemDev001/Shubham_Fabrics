'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  ArrowLeft, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  FileText, 
  RefreshCw,
  Printer,
  ChevronRight,
  ShieldCheck,
  Eye,
  Calendar,
  User,
  Barcode as BarcodeIcon
} from 'lucide-react';
import { api } from '@/lib/api';
import { 
  ColorFabricMeasurementTable, 
  ChallanItemData, 
  createBlankChallanItem,
  DepartmentInOutTracking
} from '@/components/ColorFabricMeasurementTable';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';
import { printProductionSheet, downloadProductionSheetHtml } from '@/lib/download-production-sheet';

function getWilcomDesignEntries(program: any): Array<{ styleName?: string; category?: string; wilcomDesignNumber: string }> {
  let metadata: any = {};
  try {
    metadata = typeof program?.metadataJson === 'string'
      ? JSON.parse(program.metadataJson)
      : program?.metadataJson || {};
  } catch {}

  const programEntries = Array.isArray(program?.wilcomEntries) ? program.wilcomEntries : [];
  const metadataEntries = Array.isArray(metadata?.wilcomEntries) ? metadata.wilcomEntries : [];
  const entries = programEntries.length > 0 ? programEntries : metadataEntries;
  const designs = entries
    .filter((entry: any) => String(entry?.wilcomDesignNumber || '').trim())
    .map((entry: any) => ({
      styleName: String(entry.styleName || '').trim(),
      category: String(entry.category || '').trim(),
      wilcomDesignNumber: String(entry.wilcomDesignNumber).trim(),
    }));

  if (designs.length > 0) return designs;

  const legacyDesignNumber = String(program?.wilcomDesignNumber || '').trim();
  return legacyDesignNumber ? [{ wilcomDesignNumber: legacyDesignNumber }] : [];
}

function IssueChallanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProgramId = searchParams.get('programId');

  const [loading, setLoading] = useState(false);
  const [fetchingChallanNo, setFetchingChallanNo] = useState(true);
  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<any | null>(null);

  // Form fields per Master Development Prompt Section 5
  const [challanNumber, setChallanNumber] = useState('');
  const [challanDate, setChallanDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [sourceDept] = useState('Programming Department');
  const [destinationDept] = useState('Fabric Store');
  const [priority, setPriority] = useState<'NORMAL' | 'URGENT' | 'HIGH'>('NORMAL');
  const [designNumber, setDesignNumber] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [inchargeName, setInchargeName] = useState('');
  const [remarks, setRemarks] = useState('');

  // Department In/Cut/Out Tracking
  const [tracking, setTracking] = useState<DepartmentInOutTracking>({
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

  // Reusable COLOR / FABRIC / MEASUREMENT items
  const [items, setItems] = useState<ChallanItemData[]>([
    createBlankChallanItem('PROGRAMMING_STORE'),
  ]);

  const [error, setError] = useState<string | null>(null);
  const [issuedChallan, setIssuedChallan] = useState<any | null>(null);
  const [showSheetModal, setShowSheetModal] = useState(false);

  const wilcomDesignEntries = selectedProgram ? getWilcomDesignEntries(selectedProgram) : [];

  // Load programs and next Challan number
  useEffect(() => {
    const init = async () => {
      try {
        setFetchingChallanNo(true);
        const [programsList, nextNoRes] = await Promise.all([
          api.getPrograms().catch(() => []),
          fetch('/api/challans/next-number?department=PROGRAMMING').then(r => r.json()).catch(() => ({})),
        ]);

        setPrograms(programsList || []);
        if (nextNoRes.nextNumber) {
          setChallanNumber(nextNoRes.nextNumber);
        } else {
          const year = new Date().getFullYear();
          setChallanNumber(`CH-PRG-${year}-${String(Date.now()).slice(-5)}`);
        }

        // If preselected program provided via query param
        if (preselectedProgramId && programsList.length > 0) {
          const matched = programsList.find((p: any) => p.id === preselectedProgramId);
          if (matched) {
            handleSelectProgram(matched);
          }
        }
      } catch (err) {
        console.error('Failed to initialize challan issue form:', err);
      } finally {
        setFetchingChallanNo(false);
      }
    };
    init();
  }, [preselectedProgramId]);

  const handleSelectProgram = (prog: any) => {
    setSelectedProgram(prog);
    setSerialNumber(prog.programSerialNo || prog.programNumber || '');
    setDesignNumber(prog.designNumber || prog.styleCode || prog.wilcomDesignNumber || '');
    if (prog.deliveryDate) {
      setDeliveryDate(new Date(prog.deliveryDate).toISOString().split('T')[0]);
    }

    const targetQ = Number(prog.colorQuantity || prog.targetQuantity || prog.fabricIssuedToDyeing || 0);
    setTracking((prev) => ({
      ...prev,
      fabricIn: targetQ,
      fabricOut: Math.max(0, targetQ - prev.defectivePieces),
      fabricUnit: prog.quantityMeasurement === 'PCS' ? 'PCS' : 'MTR',
      detectedFromDept: 'PROGRAMMING',
    }));

    // Auto-populate all item fields from production sheet (supporting multiple colors & measurements)
    let programItems: any[] = Array.isArray(prog.items) ? prog.items : [];
    if (programItems.length === 0 && prog.metadataJson) {
      try {
        const meta = typeof prog.metadataJson === 'string' ? JSON.parse(prog.metadataJson) : prog.metadataJson;
        if (Array.isArray(meta?.items)) {
          programItems = meta.items;
        }
      } catch {}
    }

    if (programItems.length > 0) {
      setItems(
        programItems.map((it: any, idx: number) => ({
          id: `item-${Date.now()}-${idx}`,
          fabric: prog.fabricName || it.itemName || prog.mainStyle || 'Cotton',
          color: it.color || 'Standard',
          measurement: it.measurement || 0,
          unit: (it.unit === 'PCS' ? 'PCS' : 'MTR') as 'MTR' | 'PCS',
          remarks: `${it.itemName || 'Part'} - Program #${prog.programSerialNo || prog.programNumber}`,
        }))
      );
    } else {
      setItems([
        {
          id: `item-${Date.now()}`,
          fabric: prog.fabricName || prog.mainStyle || '',
          color: prog.fabricColor || prog.color || '',
          measurement: prog.colorQuantity || prog.targetQuantity || '',
          unit: (prog.quantityMeasurement === 'PCS' ? 'PCS' : 'MTR') as 'MTR' | 'PCS',
          remarks: `Program #${prog.programSerialNo || prog.programNumber}`,
        },
      ]);
    }
  };

  const handleIssueChallan = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedProgram) {
      setError('Please select a valid Production Sheet before issuing a Challan.');
      return;
    }

    if (!challanNumber.trim()) {
      setError('Challan Number is required.');
      return;
    }

    if (items.length === 0) {
      setError('Please add at least one fabric item in COLOR / FABRIC / MEASUREMENT.');
      return;
    }
    if (new Set(items.map((item) => item.unit)).size > 1) {
      setError('Use the same unit for every quantity in one challan.');
      return;
    }

    // Validate item rows
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.fabric.trim()) {
        setError(`Item #${i + 1}: Fabric Name is required.`);
        return;
      }
      if (!it.color.trim()) {
        setError(`Item #${i + 1}: Color is required.`);
        return;
      }
      const qtyNum = parseFloat(String(it.measurement));
      if (isNaN(qtyNum) || qtyNum <= 0) {
        setError(`Item #${i + 1}: Measurement / Quantity must be a positive number.`);
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        challanNumber: challanNumber.trim(),
        challanType: 'INTER_DEPARTMENT',
        programId: selectedProgram.id,
        fromDepartment: 'PROGRAMMING',
        toDepartment: 'STORE',
        priority,
        status: 'ISSUED',
        issuedDate: challanDate,
        fabricIn: tracking.fabricIn,
        defectivePieces: tracking.defectivePieces,
        defectiveShelfLocation: tracking.defectiveShelfLocation,
        defectReason: tracking.defectReason,
        fabricOut: tracking.fabricOut,
        fabricUnit: items[0]?.unit || tracking.fabricUnit,
        detectedFromDepartment: 'PROGRAMMING',
        remarks: [
          remarks,
          designNumber ? `Design: ${designNumber}` : null,
          serialNumber ? `Serial: ${serialNumber}` : null,
          inchargeName ? `Incharge: ${inchargeName}` : null,
          deliveryDate ? `Delivery Date: ${deliveryDate}` : null,
          `Accounting: In: ${tracking.fabricIn} ${tracking.fabricUnit} | Defective Cut: ${tracking.defectivePieces} ${tracking.fabricUnit} | Leftover Out to Store: ${tracking.fabricOut} ${tracking.fabricUnit}`,
        ]
          .filter(Boolean)
          .join(' | '),
        items: items.map((it) => ({
          itemDescription: `${it.fabric} (${it.color})`,
          quantity: parseFloat(String(it.measurement)) || tracking.fabricOut || 1,
          uom: it.unit || tracking.fabricUnit || 'MTR',
          colour: it.color,
          fabricCode: it.fabric,
          remarks: it.remarks || null,
        })),
      };

      const result = await api.createChallan(payload);
      setIssuedChallan(result);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to issue Challan.');
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pl-0 md:pl-64 pb-20">
      {/* TOP HEADER */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-4">
          <Link
            href="/my-work"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A66E22] block">
              PROGRAMMING DEPARTMENT · CHALLAN ISSUANCE
            </span>
            <h1 className="text-xl font-bold text-slate-900">
              Programming → Fabric Store Challan
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/programming"
            className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition"
          >
            Programming Dashboard
          </Link>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-6">
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2.5 shadow-2xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {issuedChallan ? (
          /* CONFIRMATION CARD */
          <div className="bg-white border border-emerald-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 block">
                  CHALLAN ISSUED TO FABRIC STORE
                </span>
                <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                  Challan {issuedChallan.challanNumber} Successfully Dispatched
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  The material issue order has been linked to Master Production Sheet #
                  {selectedProgram?.programSerialNo || selectedProgram?.programNumber} and queued for Fabric Store receipt.
                </p>
              </div>
            </div>

            {/* BARCODE BADGE */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
                Official Challan Security Barcode
              </span>
              <div className="font-mono font-bold tracking-[0.3em] text-lg text-slate-900 py-1 border-y border-dashed border-slate-300">
                *{issuedChallan.challanNumber}*
              </div>
            </div>

            {/* VOUCHER DETAILS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Source Department</span>
                <span className="font-bold text-slate-900">Programming Department</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Destination Department</span>
                <span className="font-bold text-blue-900">Fabric Store</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Production Program</span>
                <span className="font-mono font-bold text-slate-900">
                  {selectedProgram?.programSerialNo || selectedProgram?.programNumber}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Total Items</span>
                <span className="font-semibold text-slate-700">{items.length} Items</span>
              </div>
            </div>

            <div className="pt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
              <Link
                href="/programming"
                className="text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                ← Return to Programming Dashboard
              </Link>

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/challans/${issuedChallan.id}`}
                  className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-md shadow-xs transition flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>View &amp; Print Challan</span>
                </Link>

                {selectedProgram && (
                  <button
                    type="button"
                    onClick={() => setShowSheetModal(true)}
                    className="px-3.5 py-2 bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-300 text-xs font-bold rounded-md shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-teal-700" />
                    <span>View Production Sheet</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIssuedChallan(null);
                    setSelectedProgram(null);
                    setItems([createBlankChallanItem('PROGRAMMING_STORE')]);
                    router.push('/my-work/issue-challan');
                  }}
                  className="px-4 py-2 bg-[#163767] hover:bg-[#0F264A] text-white text-xs font-semibold rounded-md shadow-xs transition cursor-pointer"
                >
                  Issue Another Challan
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleIssueChallan} className="space-y-6">
            {/* STEP 1: SELECT PRODUCTION SHEET */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Production Sheet Reference</h2>
                  <p className="text-[11px] text-slate-500">
                    Challans must remain strictly linked to an authorized Production Sheet
                  </p>
                </div>

                <Link
                  href="/my-work/create-production-sheet"
                  className="text-xs font-semibold text-blue-700 hover:underline"
                >
                  + Create New Production Sheet
                </Link>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Production Sheet / Program File <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={selectedProgram?.id || ''}
                  onChange={(e) => {
                    const found = programs.find((p) => p.id === e.target.value);
                    if (found) handleSelectProgram(found);
                  }}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                >
                  <option value="">-- Choose a Production Sheet --</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      Sheet #{p.programSerialNo || p.programNumber} · {p.clientName || p.buyerName} · {p.mainStyle || p.styleCode} ({p.status})
                    </option>
                  ))}
                </select>
              </div>

              {selectedProgram && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      Sheet #{selectedProgram.programSerialNo || selectedProgram.programNumber}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-900">
                      {selectedProgram.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-slate-600">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Client</span>
                      <span className="font-semibold text-slate-900">{selectedProgram.clientName || selectedProgram.buyerName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Style &amp; Design</span>
                      <span className="font-semibold text-slate-900">{selectedProgram.mainStyle || selectedProgram.styleCode}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Fabric Name</span>
                      <span className="font-semibold text-slate-900">{selectedProgram.fabricName || 'Cotton'}</span>
                    </div>
                    <div className="min-w-0 sm:col-span-2">
                      <span className="text-slate-400 block text-[10px]">Wilcom Designs</span>
                      {wilcomDesignEntries.length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {wilcomDesignEntries.map((entry, index) => (
                            <span
                              key={`${entry.wilcomDesignNumber}-${index}`}
                              className="inline-flex min-w-0 max-w-full items-center gap-1 rounded bg-purple-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-purple-900"
                            >
                              <span className="shrink-0 font-sans font-semibold text-purple-700">
                                {entry.styleName || entry.category || `Design ${index + 1}`}
                              </span>
                              <span className="break-all">{entry.wilcomDesignNumber}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="font-mono font-bold text-purple-900">WLC-N/A</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* STEP 2: CHALLAN METADATA & ROUTING */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-4">
              <div className="pb-3 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-900">Challan Metadata &amp; Routing</h2>
                <p className="text-[11px] text-slate-500">Fixed department routing and dispatch details</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                {/* Challan Number */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Challan Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={challanNumber}
                    onChange={(e) => setChallanNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                {/* Challan Date */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Challan Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={challanDate}
                    onChange={(e) => setChallanDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                {/* Source Department */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Source Department
                  </label>
                  <input
                    type="text"
                    disabled
                    value={sourceDept}
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg font-bold text-slate-700 cursor-not-allowed"
                  />
                </div>

                {/* Destination Department */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Destination Department
                  </label>
                  <input
                    type="text"
                    disabled
                    value={destinationDept}
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg font-bold text-blue-900 cursor-not-allowed"
                  />
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e: any) => setPriority(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="URGENT">Urgent</option>
                    <option value="HIGH">Super Urgent</option>
                  </select>
                </div>

                {/* Design Number */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Design Number
                  </label>
                  <input
                    type="text"
                    value={designNumber}
                    onChange={(e) => setDesignNumber(e.target.value)}
                    placeholder=""
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                {/* Serial Number */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Serial Number
                  </label>
                  <input
                    type="text"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    placeholder=""
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                {/* Delivery Date */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Delivery Date
                  </label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              {/* Department Incharge Name & Remarks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Department Incharge Name
                  </label>
                  <input
                    type="text"
                    value={inchargeName}
                    onChange={(e) => setInchargeName(e.target.value)}
                    placeholder=""
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Dispatch Notes / Remarks
                  </label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder=""
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* STEP 3: COLOR / FABRIC / MEASUREMENT REUSABLE TABLE WITH IN/OUT TRACKING */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs">
              <ColorFabricMeasurementTable
                items={items}
                onChange={setItems}
                context="PROGRAMMING_STORE"
                programId={selectedProgram?.id}
                currentDepartment="PROGRAMMING"
                tracking={tracking}
                onTrackingChange={setTracking}
                showInOutController={false}
              />
            </div>

            {/* AUDIT & SUBMIT BUTTON */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  Challan barcode and immutable transaction record will be created in the database.
                </span>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/programming"
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </Link>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-black disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>{loading ? 'Issuing Challan...' : 'Submit Challan to Fabric Store'}</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </main>

      {/* Accompanying Production Sheet Print & Download Modal */}
      <ProductionSheetPrintModal
        program={selectedProgram}
        isOpen={showSheetModal}
        onClose={() => setShowSheetModal(false)}
      />
    </div>
  );
}

export default function IssueChallanPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Loading form...</div>}>
      <IssueChallanContent />
    </Suspense>
  );
}
