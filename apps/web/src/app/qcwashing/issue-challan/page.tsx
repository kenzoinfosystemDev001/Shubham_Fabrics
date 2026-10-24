'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Send,
  Waves,
  ArrowRight,
  FileText,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Plus,
  Trash2,
  X,
  PackageCheck
} from 'lucide-react';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';
import BarcodeStickerCard from '@/components/BarcodeStickerCard';
import { ColorFabricMeasurementTable, createDepartmentInOutTracking } from '@/components/ColorFabricMeasurementTable';
import { ChallanNumberField, newSubmissionKey } from '@/components/challan/ChallanNumberField';

export default function QCWashingIssueChallanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<any | null>(null);
  const [selectedSheetForView, setSelectedSheetForView] = useState<any | null>(null);
  const [generatedChallan, setGeneratedChallan] = useState<any | null>(null);
  const [challanNumber, setChallanNumber] = useState('');
  const [challanNumberError, setChallanNumberError] = useState<string | null>(null);
  // One key per challan form fill, so a retried or double-clicked submit cannot create two challans.
  const [submissionKey, setSubmissionKey] = useState(newSubmissionKey);
  const [toDepartment, setToDepartment] = useState('RECUTTING');
  const [priority, setPriority] = useState('NORMAL');
  const [remarks, setRemarks] = useState('QC Washing Verified & Approved pieces handover to Recutting Section for embroidery precision cutting.');
  
  const [items, setItems] = useState([
    {
      itemDescription: 'Verified Washed Pieces - Approved for Recutting',
      fabricCode: 'PIECE',
      colour: 'Standard',
      quantity: '',
      uom: 'PCS',
      unitType: 'PCS',
      remarks: 'QC Washing approved. Ready for embroidery precision cutting.',
    },
  ]);
  const [tracking, setTracking] = useState(() => createDepartmentInOutTracking('QC3'));
  const totalQuantityLabel = Object.entries(items.reduce<Record<string, number>>((totals, item) => {
    const unit = item.uom || 'PCS';
    totals[unit] = (totals[unit] || 0) + (Number(item.quantity) || 0);
    return totals;
  }, {})).map(([unit, quantity]) => `${quantity.toLocaleString()} ${unit}`).join(' + ');

  useEffect(() => {
    const init = async () => {
      try {
        const progRes = await fetch('/api/programs');
        if (progRes.ok) {
          const progJson = await progRes.json();
          const list = Array.isArray(progJson) ? progJson : progJson.data || [];
          setPrograms(list);
          if (list.length > 0) {
            setSelectedProgram(list[0]);
            setTracking(createDepartmentInOutTracking('QC3', {
              fabricIn: Number(list[0].targetQuantity) || 0,
              fabricUnit: 'PCS',
            }));
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    init();
  }, []);

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        itemDescription: 'Verified Washed Pieces - Approved for Finishing',
        fabricCode: 'PIECE',
        colour: 'Standard',
        quantity: '',
        uom: prev[0]?.uom || 'PCS',
        unitType: prev[0]?.uom || 'PCS',
        remarks: 'QC Washing approved.',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProgram) {
      alert('Please select a Production Program.');
      return;
    }
    if (new Set(items.map((item) => item.uom)).size > 1) {
      alert('Use the same unit for every quantity in one challan.');
      return;
    }

    if (!challanNumber.trim()) {
      setChallanNumberError('Challan Number is required.');
      return;
    }
    setChallanNumberError(null);

    try {
      setLoading(true);

      const payload = {
        idempotencyKey: submissionKey,
        challanNumber: challanNumber.trim(),
        challanType: 'REGULAR',
        programId: selectedProgram.id,
        fromDepartment: 'QC3',
        toDepartment,
        ...tracking,
        fabricUnit: items[0]?.uom || tracking.fabricUnit,
        detectedFromDepartment: tracking.detectedFromDept,
        priority,
        remarks,
        items: items.map((it) => ({
          ...it,
          quantity: Number(it.quantity) || 0,
        })),
      };

      const res = await fetch('/api/challans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.field === 'challanNumber') setChallanNumberError(data.error);
        throw new Error(data.error || 'Failed to issue challan');
      }

      setGeneratedChallan(data.data || data);
      setChallanNumber('');
      setSubmissionKey(newSubmissionKey());
    } catch (err: any) {
      alert(`Error issuing challan: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 pb-16">
      {/* HEADER BANNER */}
      <header
        className="bg-white border-b border-neutral-200 sticky top-0 z-30 px-4 sm:px-8 py-4 shadow-md text-neutral-900"
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-accent-400/20 text-accent-700 border border-accent-500/30">
                QC WASHING DISPATCH
              </span>
              <span className="text-xs text-neutral-700">Outgoing Transfer Gate</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-neutral-900 tracking-tight mt-1 flex items-center gap-2">
              <Send className="w-6 h-6 text-accent-700" />
              <span>Issue Handover Challan to Finishing</span>
            </h1>
            <p className="text-xs text-neutral-700 mt-0.5">
              Handover verified wash-passed garments to Finishing & Steam Pressing department.
            </p>
          </div>

          <Link
            href="/qcwashing/my-work"
            className="px-3.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 border border-neutral-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            <span>Back to Work Center</span>
          </Link>
        </div>
      </header>

      {/* MAIN FORM */}
      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs space-y-6">
          {/* 1. Header Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ChallanNumberField
              value={challanNumber}
              onChange={(value) => {
                setChallanNumber(value);
                setChallanNumberError(null);
              }}
              error={challanNumberError}
            />

            <div>
              <label className="text-xs font-bold text-neutral-700 block mb-1">To Department *</label>
              <select
                value={toDepartment}
                onChange={(e) => setToDepartment(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              >
                <option value="RECUTTING">RECUTTING (Embroidery Recutting & Panel Separation)</option>
                <option value="FINISHING">FINISHING (Finishing & Steam Pressing)</option>
                <option value="STORE">STORE (Raw Material & Fabric Store)</option>
                <option value="WASHING">WASHING (Re-wash handoff)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-700 block mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              >
                <option value="NORMAL">NORMAL</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>
          </div>

          {/* 2. Program Selection */}
          <div>
            <label className="text-xs font-bold text-neutral-700 block mb-1">
              Select Production Program / Tech Sheet *
            </label>
            <select
              value={selectedProgram?.id || ''}
              onChange={(e) => {
                const p = programs.find((x) => x.id === e.target.value);
                setSelectedProgram(p || null);
                setTracking(createDepartmentInOutTracking('QC3', {
                  fabricIn: Number(p?.targetQuantity) || 0,
                  fabricUnit: 'PCS',
                }));
              }}
              className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            >
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.programSerialNo || p.programNumber} — {p.clientName} (Style: {p.styleCode}, Fabric: {p.fabricName})
                </option>
              ))}
            </select>
          </div>

          <ColorFabricMeasurementTable
            items={[]}
            onChange={() => {}}
            currentDepartment="QC3"
            programId={selectedProgram?.id}
            tracking={tracking}
            onTrackingChange={setTracking}
            trackingOnly
            showInOutController
            onSyncToItems={(fabricOut, fabricUnit) => {
              setItems((prev) => prev.map((item, index) => index === 0 ? { ...item, quantity: String(fabricOut), uom: fabricUnit, unitType: fabricUnit } : item));
            }}
          />

          {/* 3. Items Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-900">Transfer Items & Quantities</span>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-bold flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                      Item #{idx + 1}
                    </span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-danger-600 hover:text-danger-700 p-1 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-2">
                      <label className="text-[11px] font-bold text-neutral-600 block mb-1">Description</label>
                      <input
                        type="text"
                        value={item.itemDescription}
                        onChange={(e) => handleItemChange(idx, 'itemDescription', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-300 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-neutral-600 block mb-1">Quantity *</label>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        required
                        placeholder="e.g. 500"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-300 font-mono font-bold text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-neutral-600 block mb-1">Unit *</label>
                      <select
                        value={item.uom}
                        onChange={(e) => {
                          handleItemChange(idx, 'uom', e.target.value);
                          handleItemChange(idx, 'unitType', e.target.value);
                          setTracking((prev) => ({ ...prev, fabricUnit: e.target.value as 'MTR' | 'PCS' }));
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-300 text-xs bg-white font-mono"
                      >
                        <option value="MTR">MTR</option>
                        <option value="PCS">PCS</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Remarks */}
          <div>
            <label className="text-xs font-bold text-neutral-700 block mb-1">Remarks / Quality Notes</label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-4 border-t border-neutral-200 flex items-center justify-end gap-3">
            <Link
              href="/qcwashing/my-work"
              className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>Issue & Handover to Finishing</span>
            </button>
          </div>
        </form>

        {/* SUCCESS MODAL */}
        {generatedChallan && (
          <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent-100 text-accent-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">
                    Challan Issued Successfully!
                  </h3>
                  <p className="text-xs text-neutral-500 font-mono">
                    {generatedChallan.challanNumber}
                  </p>
                </div>
              </div>

              <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-100 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-neutral-500">From:</span>
                  <span className="font-bold text-neutral-900">QC WASHING (QC3)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">To:</span>
                  <span className="font-bold text-accent-800">{generatedChallan.toDepartment}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Total Quantity:</span>
                  <span className="font-bold font-mono text-neutral-900">
                    {totalQuantityLabel}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Link
                  href="/qcwashing/my-work"
                  className="flex-1 py-2.5 bg-accent-400 hover:bg-accent-500 text-neutral-900 rounded-xl text-xs font-bold text-center transition shadow-sm"
                >
                  Return to Work Center
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
