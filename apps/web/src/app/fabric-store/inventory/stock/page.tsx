'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Boxes, RefreshCw, Eye, Layers, Filter } from 'lucide-react';

export default function InventoryStockPage() {
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedBatch, setSelectedBatch] = useState<any>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const url = statusFilter
        ? `/api/fabric-store/batches?status=${encodeURIComponent(statusFilter)}`
        : '/api/fabric-store/batches';
      const res = await fetch(url);
      const json = await res.json();
      setBatches(json.data || []);
    } catch (err: any) {
      console.error('Failed to load stock batches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const viewBatchDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/fabric-store/batches/${id}`);
      const json = await res.json();
      if (res.ok) setSelectedBatch(json.data);
    } catch {}
  };

  const filteredBatches = batches.filter((b) => {
    if (typeFilter && b.fabricType !== typeFilter) return false;
    return true;
  });

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      PENDING_RECEIPT: 'bg-slate-100 text-slate-700',
      PARTIALLY_RECEIVED: 'bg-amber-100 text-amber-800',
      RECEIVED: 'bg-blue-100 text-blue-800',
      IN_STOCK: 'bg-teal-100 text-teal-800',
      PARTIALLY_ISSUED: 'bg-indigo-100 text-indigo-800',
      FULLY_ISSUED: 'bg-slate-200 text-slate-800',
      REJECTED: 'bg-rose-100 text-rose-800',
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
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-8 py-4 flex items-center justify-between shadow-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-700 block">
            FABRIC STORE · INVENTORY
          </span>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Boxes className="w-5 h-5 text-teal-600" />
            Fabric Batch Stock
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

      <main className="p-8 max-w-7xl mx-auto space-y-6">
        {/* Filters */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Fabric Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="text-xs border border-slate-300 rounded-md px-3 py-1.5"
              >
                <option value="">All Types</option>
                <option value="KORA">KORA</option>
                <option value="DYED">DYED</option>
                <option value="WOVEN">WOVEN</option>
                <option value="BLENDED">BLENDED</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Batch Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs border border-slate-300 rounded-md px-3 py-1.5"
              >
                <option value="">All Statuses</option>
                <option value="IN_STOCK">In Stock</option>
                <option value="RECEIVED">Received</option>
                <option value="PARTIALLY_ISSUED">Partially Issued</option>
                <option value="FULLY_ISSUED">Fully Issued</option>
              </select>
            </div>
          </div>
          <span className="text-xs text-slate-500">
            Total Batches: <strong className="text-slate-800">{filteredBatches.length}</strong>
          </span>
        </div>

        {/* Stock table */}
        <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading stock records...</div>
          ) : filteredBatches.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <Boxes className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">No stock batches found</p>
              <p className="text-xs text-slate-500">Inward fabric through Material Receipt to populate batch stock.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Batch Number</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Color</th>
                    <th className="py-3 px-4">Program Ref</th>
                    <th className="py-3 px-4">Total Rolls</th>
                    <th className="py-3 px-4">Total Meters</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredBatches.map((batch) => (
                    <tr key={batch.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-teal-800">
                        {batch.batchNumber}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">{batch.fabricType}</td>
                      <td className="py-3.5 px-4 text-slate-700">{batch.fabricDescription}</td>
                      <td className="py-3.5 px-4 text-slate-700">{batch.colorName || '—'}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">
                        {batch.program?.programNumber || '—'}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {batch.totalRolls}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">
                        {parseFloat(batch.totalMeters).toFixed(2)} m
                      </td>
                      <td className="py-3.5 px-4">{statusBadge(batch.status)}</td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => viewBatchDetail(batch.id)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 hover:text-teal-900 bg-slate-100 hover:bg-teal-50 px-2.5 py-1 rounded transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Batch Details</span>
                        </button>
                        <Link
                          href={`/fabric-store/inventory/rolls?batchId=${batch.id}`}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-2.5 py-1 rounded transition"
                        >
                          Rolls ({batch._count?.rolls || 0})
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Batch Details Modal */}
        {selectedBatch && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 block">
                    BATCH PROFILE
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 font-mono">
                    {selectedBatch.batchNumber}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedBatch(null)}
                  className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] font-bold uppercase block">Fabric Type</span>
                  <span className="font-semibold text-slate-900">{selectedBatch.fabricType}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] font-bold uppercase block">Color</span>
                  <span className="font-semibold text-slate-900">{selectedBatch.colorName || 'Natural'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] font-bold uppercase block">Total Rolls</span>
                  <span className="font-mono font-bold text-slate-900">{selectedBatch.rolls?.length || 0}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] font-bold uppercase block">Total Meters</span>
                  <span className="font-mono font-bold text-teal-800">{parseFloat(selectedBatch.totalMeters).toFixed(2)} m</span>
                </div>
              </div>

              {/* Rolls breakdown in batch */}
              <div className="pt-2">
                <h4 className="text-xs font-bold text-slate-900 mb-2">Rolls in Batch:</h4>
                <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-64">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="py-2 px-3">Roll #</th>
                        <th className="py-2 px-3">Length</th>
                        <th className="py-2 px-3">Width</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">QC Status</th>
                        <th className="py-2 px-3">Location</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {selectedBatch.rolls?.map((r: any) => (
                        <tr key={r.id}>
                          <td className="py-2 px-3 font-mono font-bold text-slate-800">{r.rollNumber}</td>
                          <td className="py-2 px-3 font-mono">{parseFloat(r.length).toFixed(2)} m</td>
                          <td className="py-2 px-3 font-mono">{r.width ? `${r.width} cm` : '—'}</td>
                          <td className="py-2 px-3 font-semibold">{r.status}</td>
                          <td className="py-2 px-3">{r.qcStatus}</td>
                          <td className="py-2 px-3 font-mono text-slate-500">{r.location?.locationCode || 'UNASSIGNED'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedBatch(null)}
                  className="px-4 py-2 bg-slate-800 text-white rounded-md text-xs font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
