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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
          <span>Loading packing workstation...</span>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-slate-950 p-8 text-center text-slate-400">
        <p className="text-rose-400 font-bold">{error || 'Job not found'}</p>
        <Link
          href="/packing/queue"
          className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-slate-800 text-amber-400 rounded-lg text-xs font-bold"
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
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* BREADCRUMB & HEADER */}
        <div className="flex items-center justify-between">
          <Link
            href="/packing/queue"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Packing Queue
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadJob()}
              className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
              title="Refresh Job Data"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-sm font-black text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/30">
                {job.challanNumber}
              </span>
              <span
                className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${
                  isFullyPacked
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                    : job.status === 'IN_PROCESS'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {isFullyPacked ? 'FULLY PACKED & FG UPDATED' : job.status.replace(/_/g, ' ')}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-extrabold text-white">
              Packaging & Inventory Terminal: Prog #{job.program?.programNumber || 'N/A'}
            </h1>
            <p className="mt-0.5 text-xs text-slate-400">
              Style: <strong className="text-white">{job.program?.styleCode || 'N/A'}</strong> &bull; Buyer: {job.program?.buyerName || job.program?.clientName || 'N/A'} &bull; Source: {job.fromDepartment}
            </p>
          </div>

          {job.program?.id && (
            <Link
              href={`/programs/${job.program.id}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-semibold text-amber-400 hover:bg-slate-700 transition"
            >
              <FileText className="w-4 h-4" />
              <span>Linked Production Sheet</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </Link>
          )}
        </header>

        {/* TOASTS */}
        {successToast && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-300 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            <p className="font-semibold">{successToast}</p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-300 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
            <p className="font-semibold">{error}</p>
          </div>
        )}

        {/* METRICS ROW */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Received From Final QC
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{job.totalReceivedPieces.toLocaleString()}</span>
              <span className="text-xs text-slate-400">pcs</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Verified physical handover count</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Packed into FG Store
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-400">{job.totalPackedPieces.toLocaleString()}</span>
              <span className="text-xs text-slate-400">pcs</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">In {job.cartons?.length || 0} physical carton(s)</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Remaining Balance to Pack
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-400">{job.remainingPieces.toLocaleString()}</span>
              <span className="text-xs text-slate-400">pcs</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Awaiting box packaging</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Progress Complete
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-indigo-400">{pct}%</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
              <div
                className="bg-indigo-400 h-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* WORKSPACE MAIN BODY: TWO COLUMNS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: PACKING EXECUTION FORM (5 cols) */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-5 shadow-xl">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-400" />
                <span>Pack Carton & Transfer to FG</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Each submission creates an authoritative Carton record and updates the Finished Goods Inventory ledger atomically.
              </p>
            </div>

            {isFullyPacked ? (
              <div className="rounded-xl border border-indigo-500/40 bg-indigo-500/10 p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">Batch Handover Complete</h3>
                <p className="text-xs text-indigo-300/90">
                  All {job.totalReceivedPieces} received garments have been packed into cartons and posted to Finished Goods store.
                </p>
                <Link
                  href="/packing/inventory"
                  className="inline-flex items-center gap-2 mt-2 px-4 py-2 bg-indigo-500 text-white rounded-lg text-xs font-bold hover:bg-indigo-400 transition"
                >
                  <Warehouse className="w-4 h-4" /> View Finished Goods Store
                </Link>
              </div>
            ) : (
              <form onSubmit={handlePackSubmit} className="space-y-4">
                {/* Size & Colour */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      Garment Size *
                    </label>
                    <select
                      value={size}
                      onChange={(e) => setSize(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
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
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      Garment Colour
                    </label>
                    <input
                      type="text"
                      value={colour}
                      onChange={(e) => setColour(e.target.value)}
                      placeholder="e.g. Navy Blue"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Quantity to Pack into this carton */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-slate-300">
                      Quantity for this Carton (Pieces) *
                    </label>
                    <span className="text-[11px] text-amber-400 font-mono">
                      Max: {job.remainingPieces} pcs
                    </span>
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={job.remainingPieces}
                    value={packQuantity || ''}
                    onChange={(e) => setPackQuantity(parseInt(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-base font-mono font-bold text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>

                {/* Weights (Gross / Net) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1 flex items-center gap-1">
                      <Scale className="w-3.5 h-3.5 text-slate-400" /> Gross Wt (kg)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={grossWeightKg}
                      onChange={(e) => setGrossWeightKg(e.target.value)}
                      placeholder="e.g. 15.5"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1 flex items-center gap-1">
                      <Scale className="w-3.5 h-3.5 text-slate-400" /> Net Wt (kg)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={netWeightKg}
                      onChange={(e) => setNetWeightKg(e.target.value)}
                      placeholder="e.g. 14.2"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Warehouse Location (Rack / Shelf) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" /> FG Rack
                    </label>
                    <input
                      type="text"
                      value={locationRack}
                      onChange={(e) => setLocationRack(e.target.value)}
                      placeholder="e.g. FG-A1"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none uppercase font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" /> Shelf
                    </label>
                    <input
                      type="text"
                      value={locationShelf}
                      onChange={(e) => setLocationShelf(e.target.value)}
                      placeholder="e.g. S1"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none uppercase font-mono"
                    />
                  </div>
                </div>

                {/* Remarks */}
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Carton Remarks / Inspection Notes
                  </label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="e.g. Polybagged with silica gel, export tags attached..."
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting || packQuantity <= 0}
                    className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-3 px-4 text-xs uppercase tracking-wider transition shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
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
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Boxes className="w-5 h-5 text-emerald-400" />
                    <span>Cartons Created for this Handover ({job.cartons?.length || 0})</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Physical packaging ledger with barcodes and warehouse shelf addresses.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-3 py-2.5">Carton # / Barcode</th>
                      <th className="px-3 py-2.5">Size / Colour</th>
                      <th className="px-3 py-2.5 text-right">Quantity</th>
                      <th className="px-3 py-2.5">Location</th>
                      <th className="px-3 py-2.5 text-right">Label</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {job.cartons && job.cartons.length > 0 ? (
                      job.cartons.map((ctn) => (
                        <tr key={ctn.id} className="hover:bg-slate-800/30">
                          <td className="px-3 py-2.5">
                            <span className="font-bold text-amber-400 block">{ctn.cartonNumber}</span>
                            <span className="text-[10px] text-slate-500">{ctn.barcode || 'N/A'}</span>
                          </td>
                          <td className="px-3 py-2.5 font-sans">
                            <span className="font-bold text-white">{ctn.size}</span>
                            {ctn.colour && (
                              <span className="text-slate-400 text-[11px] block">{ctn.colour}</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className="text-sm font-bold text-emerald-400">{ctn.quantity}</span>
                            <span className="text-[10px] text-slate-400 ml-1 font-sans">pcs</span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="text-slate-300">
                              {ctn.locationRack || 'A1'} / {ctn.locationShelf || 'S1'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-sans">
                            <button
                              onClick={() => handlePrintLabel(ctn)}
                              className="inline-flex items-center gap-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1 text-[11px] font-semibold border border-slate-700 transition"
                            >
                              <Printer className="w-3 h-3 text-amber-400" />
                              <span>Label</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-slate-500 font-sans">
                          No cartons packed yet. Use the form on the left to pack garments.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* AUDIT EVENTS & RECONCILIATION */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-3 shadow-xl">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Clock className="w-4 h-4 text-sky-400" />
                <span>Production Audit & Invariant Trail</span>
              </h3>
              <div className="space-y-2 text-xs">
                {job.events && job.events.length > 0 ? (
                  job.events.map((ev) => (
                    <div key={ev.id} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex justify-between items-center">
                      <div>
                        <span className="font-bold text-slate-200 block">{ev.message}</span>
                        <span className="text-[10px] text-slate-500">
                          {ev.user?.fullName || 'System'} &bull; {new Date(ev.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-amber-400">
                        {ev.eventType}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 text-xs">No audit events recorded yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* PRINT LABEL MODAL */}
        {selectedCartonForPrint && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-white p-6 text-slate-950 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <img src="/shubham-logo.jpg" alt="Logo" className="w-8 h-8 object-contain" />
                  <div>
                    <h3 className="text-sm font-black tracking-wide">SHUBHAM FABRICS</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase">FINISHED GOODS CARTON LABEL</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCartonForPrint(null)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                >
                  ✕
                </button>
              </div>

              {/* Label Content */}
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 space-y-3 bg-slate-50">
                <div className="flex justify-between items-baseline border-b border-slate-200 pb-2">
                  <span className="text-xs font-bold text-slate-600">Carton Number:</span>
                  <span className="font-mono font-black text-lg text-slate-950">
                    {selectedCartonForPrint.cartonNumber}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 block">Program No:</span>
                    <strong className="text-slate-900">{job.program?.programNumber || 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Style Code:</span>
                    <strong className="text-slate-900">{job.program?.styleCode || 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Buyer / Client:</span>
                    <strong className="text-slate-900 truncate block">
                      {job.program?.buyerName || job.program?.clientName || 'N/A'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Size / Colour:</span>
                    <strong className="text-slate-900">
                      {selectedCartonForPrint.size} {selectedCartonForPrint.colour ? `(${selectedCartonForPrint.colour})` : ''}
                    </strong>
                  </div>
                </div>

                <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-center">
                  <span className="text-xs text-amber-800 font-bold block uppercase">Net Piece Count</span>
                  <span className="text-2xl font-black text-amber-950 font-mono">
                    {selectedCartonForPrint.quantity} PCS
                  </span>
                </div>

                <div className="flex justify-between text-xs text-slate-600 pt-1">
                  <span>Rack: <strong>{selectedCartonForPrint.locationRack || 'A1'}</strong></span>
                  <span>Shelf: <strong>{selectedCartonForPrint.locationShelf || 'S1'}</strong></span>
                  <span>Challan: <strong>{job.challanNumber}</strong></span>
                </div>

                {/* Simulated Barcode */}
                <div className="pt-2 text-center border-t border-slate-200">
                  <div className="font-mono text-xl tracking-[0.25em] font-black text-slate-900 py-1">
                    ||| | |||| | ||| |||| | |||
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 block">
                    {selectedCartonForPrint.barcode || selectedCartonForPrint.cartonNumber}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedCartonForPrint(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined') window.print();
                  }}
                  className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-2"
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
