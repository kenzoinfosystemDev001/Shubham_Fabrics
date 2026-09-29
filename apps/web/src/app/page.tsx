'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [recentPrograms, setRecentPrograms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [m, depts, progs] = await Promise.all([
        api.getDashboardMetrics(),
        api.getDepartments(),
        api.getPrograms(),
      ]);
      setMetrics(m);
      setDepartments(depts);
      setRecentPrograms(progs.slice(0, 5));
    } catch (err: any) {
      setError(err.message || 'Failed to connect to MES Backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000); // 15s refresh
    return () => clearInterval(interval);
  }, []);

  if (loading && !metrics) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm font-mono text-slate-400">Loading Subham Fabrics MES Telemetry...</p>
        </div>
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="p-8">
        <div className="bg-rose-950/40 border border-rose-800 rounded-lg p-6 max-w-2xl mx-auto text-center">
          <h2 className="text-lg font-bold text-rose-300 mb-2">Backend Connection Alert</h2>
          <p className="text-sm text-rose-200 mb-4">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-rose-700 hover:bg-rose-600 text-white text-xs font-semibold rounded"
          >
            Retry Handshake
          </button>
        </div>
      </div>
    );
  }

  const kpi = metrics?.kpi || {};

  return (
    <div className="p-6 space-y-6 max-w-[1600px] w-full mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Factory Floor Control & Execution Dashboard
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Real-time shop floor visibility, department WIP queues, and production accounting
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-mono rounded flex items-center gap-1.5 transition-colors"
          >
            <span>🔄</span> Refresh Telemetry
          </button>
          <Link
            href="/shopfloor"
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded shadow transition-colors flex items-center gap-1.5"
          >
            <span>⚡</span> Open Station Terminal
          </Link>
        </div>
      </div>

      {/* Primary KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5">
          <span className="text-[11px] font-mono text-slate-400 block uppercase">Active Programs</span>
          <div className="text-2xl font-bold text-slate-100 mt-1 font-mono">{kpi.activePrograms || 0}</div>
          <span className="text-[10px] text-slate-500 mt-0.5 block">{kpi.totalPrograms || 0} Total in System</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5">
          <span className="text-[11px] font-mono text-slate-400 block uppercase">WIP Challans</span>
          <div className="text-2xl font-bold text-blue-400 mt-1 font-mono">{kpi.activeChallans || 0}</div>
          <span className="text-[10px] text-slate-500 mt-0.5 block">{kpi.totalChallans || 0} Total Issued</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5">
          <span className="text-[11px] font-mono text-slate-400 block uppercase">Accounted Input</span>
          <div className="text-2xl font-bold text-slate-100 mt-1 font-mono">{kpi.totalInput || 0}</div>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Units / KG processed</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5">
          <span className="text-[11px] font-mono text-slate-400 block uppercase">Good Output</span>
          <div className="text-2xl font-bold text-emerald-400 mt-1 font-mono">{kpi.totalGood || 0}</div>
          <span className="text-[10px] text-emerald-500/80 mt-0.5 block">Yield: {kpi.overallYield}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5">
          <span className="text-[11px] font-mono text-slate-400 block uppercase">Rejections</span>
          <div className="text-2xl font-bold text-rose-400 mt-1 font-mono">{kpi.totalReject || 0}</div>
          <span className="text-[10px] text-rose-400/80 mt-0.5 block">Rate: {kpi.rejectionRate}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5">
          <span className="text-[11px] font-mono text-slate-400 block uppercase">Process Scrap</span>
          <div className="text-2xl font-bold text-amber-400 mt-1 font-mono">{kpi.totalWaste || 0}</div>
          <span className="text-[10px] text-amber-400/80 mt-0.5 block">Cutting & Trims scrap</span>
        </div>
      </div>

      {/* 17-Department Factory Floor WIP Matrix */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
          <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <span>🏭</span> Manufacturing Line Status (All 17 Routing Stations)
          </h2>
          <span className="text-[10px] font-mono text-slate-400">Genealogy Handoff Tracked</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {departments.map((dept) => (
            <div
              key={dept.code}
              className="bg-slate-950 border border-slate-800/80 rounded p-2.5 hover:border-blue-700/60 transition-colors"
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-mono text-slate-500">#{dept.sequenceOrder}</span>
                <span className="font-bold text-slate-300 font-mono">{dept.code}</span>
              </div>
              <p className="text-[11px] font-medium text-slate-400 truncate mt-1" title={dept.name}>
                {dept.name}
              </p>
              <div className="mt-2 pt-2 border-t border-slate-900 flex items-center justify-between text-[11px] font-mono">
                <span className="text-amber-400/90" title="Incoming Challans">
                  📥 {dept.incomingCount || 0}
                </span>
                <span className="text-blue-400 font-bold" title="Work in Progress">
                  ⚙️ {dept.wipCount || 0}
                </span>
                <span className="text-emerald-400" title="Completed Handed Over">
                  ✅ {dept.completedCount || 0}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Split Grid: Active Programs & Audit Trace Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Programs Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
            <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <span>📋</span> Active Production Programs
            </h2>
            <Link href="/programs" className="text-xs text-blue-400 hover:text-blue-300 font-mono">
              View All ({recentPrograms.length}) →
            </Link>
          </div>

          <div className="space-y-2">
            {recentPrograms.map((prog) => (
              <Link
                key={prog.id}
                href={`/programs/${prog.id}`}
                className="block bg-slate-950 border border-slate-800 hover:border-slate-700 rounded p-3 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-blue-400">{prog.programNumber}</span>
                      <StatusBadge status={prog.status} />
                      <StatusBadge status={prog.priority} type="priority" />
                    </div>
                    <p className="text-xs font-medium text-slate-200 mt-1">{prog.designName}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Buyer: <span className="text-slate-300">{prog.buyer}</span> | Style: <span className="font-mono text-slate-300">{prog.styleCode}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-slate-200 block">
                      {prog.targetQuantity.toLocaleString()} pcs
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono block mt-1">
                      Due: {new Date(prog.deliveryDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Audit Activity Stream */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
            <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <span>🛡️</span> Real-time Shop-Floor Audit Stream
            </h2>
            <Link href="/audit" className="text-xs text-blue-400 hover:text-blue-300 font-mono">
              Full Ledger →
            </Link>
          </div>

          <div className="space-y-2">
            {(metrics?.recentActivity || []).map((audit: any) => (
              <div
                key={audit.id}
                className="bg-slate-950 border border-slate-800/80 rounded p-2.5 text-xs font-mono"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-blue-300">{audit.action}</span>
                  <span className="text-slate-500">{new Date(audit.createdAt).toLocaleTimeString()}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-slate-400 text-[11px]">
                  <span>
                    Actor: <span className="text-slate-200 font-semibold">{audit.actor?.fullName}</span> ({audit.actor?.role})
                  </span>
                  <span className="text-slate-500">{audit.entity}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
