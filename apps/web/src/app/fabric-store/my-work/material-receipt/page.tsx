'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { PackageCheck, Plus, RefreshCw, Eye, CheckCircle2 } from 'lucide-react';
import { formatUnitTotals } from '@/lib/fabric-stock';

export default function MaterialReceiptListPage() {
  const [loading, setLoading] = useState(true);
  const [grns, setGrns] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const url = statusFilter
        ? `/api/fabric-store/grn?status=${encodeURIComponent(statusFilter)}`
        : '/api/fabric-store/grn';
      const res = await fetch(url);
      const json = await res.json();
      setGrns(json.data || []);
    } catch (e) {
      console.error('Failed to load GRNs:', e);
      setGrns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleConfirmGRN = async (id: string) => {
    try {
      setConfirmingId(id);
      const res = await fetch(`/api/fabric-store/grn/${id}/confirm`, {
        method: 'PATCH',
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to confirm GRN');
      } else {
        await loadData();
      }
    } catch (err: any) {
      alert(err.message || 'Error confirming GRN');
    } finally {
      setConfirmingId(null);
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-accent-100 text-accent-800 border-accent-200',
      CONFIRMED: 'bg-brand-100 text-brand-800 border-brand-200',
      QC_PENDING: 'bg-accent-100 text-accent-800 border-accent-200',
      QC_COMPLETE: 'bg-brand-100 text-brand-800 border-brand-200',
      CLOSED: 'bg-accent-100 text-accent-800 border-accent-200',
    };
    return (
      <span
        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
          colors[status] || 'bg-neutral-100 text-neutral-700'
        }`}
      >
        {status?.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-brand-50">
      <header className="bg-white border-b border-neutral-200/80 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-700 block">
            FABRIC STORE · MY WORK
          </span>
          <h1 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-brand-600" />
            Material Receipt (GRN)
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
          <Link
            href="/fabric-store/my-work/material-receipt/create"
            className="flex items-center gap-2 px-3.5 py-2 bg-brand-700 hover:bg-brand-800 text-white text-xs font-semibold rounded-md shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create New GRN</span>
          </Link>
        </div>
      </header>

      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {/* Filters */}
        <div className="bg-white p-4 rounded-xl border border-neutral-200/90 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-700">Filter Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs border border-neutral-300 rounded-md px-3 py-1.5 bg-white text-neutral-900 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="QC_PENDING">QC Pending</option>
              <option value="QC_COMPLETE">QC Complete</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
          <span className="text-xs text-neutral-500">
            Total records: <strong className="text-neutral-900">{grns.length}</strong>
          </span>
        </div>

        {/* Table */}
        <div className="bg-white border border-neutral-200/90 rounded-xl shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-xs text-neutral-500">Loading GRN records...</div>
          ) : grns.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <PackageCheck className="w-10 h-10 text-neutral-700 mx-auto" />
              <p className="text-sm font-semibold text-neutral-700">No Goods Receipt Notes found</p>
              <p className="text-xs text-neutral-500">Inward fabric from suppliers to generate GRN records.</p>
              <Link
                href="/fabric-store/my-work/material-receipt/create"
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-brand-700 text-white text-xs font-semibold rounded-md shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Create GRN</span>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50/80 text-neutral-600 font-semibold border-b border-neutral-200">
                  <tr>
                    <th className="py-3 px-4">GRN Number</th>
                    <th className="py-3 px-4">Date Received</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Vehicle #</th>
                    <th className="py-3 px-4">Batch Number</th>
                    <th className="py-3 px-4">Fabric Details</th>
                    <th className="py-3 px-4">Rolls</th>
                    <th className="py-3 px-4">Total Quantity</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-neutral-700">
                  {grns.map((grn) => (
                    <tr key={grn.id} className="hover:bg-neutral-50/60 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-brand-800">
                        {grn.grnNumber}
                      </td>
                      <td className="py-3.5 px-4 text-neutral-600">
                        {new Date(grn.receivedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-neutral-900">{grn.supplierName}</td>
                      <td className="py-3.5 px-4 font-mono text-neutral-500">
                        {grn.vehicleNumber || '—'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-neutral-700">
                        {grn.batch?.batchNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold block text-neutral-900">
                          {grn.batch?.fabricType}
                        </span>
                        <span className="text-[10px] text-neutral-500">
                          {grn.batch?.fabricDescription} {grn.batch?.colorName ? `· ${grn.batch.colorName}` : ''}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-neutral-900">
                        {grn.totalRollsReceived}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-neutral-900">
                        {formatUnitTotals({ MTR: parseFloat(grn.totalMetersReceived) || 0, PCS: parseFloat(grn.totalPiecesReceived) || 0 })}
                      </td>
                      <td className="py-3.5 px-4">{statusBadge(grn.status)}</td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        {grn.status === 'DRAFT' && (
                          <button
                            onClick={() => handleConfirmGRN(grn.id)}
                            disabled={confirmingId === grn.id}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-brand-700 hover:bg-brand-800 px-2.5 py-1 rounded shadow-2xs transition disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{confirmingId === grn.id ? 'Confirming...' : 'Confirm'}</span>
                          </button>
                        )}
                        <Link
                          href={`/fabric-store/inventory/rolls?batchId=${grn.batchId}`}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-700 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 px-2.5 py-1 rounded transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Rolls</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
