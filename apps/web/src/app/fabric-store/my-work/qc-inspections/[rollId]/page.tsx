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
      <div className="min-h-screen bg-brand-50 p-8 flex items-center justify-center text-xs text-neutral-500">
        Loading roll details for inspection...
      </div>
    );
  }

  if (!roll) {
    return (
      <div className="min-h-screen bg-brand-50 p-8 max-w-xl mx-auto text-center space-y-4 pt-20">
        <h2 className="text-base font-bold text-neutral-900">Roll Not Found</h2>
        <p className="text-xs text-neutral-500">The requested roll could not be located in the system.</p>
        <Link
          href="/fabric-store/my-work/qc-inspections"
          className="inline-flex px-4 py-2 bg-brand-700 text-white text-xs font-bold rounded-md"
        >
          Return to Queue
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-50 pb-16">
      <header className="bg-white border-b border-neutral-200/80 sticky top-0 z-30 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/fabric-store/my-work/qc-inspections"
            className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-700 block">
              QC INSPECTION
            </span>
            <h1 className="text-xl font-bold text-neutral-900">Conduct Quality Audit</h1>
          </div>
        </div>
      </header>

      <main className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
        {error && (
          <div className="p-4 bg-danger-50 border border-danger-200 rounded-xl text-danger-800 text-xs font-semibold">
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 bg-accent-50 border border-accent-200 rounded-xl text-accent-800 text-xs font-semibold">
            {success}
          </div>
        )}

        {/* Roll Specifications Card */}
        <div className="bg-white border border-neutral-200/90 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-600" />
              Roll Profile &amp; Dimensions
            </h2>
            <span className="font-mono text-xs font-bold text-brand-900 bg-brand-50 px-2.5 py-1 rounded border border-brand-200">
              {roll.rollNumber}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-neutral-500 block text-[10px] font-bold uppercase">Batch Number</span>
              <span className="font-mono font-bold text-neutral-900">{roll.batch?.batchNumber}</span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[10px] font-bold uppercase">Fabric Type</span>
              <span className="font-semibold text-neutral-900">{roll.batch?.fabricType}</span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[10px] font-bold uppercase">Fabric Description</span>
              <span className="font-semibold text-neutral-900">{roll.batch?.fabricDescription}</span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[10px] font-bold uppercase">Color / Shade</span>
              <span className="font-semibold text-neutral-900">{roll.batch?.colorName || 'Natural'}</span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[10px] font-bold uppercase">Measured Length</span>
              <span className="font-mono font-bold text-brand-800 text-sm">{parseFloat(roll.length).toFixed(2)} m</span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[10px] font-bold uppercase">Measured Width</span>
              <span className="font-mono font-bold text-neutral-900">{roll.width ? `${roll.width} cm` : 'Standard'}</span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[10px] font-bold uppercase">Measured Weight</span>
              <span className="font-mono font-bold text-neutral-900">{roll.weight ? `${roll.weight} kg` : '—'}</span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[10px] font-bold uppercase">Current Status</span>
              <span className="font-semibold text-accent-800">{roll.status} ({roll.qcStatus})</span>
            </div>
          </div>
        </div>

        {/* Audit Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white border border-neutral-200/90 rounded-xl p-6 shadow-xs space-y-5">
            <h2 className="text-sm font-bold text-neutral-900 border-b border-neutral-100 pb-3 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-accent-700" />
              Inspection Parameters &amp; Verdict
            </h2>

            {/* Inspection Type */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Audit Category
              </label>
              <select
                value={inspectionType}
                onChange={(e) => setInspectionType(e.target.value)}
                className="w-full sm:w-72 text-xs border border-neutral-300 rounded-md px-3 py-2 bg-white text-neutral-900 focus:ring-1 focus:ring-brand-500/40 font-semibold"
              >
                <option value="RECEIPT_QC">RECEIPT QC (Initial Inward)</option>
                <option value="RETURN_QC">RETURN QC (Post-Production Return)</option>
                <option value="RANDOM_QC">RANDOM AUDIT (Internal Spot Check)</option>
              </select>
            </div>

            {/* Verdict Selection */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-2">
                Audit Decision <span className="text-danger-600">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setResult('PASS')}
                  className={`p-4 rounded-xl border text-left flex items-start gap-3 transition cursor-pointer ${
                    result === 'PASS'
                      ? 'bg-accent-50 border-accent-500 ring-2 ring-accent-500/20 text-accent-800'
                      : 'border-neutral-200 hover:bg-neutral-50 text-neutral-700'
                  }`}
                >
                  <CheckCircle2 className={`w-5 h-5 mt-0.5 ${result === 'PASS' ? 'text-accent-700' : 'text-neutral-500'}`} />
                  <div>
                    <span className="text-xs font-bold block">PASS (Accept into Stock)</span>
                    <span className="text-[11px] text-neutral-500 mt-0.5 block">
                      Roll is defect-free and available for production issue.
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setResult('HOLD')}
                  className={`p-4 rounded-xl border text-left flex items-start gap-3 transition cursor-pointer ${
                    result === 'HOLD'
                      ? 'bg-accent-50 border-accent-500 ring-2 ring-accent-500/20 text-accent-800'
                      : 'border-neutral-200 hover:bg-neutral-50 text-neutral-700'
                  }`}
                >
                  <AlertTriangle className={`w-5 h-5 mt-0.5 ${result === 'HOLD' ? 'text-accent-700' : 'text-neutral-500'}`} />
                  <div>
                    <span className="text-xs font-bold block">HOLD (Quarantine)</span>
                    <span className="text-[11px] text-neutral-500 mt-0.5 block">
                      Requires manager review or lab testing before issue.
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setResult('REJECT')}
                  className={`p-4 rounded-xl border text-left flex items-start gap-3 transition cursor-pointer ${
                    result === 'REJECT'
                      ? 'bg-danger-50 border-danger-500 ring-2 ring-danger-500/20 text-danger-900'
                      : 'border-neutral-200 hover:bg-neutral-50 text-neutral-700'
                  }`}
                >
                  <XCircle className={`w-5 h-5 mt-0.5 ${result === 'REJECT' ? 'text-danger-600' : 'text-neutral-500'}`} />
                  <div>
                    <span className="text-xs font-bold block">REJECT (Write-Off)</span>
                    <span className="text-[11px] text-neutral-500 mt-0.5 block">
                      Defective fabric. Cannot be issued to production.
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Defect Checklist */}
            {result !== 'PASS' && (
              <div className="pt-2 space-y-2">
                <label className="block text-xs font-bold text-neutral-700">
                  Identified Defects Checklist
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-neutral-50 p-4 rounded-xl border border-neutral-200">
                  {COMMON_DEFECTS.map((defect) => (
                    <label
                      key={defect}
                      className="flex items-center gap-2.5 p-2 rounded hover:bg-white text-xs text-neutral-900 cursor-pointer transition select-none"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDefects.includes(defect)}
                        onChange={() => toggleDefect(defect)}
                        className="rounded border-neutral-300 text-accent-700 focus:ring-brand-500/40"
                      />
                      <span>{defect}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Remarks */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Auditor Notes &amp; Observations
              </label>
              <textarea
                rows={3}
                placeholder=""
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full text-xs border border-neutral-300 rounded-md p-3 focus:ring-1 focus:ring-brand-500/40"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <Link
              href="/fabric-store/my-work/qc-inspections"
              className="px-4 py-2 border border-neutral-300 rounded-md text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className={`flex items-center gap-2 px-6 py-2.5 text-neutral-900 text-xs font-bold rounded-md shadow-xs transition disabled:opacity-50 ${
                result === 'PASS'
                  ? 'bg-accent-500 hover:bg-accent-50'
                  : result === 'HOLD'
                  ? 'bg-accent-400 hover:bg-accent-500'
                  : 'bg-danger-700 hover:bg-danger-100'
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
