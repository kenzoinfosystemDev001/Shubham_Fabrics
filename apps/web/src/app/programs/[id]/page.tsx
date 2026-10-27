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
  Palette,
  Ruler,
  Plus,
  Lock,
  ShieldCheck,
  Check,
  Building,
  RefreshCw,
  Upload,
  X
} from 'lucide-react';
import { api } from '@/lib/api';
import { getCurrentUser, canViewClientCode } from '@/lib/rbac';
import { ProductionSheetPrintModal } from '@/components/production-sheet/ProductionSheetPrintModal';
import { DocumentActionButtons } from '@/components/common/DocumentActionButtons';
import { ProductionSheetView } from '@/components/production-sheet/ProductionSheetView';
import { 
  downloadProductionSheetHtml, 
  printProductionSheet,
  extractSubStylesAndGrid,
  GarmentCategory,
  productionSheetCategoriesForViewer,
} from '@/lib/download-production-sheet';
import { WilcomPrintModal } from '@/components/wilcom/WilcomPrintModal';
import { 
  printWilcomForm, 
  downloadWilcomFormHtml,
  extractRootWilcomPhoto,
  inheritedWilcomPhoto
} from '@/lib/download-wilcom';
import { ChallanListTable } from '@/components/challan/ChallanListTable';
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
  const [viewingPhotoModal, setViewingPhotoModal] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showWilcomPrintModal, setShowWilcomPrintModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeCategoryTab, setActiveCategoryTab] = useState<GarmentCategory>('TOP');

  useEffect(() => {
    setCurrentUser(getCurrentUser());
  }, []);

  const loadProgram = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getProgram(id);
      if (!data) {
        throw new Error('Production Sheet not found');
      }
      setProgram(data);
      setChallans(data.challans || []);

      // Non-blocking fetch of fabric store availability
      fetch(`/api/fabric-store/check-availability?programId=${encodeURIComponent(id)}`)
        .then((r) => r.json())
        .then((availRes) => {
          if (availRes?.data) setStoreAvailability(availRes.data);
        })
        .catch(() => {});
    } catch (err: any) {
      console.error('Failed to load production sheet:', err);
      const rawMsg = err.message || '';
      const displayMsg = rawMsg.toLowerCase().includes('abort') || rawMsg.toLowerCase().includes('timeout')
        ? 'Network request timed out while loading the sheet. Please click Retry below.'
        : rawMsg || 'Failed to load Production Sheet';
      setError(displayMsg);
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
      <div className="min-h-screen bg-neutral-50 pl-0 md:pl-64 flex items-center justify-center">
        <div className="text-xs text-neutral-500 font-mono animate-pulse">
          Loading Production Sheet...
        </div>
      </div>
    );
  }

  if (error || !program) {
    return (
      <div className="min-h-screen bg-neutral-50 pl-0 md:pl-64 p-4 sm:p-8 flex items-center justify-center">
        <div className="max-w-md w-full p-6 bg-danger-50 border border-danger-200 rounded-2xl text-center space-y-4 shadow-xs">
          <AlertCircle className="w-10 h-10 text-danger-600 mx-auto" />
          <h2 className="text-base font-bold text-danger-900">Error Loading Sheet</h2>
          <p className="text-xs text-danger-700 leading-relaxed">{error || 'Production Sheet not found'}</p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={loadProgram}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
            <Link
              href="/programming"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-danger-800 hover:bg-danger-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
            >
              ← Return to Dashboard
            </Link>
          </div>
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
  // Every Production Sheet of this production (any number); the selected tab falls back to the first.
  const componentCategories: GarmentCategory[] = productionSheetCategoriesForViewer(program);
  const forwardedComponents: string[] = Array.isArray(meta?.forwardedComponents) ? meta.forwardedComponents : ['TOP'];
  
  const rootWilcomPhoto = extractRootWilcomPhoto(program, meta);
  let wilcomEntries: any[] = [];
  if (Array.isArray(program.wilcomEntries) && program.wilcomEntries.length > 0) {
    wilcomEntries = program.wilcomEntries;
  } else if (Array.isArray(meta?.wilcomEntries) && meta.wilcomEntries.length > 0) {
    wilcomEntries = meta.wilcomEntries;
  }

  const progDesignNo = program.designNumber || program.designName || '—';
  const progMainStyle = program.mainStyle || program.topName || meta?.mainStyle || meta?.topName || '—';
  const progSubStyle = program.subStyle || program.styleCode || meta?.subStyle || meta?.style || '—';

  if (wilcomEntries.length === 0) {
    wilcomEntries = [
      {
        id: 'wilcom-auto-1',
        category: 'TOP',
        styleName: progSubStyle !== '—' ? progSubStyle : (progMainStyle !== '—' ? progMainStyle : 'Primary Top Style'),
        wilcomDesignNumber: program.wilcomDesignNumber || program.embroideryDesign || (progDesignNo !== '—' ? progDesignNo : 'WLC-01'),
        photoUrl: rootWilcomPhoto,
        remarks: program.remarks || program.comments || '',
      },
    ];
  } else {
    wilcomEntries = wilcomEntries.map((e: any) => ({
      ...e,
      photoUrl: e.photoUrl || e.photo || e.imageUrl || e.image || inheritedWilcomPhoto(e, rootWilcomPhoto) || '',
    }));
  }

  const activeCategory: GarmentCategory = componentCategories.includes(activeCategoryTab) ? activeCategoryTab : componentCategories[0];

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
    <div className="min-h-screen bg-neutral-50 pl-0 md:pl-64 pb-20">
      {/* HEADER */}
      <header className="bg-white border-b border-neutral-200/80 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleBack}
            className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition cursor-pointer"
            title="Back to my department station"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold font-mono text-neutral-900">
                {program.programSerialNo || program.programNumber}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  isDraft
                    ? 'bg-accent-100 text-accent-800'
                    : isReady
                    ? 'bg-brand-100 text-brand-900'
                    : isIssued
                    ? 'bg-accent-100 text-accent-800'
                    : 'bg-brand-100 text-brand-900'
                }`}
              >
                {program.status}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <DocumentActionButtons
            program={program}
            challan={challans?.[0]}
            size="sm"
          />

          {isDraft && (
            <button
              onClick={() => handleUpdateStatus('READY_FOR_ISSUE')}
              className="px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-md shadow-xs transition cursor-pointer"
            >
              Mark Ready
            </button>
          )}

          {currentUser?.departmentCode === 'STORE' || currentUser?.role === 'STORE_INCHARGE' || currentUser?.role === 'FABRIC_STORE' ? (
            <Link
              href={`/fabric-store/my-work/issue-challan?programId=${program.id}`}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-700 hover:bg-brand-800 text-white text-xs font-semibold rounded-md shadow-xs transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Issue Store Challan</span>
            </Link>
          ) : (
            <Link
              href={`/my-work/issue-challan?programId=${program.id}`}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-md shadow-xs transition"
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
              ? 'bg-accent-50/80 border-accent-300 text-accent-800'
              : 'bg-accent-50/90 border-accent-300 text-accent-800'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className={`p-2.5 rounded-lg shrink-0 ${
                  storeAvailability?.isAvailable ? 'bg-accent-400 text-neutral-900' : 'bg-accent-400 text-neutral-900'
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
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded font-mono bg-white/90 border border-neutral-200">
                    Fabric Store Gatekeeper
                  </span>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                      storeAvailability?.isAvailable
                        ? 'bg-accent-200 text-accent-800 border border-accent-300'
                        : 'bg-accent-200 text-accent-800 border border-accent-300'
                    }`}
                  >
                    {storeAvailability?.isAvailable ? (
                      <>
                        <Check className="w-3 h-3 text-accent-800" />
                        Movement Cleared
                      </>
                    ) : (
                      <>
                        <Lock className="w-3 h-3 text-accent-800" />
                        Movement Blocked (Awaiting Fabric in Store)
                      </>
                    )}
                  </span>
                  <span className="text-[10px] font-mono text-neutral-600">
                    Next Dept:{' '}
                    <strong>{program.fabricDyeingRequired ? 'Dyeing' : 'Embroidery / Cutting'}</strong>
                  </span>
                </div>

                <h3 className="text-sm font-bold text-neutral-900">
                  {storeAvailability?.isAvailable
                    ? `Fabric available in store (${storeAvailability.totalStoreStockMeters || 0}m). Production Sheet authorized to move.`
                    : `Production Sheet cannot move to ${program.fabricDyeingRequired ? 'Dyeing' : 'Embroidery'} until fabric is in Store.`}
                </h3>

                <p className="text-xs text-neutral-600 leading-relaxed max-w-2xl">
                  {storeAvailability?.message ||
                    (storeAvailability?.isAvailable
                      ? 'Physical fabric stock confirmed in store inventory.'
                      : 'Required fabric rolls or inward balance not found in store.')}
                </p>

                {storeAvailability?.fabricStoreVerified && (
                  <p className="text-[11px] text-accent-800 font-semibold pt-0.5">
                    Verified by {storeAvailability.fabricStoreVerifiedBy || 'Store Incharge'}
                    {storeAvailability.fabricStoreVerifiedAt &&
                      ` on ${new Date(storeAvailability.fabricStoreVerifiedAt).toLocaleDateString()}`}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-center shrink-0">
              <Link
                href="/fabric-store/inventory/inward"
                className="text-xs font-semibold px-3 py-1.5 bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-300 rounded-md transition shadow-2xs"
              >
                Inward Stock
              </Link>
              {storeAvailability?.isAvailable ? (
                <button
                  type="button"
                  onClick={() => handleToggleStoreVerification(false)}
                  disabled={verifyingStore}
                  className="text-xs font-semibold px-3 py-1.5 bg-white hover:bg-danger-50 text-danger-700 border border-danger-300 rounded-md transition cursor-pointer"
                  title="Mark fabric missing/out of stock and hold movement"
                >
                  {verifyingStore ? 'Updating…' : 'Mark Out of Stock'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleToggleStoreVerification(true)}
                  disabled={verifyingStore}
                  className="text-xs font-semibold px-3 py-1.5 bg-brand-700 hover:bg-brand-800 text-white rounded-md transition cursor-pointer flex items-center gap-1 shadow-xs"
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 bg-white border border-neutral-200/90 rounded-xl shadow-xs text-xs">
          <div>
            <span className="text-neutral-500 block text-[10px] font-semibold uppercase tracking-wider">Client</span>
            <span className="font-bold text-neutral-900 text-sm">{program.clientName || program.buyerName || 'Standard Client'}</span>
            {isClientCodeVisible && (
              <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-accent-50 text-accent-800 border border-accent-200 block w-fit">
                <span>Code:</span>
                <span>{program.clientCode}</span>
              </span>
            )}
          </div>
          <div>
            <span className="text-neutral-500 block text-[10px] font-semibold uppercase tracking-wider">Main Style</span>
            <span className="font-bold text-neutral-900 text-sm">{program.mainStyle || program.styleCode || '—'}</span>
          </div>
          <div>
            <span className="text-neutral-500 block text-[10px] font-semibold uppercase tracking-wider">Target Quantity</span>
            <span className="font-bold font-mono text-neutral-900 text-sm">
              {program.colorQuantity || program.targetQuantity} {program.quantityMeasurement || 'PCS'}
            </span>
          </div>
          <div>
            <span className="text-neutral-500 block text-[10px] font-semibold uppercase tracking-wider">Delivery Target</span>
            <span className="font-bold text-danger-700 text-sm">
              {program.deliveryDate ? new Date(program.deliveryDate).toLocaleDateString() : '—'}
            </span>
          </div>
        </div>

        {/* SPECIFICATION DETAILS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* PROGRAM INFORMATION */}
          <div className="bg-white border border-neutral-200/90 rounded-xl p-5 shadow-xs space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-900 bg-brand-50 px-2 py-0.5 rounded">
              Program Identification
            </span>
            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <span className="text-neutral-500 block text-[11px]">Program Serial #</span>
                <span className="font-mono font-bold text-neutral-900">{program.programSerialNo || program.programNumber}</span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[11px]">Design Number</span>
                <span className="font-semibold text-neutral-900">{program.designNumber || '—'}</span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[11px]">Start Date</span>
                <span className="text-neutral-700">{program.startDate ? new Date(program.startDate).toLocaleDateString() : '—'}</span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[11px]">Delivery Date</span>
                <span className="font-semibold text-danger-700">{program.deliveryDate ? new Date(program.deliveryDate).toLocaleDateString() : '—'}</span>
              </div>
              {isClientCodeVisible && (
                <div className="col-span-2 mt-2 p-2.5 bg-accent-50/80 rounded-lg border border-accent-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-neutral-700 uppercase tracking-wider block">
                      Client Code (Confidential)
                    </span>
                    <span className="font-mono font-black text-accent-800 text-sm">
                      {program.clientCode}
                    </span>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-accent-200/90 text-accent-800 border border-accent-300">
                    Admin &amp; Programming Only
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* PRIORITY */}
          <div className="bg-white border border-neutral-200/90 rounded-xl p-5 shadow-xs space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-danger-900 bg-danger-50 px-2 py-0.5 rounded">
              Priority &amp; Dispatch Urgency
            </span>
            <div className="pt-1">
              {(() => {
                const priority = (program.clientPriority || program.priority || 'NORMAL').toUpperCase();
                const config: Record<string, { badge: string; border: string }> = {
                  LOW: {
                    badge: 'bg-neutral-100 text-neutral-900 border-neutral-300',
                    border: 'border-neutral-200 bg-neutral-50/50',
                  },
                  NORMAL: {
                    badge: 'bg-brand-100 text-brand-900 border-brand-300',
                    border: 'border-brand-200 bg-brand-50/40',
                  },
                  HIGH: {
                    badge: 'bg-accent-100 text-accent-800 border-accent-300',
                    border: 'border-accent-200 bg-accent-50/40',
                  },
                  URGENT: {
                    badge: 'bg-danger-100 text-danger-900 border-danger-300',
                    border: 'border-danger-200 bg-danger-50/40',
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
          <div className="bg-white border border-neutral-200/90 rounded-xl p-5 shadow-xs space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-accent-800 bg-accent-50 px-2 py-0.5 rounded">
              Style &amp; Pattern
            </span>
            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <span className="text-neutral-500 block text-[11px]">Main Style</span>
                <span className="font-semibold text-neutral-900">{program.mainStyle || program.styleCode}</span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[11px]">Pattern Ref #</span>
                <span className="font-mono text-neutral-700">{program.pattern || '—'}</span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[11px]">Base Design Type</span>
                <span className="text-neutral-700">{program.baseDesignType || 'Standard'}</span>
              </div>
              <div className="col-span-2 pt-2 border-t border-neutral-100">
                <span className="text-neutral-500 block text-[11px] mb-1 font-bold uppercase tracking-wider">
                  Sub Styles ({programSubStyles.length})
                </span>
                {programSubStyles.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {programSubStyles.map((sub: string, sIdx: number) => (
                      <span
                        key={sIdx}
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-accent-50 border border-accent-200 text-accent-800 font-semibold text-[11px] shadow-2xs"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-400 shrink-0" />
                        <span>{sub}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-neutral-500 italic text-xs">Standard</span>
                )}
              </div>
            </div>
          </div>

          {/* WILCOM & EMBROIDERY */}
          <div className="bg-white border border-neutral-200/90 rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-900 bg-brand-50 px-2 py-0.5 rounded">
                Wilcom &amp; Embroidery
              </span>
              <button
                type="button"
                onClick={() => setShowWilcomPrintModal(true)}
                className="text-[11px] font-bold text-brand-700 hover:text-brand-900 flex items-center gap-1 cursor-pointer"
              >
                <span>View Wilcom Form</span>
                <span className="font-mono text-[10px] bg-brand-100 text-brand-900 px-1.5 py-0.2 rounded-full font-bold">
                  {wilcomEntries.length}
                </span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <span className="text-neutral-500 block text-[11px]">Wilcom Design #</span>
                <span className="font-mono font-bold text-brand-900">{program.wilcomDesignNumber || 'WLC-N/A'}</span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[11px]">Embroidery Design</span>
                <span className="text-neutral-700">{program.embroideryDesign || 'Standard Embroidery'}</span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[11px]">Design Size</span>
                <span className="text-neutral-700">{program.embroideryDesignSize || 'Standard Size'}</span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[11px]">Wilcom Artwork</span>
                <span className="text-neutral-700 font-semibold">{rootWilcomPhoto ? 'Photo Uploaded' : 'No photo uploaded'}</span>
              </div>

              {/* WILCOM IMAGE THUMBNAIL / UPLOAD IN SPECIFICATION CARD */}
              <div className="col-span-2 pt-2.5 border-t border-brand-100 flex items-center justify-between gap-3">
                {rootWilcomPhoto ? (
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 border border-brand-300 rounded-md bg-brand-50/50 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                      <img
                        src={rootWilcomPhoto}
                        alt={program.wilcomDesignNumber || 'Wilcom Artwork'}
                        className="w-full h-full object-contain cursor-pointer hover:scale-105 transition"
                        onClick={() => setViewingPhotoModal(rootWilcomPhoto)}
                        title="Click to view full photo"
                      />
                    </div>
                    <div>
                      <span className="font-bold text-neutral-900 text-xs block">Wilcom Design Reference</span>
                      <button
                        type="button"
                        onClick={() => setViewingPhotoModal(rootWilcomPhoto)}
                        className="text-[11px] font-bold text-brand-700 hover:text-brand-900 hover:underline flex items-center gap-1 mt-0.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Enlarge Photo</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-900 border border-brand-200 rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs">
                    <Upload className="w-3.5 h-3.5 text-brand-700" />
                    <span>Upload Wilcom Artwork Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = async () => {
                          if (typeof reader.result === 'string') {
                            const newPhoto = reader.result;
                            setProgram((prev: any) => ({
                              ...prev,
                              wilcomDesignPhoto: newPhoto,
                            }));
                            try {
                              await fetch(`/api/programs/${program.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  wilcomDesignPhoto: newPhoto,
                                }),
                              });
                            } catch (err) {
                              console.warn('Failed to save photo:', err);
                            }
                          }
                        };
                        reader.readAsDataURL(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* FABRIC SPECIFICATIONS */}
          <div className="bg-white border border-neutral-200/90 rounded-xl p-5 shadow-xs space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-accent-800 bg-accent-50 px-2 py-0.5 rounded">
              Fabric Specifications
            </span>
            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <span className="text-neutral-500 block text-[11px]">Fabric Name</span>
                <span className="font-semibold text-neutral-900">{program.fabricName || 'Cotton'}</span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[11px]">Fabric Type</span>
                <span className="text-neutral-700">{program.fabricType || 'Woven'}</span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[11px]">Fabric Width</span>
                <span className="font-mono text-neutral-900">{program.fabricWidthInches || '58'} Inches</span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[11px]">Fabric Color</span>
                <span className="font-semibold text-neutral-900">{program.fabricColor || 'Natural'}</span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[11px]">Fabric Average</span>
                <span className="font-mono text-neutral-900">{program.fabricAverage || '1.25'} {program.fabricAverageType || 'Mtr/Pc'}</span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[11px]">Color Availability</span>
                <span className="font-semibold text-accent-800">{program.fabricColorAvailable || 'IN_STOCK'}</span>
              </div>
            </div>
          </div>

          {/* DYEING */}
          <div className="bg-white border border-neutral-200/90 rounded-xl p-5 shadow-xs space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-danger-900 bg-danger-50 px-2 py-0.5 rounded">
              Dyeing Requirements
            </span>
            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <span className="text-neutral-500 block text-[11px]">Dyeing Required?</span>
                <span className={`font-bold ${program.fabricDyeingRequired ? 'text-danger-700' : 'text-neutral-700'}`}>
                  {program.fabricDyeingRequired ? 'YES (Undyed / Kora)' : 'NO (Pre-Dyed / Direct)'}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[11px]">Next Department Flow</span>
                <span className={`font-bold ${program.fabricDyeingRequired ? 'text-accent-800' : 'text-accent-800'}`}>
                  {program.fabricDyeingRequired ? 'Dyeing Department' : 'Embroidery Department'}
                </span>
              </div>
            </div>
          </div>

          {/* PRODUCTION SHEET SPECIFICATION & BREAKDOWN */}
          <div className="bg-white border-2 border-neutral-200 rounded-lg p-5 shadow-xs space-y-4 md:col-span-2 text-neutral-900">
            {/* PRODUCTION SHEET COMPONENT SELECTOR */}
            <div className="flex items-center gap-2 pb-2 border-b border-neutral-200 overflow-x-auto">
              {componentCategories.map((cat) => {
                const isEnabled = components ? components[cat]?.enabled !== false : (cat === 'TOP');
                const isForwarded = forwardedComponents.includes(cat);
                const categoryName = components?.[cat]?.styleName || (cat === 'OTHER' ? 'INPUT' : cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategoryTab(cat)}
                    className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      activeCategory === cat
                        ? 'bg-brand-600 text-white shadow-2xs'
                        : isEnabled
                          ? 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200 border border-neutral-300'
                          : 'bg-neutral-50 text-neutral-500 border border-neutral-200'
                    }`}
                  >
                    <span>{categoryName} Sheet</span>
                    {isForwarded && (
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-400" title="Forwarded Component" />
                    )}
                  </button>
                );
              })}

            </div>

            <ProductionSheetView
              program={program}
              activeCategory={activeCategory}
              onCategoryChange={(cat) => setActiveCategoryTab(cat)}
              onOpenPrintModal={() => setShowPrintModal(true)}
              isClientCodeVisible={isClientCodeVisible}
            />
          </div>

          {/* PRODUCTION DATES */}
          <div className="bg-white border border-neutral-200/90 rounded-xl p-5 shadow-xs space-y-3 md:col-span-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded">
              Production Dates
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
              <div>
                <span className="text-neutral-500 block text-[11px]">Production Design Date</span>
                <span className="text-neutral-900">{program.productionDesignDate ? new Date(program.productionDesignDate).toLocaleDateString() : '—'}</span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[11px]">Projected End Date</span>
                <span className="text-neutral-900">{program.productionEndDate ? new Date(program.productionEndDate).toLocaleDateString() : '—'}</span>
              </div>
            </div>
          </div>

          {/* DISPATCHED CHALLANS ACCOMPANYING THIS PRODUCTION SHEET */}
          <div className="bg-white border border-neutral-200/90 rounded-xl p-5 shadow-xs space-y-4 md:col-span-2">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">
                  Accompanying Departmental Challans ({challans.length})
                </h3>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Physical and digital challans traveling department-to-department with this Production Sheet
                </p>
              </div>
              <Link
                href={`/my-work/issue-challan?programId=${program.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-md shadow-xs transition"
              >
                <Send className="w-3.5 h-3.5" />
                <span>+ Issue New Challan</span>
              </Link>
            </div>
            <ChallanListTable challans={challans} emptyMessage="No dispatch challans issued for this production sheet yet." />
          </div>

        </div>

      </main>

      {/* PRINT & DOWNLOAD MODALS */}
      <ProductionSheetPrintModal
        program={program}
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        initialTab={activeCategory}
      />

      <WilcomPrintModal
        program={program}
        isOpen={showWilcomPrintModal}
        onClose={() => setShowWilcomPrintModal(false)}
        initialCategory="ALL"
        onViewSheet={() => {
          setShowWilcomPrintModal(false);
          setShowPrintModal(true);
        }}
        onProgramUpdate={(updated) => setProgram((prev: any) => ({ ...prev, ...updated }))}
      />

      {/* PHOTO LIGHTBOX MODAL */}
      {viewingPhotoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/80 backdrop-blur-xs p-4 cursor-pointer"
          onClick={() => setViewingPhotoModal(null)}
        >
          <div
            className="relative max-w-3xl max-h-[90vh] bg-white p-4 rounded-xl shadow-2xl flex flex-col items-center cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-2 border-b border-neutral-200">
              <span className="text-xs font-bold text-neutral-900">Wilcom Design Artwork Reference</span>
              <button
                aria-label="Close"
                type="button"
                onClick={() => setViewingPhotoModal(null)}
                className="text-neutral-500 hover:text-neutral-900 text-sm font-black p-1 hover:bg-neutral-100 rounded transition cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            <div className="p-3 overflow-auto max-h-[75vh] flex items-center justify-center">
              <img
                src={viewingPhotoModal}
                alt="Wilcom Design Artwork"
                className="max-w-full max-h-[70vh] object-contain rounded border border-neutral-200 shadow-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
