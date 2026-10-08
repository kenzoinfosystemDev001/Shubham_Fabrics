'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import {
  ClipboardCheck,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  Save,
  Layers,
} from 'lucide-react';

const COMMON_DEFECTS = [
  'Holes / Cut marks in fabric',
  'Oil / Grease / Rust stains',
  'Weaving defects / Slubs / Missing threads',
  'Width or measurement variation beyond tolerance',
  'Shade variation / Off-color tone',
  'Bowing / Skewing / Distortion',
  'Contamination / Foreign yarn fibers',
];

export default function ConductQCPage() {
  const router = useRouter();
  const params = useParams();
  const rollId = params?.rollId as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [roll, setRoll] = useState<any>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [inspectionType, setInspectionType] = useState('RECEIPT_QC');
  const [result, setResult] = useState<'PASS' | 'HOLD' | 'REJECT'>('PASS');
  const [selectedDefects, setSelectedDefects] = useState<string[]>([]);
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (!rollId) return;
    const fetchRoll = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/fabric-store/rolls/${rollId}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch roll');
        setRoll(json.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchRoll();
  }, [rollId]);

  const toggleDefect = (defect: string) => {
    if (selectedDefects.includes(defect)) {
      setSelectedDefects(selectedDefects.filter((d) => d !== defect));
    } else {
      setSelectedDefects([...selectedDefects, defect]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (result !== 'PASS' && selectedDefects.length === 0 && !remarks.trim()) {
      setError('Please select at least one defect reason or enter detailed remarks.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        rollId,
        inspectionType,
        result,
        defects: selectedDefects,
        remarks: remarks.trim() || null,
      };

      const res = await fetch('/api/fabric-store/qc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to submit inspection');

      setSuccess(`QC recorded! Roll marked as ${result === 'PASS' ? 'IN STOCK' : result}.`);
      setTimeout(() => {
        router.push('/fabric-store/my-work/qc-inspections');
      }, 1200);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F0FAF9] p-8 flex items-center justify-center text-xs text-slate-500">
        Loading roll details for inspection...
      </div>
    );
  }

  if (!roll) {
    return (
      <div className="min-h-screen bg-[#F0FAF9] p-8 max-w-xl mx-auto text-center space-y-4 pt-20">
        <h2 className="text-base font-bold text-slate-900">Roll Not Found</h2>
        <p className="text-xs text-slate-500">The requested roll could not be located in the system.</p>
        <Link
          href="/fabric-store/my-work/qc-inspections"
          className="inline-flex px-4 py-2 bg-teal-700 text-white text-xs font-bold rounded-md"
        >
          Return to Queue
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0FAF9] pb-16">
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/fabric-store/my-work/qc-inspections"
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700 block">
              QC INSPECTION
            </span>
            <h1 className="text-xl font-bold text-slate-900">Conduct Quality Audit</h1>
          </div>
        </div>
      </header>

      <main className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold">
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold">
            {success}
          </div>
        )}

        {/* Roll Specifications Card */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-teal-600" />
              Roll Profile &amp; Dimensions
            </h2>
            <span className="font-mono text-xs font-bold text-teal-900 bg-teal-50 px-2.5 py-1 rounded border border-teal-200">
              {roll.rollNumber}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] font-bold uppercase">Batch Number</span>
              <span className="font-mono font-bold text-slate-800">{roll.batch?.batchNumber}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-bold uppercase">Fabric Type</span>
              <span className="font-semibold text-slate-800">{roll.batch?.fabricType}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-bold uppercase">Fabric Description</span>
              <span className="font-semibold text-slate-800">{roll.batch?.fabricDescription}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-bold uppercase">Color / Shade</span>
              <span className="font-semibold text-slate-800">{roll.batch?.colorName || 'Natural'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-bold uppercase">Measured Length</span>
              <span className="font-mono font-bold text-teal-800 text-sm">{parseFloat(roll.length).toFixed(2)} m</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-bold uppercase">Measured Width</span>
              <span className="font-mono font-bold text-slate-800">{roll.width ? `${roll.width} cm` : 'Standard'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-bold uppercase">Measured Weight</span>
              <span className="font-mono font-bold text-slate-800">{roll.weight ? `${roll.weight} kg` : '—'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-bold uppercase">Current Status</span>
              <span className="font-semibold text-amber-700">{roll.status} ({roll.qcStatus})</span>
            </div>
          </div>
        </div>

        {/* Audit Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-5">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-amber-600" />
              Inspection Parameters &amp; Verdict
            </h2>

            {/* Inspection Type */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Audit Category
              </label>
              <select
                value={inspectionType}
                onChange={(e) => setInspectionType(e.target.value)}
                className="w-full sm:w-72 text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-900 focus:ring-1 focus:ring-amber-500 font-semibold"
              >
                <option value="RECEIPT_QC">RECEIPT QC (Initial Inward)</option>
                <option value="RETURN_QC">RETURN QC (Post-Production Return)</option>
                <option value="RANDOM_QC">RANDOM AUDIT (Internal Spot Check)</option>
              </select>
            </div>

            {/* Verdict Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Audit Decision <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setResult('PASS')}
                  className={`p-4 rounded-xl border text-left flex items-start gap-3 transition cursor-pointer ${
                    result === 'PASS'
                      ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-950'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <CheckCircle2 className={`w-5 h-5 mt-0.5 ${result === 'PASS' ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <div>
                    <span className="text-xs font-bold block">PASS (Accept into Stock)</span>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">
                      Roll is defect-free and available for production issue.
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setResult('HOLD')}
                  className={`p-4 rounded-xl border text-left flex items-start gap-3 transition cursor-pointer ${
                    result === 'HOLD'
                      ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 text-amber-950'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <AlertTriangle className={`w-5 h-5 mt-0.5 ${result === 'HOLD' ? 'text-amber-600' : 'text-slate-400'}`} />
                  <div>
                    <span className="text-xs font-bold block">HOLD (Quarantine)</span>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">
                      Requires manager review or lab testing before issue.
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setResult('REJECT')}
                  className={`p-4 rounded-xl border text-left flex items-start gap-3 transition cursor-pointer ${
                    result === 'REJECT'
                      ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-500/20 text-rose-950'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <XCircle className={`w-5 h-5 mt-0.5 ${result === 'REJECT' ? 'text-rose-600' : 'text-slate-400'}`} />
                  <div>
                    <span className="text-xs font-bold block">REJECT (Write-Off)</span>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">
                      Defective fabric. Cannot be issued to production.
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Defect Checklist */}
            {result !== 'PASS' && (
              <div className="pt-2 space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Identified Defects Checklist
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  {COMMON_DEFECTS.map((defect) => (
                    <label
                      key={defect}
                      className="flex items-center gap-2.5 p-2 rounded hover:bg-white text-xs text-slate-800 cursor-pointer transition select-none"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDefects.includes(defect)}
                        onChange={() => toggleDefect(defect)}
                        className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                      />
                      <span>{defect}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Remarks */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Auditor Notes &amp; Observations
              </label>
              <textarea
                rows={3}
                placeholder="Specific meterage where defect starts, shade variation notes, lab test reference..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-md p-3 focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <Link
              href="/fabric-store/my-work/qc-inspections"
              className="px-4 py-2 border border-slate-300 rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className={`flex items-center gap-2 px-6 py-2.5 text-white text-xs font-bold rounded-md shadow-xs transition disabled:opacity-50 ${
                result === 'PASS'
                  ? 'bg-emerald-700 hover:bg-emerald-800'
                  : result === 'HOLD'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-rose-700 hover:bg-rose-800'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>{submitting ? 'Submitting Verdict...' : `Submit Verdict: ${result}`}</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
