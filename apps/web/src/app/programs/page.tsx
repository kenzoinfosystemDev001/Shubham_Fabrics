'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';
import { STANDARD_FACTORY_ROUTE, DEPARTMENT_LABELS } from '@subham/config';
import { DepartmentCode, PriorityLevel } from '@subham/types';

export default function ProgramsListPage() {
  const [programs, setPrograms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Program Form State
  const [form, setForm] = useState({
    programNumber: `PRG-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`,
    programDate: new Date().toISOString().split('T')[0],
    buyer: 'Marks & Spencer Global',
    orderNumber: 'PO-MS-44910',
    designNumber: 'DES-402',
    designName: "Men's Slub Cotton Henley",
    designVersion: 'v1.0',
    patternNumber: 'PAT-HNL-02',
    styleCode: 'HNL-SLUB-02',
    productCategory: 'Knitted Henley T-Shirt',
    targetQuantity: 1000,
    deliveryDate: new Date(Date.now() + 25 * 86400000).toISOString().split('T')[0],
    priority: PriorityLevel.NORMAL,
    fabrics: [
      {
        fabricCode: 'FAB-SLB-01',
        fabricName: '100% Cotton Slub Jersey',
        fabricType: 'Knit Slub',
        composition: '100% Cotton',
        widthInInches: 62,
        gsm: 190,
        colour: 'Heather Charcoal',
        shade: 'Tone-1',
        requiredQuantity: 520,
        tolerancePercentage: 5,
        supplier: 'Arvind Mills',
      },
    ],
    measurements: [
      { size: 'S', length: 69, chest: 50, waist: 48, shoulder: 42, sleeveLength: 21, armhole: 23, neck: 38, bottom: 49 },
      { size: 'M', length: 71, chest: 53, waist: 51, shoulder: 44, sleeveLength: 22, armhole: 24.5, neck: 39.5, bottom: 52 },
      { size: 'L', length: 73, chest: 56, waist: 54, shoulder: 46, sleeveLength: 23, armhole: 26, neck: 41, bottom: 55 },
    ],
    sizeMatrix: [
      { size: 'S', targetQuantity: 300 },
      { size: 'M', targetQuantity: 400 },
      { size: 'L', targetQuantity: 300 },
    ],
    colorMatrix: [
      { colorCode: 'CLR-CHAR', colorName: 'Heather Charcoal', shade: 'Dark', targetQuantity: 1000 },
    ],
    bomItems: [
      { itemCode: 'BTN-02', itemName: 'Chalk Button 16L', category: 'BUTTON', requiredQuantityPerPiece: 3, uom: 'PCS', wastagePercentage: 2, totalRequiredQuantity: 3060 },
      { itemCode: 'THRD-02', itemName: 'Sewing Thread 40/2', category: 'THREAD', requiredQuantityPerPiece: 100, uom: 'MTR', wastagePercentage: 3, totalRequiredQuantity: 103000 },
    ],
    routeSteps: STANDARD_FACTORY_ROUTE.map((dept, idx) => ({
      sequenceOrder: idx + 1,
      departmentCode: dept,
      standardCycleTimeMinutes: 40,
      isMandatory: true,
      requiresQCGate: ['QC1', 'QC2', 'QC3'].includes(dept),
    })),
  });

  const loadPrograms = async () => {
    try {
      setLoading(true);
      const data = await api.getPrograms({ status: statusFilter || undefined, search: search || undefined });
      setPrograms(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrograms();
  }, [statusFilter]);

  const handleCreateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createProgram(form);
      setIsModalOpen(false);
      await loadPrograms();
      alert('Program File created and submitted for engineering approval!');
    } catch (err: any) {
      alert(`Program creation failed: ${err.message}`);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] w-full mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>📋</span> Production Programs & Style Master
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Manufacturing master orders, fabric technical packs, size/color breakdown, BOM and routing
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded shadow transition-colors flex items-center gap-1.5"
          >
            <span>➕</span> New Program File
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 p-3 rounded-lg border border-slate-800">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search by Program #, Buyer, Style, PO..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadPrograms()}
            className="bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded px-3 py-1.5 focus:outline-none focus:border-blue-500 w-full sm:w-72 font-mono"
          />
          <button
            onClick={loadPrograms}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 font-mono"
          >
            Search
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-slate-400">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-blue-500 font-mono"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">DRAFT</option>
            <option value="APPROVED">APPROVED</option>
            <option value="IN_PRODUCTION">IN_PRODUCTION</option>
            <option value="COMPLETED">COMPLETED</option>
          </select>
        </div>
      </div>

      {/* Programs Dense Grid */}
      {loading ? (
        <div className="p-8 text-center text-slate-400 font-mono text-xs">Loading Programs...</div>
      ) : programs.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-12 text-center text-slate-400 text-xs">
          No programs found matching filter criteria.
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 font-mono text-[11px] text-slate-400 uppercase">
                <tr>
                  <th className="p-3">Program #</th>
                  <th className="p-3">Buyer & Order</th>
                  <th className="p-3">Style & Design</th>
                  <th className="p-3">Target Qty</th>
                  <th className="p-3">Delivery Date</th>
                  <th className="p-3">Priority</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Route Stages</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {programs.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-mono font-bold text-blue-400">
                      <Link href={`/programs/${p.id}`} className="hover:underline">
                        {p.programNumber}
                      </Link>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-200">{p.buyer}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{p.orderNumber}</div>
                    </td>
                    <td className="p-3">
                      <div className="text-slate-200">{p.designName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {p.styleCode} ({p.productCategory})
                      </div>
                    </td>
                    <td className="p-3 font-mono font-semibold text-slate-200">
                      {p.targetQuantity.toLocaleString()} pcs
                    </td>
                    <td className="p-3 font-mono text-slate-300">
                      {new Date(p.deliveryDate).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <StatusBadge status={p.priority} type="priority" />
                    </td>
                    <td className="p-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="p-3 font-mono text-slate-400">
                      {p.routeSteps?.length || 0} Departments
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        href={`/programs/${p.id}`}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-mono border border-slate-700"
                      >
                        Inspect Spec →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: New Program File Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>➕</span> Create New Production Program File
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProgram} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Program Number</label>
                  <input
                    type="text"
                    required
                    value={form.programNumber}
                    onChange={(e) => setForm({ ...form, programNumber: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Buyer / Customer</label>
                  <input
                    type="text"
                    required
                    value={form.buyer}
                    onChange={(e) => setForm({ ...form, buyer: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Order / PO Number</label>
                  <input
                    type="text"
                    required
                    value={form.orderNumber}
                    onChange={(e) => setForm({ ...form, orderNumber: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Design Name</label>
                  <input
                    type="text"
                    required
                    value={form.designName}
                    onChange={(e) => setForm({ ...form, designName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Style Code</label>
                  <input
                    type="text"
                    required
                    value={form.styleCode}
                    onChange={(e) => setForm({ ...form, styleCode: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Target Quantity (Pcs)</label>
                  <input
                    type="number"
                    required
                    value={form.targetQuantity}
                    onChange={(e) => setForm({ ...form, targetQuantity: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded border border-slate-800">
                <span className="font-bold text-slate-300 block mb-2 font-mono">
                  Configured Production Route ({form.routeSteps.length} Manufacturing Stations)
                </span>
                <div className="flex flex-wrap gap-1 text-[11px] font-mono">
                  {form.routeSteps.map((s) => (
                    <span key={s.departmentCode} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                      {s.sequenceOrder}. {s.departmentCode} {s.requiresQCGate ? '🛡️' : ''}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-mono text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold text-xs shadow"
                >
                  Create Program Master
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
