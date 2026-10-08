'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  Archive,
  ArrowRight,
  ShieldAlert,
  ArrowLeft,
} from 'lucide-react';

export default function DefectedShelfPage() {
  const [loading, setLoading] = useState(true);
  const [rolls, setRolls] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [selectedRoll, setSelectedRoll] = useState<any>(null);
  const [actionType, setActionType] = useState<'RELEASE' | 'MOVE' | 'SCRAP' | null>(null);
  const [shelfLocation, setShelfLocation] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/fabric-store/rolls?limit=200');
      const json = await res.json();
      const allRolls: any[] = json.data || [];
      // Defected shelf consists of rolls with QC_HOLD, QC_REJECTED, qcStatus ON_HOLD, or qcStatus FAILED
      const defected = allRolls.filter(
        (r) =>
          r.status === 'QC_HOLD' ||
          r.status === 'QC_REJECTED' ||
          r.qcStatus === 'ON_HOLD' ||
          r.qcStatus === 'FAILED'
      );
      setRolls(defected);
    } catch (err: any) {
      console.error('Failed to load defected rolls:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredRolls = rolls.filter((r) => {
    const matchesStatus =
      filterStatus === 'ALL' ||
      (filterStatus === 'QC_HOLD' && (r.status === 'QC_HOLD' || r.qcStatus === 'ON_HOLD')) ||
      (filterStatus === 'QC_REJECTED' && (r.status === 'QC_REJECTED' || r.qcStatus === 'FAILED'));

    const searchLower = search.toLowerCase();
    const matchesSearch =
      !search ||
      r.rollNumber?.toLowerCase().includes(searchLower) ||
      r.batch?.batchNumber?.toLowerCase().includes(searchLower) ||
      r.batch?.fabricDescription?.toLowerCase().includes(searchLower) ||
      r.qcRemarks?.toLowerCase().includes(searchLower);

    return matchesStatus && matchesSearch;
  });

  const totalLength = rolls.reduce((acc, r) => acc + (parseFloat(r.length) || 0), 0);
  const holdCount = rolls.filter((r) => r.status === 'QC_HOLD' || r.qcStatus === 'ON_HOLD').length;
  const rejectedCount = rolls.filter((r) => r.status === 'QC_REJECTED' || r.qcStatus === 'FAILED').length;

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoll || !actionType) return;

    try {
      setSubmitting(true);
      setActionMessage(null);

      let payload: any = {};
      if (actionType === 'RELEASE') {
        payload = {
          status: 'IN_STOCK',
          qcStatus: 'PASSED',
          qcRemarks: remarks ? `Released from Defected Shelf: ${remarks}` : 'Released from Defected Shelf by Store Incharge',
        };
      } else if (actionType === 'MOVE') {
        payload = {
          qcRemarks: remarks ? `Assigned to shelf: ${shelfLocation}. ${remarks}` : `Assigned to shelf: ${shelfLocation}`,
        };
      } else if (actionType === 'SCRAP') {
        payload = {
          status: 'QC_REJECTED',
          qcStatus: 'FAILED',
          qcRemarks: remarks ? `Scrapped / Written-off: ${remarks}` : 'Permanently written off from Defected Shelf',
        };
      }

      const res = await fetch(`/api/fabric-store/rolls/${selectedRoll.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update roll');

      setActionMessage({
        type: 'success',
        text: `Roll ${selectedRoll.rollNumber} successfully updated.`,
      });
      setSelectedRoll(null);
      setActionType(null);
      setRemarks('');
      setShelfLocation('');
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0FAF9] pb-16">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/fabric-store"
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Fabric Store</span>
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-700">
              INVENTORY
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2 mt-0.5">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            Defected Shelf &amp; Quarantine Storage
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Isolated storage for rejected, on-hold, and defective fabric rolls segregated from production stock
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/fabric-store/my-work/qc-inspections"
            className="flex items-center gap-2 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-md shadow-xs transition"
          >
            <Clock className="w-4 h-4" />
            <span>QC Inspection Queue</span>
          </Link>
          <Link
            href="/fabric-store/inventory/stock"
            className="flex items-center gap-2 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-md shadow-xs transition"
          >
            <Layers className="w-4 h-4" />
            <span>Regular Stock</span>
          </Link>
        </div>
      </header>

      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {actionMessage && (
          <div
            className={`p-4 rounded-xl border text-xs font-medium flex items-center justify-between ${
              actionMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <span>{actionMessage.text}</span>
            <button
              onClick={() => setActionMessage(null)}
              className="text-slate-400 hover:text-slate-700 text-sm font-bold ml-4"
            >
              ×
            </button>
          </div>
        )}

        {/* STATS TILES */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-rose-200/80 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-rose-600">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Total Defected Rolls
              </span>
              <ShieldAlert className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold text-rose-700 mt-1">
              {loading ? '…' : rolls.length}
            </p>
            <span className="text-[10px] text-slate-500">Separated from regular issuance</span>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Quarantined Meters
              </span>
              <Archive className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {loading ? '…' : totalLength.toFixed(1)} <span className="text-sm font-normal text-slate-500">m</span>
            </p>
            <span className="text-[10px] text-slate-500">Non-usable fabric volume</span>
          </div>

          <div className="bg-white border border-amber-200/80 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-amber-600">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                On QC Hold
              </span>
              <Clock className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold text-amber-700 mt-1">
              {loading ? '…' : holdCount}
            </p>
            <span className="text-[10px] text-slate-500">Awaiting re-test or supplier review</span>
          </div>

          <div className="bg-white border border-rose-200/80 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-rose-600">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Definitively Rejected
              </span>
              <XCircle className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold text-rose-800 mt-1">
              {loading ? '…' : rejectedCount}
            </p>
            <span className="text-[10px] text-slate-500">For return to mill or scrap write-off</span>
          </div>
        </section>

        {/* TOOLBAR */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-2">
            {[
              { id: 'ALL', label: 'All Defected Rolls' },
              { id: 'QC_HOLD', label: 'On QC Hold' },
              { id: 'QC_REJECTED', label: 'Rejected' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  filterStatus === tab.id
                    ? 'bg-rose-700 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search roll #, batch, fabric, defect..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
        </div>

        {/* DEFECTED ROLLS TABLE */}
        <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200/80 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Quarantined Defected Inventory</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Physical defected shelf assignment: Storage bay DEF-A, DEF-B, or Quarantine Cage
              </p>
            </div>
            <span className="text-xs text-slate-500">
              Showing: <strong className="text-rose-900">{filteredRolls.length}</strong> rolls
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading defected shelf...</div>
          ) : filteredRolls.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <p className="text-sm font-semibold text-slate-800">Defected Shelf is Clean</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No fabric rolls are currently marked with defects or quarantined on hold. All fabric in store is cleared for production issuance.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/90 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Roll Number</th>
                    <th className="py-3 px-4">Batch Number</th>
                    <th className="py-3 px-4">Fabric Details</th>
                    <th className="py-3 px-4">Length</th>
                    <th className="py-3 px-4">Shelf / Bay Slot</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Defect Reason / QC Notes</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredRolls.map((roll) => (
                    <tr key={roll.id} className="hover:bg-rose-50/30 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-rose-900">
                        {roll.rollNumber}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px]">
                        {roll.batch?.batchNumber || '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-800 block">
                          {roll.batch?.fabricType || 'Fabric'}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {roll.batch?.fabricDescription} {roll.batch?.colorName ? `· ${roll.batch?.colorName}` : ''}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                        {parseFloat(roll.length).toFixed(2)} m
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-100/80 text-rose-800 border border-rose-200">
                          <Archive className="w-3 h-3" />
                          {roll.location?.locationCode || 'DEF-SHELF-01'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {roll.status === 'QC_REJECTED' || roll.qcStatus === 'FAILED' ? (
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800">
                            REJECTED
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800">
                            QC HOLD
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs truncate text-[11px] text-slate-600">
                        {roll.qcRemarks || 'Flagged for quality inspection / physical defect'}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => {
                            setSelectedRoll(roll);
                            setActionType('RELEASE');
                            setRemarks('');
                          }}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[11px] font-semibold transition"
                          title="Release back to stock"
                        >
                          Release
                        </button>
                        <button
                          onClick={() => {
                            setSelectedRoll(roll);
                            setActionType('MOVE');
                            setShelfLocation(roll.location?.locationCode || 'DEF-SHELF-02');
                            setRemarks('');
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold transition"
                          title="Assign shelf slot"
                        >
                          Shelf Slot
                        </button>
                        <button
                          onClick={() => {
                            setSelectedRoll(roll);
                            setActionType('SCRAP');
                            setRemarks('');
                          }}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-[11px] font-semibold transition"
                          title="Scrap / Write off"
                        >
                          Scrap
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* INFORMATION NOTE */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Defected Shelf Governance Protocol
            </h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed font-serif">
            Rolls stored on the Defected Shelf are physically segregated in the quarantine bay and cannot be selected for issuance in production challans. If a roll passes secondary inspection or laboratory clearance, use the <strong>Release</strong> action to return it to regular stock. Written-off or scrapped rolls are recorded in the Fabric Stock Ledger for audit accountability.
          </p>
        </div>

        {/* MODAL */}
        {selectedRoll && actionType && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b pb-3 border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  {actionType === 'RELEASE' && 'Release Roll to Production Stock'}
                  {actionType === 'MOVE' && 'Assign Defected Shelf Slot'}
                  {actionType === 'SCRAP' && 'Confirm Scrap & Write-Off'}
                </h3>
                <span className="font-mono text-xs font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded">
                  {selectedRoll.rollNumber}
                </span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200/70 rounded-lg text-xs space-y-1">
                <div>
                  <span className="text-slate-500">Fabric: </span>
                  <span className="font-semibold text-slate-800">
                    {selectedRoll.batch?.fabricType} · {selectedRoll.batch?.fabricDescription}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Meters: </span>
                  <span className="font-mono font-bold text-slate-900">
                    {parseFloat(selectedRoll.length).toFixed(2)} m
                  </span>
                </div>
                {selectedRoll.qcRemarks && (
                  <div>
                    <span className="text-slate-500">Defect: </span>
                    <span className="text-rose-700 italic">{selectedRoll.qcRemarks}</span>
                  </div>
                )}
              </div>

              <form onSubmit={handleActionSubmit} className="space-y-4">
                {actionType === 'MOVE' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Defected Shelf / Slot Code <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. DEF-SHELF-01, BIN-Q-3"
                      value={shelfLocation}
                      onChange={(e) => setShelfLocation(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded px-3 py-2 uppercase font-mono"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {actionType === 'RELEASE' && 'Release Justification / Inspection Notes'}
                    {actionType === 'MOVE' && 'Shelf Slot Notes (Optional)'}
                    {actionType === 'SCRAP' && 'Write-Off & Scrap Reason'}
                  </label>
                  <textarea
                    rows={3}
                    placeholder={
                      actionType === 'RELEASE'
                        ? 'e.g. Re-inspected by Incharge: defect was within tolerance after trimming 1m.'
                        : actionType === 'SCRAP'
                        ? 'e.g. Irreparable weft skewing; rejected by QA.'
                        : 'e.g. Relocated to defect shelf B for mill collection.'
                    }
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded px-3 py-2"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRoll(null);
                      setActionType(null);
                    }}
                    className="px-3.5 py-1.5 border border-slate-300 rounded text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className={`px-4 py-1.5 text-white rounded text-xs font-bold shadow-xs transition ${
                      actionType === 'RELEASE'
                        ? 'bg-emerald-700 hover:bg-emerald-800'
                        : actionType === 'SCRAP'
                        ? 'bg-rose-700 hover:bg-rose-800'
                        : 'bg-teal-700 hover:bg-teal-800'
                    }`}
                  >
                    {submitting
                      ? 'Processing...'
                      : actionType === 'RELEASE'
                      ? 'Release to Stock'
                      : actionType === 'SCRAP'
                      ? 'Confirm Write-Off'
                      : 'Save Shelf Slot'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
