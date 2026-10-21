'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Boxes,
  Layers,
  RefreshCw,
  Search,
  Filter,
  ArrowDownToLine,
  Send,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

interface StockSummary {
  overall: {
    totalInwardMeters: number;
    totalOutwardMeters: number;
    availableBalanceMeters: number;
    totalInwardPcs: number;
    totalOutwardPcs: number;
    availableBalancePcs: number;
    itemCount: number;
  };
  undyed?: {
    totalInwardMeters: number;
    totalOutwardMeters: number;
    availableBalanceMeters: number;
    totalInwardPcs: number;
    totalOutwardPcs: number;
    availableBalancePcs: number;
    itemCount: number;
  };
  kora?: {
    totalInwardMeters: number;
    totalOutwardMeters: number;
    availableBalanceMeters: number;
    totalInwardPcs: number;
    totalOutwardPcs: number;
    availableBalancePcs: number;
    itemCount: number;
  };
  dyed: {
    totalInwardMeters: number;
    totalOutwardMeters: number;
    availableBalanceMeters: number;
    totalInwardPcs: number;
    totalOutwardPcs: number;
    availableBalancePcs: number;
    itemCount: number;
  };
  defectiveStockPcs: number;
}

interface StockItem {
  sNo: number;
  itemName: string;
  fabricType: 'UNDYED' | 'DYED' | 'KORA';
  unit: string;
  totalInward: number;
  totalOutward: number;
  balance: number;
  inwardCount: number;
  outwardCount: number;
  lastActivity: string;
  status: 'IN_STOCK' | 'OUT_OF_STOCK';
}

function TotalStockContent() {
  const searchParams = useSearchParams();
  const initialType = searchParams?.get('type')?.toUpperCase();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<StockItem[]>([]);
  const [summary, setSummary] = useState<StockSummary>({
    overall: { totalInwardMeters: 0, totalOutwardMeters: 0, availableBalanceMeters: 0, totalInwardPcs: 0, totalOutwardPcs: 0, availableBalancePcs: 0, itemCount: 0 },
    undyed: { totalInwardMeters: 0, totalOutwardMeters: 0, availableBalanceMeters: 0, totalInwardPcs: 0, totalOutwardPcs: 0, availableBalancePcs: 0, itemCount: 0 },
    kora: { totalInwardMeters: 0, totalOutwardMeters: 0, availableBalanceMeters: 0, totalInwardPcs: 0, totalOutwardPcs: 0, availableBalancePcs: 0, itemCount: 0 },
    dyed: { totalInwardMeters: 0, totalOutwardMeters: 0, availableBalanceMeters: 0, totalInwardPcs: 0, totalOutwardPcs: 0, availableBalancePcs: 0, itemCount: 0 },
    defectiveStockPcs: 0,
  });

  const [typeFilter, setTypeFilter] = useState<'ALL' | 'UNDYED' | 'DYED'>(
    initialType === 'KORA' || initialType === 'UNDYED'
      ? 'UNDYED'
      : initialType === 'DYED'
      ? 'DYED'
      : 'ALL'
  );
  const [search, setSearch] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (typeFilter !== 'ALL') params.set('type', typeFilter);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/fabric-store/total-stock?${params.toString()}`);
      const json = await res.json();
      if (res.ok) {
        setItems(json.data || []);
        if (json.summary) setSummary(json.summary);
      }
    } catch (err) {
      console.error('Failed to load total stock:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialType === 'KORA' || initialType === 'UNDYED') {
      setTypeFilter('UNDYED');
    } else if (initialType === 'DYED') {
      setTypeFilter('DYED');
    }
  }, [initialType]);

  useEffect(() => {
    loadData();
  }, [typeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const undyedData = summary.undyed || summary.kora || {
    totalInwardMeters: 0,
    totalOutwardMeters: 0,
    availableBalanceMeters: 0,
    totalInwardPcs: 0,
    totalOutwardPcs: 0,
    availableBalancePcs: 0,
    itemCount: 0,
  };

  return (
    <div className="min-h-screen bg-[#F0FAF9] pb-16">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-8 py-3.5 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700">
                FABRIC STORE
              </span>
              <span className="text-slate-300">/</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                INVENTORY
              </span>
            </div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Boxes className="w-5 h-5 text-teal-600" />
              <span>TOTAL STOCK: DYED &amp; UNDYED</span>
            </h1>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Live in-store inventory &middot; Automatically updates when fabric arrives in Inward or when Challans are issued for Dyeing / other processes
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/fabric-store/inventory/inward"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
              <span>Inward Fabric</span>
            </Link>
            <Link
              href="/fabric-store/inventory/outward"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Outward Stock</span>
            </Link>
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
              title="Refresh Stock Balance"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {/* SUMMARY TILES - THREE FIELDS: OVERALL, 1. UNDYED, 2. DYED (+ DEFECTIVE) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Tile 1: OVERALL AVAILABLE STOCK */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 block">
              TOTAL IN-STORE STOCK
            </span>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {summary.overall.availableBalanceMeters.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              <span className="text-xs font-semibold text-teal-700 ml-1">MTR</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1 font-medium">
              <span className="text-emerald-700 font-bold">+{summary.overall.totalInwardMeters.toFixed(0)} In</span>
              <span>&middot;</span>
              <span className="text-rose-700 font-bold">-{summary.overall.totalOutwardMeters.toFixed(0)} Out</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-medium">
              {summary.overall.availableBalancePcs.toLocaleString('en-IN')} PCS available
            </div>
          </div>

          {/* Tile 2: 1. UNDYED STOCK */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
                1. UNDYED STOCK
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-900">
                UNDYED
              </span>
            </div>
            <div className="text-2xl font-black text-amber-900 mt-1">
              {undyedData.availableBalanceMeters.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              <span className="text-xs font-semibold text-amber-700 ml-1">MTR</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1 font-medium">
              <span className="text-emerald-700 font-bold">+{undyedData.totalInwardMeters.toFixed(0)} In</span>
              <span>&middot;</span>
              <span className="text-rose-700 font-bold">-{undyedData.totalOutwardMeters.toFixed(0)} Dispatched</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-medium">
              {undyedData.availableBalancePcs.toLocaleString('en-IN')} PCS available
            </div>
          </div>

          {/* Tile 3: 2. DYED STOCK */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block">
                2. DYED STOCK
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-purple-100 text-purple-900">
                DYED
              </span>
            </div>
            <div className="text-2xl font-black text-purple-900 mt-1">
              {summary.dyed.availableBalanceMeters.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              <span className="text-xs font-semibold text-purple-700 ml-1">MTR</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1 font-medium">
              <span className="text-emerald-700 font-bold">+{summary.dyed.totalInwardMeters.toFixed(0)} In</span>
              <span>&middot;</span>
              <span className="text-rose-700 font-bold">-{summary.dyed.totalOutwardMeters.toFixed(0)} Dispatched</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-medium">
              {summary.dyed.availableBalancePcs.toLocaleString('en-IN')} PCS available
            </div>
          </div>

          {/* Tile 4: DEFECTIVE QUARANTINED SHELF */}
          <Link
            href="/fabric-store/inventory/defected-shelf"
            className="bg-white p-4 rounded-xl border border-rose-200 hover:border-rose-300 shadow-2xs transition group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">
                DEFECTIVE SHELF
              </span>
              <ExternalLink className="w-3.5 h-3.5 text-rose-400 group-hover:text-rose-700 transition" />
            </div>
            <div className="text-2xl font-black text-rose-900 mt-1">
              {summary.defectiveStockPcs.toLocaleString('en-IN')}
              <span className="text-xs font-semibold text-rose-700 ml-1">PCS</span>
            </div>
            <span className="text-[10px] text-rose-700/80 mt-0.5 block">
              DEF-SHELF-STORE Quarantined
            </span>
          </Link>
        </div>

        {/* CONTROLS: TABS & SEARCH */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Category:</span>
            </span>
            <button
              type="button"
              onClick={() => setTypeFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                typeFilter === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              All Fabric Stock
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('UNDYED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                typeFilter === 'UNDYED'
                  ? 'bg-amber-700 text-white'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
              }`}
            >
              1. UNDYED
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('DYED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                typeFilter === 'DYED'
                  ? 'bg-purple-700 text-white'
                  : 'bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200'
              }`}
            >
              2. DYED
            </button>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Fabric Description..."
                className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs w-48 sm:w-64 focus:outline-none focus:ring-1 focus:ring-teal-600 bg-white"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg border border-slate-300 transition"
            >
              Search
            </button>
          </form>
        </div>

        {/* TOTAL STOCK TABLE */}
        <div className="bg-white rounded-xl border-[1.5px] border-black shadow-xs overflow-hidden">
          <div className="px-5 py-3 border-b-[1.5px] border-black bg-slate-50 flex items-center justify-between">
            <span className="font-black text-xs uppercase tracking-wider text-slate-900">
              TOTAL STOCK TABLE: DYED &amp; UNDYED ({items.length} FABRIC ITEMS)
            </span>
            <span className="text-[11px] font-semibold text-slate-500">
              Available Balance = Total Inward &minus; Total Outward (Challans Issued)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-100 border-b-[1.5px] border-black text-slate-800">
                  <th className="border-r-[1.5px] border-black px-3 py-2 font-black text-center w-14">
                    S.NO
                  </th>
                  <th className="border-r-[1.5px] border-black px-4 py-2 font-black">
                    ITEM NAME (FABRIC DESCRIPTION)
                  </th>
                  <th className="border-r-[1.5px] border-black px-3 py-2 font-black text-center w-28">
                    CATEGORY
                  </th>
                  <th className="border-r-[1.5px] border-black px-4 py-2 font-black text-right w-32">
                    TOTAL INWARD
                  </th>
                  <th className="border-r-[1.5px] border-black px-4 py-2 font-black text-right w-32">
                    TOTAL OUTWARD
                  </th>
                  <th className="border-r-[1.5px] border-black px-4 py-2 font-black text-right w-36 bg-teal-50/50">
                    AVAILABLE IN STORE
                  </th>
                  <th className="border-r-[1.5px] border-black px-3 py-2 font-black text-center w-28">
                    STATUS
                  </th>
                  <th className="border-r-[1.5px] border-black px-3 py-2 font-black text-center w-32">
                    LAST MOVEMENT
                  </th>
                  <th className="px-3 py-2 font-black text-center w-32">
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-500 space-y-2">
                      <Boxes className="w-8 h-8 mx-auto text-slate-300" />
                      <div className="text-sm font-bold text-slate-700">No stock records found</div>
                      <p className="text-xs text-slate-400">
                        Receive fabric in Inward Stock to establish initial inventory balance.
                      </p>
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => {
                    const isUndyed = item.fabricType === 'UNDYED' || (item.fabricType as string) === 'KORA';
                    return (
                      <tr key={`${item.itemName}-${item.fabricType}-${item.unit}`} className="hover:bg-slate-50 transition h-10">
                        <td className="border-r-[1.5px] border-black px-3 py-2 text-center font-bold font-mono text-slate-700">
                          {item.sNo ?? index + 1}
                        </td>
                        <td className="border-r-[1.5px] border-black px-4 py-2 font-bold text-slate-900">
                          {item.itemName}
                        </td>
                        <td className="border-r-[1.5px] border-black px-3 py-2 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-black tracking-wider uppercase ${
                              isUndyed
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-purple-100 text-purple-900 border border-purple-300'
                            }`}
                          >
                            {isUndyed ? 'UNDYED' : 'DYED'}
                          </span>
                        </td>
                        <td className="border-r-[1.5px] border-black px-4 py-2 text-right font-bold text-slate-800">
                          {item.totalInward.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          <span className="text-[10px] text-slate-500 ml-1">{item.unit}</span>
                        </td>
                        <td className="border-r-[1.5px] border-black px-4 py-2 text-right font-bold text-slate-800">
                          {item.totalOutward.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          <span className="text-[10px] text-slate-500 ml-1">{item.unit}</span>
                        </td>
                        <td className="border-r-[1.5px] border-black px-4 py-2 text-right font-black text-sm text-teal-950 bg-teal-50/50">
                          {item.balance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          <span className="text-xs font-bold text-teal-700 ml-1">{item.unit}</span>
                        </td>
                        <td className="border-r-[1.5px] border-black px-3 py-2 text-center">
                          {item.balance > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                              IN STOCK
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-slate-100 text-slate-600 border border-slate-300">
                              EXHAUSTED
                            </span>
                          )}
                        </td>
                        <td className="border-r-[1.5px] border-black px-3 py-2 text-center text-slate-600 font-medium">
                          {formatDate(item.lastActivity)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {isUndyed ? (
                            <Link
                              href="/fabric-store/my-work/challan-to-dyeing"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 hover:underline"
                            >
                              <span>Issue Dyeing</span>
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          ) : (
                            <Link
                              href="/fabric-store/my-work/challan-to-embroidery"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline"
                            >
                              <span>Issue Emb.</span>
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function TotalStockPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F0FAF9] flex items-center justify-center text-xs text-slate-500">Loading Total Stock Balance...</div>}>
      <TotalStockContent />
    </Suspense>
  );
}
