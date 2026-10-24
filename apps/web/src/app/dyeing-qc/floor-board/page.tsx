'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Kanban,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  Layers,
  ArrowRight,
  Briefcase,
  ExternalLink,
  ShieldAlert,
  RotateCcw,
  PauseCircle,
  FileText,
  User
} from 'lucide-react';

interface FloorItem {
  id: string;
  challanNumber: string;
  programId: string;
  productionSheetNumber: string;
  programNumber: string;
  wilcomDesignNumber: string | null;
  clientName: string;
  fabric: string;
  fabricType: string | null;
  color: string;
  quantity: number;
  quantityInspected: number;
  quantityPassed: number;
  quantityFailed: number;
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

export default function DyeingQCFloorBoard() {
  const [loading, setLoading] = useState(true);
  const [columns, setColumns] = useState<Record<string, FloorItem[]>>({
    RECEIVED: [],
    UNDER_INSPECTION: [],
    PASS: [],
    FAIL: [],
    REWORK: [],
    HOLD: [],
  });
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const loadBoard = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/dyeing-qc/floor-board');
      if (!res.ok) {
        throw new Error('Failed to load Dyeing QC Floor Board data.');
      }
      const json = await res.json();
      setColumns(json.data.columns || {});
      setTotalItems(json.data.totalItems || 0);
    } catch (err: any) {
      console.error('Error loading Dyeing QC floor board:', err);
      setError(err.message || 'Error connecting to database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoard();
  }, []);

  const columnConfig: Record<
    string,
    { label: string; bg: string; border: string; badge: string; text: string; count: number }
  > = {
    RECEIVED: {
      label: 'Received / Awaiting QC',
      bg: 'bg-slate-50/70',
      border: 'border-slate-200',
      badge: 'bg-slate-200 text-slate-800',
      text: 'text-slate-800',
      count: columns.RECEIVED?.length || 0,
    },
    UNDER_INSPECTION: {
      label: 'Under Inspection',
      bg: 'bg-blue-50/50',
      border: 'border-blue-200',
      badge: 'bg-blue-100 text-blue-900',
      text: 'text-blue-900',
      count: columns.UNDER_INSPECTION?.length || 0,
    },
    PASS: {
      label: 'PASS (To Next Dept)',
      bg: 'bg-emerald-50/50',
      border: 'border-emerald-200',
      badge: 'bg-emerald-100 text-emerald-900',
      text: 'text-emerald-900',
      count: columns.PASS?.length || 0,
    },
    FAIL: {
      label: 'REJECT (Defective Shelf)',
      bg: 'bg-rose-50/50',
      border: 'border-rose-200',
      badge: 'bg-rose-100 text-rose-900',
      text: 'text-rose-900',
      count: columns.FAIL?.length || 0,
    },
    REWORK: {
      label: 'REWORK (To Dyeing)',
      bg: 'bg-purple-50/50',
      border: 'border-purple-200',
      badge: 'bg-purple-100 text-purple-900',
      text: 'text-purple-900',
      count: columns.REWORK?.length || 0,
    },
    HOLD: {
      label: 'On Hold',
      bg: 'bg-amber-50/50',
      border: 'border-amber-200',
      badge: 'bg-amber-100 text-amber-900',
      text: 'text-amber-900',
      count: columns.HOLD?.length || 0,
    },
  };

  // Filter items matching search
  const filterList = (list: FloorItem[] = []) => {
    if (!search.trim()) return list;
    const term = search.toLowerCase();
    return list.filter(
      (it) =>
        it.challanNumber.toLowerCase().includes(term) ||
        it.productionSheetNumber.toLowerCase().includes(term) ||
        it.fabric.toLowerCase().includes(term) ||
        it.color.toLowerCase().includes(term) ||
        it.clientName.toLowerCase().includes(term) ||
        (it.inspector && it.inspector.toLowerCase().includes(term))
    );
  };

  return (
    <div className="min-h-screen bg-ink-50 pb-16 flex flex-col">
      {/* TOP HEADER */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700 block">
            SHUBHAM FABRICS MES · INSPECTION STAGES
          </span>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Kanban className="w-5 h-5 text-amber-500" />
            <span>Dyeing QC Floor Board</span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search sheet, lot, fabric..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg w-48 sm:w-64 focus:bg-white focus:outline-none focus:ring-1 focus:ring-lavender-500 transition"
            />
          </div>

          <button
            onClick={loadBoard}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition"
            title="Refresh Board"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <Link
            href="/dyeing-qc/my-work"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-lavender-700 hover:bg-lavender-800 text-white text-xs font-semibold rounded-lg shadow-xs transition"
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>My Work</span>
          </Link>
        </div>
      </header>

      {/* ERROR */}
      {error && (
        <div className="mx-4 sm:mx-8 mt-4 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
          <button onClick={loadBoard} className="ml-auto underline font-bold">
            Retry
          </button>
        </div>
      )}

      {/* EMPTY DATABASE STATE */}
      {!loading && totalItems === 0 && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md w-full text-center p-8 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
            <CheckCircle2 className="w-10 h-10 text-slate-300 mx-auto" />
            <h2 className="text-sm font-bold text-slate-800">
              No material currently waiting for Dyeing QC inspection.
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              When the Dyeing Department completes dyeing and issues an inter-department Challan to Dyeing QC,
              it will automatically arrive on this Floor Board in real time.
            </p>
            <div className="pt-2">
              <Link
                href="/dyeing"
                className="text-xs text-purple-700 hover:text-purple-900 font-semibold inline-flex items-center gap-1"
              >
                <span>Check Dyeing Department</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 6-STAGE FLOOR BOARD COLUMNS */}
      {totalItems > 0 && (
        <main className="p-4 sm:p-6 overflow-x-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 min-w-[1200px]">
            {Object.keys(columnConfig).map((colKey) => {
              const cfg = columnConfig[colKey];
              const items = filterList(columns[colKey] || []);

              return (
                <div
                  key={colKey}
                  className={`rounded-xl border ${cfg.border} ${cfg.bg} flex flex-col max-h-[calc(100vh-160px)] shadow-xs`}
                >
                  {/* Column Header */}
                  <div className="p-3 border-b border-slate-200/80 bg-white/70 rounded-t-xl flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800 truncate">
                      {cfg.label}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${cfg.badge}`}>
                      {items.length}
                    </span>
                  </div>

                  {/* Column Cards Container */}
                  <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1">
                    {items.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-[11px]">
                        No lots in this stage
                      </div>
                    ) : (
                      items.map((it) => (
                        <div
                          key={it.id}
                          className="bg-white border border-slate-200/90 rounded-lg p-3 shadow-xs space-y-2 hover:border-slate-300 transition"
                        >
                          {/* Card Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-mono font-bold text-xs text-slate-900 block leading-tight">
                                {it.productionSheetNumber}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500 block">
                                {it.challanNumber}
                              </span>
                            </div>

                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                it.priority === 'URGENT'
                                  ? 'bg-rose-100 text-rose-800'
                                  : it.priority === 'HIGH'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {it.priority}
                            </span>
                          </div>

                          {/* Fabric & Color */}
                          <div className="text-[11px] text-slate-700">
                            <span className="font-medium text-slate-900 block truncate">
                              {it.fabric}
                            </span>
                            <div className="flex items-center gap-1.5 text-slate-500 text-[10px] mt-0.5">
                              <span>Color:</span>
                              <span className="font-semibold text-slate-800">{it.color}</span>
                            </div>
                          </div>

                          {/* Quantities breakdown */}
                          <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-1.5 text-[10px]">
                            <div>
                              <span className="text-slate-400 block">Sent / Recv:</span>
                              <span className="font-mono font-bold text-slate-900">
                                {it.quantity} {it.uom}
                              </span>
                            </div>

                            {it.quantityInspected > 0 && (
                              <div>
                                <span className="text-slate-400 block">Inspected:</span>
                                <span className="font-mono font-bold text-blue-900">
                                  {it.quantityInspected} {it.uom}
                                </span>
                              </div>
                            )}

                            {it.quantityPassed > 0 && (
                              <div>
                                <span className="text-emerald-700 block">Passed:</span>
                                <span className="font-mono font-bold text-emerald-800">
                                  {it.quantityPassed} {it.uom}
                                </span>
                              </div>
                            )}

                            {it.quantityFailed > 0 && (
                              <div>
                                <span className="text-rose-700 block">Failed:</span>
                                <span className="font-mono font-bold text-rose-800">
                                  {it.quantityFailed} {it.uom}
                                </span>
                              </div>
                            )}

                            {it.quantityRework > 0 && (
                              <div>
                                <span className="text-purple-700 block">Rework:</span>
                                <span className="font-mono font-bold text-purple-800">
                                  {it.quantityRework} {it.uom}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Footer info: Delivery date & Inspector */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                            <div className="flex items-center gap-1 truncate">
                              <User className="w-3 h-3 text-slate-400" />
                              <span className="truncate">{it.inspector || it.dyeingIncharge}</span>
                            </div>

                            {it.deliveryDate && (
                              <span className="font-mono font-medium text-slate-600">
                                Del: {new Date(it.deliveryDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>

                          {/* Action Button */}
                          <div className="pt-1">
                            <Link
                              href={`/dyeing-qc/my-work?challanId=${it.id}`}
                              className="w-full flex items-center justify-center gap-1.5 py-1 px-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded text-[11px] font-semibold border border-slate-200 transition"
                            >
                              <span>Open in My Work</span>
                              <ArrowRight className="w-3 h-3 text-slate-400" />
                            </Link>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      )}
    </div>
  );
}
