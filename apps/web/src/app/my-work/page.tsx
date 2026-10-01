'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function MyWorkPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [challans, setChallans] = useState<any[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('subham_mes_user');
      if (saved) {
        try {
          setCurrentUser(JSON.parse(saved));
        } catch {}
      }
    }

    const loadWork = async () => {
      try {
        setLoading(true);
        const data = await api.getChallans();
        setChallans(data || []);
      } catch {
        // Fallback demo queue
        setChallans([
          {
            id: 'ch-demo-01',
            challanNumber: 'CH-DYE-2026-000451',
            challanType: 'INTER_DEPARTMENT',
            fromDepartment: 'STORE',
            toDepartment: 'DYEING',
            status: 'ISSUED',
            priority: 'HIGH',
            items: [{ itemDescription: 'Cotton Cambric 60s', quantity: 250, uom: 'MTR' }],
          },
          {
            id: 'ch-demo-02',
            challanNumber: 'CH-CUT-2026-000452',
            challanType: 'INTER_DEPARTMENT',
            fromDepartment: 'QC1',
            toDepartment: 'CUTTING',
            status: 'IN_PROCESS',
            priority: 'URGENT',
            items: [{ itemDescription: 'Inspected Dyed Fabric Roll', quantity: 240, uom: 'MTR' }],
          },
        ]);
      } finally {
        setLoading(false);
      }
    };
    loadWork();
  }, []);

  const dept = currentUser?.departmentCode || 'STORE';

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full pt-20">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
            OPERATOR DESK · {dept} DEPARTMENT
          </span>
          <h1 className="text-2xl font-bold text-slate-900">My Work Queue</h1>
          <p className="text-xs text-slate-500 mt-1">
            Active challans and production tasks assigned to your station
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/challans"
            className="px-3.5 py-2 bg-[#1E3A8A] hover:bg-[#152B68] text-white text-xs font-semibold rounded-md shadow-sm transition"
          >
            + Issue New Challan
          </Link>
          <Link
            href="/shopfloor"
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-md shadow-xs transition"
          >
            Floor Terminal
          </Link>
        </div>
      </div>

      {/* Task Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Incoming to Receive</span>
          <p className="text-2xl font-bold text-blue-900 mt-2">1</p>
          <p className="text-[11px] text-amber-600 mt-1">Requires supervisor gate scan</p>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Currently in Process</span>
          <p className="text-2xl font-bold text-slate-900 mt-2">2</p>
          <p className="text-[11px] text-emerald-600 mt-1">On schedule</p>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Pending QC / Handoff</span>
          <p className="text-2xl font-bold text-slate-900 mt-2">0</p>
          <p className="text-[11px] text-slate-400 mt-1">No bottlenecks</p>
        </div>
      </div>

      {/* Active Work Table */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Assigned Production Challans</h2>
          <span className="text-xs text-slate-400">Total: {challans.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] text-slate-500 border-b border-slate-100 font-medium">
              <tr>
                <th className="py-3 px-4">Challan #</th>
                <th className="py-3 px-4">Route</th>
                <th className="py-3 px-4">Items / Quantity</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {challans.map((ch) => (
                <tr key={ch.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3.5 px-4 font-mono font-semibold text-[#1E3A8A]">
                    <Link href={`/challans/${ch.id}`}>{ch.challanNumber}</Link>
                  </td>
                  <td className="py-3.5 px-4 text-slate-700">
                    <span className="font-medium">{ch.fromDepartment}</span>
                    <span className="text-slate-400 mx-1.5">→</span>
                    <span className="font-semibold text-slate-900">{ch.toDepartment}</span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">
                    {ch.items?.[0]?.itemDescription || 'Garment components'} (
                    {ch.items?.[0]?.quantity || 100} {ch.items?.[0]?.uom || 'PCS'})
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                      {ch.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="text-[10px] font-bold text-amber-700">
                      {ch.priority || 'NORMAL'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <Link
                      href={`/challans/${ch.id}`}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-900 rounded font-medium text-[11px] text-slate-700 transition"
                    >
                      Process →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
