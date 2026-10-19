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
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';
import BarcodeStickerCard from '@/components/BarcodeStickerCard';

export default function QCWashingIssueChallanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<any | null>(null);
  const [selectedSheetForView, setSelectedSheetForView] = useState<any | null>(null);
  const [generatedChallan, setGeneratedChallan] = useState<any | null>(null);
  const [challanNumber, setChallanNumber] = useState('');
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

  useEffect(() => {
    const init = async () => {
      try {
        const [numRes, progRes] = await Promise.all([
          fetch('/api/challans/next-number?department=QC3'),
          fetch('/api/programs'),
        ]);
        if (numRes.ok) {
          const numJson = await numRes.json();
          setChallanNumber(numJson.nextNumber);
        }
        if (progRes.ok) {
          const progJson = await progRes.json();
          const list = Array.isArray(progJson) ? progJson : progJson.data || [];
          setPrograms(list);
          if (list.length > 0) setSelectedProgram(list[0]);
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
        uom: 'PCS',
        unitType: 'PCS',
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

    try {
      setLoading(true);

      const payload = {
        challanNumber,
        challanType: 'REGULAR',
        programId: selectedProgram.id,
        fromDepartment: 'QC3',
        toDepartment,
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
        throw new Error(data.error || 'Failed to issue challan');
      }

      setGeneratedChallan(data.data || data);
    } catch (err: any) {
      alert(`Error issuing challan: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] pb-16">
      {/* HEADER BANNER */}
      <header
        style={{
          backgroundImage: `linear-gradient(to right, rgba(15, 23, 42, 0.88), rgba(15, 23, 42, 0.72)), url('${DEPARTMENT_NAV_BG_IMAGE}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        className="border-b border-slate-700/80 sticky top-0 z-30 px-4 sm:px-8 py-4 shadow-md text-white"
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                QC WASHING DISPATCH
              </span>
              <span className="text-xs text-slate-300">Outgoing Transfer Gate</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mt-1 flex items-center gap-2">
              <Send className="w-6 h-6 text-emerald-400" />
              <span>Issue Handover Challan to Finishing</span>
            </h1>
            <p className="text-xs text-slate-300 mt-0.5">
              Handover verified wash-passed garments to Finishing & Steam Pressing department.
            </p>
          </div>

          <Link
            href="/qcwashing/my-work"
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            <span>Back to Work Center</span>
          </Link>
        </div>
      </header>

      {/* MAIN FORM */}
      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          {/* 1. Header Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Challan Number *</label>
              <input
                type="text"
                required
                value={challanNumber}
                onChange={(e) => setChallanNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">To Department *</label>
              <select
                value={toDepartment}
                onChange={(e) => setToDepartment(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="RECUTTING">RECUTTING (Embroidery Recutting & Panel Separation)</option>
                <option value="FINISHING">FINISHING (Finishing & Steam Pressing)</option>
                <option value="STORE">STORE (Raw Material & Fabric Store)</option>
                <option value="WASHING">WASHING (Re-wash handoff)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="NORMAL">NORMAL</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>
          </div>

          {/* 2. Program Selection */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Select Production Program / Tech Sheet *
            </label>
            <select
              value={selectedProgram?.id || ''}
              onChange={(e) => {
                const p = programs.find((x) => x.id === e.target.value);
                setSelectedProgram(p || null);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.programSerialNo || p.programNumber} — {p.clientName} (Style: {p.styleCode}, Fabric: {p.fabricName})
                </option>
              ))}
            </select>
          </div>

          {/* 3. Items Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Transfer Items & Quantities</span>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Item #{idx + 1}
                    </span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-rose-500 hover:text-rose-700 p-1 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-2">
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Description</label>
                      <input
                        type="text"
                        value={item.itemDescription}
                        onChange={(e) => handleItemChange(idx, 'itemDescription', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Quantity (PCS) *</label>
                      <input
                        type="number"
                        min="1"
                        required
                        placeholder="e.g. 500"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono font-bold text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">UOM</label>
                      <input
                        type="text"
                        readOnly
                        value={item.uom}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-100 font-mono"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Remarks */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Remarks / Quality Notes</label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <Link
              href="/qcwashing/my-work"
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>Issue & Handover to Finishing</span>
            </button>
          </div>
        </form>

        {/* SUCCESS MODAL */}
        {generatedChallan && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Challan Issued Successfully!
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {generatedChallan.challanNumber}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">From:</span>
                  <span className="font-bold text-slate-900">QC WASHING (QC3)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">To:</span>
                  <span className="font-bold text-emerald-700">{generatedChallan.toDepartment}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Quantity:</span>
                  <span className="font-bold font-mono text-slate-900">
                    {generatedChallan.items?.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0) || 0} PCS
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Link
                  href="/qcwashing/my-work"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold text-center transition shadow-sm"
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
