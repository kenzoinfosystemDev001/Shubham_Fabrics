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
  const [fetchingNumber, setFetchingNumber] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<any | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // FORM STATE - All 8 Sections of Shubham Fabrics Production Sheet
  const [formData, setFormData] = useState({
    // SECTION 1: Program Information
    programSerialNo: '',
    startDate: new Date().toISOString().split('T')[0],
    designNumber: '',
    clientName: '',
    clientPriority: 'NORMAL',
    deliveryDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],

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
    fabricType: 'Cotton Cambric',
    fabricWidth: '58 Inches',
    fabricWidthInches: '58',
    fabricColor: '',
    fabricColorAvailable: 'IN_STOCK',
    fabricAverage: '1.25',
    fabricAverageType: 'Meters/Piece',
    fabricAverageMeasurement: 'Standard Lay Consumption',

    // SECTION 5: Dyeing Information
    fabricDyeingRequired: false,
    fabricIssuedToDyeing: '',
    fabricSentToDyeing: '',

    // SECTION 6: Production Quantity
    color: '',
    colorQuantity: '500',
    quantityMeasurement: 'PCS',
    specialMaterial: '',
    specialMaterialQuantity: '',

    // SECTION 7: Production Dates
    productionDesignDate: new Date().toISOString().split('T')[0],
    productionEndDate: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],

    // SECTION 8: Rejection / Remarks
    piecesRejection: '0',
    rejectionReason: '',
    comments: '',
  });

  useEffect(() => {
    const fetchNextSeq = async () => {
      try {
        setFetchingNumber(true);
        const res = await api.getNextProgramNumber();
        if (res?.nextNumber) {
          setFormData((prev) => ({
            ...prev,
            programSerialNo: res.nextNumber,
          }));
        }
      } catch (err) {
        console.error('Failed to get next program number:', err);
      } finally {
        setFetchingNumber(false);
      }
    };
    fetchNextSeq();
  }, []);

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (targetStatus: 'DRAFT' | 'IN_PROGRESS' | 'READY_FOR_ISSUE') => {
    setError(null);
    setSuccess(null);

    // Basic required field validations
    if (!formData.programSerialNo.trim()) {
      setError('Program Serial Number is mandatory.');
      return;
    }
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

    setLoading(true);
    try {
      const payload = {
        ...formData,
        programNumber: formData.programSerialNo,
        status: targetStatus,
        fabricDyeingRequired: Boolean(formData.fabricDyeingRequired),
        fabricWidthInches: parseFloat(formData.fabricWidthInches) || 58.0,
        fabricAverage: parseFloat(formData.fabricAverage) || 1.25,
        colorQuantity: parseInt(formData.colorQuantity, 10) || 1,
        targetQuantity: parseInt(formData.colorQuantity, 10) || 1,
        piecesRejection: parseInt(formData.piecesRejection, 10) || 0,
        fabricIssuedToDyeing: formData.fabricIssuedToDyeing ? parseFloat(formData.fabricIssuedToDyeing) : 0,
        fabricSentToDyeing: formData.fabricSentToDyeing ? parseFloat(formData.fabricSentToDyeing) : 0,
      };

      const result = await api.createProductionSheet(payload);
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
              MY WORK · FORM 01
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
            disabled={loading}
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
                href="/"
                className="px-3 py-2 bg-white border border-slate-200 text-slate-600 text-xs font-medium rounded-md hover:bg-slate-50 transition"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        )}

        {/* 8-SECTION PROFESSIONAL FORM */}
        <div className="space-y-6">

          {/* SECTION 1: PROGRAM INFORMATION */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="w-6 h-6 rounded bg-blue-100 text-blue-900 font-bold text-xs flex items-center justify-center">
                1
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Program Information</h2>
                <p className="text-[11px] text-slate-500">Core manufacturing order identification</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Program Serial # *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={formData.programSerialNo}
                    onChange={(e) => handleChange('programSerialNo', e.target.value)}
                    placeholder="PRG-2026-00001"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-800"
                  />
                  {fetchingNumber && (
                    <RefreshCw className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5 animate-spin" />
                  )}
                </div>
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
                  placeholder="e.g. SF-DSG-8902"
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
                  placeholder="e.g. Raymond Apparel / FabIndia"
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Client Priority
                </label>
                <select
                  value={formData.clientPriority}
                  onChange={(e) => handleChange('clientPriority', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-800"
                >
                  <option value="LOW">LOW</option>
                  <option value="NORMAL">NORMAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="URGENT">URGENT</option>
                </select>
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

          {/* SECTION 2: STYLE INFORMATION */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="w-6 h-6 rounded bg-amber-100 text-amber-900 font-bold text-xs flex items-center justify-center">
                2
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Style Information</h2>
                <p className="text-[11px] text-slate-500">Pattern cut, style taxonomy, and base artwork</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Main Style *
                </label>
                <input
                  type="text"
                  required
                  value={formData.mainStyle}
                  onChange={(e) => handleChange('mainStyle', e.target.value)}
                  placeholder="e.g. Polo Shirt / Kurti"
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
                  placeholder="e.g. Slim Fit / Mandarin Collar"
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
                  placeholder="e.g. PAT-2026-M04"
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
                  placeholder="e.g. Floral Motif / Geometric Border"
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-800"
                />
              </div>

              <div className="sm:col-span-2">
                <ImageUpload
                  label="Base Design Photo / Drawing Reference (Cloudinary)"
                  value={formData.baseDesignPhoto}
                  onChange={(url) => handleChange('baseDesignPhoto', url)}
                  folder="base-designs"
                  helpText="Upload sketch, photo, or mock reference"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: DESIGN INFORMATION (WILCOM) */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="w-6 h-6 rounded bg-purple-100 text-purple-900 font-bold text-xs flex items-center justify-center">
                3
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Design Information (Embroidery &amp; Wilcom)</h2>
                <p className="text-[11px] text-slate-500">Multi-head embroidery machine digitizing parameters</p>
              </div>
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
                  placeholder="e.g. WLC-EMB-5541"
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
                  placeholder="e.g. Chest Logo 4-Color"
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
                  placeholder="e.g. 120mm x 85mm"
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

          {/* SECTION 4: FABRIC INFORMATION */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="w-6 h-6 rounded bg-emerald-100 text-emerald-900 font-bold text-xs flex items-center justify-center">
                4
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Fabric Information</h2>
                <p className="text-[11px] text-slate-500">Fabric specifications, roll widths, and consumption averages</p>
              </div>
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
                  placeholder="e.g. Cotton Cambric 60s"
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
                  placeholder="e.g. 100% Woven Cotton"
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
                  placeholder="58"
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
                  placeholder="e.g. Optical White / Navy Blue"
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
                  Fabric Average (Consumption)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.fabricAverage}
                  onChange={(e) => handleChange('fabricAverage', e.target.value)}
                  placeholder="1.25"
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
                  placeholder="Meters/Piece"
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
                  placeholder="Marker length 12.5m for 10 garments lay"
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-800"
                />
              </div>
            </div>
          </div>

          {/* SECTION 5: DYEING INFORMATION (CONDITIONAL ROUTING) */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="w-6 h-6 rounded bg-rose-100 text-rose-900 font-bold text-xs flex items-center justify-center">
                5
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Dyeing Information</h2>
                <p className="text-[11px] text-slate-500">Flags for undyed/Kora fabric conditioning before embroidery</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded">
                <input
                  type="checkbox"
                  id="fabricDyeingRequired"
                  checked={formData.fabricDyeingRequired}
                  onChange={(e) => handleChange('fabricDyeingRequired', e.target.checked)}
                  className="w-4 h-4 text-[#163767] rounded border-slate-300 focus:ring-0"
                />
                <label htmlFor="fabricDyeingRequired" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Fabric Dyeing Required?
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Fabric Issued to Dyeing (Qty/Mtr)
                </label>
                <input
                  type="number"
                  step="0.1"
                  disabled={!formData.fabricDyeingRequired}
                  value={formData.fabricIssuedToDyeing}
                  onChange={(e) => handleChange('fabricIssuedToDyeing', e.target.value)}
                  placeholder="0.0"
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Program Fabric Sent to Dyeing (Mtr)
                </label>
                <input
                  type="number"
                  step="0.1"
                  disabled={!formData.fabricDyeingRequired}
                  value={formData.fabricSentToDyeing}
                  onChange={(e) => handleChange('fabricSentToDyeing', e.target.value)}
                  placeholder="0.0"
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>
            </div>
          </div>

          {/* SECTION 6: PRODUCTION QUANTITY */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="w-6 h-6 rounded bg-indigo-100 text-indigo-900 font-bold text-xs flex items-center justify-center">
                6
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Production Quantity &amp; Special Materials</h2>
                <p className="text-[11px] text-slate-500">Target volume, measurement unit, and trims</p>
              </div>
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
                  placeholder="e.g. Royal Blue"
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
                  placeholder="500"
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
                  placeholder="e.g. Metallic Gold Zari Thread"
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
                  placeholder="e.g. 15 Cones / 5000 Meters"
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* SECTION 7: PRODUCTION DATES */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="w-6 h-6 rounded bg-teal-100 text-teal-900 font-bold text-xs flex items-center justify-center">
                7
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Production Dates</h2>
                <p className="text-[11px] text-slate-500">Design release and projected factory completion schedule</p>
              </div>
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

          {/* SECTION 8: REJECTION & REMARKS */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="w-6 h-6 rounded bg-slate-200 text-slate-900 font-bold text-xs flex items-center justify-center">
                8
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Rejection Parameters &amp; Comments</h2>
                <p className="text-[11px] text-slate-500">Allowed tolerance, known defect risk notes, and instructions</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Pieces Rejection Tolerance
                </label>
                <input
                  type="number"
                  value={formData.piecesRejection}
                  onChange={(e) => handleChange('piecesRejection', e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs text-slate-800"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Rejection Reason / Risk Notes
                </label>
                <input
                  type="text"
                  value={formData.rejectionReason}
                  onChange={(e) => handleChange('rejectionReason', e.target.value)}
                  placeholder="e.g. Check for needle cut on lightweight knit"
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs text-slate-800"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  General Production Comments &amp; Special Operator Instructions
                </label>
                <textarea
                  rows={3}
                  value={formData.comments}
                  onChange={(e) => handleChange('comments', e.target.value)}
                  placeholder="Add any specific stitching tension, bobbin thread, or washing shrinkage instructions here..."
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-800"
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
            disabled={loading}
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
