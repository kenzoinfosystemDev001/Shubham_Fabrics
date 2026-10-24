'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Package,
  Boxes,
  Archive,
  Send,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Layers,
  Sparkles,
} from 'lucide-react';
import { DepartmentSwitcher } from '@/components/DepartmentSwitcher';
import { DepartmentDefectiveShelfWidget } from '@/components/DepartmentDefectiveShelfWidget';
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';

export default function PackingDepartmentPage() {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'DEFECTIVE_SHELF'>('DEFECTIVE_SHELF');

  return (
    <div className="min-h-screen bg-ink-900 text-slate-100 flex flex-col">
      {/* HEADER HERO */}
      <header
        style={{
          backgroundImage: `linear-gradient(to right, rgba(37, 35, 42, 0.95), rgba(37, 35, 42, 0.85)), url('${DEPARTMENT_NAV_BG_IMAGE}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        className="border-b border-slate-800 p-6 shadow-md"
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-inner">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  FINAL PACKING & DISPATCH
                </span>
                <span className="text-xs text-slate-400">· Final Process Stage</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
                Packing Department & Defective Shelf
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Carton packing, polybag sealing, barcode tagging, defective quarantine, and final warehouse release.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <DepartmentSwitcher currentDepartmentName="Packing Department" accentColor="emerald" />
          </div>
        </div>
      </header>

      {/* TOP TAB NAVIGATION */}
      <div className="border-b border-slate-800 bg-slate-900/60 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('DEFECTIVE_SHELF')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeTab === 'DEFECTIVE_SHELF'
                ? 'bg-rose-600 text-white shadow-md'
                : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Archive className="w-4 h-4 text-rose-300" />
            <span>Defective Shelf (DEF-SHELF-PACKING)</span>
          </button>

          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeTab === 'OVERVIEW'
                ? 'bg-lavender-600 text-white shadow-md'
                : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Boxes className="w-4 h-4 text-emerald-300" />
            <span>Packing Overview & Work Center</span>
          </button>
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        {activeTab === 'DEFECTIVE_SHELF' ? (
          <div className="space-y-4">
            <DepartmentDefectiveShelfWidget
              department="PACKING"
              shelfCode="DEF-SHELF-PACKING"
              accentColor="emerald"
            />
          </div>
        ) : (
          <div className="space-y-6">
            {/* KPI STATS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">Packing Work Queue</span>
                <span className="text-2xl font-black text-white">Ready for Carton Packing</span>
                <span className="text-[11px] text-emerald-400 block mt-1">From Final QC Approved lots</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">Defective Quarantine</span>
                <span className="text-2xl font-black text-rose-400">DEF-SHELF-PACKING</span>
                <span className="text-[11px] text-slate-400 block mt-1">Damaged boxes / torn polybags</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">Central Store Sync</span>
                <span className="text-2xl font-black text-emerald-400">Live Active</span>
                <span className="text-[11px] text-slate-400 block mt-1">Synchronized with Fabric Store</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">Audit Trail</span>
                <span className="text-2xl font-black text-blue-400">100% Tracked</span>
                <span className="text-[11px] text-slate-400 block mt-1">Mandatory defect reason enforced</span>
              </div>
            </div>

            {/* QUICK ACTIONS */}
            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <span>Packing Operations & Material Handoff</span>
              </h2>
              <p className="text-xs text-slate-400">
                Garments received from Final QC that pass packaging checks proceed to final carton boxing. Any defective garments, stained pieces, or damaged packaging detected during boxing must be transferred directly to the dedicated Packing Defective Shelf.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  onClick={() => setActiveTab('DEFECTIVE_SHELF')}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 shadow-md transition"
                >
                  <Archive className="w-4 h-4" />
                  <span>Open Packing Defective Shelf (DEF-SHELF-PACKING)</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
