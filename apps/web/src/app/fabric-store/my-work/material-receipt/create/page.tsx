'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  PackageCheck,
  Plus,
  Trash2,
  ArrowLeft,
  Save,
  CheckCircle,
  AlertCircle,
  Layers,
} from 'lucide-react';

interface RollRow {
  id: string;
  length: string;
  width: string;
  weight: string;
  remarks: string;
}

function CreateGRNContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const challanId = searchParams.get('challanId');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [programs, setPrograms] = useState<any[]>([]);

  // Form state
  const [supplierName, setSupplierName] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [remarks, setRemarks] = useState('');
  const [fabricType, setFabricType] = useState('KORA');
  const [fabricDescription, setFabricDescription] = useState('');
  const [colorCode, setColorCode] = useState('');
  const [colorName, setColorName] = useState('');
  const [programId, setProgramId] = useState('');

  // Dynamic rolls
  const [rolls, setRolls] = useState<RollRow[]>([
    { id: '1', length: '', width: '', weight: '', remarks: '' },
  ]);

  useEffect(() => {
    // Load active programs for linking optional program
    const fetchPrograms = async () => {
      try {
        const res = await fetch('/api/programs');
        if (res.ok) {
          const data = await res.json();
          setPrograms(Array.isArray(data) ? data : []);
        }
      } catch {}
    };
    fetchPrograms();

    // If incoming challan ID provided, prefill details
    if (challanId) {
      const fetchChallan = async () => {
        try {
          const res = await fetch(`/api/challans/${challanId}`);
          if (res.ok) {
            const ch = await res.json();
            if (ch.programId) setProgramId(ch.programId);
            if (ch.items?.[0]) {
              setFabricDescription(ch.items[0].itemDescription || '');
              if (ch.items[0].colour) setColorName(ch.items[0].colour);
            }
            setRemarks(`Received via Challan ${ch.challanNumber}`);
          }
        } catch {}
      };
      fetchChallan();
    }
  }, [challanId]);

  const addRoll = () => {
    setRolls([
      ...rolls,
      {
        id: String(Date.now() + Math.random()),
        length: '',
        width: '',
        weight: '',
        remarks: '',
      },
    ]);
  };

  const removeRoll = (index: number) => {
    if (rolls.length <= 1) return;
    setRolls(rolls.filter((_, i) => i !== index));
  };

  const updateRoll = (index: number, field: keyof RollRow, value: string) => {
    const updated = [...rolls];
    updated[index][field] = value;
    setRolls(updated);
  };

  const totalMeters = rolls.reduce((acc, r) => {
    const val = parseFloat(r.length);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  const totalWeight = rolls.reduce((acc, r) => {
    const val = parseFloat(r.weight);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!supplierName.trim()) {
      setError('Supplier Name is required.');
      return;
    }
    if (!fabricDescription.trim()) {
      setError('Fabric Description is required.');
      return;
    }

    for (let i = 0; i < rolls.length; i++) {
      const len = parseFloat(rolls[i].length);
      if (!rolls[i].length || isNaN(len) || len <= 0) {
        setError(`Roll #${i + 1} has an invalid or missing length (meters).`);
        return;
      }
    }

    try {
      setLoading(true);
      const payload = {
        supplierName,
        vehicleNumber,
        remarks,
        fabricType,
        fabricDescription,
        colorCode,
        colorName,
        programId: programId || null,
        rolls: rolls.map((r) => ({
          length: parseFloat(r.length),
          width: r.width ? parseFloat(r.width) : null,
          weight: r.weight ? parseFloat(r.weight) : null,
          remarks: r.remarks || null,
        })),
      };

      const res = await fetch('/api/fabric-store/grn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to create GRN');
      }

      setSuccess(`GRN created successfully! Number: ${json.data.grn.grnNumber}`);
      setTimeout(() => {
        router.push('/fabric-store/my-work/material-receipt');
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0FAF9] pb-16">
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-8 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/fabric-store/my-work/material-receipt"
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-700 block">
              MATERIAL RECEIPT
            </span>
            <h1 className="text-xl font-bold text-slate-900">Create Goods Receipt Note (GRN)</h1>
          </div>
        </div>
      </header>

      <main className="p-8 max-w-5xl mx-auto space-y-6">
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 text-xs font-semibold">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Supplier & Delivery Info Card */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-teal-600" />
              1. Supplier &amp; Dispatch Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Supplier Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vardhman Textiles Ltd."
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Vehicle Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. RJ-14-GA-1234"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Associated Program (Optional)
                </label>
                <select
                  value={programId}
                  onChange={(e) => setProgramId(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="">-- No Direct Program Link --</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.programNumber} ({p.clientName || p.buyerName || 'General'})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Receipt Remarks / Notes
              </label>
              <input
                type="text"
                placeholder="Gate pass number, delivery notes, or external invoice ref"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Fabric Specifications */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-teal-600" />
              2. Fabric Batch Specifications
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Fabric Type <span className="text-rose-500">*</span>
                </label>
                <select
                  value={fabricType}
                  onChange={(e) => setFabricType(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500 font-semibold"
                >
                  <option value="KORA">KORA (Undyed / Greige)</option>
                  <option value="DYED">DYED</option>
                  <option value="WOVEN">WOVEN</option>
                  <option value="BLENDED">BLENDED</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Fabric Description <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 60x60 Cambric 100% Cotton 58''"
                  value={fabricDescription}
                  onChange={(e) => setFabricDescription(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Color / Shade Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Off-White / Natural"
                  value={colorName}
                  onChange={(e) => setColorName(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>

          {/* Roll Entry Table */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">3. Individual Roll Verification</h2>
                <p className="text-[11px] text-slate-500">
                  Every roll is tracked individually and will enter PENDING QC upon GRN generation.
                </p>
              </div>
              <button
                type="button"
                onClick={addRoll}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-md text-xs font-bold transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Roll</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-16">#</th>
                    <th className="py-2.5 px-3">Length (Meters) *</th>
                    <th className="py-2.5 px-3">Width (cm)</th>
                    <th className="py-2.5 px-3">Weight (kg)</th>
                    <th className="py-2.5 px-3">Roll Remarks</th>
                    <th className="py-2.5 px-3 text-right w-16">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {rolls.map((roll, idx) => (
                    <tr key={roll.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-500">
                        {String(idx + 1).padStart(2, '0')}
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          step="0.01"
                          required
                          placeholder="e.g. 100.5"
                          value={roll.length}
                          onChange={(e) => updateRoll(idx, 'length', e.target.value)}
                          className="w-36 text-xs border border-slate-300 rounded px-2.5 py-1.5 font-mono focus:ring-1 focus:ring-teal-500"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          step="0.1"
                          placeholder="e.g. 147"
                          value={roll.width}
                          onChange={(e) => updateRoll(idx, 'width', e.target.value)}
                          className="w-28 text-xs border border-slate-300 rounded px-2.5 py-1.5 font-mono focus:ring-1 focus:ring-teal-500"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          step="0.001"
                          placeholder="e.g. 18.2"
                          value={roll.weight}
                          onChange={(e) => updateRoll(idx, 'weight', e.target.value)}
                          className="w-28 text-xs border border-slate-300 rounded px-2.5 py-1.5 font-mono focus:ring-1 focus:ring-teal-500"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          placeholder="Condition, mill mark, tag #"
                          value={roll.remarks}
                          onChange={(e) => updateRoll(idx, 'remarks', e.target.value)}
                          className="w-full text-xs border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-teal-500"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => removeRoll(idx)}
                          disabled={rolls.length <= 1}
                          className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Summary */}
            <div className="bg-teal-50/60 border border-teal-200/60 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-4 text-xs">
              <span className="font-semibold text-slate-700">
                Total Rolls: <strong className="text-teal-900 font-bold">{rolls.length}</strong>
              </span>
              <span className="font-semibold text-slate-700">
                Total Measured Length:{' '}
                <strong className="text-teal-900 font-mono font-bold">
                  {totalMeters.toFixed(2)} m
                </strong>
              </span>
              <span className="font-semibold text-slate-700">
                Total Measured Weight:{' '}
                <strong className="text-teal-900 font-mono font-bold">
                  {totalWeight.toFixed(2)} kg
                </strong>
              </span>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3">
            <Link
              href="/fabric-store/my-work/material-receipt"
              className="px-4 py-2 border border-slate-300 rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-md shadow-xs transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'Submitting GRN...' : 'Save & Generate GRN'}</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default function CreateGRNPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-[#F0FAF9] p-8 text-xs text-slate-400">Loading GRN form...</div>}>
      <CreateGRNContent />
    </React.Suspense>
  );
}

