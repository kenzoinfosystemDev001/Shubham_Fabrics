'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { EmptyRow, FIELD, Notice, PageHeader, Panel, THEAD, fetchJson, fmtDate, fmtQty } from '@/components/workflow/WorkflowUi';
import { departmentName } from '@/lib/workflow-views';

// Defective Shelf (GET /api/defective-shelf). A department sees its own rejected fabric; the Fabric Store (department
// "ALL") is the central shelf of every department, with a department-wise summary. Both read the same rejection
// records, so a changed decision (REJECT -> REWORK) shows in both at once. MTR and PCS are never added together.

type Rec = {
  id: string;
  date: string;
  departmentCode: string;
  qcDepartmentCode: string | null;
  programId: string | null;
  productionSheetNumber: string;
  serialNumber: string;
  designNumber: string;
  style: string | null;
  fabricName: string;
  colour: string | null;
  quantity: number;
  unit: string;
  reason: string;
  remarks: string | null;
  statusLabel: string;
  location: string;
  challanNumber?: string | null;
  recordedBy: string | null;
};

const total = (rows: Rec[], unit: string) => Math.round(rows.filter((r) => r.unit === unit).reduce((s, r) => s + r.quantity, 0) * 1000) / 1000;

export function DefectiveShelf({ department }: { department: string }) {
  const central = department === 'ALL';
  const [rows, setRows] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRecords, setShowRecords] = useState(false);
  const [deptFilter, setDeptFilter] = useState('');
  const [f, setF] = useState({ q: '', unit: '', reason: '', from: '', to: '' });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const body = await fetchJson(`/api/defective-shelf?department=${encodeURIComponent(department)}`);
      setRows(body.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department]);

  const byDepartment = useMemo(() => {
    const map = new Map<string, Rec[]>();
    for (const r of rows) map.set(r.departmentCode, [...(map.get(r.departmentCode) || []), r]);
    return Array.from(map.entries()).map(([code, list]) => ({ code, list }));
  }, [rows]);

  const shown = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    const from = f.from ? new Date(`${f.from}T00:00:00`).getTime() : null;
    const to = f.to ? new Date(`${f.to}T00:00:00`).getTime() + 86400000 : null;
    return rows.filter((r) => {
      if (deptFilter && r.departmentCode !== deptFilter) return false;
      if (f.unit && r.unit !== f.unit) return false;
      if (f.reason && !r.reason.toLowerCase().includes(f.reason.toLowerCase())) return false;
      const at = new Date(r.date).getTime();
      if (from && at < from) return false;
      if (to && at >= to) return false;
      if (q && ![r.designNumber, r.serialNumber, r.productionSheetNumber, r.challanNumber, r.fabricName, r.colour].join(' ').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, deptFilter, f]);

  const open = (code = '') => {
    setDeptFilter(code);
    setShowRecords(true);
  };

  const title = central ? 'Defective Shelf · Central (all departments)' : `Defective Shelf · ${departmentName(department)}`;
  const tile = 'text-left bg-white border border-neutral-200 rounded-2xl p-5 hover:border-brand-300 transition';

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <PageHeader title={title} loading={loading} onRefresh={load} />
      <main className="p-4 sm:p-8 max-w-[1600px] mx-auto space-y-6">
        {error && <Notice kind="error" onClose={() => setError(null)}>{error}</Notice>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(['MTR', 'PCS'] as const).map((u) => (
            <button key={u} type="button" onClick={() => open()} className={tile}>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Total Defective Fabric ({u})</span>
              <span className="block text-3xl font-bold text-neutral-900 tabular-nums mt-1">{fmtQty(total(rows, u), u)}</span>
              <span className="block text-xs text-neutral-500 mt-1">
                {rows.filter((r) => r.unit === u).length} rejection record(s) · click to view
              </span>
            </button>
          ))}
        </div>

        {central && (
          <Panel title="By department" count={byDepartment.length}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className={THEAD}>
                  <tr>
                    <th className="py-2.5 px-4">Department</th>
                    <th className="py-2.5 px-4 text-right">Defective MTR</th>
                    <th className="py-2.5 px-4 text-right">Defective PCS</th>
                    <th className="py-2.5 px-4 text-right">Records</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {!loading && byDepartment.length === 0 && <EmptyRow colSpan={4} text="No rejected fabric in any department." />}
                  {byDepartment.map(({ code, list }) => (
                    <tr key={code} onClick={() => open(code)} className="cursor-pointer hover:bg-brand-50/60">
                      <td className="py-2.5 px-4 font-semibold text-brand-700">{departmentName(code)}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums">{fmtQty(total(list, 'MTR'), 'MTR')}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums">{fmtQty(total(list, 'PCS'), 'PCS')}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums">{list.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {showRecords && (
          <Panel
            title={deptFilter ? `Rejected fabric · ${departmentName(deptFilter)}` : 'Rejected fabric'}
            count={shown.length}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                {central && deptFilter && (
                  <button type="button" onClick={() => setDeptFilter('')} className="text-xs font-semibold text-brand-700 hover:underline">
                    All departments
                  </button>
                )}
                <div className="relative">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Design, serial, challan, fabric, colour…" className={`${FIELD} pl-9 w-60`} aria-label="Search" />
                </div>
                <select value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} className={`${FIELD} w-auto`} aria-label="Unit">
                  <option value="">MTR & PCS</option>
                  <option value="MTR">MTR</option>
                  <option value="PCS">PCS</option>
                </select>
                <input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Reason" className={`${FIELD} w-32`} aria-label="Reason" />
                <input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className={`${FIELD} w-auto`} aria-label="From date" />
                <input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className={`${FIELD} w-auto`} aria-label="To date" />
              </div>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={THEAD}>
                  <tr>
                    {[...(central ? ['Department'] : []), 'Design No.', 'Serial No.', 'Production Sheet', 'Type', 'Challan No.', 'Fabric', 'Colour', 'Rejected Qty', 'Unit', 'Reason', 'Rejected Date', 'Rejected By', 'Remarks', 'Status'].map((h) => (
                      <th key={h} className={`py-2.5 px-3 ${h === 'Rejected Qty' ? 'text-right' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {!loading && shown.length === 0 && <EmptyRow colSpan={central ? 15 : 14} text="No rejected fabric matches." />}
                  {shown.map((r) => (
                    <tr key={r.id} className="align-top hover:bg-neutral-50/60">
                      {central && <td className="py-2.5 px-3 font-semibold whitespace-nowrap">{departmentName(r.departmentCode)}</td>}
                      <td className="py-2.5 px-3 font-semibold text-neutral-900">{r.designNumber}</td>
                      <td className="py-2.5 px-3 font-mono">{r.serialNumber}</td>
                      <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                        {r.programId ? <Link href={`/programs/${r.programId}`} className="text-brand-700 hover:underline">{r.productionSheetNumber}</Link> : r.productionSheetNumber}
                      </td>
                      <td className="py-2.5 px-3">{r.style || '—'}</td>
                      <td className="py-2.5 px-3 font-mono whitespace-nowrap">{r.challanNumber || '—'}</td>
                      <td className="py-2.5 px-3 min-w-[140px] text-neutral-900">{r.fabricName}</td>
                      <td className="py-2.5 px-3">{r.colour || '—'}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-bold text-neutral-900">{fmtQty(r.quantity, r.unit)}</td>
                      <td className="py-2.5 px-3 font-semibold">{r.unit}</td>
                      <td className="py-2.5 px-3 min-w-[140px]">{r.reason}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">{fmtDate(r.date, true)}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">{r.recordedBy || '—'}</td>
                      <td className="py-2.5 px-3 min-w-[140px] text-neutral-600">{r.remarks || '—'}</td>
                      <td className="py-2.5 px-3 min-w-[140px]">
                        <span className="font-semibold">{r.statusLabel}</span>
                        <span className="block text-[11px] text-neutral-500">{r.location}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
        <p className="text-xs text-neutral-500">
          {central
            ? 'Every department’s rejections, read from the same records as each department’s own Defective Shelf. A decision changed to REWORK or HOLD leaves both shelves at once.'
            : 'This department’s rejected fabric. The same records appear in the Fabric Store’s central Defective Shelf; a decision changed to REWORK or HOLD leaves both at once.'}
        </p>
      </main>
    </div>
  );
}
