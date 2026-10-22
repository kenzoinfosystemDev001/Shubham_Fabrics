'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Send,
  Scissors,
  ArrowRight,
  FileText,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Plus,
  Trash2,
  X,
  PackageCheck,
  Printer,
  Sparkles,
  Barcode,
} from 'lucide-react';
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';
import BarcodeStickerCard from '@/components/BarcodeStickerCard';
import { ColorFabricMeasurementTable, createDepartmentInOutTracking } from '@/components/ColorFabricMeasurementTable';

function RecuttingIssueChallanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedSourceId = searchParams.get('sourceChallanId');

  const [loading, setLoading] = useState(false);
  const [fetchingJobs, setFetchingJobs] = useState(true);
  const [sourceJobs, setSourceJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [selectedSheetForView, setSelectedSheetForView] = useState<any | null>(null);
  const [generatedChallan, setGeneratedChallan] = useState<any | null>(null);

  const [priority, setPriority] = useState('NORMAL');
  const [remarks, setRemarks] = useState(
    'Precision-cut embroidered panels verified against Production Sheet. Transferred to Stitching Department.'
  );

  const [items, setItems] = useState([
    {
      itemDescription: 'Verified Embroidered Cut Panels - Ready for Stitching',
      fabricCode: 'PANEL',
      colour: 'Standard',
      quantity: '',
      uom: 'PCS',
      unitType: 'PCS',
      remarks: 'Passed pre-stitching verification (seam allowance and motif symmetry checked).',
    },
  ]);
  const [tracking, setTracking] = useState(() => createDepartmentInOutTracking('RECUTTING'));

  useEffect(() => {
    const loadEligibleJobs = async () => {
      try {
        setFetchingJobs(true);
        const res = await fetch('/api/recutting/queue');
        if (res.ok) {
          const json = await res.json();
          const list = json.data || [];
          // Filter jobs that are verified or completed or ready
          setSourceJobs(list);

          if (preselectedSourceId) {
            const found = list.find((j: any) => j.id === preselectedSourceId);
            if (found) {
              selectJob(found);
            } else if (list.length > 0) {
              selectJob(list[0]);
            }
          } else if (list.length > 0) {
            selectJob(list[0]);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setFetchingJobs(false);
      }
    };
    loadEligibleJobs();
  }, [preselectedSourceId]);

  const selectJob = (job: any) => {
    setSelectedJob(job);
    const goodQty = job.fabricOut ?? job.fabricIn ?? 0;
    setTracking(createDepartmentInOutTracking('RECUTTING', {
      fabricIn: Number(goodQty) || 0,
      fabricUnit: job.fabricUnit === 'MTR' ? 'MTR' : 'PCS',
      detectedFromDept: job.fromDepartment || null,
      detectedFromChallanId: job.id,
      detectedFromChallanNumber: job.challanNumber || null,
    }));
    // auto-fill first item quantity
    setItems([
      {
        itemDescription: `Embroidered Panels (${job.program?.designNumber || 'Design'} - ${job.program?.fabricName || 'Fabric'})`,
        fabricCode: 'PANEL',
        colour: job.program?.fabricColor || 'Standard',
        quantity: String(goodQty),
        uom: job.fabricUnit || job.items?.[0]?.uom || 'PCS',
        unitType: job.fabricUnit || job.items?.[0]?.uom || 'PCS',
        remarks: 'Passed pre-stitching verification. Ready for stitching assembly.',
      },
    ]);
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        itemDescription: 'Secondary Embroidered Component / Border Panels',
        fabricCode: 'PANEL',
        colour: selectedJob?.program?.fabricColor || 'Standard',
        quantity: '',
        uom: prev[0]?.uom || selectedJob?.fabricUnit || selectedJob?.items?.[0]?.uom || 'PCS',
        unitType: prev[0]?.uom || selectedJob?.fabricUnit || selectedJob?.items?.[0]?.uom || 'PCS',
        remarks: 'Passed pre-stitching check.',
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: string) => {
    setItems((prev) => {
      const next = [...prev];
      (next[index] as any)[field] = value;
      return next;
    });
  };

  const totalQuantityToIssue = items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  const sourceQuantityUnit = selectedJob?.fabricUnit || selectedJob?.items?.[0]?.uom || 'PCS';
  const totalQuantityLabel = Object.entries(items.reduce<Record<string, number>>((totals, item) => {
    const unit = item.uom || 'PCS';
    totals[unit] = (totals[unit] || 0) + (Number(item.quantity) || 0);
    return totals;
  }, {})).map(([unit, quantity]) => `${quantity.toLocaleString()} ${unit}`).join(' + ');
  const maxGoodAvailable = selectedJob ? (selectedJob.fabricOut ?? selectedJob.fabricIn ?? 0) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) {
      alert('Please select a source Recutting Challan / Job.');
      return;
    }

    if (new Set(items.map((item) => item.uom)).size > 1) {
      alert('Use the same unit for every quantity in one challan.');
      return;
    }
    if (items[0]?.uom !== sourceQuantityUnit) {
      alert(`Quantity unit must match the source job (${sourceQuantityUnit}).`);
      return;
    }

    if (totalQuantityToIssue <= 0) {
      alert('Please enter a valid quantity to handover.');
      return;
    }

    try {
      setLoading(true);

      const payload = {
        parentChallanId: selectedJob.id,
        programId: selectedJob.programId,
        ...tracking,
        fabricUnit: items[0]?.uom || tracking.fabricUnit,
        detectedFromDepartment: tracking.detectedFromDept,
        priority,
        remarks,
        items: items.map((it) => ({
          itemDescription: it.itemDescription,
          fabricCode: it.fabricCode,
          colour: it.colour,
          quantity: Number(it.quantity) || 0,
          uom: it.uom || 'PCS',
          unitType: it.unitType || 'PCS',
          remarks: it.remarks,
        })),
      };

      const res = await fetch('/api/recutting/issue-challan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to issue challan');
      }

      setGeneratedChallan(json.data || json);
    } catch (err: any) {
      alert(`Error issuing challan: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] pb-16">
      {/* HEADER */}
      <header
        style={{
          backgroundImage: `linear-gradient(to right, rgba(15, 23, 42, 0.88), rgba(15, 23, 42, 0.72)), url('${DEPARTMENT_NAV_BG_IMAGE}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        className="border-b border-slate-700/80 sticky top-0 z-30 px-4 sm:px-8 py-4 shadow-md text-white"
      >
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                RECUTTING DISPATCH
              </span>
              <span className="text-xs text-slate-300 font-medium">
                Outgoing Handover to Stitching
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mt-1 flex items-center gap-2">
              <Send className="w-6 h-6 text-emerald-400" />
              <span>Issue Handover Challan to Stitching Department</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/recutting/my-work"
              className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>Cutting Queue</span>
            </Link>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <ColorFabricMeasurementTable
            items={[]}
            onChange={() => {}}
            currentDepartment="RECUTTING"
            programId={selectedJob?.programId}
            tracking={tracking}
            onTrackingChange={setTracking}
            trackingOnly
            showInOutController
            onSyncToItems={(fabricOut, fabricUnit) => {
              setItems((prev) => prev.map((item, index) => index === 0 ? { ...item, quantity: String(fabricOut), uom: fabricUnit, unitType: fabricUnit } : item));
            }}
          />
          {/* STEP 1: SELECT SOURCE RECUTTING JOB */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-rose-600" />
                  <span>1. Select Verified Source Job (Recutting Challan)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Traceability genealogy: Outgoing Challan will be permanently linked to this parent job.
                </p>
              </div>

              {selectedJob?.program && (
                <button
                  type="button"
                  onClick={() => setSelectedSheetForView(selectedJob.program)}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 border border-slate-200"
                >
                  <FileText className="w-3.5 h-3.5 text-sky-600" />
                  <span>View Tech Sheet</span>
                </button>
              )}
            </div>

            {fetchingJobs ? (
              <div className="p-6 text-center text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-rose-500" />
                <span className="text-xs">Loading available jobs...</span>
              </div>
            ) : sourceJobs.length === 0 ? (
              <div className="p-6 bg-slate-50 rounded-xl text-center text-slate-500 text-xs">
                No active recutting jobs available. Receive and process jobs first.
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Source Challan Number *
                </label>
                <select
                  value={selectedJob?.id || ''}
                  onChange={(e) => {
                    const found = sourceJobs.find((j) => j.id === e.target.value);
                    if (found) selectJob(found);
                  }}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-medium"
                >
                  {sourceJobs.map((j) => {
                    const good = j.fabricOut ?? j.fabricIn ?? 0;
                    return (
                      <option key={j.id} value={j.id}>
                        {j.challanNumber} — {j.program?.programNumber || 'No Program'} ({good} {j.fabricUnit || j.items?.[0]?.uom || 'PCS'} verified) [{j.status}]
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* Selected Job Specs Banner */}
            {selectedJob && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Program Sheet</span>
                  <strong className="text-slate-800 font-mono">{selectedJob.program?.programNumber || 'N/A'}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Wilcom File #</span>
                  <strong className="text-rose-700 font-mono">{selectedJob.program?.wilcomDesignNumber || 'N/A'}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Buyer / Client</span>
                  <strong className="text-slate-800">{selectedJob.program?.buyerName || selectedJob.program?.clientName || 'N/A'}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Verified Good Available</span>
                  <strong className="text-emerald-700 font-black">{maxGoodAvailable} {sourceQuantityUnit}</strong>
                </div>
              </div>
            )}
          </div>

          {/* STEP 2: DISPATCH DESTINATION & ROUTING */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2 border-b border-slate-100 pb-3">
              <Send className="w-4 h-4 text-emerald-600" />
              <span>2. Handover Routing & Priority</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">From Department</label>
                <input
                  type="text"
                  disabled
                  value="RECUTTING (Embroidery Recutting Dept)"
                  className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-100 rounded-lg text-slate-600 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">To Department *</label>
                <input
                  type="text"
                  disabled
                  value="STITCHING (Garment Stitching Dept)"
                  className="w-full px-3 py-2 text-xs border border-emerald-300 bg-emerald-50 text-emerald-800 font-bold rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-medium"
                >
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High Priority</option>
                  <option value="URGENT">Urgent / Critical</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Dispatch Remarks / Stitching Instructions
              </label>
              <textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* STEP 3: CHALLAN ITEMS & PIECES */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <PackageCheck className="w-4 h-4 text-emerald-600" />
                  <span>3. Outgoing Items & Quantities</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Specify the cut panels and components being transferred to Stitching.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition flex items-center gap-1 border border-emerald-200"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item Line</span>
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 relative group"
                >
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="absolute top-3 right-3 text-slate-400 hover:text-rose-600 p-1"
                      title="Remove Item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-6">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Item Description *
                      </label>
                      <input
                        type="text"
                        value={item.itemDescription}
                        onChange={(e) => handleItemChange(index, 'itemDescription', e.target.value)}
                        required
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Quantity *
                      </label>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                        required
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-bold text-slate-900"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Unit *
                      </label>
                      <select
                        value={item.uom}
                        onChange={(e) => {
                          handleItemChange(index, 'uom', e.target.value);
                          handleItemChange(index, 'unitType', e.target.value);
                        }}
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="MTR">MTR</option>
                        <option value="PCS">PCS</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Color / Code
                      </label>
                      <input
                        type="text"
                        value={item.colour}
                        onChange={(e) => handleItemChange(index, 'colour', e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Total Quantity & Balance Check */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500 font-medium">Total Quantity to Dispatch: </span>
                <span className="font-mono font-black text-slate-900 text-sm">
                  {totalQuantityLabel}
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Available Good: </span>
                <span className="font-mono font-bold text-emerald-700 text-sm">
                  {maxGoodAvailable.toLocaleString()} {sourceQuantityUnit}
                </span>
              </div>
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <div className="flex items-center justify-end gap-3">
            <Link
              href="/recutting"
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading || totalQuantityToIssue <= 0}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Issuing Challan...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Issue Handover Challan to Stitching</span>
                </>
              )}
            </button>
          </div>
        </form>
      </main>

      {/* SUCCESS MODAL WITH BARCODE CARD */}
      {generatedChallan && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Challan Issued to Stitching Successfully!
                </h3>
              </div>
              <button
                onClick={() => setGeneratedChallan(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Summary Details */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Challan Number:</span>
                <span className="font-mono font-bold text-slate-900">{generatedChallan.challanNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Route:</span>
                <span className="font-semibold text-slate-800">RECUTTING &rarr; STITCHING</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Handover Quantity:</span>
                <span className="font-black text-emerald-700">
                  {generatedChallan.totalQuantity || totalQuantityToIssue} {items[0]?.uom || 'PCS'}
                </span>
              </div>
            </div>

            {/* Printable Barcode Sticker Card */}
            <div className="p-3 bg-slate-100 rounded-xl border border-slate-200">
              <BarcodeStickerCard
                params={{
                  challanNumber: generatedChallan.challanNumber,
                  designNumber: selectedJob?.program?.designNumber || 'N/A',
                  departmentName: 'Embroidery Recutting Department',
                  fromDepartment: 'RECUTTING',
                  toDepartment: 'STITCHING',
                  totalQuantity: generatedChallan.totalQuantity || totalQuantityToIssue,
                  uom: items[0]?.uom || 'PCS',
                  date: new Date().toLocaleDateString(),
                  clientName: selectedJob?.program?.clientName || 'N/A',
                }}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Link
                href="/recutting"
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold text-center transition"
              >
                Return to Recutting Dashboard
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* TECH SHEET MODAL */}
      {selectedSheetForView && (
        <ProductionSheetPrintModal
          isOpen={true}
          onClose={() => setSelectedSheetForView(null)}
          program={selectedSheetForView}
        />
      )}
    </div>
  );
}

export default function RecuttingIssueChallanPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-8">
          <div className="text-center text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-rose-600" />
            <p className="text-xs font-semibold">Loading Handover Form...</p>
          </div>
        </div>
      }
    >
      <RecuttingIssueChallanContent />
    </Suspense>
  );
}
