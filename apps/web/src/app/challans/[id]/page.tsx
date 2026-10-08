'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Printer, 
  CheckCircle2, 
  Send, 
  Layers, 
  Calendar, 
  AlertCircle,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { api } from '@/lib/api';

export default function ChallanDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [challan, setChallan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadChallan = async () => {
    try {
      setLoading(true);
      const data = await api.getChallan(id);
      setChallan(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load Challan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadChallan();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] pl-0 md:pl-64 flex items-center justify-center">
        <div className="text-xs text-slate-500 font-mono animate-pulse">
          Loading Challan Document...
        </div>
      </div>
    );
  }

  if (error || !challan) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] pl-0 md:pl-64 p-4 sm:p-8">
        <div className="max-w-xl mx-auto p-6 bg-rose-50 border border-rose-200 rounded-xl text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
          <h2 className="text-sm font-bold text-rose-900">Error Loading Challan</h2>
          <p className="text-xs text-rose-700">{error || 'Challan not found'}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-rose-900 text-white rounded text-xs font-semibold"
          >
            ← Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pl-0 md:pl-64 pb-20">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A66E22] block">
              SHUBHAM FABRICS · DISPATCH CHALLAN
            </span>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold font-mono text-slate-900">
                {challan.challanNumber}
              </h1>
              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-900">
                {challan.status}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#163767] hover:bg-[#0F264A] text-white text-xs font-semibold rounded-md shadow-xs transition"
          >
            <Printer className="w-4 h-4" />
            <span>Print Challan Slip</span>
          </button>
        </div>
      </header>

      {/* PRINTABLE VOUCHER */}
      <main className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
        
        <div className="bg-white border border-slate-300 rounded-xl p-4 sm:p-8 shadow-sm space-y-6">
          
          {/* VOUCHER TOP HEADER */}
          <div className="flex items-start justify-between pb-6 border-b-2 border-slate-900">
            <div>
              <span className="text-[11px] font-bold tracking-[0.2em] text-[#A66E22] block mb-1">
                SHUBHAM FABRICS INDIA PVT. LTD.
              </span>
              {challan.fromDepartment === 'STORE' && (challan.toDepartment === 'DYEING' || challan.toDepartment?.includes('DYE')) ? (
                <div>
                  <h2 className="text-xl font-serif font-black text-slate-900 tracking-wide">
                    FABRIC STORE DEPARTMENT
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-black font-mono tracking-wider text-purple-900 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                      FABRIC STORE → DYEING
                    </span>
                    <span className="text-sm font-bold text-slate-800 tracking-widest">
                      CHALLAN
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Raw material / kora fabric dispatch slip to Dyeing Department
                  </p>
                </div>
              ) : challan.fromDepartment === 'DYEING' || challan.toDepartment === 'QC1' || (challan.challanNumber && challan.challanNumber.startsWith('CH-DYE-')) ? (
                <div>
                  <h2 className="text-xl font-serif font-black text-slate-900 tracking-wide">
                    DYEING DEPARTMENT
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-black font-mono tracking-wider text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      DYEING → QC1
                    </span>
                    <span className="text-sm font-bold text-slate-800 tracking-widest">
                      CHALLAN
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Inter-department manufacturing transfer &amp; quality check dispatch slip
                  </p>
                </div>
              ) : (
                <div>
                  <h2 className="text-2xl font-serif font-black text-slate-900">
                    MATERIAL DISPATCH CHALLAN
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Inter-department manufacturing transfer &amp; chain of custody
                  </p>
                </div>
              )}
            </div>

            <div className="text-right">
              <span className="font-mono font-bold text-lg text-slate-900 block">
                {challan.challanNumber}
              </span>
              <span className="text-xs text-slate-500 block">
                Date: {challan.createdAt ? new Date(challan.createdAt).toLocaleDateString() : '—'}
              </span>
              <span className="inline-block mt-1 px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-800">
                PRIORITY: {challan.priority || 'NORMAL'}
              </span>
            </div>
          </div>

          {/* ROUTING INFO GRID */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] font-bold uppercase">Issued From</span>
              <span className="font-bold text-slate-900 text-sm">{challan.fromDepartment || 'FABRIC STORE'}</span>
              <span className="text-[10px] text-slate-500 block">
                {challan.fromDepartment === 'DYEING' ? 'Dyeing Unit' : 'Source Gate'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-bold uppercase">Dispatched To</span>
              <span className="font-bold text-blue-900 text-sm">{challan.toDepartment}</span>
              <span className="text-[10px] text-slate-500 block">Next Gate</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-bold uppercase">Program File</span>
              <span className="font-mono font-bold text-slate-900 text-sm">
                {challan.program?.programNumber || '—'}
              </span>
              <span className="text-[10px] text-slate-500 block truncate">
                {challan.program?.clientName || challan.program?.buyerName || 'Standard Client'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-bold uppercase">Issuer</span>
              <span className="font-semibold text-slate-900 text-sm">
                {challan.issuedBy?.fullName || challan.createdBy?.fullName || challan.createdBy?.username || 'Department Incharge'}
              </span>
              <span className="text-[10px] text-emerald-700 block">✓ Digitally Signed</span>
            </div>
          </div>

          {/* ITEMS TRANSFER TABLE */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
              Transferred Work Items &amp; Materials
            </h3>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">#</th>
                    <th className="py-2.5 px-4">Description</th>
                    <th className="py-2.5 px-4">Color</th>
                    <th className="py-2.5 px-4 text-right">Quantity</th>
                    <th className="py-2.5 px-4">UOM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {(challan.items || []).map((item: any, idx: number) => (
                    <tr key={item.id || idx}>
                      <td className="py-3 px-4 font-mono text-slate-500">{idx + 1}</td>
                      <td className="py-3 px-4 font-medium text-slate-900">{item.itemDescription}</td>
                      <td className="py-3 px-4">{item.colour || 'Standard'}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold">{item.quantity}</td>
                      <td className="py-3 px-4">{item.uom || 'PCS'}</td>
                    </tr>
                  ))}
                  {(!challan.items || challan.items.length === 0) && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-slate-400">
                        No item records attached to this Challan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* REMARKS */}
          {challan.remarks && (
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
              <span className="font-bold text-slate-700 block mb-0.5">Remarks / Instructions:</span>
              <p className="text-slate-600 italic font-serif">{challan.remarks}</p>
            </div>
          )}

          {/* PHYSICAL SIGNATURE BLOCKS FOR FACTORY HANDOFF */}
          <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-xs">
            <div className="border-t border-dashed border-slate-400 pt-2 text-center">
              <span className="font-bold text-slate-800 block">
                {challan.fromDepartment === 'DYEING' || challan.toDepartment === 'QC1'
                  ? 'Dyeing Department'
                  : challan.fromDepartment
                  ? `${challan.fromDepartment} Department`
                  : 'Dispatch Department'}
              </span>
              <span className="text-[10px] text-slate-500">Authorized Issuer Signature</span>
            </div>
            <div className="border-t border-dashed border-slate-400 pt-2 text-center">
              <span className="font-bold text-slate-800 block">{challan.toDepartment} Supervisor</span>
              <span className="text-[10px] text-slate-500">Receiver Gate Inward Stamp &amp; Signature</span>
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}
