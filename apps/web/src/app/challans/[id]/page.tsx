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
  downloadBarcodeStickerSvg, 
  printBarcodeSticker,
  generateCode128SvgBars 
} from '@/lib/barcode';
import { 
  downloadChallanHtml, 
  printChallan 
} from '@/lib/download-challan';

export default function ChallanDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [challan, setChallan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [downloadingBarcode, setDownloadingBarcode] = useState(false);
  const [showSheetModal, setShowSheetModal] = useState(false);

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
      <div className={`min-h-screen bg-[#F8FAFC] ${paddingClass} flex items-center justify-center`}>
        <div className="text-xs text-slate-500 font-mono animate-pulse">
          Loading Challan Document...
        </div>
      </div>
    );
  }

  if (error || !challan) {
    return (
      <div className={`min-h-screen bg-[#F8FAFC] ${paddingClass} p-4 sm:p-8`}>
        <div className="max-w-xl mx-auto p-6 bg-rose-50 border border-rose-200 rounded-xl text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
          <h2 className="text-sm font-bold text-rose-900">Error Loading Challan</h2>
          <p className="text-xs text-rose-700">{error || 'Challan not found'}</p>
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-rose-900 text-white rounded text-xs font-semibold cursor-pointer"
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
    QC1: 'QC1',
    EMBROIDERY: 'EMBROIDERY',
    THREAD_CUTTING: 'THREAD CUTTING',
    CUTTING: 'CUTTING',
    QC2: 'QC2',
    FINISHING: 'FINISHING',
    PACKING: 'PACKING'
  };

  const deptDisplay = challan ? (deptLabels[challan.fromDepartment] || challan.fromDepartment || 'PRODUCTION') : 'PRODUCTION';

  const totalPieces = challan ? (challan.items || []).reduce(
    (sum: number, it: any) => sum + (Number(it.quantity) || 0),
    0
  ) : 0;

  const barcodeStickerParams: BarcodeStickerParams | null = challan ? {
    challanNumber: challan.challanNumber,
    designNumber: designNumber,
    departmentName: deptDisplay,
    fromDepartment: challan.fromDepartment,
    toDepartment: challan.toDepartment,
    programSerialNo: challan.program?.programSerialNo || challan.program?.programNumber || '—',
    clientName: challan.program?.clientName || challan.program?.buyerName || 'Standard Client',
    mainStyle: challan.program?.mainStyle || challan.program?.styleCode || '—',
    totalQuantity: totalPieces,
    uom: challan.items?.[0]?.uom || 'PCS',
    date: challan.createdAt ? new Date(challan.createdAt).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN')
  } : null;

  const handleDownloadBarcodePng = async () => {
    if (!barcodeStickerParams) return;
    try {
      setDownloadingBarcode(true);
      await downloadBarcodeStickerPng(barcodeStickerParams);
    } catch (e) {
      console.error('Failed to download barcode sticker PNG:', e);
    } finally {
      setDownloadingBarcode(false);
    }
  };

  const handlePrintBarcodeSticker = () => {
    if (!barcodeStickerParams) return;
    printBarcodeSticker(barcodeStickerParams);
  };

  return (
    <div className={`min-h-screen bg-[#F8FAFC] ${paddingClass} pb-20`}>
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition cursor-pointer"
            title="Back to my department station"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
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

        {/* TOP ACTION BAR: CHALLAN PRINT + STANDALONE BARCODE DOWNLOADS */}
        <div className="flex items-center gap-2.5 print:hidden flex-wrap">
          {/* 1. STANDALONE BARCODE DOWNLOAD (RULE: DOWNLOADABLE ALAG SE) */}
          {barcodeStickerParams && (
            <>
              <button
                type="button"
                onClick={handleDownloadBarcodePng}
                disabled={downloadingBarcode}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-md shadow-xs transition cursor-pointer"
                title="Download standalone barcode sticker with Design Number as PNG"
              >
                <BarcodeIcon className="w-4 h-4" />
                <span>{downloadingBarcode ? 'Downloading...' : 'Download Barcode (PNG)'}</span>
              </button>
              <button
                type="button"
                onClick={handlePrintBarcodeSticker}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-md shadow-xs transition cursor-pointer"
                title="Print 4x2.5 thermal sticker label directly"
              >
                <Printer className="w-4 h-4" />
                <span>Print Barcode Sticker</span>
              </button>
            </>
          )}

          {/* DOCUMENT SUITE: PRODUCTION SHEET, CHALLAN & WILCOM (VIEW, DOWNLOAD, PRINT) */}
          <DocumentActionButtons
            challan={challan}
            program={challan.program}
            size="sm"
          />
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

      {/* PRINTABLE VOUCHER */}
      <main className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
        
        <div className="bg-white border border-slate-300 rounded-xl p-4 sm:p-8 shadow-sm space-y-6">
          
          {/* VOUCHER TOP HEADER */}
          <div className="flex items-start justify-between pb-6 border-b-2 border-slate-900 gap-4">
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
                </div>
              ) : challan.fromDepartment === 'THREAD_CUTTING' && challan.toDepartment === 'QC2' ? (
                <div>
                  <h2 className="text-xl font-serif font-black text-slate-900 tracking-wide">
                    THREAD CUTTING DEPARTMENT
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-black font-mono tracking-wider text-cyan-900 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                      THREAD CUTTING → QC2 (QUALITY CHECK 2)
                    </span>
                    <span className="text-sm font-bold text-slate-800 tracking-widest">
                      CHALLAN
                    </span>
                  </div>
                </div>
              ) : (
                <div>
                  <h2 className="text-2xl font-serif font-black text-slate-900">
                    MATERIAL DISPATCH CHALLAN
                  </h2>
                </div>
              )}
            </div>

            {/* VOUCHER RIGHT SIDE: SCANNABLE CODE-128 BARCODE + DESIGN NUMBER + DEPARTMENT NAME */}
            <div className="text-right flex flex-col items-end">
              {/* Authenticated Code-128 Barcode with Quiet Zones */}
              {(() => {
                const { svgBars, totalWidth: barW, totalHeight: barH } = generateCode128SvgBars(challan.challanNumber, 1.4, 30);
                return (
                  <div className="mb-1 bg-white p-1 rounded border border-slate-200 shadow-2xs">
                    <svg viewBox={`0 0 ${barW} ${barH}`} className="h-7 w-auto max-w-[150px]">
                      <g dangerouslySetInnerHTML={{ __html: svgBars }} />
                    </svg>
                  </div>
                );
              })()}

              {/* Department Badge on Barcode Area */}
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 mb-0.5">
                DEPT: {deptDisplay}
              </span>

              {/* Production Sheet Design Number on Barcode Area */}
              <div className="flex items-center gap-1 justify-end text-[11px] mb-0.5">
                <span className="text-slate-500 font-bold text-[9px] uppercase tracking-wider">DESIGN NO:</span>
                <strong className="font-mono font-black text-slate-900">
                  {designNumber}
                </strong>
              </div>

              <span className="font-mono font-bold text-base text-slate-900 block leading-tight">
                {challan.challanNumber}
              </span>

              <span className="text-[11px] text-slate-500 block">
                Date: {challan.createdAt ? new Date(challan.createdAt).toLocaleDateString('en-IN') : '—'}
              </span>

              {/* Quick Standalone Barcode Download Action Links */}
              {barcodeStickerParams && (
                <div className="mt-1 flex items-center gap-1.5 print:hidden">
                  <button
                    type="button"
                    onClick={handleDownloadBarcodePng}
                    className="text-[10px] font-bold text-amber-700 hover:text-amber-900 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <Download className="w-2.5 h-2.5" />
                    <span>Barcode PNG</span>
                  </button>
                  <span className="text-slate-300">·</span>
                  <button
                    type="button"
                    onClick={handlePrintBarcodeSticker}
                    className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <Printer className="w-2.5 h-2.5" />
                    <span>Sticker</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* TRACEABILITY & GENEALOGY BAR (PRODUCTION SHEET ACCOMPANIES THIS CHALLAN) */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-700" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Accompanying Production Sheet
                </span>
              </div>
              {challan.program && (
                <div className="flex items-center gap-2 print:hidden">
                  <button
                    type="button"
                    onClick={() => setShowSheetModal(true)}
                    className="inline-flex items-center gap-1.5 text-xs text-indigo-700 hover:text-indigo-900 font-bold bg-white px-2.5 py-1 rounded border border-indigo-200 shadow-2xs transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview Production Sheet</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => printProductionSheet(challan.program)}
                    className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 font-bold bg-white px-2 py-1 rounded border border-blue-200 shadow-2xs transition cursor-pointer"
                    title="Print Production Sheet (A4)"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Sheet</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadProductionSheetHtml(challan.program)}
                    className="inline-flex items-center gap-1 text-xs text-slate-700 hover:text-slate-900 font-bold bg-white px-2 py-1 rounded border border-slate-300 shadow-2xs transition cursor-pointer"
                    title="Download Production Sheet HTML/PDF"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              {/* 1. Master Sheet Details */}
              <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Master Production Record</span>
                <span className="font-mono font-bold text-slate-900 text-sm block">
                  {challan.program?.programSerialNo || challan.program?.programNumber || '—'}
                </span>
                <span className="text-slate-600 text-[11px] block mt-0.5">
                  Buyer: <strong>{challan.program?.clientName || challan.program?.buyerName || 'Standard'}</strong> | Style: <strong>{challan.program?.mainStyle || challan.program?.styleCode || '—'}</strong>
                </span>
              </div>

              {/* 2. Previous Movement Trace */}
              <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Previous Movement Trace</span>
                {challan.parentChallan ? (
                  <div>
                    <Link
                      href={`/challans/${challan.parentChallan.id}`}
                      className="font-mono font-bold text-blue-700 hover:underline text-xs flex items-center gap-1"
                    >
                      <span>{challan.parentChallan.challanNumber}</span>
                      <span className="text-[10px] text-slate-500 font-normal">
                        ({challan.parentChallan.fromDepartment} → {challan.parentChallan.toDepartment})
                      </span>
                    </Link>
                  </div>
                ) : (
                  <div>
                    <span className="font-semibold text-slate-800 text-xs block">
                      Originating Lot
                    </span>
                  </div>
                )}
              </div>

              {/* 3. Downstream Movements Trace */}
              <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Subsequent Movements Trace</span>
                {challan.childChallans && challan.childChallans.length > 0 ? (
                  <div className="space-y-1">
                    {challan.childChallans.map((child: any) => (
                      <Link
                        key={child.id}
                        href={`/challans/${child.id}`}
                        className="font-mono font-bold text-blue-700 hover:underline text-xs block truncate"
                      >
                        → {child.challanNumber} ({child.fromDepartment} → {child.toDepartment})
                      </Link>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-500 text-xs italic block mt-1">
                    Current active stage ({challan.toDepartment})
                  </span>
                )}
              </div>
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

          {/* STANDALONE DOWNLOADABLE BARCODE DISPATCH STICKER & LOT TAG (RULE: DOWNLOADABLE ALAG SE) */}
          {barcodeStickerParams && (
            <BarcodeStickerCard 
              params={barcodeStickerParams}
              title={`${deptDisplay} Barcode Dispatch Sticker & Lot Tag`}
            />
          )}

          {/* TOTAL PIECES CALCULATION & QC2 CHECKING DIRECTIVE */}
          {(() => {
            const totalQuantity = (challan.items || []).reduce(
              (sum: number, it: any) => sum + (Number(it.quantity) || 0),
              0
            );
            const isThreadCuttingToQc2 =
              challan.fromDepartment === 'THREAD_CUTTING' && challan.toDepartment === 'QC2';

            return (
              <>
                {/* QC2 MANDATORY INSPECTION HANDOVER DIRECTIVE */}
                {isThreadCuttingToQc2 && (
                  <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border-2 border-emerald-400 rounded-xl space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200 pb-2.5">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" />
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                            QUALITY ASSURANCE DIRECTIVE
                          </span>
                          <h4 className="text-sm font-bold text-slate-900">
                            QC2 Piece-by-Piece Quality Inspection Basis
                          </h4>
                        </div>
                      </div>
                      <div className="text-left sm:text-right bg-white px-3.5 py-1.5 rounded-xl border border-emerald-300">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Pieces Dispatched to QC2</span>
                        <strong className="text-lg font-mono font-black text-emerald-800">
                          {totalQuantity} PCS
                        </strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* DEPARTMENT PIECE / FABRIC IN & OUT AUTO-DETECTION & DEFECTIVE SHELF AUDIT CARD */}
                {(() => {
                  const fIn = challan.fabricIn ?? (challan.parentChallan?.fabricOut || totalQuantity);
                  const fOut = challan.fabricOut ?? totalQuantity;
                  const fDef = challan.defectivePieces ?? 0;
                  const fUnit = challan.fabricUnit || challan.items?.[0]?.uom || 'MTR';
                  const shelf = challan.defectiveShelfLocation || 'DEF-SHELF-01 (Fabric Store Quarantined Shelf)';
                  const reason = challan.defectReason || 'Quality Defect / Trimming Rejection';
                  const detectedSource = challan.detectedFromDepartment || challan.parentChallan?.fromDepartment;

                  return (
                    <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-xl shadow-xs border border-slate-700/80 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 bg-amber-400/20 text-amber-300 rounded border border-amber-400/30 text-[10px] font-bold font-mono">
                            FLOW AUDIT
                          </span>
                          <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                            Department Fabric &amp; Piece Transfer Ledger
                          </span>
                        </div>
                        {detectedSource && (
                          <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30 self-start sm:self-auto">
                            ⚡ Auto-detected from {detectedSource}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        {/* 1. FABRIC IN */}
                        <div className="bg-slate-800/90 border border-slate-700 rounded-lg p-3 space-y-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            1. Fabric / Pieces IN
                          </span>
                          <div className="text-xl font-mono font-bold text-white">
                            {fIn} <span className="text-xs font-normal text-slate-400">{fUnit}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block truncate">
                            {detectedSource ? `Source: ${detectedSource}` : `From: ${challan.fromDepartment}`}
                          </span>
                        </div>

                        {/* 2. DEFECTIVE CUT */}
                        <div className="bg-rose-950/40 border border-rose-800/60 rounded-lg p-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold text-rose-300 block">
                              2. Defective Cut Pieces
                            </span>
                            <span className="text-[9px] font-mono text-rose-300 bg-rose-500/20 px-1 py-0.5 rounded">
                              To Shelf
                            </span>
                          </div>
                          <div className="text-xl font-mono font-bold text-rose-300">
                            {fDef} <span className="text-xs font-normal text-rose-400">{fUnit}</span>
                          </div>
                          <span className="text-[10px] text-rose-200/90 block truncate" title={shelf}>
                            {fDef > 0 ? `Station Shelf: ${shelf} | Central Hub: DEF-SHELF-CENTRAL` : 'Zero defects cut'}
                          </span>
                        </div>

                        {/* 3. FABRIC OUT */}
                        <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-lg p-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold text-emerald-300 block">
                              3. Pieces Left (OUT)
                            </span>
                            <span className="text-[9px] font-mono text-emerald-300 bg-emerald-500/20 px-1 py-0.5 rounded">
                              To {challan.toDepartment}
                            </span>
                          </div>
                          <div className="text-xl font-mono font-black text-emerald-300">
                            {fOut} <span className="text-xs font-normal text-emerald-400">{fUnit}</span>
                          </div>
                          <span className="text-[10px] text-emerald-300/80 block truncate">
                            Auto-detected by {challan.toDepartment}
                          </span>
                        </div>
                      </div>

                      {/* BALANCE BAR */}
                      <div className="pt-2 border-t border-slate-700/80 flex items-center justify-between text-[11px] font-mono text-slate-300">
                        <span>
                          Accounting: <strong>{fIn} {fUnit} IN</strong> = <strong>{fDef} {fUnit} CUT</strong> (To Shelf) + <strong>{fOut} {fUnit} OUT</strong> (To {challan.toDepartment})
                        </span>
                        {fDef > 0 && (
                          <span className="text-amber-300 text-[10px]">
                            Reason: {reason}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* ITEMS TRANSFER TABLE */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Transferred Work Items &amp; Materials
                    </h3>
                    {isThreadCuttingToQc2 && (
                      <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded border border-emerald-200">
                        Dispatched Pieces: {totalQuantity} PCS
                      </span>
                    )}
                  </div>
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
                      {/* TABLE FOOTER WITH EXPLICIT TOTAL PIECES */}
                      <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-bold text-xs text-slate-800">
                        <tr>
                          <td colSpan={3} className="py-2.5 px-4 text-right uppercase text-[11px] tracking-wider text-slate-700">
                            {isThreadCuttingToQc2
                              ? 'Total Dispatched Pieces for QC2 Inspection:'
                              : 'Total Material Quantity:'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-sm font-black text-slate-900">
                            {totalQuantity}
                          </td>
                          <td className="py-2.5 px-4 font-bold text-slate-700">
                            {challan.items?.[0]?.uom || 'PCS'}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>


                {/* PHYSICAL SIGNATURE BLOCKS FOR FACTORY HANDOFF */}
                <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-xs">
                  <div className="border-t border-dashed border-slate-400 pt-2 text-center space-y-1">
                    <span className="font-bold text-slate-800 block">
                      {isThreadCuttingToQc2
                        ? 'Thread Cutting Incharge'
                        : challan.fromDepartment === 'DYEING' || challan.toDepartment === 'QC1'
                        ? 'Dyeing Department'
                        : challan.fromDepartment
                        ? `${challan.fromDepartment} Department`
                        : 'Dispatch Department'}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      Authorized Issuer Signature (Dispatched: {totalQuantity} PCS)
                    </span>
                  </div>
                  <div className="border-t border-dashed border-slate-400 pt-2 text-center space-y-1">
                    <span className="font-bold text-slate-800 block">
                      {challan.toDepartment === 'QC2' ? 'QC2 Quality Inspector' : `${challan.toDepartment} Supervisor`}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {challan.toDepartment === 'QC2'
                        ? `Checking Basis: ${totalQuantity} PCS | Checked: ____ | Passed: ____ | Defective: ____`
                        : 'Receiver Gate Inward Stamp & Signature'}
                    </span>
                  </div>
                </div>
              </>
            );
          })()}

        </div>

      </main>

      {/* ACCOMPANYING PRODUCTION SHEET PREVIEW & PRINT MODAL */}
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
