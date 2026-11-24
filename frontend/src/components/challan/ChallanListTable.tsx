'use client';

import React, { useState } from 'react';
import { departmentName } from '@/lib/workflow-views';
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
import { DocumentActionButtons } from '@/components/common/DocumentActionButtons';
import { formatTotals, totalsByUnit } from '@/lib/challan-units.mjs';

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
        <h4 className="text-xs font-black uppercase tracking-wider text-neutral-900 flex items-center gap-2">
          <FileText className="w-4 h-4 text-accent-800" />
          <span>{title} ({challans.length})</span>
        </h4>
      </div>

      {challans.length > 0 ? (
        <div className="overflow-x-auto border border-neutral-200 rounded-lg bg-white shadow-2xs">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-700">
                <th className="p-2.5 font-bold">Challan #</th>
                <th className="p-2.5 font-bold">Type</th>
                <th className="p-2.5 font-bold">Handoff Route</th>
                <th className="p-2.5 font-bold">Items / Qty</th>
                <th className="p-2.5 font-bold">Status</th>
                <th className="p-2.5 font-bold">Priority</th>
                <th className="p-2.5 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {challans.map((challan: any) => {
                // Per unit ("30 MTR · 10 PCS"); meters and pieces are never added together.
                const totalQtyText = formatTotals(totalsByUnit(Array.isArray(challan.items) ? challan.items : []), '');

                return (
                  <tr key={challan.id} className="hover:bg-neutral-50/80 transition">
                    <td className="p-2.5 font-mono font-bold text-brand-900">
                      <Link 
                        href={`/challans/${challan.id}`}
                        className="hover:underline flex items-center gap-1"
                      >
                        <span>{challan.challanNumber || challan.id}</span>
                      </Link>
                    </td>
                    <td className="p-2.5 font-semibold text-neutral-700">
                      {challan.challanType || 'DISPATCH'}
                    </td>
                    <td className="p-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-900">
                        <span className="px-1.5 py-0.5 rounded bg-neutral-100 border border-neutral-200 text-[10px]">
                          {departmentName(challan.fromDepartment)}
                        </span>
                        <ArrowRight className="w-3 h-3 text-neutral-500" />
                        <span className="px-1.5 py-0.5 rounded bg-accent-50 border border-accent-200 text-accent-800 text-[10px]">
                          {departmentName(challan.toDepartment)}
                        </span>
                      </div>
                    </td>
                    <td className="p-2.5 font-medium text-neutral-700">
                      {challan.items?.length || 0} items
                      {totalQtyText && <span className="font-mono text-neutral-500 ml-1">({totalQtyText})</span>}
                    </td>
                    <td className="p-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        challan.status === 'COMPLETED' || challan.status === 'RECEIVED'
                          ? 'bg-accent-100 text-accent-800 border border-accent-200'
                          : challan.status === 'CANCELLED'
                            ? 'bg-danger-100 text-danger-800 border border-danger-200'
                            : 'bg-brand-100 text-brand-800 border border-brand-200'
                      }`}>
                        {challan.status}
                      </span>
                    </td>
                    <td className="p-2.5">
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        challan.priority === 'URGENT'
                          ? 'bg-danger-100 text-danger-900 font-black'
                          : challan.priority === 'HIGH'
                            ? 'bg-accent-100 text-accent-800'
                            : 'bg-neutral-100 text-neutral-700'
                      }`}>
                        {challan.priority || 'NORMAL'}
                      </span>
                    </td>
                    <td className="p-2.5 text-right">
                      <div className="flex items-center justify-end">
                        <DocumentActionButtons
                          challan={challan}
                          program={challan.program}
                          size="xs"
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-6 text-center border-2 border-dashed border-neutral-200 rounded-lg text-neutral-500 text-xs">
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
