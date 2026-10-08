'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ListChecks, RefreshCw, MapPin, Eye, Filter } from 'lucide-react';

function InventoryRollsContent() {
  const searchParams = useSearchParams();
  const initialBatchId = searchParams.get('batchId') || '';

  const [loading, setLoading] = useState(true);
  const [rolls, setRolls] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [qcStatusFilter, setQcStatusFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [batchIdFilter, setBatchIdFilter] = useState(initialBatchId);

  // Moving location modal
  const [movingRoll, setMovingRoll] = useState<any>(null);
  const [newLocationId, setNewLocationId] = useState('');
  const [savingLocation, setSavingLocation] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (statusFilter) query.set('status', statusFilter);
      if (qcStatusFilter) query.set('qcStatus', qcStatusFilter);
      if (locationFilter) query.set('locationId', locationFilter);
      if (batchIdFilter) query.set('batchId', batchIdFilter);
      query.set('limit', '100');

      const [rollsRes, locsRes] = await Promise.all([
        fetch(`/api/fabric-store/rolls?${query.toString()}`),
        fetch('/api/fabric-store/locations'),
      ]);

      const rollsJson = await rollsRes.json();
      const locsJson = await locsRes.json();

      setRolls(rollsJson.data || []);
      setLocations(locsJson.data || []);
    } catch (err: any) {
      console.error('Failed to load rolls:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, qcStatusFilter, locationFilter, batchIdFilter]);

  const handleMoveLocation = async () => {
    if (!movingRoll) return;
    try {
      setSavingLocation(true);
      const res = await fetch(`/api/fabric-store/rolls/${movingRoll.id}/location`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId: newLocationId || null }),
      });
      if (res.ok) {
        setMovingRoll(null);
        await loadData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update location');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingLocation(false);
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      RECEIVED: 'bg-slate-100 text-slate-800',
      QC_HOLD: 'bg-amber-100 text-amber-800',
      QC_PASSED: 'bg-emerald-100 text-emerald-800',
      QC_REJECTED: 'bg-rose-100 text-rose-800',
      IN_STOCK: 'bg-teal-100 text-teal-800',
      ISSUED: 'bg-blue-100 text-blue-800',
      RETURNED: 'bg-purple-100 text-purple-800',
      CONSUMED: 'bg-slate-200 text-slate-800',
    };
    return (
      <span
        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
          colors[status] || 'bg-slate-100 text-slate-700'
        }`}
      >
        {status?.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#F0FAF9] pb-16">
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-700 block">
            FABRIC STORE · INVENTORY
          </span>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-teal-600" />
            Individual Fabric Roll Inventory
          </h1>
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
        </div>
      </header>

      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {/* Filters */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-md px-3 py-1.5"
            >
              <option value="">All Statuses</option>
              <option value="IN_STOCK">In Stock</option>
              <option value="RECEIVED">Received</option>
              <option value="QC_HOLD">QC Hold</option>
              <option value="ISSUED">Issued</option>
              <option value="RETURNED">Returned</option>
              <option value="QC_REJECTED">Rejected</option>
            </select>

            <select
              value={qcStatusFilter}
              onChange={(e) => setQcStatusFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-md px-3 py-1.5"
            >
              <option value="">All QC Statuses</option>
              <option value="PASSED">Passed</option>
              <option value="PENDING">Pending</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="FAILED">Failed</option>
            </select>

            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-md px-3 py-1.5"
            >
              <option value="">All Locations</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.locationCode} ({loc.locationName})
                </option>
              ))}
            </select>

            {batchIdFilter && (
              <button
                onClick={() => setBatchIdFilter('')}
                className="text-xs font-semibold text-rose-600 hover:underline"
              >
                Clear Batch Filter ✕
              </button>
            )}
          </div>
          <span className="text-xs text-slate-500">
            Total Rolls: <strong className="text-slate-800">{rolls.length}</strong>
          </span>
        </div>

        {/* Rolls table */}
        <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading rolls...</div>
          ) : rolls.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <ListChecks className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">No fabric rolls matching criteria</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Roll Number</th>
                    <th className="py-3 px-4">Batch #</th>
                    <th className="py-3 px-4">Fabric Description</th>
                    <th className="py-3 px-4">Length</th>
                    <th className="py-3 px-4">Width</th>
                    <th className="py-3 px-4">Weight</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">QC Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {rolls.map((roll) => (
                    <tr key={roll.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4 font-mono font-bold text-teal-900">{roll.rollNumber}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{roll.batch?.batchNumber}</td>
                      <td className="py-3 px-4">
                        <span className="font-semibold block text-slate-900">{roll.batch?.fabricType}</span>
                        <span className="text-[10px] text-slate-500">{roll.batch?.fabricDescription}</span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {parseFloat(roll.length).toFixed(2)} m
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {roll.width ? `${roll.width} cm` : '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {roll.weight ? `${roll.weight} kg` : '—'}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-teal-800">
                        {roll.location?.locationCode || 'UNASSIGNED'}
                      </td>
                      <td className="py-3 px-4">{statusBadge(roll.status)}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            roll.qcStatus === 'PASSED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : roll.qcStatus === 'ON_HOLD'
                              ? 'bg-amber-100 text-amber-800'
                              : roll.qcStatus === 'FAILED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-orange-100 text-orange-800'
                          }`}
                        >
                          {roll.qcStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setMovingRoll(roll);
                            setNewLocationId(roll.locationId || '');
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 hover:text-teal-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition"
                        >
                          <MapPin className="w-3 h-3 text-slate-500" />
                          <span>Assign Rack</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Location Assignment Modal */}
        {movingRoll && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-teal-600" />
                Assign Storage Location for {movingRoll.rollNumber}
              </h3>
              <p className="text-xs text-slate-500">
                Updating roll location automatically logs a TRANSFER entry in the immutable Stock Ledger.
              </p>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Select Target Storage Location
                </label>
                <select
                  value={newLocationId}
                  onChange={(e) => setNewLocationId(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-900 font-semibold focus:ring-1 focus:ring-teal-500"
                >
                  <option value="">-- No Location (Unassigned) --</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.locationCode} — {loc.locationName} ({loc.locationType})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMovingRoll(null)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingLocation}
                  onClick={handleMoveLocation}
                  className="px-4 py-1.5 bg-teal-700 text-white rounded text-xs font-bold hover:bg-teal-800 disabled:opacity-50"
                >
                  {savingLocation ? 'Updating...' : 'Save Location'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function InventoryRollsPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-[#F0FAF9] p-8 text-xs text-slate-400">Loading rolls inventory...</div>}>
      <InventoryRollsContent />
    </React.Suspense>
  );
}

