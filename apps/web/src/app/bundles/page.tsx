'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';

export default function BundlesPage() {
  const [bundles, setBundles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDept, setFilterDept] = useState('');
  const [search, setSearch] = useState('');

  const loadBundles = async () => {
    try {
      setLoading(true);
      const data = await api.getBundles({ currentDepartment: filterDept || undefined, search: search || undefined });
      setBundles(data);
    } catch (err) {
      console.error('Failed to load bundles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBundles();
  }, [filterDept]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadBundles();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🏷️</span>
            <h1 className="text-xl font-bold text-slate-100">Cut Bundles &amp; Piece Tracking</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Bundle genealogy from lay cutting, department transfer checkpoints, and barcode tracking.
          </p>
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Total Tracked: <span className="font-bold text-slate-100">{bundles.length}</span> Bundles
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between gap-4 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search by bundle #, barcode, roll #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
          />
          <button type="submit" className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded">
            Search
          </button>
        </form>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 font-mono">Department:</label>
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded px-2.5 py-1.5 font-mono focus:outline-none focus:border-blue-500"
          >
            <option value="">All Departments</option>
            <option value="CUTTING">CUTTING</option>
            <option value="EMBROIDERY">EMBROIDERY</option>
            <option value="THREAD_CUTTING">THREAD_CUTTING</option>
            <option value="WASHING">WASHING</option>
            <option value="STITCHING">STITCHING</option>
            <option value="FINISHING">FINISHING</option>
            <option value="PACKING">PACKING</option>
            <option value="FINISHED_GOODS">FINISHED_GOODS</option>
          </select>
        </div>
      </div>

      {/* Bundles Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400 font-mono">Loading bundles from Neon DB...</div>
      ) : bundles.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-500 font-mono bg-slate-900 border border-slate-800 rounded-lg">
          No cut bundles found matching criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {bundles.map((b) => (
            <div key={b.id} className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm font-mono">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-blue-400 text-xs">{b.bundleNumber}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                  b.status === 'PACKED' ? 'bg-slate-800 text-slate-400' :
                  b.status === 'REWORK' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                  'bg-emerald-950 text-emerald-400 border border-emerald-800'
                }`}>
                  {b.status}
                </span>
              </div>

              <div className="text-xs text-slate-200 font-sans font-semibold mb-2">
                {b.program?.buyerName || 'Client Order'} — {b.program?.styleCode || 'Style'}
              </div>

              <div className="text-[11px] text-slate-400 space-y-1 pt-2 border-t border-slate-800/60">
                <div className="flex justify-between">
                  <span>Size &amp; Colour:</span>
                  <strong className="text-slate-200">{b.size} / {b.colour}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Quantity:</span>
                  <strong className="text-emerald-400">{b.quantity} PCS</strong>
                </div>
                <div className="flex justify-between">
                  <span>Current Station:</span>
                  <span className="text-blue-400 font-bold">{b.currentDepartment}</span>
                </div>
                <div className="flex justify-between">
                  <span>Roll / Lay:</span>
                  <span className="text-slate-300">{b.rollNumber || '—'} / {b.layNumber || '—'}</span>
                </div>
                <div className="pt-2 text-center text-[10px] text-slate-500 border-t border-slate-800/40">
                  Barcode: {b.barcode || `BC-${b.bundleNumber}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
