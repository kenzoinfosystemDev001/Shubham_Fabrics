'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Kanban,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Shirt,
  ArrowRight,
  ShieldCheck,
  Send,
  FileText,
  Package,
} from 'lucide-react';
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';

export default function StitchingFloorBoard() {
  const [loading, setLoading] = useState(true);
  const [lanes, setLanes] = useState<{
    INCOMING: any[];
    IN_STITCHING: any[];
    INSPECTION: any[];
    READY_FOR_DISPATCH: any[];
  }>({
    INCOMING: [],
    IN_STITCHING: [],
    INSPECTION: [],
    READY_FOR_DISPATCH: [],
  });

  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  const loadBoard = async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
      setError('');
      const res = await fetch('/api/stitching/floor-board');
      if (!res.ok) {
        throw new Error('Failed to load Stitching Floor Board data.');
      }
      const json = await res.json();
      setLanes(
        json.data || {
          INCOMING: [],
          IN_STITCHING: [],
          INSPECTION: [],
          READY_FOR_DISPATCH: [],
        }
      );
      setLastSyncTime(new Date());
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error loading board');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadBoard(true);
    const interval = setInterval(() => {
      loadBoard(false);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const filterCards = (list: any[]) => {
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (c) =>
        c.challanNumber?.toLowerCase().includes(q) ||
        c.programNumber?.toLowerCase().includes(q) ||
        c.styleCode?.toLowerCase().includes(q) ||
        c.clientName?.toLowerCase().includes(q)
    );
  };

  const laneDefinitions = [
    {
      id: 'INCOMING',
      title: 'Incoming from Recutting',
      cards: filterCards(lanes.INCOMING || []),
      color: 'amber',
      borderColor: 'border-amber-500/30',
      badgeBg: 'bg-amber-500/20 text-amber-300',
    },
    {
      id: 'IN_STITCHING',
      title: 'Active Stitching Lines',
      cards: filterCards(lanes.IN_STITCHING || []),
      color: 'indigo',
      borderColor: 'border-indigo-500/40',
      badgeBg: 'bg-indigo-500/20 text-indigo-300',
    },
    {
      id: 'INSPECTION',
      title: 'End-Line QC Verification',
      cards: filterCards(lanes.INSPECTION || []),
      color: 'purple',
      borderColor: 'border-purple-500/30',
      badgeBg: 'bg-purple-500/20 text-purple-300',
    },
    {
      id: 'READY_FOR_DISPATCH',
      title: 'Ready for Finishing Handover',
      cards: filterCards(lanes.READY_FOR_DISPATCH || []),
      color: 'emerald',
      borderColor: 'border-emerald-500/30',
      badgeBg: 'bg-emerald-500/20 text-emerald-300',
    },
  ];

  return (
    <div className="min-h-screen bg-ink-950 text-slate-100 flex flex-col">
      {/* HEADER HERO */}
      <div
        style={{
          backgroundImage: `linear-gradient(to right, rgba(37, 35, 42, 0.95), rgba(37, 35, 42, 0.85)), url('${DEPARTMENT_NAV_BG_IMAGE}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        className="border-b border-slate-800 p-6 shadow-md"
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center">
              <Kanban className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white">Stitching Floor Kanban Board</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time visual WIP across incoming receipt, active sewing lines, in-line QA, and finishing handover
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700/80 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Live 5s</span>
              <span className="text-[10px] text-slate-400 font-mono">
                {lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>

            <button
              onClick={() => loadBoard(true)}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700 disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* FILTER & KANBAN GRID */}
      <div className="max-w-7xl mx-auto w-full p-4 md:p-6 space-y-4 flex-1 flex flex-col">
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* SEARCH BAR */}
        <div className="flex items-center justify-between gap-4 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by challan, style, program..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-lavender-500"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Link href="/stitching/my-work" className="hover:text-indigo-400 transition">
              Open Workstation &rarr;
            </Link>
          </div>
        </div>

        {/* 4 LANES */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 flex-1 items-start">
          {laneDefinitions.map((lane) => (
            <div
              key={lane.id}
              className={`rounded-2xl bg-slate-900/50 border ${lane.borderColor} p-3.5 flex flex-col gap-3 min-h-[500px]`}
            >
              {/* LANE HEADER */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-slate-200 tracking-wide">{lane.title}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${lane.badgeBg}`}>
                  {lane.cards.length}
                </span>
              </div>

              {/* CARD CONTAINER */}
              <div className="space-y-2.5 flex-1 overflow-y-auto">
                {lane.cards.length === 0 ? (
                  <div className="p-6 text-center text-[11px] text-slate-500 border border-dashed border-slate-800/80 rounded-xl">
                    No active jobs in this stage.
                  </div>
                ) : (
                  lane.cards.map((c) => (
                    <Link
                      key={c.id}
                      href={`/stitching/my-work?jobId=${c.id}`}
                      className="block p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition shadow-sm space-y-2 group"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-xs font-mono font-bold text-white group-hover:text-indigo-400 transition">
                          {c.challanNumber}
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                          {c.priority || 'NORM'}
                        </span>
                      </div>

                      <div className="space-y-0.5 text-xs">
                        <p className="font-semibold text-slate-300 truncate">{c.styleCode}</p>
                        <p className="text-[11px] text-slate-500 truncate">{c.programNumber}</p>
                      </div>

                      <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Total: <strong className="text-white">{c.totalPieces}</strong> pcs</span>
                        {c.goodPieces > 0 ? (
                          <span className="text-emerald-400 font-semibold">{c.goodPieces} good</span>
                        ) : (
                          <span className="text-slate-500">In Queue</span>
                        )}
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
