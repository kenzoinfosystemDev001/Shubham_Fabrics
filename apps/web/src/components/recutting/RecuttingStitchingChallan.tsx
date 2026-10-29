'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus, Send, Trash2 } from 'lucide-react';
import { ChallanNumberField, newSubmissionKey } from '@/components/challan/ChallanNumberField';
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  DocumentsButton,
  EmptyRow,
  FIELD,
  FabricStatusBadge,
  Notice,
  PageHeader,
  Panel,
  THEAD,
  fetchJson,
  fmtDate,
  fmtQty,
  sheetRef,
} from '@/components/workflow/WorkflowUi';
import { CategoryBadge } from '@/components/recutting/RecuttingUi';
import { AverageField, QuantityUnitField, averageError, quantityPairError, type QtyUnit } from '@/components/challan/AverageField';
import { CATEGORY_LABEL, GARMENT_CATEGORIES, categoryName, readyForStitching } from '@/lib/recutting.mjs';

interface Row {
  key: string;
  allocationId: string;
  quantity: string;
  /** Optional Average of the entry, with its own MTR / PCS (never pre-selected). */
  average: string;
  averageUnit: QtyUnit;
  /** Required Unit quantity of the entry, with its own MTR / PCS. */
  unitQuantity: string;
  unitQuantityUom: QtyUnit;
  remarks: string;
}

const newRow = (): Row => ({ key: Math.random().toString(36).slice(2), allocationId: '', quantity: '', average: '', averageUnit: '', unitQuantity: '', unitQuantityUom: '', remarks: '' });

function StitchingChallanContent() {
  const params = useSearchParams();
  const [allocations, setAllocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [programId, setProgramId] = useState(params.get('programId') || '');
  const [category, setCategory] = useState((params.get('category') || '').toUpperCase());
  const [challanNumber, setChallanNumber] = useState('');
  const [numberError, setNumberError] = useState<string | null>(null);
  const [challanDate, setChallanDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState('');
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [submissionKey, setSubmissionKey] = useState(newSubmissionKey);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<any | null>(null);
  const [incharge, setIncharge] = useState('');

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('subham_mes_user') || 'null');
      setIncharge(u?.fullName || u?.username || '');
    } catch {}
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const body = await fetchJson('/api/recutting/allocations?ready=1');
      setAllocations(body.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const sheets = useMemo(() => {
    const map = new Map<string, any>();
    for (const a of allocations) if (a.workItem?.program) map.set(a.workItem.program.id, a.workItem.program);
    return Array.from(map.values());
  }, [allocations]);
  const program = sheets.find((p) => p.id === programId) || null;
  const choices = allocations.filter((a) => a.workItem?.programId === programId && (!category || a.category === category));
  const byId = (id: string) => allocations.find((a) => a.id === id);

  useEffect(() => {
    if (!programId && sheets.length === 1) setProgramId(sheets[0].id);
  }, [sheets, programId]);

  const updateRow = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const choose = (key: string, allocationId: string) => {
    const a = byId(allocationId);
    updateRow(key, { allocationId, quantity: a ? String(readyForStitching(a)) : '' });
  };

  const filled = rows.filter((r) => r.allocationId);
  const totals = filled.reduce<Record<string, number>>((acc, r) => {
    const a = byId(r.allocationId);
    if (a) acc[a.cutUom] = (acc[a.cutUom] || 0) + (Number(r.quantity) || 0);
    return acc;
  }, {});
  const incomingRefs = Array.from(new Set(filled.map((r) => byId(r.allocationId)?.workItem?.inboundChallan?.challanNumber).filter(Boolean)));
  const allocationRefs = filled.map((r) => byId(r.allocationId)?.allocationNumber).filter(Boolean);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNumberError(null);
    if (!program) return setError('Choose a Production Sheet.');
    if (!challanNumber.trim()) return setNumberError('Challan Number is required.');
    if (filled.length === 0) return setError('Add at least one item.');
    const entryError = (r: Row) => averageError(r.average, r.averageUnit) || quantityPairError(r.unitQuantity, r.unitQuantityUom, 'Unit quantity', true);
    const bad = filled.findIndex((r) => entryError(r));
    if (bad >= 0) return setError(`Item ${bad + 1}: ${entryError(filled[bad])}.`);
    setSubmitting(true);
    try {
      const body = await fetchJson('/api/recutting/stitching-challans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: submissionKey,
          challanNumber: challanNumber.trim(),
          issuedDate: challanDate,
          remarks,
          lines: filled.map((r) => ({
            allocationId: r.allocationId,
            quantity: r.quantity,
            ...(r.average.trim() !== '' ? { average: r.average, averageUnit: r.averageUnit } : {}),
            unitQuantity: r.unitQuantity,
            unitQuantityUom: r.unitQuantityUom,
            remarks: r.remarks,
          })),
        }),
      });
      setIssued(body.data);
      setChallanNumber('');
      setRows([newRow()]);
      setRemarks('');
      setSubmissionKey(newSubmissionKey());
      load();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      if (err.body?.field === 'challanNumber') setNumberError(err.message);
      else setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <PageHeader title="Generate Stitching Challan" loading={loading} onRefresh={load}>
        <Link href="/recutting/my-work/issued-challans" className={BTN_SECONDARY}>
          Issued Challans
        </Link>
      </PageHeader>

      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {issued && (
          <Notice kind="success" onClose={() => setIssued(null)}>
            <div className="flex flex-wrap items-center gap-3">
              <span>
                Challan <span className="font-mono font-semibold">{issued.challanNumber}</span> issued to Stitching.
              </span>
              <DocumentsButton programId={issued.programId} challanId={issued.id} />
            </div>
          </Notice>
        )}
        {error && <Notice kind="error" onClose={() => setError(null)}>{error}</Notice>}
        {!loading && allocations.length === 0 && (
          <Notice kind="error">
            Nothing is ready for Stitching. Record the cut quantity on an allocation first.{' '}
            <Link href="/recutting/my-work/allocation-history?open=1" className="font-semibold underline">Open allocations</Link>
          </Notice>
        )}

        <form onSubmit={submit} className="space-y-6">
          <Panel title="Challan">
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <ChallanNumberField value={challanNumber} onChange={setChallanNumber} error={numberError} />
              <label className="block">
                <span className="text-xs font-semibold text-neutral-600">Challan date</span>
                <input type="date" value={challanDate} onChange={(e) => setChallanDate(e.target.value)} required className={`${FIELD} mt-1`} />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-neutral-600">Production Sheet</span>
                <select
                  value={programId}
                  onChange={(e) => {
                    setProgramId(e.target.value);
                    setRows([newRow()]);
                  }}
                  className={`${FIELD} mt-1`}
                  required
                >
                  <option value="">{sheets.length ? 'Choose a sheet' : 'Nothing ready'}</option>
                  {sheets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {sheetRef(p)}{p.designNumber ? ` · ${p.designNumber}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-neutral-600">Garment category</span>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${FIELD} mt-1`}>
                  <option value="">All categories</option>
                  {GARMENT_CATEGORIES.map((c) => <option key={c} value={c}>{(CATEGORY_LABEL as Record<string, string>)[c]} only</option>)}
                </select>
              </label>
              <ReadOnly label="Source" value="Recutting" />
              <ReadOnly label="Destination" value="Stitching" />
              <ReadOnly label="Design / Serial" value={program ? `${program.designNumber || program.wilcomDesignNumber || '—'} · ${program.programSerialNo || '—'}` : '—'} />
              <ReadOnly label="Delivery date" value={program ? fmtDate(program.deliveryDate) : '—'} />
              <ReadOnly label="Incoming challan" value={incomingRefs.join(', ') || '—'} />
              <ReadOnly label="Allocation refs" value={allocationRefs.join(', ') || '—'} />
              <ReadOnly label="Issued by" value={incharge || '—'} />
              <label className="block">
                <span className="text-xs font-semibold text-neutral-600">Remarks</span>
                <input value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={500} className={`${FIELD} mt-1`} />
              </label>
            </div>
          </Panel>

          <Panel
            title="Category / Style / Color / Fabric / Measurement"
            count={filled.length}
            actions={
              <button type="button" onClick={() => setRows((rs) => [...rs, newRow()])} disabled={!program || rows.length >= choices.length} className={BTN_SECONDARY}>
                <Plus className="w-3.5 h-3.5" />
                <span>Add item</span>
              </button>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className={THEAD}>
                  <tr>
                    <th className="py-3 px-4 min-w-[240px]">Allocation</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Style</th>
                    <th className="py-3 px-3">Colour</th>
                    <th className="py-3 px-3">Fabric</th>
                    <th className="py-3 px-3">Dyed / Undyed</th>
                    <th className="py-3 px-3 text-right">Ready</th>
                    <th className="py-3 px-3 min-w-[220px]">Size</th>
                    <th className="py-3 px-3 min-w-[200px]">Average</th>
                    <th className="py-3 px-3 min-w-[200px]">Unit</th>
                    <th className="py-3 px-3 min-w-[140px]">Remarks</th>
                    <th className="py-3 px-3"><span className="sr-only">Remove</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {!program && <EmptyRow colSpan={12} text="Choose a Production Sheet to add items" />}
                  {program &&
                    rows.map((r) => {
                      const a = byId(r.allocationId);
                      const taken = new Set(rows.filter((x) => x.key !== r.key).map((x) => x.allocationId));
                      const over = a && Number(r.quantity) > readyForStitching(a);
                      return (
                        <tr key={r.key}>
                          <td className="py-2.5 px-4">
                            <select value={r.allocationId} onChange={(e) => choose(r.key, e.target.value)} className={FIELD} aria-label="Allocation">
                              <option value="">Choose a cut allocation</option>
                              {choices.filter((x) => !taken.has(x.id)).map((x) => (
                                <option key={x.id} value={x.id}>
                                  {x.allocationNumber} · {categoryName(x)}{x.styleRef ? ` · ${x.styleRef}` : ''} · {x.workItem?.colour || '—'} · {fmtQty(readyForStitching(x), x.cutUom)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5 px-3">{a ? <CategoryBadge category={a.category} otherName={a.otherName} /> : '—'}</td>
                          <td className="py-2.5 px-3 text-neutral-800">{a?.styleRef || '—'}</td>
                          <td className="py-2.5 px-3 text-neutral-700">{a?.workItem?.colour || '—'}</td>
                          <td className="py-2.5 px-3 font-semibold text-neutral-900">{a?.workItem?.fabricName || '—'}</td>
                          <td className="py-2.5 px-3">{a ? <FabricStatusBadge status={a.workItem?.fabricProcessingStatus} /> : '—'}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{a ? fmtQty(readyForStitching(a), a.cutUom) : '—'}</td>
                          <td className="py-2.5 px-3">
                            <QuantityUnitField
                              label="Size"
                              value={r.quantity}
                              unit={a?.cutUom === 'MTR' || a?.cutUom === 'PCS' ? a.cutUom : ''}
                              onValue={(quantity) => updateRow(r.key, { quantity })}
                              required={Boolean(a)}
                              disabled={!a}
                              min="0.001"
                              max={a ? readyForStitching(a) : undefined}
                              lockedTitle={a ? `This allocation is cut in ${a.cutUom}; meters and pieces are never converted` : undefined}
                              inputClassName={`${FIELD} text-right ${over ? 'border-danger-500' : ''}`}
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <AverageField average={r.average} averageUnit={r.averageUnit} onChange={(patch) => updateRow(r.key, patch)} disabled={!a} />
                          </td>
                          <td className="py-2.5 px-3">
                            <QuantityUnitField
                              label="Unit quantity"
                              value={r.unitQuantity}
                              unit={r.unitQuantityUom}
                              onValue={(unitQuantity) => updateRow(r.key, { unitQuantity })}
                              onUnit={(unitQuantityUom) => updateRow(r.key, { unitQuantityUom })}
                              required={Boolean(a)}
                              disabled={!a}
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input value={r.remarks} onChange={(e) => updateRow(r.key, { remarks: e.target.value })} maxLength={300} className={FIELD} aria-label="Remarks" />
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : [newRow()]))}
                              className="p-2 text-neutral-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg"
                              aria-label="Remove item"
                              title="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-4 border-t border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-sm text-neutral-600">
                Total to stitch:{' '}
                <span className="font-semibold text-neutral-900 tabular-nums">{Object.entries(totals).map(([u, q]) => fmtQty(q, u)).join(' · ') || '—'}</span>
              </span>
              <button type="submit" disabled={submitting || !program} className={BTN_PRIMARY}>
                <Send className="w-3.5 h-3.5" />
                <span>{submitting ? 'Issuing…' : 'Issue Challan'}</span>
              </button>
            </div>
          </Panel>
        </form>
      </main>
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs font-semibold text-neutral-600">{label}</span>
      <div className="mt-1 h-9 px-3 flex items-center bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-700 truncate">{value}</div>
    </div>
  );
}

export function RecuttingStitchingChallan() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <StitchingChallanContent />
    </Suspense>
  );
}
