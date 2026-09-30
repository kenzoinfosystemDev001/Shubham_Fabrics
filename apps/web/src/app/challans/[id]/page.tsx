'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';
import { ProductionSheetTraveler } from '@/components/ProductionSheetTraveler';

export default function ChallanDetailPage() {
  const { id } = useParams() as { id: string };
  const [challan, setChallan] = useState<any>(null);
  const [genealogy, setGenealogy] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTravelerModal, setShowTravelerModal] = useState(false);

  const loadChallan = async () => {
    try {
      setLoading(true);
      const [ch, gen] = await Promise.all([
        api.getChallan(id),
        api.getGenealogy(id),
      ]);
      setChallan(ch);
      setGenealogy(gen);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadChallan();
  }, [id]);

  const handleTransition = async (newStatus: string) => {
    const note = prompt(`Enter action remarks for transitioning to '${newStatus}':`, `Authorized transition to ${newStatus}`);
    if (note === null) return;

    try {
      await api.updateChallanStatus(id, newStatus, note);
      await loadChallan();
      alert(`Challan status transitioned to: ${newStatus}`);
    } catch (err: any) {
      alert(`Transition error: ${err.message}`);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400 font-mono text-xs">Loading Challan Document...</div>;
  }

  if (error || !challan) {
    return (
      <div className="p-8 text-center text-rose-400">
        <p>Error: {error || 'Challan not found'}</p>
        <Link href="/challans" className="text-xs text-blue-400 underline mt-2 block">
          ← Back to Challans
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1200px] w-full mx-auto">
      {/* Top Bar (Actions, Print, Back) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4 no-print">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-1">
            <Link href="/challans" className="hover:text-slate-200">
              Challan Registry
            </Link>
            <span>/</span>
            <span className="text-slate-200">{challan.challanNumber}</span>
          </div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2 font-mono">
            <span>{challan.challanNumber}</span>
            <StatusBadge status={challan.status} />
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {challan.status === 'DRAFT' && (
            <button
              onClick={() => handleTransition('SUBMITTED')}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded shadow font-mono"
            >
              Submit Challan
            </button>
          )}

          {challan.status === 'SUBMITTED' && (
            <button
              onClick={() => handleTransition('ISSUED')}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded shadow font-mono"
            >
              Issue / Dispatch From Station
            </button>
          )}

          {challan.status === 'ISSUED' && (
            <button
              onClick={() => handleTransition('RECEIVED')}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded shadow font-mono"
            >
              Acknowledge Physical Receipt
            </button>
          )}

          {challan.status === 'RECEIVED' && (
            <button
              onClick={() => handleTransition('IN_PROCESS')}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded shadow font-mono"
            >
              Start Station WIP
            </button>
          )}

          {challan.status === 'IN_PROCESS' && (
            <button
              onClick={() => handleTransition('COMPLETED')}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded shadow font-mono"
            >
              Mark Station Complete
            </button>
          )}

          {challan.status === 'COMPLETED' && (
            <button
              onClick={() => handleTransition('QC_PENDING')}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded shadow font-mono"
            >
              Submit to QC Gate
            </button>
          )}

          {challan.status === 'QC_PENDING' && (
            <>
              <button
                onClick={() => handleTransition('QC_APPROVED')}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded shadow font-mono"
              >
                ✓ Approve QC
              </button>
              <button
                onClick={() => handleTransition('REWORK')}
                className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold rounded shadow font-mono"
              >
                ⚠ Flag for Rework
              </button>
            </>
          )}

          {challan.status === 'QC_APPROVED' && (
            <button
              onClick={() => handleTransition('HANDED_OVER')}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded shadow font-mono"
            >
              Handover to Next Station
            </button>
          )}

          <button
            onClick={() => setShowTravelerModal(true)}
            className="px-3 py-1.5 bg-[#1E3A8A] hover:bg-[#152B68] text-white text-xs font-semibold rounded shadow flex items-center gap-1.5 font-mono"
          >
            <span>📄</span> View Production Sheet (Traveler)
          </button>

          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono rounded border border-slate-700 flex items-center gap-1.5"
          >
            <span>🖨️</span> Print Gate Pass
          </button>
        </div>
      </div>

      {/* ATTACHED MASTER PRODUCTION SHEET BANNER (Generated by Programming Dept) */}
      <div className="bg-blue-950/40 border border-blue-800/80 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-blue-900 border border-blue-700 flex items-center justify-center text-lg shrink-0">
            📋
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-blue-200">ATTACHED PRODUCTION SHEET (TRAVELER)</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-900/80 text-blue-300 border border-blue-700">
                PROGRAMMING DEPT
              </span>
            </div>
            <p className="text-slate-300 mt-0.5">
              Program: <strong className="text-white font-mono">{challan.program?.programNumber}</strong> — Style: {challan.program?.styleCode || 'SF-3201'} ({challan.program?.designName}) · Target: {challan.program?.targetQuantity?.toLocaleString()} PCS
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowTravelerModal(true)}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold shrink-0 transition"
        >
          Open Traveler Sheet →
        </button>
      </div>

      {/* TRAVELER MODAL OVERLAY */}
      {showTravelerModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl">
            <ProductionSheetTraveler
              program={challan.program}
              currentChallan={challan}
              activeDepartment={challan.toDepartment || challan.fromDepartment}
              onClose={() => setShowTravelerModal(false)}
            />
          </div>
        </div>
      )}

      {/* Official Factory Challan Sheet (Print-optimized) */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-6 text-slate-100 shadow-md print:bg-white print:text-black print:border-black">
        {/* Document Header */}
        <div className="flex justify-between items-start border-b border-slate-800 print:border-black pb-4">
          <div>
            <h2 className="text-lg font-bold tracking-wider">SUBHAM FABRICS & APPAREL LTD.</h2>
            <p className="text-xs text-slate-400 print:text-gray-600 font-mono">
              Inter-Departmental Material Movement Gate Pass / Delivery Challan
            </p>
          </div>
          <div className="text-right">
            <span className="font-mono text-base font-bold text-blue-400 print:text-black block">
              {challan.challanNumber}
            </span>
            <span className="text-[11px] font-mono text-slate-400 print:text-gray-600 block">
              Type: {challan.challanType}
            </span>
          </div>
        </div>

        {/* Transfer Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-950 print:bg-gray-100 rounded border border-slate-800 print:border-black text-xs font-mono">
          <div>
            <span className="text-slate-500 print:text-gray-600 block">DISPATCH STATION</span>
            <span className="text-sm font-bold text-slate-200 print:text-black mt-1 block">
              {challan.fromDepartment}
            </span>
            <span className="text-[11px] text-slate-400 print:text-gray-600">
              {challan.fromDeptRel?.name}
            </span>
          </div>

          <div>
            <span className="text-slate-500 print:text-gray-600 block">RECEIVING STATION</span>
            <span className="text-sm font-bold text-blue-400 print:text-black mt-1 block">
              ➔ {challan.toDepartment}
            </span>
            <span className="text-[11px] text-slate-400 print:text-gray-600">
              {challan.toDeptRel?.name}
            </span>
          </div>

          <div>
            <span className="text-slate-500 print:text-gray-600 block">PROGRAM & ORDER</span>
            <span className="font-bold text-slate-200 print:text-black mt-1 block">
              {challan.program?.programNumber}
            </span>
            <span className="text-[11px] text-slate-400 print:text-gray-600 truncate block">
              PO: {challan.program?.orderNumber} ({challan.program?.styleCode})
            </span>
          </div>

          <div>
            <span className="text-slate-500 print:text-gray-600 block">ISSUED / RECEIVED AT</span>
            <span className="text-slate-200 print:text-black mt-1 block">
              {challan.issuedDate ? new Date(challan.issuedDate).toLocaleString() : 'Not Yet Issued'}
            </span>
            <span className="text-[11px] text-slate-400 print:text-gray-600 block">
              Rec: {challan.receivedDate ? new Date(challan.receivedDate).toLocaleString() : 'Pending Receipt'}
            </span>
          </div>
        </div>

        {/* Itemized Manifest */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-slate-300 print:text-black">
            Material Manifest & Quantity Breakdown
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border border-slate-800 print:border-black">
              <thead className="bg-slate-950 print:bg-gray-200 font-mono text-[11px] text-slate-400 print:text-black border-b border-slate-800 print:border-black">
                <tr>
                  <th className="p-2.5">#</th>
                  <th className="p-2.5">Item Description</th>
                  <th className="p-2.5">Roll / Lot / Bundle #</th>
                  <th className="p-2.5">Colour & Shade</th>
                  <th className="p-2.5">Barcode</th>
                  <th className="p-2.5">Gross Wt</th>
                  <th className="p-2.5">Net Wt</th>
                  <th className="p-2.5">Quantity</th>
                  <th className="p-2.5">UOM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 print:divide-black font-mono">
                {challan.items?.map((it: any, idx: number) => (
                  <tr key={it.id || idx}>
                    <td className="p-2.5 text-slate-500 print:text-black">{idx + 1}</td>
                    <td className="p-2.5 font-sans font-medium text-slate-200 print:text-black">
                      {it.itemDescription}
                    </td>
                    <td className="p-2.5 font-bold text-slate-300 print:text-black">
                      {it.rollNumber || it.bundleNumber || it.lotNumber || '—'}
                    </td>
                    <td className="p-2.5 text-slate-400 print:text-black">
                      {it.colour ? `${it.colour} (${it.shade || ''})` : '—'}
                    </td>
                    <td className="p-2.5 text-blue-400 print:text-black">{it.barcode || '—'}</td>
                    <td className="p-2.5 text-slate-400 print:text-black">
                      {it.grossWeightKg ? `${it.grossWeightKg} KG` : '—'}
                    </td>
                    <td className="p-2.5 text-slate-400 print:text-black">
                      {it.netWeightKg ? `${it.netWeightKg} KG` : '—'}
                    </td>
                    <td className="p-2.5 font-bold text-emerald-400 print:text-black">{it.quantity}</td>
                    <td className="p-2.5 text-slate-400 print:text-black">{it.uom}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Genealogy Chain Visualizer */}
        <div className="bg-slate-950 print:hidden border border-slate-800 rounded p-4 space-y-2">
          <h4 className="text-xs font-bold uppercase font-mono tracking-wider text-slate-300">
            Genealogy Ancestry & Descendant Tree
          </h4>
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            {(genealogy?.ancestors || []).map((anc: any) => (
              <React.Fragment key={anc.id}>
                <Link
                  href={`/challans/${anc.id}`}
                  className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded text-slate-300 hover:text-white"
                >
                  {anc.challanNumber} ({anc.fromDepartment} ➔ {anc.toDepartment})
                </Link>
                <span className="text-slate-600">➔</span>
              </React.Fragment>
            ))}

            <span className="px-3 py-1 bg-blue-900/60 border border-blue-500 rounded text-blue-200 font-bold">
              ★ {challan.challanNumber} (CURRENT)
            </span>

            {(genealogy?.descendants || []).map((desc: any) => (
              <React.Fragment key={desc.id}>
                <span className="text-slate-600">➔</span>
                <Link
                  href={`/challans/${desc.id}`}
                  className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded text-slate-300 hover:text-white"
                >
                  {desc.challanNumber} ({desc.fromDepartment} ➔ {desc.toDepartment})
                </Link>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Digital Sign-off Blocks */}
        <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-800 print:border-black text-xs font-mono">
          <div className="border border-slate-800 print:border-black p-3 rounded">
            <span className="text-slate-500 print:text-gray-600 block text-[10px]">ISSUING SUPERVISOR</span>
            <span className="font-semibold text-slate-200 print:text-black mt-1 block">
              {challan.issuedBy ? challan.issuedBy.fullName : 'Awaiting Issue'}
            </span>
            <span className="text-[10px] text-slate-500 print:text-gray-600 block mt-3">Signature & Stamp</span>
          </div>

          <div className="border border-slate-800 print:border-black p-3 rounded">
            <span className="text-slate-500 print:text-gray-600 block text-[10px]">RECEIVING SUPERVISOR</span>
            <span className="font-semibold text-slate-200 print:text-black mt-1 block">
              {challan.receivedBy ? challan.receivedBy.fullName : 'Awaiting Receiver'}
            </span>
            <span className="text-[10px] text-slate-500 print:text-gray-600 block mt-3">Signature & Stamp</span>
          </div>

          <div className="border border-slate-800 print:border-black p-3 rounded">
            <span className="text-slate-500 print:text-gray-600 block text-[10px]">QUALITY CONTROLLER (QA)</span>
            <span className="font-semibold text-slate-200 print:text-black mt-1 block">
              {challan.approvedBy ? challan.approvedBy.fullName : 'Pending Quality Sign-off'}
            </span>
            <span className="text-[10px] text-slate-500 print:text-gray-600 block mt-3">QC Stamp & Sign</span>
          </div>
        </div>
      </div>
    </div>
  );
}
