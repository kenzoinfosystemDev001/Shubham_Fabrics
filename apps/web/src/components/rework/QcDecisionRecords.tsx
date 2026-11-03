'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BTN_PRIMARY, EmptyRow, FIELD, Notice, PageHeader, Panel, THEAD, fetchJson, fmtDate, fmtQty, sheetRef } from '@/components/workflow/WorkflowUi';
import { pendingReject, pendingRework } from '@/lib/work-items.mjs';
import type { WorkflowView } from '@/lib/workflow-views';

// A QC department's REJECT or REWORK decisions. Neither needs a challan: REJECT is on the Defective Shelf when it is
// recorded, and REWORK goes to the configured rework department as a rework task. This page shows where each one
// is now. Lines decided before that (still waiting for the challan that is no longer used) can be routed here.

export function QcDecisionRecords({ flow, kind }: { flow: WorkflowView; kind: 'REJECT' | 'REWORK' }) {
  const [records, setRecords] = useState<any[]>([]);
  const [waiting, setWaiting] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const reject = kind === 'REJECT';
  const noun = flow.garments ? 'Items' : 'Material';
  const title = reject ? `Rejected ${noun}` : `Rework ${noun}`;
  const destination = reject ? 'the Defective Shelf' : flow.qc?.reworkTo || 'the rework department';
  const pendingOf = (i: any) => (reject ? pendingReject(i) : pendingRework(i));

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, w] = await Promise.all([
        fetchJson(`/api/quality-records?department=${flow.code}&kind=${kind}`),
        fetchJson(`${flow.api}/items?available=${kind}`),
      ]);
      setRecords(r.data || []);
      setWaiting(w.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const route = async (item: any) => {
    setBusy(item.id);
    setError(null);
    setNotice(null);
    try {
      const body = await fetchJson(`${flow.api}/items/${item.id}/route-decisions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      setNotice(body.message);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const q = search.trim().toLowerCase();
  const statuses = useMemo(() => Array.from(new Set(records.map((r) => r.statusLabel))).sort(), [records]);
  const shown = useMemo(
    () =>
      records.filter(
        (r) =>
          (!status || r.statusLabel === status) &&
          (!q || [r.productionSheetNumber, r.serialNumber, r.designNumber, r.challanNumber, r.fabricName, r.colour, r.reason, ...r.references].some((v) => String(v || '').toLowerCase().includes(q))),
      ),
    [records, status, q],
  );

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <PageHeader title={title} loading={loading} onRefresh={load}>
        {reject && (
          <Link href={flow.defectivePage ? `${flow.base}/my-work/defective` : `${flow.base}/defective-shelf`} className="text-xs font-semibold text-brand-700 hover:text-brand-900">
            Defective Shelf
          </Link>
        )}
      </PageHeader>
      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {error && <Notice kind="error" onClose={() => setError(null)}>{error}</Notice>}
        {notice && <Notice kind="success" onClose={() => setNotice(null)}>{notice}</Notice>}
        <p className="px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm text-neutral-700">
          {reject
            ? 'REJECT is recorded on the inspection and goes onto the Defective Shelf straight away: this department’s shelf and the Fabric Store central shelf show the same record. No challan is needed.'
            : `REWORK is recorded on the inspection and goes to ${destination} straight away as a rework task, with its Production Sheet, challan and fabric. No challan is needed now; ${destination} forwards the finished rework on its own challan, and it comes back here for inspection.`}
        </p>

        {waiting.length > 0 && (
          <Panel title={`Decided earlier, still waiting for a challan`} count={waiting.length}>
            <p className="px-5 pt-3 text-xs text-neutral-600">
              These were decided before REJECT and REWORK stopped needing a challan. {reject ? 'Move them to the Defective Shelf' : `Send them to ${destination}`} without a challan.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className={THEAD}>
                  <tr>
                    <th className="py-3 px-4">Production Sheet</th>
                    <th className="py-3 px-3">Line</th>
                    <th className="py-3 px-3">Fabric · Colour</th>
                    <th className="py-3 px-3 text-right">Waiting</th>
                    <th className="py-3 px-3"><span className="sr-only">Route</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {waiting.map((i) => (
                    <tr key={i.id}>
                      <td className="py-2.5 px-4 font-mono text-xs font-semibold">{sheetRef(i.program)}</td>
                      <td className="py-2.5 px-3 font-mono text-xs">{i.itemNumber} · {i.inboundChallan?.challanNumber || '—'}</td>
                      <td className="py-2.5 px-3 text-xs">{[i.garmentCategory, i.fabricName, i.colour].filter(Boolean).join(' · ')}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-semibold whitespace-nowrap">{fmtQty(pendingOf(i), i.uom)}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button type="button" onClick={() => route(i)} disabled={busy !== null} className={BTN_PRIMARY}>
                          {busy === i.id ? 'Saving…' : reject ? 'Move to Defective Shelf' : `Send to ${destination}`}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        <Panel
          title={reject ? 'Rejections' : 'Rework Decisions'}
          count={shown.length}
          actions={
            <>
              <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" className={`${FIELD} w-52`}>
                <option value="">Every status</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Sheet, design, challan, fabric" aria-label="Search" className={`${FIELD} w-56`} />
            </>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className={THEAD}>
                <tr>
                  <th className="py-3 px-4">Decided</th>
                  <th className="py-3 px-3">Production Sheet</th>
                  <th className="py-3 px-3">Challan</th>
                  <th className="py-3 px-3">Fabric · Colour</th>
                  <th className="py-3 px-3 text-right">Quantity</th>
                  <th className="py-3 px-3">Reason</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Where</th>
                  <th className="py-3 px-3">Records</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {!loading && shown.length === 0 && <EmptyRow colSpan={9} text={records.length ? 'Nothing matches the filters' : reject ? 'Nothing has been rejected' : 'Nothing has been sent for rework'} />}
                {shown.map((r) => (
                  <tr key={r.id} className="align-top hover:bg-neutral-50/60">
                    <td className="py-3 px-4 text-xs whitespace-nowrap">
                      {fmtDate(r.date, true)}
                      {r.recordedBy && <span className="block text-neutral-500">by {r.recordedBy}</span>}
                    </td>
                    <td className="py-3 px-3 text-xs">
                      <span className="font-mono font-semibold">{r.productionSheetNumber}</span>
                      <span className="block text-neutral-500">Serial {r.serialNumber} · Design {r.designNumber}</span>
                      {r.style && <span className="block text-neutral-500">{r.style}</span>}
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-brand-800">{r.challanNumber || '—'}</td>
                    <td className="py-3 px-3 text-xs">
                      <span className="font-semibold text-neutral-900">{r.fabricName}</span>
                      <span className="block text-neutral-500">{[r.colour, r.shade].filter(Boolean).join(' · ') || '—'}</span>
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap font-semibold">
                      {fmtQty(r.quantity, r.unit)}
                      {r.remainingQuantity != null && r.remainingQuantity > 0 && <span className="block text-[11px] font-normal text-neutral-500">To forward {fmtQty(r.remainingQuantity, r.unit)}</span>}
                    </td>
                    <td className="py-3 px-3 text-xs text-neutral-700 max-w-[200px]">{r.reason}</td>
                    <td className="py-3 px-3 text-xs font-semibold whitespace-nowrap">{r.statusLabel}</td>
                    <td className="py-3 px-3 text-xs text-neutral-700 max-w-[220px]">{r.location}</td>
                    <td className="py-3 px-3 text-[11px] text-neutral-500 max-w-[240px]">{r.references.join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </main>
    </div>
  );
}
