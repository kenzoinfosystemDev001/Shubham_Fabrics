'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Search, Trash2, X } from 'lucide-react';
import { newSubmissionKey } from '@/components/challan/ChallanNumberField';
import {
  BTN_PRIMARY,
  BTN_QUIET,
  BTN_SECONDARY,
  DeadlineText,
  EmptyRow,
  FIELD,
  FabricStatusBadge,
  Notice,
  PageHeader,
  Panel,
  THEAD,
  WorkStatusBadge,
  fetchJson,
  fmtQty,
  challanRef,
  sheetRef,
} from '@/components/workflow/WorkflowUi';
import { AllocationStatusBadge, CATEGORY_TONE, CategoryBadge, sheetStyles } from '@/components/recutting/RecuttingUi';
import {
  CATEGORY_LABEL,
  CUT_UNITS,
  GARMENT_CATEGORIES,
  allocatedTotal,
  allocationStatusOf,
  isActiveAllocation,
  readyForStitching,
  unallocated,
} from '@/lib/recutting.mjs';
import { receivedBasis } from '@/lib/work-items.mjs';
import { departmentName } from '@/lib/workflow-views';

const API = '/api/recutting';
const PAGE = '/recutting/my-work/allocation';
const FILTERS = [
  { id: 'open', label: 'To Allocate' },
  { id: 'pending', label: 'Pending' },
  { id: 'progress', label: 'In Progress' },
  { id: 'all', label: 'All Received' },
];

const round = (n: number) => Math.round(n * 1000) / 1000;

function AllocationContent() {
  const params = useSearchParams();
  const router = useRouter();
  const overdue = params.get('overdue') === '1';
  const [filter, setFilter] = useState(params.get('filter') || 'open');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(params.get('itemId'));
  const [current, setCurrent] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ filter });
      if (overdue) q.set('overdue', '1');
      if (search.trim()) q.set('search', search.trim());
      const body = await fetchJson(`${API}/items?${q}`);
      setItems(body.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, overdue]);

  // The open line is always loaded on its own, so it stays current after every change.
  const reloadCurrent = async (id = openId) => {
    if (!id) return setCurrent(null);
    try {
      const body = await fetchJson(`${API}/items/${id}`);
      setCurrent(body.data);
    } catch (e: any) {
      setError(e.message);
      setCurrent(null);
    }
  };
  useEffect(() => {
    reloadCurrent(openId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  const changed = (message: string) => {
    setSuccess(message);
    reloadCurrent();
    load();
  };

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <PageHeader title="Fabric Allocation & Recutting" loading={loading} onRefresh={load}>
        <Link href="/recutting/my-work/issue-challan" className={BTN_PRIMARY}>
          Generate Stitching Challan
        </Link>
      </PageHeader>

      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {error && <Notice kind="error" onClose={() => setError(null)}>{error}</Notice>}
        {success && <Notice kind="success" onClose={() => setSuccess(null)}>{success}</Notice>}
        {overdue && (
          <Notice kind="error" onClose={() => router.replace(PAGE)}>
            Showing overdue work only.
          </Notice>
        )}

        {current && (
          <AllocationWorkspace
            key={current.id}
            item={current}
            onClose={() => {
              setOpenId(null);
              setCurrent(null);
              if (params.get('itemId')) router.replace(PAGE);
            }}
            onChanged={changed}
            onError={setError}
          />
        )}

        <Panel
          title="Received Fabric"
          count={items.length}
          actions={
            <>
              <div role="tablist" className="inline-flex flex-wrap p-0.5 bg-neutral-100 rounded-lg">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    role="tab"
                    aria-selected={filter === f.id}
                    onClick={() => setFilter(f.id)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                      filter === f.id ? 'bg-white text-brand-800 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  load();
                }}
                className="relative"
              >
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" aria-label="Search received fabric" className={`${FIELD} pl-9 md:w-56`} />
              </form>
            </>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className={THEAD}>
                <tr>
                  <th className="py-3 px-4">Production Sheet</th>
                  <th className="py-3 px-3">Incoming Challan</th>
                  <th className="py-3 px-3">Fabric</th>
                  <th className="py-3 px-3">Colour</th>
                  <th className="py-3 px-3">Dyed / Undyed</th>
                  <th className="py-3 px-3 text-right">Received</th>
                  <th className="py-3 px-3 text-right">Allocated</th>
                  <th className="py-3 px-3 text-right">Unallocated</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Deadline</th>
                  <th className="py-3 px-3"><span className="sr-only">Allocate</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {!loading && items.length === 0 && <EmptyRow colSpan={11} text="No received fabric in this view" />}
                {items.map((i) => {
                  const left = unallocated(i, i.allocations);
                  return (
                    <tr key={i.id} className={`hover:bg-neutral-50/60 ${openId === i.id ? 'bg-brand-50/40' : ''}`}>
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs font-semibold text-neutral-900">{sheetRef(i.program)}</span>
                        <span className="block font-mono text-[11px] text-neutral-500">{challanRef(i)}</span>
                      </td>
                      <td className="py-3 px-3 text-xs">
                        <span className="font-mono text-brand-800">{i.inboundChallan?.challanNumber || '—'}</span>
                        <span className="block text-[11px] text-neutral-500">{departmentName(i.sourceDepartment)}</span>
                      </td>
                      <td className="py-3 px-3 font-semibold text-neutral-900">{i.fabricName}</td>
                      <td className="py-3 px-3 text-neutral-700">{i.colour || '—'}</td>
                      <td className="py-3 px-3"><FabricStatusBadge status={i.fabricProcessingStatus} /></td>
                      <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(receivedBasis(i), i.uom)}</td>
                      <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(allocatedTotal(i.allocations), i.uom)}</td>
                      <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap font-semibold">{fmtQty(left, i.uom)}</td>
                      <td className="py-3 px-3"><WorkStatusBadge status={i.status} next="Stitching" /></td>
                      <td className="py-3 px-3 text-xs whitespace-nowrap"><DeadlineText program={i.program} /></td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => {
                            setOpenId(i.id);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className={BTN_QUIET}
                        >
                          {left > 0 ? 'Allocate' : 'View'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </main>
    </div>
  );
}

interface Row {
  key: string;
  category: string;
  otherName: string;
  styleRef: string;
  allocatedQuantity: string;
  cutUom: string;
  cutQuantity: string;
  remarks: string;
}

const newRow = (category: string): Row => ({
  key: Math.random().toString(36).slice(2),
  category,
  otherName: '',
  styleRef: '',
  allocatedQuantity: '',
  cutUom: '',
  cutQuantity: '',
  remarks: '',
});

function AllocationWorkspace({
  item,
  onClose,
  onChanged,
  onError,
}: {
  item: any;
  onClose: () => void;
  onChanged: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [submissionKey, setSubmissionKey] = useState(newSubmissionKey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allocations: any[] = item.allocations || [];
  const received = receivedBasis(item);
  const already = allocatedTotal(allocations);
  const open = unallocated(item, allocations);
  const adding = round(rows.reduce((s, r) => s + (Number(r.allocatedQuantity) || 0), 0));
  const after = round(open - adding);
  const styles = sheetStyles(item.program);
  const p = item.program || {};

  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const save = async () => {
    setError(null);
    if (rows.length === 0) return setError('Add at least one allocation row.');
    if (after < 0) return setError(`These rows allocate ${fmtQty(adding, item.uom)}, but only ${fmtQty(open, item.uom)} is unallocated.`);
    setSaving(true);
    try {
      await fetchJson(`${API}/items/${item.id}/allocations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: submissionKey,
          rows: rows.map(({ key, ...r }) => r),
        }),
      });
      setRows([]);
      setSubmissionKey(newSubmissionKey());
      onChanged(`${item.fabricName}: ${rows.length} allocation${rows.length === 1 ? '' : 's'} saved (${fmtQty(adding, item.uom)}).`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-white border border-brand-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-neutral-200 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-neutral-900 flex flex-wrap items-center gap-2">
            {item.fabricName}
            <span className="font-normal text-neutral-600">{item.colour || ''}</span>
            <FabricStatusBadge status={item.fabricProcessingStatus} />
          </h2>
          <p className="text-xs text-neutral-500 font-mono">{challanRef(item)}</p>
        </div>
        <button type="button" onClick={onClose} className="p-1.5 text-neutral-500 hover:bg-neutral-100 rounded-lg" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-5">
        {error && <Notice kind="error" onClose={() => setError(null)}>{error}</Notice>}

        <dl className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-3 text-sm">
          <Info label="Production Sheet">
            {p.id ? <Link href={`/programs/${p.id}`} className="font-mono hover:underline">{sheetRef(p)}</Link> : '—'}
          </Info>
          <Info label="Design No.">{p.designNumber || p.wilcomDesignNumber || '—'}</Info>
          <Info label="Serial No.">{p.programSerialNo || '—'}</Info>
          <Info label="Style">{styles.join(' / ') || '—'}</Info>
          <Info label="Incoming challan">
            {item.inboundChallan ? (
              <Link href={`/challans/${item.inboundChallan.id}`} className="font-mono hover:underline">{item.inboundChallan.challanNumber}</Link>
            ) : (
              '—'
            )}
          </Info>
          <Info label="Unit">{item.uom}</Info>
          <Info label="Received">{fmtQty(received, item.uom)}</Info>
          <Info label="Allocated">{fmtQty(already, item.uom)}</Info>
          <Info label="Available">{fmtQty(open, item.uom)}</Info>
          <Info label="After these rows">
            <span className={after < 0 ? 'text-danger-700' : ''}>{fmtQty(after, item.uom)}</span>
          </Info>
        </dl>

        <datalist id={`styles-${item.id}`}>
          {styles.map((s) => <option key={s} value={s} />)}
        </datalist>

        <div className="space-y-4">
          {GARMENT_CATEGORIES.map((cat) => (
            <CategorySection
              key={cat}
              category={cat}
              item={item}
              existing={allocations.filter((a) => a.category === cat)}
              rows={rows.filter((r) => r.category === cat)}
              open={open}
              onAdd={() => setRows((rs) => [...rs, newRow(cat)])}
              onUpdate={update}
              onRemove={(key) => setRows((rs) => rs.filter((r) => r.key !== key))}
              onChanged={onChanged}
              onError={onError}
            />
          ))}
        </div>
      </div>

      <div className="px-5 py-4 border-t border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50/60">
        <span className="text-sm text-neutral-600">
          New allocation: <span className="font-semibold text-neutral-900 tabular-nums">{fmtQty(adding, item.uom)}</span> of{' '}
          <span className="tabular-nums">{fmtQty(open, item.uom)}</span> available
          {after < 0 && <span className="ml-2 font-semibold text-danger-700">Exceeds the available balance</span>}
        </span>
        <button type="button" onClick={save} disabled={saving || rows.length === 0 || after < 0} className={BTN_PRIMARY}>
          {saving ? 'Saving…' : 'Save Allocation'}
        </button>
      </div>
    </section>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="font-semibold text-neutral-900 truncate tabular-nums">{children}</dd>
    </div>
  );
}

function CategorySection({
  category,
  item,
  existing,
  rows,
  open,
  onAdd,
  onUpdate,
  onRemove,
  onChanged,
  onError,
}: {
  category: string;
  item: any;
  existing: any[];
  rows: Row[];
  open: number;
  onAdd: () => void;
  onUpdate: (key: string, patch: Partial<Row>) => void;
  onRemove: (key: string) => void;
  onChanged: (message: string) => void;
  onError: (message: string) => void;
}) {
  const label = (CATEGORY_LABEL as Record<string, string>)[category];
  const active = existing.filter(isActiveAllocation);
  const others = category === 'OTHERS';
  return (
    <div className={`border border-neutral-200 border-l-4 ${CATEGORY_TONE[category].section} rounded-xl overflow-hidden`}>
      <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 bg-neutral-50/60">
        <div className="flex items-center gap-2">
          <CategoryBadge category={category} />
          <span className="text-xs text-neutral-500">
            {active.length} allocation{active.length === 1 ? '' : 's'} · {fmtQty(allocatedTotal(active), item.uom)}
          </span>
        </div>
        <button type="button" onClick={onAdd} disabled={open <= 0} className={BTN_SECONDARY}>
          <Plus className="w-3.5 h-3.5" />
          <span>Add {label} row</span>
        </button>
      </div>

      {existing.length > 0 && (
        <div className="overflow-x-auto border-t border-neutral-200">
          <table className="w-full text-left text-xs">
            <thead className={THEAD}>
              <tr>
                <th className="py-2 px-4">Ref</th>
                <th className="py-2 px-3">{others ? 'Item / Style' : 'Style'}</th>
                <th className="py-2 px-3 text-right">Allocated</th>
                <th className="py-2 px-3 text-right">Cut</th>
                <th className="py-2 px-3 text-right">Issued</th>
                <th className="py-2 px-3 text-right">Ready</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {existing.map((a) => (
                <ExistingAllocation key={`${a.id}-${a.updatedAt}`} allocation={a} onChanged={onChanged} onError={onError} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto border-t border-neutral-200">
          <table className="w-full text-left text-sm">
            <thead className={THEAD}>
              <tr>
                {others && <th className="py-2 px-4 min-w-[140px]">Item name</th>}
                <th className={`py-2 ${others ? 'px-3' : 'px-4'} min-w-[150px]`}>Style / sub-style</th>
                <th className="py-2 px-3 min-w-[130px] text-right">Allocate ({item.uom})</th>
                <th className="py-2 px-3 min-w-[100px]">Cut unit</th>
                <th className="py-2 px-3 min-w-[120px] text-right">Cut qty</th>
                <th className="py-2 px-3 min-w-[140px]">Remarks</th>
                <th className="py-2 px-3"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((r) => (
                <tr key={r.key}>
                  {others && (
                    <td className="py-2 px-4">
                      <input value={r.otherName} onChange={(e) => onUpdate(r.key, { otherName: e.target.value })} maxLength={120} required className={FIELD} aria-label="Item name" />
                    </td>
                  )}
                  <td className={`py-2 ${others ? 'px-3' : 'px-4'}`}>
                    <input
                      value={r.styleRef}
                      onChange={(e) => onUpdate(r.key, { styleRef: e.target.value })}
                      list={`styles-${item.id}`}
                      maxLength={120}
                      className={FIELD}
                      aria-label="Style or sub-style"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      min="0.001"
                      step="any"
                      value={r.allocatedQuantity}
                      onChange={(e) => onUpdate(r.key, { allocatedQuantity: e.target.value })}
                      required
                      className={`${FIELD} text-right tabular-nums`}
                      aria-label={`Quantity allocated in ${item.uom}`}
                    />
                  </td>
                  <td className="py-2 px-3">
                    <select value={r.cutUom} onChange={(e) => onUpdate(r.key, { cutUom: e.target.value })} required className={FIELD} aria-label="Cut unit">
                      <option value="">Unit</option>
                      {CUT_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={r.cutQuantity}
                      onChange={(e) => onUpdate(r.key, { cutQuantity: e.target.value })}
                      placeholder="If cut now"
                      className={`${FIELD} text-right tabular-nums`}
                      aria-label="Quantity actually cut"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input value={r.remarks} onChange={(e) => onUpdate(r.key, { remarks: e.target.value })} maxLength={300} className={FIELD} aria-label="Remarks" />
                  </td>
                  <td className="py-2 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => onRemove(r.key)}
                      className="p-2 text-neutral-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg"
                      aria-label="Remove row"
                      title="Remove row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {existing.length === 0 && rows.length === 0 && <p className="px-4 py-3 text-xs text-neutral-400 border-t border-neutral-100">No {label} allocation yet</p>}
    </div>
  );
}

function ExistingAllocation({ allocation: a, onChanged, onError }: { allocation: any; onChanged: (m: string) => void; onError: (m: string) => void }) {
  const [mode, setMode] = useState<'view' | 'cut' | 'cancel'>('view');
  const [cut, setCut] = useState(String(a.cutQuantity || ''));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const status = allocationStatusOf(a);
  const cancelled = status === 'CANCELLED';
  const closed = status === 'TRANSFERRED' || cancelled;

  const run = async (url: string, init: RequestInit, message: string) => {
    setBusy(true);
    try {
      await fetchJson(url, { ...init, headers: { 'Content-Type': 'application/json' } });
      onChanged(message);
    } catch (err: any) {
      onError(err.message);
      setBusy(false);
    }
  };

  return (
    <>
      <tr className={cancelled ? 'text-neutral-400' : ''}>
        <td className="py-2 px-4 font-mono">{a.allocationNumber}</td>
        <td className="py-2 px-3">
          {a.category === 'OTHERS' && a.otherName ? <span className="font-semibold">{a.otherName}</span> : null}
          {a.category === 'OTHERS' && a.otherName && a.styleRef ? ' · ' : ''}
          {a.styleRef || (a.category === 'OTHERS' && a.otherName ? '' : '—')}
        </td>
        <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(a.allocatedQuantity, a.allocatedUom)}</td>
        <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(a.cutQuantity, a.cutUom)}</td>
        <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(a.transferredQuantity, a.cutUom)}</td>
        <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap font-semibold">{fmtQty(readyForStitching(a), a.cutUom)}</td>
        <td className="py-2 px-3">
          <AllocationStatusBadge status={status} />
          {cancelled && a.cancelReason && <span className="block text-[11px]">{a.cancelReason}</span>}
        </td>
        <td className="py-2 px-3 text-right whitespace-nowrap">
          {!closed && mode === 'view' && (
            <div className="inline-flex gap-1.5">
              <button type="button" onClick={() => setMode('cut')} className={BTN_QUIET}>Record cut</button>
              {Number(a.transferredQuantity) <= 0 && (
                <button type="button" onClick={() => setMode('cancel')} className={BTN_QUIET}>Cancel</button>
              )}
            </div>
          )}
        </td>
      </tr>
      {mode !== 'view' && (
        <tr className="bg-neutral-50/60">
          <td colSpan={8} className="px-4 py-2.5">
            {mode === 'cut' ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-neutral-600">Total cut ({a.cutUom})</span>
                <input
                  type="number"
                  min={a.transferredQuantity || 0}
                  step="any"
                  value={cut}
                  onChange={(e) => setCut(e.target.value)}
                  className={`${FIELD} w-32 text-right tabular-nums`}
                  aria-label="Total cut quantity"
                />
                <button
                  type="button"
                  disabled={busy || cut === ''}
                  onClick={() => run(`${API}/allocations/${a.id}`, { method: 'PATCH', body: JSON.stringify({ cutQuantity: cut }) }, `${a.allocationNumber}: cut ${fmtQty(Number(cut), a.cutUom)} recorded.`)}
                  className={BTN_PRIMARY}
                >
                  Save
                </button>
                <button type="button" onClick={() => setMode('view')} className={BTN_QUIET}>Close</button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-neutral-600">Reason (recorded in the audit log)</span>
                <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className={`${FIELD} w-64`} aria-label="Reason for cancelling" />
                <button
                  type="button"
                  disabled={busy || !reason.trim()}
                  onClick={() => run(`${API}/allocations/${a.id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }, `${a.allocationNumber} cancelled; its quantity is available again.`)}
                  className={BTN_PRIMARY}
                >
                  Cancel allocation
                </button>
                <button type="button" onClick={() => setMode('view')} className={BTN_QUIET}>Close</button>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export function RecuttingAllocation() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <AllocationContent />
    </Suspense>
  );
}
