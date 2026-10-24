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

export default function QC2IssueChallanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<any | null>(null);
  const [selectedSheetForView, setSelectedSheetForView] = useState<any | null>(null);
  const [generatedChallan, setGeneratedChallan] = useState<any | null>(null);
  const [challanNumber, setChallanNumber] = useState('');
  const [toDepartment, setToDepartment] = useState('WASHING');
  const [priority, setPriority] = useState('NORMAL');
  const [remarks, setRemarks] = useState('QC2 Inspected & Passed pieces handover to Washing for soft wash and drying.');
  
  const [items, setItems] = useState([
    {
      itemDescription: 'Inspected Garment Pieces - Ready for Washing',
      fabricCode: 'PIECE',
      colour: 'Standard',
      quantity: '',
      uom: 'PCS',
      remarks: 'QC2 Approved. Ready for drum washer & hydro-extractor.',
    },
  ]);
  const [tracking, setTracking] = useState(() => createDepartmentInOutTracking('QC2'));
  const totalQuantityLabel = Object.entries(items.reduce<Record<string, number>>((totals, item) => {
    const unit = item.uom || 'PCS';
    totals[unit] = (totals[unit] || 0) + (Number(item.quantity) || 0);
    return totals;
  }, {})).map(([unit, quantity]) => `${quantity.toLocaleString()} ${unit}`).join(' + ');

  useEffect(() => {
    const init = async () => {
      try {
        const [numRes, progRes] = await Promise.all([
          fetch('/api/challans/next-number?department=QC2'),
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
          if (list.length > 0) {
            handleSelectProgram(list[0]);
          }
        }
      } catch (err) {
        console.error('Failed to initialize QC2 Issue Challan:', err);
      }
    };
    init();
  }, []);

  const handleSelectProgram = (prog: any) => {
    setSelectedProgram(prog);
    setTracking(createDepartmentInOutTracking('QC2', {
      fabricIn: Number(prog.targetQuantity) || 0,
      fabricUnit: 'PCS',
    }));
    setItems((prev) => [
      {
        ...prev[0],
        itemDescription: `${prog.fabricName || 'Garment Pieces'} - ${prog.mainStyle || prog.styleCode || 'Lot'}`,
        colour: prog.fabricColor || 'Standard',
        quantity: prev[0]?.quantity || String(prog.targetQuantity || ''),
      },
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProgram) {
      alert('Please select a Production Program / Sheet.');
      return;
    }
    if (new Set(items.map((item) => item.uom)).size > 1) {
      alert('Use the same unit for every quantity in one challan.');
      return;
    }
    const validItems = items.filter((it) => Number(it.quantity) > 0);
    if (validItems.length === 0) {
      alert('Please enter a valid quantity greater than 0.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/challans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challanNumber,
          challanType: 'REGULAR',
          programId: selectedProgram.id,
          fromDepartment: 'QC2',
          toDepartment: toDepartment,
          ...tracking,
          fabricUnit: validItems[0]?.uom || tracking.fabricUnit,
          detectedFromDepartment: tracking.detectedFromDept,
          priority,
          remarks: `${remarks} | Production Sheet #${selectedProgram.programSerialNo || selectedProgram.programNumber}`,
          items: validItems.map((it) => ({
            ...it,
            quantity: Number(it.quantity),
          })),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to issue challan');
      }

      setGeneratedChallan(json.data);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 pb-16">
      {/* HEADER */}
      <header
        className="bg-white border-b border-neutral-200 sticky top-0 z-30 px-4 sm:px-8 py-4 shadow-md text-neutral-900"
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-700 block drop-shadow-sm">
              SHUBHAM FABRICS MES · QC2 DEPARTMENT
            </span>
            <h1 className="text-xl font-bold text-neutral-900 flex items-center gap-2.5 drop-shadow-sm">
              <Send className="w-5 h-5 text-accent-700" />
              <span>Issue Handover Challan to Washing</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/qc2/my-work"
              className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 rounded-lg text-xs font-semibold border border-neutral-200"
            >
              Inspection Station
            </Link>
          </div>
        </div>
      </header>

      {/* FORM CONTAINER */}
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs space-y-6">
          {/* ROW 1: CHALLAN #, TARGET DEPT, PRIORITY */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">Challan Number</label>
              <input
                type="text"
                readOnly
                value={challanNumber}
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-mono font-bold text-neutral-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">To Department</label>
              <select
                value={toDepartment}
                onChange={(e) => setToDepartment(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-accent-300 rounded-lg text-xs font-bold text-accent-800 focus:ring-2 focus:ring-brand-500/40"
              >
                <option value="WASHING">WASHING DEPARTMENT (Next Stage)</option>
                <option value="THREAD_CUTTING">THREAD CUTTING (Rework Return)</option>
                <option value="STORE">FABRIC STORE (Defected Shelf)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-xs font-semibold"
              >
                <option value="NORMAL">NORMAL</option>
                <option value="HIGH">HIGH PRIORITY</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>
          </div>

          {/* ROW 2: SELECT PRODUCTION SHEET (TRAVELER) */}
          <div className="p-4 bg-brand-50/60 rounded-xl border border-brand-100 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-neutral-900">
                Link Master Production Sheet (Traveler) *
              </label>
              {selectedProgram && (
                <button
                  type="button"
                  onClick={() => setSelectedSheetForView(selectedProgram)}
                  className="px-2.5 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-xs"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Preview Sheet</span>
                </button>
              )}
            </div>

            <select
              value={selectedProgram?.id || ''}
              onChange={(e) => {
                const prog = programs.find((p) => p.id === e.target.value);
                if (prog) handleSelectProgram(prog);
                else setSelectedProgram(null);
              }}
              className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-brand-500"
            >
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  Sheet #{p.programSerialNo || p.programNumber} — {p.clientName} ({p.mainStyle || p.styleCode || 'Standard Style'})
                </option>
              ))}
            </select>

            <ColorFabricMeasurementTable
              items={[]}
              onChange={() => {}}
              currentDepartment="QC2"
              programId={selectedProgram?.id}
              tracking={tracking}
              onTrackingChange={setTracking}
              trackingOnly
              showInOutController
              onSyncToItems={(fabricOut, fabricUnit) => {
                setItems((prev) => prev.map((item, index) => index === 0 ? { ...item, quantity: String(fabricOut), uom: fabricUnit } : item));
              }}
            />

            {selectedProgram && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-neutral-600 pt-2 border-t border-brand-200/60">
                <div>Client: <strong className="text-neutral-900">{selectedProgram.clientName}</strong></div>
                <div>Style: <strong className="text-neutral-900">{selectedProgram.mainStyle || selectedProgram.styleCode}</strong></div>
                <div>Fabric: <strong className="text-neutral-900">{selectedProgram.fabricName || '—'}</strong></div>
                <div>Target: <strong className="text-neutral-900">{selectedProgram.targetQuantity || '—'} PCS</strong></div>
              </div>
            )}
          </div>

          {/* ITEMS TO DISPATCH */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">Pieces to Dispatch</h3>
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3 bg-neutral-50 rounded-xl border border-neutral-200 items-end">
                <div className="sm:col-span-5">
                  <label className="block text-[10px] font-bold text-neutral-600 mb-1">Item Description</label>
                  <input
                    type="text"
                    value={it.itemDescription}
                    onChange={(e) => {
                      const next = [...items];
                      next[idx].itemDescription = e.target.value;
                      setItems(next);
                    }}
                    className="w-full px-3 py-1.5 bg-white border border-neutral-300 rounded-lg text-xs"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-neutral-600 mb-1">Quantity *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    required
                    value={it.quantity}
                    onChange={(e) => {
                      const next = [...items];
                      next[idx].quantity = e.target.value;
                      setItems(next);
                    }}
                    className="w-full px-3 py-1.5 bg-white border border-accent-300 rounded-lg text-xs font-mono font-bold text-accent-800"
                    placeholder="e.g. 500"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-[10px] font-bold text-neutral-600 mb-1">Unit *</label>
                  <select
                    value={it.uom}
                    onChange={(e) => {
                      const next = [...items];
                      next[idx].uom = e.target.value;
                      (next[idx] as any).unitType = e.target.value;
                      setItems(next);
                      setTracking((prev) => ({ ...prev, fabricUnit: e.target.value as 'MTR' | 'PCS' }));
                    }}
                    className="w-full px-2 py-1.5 bg-white border border-neutral-300 rounded-lg text-xs"
                  >
                    <option value="MTR">MTR</option>
                    <option value="PCS">PCS</option>
                  </select>
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-[10px] font-bold text-neutral-600 mb-1">Remarks</label>
                  <input
                    type="text"
                    value={it.remarks}
                    onChange={(e) => {
                      const next = [...items];
                      next[idx].remarks = e.target.value;
                      setItems(next);
                    }}
                    className="w-full px-3 py-1.5 bg-white border border-neutral-300 rounded-lg text-xs"
                  />
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">Handover Notes</label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-200">
            <button
              type="button"
              onClick={() => router.push('/qc2/my-work')}
              className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold text-xs rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Issuing Challan & Traveler...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Issue Challan & Production Sheet to Washing</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* SUCCESS MODAL WITH BARCODE TAG */}
      {generatedChallan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl border border-neutral-200 text-neutral-900 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-accent-100 flex items-center justify-center text-accent-800">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">Challan Issued to Washing!</h3>
                  <p className="text-xs text-neutral-500 font-mono">{generatedChallan.challanNumber}</p>
                </div>
              </div>
              <button onClick={() => router.push('/qc2/my-work')} className="p-1 rounded text-neutral-500 hover:text-neutral-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <BarcodeStickerCard
              params={{
                challanNumber: generatedChallan.challanNumber,
                designNumber: selectedProgram?.wilcomDesignNumber || selectedProgram?.programSerialNo || 'WASH-TAG',
                departmentName: 'QC2 Handover to Washing',
                fromDepartment: 'QC2',
                toDepartment: 'WASHING',
                programSerialNo: selectedProgram?.programSerialNo,
                clientName: selectedProgram?.clientName,
                totalQuantity: generatedChallan.items?.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0) || 0,
                uom: items[0]?.uom || 'PCS',
              }}
              title="Official Washing Dispatch Tag"
            />

            <p className="text-right text-xs font-bold text-neutral-700">Total Quantity: {totalQuantityLabel}</p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200">
              <button
                type="button"
                onClick={() => router.push('/qc2/my-work')}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-lg shadow-sm"
              >
                Go to Inspection Terminal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRODUCTION SHEET PRINT / TRAVELER MODAL */}
      {selectedSheetForView && (
        <ProductionSheetPrintModal
          program={selectedSheetForView}
          isOpen={!!selectedSheetForView}
          onClose={() => setSelectedSheetForView(null)}
        />
      )}
    </div>
  );
}
