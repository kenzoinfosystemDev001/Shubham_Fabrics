'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  Briefcase,
  ShieldAlert,
  RotateCcw,
  PauseCircle,
  Inbox,
  ScanSearch,
  CalendarDays,
  User,
} from 'lucide-react';

interface FloorItem {
  id: string;
  challanNumber: string;
  programId: string;
  productionSheetNumber: string;
  programNumber: string;
  wilcomDesignNumber: string | null;
  designNumber: string | null;
  clientName: string;
  fabric: string;
  fabricType: string | null;
  color: string;
  quantity: number;
  quantityText?: string; // every unit, e.g. "120 MTR · 10 PCS"
  quantityInspected: number;
  quantityPassed: number;
  quantityFailed: number;
  quantityShrinkage: number;
  quantityRework: number;
  quantityHold: number;
  uom: string;
  priority: string;
  status: string;
  issuedDate: string | null;
  receivedDate: string | null;
  dyeingIncharge: string;
  inspector: string | null;
  deliveryDate: string | null;
  barcode: string;
  remarks: string | null;
  inspectionNotes: string | null;
}

type StageKey = 'RECEIVED' | 'UNDER_INSPECTION' | 'PASS' | 'REWORK' | 'HOLD' | 'FAIL';

// Stage look: a coloured top rule and count badge per column. FAIL (Reject) only holds lots inspected before
// Dyeing QC switched from Reject to Shrinkage, so it is shown only when it has lots.
const STAGES: Array<{ key: StageKey; label: string; icon: React.ElementType; rule: string; badge: string; icon_: string }> = [
  { key: 'RECEIVED', label: 'Awaiting QC', icon: Inbox, rule: 'bg-neutral-400', badge: 'bg-neutral-100 text-neutral-800', icon_: 'text-neutral-600' },
  { key: 'UNDER_INSPECTION', label: 'Under Inspection', icon: ScanSearch, rule: 'bg-brand-500', badge: 'bg-brand-100 text-brand-800', icon_: 'text-brand-600' },
  { key: 'PASS', label: 'Passed', icon: CheckCircle2, rule: 'bg-accent-500', badge: 'bg-accent-100 text-accent-800', icon_: 'text-accent-700' },
  { key: 'REWORK', label: 'Rework', icon: RotateCcw, rule: 'bg-brand-400', badge: 'bg-brand-100 text-brand-800', icon_: 'text-brand-600' },
  { key: 'HOLD', label: 'On Hold', icon: PauseCircle, rule: 'bg-neutral-500', badge: 'bg-neutral-100 text-neutral-800', icon_: 'text-neutral-600' },
  { key: 'FAIL', label: 'Rejected (earlier)', icon: ShieldAlert, rule: 'bg-danger-500', badge: 'bg-danger-100 text-danger-800', icon_: 'text-danger-600' },
];

const PRIORITY_STYLE: Record<string, string> = {
  URGENT: 'bg-danger-100 text-danger-800',
  HIGH: 'bg-accent-100 text-accent-800',
};

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const isOverdue = (d: string | null) => Boolean(d) && new Date(d as string).getTime() < new Date().setHours(0, 0, 0, 0);

export default function QC1FloorBoard() {
  const [loading, setLoading] = useState(true);
  const [columns, setColumns] = useState<Record<string, FloorItem[]>>({});
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<StageKey | 'ALL'>('ALL');
  const [error, setError] = useState('');

  const loadBoard = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/qc1/floor-board');
      if (!res.ok) {
        throw new Error('Failed to load Dyeing QC Floor Board data.');
      }
      const json = await res.json();
      setColumns(json.data.columns || {});
      setTotalItems(json.data.totalItems || 0);
    } catch (err: any) {
      console.error('Error loading QC1 floor board:', err);
      setError(err.message || 'Error connecting to database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoard();
  }, []);

  const filterList = (list: FloorItem[] = []) => {
    if (!search.trim()) return list;
    const term = search.toLowerCase();
    return list.filter((it) =>
      [it.challanNumber, it.productionSheetNumber, it.designNumber, it.fabric, it.color, it.dyeingIncharge, it.inspector]
        .some((v) => String(v || '').toLowerCase().includes(term))
    );
  };

  const stages = STAGES.filter((s) => s.key !== 'FAIL' || (columns.FAIL?.length || 0) > 0);
  const shownStages = stageFilter === 'ALL' ? stages : stages.filter((s) => s.key === stageFilter);

  return (
    <div className="min-h-screen bg-neutral-50 pb-16 flex flex-col">
      {/* HEADER */}
      <header className="bg-white border-b border-neutral-200/80 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Dyeing QC Floor Board</h1>
          <p className="text-xs text-neutral-500 mt-0.5">{totalItems} lot{totalItems === 1 ? '' : 's'} received from Dyeing</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="Search serial, design, challan, fabric"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg w-56 sm:w-72 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500/40 transition"
            />
          </div>
          <button
            onClick={loadBoard}
            disabled={loading}
            className="p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/qc1/my-work"
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>My Work</span>
          </Link>
        </div>
      </header>

      {error && (
        <div className="mx-4 sm:mx-8 mt-4 p-4 bg-danger-50 border border-danger-200 rounded-xl flex items-center gap-3 text-danger-800 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-danger-600" />
          <span>{error}</span>
          <button onClick={loadBoard} className="ml-auto underline font-bold">
            Retry
          </button>
        </div>
      )}

      {/* STAGE SUMMARY (also filters the board) */}
      {totalItems > 0 && (
        <div className="px-4 sm:px-8 pt-5 flex flex-wrap gap-2">
          <button
            onClick={() => setStageFilter('ALL')}
            className={`px-3.5 py-2 rounded-xl border text-xs font-semibold transition ${
              stageFilter === 'ALL' ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            All <span className="ml-1 font-mono">{totalItems}</span>
          </button>
          {stages.map((s) => {
            const Icon = s.icon;
            const active = stageFilter === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setStageFilter(active ? 'ALL' : s.key)}
                className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition ${
                  active ? 'bg-white border-brand-500 ring-2 ring-brand-500/20 text-neutral-900' : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${s.icon_}`} />
                {s.label}
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${s.badge}`}>{columns[s.key]?.length || 0}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* EMPTY STATE */}
      {!loading && totalItems === 0 && !error && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md w-full text-center p-8 bg-white border border-neutral-200 rounded-2xl shadow-xs space-y-3">
            <Inbox className="w-10 h-10 text-neutral-400 mx-auto" />
            <h2 className="text-sm font-bold text-neutral-900">No lots received from Dyeing yet</h2>
            <p className="text-xs text-neutral-500">Challans issued by Dyeing to Dyeing QC appear here.</p>
          </div>
        </div>
      )}

      {/* BOARD */}
      {totalItems > 0 && (
        <main className="px-4 sm:px-8 pt-4 flex-1">
          <div
            className={`grid gap-4 items-start ${
              shownStages.length === 1 ? 'grid-cols-1 max-w-md' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5'
            }`}
          >
            {shownStages.map((s) => {
              const Icon = s.icon;
              const items = filterList(columns[s.key] || []);
              return (
                <section key={s.key} className="bg-white/80 border border-neutral-200 rounded-2xl shadow-xs overflow-hidden flex flex-col max-h-[calc(100vh-220px)]">
                  <div className={`h-1 ${s.rule}`} />
                  <div className="px-4 py-3 flex items-center justify-between border-b border-neutral-100">
                    <span className="flex items-center gap-2 text-sm font-bold text-neutral-900">
                      <Icon className={`w-4 h-4 ${s.icon_}`} />
                      {s.label}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold ${s.badge}`}>{items.length}</span>
                  </div>

                  <div className="p-3 space-y-3 overflow-y-auto flex-1 bg-neutral-50/60">
                    {items.length === 0 ? (
                      <p className="py-10 text-center text-neutral-400 text-xs">Nothing here</p>
                    ) : (
                      items.map((it) => <LotCard key={it.id} it={it} />)
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </main>
      )}
    </div>
  );
}

function LotCard({ it }: { it: FloorItem }) {
  const inspected = it.quantityInspected > 0;
  const overdue = isOverdue(it.deliveryDate) && !['QC_APPROVED'].includes(it.status);
  return (
    <Link
      href={`/qc1/my-work?challanId=${it.id}`}
      className="group block bg-white border border-neutral-200 rounded-xl p-3.5 shadow-xs hover:shadow-sm hover:border-brand-300 transition"
    >
      {/* Serial, design, challan, priority */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-sm font-bold text-neutral-900 block truncate">Serial {it.productionSheetNumber}</span>
          <span className="text-[11px] text-neutral-500 block truncate">
            {it.designNumber ? `Design ${it.designNumber} · ` : ''}Challan {it.challanNumber}
          </span>
        </div>
        {it.priority !== 'NORMAL' && (
          <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase shrink-0 ${PRIORITY_STYLE[it.priority] || 'bg-neutral-100 text-neutral-700'}`}>
            {it.priority}
          </span>
        )}
      </div>

      {/* Fabric */}
      <div className="mt-2.5 flex items-center gap-2 text-xs">
        <span className="font-semibold text-neutral-900 truncate">{it.fabric}</span>
        {it.color && <span className="px-1.5 py-0.5 rounded-md bg-neutral-100 text-neutral-700 text-[10px] font-semibold shrink-0">{it.color}</span>}
      </div>

      {/* Quantities */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Qty label="Received" value={it.quantityText ?? `${it.quantity} ${it.uom}`} />
        {inspected ? (
          <Qty label="Inspected" value={`${it.quantityInspected} ${it.uom}`} />
        ) : (
          <Qty label="Status" value="Awaiting" muted />
        )}
        {it.quantityPassed > 0 && <Qty label="Passed" value={`${it.quantityPassed} ${it.uom}`} tone="text-accent-800" />}
        {it.quantityRework > 0 && <Qty label="Rework" value={`${it.quantityRework} ${it.uom}`} tone="text-brand-800" />}
        {it.quantityShrinkage > 0 && <Qty label="Shrinkage" value={`${it.quantityShrinkage} ${it.uom}`} tone="text-brand-800" />}
        {it.quantityFailed > 0 && <Qty label="Rejected" value={`${it.quantityFailed} ${it.uom}`} tone="text-danger-800" />}
      </div>

      {/* People and dates */}
      <div className="mt-3 pt-2.5 border-t border-neutral-100 flex items-center justify-between gap-2 text-[11px] text-neutral-600">
        <span className="flex items-center gap-1 min-w-0" title={`Dyeing incharge: ${it.dyeingIncharge}`}>
          <User className="w-3 h-3 shrink-0 text-neutral-400" />
          <span className="truncate">{it.dyeingIncharge}</span>
        </span>
        <span className={`flex items-center gap-1 shrink-0 ${overdue ? 'text-danger-700 font-semibold' : ''}`} title="Delivery date">
          {overdue ? <Clock className="w-3 h-3" /> : <CalendarDays className="w-3 h-3 text-neutral-400" />}
          {fmtDate(it.deliveryDate)}
        </span>
      </div>

      <span className="mt-2.5 flex items-center justify-end gap-1 text-[11px] font-semibold text-brand-700 opacity-70 group-hover:opacity-100 transition">
        Open in My Work <ArrowRight className="w-3 h-3" />
      </span>
    </Link>
  );
}

function Qty({ label, value, tone, muted }: { label: string; value: string; tone?: string; muted?: boolean }) {
  return (
    <div className="rounded-lg bg-neutral-50 border border-neutral-100 px-2.5 py-1.5">
      <span className="text-[10px] text-neutral-500 block">{label}</span>
      <span className={`text-xs font-mono font-bold ${muted ? 'text-neutral-500' : tone || 'text-neutral-900'}`}>{value}</span>
    </div>
  );
}
