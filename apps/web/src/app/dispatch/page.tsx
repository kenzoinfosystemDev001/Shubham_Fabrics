'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';

export default function DispatchPage() {
  const [cartons, setCartons] = useState<any[]>([]);
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDispatchModal, setShowDispatchModal] = useState(false);

  // Form State
  const [dispatchForm, setDispatchForm] = useState({
    dispatchNumber: `DSP-2026-${Math.floor(Math.random() * 9000) + 1000}`,
    orderNumber: 'PO-EXP-5000',
    invoiceNumber: `INV-2026-${Math.floor(Math.random() * 9000) + 1000}`,
    transporterName: 'Safexpress Supply Chain Ltd.',
    vehicleNumber: 'MH-04-AB-1234',
    lrNumber: `LR-SFX-${Math.floor(Math.random() * 90000) + 10000}`,
    destination: 'Export Warehouse, JNPT Nhava Sheva, Mumbai',
    cartonIds: [] as string[],
    notes: 'Export standard pallets and shrink-wrapped cartons',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [cartonsData, dispatchesData] = await Promise.all([
        api.getCartons(),
        api.getDispatches(),
      ]);
      setCartons(cartonsData);
      setDispatches(dispatchesData);
    } catch (err) {
      console.error('Failed to load dispatch data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleCartonSelection = (cartonId: string) => {
    setDispatchForm((prev) => {
      const exists = prev.cartonIds.includes(cartonId);
      return {
        ...prev,
        cartonIds: exists ? prev.cartonIds.filter((id) => id !== cartonId) : [...prev.cartonIds, cartonId],
      };
    });
  };

  const handleCreateDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (dispatchForm.cartonIds.length === 0) {
      alert('Please select at least one carton from Finished Goods to dispatch.');
      return;
    }
    try {
      await api.createDispatch(dispatchForm);
      alert('Dispatch Order created, LR assigned, and Finished Goods stock consumed from ledger.');
      setShowDispatchModal(false);
      await loadData();
    } catch (err: any) {
      alert(`Dispatch creation failed: ${err.message}`);
    }
  };

  const availableCartons = cartons.filter((c) => c.status !== 'DISPATCHED');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🚚</span>
            <h1 className="text-xl font-bold text-slate-100">Finished Goods &amp; Dispatch Logistics</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Finished Goods rack inventory, carton barcodes, and double-dispatch-prevented LR dispatch tracking.
          </p>
        </div>

        <button
          onClick={() => setShowDispatchModal(true)}
          disabled={availableCartons.length === 0}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded shadow transition"
        >
          + Create Dispatch Order
        </button>
      </div>

      {/* Cartons Grid */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          Finished Goods Warehouse Inventory ({cartons.length} Cartons)
        </h3>
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400 font-mono">Querying FG inventory...</div>
        ) : cartons.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 font-mono bg-slate-900 border border-slate-800 rounded-lg">
            No cartons packed yet. Execute packing from completed stitching bundles.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {cartons.map((c) => (
              <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm font-mono">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-blue-400 text-xs">{c.cartonNumber}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                    c.status === 'DISPATCHED' ? 'bg-slate-800 text-slate-400' : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  }`}>
                    {c.status}
                  </span>
                </div>
                <div className="text-xs text-slate-200 font-sans font-semibold mb-1">
                  {c.program?.designName || 'Garment Design'} ({c.size} / {c.colour})
                </div>
                <div className="text-[11px] text-slate-400 space-y-0.5">
                  <div>Quantity: <strong className="text-slate-200">{c.quantity} PCS</strong></div>
                  <div>Weight: {c.grossWeightKg || '—'} KG (Gross)</div>
                  <div>Rack/Shelf: <span className="text-emerald-400">{c.locationRack}/{c.locationShelf}</span></div>
                  <div>Barcode: {c.barcode}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dispatch Orders Table */}
      <div className="pt-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          Authorized Dispatches ({dispatches.length})
        </h3>
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono text-[11px] uppercase">
                  <th className="px-4 py-3">Dispatch #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Transporter &amp; LR</th>
                  <th className="px-4 py-3">Vehicle #</th>
                  <th className="px-4 py-3">Destination</th>
                  <th className="px-4 py-3 text-right">Cartons</th>
                  <th className="px-4 py-3 text-right">Total Qty</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {dispatches.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-850/50 transition">
                    <td className="px-4 py-3 font-bold text-blue-400">{d.dispatchNumber}</td>
                    <td className="px-4 py-3 text-slate-400 text-[11px]">{new Date(d.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-slate-200 font-sans">
                      <div>{d.transporterName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">LR: {d.lrNumber || 'Direct Handover'}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{d.vehicleNumber}</td>
                    <td className="px-4 py-3 text-slate-300 truncate max-w-[200px]">{d.destination}</td>
                    <td className="px-4 py-3 text-right text-slate-200 font-bold">{d.totalCartons}</td>
                    <td className="px-4 py-3 text-right text-emerald-400 font-bold">{d.totalQuantity} PCS</td>
                    <td className="px-4 py-3">
                      <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                        {d.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Dispatch Modal */}
      {showDispatchModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-xl w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-sm font-bold text-slate-100">Create &amp; Authorize Dispatch Order</h3>
              <button onClick={() => setShowDispatchModal(false)} className="text-slate-400 hover:text-slate-200 text-sm">✕</button>
            </div>

            <form onSubmit={handleCreateDispatch} className="space-y-3 font-mono text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Dispatch #</label>
                  <input
                    type="text"
                    value={dispatchForm.dispatchNumber}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, dispatchNumber: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-200"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Order #</label>
                  <input
                    type="text"
                    value={dispatchForm.orderNumber}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, orderNumber: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-200"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Transporter Name</label>
                  <input
                    type="text"
                    value={dispatchForm.transporterName}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, transporterName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-200"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Vehicle #</label>
                  <input
                    type="text"
                    value={dispatchForm.vehicleNumber}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, vehicleNumber: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-200"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">LR #</label>
                  <input
                    type="text"
                    value={dispatchForm.lrNumber}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, lrNumber: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-200"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Destination</label>
                  <input
                    type="text"
                    value={dispatchForm.destination}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, destination: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-200"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Select Cartons to Dispatch ({availableCartons.length} available)</label>
                <div className="max-h-40 overflow-y-auto bg-slate-950 border border-slate-800 rounded p-2 space-y-1">
                  {availableCartons.map((c) => {
                    const isSelected = dispatchForm.cartonIds.includes(c.id);
                    return (
                      <div
                        key={c.id}
                        onClick={() => handleToggleCartonSelection(c.id)}
                        className={`flex items-center justify-between p-2 rounded cursor-pointer transition ${
                          isSelected ? 'bg-blue-600/30 border border-blue-500 text-blue-200' : 'hover:bg-slate-900 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={isSelected} readOnly className="rounded" />
                          <span>{c.cartonNumber} ({c.size}/{c.colour})</span>
                        </div>
                        <span className="font-bold text-slate-200">{c.quantity} PCS</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-1.5 rounded shadow"
                >
                  Confirm Dispatch &amp; Consume FG
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
