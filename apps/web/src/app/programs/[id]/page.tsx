'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Send, 
  Printer, 
  Download,
  Eye,
  CheckCircle2, 
  Clock, 
  Layers, 
  FileText, 
  Scissors, 
  AlertCircle,
  Calendar,
  Sparkles,
  Palette,
  Ruler,
  Plus,
  Lock,
  ShieldCheck,
  Check,
  Building
} from 'lucide-react';
import { api } from '@/lib/api';
import { getCurrentUser, canViewClientCode } from '@/lib/rbac';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';
import { 
  downloadProductionSheetHtml, 
  printProductionSheet,
  downloadWilcomFormHtml,
  printWilcomForm,
  extractSubStylesAndGrid,
  GarmentCategory
} from '@/lib/download-production-sheet';
import { 
  downloadChallanHtml, 
  printChallan 
} from '@/lib/download-challan';

export default function ProgramDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [program, setProgram] = useState<any>(null);
  const [challans, setChallans] = useState<any[]>([]);
  const [storeAvailability, setStoreAvailability] = useState<any>(null);
  const [verifyingStore, setVerifyingStore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeCategoryTab, setActiveCategoryTab] = useState<'TOP' | 'BOTTOM' | 'DUPATTA' | 'OTHER' | 'WILCOM'>('TOP');

  useEffect(() => {
    setCurrentUser(getCurrentUser());
  }, []);

  const loadProgram = async () => {
    try {
      setLoading(true);
      const [data, challansData, availRes] = await Promise.all([
        api.getProgram(id),
        api.getChallans({ programId: id }).catch(() => []),
        fetch(`/api/fabric-store/check-availability?programId=${id}`).then(r => r.json()).catch(() => null)
      ]);
      setProgram(data);
      setChallans(challansData || []);
      if (availRes && availRes.data) {
        setStoreAvailability(availRes.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load Production Sheet');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStoreVerification = async (isAvailable: boolean) => {
    try {
      setVerifyingStore(true);
      const res = await fetch('/api/fabric-store/check-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programId: id,
          isAvailable,
          actorName: currentUser?.name || 'Fabric Store Incharge',
          remarks: isAvailable 
            ? 'Physical fabric confirmed present in Store' 
            : 'Marked on Hold / Out of Stock in Store'
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to update store availability');
        return;
      }
      await loadProgram();
    } catch (err: any) {
      alert(`Error updating store status: ${err.message}`);
    } finally {
      setVerifyingStore(false);
    }
  };

  useEffect(() => {
    if (id) loadProgram();
  }, [id]);

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      await api.updateProgramStatus(id, newStatus);
      await loadProgram();
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] pl-0 md:pl-64 flex items-center justify-center">
        <div className="text-xs text-slate-500 font-mono animate-pulse">
          Loading Production Sheet...
        </div>
      </div>
    );
  }

  if (error || !program) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] pl-0 md:pl-64 p-4 sm:p-8">
        <div className="max-w-xl mx-auto p-6 bg-rose-50 border border-rose-200 rounded-xl text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
          <h2 className="text-sm font-bold text-rose-900">Error Loading Sheet</h2>
          <p className="text-xs text-rose-700">{error || 'Production Sheet not found'}</p>
          <Link
            href="/programming"
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-rose-900 text-white rounded text-xs font-semibold"
          >
            ← Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const isDraft = program.status === 'DRAFT';
  const isReady = program.status === 'READY_FOR_ISSUE' || program.status === 'APPROVED';
  const isIssued = program.status === 'ISSUED' || program.status === 'IN_PRODUCTION';

  let programItems: any[] = Array.isArray(program.items) ? program.items : [];
  if (programItems.length === 0 && program.metadataJson) {
    try {
      const meta = typeof program.metadataJson === 'string' ? JSON.parse(program.metadataJson) : program.metadataJson;
      if (Array.isArray(meta?.items)) {
        programItems = meta.items;
      }
    } catch {}
  }
  if (programItems.length === 0) {
    programItems = [
      {
        id: 'item-default',
        itemName: program.mainStyle || 'Main Garment Part',
        color: program.fabricColor || 'Standard',
        measurement: program.colorQuantity || program.targetQuantity || 1,
        unit: program.quantityMeasurement || 'PCS',
        fabricAverage: program.fabricAverage || 1.25,
        fabricWidth: program.fabricWidthInches ? `${program.fabricWidthInches} Inches` : (program.fabricWidth || '58 Inches'),
        specialMaterial: program.specialMaterial || 'None',
        remarks: program.comments || '',
      },
    ];
  }

  const grandTotalMeasurement = programItems.reduce((acc, it) => acc + (Number(it.measurement) || 0), 0);
  const totalFabricRequired = programItems.reduce((acc, it) => {
    const qty = Number(it.measurement) || 0;
    const avg = Number(it.fabricAverage) || Number(program.fabricAverage) || 1.25;
    return acc + (qty * avg);
  }, 0);
  const uniqueProgramColors = Array.from(new Set(programItems.map((it) => String(it.color || '').trim()).filter(Boolean)));

  let programSubStyles: string[] = Array.isArray(program.subStyles) ? program.subStyles : [];
  if (programSubStyles.length === 0 && program.subStyle) {
    programSubStyles = program.subStyle.split(',').map((s: string) => s.trim()).filter(Boolean);
  }

  let meta: any = null;
  if (program?.metadataJson) {
    try {
      meta = typeof program.metadataJson === 'string' ? JSON.parse(program.metadataJson) : program.metadataJson;
    } catch {}
  }

  const components = meta?.components || null;
  const forwardedComponents: string[] = Array.isArray(meta?.forwardedComponents) ? meta.forwardedComponents : ['TOP'];
  const wilcomEntries: any[] = Array.isArray(meta?.wilcomEntries) ? meta.wilcomEntries : [];

  const activeCategory: GarmentCategory = activeCategoryTab === 'WILCOM' ? 'TOP' : activeCategoryTab;

  const {
    subStylesWithAverages,
    productionGrid,
    topName,
    pattern,
    serialNoCounter,
    noteText,
    remarksText,
    totalMtrAverage,
    fabricName: componentFabricName,
    fabricWidth: componentFabricWidth,
  } = program ? extractSubStylesAndGrid(program, activeCategory) : {
    subStylesWithAverages: [],
    productionGrid: [],
    topName: '',
    pattern: '',
    serialNoCounter: '000',
    noteText: '',
    remarksText: '',
    totalMtrAverage: 0,
    fabricName: '',
    fabricWidth: '',
  };

  const isClientCodeVisible = canViewClientCode(currentUser) && Boolean(program?.clientCode);

  const handleBack = () => {
    if (typeof window !== 'undefined') {
      const activeDept = sessionStorage.getItem('active_department');
      const activeRoot = sessionStorage.getItem('active_department_root');
      if (activeDept === 'EMBROIDERY') {
        router.push('/embroidery');
        return;
      }
      if (activeDept === 'THREAD_CUTTING') {
        router.push('/thread-cutting');
        return;
      }
      if (activeDept === 'DYEING') {
        router.push('/dyeing');
        return;
      }
      if (activeDept === 'FABRIC_STORE') {
        router.push('/fabric-store');
        return;
      }
      if (activeDept === 'QC1') {
        router.push('/qc1');
        return;
      }
      if (activeRoot) {
        router.push(activeRoot);
        return;
      }
    }
    router.push('/programming');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pl-0 md:pl-64 pb-20">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleBack}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition cursor-pointer"
            title="Back to my department station"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A66E22] block">
              SHUBHAM FABRICS · PRODUCTION SHEET
            </span>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold font-mono text-slate-900">
                {program.programSerialNo || program.programNumber}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  isDraft
                    ? 'bg-amber-100 text-amber-900'
                    : isReady
                    ? 'bg-indigo-100 text-indigo-900'
                    : isIssued
                    ? 'bg-emerald-100 text-emerald-900'
                    : 'bg-blue-100 text-blue-900'
                }`}
              >
                {program.status}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPrintModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-md border border-slate-300 transition cursor-pointer"
            title="Preview Full A4 Traveler"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Preview</span>
          </button>

          <button
            onClick={() => printProductionSheet(program)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-900 text-xs font-semibold rounded-md border border-blue-200 transition cursor-pointer"
            title="Print Production Sheet on A4 Paper"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Sheet</span>
          </button>

          <button
            onClick={() => downloadProductionSheetHtml(program)}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-semibold rounded-md border border-emerald-200 transition cursor-pointer"
            title="Download Standalone HTML/PDF File"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>

          {isDraft && (
            <button
              onClick={() => handleUpdateStatus('READY_FOR_ISSUE')}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-xs transition cursor-pointer"
            >
              Mark Ready
            </button>
          )}

          {currentUser?.departmentCode === 'STORE' || currentUser?.role === 'STORE_INCHARGE' || currentUser?.role === 'FABRIC_STORE' ? (
            <Link
              href={`/fabric-store/my-work/issue-challan?programId=${program.id}`}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-md shadow-xs transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Issue Store Challan</span>
            </Link>
          ) : (
            <Link
              href={`/my-work/issue-challan?programId=${program.id}`}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#163767] hover:bg-[#0F264A] text-white text-xs font-semibold rounded-md shadow-xs transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Issue Challan</span>
            </Link>
          )}
        </div>
      </header>

      {/* BODY CONTENT - 8 SECTIONS */}
      <main className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">

        {/* FABRIC STORE CLEARANCE GATE BANNER */}
        <div
          className={`p-4 rounded-xl border transition-all ${
            storeAvailability?.isAvailable
              ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
              : 'bg-amber-50/90 border-amber-300 text-amber-950'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className={`p-2.5 rounded-lg shrink-0 ${
                  storeAvailability?.isAvailable ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
                }`}
              >
                {storeAvailability?.isAvailable ? (
                  <ShieldCheck className="w-5 h-5" />
                ) : (
                  <Lock className="w-5 h-5" />
                )}
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded font-mono bg-white/90 border border-slate-200">
                    Fabric Store Gatekeeper
                  </span>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                      storeAvailability?.isAvailable
                        ? 'bg-emerald-200 text-emerald-900 border border-emerald-300'
                        : 'bg-amber-200 text-amber-950 border border-amber-300'
                    }`}
                  >
                    {storeAvailability?.isAvailable ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-800" />
                        Movement Cleared
                      </>
                    ) : (
                      <>
                        <Lock className="w-3 h-3 text-amber-900" />
                        Movement Blocked (Awaiting Fabric in Store)
                      </>
                    )}
                  </span>
                  <span className="text-[10px] font-mono text-slate-600">
                    Next Dept:{' '}
                    <strong>{program.fabricDyeingRequired ? 'Dyeing' : 'Embroidery / Cutting'}</strong>
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900">
                  {storeAvailability?.isAvailable
                    ? `Fabric available in store (${storeAvailability.totalStoreStockMeters || 0}m). Production Sheet authorized to move.`
                    : `Production Sheet cannot move to ${program.fabricDyeingRequired ? 'Dyeing' : 'Embroidery'} until fabric is in Store.`}
                </h3>

                <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                  {storeAvailability?.message ||
                    (storeAvailability?.isAvailable
                      ? 'Physical fabric stock confirmed in store inventory.'
                      : 'Required fabric rolls or inward balance not found in store.')}
                </p>

                {storeAvailability?.fabricStoreVerified && (
                  <p className="text-[11px] text-emerald-800 font-semibold pt-0.5">
                    ✓ Verified by {storeAvailability.fabricStoreVerifiedBy || 'Store Incharge'}
                    {storeAvailability.fabricStoreVerifiedAt &&
                      ` on ${new Date(storeAvailability.fabricStoreVerifiedAt).toLocaleDateString()}`}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-center shrink-0">
              <Link
                href="/fabric-store/inventory/inward"
                className="text-xs font-semibold px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-md transition shadow-2xs"
              >
                Inward Stock
              </Link>
              {storeAvailability?.isAvailable ? (
                <button
                  type="button"
                  onClick={() => handleToggleStoreVerification(false)}
                  disabled={verifyingStore}
                  className="text-xs font-semibold px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 rounded-md transition cursor-pointer"
                  title="Mark fabric missing/out of stock and hold movement"
                >
                  {verifyingStore ? 'Updating…' : 'Mark Out of Stock'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleToggleStoreVerification(true)}
                  disabled={verifyingStore}
                  className="text-xs font-semibold px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-md transition cursor-pointer flex items-center gap-1 shadow-xs"
                  title="Confirm physical fabric presence in store to authorize movement"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{verifyingStore ? 'Confirming…' : 'Confirm Fabric in Store'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* SUMMARY STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 bg-white border border-slate-200/90 rounded-xl shadow-xs text-xs">
          <div>
            <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">Client</span>
            <span className="font-bold text-slate-900 text-sm">{program.clientName || program.buyerName || 'Standard Client'}</span>
            {isClientCodeVisible && (
              <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-900 border border-amber-200 block w-fit">
                <span>🔒 Code:</span>
                <span>{program.clientCode}</span>
              </span>
            )}
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">Main Style</span>
            <span className="font-bold text-slate-900 text-sm">{program.mainStyle || program.styleCode || '—'}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">Target Quantity</span>
            <span className="font-bold font-mono text-slate-900 text-sm">
              {program.colorQuantity || program.targetQuantity} {program.quantityMeasurement || 'PCS'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">Delivery Target</span>
            <span className="font-bold text-rose-700 text-sm">
              {program.deliveryDate ? new Date(program.deliveryDate).toLocaleDateString() : '—'}
            </span>
          </div>
        </div>

        {/* SPECIFICATION DETAILS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* PROGRAM INFORMATION */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900 bg-blue-50 px-2 py-0.5 rounded">
              Program Identification
            </span>
            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <span className="text-slate-400 block text-[11px]">Program Serial #</span>
                <span className="font-mono font-bold text-slate-900">{program.programSerialNo || program.programNumber}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Design Number</span>
                <span className="font-semibold text-slate-900">{program.designNumber || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Start Date</span>
                <span className="text-slate-700">{program.startDate ? new Date(program.startDate).toLocaleDateString() : '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Delivery Date</span>
                <span className="font-semibold text-rose-700">{program.deliveryDate ? new Date(program.deliveryDate).toLocaleDateString() : '—'}</span>
              </div>
              {isClientCodeVisible && (
                <div className="col-span-2 mt-2 p-2.5 bg-amber-50/80 rounded-lg border border-amber-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">
                      Client Code (Confidential)
                    </span>
                    <span className="font-mono font-black text-amber-950 text-sm">
                      {program.clientCode}
                    </span>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-200/90 text-amber-950 border border-amber-300">
                    🔒 Admin &amp; Programming Only
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* PRIORITY */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-900 bg-rose-50 px-2 py-0.5 rounded">
              Priority &amp; Dispatch Urgency
            </span>
            <div className="pt-1">
              {(() => {
                const priority = (program.clientPriority || program.priority || 'NORMAL').toUpperCase();
                const config: Record<string, { badge: string; border: string }> = {
                  LOW: {
                    badge: 'bg-slate-100 text-slate-800 border-slate-300',
                    border: 'border-slate-200 bg-slate-50/50',
                  },
                  NORMAL: {
                    badge: 'bg-blue-100 text-blue-900 border-blue-300',
                    border: 'border-blue-200 bg-blue-50/40',
                  },
                  HIGH: {
                    badge: 'bg-amber-100 text-amber-900 border-amber-300',
                    border: 'border-amber-200 bg-amber-50/40',
                  },
                  URGENT: {
                    badge: 'bg-rose-100 text-rose-900 border-rose-300',
                    border: 'border-rose-200 bg-rose-50/40',
                  },
                };
                const current = config[priority] || config.NORMAL;
                return (
                  <div className={`p-3 rounded-lg border ${current.border} flex items-center justify-between`}>
                    <span className={`text-xs font-black px-2.5 py-1 rounded border ${current.badge}`}>
                      {priority}
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* STYLE INFORMATION */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 bg-amber-50 px-2 py-0.5 rounded">
              Style &amp; Pattern
            </span>
            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <span className="text-slate-400 block text-[11px]">Main Style</span>
                <span className="font-semibold text-slate-900">{program.mainStyle || program.styleCode}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Pattern Ref #</span>
                <span className="font-mono text-slate-700">{program.pattern || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Base Design Type</span>
                <span className="text-slate-700">{program.baseDesignType || 'Standard'}</span>
              </div>
              <div className="col-span-2 pt-2 border-t border-slate-100">
                <span className="text-slate-400 block text-[11px] mb-1 font-bold uppercase tracking-wider">
                  Sub Styles ({programSubStyles.length})
                </span>
                {programSubStyles.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {programSubStyles.map((sub: string, sIdx: number) => (
                      <span
                        key={sIdx}
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-950 font-semibold text-[11px] shadow-2xs"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0" />
                        <span>{sub}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-500 italic text-xs">Standard</span>
                )}
              </div>
            </div>
          </div>

          {/* WILCOM & EMBROIDERY */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-900 bg-purple-50 px-2 py-0.5 rounded">
              Wilcom &amp; Embroidery
            </span>
            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <span className="text-slate-400 block text-[11px]">Wilcom Design #</span>
                <span className="font-mono font-bold text-purple-950">{program.wilcomDesignNumber || 'WLC-N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Embroidery Design</span>
                <span className="text-slate-700">{program.embroideryDesign || 'Standard Embroidery'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Design Size</span>
                <span className="text-slate-700">{program.embroideryDesignSize || 'Standard Size'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Wilcom Artwork</span>
                <span className="text-slate-500 italic">{program.wilcomDesignPhoto ? 'Attached' : 'No photo uploaded'}</span>
              </div>
            </div>
          </div>

          {/* FABRIC SPECIFICATIONS */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded">
              Fabric Specifications
            </span>
            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <span className="text-slate-400 block text-[11px]">Fabric Name</span>
                <span className="font-semibold text-slate-900">{program.fabricName || 'Cotton'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Fabric Type</span>
                <span className="text-slate-700">{program.fabricType || 'Woven'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Fabric Width</span>
                <span className="font-mono text-slate-800">{program.fabricWidthInches || '58'} Inches</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Fabric Color</span>
                <span className="font-semibold text-slate-900">{program.fabricColor || 'Natural'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Fabric Average</span>
                <span className="font-mono text-slate-800">{program.fabricAverage || '1.25'} {program.fabricAverageType || 'Mtr/Pc'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Color Availability</span>
                <span className="font-semibold text-emerald-700">{program.fabricColorAvailable || 'IN_STOCK'}</span>
              </div>
            </div>
          </div>

          {/* DYEING */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-900 bg-rose-50 px-2 py-0.5 rounded">
              Dyeing Requirements
            </span>
            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <span className="text-slate-400 block text-[11px]">Dyeing Required?</span>
                <span className={`font-bold ${program.fabricDyeingRequired ? 'text-rose-700' : 'text-slate-700'}`}>
                  {program.fabricDyeingRequired ? 'YES (Undyed / Kora)' : 'NO (Pre-Dyed / Direct)'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Next Department Flow</span>
                <span className={`font-bold ${program.fabricDyeingRequired ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {program.fabricDyeingRequired ? 'Dyeing Department' : 'Embroidery Department'}
                </span>
              </div>
            </div>          </div>

          {/* PRODUCTION SHEET SPECIFICATION & BREAKDOWN */}
          <div className="bg-white border-2 border-black rounded-lg p-5 shadow-xs space-y-4 md:col-span-2 text-black">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/10 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-black bg-slate-100 px-2 py-0.5 rounded border border-black/20">
                  PRODUCTION SHEET &middot; TRAVELER #{program.programSerialNo || program.programNumber}
                </span>
                <h3 className="text-sm font-black text-black mt-1 uppercase tracking-wide flex items-center gap-2">
                  <span>{activeCategoryTab === 'WILCOM' ? 'Wilcom Embroidery Specifications' : `${activeCategoryTab} Production Sheet Breakdown`}</span>
                  {isClientCodeVisible && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-950 text-[10px] font-mono font-black border border-amber-300 normal-case">
                      🔒 Client Code: {program.clientCode}
                    </span>
                  )}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (activeCategoryTab === 'WILCOM') {
                      printWilcomForm(program);
                    } else {
                      printProductionSheet(program, activeCategoryTab);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded shadow-2xs transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{activeCategoryTab === 'WILCOM' ? 'Print Wilcom' : `Print ${activeCategoryTab}`}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (activeCategoryTab === 'WILCOM') {
                      void downloadWilcomFormHtml(program);
                    } else {
                      void downloadProductionSheetHtml(program, activeCategoryTab);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-black text-white text-xs font-bold rounded shadow-2xs transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-300 text-slate-800 text-xs font-bold rounded hover:bg-slate-50 transition cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Print Modal</span>
                </button>
              </div>
            </div>

            {/* COMPONENT & WILCOM TAB SELECTOR */}
            <div className="flex items-center gap-2 pb-2 border-b border-black/10 overflow-x-auto">
              {(['TOP', 'BOTTOM', 'DUPATTA'] as GarmentCategory[]).map((cat) => {
                const isEnabled = components ? components[cat]?.enabled !== false : (cat === 'TOP');
                const isForwarded = forwardedComponents.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategoryTab(cat)}
                    className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      activeCategoryTab === cat
                        ? 'bg-[#163767] text-white shadow-2xs'
                        : isEnabled
                          ? 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-300'
                          : 'bg-slate-50 text-slate-400 border border-slate-200'
                    }`}
                  >
                    <span>{cat} Sheet</span>
                    {isForwarded && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Forwarded" />
                    )}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setActiveCategoryTab('WILCOM')}
                className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeCategoryTab === 'WILCOM'
                    ? 'bg-purple-700 text-white shadow-2xs'
                    : 'bg-purple-50 text-purple-900 hover:bg-purple-100 border border-purple-200'
                }`}
              >
                <Sparkles className="w-3 h-3 text-purple-500" />
                <span>Wilcom Form</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-purple-200/70 text-purple-950">
                  {wilcomEntries.length}
                </span>
              </button>
            </div>

            {activeCategoryTab === 'WILCOM' ? (
              /* WILCOM SPECIFICATIONS VIEW */
              <div className="space-y-4 pt-1">
                {wilcomEntries.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {wilcomEntries.map((entry: any, wIdx: number) => (
                      <div key={entry.id || wIdx} className="p-3.5 border-[1.5px] border-black rounded bg-white space-y-2">
                        <div className="flex items-center justify-between border-b border-black/10 pb-1.5">
                          <span className="text-[10px] font-black px-2 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-300 uppercase">
                            {entry.category || 'EMBROIDERY'}
                          </span>
                          <span className="font-mono font-black text-xs text-purple-950">
                            WILCOM #{entry.wilcomDesignNumber}
                          </span>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-20 h-20 border border-slate-300 rounded bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                            {entry.photoUrl ? (
                              <img src={entry.photoUrl} alt={entry.wilcomDesignNumber} className="w-full h-full object-contain" />
                            ) : (
                              <span className="text-[10px] text-slate-400 font-bold">No Photo</span>
                            )}
                          </div>
                          <div className="space-y-1 text-xs">
                            <div className="font-bold text-slate-900">{entry.styleName || 'Garment Style'}</div>
                            {entry.remarks && <p className="text-slate-600 text-[11px]">{entry.remarks}</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center border border-dashed border-slate-300 rounded-md text-slate-500 text-xs">
                    No Wilcom embroidery designs recorded for this production order.
                  </div>
                )}
              </div>
            ) : (
              /* COMPONENT SHEET VIEW */
              <div className="space-y-4">
                {/* AVERAGE TABLE (SUB-STYLES & INDIVIDUAL AVERAGES) */}
                <div className="space-y-1">
                  <div className="font-black text-xs uppercase tracking-wider">
                    {activeCategoryTab} AVERAGE CONSUMPTION (METERS PER PIECE)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border-[1.5px] border-black text-center text-xs">
                      <thead>
                        <tr className="bg-slate-50">
                          {subStylesWithAverages.map((s, idx) => (
                            <th key={idx} className="border-[1.5px] border-black p-1.5 font-black text-[11px] uppercase tracking-wider">
                              {s.name}
                            </th>
                          ))}
                          <th className="border-[1.5px] border-black p-1.5 font-black text-[11px] uppercase tracking-wider bg-slate-100">
                            TOTAL MTR
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="h-7 font-bold text-xs">
                          {subStylesWithAverages.map((s, idx) => (
                            <td key={idx} className="border-[1.5px] border-black p-1">
                              {s.average ? Number(s.average).toFixed(2) : '—'}
                            </td>
                          ))}
                          <td className="border-[1.5px] border-black p-1 font-black bg-slate-100 text-blue-950">
                            {totalMtrAverage > 0 ? totalMtrAverage.toFixed(2) : '—'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* MAIN PRODUCTION BREAKDOWN GRID */}
                <div className="space-y-1 pt-1">
                  <div className="font-black text-xs uppercase tracking-wider">
                    {activeCategoryTab} COLOR, QTY &amp; SIZE BREAKDOWN
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border-[1.5px] border-black text-center text-xs">
                      <thead>
                        <tr className="bg-slate-50">
                          <th rowSpan={2} className="border-[1.5px] border-black p-1.5 font-black text-xs uppercase tracking-wider w-32">
                            COLOR
                          </th>
                          <th colSpan={2} className="border-[1.5px] border-black p-1 font-black text-xs uppercase tracking-wider">
                            QTY
                          </th>
                          <th colSpan={subStylesWithAverages.length} className="border-[1.5px] border-black p-1 font-black text-xs uppercase tracking-wider">
                            SIZE
                          </th>
                        </tr>
                        <tr className="bg-slate-50">
                          <th className="border-[1.5px] border-black p-1 font-black text-[11px] w-16">PCS</th>
                          <th className="border-[1.5px] border-black p-1 font-black text-[11px] w-16">MTR</th>
                          {subStylesWithAverages.map((sub, idx) => (
                            <th key={idx} className="border-[1.5px] border-black p-1 font-black text-[11px] uppercase">
                              {sub.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {productionGrid.length > 0 ? (
                          productionGrid.map((row, rIdx) => (
                            <tr key={rIdx} className="h-7">
                              <td className="border-[1.5px] border-black px-2 py-1 text-left font-black text-xs">
                                {row.color}
                              </td>
                              <td className="border-[1.5px] border-black px-1 py-1 font-bold text-xs">
                                {row.pcs}
                              </td>
                              <td className="border-[1.5px] border-black px-1 py-1 font-bold text-xs bg-slate-50/50">
                                {row.mtr}
                              </td>
                              {subStylesWithAverages.map((sub, sIdx) => (
                                <td key={sIdx} className="border-[1.5px] border-black px-1 py-1 font-medium text-xs">
                                  {row.sizes?.[sub.name] || '—'}
                                </td>
                              ))}
                            </tr>
                          ))
                        ) : (
                          <tr className="h-7">
                            <td className="border-[1.5px] border-black px-2 py-1 text-left font-black text-xs">
                              {program.fabricColor || 'Standard'}
                            </td>
                            <td className="border-[1.5px] border-black px-1 py-1 font-bold text-xs">
                              {program.targetQuantity || 0}
                            </td>
                            <td className="border-[1.5px] border-black px-1 py-1 font-bold text-xs bg-slate-50/50">
                              {((program.targetQuantity || 0) * totalMtrAverage).toFixed(2)}
                            </td>
                            {subStylesWithAverages.map((_, sIdx) => (
                              <td key={sIdx} className="border-[1.5px] border-black px-1 py-1 font-medium text-xs">
                                Free
                              </td>
                            ))}
                          </tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100 font-bold border-t-[1.5px] border-black text-xs">
                          <td className="border-[1.5px] border-black p-1.5 text-right font-black uppercase text-[10px]">
                            TOTALS:
                          </td>
                          <td className="border-[1.5px] border-black p-1.5 text-center font-black text-sm text-[#163767]">
                            {productionGrid.length > 0 ? productionGrid.reduce((acc, r) => acc + (Number(r.pcs) || 0), 0) : (program.targetQuantity || 0)}
                          </td>
                          <td className="border-[1.5px] border-black p-1.5 text-center font-black text-sm text-emerald-800">
                            {productionGrid.length > 0 
                              ? (productionGrid.reduce((acc, r) => acc + (Number(r.mtr) || 0), 0)).toFixed(2)
                              : (((program.targetQuantity || 0) * totalMtrAverage)).toFixed(2)}
                          </td>
                          <td colSpan={subStylesWithAverages.length} className="border-[1.5px] border-black p-1.5 text-right text-[10px] text-slate-700 font-bold">
                            Avg: {totalMtrAverage.toFixed(2)} Mtr/Pc
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* NOTE & REMARKS */}
                {(noteText || program.remarks) && (
                  <div className="pt-2 text-xs border-t border-black/10">
                    <span className="font-black text-xs uppercase tracking-wider block mb-0.5">NOTE:-</span>
                    <p className="text-slate-800 font-sans">{noteText || program.remarks}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* PRODUCTION DATES */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-3 md:col-span-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
              Production Dates
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
              <div>
                <span className="text-slate-400 block text-[11px]">Production Design Date</span>
                <span className="text-slate-800">{program.productionDesignDate ? new Date(program.productionDesignDate).toLocaleDateString() : '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Projected End Date</span>
                <span className="text-slate-800">{program.productionEndDate ? new Date(program.productionEndDate).toLocaleDateString() : '—'}</span>
              </div>
            </div>
          </div>

          {/* DISPATCHED CHALLANS ACCOMPANYING THIS PRODUCTION SHEET */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-4 md:col-span-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Accompanying Departmental Challans ({challans.length})
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Physical and digital challans traveling department-to-department with this Production Sheet
                </p>
              </div>
              <Link
                href={`/my-work/issue-challan?programId=${program.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#163767] hover:bg-[#0F264A] text-white text-xs font-semibold rounded-md shadow-xs transition"
              >
                <Send className="w-3.5 h-3.5" />
                <span>+ Issue New Challan</span>
              </Link>
            </div>

            {challans.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-400 space-y-2">
                <p>No dispatch challans issued for this production sheet yet.</p>
                <Link
                  href={`/my-work/issue-challan?programId=${program.id}`}
                  className="inline-block font-semibold text-blue-700 hover:underline"
                >
                  Issue first Challan from Programming to Fabric Store →
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Challan No.</th>
                      <th className="py-2.5 px-3">Handoff Route</th>
                      <th className="py-2.5 px-3">Dispatched Quantity</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {challans.map((ch) => (
                      <tr key={ch.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-3 font-mono font-bold text-[#163767]">
                          <Link href={`/challans/${ch.id}`} className="hover:underline">
                            {ch.challanNumber}
                          </Link>
                        </td>
                        <td className="py-3 px-3 font-medium">
                          <span className="text-slate-900 font-semibold">{ch.fromDepartment}</span>
                          <span className="text-slate-400 mx-1">→</span>
                          <span className="text-blue-900 font-bold">{ch.toDepartment}</span>
                        </td>
                        <td className="py-3 px-3 font-mono">
                          {ch.items?.[0]?.quantity || ch.totalQuantity || '—'} {ch.items?.[0]?.uom || 'PCS'}
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                            {ch.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[11px] text-slate-500">
                          {ch.createdAt ? new Date(ch.createdAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => downloadChallanHtml(ch)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 hover:text-emerald-900 bg-slate-100 hover:bg-emerald-50 px-2 py-1 rounded border border-slate-200 transition cursor-pointer"
                              title="Download Challan as standalone HTML/PDF"
                            >
                              <Download className="w-3 h-3 text-emerald-600" />
                              <span>Download</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => printChallan(ch)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 hover:text-blue-900 bg-slate-100 hover:bg-blue-50 px-2 py-1 rounded border border-slate-200 transition cursor-pointer"
                              title="Print Challan Slip"
                            >
                              <Printer className="w-3 h-3 text-slate-500" />
                              <span>Print</span>
                            </button>
                            <Link
                              href={`/challans/${ch.id}`}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded transition"
                            >
                              <Eye className="w-3 h-3" />
                              <span>View</span>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

      </main>

      {/* PRINT & DOWNLOAD MODAL */}
      <ProductionSheetPrintModal
        program={program}
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
      />
    </div>
  );
}
