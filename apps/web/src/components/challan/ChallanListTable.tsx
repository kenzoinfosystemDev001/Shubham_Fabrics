'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  FileText, 
  Printer, 
  Download, 
  Eye, 
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { downloadChallanHtml, printChallan } from '@/lib/download-challan';
import { ChallanPrintModal } from './ChallanPrintModal';

interface ChallanListTableProps {
  challans: any[];
  title?: string;
  emptyMessage?: string;
}

export function ChallanListTable({
  challans,
  title = 'Departmental Transfer Challans',
  emptyMessage = 'No challans recorded for this production order.',
}: ChallanListTableProps) {
  const [selectedChallan, setSelectedChallan] = useState<any | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-700" />
          <span>{title} ({challans.length})</span>
        </h4>
      </div>

      {challans.length > 0 ? (
        <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white shadow-2xs">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                <th className="p-2.5 font-bold">Challan #</th>
                <th className="p-2.5 font-bold">Type</th>
                <th className="p-2.5 font-bold">Handoff Route</th>
                <th className="p-2.5 font-bold">Items / Qty</th>
                <th className="p-2.5 font-bold">Status</th>
                <th className="p-2.5 font-bold">Priority</th>
                <th className="p-2.5 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {challans.map((challan: any) => {
                const totalQty = Array.isArray(challan.items)
                  ? challan.items.reduce((acc: number, it: any) => acc + (Number(it.quantity) || 0), 0)
                  : 0;

                return (
                  <tr key={challan.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-2.5 font-mono font-bold text-blue-900">
                      <Link 
                        href={`/challans/${challan.id}`}
                        className="hover:underline flex items-center gap-1"
                      >
                        <span>{challan.challanNumber || challan.id}</span>
                      </Link>
                    </td>
                    <td className="p-2.5 font-semibold text-slate-700">
                      {challan.challanType || 'DISPATCH'}
                    </td>
                    <td className="p-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px]">
                          {challan.fromDepartment}
                        </span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-900 text-[10px]">
                          {challan.toDepartment}
                        </span>
                      </div>
                    </td>
                    <td className="p-2.5 font-medium text-slate-700">
                      {challan.items?.length || 0} items
                      {totalQty > 0 && <span className="font-mono text-slate-500 ml-1">({totalQty} pcs)</span>}
                    </td>
                    <td className="p-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        challan.status === 'COMPLETED' || challan.status === 'RECEIVED'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : challan.status === 'CANCELLED'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}>
                        {challan.status}
                      </span>
                    </td>
                    <td className="p-2.5">
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        challan.priority === 'URGENT'
                          ? 'bg-rose-100 text-rose-900 font-black'
                          : challan.priority === 'HIGH'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-slate-100 text-slate-700'
                      }`}>
                        {challan.priority || 'NORMAL'}
                      </span>
                    </td>
                    <td className="p-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => printChallan(challan)}
                          className="p-1.5 rounded hover:bg-slate-200/70 text-slate-600 hover:text-slate-900 transition cursor-pointer"
                          title="Print Challan Slip"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void downloadChallanHtml(challan)}
                          className="p-1.5 rounded hover:bg-slate-200/70 text-slate-600 hover:text-slate-900 transition cursor-pointer"
                          title="Download HTML Slip"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedChallan(challan)}
                          className="p-1.5 rounded hover:bg-slate-200/70 text-slate-600 hover:text-slate-900 transition cursor-pointer"
                          title="Preview Slip Modal"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-xs">
          {emptyMessage}
        </div>
      )}

      {/* CHALLAN MODAL */}
      {selectedChallan && (
        <ChallanPrintModal
          challan={selectedChallan}
          isOpen={Boolean(selectedChallan)}
          onClose={() => setSelectedChallan(null)}
        />
      )}
    </div>
  );
}
