'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';
import { DEPARTMENT_LABELS } from '@subham/config';
import { DepartmentCode } from '@subham/types';

export default function ProgramDetailPage() {
  const { id } = useParams() as { id: string };
  const [program, setProgram] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'specs' | 'route' | 'bom' | 'challans'>('specs');

  const loadProgram = async () => {
    try {
      setLoading(true);
      const data = await api.getProgram(id);
      setProgram(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadProgram();
  }, [id]);

  const handleApprove = async () => {
    if (!confirm('Authorize this Program for factory shop floor execution?')) return;
    try {
      await api.updateProgramStatus(id, 'APPROVED');
      await loadProgram();
      alert('Program APPROVED! Factory departments may now issue/receive Challans for this order.');
    } catch (err: any) {
      alert(`Approval failed: ${err.message}`);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400 font-mono text-xs">Loading Program Specification...</div>;
  }

  if (error || !program) {
    return (
      <div className="p-8 text-center text-rose-400">
        <p>Error: {error || 'Program not found'}</p>
        <Link href="/programs" className="text-xs text-blue-400 underline mt-2 block">
          ← Back to Programs
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1600px] w-full mx-auto">
      {/* Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-1">
            <Link href="/programs" className="hover:text-slate-200">
              Programs
            </Link>
            <span>/</span>
            <span className="text-slate-200">{program.programNumber}</span>
          </div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span>{program.designName}</span>
            <StatusBadge status={program.status} />
            <StatusBadge status={program.priority} type="priority" />
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {program.status === 'DRAFT' && (
            <button
              onClick={handleApprove}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded shadow transition-colors"
            >
              ✓ Authorize & Approve Program
            </button>
          )}
          <Link
            href={`/challans?programId=${program.id}`}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono rounded border border-slate-700"
          >
            View Active Challans ({program.challans?.length || 0})
          </Link>
        </div>
      </div>

      {/* Program Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded p-3 text-xs">
          <span className="text-slate-500 font-mono block">BUYER / CLIENT</span>
          <span className="font-semibold text-slate-200 mt-1 block">{program.buyer}</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded p-3 text-xs">
          <span className="text-slate-500 font-mono block">ORDER / PO #</span>
          <span className="font-mono text-slate-200 mt-1 block">{program.orderNumber}</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded p-3 text-xs">
          <span className="text-slate-500 font-mono block">STYLE CODE</span>
          <span className="font-mono text-slate-200 mt-1 block">{program.styleCode}</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded p-3 text-xs">
          <span className="text-slate-500 font-mono block">TARGET QUANTITY</span>
          <span className="font-mono font-bold text-slate-200 mt-1 block">
            {program.targetQuantity.toLocaleString()} pcs
          </span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded p-3 text-xs">
          <span className="text-slate-500 font-mono block">DELIVERY DUE</span>
          <span className="font-mono text-slate-200 mt-1 block">
            {new Date(program.deliveryDate).toLocaleDateString()}
          </span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded p-3 text-xs">
          <span className="text-slate-500 font-mono block">APPROVED BY</span>
          <span className="text-slate-200 mt-1 block">
            {program.approvedBy ? program.approvedBy.fullName : 'Pending Approval'}
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-800 flex gap-4 text-xs font-mono">
        <button
          onClick={() => setActiveTab('specs')}
          className={`pb-2 border-b-2 font-semibold transition-colors ${
            activeTab === 'specs' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Fabric & Measurements Spec
        </button>
        <button
          onClick={() => setActiveTab('route')}
          className={`pb-2 border-b-2 font-semibold transition-colors ${
            activeTab === 'route' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Configurable Route ({program.routeSteps?.length || 0} Stages)
        </button>
        <button
          onClick={() => setActiveTab('bom')}
          className={`pb-2 border-b-2 font-semibold transition-colors ${
            activeTab === 'bom' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Bill of Materials (BOM)
        </button>
        <button
          onClick={() => setActiveTab('challans')}
          className={`pb-2 border-b-2 font-semibold transition-colors ${
            activeTab === 'challans' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Challans & Handoffs ({program.challans?.length || 0})
        </button>
      </div>

      {/* Tab 1: Specs */}
      {activeTab === 'specs' && (
        <div className="space-y-6">
          {/* Fabric Specifications */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <h3 className="text-xs font-bold text-slate-200 uppercase font-mono mb-3">Fabric Components</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 font-mono text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-2.5">Code</th>
                    <th className="p-2.5">Fabric Name</th>
                    <th className="p-2.5">Composition</th>
                    <th className="p-2.5">Width</th>
                    <th className="p-2.5">GSM</th>
                    <th className="p-2.5">Colour / Shade</th>
                    <th className="p-2.5">Req. Qty</th>
                    <th className="p-2.5">Tolerance</th>
                    <th className="p-2.5">Supplier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {program.fabrics?.map((f: any) => (
                    <tr key={f.id} className="hover:bg-slate-800/30 font-sans">
                      <td className="p-2.5 font-mono text-blue-400 font-semibold">{f.fabricCode}</td>
                      <td className="p-2.5 text-slate-200">{f.fabricName}</td>
                      <td className="p-2.5 text-slate-300">{f.composition}</td>
                      <td className="p-2.5 font-mono text-slate-300">{f.widthInInches}&quot;</td>
                      <td className="p-2.5 font-mono text-slate-300">{f.gsm} gsm</td>
                      <td className="p-2.5 text-slate-300">{f.colour} ({f.shade})</td>
                      <td className="p-2.5 font-mono font-bold text-slate-200">{f.requiredQuantity} KG</td>
                      <td className="p-2.5 font-mono text-slate-400">±{f.tolerancePercentage}%</td>
                      <td className="p-2.5 text-slate-300">{f.supplier}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Size & Color Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <h3 className="text-xs font-bold text-slate-200 uppercase font-mono mb-3">Size Distribution</h3>
              <div className="space-y-1.5">
                {program.sizeMatrix?.map((s: any) => (
                  <div key={s.id} className="flex justify-between items-center text-xs p-2 bg-slate-950 rounded border border-slate-800">
                    <span className="font-mono font-bold text-slate-300">Size: {s.size}</span>
                    <span className="font-mono text-blue-400 font-bold">{s.targetQuantity} pcs</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <h3 className="text-xs font-bold text-slate-200 uppercase font-mono mb-3">Color Breakdown</h3>
              <div className="space-y-1.5">
                {program.colorMatrix?.map((c: any) => (
                  <div key={c.id} className="flex justify-between items-center text-xs p-2 bg-slate-950 rounded border border-slate-800">
                    <div>
                      <span className="font-semibold text-slate-200">{c.colorName}</span>
                      <span className="text-[10px] text-slate-400 font-mono block">{c.pantoneReference || c.shade}</span>
                    </div>
                    <span className="font-mono text-emerald-400 font-bold">{c.targetQuantity} pcs</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Configurable Route */}
      {activeTab === 'route' && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <h3 className="text-xs font-bold text-slate-200 uppercase font-mono mb-4">
            Custom Manufacturing Route for {program.programNumber}
          </h3>
          <div className="space-y-2">
            {program.routeSteps?.map((step: any) => (
              <div
                key={step.id}
                className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded text-xs font-mono"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded bg-slate-800 text-slate-300 font-bold flex items-center justify-center text-[11px]">
                    {step.sequenceOrder}
                  </span>
                  <div>
                    <span className="font-bold text-slate-200">{step.departmentCode}</span>
                    <span className="text-slate-400 text-[11px] block">
                      {DEPARTMENT_LABELS[step.departmentCode as DepartmentCode] || step.departmentCode}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[11px]">
                  <span className="text-slate-400">Cycle Time: {step.standardCycleTimeMinutes || 45} mins</span>
                  {step.requiresQCGate && (
                    <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                      🛡️ QC Quality Gate
                    </span>
                  )}
                  <span className="text-emerald-400">Mandatory</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: BOM */}
      {activeTab === 'bom' && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <h3 className="text-xs font-bold text-slate-200 uppercase font-mono mb-3">Bill of Materials (BOM)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950 font-mono text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-2.5">Code</th>
                  <th className="p-2.5">Item Name</th>
                  <th className="p-2.5">Category</th>
                  <th className="p-2.5">Per Piece</th>
                  <th className="p-2.5">Wastage %</th>
                  <th className="p-2.5">Total Required</th>
                  <th className="p-2.5">UOM</th>
                  <th className="p-2.5">Supplier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-sans">
                {program.bomItems?.map((b: any) => (
                  <tr key={b.id} className="hover:bg-slate-800/30">
                    <td className="p-2.5 font-mono text-blue-400 font-semibold">{b.itemCode}</td>
                    <td className="p-2.5 text-slate-200 font-medium">{b.itemName}</td>
                    <td className="p-2.5 text-slate-300 font-mono text-[11px]">{b.category}</td>
                    <td className="p-2.5 font-mono text-slate-300">{b.requiredQuantityPerPiece}</td>
                    <td className="p-2.5 font-mono text-slate-400">{b.wastagePercentage}%</td>
                    <td className="p-2.5 font-mono font-bold text-slate-200">{b.totalRequiredQuantity}</td>
                    <td className="p-2.5 font-mono text-slate-300">{b.uom}</td>
                    <td className="p-2.5 text-slate-400">{b.supplier || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Challans */}
      {activeTab === 'challans' && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-200 uppercase font-mono">Associated Movement Challans</h3>
            <Link
              href="/challans"
              className="text-xs text-blue-400 hover:text-blue-300 font-mono"
            >
              Issue New Challan →
            </Link>
          </div>
          <div className="space-y-2">
            {program.challans?.map((ch: any) => (
              <Link
                key={ch.id}
                href={`/challans/${ch.id}`}
                className="block p-3 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded transition-colors text-xs font-mono"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-blue-400">{ch.challanNumber}</span>
                    <span className="text-slate-400">
                      {ch.fromDepartment} ➔ {ch.toDepartment}
                    </span>
                    <StatusBadge status={ch.status} />
                  </div>
                  <span className="text-slate-500">{new Date(ch.createdAt).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
