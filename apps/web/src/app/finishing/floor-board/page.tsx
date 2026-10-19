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
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Send,
  FileText,
  Package,
} from 'lucide-react';
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';

export default function FinishingFloorBoard() {
  const [loading, setLoading] = useState(true);
  const [lanes, setLanes] = useState<{
    INCOMING: any[];
    IN_FINISHING: any[];
    INSPECTION: any[];
    READY_FOR_DISPATCH: any[];
  }>({
    INCOMING: [],
    IN_FINISHING: [],
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
      const res = await fetch('/api/finishing/floor-board');
      if (!res.ok) {
        throw new Error('Failed to load Finishing Floor Board data.');
      }
      const json = await res.json();
      setLanes(
        json.data || {
          INCOMING: [],
          IN_FINISHING: [],
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
      title: 'Incoming from Stitching',
      cards: filterCards(lanes.INCOMING || []),
      color: 'amber',
      borderColor: 'border-amber-500/30',
      badgeBg: 'bg-amber-500/20 text-amber-300',
    },
    {
      id: 'IN_FINISHING',
      title: 'Active Finishing Tables',
      cards: filterCards(lanes.IN_FINISHING || []),
      color: 'teal',
      borderColor: 'border-teal-500/40',
      badgeBg: 'bg-teal-500/20 text-teal-300',
    },
    {
      id: 'INSPECTION',
      title: 'Quality & Sizing Audit',
      cards: filterCards(lanes.INSPECTION || []),
      color: 'purple',
      borderColor: 'border-purple-500/40',
      badgeBg: 'bg-purple-500/20 text-purple-300',
    },
    {
      id: 'READY_FOR_DISPATCH',
      title: 'Ready for Handover',
      cards: filterCards(lanes.READY_FOR_DISPATCH || []),
      color: 'emerald',
      borderColor: 'border-emerald-500/40',
      badgeBg: 'bg-emerald-500/20 text-emerald-300',
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
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Kanban className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Finishing Floor Board (Kanban)
              </h1>
              <p className="text-xs text-slate-400">
                Live department workflow pipeline &bull; Auto-sync 5s &bull; Last update: {lastSyncTime.toLocaleTimeString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search board..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-400 w-48 sm:w-64"
              />
            </div>

            <button
              onClick={() => loadBoard(true)}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-300 hover:text-white transition disabled:opacity-50"
              title="Refresh Floor Board"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-teal-400' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* ERROR */}
      {error && (
        <div className="max-w-7xl mx-auto w-full px-6 pt-4">
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* KANBAN BOARD LANES */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6 overflow-x-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 min-w-[1000px] lg:min-w-0">
          {laneDefinitions.map((lane) => (
            <div
              key={lane.id}
              className="flex flex-col rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xs p-4 space-y-3 min-h-[500px]"
            >
              {/* Lane Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full bg-${lane.color}-400`}></span>
                  <h3 className="text-xs font-bold text-white tracking-wide uppercase">
                    {lane.title}
                  </h3>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${lane.badgeBg}`}>
                  {lane.cards.length}
                </span>
              </div>

              {/* Cards List */}
              <div className="flex-1 space-y-3 overflow-y-auto max-h-[calc(100vh-250px)] pr-1">
                {lane.cards.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-xs">
                    No jobs in this stage.
                  </div>
                ) : (
                  lane.cards.map((card) => (
                    <div
                      key={card.id}
                      className={`p-3.5 rounded-xl bg-slate-950/70 border ${lane.borderColor} hover:border-slate-600 transition flex flex-col justify-between space-y-2 shadow-sm`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-white">
                          {card.challanNumber}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            card.priority === 'HIGH' || card.priority === 'URGENT'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {card.priority || 'NORMAL'}
                        </span>
                      </div>

                      <div>
                        <div className="text-xs font-semibold text-teal-300">{card.styleCode}</div>
                        <div className="text-[11px] font-mono text-slate-400">
                          Program: {card.programNumber}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          Client: {card.clientName}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">
                          Pieces: <strong className="text-white font-mono">{card.totalPieces}</strong>
                        </span>
                        {card.goodPieces > 0 && (
                          <span className="text-emerald-400 font-mono font-bold">
                            Good: {card.goodPieces}
                          </span>
                        )}
                      </div>

                      <div className="pt-2 flex justify-end">
                        <Link
                          href={`/finishing/workspace/${card.id}`}
                          className="text-[10px] font-semibold text-teal-400 hover:text-teal-300 flex items-center gap-1 transition"
                        >
                          <span>Open Station</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
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
