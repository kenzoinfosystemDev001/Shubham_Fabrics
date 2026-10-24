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
  Warehouse,
  ArrowRight,
  AlertTriangle,
  Archive,
  Boxes,
} from 'lucide-react';
import { DepartmentStockView } from '@/components/DepartmentStockView';
import { DepartmentDefectiveShelfWidget } from '@/components/DepartmentDefectiveShelfWidget';
import {
  ColorFabricMeasurementTable,
  ChallanItemData,
  createBlankChallanItem,
  DepartmentInOutTracking,
} from '@/components/ColorFabricMeasurementTable';
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';
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

export default function EmbroideryMyWorkPage() {
  const [activeWorkflow, setActiveWorkflow] = useState<
    'CREATE_CHALLAN' | 'PRODUCTION_SHEETS' | 'INCOMING_CHECK' | 'STOCK' | 'DEFECTIVE_SHELF'
  >('CREATE_CHALLAN');

  // Form State: "Challan from Embroidery to Thread Cutting"
  const [challanNumber, setChallanNumber] = useState('');
  const [challanDate, setChallanDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [sourceDept] = useState('Embroidery Department');
  const [destinationDept] = useState('Thread Cutting Department');
  const [priority, setPriority] = useState<'NORMAL' | 'URGENT' | 'HIGH'>('NORMAL');
  const [deliveryDate, setDeliveryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [designNumber, setDesignNumber] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [inchargeName, setInchargeName] = useState('Embroidery Incharge');

  // In / Out Tracking across departments
  const [tracking, setTracking] = useState<DepartmentInOutTracking>({
    fabricIn: 0,
    fabricOut: 0,
    fabricUnit: 'PCS',
    defectivePieces: 0,
    defectiveShelfLocation: 'DEF-SHELF-EMBROIDERY (Embroidery Station Defective Shelf)',
    defectReason: '',
    detectedFromDept: null,
    detectedFromChallanId: null,
    detectedFromChallanNumber: null,
  });
  const [embroideryDefects, setEmbroideryDefects] = useState<any[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // Universal Color / Fabric / Measurement table items (Default blank)
  const [items, setItems] = useState<ChallanItemData[]>(() => [
    createBlankChallanItem('EMBROIDERY_THREAD_CUTTING'),
  ]);

  // Modals & Data
  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<any | null>(null);
  const [showSheetPickerModal, setShowSheetPickerModal] = useState(false);
  const [showSheetDetailModal, setShowSheetDetailModal] = useState<any | null>(null);
  const [createdChallanModal, setCreatedChallanModal] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchSheet, setSearchSheet] = useState('');
  const [incomingChallans, setIncomingChallans] = useState<any[]>([]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [receivingId, setReceivingId] = useState<string | null>(null);

  // Fetch active programs (the challan number is entered manually)
  const loadInitialData = async () => {
    try {
      setLoading(true);

      // Fetch dashboard data for programs and incoming challans
      const dashRes = await fetch('/api/embroidery/dashboard');
      const dashData = await dashRes.json();
      if (dashData.data?.programs) {
        setPrograms(dashData.data.programs);
        if (dashData.data.programs.length > 0 && !selectedProgram) {
          applyProgramToForm(dashData.data.programs[0]);
        }
      }
      if (dashData.data?.challans) {
        setIncomingChallans(dashData.data.challans);
      }

      // 3. Fetch Embroidery station defective records
      const defRes = await fetch('/api/defective-shelves?department=EMBROIDERY');
      const defJson = await defRes.json();
      if (defJson.success && defJson.data?.challans) {
        setEmbroideryDefects(defJson.data.defectRecords || []);
      }
    } catch (err) {
      console.error('Error loading embroidery initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReceiveIncoming = async (ch: any) => {
    try {
      setReceivingId(ch.id);
      const res = await fetch(`/api/challans/${ch.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'RECEIVED',
          notes: 'Material received onto Embroidery floor. Floor stock updated.',
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to receive material');
      }
      setSuccessMsg(`Challan ${ch.challanNumber} received successfully! Embroidery stock updated on-hand.`);
      setTimeout(() => setSuccessMsg(null), 4500);
      await loadInitialData();
    } catch (err: any) {
      alert(err.message || 'Error receiving challan');
    } finally {
      setReceivingId(null);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const applyProgramToForm = (prog: any) => {
    setSelectedProgram(prog);
    setSerialNumber(prog.programSerialNo || prog.programNumber || '');
    setDesignNumber(prog.wilcomDesignNumber || prog.embroideryDesign || '');
    if (prog.priority) setPriority(prog.priority);
  };

  const handleSubmitChallan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProgram) {
      setFormError('Please select a Production Sheet first.');
      return;
    }
    if (!challanNumber.trim()) {
      setFormError('Please provide a Challan Number.');
      return;
    }
    if (items.length === 0) {
      setFormError('Please add at least one item to the Challan.');
      return;
    }
    if (new Set(items.map((item) => item.unit)).size > 1) {
      setFormError('Use the same unit for every quantity in one challan.');
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);

      const effectiveItems = items.map((it) => ({
        itemDescription: `${it.fabric || 'Embroidered Panel'} — ${it.color || 'Processed'}`,
        unitType: 'ROLL',
        quantity: parseFloat(String(it.measurement)) || tracking.fabricOut || 1,
        uom: it.unit || tracking.fabricUnit || 'PCS',
        fabricCode: it.fabric || selectedProgram.fabricName || 'EMB-FABRIC',
        colour: it.color || selectedProgram.fabricColor || 'Dyed',
        remarks: it.remarks || null,
      }));

      const payload = {
        challanNumber: challanNumber.trim(),
        challanType: 'INTER_DEPARTMENT',
        programId: selectedProgram.id,
        parentChallanId: tracking.detectedFromChallanId || null,
        fromDepartment: 'EMBROIDERY',
        toDepartment: 'THREAD_CUTTING',
        priority: priority || 'NORMAL',
        status: 'ISSUED',
        issuedDate: challanDate,
        fabricIn: tracking.fabricIn,
        defectivePieces: tracking.defectivePieces,
        defectiveShelfLocation: tracking.defectiveShelfLocation,
        defectReason: tracking.defectReason,
        fabricOut: tracking.fabricOut,
        fabricUnit: items[0]?.unit || tracking.fabricUnit,
        detectedFromDepartment: tracking.detectedFromDept || 'DYEING_QC',
        detectedFromChallanId: tracking.detectedFromChallanId,
        remarks: `Embroidery Handover to Thread Cutting | Design: ${designNumber} | Sheet: ${serialNumber} | Incharge: ${inchargeName} | Accounting: In: ${tracking.fabricIn} ${tracking.fabricUnit}, Defective Cut: ${tracking.defectivePieces} ${tracking.fabricUnit} (To ${tracking.defectiveShelfLocation}), Leftover Out: ${tracking.fabricOut} ${tracking.fabricUnit} (To Thread Cutting)`,
        items: effectiveItems,
      };

      const res = await fetch('/api/challans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to dispatch Challan to Thread Cutting');
      }

      setCreatedChallanModal(json);
      setChallanNumber('');
      setSuccessMsg(`Challan ${json.challanNumber} to Thread Cutting created successfully! Dispatched ${tracking.fabricOut} ${tracking.fabricUnit}.`);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      loadInitialData();
    } catch (err: any) {
      setFormError(err.message || 'Error creating challan');
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
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
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-fuchsia-400 block drop-shadow-sm">
              SHUBHAM FABRICS MES · EMBROIDERY DEPARTMENT
            </span>
            <h1 className="text-xl font-bold text-white flex items-center gap-2.5 drop-shadow-sm">
              <Scissors className="w-5 h-5 text-fuchsia-400" />
              <span>Embroidery Department · My Work</span>
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/embroidery/incoming-challans"
              className="flex items-center gap-1.5 px-3 py-2 bg-lavender-600 hover:bg-lavender-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Checking of Incoming Challans</span>
            </Link>

            <Link
              href="/embroidery"
              className="px-3 py-2 bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* TOAST ALERT */}
      {successMsg && (
        <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-4">
          <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs font-semibold flex items-center gap-2 shadow-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {/* WORKFLOW TABS ACCORDING TO HANDWRITTEN DIAGRAM:
            - Create challan to Thread Cutting (PASS)
            - See production sheet
            - Checking of Incoming Challans */}
        <div className="bg-white border border-slate-200 rounded-2xl p-2 shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            <button
              type="button"
              onClick={() => setActiveWorkflow('CREATE_CHALLAN')}
              className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                activeWorkflow === 'CREATE_CHALLAN'
                  ? 'bg-fuchsia-50/90 border-fuchsia-400 text-fuchsia-950 shadow-xs'
                  : 'bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Send className="w-4 h-4 text-fuchsia-600" />
              <span>Create Challan to Thread Cutting</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveWorkflow('PRODUCTION_SHEETS')}
              className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                activeWorkflow === 'PRODUCTION_SHEETS'
                  ? 'bg-fuchsia-50/90 border-fuchsia-400 text-fuchsia-950 shadow-xs'
                  : 'bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Eye className="w-4 h-4 text-blue-600" />
              <span>See Production Sheet</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveWorkflow('INCOMING_CHECK')}
              className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                activeWorkflow === 'INCOMING_CHECK'
                  ? 'bg-fuchsia-50/90 border-fuchsia-400 text-fuchsia-950 shadow-xs'
                  : 'bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>Checking of Incoming Challans</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveWorkflow('STOCK')}
              className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                activeWorkflow === 'STOCK'
                  ? 'bg-fuchsia-50/90 border-fuchsia-400 text-fuchsia-950 shadow-xs'
                  : 'bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Boxes className="w-4 h-4 text-purple-600" />
              <span>Embroidery Stock &amp; Balance</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveWorkflow('DEFECTIVE_SHELF')}
              className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                activeWorkflow === 'DEFECTIVE_SHELF'
                  ? 'bg-rose-50/90 border-rose-400 text-rose-950 shadow-xs'
                  : 'bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Defective Shelf (DEF-SHELF-EMBROIDERY)</span>
            </button>
          </div>
        </div>

        {/* WORKFLOW 1: CHALLAN FROM EMBROIDERY TO THREAD CUTTING (MAIN USER DRAWING) */}
        {activeWorkflow === 'CREATE_CHALLAN' && (
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
            <form onSubmit={handleSubmitChallan} className="p-6 sm:p-8 space-y-6">
              {/* TOP HEADER OF FORM WITH "Show production sheet" BUTTON */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-200 gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-fuchsia-600 block">
                    MATERIAL MOVEMENT CHALLAN
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mt-0.5">
                    <span>Challan from Embroidery to Thread Cutting</span>
                  </h2>
                </div>

                {/* (Show production sheet) BUTTON AS PROMINENTLY DRAWN */}
                <button
                  type="button"
                  onClick={() => setShowSheetPickerModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
                >
                  <Eye className="w-4 h-4" />
                  <span>(Show production sheet)</span>
                </button>
              </div>

              {/* ACTIVE PRODUCTION SHEET BANNER IF SELECTED */}
              {selectedProgram && (
                <div className="p-4 bg-teal-50/70 border border-teal-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-teal-600 text-white flex items-center justify-center font-mono font-bold text-sm shrink-0">
                      PS
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-teal-800 tracking-wider block">
                        Linked Master Production Sheet (Master Record)
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
                      View Sheet Details
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

              {/* PRIMARY FORM FIELDS CORRESPONDING EXACTLY TO HANDWRITTEN SKETCH */}
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

                {/* 3. Source (Embroidery) */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Source (Embroidery)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={sourceDept}
                    className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl font-bold text-slate-700 cursor-not-allowed"
                  />
                </div>

                {/* 4. Destination (Thread Cutting) */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Destination (Thread Cutting)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={destinationDept}
                    className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl font-bold text-fuchsia-700 cursor-not-allowed"
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
                    <option value="URGENT">Urgent (Express Line)</option>
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

              {/* UNIVERSAL COLOR / FABRIC / MEASUREMENT TABLE WITH IN/OUT AUTO-DETECTION & DEFECTIVE SHELF CONTROLLER */}
              <div className="pt-3">
                <ColorFabricMeasurementTable
                  items={items}
                  onChange={setItems}
                  context="EMBROIDERY_THREAD_CUTTING"
                  programId={selectedProgram?.id}
                  currentDepartment="EMBROIDERY"
                  tracking={tracking}
                  onTrackingChange={setTracking}
                  showInOutController={true}
                />
              </div>

              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <X className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* FOOTER: EMBROIDERY INCHARGE & SUBMIT BUTTON */}
              <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="w-full sm:w-80">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Embroidery Incharge *
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

                {/* Submit BUTTON: Active Dispatch to Thread Cutting */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto px-6 py-3 bg-fuchsia-700 hover:bg-fuchsia-800 disabled:opacity-50 active:scale-98 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition"
                  title="Issue Challan and dispatch verified leftover pieces to Thread Cutting"
                >
                  {submitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-fuchsia-200" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>
                    {submitting
                      ? 'Dispatching Challan…'
                      : `Dispatch to Thread Cutting (${tracking.fabricOut} ${tracking.fabricUnit})`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* WORKFLOW 2: SEE PRODUCTION SHEET */}
        {activeWorkflow === 'PRODUCTION_SHEETS' && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-600 block">
                  MASTER RECORDS ARCHIVE (RULE 1)
                </span>
                <h2 className="text-lg font-bold text-slate-900">
                  Active Production Sheets for Embroidery
                </h2>
              </div>

              <div className="relative w-full sm:w-80">
                <input
                  type="text"
                  value={searchSheet}
                  onChange={(e) => setSearchSheet(e.target.value)}
                  placeholder="Search Sheet Serial, Buyer, Style..."
                  className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-lavender-600"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {programs
                .filter((p) => {
                  const q = searchSheet.toLowerCase();
                  const s = (p.programSerialNo || '').toLowerCase();
                  const n = (p.programNumber || '').toLowerCase();
                  const b = (p.clientName || p.buyerName || '').toLowerCase();
                  const st = (p.mainStyle || '').toLowerCase();
                  const w = (p.wilcomDesignNumber || '').toLowerCase();
                  return s.includes(q) || n.includes(q) || b.includes(q) || st.includes(q) || w.includes(q);
                })
                .map((prog) => (
                  <div
                    key={prog.id}
                    className="p-5 border border-slate-200 rounded-2xl bg-white hover:border-teal-400 hover:shadow-xs transition space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-teal-900 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md">
                        {prog.programSerialNo || prog.programNumber}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-slate-500">
                        {prog.status || 'ACTIVE'}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        {prog.clientName || prog.buyerName || 'Standard Buyer'}
                      </h4>
                      <p className="text-xs text-slate-600 font-medium">Style: {prog.mainStyle || 'Standard'}</p>
                    </div>

                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-400 text-[10px]">Wilcom #</span>
                        <strong className="font-mono text-fuchsia-700">{prog.wilcomDesignNumber || 'WLC-STD'}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 text-[10px]">Embroidery Size</span>
                        <strong className="text-slate-700">{prog.embroideryDesignSize || 'Standard 12x12'}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 text-[10px]">Target Qty</span>
                        <strong className="font-mono text-slate-800">{prog.targetQuantity || 0} PCS</strong>
                      </div>
                    </div>

                    <div className="pt-2 flex flex-col gap-1.5 border-t border-slate-100">
                      <DocumentActionButtons program={prog} size="xs" className="w-full justify-between" />
                      <button
                        type="button"
                        onClick={() => {
                          applyProgramToForm(prog);
                          setActiveWorkflow('CREATE_CHALLAN');
                        }}
                        className="w-full py-1.5 px-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg text-xs font-bold shadow-2xs transition text-center"
                      >
                        Use in Challan
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* WORKFLOW 3: CHECKING OF INCOMING CHALLANS (OVERVIEW) */}
        {activeWorkflow === 'INCOMING_CHECK' && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600 block">
                  RECEIVING VERIFICATION
                </span>
                <h2 className="text-lg font-bold text-slate-900">
                  Checking of Incoming Challans Overview
                </h2>
              </div>

              <Link
                href="/embroidery/incoming-challans"
                className="inline-flex items-center gap-2 px-4 py-2 bg-lavender-600 hover:bg-lavender-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
              >
                <span>Open Full Incoming Verification Console</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 border border-blue-200 bg-blue-50/50 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Warehouse className="w-5 h-5 text-blue-700" />
                    <h3 className="text-sm font-bold text-blue-950 uppercase tracking-wide">
                      Route ①: From Fabric Store (Undyed)
                    </h3>
                  </div>
                  <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    {incomingChallans.filter((c) => c.fromDepartment === 'STORE').length} Challans
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Raw / Greige Kora fabric rolls delivered straight from raw fabric warehouse for direct embroidery.
                </p>
                <Link
                  href="/embroidery/incoming-challans"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 pt-1"
                >
                  <span>Review Store Incoming Challans</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="p-5 border border-purple-200 bg-purple-50/50 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-purple-700" />
                    <h3 className="text-sm font-bold text-purple-950 uppercase tracking-wide">
                      Route ②: From Dyeing Department (Dyeing QC PASS)
                    </h3>
                  </div>
                  <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                    {incomingChallans.filter((c) => c.fromDepartment === 'DYEING_QC' || c.fromDepartment === 'DYEING').length} Challans
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Dyed fabric processed through Dyeing and rigorously inspected by Dyeing QC Quality Incharge before release.
                </p>
                <Link
                  href="/embroidery/incoming-challans"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 hover:text-purple-900 pt-1"
                >
                  <span>Review Dyeing QC Incoming Challans</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* LIVE INCOMING CHALLANS TABLE WITH RECEIVE ACTIONS */}
            <div className="pt-2 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Incoming Lots Addressed to Embroidery
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Click <strong>Receive Material</strong> to officially accept into Embroidery floor stock and material balance.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-slate-600">
                  {incomingChallans.length} Challan{incomingChallans.length === 1 ? '' : 's'}
                </span>
              </div>

              {incomingChallans.length === 0 ? (
                <div className="p-12 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50 space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700">No incoming challans pending receipt</p>
                  <p className="text-[11px] text-slate-400">
                    Challans issued from Fabric Store or Dyeing QC to Embroidery will appear here automatically.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Challan #</th>
                        <th className="py-2.5 px-3">From Station</th>
                        <th className="py-2.5 px-3">Program / Style</th>
                        <th className="py-2.5 px-3">Fabric &amp; Color</th>
                        <th className="py-2.5 px-3 text-right">Quantity</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {incomingChallans.map((ch) => {
                        const totalQty = (ch.items || []).reduce(
                          (sum: number, it: any) => sum + (Number(it.quantity) || 0),
                          0
                        );
                        const effectiveQty = Number(ch.fabricIn) || totalQty || ch.program?.targetQuantity || 0;
                        const isReceived = ['RECEIVED', 'IN_PROCESS', 'COMPLETED'].includes(ch.status);

                        return (
                          <tr key={ch.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-3 px-3 font-mono">
                              <span className="font-bold text-slate-900 block">{ch.challanNumber}</span>
                              <span className="text-[10px] text-slate-500 font-sans">
                                {new Date(ch.issuedDate || ch.createdAt).toLocaleDateString('en-GB')}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                                {ch.fromDepartment}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-semibold text-slate-800 block">
                                {ch.program?.clientName || ch.program?.buyerName || 'Standard'}
                              </span>
                              <span className="text-[10px] text-slate-500 block">
                                Style: {ch.program?.mainStyle || ch.program?.styleCode || '—'} · Sheet #{ch.program?.programSerialNo || ch.program?.programNumber || '—'}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-medium text-slate-800 block">
                                {ch.items?.[0]?.itemDescription || ch.program?.fabricName || 'Fabric Lot'}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {ch.items?.[0]?.colour || ch.program?.fabricColor || 'Standard'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                              {effectiveQty} {ch.fabricUnit || ch.items?.[0]?.uom || 'PCS'}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {isReceived ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>{ch.status}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                                  <span>Pending Receipt</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex flex-col items-end gap-1.5">
                                {/* WORKFLOW ACTION */}
                                <div className="flex items-center gap-1.5">
                                  {!isReceived ? (
                                    <button
                                      type="button"
                                      disabled={receivingId === ch.id}
                                      onClick={() => handleReceiveIncoming(ch)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-lavender-600 hover:bg-lavender-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
                                      title="Receive material and book onto Embroidery floor stock"
                                    >
                                      {receivingId === ch.id ? (
                                        <>
                                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                          <span>Receiving...</span>
                                        </>
                                      ) : (
                                        <>
                                          <CheckCircle2 className="w-3.5 h-3.5" />
                                          <span>Receive &amp; Accept</span>
                                        </>
                                      )}
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (ch.program) applyProgramToForm(ch.program);
                                        setActiveWorkflow('CREATE_CHALLAN');
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
                                      title="Use this received lot in a new Challan to Thread Cutting"
                                    >
                                      <Send className="w-3 h-3" />
                                      <span>To Thread Cutting</span>
                                    </button>
                                  )}
                                </div>

                                {/* COMPLETE DOCUMENT ACTIONS: PRODUCTION SHEET, CHALLAN & WILCOM */}
                                <DocumentActionButtons program={ch.program} challan={ch} size="xs" />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* WORKFLOW 4: EMBROIDERY DEFECTIVE SHELF (DEF-SHELF-EMBROIDERY) */}
        {activeWorkflow === 'DEFECTIVE_SHELF' && (
          <DepartmentDefectiveShelfWidget
            department="EMBROIDERY"
            shelfCode="DEF-SHELF-EMBROIDERY"
            accentColor="fuchsia"
          />
        )}

        {/* WORKFLOW 5: EMBROIDERY DEPARTMENT STOCK & MATERIAL BALANCE */}
        {activeWorkflow === 'STOCK' && (
          <DepartmentStockView
            department="EMBROIDERY"
            createChallanUrl="/embroidery/my-work"
          />
        )}
      </main>

      {/* POPUP MODAL: "Show production sheet" SELECTION */}
      {showSheetPickerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden space-y-4 p-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 block">
                  Select Master Record (Rule 1)
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  Show Production Sheet for Embroidery
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
              Select an active Production Sheet to automatically populate Design Number, Serial Number, and Material Item measurements.
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

      {/* POPUP MODAL: PRODUCTION SHEET TRAVELER (MOVES ALONG WITH CHALLAN) */}
      <ProductionSheetPrintModal
        program={showSheetDetailModal}
        isOpen={!!showSheetDetailModal}
        onClose={() => setShowSheetDetailModal(null)}
      />

      {/* POPUP MODAL: CHALLAN CREATED SUCCESSFULLY WITH BARCODE & PRINT (RULE 2) */}
      {createdChallanModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden space-y-5 p-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Challan Issued Successfully!
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
                Challan Receipt Confirmed (Rule 2)
              </span>
              <div className="grid grid-cols-2 gap-2 text-slate-800">
                <div>
                  <span className="text-slate-500 text-[10px] block">Challan Number</span>
                  <strong className="font-mono text-sm text-slate-900">{createdChallanModal.challanNumber}</strong>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Destination</span>
                  <strong className="text-slate-900">Thread Cutting Department</strong>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Design Number</span>
                  <strong className="font-mono text-fuchsia-700">{designNumber}</strong>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Total Items Transferred</span>
                  <strong className="text-slate-900">{items.length} Items</strong>
                </div>
              </div>
            </div>

            {/* BARCODE PREVIEW (RULE 2) */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
                Security Barcode Identification
              </span>
              <div className="font-mono font-bold tracking-[0.3em] text-lg text-slate-800 py-2 border-y border-dashed border-slate-300">
                *{createdChallanModal.challanNumber}*
              </div>
              <span className="text-[10px] text-slate-500">
                Scan barcode at Thread Cutting receipt terminal to acknowledge.
              </span>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setCreatedChallanModal(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Create Another Challan
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
              {selectedProgram && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowSheetDetailModal(selectedProgram)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-300 rounded-lg text-xs font-bold transition"
                  >
                    <FileText className="w-3.5 h-3.5 text-teal-700" />
                    <span>View Production Sheet</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadProductionSheetHtml(selectedProgram)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 rounded-lg text-xs font-bold transition"
                  >
                    <Download className="w-3.5 h-3.5 text-sky-700" />
                    <span>Download Sheet</span>
                  </button>
                </>
              )}
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

      {/* PRODUCTION SHEET PRINT / TRAVELER MODAL */}
      {showSheetDetailModal && (
        <ProductionSheetPrintModal
          isOpen={true}
          onClose={() => setShowSheetDetailModal(null)}
          program={showSheetDetailModal}
        />
      )}
    </div>
  );
}
