'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Warehouse,
  Boxes,
  Layers,
  Search,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  Printer,
  History,
  TrendingUp,
  MapPin,
  Barcode,
  ExternalLink,
} from 'lucide-react';
import { api } from '@/lib/api';

interface InventoryData {
  summary: {
    totalStockQuantity: number;
    totalCartonsCount: number;
    totalCartonPieces: number;
  };
  stockBalances: Array<{
    id: string;
    identifier: string;
    description?: string;
    currentQuantity: number;
    uom: string;
    updatedAt: string;
    programId?: string;
  }>;
  cartons: Array<{
    id: string;
    cartonNumber: string;
    size: string;
    colour?: string;
    quantity: number;
    grossWeightKg?: number;
    netWeightKg?: number;
    locationRack?: string;
    locationShelf?: string;
    barcode?: string;
    status: string;
    createdAt: string;
    program?: {
      programNumber?: string;
      styleCode?: string;
      clientName?: string;
      buyerName?: string;
    };
  }>;
  ledgerEntries: Array<{
    id: string;
    entryType: string;
    itemCode: string;
    itemName?: string;
    quantity: number;
    balanceAfter: number;
    referenceType?: string;
    referenceId?: string;
    remarks?: string;
    createdAt: string;
    program?: {
      programNumber?: string;
      styleCode?: string;
    };
    actor?: {
      fullName?: string;
    };
  }>;
}

export default function FinishedGoodsInventoryPage() {
  const [data, setData] = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'BALANCES' | 'CARTONS' | 'LEDGER'>('BALANCES');
  const [searchQuery, setSearchQuery] = useState('');

  const loadInventory = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setLoading(true);
      setError('');
      const params: any = {};
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await api.getFinishedGoodsInventory(params);
      if (res?.success && res.data) {
        setData(res.data);
      } else {
        const query = new URLSearchParams(params).toString();
        const fallbackRes = await fetch(`/api/packing/inventory?${query}`, { cache: 'no-store' });
        const json = await fallbackRes.json();
        if (json.success && json.data) {
          setData(json.data);
        } else {
          throw new Error(json.error || 'Failed to load inventory data');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error loading Finished Goods stock');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const summary = data?.summary;

  return (
    <div className="min-h-screen bg-canvas px-4 py-8 text-neutral-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* HEADER */}
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-600 border border-brand-500/30">
                <Warehouse className="w-3.5 h-3.5" />
                Finished Goods Warehouse (FG Store)
              </span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold text-neutral-900 tracking-tight">
              Finished Goods Inventory & Ledger
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Authoritative stock balance snapshots, physical carton warehouse registry, and immutable stock ledger audit.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => void loadInventory()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 py-2 text-xs font-semibold text-neutral-900 transition hover:bg-neutral-200 hover:text-neutral-900 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-accent-700' : ''}`} />
              <span>Refresh</span>
            </button>
            <Link
              href="/packing/workspace"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-700 shadow-sm"
            >
              <Boxes className="w-4 h-4" />
              <span>Pack Cartons</span>
            </Link>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-danger-500/40 bg-danger-500/10 p-4 text-sm text-danger-600 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-danger-600" />
            <p className="font-semibold">{error}</p>
          </div>
        )}

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
              Total Finished Goods Stock
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-neutral-900">
                {(summary?.totalStockQuantity ?? 0).toLocaleString()}
              </span>
              <span className="text-xs font-medium text-neutral-500">pcs</span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">Authoritative available balance</p>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
              Total Cartons on Shelf
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-neutral-900">
                {(summary?.totalCartonsCount ?? 0).toLocaleString()}
              </span>
              <span className="text-xs font-medium text-neutral-500">cartons</span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">
              Containing {(summary?.totalCartonPieces ?? 0).toLocaleString()} packaged garments
            </p>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
              Stock Ledger Transactions
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-brand-600">
                {data?.ledgerEntries?.length ?? 0}
              </span>
              <span className="text-xs font-medium text-neutral-500">recent receipts</span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">Immutable double-entry audit records</p>
          </div>
        </div>

        {/* NAVIGATION TABS & SEARCH */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-neutral-200">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('BALANCES')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'BALANCES'
                  ? 'bg-accent-400 text-neutral-900 shadow-sm'
                  : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>SKU Stock Balances ({data?.stockBalances?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('CARTONS')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'CARTONS'
                  ? 'bg-accent-400 text-neutral-900 shadow-sm'
                  : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
            >
              <Boxes className="w-4 h-4" />
              <span>Physical Cartons ({data?.cartons?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('LEDGER')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'LEDGER'
                  ? 'bg-accent-400 text-neutral-900 shadow-sm'
                  : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Stock Ledger Audit ({data?.ledgerEntries?.length || 0})</span>
            </button>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="Search Style, SKU, Carton #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-canvas border border-neutral-200 rounded-lg pl-9 pr-3 py-2 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-brand-500 transition"
            />
          </div>
        </div>

        {/* TAB 1: SKU STOCK BALANCES */}
        {activeTab === 'BALANCES' && (
          <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-neutral-700">
                <thead className="bg-white text-[11px] font-bold uppercase tracking-wider text-neutral-500 border-b border-neutral-200">
                  <tr>
                    <th className="px-4 py-3.5">SKU / Identifier</th>
                    <th className="px-4 py-3.5">Description</th>
                    <th className="px-4 py-3.5 text-right">Available Stock</th>
                    <th className="px-4 py-3.5 text-center">UOM</th>
                    <th className="px-4 py-3.5 text-right">Last Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {data?.stockBalances && data.stockBalances.length > 0 ? (
                    data.stockBalances.map((stock) => (
                      <tr key={stock.id} className="hover:bg-neutral-100 transition">
                        <td className="px-4 py-3.5 font-mono font-bold text-accent-700">
                          {stock.identifier}
                        </td>
                        <td className="px-4 py-3.5 text-neutral-700">
                          {stock.description || 'Finished Goods Garment'}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-black text-sm text-accent-700">
                          {Number(stock.currentQuantity).toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5 text-center font-mono text-[11px] text-neutral-500">
                          {stock.uom || 'PCS'}
                        </td>
                        <td className="px-4 py-3.5 text-right text-neutral-500 text-[11px]">
                          {new Date(stock.updatedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-neutral-500">
                        No stock balances found in Finished Goods.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: PHYSICAL CARTONS */}
        {activeTab === 'CARTONS' && (
          <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-neutral-700">
                <thead className="bg-white text-[11px] font-bold uppercase tracking-wider text-neutral-500 border-b border-neutral-200">
                  <tr>
                    <th className="px-4 py-3.5">Carton # / Barcode</th>
                    <th className="px-4 py-3.5">Program & Style</th>
                    <th className="px-4 py-3.5">Size / Colour</th>
                    <th className="px-4 py-3.5 text-right">Pieces</th>
                    <th className="px-4 py-3.5">Rack / Shelf</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    <th className="px-4 py-3.5 text-right">Packed At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 font-mono">
                  {data?.cartons && data.cartons.length > 0 ? (
                    data.cartons.map((ctn) => (
                      <tr key={ctn.id} className="hover:bg-neutral-100 transition">
                        <td className="px-4 py-3.5">
                          <span className="font-bold text-accent-700 block">{ctn.cartonNumber}</span>
                          <span className="text-[10px] text-neutral-500 flex items-center gap-1 font-mono">
                            <Barcode className="w-3 h-3" /> {ctn.barcode || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-sans">
                          <span className="font-bold text-neutral-900 block">
                            Prog #{ctn.program?.programNumber || 'N/A'}
                          </span>
                          <span className="text-[11px] text-neutral-500 block">
                            {ctn.program?.styleCode || 'N/A'} &bull; {ctn.program?.clientName || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-sans">
                          <span className="font-bold text-neutral-900">{ctn.size}</span>
                          {ctn.colour && (
                            <span className="text-[10px] text-neutral-500 block">{ctn.colour}</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right font-black text-sm text-accent-700">
                          {ctn.quantity} <span className="text-[10px] font-normal text-neutral-500 font-sans">pcs</span>
                        </td>
                        <td className="px-4 py-3.5 text-neutral-700">
                          <span className="flex items-center gap-1 text-[11px]">
                            <MapPin className="w-3 h-3 text-neutral-500" />
                            Rack: {ctn.locationRack || 'A1'} / Shelf: {ctn.locationShelf || 'S1'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center font-sans">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-accent-400/20 text-accent-700 border border-accent-500/40">
                            {ctn.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right text-neutral-500 text-[11px] font-sans">
                          {new Date(ctn.createdAt).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-neutral-500 font-sans">
                        No physical cartons registered in warehouse.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: STOCK LEDGER AUDIT */}
        {activeTab === 'LEDGER' && (
          <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-neutral-700">
                <thead className="bg-white text-[11px] font-bold uppercase tracking-wider text-neutral-500 border-b border-neutral-200">
                  <tr>
                    <th className="px-4 py-3.5">Timestamp</th>
                    <th className="px-4 py-3.5">Type / Ref</th>
                    <th className="px-4 py-3.5">Item / SKU</th>
                    <th className="px-4 py-3.5 text-right">Movement</th>
                    <th className="px-4 py-3.5 text-right">Balance After</th>
                    <th className="px-4 py-3.5">Operator</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 font-mono">
                  {data?.ledgerEntries && data.ledgerEntries.length > 0 ? (
                    data.ledgerEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-neutral-100 transition">
                        <td className="px-4 py-3.5 text-neutral-500 text-[11px]">
                          {new Date(entry.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-accent-400/20 text-accent-700 border border-accent-500/40">
                            {entry.entryType}
                          </span>
                          <span className="text-[10px] text-neutral-500 block mt-1 truncate max-w-[120px]">
                            {entry.referenceType}: {entry.referenceId || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-neutral-900 font-bold">
                          {entry.itemCode}
                          {entry.itemName && (
                            <span className="text-[10px] text-neutral-500 block font-normal font-sans">
                              {entry.itemName}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right font-black text-accent-700">
                          +{entry.quantity}
                        </td>
                        <td className="px-4 py-3.5 text-right font-black text-neutral-900">
                          {entry.balanceAfter}
                        </td>
                        <td className="px-4 py-3.5 text-neutral-500 font-sans text-[11px]">
                          {entry.actor?.fullName || 'Packing Supervisor'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-neutral-500 font-sans">
                        No ledger movements recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
