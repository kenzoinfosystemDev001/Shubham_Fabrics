'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Boxes,
  Layers,
  RefreshCw,
  Search,
  ArrowDownToLine,
  Send,
  AlertTriangle,
  ArrowRight,
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
  colour?: string | null;
  unit: string;
  totalInward: number;
  totalOutward: number;
  balance: number;
  shortfall?: number;
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
  colour?: string | null;
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

  const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

  const stockCards = [
    { label: 'All Stock', data: summary.overall, tone: 'bg-brand-50 text-brand-700', icon: Boxes },
    { label: 'Undyed', data: undyedData, tone: 'bg-accent-100 text-neutral-900', icon: Layers },
    { label: 'Dyed', data: summary.dyed, tone: 'bg-brand-50 text-brand-700', icon: Layers },
  ];

  const tabs = [
    { id: 'ALL', label: 'All' },
    { id: 'UNDYED', label: 'Undyed' },
    { id: 'DYED', label: 'Dyed' },
  ] as const;

  const panel = 'bg-white border border-neutral-200 rounded-2xl shadow-xs overflow-hidden';
  const th = 'py-3 px-4 whitespace-nowrap';

  return (
    <div className="min-h-screen bg-canvas pb-16">
      {/* HEADER */}
      <header className="bg-white/90 backdrop-blur border-b border-neutral-200 sticky top-0 z-30 px-4 sm:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-neutral-900">Total Stock</h1>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition"
              title="Refresh"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Link
              href="/fabric-store/inventory/inward"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
            >
              <ArrowDownToLine className="w-4 h-4" />
              <span>Inward</span>
            </Link>
            <Link
              href="/fabric-store/inventory/outward"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-brand-50 text-brand-800 border border-brand-300 text-xs font-semibold rounded-lg transition"
            >
              <Send className="w-4 h-4" />
              <span>Outward</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {/* SUMMARY */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {stockCards.map((card) => (
            <div key={card.label} className="bg-white border border-neutral-200 rounded-2xl p-4 sm:p-5 shadow-xs">
              <div className="flex items-center gap-2.5">
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${card.tone}`}>
                  <card.icon className="w-4 h-4" />
                </span>
                <span className="text-xs font-semibold text-neutral-600">{card.label}</span>
              </div>
              <p className="mt-3 text-2xl font-bold text-neutral-900 tabular-nums leading-none">
                {fmt(card.data.availableBalanceMeters)}
                <span className="text-xs font-semibold text-neutral-500 ml-1">MTR</span>
              </p>
              <p className="mt-2 text-[11px] text-neutral-500 tabular-nums">
                <span className="text-neutral-700 font-medium">+{fmt(card.data.totalInwardMeters)}</span> in
                <span className="mx-1.5 text-neutral-300">|</span>
                <span className="text-neutral-700 font-medium">−{fmt(card.data.totalOutwardMeters)}</span> out
                {card.data.availableBalancePcs > 0 && (
                  <>
                    <span className="mx-1.5 text-neutral-300">|</span>
                    {fmt(card.data.availableBalancePcs)} PCS
                  </>
                )}
              </p>
            </div>
          ))}

          <Link
            href="/fabric-store/inventory/defected-shelf"
            className="group bg-white border border-neutral-200 hover:border-danger-300 rounded-2xl p-4 sm:p-5 shadow-xs transition"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-danger-50 text-danger-600">
                <AlertTriangle className="w-4 h-4" />
              </span>
              <span className="flex-1 text-xs font-semibold text-neutral-600">Defective Shelf</span>
              <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-danger-600 transition" />
            </div>
            <p className="mt-3 text-2xl font-bold text-neutral-900 tabular-nums leading-none">
              {Object.entries(defectiveStockByUnit).map(([unit, quantity]) => (
                <span key={unit} className="mr-2">
                  {fmt(quantity)}
                  <span className="text-xs font-semibold text-neutral-500 ml-1">{unit}</span>
                </span>
              ))}
            </p>
          </Link>
        </section>

        {/* STOCK TABLE */}
        <section className={panel}>
          <div className="px-5 py-4 border-b border-neutral-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold text-neutral-900">Stock</h2>
              <span className="text-[11px] font-semibold tabular-nums bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">
                {items.length}
              </span>
              <div role="tablist" aria-label="Category" className="inline-flex p-0.5 bg-neutral-100 rounded-lg ml-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={typeFilter === tab.id}
                    onClick={() => setTypeFilter(tab.id)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                      typeFilter === tab.id ? 'bg-white text-brand-800 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search fabric"
                aria-label="Search fabric"
                className="h-9 w-full md:w-64 pl-9 pr-3 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition"
              />
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className={`${th} w-12`}>#</th>
                  <th className={th}>Fabric</th>
                  <th className={th}>Colour</th>
                  <th className={th}>Category</th>
                  <th className={`${th} text-right`}>Inward</th>
                  <th className={`${th} text-right`}>Outward</th>
                  <th className={`${th} text-right`}>Available</th>
                  <th className={th}>Status</th>
                  <th className={th}>Last Movement</th>
                  <th className={th}>
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-14 text-center">
                      <Boxes className="w-8 h-8 mx-auto text-neutral-300" />
                      <p className="text-sm font-medium text-neutral-500 mt-3">{loading ? 'Loading…' : 'No stock yet'}</p>
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => {
                    const isUndyed = item.fabricType === 'UNDYED' || (item.fabricType as string) === 'KORA';
                    return (
                      <tr
                        key={`${item.itemName}-${item.fabricType}-${item.colour || ''}-${item.unit}`}
                        className="hover:bg-neutral-50/60 transition"
                      >
                        <td className="py-3 px-4 text-xs font-semibold text-neutral-400 tabular-nums">{item.sNo ?? index + 1}</td>
                        <td className="py-3 px-4 font-semibold text-neutral-900">{item.itemName}</td>
                        <td className="py-3 px-4 text-neutral-700">{item.colour || <span className="text-neutral-400">—</span>}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                              isUndyed ? 'bg-accent-100 text-neutral-900' : 'bg-brand-50 text-brand-800'
                            }`}
                          >
                            {isUndyed ? 'Undyed' : 'Dyed'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-neutral-700 whitespace-nowrap">
                          {fmt(item.totalInward)} <span className="text-[11px] text-neutral-400">{item.unit}</span>
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-neutral-700 whitespace-nowrap">
                          {fmt(item.totalOutward)} <span className="text-[11px] text-neutral-400">{item.unit}</span>
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums whitespace-nowrap">
                          <span className="font-bold text-brand-900">{fmt(item.balance)}</span>{' '}
                          <span className="text-[11px] font-semibold text-brand-700">{item.unit}</span>
                          {item.shortfall ? (
                            <span className="block text-[11px] font-semibold text-danger-700" title="Older issues exceed the recorded inward quantity">
                              Short {fmt(item.shortfall)} {item.unit}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-3 px-4">
                          {item.balance > 0 ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-900">
                              <span className="w-1.5 h-1.5 rounded-full bg-accent-500" />
                              In stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500">
                              <span className="w-1.5 h-1.5 rounded-full bg-neutral-300" />
                              Exhausted
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-neutral-500 whitespace-nowrap">{formatDate(item.lastActivity)}</td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <Link
                            href={isUndyed ? '/fabric-store/my-work/challan-to-dyeing' : '/fabric-store/my-work/challan-to-embroidery'}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900"
                          >
                            <span>{isUndyed ? 'To Dyeing' : 'To Embroidery'}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* OUTWARD HISTORY */}
        <section className={panel}>
          <div className="px-5 py-4 border-b border-neutral-200 flex items-center gap-3">
            <h2 className="text-sm font-bold text-neutral-900">Outward History</h2>
            <span className="text-[11px] font-semibold tabular-nums bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">
              {outwardHistory.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className={th}>Date</th>
                  <th className={th}>Challan</th>
                  <th className={th}>Fabric</th>
                  <th className={th}>Colour</th>
                  <th className={th}>From</th>
                  <th className={th}>To</th>
                  <th className={`${th} text-right`}>Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {outwardHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm font-medium text-neutral-500">
                      No outward entries yet
                    </td>
                  </tr>
                ) : (
                  outwardHistory.map((entry) => (
                    <tr key={entry.id} className="hover:bg-neutral-50/60 transition">
                      <td className="py-3 px-4 text-xs text-neutral-500 whitespace-nowrap">{formatDate(entry.date)}</td>
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-brand-800">{entry.challanNumber || '—'}</td>
                      <td className="py-3 px-4 text-neutral-900">{entry.itemName}</td>
                      <td className="py-3 px-4 text-neutral-700">{entry.colour || '—'}</td>
                      <td className="py-3 px-4 text-neutral-700">{entry.sourceDepartment || '—'}</td>
                      <td className="py-3 px-4 text-neutral-700">{entry.destination || '—'}</td>
                      <td className="py-3 px-4 text-right font-semibold tabular-nums whitespace-nowrap">
                        {fmt(Number(entry.quantity))} <span className="text-[11px] text-neutral-400">{entry.unit}</span>
                      </td>
                    </tr>
                  ))
                )}
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
    <Suspense fallback={<div className="min-h-screen bg-canvas flex items-center justify-center text-sm text-neutral-500">Loading…</div>}>
      <TotalStockContent />
    </Suspense>
  );
}
