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
  Eye,
  Calendar,
  User,
  Barcode as BarcodeIcon
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatTotals, totalsByUnit, unitOf } from '@/lib/challan-units.mjs';
import {
  ColorFabricMeasurementTable,
  ChallanItemData, 
  createBlankChallanItem,
  DepartmentInOutTracking
} from '@/components/ColorFabricMeasurementTable';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';
import { printProductionSheet, downloadProductionSheetHtml } from '@/lib/download-production-sheet';
import { ChallanNumberField, newSubmissionKey } from '@/components/challan/ChallanNumberField';
import { quantityPairError } from '@/components/challan/AverageField';

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
  const [challanNumberError, setChallanNumberError] = useState<string | null>(null);
  // One key per challan form fill, so a retried or double-clicked submit cannot create two challans.
  const [submissionKey, setSubmissionKey] = useState(newSubmissionKey);
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

  // Load programs
  useEffect(() => {
    const init = async () => {
      try {
        setFetchingChallanNo(true);
        const programsList = await api.getPrograms().catch(() => []);

        setPrograms(programsList || []);

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
          // Pre-filled only from a unit the production sheet actually stored; otherwise the user picks.
          unit: (unitOf(it.unit) || '') as ChallanItemData['unit'],
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
          unit: (unitOf(prog.quantityMeasurement) || '') as ChallanItemData['unit'],
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
      setChallanNumberError('Challan Number is required.');
      setError('Challan Number is required.');
      return;
    }
    setChallanNumberError(null);

    if (items.length === 0) {
      setError('Please add at least one fabric item in COLOR / FABRIC / MEASUREMENT.');
      return;
    }
    // Validate item rows (each row has its own quantity and unit)
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
      if (!it.unit) {
        setError(`Item #${i + 1}: Select MTR or PCS.`);
        return;
      }
      if (String(it.average ?? '').trim() !== '' && !(Number(it.average) >= 0)) {
        setError(`Item #${i + 1}: Average must be a number of zero or more.`);
        return;
      }
      if (String(it.average ?? '').trim() !== '' && !it.averageUnit) {
        setError(`Item #${i + 1}: Select MTR or PCS for the Average.`);
        return;
      }
      const unitQuantityError = quantityPairError(String(it.unitQuantity ?? ''), it.unitQuantityUnit || '', 'Unit quantity', true);
      if (unitQuantityError) {
        setError(`Item #${i + 1}: ${unitQuantityError[0].toUpperCase()}${unitQuantityError.slice(1)}.`);
        return;
      }
    }

    // Meters and pieces are totalled separately; header totals exist only for a single-unit challan.
    const lineUnit = (it: ChallanItemData) => it.unit as 'MTR' | 'PCS';
    const itemTotals = totalsByUnit(items.map((it) => ({ quantity: parseFloat(String(it.measurement)), uom: lineUnit(it) })));
    const itemUnits = Object.keys(itemTotals);
    const singleUnit = itemUnits.length === 1 ? itemUnits[0] : null;

    setLoading(true);
    try {
      const payload = {
        idempotencyKey: submissionKey,
        challanNumber: challanNumber.trim(),
        challanType: 'INTER_DEPARTMENT',
        programId: selectedProgram.id,
        fromDepartment: 'PROGRAMMING',
        toDepartment: 'STORE',
        priority,
        status: 'ISSUED',
        issuedDate: challanDate,
        fabricIn: singleUnit ? tracking.fabricIn : undefined,
        defectivePieces: tracking.defectivePieces,
        defectiveUnit: tracking.defectivePieces > 0 ? tracking.fabricUnit : undefined,
        defectiveShelfLocation: tracking.defectiveShelfLocation,
        defectReason: tracking.defectReason,
        fabricOut: singleUnit ? tracking.fabricOut : undefined,
        fabricUnit: singleUnit || undefined,
        detectedFromDepartment: 'PROGRAMMING',
        // Only what the user typed; design, serial, dates and quantities are saved in their own fields.
        remarks: remarks.trim() || undefined,
        inchargeName: inchargeName.trim() || undefined,
        items: items.map((it) => ({
          itemDescription: `${it.fabric} (${it.color})`,
          quantity: parseFloat(String(it.measurement)),
          uom: lineUnit(it),
          colour: it.color,
          fabricCode: it.fabric,
          average: String(it.average ?? '').trim() === '' ? null : Number(it.average),
          averageUnit: String(it.average ?? '').trim() === '' ? null : it.averageUnit || null,
          unitQuantity: Number(it.unitQuantity),
          unitQuantityUom: it.unitQuantityUnit || null,
          remarks: it.remarks || null,
        })),
      };

      const result = await api.createChallan(payload);
      setIssuedChallan(result);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err: any) {
      if (/challan number/i.test(err.message || '')) setChallanNumberError(err.message);
      setError(err.message || 'Failed to issue Challan.');
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 pl-0 md:pl-64 pb-20">
      {/* TOP HEADER */}
      <header className="bg-white border-b border-neutral-200/80 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-4">
          <Link
            href="/my-work"
            className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-700 block">
              PROGRAMMING DEPARTMENT · CHALLAN ISSUANCE
            </span>
            <h1 className="text-xl font-bold text-neutral-900">
              Programming → Fabric Store Challan
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/programming"
            className="px-3 py-1.5 text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-md transition"
          >
            Programming Dashboard
          </Link>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-6">
        {error && (
          <div className="p-4 bg-danger-50 border border-danger-200 rounded-xl text-xs text-danger-800 flex items-center gap-2.5 shadow-2xs">
            <AlertCircle className="w-4 h-4 text-danger-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {issuedChallan ? (
          /* CONFIRMATION CARD */
          <div className="bg-white border border-accent-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-accent-100 text-accent-800 rounded-xl flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-700 block">
                  CHALLAN ISSUED TO FABRIC STORE
                </span>
                <h2 className="text-xl font-bold text-neutral-900 mt-0.5">
                  Challan {issuedChallan.challanNumber} Successfully Dispatched
                </h2>
                <p className="text-xs text-neutral-600 mt-1">
                  The material issue order has been linked to Master Production Sheet #
                  {selectedProgram?.programSerialNo || selectedProgram?.programNumber} and queued for Fabric Store receipt.
                </p>
              </div>
            </div>

            {/* BARCODE BADGE */}
            <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl text-center space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 block">
                Official Challan Security Barcode
              </span>
              <div className="font-mono font-bold tracking-[0.3em] text-lg text-neutral-900 py-1 border-y border-dashed border-neutral-300">
                *{issuedChallan.challanNumber}*
              </div>
            </div>

            {/* VOUCHER DETAILS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-neutral-50 border border-neutral-200 rounded-lg text-xs">
              <div>
                <span className="text-neutral-500 block font-medium">Source Department</span>
                <span className="font-bold text-neutral-900">Programming Department</span>
              </div>
              <div>
                <span className="text-neutral-500 block font-medium">Destination Department</span>
                <span className="font-bold text-brand-900">Fabric Store</span>
              </div>
              <div>
                <span className="text-neutral-500 block font-medium">Production Program</span>
                <span className="font-mono font-bold text-neutral-900">
                  {selectedProgram?.programSerialNo || selectedProgram?.programNumber}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 block font-medium">Total Items</span>
                <span className="font-semibold text-neutral-700">{items.length} Items</span>
              </div>
            </div>

            <div className="pt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100">
              <Link
                href="/programming"
                className="text-xs font-semibold text-neutral-600 hover:text-neutral-900"
              >
                ← Return to Programming Dashboard
              </Link>

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/challans/${issuedChallan.id}`}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-md shadow-xs transition flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>View &amp; Print Challan</span>
                </Link>

                {selectedProgram && (
                  <button
                    type="button"
                    onClick={() => setShowSheetModal(true)}
                    className="px-3.5 py-2 bg-brand-50 hover:bg-brand-100 text-brand-900 border border-brand-300 text-xs font-bold rounded-md shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-brand-700" />
                    <span>View Production Sheet</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIssuedChallan(null);
                    setSelectedProgram(null);
                    setChallanNumber('');
                    setChallanNumberError(null);
                    setSubmissionKey(newSubmissionKey());
                    setItems([createBlankChallanItem('PROGRAMMING_STORE')]);
                    router.push('/my-work/issue-challan');
                  }}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-md shadow-xs transition cursor-pointer"
                >
                  Issue Another Challan
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleIssueChallan} className="space-y-6">
            {/* STEP 1: SELECT PRODUCTION SHEET */}
            <div className="bg-white border border-neutral-200/90 rounded-xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                <div>
                  <h2 className="text-sm font-bold text-neutral-900">Production Sheet Reference</h2>
                  <p className="text-[11px] text-neutral-500">
                    Challans must remain strictly linked to an authorized Production Sheet
                  </p>
                </div>

                <Link
                  href="/my-work/create-production-sheet"
                  className="text-xs font-semibold text-brand-700 hover:underline"
                >
                  + Create New Production Sheet
                </Link>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                  Production Sheet / Program File <span className="text-danger-600">*</span>
                </label>
                <select
                  required
                  value={selectedProgram?.id || ''}
                  onChange={(e) => {
                    const found = programs.find((p) => p.id === e.target.value);
                    if (found) handleSelectProgram(found);
                  }}
                  className="w-full px-3.5 py-2.5 border border-neutral-300 rounded-lg text-sm text-neutral-900 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30 bg-white cursor-pointer"
                >
                  <option value="">Choose a production sheet</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {[
                        p.designNumber || p.mainStyle || p.styleCode,
                        `Serial ${p.programSerialNo || p.programNumber}`,
                        p.clientName || p.buyerName,
                      ]
                        .filter(Boolean)
                        .join('   ·   ')}
                    </option>
                  ))}
                </select>
              </div>

              {selectedProgram && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 rounded-xl ring-1 ring-neutral-200 bg-white overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-neutral-200">
                  {[
                    { label: 'Production Design Number', value: selectedProgram.designNumber || selectedProgram.mainStyle || selectedProgram.styleCode },
                    { label: 'Production Serial Number', value: selectedProgram.programSerialNo || selectedProgram.programNumber },
                    { label: 'Client Name', value: selectedProgram.clientName || selectedProgram.buyerName },
                  ].map((field) => (
                    <div key={field.label} className="px-4 py-3 min-w-0">
                      <span className="block text-[11px] font-medium text-neutral-500">{field.label}</span>
                      <span className="block mt-0.5 text-sm font-semibold text-neutral-900 truncate">{field.value || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* STEP 2: CHALLAN */}
            <div className="bg-white border border-neutral-200/90 rounded-xl p-6 shadow-xs space-y-4">
              <div className="pb-3 border-b border-neutral-100">
                <h2 className="text-sm font-bold text-neutral-900">Challan</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                {/* Challan Number */}
                <ChallanNumberField
                  value={challanNumber}
                  onChange={(value) => {
                    setChallanNumber(value);
                    setChallanNumberError(null);
                  }}
                  error={challanNumberError}
                />

                {/* Challan Date */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-700 mb-1">
                    Challan Date <span className="text-danger-600">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={challanDate}
                    onChange={(e) => setChallanDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg font-medium text-neutral-900 focus:outline-none focus:ring-1 focus:ring-brand-500/40"
                  />
                </div>

                {/* Source Department */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-700 mb-1">
                    Source Department
                  </label>
                  <input
                    type="text"
                    disabled
                    value={sourceDept}
                    className="w-full px-3 py-2 bg-neutral-100 border border-neutral-200 rounded-lg font-bold text-neutral-700 cursor-not-allowed"
                  />
                </div>

                {/* Destination Department */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-700 mb-1">
                    Destination Department
                  </label>
                  <input
                    type="text"
                    disabled
                    value={destinationDept}
                    className="w-full px-3 py-2 bg-neutral-100 border border-neutral-200 rounded-lg font-bold text-brand-900 cursor-not-allowed"
                  />
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e: any) => setPriority(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg font-bold text-neutral-900 focus:outline-none focus:ring-1 focus:ring-brand-500/40"
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="URGENT">Urgent</option>
                    <option value="HIGH">Super Urgent</option>
                  </select>
                </div>

                {/* Production Design Number */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-700 mb-1">
                    Production Design Number
                  </label>
                  <input
                    type="text"
                    value={designNumber}
                    onChange={(e) => setDesignNumber(e.target.value)}
                    placeholder=""
                    className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg font-semibold text-neutral-900 focus:outline-none focus:ring-1 focus:ring-brand-500/40"
                  />
                </div>

                {/* Production Serial Number */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-700 mb-1">
                    Production Serial Number
                  </label>
                  <input
                    type="text"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    placeholder=""
                    className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg font-semibold text-neutral-900 focus:outline-none focus:ring-1 focus:ring-brand-500/40"
                  />
                </div>

                {/* Delivery Date */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-700 mb-1">
                    Delivery Date
                  </label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg text-neutral-900 focus:outline-none focus:ring-1 focus:ring-brand-500/40"
                  />
                </div>
              </div>

              {/* Department Incharge Name & Remarks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-700 mb-1">
                    Department Incharge Name
                  </label>
                  <input
                    type="text"
                    value={inchargeName}
                    onChange={(e) => setInchargeName(e.target.value)}
                    placeholder=""
                    className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg text-neutral-900 focus:outline-none focus:ring-1 focus:ring-brand-500/40"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-700 mb-1">
                    Dispatch Notes / Remarks
                  </label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder=""
                    className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg text-neutral-900 focus:outline-none focus:ring-1 focus:ring-brand-500/40"
                  />
                </div>
              </div>
            </div>

            {/* STEP 3: COLOR / FABRIC / MEASUREMENT REUSABLE TABLE WITH IN/OUT TRACKING */}
            <div className="bg-white border border-neutral-200/90 rounded-xl p-6 shadow-xs">
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
            <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4">

              <div className="flex items-center gap-3">
                <Link
                  href="/programming"
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900"
                >
                  Cancel
                </Link>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-accent-700" />
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
    <Suspense fallback={<div className="p-8 text-center text-xs text-neutral-500">Loading form...</div>}>
      <IssueChallanContent />
    </Suspense>
  );
}
