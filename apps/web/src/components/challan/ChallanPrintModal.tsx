'use client';

import React from 'react';
import { 
  Printer, 
  Download, 
  X, 
  FileText, 
  ArrowRight,
  Barcode as BarcodeIcon,
  ShieldCheck
} from 'lucide-react';
import { 
  downloadChallanHtml, 
  printChallan,
  ChallanItem
} from '@/lib/download-challan';
import { getCurrentUser, canViewClientCode } from '@/lib/rbac';

interface ChallanPrintModalProps {
  challan: any;
  isOpen: boolean;
  onClose: () => void;
}

export function ChallanPrintModal({
  challan,
  isOpen,
  onClose,
}: ChallanPrintModalProps) {
  if (!isOpen || !challan) return null;

  const currentUser = typeof window !== 'undefined' ? getCurrentUser() : null;
  const canSeeClientCode = canViewClientCode(currentUser);

  const challanNo = challan.challanNumber || 'CH-0000';
  const fromDept = challan.fromDepartment || 'FABRIC_STORE';
  const toDept = challan.toDepartment || 'DYEING';
  const status = challan.status || 'ISSUED';
  const priority = challan.priority || 'NORMAL';
  const remarks = challan.remarks || '';
  const dateStr = challan.createdAt || challan.issuedDate 
    ? new Date(challan.createdAt || challan.issuedDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    : new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });

  const prog = challan.program || {};
  const programSerial = prog.programSerialNo || prog.programNumber || '—';
  const designNo = prog.designNumber || prog.designName || prog.wilcomDesignNumber || 'STANDARD DESIGN';
  const clientName = prog.clientName || prog.buyerName || 'Standard Client';
  const items: ChallanItem[] = Array.isArray(challan.items) ? challan.items : [];

  const handlePrint = () => {
    printChallan(challan);
  };

  const handleDownload = () => {
    void downloadChallanHtml(challan);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[96vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* MODAL HEADER */}
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-900 rounded-lg">
              <FileText className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                Departmental Transfer Challan Slip
              </div>
              <h2 className="text-base font-bold text-slate-900">
                {challanNo} &middot; {fromDept} &rarr; {toDept}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Challan</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-black text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Slip</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto bg-slate-100 flex-1">
          <div className="max-w-[760px] mx-auto bg-white p-6 sm:p-8 rounded shadow-sm border-2 border-black text-black font-sans space-y-4">
            
            {/* Header */}
            <div className="text-center border-b-2 border-black pb-3">
              <div className="text-sm font-black tracking-wider uppercase text-slate-800">
                SHUBHAM FABRICS INDIA PVT. LTD.
              </div>
              <div className="text-xl font-black tracking-widest uppercase text-emerald-900 mt-1">
                DEPARTMENTAL TRANSFER CHALLAN
              </div>
              <div className="text-xs font-bold font-mono text-slate-600 mt-0.5">
                CHALLAN #{challanNo}
              </div>
            </div>

            {/* Handoff Route Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-300 rounded text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">FROM DEPARTMENT</span>
                <span className="font-black text-slate-900">{fromDept}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">TO DEPARTMENT</span>
                <span className="font-black text-slate-900">{toDept}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">DATE</span>
                <span className="font-black text-slate-900">{dateStr}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">STATUS &middot; PRIORITY</span>
                <span className="font-black text-slate-900">{status} &middot; {priority}</span>
              </div>
            </div>

            {/* Production Order Info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border border-black p-2.5 bg-white">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">TRAVELER SERIAL #</span>
                <span className="font-bold text-slate-900 font-mono">{programSerial}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">DESIGN #</span>
                <span className="font-bold text-slate-900">{designNo}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">CLIENT</span>
                <span className="font-bold text-slate-900">
                  {clientName}
                  {canSeeClientCode && prog.clientCode && (
                    <span className="ml-1 text-[10px] font-mono text-emerald-800">({prog.clientCode})</span>
                  )}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">STYLE &middot; PATTERN</span>
                <span className="font-bold text-slate-900">{prog.mainStyle || 'Standard'} &middot; {prog.pattern || '—'}</span>
              </div>
            </div>

            {/* Items Table */}
            <div className="space-y-1">
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-800">
                TRANSFERRED ITEMS &amp; FABRIC BREAKDOWN
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border-[1.5px] border-black text-xs text-center">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="border-[1.5px] border-black p-1.5 font-black text-left w-10">#</th>
                      <th className="border-[1.5px] border-black p-1.5 font-black text-left">DESCRIPTION</th>
                      <th className="border-[1.5px] border-black p-1.5 font-black">COLOR</th>
                      <th className="border-[1.5px] border-black p-1.5 font-black w-20">QUANTITY</th>
                      <th className="border-[1.5px] border-black p-1.5 font-black w-14">UOM</th>
                      <th className="border-[1.5px] border-black p-1.5 font-black">REMARKS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length > 0 ? (
                      items.map((it, idx) => (
                        <tr key={it.id || idx} className="h-6">
                          <td className="border-[1.5px] border-black p-1 text-left font-bold">{idx + 1}</td>
                          <td className="border-[1.5px] border-black p-1 text-left font-semibold">{it.itemDescription || 'Garment Component'}</td>
                          <td className="border-[1.5px] border-black p-1 font-bold">{it.colour || '—'}</td>
                          <td className="border-[1.5px] border-black p-1 font-mono font-bold">{it.quantity || '—'}</td>
                          <td className="border-[1.5px] border-black p-1 font-semibold">{it.uom || 'PCS'}</td>
                          <td className="border-[1.5px] border-black p-1 text-slate-600 italic text-[11px]">{it.remarks || '—'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr className="h-8">
                        <td colSpan={6} className="border-[1.5px] border-black p-2 text-slate-400 italic">
                          Standard Program Component Transfer Batch
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Remarks */}
            {remarks && (
              <div className="p-3 bg-amber-50/70 border border-amber-300 rounded text-xs space-y-0.5">
                <span className="font-bold text-amber-950">CHALLAN REMARKS: </span>
                <span className="text-amber-900">{remarks}</span>
              </div>
            )}

            {/* Custody Signatures Bar */}
            <div className="grid grid-cols-2 gap-8 pt-8 border-t border-black/20 text-xs">
              <div className="text-center space-y-6">
                <div className="border-b border-black w-3/4 mx-auto pb-1" />
                <span className="font-bold uppercase tracking-wider block text-[10px] text-slate-600">
                  DISPATCHED BY ({fromDept})
                </span>
              </div>
              <div className="text-center space-y-6">
                <div className="border-b border-black w-3/4 mx-auto pb-1" />
                <span className="font-bold uppercase tracking-wider block text-[10px] text-slate-600">
                  RECEIVED &amp; VERIFIED BY ({toDept})
                </span>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
