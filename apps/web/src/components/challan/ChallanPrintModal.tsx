'use client';

import React from 'react';
import { 
  Printer, 
  Download, 
  X, 
  FileText, 
  Sparkles
} from 'lucide-react';
import { 
  downloadChallanHtml, 
  printChallan,
  ChallanItem
} from '@/lib/download-challan';
import { generateCode128SvgBars } from '@/lib/barcode';
import { getCurrentUser, canViewClientCode } from '@/lib/rbac';
import { extractRootWilcomPhoto } from '@/lib/download-wilcom';
import { useProgramDocument } from '@/hooks/useProgramDocument';
import { FinishedGarmentList, useGarmentImages } from '@/components/workflow/FinishedGarments';
import { isFinishedGoodsChallan } from '@/lib/finished-garments.mjs';

interface ChallanPrintModalProps {
  challan: any;
  isOpen: boolean;
  onClose: () => void;
  onViewSheet?: () => void;
  onViewWilcom?: () => void;
}

export function ChallanPrintModal({
  challan: sourceChallan,
  isOpen,
  onClose,
  onViewSheet,
  onViewWilcom,
}: ChallanPrintModalProps) {
  const sourceProgram = sourceChallan?.program || (sourceChallan?.programId ? { id: sourceChallan.programId } : undefined);
  const { program, loading, error } = useProgramDocument(sourceProgram, isOpen);
  const challan = sourceChallan ? { ...sourceChallan, program: program || sourceProgram } : null;
  // Finished garments (Finishing onward): name and image only, sent with the Production Sheet.
  const finishedGoods = isFinishedGoodsChallan(sourceChallan);
  const { images: garmentImages } = useGarmentImages(isOpen && finishedGoods ? [sourceChallan?.programId || sourceProgram?.id] : []);
  if (!isOpen || !challan) return null;

  const currentUser = typeof window !== 'undefined' ? getCurrentUser() : null;
  const canSeeClientCode = canViewClientCode(currentUser);

  const challanNo = challan.challanNumber || 'CH-0000';
  const fromDept = challan.fromDepartment || 'FABRIC_STORE';
  const toDept = challan.toDepartment || 'DYEING';
  const status = challan.status || 'ISSUED';
  const priority = challan.priority || 'NORMAL';
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
  const clientName = prog.clientName || prog.buyerName || '';
  const clientCode = prog.clientCode;
  const styleCode = prog.mainStyle || prog.styleCode || '—';
  const pattern = prog.pattern || '';
  const fabricName = prog.fabricName || '—';
  const artworkPhoto = extractRootWilcomPhoto(prog);

  // Department labels
  const deptLabels: Record<string, string> = {
    STORE: 'FABRIC STORE',
    FABRIC_STORE: 'FABRIC STORE',
    DYEING: 'DYEING DEPARTMENT',
    QC1: 'QC1 (QUALITY CHECK 1)',
    EMBROIDERY: 'EMBROIDERY DEPARTMENT',
    THREAD_CUTTING: 'THREAD CUTTING DEPARTMENT',
    CUTTING: 'CUTTING DEPARTMENT',
    RECUTTING: 'RECUTTING DEPARTMENT',
    STITCHING: 'STITCHING DEPARTMENT',
    QC2: 'THREADCUT QC',
    WASHING: 'WASHING DEPARTMENT',
    QCWASHING: 'WASHING QC',
    QC3: 'WASHING QC',
    FINISHING: 'FINISHING DEPARTMENT',
    STEAM_PRESS: 'STEAM PRESS DEPARTMENT',
    FINAL_CHECK: 'FINAL QC',
    INVENTORY: 'INVENTORY',
    PACKING: 'PACKING & DISPATCH',
    PROGRAMMING: 'PROGRAMMING & PLANNING'
  };

  const fromLabel = deptLabels[fromDept] || fromDept;
  const toLabel = deptLabels[toDept] || toDept;

  const items: ChallanItem[] = Array.isArray(challan.items) ? challan.items : [];
  const totalQuantity = items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  const uom = items[0]?.uom || 'PCS';

  const defectivePieces = challan.defectivePieces ?? 0;
  const fabricUnit = challan.fabricUnit || uom;
  const defectiveShelf = challan.defectiveShelfLocation || 'Station Defective Shelf';
  const defectReason = challan.defectReason || '';

  // Barcode SVG
  const { svgBars, totalWidth: barW, totalHeight: barH } = generateCode128SvgBars(challanNo, 1.6, 40);

  const issuerName = challan.issuedBy?.fullName || challan.createdBy?.fullName || challan.createdBy?.username || 'Department Incharge';

  const handlePrint = () => {
    printChallan(challan);
  };

  const handleDownload = () => {
    void downloadChallanHtml(challan);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-neutral-200 w-full max-w-4xl max-h-[96vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* MODAL HEADER */}
        <div className="px-5 py-3 border-b border-neutral-200 flex items-center justify-between bg-neutral-50 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent-100 text-accent-800 rounded-lg">
              <FileText className="w-5 h-5 text-accent-800" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-700">
                Department Transfer Challan Form
              </div>
              <h2 className="text-base font-bold text-neutral-900 font-mono">
                {challanNo} &middot; {fromDept} &rarr; {toDept}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onViewSheet && (
              <button
                type="button"
                onClick={onViewSheet}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-800 rounded-lg text-xs font-bold border border-brand-200 transition cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-brand-700" />
                <span>View Sheet</span>
              </button>
            )}
            {onViewWilcom && (
              <button
                type="button"
                onClick={onViewWilcom}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-800 rounded-lg text-xs font-bold border border-brand-200 transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-brand-700" />
                <span>View Wilcom Sheet</span>
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer disabled:cursor-wait"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Challan</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer disabled:cursor-wait"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Challan</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-neutral-500 hover:text-neutral-600 rounded-lg hover:bg-neutral-200/60 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {(loading || error) && (
          <div className={`px-5 py-2 text-xs ${error ? 'bg-danger-50 text-danger-800' : 'bg-brand-50 text-brand-800'}`}>
            {error || 'Loading complete production and artwork details…'}
          </div>
        )}

        {/* MODAL BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto bg-neutral-100 flex-1">
          <div className="max-w-[760px] mx-auto bg-white p-6 sm:p-8 rounded shadow-sm border-2 border-neutral-200 text-neutral-900 font-sans space-y-3">
            
            {/* Header: Company Title, Transfer Challan, and Code-128 SVG Barcode */}
            <div className="flex items-start justify-between border-b-2 border-neutral-200 pb-3 gap-4">
              <div>
                <div className="text-[11px] font-black tracking-wider uppercase text-neutral-900">
                  SHUBHAM FABRICS INDIA PVT. LTD.
                </div>
                <h1 className="text-lg font-black tracking-widest uppercase text-neutral-900 mt-0.5">
                  DEPARTMENT TRANSFER CHALLAN
                </h1>
                <div className="inline-block mt-1 px-2 py-0.5 bg-neutral-100 border border-neutral-300 text-[10px] font-bold font-mono rounded text-neutral-900">
                  {fromLabel} &rarr; {toLabel}
                </div>
              </div>

              {/* Barcode Block */}
              <div className="flex flex-col items-end text-right">
                <div className="bg-white p-1 border border-neutral-300 rounded mb-1">
                  <svg
                    viewBox={`0 0 ${barW} ${barH}`}
                    width="150"
                    height="36"
                    dangerouslySetInnerHTML={{ __html: svgBars }}
                  />
                </div>
                <div className="font-mono text-xs font-black tracking-wider text-neutral-900">{challanNo}</div>
                <div className="text-[10px] font-bold text-neutral-600">DESIGN: {designNo}</div>
              </div>
            </div>

            {/* Metadata Grid (Only Actual Filled Details) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-[1.5px] border-neutral-200 p-2.5 bg-neutral-50 text-xs">
              <div>
                <span className="text-[9px] font-black text-neutral-500 uppercase block">CHALLAN NO</span>
                <span className="font-mono font-bold text-neutral-900">{challanNo}</span>
              </div>
              <div>
                <span className="text-[9px] font-black text-neutral-500 uppercase block">DISPATCH DATE</span>
                <span className="font-bold text-neutral-900">{dateStr}</span>
              </div>
              <div>
                <span className="text-[9px] font-black text-neutral-500 uppercase block">FROM STATION</span>
                <span className="font-bold text-neutral-900">{fromLabel}</span>
              </div>
              <div>
                <span className="text-[9px] font-black text-neutral-500 uppercase block">TO STATION</span>
                <span className="font-bold text-neutral-900">{toLabel}</span>
              </div>
            </div>

            {/* Production Order Details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-[1.5px] border-neutral-200 p-2.5 bg-white text-xs">
              <div>
                <span className="text-[9px] font-black text-neutral-500 uppercase block">PRODUCTION SHEET #</span>
                <span className="font-mono font-bold text-neutral-900">{programSerial}</span>
              </div>
              <div>
                <span className="text-[9px] font-black text-neutral-500 uppercase block">DESIGN NO</span>
                <span className="font-mono font-bold text-neutral-900">{designNo}</span>
              </div>
              <div>
                <span className="text-[9px] font-black text-neutral-500 uppercase block">STYLE / PATTERN</span>
                <span className="font-bold text-neutral-900">{styleCode}{pattern && pattern !== '—' ? ` (${pattern})` : ''}</span>
              </div>
              <div>
                <span className="text-[9px] font-black text-neutral-500 uppercase block">FABRIC</span>
                <span className="font-bold text-neutral-900">{fabricName}</span>
              </div>
            </div>

            {artworkPhoto && (
              <div className="border-[1.5px] border-neutral-200 p-2.5 bg-white">
                <div className="text-[9px] font-black text-neutral-500 uppercase mb-2">Wilcom Artwork Reference</div>
                <img src={artworkPhoto} alt={`Wilcom artwork for design ${designNo}`} className="max-h-40 max-w-full object-contain" />
              </div>
            )}

            {/* Client / Status if present */}
            {clientName && clientName !== 'Standard Client' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-[1.5px] border-neutral-200 p-2.5 bg-neutral-50 text-xs">
                <div className="col-span-2">
                  <span className="text-[9px] font-black text-neutral-500 uppercase block">BUYER / CLIENT</span>
                  <span className="font-bold text-neutral-900">
                    {clientName}
                    {canSeeClientCode && clientCode && (
                      <span className="ml-1 text-[10px] font-mono text-accent-800">({clientCode})</span>
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-black text-neutral-500 uppercase block">PRIORITY</span>
                  <span className="font-bold text-neutral-900">{priority}</span>
                </div>
                <div>
                  <span className="text-[9px] font-black text-neutral-500 uppercase block">STATUS</span>
                  <span className="font-bold text-neutral-900">{status}</span>
                </div>
              </div>
            )}

            {/* Defective cut alert only if defective pieces exist */}
            {defectivePieces > 0 && (
              <div className="border-[1.5px] border-danger-200 bg-danger-50 p-2 text-xs font-bold text-danger-900 rounded">
                DEFECTIVE CUT (TO SHELF): {defectivePieces} {fabricUnit} [Location: {defectiveShelf}]
                {defectReason ? ` &middot; Reason: ${defectReason}` : ''}
              </div>
            )}

            {/* Finished garments */}
            {finishedGoods && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-neutral-700">
                  <span>FINISHED GARMENTS</span>
                  <span className="normal-case font-semibold">Production Sheet {programSerial} is printed with this challan</span>
                </div>
                <div className="border-[1.5px] border-neutral-200 rounded">
                  <FinishedGarmentList items={items} programId={challan.programId || prog.id} images={garmentImages} />
                </div>
              </div>
            )}

            {/* Items Table */}
            {!finishedGoods && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-neutral-700">
                <span>ITEMS / MATERIALS</span>
                <span className="font-mono text-xs text-neutral-900">
                  Total: {totalQuantity || challan.fabricOut || challan.fabricIn || 0} {uom}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border-[1.5px] border-neutral-200 text-xs text-left">
                  <thead>
                    <tr className="bg-neutral-100">
                      <th className="border-[1.5px] border-neutral-200 p-1.5 font-black text-center w-8">#</th>
                      <th className="border-[1.5px] border-neutral-200 p-1.5 font-black">ITEM DESCRIPTION</th>
                      <th className="border-[1.5px] border-neutral-200 p-1.5 font-black w-28">COLOR / SHADE</th>
                      <th className="border-[1.5px] border-neutral-200 p-1.5 font-black w-24">ROLL / LOT #</th>
                      <th className="border-[1.5px] border-neutral-200 p-1.5 font-black text-right w-20">QUANTITY</th>
                      <th className="border-[1.5px] border-neutral-200 p-1.5 font-black text-center w-14">UOM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length > 0 ? (
                      items.map((it, idx) => (
                        <tr key={it.id || idx}>
                          <td className="border-[1.5px] border-neutral-200 p-1 text-center font-bold font-mono">{idx + 1}</td>
                          <td className="border-[1.5px] border-neutral-200 p-1 font-bold">{it.itemDescription || fabricName || styleCode || 'Fabric Lot'}</td>
                          <td className="border-[1.5px] border-neutral-200 p-1">{it.colour || prog.fabricColor || 'Standard'}</td>
                          <td className="border-[1.5px] border-neutral-200 p-1 font-mono">{it.rollNumber || it.lotNumber || '—'}</td>
                          <td className="border-[1.5px] border-neutral-200 p-1 text-right font-mono font-bold">{it.quantity || 0}</td>
                          <td className="border-[1.5px] border-neutral-200 p-1 text-center">{it.uom || uom}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="border-[1.5px] border-neutral-200 p-1 text-center font-mono">1</td>
                        <td className="border-[1.5px] border-neutral-200 p-1 font-bold">{fabricName || styleCode || 'Production Material'}</td>
                        <td className="border-[1.5px] border-neutral-200 p-1">{prog.fabricColor || 'Standard'}</td>
                        <td className="border-[1.5px] border-neutral-200 p-1 font-mono">—</td>
                        <td className="border-[1.5px] border-neutral-200 p-1 text-right font-mono font-bold">{totalQuantity || challan.fabricOut || challan.fabricIn || 0}</td>
                        <td className="border-[1.5px] border-neutral-200 p-1 text-center">{uom}</td>
                      </tr>
                    )}
                    <tr className="bg-neutral-50 font-black">
                      <td colSpan={4} className="border-[1.5px] border-neutral-200 p-1 text-right text-[10px] uppercase font-black">
                        TOTAL QUANTITY:
                      </td>
                      <td className="border-[1.5px] border-neutral-200 p-1 text-right font-mono text-sm font-black">
                        {totalQuantity || challan.fabricOut || challan.fabricIn || 0}
                      </td>
                      <td className="border-[1.5px] border-neutral-200 p-1 text-center font-black">{uom}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            )}


            {/* Dual Custody Signatures Bar */}
            <div className="grid grid-cols-2 gap-8 pt-8 border-t border-neutral-200 text-xs">
              <div className="text-center space-y-4">
                <div className="border-b border-neutral-200 w-3/4 mx-auto pb-1" />
                <div>
                  <span className="font-black uppercase tracking-wider block text-[10px] text-neutral-900">
                    DISPATCHED BY
                  </span>
                  <span className="text-[10px] text-neutral-600 block">{issuerName} ({fromLabel})</span>
                </div>
              </div>
              <div className="text-center space-y-4">
                <div className="border-b border-neutral-200 w-3/4 mx-auto pb-1" />
                <div>
                  <span className="font-black uppercase tracking-wider block text-[10px] text-neutral-900">
                    RECEIVED BY
                  </span>
                  <span className="text-[10px] text-neutral-600 block">Station Incharge ({toLabel})</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-2 border-t border-neutral-200 flex justify-between text-[9px] font-mono text-neutral-500">
              <span>SHUBHAM FABRICS INDIA PVT. LTD.</span>
              <span>CHALLAN NO: {challanNo}</span>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
