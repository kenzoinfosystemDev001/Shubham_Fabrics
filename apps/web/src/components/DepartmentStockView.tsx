'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Boxes,
  RefreshCw,
  ArrowDownRight,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  Package,
  Layers,
  Search,
  ExternalLink,
  ShieldCheck,
  Send,
  Eye,
  Archive,
  Truck,
  Check,
} from 'lucide-react';

interface DepartmentStockViewProps {
  department: 'STORE' | 'DYEING' | 'DYEING_QC' | 'EMBROIDERY' | 'THREAD_CUTTING' | 'THREADCUT_QC' | 'PROGRAMMING';
  title?: string;
  accentColor?: string;
  createChallanUrl?: string;
}

export function DepartmentStockView({
  department,
  title,
  accentColor = 'indigo',
  createChallanUrl,
}: DepartmentStockViewProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const loadStock = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/departments/stock?department=${department}`);
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      }
    } catch (err) {
      console.error('Failed to load department stock:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStock();
  }, [department]);

  const handleReceiveMaterial = async (item: any) => {
    try {
      setReceivingId(item.id);
      const res = await fetch(`/api/challans/${item.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'RECEIVED',
          notes: `Material officially accepted into ${department.replace('_', ' ')} floor stock`,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to receive material');
      }
      setToastMsg(`Challan ${item.challanNumber} received successfully! Stock updated on-hand.`);
      setTimeout(() => setToastMsg(null), 4000);
      await loadStock();
    } catch (err: any) {
      alert(err.message || 'Error receiving material');
    } finally {
      setReceivingId(null);
    }
  };

  const summary = data?.summary || {
    totalReceived: 0,
    pendingInTransit: 0,
    pendingBatches: 0,
    totalDispatched: 0,
    totalDefective: 0,
    currentStockOnHand: 0,
    activeWip: 0,
    activeBatches: 0,
    unit: 'MTR',
    shelfCode: `DEF-SHELF-${department}`,
    shelfName: `${department} Defective Shelf`,
  };

  const inventory: any[] = data?.inventory || [];

  const filteredInventory = inventory.filter((item) => {
    if (statusFilter === 'IN_TRANSIT') {
      if (item.isReceived) return false;
    } else if (statusFilter === 'RECEIVED') {
      if (!item.isReceived) return false;
    } else if (statusFilter !== 'ALL' && item.status !== statusFilter) {
      return false;
    }
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.programSerialNo?.toLowerCase().includes(q) ||
      item.challanNumber?.toLowerCase().includes(q) ||
      item.clientName?.toLowerCase().includes(q) ||
      item.fabricDescription?.toLowerCase().includes(q) ||
      item.color?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm p-6 space-y-6">
      {/* TOAST MESSAGE */}
      {toastMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs font-semibold flex items-center gap-2 shadow-xs animate-in fade-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 block">
            REAL-TIME DEPARTMENT INVENTORY &amp; STOCK ACCOUNTING
          </span>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mt-0.5">
            <Boxes className="w-5 h-5 text-indigo-600" />
            <span>{title || `${department.replace('_', ' ')} Stock &amp; Material Balance`}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Zero-loss audit: In-Transit incoming challans must be received to update physical floor stock on-hand.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadStock}
            disabled={loading}
            className="p-2 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-600 transition cursor-pointer"
            title="Refresh Stock Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
          {createChallanUrl && (
            <Link
              href={createChallanUrl}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-lg shadow-xs transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Issue Challan</span>
            </Link>
          )}
        </div>
      </div>

      {/* IN-TRANSIT NOTIFICATION BANNER IF MATERIAL IS WAITING FOR RECEIPT */}
      {summary.pendingInTransit > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-950 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5 text-amber-700 animate-pulse" />
            </div>
            <div>
              <div className="font-bold text-xs">
                {summary.pendingInTransit} {summary.unit} Incoming In-Transit ({summary.pendingBatches} Challan{summary.pendingBatches === 1 ? '' : 's'})
              </div>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Material has moved to this department. Click <strong>Receive Material</strong> on the lot below to officially update on-hand stock.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStatusFilter('IN_TRANSIT')}
            className="self-start sm:self-center px-3 py-1.5 bg-lavender-600 hover:bg-lavender-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer whitespace-nowrap"
          >
            View Incoming Lots
          </button>
        </div>
      )}

      {/* METRIC TILES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
        {/* 1. Total Received On Floor */}
        <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-blue-800">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Received</span>
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-blue-950">
            {summary.totalReceived} <span className="text-xs font-sans font-medium text-blue-700">{summary.unit}</span>
          </div>
          <p className="text-[10px] text-blue-600">Accepted onto floor</p>
        </div>

        {/* 2. In-Transit / Pending Inward */}
        <div className={`p-4 rounded-xl space-y-1 border transition ${
          summary.pendingInTransit > 0
            ? 'bg-amber-50 border-amber-300 shadow-xs'
            : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center justify-between text-amber-800">
            <span className="text-[10px] font-bold uppercase tracking-wider">In-Transit</span>
            <Truck className={`w-4 h-4 ${summary.pendingInTransit > 0 ? 'text-amber-600 animate-pulse' : 'text-slate-400'}`} />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-950">
            {summary.pendingInTransit} <span className="text-xs font-sans font-medium text-amber-700">{summary.unit}</span>
          </div>
          <p className="text-[10px] text-amber-700">
            {summary.pendingBatches} Challan{summary.pendingBatches === 1 ? '' : 's'} awaiting receive
          </p>
        </div>

        {/* 3. In-Process WIP */}
        <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-purple-800">
            <span className="text-[10px] font-bold uppercase tracking-wider">Active WIP</span>
            <Layers className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-purple-950">
            {summary.activeWip} <span className="text-xs font-sans font-medium text-purple-700">Batches</span>
          </div>
          <p className="text-[10px] text-purple-700">In production process</p>
        </div>

        {/* 4. Dispatched Outflow */}
        <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-[10px] font-bold uppercase tracking-wider">Dispatched Out</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-950">
            {summary.totalDispatched} <span className="text-xs font-sans font-medium text-emerald-700">{summary.unit}</span>
          </div>
          <p className="text-[10px] text-emerald-600">Moved downstream</p>
        </div>

        {/* 5. Defective Quarantined */}
        <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-rose-800">
            <span className="text-[10px] font-bold uppercase tracking-wider">Defective Cuts</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-950">
            {summary.totalDefective} <span className="text-xs font-sans font-medium text-rose-700">{summary.unit}</span>
          </div>
          <p className="text-[10px] text-rose-700 font-mono truncate" title={summary.shelfCode}>
            On {summary.shelfCode}
          </p>
        </div>

        {/* 6. Net Stock On Hand */}
        <div className="p-4 bg-slate-900 text-white rounded-xl space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Net On Hand</span>
            <Package className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {summary.currentStockOnHand} <span className="text-xs font-sans font-medium text-slate-300">{summary.unit}</span>
          </div>
          <p className="text-[10px] text-slate-400">Physical floor stock</p>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Program #, Challan #, Fabric, Color..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lavender-600 focus:bg-white bg-slate-50 transition"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">Filter View:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Lots ({inventory.length})</option>
            <option value="IN_TRANSIT">Pending In-Transit ({inventory.filter((i) => !i.isReceived).length})</option>
            <option value="RECEIVED">Received On-Hand ({inventory.filter((i) => i.isReceived).length})</option>
            <option value="IN_PROCESS">In Process</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
      </div>

      {/* INVENTORY TABLE */}
      {filteredInventory.length === 0 ? (
        <div className="p-12 text-center space-y-2 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <Package className="w-10 h-10 text-slate-400 mx-auto" />
          <p className="text-xs font-semibold text-slate-700">No stock lots match the filter</p>
          <p className="text-[11px] text-slate-400">
            Material received via Challan from upstream stations will automatically appear in this department stock register.
          </p>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Challan / Program #</th>
                <th className="py-2.5 px-3">Client &amp; Style</th>
                <th className="py-2.5 px-3">Fabric &amp; Shade</th>
                <th className="py-2.5 px-3 text-right">Inflow ({summary.unit})</th>
                <th className="py-2.5 px-3 text-right">Defective ({summary.unit})</th>
                <th className="py-2.5 px-3 text-right">Outflow ({summary.unit})</th>
                <th className="py-2.5 px-3 text-right font-bold">On-Hand Stock</th>
                <th className="py-2.5 px-3 text-center">Receipt Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInventory.map((item, idx) => (
                <tr
                  key={item.id || idx}
                  className={`transition ${!item.isReceived ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'hover:bg-slate-50/80'}`}
                >
                  <td className="py-3 px-3 font-mono">
                    <span className="font-bold text-slate-900 block">{item.challanNumber}</span>
                    <span className="text-[10px] text-slate-500 font-sans">
                      Program #{item.programSerialNo}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-semibold text-slate-800 block truncate max-w-[150px]">
                      {item.clientName}
                    </span>
                    <span className="text-[10px] text-slate-500 truncate max-w-[150px] block">
                      {item.style}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-medium text-slate-800 block truncate max-w-[150px]">
                      {item.fabricDescription}
                    </span>
                    <span className="text-[10px] text-slate-500">{item.color}</span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-blue-700">
                    {item.quantityIn}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-rose-700">
                    {item.defectiveQuantity > 0 ? (
                      <span className="font-bold">-{item.defectiveQuantity}</span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-emerald-700">
                    {item.quantityOut > 0 ? (
                      <span>{item.quantityOut}</span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 bg-slate-50/60">
                    {item.isReceived ? (
                      <span className="text-slate-900">{item.balanceOnHand} {item.uom}</span>
                    ) : (
                      <span className="text-amber-700 font-semibold text-[11px]">0 (In-Transit)</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {!item.isReceived ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                        <Truck className="w-3 h-3 text-amber-600 animate-pulse" />
                        <span>Awaiting Receipt</span>
                      </span>
                    ) : (
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          item.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'IN_PROCESS'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {!item.isReceived ? (
                        <button
                          type="button"
                          disabled={receivingId === item.id}
                          onClick={() => handleReceiveMaterial(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-lavender-600 hover:bg-lavender-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
                          title="Click to receive this lot and update on-hand stock"
                        >
                          {receivingId === item.id ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Receiving...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Receive Material</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <Link
                          href={`/challans/${item.id}`}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                          <span>Challan</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
