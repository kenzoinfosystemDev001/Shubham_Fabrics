'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';

type StoreTab = 'rolls' | 'ledger' | 'summary' | 'issue' | 'defected';

export default function StorePage() {
  const [activeTab, setActiveTab] = useState<StoreTab>('rolls');
  const [rolls, setRolls] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [summary, setSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInwardModal, setShowInwardModal] = useState(false);

  // Inward Form State
  const [inwardForm, setInwardForm] = useState({
    rollNumber: `ROLL-2026-${Math.floor(Math.random() * 9000) + 1000}`,
    lotNumber: 'LOT-TX-01',
    fabricCode: 'FAB-SNG-01',
    fabricName: 'Single Jersey 100% Combed Cotton',
    colour: 'Navy Blue',
    initialLengthMtr: 1250,
    initialWeightKg: 250,
    location: 'STORE-BAY-A',
  });

  // Issue Form State
  const [issueForm, setIssueForm] = useState({
    rollNumber: '',
    targetDepartment: 'CUTTING',
    challanId: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [rollsData, ledgerData, summaryData] = await Promise.all([
        api.getFabricRolls(),
        api.getStockLedger(),
        api.getStockSummary(),
      ]);
      setRolls(rollsData);
      setLedger(ledgerData);
      setSummary(summaryData);
      if (rollsData.length > 0 && !issueForm.rollNumber) {
        setIssueForm((f) => ({ ...f, rollNumber: rollsData[0].rollNumber }));
      }
    } catch (err) {
      console.error('Failed to load store data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const handleRegisterRoll = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.registerFabricRoll(inwardForm);
      setShowInwardModal(false);
      await loadData();
    } catch (err: any) {
      alert(`Roll registration failed: ${err.message}`);
    }
  };

  const handleIssueRoll = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!issueForm.challanId) {
        alert('Please enter a valid Challan ID to authorize the issue handoff.');
        return;
      }
      await api.issueFabricRoll(issueForm);
      alert(`Roll ${issueForm.rollNumber} issued to ${issueForm.targetDepartment} successfully.`);
      await loadData();
    } catch (err: any) {
      alert(`Roll issue failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">📦</span>
            <h1 className="text-xl font-bold text-slate-100">Raw Material Store &amp; Stock Ledger</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            ACID-compliant inventory transactions, fabric roll genealogy, and negative-stock prevention.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInwardModal(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded shadow transition"
          >
            + Inward Fabric Roll
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800">
        <button
          onClick={() => setActiveTab('rolls')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${
            activeTab === 'rolls' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Fabric Rolls Registry ({rolls.length})
        </button>
        <button
          onClick={() => setActiveTab('ledger')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${
            activeTab === 'ledger' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Immutable Stock Ledger ({ledger.length})
        </button>
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${
            activeTab === 'summary' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Stock Summary by Department
        </button>
        <button
          onClick={() => setActiveTab('issue')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${
            activeTab === 'issue' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Material Issue Station
        </button>
      </div>

      {/* Tab Contents */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400 font-mono">
          Querying PostgreSQL Stock Ledger...
        </div>
      ) : activeTab === 'rolls' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono text-[11px] uppercase">
                  <th className="px-4 py-3">Roll Number</th>
                  <th className="px-4 py-3">Fabric Code &amp; Name</th>
                  <th className="px-4 py-3">Colour</th>
                  <th className="px-4 py-3">Length (MTR)</th>
                  <th className="px-4 py-3">Weight (KG)</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Program</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {rolls.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-850/50 transition">
                    <td className="px-4 py-3 font-bold text-blue-400">{r.rollNumber}</td>
                    <td className="px-4 py-3 text-slate-200">{r.fabricName} ({r.fabricCode})</td>
                    <td className="px-4 py-3 text-slate-300">{r.colour}</td>
                    <td className="px-4 py-3 text-emerald-400 font-bold">{r.currentLengthMtr} MTR</td>
                    <td className="px-4 py-3 text-slate-400">{r.currentWeightKg} KG</td>
                    <td className="px-4 py-3 text-slate-400">{r.location || 'STORE'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        r.status === 'RECEIVED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                        r.status === 'ISSUED' ? 'bg-blue-950 text-blue-400 border border-blue-800' :
                        'bg-slate-800 text-slate-400'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{r.program?.programNumber || 'Unassigned'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'ledger' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono text-[11px] uppercase">
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Entry Type</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Item / Description</th>
                  <th className="px-4 py-3">Roll / Lot #</th>
                  <th className="px-4 py-3 text-right">Delta Qty</th>
                  <th className="px-4 py-3 text-right">Balance After</th>
                  <th className="px-4 py-3">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {ledger.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-850/50 transition">
                    <td className="px-4 py-3 text-slate-400 text-[11px]">{new Date(e.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        e.entryType === 'RECEIPT' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                        e.entryType === 'ISSUE' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                        e.entryType === 'CONSUMPTION' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                        'bg-blue-950 text-blue-400 border border-blue-800'
                      }`}>
                        {e.entryType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 font-bold">{e.departmentCode}</td>
                    <td className="px-4 py-3 text-slate-200">{e.itemName} ({e.itemCode})</td>
                    <td className="px-4 py-3 text-slate-400">{e.rollNumber || e.lotNumber || '—'}</td>
                    <td className={`px-4 py-3 text-right font-bold ${e.quantity > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {e.quantity > 0 ? `+${e.quantity}` : e.quantity} {e.uom}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-400 font-bold">{e.balanceAfter} {e.uom}</td>
                    <td className="px-4 py-3 text-slate-400 text-[11px] truncate max-w-[150px]">{e.notes || e.referenceType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'summary' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {summary.map((s) => (
            <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                  {s.departmentCode}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                  {s.itemType}
                </span>
              </div>
              <h4 className="text-sm font-bold text-slate-100">{s.description}</h4>
              <p className="text-xs text-slate-400 font-mono mt-1">ID: {s.identifier}</p>
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">Available Stock:</span>
                <span className="text-base font-bold text-emerald-400 font-mono">
                  {s.currentQuantity} {s.uom}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Material Issue Form */
        <div className="max-w-xl mx-auto bg-slate-900 border border-slate-800 rounded-lg p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-100 mb-4 pb-2 border-b border-slate-800">
            Issue Fabric Roll to Production Department
          </h3>
          <form onSubmit={handleIssueRoll} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">Select Fabric Roll</label>
              <select
                value={issueForm.rollNumber}
                onChange={(e) => setIssueForm({ ...issueForm, rollNumber: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
              >
                {rolls.map((r) => (
                  <option key={r.id} value={r.rollNumber} disabled={r.status === 'ISSUED'}>
                    {r.rollNumber} — {r.fabricName} ({r.currentLengthMtr} MTR) [{r.status}]
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">Target Department</label>
              <select
                value={issueForm.targetDepartment}
                onChange={(e) => setIssueForm({ ...issueForm, targetDepartment: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
              >
                <option value="DYEING">DYEING (Pre-treatment &amp; Shade Formulation)</option>
                <option value="CUTTING">CUTTING (Direct Lay Spreading)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">Authorizing Challan ID</label>
              <input
                type="text"
                placeholder="UUID of active Challan"
                value={issueForm.challanId}
                onChange={(e) => setIssueForm({ ...issueForm, challanId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2.5 rounded shadow transition"
            >
              Authorize &amp; Deduct From Store Ledger
            </button>
          </form>
        </div>
      )}

      {/* Inward Modal */}
      {showInwardModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-sm font-bold text-slate-100">Inward New Fabric Roll</h3>
              <button onClick={() => setShowInwardModal(false)} className="text-slate-400 hover:text-slate-200 text-sm">✕</button>
            </div>

            <form onSubmit={handleRegisterRoll} className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Roll Number</label>
                <input
                  type="text"
                  value={inwardForm.rollNumber}
                  onChange={(e) => setInwardForm({ ...inwardForm, rollNumber: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-200"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Fabric Code &amp; Name</label>
                <input
                  type="text"
                  value={inwardForm.fabricCode}
                  onChange={(e) => setInwardForm({ ...inwardForm, fabricCode: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-200"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Length (MTR)</label>
                  <input
                    type="number"
                    value={inwardForm.initialLengthMtr}
                    onChange={(e) => setInwardForm({ ...inwardForm, initialLengthMtr: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-200"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Weight (KG)</label>
                  <input
                    type="number"
                    value={inwardForm.initialWeightKg}
                    onChange={(e) => setInwardForm({ ...inwardForm, initialWeightKg: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-200"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Colour</label>
                <input
                  type="text"
                  value={inwardForm.colour}
                  onChange={(e) => setInwardForm({ ...inwardForm, colour: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-200"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowInwardModal(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-1.5 rounded shadow"
                >
                  Confirm Inward
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
