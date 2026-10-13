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
  Sparkles
} from 'lucide-react';
import { api } from '@/lib/api';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';
import { 
  downloadProductionSheetHtml, 
  printProductionSheet 
} from '@/lib/download-production-sheet';

export default function ProgramDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [program, setProgram] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const loadProgram = async () => {
    try {
      setLoading(true);
      const data = await api.getProgram(id);
      setProgram(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load Production Sheet');
    } finally {
      setLoading(false);
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

          <Link
            href={`/my-work/issue-challan?programId=${program.id}`}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#163767] hover:bg-[#0F264A] text-white text-xs font-semibold rounded-md shadow-xs transition"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Issue Challan</span>
          </Link>
        </div>
      </header>

      {/* BODY CONTENT - 8 SECTIONS */}
      <main className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
        
        {/* SUMMARY STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 bg-white border border-slate-200/90 rounded-xl shadow-xs text-xs">
          <div>
            <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">Client</span>
            <span className="font-bold text-slate-900 text-sm">{program.clientName || program.buyerName || 'Standard Client'}</span>
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
                const config: Record<string, { badge: string; border: string; desc: string }> = {
                  LOW: {
                    badge: 'bg-slate-100 text-slate-800 border-slate-300',
                    border: 'border-slate-200 bg-slate-50/50',
                    desc: 'Routine manufacturing queue, flexible lead time',
                  },
                  NORMAL: {
                    badge: 'bg-blue-100 text-blue-900 border-blue-300',
                    border: 'border-blue-200 bg-blue-50/40',
                    desc: 'Standard production pipeline and dispatch schedule',
                  },
                  HIGH: {
                    badge: 'bg-amber-100 text-amber-900 border-amber-300',
                    border: 'border-amber-200 bg-amber-50/40',
                    desc: 'Priority queue for expedited delivery commitments',
                  },
                  URGENT: {
                    badge: 'bg-rose-100 text-rose-900 border-rose-300',
                    border: 'border-rose-200 bg-rose-50/40',
                    desc: 'Immediate dispatch & top floor priority across departments',
                  },
                };
                const current = config[priority] || config.NORMAL;
                return (
                  <div className={`p-3 rounded-lg border ${current.border} flex items-center justify-between`}>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-black px-2.5 py-0.5 rounded border ${current.badge}`}>
                          {priority}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600">{current.desc}</p>
                    </div>
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
                <span className="text-slate-400 block text-[11px]">Sub Style</span>
                <span className="text-slate-700">{program.subStyle || 'Standard'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Pattern Ref #</span>
                <span className="font-mono text-slate-700">{program.pattern || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Base Design Type</span>
                <span className="text-slate-700">{program.baseDesignType || 'Standard'}</span>
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
            </div>
          </div>

          {/* PRODUCTION QUANTITY & TRIMS */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded">
              Quantities &amp; Special Materials
            </span>
            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <span className="text-slate-400 block text-[11px]">Total Color Qty</span>
                <span className="font-mono font-bold text-slate-900">{program.colorQuantity || program.targetQuantity} {program.quantityMeasurement || 'PCS'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Special Material</span>
                <span className="text-slate-700">{program.specialMaterial || 'None'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 block text-[11px]">Special Material Quantity</span>
                <span className="text-slate-700">{program.specialMaterialQuantity || '—'}</span>
              </div>
            </div>
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
