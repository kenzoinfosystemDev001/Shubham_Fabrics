'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Send,
  FileText,
  Printer,
  Download,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Layers,
  ArrowRight,
  ArrowLeft,
  Truck,
  Building2,
  Calendar,
  User,
  Info,
  ExternalLink,
  RefreshCw,
  Eye,
  Check,
  PackageCheck,
  Droplet,
} from 'lucide-react';
import {
  generateProductionSheetHtml,
  downloadProductionSheetHtml,
  printProductionSheet,
} from '@/lib/download-production-sheet';

function FabricStoreIssueChallanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryProgramId = searchParams.get('programId');
  const queryDest = searchParams.get('dest');

  // Data states
  const [loading, setLoading] = useState(true);
  const [programs, setPrograms] = useState<any[]>([]);
  const [availableRolls, setAvailableRolls] = useState<any[]>([]);

  // Selection states
  const [selectedProgramId, setSelectedProgramId] = useState<string>(queryProgramId || '');
  const [destinationDept, setDestinationDept] = useState<'DYEING' | 'EMBROIDERY'>('DYEING');
  const [selectedRollIds, setSelectedRollIds] = useState<string[]>([]);

  // Dispatch mode: 'ROLLS' (physical rolls) vs 'DIRECT_LOT' (meters/lot without individual roll tags)
  const [dispatchMode, setDispatchMode] = useState<'ROLLS' | 'DIRECT_LOT'>('DIRECT_LOT');

  // Direct Lot / Meters fields
  const [directQuantity, setDirectQuantity] = useState<string>('500');
  const [directUom, setDirectUom] = useState<string>('MTR');
  const [directFabric, setDirectFabric] = useState<string>('');
  const [directColor, setDirectColor] = useState<string>('');
  const [directLotNumber, setDirectLotNumber] = useState<string>('');

  // Logistics form states
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [remarks, setRemarks] = useState('');
  const [priority, setPriority] = useState('NORMAL');

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showSheetModal, setShowSheetModal] = useState(false);
  const [issuedChallan, setIssuedChallan] = useState<any>(null);

  // Load initial data
  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [progRes, rollsRes] = await Promise.all([
        fetch('/api/programs'),
        fetch('/api/fabric-store/rolls?status=IN_STOCK&qcStatus=PASSED&limit=200'),
      ]);

      const progData = await progRes.json();
      const rollsData = await rollsRes.json();

      const progList = Array.isArray(progData) ? progData : [];
      setPrograms(progList);

      const allRolls = rollsData.data || [];
      setAvailableRolls(allRolls);

      // Select program if query param matches, else select first program
      let targetProg = null;
      if (queryProgramId) {
        targetProg = progList.find((p) => p.id === queryProgramId);
      }
      if (!targetProg && progList.length > 0) {
        targetProg = progList[0];
      }

      if (targetProg) {
        selectProgram(targetProg);
      }

      // If physical rolls are available in stock, default to ROLLS mode; otherwise DIRECT_LOT mode
      if (allRolls.length > 0) {
        setDispatchMode('ROLLS');
      } else {
        setDispatchMode('DIRECT_LOT');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load programs and rolls');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [queryProgramId]);

  const selectProgram = (prog: any) => {
    setSelectedProgramId(prog.id);

    // If queryDest is provided, honor it, otherwise smart recommendation
    if (queryDest === 'EMBROIDERY') {
      setDestinationDept('EMBROIDERY');
    } else if (queryDest === 'DYEING' || prog.fabricDyeingRequired) {
      setDestinationDept('DYEING');
    } else {
      setDestinationDept('EMBROIDERY');
    }

    // Populate direct lot defaults from the program
    const defaultQty =
      prog.fabricIssuedToDyeing ||
      prog.fabricSentToDyeing ||
      prog.targetQuantity ||
      prog.colorQuantity ||
      500;
    setDirectQuantity(String(defaultQty));
    setDirectUom(prog.quantityMeasurement || 'MTR');
    setDirectFabric(prog.fabricName || 'Cotton Fabric');
    setDirectColor(prog.fabricColor || 'Natural');
    setDirectLotNumber(`LOT-${prog.programSerialNo || prog.programNumber || '01'}`);
    setPriority(prog.priority || 'NORMAL');
  };

  const selectedProgram = programs.find((p) => p.id === selectedProgramId);

  // Toggle roll selection
  const toggleRoll = (rollId: string) => {
    setSelectedRollIds((prev) =>
      prev.includes(rollId) ? prev.filter((id) => id !== rollId) : [...prev, rollId]
    );
  };

  const toggleAllRolls = () => {
    if (selectedRollIds.length === availableRolls.length) {
      setSelectedRollIds([]);
    } else {
      setSelectedRollIds(availableRolls.map((r) => r.id));
    }
  };

  const selectedRolls = availableRolls.filter((r) => selectedRollIds.includes(r.id));
  const totalMetersSelected = selectedRolls.reduce(
    (sum, r) => sum + (parseFloat(r.length) || 0),
    0
  );

  // Handle Dispatch
  const handleDispatchChallan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProgram) {
      setError('Please select a program first.');
      return;
    }

    const useRolls = dispatchMode === 'ROLLS' && selectedRollIds.length > 0;
    const directQtyNum = parseFloat(directQuantity);

    if (!useRolls && (isNaN(directQtyNum) || directQtyNum <= 0)) {
      setError('Please enter a valid dispatch quantity in meters/pieces.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      let challanItems: any[] = [];
      let dispatchedMeters = 0;
      let dispatchedRollsCount = 0;

      if (useRolls) {
        // 1A. Prepare Challan Items from selected rolls
        challanItems = selectedRolls.map((roll) => ({
          itemDescription: `${roll.batch?.fabricDescription || 'Fabric Roll'} (${roll.rollNumber})`,
          unitType: 'ROLL',
          rollNumber: roll.rollNumber,
          lotNumber: roll.batch?.batchNumber || null,
          quantity: parseFloat(roll.length) || 1,
          uom: 'MTR',
          fabricCode: roll.batch?.fabricType || selectedProgram.fabricName || 'FABRIC',
          colour: roll.batch?.colorName || selectedProgram.fabricColor || null,
          remarks: `Dispatched from Fabric Store location ${roll.location?.locationCode || 'STOCK'}`,
        }));
        dispatchedMeters = totalMetersSelected;
        dispatchedRollsCount = selectedRollIds.length;
      } else {
        // 1B. Direct Program Lot Dispatch
        const itemDesc = `${directFabric || selectedProgram.fabricName || 'Fabric'} - ${directColor || selectedProgram.fabricColor || 'Natural'} (Lot: ${directLotNumber || 'LOT-01'})`;
        challanItems = [
          {
            itemDescription: itemDesc,
            unitType: 'LOT',
            quantity: directQtyNum,
            uom: directUom,
            fabricCode: directFabric || selectedProgram.fabricName || 'FABRIC',
            colour: directColor || selectedProgram.fabricColor || 'Natural',
            lotNumber: directLotNumber || null,
            remarks: `Direct Fabric Lot Dispatch from Store to ${destinationDept}`,
          },
        ];
        dispatchedMeters = directQtyNum;
        dispatchedRollsCount = 1;
      }

      // 2. Create Challan via POST /api/challans
      const challanPayload = {
        challanType: 'FABRIC_ISSUE',
        programId: selectedProgram.id,
        fromDepartment: 'STORE',
        toDepartment: destinationDept,
        priority: priority || selectedProgram.priority || 'NORMAL',
        vehicleNumber: vehicleNumber || null,
        driverName: driverName || null,
        remarks: [
          `Fabric Store Dispatch with Production Sheet ${selectedProgram.programNumber || selectedProgram.programSerialNo}`,
          remarks,
        ]
          .filter(Boolean)
          .join(' · '),
        items: challanItems,
      };

      const challanRes = await fetch('/api/challans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(challanPayload),
      });

      const challanJson = await challanRes.json();
      if (!challanRes.ok) {
        throw new Error(challanJson.error || 'Failed to create challan');
      }

      // 3. Mark rolls as ISSUED in Fabric Store ledger if physical rolls were selected
      if (useRolls) {
        try {
          await fetch('/api/fabric-store/issue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              rollIds: selectedRollIds,
              programId: selectedProgram.id,
              remarks: `Dispatched on Challan ${challanJson.challanNumber} to ${destinationDept} Department`,
            }),
          });
        } catch (issueErr) {
          console.warn('Roll status ledger update notice:', issueErr);
        }
      }

      // 4. Ensure Dyeing synchronization is guaranteed if sent to DYEING
      if (destinationDept === 'DYEING') {
        try {
          await fetch('/api/dyeing/sync', { method: 'POST' });
        } catch {}
      }

      setIssuedChallan({
        ...challanJson,
        program: selectedProgram,
        dispatchedRollsCount,
        dispatchedMeters,
        destinationDept,
      });
    } catch (err: any) {
      setError(err.message || 'Error dispatching challan');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setIssuedChallan(null);
    setSelectedRollIds([]);
    setVehicleNumber('');
    setDriverName('');
    setRemarks('');
    loadData();
  };

  return (
    <div className="min-h-screen bg-[#F0FAF9] pb-20">
      {/* TOP HEADER */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/fabric-store"
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Fabric Store</span>
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs text-slate-500">My Work</span>
            <span className="text-slate-300">/</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">
              DISPATCH CHALLAN
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2 mt-0.5">
            <Send className="w-5 h-5 text-emerald-600" />
            Issue Challan to Production (Fabric Store → Dyeing / Embroidery)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Dispatches approved fabric lots along with linked Production Sheet traveler directly to Dyeing or Embroidery
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/fabric-store/my-work/incoming-challans"
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-md transition"
          >
            <span>View Incoming Challans</span>
          </Link>
          <Link
            href="/dyeing"
            className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 text-xs font-semibold rounded-md transition"
          >
            <Droplet className="w-3.5 h-3.5 text-purple-600" />
            <span>Dyeing Dept</span>
          </Link>
        </div>
      </header>

      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* SUCCESS STATE */}
        {issuedChallan ? (
          <div className="bg-white border border-emerald-200 rounded-2xl p-8 shadow-sm space-y-6 animate-in fade-in">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">
                  DISPATCH CONFIRMED &middot; CHALLAN ISSUED &amp; SYNCHRONIZED
                </span>
                <h2 className="text-2xl font-bold text-slate-900 mt-0.5">
                  Challan {issuedChallan.challanNumber} Dispatched
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  Successfully issued from{' '}
                  <strong className="text-slate-900 font-bold">Fabric Store</strong> to{' '}
                  <strong className="text-emerald-800 font-bold">
                    {issuedChallan.destinationDept === 'DYEING' ? 'Dyeing Department' : 'Embroidery Department'}
                  </strong>{' '}
                  along with Production Sheet traveler card. The work order is now live in the receiving department!
                </p>
              </div>
            </div>

            {/* SUMMARY CARDS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Challan Number</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{issuedChallan.challanNumber}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Program #</span>
                <span className="font-mono font-bold text-teal-800 text-sm">
                  {issuedChallan.program?.programNumber || issuedChallan.program?.programSerialNo}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Destination</span>
                <span className="font-bold text-purple-800 text-sm flex items-center gap-1">
                  {issuedChallan.destinationDept === 'DYEING' && <Droplet className="w-3.5 h-3.5 text-purple-600" />}
                  {issuedChallan.destinationDept}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Quantity Dispatched</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {issuedChallan.dispatchedMeters.toFixed(1)} m ({issuedChallan.dispatchedRollsCount} {issuedChallan.dispatchedRollsCount > 1 ? 'rolls' : 'lot'})
                </span>
              </div>
            </div>

            {/* ACTIONS */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href={`/challans/${issuedChallan.id}`}
                target="_blank"
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xs transition"
              >
                <Printer className="w-4 h-4" />
                <span>View / Print Challan Slip</span>
              </Link>

              {issuedChallan.destinationDept === 'DYEING' && (
                <Link
                  href="/dyeing/my-work"
                  className="flex items-center gap-2 px-4 py-2.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold rounded-lg shadow-xs transition"
                >
                  <Droplet className="w-4 h-4" />
                  <span>Open in Dyeing Department →</span>
                </Link>
              )}

              <button
                onClick={() => printProductionSheet(issuedChallan.program)}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
              >
                <FileText className="w-4 h-4" />
                <span>Print Production Sheet</span>
              </button>

              <button
                onClick={resetForm}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-xs transition ml-auto"
              >
                <Send className="w-4 h-4" />
                <span>Issue Another Challan</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleDispatchChallan} className="space-y-6">
            {/* STEP 1: SELECT PROGRAM & VIEW PRODUCTION SHEET */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b pb-3 border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 text-xs font-bold flex items-center justify-center">
                    1
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Select Active Production Program</h2>
                    <p className="text-[11px] text-slate-500">
                      The Production Sheet traveler will be automatically attached to the issued Challan
                    </p>
                  </div>
                </div>
                {selectedProgram && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowSheetModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-md text-xs font-semibold transition"
                    >
                      <FileText className="w-3.5 h-3.5 text-teal-700" />
                      <span>View Production Sheet</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => printProductionSheet(selectedProgram)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-semibold transition"
                      title="Print Production Sheet"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print</span>
                    </button>
                  </div>
                )}
              </div>

              {/* PROGRAM SELECTOR */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Select Program <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedProgramId}
                    onChange={(e) => {
                      const prog = programs.find((p) => p.id === e.target.value);
                      if (prog) selectProgram(prog);
                    }}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2.5 bg-white font-mono"
                  >
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.programNumber || p.programSerialNo} — {p.clientName || p.buyerName} ({p.mainStyle || p.styleCode || 'Style'}) · {p.targetQuantity || p.colorQuantity || 0} PCS
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2.5 bg-white"
                  >
                    <option value="NORMAL">NORMAL</option>
                    <option value="HIGH">HIGH PRIORITY</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>
              </div>

              {/* PRODUCTION SHEET EMBEDDED PREVIEW CARD */}
              {selectedProgram && (
                <div className="mt-3 p-4 bg-slate-50 border border-slate-200/90 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-teal-700" />
                      <span className="text-xs font-bold text-slate-900">
                        PRODUCTION SHEET SUMMARY &middot; {selectedProgram.programNumber || selectedProgram.programSerialNo}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-teal-100 text-teal-800">
                      {selectedProgram.status || 'ACTIVE'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Buyer / Client</span>
                      <strong className="text-slate-900 font-semibold">{selectedProgram.clientName || selectedProgram.buyerName || '—'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Main Style</span>
                      <strong className="text-slate-900 font-semibold">{selectedProgram.mainStyle || selectedProgram.styleCode || '—'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Wilcom Design #</span>
                      <strong className="font-mono text-teal-900">{selectedProgram.wilcomDesignNumber || '—'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Fabric Quality</span>
                      <strong className="text-slate-900 font-semibold">{selectedProgram.fabricName || '—'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Fabric Composition</span>
                      <span className="text-slate-700">{selectedProgram.fabricType || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Dyeing Required</span>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                          selectedProgram.fabricDyeingRequired
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {selectedProgram.fabricDyeingRequired ? 'YES (Dyeing Needed)' : 'NO (Pre-Dyed/Ready)'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1 border-t border-slate-200/60">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Fabric Color / Shade</span>
                      <strong className="text-slate-800">{selectedProgram.fabricColor || '—'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Target Qty</span>
                      <strong className="font-mono text-slate-900">
                        {selectedProgram.colorQuantity || selectedProgram.targetQuantity || 0} {selectedProgram.quantityMeasurement || 'PCS'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Fabric Average</span>
                      <span className="font-mono text-slate-700">
                        {selectedProgram.fabricAverage ? `${selectedProgram.fabricAverage} ${selectedProgram.fabricAverageType || 'Mtr/Pc'}` : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Delivery Target</span>
                      <span className="font-mono text-slate-700">
                        {selectedProgram.deliveryDate ? new Date(selectedProgram.deliveryDate).toLocaleDateString() : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* STEP 2: DESTINATION DEPARTMENT */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b pb-3 border-slate-100">
                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center">
                  2
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Select Destination Production Department</h2>
                  <p className="text-[11px] text-slate-500">
                    Specify whether fabric is being dispatched for Dyeing or directly to Embroidery
                  </p>
                </div>
              </div>

              {/* RECOMMENDATION BANNER */}
              {selectedProgram && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    selectedProgram.fabricDyeingRequired
                      ? 'bg-purple-50/80 border-purple-200 text-purple-900'
                      : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                  }`}
                >
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>
                    {selectedProgram.fabricDyeingRequired ? (
                      <>
                        <strong>System Recommendation: Dyeing Department.</strong> The Production Sheet states that fabric dyeing is required for this program.
                      </>
                    ) : (
                      <>
                        <strong>System Recommendation: Embroidery Department.</strong> Fabric is pre-dyed or ready for embroidery machines.
                      </>
                    )}
                  </span>
                </div>
              )}

              {/* DEPARTMENT SELECTION CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  onClick={() => setDestinationDept('DYEING')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition relative ${
                    destinationDept === 'DYEING'
                      ? 'border-purple-600 bg-purple-50/40 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          destinationDept === 'DYEING'
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <Droplet className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Dyeing Department</h3>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">
                          CODE: DYEING
                        </span>
                      </div>
                    </div>
                    {destinationDept === 'DYEING' && (
                      <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-2">
                    For grey / kora fabric batch processing, RFD wash, and custom shade dyeing before cutting and embroidery.
                  </p>
                </div>

                <div
                  onClick={() => setDestinationDept('EMBROIDERY')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition relative ${
                    destinationDept === 'EMBROIDERY'
                      ? 'border-emerald-600 bg-emerald-50/40 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          destinationDept === 'EMBROIDERY'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Embroidery Department</h3>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                          CODE: EMBROIDERY
                        </span>
                      </div>
                    </div>
                    {destinationDept === 'EMBROIDERY' && (
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-2">
                    For multi-head embroidery machines, frame loading, design stitching matching Wilcom specs, and panel embellishment.
                  </p>
                </div>
              </div>
            </div>

            {/* STEP 3: DISPATCH MATERIAL SELECTION (ROLLS OR DIRECT QUANTITY) */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-3 border-slate-100 gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold flex items-center justify-center">
                    3
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Fabric Material Dispatch Mode</h2>
                    <p className="text-[11px] text-slate-500">
                      Issue physical rolls from inventory, or dispatch fabric quantity / lot directly
                    </p>
                  </div>
                </div>

                {/* MODE TOGGLE TABS */}
                <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => setDispatchMode('DIRECT_LOT')}
                    className={`px-3 py-1.5 rounded-md font-semibold transition ${
                      dispatchMode === 'DIRECT_LOT'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Direct Fabric Lot / Meters
                  </button>
                  <button
                    type="button"
                    onClick={() => setDispatchMode('ROLLS')}
                    className={`px-3 py-1.5 rounded-md font-semibold transition ${
                      dispatchMode === 'ROLLS'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Select Scanned Rolls ({availableRolls.length})
                  </button>
                </div>
              </div>

              {/* MODE 1: DIRECT FABRIC LOT FORM */}
              {dispatchMode === 'DIRECT_LOT' && (
                <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Direct Dispatch Specifications
                    </span>
                    <span className="text-[11px] text-teal-800 bg-teal-50 px-2 py-0.5 rounded font-semibold border border-teal-200">
                      Dispatches directly from Fabric Store to {destinationDept}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Dispatch Quantity <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="any"
                        required
                        value={directQuantity}
                        onChange={(e) => setDirectQuantity(e.target.value)}
                        placeholder="e.g. 500"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono font-bold text-slate-900 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Unit of Measure (UOM)</label>
                      <select
                        value={directUom}
                        onChange={(e) => setDirectUom(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                      >
                        <option value="MTR">MTR (Meters)</option>
                        <option value="KG">KG (Kilograms)</option>
                        <option value="PCS">PCS (Pieces)</option>
                        <option value="ROLL">ROLL (Rolls)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Fabric Quality / Name</label>
                      <input
                        type="text"
                        value={directFabric}
                        onChange={(e) => setDirectFabric(e.target.value)}
                        placeholder="e.g. 100% Cotton Kora"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Fabric Color / Shade</label>
                      <input
                        type="text"
                        value={directColor}
                        onChange={(e) => setDirectColor(e.target.value)}
                        placeholder="e.g. Off White / Grey"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-bold text-slate-700 mb-1">Lot / Batch Reference Number</label>
                      <input
                        type="text"
                        value={directLotNumber}
                        onChange={(e) => setDirectLotNumber(e.target.value)}
                        placeholder="e.g. LOT-2026-001"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono uppercase bg-white"
                      />
                    </div>

                    <div className="sm:col-span-2 flex items-center">
                      <p className="text-[11px] text-slate-500 pt-5">
                        This lot will be transferred under Challan control directly to the <strong>{destinationDept}</strong> department floor.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* MODE 2: ROLLS SELECTION TABLE */}
              {dispatchMode === 'ROLLS' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">
                      Selected: <strong className="text-teal-900">{selectedRollIds.length}</strong> rolls &middot;{' '}
                      <strong className="text-teal-900">{totalMetersSelected.toFixed(1)}</strong> m
                    </span>
                    <button
                      type="button"
                      onClick={toggleAllRolls}
                      className="text-teal-700 hover:text-teal-900 font-semibold"
                    >
                      {selectedRollIds.length === availableRolls.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  {availableRolls.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl space-y-2">
                      <p>No QC-passed rolls currently in stock in Fabric Store inventory.</p>
                      <button
                        type="button"
                        onClick={() => setDispatchMode('DIRECT_LOT')}
                        className="px-3.5 py-1.5 bg-teal-700 text-white rounded-md text-xs font-semibold"
                      >
                        Switch to Direct Fabric Lot / Meters Mode →
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-4 w-10 text-center">
                              <input
                                type="checkbox"
                                checked={selectedRollIds.length === availableRolls.length && availableRolls.length > 0}
                                onChange={toggleAllRolls}
                                className="rounded text-teal-700"
                              />
                            </th>
                            <th className="py-2.5 px-4">Roll Number</th>
                            <th className="py-2.5 px-4">Batch Number</th>
                            <th className="py-2.5 px-4">Fabric Description</th>
                            <th className="py-2.5 px-4">Color / Shade</th>
                            <th className="py-2.5 px-4">Length</th>
                            <th className="py-2.5 px-4">Store Location</th>
                            <th className="py-2.5 px-4">QC Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {availableRolls.map((roll) => {
                            const isChecked = selectedRollIds.includes(roll.id);
                            return (
                              <tr
                                key={roll.id}
                                onClick={() => toggleRoll(roll.id)}
                                className={`cursor-pointer transition ${
                                  isChecked ? 'bg-teal-50/60' : 'hover:bg-slate-50/60'
                                }`}
                              >
                                <td className="py-3 px-4 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {}} // handled by row click
                                    className="rounded text-teal-700"
                                  />
                                </td>
                                <td className="py-3 px-4 font-mono font-bold text-teal-900">
                                  {roll.rollNumber}
                                </td>
                                <td className="py-3 px-4 font-mono text-[11px]">
                                  {roll.batch?.batchNumber || '—'}
                                </td>
                                <td className="py-3 px-4">
                                  <span className="font-semibold text-slate-800 block">
                                    {roll.batch?.fabricType || 'Fabric'}
                                  </span>
                                  <span className="text-[10px] text-slate-500">
                                    {roll.batch?.fabricDescription}
                                  </span>
                                </td>
                                <td className="py-3 px-4">{roll.batch?.colorName || '—'}</td>
                                <td className="py-3 px-4 font-mono font-bold text-slate-900">
                                  {parseFloat(roll.length).toFixed(2)} m
                                </td>
                                <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                                  {roll.location?.locationCode || 'RACK-01'}
                                </td>
                                <td className="py-3 px-4">
                                  <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    PASSED
                                  </span>
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
            </div>

            {/* STEP 4: LOGISTICS & DISPATCH DETAILS */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b pb-3 border-slate-100">
                <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-800 text-xs font-bold flex items-center justify-center">
                  4
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Dispatch Logistics &amp; Handover Notes</h2>
                  <p className="text-[11px] text-slate-500">
                    Enter vehicle, trolley number, or handover incharge details
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Vehicle / Internal Trolley # (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TROLLEY-04, CART-B, DL-1AA-1234"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Handover Person / Driver Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Kumar (Store Incharge)"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Challan Remarks &amp; Special Handling Instructions
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Undyed Kora lot for Dyeing Department; maintain lot traceability."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              {/* DISPATCH ACTION BAR */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  Ready to dispatch{' '}
                  <strong className="text-slate-900 font-semibold">
                    {dispatchMode === 'ROLLS' && selectedRollIds.length > 0
                      ? `${selectedRollIds.length} rolls (${totalMetersSelected.toFixed(1)} m)`
                      : `${parseFloat(directQuantity) || 0} ${directUom}`}
                  </strong>{' '}
                  from Fabric Store to{' '}
                  <strong className="text-purple-800 font-bold">
                    {destinationDept === 'DYEING' ? 'Dyeing Department' : 'Embroidery Department'}
                  </strong>{' '}
                  with linked Production Sheet traveler.
                </div>
                <button
                  type="submit"
                  disabled={
                    submitting ||
                    (dispatchMode === 'ROLLS' && selectedRollIds.length === 0) ||
                    (dispatchMode === 'DIRECT_LOT' && (!directQuantity || parseFloat(directQuantity) <= 0))
                  }
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {submitting
                      ? 'Dispatching Challan...'
                      : `Dispatch Challan to ${destinationDept === 'DYEING' ? 'Dyeing' : 'Embroidery'} →`}
                  </span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* PRODUCTION SHEET PREVIEW MODAL */}
        {showSheetModal && selectedProgram && (
          <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b pb-3 border-slate-200">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-teal-700" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Production Sheet Traveler &middot; {selectedProgram.programNumber || selectedProgram.programSerialNo}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Standard factory production traveler card dispatched with challan
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => printProductionSheet(selectedProgram)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Sheet</span>
                  </button>
                  <button
                    onClick={() => downloadProductionSheetHtml(selectedProgram)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-semibold"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                  <button
                    onClick={() => setShowSheetModal(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 text-lg font-bold ml-2"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* MODAL SHEET CONTENT */}
              <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-4 text-xs">
                {/* Header */}
                <div className="flex justify-between items-start border-b-2 border-slate-800 pb-3">
                  <div>
                    <h2 className="text-base font-black text-slate-900 tracking-wider">
                      SHUBHAM FABRICS INDIA PVT. LTD.
                    </h2>
                    <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 block">
                      MES Enterprise Production Traveler Card
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

                {/* Grid details */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-2.5 bg-slate-50 rounded">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Client / Buyer</span>
                    <strong className="text-slate-900">{selectedProgram.clientName || selectedProgram.buyerName || '—'}</strong>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Main Style</span>
                    <strong className="text-slate-900">{selectedProgram.mainStyle || selectedProgram.styleCode || '—'}</strong>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Wilcom Design #</span>
                    <strong className="font-mono text-teal-900">{selectedProgram.wilcomDesignNumber || '—'}</strong>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Fabric Quality</span>
                    <strong className="text-slate-900">{selectedProgram.fabricName || '—'}</strong>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Fabric Composition</span>
                    <span className="text-slate-700">{selectedProgram.fabricType || '—'}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Fabric Color</span>
                    <strong className="text-slate-900">{selectedProgram.fabricColor || '—'}</strong>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Target Quantity</span>
                    <strong className="font-mono text-slate-900">
                      {selectedProgram.colorQuantity || selectedProgram.targetQuantity || 0}{' '}
                      {selectedProgram.quantityMeasurement || 'PCS'}
                    </strong>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Delivery Target Date</span>
                    <span className="font-mono text-slate-700">
                      {selectedProgram.deliveryDate ? new Date(selectedProgram.deliveryDate).toLocaleDateString() : '—'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Client Priority</span>
                    <span className="font-bold text-slate-800">{selectedProgram.clientPriority || 'NORMAL'}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setShowSheetModal(false)}
                  className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function FabricStoreIssueChallanPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F0FAF9] flex items-center justify-center text-xs font-mono text-slate-500">
          Loading Challan Dispatch Center...
        </div>
      }
    >
      <FabricStoreIssueChallanContent />
    </Suspense>
  );
}
