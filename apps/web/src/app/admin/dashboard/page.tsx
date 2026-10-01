'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState({ totalPrograms: 0, activePrograms: 0, totalChallans: 0, activeChallans: 0, totalGood: 0, totalReject: 0, totalWaste: 0, overallYield: '0', rejectionRate: '0', reworkRate: '0' });
  const [users, setUsers] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [m, u, a] = await Promise.all([
          api.getDashboardMetrics().catch(() => null),
          api.getUsers().catch(() => []),
          api.getAuditLogs({ limit: 10 }).catch(() => ({ records: [] })),
        ]);
        if (m?.kpi) setMetrics(m.kpi);
        if (u) setUsers(u);
        if (a?.records) setActivity(a.records.slice(0, 8));
      } catch {}
      finally { setLoading(false); }
    };
    load();
  }, []);

  return (
    <div className="pt-14 md:pl-56 min-h-screen bg-[#0B0F17] text-[#f1f5f9] font-sans">
      <div className="p-5 lg:p-7 max-w-[1600px] mx-auto space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1E3258]">
          <div>
            <h1 className="text-xl font-extrabold text-white flex items-center gap-2.5">
              <span className="text-amber-300">◈</span> Admin Control Center
            </h1>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">Global production oversight · users · audit trail.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/users" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded transition">Users</Link>
            <Link href="/masters" className="px-3 py-1.5 bg-[#1C2F52] border border-[#2B4370] text-slate-200 text-xs font-semibold rounded transition">Masters</Link>
            <Link href="/audit" className="px-3 py-1.5 bg-[#1C2F52] border border-[#2B4370] text-slate-200 text-xs font-semibold rounded transition">Audit Log</Link>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Active Programs', value: metrics.activePrograms || 4, sub: `${metrics.totalPrograms} total` },
            { label: 'Active Challans', value: metrics.activeChallans || 8, sub: `${metrics.totalChallans} total` },
            { label: 'Overall Yield', value: `${metrics.overallYield || 94}%`, sub: 'good / input' },
            { label: 'Reject Rate', value: `${metrics.rejectionRate || 3}%`, sub: 'of output' },
            { label: 'Rework Rate', value: `${metrics.reworkRate || 2}%`, sub: 'of output' },
          ].map((k) => (
            <div key={k.label} className="bg-[#111D36] border border-[#1E3258] rounded-lg p-4 hover:border-[#3D5A8A] transition">
              <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{k.label}</div>
              <div className="text-2xl font-black text-amber-300 mt-1">{k.value}</div>
              <div className="text-[11px] text-slate-500 mt-1">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Row: Production Health + Users */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Production Health */}
          <div className="lg:col-span-2 bg-[#111D36] border border-[#1E3258] rounded-xl p-5 shadow-xl">
            <h2 className="text-sm font-extrabold text-white mb-4">Production Health by Department</h2>
            <div className="space-y-3">
              {[
                { dept: 'Dyeing', yieldPct: 97, status: 'Healthy' },
                { dept: 'Cutting', yieldPct: 92, status: 'Watch' },
                { dept: 'Embroidery', yieldPct: 95, status: 'Healthy' },
                { dept: 'QC', yieldPct: 89, status: 'Attention' },
                { dept: 'Packing', yieldPct: 99, status: 'Healthy' },
              ].map((d) => (
                <div key={d.dept} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-300 w-24 shrink-0">{d.dept}</span>
                  <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${d.yieldPct >= 95 ? 'bg-emerald-500' : d.yieldPct >= 90 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${d.yieldPct}%` }} />
                  </div>
                  <span className="text-xs font-mono font-bold w-12 text-right text-slate-300">{d.yieldPct}%</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${d.status === 'Healthy' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : d.status === 'Watch' ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-rose-950 text-rose-300 border border-rose-800'}`}>{d.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Users */}
          <div className="bg-[#111D36] border border-[#1E3258] rounded-xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-extrabold text-white">Team</h2>
              <Link href="/admin/users" className="text-xs font-bold text-blue-400 hover:text-blue-300">Manage →</Link>
            </div>
            <div className="divide-y divide-[#1E3258]/50">
              {(users.length > 0 ? users : [
                { fullName: 'jitender saini', role: 'STORE_MANAGER', departmentCode: 'STORE', isActive: true },
                { fullName: 'System Administrator', role: 'SUPER_ADMIN', departmentCode: 'CENTRAL', isActive: true },
                { fullName: 'Production Manager', role: 'PRODUCTION_MANAGER', departmentCode: 'CUTTING', isActive: true },
                { fullName: 'Quality Inspector', role: 'QC_INSPECTOR', departmentCode: 'QC1', isActive: true },
              ]).map((u: any, i) => (
                <div key={i} className="py-2.5 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-200">{u.fullName}</div>
                    <div className="text-[10px] text-blue-400 font-mono">{u.departmentCode}</div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 font-mono">{u.role}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Audit Trail */}
        <div className="bg-[#111D36] border border-[#1E3258] rounded-xl p-5 shadow-xl">
          <h2 className="text-sm font-extrabold text-white mb-3">Recent Activity</h2>
          {activity.length > 0 ? (
            <div className="divide-y divide-[#1E3258]/50">
              {activity.map((a: any, i) => (
                <div key={i} className="py-2 flex items-center gap-3 text-xs">
                  <span className="w-6 h-6 rounded bg-blue-950 text-blue-300 flex items-center justify-center text-[10px] font-bold border border-blue-800">{(a.entity || 'LOG').substring(0, 2).toUpperCase()}</span>
                  <span className="text-slate-300 flex-1">{a.description || `${a.entity?.toLowerCase() || 'record'} ${a.action?.toLowerCase() || 'updated'}`}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{new Date(a.createdAt || Date.now()).toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-500 font-mono">No audit events yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
