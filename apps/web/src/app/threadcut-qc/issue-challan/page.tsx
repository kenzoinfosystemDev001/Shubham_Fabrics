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
import { ChallanNumberInput, getChallanNumberError } from '@/components/challan/ChallanNumberInput';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';
import BarcodeStickerCard from '@/components/BarcodeStickerCard';
import { ColorFabricMeasurementTable, createDepartmentInOutTracking } from '@/components/ColorFabricMeasurementTable';

export default function ThreadcutQCIssueChallanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<any | null>(null);
  const [selectedSheetForView, setSelectedSheetForView] = useState<any | null>(null);
  const [generatedChallan, setGeneratedChallan] = useState<any | null>(null);
  const [challanNumber, setChallanNumber] = useState('');
  const [challanNumberError, setChallanNumberError] = useState<string | null>(null);
  const [toDepartment, setToDepartment] = useState('WASHING');
  const [priority, setPriority] = useState('NORMAL');
  const [remarks, setRemarks] = useState('Threadcut QC Inspected & Passed pieces handover to Washing for soft wash and drying.');
  
  const [items, setItems] = useState([
    {
      itemDescription: 'Inspected Garment Pieces - Ready for Washing',
      fabricCode: 'PIECE',
      colour: 'Standard',
      quantity: '',
      uom: 'PCS',
      remarks: 'Threadcut QC Approved. Ready for drum washer & hydro-extractor.',
    },
  ]);
  const [tracking, setTracking] = useState(() => createDepartmentInOutTracking('THREADCUT_QC'));
  const totalQuantityLabel = Object.entries(items.reduce<Record<string, number>>((totals, item) => {
    const unit = item.uom || 'PCS';
    totals[unit] = (totals[unit] || 0) + (Number(item.quantity) || 0);
    return totals;
  }, {})).map(([unit, quantity]) => `${quantity.toLocaleString()} ${unit}`).join(' + ');

  useEffect(() => {
    const init = async () => {
      try {
        // Challan number is entered manually; it is never pre-filled.
        const progRes = await fetch('/api/programs');
        if (progRes.ok) {
          const progJson = await progRes.json();
          const list = Array.isArray(progJson) ? progJson : progJson.data || [];
          setPrograms(list);
          if (list.length > 0) {
            handleSelectProgram(list[0]);
          }
        }
      } catch (err) {
        console.error('Failed to initialize Threadcut QC Issue Challan:', err);
      }
    };
    init();
  }, []);

  const handleSelectProgram = (prog: any) => {
    setSelectedProgram(prog);
    setTracking(createDepartmentInOutTracking('THREADCUT_QC', {
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
    if (loading) return;
    const numberError = getChallanNumberError(challanNumber);
    setChallanNumberError(numberError);
    if (numberError) return;
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
          challanNumber: challanNumber.trim(),
          challanType: 'REGULAR',
          programId: selectedProgram.id,
          fromDepartment: 'THREADCUT_QC',
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
      if (!res.ok) {
        if (json.field === 'challanNumber') {
          setChallanNumberError(json.error);
          return;
        }
        throw new Error(json.error || 'Failed to issue challan');
      }

      // POST /api/challans returns the created challan itself.
      setGeneratedChallan(json.data || json);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink-50 pb-16">
      {/* HEADER */}
      <header
        style={{
          backgroundImage: `linear-gradient(to right, rgba(37, 35, 42, 0.88), rgba(37, 35, 42, 0.72)), url('${DEPARTMENT_NAV_BG_IMAGE}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        className="border-b border-slate-700/80 sticky top-0 z-30 px-4 sm:px-8 py-4 shadow-md text-white"
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 block drop-shadow-sm">
              SHUBHAM FABRICS MES · THREADCUT QC
            </span>
            <h1 className="text-xl font-bold text-white flex items-center gap-2.5 drop-shadow-sm">
              <Send className="w-5 h-5 text-emerald-400" />
              <span>Issue Handover Challan to Washing</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/threadcut-qc/my-work"
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-600/50"
            >
              Inspection Station
            </Link>
          </div>
        </div>
      </header>

      {/* FORM CONTAINER */}
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          {/* ROW 1: CHALLAN #, TARGET DEPT, PRIORITY */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ChallanNumberInput
              value={challanNumber}
              onChange={(value) => {
                setChallanNumber(value);
                setChallanNumberError(null);
              }}
              error={challanNumberError}
              disabled={loading}
            />

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">To Department</label>
              <select
                value={toDepartment}
                onChange={(e) => setToDepartment(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg text-xs font-bold text-emerald-700 focus:ring-2 focus:ring-lavender-500"
              >
                <option value="WASHING">WASHING DEPARTMENT (Next Stage)</option>
                <option value="THREAD_CUTTING">THREAD CUTTING (Rework Return)</option>
                <option value="STORE">FABRIC STORE (Defected Shelf)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
              >
                <option value="NORMAL">NORMAL</option>
                <option value="HIGH">HIGH PRIORITY</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>
          </div>

          {/* ROW 2: SELECT PRODUCTION SHEET (TRAVELER) */}
          <div className="p-4 bg-sky-50/60 rounded-xl border border-sky-100 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-900">
                Link Master Production Sheet (Traveler) *
              </label>
              {selectedProgram && (
                <button
                  type="button"
                  onClick={() => setSelectedSheetForView(selectedProgram)}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-xs"
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
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-lavender-500"
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
              currentDepartment="THREADCUT_QC"
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-600 pt-2 border-t border-sky-200/60">
                <div>Client: <strong className="text-slate-900">{selectedProgram.clientName}</strong></div>
                <div>Style: <strong className="text-slate-900">{selectedProgram.mainStyle || selectedProgram.styleCode}</strong></div>
                <div>Fabric: <strong className="text-slate-900">{selectedProgram.fabricName || '—'}</strong></div>
                <div>Target: <strong className="text-slate-900">{selectedProgram.targetQuantity || '—'} PCS</strong></div>
              </div>
            )}
          </div>

          {/* ITEMS TO DISPATCH */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Pieces to Dispatch</h3>
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 items-end">
                <div className="sm:col-span-5">
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Item Description</label>
                  <input
                    type="text"
                    value={it.itemDescription}
                    onChange={(e) => {
                      const next = [...items];
                      next[idx].itemDescription = e.target.value;
                      setItems(next);
                    }}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Quantity *</label>
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
                    className="w-full px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-mono font-bold text-emerald-700"
                    placeholder="e.g. 500"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Unit *</label>
                  <select
                    value={it.uom}
                    onChange={(e) => {
                      const next = [...items];
                      next[idx].uom = e.target.value;
                      (next[idx] as any).unitType = e.target.value;
                      setItems(next);
                      setTracking((prev) => ({ ...prev, fabricUnit: e.target.value as 'MTR' | 'PCS' }));
                    }}
                    className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="MTR">MTR</option>
                    <option value="PCS">PCS</option>
                  </select>
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Remarks</label>
                  <input
                    type="text"
                    value={it.remarks}
                    onChange={(e) => {
                      const next = [...items];
                      next[idx].remarks = e.target.value;
                      setItems(next);
                    }}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Handover Notes</label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => router.push('/threadcut-qc/my-work')}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-lavender-600 hover:bg-lavender-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-2"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 text-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Challan Issued to Washing!</h3>
                  <p className="text-xs text-slate-500 font-mono">{generatedChallan.challanNumber}</p>
                </div>
              </div>
              <button onClick={() => router.push('/threadcut-qc/my-work')} className="p-1 rounded text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <BarcodeStickerCard
              params={{
                challanNumber: generatedChallan.challanNumber,
                designNumber: selectedProgram?.wilcomDesignNumber || selectedProgram?.programSerialNo || 'WASH-TAG',
                departmentName: 'Threadcut QC Handover to Washing',
                fromDepartment: 'THREADCUT_QC',
                toDepartment: 'WASHING',
                programSerialNo: selectedProgram?.programSerialNo,
                clientName: selectedProgram?.clientName,
                totalQuantity: generatedChallan.items?.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0) || 0,
                uom: items[0]?.uom || 'PCS',
              }}
              title="Official Washing Dispatch Tag"
            />

            <p className="text-right text-xs font-bold text-slate-700">Total Quantity: {totalQuantityLabel}</p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => router.push('/threadcut-qc/my-work')}
                className="px-4 py-2 bg-lavender-600 hover:bg-lavender-700 text-white font-bold text-xs rounded-lg shadow-sm"
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
