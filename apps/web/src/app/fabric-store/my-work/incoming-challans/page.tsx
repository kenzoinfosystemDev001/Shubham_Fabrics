'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { RefreshCw, ArrowDownToLine, Package } from 'lucide-react';

export default function IncomingChallansPage() {
  const [loading, setLoading] = useState(true);
  const [challans, setChallans] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        // Load challans where toDepartment = STORE and status = ISSUED or RECEIVED
        const res = await fetch('/api/challans?toDepartment=STORE');
        const json = await res.json();
        const data = Array.isArray(json) ? json : json.data || [];
        // Filter: addressed to store and not yet processed
        setChallans(data.filter((c: any) => 
          c.toDepartment === 'STORE' && 
          ['ISSUED', 'SUBMITTED', 'DRAFT'].includes(c.status)
        ));
      } catch {
        setChallans([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-slate-100 text-slate-700',
      SUBMITTED: 'bg-amber-100 text-amber-800',
      ISSUED: 'bg-blue-100 text-blue-800',
      RECEIVED: 'bg-emerald-100 text-emerald-800',
    };
    return (
      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${colors[status] || 'bg-slate-100 text-slate-700'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#F0FAF9]">
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-700 block">FABRIC STORE · MY WORK</span>
          <h1 className="text-xl font-bold text-slate-900">Incoming Challans</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/fabric-store/my-work/material-receipt/create"
            className="flex items-center gap-2 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-md transition"
          >
            <Package className="w-4 h-4" />
            <span>Create GRN</span>
          </Link>
        </div>
      </header>

      <main className="p-4 sm:p-8 max-w-5xl mx-auto">
        <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200/80">
            <h2 className="text-sm font-bold text-slate-900">Challans Addressed to Fabric Store</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">Challans dispatched from Programming or other departments to Fabric Store</p>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading challans…</div>
          ) : challans.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <ArrowDownToLine className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">No incoming challans at this time</p>
              <p className="text-[11px] text-slate-500">Challans issued from Programming to Fabric Store will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Challan No.</th>
                    <th className="py-2.5 px-4">Program</th>
                    <th className="py-2.5 px-4">From Dept.</th>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Description</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {challans.map((ch: any) => (
                    <tr key={ch.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4 font-mono font-bold text-teal-800">{ch.challanNumber}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{ch.program?.programNumber || '—'}</td>
                      <td className="py-3 px-4 font-semibold">{ch.fromDepartment}</td>
                      <td className="py-3 px-4 text-[11px]">{new Date(ch.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-[11px]">{ch.items?.[0]?.itemDescription || '—'}</td>
                      <td className="py-3 px-4">{statusBadge(ch.status)}</td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/fabric-store/my-work/material-receipt/create?challanId=${ch.id}`}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-2 py-1 rounded transition"
                        >
                          Create GRN
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
