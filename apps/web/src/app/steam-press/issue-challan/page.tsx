'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Send,
  Wind,
  Flame,
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
  Barcode,
} from 'lucide-react';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';
import BarcodeStickerCard from '@/components/BarcodeStickerCard';
import { ColorFabricMeasurementTable, createDepartmentInOutTracking } from '@/components/ColorFabricMeasurementTable';
import { ChallanNumberField, challanNumberClientError } from '@/components/challan/ChallanNumberField';

function SteamPressIssueChallanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedJobId = searchParams.get('jobId') || searchParams.get('sourceChallanId');

  const [loading, setLoading] = useState(false);
  const [fetchingJobs, setFetchingJobs] = useState(true);
  const [sourceJobs, setSourceJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [selectedSheetForView, setSelectedSheetForView] = useState<any | null>(null);
  const [generatedChallan, setGeneratedChallan] = useState<any | null>(null);

  const [challanNumber, setChallanNumber] = useState('');
  const [challanNumberError, setChallanNumberError] = useState<string | null>(null);
  const [targetDepartment, setTargetDepartment] = useState('FINAL_CHECK');
  const [priority, setPriority] = useState('NORMAL');
  const [remarks, setRemarks] = useState(
    'Steam pressed and moisture-extracted garments verified against Production Sheet. Transferred to Final QC.'
  );

  const [items, setItems] = useState([
    {
      itemDescription: 'Steam Pressed Garments - Ready for Final QC Inspection',
      fabricCode: 'GARMENT',
      colour: 'Standard',
      quantity: '',
      uom: 'PCS',
      unitType: 'PCS',
      remarks: 'Passed Steam Press quality audit (creases sharp, zero shine glaze, dry).',
    },
  ]);
  const [tracking, setTracking] = useState(() => createDepartmentInOutTracking('STEAM_PRESS'));

  useEffect(() => {
    const loadEligibleJobs = async () => {
      try {
        setFetchingJobs(true);
        const res = await fetch('/api/steam-press/queue');
        if (!res.ok) throw new Error('Failed to load eligible steam press jobs');
        const json = await res.json();
        const list = json.data || [];

        // Prioritize jobs that are ready for handover or completed
        const eligible = list.filter((j: any) =>
          ['READY_FOR_HANDOVER', 'COMPLETED', 'IN_PROCESS', 'RECEIVED'].includes(j.status)
        );
        setSourceJobs(eligible);

        if (preselectedJobId) {
          const match = eligible.find((j: any) => j.id === preselectedJobId);
          if (match) selectJob(match);
        } else if (eligible.length > 0) {
          selectJob(eligible[0]);
        }
      } catch (err: any) {
        console.error('Error loading eligible jobs:', err);
      } finally {
        setFetchingJobs(false);
      }
    };

    loadEligibleJobs();
  }, [preselectedJobId]);

  const selectJob = (job: any) => {
    setSelectedJob(job);
    const availableGood = job.fabricOut ?? job.fabricIn ?? 0;
    setTracking(createDepartmentInOutTracking('STEAM_PRESS', {
      fabricIn: Number(availableGood) || 0,
      fabricUnit: job.fabricUnit === 'MTR' ? 'MTR' : 'PCS',
      detectedFromDept: job.fromDepartment || null,
      detectedFromChallanId: job.id,
      detectedFromChallanNumber: job.challanNumber || null,
    }));
    setItems([
      {
        itemDescription: `${job.program?.styleCode || 'Steam Pressed'} Garments - Ready for Final QC`,
        fabricCode: 'GARMENT',
        colour: job.program?.fabricColor || 'Standard',
        quantity: availableGood > 0 ? String(availableGood) : '1',
        uom: job.fabricUnit || job.items?.[0]?.uom || 'PCS',
        unitType: job.items?.[0]?.uom || job.fabricUnit || 'PCS',
        remarks: 'Passed steam press quality audit.',
      },
    ]);
  };

  const handleItemChange = (index: number, field: string, value: string) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        itemDescription: 'Steam Pressed Garment Secondary Bundle',
        fabricCode: 'GARMENT',
        colour: 'Standard',
        quantity: '1',
        uom: prev[0]?.uom || selectedJob?.fabricUnit || selectedJob?.items?.[0]?.uom || 'PCS',
        unitType: prev[0]?.uom || selectedJob?.fabricUnit || selectedJob?.items?.[0]?.uom || 'PCS',
        remarks: 'Batch portion',
      },
    ]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const totalTransferPieces = items.reduce(
    (sum, item) => sum + (parseFloat(item.quantity) || 0),
    0
  );
  const sourceQuantityUnit = selectedJob?.fabricUnit || selectedJob?.items?.[0]?.uom || 'PCS';
  const totalTransferLabel = Object.entries(items.reduce<Record<string, number>>((totals, item) => {
    const unit = item.uom || 'PCS';
    totals[unit] = (totals[unit] || 0) + (Number(item.quantity) || 0);
    return totals;
  }, {})).map(([unit, quantity]) => `${quantity.toLocaleString()} ${unit}`).join(' + ');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) {
      alert('Please select a source job.');
      return;
    }

    const numberError = challanNumberClientError(challanNumber);
    setChallanNumberError(numberError);
    if (numberError) {
      document.getElementById('issue-challan-number')?.focus();
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

    if (totalTransferPieces <= 0) {
      alert('Total handover pieces must be greater than zero.');
      return;
    }

    const availableGood = selectedJob.fabricOut ?? selectedJob.fabricIn ?? 0;
    if (availableGood > 0 && totalTransferPieces > availableGood) {
      if (!confirm(`Warning: Transfer quantity (${totalTransferPieces}) exceeds good output (${availableGood}). Continue?`)) {
        return;
      }
    }

    try {
      setLoading(true);
      const payload = {
        challanNumber: challanNumber.trim(),
        parentChallanId: selectedJob.id,
        programId: selectedJob.programId,
        toDepartment: targetDepartment,
        ...tracking,
        fabricUnit: items[0]?.uom || tracking.fabricUnit,
        detectedFromDepartment: tracking.detectedFromDept,
        priority,
        remarks,
        items: items.map((it) => ({
          itemDescription: it.itemDescription,
          fabricCode: it.fabricCode,
          colour: it.colour,
          quantity: parseFloat(it.quantity) || 0,
          uom: it.uom || 'PCS',
          unitType: it.unitType || 'PCS',
          remarks: it.remarks,
        })),
      };

      const res = await fetch('/api/steam-press/issue-challan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        if (json.field === 'challanNumber') {
          setChallanNumberError(json.error || 'Challan Number is not valid.');
          document.getElementById('issue-challan-number')?.focus();
          return;
        }
        throw new Error(json.error || 'Failed to issue challan');
      }

      setGeneratedChallan(json.data);
      setChallanNumber('');
    } catch (err: any) {
      alert(err.message || 'Error issuing challan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen text-neutral-900 flex flex-col"
      
    >
      {/* HEADER */}
      <header className="border-b border-neutral-200 bg-white backdrop-blur-md px-6 py-4 sticky top-0 z-30 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-600 shadow-inner">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-neutral-900 flex items-center gap-2">
                Issue Handover Challan
              </h1>
              <p className="text-xs text-neutral-500">
                Generate official transfer Challan and barcode sticker for Final QC inspection
              </p>
            </div>
          </div>

          <Link
            href="/steam-press/my-work"
            className="px-3.5 py-1.5 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-700 text-xs font-semibold transition"
          >
            Workstation
          </Link>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-6">
        {generatedChallan ? (
          /* SUCCESS STATE WITH BARCODE STICKER */
          <div className="bg-white border border-accent-500/40 rounded-2xl p-8 backdrop-blur-md max-w-2xl mx-auto space-y-6 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-accent-400/10 border border-accent-500/30 rounded-2xl flex items-center justify-center text-accent-700 mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-neutral-900">Challan Issued Successfully!</h2>
              <p className="text-xs text-neutral-500">
                Official handover Challan dispatched to Final QC (`FINAL_CHECK`).
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-neutral-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-neutral-500">Challan Number:</span>
                <span className="font-mono font-bold text-brand-600">{generatedChallan.challanNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">From Department:</span>
                <span className="font-semibold text-neutral-900">Steam Press (STEAM_PRESS)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">To Department:</span>
                <span className="font-semibold text-brand-600">{generatedChallan.toDepartment || 'FINAL_CHECK'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Handover Quantity:</span>
                <span className="font-mono font-bold text-neutral-900">
                  {totalTransferLabel}
                </span>
              </div>
            </div>

            {/* Printable Barcode Sticker Card */}
            <div className="p-3 bg-white rounded-xl border border-neutral-200">
              <BarcodeStickerCard
                params={{
                  challanNumber: generatedChallan.challanNumber,
                  designNumber: selectedJob?.program?.designNumber || 'N/A',
                  departmentName: 'Steam Press Department',
                  fromDepartment: 'STEAM_PRESS',
                  toDepartment: generatedChallan.toDepartment || 'FINAL_CHECK',
                  totalQuantity: totalTransferPieces,
                  uom: items[0]?.uom || 'PCS',
                  date: new Date().toLocaleDateString('en-GB'),
                  mainStyle: selectedJob?.program?.styleCode || 'Standard',
                  programSerialNo: selectedJob?.program?.programNumber || 'N/A',
                }}
              />
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>Print Barcode Sticker</span>
              </button>
              <button
                onClick={() => {
                  setGeneratedChallan(null);
                  router.push('/steam-press/my-work');
                }}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 text-xs font-semibold rounded-xl transition"
              >
                Back to Workstation
              </button>
            </div>
          </div>
        ) : (
          /* CHALLAN CREATION FORM */
          <form onSubmit={handleSubmit} className="space-y-6">
            <ColorFabricMeasurementTable
              items={[]}
              onChange={() => {}}
              currentDepartment="STEAM_PRESS"
              programId={selectedJob?.programId}
              tracking={tracking}
              onTrackingChange={setTracking}
              trackingOnly
              showInOutController
              onSyncToItems={(fabricOut, fabricUnit) => {
                setItems((prev) => prev.map((item, index) => index === 0 ? { ...item, quantity: String(fabricOut), uom: fabricUnit, unitType: fabricUnit } : item));
              }}
            />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* SOURCE JOB SELECTION */}
              <div className="lg:col-span-1 bg-white border border-neutral-200 rounded-2xl p-5 backdrop-blur-md space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-600 block">
                  1. Select Source Job
                </span>

                {fetchingJobs ? (
                  <div className="py-12 text-center text-neutral-500 text-xs">
                    <RefreshCw className="w-6 h-6 animate-spin text-brand-600 mx-auto mb-2" />
                    <span>Loading active jobs...</span>
                  </div>
                ) : sourceJobs.length === 0 ? (
                  <div className="p-4 text-center text-neutral-500 text-xs bg-white rounded-xl border border-neutral-200">
                    No active or completed jobs ready for handover.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {sourceJobs.map((job) => {
                      const isSel = selectedJob?.id === job.id;
                      const availableGood = job.fabricOut ?? job.fabricIn ?? 0;
                      return (
                        <div
                          key={job.id}
                          onClick={() => selectJob(job)}
                          className={`p-3 rounded-xl border cursor-pointer transition text-xs space-y-1 ${
                            isSel
                              ? 'bg-brand-50 border-brand-500 ring-1 ring-brand-500'
                              : 'bg-white border-neutral-200 hover:border-neutral-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-brand-600">{job.challanNumber}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700">
                              {job.status}
                            </span>
                          </div>
                          <div className="text-neutral-500 text-[11px]">
                            Style: <span className="text-neutral-900">{job.program?.styleCode || 'Standard'}</span>
                          </div>
                          <div className="flex justify-between text-[11px] pt-1 border-t border-neutral-200 text-neutral-500">
                            <span>Available:</span>
                            <span className="font-mono font-bold text-accent-700">{availableGood} {sourceQuantityUnit}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ROUTING & DESTINATION */}
              <div className="lg:col-span-2 bg-white border border-neutral-200 rounded-2xl p-5 backdrop-blur-md space-y-5">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-600 block">
                  2. Handover Routing & Parameters
                </span>

                <ChallanNumberField
                  id="issue-challan-number"
                  className="max-w-xs"
                  value={challanNumber}
                  onChange={(value) => {
                    setChallanNumber(value);
                    if (challanNumberError) setChallanNumberError(null);
                  }}
                  error={challanNumberError}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Target Destination Department *
                    </label>
                    <select
                      value={targetDepartment}
                      onChange={(e) => setTargetDepartment(e.target.value)}
                      className="w-full px-3 py-2 bg-canvas border border-neutral-200 rounded-lg text-xs text-neutral-900 focus:outline-none focus:border-brand-500"
                    >
                      <option value="FINAL_CHECK">Final Quality Check (FINAL_CHECK)</option>
                      <option value="FINISHED_GOODS">Finished Goods Warehouse (FINISHED_GOODS)</option>
                      <option value="DISPATCH">Dispatch / Packing (DISPATCH)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Priority</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="w-full px-3 py-2 bg-canvas border border-neutral-200 rounded-lg text-xs text-neutral-900 focus:outline-none focus:border-brand-500"
                    >
                      <option value="NORMAL">Normal Priority</option>
                      <option value="HIGH">High Priority</option>
                      <option value="URGENT">Urgent Rush</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Transfer Handover Remarks
                  </label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full px-3 py-2 bg-canvas border border-neutral-200 rounded-lg text-xs text-neutral-900 focus:outline-none focus:border-brand-500"
                  />
                </div>

                {/* LINE ITEMS */}
                <div className="space-y-3 pt-2 border-t border-neutral-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-700">Handover Bundle Line Items</span>
                    <button
                      type="button"
                      onClick={addItemRow}
                      className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-brand-600 rounded text-xs flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Row</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {items.map((it, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-12 gap-2 bg-white p-2.5 rounded-xl border border-neutral-200 items-center text-xs"
                      >
                        <div className="col-span-6">
                          <input
                            type="text"
                            value={it.itemDescription}
                            onChange={(e) => handleItemChange(idx, 'itemDescription', e.target.value)}
                            placeholder="Item description"
                            className="w-full px-2 py-1 bg-white border border-neutral-200 rounded text-xs text-neutral-900"
                          />
                        </div>
                        <div className="col-span-3">
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={it.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                            placeholder={`Qty (${it.uom})`}
                            className="w-full px-2 py-1 bg-white border border-neutral-200 rounded text-xs text-neutral-900 font-mono font-bold"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="mb-1 block text-[10px] font-semibold text-neutral-500">Unit *</label>
                          <select
                            value={it.uom}
                            onChange={(e) => {
                              handleItemChange(idx, 'uom', e.target.value);
                              handleItemChange(idx, 'unitType', e.target.value);
                            }}
                            className="w-full px-2 py-1 bg-white border border-neutral-200 rounded text-xs text-neutral-900"
                            aria-label="Quantity unit"
                          >
                            <option value="MTR">MTR</option>
                            <option value="PCS">PCS</option>
                          </select>
                        </div>
                        <div className="col-span-1 flex justify-end">
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItemRow(idx)}
                              className="text-neutral-500 hover:text-danger-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between p-3 bg-brand-50 border border-brand-500/30 rounded-xl">
                    <span className="text-xs text-neutral-700">Total Handover Quantity:</span>
                    <span className="font-mono text-base font-bold text-brand-600">{totalTransferLabel}</span>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={loading || !selectedJob}
                    className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>{loading ? 'Issuing...' : 'Generate & Issue Handover Challan'}</span>
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}
      </main>

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

export default function SteamPressIssueChallanPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-canvas text-neutral-900 flex items-center justify-center">
          <RefreshCw className="w-8 h-8 animate-spin text-brand-600" />
        </div>
      }
    >
      <SteamPressIssueChallanContent />
    </Suspense>
  );
}
