'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Send,
  Shirt,
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

function StitchingIssueChallanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedJobId = searchParams.get('jobId') || searchParams.get('sourceChallanId');

  const [loading, setLoading] = useState(false);
  const [fetchingJobs, setFetchingJobs] = useState(true);
  const [sourceJobs, setSourceJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [selectedSheetForView, setSelectedSheetForView] = useState<any | null>(null);
  const [generatedChallan, setGeneratedChallan] = useState<any | null>(null);

  const [targetDepartment, setTargetDepartment] = useState('FINISHING');
  const [priority, setPriority] = useState('NORMAL');
  const [remarks, setRemarks] = useState(
    'Assembled garments verified against Production Sheet. Transferred to Finishing Department.'
  );

  const [items, setItems] = useState([
    {
      itemDescription: 'Assembled Finished Garments - Ready for Finishing & Trimming',
      fabricCode: 'GARMENT',
      colour: 'Standard',
      quantity: '',
      uom: 'PCS',
      unitType: 'PCS',
      remarks: 'Passed end-line quality check (seam strength, SPI 10-12, fit checked).',
    },
  ]);

  useEffect(() => {
    const loadEligibleJobs = async () => {
      try {
        setFetchingJobs(true);
        const res = await fetch('/api/stitching/queue');
        if (res.ok) {
          const json = await res.json();
          const list = json.data || [];
          setSourceJobs(list);

          if (preselectedJobId) {
            const found = list.find((j: any) => j.id === preselectedJobId);
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
  }, [preselectedJobId]);

  const selectJob = (job: any) => {
    setSelectedJob(job);
    const goodQty = job.fabricOut ?? job.fabricIn ?? 0;
    setItems([
      {
        itemDescription: `Assembled Finished Garments (${job.program?.styleCode || 'Garment'} - ${job.program?.fabricName || 'Fabric'})`,
        fabricCode: 'GARMENT',
        colour: job.program?.color || 'Standard',
        quantity: String(goodQty),
        uom: 'PCS',
        unitType: 'PCS',
        remarks: 'Passed end-line quality inspection. Transferred downstream.',
      },
    ]);
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        itemDescription: 'Secondary Garment Component / Detachable Belt / Collar',
        fabricCode: 'ACCESSORY',
        colour: selectedJob?.program?.color || 'Standard',
        quantity: '',
        uom: 'PCS',
        unitType: 'PCS',
        remarks: 'Passed quality check.',
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
  const maxGoodAvailable = selectedJob ? (selectedJob.fabricOut ?? selectedJob.fabricIn ?? 0) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) {
      alert('Please select a source Stitching Job.');
      return;
    }

    if (totalQuantityToIssue <= 0) {
      alert('Please enter a valid quantity to handover.');
      return;
    }

    if (maxGoodAvailable > 0 && totalQuantityToIssue > maxGoodAvailable) {
      alert(
        `Cannot issue ${totalQuantityToIssue} garments. Maximum available unissued balance is ${maxGoodAvailable}.`
      );
      return;
    }

    try {
      setLoading(true);

      const payload = {
        parentChallanId: selectedJob.id,
        programId: selectedJob.programId,
        toDepartment: targetDepartment,
        priority,
        remarks,
        items: items.map((it) => ({
          itemDescription: it.itemDescription,
          fabricCode: it.fabricCode,
          color: it.colour,
          quantity: Number(it.quantity) || 0,
          uom: it.uom,
          notes: it.remarks,
        })),
      };

      const res = await fetch('/api/stitching/issue-challan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to issue handover challan');
      }

      setGeneratedChallan(json.data);
    } catch (err: any) {
      alert(err.message || 'Error creating handover challan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col">
      {/* HEADER HERO */}
      <div
        style={{
          backgroundImage: `linear-gradient(to right, rgba(15, 23, 42, 0.95), rgba(15, 23, 42, 0.85)), url('${DEPARTMENT_NAV_BG_IMAGE}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        className="border-b border-slate-800 p-6 shadow-md"
      >
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <Send className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white">Issue Handover Challan</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Generate official transfer Challan and printable barcode sticker for assembled garments
              </p>
            </div>
          </div>

          <Link
            href="/stitching/my-work"
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition"
          >
            &larr; Back to Workstation
          </Link>
        </div>
      </div>

      {/* FORM BODY */}
      <main className="max-w-5xl mx-auto w-full p-4 md:p-6 space-y-6 flex-1">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* SOURCE JOB SELECTOR */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Shirt className="w-4 h-4 text-indigo-400" />
              <span>1. Select Completed Stitching Job</span>
            </h3>

            {fetchingJobs ? (
              <div className="p-4 text-xs text-slate-500">Loading eligible jobs...</div>
            ) : sourceJobs.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-amber-300">
                No active jobs available in Stitching queue. Complete a stitching job first.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {sourceJobs.map((j) => {
                  const isSelected = selectedJob?.id === j.id;
                  const goodQty = j.fabricOut ?? j.fabricIn ?? 0;
                  return (
                    <div
                      key={j.id}
                      onClick={() => selectJob(j)}
                      className={`p-3 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-indigo-950/40 border-indigo-500 shadow-md'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-white">{j.challanNumber}</span>
                          <span className="text-[10px] font-bold text-indigo-400">{j.status}</span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1 truncate">
                          {j.program?.styleCode || 'Garment'} &bull; {j.program?.programNumber}
                        </p>
                      </div>

                      <div className="mt-2 pt-2 border-t border-slate-800 flex justify-between text-xs text-slate-400">
                        <span>Good Output:</span>
                        <span className="font-bold text-emerald-400">{goodQty} pcs</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* DESTINATION ROUTE & PRIORITY */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-emerald-400" />
              <span>2. Production Routing & Destination</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Target Department *</label>
                <select
                  value={targetDepartment}
                  onChange={(e) => setTargetDepartment(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-semibold"
                >
                  <option value="FINISHING">Finishing & Thread Trimming (Default Next Route)</option>
                  <option value="BUTTON_ATTACHMENT">Button & Trim Attachment</option>
                  <option value="STEAM_PRESS">Boiler Steam Pressing</option>
                  <option value="FINAL_CHECK">Final Quality Inspection</option>
                  <option value="PACKING">Folding & Packing</option>
                  <option value="FINISHED_GOODS">Finished Goods Warehouse</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1">Configured manufacturing route destination.</p>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Dispatch Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                >
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High (Urgent Order)</option>
                  <option value="URGENT">Urgent (Express Line)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Available Unissued Balance</label>
                <div className="p-2 bg-slate-950 border border-slate-700 rounded-lg text-sm font-black text-emerald-400">
                  {maxGoodAvailable} PCS
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Remarks / Dispatch Instructions</label>
              <textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
              />
            </div>
          </div>

          {/* ITEM LINE ENTRIES */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Barcode className="w-4 h-4 text-purple-400" />
                <span>3. Assembled Garments Items List</span>
              </h3>

              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item Line</span>
              </button>
            </div>

            <div className="space-y-3">
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 grid grid-cols-1 md:grid-cols-6 gap-3 text-xs items-end"
                >
                  <div className="md:col-span-2">
                    <label className="block text-slate-400 text-[11px] mb-1">Item Description *</label>
                    <input
                      type="text"
                      value={it.itemDescription}
                      onChange={(e) => handleItemChange(idx, 'itemDescription', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">Fabric Code</label>
                    <input
                      type="text"
                      value={it.fabricCode}
                      onChange={(e) => handleItemChange(idx, 'fabricCode', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">Color</label>
                    <input
                      type="text"
                      value={it.colour}
                      onChange={(e) => handleItemChange(idx, 'colour', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">Quantity *</label>
                    <input
                      type="number"
                      min="1"
                      value={it.quantity}
                      onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white font-bold"
                      required
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="block text-slate-400 text-[11px] mb-1">UOM</label>
                      <input
                        type="text"
                        value={it.uom}
                        onChange={(e) => handleItemChange(idx, 'uom', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white"
                      />
                    </div>

                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-2 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 px-1 text-xs">
              <span className="text-slate-400">Total Quantity to Dispatch:</span>
              <span className="text-sm font-black text-white">{totalQuantityToIssue} PCS</span>
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || totalQuantityToIssue <= 0}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-lg flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Generating Challan...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Issue Handover Challan to {targetDepartment}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </main>

      {/* SUCCESS MODAL WITH BARCODE CARD */}
      {generatedChallan && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0F172A] rounded-2xl border border-slate-700 shadow-2xl max-w-lg w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  Challan Issued to {generatedChallan.toDepartment} Successfully!
                </h3>
              </div>
              <button
                onClick={() => setGeneratedChallan(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Summary Details */}
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Challan Number:</span>
                <span className="font-mono font-bold text-white">{generatedChallan.challanNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Route:</span>
                <span className="font-semibold text-slate-200">
                  STITCHING &rarr; {generatedChallan.toDepartment}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Handover Quantity:</span>
                <span className="font-black text-emerald-400">
                  {totalQuantityToIssue} PCS
                </span>
              </div>
            </div>

            {/* Printable Barcode Sticker Card */}
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <BarcodeStickerCard
                params={{
                  challanNumber: generatedChallan.challanNumber,
                  designNumber: selectedJob?.program?.designNumber || 'N/A',
                  departmentName: 'Stitching & Assembly Department',
                  fromDepartment: 'STITCHING',
                  toDepartment: generatedChallan.toDepartment,
                  totalQuantity: totalQuantityToIssue,
                  uom: 'PCS',
                  date: new Date().toLocaleDateString(),
                  clientName: selectedJob?.program?.clientName || 'N/A',
                }}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Link
                href="/stitching"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold text-center transition shadow-md"
              >
                Return to Stitching Dashboard
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

export default function StitchingIssueChallanPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading handover form...</div>}>
      <StitchingIssueChallanContent />
    </Suspense>
  );
}
