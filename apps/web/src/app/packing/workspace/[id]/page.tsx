'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Package,
  Boxes,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Barcode,
  Printer,
  FileText,
  Warehouse,
  Scale,
  MapPin,
  Clock,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { api } from '@/lib/api';

interface JobDetails {
  id: string;
  challanNumber: string;
  fromDepartment: string;
  toDepartment: string;
  status: string;
  createdAt: string;
  receivedAt?: string;
  totalReceivedPieces: number;
  totalPackedPieces: number;
  remainingPieces: number;
  program?: {
    id: string;
    programNumber?: string;
    styleCode?: string;
    clientName?: string;
    buyerName?: string;
    fabricName?: string;
    targetQuantity?: number;
  };
  items: Array<{
    id?: string;
    size?: string;
    color?: string;
    quantity: number;
    uom: string;
    description?: string;
  }>;
  cartons: Array<{
    id: string;
    cartonNumber: string;
    size: string;
    colour?: string;
    quantity: number;
    grossWeightKg?: number;
    netWeightKg?: number;
    dimensionsCm?: string;
    locationRack?: string;
    locationShelf?: string;
    barcode?: string;
    status: string;
    createdAt: string;
  }>;
  transactions?: Array<{
    id: string;
    inputQuantity: number;
    goodQuantity: number;
    recordedAt: string;
    operator?: { fullName?: string };
    remarks?: string;
  }>;
  events?: Array<{
    id: string;
    eventType: string;
    message: string;
    createdAt: string;
    user?: { fullName?: string };
  }>;
}

export default function PackingWorkstationJobPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [job, setJob] = useState<JobDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState('');

  // Carton Packing Form State
  const [size, setSize] = useState('Standard');
  const [colour, setColour] = useState('');
  const [packQuantity, setPackQuantity] = useState<number>(0);
  const [grossWeightKg, setGrossWeightKg] = useState<string>('');
  const [netWeightKg, setNetWeightKg] = useState<string>('');
  const [locationRack, setLocationRack] = useState('FG-A1');
  const [locationShelf, setLocationShelf] = useState('S1');
  const [remarks, setRemarks] = useState('');

  // Print Label Modal State
  const [selectedCartonForPrint, setSelectedCartonForPrint] = useState<any | null>(null);

  const loadJob = useCallback(async (quiet = false) => {
    if (!id) return;
    try {
      if (!quiet) setLoading(true);
      setError('');
      const res = await api.getPackingJob(id);
      if (res?.success && res.data) {
        setJob(res.data);
        // Pre-fill size and remaining pieces if available
        if (res.data.items && res.data.items.length > 0) {
          const firstItem = res.data.items[0];
          if (firstItem.size) setSize(firstItem.size);
          if (firstItem.color) setColour(firstItem.color);
        }
        if (res.data.remainingPieces > 0) {
          setPackQuantity(res.data.remainingPieces);
        }
      } else {
        const fallbackRes = await fetch(`/api/packing/jobs/${id}`, { cache: 'no-store' });
        const json = await fallbackRes.json();
        if (json.success && json.data) {
          setJob(json.data);
          if (json.data.remainingPieces > 0) {
            setPackQuantity(json.data.remainingPieces);
          }
        } else {
          throw new Error(json.error || 'Failed to load packing job');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load packing job details');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadJob();
  }, [loadJob]);

  const handlePackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job) return;

    if (packQuantity <= 0) {
      setError('Quantity to pack must be greater than 0.');
      return;
    }

    if (packQuantity > job.remainingPieces) {
      setError(`Cannot pack ${packQuantity} pieces. Only ${job.remainingPieces} pieces remaining.`);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const payload = {
        size: size || 'Standard',
        colour: colour || undefined,
        quantity: packQuantity,
        grossWeightKg: grossWeightKg ? parseFloat(grossWeightKg) : undefined,
        netWeightKg: netWeightKg ? parseFloat(netWeightKg) : undefined,
        locationRack: locationRack || undefined,
        locationShelf: locationShelf || undefined,
        remarks: remarks || undefined,
      };

      const res = await api.packJob(job.id, payload);
      if (!res?.success) {
        throw new Error(res?.error || 'Failed to pack carton');
      }

      setSuccessToast(`Successfully packed ${packQuantity} pcs into carton ${res.data?.carton?.cartonNumber || ''}! Stock ledger updated.`);
      setRemarks('');
      setGrossWeightKg('');
      setNetWeightKg('');
      void loadJob(true);
      setTimeout(() => setSuccessToast(''), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to commit packing transaction');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintLabel = (carton: any) => {
    setSelectedCartonForPrint(carton);
  };

  if (loading && !job) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center text-neutral-500">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 animate-spin text-accent-700" />
          <span>Loading packing workstation...</span>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-canvas p-8 text-center text-neutral-500">
        <p className="text-danger-600 font-bold">{error || 'Job not found'}</p>
        <Link
          href="/packing/queue"
          className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-neutral-100 text-accent-700 rounded-lg text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Queue
        </Link>
      </div>
    );
  }

  const pct = job.totalReceivedPieces > 0
    ? Math.min(100, Math.round((job.totalPackedPieces / job.totalReceivedPieces) * 100))
    : 0;
  const isFullyPacked = job.remainingPieces === 0 && job.totalPackedPieces > 0;

  return (
    <div className="min-h-screen bg-canvas px-4 py-8 text-neutral-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* BREADCRUMB & HEADER */}
        <div className="flex items-center justify-between">
          <Link
            href="/packing/queue"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Packing Queue
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadJob()}
              className="p-1.5 rounded-lg border border-neutral-200 bg-neutral-100 text-neutral-700 hover:text-neutral-900"
              title="Refresh Job Data"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-sm font-black text-accent-700 bg-accent-400/10 px-2.5 py-1 rounded-lg border border-accent-500/30">
                {job.challanNumber}
              </span>
              <span
                className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${
                  isFullyPacked
                    ? 'bg-brand-500/20 text-brand-600 border border-brand-500/40'
                    : job.status === 'IN_PROCESS'
                    ? 'bg-brand-500/20 text-brand-600 border border-brand-500/40'
                    : 'bg-accent-400/20 text-accent-700 border border-accent-500/40'
                }`}
              >
                {isFullyPacked ? 'FULLY PACKED & FG UPDATED' : job.status.replace(/_/g, ' ')}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-extrabold text-neutral-900">
              Packaging & Inventory Terminal: Prog #{job.program?.programNumber || 'N/A'}
            </h1>
            <p className="mt-0.5 text-xs text-neutral-500">
              Style: <strong className="text-neutral-900">{job.program?.styleCode || 'N/A'}</strong> &bull; Buyer: {job.program?.buyerName || job.program?.clientName || 'N/A'} &bull; Source: {job.fromDepartment}
            </p>
          </div>

          {job.program?.id && (
            <Link
              href={`/programs/${job.program.id}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 py-2 text-xs font-semibold text-accent-700 hover:bg-neutral-200 transition"
            >
              <FileText className="w-4 h-4" />
              <span>Linked Production Sheet</span>
              <ExternalLink className="w-3 h-3 text-neutral-500" />
            </Link>
          )}
        </header>

        {/* TOASTS */}
        {successToast && (
          <div className="rounded-xl border border-accent-500/40 bg-accent-400/10 p-4 text-sm text-accent-700 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-accent-700" />
            <p className="font-semibold">{successToast}</p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-danger-500/40 bg-danger-500/10 p-4 text-sm text-danger-600 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-danger-600" />
            <p className="font-semibold">{error}</p>
          </div>
        )}

        {/* METRICS ROW */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
              Received From Final QC
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-neutral-900">{job.totalReceivedPieces.toLocaleString()}</span>
              <span className="text-xs text-neutral-500">pcs</span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">Verified physical handover count</p>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
              Packed into FG Store
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-neutral-900">{job.totalPackedPieces.toLocaleString()}</span>
              <span className="text-xs text-neutral-500">pcs</span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">In {job.cartons?.length || 0} physical carton(s)</p>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
              Remaining Balance to Pack
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-neutral-900">{job.remainingPieces.toLocaleString()}</span>
              <span className="text-xs text-neutral-500">pcs</span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">Awaiting box packaging</p>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
              Progress Complete
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-brand-600">{pct}%</span>
            </div>
            <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden mt-2">
              <div
                className="bg-brand-500 h-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* WORKSPACE MAIN BODY: TWO COLUMNS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: PACKING EXECUTION FORM (5 cols) */}
          <div className="lg:col-span-5 rounded-2xl border border-neutral-200 bg-white p-6 space-y-5 shadow-sm">
            <div className="border-b border-neutral-200 pb-3">
              <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-accent-700" />
                <span>Pack Carton & Transfer to FG</span>
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Each submission creates an authoritative Carton record and updates the Finished Goods Inventory ledger atomically.
              </p>
            </div>

            {isFullyPacked ? (
              <div className="rounded-xl border border-brand-500/40 bg-brand-500/10 p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-brand-500/20 text-brand-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-neutral-900">Batch Handover Complete</h3>
                <p className="text-xs text-brand-600">
                  All {job.totalReceivedPieces} received garments have been packed into cartons and posted to Finished Goods store.
                </p>
                <Link
                  href="/packing/inventory"
                  className="inline-flex items-center gap-2 mt-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700 transition"
                >
                  <Warehouse className="w-4 h-4" /> View Finished Goods Store
                </Link>
              </div>
            ) : (
              <form onSubmit={handlePackSubmit} className="space-y-4">
                {/* Size & Colour */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-neutral-700 block mb-1">
                      Garment Size *
                    </label>
                    <select
                      value={size}
                      onChange={(e) => setSize(e.target.value)}
                      className="w-full rounded-lg border border-neutral-200 bg-canvas px-3 py-2 text-xs text-neutral-900 focus:border-brand-500 focus:outline-none"
                    >
                      {job.items && job.items.length > 0 ? (
                        job.items.map((it, idx) => (
                          <option key={idx} value={it.size || `Item-${idx + 1}`}>
                            {it.size || `Standard`} ({it.quantity} pcs)
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="S">S</option>
                          <option value="M">M</option>
                          <option value="L">L</option>
                          <option value="XL">XL</option>
                          <option value="XXL">XXL</option>
                          <option value="Free Size">Free Size</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-neutral-700 block mb-1">
                      Garment Colour
                    </label>
                    <input
                      type="text"
                      value={colour}
                      onChange={(e) => setColour(e.target.value)}
                      placeholder="e.g. Navy Blue"
                      className="w-full rounded-lg border border-neutral-200 bg-canvas px-3 py-2 text-xs text-neutral-900 focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Quantity to Pack into this carton */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-neutral-700">
                      Quantity for this Carton (Pieces) *
                    </label>
                    <span className="text-[11px] text-accent-700 font-mono">
                      Max: {job.remainingPieces} pcs
                    </span>
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={job.remainingPieces}
                    value={packQuantity || ''}
                    onChange={(e) => setPackQuantity(parseInt(e.target.value) || 0)}
                    className="w-full rounded-lg border border-neutral-200 bg-canvas px-3 py-2.5 text-base font-mono font-bold text-neutral-900 focus:border-brand-500 focus:outline-none"
                  />
                </div>

                {/* Weights (Gross / Net) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-neutral-700 block mb-1 flex items-center gap-1">
                      <Scale className="w-3.5 h-3.5 text-neutral-500" /> Gross Wt (kg)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={grossWeightKg}
                      onChange={(e) => setGrossWeightKg(e.target.value)}
                      placeholder="e.g. 15.5"
                      className="w-full rounded-lg border border-neutral-200 bg-canvas px-3 py-2 text-xs text-neutral-900 focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-neutral-700 block mb-1 flex items-center gap-1">
                      <Scale className="w-3.5 h-3.5 text-neutral-500" /> Net Wt (kg)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={netWeightKg}
                      onChange={(e) => setNetWeightKg(e.target.value)}
                      placeholder="e.g. 14.2"
                      className="w-full rounded-lg border border-neutral-200 bg-canvas px-3 py-2 text-xs text-neutral-900 focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Warehouse Location (Rack / Shelf) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-neutral-700 block mb-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-neutral-500" /> FG Rack
                    </label>
                    <input
                      type="text"
                      value={locationRack}
                      onChange={(e) => setLocationRack(e.target.value)}
                      placeholder="e.g. FG-A1"
                      className="w-full rounded-lg border border-neutral-200 bg-canvas px-3 py-2 text-xs text-neutral-900 focus:border-brand-500 focus:outline-none uppercase font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-neutral-700 block mb-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-neutral-500" /> Shelf
                    </label>
                    <input
                      type="text"
                      value={locationShelf}
                      onChange={(e) => setLocationShelf(e.target.value)}
                      placeholder="e.g. S1"
                      className="w-full rounded-lg border border-neutral-200 bg-canvas px-3 py-2 text-xs text-neutral-900 focus:border-brand-500 focus:outline-none uppercase font-mono"
                    />
                  </div>
                </div>

                {/* Remarks */}
                <div>
                  <label className="text-xs font-bold text-neutral-700 block mb-1">
                    Carton Remarks / Inspection Notes
                  </label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="e.g. Polybagged with silica gel, export tags attached..."
                    className="w-full rounded-lg border border-neutral-200 bg-canvas px-3 py-2 text-xs text-neutral-900 focus:border-brand-500 focus:outline-none"
                  />
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting || packQuantity <= 0}
                    className="w-full rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-black py-3 px-4 text-xs uppercase tracking-wider transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Posting to Inventory...</span>
                      </>
                    ) : (
                      <>
                        <Boxes className="w-4 h-4" />
                        <span>Create Carton & Post to FG Stock</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* RIGHT: CARTONS PACKED & AUDIT TRAIL (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* CARTONS TABLE */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                <div>
                  <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                    <Boxes className="w-5 h-5 text-accent-700" />
                    <span>Cartons Created for this Handover ({job.cartons?.length || 0})</span>
                  </h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Physical packaging ledger with barcodes and warehouse shelf addresses.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-neutral-700">
                  <thead className="bg-white text-[10px] font-bold uppercase tracking-wider text-neutral-500 border-b border-neutral-200">
                    <tr>
                      <th className="px-3 py-2.5">Carton # / Barcode</th>
                      <th className="px-3 py-2.5">Size / Colour</th>
                      <th className="px-3 py-2.5 text-right">Quantity</th>
                      <th className="px-3 py-2.5">Location</th>
                      <th className="px-3 py-2.5 text-right">Label</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 font-mono">
                    {job.cartons && job.cartons.length > 0 ? (
                      job.cartons.map((ctn) => (
                        <tr key={ctn.id} className="hover:bg-neutral-100">
                          <td className="px-3 py-2.5">
                            <span className="font-bold text-accent-700 block">{ctn.cartonNumber}</span>
                            <span className="text-[10px] text-neutral-500">{ctn.barcode || 'N/A'}</span>
                          </td>
                          <td className="px-3 py-2.5 font-sans">
                            <span className="font-bold text-neutral-900">{ctn.size}</span>
                            {ctn.colour && (
                              <span className="text-neutral-500 text-[11px] block">{ctn.colour}</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className="text-sm font-bold text-accent-700">{ctn.quantity}</span>
                            <span className="text-[10px] text-neutral-500 ml-1 font-sans">pcs</span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="text-neutral-700">
                              {ctn.locationRack || 'A1'} / {ctn.locationShelf || 'S1'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-sans">
                            <button
                              onClick={() => handlePrintLabel(ctn)}
                              className="inline-flex items-center gap-1 rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-900 px-2 py-1 text-[11px] font-semibold border border-neutral-200 transition"
                            >
                              <Printer className="w-3 h-3 text-accent-700" />
                              <span>Label</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-neutral-500 font-sans">
                          No cartons packed yet. Use the form on the left to pack garments.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* AUDIT EVENTS & RECONCILIATION */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 space-y-3 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-600" />
                <span>Production Audit & Invariant Trail</span>
              </h3>
              <div className="space-y-2 text-xs">
                {job.events && job.events.length > 0 ? (
                  job.events.map((ev) => (
                    <div key={ev.id} className="p-2.5 rounded-lg bg-canvas border border-neutral-200 flex justify-between items-center">
                      <div>
                        <span className="font-bold text-neutral-900 block">{ev.message}</span>
                        <span className="text-[10px] text-neutral-500">
                          {ev.user?.fullName || 'System'} &bull; {new Date(ev.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-100 text-accent-700">
                        {ev.eventType}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-neutral-500 text-xs">No audit events recorded yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* PRINT LABEL MODAL */}
        {selectedCartonForPrint && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/80 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 text-neutral-900 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                <div className="flex items-center gap-2">
                  <img src="/shubham-logo.jpg" alt="Logo" className="w-8 h-8 object-contain" />
                  <div>
                    <h3 className="text-sm font-black tracking-wide">SHUBHAM FABRICS</h3>
                    <p className="text-[10px] text-neutral-500 font-bold uppercase">FINISHED GOODS CARTON LABEL</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCartonForPrint(null)}
                  className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100"
                >
                  ✕
                </button>
              </div>

              {/* Label Content */}
              <div className="border-2 border-dashed border-neutral-300 rounded-xl p-4 space-y-3 bg-neutral-50">
                <div className="flex justify-between items-baseline border-b border-neutral-200 pb-2">
                  <span className="text-xs font-bold text-neutral-600">Carton Number:</span>
                  <span className="font-mono font-black text-lg text-neutral-900">
                    {selectedCartonForPrint.cartonNumber}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-neutral-500 block">Program No:</span>
                    <strong className="text-neutral-900">{job.program?.programNumber || 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Style Code:</span>
                    <strong className="text-neutral-900">{job.program?.styleCode || 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Buyer / Client:</span>
                    <strong className="text-neutral-900 truncate block">
                      {job.program?.buyerName || job.program?.clientName || 'N/A'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Size / Colour:</span>
                    <strong className="text-neutral-900">
                      {selectedCartonForPrint.size} {selectedCartonForPrint.colour ? `(${selectedCartonForPrint.colour})` : ''}
                    </strong>
                  </div>
                </div>

                <div className="rounded-lg bg-accent-50 border border-accent-200 p-2 text-center">
                  <span className="text-xs text-accent-800 font-bold block uppercase">Net Piece Count</span>
                  <span className="text-2xl font-black text-neutral-900 font-mono">
                    {selectedCartonForPrint.quantity} PCS
                  </span>
                </div>

                <div className="flex justify-between text-xs text-neutral-600 pt-1">
                  <span>Rack: <strong>{selectedCartonForPrint.locationRack || 'A1'}</strong></span>
                  <span>Shelf: <strong>{selectedCartonForPrint.locationShelf || 'S1'}</strong></span>
                  <span>Challan: <strong>{job.challanNumber}</strong></span>
                </div>

                {/* Simulated Barcode */}
                <div className="pt-2 text-center border-t border-neutral-200">
                  <div className="font-mono text-xl tracking-[0.25em] font-black text-neutral-900 py-1">
                    ||| | |||| | ||| |||| | |||
                  </div>
                  <span className="text-[10px] font-mono text-neutral-500 block">
                    {selectedCartonForPrint.barcode || selectedCartonForPrint.cartonNumber}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedCartonForPrint(null)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-lg"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined') window.print();
                  }}
                  className="px-5 py-2 text-xs font-bold text-neutral-900 bg-white hover:bg-neutral-100 rounded-lg flex items-center gap-2"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Label</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
