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
  Wind,
  Flame,
  ArrowRight,
  ShieldCheck,
  Send,
  FileText,
  Package,
} from 'lucide-react';
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';

export default function SteamPressFloorBoard() {
  const [loading, setLoading] = useState(true);
  const [lanes, setLanes] = useState<{
    INCOMING: any[];
    IN_PRESSING: any[];
    INSPECTION: any[];
    READY_FOR_DISPATCH: any[];
  }>({
    INCOMING: [],
    IN_PRESSING: [],
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
      const res = await fetch('/api/steam-press/floor-board');
      if (!res.ok) {
        throw new Error('Failed to load Steam Press Floor Board data.');
      }
      const json = await res.json();
      setLanes(
        json.data || {
          INCOMING: [],
          IN_PRESSING: [],
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
        (c.challanNumber || '').toLowerCase().includes(q) ||
        (c.programNumber || '').toLowerCase().includes(q) ||
        (c.styleCode || '').toLowerCase().includes(q) ||
        (c.clientName || '').toLowerCase().includes(q)
    );
  };

  const laneConfigs = [
    {
      id: 'INCOMING',
      title: '1. Inward Receipt',
      description: 'Incoming bundles from Finishing',
      color: 'border-cyan-500/40 text-cyan-400 bg-cyan-950/20',
      badgeColor: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
      cards: filterCards(lanes.INCOMING || []),
    },
    {
      id: 'IN_PRESSING',
      title: '2. In Steam Pressing',
      description: 'Crease setting & moisture extract',
      color: 'border-blue-500/40 text-blue-400 bg-blue-950/20',
      badgeColor: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
      cards: filterCards(lanes.IN_PRESSING || []),
    },
    {
      id: 'INSPECTION',
      title: '3. Quality & Moisture Audit',
      description: 'Shine & wrinkle-free check',
      color: 'border-teal-500/40 text-teal-400 bg-teal-950/20',
      badgeColor: 'bg-teal-500/10 text-teal-300 border-teal-500/30',
      cards: filterCards(lanes.INSPECTION || []),
    },
    {
      id: 'READY_FOR_DISPATCH',
      title: '4. Ready for Handover',
      description: 'Cleared for Final QC handover',
      color: 'border-emerald-500/40 text-emerald-400 bg-emerald-950/20',
      badgeColor: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
      cards: filterCards(lanes.READY_FOR_DISPATCH || []),
    },
  ];

  return (
    <div
      className="min-h-screen text-slate-100 flex flex-col"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(15, 23, 42, 0.94), rgba(10, 15, 29, 0.98)), url('${DEPARTMENT_NAV_BG_IMAGE}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* HEADER */}
      <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md px-6 py-4 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
              <Kanban className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Steam Press Live Floor Board
              </h1>
              <p className="text-xs text-slate-400">
                Live synchronized kanban visualization of pressing floor operations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Live Sync: {lastSyncTime.toLocaleTimeString()}</span>
            </div>

            <button
              onClick={() => loadBoard(true)}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-300 hover:text-white transition disabled:opacity-50"
              title="Refresh Kanban"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>

            <Link
              href="/steam-press/my-work"
              className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-900/30 transition flex items-center gap-1.5"
            >
              <Flame className="w-4 h-4" />
              <span>Workstation</span>
            </Link>
          </div>
        </div>
      </header>

      {/* MAIN KANBAN BOARD */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6 space-y-4">
        {/* SEARCH BAR */}
        <div className="flex items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 rounded-xl p-3 backdrop-blur-xs">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Filter by Challan, Program, Style, Client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
            />
          </div>

          <div className="text-xs text-slate-400">
            Total Active WIP:{' '}
            <span className="font-mono font-bold text-white">
              {laneConfigs.reduce((acc, l) => acc + l.cards.length, 0)} Jobs
            </span>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 4 COLUMNS KANBAN */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {laneConfigs.map((lane) => (
            <div
              key={lane.id}
              className={`rounded-2xl border ${lane.color} p-4 flex flex-col space-y-3 backdrop-blur-md min-h-[580px] shadow-sm`}
            >
              {/* Lane Header */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                <div>
                  <h3 className="font-bold text-xs text-white">{lane.title}</h3>
                  <p className="text-[10px] text-slate-400">{lane.description}</p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-bold border ${lane.badgeColor}`}
                >
                  {lane.cards.length}
                </span>
              </div>

              {/* Cards List */}
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[680px] pr-1">
                {lane.cards.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800/60 rounded-xl">
                    No jobs in this stage.
                  </div>
                ) : (
                  lane.cards.map((card: any) => (
                    <Link
                      key={card.id}
                      href={`/steam-press/my-work?jobId=${card.id}`}
                      className="block p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/60 transition shadow-sm hover:shadow-cyan-950/40 space-y-2.5 group"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-mono text-xs font-bold text-cyan-300 group-hover:text-cyan-200">
                          {card.challanNumber}
                        </span>
                        {card.priority === 'URGENT' && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            URGENT
                          </span>
                        )}
                      </div>

                      <div className="space-y-0.5 text-[11px]">
                        <div className="text-slate-300 font-semibold truncate">{card.styleCode}</div>
                        <div className="text-slate-400">Prog: {card.programNumber}</div>
                        <div className="text-slate-400 truncate">{card.clientName}</div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                        <span className="font-mono font-bold text-white">{card.totalPieces} PCS</span>
                        <div className="flex items-center gap-1 text-[11px] text-cyan-400 group-hover:translate-x-0.5 transition">
                          <span>Open</span>
                          <ArrowRight className="w-3 h-3" />
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
