'use client';

import React from 'react';
import { inchargeNameOf, userChallanRemarks } from '@/lib/challan-remarks.mjs';
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
import { downloadBarcodePng, generateCode128SvgBars } from '@/lib/barcode';
import { getCurrentUser, canViewClientCode } from '@/lib/rbac';
import { extractRootWilcomPhoto } from '@/lib/download-wilcom';
import { departmentName } from '@/lib/workflow-views';
import { useProgramDocument } from '@/hooks/useProgramDocument';
import { FinishedGarmentList, useGarmentImages } from '@/components/workflow/FinishedGarments';
import { isFinishedGoodsChallan } from '@/lib/finished-garments.mjs';
import { averageBeforeUnit, averageText, challanTotalsByUnit, formatTotals, unitOf } from '@/lib/challan-units.mjs';

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
    QC1: 'DYEING QC',
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
  // Store → Dyeing lines carry the colour Dyeing must achieve next to the current (base) colour.
  const hasDyeColour = items.some((i: any) => String(i.requiredColour || '').trim());
  // Programming to Recutting: Size | Average | Unit | Remarks; later challans: Size | Unit | Average | Remarks.
  const averageFirst = averageBeforeUnit(fromDept);
  // Each line keeps its unit: totals are per unit, never MTR + PCS.
  const unitTotals = challanTotalsByUnit(challan);
  const totalUnits = Object.keys(unitTotals);
  const singleUnit = totalUnits.length === 1 ? totalUnits[0] : null;
  const totalQtyText = singleUnit ? String(unitTotals[singleUnit]) : formatTotals(unitTotals);
  // Shown exactly as recorded; a challan with no recorded unit shows none rather than a guess.
  const uom = singleUnit || unitOf(challan.fabricUnit) || unitOf(items[0]?.uom) || '';
  const totalUnitLabel = singleUnit || '';

  const defectivePieces = challan.defectivePieces ?? 0;
  const fabricUnit = unitOf(challan.defectiveUnit) || unitOf(challan.fabricUnit) || '';
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
                Challan
              </div>
              <h2 className="text-base font-bold text-neutral-900 font-mono">
                {challanNo} &middot; {departmentName(fromDept)} &rarr; {departmentName(toDept)}
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
              onClick={() => void downloadBarcodePng(challanNo, `barcode-${String(challanNo).replace(/[^a-zA-Z0-9_-]/g, '_')}.png`)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-neutral-50 text-neutral-800 rounded-lg text-xs font-semibold ring-1 ring-neutral-300 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Barcode</span>
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

        {/* MODAL BODY: the challan, as it prints */}
        <div className="p-4 sm:p-6 overflow-y-auto bg-neutral-100 flex-1">
          <div className="max-w-[760px] mx-auto bg-white p-6 sm:p-9 rounded-xl ring-1 ring-neutral-200 text-neutral-900 space-y-7">
            {/* Heading */}
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-xs font-semibold tracking-[0.18em] text-neutral-500">SHUBHAM FABRICS INDIA PVT. LTD.</p>
                <h1 className="mt-1 text-3xl font-bold">Challan</h1>
              </div>
              <div className="text-right shrink-0">
                <svg viewBox={`0 0 ${barW} ${barH}`} width="160" height="38" className="ml-auto" dangerouslySetInnerHTML={{ __html: svgBars }} />
                <p className="mt-1.5 text-lg font-bold font-mono">{challanNo}</p>
                <p className="text-sm text-neutral-500">{dateStr}</p>
              </div>
            </div>

            {/* From → To */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-xl bg-neutral-50 ring-1 ring-neutral-200 px-5 py-4">
              <div>
                <p className="text-xs font-medium text-neutral-500">From</p>
                <p className="text-base font-semibold">{departmentName(fromDept)}</p>
              </div>
              <span className="text-lg text-brand-600" aria-hidden="true">&rarr;</span>
              <div className="text-right">
                <p className="text-xs font-medium text-neutral-500">To</p>
                <p className="text-base font-semibold">{departmentName(toDept)}</p>
              </div>
            </div>

            {/* Production sheet */}
            {challan.program && (
              <div>
                <h2 className="text-sm font-semibold mb-2">Production Sheet</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 rounded-xl ring-1 ring-neutral-200 overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-neutral-200">
                  {[
                    { label: 'Design No.', value: prog.designNumber || prog.designName || prog.mainStyle },
                    { label: 'Serial No.', value: programSerial },
                    { label: 'Incharge', value: inchargeNameOf(challan) || issuerName },
                  ].map((field) => (
                    <div key={field.label} className="px-4 py-3 min-w-0">
                      <p className="text-xs font-medium text-neutral-500">{field.label}</p>
                      <p className="mt-0.5 text-sm font-semibold truncate">{field.value || '—'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Items */}
            {finishedGoods ? (
              <div>
                <h2 className="text-sm font-semibold mb-2">Garments</h2>
                <div className="rounded-xl ring-1 ring-neutral-200">
                  <FinishedGarmentList items={items} programId={challan.programId || prog.id} images={garmentImages} />
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-sm font-semibold mb-2">Items</h2>
                <div className="rounded-xl ring-1 ring-neutral-200 overflow-x-auto">
                  <table className="w-full text-left text-sm min-w-[520px]">
                    <thead className="bg-neutral-50 text-xs text-neutral-500">
                      <tr>
                        <th className="py-2.5 pl-4 pr-3 font-medium">Fabric</th>
                        <th className="py-2.5 px-3 font-medium">{hasDyeColour ? 'Base Colour' : 'Colour'}</th>
                        {hasDyeColour && <th className="py-2.5 px-3 font-medium">Dye Colour</th>}
                        <th className="py-2.5 px-3 font-medium text-right">Size</th>
                        {averageFirst && <th className="py-2.5 px-3 font-medium text-right">Average</th>}
                        <th className="py-2.5 px-3 font-medium">Unit</th>
                        {!averageFirst && <th className="py-2.5 px-3 font-medium text-right">Average</th>}
                        <th className="py-2.5 pl-3 pr-4 font-medium">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {items.map((it: any, idx: number) => (
                        <tr key={it.id || idx}>
                          <td className="py-3 pl-4 pr-3 font-medium">{it.fabricCode || it.itemDescription || '—'}</td>
                          <td className="py-3 px-3">{it.colour || '—'}</td>
                          {hasDyeColour && <td className="py-3 px-3 font-semibold text-brand-800">{it.requiredColour || '—'}</td>}
                          <td className="py-3 px-3 text-right tabular-nums font-semibold">{it.quantity}</td>
                          {averageFirst && <td className="py-3 px-3 text-right tabular-nums">{averageText(it)}</td>}
                          <td className="py-3 px-3">{it.uom || '—'}</td>
                          {!averageFirst && <td className="py-3 px-3 text-right tabular-nums">{averageText(it)}</td>}
                          <td className="py-3 pl-3 pr-4 text-neutral-600">
                            {[it.rollNumber ? `Roll ${it.rollNumber}` : null, userChallanRemarks(it.remarks)].filter(Boolean).join(' · ') || '—'}
                          </td>
                        </tr>
                      ))}
                      {items.length === 0 && (
                        <tr>
                          <td colSpan={hasDyeColour ? 7 : 6} className="py-6 text-center text-neutral-500">No items on this challan.</td>
                        </tr>
                      )}
                    </tbody>
                    {items.length > 0 && (
                      <tfoot className="bg-neutral-50 border-t border-neutral-200">
                        <tr>
                          <td colSpan={2} className="py-3 pl-4 pr-3 font-semibold">Total</td>
                          <td colSpan={hasDyeColour ? 5 : 4} className="py-3 px-3 font-bold tabular-nums">{formatTotals(unitTotals)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
                {defectivePieces > 0 && (
                  <p className="mt-3 text-sm text-danger-700">
                    Defective: <strong>{defectivePieces} {fabricUnit}</strong>
                    {defectReason ? ` — ${defectReason}` : ''}
                  </p>
                )}
              </div>
            )}

            {userChallanRemarks(challan.remarks) && (
              <div>
                <h2 className="text-sm font-semibold mb-1">Remarks</h2>
                <p className="text-sm text-neutral-700">{userChallanRemarks(challan.remarks)}</p>
              </div>
            )}

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-10 pt-10">
              {[
                { label: 'Issued by', dept: departmentName(fromDept) },
                { label: 'Received by', dept: departmentName(toDept) },
              ].map((sign) => (
                <div key={sign.label} className="border-t border-neutral-300 pt-2 text-center">
                  <p className="text-sm font-semibold">{sign.label}</p>
                  <p className="text-xs text-neutral-500">{sign.dept}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
