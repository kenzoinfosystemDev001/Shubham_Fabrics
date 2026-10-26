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
import { TRANSFERABLE_STATUSES, availableFor } from '@/lib/work-items.mjs';
import { destinationName, workPath, type TransferKind, type WorkflowView } from '@/lib/workflow-views';
import { GarmentTag } from '@/components/recutting/RecuttingUi';
import { GarmentImageUpload, GarmentThumb, useGarmentImages } from '@/components/workflow/FinishedGarments';
import { groupGarments, imageFor } from '@/lib/finished-garments.mjs';
import { formatTotals, totalsByUnit } from '@/lib/challan-units.mjs';

const AVAILABLE_LABEL: Record<TransferKind, string> = { PASS: 'Available', REJECT: 'Rejected', REWORK: 'For Rework' };

/** Reasons recorded at inspection for this outcome. */
function reasonsOf(item: any, kind: TransferKind) {
  const pick = (x: any) => (kind === 'REJECT' ? x.rejectReason : x.reworkReason);
  return Array.from(new Set((item?.inspections || []).map(pick).filter(Boolean))).join('; ');
}

interface Row {
  key: string;
  itemId: string;
  quantity: string;
  remarks: string;
}

const newRow = (): Row => ({ key: Math.random().toString(36).slice(2), itemId: '', quantity: '', remarks: '' });

function IssueChallanContent({ flow, kind }: { flow: WorkflowView; kind: TransferKind }) {
  const params = useSearchParams();
  const available = (i: any): number => availableFor(i, kind);
  const dest = destinationName(flow, kind);
  const noun = flow.garments ? 'Items' : 'Material';
  const title = kind === 'REJECT' ? `Rejected ${noun}` : kind === 'REWORK' ? `Rework ${noun}` : `Issue Challan to ${flow.next}`;
  const [items, setItems] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [programId, setProgramId] = useState(params.get('programId') || '');
  const [challanNumber, setChallanNumber] = useState('');
  const [numberError, setNumberError] = useState<string | null>(null);
  const [challanDate, setChallanDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState('');
  const [priority, setPriority] = useState('');
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
      const [o, r] = await Promise.all([
        fetchJson(flow.qc ? `${flow.api}/items?available=${kind}` : `${flow.api}/items?status=IN_PROGRESS,${TRANSFERABLE_STATUSES.join(',')}`),
        fetchJson(`${flow.api}/transfer-challans?kind=${kind}`),
      ]);
      setItems(o.data || []);
      setRecent(r.data || []);
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

  // Lines that may move now: completed or ready (QC: with this outcome), with quantity not yet sent.
  const ready = useMemo(
    () => items.filter((i) => (flow.qc || TRANSFERABLE_STATUSES.includes(i.status)) && available(i) > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items],
  );
  // The next department may accept one unit only (Final QC -> Inventory: pieces); other lines wait.
  const unitBlocked = useMemo(
    () => (kind === 'PASS' && flow.passUnit ? ready.filter((i) => i.uom !== flow.passUnit) : []),
    [ready, kind, flow.passUnit],
  );
  const eligible = useMemo(() => ready.filter((i) => !unitBlocked.includes(i)), [ready, unitBlocked]);
  // Processed work still marked In Progress: it must be marked Completed or Ready first.
  const notMarked = useMemo(
    () => (flow.qc ? [] : items.filter((i) => i.status === 'IN_PROGRESS' && available(i) > 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items],
  );
  const sheets = useMemo(() => {
    const map = new Map<string, any>();
    for (const i of eligible) if (i.program) map.set(i.program.id, i.program);
    return Array.from(map.values());
  }, [eligible]);
  const program = sheets.find((p) => p.id === programId) || null;
  const sheetItems = eligible.filter((i) => i.programId === programId);
  const itemById = (id: string) => sheetItems.find((i) => i.id === id);

  // Finished garments (Finishing onward): rows choose a garment (all its lines and pieces), not a line.
  const finished = Boolean(flow.finishedGoods);
  const canAddImages = finished && flow.code === 'FINISHING' && kind === 'PASS';
  const garments = useMemo(() => (finished ? groupGarments(sheetItems) : []), [finished, sheetItems]);
  const garmentByKey = (key: string) => garments.find((g) => g.key === key);
  const { images, reload: reloadImages } = useGarmentImages(finished ? [programId, ...recent.map((c) => c.programId)] : []);

  useEffect(() => {
    if (!programId && sheets.length === 1) setProgramId(sheets[0].id);
  }, [sheets, programId]);

  const updateRow = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const chooseItem = (key: string, itemId: string) => {
    const i = itemById(itemId);
    updateRow(key, { itemId, quantity: i ? String(available(i)) : '' });
  };

  const filled = rows.filter((r) => r.itemId);
  // The work lines each row sends, with the quantity that goes (finished garments: all available pieces).
  const rowLines = (r: Row) =>
    finished
      ? (garmentByKey(r.itemId)?.items || []).map((i: any) => ({ item: i, quantity: available(i) }))
      : [itemById(r.itemId)].filter(Boolean).map((i) => ({ item: i, quantity: Number(r.quantity) || 0 }));
  const chosenLines = filled.flatMap(rowLines);
  const totals = chosenLines.reduce<Record<string, number>>((acc, l) => {
    acc[l.item.uom] = (acc[l.item.uom] || 0) + l.quantity;
    return acc;
  }, {});
  const incomingRefs = Array.from(new Set(chosenLines.map((l) => l.item.inboundChallan?.challanNumber).filter(Boolean)));
  const withoutImage = canAddImages ? filled.map((r) => garmentByKey(r.itemId)).filter((g) => g && !imageFor(images, g.items[0])) : [];

  const resetForm = () => {
    setChallanNumber('');
    setRows([newRow()]);
    setRemarks('');
    setPriority('');
    setSubmissionKey(newSubmissionKey());
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNumberError(null);
    if (!program) return setError('Choose a Production Sheet.');
    if (!challanNumber.trim()) return setNumberError('Challan Number is required.');
    if (filled.length === 0) return setError(finished ? 'Add at least one finished garment.' : 'Add at least one item.');
    if (withoutImage.length > 0) return setError(`Add the image of ${withoutImage.map((g) => g!.name).join(', ')} before issuing the challan.`);
    setSubmitting(true);
    try {
      const body = await fetchJson(`${flow.api}/transfer-challans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: submissionKey,
          kind,
          priority: priority || undefined,
          challanNumber: challanNumber.trim(),
          issuedDate: challanDate,
          remarks,
          // Finished garments send no quantity: the server sends every available piece of each line.
          lines: finished
            ? filled.flatMap((r) => (garmentByKey(r.itemId)?.items || []).map((i: any) => ({ workItemId: i.id, remarks: r.remarks })))
            : filled.map((r) => ({ workItemId: r.itemId, quantity: r.quantity, remarks: r.remarks })),
        }),
      });
      setIssued(body.data);
      resetForm();
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
      <PageHeader title={title} loading={loading} onRefresh={load} />

      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {issued && (
          <Notice kind="success" onClose={() => setIssued(null)}>
            <div className="flex flex-wrap items-center gap-3">
              <span>
                Challan <span className="font-mono font-semibold">{issued.challanNumber}</span> issued to {dest}.
              </span>
              <DocumentsButton programId={issued.programId} challanId={issued.id} />
            </div>
          </Notice>
        )}
        {error && <Notice kind="error" onClose={() => setError(null)}>{error}</Notice>}
        {unitBlocked.length > 0 && (
          <Notice kind="error">
            {unitBlocked.map((i) => i.itemNumber).join(', ')} {unitBlocked.length === 1 ? 'is' : 'are'} recorded in{' '}
            {Array.from(new Set(unitBlocked.map((i) => i.uom))).join(' / ')}. {dest} receives finished garments in {flow.passUnit} only, so{' '}
            {unitBlocked.length === 1 ? 'it is' : 'they are'} not listed here; meters are never converted to pieces.
          </Notice>
        )}
        {notMarked.length > 0 && (
          <Notice kind="error">
            {notMarked.length} line{notMarked.length === 1 ? ' has' : 's have'} processed quantity but {notMarked.length === 1 ? 'is' : 'are'} still In Progress. Mark
            them Completed or Ready to transfer them.{' '}
            <Link href={`${workPath(flow)}?status=IN_PROGRESS`} className="font-semibold underline">Open {flow.label} Process</Link>
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
                  <option value="">{sheets.length ? 'Choose a sheet' : kind === 'PASS' ? 'Nothing ready' : 'Nothing pending'}</option>
                  {sheets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {sheetRef(p)}{p.designNumber ? ` · ${p.designNumber}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <ReadOnly label="Design / Serial" value={program ? `${program.designNumber || program.wilcomDesignNumber || '—'} · ${program.programSerialNo || '—'}` : '—'} />
              <ReadOnly label="Source" value={flow.label} />
              <ReadOnly label="Destination" value={dest} />
              <ReadOnly label="Incoming challan" value={incomingRefs.join(', ') || '—'} />
              <ReadOnly label="Department incharge (issued by)" value={incharge || '—'} />
              <label className="block">
                <span className="text-xs font-semibold text-neutral-600">Priority</span>
                <select value={priority} onChange={(e) => setPriority(e.target.value)} className={`${FIELD} mt-1`}>
                  <option value="">Same as the work</option>
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </label>
              <ReadOnly label="Delivery date" value={program ? fmtDate(program.deliveryDate) : '—'} />
              <label className="block sm:col-span-2 lg:col-span-3">
                <span className="text-xs font-semibold text-neutral-600">Remarks</span>
                <input value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={500} className={`${FIELD} mt-1`} />
              </label>
            </div>
          </Panel>

          <Panel
            title={finished ? 'Finished Garments' : 'Color / Fabric / Measurement'}
            count={filled.length}
            actions={
              <button
                type="button"
                onClick={() => setRows((rs) => [...rs, newRow()])}
                disabled={!program || rows.length >= (finished ? garments.length : sheetItems.length)}
                className={BTN_SECONDARY}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{finished ? 'Add garment' : 'Add item'}</span>
              </button>
            }
          >
            {finished ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className={THEAD}>
                    <tr>
                      <th className="py-3 px-4 w-24">Image</th>
                      <th className="py-3 px-3 min-w-[240px]">Finished garment</th>
                      {kind !== 'PASS' && <th className="py-3 px-3">Reason</th>}
                      <th className="py-3 px-3">Incoming</th>
                      <th className="py-3 px-3 min-w-[160px]">Remarks</th>
                      <th className="py-3 px-3"><span className="sr-only">Remove</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {!program && <EmptyRow colSpan={kind === 'PASS' ? 5 : 6} text="Choose a Production Sheet to add finished garments" />}
                    {program &&
                      rows.map((r) => {
                        const g = garmentByKey(r.itemId);
                        const image = g ? imageFor(images, g.items[0]) : null;
                        const taken = new Set(rows.filter((x) => x.key !== r.key).map((x) => x.itemId));
                        return (
                          <tr key={r.key} className="align-middle">
                            <td className="py-2.5 px-4">
                              <GarmentThumb image={image} name={g?.name || 'Garment'} />
                            </td>
                            <td className="py-2.5 px-3">
                              <select value={r.itemId} onChange={(e) => updateRow(r.key, { itemId: e.target.value })} className={FIELD} aria-label="Finished garment">
                                <option value="">Choose a finished garment</option>
                                {garments.filter((x) => !taken.has(x.key)).map((x) => (
                                  <option key={x.key} value={x.key}>{x.name}</option>
                                ))}
                              </select>
                              {g && canAddImages && (
                                <div className="mt-1.5">
                                  <GarmentImageUpload programId={programId} garmentCategory={g.garmentCategory} styleRef={g.styleRef} hasImage={Boolean(image)} onUploaded={reloadImages} />
                                </div>
                              )}
                            </td>
                            {kind !== 'PASS' && (
                              <td className="py-2.5 px-3 text-xs text-neutral-700 max-w-[200px]">
                                {g ? Array.from(new Set(g.items.map((i: any) => reasonsOf(i, kind)).filter(Boolean))).join('; ') || '—' : '—'}
                              </td>
                            )}
                            <td className="py-2.5 px-3 font-mono text-xs text-neutral-600">
                              {g ? Array.from(new Set(g.items.map((i: any) => i.inboundChallan?.challanNumber).filter(Boolean))).join(', ') || '—' : '—'}
                            </td>
                            <td className="py-2.5 px-3">
                              <input value={r.remarks} onChange={(e) => updateRow(r.key, { remarks: e.target.value })} maxLength={300} className={FIELD} aria-label="Remarks" />
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : [newRow()]))}
                                className="p-2 text-neutral-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg"
                                aria-label="Remove garment"
                                title="Remove garment"
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
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className={THEAD}>
                  <tr>
                    <th className="py-3 px-4 min-w-[220px]">{flow.label} Line</th>
                    <th className="py-3 px-3">Colour</th>
                    <th className="py-3 px-3">Fabric</th>
                    <th className="py-3 px-3">Dyed / Undyed</th>
                    {kind !== 'PASS' && <th className="py-3 px-3">Reason</th>}
                    <th className="py-3 px-3">Incoming</th>
                    <th className="py-3 px-3 text-right">{AVAILABLE_LABEL[kind]}</th>
                    <th className="py-3 px-3 min-w-[130px] text-right">Transfer Qty</th>
                    <th className="py-3 px-3">Unit</th>
                    <th className="py-3 px-3 min-w-[140px]">Remarks</th>
                    <th className="py-3 px-3"><span className="sr-only">Remove</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {!program && <EmptyRow colSpan={kind === 'PASS' ? 10 : 11} text="Choose a Production Sheet to add items" />}
                  {program &&
                    rows.map((r) => {
                      const i = itemById(r.itemId);
                      const taken = new Set(rows.filter((x) => x.key !== r.key).map((x) => x.itemId));
                      const over = i && Number(r.quantity) > available(i);
                      return (
                        <tr key={r.key}>
                          <td className="py-2.5 px-4">
                            <select value={r.itemId} onChange={(e) => chooseItem(r.key, e.target.value)} className={FIELD} aria-label={`${flow.label} line`}>
                              <option value="">Choose a ready line</option>
                              {sheetItems.filter((x) => !taken.has(x.id)).map((x) => (
                                <option key={x.id} value={x.id}>
                                  {x.itemNumber} · {x.garmentCategory ? `${x.garmentCategory}${x.styleRef ? ` ${x.styleRef}` : ''} · ` : ''}{x.fabricName} · {x.colour || '—'} · {x.fabricProcessingStatus === 'DYED' ? 'Dyed' : 'Undyed'}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5 px-3 text-neutral-700">{i?.colour || '—'}</td>
                          <td className="py-2.5 px-3 font-semibold text-neutral-900">{i?.fabricName || '—'}<GarmentTag item={i} /></td>
                          <td className="py-2.5 px-3">{i ? <FabricStatusBadge status={i.fabricProcessingStatus} /> : '—'}</td>
                          {kind !== 'PASS' && <td className="py-2.5 px-3 text-xs text-neutral-700 max-w-[200px]">{i ? reasonsOf(i, kind) || '—' : '—'}</td>}
                          <td className="py-2.5 px-3 font-mono text-xs text-neutral-600">{i?.inboundChallan?.challanNumber || '—'}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{i ? fmtQty(available(i), i.uom) : '—'}</td>
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              min="0.001"
                              step="any"
                              max={i ? available(i) : undefined}
                              value={r.quantity}
                              onChange={(e) => updateRow(r.key, { quantity: e.target.value })}
                              disabled={!i}
                              required={Boolean(i)}
                              className={`${FIELD} text-right tabular-nums ${over ? 'border-danger-500' : ''}`}
                              aria-label="Quantity to transfer"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-xs font-semibold">{i?.uom || '—'}</td>
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
            )}
            <div className="px-5 py-4 border-t border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {finished ? (
                <span className="text-sm text-neutral-600">
                  {filled.length
                    ? `${filled.length} finished garment${filled.length === 1 ? '' : 's'} go to ${dest} with the Production Sheet.`
                    : `Choose the finished garments to send to ${dest}.`}
                </span>
              ) : (
              <span className="text-sm text-neutral-600">
                Total to transfer:{' '}
                <span className="font-semibold text-neutral-900 tabular-nums">
                  {Object.entries(totals).map(([u, q]) => fmtQty(q, u)).join(' · ') || '—'}
                </span>
              </span>
              )}
              <button type="submit" disabled={submitting || !program} className={BTN_PRIMARY}>
                <Send className="w-3.5 h-3.5" />
                <span>{submitting ? 'Issuing…' : 'Issue Challan'}</span>
              </button>
            </div>
          </Panel>
        </form>

        <Panel title={`Recent Challans to ${dest}`} count={recent.length}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className={THEAD}>
                <tr>
                  <th className="py-3 px-4">Challan</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Production Sheet</th>
                  <th className="py-3 px-3">Incoming Challan</th>
                  <th className="py-3 px-3">{finished ? 'Finished garments' : 'Items'}</th>
                  {!finished && <th className="py-3 px-3 text-right">Quantity</th>}
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3"><span className="sr-only">Documents</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {!loading && recent.length === 0 && <EmptyRow colSpan={finished ? 7 : 8} text="No challans issued yet" />}
                {recent.slice(0, 15).map((c) => (
                  <tr key={c.id} className="hover:bg-neutral-50/60 align-top">
                    <td className="py-3 px-4 font-mono text-xs font-bold text-brand-800">
                      <Link href={`/challans/${c.id}`} className="hover:underline">{c.challanNumber}</Link>
                    </td>
                    <td className="py-3 px-3 text-xs text-neutral-600">{fmtDate(c.issuedDate || c.createdAt)}</td>
                    <td className="py-3 px-3 font-mono text-xs">{sheetRef(c.program)}</td>
                    <td className="py-3 px-3 font-mono text-xs text-neutral-600">
                      {Array.from(new Set((c.workTransfers || []).map((t: any) => t.workItem?.inboundChallan?.challanNumber).filter(Boolean))).join(', ') ||
                        c.parentChallan?.challanNumber ||
                        '—'}
                    </td>
                    {finished ? (
                      <td className="py-3 px-3 text-xs text-neutral-700">
                        {groupGarments((c.items || []).map((i: any) => ({ ...i, programId: c.programId }))).map((g) => (
                          <span key={g.key} className="flex items-center gap-2 whitespace-nowrap py-0.5">
                            <GarmentThumb image={imageFor(images, g.items[0])} name={g.name} size="sm" />
                            <span className="font-semibold text-neutral-900">{g.name}</span>
                          </span>
                        ))}
                      </td>
                    ) : (
                      <>
                        <td className="py-3 px-3 text-xs text-neutral-700">
                          {(c.items || []).map((i: any) => (
                            <span key={i.id} className="flex items-center gap-1.5 whitespace-nowrap py-0.5">
                              <span>{i.fabricCode || i.itemDescription} · {i.colour || '—'}</span>
                              <FabricStatusBadge status={i.fabricProcessingStatus} />
                            </span>
                          ))}
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">
                          {formatTotals(totalsByUnit(c.items || []), '—')}
                        </td>
                      </>
                    )}
                    <td className="py-3 px-3 text-xs">{String(c.status || '').replace(/_/g, ' ')}</td>
                    <td className="py-3 px-3 text-right"><DocumentsButton programId={c.programId} challanId={c.id} /></td>
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

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs font-semibold text-neutral-600">{label}</span>
      <div className="mt-1 h-9 px-3 flex items-center bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-700 truncate">{value}</div>
    </div>
  );
}

export function WorkIssueChallan({ flow, kind = 'PASS' }: { flow: WorkflowView; kind?: TransferKind }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <IssueChallanContent flow={flow} kind={kind} />
    </Suspense>
  );
}
