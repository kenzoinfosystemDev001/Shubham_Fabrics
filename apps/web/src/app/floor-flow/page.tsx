'use client';

import React from 'react';
import Link from 'next/link';

const STAGES = [
  { code: 'STORE', name: 'Raw Material Store', type: 'METRES', count: 3422, status: 'NORMAL', leadTime: '0.5h' },
  { code: 'DYEING', name: 'Dyeing Mill', type: 'METRES', count: 144, status: 'BUSY', leadTime: '4.0h' },
  { code: 'QC1', name: 'Greige / Fabric Inspection', type: 'METRES', count: 12, status: 'NORMAL', leadTime: '1.0h' },
  { code: 'CUTTING', name: 'Spreading & Auto Cutting', type: 'PIECES', count: 580, status: 'BUSY', leadTime: '2.5h' },
  { code: 'EMBROIDERY', name: 'Multi-head Embroidery', type: 'PIECES', count: 210, status: 'NORMAL', leadTime: '3.0h' },
  { code: 'THREAD_CUTTING', name: 'Thread Trimming', type: 'PIECES', count: 85, status: 'NORMAL', leadTime: '1.0h' },
  { code: 'WASHING', name: 'Garment Washing & Softening', type: 'PIECES', count: 0, status: 'IDLE', leadTime: '2.0h' },
  { code: 'QC2', name: 'Post-Wash Inspection', type: 'PIECES', count: 0, status: 'IDLE', leadTime: '0.5h' },
  { code: 'STITCHING', name: 'Sewing & Assembly Lines', type: 'PIECES', count: 420, status: 'BUSY', leadTime: '6.0h' },
  { code: 'QC3', name: 'End-Line 100% Quality Gate', type: 'PIECES', count: 45, status: 'NORMAL', leadTime: '1.5h' },
  { code: 'FINISHING', name: 'Button & Steam Pressing', type: 'PIECES', count: 190, status: 'NORMAL', leadTime: '2.0h' },
  { code: 'PACKING', name: 'Carton Packing & Barcoding', type: 'CARTONS', count: 32, status: 'NORMAL', leadTime: '1.0h' },
  { code: 'DISPATCH', name: 'Finished Goods Logistics', type: 'CARTONS', count: 18, status: 'NORMAL', leadTime: '0.5h' },
];

export default function FloorFlowPage() {
  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full pt-20">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
            MANUFACTURING PIPELINE
          </span>
          <h1 className="text-2xl font-bold text-slate-900">Floor Flow & Stage Velocity</h1>
          <p className="text-xs text-slate-500 mt-1">
            End-to-end visualization of materials passing through production departments
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/shopfloor"
            className="px-3.5 py-2 bg-[#1E3A8A] hover:bg-[#152B68] text-white text-xs font-semibold rounded-md shadow-sm transition"
          >
            Terminal Station Mode
          </Link>
        </div>
      </div>

      {/* Visual Pipeline Flow */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs mb-8">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-6">
          Factory Floor Linear Sequence
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {STAGES.map((s, idx) => (
            <div
              key={s.code}
              className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 hover:bg-white hover:border-blue-400 hover:shadow-xs transition relative group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold flex items-center justify-center">
                  {idx + 1}
                </span>
                <span
                  className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                    s.status === 'BUSY'
                      ? 'bg-amber-100 text-amber-800'
                      : s.status === 'IDLE'
                      ? 'bg-slate-100 text-slate-500'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {s.status}
                </span>
              </div>

              <h3 className="font-bold text-xs text-slate-900 leading-snug">{s.name}</h3>
              <p className="text-[10px] font-mono text-slate-400 mt-0.5">{s.code}</p>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Active WIP:</span>
                <span className="font-mono font-bold text-slate-900">
                  {s.count.toLocaleString()} {s.type}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                <span>Avg cycle time:</span>
                <span>{s.leadTime}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
