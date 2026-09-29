'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';
import { DepartmentCode, ChallanType, ProductionUnitType, PriorityLevel } from '@subham/types';

export default function ChallansListPage() {
  const [challans, setChallans] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Challan Form State
  const [form, setForm] = useState({
    challanNumber: '',
    challanType: ChallanType.INTER_DEPARTMENT,
    programId: '',
    parentChallanId: '',
    fromDepartment: DepartmentCode.STORE,
    toDepartment: DepartmentCode.CUTTING,
    priority: PriorityLevel.NORMAL,
    remarks: 'Inter-station garment bundle handoff',
    items: [
      {
        itemDescription: 'Cotton Fabric Rolls / Cut Panels',
        unitType: ProductionUnitType.ROLL,
        rollNumber: 'ROL-2026-009',
        lotNumber: 'LOT-2026-PC-99',
        barcode: 'BAR-009',
        quantity: 120,
        grossWeightKg: 122.5,
        netWeightKg: 120,
        uom: 'KG',
        remarks: 'Direct store issue',
      },
    ],
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [chList, prgList] = await Promise.all([
        api.getChallans({
          department: deptFilter || undefined,
          status: statusFilter || undefined,
        }),
        api.getPrograms({ status: 'APPROVED' }),
      ]);
      setChallans(chList);
      setPrograms(prgList);
      if (prgList.length > 0 && !form.programId) {
        setForm((f) => ({ ...f, programId: prgList[0].id }));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [deptFilter, statusFilter]);

  const openCreateModal = async () => {
    try {
      const nextNum = await api.getNextChallanNumber(form.fromDepartment);
      setForm((f) => ({ ...f, challanNumber: nextNum.nextNumber }));
      setIsModalOpen(true);
    } catch (err: any) {
      alert(`Could not fetch next Challan number: ${err.message}`);
    }
  };

  const handleCreateChallan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createChallan(form);
      setIsModalOpen(false);
      await loadData();
      alert('Challan created successfully in DRAFT state! You may now submit and issue it.');
    } catch (err: any) {
      alert(`Challan creation error: ${err.message}`);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] w-full mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>📜</span> Inter-Department Challan System
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Station-to-station electronic handoff, genealogy linkage, roll/bundle manifests, and state machine
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded shadow transition-colors flex items-center gap-1.5"
          >
            <span>➕</span> Generate New Challan
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-3 rounded-lg border border-slate-800">
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-mono">Department:</span>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-blue-500 font-mono"
          >
            <option value="">All Departments</option>
            {Object.values(DepartmentCode).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-mono">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-blue-500 font-mono"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">DRAFT</option>
            <option value="SUBMITTED">SUBMITTED</option>
            <option value="ISSUED">ISSUED</option>
            <option value="RECEIVED">RECEIVED</option>
            <option value="IN_PROCESS">IN_PROCESS</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="QC_PENDING">QC_PENDING</option>
            <option value="QC_APPROVED">QC_APPROVED</option>
            <option value="HANDED_OVER">HANDED_OVER</option>
            <option value="CLOSED">CLOSED</option>
            <option value="REWORK">REWORK</option>
            <option value="ON_HOLD">ON_HOLD</option>
            <option value="REJECTED">REJECTED</option>
          </select>
        </div>
      </div>

      {/* Dense Challans Grid */}
      {loading ? (
        <div className="p-8 text-center text-slate-400 font-mono text-xs">Loading Challan Records...</div>
      ) : challans.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-12 text-center text-slate-400 text-xs">
          No challans found for the selected filter.
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 font-mono text-[11px] text-slate-400 uppercase">
                <tr>
                  <th className="p-3">Challan #</th>
                  <th className="p-3">Program / Order</th>
                  <th className="p-3">From Station</th>
                  <th className="p-3">To Station</th>
                  <th className="p-3">Items / Units</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Issued Date</th>
                  <th className="p-3">Issuer / Receiver</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {challans.map((ch) => {
                  const totalUnits = (ch.items || []).reduce((acc: number, it: any) => acc + (it.quantity || 0), 0);
                  const uom = ch.items?.[0]?.uom || 'units';

                  return (
                    <tr key={ch.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 font-mono font-bold text-blue-400">
                        <Link href={`/challans/${ch.id}`} className="hover:underline">
                          {ch.challanNumber}
                        </Link>
                      </td>
                      <td className="p-3">
                        <span className="font-mono text-slate-300 block">{ch.program?.programNumber}</span>
                        <span className="text-[11px] text-slate-400 truncate block">
                          {ch.program?.buyer} - {ch.program?.styleCode}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-semibold text-slate-300">{ch.fromDepartment}</td>
                      <td className="p-3 font-mono font-semibold text-blue-300">➔ {ch.toDepartment}</td>
                      <td className="p-3 font-mono text-slate-200">
                        <span className="font-bold">{totalUnits}</span> {uom} ({ch.items?.length || 0} lines)
                      </td>
                      <td className="p-3">
                        <StatusBadge status={ch.status} />
                      </td>
                      <td className="p-3 font-mono text-slate-400">
                        {ch.issuedDate ? new Date(ch.issuedDate).toLocaleDateString() : 'Pending'}
                      </td>
                      <td className="p-3 text-[11px] text-slate-400">
                        <div>Iss: {ch.issuedBy ? ch.issuedBy.username : '—'}</div>
                        <div>Rec: {ch.receivedBy ? ch.receivedBy.username : '—'}</div>
                      </td>
                      <td className="p-3 text-right">
                        <Link
                          href={`/challans/${ch.id}`}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-mono border border-slate-700"
                        >
                          View Pass →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Generate New Challan */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-3xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>📜</span> Issue Inter-Department Transfer Challan
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white font-bold text-lg">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateChallan} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Challan Number (Unique)</label>
                  <input
                    type="text"
                    required
                    readOnly
                    value={form.challanNumber}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-blue-400 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">From Department</label>
                  <select
                    value={form.fromDepartment}
                    onChange={async (e) => {
                      const newDept = e.target.value as DepartmentCode;
                      const nextNum = await api.getNextChallanNumber(newDept);
                      setForm({ ...form, fromDepartment: newDept, challanNumber: nextNum.nextNumber });
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono"
                  >
                    {Object.values(DepartmentCode).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">To Department</label>
                  <select
                    value={form.toDepartment}
                    onChange={(e) => setForm({ ...form, toDepartment: e.target.value as DepartmentCode })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono"
                  >
                    {Object.values(DepartmentCode).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Associated Program</label>
                  <select
                    value={form.programId}
                    onChange={(e) => setForm({ ...form, programId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono"
                  >
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.programNumber} - {p.designName} ({p.buyer})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Remarks / Dispatch Instruction</label>
                  <input
                    type="text"
                    value={form.remarks}
                    onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
                  />
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-800 rounded p-3 bg-slate-950 space-y-2">
                <span className="font-bold text-slate-300 block font-mono">Challan Handoff Items</span>
                <div className="grid grid-cols-6 gap-2 font-mono text-[11px]">
                  <input
                    type="text"
                    placeholder="Description"
                    value={form.items[0].itemDescription}
                    onChange={(e) => {
                      const it = [...form.items];
                      it[0].itemDescription = e.target.value;
                      setForm({ ...form, items: it });
                    }}
                    className="col-span-2 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
                  />
                  <input
                    type="text"
                    placeholder="Roll / Bundle #"
                    value={form.items[0].rollNumber}
                    onChange={(e) => {
                      const it = [...form.items];
                      it[0].rollNumber = e.target.value;
                      setForm({ ...form, items: it });
                    }}
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
                  />
                  <input
                    type="number"
                    placeholder="Quantity"
                    value={form.items[0].quantity}
                    onChange={(e) => {
                      const it = [...form.items];
                      it[0].quantity = parseFloat(e.target.value) || 0;
                      setForm({ ...form, items: it });
                    }}
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
                  />
                  <input
                    type="text"
                    placeholder="UOM"
                    value={form.items[0].uom}
                    onChange={(e) => {
                      const it = [...form.items];
                      it[0].uom = e.target.value;
                      setForm({ ...form, items: it });
                    }}
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
                  />
                  <input
                    type="text"
                    placeholder="Barcode"
                    value={form.items[0].barcode}
                    onChange={(e) => {
                      const it = [...form.items];
                      it[0].barcode = e.target.value;
                      setForm({ ...form, items: it });
                    }}
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-mono text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold text-xs shadow"
                >
                  Generate Challan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
