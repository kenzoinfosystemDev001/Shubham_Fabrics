'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { PackageCheck, Plus, RefreshCw, Eye, CheckCircle2 } from 'lucide-react';

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
      DRAFT: 'bg-amber-100 text-amber-800 border-amber-200',
      CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-200',
      QC_PENDING: 'bg-orange-100 text-orange-800 border-orange-200',
      QC_COMPLETE: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      CLOSED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    };
    return (
      <span
        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
          colors[status] || 'bg-slate-100 text-slate-700'
        }`}
      >
        {status?.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#F0FAF9]">
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-700 block">
            FABRIC STORE · MY WORK
          </span>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-teal-600" />
            Material Receipt (GRN)
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
          <Link
            href="/fabric-store/my-work/material-receipt/create"
            className="flex items-center gap-2 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-md shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create New GRN</span>
          </Link>
        </div>
      </header>

      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {/* Filters */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">Filter Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-md px-3 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="QC_PENDING">QC Pending</option>
              <option value="QC_COMPLETE">QC Complete</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
          <span className="text-xs text-slate-500">
            Total records: <strong className="text-slate-800">{grns.length}</strong>
          </span>
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading GRN records...</div>
          ) : grns.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <PackageCheck className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">No Goods Receipt Notes found</p>
              <p className="text-xs text-slate-500">Inward fabric from suppliers to generate GRN records.</p>
              <Link
                href="/fabric-store/my-work/material-receipt/create"
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-teal-700 text-white text-xs font-semibold rounded-md shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Create GRN</span>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">GRN Number</th>
                    <th className="py-3 px-4">Date Received</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Vehicle #</th>
                    <th className="py-3 px-4">Batch Number</th>
                    <th className="py-3 px-4">Fabric Details</th>
                    <th className="py-3 px-4">Rolls</th>
                    <th className="py-3 px-4">Total Meters</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {grns.map((grn) => (
                    <tr key={grn.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-teal-800">
                        {grn.grnNumber}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {new Date(grn.receivedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-900">{grn.supplierName}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">
                        {grn.vehicleNumber || '—'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700">
                        {grn.batch?.batchNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold block text-slate-900">
                          {grn.batch?.fabricType}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {grn.batch?.fabricDescription} {grn.batch?.colorName ? `· ${grn.batch.colorName}` : ''}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {grn.totalRollsReceived}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">
                        {parseFloat(grn.totalMetersReceived).toFixed(2)} m
                      </td>
                      <td className="py-3.5 px-4">{statusBadge(grn.status)}</td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        {grn.status === 'DRAFT' && (
                          <button
                            onClick={() => handleConfirmGRN(grn.id)}
                            disabled={confirmingId === grn.id}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-teal-700 hover:bg-teal-800 px-2.5 py-1 rounded shadow-2xs transition disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{confirmingId === grn.id ? 'Confirming...' : 'Confirm'}</span>
                          </button>
                        )}
                        <Link
                          href={`/fabric-store/inventory/rolls?batchId=${grn.batchId}`}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded transition"
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
