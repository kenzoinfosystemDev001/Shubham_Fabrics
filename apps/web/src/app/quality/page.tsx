'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';
import { DepartmentCode, QualityStatus } from '@subham/types';

export default function QualityGatePage() {
  const [inspections, setInspections] = useState<any[]>([]);
  const [challans, setChallans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Inspection Form
  const [form, setForm] = useState({
    challanId: '',
    programId: '',
    departmentCode: DepartmentCode.QC1,
    sampleSize: 50,
    status: QualityStatus.PASSED,
    notes: 'AQL 1.5 standard inspection passed with minor shade variation within tolerance',
    defects: [
      { defectType: 'SHADE_VARIATION', count: 1, severity: 'MINOR' as const },
    ],
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [insp, chList] = await Promise.all([
        api.getInspections(),
        api.getChallans({ status: 'QC_PENDING' }),
      ]);
      setInspections(insp);
      setChallans(chList);
      if (chList.length > 0 && !form.challanId) {
        setForm((f) => ({
          ...f,
          challanId: chList[0].id,
          programId: chList[0].programId,
          departmentCode: chList[0].toDepartment,
        }));
      }
    } catch (err: any) {
      console.error('QC load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRecordInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.recordInspection(form);
      setIsModalOpen(false);
      await loadData();
      alert('Quality Inspection audit saved and Challan status updated!');
    } catch (err: any) {
      alert(`Inspection error: ${err.message}`);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] w-full mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>🔍</span> Quality Control Gates (QC1, QC2, QC3)
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            4-Point Fabric Inspection, In-process Stitch Audit, Defect Logging and AQL Standard Sign-off
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded shadow transition-colors flex items-center gap-1.5"
          >
            <span>➕</span> Record New QC Inspection
          </button>
        </div>
      </div>

      {/* QC Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <span className="text-xs font-mono text-slate-400 block uppercase">Gate 1: Fabric Inspection (QC1)</span>
          <div className="text-lg font-bold text-slate-200 mt-1">4-Point ASTM System</div>
          <p className="text-[11px] text-slate-400 mt-1">Acceptance: Max 40 points per 100 sq yds</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <span className="text-xs font-mono text-slate-400 block uppercase">Gate 2: Cut & Wash Audit (QC2)</span>
          <div className="text-lg font-bold text-slate-200 mt-1">Shrinkage & Shade Match</div>
          <p className="text-[11px] text-slate-400 mt-1">Tolerance: Length ±3%, Width ±3%</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <span className="text-xs font-mono text-slate-400 block uppercase">Gate 3: Assembly Audit (QC3)</span>
          <div className="text-lg font-bold text-slate-200 mt-1">AQL 1.5 / 2.5 Finished Goods</div>
          <p className="text-[11px] text-slate-400 mt-1">100% Critical Zero-Tolerance defect check</p>
        </div>
      </div>

      {/* Inspections History Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="p-3 border-b border-slate-800 bg-slate-950 font-mono text-xs font-bold text-slate-300">
          Inspection History Ledger
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[11px]">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Gate Station</th>
                <th className="p-3">Challan #</th>
                <th className="p-3">Sample Size</th>
                <th className="p-3">Status</th>
                <th className="p-3">Defects Logged</th>
                <th className="p-3">Auditor</th>
                <th className="p-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {inspections.map((insp) => (
                <tr key={insp.id} className="hover:bg-slate-800/40">
                  <td className="p-3 text-slate-400">{new Date(insp.inspectedAt).toLocaleString()}</td>
                  <td className="p-3 font-bold text-blue-400">{insp.departmentCode}</td>
                  <td className="p-3 text-slate-200 font-semibold">{insp.challan?.challanNumber}</td>
                  <td className="p-3 text-slate-300">{insp.sampleSize} pcs</td>
                  <td className="p-3">
                    <StatusBadge status={insp.status} type="quality" />
                  </td>
                  <td className="p-3">
                    {insp.defects?.length > 0 ? (
                      <div className="space-y-0.5">
                        {insp.defects.map((d: any) => (
                          <span
                            key={d.id}
                            className="inline-block mr-1 px-1.5 py-0.5 rounded text-[10px] bg-rose-950 text-rose-300 border border-rose-800"
                          >
                            {d.defectType}: {d.count} ({d.severity})
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-emerald-400 text-[11px]">Zero Defects</span>
                    )}
                  </td>
                  <td className="p-3 text-slate-300">{insp.inspector?.fullName || insp.inspector?.username}</td>
                  <td className="p-3 text-slate-400 truncate max-w-xs">{insp.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: New QC Inspection */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>🔍</span> Record Quality Inspection Audit
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white font-bold text-lg">
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordInspection} className="space-y-4 text-xs font-mono">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Target Challan</label>
                  <select
                    value={form.challanId}
                    onChange={(e) => {
                      const ch = challans.find((c) => c.id === e.target.value);
                      if (ch) {
                        setForm({
                          ...form,
                          challanId: ch.id,
                          programId: ch.programId,
                          departmentCode: ch.toDepartment,
                        });
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
                  >
                    {challans.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.challanNumber} ({ch.fromDepartment} ➔ {ch.toDepartment})
                      </option>
                    ))}
                    {challans.length === 0 && (
                      <option value="">No QC-Pending Challans (Select from all)</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Inspection Gate</label>
                  <select
                    value={form.departmentCode}
                    onChange={(e) => setForm({ ...form, departmentCode: e.target.value as DepartmentCode })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
                  >
                    <option value="QC1">QC1 - Raw Fabric Inspection</option>
                    <option value="QC2">QC2 - Cut & Wash Audit</option>
                    <option value="QC3">QC3 - Final Assembly Inspection</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Sample Size (Pcs / Rolls)</label>
                  <input
                    type="number"
                    required
                    value={form.sampleSize}
                    onChange={(e) => setForm({ ...form, sampleSize: parseInt(e.target.value, 10) || 1 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-bold"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">QA Decision</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as QualityStatus })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-bold"
                  >
                    <option value="PASSED">PASSED (Release to Next Station)</option>
                    <option value="FAILED">FAILED (Route to Rework / Reject)</option>
                    <option value="CONDITIONALLY_PASSED">CONDITIONALLY_PASSED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Audit Notes & Observations</label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold"
                >
                  Commit QA Sign-off
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
