'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function StoreDashboardPage() {
  const [summary, setSummary] = useState<any[]>([]);
  const [rolls, setRolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, r] = await Promise.all([
          api.getStockSummary().catch(() => []),
          api.getFabricRolls().catch(() => []),
        ]);
        if (s) setSummary(s);
        if (r) setRolls(r);
      } catch {}
      finally { setLoading(false); }
    };
    load();
  }, []);

  const totalPlain = rolls.filter((r) => r.status === 'RECEIVED').reduce((a, b) => a + (b.currentLengthMtr || 0), 0);
  const totalIssued = rolls.filter((r) => r.status === 'ISSUED').reduce((a, b) => a + (b.currentLengthMtr || 0), 0);

  return (
    <div className="pt-14 md:pl-56 min-h-screen bg-[#0B0F17] text-[#f1f5f9] font-sans">
      <div className="p-5 lg:p-7 max-w-[1600px] mx-auto space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1E3258]">
          <div>
            <h1 className="text-xl font-extrabold text-white flex items-center gap-2.5"><span className="text-amber-300">◈</span> Store Control Center</h1>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">Raw material intake · stock ledger · issue handoff.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/store" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded transition">Open Store</Link>
            <Link href="/challans" className="px-3 py-1.5 bg-[#1C2F52] border border-[#2B4370] text-slate-200 text-xs font-semibold rounded transition">Challans</Link>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Plain Stock', value: `${totalPlain.toLocaleString()} m`, sub: 'on the shelf' },
            { label: 'Issued to Floor', value: `${totalIssued.toLocaleString()} m`, sub: 'out on production' },
            { label: 'Fabric Rolls', value: rolls.length, sub: 'registered in system' },
            { label: 'Inward Today', value: 0, sub: 'rolls received' },
          ].map((k) => (
            <div key={k.label} className="bg-[#111D36] border border-[#1E3258] rounded-lg p-4 hover:border-[#3D5A8A] transition">
              <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{k.label}</div>
              <div className="text-2xl font-black text-amber-300 mt-1">{k.value}</div>
              <div className="text-[11px] text-slate-500 mt-1">{k.sub}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-[#111D36] border border-[#1E3258] rounded-xl p-5 shadow-xl">
            <h2 className="text-sm font-extrabold text-white mb-4">Stock by Department</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-slate-500 border-b border-[#1E3258]">
                    <th className="text-left py-2 font-semibold">Dept</th>
                    <th className="text-left py-2 font-semibold">Item</th>
                    <th className="text-right py-2 font-semibold">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E3258]/50">
                  {summary.length > 0 ? summary.map((s, i) => (
                    <tr key={i} className="hover:bg-[#1C2F52]/30">
                      <td className="py-2 font-bold text-blue-300">{s.departmentCode}</td>
                      <td className="py-2 text-slate-300">{s.description}</td>
                      <td className="py-2 text-right font-bold text-emerald-300">{s.currentQuantity} {s.uom}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={3} className="py-6 text-center text-slate-500">No stock data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-[#111D36] border border-[#1E3258] rounded-xl p-5 shadow-xl">
            <h2 className="text-sm font-extrabold text-white mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/store" className="p-3 bg-[#0B0F17] border border-[#1E3258] rounded-lg hover:border-blue-400 transition text-center">
                <div className="text-lg">📥</div>
                <div className="text-xs font-bold text-slate-200 mt-1">Receive</div>
              </Link>
              <Link href="/store" className="p-3 bg-[#0B0F17] border border-[#1E3258] rounded-lg hover:border-blue-400 transition text-center">
                <div className="text-lg">🧵</div>
                <div className="text-xs font-bold text-slate-200 mt-1">Trims</div>
              </Link>
              <Link href="/challans" className="p-3 bg-[#0B0F17] border border-[#1E3258] rounded-lg hover:border-blue-400 transition text-center">
                <div className="text-lg">📄</div>
                <div className="text-xs font-bold text-slate-200 mt-1">Issue</div>
              </Link>
              <Link href="/store" className="p-3 bg-[#0B0F17] border border-[#1E3258] rounded-lg hover:border-blue-400 transition text-center">
                <div className="text-lg">⚠️</div>
                <div className="text-xs font-bold text-slate-200 mt-1">Defected</div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}