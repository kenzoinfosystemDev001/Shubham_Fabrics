'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  Archive,
  ArrowRight,
  ShieldAlert,
  ArrowLeft,
  Scissors,
  FileText,
  ExternalLink,
  Sparkles,
  Building2,
  Package,
  Filter,
  Check,
  Eye,
} from 'lucide-react';

interface DepartmentShelfInfo {
  code: string;
  name: string;
  deptKey: string;
  badgeColor: string;
  borderLight: string;
}

const DEPARTMENT_SHELVES: DepartmentShelfInfo[] = [
  {
    code: 'DEF-SHELF-STORE',
    name: 'Raw Fabric Store Quarantined Shelf',
    deptKey: 'STORE',
    badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    borderLight: 'border-emerald-200',
  },
  {
    code: 'DEF-SHELF-DYEING',
    name: 'Dyeing Station Defective Shelf',
    deptKey: 'DYEING',
    badgeColor: 'bg-blue-100 text-blue-900 border-blue-300',
    borderLight: 'border-blue-200',
  },
  {
    code: 'DEF-SHELF-QC1',
    name: 'Dyeing QC Defective Shelf',
    deptKey: 'QC1',
    badgeColor: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    borderLight: 'border-indigo-200',
  },
  {
    code: 'DEF-SHELF-EMBROIDERY',
    name: 'Embroidery Station Defective Shelf',
    deptKey: 'EMBROIDERY',
    badgeColor: 'bg-purple-100 text-purple-900 border-purple-300',
    borderLight: 'border-purple-200',
  },
  {
    code: 'DEF-SHELF-THREAD-CUTTING',
    name: 'Thread Cutting Trimming & Snip Shelf',
    deptKey: 'THREAD_CUTTING',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
    borderLight: 'border-amber-200',
  },
  {
    code: 'DEF-SHELF-QC2',
    name: 'Thread Cut QC Defective Shelf',
    deptKey: 'QC2',
    badgeColor: 'bg-rose-100 text-rose-900 border-rose-300',
    borderLight: 'border-rose-200',
  },
  {
    code: 'DEF-SHELF-QC3',
    name: 'Washing QC Defective Shelf',
    deptKey: 'QC3',
    badgeColor: 'bg-sky-100 text-sky-900 border-sky-300',
    borderLight: 'border-sky-200',
  },
  {
    code: 'DEF-SHELF-FINAL-CHECK',
    name: 'Final check Defective Shelf',
    deptKey: 'FINAL_CHECK',
    badgeColor: 'bg-orange-100 text-orange-900 border-orange-300',
    borderLight: 'border-orange-200',
  },
];

export default function DefectedShelfPage() {
  const [loading, setLoading] = useState(true);
  const [shelfSection, setShelfSection] = useState<'MASTER_CENTRAL' | 'ROLLS' | 'DEPARTMENT_RETURNS'>('MASTER_CENTRAL');
  
  // Master Central Defective Data from API
  const [masterData, setMasterData] = useState<any>(null);
  const [allChallans, setAllChallans] = useState<any[]>([]);
  const [allDefectRecords, setAllDefectRecords] = useState<any[]>([]);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');

  // Fabric Store Rolls State
  const [rolls, setRolls] = useState<any[]>([]);
  const [defectReturns, setDefectReturns] = useState<any[]>([]);
  const [filterRollStatus, setFilterRollStatus] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [selectedRoll, setSelectedRoll] = useState<any>(null);
  const [actionType, setActionType] = useState<'RELEASE' | 'MOVE' | 'SCRAP' | null>(null);
  const [shelfLocation, setShelfLocation] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);

      // 1. Fetch Consolidated Defective Shelves Data from All Departments
      const masterRes = await fetch('/api/defective-shelves');
      const masterJson = await masterRes.json();
      if (masterJson.success && masterJson.data) {
        setMasterData(masterJson.data);
        setAllChallans(masterJson.data.challans || []);
        setAllDefectRecords(masterJson.data.defectRecords || []);
        setRolls(masterJson.data.defectedRolls || []);
      }

      // 2. Fetch direct returns to STORE
      const challanRes = await fetch('/api/challans?toDepartment=STORE');
      const challans = await challanRes.json();
      if (Array.isArray(challans)) {
        const returns = challans.filter(
          (c) =>
            c.challanType === 'DEFECT_RETURN' ||
            c.challanType === 'DEFECTIVE_RETURN' ||
            c.fromDepartment === 'THREAD_CUTTING' ||
            c.fromDepartment === 'QC2' ||
            c.fromDepartment === 'QC1' ||
            (c.remarks && c.remarks.toLowerCase().includes('defective'))
        );
        setDefectReturns(returns);
      }
    } catch (err: any) {
      console.error('Failed to load defective shelf data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter Master Department Defect Items
  const filteredMasterChallans = useMemo(() => {
    return allChallans.filter((ch) => {
      const matchDept =
        selectedDeptFilter === 'ALL' ||
        (ch.fromDepartment && ch.fromDepartment.toUpperCase().includes(selectedDeptFilter)) ||
        (ch.defectiveShelfLocation && ch.defectiveShelfLocation.toUpperCase().includes(selectedDeptFilter));

      const s = search.toLowerCase();
      const matchSearch =
        !search ||
        ch.challanNumber?.toLowerCase().includes(s) ||
        ch.fromDepartment?.toLowerCase().includes(s) ||
        ch.program?.programNumber?.toLowerCase().includes(s) ||
        ch.program?.programSerialNo?.toLowerCase().includes(s) ||
        ch.program?.clientName?.toLowerCase().includes(s) ||
        ch.program?.mainStyle?.toLowerCase().includes(s) ||
        ch.defectReason?.toLowerCase().includes(s) ||
        ch.defectiveShelfLocation?.toLowerCase().includes(s) ||
        ch.remarks?.toLowerCase().includes(s);

      return matchDept && matchSearch;
    });
  }, [allChallans, selectedDeptFilter, search]);

  // Filter Rolls
  const filteredRolls = useMemo(() => {
    return rolls.filter((r) => {
      const matchesStatus =
        filterRollStatus === 'ALL' ||
        (filterRollStatus === 'QC_HOLD' && (r.status === 'QC_HOLD' || r.qcStatus === 'ON_HOLD')) ||
        (filterRollStatus === 'QC_REJECTED' && (r.status === 'QC_REJECTED' || r.qcStatus === 'FAILED'));

      const searchLower = search.toLowerCase();
      const matchesSearch =
        !search ||
        r.rollNumber?.toLowerCase().includes(searchLower) ||
        r.batch?.batchNumber?.toLowerCase().includes(searchLower) ||
        r.batch?.fabricDescription?.toLowerCase().includes(searchLower) ||
        r.qcRemarks?.toLowerCase().includes(searchLower);

      return matchesStatus && matchesSearch;
    });
  }, [rolls, filterRollStatus, search]);

  const totalLength = rolls.reduce((acc, r) => acc + (parseFloat(r.length) || 0), 0);
  const holdCount = rolls.filter((r) => r.status === 'QC_HOLD' || r.qcStatus === 'ON_HOLD').length;
  const rejectedCount = rolls.filter((r) => r.status === 'QC_REJECTED' || r.qcStatus === 'FAILED').length;
  const factoryTotalPieces = masterData?.summary?.factoryTotalDefectivePieces || 0;
  const deptStats = masterData?.summary?.departmentStats || {};

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoll || !actionType) return;

    try {
      setSubmitting(true);
      setActionMessage(null);

      let payload: any = {};
      if (actionType === 'RELEASE') {
        payload = {
          status: 'IN_STOCK',
          qcStatus: 'PASSED',
          qcRemarks: remarks ? `Released from Defected Shelf: ${remarks}` : 'Released from Defected Shelf by Store Incharge',
        };
      } else if (actionType === 'MOVE') {
        payload = {
          qcRemarks: remarks ? `Assigned to shelf: ${shelfLocation}. ${remarks}` : `Assigned to shelf: ${shelfLocation}`,
        };
      } else if (actionType === 'SCRAP') {
        payload = {
          status: 'QC_REJECTED',
          qcStatus: 'FAILED',
          qcRemarks: remarks ? `Scrapped / Written-off: ${remarks}` : 'Permanently written off from Defected Shelf',
        };
      }

      const res = await fetch(`/api/fabric-store/rolls/${selectedRoll.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update roll');

      setActionMessage({
        type: 'success',
        text: `Roll ${selectedRoll.rollNumber} successfully updated.`,
      });
      setSelectedRoll(null);
      setActionType(null);
      setRemarks('');
      setShelfLocation('');
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0FAF9] pb-16">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/fabric-store"
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Fabric Store</span>
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-700">
              CENTRAL DEFECTIVE GOVERNANCE
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2 mt-0.5">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <span>Fabric Store Central Defective Shelf &amp; Department Master Audit</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Centralized factory-wide registry recording every department&apos;s defective shelf, quarantined rolls, and cutting snips.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition"
            title="Refresh All Defective Shelves"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/fabric-store/inventory/stock"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg shadow-xs transition"
          >
            <Layers className="w-4 h-4" />
            <span>Regular Stock</span>
          </Link>
        </div>
      </header>

      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {actionMessage && (
          <div
            className={`p-4 rounded-xl border text-xs font-medium flex items-center justify-between ${
              actionMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <span>{actionMessage.text}</span>
            <button
              onClick={() => setActionMessage(null)}
              className="text-slate-400 hover:text-slate-700 text-sm font-bold ml-4"
            >
              ×
            </button>
          </div>
        )}

        {/* 1. TOP SUMMARY TILES ACROSS ENTIRE FACTORY */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-rose-200/90 rounded-2xl p-4 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-rose-600">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                All-Dept Defective Pieces
              </span>
              <ShieldAlert className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold text-rose-700 mt-1">
              {loading ? '…' : `${factoryTotalPieces} PCS`}
            </p>
            <span className="text-[10px] text-slate-500">
              Recorded across all 6 department shelves
            </span>
            <div className="absolute top-0 right-0 w-16 h-16 bg-rose-50 -mr-6 -mt-6 rounded-full pointer-events-none" />
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Store Quarantined Fabric
              </span>
              <Archive className="w-4 h-4 text-slate-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {loading ? '…' : totalLength.toFixed(1)} <span className="text-sm font-normal text-slate-500">m</span>
            </p>
            <span className="text-[10px] text-slate-500">
              {rolls.length} rolls on DEF-SHELF-STORE
            </span>
          </div>

          <div className="bg-white border border-amber-200/80 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-amber-600">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Active Department Shelves
              </span>
              <Building2 className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold text-amber-700 mt-1">
              6 Stations
            </p>
            <span className="text-[10px] text-slate-500">
              Store · Dyeing · QC1 · Emb · THC · QC2
            </span>
          </div>

          <div className="bg-white border border-purple-200/80 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-purple-600">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Central Defective Hub
              </span>
              <Sparkles className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-purple-900 mt-1 font-mono">
              DEF-SHELF-CENTRAL
            </p>
            <span className="text-[10px] text-slate-500">
              Consolidating all factory defectiveness
            </span>
          </div>
        </section>

        {/* 2. DEPARTMENT DEFECTIVE SHELVES QUICK GLANCE CARDS */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4 text-slate-700" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Station-Wise Defective Shelves Infrastructure
              </h2>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              Each department records to its local shelf + consolidates here in Central Store
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {DEPARTMENT_SHELVES.map((shelf) => {
              const count = deptStats[shelf.deptKey]?.totalPieces || 0;
              const incidents = deptStats[shelf.deptKey]?.totalIncidents || 0;
              const isSelected = selectedDeptFilter === shelf.deptKey;

              return (
                <button
                  key={shelf.code}
                  type="button"
                  onClick={() => {
                    setShelfSection('MASTER_CENTRAL');
                    setSelectedDeptFilter(isSelected ? 'ALL' : shelf.deptKey);
                  }}
                  className={`p-3 rounded-xl border text-left transition relative cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/30'
                      : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100 text-slate-800'
                  }`}
                >
                  <div className="text-[9px] font-mono font-bold tracking-wider opacity-75 truncate">
                    {shelf.code}
                  </div>
                  <div className="text-xs font-bold mt-1 line-clamp-1">
                    {shelf.name.replace(' Defective Shelf', '')}
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-lg font-mono font-bold">
                      {count} <span className="text-[10px] font-normal">PCS</span>
                    </span>
                    <span className="text-[9px] opacity-70">
                      {incidents} logs
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. THREE-WAY WORKFLOW TOGGLE */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-1.5 shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            
            {/* TAB 1: ALL DEPARTMENTS MASTER DEFECTIVE SHELF (CENTRAL RECORD) */}
            <button
              type="button"
              onClick={() => setShelfSection('MASTER_CENTRAL')}
              className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-between transition cursor-pointer ${
                shelfSection === 'MASTER_CENTRAL'
                  ? 'bg-gradient-to-r from-rose-900 to-indigo-950 text-white border-rose-800 shadow-sm'
                  : 'bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span className="uppercase tracking-wide text-left">
                  All Departments Master Defective Shelf
                </span>
              </div>
              <span className={`font-mono text-xs px-2.5 py-0.5 rounded-full font-bold ${
                shelfSection === 'MASTER_CENTRAL'
                  ? 'bg-amber-400 text-slate-900'
                  : 'bg-slate-200 text-slate-800'
              }`}>
                {allChallans.length} Logs
              </span>
            </button>

            {/* TAB 2: STORE QUARANTINED FABRIC ROLLS */}
            <button
              type="button"
              onClick={() => setShelfSection('ROLLS')}
              className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-between transition cursor-pointer ${
                shelfSection === 'ROLLS'
                  ? 'bg-rose-50/90 border-rose-400 text-rose-950 shadow-xs'
                  : 'bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-rose-600" />
                <span className="uppercase tracking-wide text-left">
                  Store Quarantined Rolls (DEF-SHELF-STORE)
                </span>
              </div>
              <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold">
                {rolls.length} Rolls
              </span>
            </button>

            {/* TAB 3: PHYSICAL DEPARTMENT DEFECT RETURNS */}
            <button
              type="button"
              onClick={() => setShelfSection('DEPARTMENT_RETURNS')}
              className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-between transition cursor-pointer ${
                shelfSection === 'DEPARTMENT_RETURNS'
                  ? 'bg-amber-50/90 border-amber-400 text-amber-950 shadow-xs'
                  : 'bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <Scissors className="w-4 h-4 text-amber-600" />
                <span className="uppercase tracking-wide text-left">
                  Physical Defect Returns from Stations
                </span>
              </div>
              <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                {defectReturns.length} Returns
              </span>
            </button>

          </div>
        </div>

        {/* ======================================================== */}
        {/* VIEW 1: CENTRAL MASTER DEFECTIVE SHELF (ALL DEPARTMENTS) */}
        {/* ======================================================== */}
        {shelfSection === 'MASTER_CENTRAL' && (
          <div className="space-y-4">
            
            {/* TOOLBAR & DEPARTMENT FILTER PILLS */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-rose-600" />
                    <span>Consolidated Defective Audit Register (DEF-SHELF-CENTRAL)</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Records defectiveness from each department&apos;s own defective shelf in real-time.
                  </p>
                </div>

                <div className="relative w-full md:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search Challan #, dept, style, reason..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              {/* FILTER PILLS */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
                  <Filter className="w-3 h-3" />
                  Filter Dept:
                </span>
                {[
                  { key: 'ALL', label: 'All Departments' },
                  { key: 'STORE', label: 'Store (DEF-SHELF-STORE)' },
                  { key: 'DYEING', label: 'Dyeing (DEF-SHELF-DYEING)' },
                  { key: 'QC1', label: 'Dyeing QC (DEF-SHELF-QC1)' },
                  { key: 'EMBROIDERY', label: 'Embroidery (DEF-SHELF-EMBROIDERY)' },
                  { key: 'THREAD_CUTTING', label: 'Thread Cutting (DEF-SHELF-THREAD-CUTTING)' },
                  { key: 'QC2', label: 'Thread Cut QC (DEF-SHELF-QC2)' },
                  { key: 'QC3', label: 'Washing QC (DEF-SHELF-QC3)' },
                  { key: 'FINAL_CHECK', label: 'Final check (DEF-SHELF-FINAL-CHECK)' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setSelectedDeptFilter(tab.key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      selectedDeptFilter === tab.key
                        ? 'bg-rose-700 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* MASTER AUDIT TABLE */}
            <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-200/80 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Factory Defective Record Entries ({filteredMasterChallans.length})
                  </h4>
                </div>
                <span className="text-xs text-slate-500">
                  Showing: <strong className="text-rose-900">{filteredMasterChallans.length}</strong> incidents
                </span>
              </div>

              {loading ? (
                <div className="p-12 text-center text-xs text-slate-400">Loading master defective shelf...</div>
              ) : filteredMasterChallans.length === 0 ? (
                <div className="p-16 text-center space-y-3">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                  <p className="text-sm font-semibold text-slate-800">No Defective Records Found</p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    {selectedDeptFilter === 'ALL'
                      ? 'No department has logged any defectiveness. All stations are operating with 100% first-pass yield.'
                      : `No defectiveness currently logged under ${selectedDeptFilter}.`}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/90 text-slate-600 font-semibold border-b border-slate-200 text-[10px] uppercase">
                      <tr>
                        <th className="py-3 px-3.5">Challan / Ref #</th>
                        <th className="py-3 px-3.5">Origin Department</th>
                        <th className="py-3 px-3.5">Program / Style</th>
                        <th className="py-3 px-3.5 text-center">Defective Cut</th>
                        <th className="py-3 px-3.5">Department Local Shelf</th>
                        <th className="py-3 px-3.5">Central Store Log</th>
                        <th className="py-3 px-3.5">Defect Reason &amp; Remarks</th>
                        <th className="py-3 px-3.5">Date</th>
                        <th className="py-3 px-3.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredMasterChallans.map((ch) => {
                        const defectPcs = ch.defectivePieces || ch.items?.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0) || 0;
                        const unit = ch.fabricUnit || ch.items?.[0]?.uom || 'PCS';

                        return (
                          <tr key={ch.id} className="hover:bg-rose-50/30 transition">
                            <td className="py-3.5 px-3.5 font-mono font-bold text-slate-900">
                              {ch.challanNumber}
                            </td>

                            <td className="py-3.5 px-3.5">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200">
                                {ch.fromDepartment}
                              </span>
                            </td>

                            <td className="py-3.5 px-3.5">
                              <span className="font-semibold text-slate-900 block truncate max-w-[150px]">
                                {ch.program?.mainStyle || ch.program?.clientName || 'General Style'}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                Sheet: {ch.program?.programSerialNo || ch.program?.programNumber || '—'}
                              </span>
                            </td>

                            <td className="py-3.5 px-3.5 text-center font-mono font-bold text-rose-700">
                              {defectPcs} {unit}
                            </td>

                            <td className="py-3.5 px-3.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                                <Archive className="w-3 h-3 text-rose-600" />
                                {ch.defectiveShelfLocation ? ch.defectiveShelfLocation.split(' ')[0] : 'DEF-SHELF-DEPT'}
                              </span>
                            </td>

                            <td className="py-3.5 px-3.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-purple-50 text-purple-900 border border-purple-200">
                                <Sparkles className="w-3 h-3 text-purple-600" />
                                DEF-SHELF-CENTRAL
                              </span>
                            </td>

                            <td className="py-3.5 px-3.5 max-w-xs text-slate-600">
                              <div className="font-medium text-slate-900 text-[11px]">
                                {ch.defectReason || 'Process Defect'}
                              </div>
                              <p className="truncate text-[10px] text-slate-500 mt-0.5">
                                {ch.remarks || 'Recorded during department cut'}
                              </p>
                            </td>

                            <td className="py-3.5 px-3.5 font-mono text-[11px] text-slate-600">
                              {new Date(ch.createdAt).toLocaleDateString('en-GB')}
                            </td>

                            <td className="py-3.5 px-3.5 text-right">
                              <Link
                                href={`/challans/${ch.id}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition"
                              >
                                <Eye className="w-3.5 h-3.5 text-slate-600" />
                                <span>Audit</span>
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 2: STORE QUARANTINED FABRIC ROLLS                   */}
        {/* ======================================================== */}
        {shelfSection === 'ROLLS' && (
          <>
            <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-2">
                {[
                  { id: 'ALL', label: 'All Defected Rolls' },
                  { id: 'QC_HOLD', label: 'On QC Hold' },
                  { id: 'QC_REJECTED', label: 'Rejected' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFilterRollStatus(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      filterRollStatus === tab.id
                        ? 'bg-rose-700 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search roll #, batch, fabric, defect..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-200/80 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Quarantined Defected Inventory (Store Bay)</h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Physical defective shelf: DEF-SHELF-STORE (Bay DEF-A, DEF-B, or Quarantine Cage)
                  </p>
                </div>
                <span className="text-xs text-slate-500">
                  Showing: <strong className="text-rose-900">{filteredRolls.length}</strong> rolls
                </span>
              </div>

              {loading ? (
                <div className="p-12 text-center text-xs text-slate-400">Loading defected shelf...</div>
              ) : filteredRolls.length === 0 ? (
                <div className="p-16 text-center space-y-3">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                  <p className="text-sm font-semibold text-slate-800">Defected Shelf is Clean</p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    No fabric rolls are currently marked with defects or quarantined on hold.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/90 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Roll Number</th>
                        <th className="py-3 px-4">Batch Number</th>
                        <th className="py-3 px-4">Fabric Details</th>
                        <th className="py-3 px-4">Length</th>
                        <th className="py-3 px-4">Shelf / Bay Slot</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Defect Reason / QC Notes</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredRolls.map((roll) => (
                        <tr key={roll.id} className="hover:bg-rose-50/30 transition">
                          <td className="py-3.5 px-4 font-mono font-bold text-rose-900">
                            {roll.rollNumber}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[11px]">
                            {roll.batch?.batchNumber || '—'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-slate-800 block">
                              {roll.batch?.fabricType || 'Fabric'}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {roll.batch?.fabricDescription} {roll.batch?.colorName ? `· ${roll.batch?.colorName}` : ''}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                            {parseFloat(roll.length).toFixed(2)} m
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-100/80 text-rose-800 border border-rose-200">
                              <Archive className="w-3 h-3" />
                              {roll.location?.locationCode || 'DEF-SHELF-STORE'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {roll.status === 'QC_REJECTED' || roll.qcStatus === 'FAILED' ? (
                              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800">
                                REJECTED
                              </span>
                            ) : (
                              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800">
                                QC HOLD
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 max-w-xs truncate text-[11px] text-slate-600">
                            {roll.qcRemarks || 'Flagged for quality inspection / physical defect'}
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => {
                                setSelectedRoll(roll);
                                setActionType('RELEASE');
                                setRemarks('');
                              }}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[11px] font-semibold transition"
                              title="Release back to stock"
                            >
                              Release
                            </button>
                            <button
                              onClick={() => {
                                setSelectedRoll(roll);
                                setActionType('MOVE');
                                setShelfLocation(roll.location?.locationCode || 'DEF-SHELF-STORE-02');
                                setRemarks('');
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold transition"
                              title="Assign shelf slot"
                            >
                              Shelf Slot
                            </button>
                            <button
                              onClick={() => {
                                setSelectedRoll(roll);
                                setActionType('SCRAP');
                                setRemarks('');
                              }}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-[11px] font-semibold transition"
                              title="Scrap / Write off"
                            >
                              Scrap
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ======================================================== */}
        {/* VIEW 3: PHYSICAL DEPARTMENT DEFECT RETURNS              */}
        {/* ======================================================== */}
        {shelfSection === 'DEPARTMENT_RETURNS' && (
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
                  PHYSICAL HANDOVER GATE
                </span>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mt-0.5">
                  <Scissors className="w-5 h-5 text-amber-600" />
                  <span>Physical Defective Pieces Returned to Store</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Panels and cut pieces physically returned from production stations (Thread Cutting, Dyeing, Embroidery).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">
                  Total Returns: <strong className="text-slate-900">{defectReturns.length}</strong>
                </span>
              </div>
            </div>

            {defectReturns.length === 0 ? (
              <div className="p-16 text-center space-y-3 border border-dashed border-slate-200 rounded-xl">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <p className="text-sm font-semibold text-slate-800">No Physical Defect Returns</p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  No stations have dispatched physical defect return consignments to the Fabric Store.
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold text-[10px] uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Return Challan #</th>
                      <th className="py-2.5 px-3">Source Department</th>
                      <th className="py-2.5 px-3">Program / Style</th>
                      <th className="py-2.5 px-3 text-center">Defective Pcs</th>
                      <th className="py-2.5 px-3">Target Defective Shelf</th>
                      <th className="py-2.5 px-3">Defect Reason &amp; Comments</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
        {defectReturns.length === 0 ? (
          <div className="p-16 text-center space-y-3 border border-dashed border-slate-200 rounded-xl">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <p className="text-sm font-semibold text-slate-800">No Department Defect Returns</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              No factory departments (Thread Cutting / QC2 / QC1) have dispatched defective pieces to the Fabric Store defective shelf.
            </p>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold text-[10px] uppercase">
                <tr>
                  <th className="py-2.5 px-3">Return Challan #</th>
                  <th className="py-2.5 px-3">Source Department</th>
                  <th className="py-2.5 px-3">Program / Style</th>
                  <th className="py-2.5 px-3 text-center">Defective Pcs</th>
                  <th className="py-2.5 px-3">Target Defective Shelf</th>
                  <th className="py-2.5 px-3">Defect Reason &amp; Comments</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {defectReturns.map((ch: any) => {
                  const totalPcs = (ch.items || []).reduce(
                    (sum: number, it: any) => sum + (Number(it.quantity) || 0),
                    0
                  );

                  return (
                    <tr key={ch.id} className="hover:bg-amber-50/40 transition">
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">
                        {ch.challanNumber}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800 border border-cyan-200 text-[10px] font-bold">
                          {ch.fromDepartment}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-800 block">
                          {ch.program?.mainStyle || ch.program?.clientName || 'General Style'}
                        </span>
                        <span className="font-mono text-[10px] text-fuchsia-700">
                          {ch.program?.wilcomDesignNumber || 'WILCOM-DES'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-rose-700 text-sm">
                        {totalPcs} PCS
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-800 font-mono text-[10px] font-bold">
                          DEF-SHELF-01 (Bay A)
                        </span>
                      </td>
                      <td className="py-3 px-3 max-w-sm text-slate-700">
                        <p className="line-clamp-2 text-[11px]">
                          {ch.remarks || ch.items?.[0]?.remarks || 'Defective return to Fabric Store'}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-slate-600 text-[11px] font-mono">
                        {new Date(ch.createdAt).toLocaleDateString('en-GB')}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Link
                          href={`/challans/${ch.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition"
                        >
                          <FileText className="w-3.5 h-3.5 text-slate-600" />
                          <span>View Challan</span>
                        </Link>
                      </td>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {defectReturns.map((ch: any) => {
                      const totalPcs = (ch.items || []).reduce(
                        (sum: number, it: any) => sum + (Number(it.quantity) || 0),
                        0
                      );

                      return (
                        <tr key={ch.id} className="hover:bg-amber-50/40 transition">
                          <td className="py-3 px-3 font-mono font-bold text-slate-900">
                            {ch.challanNumber}
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800 border border-cyan-200 text-[10px] font-bold">
                              {ch.fromDepartment}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-semibold text-slate-800 block">
                              {ch.program?.mainStyle || ch.program?.clientName || 'General Style'}
                            </span>
                            <span className="font-mono text-[10px] text-fuchsia-700">
                              {ch.program?.wilcomDesignNumber || 'WILCOM-DES'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-rose-700 text-sm">
                            {totalPcs} PCS
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-800 font-mono text-[10px] font-bold">
                              {ch.defectiveShelfLocation || 'DEF-SHELF-STORE'}
                            </span>
                          </td>
                          <td className="py-3 px-3 max-w-sm text-slate-700">
                            <p className="line-clamp-2 text-[11px]">
                              {ch.remarks || ch.items?.[0]?.remarks || 'Defective return to Fabric Store'}
                            </p>
                          </td>
                          <td className="py-3 px-3 text-slate-600 text-[11px] font-mono">
                            {new Date(ch.createdAt).toLocaleDateString('en-GB')}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <Link
                              href={`/challans/${ch.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition"
                            >
                              <FileText className="w-3.5 h-3.5 text-slate-600" />
                              <span>View Challan</span>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* MODAL FOR ROLL ACTIONS */}
        {selectedRoll && actionType && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b pb-3 border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  {actionType === 'RELEASE' && 'Release Roll to Production Stock'}
                  {actionType === 'MOVE' && 'Assign Defective Shelf Slot'}
                  {actionType === 'SCRAP' && 'Confirm Scrap & Write-Off'}
                </h3>
                <span className="font-mono text-xs font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded">
                  {selectedRoll.rollNumber}
                </span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200/70 rounded-lg text-xs space-y-1">
                <div>
                  <span className="text-slate-500">Fabric: </span>
                  <span className="font-semibold text-slate-800">
                    {selectedRoll.batch?.fabricType} · {selectedRoll.batch?.fabricDescription}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Meters: </span>
                  <span className="font-mono font-bold text-slate-900">
                    {parseFloat(selectedRoll.length).toFixed(2)} m
                  </span>
                </div>
                {selectedRoll.qcRemarks && (
                  <div>
                    <span className="text-slate-500">Defect: </span>
                    <span className="text-rose-700 italic">{selectedRoll.qcRemarks}</span>
                  </div>
                )}
              </div>

              <form onSubmit={handleActionSubmit} className="space-y-4">
                {actionType === 'MOVE' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Defective Shelf / Slot Code <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder=""
                      value={shelfLocation}
                      onChange={(e) => setShelfLocation(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded px-3 py-2 uppercase font-mono"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {actionType === 'RELEASE' && 'Release Justification / Inspection Notes'}
                    {actionType === 'MOVE' && 'Shelf Slot Notes (Optional)'}
                    {actionType === 'SCRAP' && 'Write-Off & Scrap Reason'}
                  </label>
                  <textarea
                    rows={3}
                    placeholder=""
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded px-3 py-2"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRoll(null);
                      setActionType(null);
                    }}
                    className="px-3.5 py-1.5 border border-slate-300 rounded text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className={`px-4 py-1.5 text-white rounded text-xs font-bold shadow-xs transition cursor-pointer ${
                      actionType === 'RELEASE'
                        ? 'bg-emerald-700 hover:bg-emerald-800'
                        : actionType === 'SCRAP'
                        ? 'bg-rose-700 hover:bg-rose-800'
                        : 'bg-teal-700 hover:bg-teal-800'
                    }`}
                  >
                    {submitting
                      ? 'Processing...'
                      : actionType === 'RELEASE'
                      ? 'Release to Stock'
                      : actionType === 'SCRAP'
                      ? 'Confirm Write-Off'
                      : 'Save Shelf Slot'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
