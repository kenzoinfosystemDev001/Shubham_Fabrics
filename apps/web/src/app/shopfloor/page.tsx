'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';
import { DepartmentCode } from '@subham/types';
import { DEPARTMENT_LABELS } from '@subham/config';

export default function ShopFloorStationPage() {
  const [selectedDept, setSelectedDept] = useState<DepartmentCode>(DepartmentCode.CUTTING);
  const [activeStep, setActiveStep] = useState<number>(4); // Default to Step 4 (Production)
  const [incomingChallans, setIncomingChallans] = useState<any[]>([]);
  const [wipChallans, setWipChallans] = useState<any[]>([]);
  const [completedChallans, setCompletedChallans] = useState<any[]>([]);
  const [selectedChallan, setSelectedChallan] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Production Accounting Form State
  const [prodForm, setProdForm] = useState({
    operationName: 'Spreading and Lay Auto-Cutting',
    machineId: 'CUT-TABLE-01',
    shift: 'Shift-A (Morning)',
    inputQuantity: 650,
    goodQuantity: 620,
    reworkQuantity: 0,
    rejectQuantity: 10,
    wasteQuantity: 20,
    balanceQuantity: 0,
    unitOfMeasure: 'KG',
    reworkReason: '',
    rejectReason: 'End-bit weaving bar fault',
    wasteReason: 'Table selvage edge trim waste',
    notes: 'Completed without line interruption',
  });

  const loadStationData = async () => {
    try {
      setLoading(true);
      const [incoming, wip, completed] = await Promise.all([
        api.getChallans({ toDepartment: selectedDept, status: 'ISSUED' }),
        api.getChallans({ toDepartment: selectedDept, status: 'IN_PROCESS' }),
        api.getChallans({ fromDepartment: selectedDept, status: 'COMPLETED' }),
      ]);
      setIncomingChallans(incoming);
      setWipChallans(wip);
      setCompletedChallans(completed);

      if (wip.length > 0) {
        setSelectedChallan(wip[0]);
        // Update input quantity to match total of items
        const total = wip[0].items?.reduce((a: number, b: any) => a + (b.quantity || 0), 0) || 100;
        setProdForm((f) => ({ ...f, inputQuantity: total, goodQuantity: total }));
      } else if (incoming.length > 0) {
        setSelectedChallan(incoming[0]);
      }
    } catch (err: any) {
      console.error('Station load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStationData();
  }, [selectedDept]);

  // Dynamic Equation Check
  const accountedTotal =
    (prodForm.goodQuantity || 0) +
    (prodForm.reworkQuantity || 0) +
    (prodForm.rejectQuantity || 0) +
    (prodForm.wasteQuantity || 0) +
    (prodForm.balanceQuantity || 0);

  const variance = prodForm.inputQuantity - accountedTotal;
  const isEquationBalanced = variance === 0 && prodForm.inputQuantity > 0;

  const handleReceiveChallan = async (challanId: string) => {
    try {
      await api.updateChallanStatus(challanId, 'RECEIVED', 'Physical count verified on station scale');
      await api.updateChallanStatus(challanId, 'IN_PROCESS', 'Job loaded on production station');
      await loadStationData();
      alert('Challan received and moved to station Work-In-Progress (WIP)!');
    } catch (err: any) {
      alert(`Receive failed: ${err.message}`);
    }
  };

  const handleRecordProduction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEquationBalanced) {
      alert(`Cannot record: Accounting Imbalance! Input (${prodForm.inputQuantity}) != Accounted Total (${accountedTotal}). Variance: ${variance}`);
      return;
    }

    if (!selectedChallan) {
      alert('Please select an active Challan to record production against.');
      return;
    }

    try {
      const profile = await api.getProfile();
      await api.recordProduction({
        programId: selectedChallan.programId,
        challanId: selectedChallan.id,
        departmentCode: selectedDept,
        operatorId: profile.id,
        ...prodForm,
      });

      await loadStationData();
      alert('Production Accounting transaction verified & committed to database!');
    } catch (err: any) {
      alert(`Production recording error: ${err.message}`);
    }
  };

  const stationSteps = [
    { num: 1, title: 'Incoming', count: incomingChallans.length },
    { num: 2, title: 'Receive', count: incomingChallans.length },
    { num: 3, title: 'WIP Allocation', count: wipChallans.length },
    { num: 4, title: 'Production Accounting', count: wipChallans.length },
    { num: 5, title: 'Output & QC', count: completedChallans.length },
    { num: 6, title: 'Station Handover', count: completedChallans.length },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] w-full mx-auto">
      {/* Top Bar with Department Terminal Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>🏭</span> Shop-Floor Operational Terminal
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            6-Step Station Execution Standard with Mandatory Material Balance Validation
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400 font-mono">Current Station:</label>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value as DepartmentCode)}
            className="bg-slate-900 border border-blue-500/60 text-blue-300 text-xs font-mono font-bold rounded px-3 py-1.5 focus:outline-none"
          >
            {Object.values(DepartmentCode).map((d) => (
              <option key={d} value={d}>
                {d} - {DEPARTMENT_LABELS[d] || d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 6-Step Standard Operating Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        {stationSteps.map((step) => {
          const isActive = activeStep === step.num;
          return (
            <button
              key={step.num}
              onClick={() => setActiveStep(step.num)}
              className={`p-3 rounded-lg border text-left transition-all ${
                isActive
                  ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="font-bold">Step {step.num}</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-950 text-[10px] text-blue-400 font-mono">
                  {step.count}
                </span>
              </div>
              <p className="text-xs font-semibold mt-1 truncate">{step.title}</p>
            </button>
          );
        })}
      </div>

      {/* Step View Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Station Queue */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <h3 className="text-xs font-bold text-slate-200 uppercase font-mono">
              Active Station Manifests ({wipChallans.length + incomingChallans.length})
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">{selectedDept}</span>
          </div>

          <div className="space-y-2">
            {incomingChallans.map((ch) => (
              <div
                key={ch.id}
                onClick={() => setSelectedChallan(ch)}
                className={`p-3 rounded border cursor-pointer text-xs transition-colors ${
                  selectedChallan?.id === ch.id
                    ? 'bg-slate-800 border-blue-500'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex justify-between font-mono">
                  <span className="font-bold text-blue-400">{ch.challanNumber}</span>
                  <StatusBadge status={ch.status} />
                </div>
                <p className="text-[11px] text-slate-300 mt-1">From: {ch.fromDepartment}</p>
                <div className="mt-2 flex justify-between items-center">
                  <span className="text-[10px] text-slate-500 font-mono">{ch.items?.length || 0} items</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReceiveChallan(ch.id);
                    }}
                    className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-mono"
                  >
                    Receive on Station ➔
                  </button>
                </div>
              </div>
            ))}

            {wipChallans.map((ch) => (
              <div
                key={ch.id}
                onClick={() => {
                  setSelectedChallan(ch);
                  const total = ch.items?.reduce((a: number, b: any) => a + (b.quantity || 0), 0) || 100;
                  setProdForm((f) => ({ ...f, inputQuantity: total, goodQuantity: total }));
                }}
                className={`p-3 rounded border cursor-pointer text-xs transition-colors ${
                  selectedChallan?.id === ch.id
                    ? 'bg-slate-800 border-blue-500'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex justify-between font-mono">
                  <span className="font-bold text-blue-400">{ch.challanNumber}</span>
                  <StatusBadge status={ch.status} />
                </div>
                <p className="text-[11px] text-slate-300 mt-1">In Station WIP</p>
                <span className="text-[10px] text-emerald-400 font-mono mt-1 block">Active on Line</span>
              </div>
            ))}

            {incomingChallans.length === 0 && wipChallans.length === 0 && (
              <div className="p-8 text-center text-slate-500 font-mono text-xs">
                No pending or active challans in this department queue.
              </div>
            )}
          </div>
        </div>

        {/* Right 2 Columns: Mathematical Production Accounting Calculator */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-6">
          <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>⚖️</span> Strict Production Accounting Ledger
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Target Challan: <span className="text-blue-400 font-bold">{selectedChallan?.challanNumber || 'Select a Challan'}</span>
              </p>
            </div>
            <div className="text-right">
              <span
                className={`text-xs font-mono font-bold px-3 py-1 rounded border ${
                  isEquationBalanced
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                    : 'bg-rose-950 text-rose-400 border-rose-800 animate-pulse'
                }`}
              >
                {isEquationBalanced ? '✓ EQUATION BALANCED' : `IMBALANCE: VARIANCE ${variance}`}
              </span>
            </div>
          </div>

          {/* Mathematical Identity Visual Formula */}
          <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-[11px]">
              <span>INPUT QUANTITY</span>
              <span>ACCOUNTED TOTAL (GOOD + REWORK + REJECT + WASTE + BALANCE)</span>
            </div>
            <div className="flex items-center justify-between font-bold text-lg">
              <span className="text-blue-400">{prodForm.inputQuantity} {prodForm.unitOfMeasure}</span>
              <span className="text-slate-600">=</span>
              <span className={isEquationBalanced ? 'text-emerald-400' : 'text-rose-400'}>
                {accountedTotal} {prodForm.unitOfMeasure}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 flex justify-between pt-1 border-t border-slate-900">
              <span>Good: {prodForm.goodQuantity}</span>
              <span>Rework: {prodForm.reworkQuantity}</span>
              <span>Reject: {prodForm.rejectQuantity}</span>
              <span>Waste: {prodForm.wasteQuantity}</span>
              <span>Balance: {prodForm.balanceQuantity}</span>
            </div>
          </div>

          {/* Accounting Input Form */}
          <form onSubmit={handleRecordProduction} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Operation / Process Name</label>
                <input
                  type="text"
                  required
                  value={prodForm.operationName}
                  onChange={(e) => setProdForm({ ...prodForm, operationName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Machine / Station ID</label>
                <input
                  type="text"
                  value={prodForm.machineId}
                  onChange={(e) => setProdForm({ ...prodForm, machineId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Shift</label>
                <select
                  value={prodForm.shift}
                  onChange={(e) => setProdForm({ ...prodForm, shift: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono"
                >
                  <option value="Shift-A (Morning)">Shift-A (Morning)</option>
                  <option value="Shift-B (Evening)">Shift-B (Evening)</option>
                  <option value="Shift-C (Night)">Shift-C (Night)</option>
                </select>
              </div>
            </div>

            {/* Quantities Row */}
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-2">
              <div>
                <label className="text-blue-400 font-mono font-bold block mb-1">Input Qty</label>
                <input
                  type="number"
                  required
                  value={prodForm.inputQuantity}
                  onChange={(e) => setProdForm({ ...prodForm, inputQuantity: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-blue-500/80 rounded px-2 py-1.5 text-slate-200 font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-emerald-400 font-mono font-bold block mb-1">Good Qty</label>
                <input
                  type="number"
                  required
                  value={prodForm.goodQuantity}
                  onChange={(e) => setProdForm({ ...prodForm, goodQuantity: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-emerald-600/80 rounded px-2 py-1.5 text-slate-200 font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-orange-400 font-mono block mb-1">Rework Qty</label>
                <input
                  type="number"
                  value={prodForm.reworkQuantity}
                  onChange={(e) => setProdForm({ ...prodForm, reworkQuantity: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="text-rose-400 font-mono block mb-1">Reject Qty</label>
                <input
                  type="number"
                  value={prodForm.rejectQuantity}
                  onChange={(e) => setProdForm({ ...prodForm, rejectQuantity: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="text-amber-400 font-mono block mb-1">Waste Qty</label>
                <input
                  type="number"
                  value={prodForm.wasteQuantity}
                  onChange={(e) => setProdForm({ ...prodForm, wasteQuantity: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 font-mono block mb-1">Balance Qty</label>
                <input
                  type="number"
                  value={prodForm.balanceQuantity}
                  onChange={(e) => setProdForm({ ...prodForm, balanceQuantity: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-slate-200 font-mono"
                />
              </div>
            </div>

            {/* Reasons for Rework & Reject */}
            {(prodForm.reworkQuantity > 0 || prodForm.rejectQuantity > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-950 border border-slate-800 rounded">
                {prodForm.reworkQuantity > 0 && (
                  <div>
                    <label className="text-orange-400 font-mono block mb-1">Rework Defect Reason *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Skipped needle stitch / broken seam"
                      value={prodForm.reworkReason}
                      onChange={(e) => setProdForm({ ...prodForm, reworkReason: e.target.value })}
                      className="w-full bg-slate-900 border border-orange-700 rounded px-2.5 py-1.5 text-slate-200"
                    />
                  </div>
                )}
                {prodForm.rejectQuantity > 0 && (
                  <div>
                    <label className="text-rose-400 font-mono block mb-1">Reject Reason Code *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Fabric center hole / uneven cut blade bite"
                      value={prodForm.rejectReason}
                      onChange={(e) => setProdForm({ ...prodForm, rejectReason: e.target.value })}
                      className="w-full bg-slate-900 border border-rose-700 rounded px-2.5 py-1.5 text-slate-200"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="submit"
                disabled={!isEquationBalanced || !selectedChallan}
                className={`px-5 py-2 rounded font-mono font-bold text-xs shadow transition-all ${
                  isEquationBalanced && selectedChallan
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                    : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                }`}
              >
                Commit Production Accounting Record ➔
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
