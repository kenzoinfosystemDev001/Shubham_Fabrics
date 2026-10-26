'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Kanban,
  RefreshCw,
  Send,
  AlertTriangle,
  ArrowRight,
  ArrowDownToLine,
  Lock,
  Check,
} from 'lucide-react';

export default function FabricStoreFloorBoardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [incomingChallans, setIncomingChallans] = useState<any[]>([]);
  const [rolls, setRolls] = useState<any[]>([]);
  const [issueChallans, setIssueChallans] = useState<any[]>([]);
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, any>>({});

  const loadData = async () => {
    try {
      setLoading(true);
      const [challansRes, rollsRes, availRes] = await Promise.all([
        fetch('/api/challans').catch(() => null),
        fetch('/api/fabric-store/rolls?limit=100').catch(() => null),
        fetch('/api/fabric-store/check-availability').catch(() => null),
      ]);

      if (availRes && availRes.ok) {
        const availJson = await availRes.json();
        const map: Record<string, any> = {};
        if (Array.isArray(availJson.data)) {
          for (const item of availJson.data) {
            if (item.programId) map[item.programId] = item;
            if (item.programNumber) map[item.programNumber] = item;
          }
        }
        setAvailabilityMap(map);
      }

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

  // Lane 2: Defected / Quarantine Shelf
  const defectedLane = rolls.filter(
    (r) => r.qcStatus === 'FAILED' || r.status === 'REJECTED' || r.status === 'QC_HOLD'
  );

  // Lane 3: Issued / Dispatched Challans
  const issuedLane = issueChallans;

  return (
    <div className="min-h-screen bg-brand-50 pb-16">
      {/* HEADER */}
      <header className="bg-white border-b border-neutral-200/80 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
            <Kanban className="w-5 h-5 text-brand-700" />
            <span>Fabric Store Floor Board</span>
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition"
            title="Refresh Board"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <Link
            href="/fabric-store/my-work/incoming-challans"
            className="flex items-center gap-2 px-3.5 py-2 bg-brand-700 hover:bg-brand-800 text-white text-xs font-semibold rounded-lg shadow-xs transition"
          >
            <Send className="w-4 h-4" />
            <span>Issue Challan</span>
          </Link>
        </div>
      </header>

      {/* PIPELINE KPI SUMMARY */}
      <div className="px-4 sm:px-8 pt-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-white border border-brand-500/10 rounded-xl shadow-xs">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600">1. Incoming</span>
            <p className="text-xl font-bold text-neutral-900 mt-0.5">{incomingLane.length} Challans</p>
          </div>
          <div className="border-t sm:border-t-0 sm:border-l border-neutral-100 pt-3 sm:pt-0 sm:pl-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-danger-600">2. Defected Shelf</span>
            <p className="text-xl font-bold text-danger-700 mt-0.5">{defectedLane.length} Rolls</p>
          </div>
          <div className="border-t sm:border-t-0 sm:border-l border-neutral-100 pt-3 sm:pt-0 sm:pl-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700">3. Dispatched</span>
            <p className="text-xl font-bold text-brand-800 mt-0.5">{issuedLane.length} Challans</p>
          </div>
        </div>
      </div>

      {/* KANBAN BOARD LANES */}
      <div className="px-4 sm:px-8 pt-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          
          {/* LANE 1: INCOMING CHALLANS */}
          <div className="bg-white/90 rounded-xl border border-neutral-200/90 shadow-xs flex flex-col min-h-[500px]">
            <div className="p-3.5 border-b border-neutral-100 bg-brand-50/60 rounded-t-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowDownToLine className="w-4 h-4 text-brand-600" />
                <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">Incoming</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-brand-100 text-brand-800 font-mono">
                {incomingLane.length}
              </span>
            </div>

            <div className="p-3 space-y-2.5 flex-1 overflow-y-auto max-h-[650px]">
              {incomingLane.length === 0 ? (
                <div className="text-center py-10 px-2 text-neutral-500 text-xs">
                  No incoming challans pending receipt.
                </div>
              ) : (
                incomingLane.map((c) => {
                  const progId = c.programId || c.program?.id;
                  const progNum = c.programNumber || c.program?.programNumber;
                  const avail = (progId && availabilityMap[progId]) || (progNum && availabilityMap[progNum]);
                  const isAvailable = avail ? Boolean(avail.isAvailable) : false;

                  return (
                    <div key={c.id} className="p-3 bg-white border border-neutral-200/80 rounded-lg shadow-2xs hover:border-brand-500 transition">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-mono font-bold text-brand-700">{c.challanNumber}</span>
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-brand-50 text-brand-700 rounded">
                          {c.status}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-neutral-900 mb-1">
                        From: {c.fromDepartment || 'Programming'}
                      </div>
                      {c.program && (
                        <div className="text-[11px] text-neutral-500 font-mono mb-1.5">
                          Prog: {c.program.programNumber || c.programNumber}
                        </div>
                      )}

                      {/* Fabric Store Availability Status Badge */}
                      <div className="mb-2">
                        {isAvailable ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-accent-800 bg-accent-50 px-2 py-0.5 rounded border border-accent-200">
                            <Check className="w-2.5 h-2.5 text-accent-700" />
                            Fabric in Store ({avail?.totalStoreStockMeters || 0}m)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-accent-800 bg-accent-50 px-2 py-0.5 rounded border border-accent-200">
                            <Lock className="w-2.5 h-2.5 text-accent-700" />
                            Fabric Not in Store (Movement Blocked)
                          </span>
                        )}
                      </div>

                      <div className="pt-2 border-t border-neutral-100 flex items-center justify-between gap-1">
                        {isAvailable ? (
                          <Link
                            href={`/fabric-store/my-work/issue-challan?programId=${progId}&dest=DYEING`}
                            className="text-[10px] font-bold text-brand-700 hover:text-brand-900 bg-brand-50 px-2 py-1 rounded border border-brand-200 inline-flex items-center gap-1"
                            title="Fabric is in store — authorized to dispatch to Dyeing"
                          >
                            To Dyeing →
                          </Link>
                        ) : (
                          <span
                            className="text-[10px] font-semibold text-neutral-500 bg-neutral-100 px-2 py-1 rounded border border-neutral-200 inline-flex items-center gap-1 cursor-not-allowed"
                            title="Cannot move to next department until fabric is available in store"
                          >
                            <Lock className="w-2.5 h-2.5" /> Blocked
                          </span>
                        )}
                        <Link
                          href="/fabric-store/my-work/incoming-challans"
                          className="text-[11px] font-bold text-brand-700 hover:text-brand-900 flex items-center gap-1"
                        >
                          Process <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* LANE 2: DEFECTED SHELF */}
          <div className="bg-white/90 rounded-xl border border-neutral-200/90 shadow-xs flex flex-col min-h-[500px]">
            <div className="p-3.5 border-b border-neutral-100 bg-danger-50/60 rounded-t-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-danger-600" />
                <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">Defected Shelf</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-danger-100 text-danger-800 font-mono">
                {defectedLane.length}
              </span>
            </div>

            <div className="p-3 space-y-2.5 flex-1 overflow-y-auto max-h-[650px]">
              {defectedLane.length === 0 ? (
                <div className="text-center py-10 px-2 text-neutral-500 text-xs">
                  Zero defected rolls on quarantine shelf.
                </div>
              ) : (
                defectedLane.map((roll) => (
                  <div key={roll.id} className="p-3 bg-white border border-danger-200 rounded-lg shadow-2xs hover:border-danger-500 transition">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-mono font-bold text-danger-900">{roll.rollNumber}</span>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-danger-50 text-danger-700 rounded">
                        DEFECTED
                      </span>
                    </div>
                    <div className="text-xs text-neutral-900 font-semibold mb-1">
                      {roll.batch?.fabricDescription || 'Quarantined Roll'}
                    </div>
                    <div className="text-[11px] text-danger-600 font-mono mb-1">
                      Reason: {roll.rejectionReason || roll.defectType || 'Defected'}
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-neutral-100 flex items-center justify-between">
                      <span className="text-[10px] text-neutral-500 font-mono">{roll.netWeightKg || 0} kg</span>
                      <Link
                        href="/fabric-store/inventory/defected-shelf"
                        className="text-[11px] font-bold text-danger-700 hover:text-danger-900 flex items-center gap-1"
                      >
                        Shelf <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* LANE 3: DISPATCHED CHALLANS */}
          <div className="bg-white/90 rounded-xl border border-neutral-200/90 shadow-xs flex flex-col min-h-[500px]">
            <div className="p-3.5 border-b border-neutral-100 bg-brand-50/60 rounded-t-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-brand-700" />
                <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">Dispatched</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-brand-100 text-brand-800 font-mono">
                {issuedLane.length}
              </span>
            </div>

            <div className="p-3 space-y-2.5 flex-1 overflow-y-auto max-h-[650px]">
              {issuedLane.length === 0 ? (
                <div className="text-center py-10 px-2 text-neutral-500 text-xs">
                  No outbound challans dispatched yet.
                </div>
              ) : (
                issuedLane.map((c) => (
                  <div key={c.id} className="p-3 bg-white border border-neutral-200/80 rounded-lg shadow-2xs hover:border-brand-500 transition">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-mono font-bold text-brand-800">{c.challanNumber}</span>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-brand-50 text-brand-700 rounded">
                        {c.status}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-neutral-900 mb-1">
                      To: {c.toDepartment || 'Dyeing / Embroidery'}
                    </div>
                    <div className="text-[11px] text-neutral-500 font-mono flex items-center justify-between">
                      <span>Rolls: {c.totalRolls || 0}</span>
                      <span>Weight: {c.totalWeightKg || 0} kg</span>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-neutral-100 flex items-center justify-between">
                      <span className="text-[10px] text-neutral-500 font-mono">
                        {new Date(c.createdAt || c.issuedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </span>
                      <Link
                        href={`/challans/${c.id}`}
                        className="text-[11px] font-bold text-brand-700 hover:text-brand-900 flex items-center gap-1"
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
