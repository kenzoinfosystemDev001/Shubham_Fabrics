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
  defectiveStockByUnit: Record<string, number>;
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

interface OutwardHistoryItem {
  id: string;
  date: string;
  challanNumber?: string;
  sourceDepartment?: string;
  destination?: string;
  itemName: string;
  quantity: number;
  unit: string;
  fabricType: string;
}

function TotalStockContent() {
  const searchParams = useSearchParams();
  const initialType = searchParams?.get('type')?.toUpperCase();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<StockItem[]>([]);
  const [outwardHistory, setOutwardHistory] = useState<OutwardHistoryItem[]>([]);
  const [summary, setSummary] = useState<StockSummary>({
    overall: { totalInwardMeters: 0, totalOutwardMeters: 0, availableBalanceMeters: 0, totalInwardPcs: 0, totalOutwardPcs: 0, availableBalancePcs: 0, itemCount: 0 },
    undyed: { totalInwardMeters: 0, totalOutwardMeters: 0, availableBalanceMeters: 0, totalInwardPcs: 0, totalOutwardPcs: 0, availableBalancePcs: 0, itemCount: 0 },
    kora: { totalInwardMeters: 0, totalOutwardMeters: 0, availableBalanceMeters: 0, totalInwardPcs: 0, totalOutwardPcs: 0, availableBalancePcs: 0, itemCount: 0 },
    dyed: { totalInwardMeters: 0, totalOutwardMeters: 0, availableBalanceMeters: 0, totalInwardPcs: 0, totalOutwardPcs: 0, availableBalancePcs: 0, itemCount: 0 },
    defectiveStockPcs: 0,
    defectiveStockByUnit: {},
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
        setOutwardHistory(json.outwardHistory || []);
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
  const defectiveStockByUnit = Object.keys(summary.defectiveStockByUnit || {}).length > 0
    ? summary.defectiveStockByUnit
    : { PCS: summary.defectiveStockPcs };

  return (
    <div className="min-h-screen bg-brand-50 pb-16">
      {/* HEADER */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-30 px-4 sm:px-8 py-3.5 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700">
                FABRIC STORE
              </span>
              <span className="text-neutral-700">/</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                INVENTORY
              </span>
            </div>
            <h1 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
              <Boxes className="w-5 h-5 text-brand-600" />
              <span>TOTAL STOCK: DYED &amp; UNDYED</span>
            </h1>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Live in-store inventory &middot; Automatically updates when fabric arrives in Inward or when Challans are issued for Dyeing / other processes
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/fabric-store/inventory/inward"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
              <span>Inward Fabric</span>
            </Link>
            <Link
              href="/fabric-store/inventory/outward"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Outward Stock</span>
            </Link>
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition"
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
          <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700 block">
              TOTAL IN-STORE STOCK
            </span>
            <div className="text-2xl font-black text-neutral-900 mt-1">
              {summary.overall.availableBalanceMeters.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              <span className="text-xs font-semibold text-brand-700 ml-1">MTR</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-neutral-500 mt-1 font-medium">
              <span className="text-accent-800 font-bold">+{summary.overall.totalInwardMeters.toFixed(0)} In</span>
              <span>&middot;</span>
              <span className="text-danger-700 font-bold">-{summary.overall.totalOutwardMeters.toFixed(0)} Out</span>
            </div>
            <div className="text-[10px] text-neutral-500 mt-1 font-medium">
              {summary.overall.availableBalancePcs.toLocaleString('en-IN')} PCS available
            </div>
          </div>

          {/* Tile 2: 1. UNDYED STOCK */}
          <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-700 block">
                1. UNDYED STOCK
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-accent-100 text-accent-800">
                UNDYED
              </span>
            </div>
            <div className="text-2xl font-black text-neutral-900 mt-1">
              {undyedData.availableBalanceMeters.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              <span className="text-xs font-semibold text-accent-800 ml-1">MTR</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-neutral-500 mt-1 font-medium">
              <span className="text-accent-800 font-bold">+{undyedData.totalInwardMeters.toFixed(0)} In</span>
              <span>&middot;</span>
              <span className="text-danger-700 font-bold">-{undyedData.totalOutwardMeters.toFixed(0)} Dispatched</span>
            </div>
            <div className="text-[10px] text-neutral-500 mt-1 font-medium">
              {undyedData.availableBalancePcs.toLocaleString('en-IN')} PCS available
            </div>
          </div>

          {/* Tile 3: 2. DYED STOCK */}
          <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700 block">
                2. DYED STOCK
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-brand-100 text-brand-900">
                DYED
              </span>
            </div>
            <div className="text-2xl font-black text-brand-900 mt-1">
              {summary.dyed.availableBalanceMeters.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              <span className="text-xs font-semibold text-brand-700 ml-1">MTR</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-neutral-500 mt-1 font-medium">
              <span className="text-accent-800 font-bold">+{summary.dyed.totalInwardMeters.toFixed(0)} In</span>
              <span>&middot;</span>
              <span className="text-danger-700 font-bold">-{summary.dyed.totalOutwardMeters.toFixed(0)} Dispatched</span>
            </div>
            <div className="text-[10px] text-neutral-500 mt-1 font-medium">
              {summary.dyed.availableBalancePcs.toLocaleString('en-IN')} PCS available
            </div>
          </div>

          {/* Tile 4: DEFECTIVE QUARANTINED SHELF */}
          <Link
            href="/fabric-store/inventory/defected-shelf"
            className="bg-white p-4 rounded-xl border border-danger-200 hover:border-danger-300 shadow-2xs transition group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-danger-700 block">
                DEFECTIVE SHELF
              </span>
              <ExternalLink className="w-3.5 h-3.5 text-danger-600 group-hover:text-danger-700 transition" />
            </div>
            <div className="text-2xl font-black text-danger-900 mt-1">
              {Object.entries(defectiveStockByUnit)
                .map(([unit, quantity]) => (
                  <span key={unit} className="mr-2">
                    {quantity.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    <span className="text-xs font-semibold text-danger-700 ml-1">{unit}</span>
                  </span>
                ))}
            </div>
            <span className="text-[10px] text-danger-700 mt-0.5 block">
              DEF-SHELF-STORE Quarantined
            </span>
          </Link>
        </div>

        {/* CONTROLS: TABS & SEARCH */}
        <div className="bg-white p-3.5 rounded-xl border border-neutral-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-neutral-500 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Category:</span>
            </span>
            <button
              type="button"
              onClick={() => setTypeFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                typeFilter === 'ALL'
                  ? 'bg-brand-600 text-white'
                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
              }`}
            >
              All Fabric Stock
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('UNDYED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                typeFilter === 'UNDYED'
                  ? 'bg-accent-500 text-neutral-900'
                  : 'bg-accent-50 hover:bg-accent-100 text-accent-800 border border-accent-200'
              }`}
            >
              1. UNDYED
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('DYED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                typeFilter === 'DYED'
                  ? 'bg-brand-700 text-white'
                  : 'bg-brand-50 hover:bg-brand-100 text-brand-900 border border-brand-200'
              }`}
            >
              2. DYED
            </button>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Fabric Description..."
                className="pl-8 pr-3 py-1.5 border border-neutral-300 rounded-lg text-xs w-48 sm:w-64 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 text-xs font-bold rounded-lg border border-neutral-300 transition"
            >
              Search
            </button>
          </form>
        </div>

        {/* TOTAL STOCK TABLE */}
        <div className="bg-white rounded-xl border-[1.5px] border-neutral-200 shadow-xs overflow-hidden">
          <div className="px-5 py-3 border-b-[1.5px] border-neutral-200 bg-neutral-50 flex items-center justify-between">
            <span className="font-black text-xs uppercase tracking-wider text-neutral-900">
              TOTAL STOCK TABLE: DYED &amp; UNDYED ({items.length} FABRIC ITEMS)
            </span>
            <span className="text-[11px] font-semibold text-neutral-500">
              Available Balance = Total Inward &minus; Total Outward (Challans Issued)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-neutral-100 border-b-[1.5px] border-neutral-200 text-neutral-900">
                  <th className="border-r-[1.5px] border-neutral-200 px-3 py-2 font-black text-center w-14">
                    S.NO
                  </th>
                  <th className="border-r-[1.5px] border-neutral-200 px-4 py-2 font-black">
                    ITEM NAME (FABRIC DESCRIPTION)
                  </th>
                  <th className="border-r-[1.5px] border-neutral-200 px-3 py-2 font-black text-center w-28">
                    CATEGORY
                  </th>
                  <th className="border-r-[1.5px] border-neutral-200 px-4 py-2 font-black text-right w-32">
                    TOTAL INWARD
                  </th>
                  <th className="border-r-[1.5px] border-neutral-200 px-4 py-2 font-black text-right w-32">
                    TOTAL OUTWARD
                  </th>
                  <th className="border-r-[1.5px] border-neutral-200 px-4 py-2 font-black text-right w-36 bg-brand-50/50">
                    AVAILABLE IN STORE
                  </th>
                  <th className="border-r-[1.5px] border-neutral-200 px-3 py-2 font-black text-center w-28">
                    STATUS
                  </th>
                  <th className="border-r-[1.5px] border-neutral-200 px-3 py-2 font-black text-center w-32">
                    LAST MOVEMENT
                  </th>
                  <th className="px-3 py-2 font-black text-center w-32">
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-neutral-500 space-y-2">
                      <Boxes className="w-8 h-8 mx-auto text-neutral-700" />
                      <div className="text-sm font-bold text-neutral-700">No stock records found</div>
                      <p className="text-xs text-neutral-500">
                        Receive fabric in Inward Stock to establish initial inventory balance.
                      </p>
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => {
                    const isUndyed = item.fabricType === 'UNDYED' || (item.fabricType as string) === 'KORA';
                    return (
                      <tr key={`${item.itemName}-${item.fabricType}-${item.unit}`} className="hover:bg-neutral-50 transition h-10">
                        <td className="border-r-[1.5px] border-neutral-200 px-3 py-2 text-center font-bold font-mono text-neutral-700">
                          {item.sNo ?? index + 1}
                        </td>
                        <td className="border-r-[1.5px] border-neutral-200 px-4 py-2 font-bold text-neutral-900">
                          {item.itemName}
                        </td>
                        <td className="border-r-[1.5px] border-neutral-200 px-3 py-2 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-black tracking-wider uppercase ${
                              isUndyed
                                ? 'bg-accent-100 text-accent-800 border border-accent-300'
                                : 'bg-brand-100 text-brand-900 border border-brand-300'
                            }`}
                          >
                            {isUndyed ? 'UNDYED' : 'DYED'}
                          </span>
                        </td>
                        <td className="border-r-[1.5px] border-neutral-200 px-4 py-2 text-right font-bold text-neutral-900">
                          {item.totalInward.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          <span className="text-[10px] text-neutral-500 ml-1">{item.unit}</span>
                        </td>
                        <td className="border-r-[1.5px] border-neutral-200 px-4 py-2 text-right font-bold text-neutral-900">
                          {item.totalOutward.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          <span className="text-[10px] text-neutral-500 ml-1">{item.unit}</span>
                        </td>
                        <td className="border-r-[1.5px] border-neutral-200 px-4 py-2 text-right font-black text-sm text-brand-900 bg-brand-50/50">
                          {item.balance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          <span className="text-xs font-bold text-brand-700 ml-1">{item.unit}</span>
                        </td>
                        <td className="border-r-[1.5px] border-neutral-200 px-3 py-2 text-center">
                          {item.balance > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-accent-100 text-accent-800 border border-accent-300">
                              IN STOCK
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-neutral-100 text-neutral-600 border border-neutral-300">
                              EXHAUSTED
                            </span>
                          )}
                        </td>
                        <td className="border-r-[1.5px] border-neutral-200 px-3 py-2 text-center text-neutral-600 font-medium">
                          {formatDate(item.lastActivity)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {isUndyed ? (
                            <Link
                              href="/fabric-store/my-work/challan-to-dyeing"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-700 hover:text-brand-900 hover:underline"
                            >
                              <span>Issue Dyeing</span>
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          ) : (
                            <Link
                              href="/fabric-store/my-work/challan-to-embroidery"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-accent-800 hover:text-accent-800 hover:underline"
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

        <section className="bg-white rounded-xl border-[1.5px] border-neutral-200 shadow-xs overflow-hidden">
          <div className="px-5 py-3 border-b-[1.5px] border-neutral-200 bg-neutral-50 flex items-center justify-between">
            <h2 className="font-black text-xs uppercase tracking-wider text-neutral-900">Fabric Outward History</h2>
            <span className="text-[11px] font-semibold text-neutral-500">{outwardHistory.length} issued entries</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-neutral-100 border-b border-neutral-300 text-neutral-700">
                  <th className="px-4 py-2 font-bold">DATE</th>
                  <th className="px-4 py-2 font-bold">CHALLAN</th>
                  <th className="px-4 py-2 font-bold">FABRIC</th>
                  <th className="px-4 py-2 font-bold">FROM</th>
                  <th className="px-4 py-2 font-bold">TO</th>
                  <th className="px-4 py-2 font-bold text-right">QUANTITY</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {outwardHistory.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-500">No outward challans found</td></tr>
                ) : outwardHistory.map((entry) => (
                  <tr key={entry.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-2 whitespace-nowrap">{formatDate(entry.date)}</td>
                    <td className="px-4 py-2 font-semibold">{entry.challanNumber || '—'}</td>
                    <td className="px-4 py-2">{entry.itemName}</td>
                    <td className="px-4 py-2">{entry.sourceDepartment || '—'}</td>
                    <td className="px-4 py-2">{entry.destination || '—'}</td>
                    <td className="px-4 py-2 text-right font-bold">{Number(entry.quantity).toLocaleString('en-IN', { maximumFractionDigits: 2 })} {entry.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function TotalStockPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-brand-50 flex items-center justify-center text-xs text-neutral-500">Loading Total Stock Balance...</div>}>
      <TotalStockContent />
    </Suspense>
  );
}
