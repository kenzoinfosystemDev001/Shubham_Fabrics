'use client';

import React from 'react';
import { 
  Printer, 
  Download, 
  X, 
  FileText, 
  CheckCircle2, 
  Building2, 
  Calendar,
  Layers,
  Scissors
} from 'lucide-react';
import { 
  downloadProductionSheetHtml, 
  printProductionSheet 
} from '@/lib/download-production-sheet';

interface ProductionSheetPrintModalProps {
  program: any;
  isOpen: boolean;
  onClose: () => void;
}

export function ProductionSheetPrintModal({
  program,
  isOpen,
  onClose,
}: ProductionSheetPrintModalProps) {
  if (!isOpen || !program) return null;

  const serialNo = program.programSerialNo || program.programNumber || 'PRG-DRAFT';
  const clientName = program.clientName || program.buyerName || '—';
  const designNo = program.designNumber || program.designName || '—';
  const wilcomNo = program.wilcomDesignNumber || '—';
  const mainStyle = program.mainStyle || program.styleCode || '—';
  const subStyle = program.subStyle || '—';
  const pattern = program.pattern || '—';
  const baseDesignType = program.baseDesignType || '—';
  const embroideryDesign = program.embroideryDesign || program.designName || '—';
  const embroiderySize = program.embroideryDesignSize || '—';
  const fabricName = program.fabricName || program.fabrics?.[0]?.fabricName || '—';
  const fabricType = program.fabricType || program.fabrics?.[0]?.composition || '—';
  const fabricWidth = program.fabricWidth || (program.fabricWidthInches ? `${program.fabricWidthInches} Inches` : '—');
  const fabricColor = program.fabricColor || program.colours?.[0]?.colorName || '—';
  const fabricColorAvailable = program.fabricColorAvailable || 'IN_STOCK';
  const fabricAverage = program.fabricAverage || '—';
  const fabricAverageType = program.fabricAverageType || 'Meters/Piece';
  const fabricAverageMeasurement = program.fabricAverageMeasurement || 'Standard';
  const fabricDyeingRequired = program.fabricDyeingRequired ? 'YES' : 'NO';
  const fabricIssuedToDyeing = program.fabricIssuedToDyeing || 0;
  const fabricSentToDyeing = program.fabricSentToDyeing || 0;
  const colorQty = program.colorQuantity || program.targetQuantity || 0;
  const qtyUnit = program.quantityMeasurement || 'PCS';
  const specialMaterial = program.specialMaterial || 'None';
  const specialMaterialQty = program.specialMaterialQuantity || '—';
  const prodDesignDate = program.productionDesignDate ? new Date(program.productionDesignDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const prodEndDate = program.productionEndDate ? new Date(program.productionEndDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const deliveryDate = program.deliveryDate ? new Date(program.deliveryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const startDate = program.startDate || program.programDate ? new Date(program.startDate || program.programDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const piecesRejection = program.piecesRejection || 0;
  const rejectionReason = program.rejectionReason || '—';
  const comments = program.comments || program.remarks || 'No special remarks entered.';
  const authorName = program.createdBy?.fullName || 'Programming Incharge';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* MODAL HEADER */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-900 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Production Sheet Traveler &middot; {serialNo}
              </h2>
              <p className="text-xs text-slate-500">
                Print ready A4 manufacturing specification document
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => printProductionSheet(program)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print A4 Sheet</span>
            </button>
            <button
              onClick={() => downloadProductionSheetHtml(program)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#163767] hover:bg-[#0F264A] text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download File</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MODAL BODY: DOCUMENT PREVIEW */}
        <div className="p-6 overflow-y-auto bg-slate-100 flex-1">
          <div className="max-w-[780px] mx-auto bg-white p-8 sm:p-10 rounded-lg shadow-sm border border-slate-200 text-slate-900 space-y-6">
            
            {/* LETTERHEAD */}
            <div className="border-b-2 border-[#163767] pb-4 flex justify-between items-start">
              <div>
                <span className="text-lg font-black tracking-wider text-[#163767] uppercase block">
                  SHUBHAM FABRICS INDIA PVT. LTD.
                </span>
                <span className="text-[11px] font-bold text-slate-500 tracking-widest uppercase block mt-0.5">
                  Manufacturing Execution System &middot; Production Sheet
                </span>
                <span className="inline-block mt-2 px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-bold uppercase text-slate-700">
                  Department: Programming &middot; Factory Traveler Card
                </span>
              </div>
              <div className="text-right">
                <span className="font-mono text-xl font-bold text-[#163767] block">
                  {serialNo}
                </span>
                <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-900 font-bold text-[10px] rounded uppercase mt-1">
                  {program.status || 'DRAFT'}
                </span>
              </div>
            </div>

            {/* SECTIONS 1 & 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              
              {/* Section 1 */}
              <div className="border border-slate-200 rounded-md overflow-hidden">
                <div className="bg-slate-50 px-3 py-1.5 font-bold uppercase text-[10px] text-[#163767] border-b border-slate-200">
                  Section 1 &middot; Order &amp; Commercial Info
                </div>
                <div className="p-3 space-y-1.5 divide-y divide-slate-100">
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-500">Client / Buyer:</span>
                    <strong className="text-slate-900">{clientName}</strong>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-500">Design Number:</span>
                    <span className="font-mono font-semibold">{designNo}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-500">Priority:</span>
                    <strong className="text-amber-700">{program.clientPriority || 'NORMAL'}</strong>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-500">Target Delivery:</span>
                    <strong className="font-mono">{deliveryDate}</strong>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-500">Start Date:</span>
                    <span>{startDate}</span>
                  </div>
                </div>
              </div>

              {/* Section 2 */}
              <div className="border border-slate-200 rounded-md overflow-hidden">
                <div className="bg-slate-50 px-3 py-1.5 font-bold uppercase text-[10px] text-[#163767] border-b border-slate-200">
                  Section 2 &middot; Style Specifications
                </div>
                <div className="p-3 space-y-1.5 divide-y divide-slate-100">
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-500">Main Style:</span>
                    <strong className="text-slate-900">{mainStyle}</strong>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-500">Sub Style:</span>
                    <span>{subStyle}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-500">Pattern:</span>
                    <span>{pattern}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-500">Base Design Type:</span>
                    <span>{baseDesignType}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-500">Product Category:</span>
                    <span>{program.productCategory || 'GARMENT'}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* SECTION 3: WILCOM & EMBROIDERY */}
            <div className="border border-slate-200 rounded-md overflow-hidden text-xs">
              <div className="bg-slate-50 px-3 py-1.5 font-bold uppercase text-[10px] text-[#163767] border-b border-slate-200">
                Section 3 &middot; Wilcom &amp; Technical Embroidery Parameters
              </div>
              <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-500 block text-[11px]">Wilcom Design Number</span>
                  <span className="font-mono font-bold text-sm text-[#163767]">{wilcomNo}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Embroidery Frame Size</span>
                  <span className="font-mono font-semibold">{embroiderySize}</span>
                </div>
                <div className="sm:col-span-2 pt-1 border-t border-slate-100">
                  <span className="text-slate-500 block text-[11px]">Embroidery Description</span>
                  <span className="font-semibold text-slate-800">{embroideryDesign}</span>
                </div>
              </div>
            </div>

            {/* SECTIONS 4 & 5 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              
              {/* Section 4 */}
              <div className="border border-slate-200 rounded-md overflow-hidden">
                <div className="bg-slate-50 px-3 py-1.5 font-bold uppercase text-[10px] text-[#163767] border-b border-slate-200">
                  Section 4 &middot; Fabric Master Details
                </div>
                <div className="p-3 space-y-1.5 divide-y divide-slate-100">
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-500">Fabric Quality:</span>
                    <strong className="text-slate-900">{fabricName}</strong>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-500">Composition:</span>
                    <span>{fabricType}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-500">Width:</span>
                    <span className="font-mono">{fabricWidth}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-500">Color / Shade:</span>
                    <strong className="text-slate-900">{fabricColor}</strong>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-500">Avg Consumption:</span>
                    <span className="font-mono font-bold">{fabricAverage} {fabricAverageType}</span>
                  </div>
                </div>
              </div>

              {/* Section 5 & 6 */}
              <div className="border border-slate-200 rounded-md overflow-hidden">
                <div className="bg-slate-50 px-3 py-1.5 font-bold uppercase text-[10px] text-[#163767] border-b border-slate-200">
                  Section 5 &middot; Dyeing &amp; Quantities
                </div>
                <div className="p-3 space-y-1.5 divide-y divide-slate-100">
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-500">Dyeing Required:</span>
                    <strong className={fabricDyeingRequired === 'YES' ? 'text-blue-700' : 'text-slate-700'}>
                      {fabricDyeingRequired}
                    </strong>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-500">Sent to Dyeing:</span>
                    <span className="font-mono">{fabricSentToDyeing} Mtr</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-500">Target Color Qty:</span>
                    <strong className="font-mono text-sm text-[#163767]">{colorQty} {qtyUnit}</strong>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-500">Special Material:</span>
                    <span>{specialMaterial}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-500">Rejection Allowance:</span>
                    <span className="font-mono text-rose-700 font-bold">{piecesRejection} PCS</span>
                  </div>
                </div>
              </div>

            </div>

            {/* SECTIONS 7 & 8: SCHEDULE & COMMENTS */}
            <div className="border border-slate-200 rounded-md overflow-hidden text-xs">
              <div className="bg-slate-50 px-3 py-1.5 font-bold uppercase text-[10px] text-[#163767] border-b border-slate-200">
                Sections 7 &amp; 8 &middot; Schedule &amp; Operator Instructions
              </div>
              <div className="p-3 space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Design Release Date</span>
                    <span className="font-medium">{prodDesignDate}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Projected End Date</span>
                    <span className="font-medium">{prodEndDate}</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-500 block text-[11px]">Comments &amp; Instructions</span>
                  <p className="text-slate-800 font-serif italic mt-0.5">
                    {comments}
                  </p>
                </div>
              </div>
            </div>

            {/* SIGNATURE AUTHORIZATION GRID */}
            <div className="pt-4 border-t border-dashed border-slate-300">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-2">
                Department Sign-off &amp; Material Movement Authorization
              </span>
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="border border-slate-200 rounded p-2.5 bg-slate-50">
                  <span className="text-[9px] font-bold uppercase text-slate-500 block">1. Prepared By</span>
                  <span className="text-xs font-semibold text-slate-900 block mt-1">{authorName}</span>
                  <div className="mt-4 pt-1 border-t border-dotted border-slate-300 text-[8px] text-slate-400">
                    Sign &amp; Date
                  </div>
                </div>
                <div className="border border-slate-200 rounded p-2.5 bg-slate-50">
                  <span className="text-[9px] font-bold uppercase text-slate-500 block">2. Fabric Store</span>
                  <span className="text-[10px] text-slate-600 block mt-1">Rolls Issued</span>
                  <div className="mt-4 pt-1 border-t border-dotted border-slate-300 text-[8px] text-slate-400">
                    Sign &amp; Date
                  </div>
                </div>
                <div className="border border-slate-200 rounded p-2.5 bg-slate-50">
                  <span className="text-[9px] font-bold uppercase text-slate-500 block">3. Floor Master</span>
                  <span className="text-[10px] text-slate-600 block mt-1">Embroidery Received</span>
                  <div className="mt-4 pt-1 border-t border-dotted border-slate-300 text-[8px] text-slate-400">
                    Sign &amp; Date
                  </div>
                </div>
                <div className="border border-slate-200 rounded p-2.5 bg-slate-50">
                  <span className="text-[9px] font-bold uppercase text-slate-500 block">4. QA / Manager</span>
                  <span className="text-[10px] text-slate-600 block mt-1">Final Approval</span>
                  <div className="mt-4 pt-1 border-t border-dotted border-slate-300 text-[8px] text-slate-400">
                    Sign &amp; Date
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50 text-xs">
          <span className="text-slate-500">
            Shubham Fabrics India Pvt. Ltd. &middot; Official Production Traveler Document
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => printProductionSheet(program)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print A4 Sheet</span>
            </button>
            <button
              onClick={() => downloadProductionSheetHtml(program)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#163767] hover:bg-[#0F264A] text-white rounded-md font-semibold transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download File (.html / PDF)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
