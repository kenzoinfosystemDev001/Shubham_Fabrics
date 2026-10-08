'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Kanban,
  RefreshCw,
  PackageCheck,
  ClipboardCheck,
  Send,
  AlertTriangle,
  ArrowRight,
  Boxes,
  Clock,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowDownToLine,
  UserCheck,
  Plus
} from 'lucide-react';
import { api } from '@/lib/api';

export default function FabricStoreFloorBoardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [incomingChallans, setIncomingChallans] = useState<any[]>([]);
  const [rolls, setRolls] = useState<any[]>([]);
  const [issueChallans, setIssueChallans] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'incoming' | 'qc' | 'defected' | 'ready'>('all');

  const loadData = async () => {
    try {
      setLoading(true);
      const [challansRes, rollsRes] = await Promise.all([
        fetch('/api/challans').catch(() => null),
        fetch('/api/fabric-store/rolls?limit=100').catch(() => null),
      ]);

      if (challansRes && challansRes.ok) {
        const challanData = await challansRes.json();
        const allChallans = Array.isArray(challanData) ? challanData : challanData.data || [];
        
        // Incoming to Store
        setIncomingChallans(
          allChallans.filter((c: any) =>
            (c.toDepartment === 'STORE' || c.toDepartmentCode === 'STORE') &&
            ['ISSUED', 'SUBMITTED', 'DRAFT'].includes(c.status)
          )
        );

        // Issued from Store to Dyeing / Embroidery / etc.
        setIssueChallans(
          allChallans.filter((c: any) =>
            c.fromDepartment === 'STORE' || c.fromDepartmentCode === 'STORE'
          )
        );
      }

      if (rollsRes && rollsRes.ok) {
        const rollsData = await rollsRes.json();
        setRolls(rollsData.data || []);
      }
    } catch (err) {
      console.error('Failed to load fabric store floor board:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('subham_mes_user');
      if (!savedUser) {
        router.push('/login');
        return;
      }
    }
    loadData();
  }, [router]);

  // Derived lanes
  // Lane 1: Incoming Challans (from Programming or Supplier)
  const incomingLane = incomingChallans;

  // Lane 2: Staged Material / Pending QC
  const pendingQCLane = rolls.filter((r) => r.qcStatus === 'PENDING' && r.status !== 'REJECTED');

  // Lane 3: Passed QC / In Stock (Ready for Issue)
  const readyLane = rolls.filter((r) => r.qcStatus === 'PASSED' && r.status === 'IN_STOCK');

  // Lane 4: Defected / Quarantine Shelf
  const defectedLane = rolls.filter(
    (r) => r.qcStatus === 'FAILED' || r.status === 'REJECTED' || r.status === 'QC_HOLD'
  );

  // Lane 5: Issued / Dispatched Challans
  const issuedLane = issueChallans;

  return (
    <div className="min-h-screen bg-[#F0FAF9] pb-16">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-700 block">
            SHUBHAM FABRICS MES · OPERATIONS BOARD
          </span>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Kanban className="w-5 h-5 text-teal-700" />
            <span>Fabric Store Floor Board</span>
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition"
            title="Refresh Board"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <Link
            href="/fabric-store/my-work/issue-challan"
            className="flex items-center gap-2 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg shadow-xs transition"
          >
            <Send className="w-4 h-4" />
            <span>Issue Challan</span>
          </Link>
        </div>
      </header>

      {/* PIPELINE KPI SUMMARY */}
      <div className="px-4 sm:px-8 pt-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 bg-white border border-teal-900/10 rounded-xl shadow-xs">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">1. Incoming</span>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{incomingLane.length} Challans</p>
          </div>
          <div className="border-l border-slate-100 pl-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">2. QC Pending</span>
            <p className="text-xl font-bold text-amber-700 mt-0.5">{pendingQCLane.length} Rolls</p>
          </div>
          <div className="border-l border-slate-100 pl-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">3. Ready for Issue</span>
            <p className="text-xl font-bold text-emerald-700 mt-0.5">{readyLane.length} Rolls</p>
          </div>
          <div className="border-l border-slate-100 pl-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">4. Defected Shelf</span>
            <p className="text-xl font-bold text-rose-700 mt-0.5">{defectedLane.length} Rolls</p>
          </div>
          <div className="border-l border-slate-100 pl-3 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700">5. Dispatched</span>
            <p className="text-xl font-bold text-teal-800 mt-0.5">{issuedLane.length} Challans</p>
          </div>
        </div>
      </div>

      {/* KANBAN BOARD LANES */}
      <div className="px-4 sm:px-8 pt-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-start">
          
          {/* LANE 1: INCOMING CHALLANS */}
          <div className="bg-white/90 rounded-xl border border-slate-200/90 shadow-xs flex flex-col min-h-[500px]">
            <div className="p-3.5 border-b border-slate-100 bg-blue-50/60 rounded-t-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowDownToLine className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Incoming</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 font-mono">
                {incomingLane.length}
              </span>
            </div>

            <div className="p-3 space-y-2.5 flex-1 overflow-y-auto max-h-[650px]">
              {incomingLane.length === 0 ? (
                <div className="text-center py-10 px-2 text-slate-400 text-xs">
                  No incoming challans pending receipt.
                </div>
              ) : (
                incomingLane.map((c) => (
                  <div key={c.id} className="p-3 bg-white border border-slate-200/80 rounded-lg shadow-2xs hover:border-blue-400 transition">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-mono font-bold text-blue-700">{c.challanNumber}</span>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">
                        {c.status}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-800 mb-1">
                      From: {c.fromDepartment || 'Programming'}
                    </div>
                    {c.program && (
                      <div className="text-[11px] text-slate-500 font-mono">
                        Prog: {c.program.programNumber || c.programNumber}
                      </div>
                    )}
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-mono">{c.totalRolls || 0} Rolls</span>
                      <Link
                        href="/fabric-store/my-work/material-receipt/create"
                        className="text-[11px] font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1"
                      >
                        Receive <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* LANE 2: QC PENDING */}
          <div className="bg-white/90 rounded-xl border border-slate-200/90 shadow-xs flex flex-col min-h-[500px]">
            <div className="p-3.5 border-b border-slate-100 bg-amber-50/60 rounded-t-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">QC Pending</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 font-mono">
                {pendingQCLane.length}
              </span>
            </div>

            <div className="p-3 space-y-2.5 flex-1 overflow-y-auto max-h-[650px]">
              {pendingQCLane.length === 0 ? (
                <div className="text-center py-10 px-2 text-slate-400 text-xs">
                  All received rolls have been inspected!
                </div>
              ) : (
                pendingQCLane.map((roll) => (
                  <div key={roll.id} className="p-3 bg-white border border-slate-200/80 rounded-lg shadow-2xs hover:border-amber-400 transition">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-mono font-bold text-slate-900">{roll.rollNumber}</span>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-amber-50 text-amber-800 rounded">
                        QC PENDING
                      </span>
                    </div>
                    <div className="text-xs text-slate-700 font-medium mb-1">
                      {roll.batch?.fabricDescription || 'Fabric Roll'}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono flex items-center justify-between">
                      <span>Gross: {roll.grossWeightKg || 0} kg</span>
                      <span>Net: {roll.netWeightKg || 0} kg</span>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-mono">
                        {roll.batch?.batchNumber || 'Batch'}
                      </span>
                      <Link
                        href={`/fabric-store/my-work/qc-inspections/${roll.id}`}
                        className="text-[11px] font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1"
                      >
                        Inspect <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* LANE 3: READY FOR ISSUE */}
          <div className="bg-white/90 rounded-xl border border-slate-200/90 shadow-xs flex flex-col min-h-[500px]">
            <div className="p-3.5 border-b border-slate-100 bg-emerald-50/60 rounded-t-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Ready to Issue</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 font-mono">
                {readyLane.length}
              </span>
            </div>

            <div className="p-3 space-y-2.5 flex-1 overflow-y-auto max-h-[650px]">
              {readyLane.length === 0 ? (
                <div className="text-center py-10 px-2 text-slate-400 text-xs">
                  No passed rolls currently waiting for issue.
                </div>
              ) : (
                readyLane.map((roll) => (
                  <div key={roll.id} className="p-3 bg-white border border-slate-200/80 rounded-lg shadow-2xs hover:border-emerald-400 transition">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-mono font-bold text-emerald-900">{roll.rollNumber}</span>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-emerald-50 text-emerald-800 rounded">
                        PASSED
                      </span>
                    </div>
                    <div className="text-xs text-slate-800 font-semibold mb-1">
                      {roll.batch?.fabricDescription || 'Ready Stock'}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono flex items-center justify-between">
                      <span>Net: {roll.netWeightKg || 0} kg</span>
                      <span>Grade: {roll.grade || 'A'}</span>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-mono">
                        {roll.location?.name || 'Floor'}
                      </span>
                      <Link
                        href="/fabric-store/my-work/issue-challan"
                        className="text-[11px] font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1"
                      >
                        Issue <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* LANE 4: DEFECTED SHELF */}
          <div className="bg-white/90 rounded-xl border border-slate-200/90 shadow-xs flex flex-col min-h-[500px]">
            <div className="p-3.5 border-b border-slate-100 bg-rose-50/60 rounded-t-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Defected Shelf</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 font-mono">
                {defectedLane.length}
              </span>
            </div>

            <div className="p-3 space-y-2.5 flex-1 overflow-y-auto max-h-[650px]">
              {defectedLane.length === 0 ? (
                <div className="text-center py-10 px-2 text-slate-400 text-xs">
                  Zero defected rolls on quarantine shelf.
                </div>
              ) : (
                defectedLane.map((roll) => (
                  <div key={roll.id} className="p-3 bg-white border border-rose-200 rounded-lg shadow-2xs hover:border-rose-400 transition">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-mono font-bold text-rose-900">{roll.rollNumber}</span>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded">
                        DEFECTED
                      </span>
                    </div>
                    <div className="text-xs text-slate-800 font-semibold mb-1">
                      {roll.batch?.fabricDescription || 'Quarantined Roll'}
                    </div>
                    <div className="text-[11px] text-rose-600 font-mono mb-1">
                      Reason: {roll.rejectionReason || roll.defectType || 'QC Failure'}
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-mono">{roll.netWeightKg || 0} kg</span>
                      <Link
                        href="/fabric-store/inventory/defected-shelf"
                        className="text-[11px] font-bold text-rose-700 hover:text-rose-900 flex items-center gap-1"
                      >
                        Shelf <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* LANE 5: DISPATCHED CHALLANS */}
          <div className="bg-white/90 rounded-xl border border-slate-200/90 shadow-xs flex flex-col min-h-[500px]">
            <div className="p-3.5 border-b border-slate-100 bg-teal-50/60 rounded-t-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-teal-700" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Dispatched</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800 font-mono">
                {issuedLane.length}
              </span>
            </div>

            <div className="p-3 space-y-2.5 flex-1 overflow-y-auto max-h-[650px]">
              {issuedLane.length === 0 ? (
                <div className="text-center py-10 px-2 text-slate-400 text-xs">
                  No outbound challans dispatched yet.
                </div>
              ) : (
                issuedLane.map((c) => (
                  <div key={c.id} className="p-3 bg-white border border-slate-200/80 rounded-lg shadow-2xs hover:border-teal-400 transition">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-mono font-bold text-teal-800">{c.challanNumber}</span>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-teal-50 text-teal-700 rounded">
                        {c.status}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-800 mb-1">
                      To: {c.toDepartment || 'Dyeing / Embroidery'}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono flex items-center justify-between">
                      <span>Rolls: {c.totalRolls || 0}</span>
                      <span>Weight: {c.totalWeightKg || 0} kg</span>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(c.createdAt || c.issuedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </span>
                      <Link
                        href={`/challans/${c.id}`}
                        className="text-[11px] font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1"
                      >
                        View <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
