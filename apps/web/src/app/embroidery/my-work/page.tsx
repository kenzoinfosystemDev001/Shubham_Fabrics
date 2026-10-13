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
  ArrowRight
} from 'lucide-react';
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';

interface ItemRow {
  fabricDetails: string; // Color / Fabric / Measurement (Dyed/undyed)
  colorCodeWidth: string; // Color code / Width
  quantity: number;
  uom: string;
  remarks: string;
}

export default function EmbroideryMyWorkPage() {
  const [activeWorkflow, setActiveWorkflow] = useState<'CREATE_CHALLAN' | 'PRODUCTION_SHEETS' | 'INCOMING_CHECK'>(
    'CREATE_CHALLAN'
  );

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

  // Dynamic Item Table
  const [items, setItems] = useState<ItemRow[]>([
    {
      fabricDetails: 'Dyed Cotton Satin / 58" / Embroidered Panel',
      colorCodeWidth: 'CC-BLK-04 / 58 INCH',
      quantity: 120,
      uom: 'PCS',
      remarks: 'Multi-head embroidered panel ready for thread trimming',
    },
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

  // Fetch initial next-number and active programs
  const loadInitialData = async () => {
    try {
      setLoading(true);
      // 1. Get next challan number
      const numRes = await fetch('/api/challans/next-number?department=EMBROIDERY');
      const numData = await numRes.json();
      if (numData.nextNumber) {
        setChallanNumber(numData.nextNumber.replace('CH-EMB-', 'CH-EMB-TC-'));
      } else {
        const year = new Date().getFullYear();
        setChallanNumber(`CH-EMB-TC-${year}-${String(Date.now()).slice(-5)}`);
      }

      // 2. Fetch dashboard data for programs and incoming challans
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
    } catch (err) {
      console.error('Error loading embroidery initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const applyProgramToForm = (prog: any) => {
    setSelectedProgram(prog);
    setSerialNumber(prog.programSerialNo || prog.programNumber || '');
    setDesignNumber(prog.wilcomDesignNumber || prog.embroideryDesign || 'WILCOM-DES-01');

    // Auto-populate item table with production sheet specs
    if (prog.fabricColor || prog.mainStyle) {
      setItems([
        {
          fabricDetails: `${prog.fabricColor ? 'Dyed ' + prog.fabricColor : 'Dyed / Undyed Kora'} / ${prog.mainStyle || 'Garment Panel'} / ${prog.embroideryDesignSize || 'Standard Size'}`,
          colorCodeWidth: `${prog.wilcomDesignNumber || 'WLC-01'} / Width 58"`,
          quantity: prog.targetQuantity || 100,
          uom: 'PCS',
          remarks: `Embroidery completed per sheet #${prog.programSerialNo || prog.programNumber}`,
        },
      ]);
    }
  };

  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        fabricDetails: 'Dyed / Undyed / Panel',
        colorCodeWidth: 'CC-STD / 58"',
        quantity: 50,
        uom: 'PCS',
        remarks: 'Panel stitch completed',
      },
    ]);
  };

  const removeItemRow = (idx: number) => {
    if (items.length <= 1) {
      alert('A minimum of one item must be present in the Challan.');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateItemRow = (idx: number, field: keyof ItemRow, val: any) => {
    setItems((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: val } : row))
    );
  };

  const handleSubmitChallan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challanNumber.trim()) {
      alert('Please enter a valid Challan Number.');
      return;
    }
    if (items.length === 0) {
      alert('Please add at least one item row to the Challan.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        challanNumber: challanNumber.trim(),
        challanType: 'INTER_DEPARTMENT',
        fromDepartment: 'EMBROIDERY',
        toDepartment: 'THREAD_CUTTING',
        priority: priority,
        issuedDate: challanDate,
        programId: selectedProgram?.id || serialNumber,
        remarks: `Challan from Embroidery to Thread Cutting | Design: ${designNumber} | Sheet: ${serialNumber} | Incharge: ${inchargeName}`,
        items: items.map((it) => ({
          itemDescription: it.fabricDetails,
          colour: it.fabricDetails.includes('Dyed') ? 'Dyed' : 'Undyed',
          fabricCode: it.colorCodeWidth,
          quantity: Number(it.quantity) || 1,
          uom: it.uom || 'PCS',
          remarks: it.remarks,
        })),
      };

      const res = await fetch('/api/challans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to issue challan');
      }

      setCreatedChallanModal(json);
      setSuccessMsg(`Challan ${json.challanNumber} generated successfully to Thread Cutting!`);
      setTimeout(() => setSuccessMsg(null), 5000);

      // Refresh next number for future issuance
      loadInitialData();
    } catch (err: any) {
      console.error(err);
      alert('Error creating challan: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* HEADER WITH REAL DB BACKGROUND */}
      <header
        style={{
          backgroundImage: `linear-gradient(to right, rgba(15, 23, 42, 0.88), rgba(15, 23, 42, 0.72)), url('${DEPARTMENT_NAV_BG_IMAGE}')`,
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
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setActiveWorkflow('CREATE_CHALLAN')}
              className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition ${
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
              className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition ${
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
              className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition ${
                activeWorkflow === 'INCOMING_CHECK'
                  ? 'bg-fuchsia-50/90 border-fuchsia-400 text-fuchsia-950 shadow-xs'
                  : 'bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>Checking of Incoming Challans</span>
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
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
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
                    placeholder="e.g. CH-EMB-TC-2026-00001"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-fuchsia-600 transition"
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
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-fuchsia-600 transition"
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
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-fuchsia-600 transition"
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
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-fuchsia-600 transition"
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
                    placeholder="e.g. WILCOM-DES-104"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-mono font-bold text-fuchsia-800 focus:outline-none focus:ring-2 focus:ring-fuchsia-600 transition"
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
                    placeholder="e.g. PS-2026-00042"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-fuchsia-600 transition"
                  />
                </div>
              </div>

              {/* TABLE FORM AS CLEARLY SPECIFIED WITH (add item) BUTTON */}
              <div className="space-y-3 pt-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Material / Panel Items (Table Form)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Specify dyed/undyed status, fabric measurements, color code and width.
                    </p>
                  </div>

                  {/* (add item) BUTTON */}
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
                          Color / Fabric / Measurement (Dyed/undyed) *
                        </th>
                        <th className="py-2.5 px-3">
                          Color code / width *
                        </th>
                        <th className="py-2.5 px-3 w-28">Quantity</th>
                        <th className="py-2.5 px-3 w-24">UOM</th>
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
                              value={row.fabricDetails}
                              onChange={(e) => updateItemRow(idx, 'fabricDetails', e.target.value)}
                              placeholder="e.g. Dyed Navy Cotton 58 Inch Embroidered Panel"
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-fuchsia-600"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              required
                              value={row.colorCodeWidth}
                              onChange={(e) => updateItemRow(idx, 'colorCodeWidth', e.target.value)}
                              placeholder="e.g. CC-NV-01 / 58 INCH"
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-fuchsia-600"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              min="1"
                              required
                              value={row.quantity}
                              onChange={(e) => updateItemRow(idx, 'quantity', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-fuchsia-600"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <select
                              value={row.uom}
                              onChange={(e) => updateItemRow(idx, 'uom', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-fuchsia-600"
                            >
                              <option value="PCS">PCS</option>
                              <option value="MTR">MTR</option>
                              <option value="ROLLS">ROLLS</option>
                              <option value="PANELS">PANELS</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={row.remarks}
                              onChange={(e) => updateItemRow(idx, 'remarks', e.target.value)}
                              placeholder="Trimming notes"
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-fuchsia-600"
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
                  </table>
                </div>
              </div>

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
                    placeholder="Embroidery Incharge Signature / Name"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-fuchsia-600 transition"
                  />
                </div>

                {/* Submit BUTTON */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto px-8 py-3 bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>{submitting ? 'Generating Challan...' : 'Submit Challan'}</span>
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
                  className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
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

                    <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setShowSheetDetailModal(prog)}
                        className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition text-center"
                      >
                        Inspect Sheet
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          applyProgramToForm(prog);
                          setActiveWorkflow('CREATE_CHALLAN');
                        }}
                        className="flex-1 py-1.5 px-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg text-xs font-bold shadow-2xs transition text-center"
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
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
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
                      Route ②: From Dyeing Department (QC1 PASS)
                    </h3>
                  </div>
                  <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                    {incomingChallans.filter((c) => c.fromDepartment === 'QC1' || c.fromDepartment === 'DYEING').length} Challans
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Dyed fabric processed through Dyeing and rigorously inspected by QC1 Quality Incharge before release.
                </p>
                <Link
                  href="/embroidery/incoming-challans"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 hover:text-purple-900 pt-1"
                >
                  <span>Review Dyeing QC1 Incoming Challans</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
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

      {/* POPUP MODAL: VIEW PRODUCTION SHEET DETAILS */}
      {showSheetDetailModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-3xl w-full bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden space-y-4 p-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 block">
                  Master Production Sheet Specifications
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

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <div>
                <span className="text-slate-400 text-[10px] block">Buyer Name</span>
                <strong className="text-slate-800">{showSheetDetailModal.clientName || showSheetDetailModal.buyerName || 'Standard'}</strong>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Style Code</span>
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

            <div className="p-4 bg-fuchsia-50/70 border border-fuchsia-200 rounded-xl text-xs space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-900 block">
                Wilcom Pattern &amp; Stitch Details
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-500 text-[10px] block">Description</span>
                  <strong className="text-slate-800">{showSheetDetailModal.embroideryDesign || 'Logo & Branding Stitch'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Frame Size</span>
                  <strong className="text-slate-800">{showSheetDetailModal.embroideryDesignSize || 'Standard 12x12 cm'}</strong>
                </div>
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
              <button
                type="button"
                onClick={() => {
                  applyProgramToForm(showSheetDetailModal);
                  setShowSheetDetailModal(null);
                  setActiveWorkflow('CREATE_CHALLAN');
                }}
                className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg text-xs font-bold shadow-xs"
              >
                Use This Sheet
              </button>
            </div>
          </div>
        </div>
      )}

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
              <Link
                href={`/challans/${createdChallanModal.id}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-bold shadow-xs transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>View &amp; Print Full Challan</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
