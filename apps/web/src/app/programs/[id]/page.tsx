'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Send, 
  Printer, 
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

export default function ProgramDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [program, setProgram] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <div className="min-h-screen bg-[#F8FAFC] pl-64 flex items-center justify-center">
        <div className="text-xs text-slate-500 font-mono animate-pulse">
          Loading Production Sheet...
        </div>
      </div>
    );
  }

  if (error || !program) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] pl-64 p-8">
        <div className="max-w-xl mx-auto p-6 bg-rose-50 border border-rose-200 rounded-xl text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
          <h2 className="text-sm font-bold text-rose-900">Error Loading Sheet</h2>
          <p className="text-xs text-rose-700">{error || 'Production Sheet not found'}</p>
          <Link
            href="/"
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

  return (
    <div className="min-h-screen bg-[#F8FAFC] pl-64 pb-20">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-8 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
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

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-md border border-slate-300 transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Sheet</span>
          </button>

          {isDraft && (
            <button
              onClick={() => handleUpdateStatus('READY_FOR_ISSUE')}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-xs transition"
            >
              Mark Ready for Issue
            </button>
          )}

          <Link
            href={`/my-work/issue-challan?programId=${program.id}`}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#163767] hover:bg-[#0F264A] text-white text-xs font-semibold rounded-md shadow-xs transition"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Issue Challan</span>
          </Link>
        </div>
      </header>

      {/* BODY CONTENT - 8 SECTIONS */}
      <main className="p-8 max-w-5xl mx-auto space-y-6">
        
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

        {/* 8-SECTION SPECIFICATION CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* SEC 1: PROGRAM INFORMATION */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900 bg-blue-50 px-2 py-0.5 rounded">
              Section 1 · Program Identification
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
                <span className="text-slate-400 block text-[11px]">Client Priority</span>
                <span className="font-bold text-amber-700">{program.clientPriority || program.priority || 'NORMAL'}</span>
              </div>
            </div>
          </div>

          {/* SEC 2: STYLE INFORMATION */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 bg-amber-50 px-2 py-0.5 rounded">
              Section 2 · Style &amp; Pattern
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

          {/* SEC 3: WILCOM & EMBROIDERY */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-900 bg-purple-50 px-2 py-0.5 rounded">
              Section 3 · Wilcom &amp; Embroidery
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

          {/* SEC 4: FABRIC SPECIFICATIONS */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded">
              Section 4 · Fabric Specifications
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

          {/* SEC 5: DYEING */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-900 bg-rose-50 px-2 py-0.5 rounded">
              Section 5 · Dyeing Requirements
            </span>
            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <span className="text-slate-400 block text-[11px]">Dyeing Required?</span>
                <span className={`font-bold ${program.fabricDyeingRequired ? 'text-rose-700' : 'text-slate-700'}`}>
                  {program.fabricDyeingRequired ? 'YES (Undyed / Kora)' : 'NO (Pre-Dyed / Direct)'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Sent to Dyeing</span>
                <span className="font-mono text-slate-700">{program.fabricSentToDyeing || 0} Mtr</span>
              </div>
            </div>
          </div>

          {/* SEC 6: PRODUCTION QUANTITY & TRIMS */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded">
              Section 6 · Quantities &amp; Special Materials
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

          {/* SEC 7 & 8: DATES & REJECTION REMARKS */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-3 md:col-span-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
              Sections 7 &amp; 8 · Schedule, Quality Tolerances &amp; Comments
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-1">
              <div>
                <span className="text-slate-400 block text-[11px]">Production Design Date</span>
                <span className="text-slate-800">{program.productionDesignDate ? new Date(program.productionDesignDate).toLocaleDateString() : '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Projected End Date</span>
                <span className="text-slate-800">{program.productionEndDate ? new Date(program.productionEndDate).toLocaleDateString() : '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Pieces Rejection Tolerance</span>
                <span className="font-mono font-bold text-rose-700">{program.piecesRejection || 0} PCS</span>
              </div>
              <div className="sm:col-span-3">
                <span className="text-slate-400 block text-[11px]">Comments &amp; Operator Instructions</span>
                <p className="text-slate-700 font-serif italic mt-0.5">{program.comments || program.remarks || 'No special comments noted.'}</p>
              </div>
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}
