'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  PackageCheck,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Plus,
  Boxes,
  Layers,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle
} from 'lucide-react';

export default function FabricBatchesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const loadBatches = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/fabric-store/batches');
      const json = await res.json();
      setBatches(json.data || []);
    } catch (err) {
      console.error('Failed to load fabric batches:', err);
      setBatches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  const filteredBatches = batches.filter((b) => {
    const matchesSearch =
      !searchQuery ||
      b.batchNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.fabricDescription?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.fabricType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.colorName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.colorCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.program?.programNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.program?.clientName?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL' || b.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalBatches = batches.length;
  const activeBatches = batches.filter((b) => b.status === 'ACTIVE').length;
  const holdBatches = batches.filter((b) => b.status === 'HOLD' || b.status === 'QC_HOLD').length;
  const totalRolls = batches.reduce((acc, b) => acc + (b._count?.rolls || 0), 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            ACTIVE
          </span>
        );
      case 'HOLD':
      case 'QC_HOLD':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            ON HOLD
          </span>
        );
      case 'DEPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            DEPLETED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#F0FAF9] pb-16">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-700 block">
            FABRIC STORE · INVENTORY
          </span>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-teal-700" />
            <span>Fabric Batches Registry</span>
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadBatches}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition"
            title="Refresh Batches"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <Link
            href="/fabric-store/my-work/material-receipt/create"
            className="flex items-center gap-2 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Receive New Batch (GRN)</span>
          </Link>
        </div>
      </header>

      {/* KPI METRICS BAR */}
      <div className="px-4 sm:px-8 pt-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 p-4 bg-white border border-teal-900/10 rounded-xl shadow-xs">
          <div className="p-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Batches</span>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{totalBatches}</p>
          </div>
          <div className="p-2 border-l border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Active Batches</span>
            <p className="text-2xl font-bold text-emerald-700 mt-0.5">{activeBatches}</p>
          </div>
          <div className="p-2 border-l border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">On Hold / QC</span>
            <p className="text-2xl font-bold text-amber-700 mt-0.5">{holdBatches}</p>
          </div>
          <div className="p-2 border-l border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700">Total Rolls Linked</span>
            <p className="text-2xl font-bold text-teal-800 mt-0.5">{totalRolls}</p>
          </div>
        </div>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="px-4 sm:px-8 pt-6 max-w-7xl mx-auto">
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by batch #, fabric, color, or program..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5" /> Filter:
            </span>
            {['ALL', 'ACTIVE', 'HOLD', 'DEPLETED'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  statusFilter === status
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TABLE / LIST */}
      <div className="px-4 sm:px-8 pt-6 max-w-7xl mx-auto">
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-20 text-center">
              <RefreshCw className="w-8 h-8 text-teal-600 animate-spin mx-auto mb-3" />
              <p className="text-xs font-semibold text-slate-500">Loading batch records...</p>
            </div>
          ) : filteredBatches.length === 0 ? (
            <div className="py-16 text-center px-4">
              <Boxes className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-700">No Batches Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                {searchQuery || statusFilter !== 'ALL'
                  ? 'No batches match your filter criteria. Try clearing filters.'
                  : 'No fabric batches registered yet. Batches are created when Material Receipts (GRN) are processed.'}
              </p>
              <div className="mt-4">
                <Link
                  href="/fabric-store/my-work/material-receipt/create"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg shadow-xs transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Receive GRN / New Batch</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4 font-bold">Batch Number</th>
                    <th className="py-3.5 px-4 font-bold">Fabric Specification</th>
                    <th className="py-3.5 px-4 font-bold">Color Details</th>
                    <th className="py-3.5 px-4 font-bold">Linked Program</th>
                    <th className="py-3.5 px-4 font-bold text-center">Rolls Count</th>
                    <th className="py-3.5 px-4 font-bold">Status</th>
                    <th className="py-3.5 px-4 font-bold">Received Date</th>
                    <th className="py-3.5 px-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBatches.map((batch) => (
                    <tr key={batch.id} className="hover:bg-slate-50/60 transition group">
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-teal-800 block text-xs">
                          {batch.batchNumber}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ID: {batch.id.slice(0, 8)}...
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{batch.fabricDescription || '—'}</div>
                        <div className="text-[11px] text-slate-500 font-medium">{batch.fabricType || 'KNIT'}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-3 h-3 rounded-full border border-slate-300 shadow-2xs shrink-0"
                            style={{ backgroundColor: batch.colorCode || '#CBD5E1' }}
                          />
                          <span className="font-medium text-slate-700">{batch.colorName || 'Natural/Raw'}</span>
                        </div>
                        {batch.colorCode && (
                          <span className="text-[10px] font-mono text-slate-400 block ml-4.5">
                            {batch.colorCode}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {batch.program ? (
                          <div>
                            <span className="font-mono font-semibold text-slate-800 block">
                              {batch.program.programNumber}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {batch.program.clientName || 'General'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-teal-50 text-teal-800 border border-teal-200">
                          {batch._count?.rolls || 0} Rolls
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {getStatusBadge(batch.status)}
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{new Date(batch.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/fabric-store/inventory/rolls?batchId=${batch.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-teal-700 hover:text-white text-slate-700 text-xs font-semibold rounded-lg transition"
                          title="View all individual rolls for this batch"
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
      </div>
    </div>
  );
}
