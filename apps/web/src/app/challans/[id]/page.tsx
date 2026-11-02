'use client';

import React, { useState, useEffect } from 'react';
import { inchargeNameOf, userChallanRemarks } from '@/lib/challan-remarks.mjs';
import { departmentName } from '@/lib/workflow-views';
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
  FileText,
  Download,
  Barcode as BarcodeIcon,
  Tag,
  Eye
} from 'lucide-react';
import { DocumentActionButtons } from '@/components/common/DocumentActionButtons';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';
import { 
  downloadProductionSheetHtml, 
  printProductionSheet 
} from '@/lib/download-production-sheet';
import { api } from '@/lib/api';
import { 
  getCurrentUser, 
  isAdminUser, 
  isDyeingUser, 
  isFabricStoreUser, 
  isQc1User, 
  isEmbroideryUser,
  isThreadCuttingUser
} from '@/lib/rbac';
import BarcodeStickerCard from '@/components/BarcodeStickerCard';
import { 
  BarcodeStickerParams, 
  downloadBarcodeStickerPng,
  downloadBarcodePng,
  downloadBarcodeStickerSvg, 
  printBarcodeSticker,
  generateCode128SvgBars 
} from '@/lib/barcode';
import { averageText, challanTotalsByUnit, formatTotals, isProgrammingToRecutting, unitOf, unitQuantityText, widthText } from '@/lib/challan-units.mjs';
import { distinct, lineSheetId, sheetBreakdown, sheetLabel } from '@/lib/challan-sheets.mjs';
import { 
  downloadChallanHtml, 
  printChallan 
} from '@/lib/download-challan';
import { FinishedGarmentList, useGarmentImages } from '@/components/workflow/FinishedGarments';
import { isFinishedGoodsChallan } from '@/lib/finished-garments.mjs';
import { EditChallanDialog } from '@/components/challan/EditChallanDialog';
import { Pencil } from 'lucide-react';

export default function ChallanDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [challan, setChallan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [downloadingBarcode, setDownloadingBarcode] = useState(false);
  const [showSheetModal, setShowSheetModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Finished garments (Finishing onward) are shown by name and image only, without colour or quantity.
  const finishedGoods = isFinishedGoodsChallan(challan);
  // Garment images of every sheet on the challan.
  const { images: garmentImages } = useGarmentImages(finishedGoods ? distinct([challan?.programId, ...(challan?.items || []).map((i: any) => lineSheetId(i, challan))]) : []);

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  const handleBack = () => {
    if (typeof window !== 'undefined') {
      const activeDept = sessionStorage.getItem('active_department');
      const activeRoot = sessionStorage.getItem('active_department_root');
      if (activeDept === 'EMBROIDERY') {
        router.push('/embroidery');
        return;
      }
      if (activeDept === 'THREAD_CUTTING') {
        router.push('/thread-cutting/my-work');
        return;
      }
      if (activeDept === 'DYEING') {
        router.push('/dyeing/my-work');
        return;
      }
      if (activeDept === 'FABRIC_STORE') {
        router.push('/fabric-store/my-work/incoming-challans');
        return;
      }
      if (activeDept === 'QC1') {
        router.push('/qc1/my-work');
        return;
      }
      if (activeDept === 'PROGRAMMING') {
        router.push('/programming');
        return;
      }
      if (activeRoot) {
        router.push(activeRoot);
        return;
      }
    }

    if (challan) {
      if (challan.fromDepartment === 'EMBROIDERY' || challan.toDepartment === 'EMBROIDERY') {
        router.push('/embroidery');
        return;
      }
      if (challan.fromDepartment === 'THREAD_CUTTING' || challan.toDepartment === 'THREAD_CUTTING') {
        router.push('/thread-cutting/my-work');
        return;
      }
      if (challan.fromDepartment === 'DYEING' || challan.toDepartment === 'DYEING') {
        router.push('/dyeing/my-work');
        return;
      }
      if (challan.fromDepartment === 'STORE' || challan.toDepartment === 'STORE') {
        router.push('/fabric-store');
        return;
      }
      if (challan.fromDepartment === 'QC1' || challan.toDepartment === 'QC1') {
        router.push('/qc1/my-work');
        return;
      }
    }

    if (isEmbroideryUser(user)) { router.push('/embroidery'); return; }
    if (isThreadCuttingUser(user)) { router.push('/thread-cutting/my-work'); return; }
    if (isDyeingUser(user)) { router.push('/dyeing/my-work'); return; }
    if (isFabricStoreUser(user)) { router.push('/fabric-store/my-work/incoming-challans'); return; }
    if (isQc1User(user)) { router.push('/qc1/my-work'); return; }

    router.push('/login');
  };

  const isProgUser = user?.departmentCode === 'PROGRAMMING';
  const paddingClass = isProgUser ? 'pl-0 md:pl-64' : 'pl-0';

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
      <div className={`min-h-screen bg-neutral-50 ${paddingClass} flex items-center justify-center`}>
        <div className="text-xs text-neutral-500 font-mono animate-pulse">
          Loading Challan Document...
        </div>
      </div>
    );
  }

  if (error || !challan) {
    return (
      <div className={`min-h-screen bg-neutral-50 ${paddingClass} p-4 sm:p-8`}>
        <div className="max-w-xl mx-auto p-6 bg-danger-50 border border-danger-200 rounded-xl text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-danger-600 mx-auto" />
          <h2 className="text-sm font-bold text-danger-900">Error Loading Challan</h2>
          <p className="text-xs text-danger-700">{error || 'Challan not found'}</p>
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-danger-800 text-white rounded text-xs font-semibold cursor-pointer"
          >
            ← Return to Station
          </button>
        </div>
      </div>
    );
  }

  // PRODUCTION SHEET DESIGN NUMBER (Mandatory on Barcode as per business rule)
  const designNumber = 
    challan?.program?.designNumber || 
    challan?.program?.designName || 
    challan?.program?.wilcomDesignNumber || 
    challan?.program?.embroideryDesign || 
    challan?.program?.mainStyle || 
    'STANDARD DESIGN';

  const deptLabels: Record<string, string> = {
    STORE: 'FABRIC STORE',
    FABRIC_STORE: 'FABRIC STORE',
    DYEING: 'DYEING',
    QC1: 'DYEING QC',
    EMBROIDERY: 'EMBROIDERY',
    THREAD_CUTTING: 'THREAD CUTTING',
    CUTTING: 'CUTTING',
    QC2: 'THREADCUT QC',
    QC3: 'WASHING QC',
    FINISHING: 'FINISHING',
    INVENTORY: 'INVENTORY',
    PACKING: 'INVENTORY'
  };

  const deptDisplay = challan ? (deptLabels[challan.fromDepartment] || challan.fromDepartment || 'PRODUCTION') : 'PRODUCTION';

  // Each line keeps its unit: totals are per unit, never MTR + PCS.
  const unitTotals: Record<string, number> = challan ? challanTotalsByUnit(challan) : {};
  const totalUnits = Object.keys(unitTotals);
  const singleUnit = totalUnits.length === 1 ? totalUnits[0] : null;
  const totalQtyText = singleUnit ? String(unitTotals[singleUnit]) : formatTotals(unitTotals);

  const barcodeStickerParams: BarcodeStickerParams | null = challan ? {
    challanNumber: challan.challanNumber,
    designNumber: designNumber,
    departmentName: deptDisplay,
    fromDepartment: challan.fromDepartment,
    toDepartment: challan.toDepartment,
    programSerialNo: challan.program?.programSerialNo || challan.program?.programNumber || '—',
    clientName: challan.program?.clientName || challan.program?.buyerName || 'Standard Client',
    mainStyle: challan.program?.mainStyle || challan.program?.styleCode || '—',
    totalQuantity: totalQtyText,
    uom: singleUnit || '',
    date: challan.createdAt ? new Date(challan.createdAt).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN')
  } : null;

  // Only the barcode (bars + challan number), not the full sticker.
  const handleDownloadBarcodePng = async () => {
    if (!challan?.challanNumber) return;
    try {
      setDownloadingBarcode(true);
      await downloadBarcodePng(challan.challanNumber, `barcode-${String(challan.challanNumber).replace(/[^a-zA-Z0-9_-]/g, '_')}.png`);
    } catch (e) {
      console.error('Failed to download barcode PNG:', e);
    } finally {
      setDownloadingBarcode(false);
    }
  };

  const handlePrintBarcodeSticker = () => {
    if (!barcodeStickerParams) return;
    printBarcodeSticker(barcodeStickerParams);
  };


  const issuedOn = challan.issuedDate || challan.createdAt;
  const fromName = departmentName(challan.fromDepartment);
  const toName = departmentName(challan.toDepartment);
  const defectQty = Number(challan.defectivePieces) || 0;
  const defectUnit = unitOf(challan.defectiveUnit) || unitOf(challan.fabricUnit) || '';
  const items: any[] = challan.items || [];
  // Store → Dyeing lines carry the colour Dyeing must achieve next to the current (base) colour.
  const hasDyeColour = items.some((i: any) => String(i.requiredColour || '').trim());
  // Programming to Recutting: Size | Average | Unit | Remarks, each of the first three a quantity with its own unit;
  // later challans: Size | Unit (of the Size) | Average | Remarks.
  const toRecuttingLayout = isProgrammingToRecutting(challan.fromDepartment);
  const { svgBars, totalWidth: barW, totalHeight: barH } = generateCode128SvgBars(challan.challanNumber, 1.4, 30);
  const sheetFields = [
    { label: 'Design No.', value: designNumber },
    { label: 'Serial No.', value: challan.program?.programSerialNo || challan.program?.programNumber },
    // The issuing department's incharge (the account that issued the challan), not the client.
    { label: 'Incharge', value: inchargeNameOf(challan) || challan.issuedBy?.username },
  ];

  return (
    <div className={`min-h-screen bg-neutral-100 ${paddingClass} pb-20`}>
      {/* TOP BAR: back and actions (never printed) */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-30 print:hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-neutral-50 text-neutral-800 text-xs font-semibold rounded-md ring-1 ring-neutral-300 transition cursor-pointer"
              title="Correct this challan"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadBarcodePng}
              disabled={downloadingBarcode}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-neutral-50 text-neutral-800 text-xs font-semibold rounded-md ring-1 ring-neutral-300 transition cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloadingBarcode ? 'Downloading…' : 'Download Barcode'}</span>
            </button>
            {barcodeStickerParams && (
              <button
                type="button"
                onClick={handlePrintBarcodeSticker}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-neutral-50 text-neutral-800 text-xs font-semibold rounded-md ring-1 ring-neutral-300 transition cursor-pointer"
              >
                <BarcodeIcon className="w-3.5 h-3.5" />
                <span>Print Sticker</span>
              </button>
            )}
            <DocumentActionButtons challan={challan} program={challan.program} size="sm" />
          </div>
        </div>
      </header>

      {/* PRINT STYLES */}
      <style jsx global>{`
        @media print {
          header, aside, nav, .print\\:hidden {
            display: none !important;
          }
          body, main {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>

      {/* THE CHALLAN */}
      <main className="p-4 sm:p-8 max-w-4xl mx-auto">
        <article className="bg-white rounded-2xl ring-1 ring-neutral-200 shadow-sm p-6 sm:p-10 space-y-8">
          {/* Heading */}
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-neutral-500">SHUBHAM FABRICS INDIA PVT. LTD.</p>
              <h1 className="mt-1 text-3xl font-bold text-neutral-900">Challan</h1>
            </div>
            <div className="text-right shrink-0">
              <svg viewBox={`0 0 ${barW} ${barH}`} className="h-9 w-auto max-w-[170px] ml-auto" aria-hidden="true">
                <g dangerouslySetInnerHTML={{ __html: svgBars }} />
              </svg>
              <p className="mt-1.5 text-lg font-bold font-mono text-neutral-900">{challan.challanNumber}</p>
              <p className="text-sm text-neutral-500">
                {issuedOn ? new Date(issuedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
              </p>
            </div>
          </div>

          {/* From → To */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-xl bg-neutral-50 ring-1 ring-neutral-200 px-5 py-4">
            <div>
              <p className="text-xs font-medium text-neutral-500">From</p>
              <p className="text-base font-semibold text-neutral-900">{fromName}</p>
            </div>
            <Send className="w-5 h-5 text-brand-600" aria-hidden="true" />
            <div className="text-right">
              <p className="text-xs font-medium text-neutral-500">To</p>
              <p className="text-base font-semibold text-neutral-900">{toName}</p>
            </div>
          </div>

          {/* Production sheet */}
          {challan.program && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-neutral-900">Production Sheet</h2>
                <button
                  type="button"
                  onClick={() => setShowSheetModal(true)}
                  className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900 print:hidden cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View</span>
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 rounded-xl ring-1 ring-neutral-200 overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-neutral-200">
                {sheetFields.map((field) => (
                  <div key={field.label} className="px-4 py-3 min-w-0">
                    <p className="text-xs font-medium text-neutral-500">{field.label}</p>
                    <p className="mt-0.5 text-sm font-semibold text-neutral-900 truncate">{field.value || '—'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Items */}
          {finishedGoods ? (
            <div>
              <h2 className="text-sm font-semibold text-neutral-900 mb-2">Garments</h2>
              <div className="rounded-xl ring-1 ring-neutral-200 bg-neutral-50/60">
                <FinishedGarmentList items={items} programId={challan.programId} images={garmentImages} />
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-sm font-semibold text-neutral-900 mb-2">Items</h2>
              <div className="rounded-xl ring-1 ring-neutral-200 overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[560px]">
                  <thead className="bg-neutral-50 text-xs font-medium text-neutral-500">
                    <tr>
                      <th className="py-2.5 pl-4 pr-3 font-medium">Production Sheet</th>
                      <th className="py-2.5 px-3 font-medium">Fabric</th>
                      <th className="py-2.5 px-3 font-medium">{hasDyeColour ? 'Base Colour' : 'Colour'}</th>
                      {hasDyeColour && <th className="py-2.5 px-3 font-medium">Dye Colour</th>}
                      <th className="py-2.5 px-3 font-medium">Shade</th>
                      <th className="py-2.5 px-3 font-medium text-right">Size</th>
                      {toRecuttingLayout && <th className="py-2.5 px-3 font-medium text-right">Average</th>}
                      <th className="py-2.5 px-3 font-medium">Unit</th>
                      {!toRecuttingLayout && <th className="py-2.5 px-3 font-medium text-right">Average</th>}
                      <th className="py-2.5 px-3 font-medium">Width</th>
                      <th className="py-2.5 px-3 font-medium">Source Challan</th>
                      <th className="py-2.5 pl-3 pr-4 font-medium">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-neutral-900">
                    {items.map((item: any, idx: number) => (
                      <tr key={item.id || idx}>
                        <td className="py-3 pl-4 pr-3 font-mono text-xs font-semibold whitespace-nowrap">
                          {sheetLabel(item.program || (lineSheetId(item, challan) === challan.programId ? challan.program : null))}
                        </td>
                        <td className="py-3 px-3 font-medium">{item.fabricCode || item.itemDescription || '—'}</td>
                        <td className="py-3 px-3">{item.colour || '—'}</td>
                        {hasDyeColour && <td className="py-3 px-3 font-semibold text-brand-800">{item.requiredColour || '—'}</td>}
                        <td className="py-3 px-3">{item.shade || '—'}</td>
                        <td className="py-3 px-3 text-right tabular-nums font-semibold whitespace-nowrap">{item.quantity}{toRecuttingLayout && item.uom ? ` ${item.uom}` : ''}</td>
                        {toRecuttingLayout && <td className="py-3 px-3 text-right tabular-nums">{averageText(item)}</td>}
                        <td className="py-3 px-3 whitespace-nowrap">{toRecuttingLayout ? unitQuantityText(item) : item.uom || '—'}</td>
                        {!toRecuttingLayout && <td className="py-3 px-3 text-right tabular-nums">{averageText(item)}</td>}
                        <td className="py-3 px-3 whitespace-nowrap font-medium">{widthText(item)}</td>
                        <td className="py-3 px-3 font-mono text-xs whitespace-nowrap">
                          {item.sourceChallanItem?.challan ? (
                            <Link href={`/challans/${item.sourceChallanItem.challan.id}`} className="text-brand-700 hover:underline">
                              {item.sourceChallanItem.challan.challanNumber}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3 pl-3 pr-4 text-neutral-600">
                          {[item.rollNumber ? `Roll ${item.rollNumber}` : null, userChallanRemarks(item.remarks)].filter(Boolean).join(' · ') || '—'}
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr>
                        <td colSpan={hasDyeColour ? 11 : 10} className="py-6 text-center text-neutral-500">No items on this challan.</td>
                      </tr>
                    )}
                    {/* A challan carrying several Production Sheets: each sheet's total */}
                    {sheetBreakdown(challan).multiSheet &&
                      sheetBreakdown(challan).sheets.map((s: any) => (
                        <tr key={s.programId || 'none'} className="bg-neutral-50/70">
                          <td colSpan={3} className="py-2 pl-4 pr-3 text-xs font-semibold text-neutral-600">
                            Sheet {sheetLabel(s.program)} ({s.lines.length} line{s.lines.length === 1 ? '' : 's'})
                          </td>
                          <td colSpan={hasDyeColour ? 8 : 7} className="py-2 px-3 text-xs font-semibold tabular-nums">{formatTotals(s.totals)}</td>
                        </tr>
                      ))}
                  </tbody>
                  {items.length > 0 && (
                    <tfoot className="bg-neutral-50 border-t border-neutral-200 text-neutral-900">
                      <tr>
                        <td colSpan={3} className="py-3 pl-4 pr-3 text-sm font-semibold">Total</td>
                        <td colSpan={hasDyeColour ? 8 : 7} className="py-3 px-3 text-sm font-bold tabular-nums">
                          {formatTotals(unitTotals)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              {defectQty > 0 && (
                <p className="mt-3 text-sm text-danger-700">
                  Defective: <strong>{defectQty} {defectUnit}</strong>
                  {challan.defectReason ? ` — ${challan.defectReason}` : ''}
                </p>
              )}
            </div>
          )}

          {userChallanRemarks(challan.remarks) && (
            <div>
              <h2 className="text-sm font-semibold text-neutral-900 mb-1">Remarks</h2>
              <p className="text-sm text-neutral-700">{userChallanRemarks(challan.remarks)}</p>
            </div>
          )}

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-10 pt-10">
            {[
              { label: 'Issued by', dept: fromName },
              { label: 'Received by', dept: toName },
            ].map((sign) => (
              <div key={sign.label} className="border-t border-neutral-300 pt-2 text-center">
                <p className="text-sm font-semibold text-neutral-900">{sign.label}</p>
                <p className="text-xs text-neutral-500">{sign.dept}</p>
              </div>
            ))}
          </div>
        </article>
      </main>

      {notice && (
        <div className="fixed bottom-4 right-4 z-40 px-4 py-3 bg-white border border-accent-300 rounded-xl shadow-lg text-sm text-neutral-900 print:hidden" role="status">
          {notice}
          <button type="button" onClick={() => setNotice(null)} className="ml-3 text-xs font-semibold opacity-70 hover:opacity-100">Close</button>
        </div>
      )}
      {editing && (
        <EditChallanDialog
          challan={challan}
          onClose={() => setEditing(false)}
          onSaved={(message) => {
            setEditing(false);
            setNotice(message);
            loadChallan();
          }}
        />
      )}

      {/* PRODUCTION SHEET PREVIEW */}
      {challan?.program && (
        <ProductionSheetPrintModal
          program={challan.program}
          isOpen={showSheetModal}
          onClose={() => setShowSheetModal(false)}
        />
      )}
    </div>
  );
}
