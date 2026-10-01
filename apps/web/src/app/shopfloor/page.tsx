'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';
import { DepartmentCode } from '@subham/types';
import { DEPARTMENT_LABELS } from '@subham/config';

export default function FloorBoardPage() {
  const [selectedDept, setSelectedDept] = useState<DepartmentCode>(DepartmentCode.CUTTING);
  const [stats, setStats] = useState({ activeLots: 4, inQC: 1, stalled: 4, unaccounted: 9 });
  const [stageData, setStageData] = useState([
    { stage: 'Dyeing', qty: 1, total: 1 },
    { stage: 'QC 1 (Checking)', qty: 1, total: 1, note: 'Quality control' },
    { stage: 'Cutting', qty: 0, total: 0 },
    { stage: 'Embroidery', qty: 1, total: 1, note: 'Embroidery' },
    { stage: 'Thread cutting', qty: 1, total: 1, note: 'Thread cutting' },
    { stage: 'Finishing', qty: 1, total: 1 },
    { stage: 'Buttons & attac...', qty: 1, total: 1 },
    { stage: 'Steam press', qty: 0, total: 0 },
    { stage: 'Packing', qty: 1, total: 1 },
  ]);
  const [workToday, setWorkToday] = useState([
    { day: 'Today', dept: 1, today: 4, mon: 4, tue: 0, wed: 0, thu: 0, fri: 0 },
    { day: 'Mon', dept: 1, today: 0, mon: 4, tue: 0, wed: 0, thu: 0, fri: 0 },
  ]);
  const [qcResults, setQcResults] = useState([
    { title: 'Passed', value: 2, sub: 'Passed' },
    { title: 'Started back', value: 0, sub: 'Start back' },
    { title: 'Rejected', value: 0, sub: 'Rejected' },
  ]);
  const [needsAttention, setNeedsAttention] = useState([
    { lot: 'SF-3201-NEW-2609-01', from: 'Dyeing', to: 'QC 1 (Checking)', time: '2d 13h', tag: 'Started' },
    { lot: 'SF-100-NEW-2609-01', from: 'Dyeing', to: 'Cutting', time: '17h 27m', tag: 'Started' },
  ]);
  const [stageCards, setStageCards] = useState<{ name: string; count: number; cards: { id: string; code: string; status: string; time: string; sub?: string }[] }[]>([
    { name: 'Dyeing', count: 1, cards: [{ id: 'd1', code: 'SF-AB579...', status: 'Started', time: '2d 13h' }] },
    { name: 'QC 1 (Checking)', count: 1, cards: [{ id: 'q1', code: 'SF-100-NEW...', status: 'Started', time: '17h 27m', sub: 'Quality control' }] },
    { name: 'Cutting', count: 0, cards: [] },
    { name: 'Embroidery', count: 1, cards: [{ id: 'e1', code: 'SF-3204-...', status: 'Started', time: '23h 57m', sub: 'Embroidery' }] },
    { name: 'Thread cutting', count: 1, cards: [{ id: 't1', code: 'SF-3234-...', status: 'Started', time: '1d 2h', sub: 'Thread cutting' }] },
  ]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [floor, challans] = await Promise.all([
          api.getFloorBoardState().catch(() => null),
          api.getChallans({ toDepartment: selectedDept, status: 'IN_PROCESS' }).catch(() => []),
        ]);
        if (floor?.metrics) {
          setStats({
            activeLots: floor.metrics.activeLots ?? 4,
            inQC: floor.metrics.inQC ?? 1,
            stalled: floor.metrics.stalled ?? 4,
            unaccounted: floor.metrics.unaccounted ?? 9,
          });
        }
      } catch { /* demo fallback */ }
      finally { setLoading(false); }
    };
    load();
  }, [selectedDept]);

  return (
    <div className="pt-14 md:pl-56 min-h-screen bg-[#0B0F17] text-[#f1f5f9] font-sans">
      <div className="p-5 lg:p-7 max-w-[1600px] mx-auto space-y-5">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1E3258]">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              <span className="text-amber-300">◈</span> Live Production Floor
              <span className="text-[11px] font-mono font-semibold text-blue-400 bg-blue-950 px-1.5 py-0.5 rounded border border-blue-800">LIVE</span>
            </h1>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">How the mill is running — refreshing every minute.</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded shadow transition">● Live updates every minute</button>
            <button className="px-3 py-1.5 bg-[#1C2F52] border border-[#2B4370] hover:bg-[#223860] text-slate-200 text-xs font-semibold rounded transition">Wall View</button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Active lots', value: stats.activeLots, sub: 'on the floor row', accent: 'amber' },
            { label: 'In QC now', value: stats.inQC, sub: 'at a checking table', accent: 'blue' },
            { label: 'Stalled over 4h', value: stats.stalled, sub: 'click to see them', accent: 'rose' },
            { label: 'Unaccounted', value: `${stats.unaccounted} m`, sub: 'open the report →', accent: 'emerald' },
          ].map((k) => (
            <div key={k.label} className="bg-[#111D36] border border-[#1E3258] rounded-lg p-4 shadow-lg hover:border-[#3D5A8A] transition">
              <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{k.label}</div>
              <div className={`text-3xl font-black font-sans mt-1 ${k.accent === 'amber' ? 'text-amber-300' : k.accent === 'blue' ? 'text-blue-300' : k.accent === 'rose' ? 'text-rose-400' : 'text-emerald-300'}`}>{k.value}</div>
              <div className="text-[11px] text-slate-500 mt-1">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Middle Row: Lots at each stage + Work recorded */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left: Lots at each stage */}
          <div className="lg:col-span-2 bg-[#111D36] border border-[#1E3258] rounded-xl p-5 shadow-xl">
            <h2 className="text-sm font-extrabold text-white mb-0.5">Lots at each stage</h2>
            <p className="text-[11px] text-slate-400 mb-4">How many lots are waiting at each stage. Click a stage to filter the board below.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {stageData.map((s) => {
                const pct = s.total > 0 ? Math.round((s.qty / Math.max(s.total, 1)) * 100) : 0;
                return (
                  <button
                    key={s.stage}
                    onClick={() => setSelectedDept(s.stage === 'Cutting' ? DepartmentCode.CUTTING : DepartmentCode.DYEING)}
                    className="bg-[#0B0F17] border border-[#1E3258] hover:border-blue-400 rounded-lg p-3 text-left transition group"
                  >
                    <div className="text-[10px] font-mono font-bold text-amber-300 mb-1">{s.qty} of {s.total}</div>
                    <div className="text-xs font-bold text-slate-200 group-hover:text-white truncate">{s.stage}</div>
                    {s.note && <div className="text-[10px] text-blue-400 mt-0.5">{s.note}</div>}
                    <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full" style={{ width: `${pct || 10}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Work recorded */}
          <div className="bg-[#111D36] border border-[#1E3258] rounded-xl p-5 shadow-xl">
            <h2 className="text-sm font-extrabold text-white mb-0.5">Work recorded</h2>
            <p className="text-[11px] text-slate-400 mb-3">Entries made on the floor today, last 7 days.</p>
            <table className="w-full text-[11px] font-mono">
              <thead>
                <tr className="text-slate-500 border-b border-[#1E3258]">
                  <th className="text-left py-1 font-semibold">Day</th>
                  <th className="text-right py-1 font-semibold">Dept</th>
                  <th className="text-right py-1 font-semibold">Today</th>
                  <th className="text-right py-1 font-semibold">Mon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E3258]/50">
                {workToday.map((r) => (
                  <tr key={r.day} className="hover:bg-[#1C2F52]/40">
                    <td className="py-1.5 text-slate-200">{r.day}</td>
                    <td className="py-1.5 text-right text-blue-300">{r.dept}</td>
                    <td className="py-1.5 text-right font-bold text-amber-300">{r.today}</td>
                    <td className="py-1.5 text-right text-slate-400">{r.mon}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* QC Results + Attention */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* QC Results */}
          <div className="bg-[#111D36] border border-[#1E3258] rounded-xl p-5 shadow-xl">
            <h2 className="text-sm font-extrabold text-white mb-0.5">QC results</h2>
            <p className="text-[11px] text-slate-400 mb-4">Lots checked at QC, last 7 days.</p>
            <div className="grid grid-cols-3 gap-2">
              {qcResults.map((q) => (
                <div key={q.title} className="bg-[#0B0F17] border border-[#1E3258] rounded-lg p-3 text-center hover:border-blue-400 transition">
                  <div className="text-2xl font-black text-blue-300">{q.value}</div>
                  <div className="text-[10px] font-bold text-slate-300 mt-1">{q.title}</div>
                  <div className="text-[10px] text-slate-500">{q.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Needs attention */}
          <div className="lg:col-span-2 bg-[#111D36] border border-[#1E3258] rounded-xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-extrabold text-white">Needs attention</h2>
                <p className="text-[11px] text-slate-400">A stage sent more than the next one received.</p>
              </div>
              <a href="#" className="text-xs font-bold text-blue-400 hover:text-blue-300">View all →</a>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] font-mono">
                <thead>
                  <tr className="text-slate-500 border-b border-[#1E3258]">
                    <th className="text-left py-2 font-semibold">Lot</th>
                    <th className="text-left py-2 font-semibold">From</th>
                    <th className="text-left py-2 font-semibold">To</th>
                    <th className="text-right py-2 font-semibold">Sent</th>
                    <th className="text-right py-2 font-semibold">Received</th>
                    <th className="text-left py-2 font-semibold">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E3258]/50">
                  {needsAttention.map((n) => (
                    <tr key={n.lot} className="hover:bg-[#1C2F52]/30">
                      <td className="py-2 font-bold text-blue-300">{n.lot}</td>
                      <td className="py-2 text-slate-300">{n.from}</td>
                      <td className="py-2 text-slate-300">{n.to}</td>
                      <td className="py-2 text-right text-amber-300 font-bold">{n.from === 'Dyeing' ? '10 m' : '-'}</td>
                      <td className="py-2 text-right text-rose-400 font-bold">{n.to === 'QC 1 (Checking)' ? '1 m' : '-'}</td>
                      <td className="py-2 text-slate-400">{n.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Stage Cards Row */}
        <div className="bg-[#111D36] border border-[#1E3258] rounded-xl p-5 shadow-xl">
          <h2 className="text-sm font-extrabold text-white mb-4">The floor, stage by stage</h2>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {stageCards.map((sc) => (
              <div key={sc.name} className="min-w-[220px] bg-[#0B0F17] border border-[#1E3258] rounded-lg p-3 hover:border-blue-400 transition">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-extrabold text-white">{sc.name}</span>
                  <span className="text-[10px] font-mono text-amber-300 font-bold bg-amber-950 px-1.5 py-0.5 rounded border border-amber-800">{sc.count}</span>
                </div>
                <div className="space-y-2">
                  {sc.cards.length === 0 ? (
                    <div className="text-[11px] text-slate-500 font-mono">Nothing here</div>
                  ) : sc.cards.map((c) => (
                    <div key={c.id} className="bg-[#111D36] border border-[#1E3258] rounded p-2 text-[10px] font-mono hover:border-blue-500 transition">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-blue-300">{c.code}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${c.status === 'Started' ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-blue-950 text-blue-300 border border-blue-800'}`}>{c.status}</span>
                      </div>
                      <div className="text-slate-400 mt-0.5">{c.time}</div>
                      {c.sub && <div className="text-blue-400 mt-0.5">{c.sub}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="text-[11px] text-slate-500 mt-2">4 lots shown · Filter by stage below</div>
        </div>
      </div>
    </div>
  );
}
