'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  Palette, 
  Cpu, 
  Scissors, 
  Droplet, 
  Hash, 
  Calendar, 
  MessageSquare,
  Sparkles,
  RefreshCw,
  Printer,
  Download,
  Eye,
  ExternalLink
} from 'lucide-react';
import { ImageUpload } from '@/components/ImageUpload';
import { api } from '@/lib/api';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';
import { 
  downloadProductionSheetHtml, 
  printProductionSheet 
} from '@/lib/download-production-sheet';

export default function CreateProductionSheetPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<any | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [createdProgramId, setCreatedProgramId] = useState<string | null>(null);
  const [fabricAvailability, setFabricAvailability] = useState<{
    availableMeters: number;
    requiredMeters: number;
    matchingRollCount: number;
    sufficient: boolean;
  } | null>(null);
  const [checkingFabricAvailability, setCheckingFabricAvailability] = useState(false);
  const [fabricAvailabilityError, setFabricAvailabilityError] = useState<string | null>(null);

  // FORM STATE - All 8 Sections of Shubham Fabrics Production Sheet
  const [formData, setFormData] = useState({
    // SECTION 1: Program Information
    programSerialNo: '',
    startDate: '',
    designNumber: '',
    clientName: '',
    clientPriority: 'NORMAL',
    deliveryDate: '',

    // SECTION 2: Style Information
    mainStyle: '',
    subStyle: '',
    pattern: '',
    baseDesignType: '',
    baseDesignPhoto: '',

    // SECTION 3: Design Information
    wilcomDesignNumber: '',
    wilcomDesignPhoto: '',
    embroideryDesign: '',
    embroideryDesignSize: '',

    // SECTION 4: Fabric Information
    fabricName: '',
    fabric: '',
    fabricType: '',
    fabricWidth: '',
    fabricWidthInches: '',
    fabricColor: '',
    fabricColorAvailable: 'IN_STOCK',
    fabricAverage: '',
    fabricAverageType: '',
    fabricAverageMeasurement: '',

    // SECTION 5: Dyeing Information
    fabricDyeingRequired: false,
    fabricIssuedToDyeing: '',
    fabricSentToDyeing: '',

    // SECTION 6: Production Quantity
    color: '',
    colorQuantity: '',
    quantityMeasurement: 'PCS',
    specialMaterial: '',
    specialMaterialQuantity: '',

    // SECTION 7: Production Dates
    productionDesignDate: '',
    productionEndDate: '',

    // SECTION 8: Rejection / Remarks
    piecesRejection: '',
    rejectionReason: '',
    comments: '',
  });

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    const fabricName = formData.fabricName.trim();
    const fabricAverage = Number(formData.fabricAverage);
    const productionQuantity = Number(formData.colorQuantity);

    setFabricAvailability(null);
    setFabricAvailabilityError(null);

    if (
      !fabricName ||
      !Number.isFinite(fabricAverage) ||
      fabricAverage <= 0 ||
      !Number.isInteger(productionQuantity) ||
      productionQuantity <= 0
    ) {
      setCheckingFabricAvailability(false);
      return;
    }

    let active = true;
    setCheckingFabricAvailability(true);
    const timeout = window.setTimeout(() => {
      api.getFabricAvailability({
        fabricName,
        fabricColor: formData.fabricColor.trim(),
        fabricAverage,
        productionQuantity,
      })
        .then((availability) => {
          if (active) setFabricAvailability(availability);
        })
        .catch((err: Error) => {
          if (active) setFabricAvailabilityError(err.message || 'Unable to check Fabric Store stock.');
        })
        .finally(() => {
          if (active) setCheckingFabricAvailability(false);
        });
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [
    formData.fabricName,
    formData.fabricColor,
    formData.fabricAverage,
    formData.colorQuantity,
  ]);

  const canMarkReady =
    formData.fabricColorAvailable === 'IN_STOCK' &&
    fabricAvailability?.sufficient === true &&
    !checkingFabricAvailability &&
    !fabricAvailabilityError;

  const handleSubmit = async (targetStatus: 'DRAFT' | 'IN_PROGRESS' | 'READY_FOR_ISSUE') => {
    setError(null);
    setSuccess(null);

    if (targetStatus === 'READY_FOR_ISSUE' && !canMarkReady) {
      setError(
        fabricAvailabilityError ||
          'A production sheet can only be marked ready when enough matching, QC-passed fabric is available in the Fabric Store.',
      );
      return;
    }

    // Basic required field validations
    if (targetStatus !== 'DRAFT') {
      if (!formData.clientName.trim()) {
        setError('Client Name is mandatory.');
        return;
      }
      if (!formData.mainStyle.trim()) {
        setError('Main Style is mandatory.');
        return;
      }
      if (!formData.wilcomDesignNumber.trim()) {
        setError('Wilcom Design Number is mandatory for embroidery manufacturing.');
        return;
      }
    } else {
      if (!formData.clientName.trim() && !formData.programSerialNo.trim() && !formData.designNumber.trim()) {
        setError('Please enter at least Client Name, Design #, or Serial # to save as draft.');
        return;
      }
    }

    setLoading(true);
    try {
      const payload: any = {
        ...formData,
        id: createdProgramId || undefined,
        programNumber: formData.programSerialNo.trim() || undefined,
        programSerialNo: formData.programSerialNo.trim() || undefined,
        status: targetStatus,
        fabricDyeingRequired: Boolean(formData.fabricDyeingRequired),
        fabricWidthInches: formData.fabricWidthInches ? parseFloat(formData.fabricWidthInches) : null,
        fabricAverage: formData.fabricAverage ? parseFloat(formData.fabricAverage) : null,
        colorQuantity: formData.colorQuantity ? parseInt(formData.colorQuantity, 10) : 0,
        targetQuantity: formData.colorQuantity ? parseInt(formData.colorQuantity, 10) : 0,
        piecesRejection: formData.piecesRejection ? parseInt(formData.piecesRejection, 10) : 0,
        fabricIssuedToDyeing: formData.fabricIssuedToDyeing ? parseFloat(formData.fabricIssuedToDyeing) : 0,
        fabricSentToDyeing: formData.fabricSentToDyeing ? parseFloat(formData.fabricSentToDyeing) : 0,
      };

      const result = await api.createProductionSheet(payload);
      if (result?.id) {
        setCreatedProgramId(result.id);
      }
      setSuccess(result);
    } catch (err: any) {
      setError(err.message || 'Failed to save Production Sheet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pl-0 md:pl-64 pb-20">
      {/* TOP HEADER */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-4">
          <Link
            href="/my-work"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A66E22] block">
              MY WORK · PRODUCTION SHEET
            </span>
            <h1 className="text-xl font-bold text-slate-900">
              Create Production Sheet
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleSubmit('DRAFT')}
            disabled={loading}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-md border border-slate-300 shadow-xs transition"
          >
            Save as Draft
          </button>
          <button
            type="button"
            onClick={() => handleSubmit('IN_PROGRESS')}
            disabled={loading}
            className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-900 text-xs font-semibold rounded-md border border-blue-300 shadow-xs transition"
          >
            Mark In Progress
          </button>
          <button
            type="button"
            onClick={() => handleSubmit('READY_FOR_ISSUE')}
            disabled={loading || !canMarkReady}
            className="px-4 py-2 bg-[#163767] hover:bg-[#0F264A] text-white text-xs font-semibold rounded-md shadow-xs transition flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Submit Ready for Issue</span>
          </button>
        </div>
      </header>

      {/* FORM BODY */}
      <main className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
        
        {/* Error State */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Modal / Banner */}
        {success && (
          <div className="p-6 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-bold">
                Production Sheet Successfully Created: {success.programSerialNo || success.programNumber}
              </h3>
            </div>
            <p className="text-xs text-emerald-800 leading-relaxed font-serif">
              Status is marked as <strong className="font-bold">{success.status}</strong>. You can now immediately issue a Challan for downstream factory movement or return to the dashboard.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => printProductionSheet(success)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-xs transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Sheet (A4)</span>
              </button>

              <button
                type="button"
                onClick={() => downloadProductionSheetHtml(success)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-md shadow-xs transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download File (.html / PDF)</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPrintModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-emerald-300 text-emerald-800 text-xs font-semibold rounded-md hover:bg-emerald-100/60 transition cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview Document</span>
              </button>

              <Link
                href={`/programs/${success.id}`}
                className="inline-flex items-center gap-1 px-3 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-md hover:bg-slate-50 transition"
              >
                <span>View Details</span>
                <ExternalLink className="w-3 h-3" />
              </Link>

              <Link
                href={`/my-work/issue-challan?programId=${success.id}`}
                className="px-3.5 py-2 bg-[#163767] hover:bg-[#0F264A] text-white text-xs font-semibold rounded-md shadow-xs transition"
              >
                Proceed to Issue Challan →
              </Link>

              <Link
                href="/programming"
                className="px-3 py-2 bg-white border border-slate-200 text-slate-600 text-xs font-medium rounded-md hover:bg-slate-50 transition"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        )}

        {/* PRODUCTION SHEET FORM */}
        <div className="space-y-6">

          {/* PROGRAM INFORMATION */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">Program Information</h2>
              <p className="text-[11px] text-slate-500">Core manufacturing order identification</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Program Serial #
                </label>
                <input
                  type="text"
                  value={formData.programSerialNo}
                  onChange={(e) => handleChange('programSerialNo', e.target.value)}
                  placeholder=""
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Program Start Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.startDate}
                  onChange={(e) => handleChange('startDate', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Program Design # *
                </label>
                <input
                  type="text"
                  required
                  value={formData.designNumber}
                  onChange={(e) => handleChange('designNumber', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Client Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.clientName}
                  onChange={(e) => handleChange('clientName', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Client Delivery Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.deliveryDate}
                  onChange={(e) => handleChange('deliveryDate', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-800"
                />
              </div>
            </div>
          </div>

          {/* PRIORITY */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">Priority</h2>
              <p className="text-[11px] text-slate-500">Order execution urgency and shopfloor production scheduling</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {[
                {
                  id: 'LOW',
                  label: 'LOW',
                  desc: 'Routine manufacturing queue, flexible lead time',
                  color: 'border-slate-200 hover:border-slate-400 text-slate-700',
                  activeBg: 'bg-slate-50 border-slate-600 ring-2 ring-slate-400/20 text-slate-900',
                  badge: 'bg-slate-100 text-slate-700',
                },
                {
                  id: 'NORMAL',
                  label: 'NORMAL',
                  desc: 'Standard production pipeline and dispatch schedule',
                  color: 'border-slate-200 hover:border-blue-400 text-slate-700',
                  activeBg: 'bg-blue-50/80 border-blue-600 ring-2 ring-blue-500/20 text-blue-950',
                  badge: 'bg-blue-100 text-blue-800',
                },
                {
                  id: 'HIGH',
                  label: 'HIGH',
                  desc: 'Priority queue for expedited delivery commitments',
                  color: 'border-slate-200 hover:border-amber-400 text-slate-700',
                  activeBg: 'bg-amber-50/80 border-amber-600 ring-2 ring-amber-500/20 text-amber-950',
                  badge: 'bg-amber-100 text-amber-900',
                },
                {
                  id: 'URGENT',
                  label: 'URGENT',
                  desc: 'Immediate dispatch & top floor priority across departments',
                  color: 'border-slate-200 hover:border-rose-400 text-slate-700',
                  activeBg: 'bg-rose-50/80 border-rose-600 ring-2 ring-rose-500/20 text-rose-950',
                  badge: 'bg-rose-100 text-rose-900',
                },
              ].map((lvl) => {
                const isSelected = formData.clientPriority === lvl.id;
                return (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => {
                      handleChange('clientPriority', lvl.id);
                    }}
                    className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                      isSelected ? lvl.activeBg : `bg-white ${lvl.color}`
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${lvl.badge}`}>
                        {lvl.label}
                      </span>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      {lvl.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STYLE INFORMATION */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">Style Information</h2>
              <p className="text-[11px] text-slate-500">Pattern cut, style taxonomy, and base artwork</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Main Style *
                </label>
                <input
                  type="text"
                  required
                  value={formData.mainStyle}
                  onChange={(e) => handleChange('mainStyle', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Sub Style
                </label>
                <input
                  type="text"
                  value={formData.subStyle}
                  onChange={(e) => handleChange('subStyle', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Pattern # / Marker Ref
                </label>
                <input
                  type="text"
                  value={formData.pattern}
                  onChange={(e) => handleChange('pattern', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Base Design Type
                </label>
                <input
                  type="text"
                  value={formData.baseDesignType}
                  onChange={(e) => handleChange('baseDesignType', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-800"
                />
              </div>
            </div>
          </div>

          {/* DESIGN INFORMATION (WILCOM) */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">Design Information (Embroidery &amp; Wilcom)</h2>
              <p className="text-[11px] text-slate-500">Multi-head embroidery machine digitizing parameters</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Wilcom Design Number *
                </label>
                <input
                  type="text"
                  required
                  value={formData.wilcomDesignNumber}
                  onChange={(e) => handleChange('wilcomDesignNumber', e.target.value)}
                  className="w-full px-3 py-2 font-mono font-bold border border-slate-200 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Embroidery Design Name
                </label>
                <input
                  type="text"
                  value={formData.embroideryDesign}
                  onChange={(e) => handleChange('embroideryDesign', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Embroidery Design Size
                </label>
                <input
                  type="text"
                  value={formData.embroideryDesignSize}
                  onChange={(e) => handleChange('embroideryDesignSize', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-800"
                />
              </div>

              <div>
                <ImageUpload
                  label="Wilcom Design / Embroidery Technical Photo (Cloudinary)"
                  value={formData.wilcomDesignPhoto}
                  onChange={(url) => handleChange('wilcomDesignPhoto', url)}
                  folder="wilcom-designs"
                  helpText="Upload Wilcom screenshot or digitizer proof"
                />
              </div>
            </div>
          </div>

          {/* FABRIC INFORMATION */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">Fabric Information</h2>
              <p className="text-[11px] text-slate-500">Fabric specifications, roll widths, and consumption averages</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Fabric Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.fabricName}
                  onChange={(e) => handleChange('fabricName', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Fabric Type
                </label>
                <input
                  type="text"
                  value={formData.fabricType}
                  onChange={(e) => handleChange('fabricType', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Fabric Width (Inches)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.fabricWidthInches}
                  onChange={(e) => handleChange('fabricWidthInches', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Fabric Color
                </label>
                <input
                  type="text"
                  value={formData.fabricColor}
                  onChange={(e) => handleChange('fabricColor', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Fabric Color Available
                </label>
                <select
                  value={formData.fabricColorAvailable}
                  onChange={(e) => handleChange('fabricColorAvailable', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-800"
                >
                  <option value="IN_STOCK">IN STOCK (STORE)</option>
                  <option value="PROCUREMENT_PENDING">PROCUREMENT PENDING</option>
                  <option value="DYEING_REQUIRED">DYEING REQUIRED (KORA)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Fabric Average (Meters per Piece)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.fabricAverage}
                  onChange={(e) => handleChange('fabricAverage', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Fabric Average Type
                </label>
                <input
                  type="text"
                  value={formData.fabricAverageType}
                  onChange={(e) => handleChange('fabricAverageType', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-800"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Fabric Average Measurement Description
                </label>
                <input
                  type="text"
                  value={formData.fabricAverageMeasurement}
                  onChange={(e) => handleChange('fabricAverageMeasurement', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-800"
                />
              </div>
            </div>

            <div
              className={`rounded-lg border p-3 text-xs ${
                fabricAvailabilityError || (fabricAvailability && !fabricAvailability.sufficient) ||
                formData.fabricColorAvailable !== 'IN_STOCK'
                  ? 'border-amber-200 bg-amber-50 text-amber-900'
                  : fabricAvailability?.sufficient
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
              role="status"
              aria-live="polite"
            >
              <strong className="block mb-1">Fabric Store availability</strong>
              {formData.fabricColorAvailable !== 'IN_STOCK' ? (
                <span>Set Fabric Color Available to “IN STOCK” before marking this sheet ready.</span>
              ) : fabricAvailabilityError ? (
                <span>Could not verify stock: {fabricAvailabilityError}</span>
              ) : checkingFabricAvailability ? (
                <span>Checking matching QC-passed fabric rolls in the store…</span>
              ) : fabricAvailability ? (
                <span>
                  {fabricAvailability.sufficient ? 'Sufficient stock' : 'Insufficient stock'} —{' '}
                  {fabricAvailability.availableMeters.toFixed(2)} m available of{' '}
                  {fabricAvailability.requiredMeters.toFixed(2)} m required
                  {' '}({fabricAvailability.matchingRollCount} matching roll
                  {fabricAvailability.matchingRollCount === 1 ? '' : 's'}).
                </span>
              ) : (
                <span>Enter fabric name, meters per piece, and production quantity to check stock.</span>
              )}
            </div>
          </div>

          {/* DYEING INFORMATION (CONDITIONAL ROUTING) */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">Dyeing Information</h2>
              <p className="text-[11px] text-slate-500">Route to Dyeing department (YES) or directly to Embroidery department (NO)</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Is Dyeing Required? *
                </label>
                <select
                  value={formData.fabricDyeingRequired ? 'YES' : 'NO'}
                  onChange={(e) => handleChange('fabricDyeingRequired', e.target.value === 'YES')}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-800"
                >
                  <option value="NO">NO</option>
                  <option value="YES">YES</option>
                </select>
              </div>

              <div className="pt-1">
                {formData.fabricDyeingRequired ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                    <div>
                      <strong className="font-semibold">Next Station: Dyeing Department</strong>
                      <p className="text-[11px] text-amber-700 mt-0.5">Fabric requires dyeing/coloring before embroidery.</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-xs flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <div>
                      <strong className="font-semibold">Next Station: Embroidery Department</strong>
                      <p className="text-[11px] text-emerald-700 mt-0.5">Fabric skips dyeing and will go directly to embroidery.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* PRODUCTION QUANTITY */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">Production Quantity &amp; Special Materials</h2>
              <p className="text-[11px] text-slate-500">Target volume, measurement unit, and trims</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Color / Shade Variant
                </label>
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) => handleChange('color', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Color Quantity *
                </label>
                <input
                  type="number"
                  required
                  value={formData.colorQuantity}
                  onChange={(e) => handleChange('colorQuantity', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs text-slate-800 font-bold font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Qty Measurement Unit
                </label>
                <select
                  value={formData.quantityMeasurement}
                  onChange={(e) => handleChange('quantityMeasurement', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs text-slate-800"
                >
                  <option value="PCS">PCS (Pieces)</option>
                  <option value="MTR">MTR (Meters)</option>
                  <option value="KG">KG (Kilograms)</option>
                  <option value="YDS">YDS (Yards)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Special Material Required
                </label>
                <input
                  type="text"
                  value={formData.specialMaterial}
                  onChange={(e) => handleChange('specialMaterial', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs text-slate-800"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Special Material Quantity
                </label>
                <input
                  type="text"
                  value={formData.specialMaterialQuantity}
                  onChange={(e) => handleChange('specialMaterialQuantity', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* PRODUCTION DATES */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">Production Dates</h2>
              <p className="text-[11px] text-slate-500">Design release and projected factory completion schedule</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Production Design Date
                </label>
                <input
                  type="date"
                  value={formData.productionDesignDate}
                  onChange={(e) => handleChange('productionDesignDate', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Production End Date
                </label>
                <input
                  type="date"
                  value={formData.productionEndDate}
                  onChange={(e) => handleChange('productionEndDate', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs text-slate-800"
                />
              </div>
            </div>
          </div>

        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="pt-4 flex items-center justify-end gap-3">
          <Link
            href="/my-work"
            className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-md shadow-xs hover:bg-slate-50 transition"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={() => handleSubmit('DRAFT')}
            disabled={loading}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-md border border-slate-300 shadow-xs transition"
          >
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => handleSubmit('READY_FOR_ISSUE')}
            disabled={loading || !canMarkReady}
            className="px-6 py-2.5 bg-[#163767] hover:bg-[#0F264A] text-white text-xs font-semibold rounded-md shadow-sm transition flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Complete &amp; Submit Ready for Issue</span>
          </button>
        </div>

      </main>

      {/* PRINT & DOWNLOAD MODAL */}
      <ProductionSheetPrintModal
        program={success}
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
      />
    </div>
  );
}
