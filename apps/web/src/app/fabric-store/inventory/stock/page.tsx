'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Boxes, RefreshCw, Eye, Layers, Filter, AlertTriangle, X } from 'lucide-react';
import { DepartmentStockView } from '@/components/DepartmentStockView';

export default function InventoryStockPage() {
  const [activeView, setActiveView] = useState<'balance' | 'batches'>('balance');
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
      PENDING_RECEIPT: 'bg-neutral-100 text-neutral-700',
      PARTIALLY_RECEIVED: 'bg-accent-100 text-accent-800',
      RECEIVED: 'bg-brand-100 text-brand-800',
      IN_STOCK: 'bg-brand-100 text-brand-800',
      PARTIALLY_ISSUED: 'bg-brand-100 text-brand-800',
      FULLY_ISSUED: 'bg-neutral-200 text-neutral-900',
      REJECTED: 'bg-danger-100 text-danger-800',
    };
    return (
      <span
        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
          colors[status] || 'bg-neutral-100 text-neutral-700'
        }`}
      >
        {status?.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-brand-50 pb-16">
      <header className="bg-white border-b border-neutral-200/80 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-700 block">
            FABRIC STORE · INVENTORY
          </span>
          <h1 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
            <Boxes className="w-5 h-5 text-brand-600" />
            Fabric Batch Stock
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {/* VIEW TABS: Store Balance & Stock | Batch Stock Ledger */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveView('balance')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeView === 'balance'
                  ? 'bg-brand-700 text-white shadow-xs'
                  : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200'
              }`}
            >
              <Boxes className="w-4 h-4" />
              <span>Store Material Balance &amp; Stock</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('batches')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeView === 'batches'
                  ? 'bg-brand-700 text-white shadow-xs'
                  : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Batch-wise Stock Ledger ({filteredBatches.length})</span>
            </button>
          </div>

          <Link
            href="/fabric-store/inventory/defected-shelf"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-danger-50 hover:bg-danger-100 text-danger-800 border border-danger-200 rounded-xl text-xs font-bold transition"
          >
            <AlertTriangle className="w-4 h-4 text-danger-600" />
            <span>Master Defective Shelf (DEF-SHELF-CENTRAL)</span>
          </Link>
        </div>

        {/* VIEW 1: STORE MATERIAL BALANCE & REAL-TIME LEDGER */}
        {activeView === 'balance' && (
          <DepartmentStockView
            department="STORE"
            title="Raw Fabric Store Stock &amp; Material Ledger"
            createChallanUrl="/fabric-store/my-work/challan-to-dyeing"
          />
        )}

        {/* VIEW 2: BATCH-WISE STOCK LEDGER */}
        {activeView === 'batches' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-neutral-200/90 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-700">Fabric Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="text-xs border border-neutral-300 rounded-md px-3 py-1.5"
              >
                <option value="">All Types</option>
                <option value="KORA">KORA</option>
                <option value="DYED">DYED</option>
                <option value="WOVEN">WOVEN</option>
                <option value="BLENDED">BLENDED</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-700">Batch Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs border border-neutral-300 rounded-md px-3 py-1.5"
              >
                <option value="">All Statuses</option>
                <option value="IN_STOCK">In Stock</option>
                <option value="RECEIVED">Received</option>
                <option value="PARTIALLY_ISSUED">Partially Issued</option>
                <option value="FULLY_ISSUED">Fully Issued</option>
              </select>
            </div>
          </div>
          <span className="text-xs text-neutral-500">
            Total Batches: <strong className="text-neutral-900">{filteredBatches.length}</strong>
          </span>
        </div>

        {/* Stock table */}
        <div className="bg-white border border-neutral-200/90 rounded-xl shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-xs text-neutral-500">Loading stock records...</div>
          ) : filteredBatches.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <Boxes className="w-10 h-10 text-neutral-700 mx-auto" />
              <p className="text-sm font-semibold text-neutral-700">No stock batches found</p>
              <p className="text-xs text-neutral-500">Inward fabric through Material Receipt to populate batch stock.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50/80 text-neutral-600 font-semibold border-b border-neutral-200">
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
                <tbody className="divide-y divide-neutral-100 text-neutral-700">
                  {filteredBatches.map((batch) => (
                    <tr key={batch.id} className="hover:bg-neutral-50/60 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-brand-800">
                        {batch.batchNumber}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-neutral-900">{batch.fabricType}</td>
                      <td className="py-3.5 px-4 text-neutral-700">{batch.fabricDescription}</td>
                      <td className="py-3.5 px-4 text-neutral-700">{batch.colorName || '—'}</td>
                      <td className="py-3.5 px-4 font-mono text-neutral-500">
                        {batch.program?.programNumber || '—'}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-neutral-900">
                        {batch.totalRolls}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-neutral-900">
                        {parseFloat(batch.totalMeters).toFixed(2)} m
                      </td>
                      <td className="py-3.5 px-4">{statusBadge(batch.status)}</td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => viewBatchDetail(batch.id)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-700 hover:text-brand-900 bg-neutral-100 hover:bg-brand-50 px-2.5 py-1 rounded transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Batch Details</span>
                        </button>
                        <Link
                          href={`/fabric-store/inventory/rolls?batchId=${batch.id}`}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-700 hover:text-brand-900 bg-brand-50 hover:bg-brand-100 px-2.5 py-1 rounded transition"
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
          </div>
        )}

        {/* Batch Details Modal */}
        {selectedBatch && (
          <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700 block">
                    BATCH PROFILE
                  </span>
                  <h3 className="text-lg font-bold text-neutral-900 font-mono">
                    {selectedBatch.batchNumber}
                  </h3>
                </div>
                <button
                  aria-label="Close"
                  onClick={() => setSelectedBatch(null)}
                  className="text-neutral-500 hover:text-neutral-700 text-lg font-bold p-1"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-neutral-500 text-[10px] font-bold uppercase block">Fabric Type</span>
                  <span className="font-semibold text-neutral-900">{selectedBatch.fabricType}</span>
                </div>
                <div>
                  <span className="text-neutral-500 text-[10px] font-bold uppercase block">Color</span>
                  <span className="font-semibold text-neutral-900">{selectedBatch.colorName || 'Natural'}</span>
                </div>
                <div>
                  <span className="text-neutral-500 text-[10px] font-bold uppercase block">Total Rolls</span>
                  <span className="font-mono font-bold text-neutral-900">{selectedBatch.rolls?.length || 0}</span>
                </div>
                <div>
                  <span className="text-neutral-500 text-[10px] font-bold uppercase block">Total Meters</span>
                  <span className="font-mono font-bold text-brand-800">{parseFloat(selectedBatch.totalMeters).toFixed(2)} m</span>
                </div>
              </div>

              {/* Rolls breakdown in batch */}
              <div className="pt-2">
                <h4 className="text-xs font-bold text-neutral-900 mb-2">Rolls in Batch:</h4>
                <div className="border border-neutral-200 rounded-lg overflow-x-auto max-h-64">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-50 text-neutral-600 font-semibold border-b border-neutral-200 sticky top-0">
                      <tr>
                        <th className="py-2 px-3">Roll #</th>
                        <th className="py-2 px-3">Length</th>
                        <th className="py-2 px-3">Width</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">QC Status</th>
                        <th className="py-2 px-3">Location</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 text-neutral-700">
                      {selectedBatch.rolls?.map((r: any) => (
                        <tr key={r.id}>
                          <td className="py-2 px-3 font-mono font-bold text-neutral-900">{r.rollNumber}</td>
                          <td className="py-2 px-3 font-mono">{parseFloat(r.length).toFixed(2)} m</td>
                          <td className="py-2 px-3 font-mono">{r.width ? `${r.width} cm` : '—'}</td>
                          <td className="py-2 px-3 font-semibold">{r.status}</td>
                          <td className="py-2 px-3">{r.qcStatus}</td>
                          <td className="py-2 px-3 font-mono text-neutral-500">{r.location?.locationCode || 'UNASSIGNED'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedBatch(null)}
                  className="px-4 py-2 bg-brand-600 text-white rounded-md text-xs font-bold"
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
