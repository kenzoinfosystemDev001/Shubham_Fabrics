'use client';

import React, { useState, useEffect } from 'react';
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
  ShieldCheck
} from 'lucide-react';
import { api } from '@/lib/api';

function IssueChallanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProgramId = searchParams.get('programId');

  const [loading, setLoading] = useState(false);
  const [fetchingChallanNo, setFetchingChallanNo] = useState(true);
  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<any | null>(null);
  const [challanNumber, setChallanNumber] = useState('');
  const [destinationDept, setDestinationDept] = useState('STORE');
  const [itemDescription, setItemDescription] = useState('');
  const [quantity, setQuantity] = useState('500');
  const [uom, setUom] = useState('PCS');
  const [remarks, setRemarks] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [error, setError] = useState<string | null>(null);
  const [issuedChallan, setIssuedChallan] = useState<any | null>(null);

  // Load programs and next Challan number
  useEffect(() => {
    const init = async () => {
      try {
        setFetchingChallanNo(true);
        const [programsList, nextChallanRes] = await Promise.all([
          api.getPrograms().catch(() => []),
          api.getNextChallanNumber('PROGRAMMING').catch(() => ({ nextNumber: 'CH-PRG-2026-00001' })),
        ]);

        setPrograms(programsList || []);
        if (nextChallanRes?.nextNumber) {
          setChallanNumber(nextChallanRes.nextNumber);
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
    const qty = prog.colorQuantity || prog.targetQuantity || 500;
    setQuantity(String(qty));
    setUom(prog.quantityMeasurement || 'PCS');
    setPriority(prog.clientPriority || prog.priority || 'NORMAL');
    
    // Auto-compose descriptive transfer item name
    const style = prog.mainStyle || prog.styleCode || 'Garment';
    const fabric = prog.fabricName || 'Cotton Fabric';
    const color = prog.fabricColor || 'Natural';
    const wilcom = prog.wilcomDesignNumber ? ` [Wilcom: ${prog.wilcomDesignNumber}]` : '';
    setItemDescription(`${style} - ${fabric} (${color})${wilcom}`);

    // Set appropriate destination based on dyeing flag
    if (prog.fabricDyeingRequired) {
      setDestinationDept('DYEING');
    } else {
      setDestinationDept('STORE');
    }
  };

  const handleIssueChallan = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedProgram) {
      setError('Please select a valid Production Sheet before issuing a Challan.');
      return;
    }

    const qtyNum = parseFloat(quantity);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setError('Quantity must be a positive number.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        challanNumber,
        challanType: 'INTER_DEPARTMENT',
        programId: selectedProgram.id,
        fromDepartment: 'PROGRAMMING',
        toDepartment: destinationDept,
        priority,
        status: 'ISSUED',
        remarks: remarks || `Dispatched from Programming for Program ${selectedProgram.programSerialNo || selectedProgram.programNumber}`,
        items: [
          {
            itemDescription: itemDescription.trim() || `${selectedProgram.mainStyle || 'Style'} Production Lot`,
            quantity: qtyNum,
            uom,
            colour: selectedProgram.fabricColor || 'Standard',
            remarks: remarks || null,
          },
        ],
      };

      const result = await api.createChallan(payload);
      
      // Update Program status to ISSUED or IN_PRODUCTION
      await api.updateProgramStatus(selectedProgram.id, 'ISSUED').catch(() => {
        // Fallback if transition already occurred
      });

      setIssuedChallan(result);
    } catch (err: any) {
      setError(err.message || 'Failed to issue Challan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pl-64 pb-20">
      {/* TOP HEADER */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-8 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-4">
          <Link
            href="/my-work"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A66E22] block">
              MY WORK · FORM 02
            </span>
            <h1 className="text-xl font-bold text-slate-900">
              Issue Challan
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded text-xs font-mono font-bold text-blue-900">
            {challanNumber || 'CH-PRG-2026-XXXXX'}
          </div>
        </div>
      </header>

      {/* FORM BODY */}
      <main className="p-8 max-w-4xl mx-auto space-y-6">

        {/* Error notification */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* ISSUED CHALLAN RECEIPT / CONFIRMATION MODAL */}
        {issuedChallan ? (
          <div className="bg-white border-2 border-emerald-500 rounded-xl p-8 shadow-sm space-y-6 animate-fade-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                    CHALLAN SUCCESSFULLY ISSUED &amp; AUDITED
                  </span>
                  <h2 className="text-xl font-bold font-mono text-slate-900">
                    {issuedChallan.challanNumber}
                  </h2>
                </div>
              </div>

              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-xs font-semibold border border-slate-300 transition"
              >
                <Printer className="w-4 h-4" />
                <span>Print Challan Slip</span>
              </button>
            </div>

            {/* VOUCHER DETAILS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Source Department</span>
                <span className="font-bold text-slate-900">PROGRAMMING</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Destination Department</span>
                <span className="font-bold text-blue-900">{issuedChallan.toDepartment}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Production Program</span>
                <span className="font-mono font-bold text-slate-900">
                  {selectedProgram?.programSerialNo || selectedProgram?.programNumber}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Date &amp; Time</span>
                <span className="font-semibold text-slate-700">
                  {new Date().toLocaleString()}
                </span>
              </div>
            </div>

            {/* ITEMS TABLE */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Item Description</th>
                    <th className="py-2.5 px-4">Color</th>
                    <th className="py-2.5 px-4 text-right">Quantity</th>
                    <th className="py-2.5 px-4">Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  <tr>
                    <td className="py-3 px-4 font-medium">{itemDescription}</td>
                    <td className="py-3 px-4">{selectedProgram?.fabricColor || 'Natural'}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold">{quantity}</td>
                    <td className="py-3 px-4">{uom}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="pt-4 flex items-center justify-between">
              <Link
                href="/"
                className="text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                ← Return to Dashboard
              </Link>

              <button
                type="button"
                onClick={() => {
                  setIssuedChallan(null);
                  setSelectedProgram(null);
                  setItemDescription('');
                  router.push('/my-work/issue-challan');
                }}
                className="px-4 py-2 bg-[#163767] hover:bg-[#0F264A] text-white text-xs font-semibold rounded-md shadow-xs transition"
              >
                Issue Another Challan
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleIssueChallan} className="space-y-6">
            
            {/* STEP 1: SELECT PRODUCTION SHEET */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-blue-100 text-blue-900 font-bold text-xs flex items-center justify-center">
                    1
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Select Production Sheet</h2>
                    <p className="text-[11px] text-slate-500">Pick the validated Production Sheet to dispatch</p>
                  </div>
                </div>

                <Link
                  href="/my-work/create-production-sheet"
                  className="text-xs font-semibold text-blue-700 hover:underline"
                >
                  + Create New Sheet
                </Link>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Production Sheet / Program File *
                </label>
                <select
                  required
                  value={selectedProgram?.id || ''}
                  onChange={(e) => {
                    const found = programs.find((p) => p.id === e.target.value);
                    if (found) handleSelectProgram(found);
                  }}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-800"
                >
                  <option value="">-- Choose a Production Sheet --</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.programSerialNo || p.programNumber} · {p.clientName || p.buyerName} · {p.mainStyle || p.styleCode} ({p.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected Program Snapshot Box */}
              {selectedProgram && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2 mt-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {selectedProgram.programSerialNo || selectedProgram.programNumber}
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
                      <span className="text-slate-400 block text-[10px]">Fabric</span>
                      <span className="font-semibold text-slate-900">{selectedProgram.fabricName || 'Cotton'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Wilcom #</span>
                      <span className="font-mono font-bold text-purple-900">{selectedProgram.wilcomDesignNumber || 'WLC-N/A'}</span>
                    </div>
                  </div>
                  {selectedProgram.fabricDyeingRequired && (
                    <div className="mt-2 p-2 bg-rose-50 border border-rose-200 rounded text-rose-800 font-semibold text-[11px] flex items-center gap-1.5">
                      <span>• Notice: This program specifies undyed fabric requiring preliminary Dyeing. Destination default set to DYEING.</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* STEP 2: MOVEMENT & CHALLAN DETAILS */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <div className="w-6 h-6 rounded bg-emerald-100 text-emerald-900 font-bold text-xs flex items-center justify-center">
                  2
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Movement &amp; Dispatch Routing</h2>
                  <p className="text-[11px] text-slate-500">Destination department and physical transfer quantities</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Source Department
                  </label>
                  <input
                    type="text"
                    disabled
                    value="PROGRAMMING"
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded text-xs font-bold text-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Destination Department *
                  </label>
                  <select
                    required
                    value={destinationDept}
                    onChange={(e) => setDestinationDept(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs text-blue-900 font-bold focus:outline-none focus:ring-1 focus:ring-blue-800"
                  >
                    <option value="STORE">FABRIC STORE (Raw Material &amp; Inventory)</option>
                    <option value="DYEING">DYEING (Undyed / Kora Processing Unit)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Item / Work Description *
                  </label>
                  <input
                    type="text"
                    required
                    value={itemDescription}
                    onChange={(e) => setItemDescription(e.target.value)}
                    placeholder="e.g. Approved Production Sheet & Pattern Marker for Polo Shirt"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-blue-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Transfer Quantity *
                  </label>
                  <input
                    type="number"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="500"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs text-slate-900 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Unit of Measure (UOM)
                  </label>
                  <select
                    value={uom}
                    onChange={(e) => setUom(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs text-slate-800 font-medium"
                  >
                    <option value="PCS">PCS (Pieces)</option>
                    <option value="MTR">MTR (Meters)</option>
                    <option value="KG">KG (Kilograms)</option>
                    <option value="YDS">YDS (Yards)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Challan Remarks / Dispatch Notes
                  </label>
                  <textarea
                    rows={2}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Add any instructions for Fabric Store or Dyeing supervisors..."
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* AUDIT & SUBMIT BUTTON */}
            <div className="p-4 bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  This transaction will generate an immutable audit record stamped with your operator ID.
                </span>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/my-work"
                  className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-md hover:bg-slate-50 transition"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={loading || !selectedProgram}
                  className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-md shadow-sm transition flex items-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <span>Issuing Challan...</span>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Issue &amp; Dispatch Challan</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </form>
        )}

      </main>
    </div>
  );
}

export default function IssueChallanPage() {
  return (
    <React.Suspense fallback={
      <div className="min-h-screen bg-[#F8FAFC] pl-64 flex items-center justify-center text-xs text-slate-500 font-mono">
        Loading Challan Form...
      </div>
    }>
      <IssueChallanContent />
    </React.Suspense>
  );
}
