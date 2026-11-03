'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Eye, FileText, Pencil, Printer, RefreshCw, Search, X } from 'lucide-react';
import { DeleteRecordButton } from '@/components/common/DeleteRecordDialog';
import { printChallan } from '@/lib/download-challan';
import { ProductionSheetPrintModal } from '@/components/production-sheet/ProductionSheetPrintModal';

// Floor Board > COMPLETED: the challans this department has issued (GET /api/challans/issued). A challan is
// listed as soon as it is issued; its receiving status follows the destination's receipt. Refreshes every minute.

const REFRESH_MS = 60000;
const PAGE_SIZE = 20;

const DEPARTMENTS: Array<{ code: string; name: string }> = [
  { code: 'STORE', name: 'Fabric Store' }, { code: 'DYEING', name: 'Dyeing' }, { code: 'QC1', name: 'Dyeing QC' },
  { code: 'EMBROIDERY', name: 'Embroidery' }, { code: 'THREAD_CUTTING', name: 'Thread Cutting' }, { code: 'QC2', name: 'Threadcut QC' },
  { code: 'WASHING', name: 'Washing' }, { code: 'QC3', name: 'Washing QC' }, { code: 'RECUTTING', name: 'Recutting' },
  { code: 'STITCHING', name: 'Stitching' }, { code: 'FINISHING', name: 'Finishing' }, { code: 'STEAM_PRESS', name: 'Steam Press' },
  { code: 'FINAL_CHECK', name: 'Final QC' }, { code: 'INVENTORY', name: 'Inventory' },
];

const RECEIVING_TONE: Record<string, string> = {
  PENDING: 'bg-danger-50 text-danger-700 border-danger-200',
  PARTIALLY_RECEIVED: 'bg-brand-50 text-brand-800 border-brand-200',
  RECEIVED: 'bg-accent-100 text-neutral-900 border-accent-300',
};

const qty = (n: number | null | undefined) => (n == null ? '—' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: 3 }));
const totalsText = (t: Record<string, number> | null | undefined) =>
  Object.entries(t || {}).filter(([, v]) => v).map(([u, v]) => `${qty(v)} ${u}`).join(' · ') || '0';
const dateTime = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

function ReceivingBadge({ status, label }: { status: string; label: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold whitespace-nowrap ${RECEIVING_TONE[status] || RECEIVING_TONE.PENDING}`}>{label}</span>;
}

/** The challan as the printed document needs it (GET /api/challans/:id), with each line's width. */
async function printableChallan(row: any) {
  const res = await fetch(`/api/challans/${row.id}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Could not load the challan.');
  const widthOf = new Map<string, string | null>(row.items.map((i: any) => [i.id, i.width]));
  return { ...body, items: (body.items || []).map((i: any) => ({ ...i, width: widthOf.get(i.id) || null })) };
}

async function printIssued(row: any) {
  try {
    printChallan(await printableChallan(row));
  } catch (e: any) {
    window.alert(e.message || 'Could not print the challan.');
  }
}

/**
 * Tabs above a department's Floor Board: the board itself, and COMPLETED (challans the department issued) with
 * a live count. `department` is the issuing department's code.
 */
export function FloorBoardTabs({ department, children }: { department: string; children: React.ReactNode }) {
  const [tab, setTab] = useState<'board' | 'completed'>('board');
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get('tab') === 'completed') setTab('completed');
    } catch {}
  }, []);

  const loadCount = useCallback(async () => {
    const res = await fetch(`/api/challans/issued?department=${encodeURIComponent(department)}&countsOnly=1`).catch(() => null);
    const body = res && res.ok ? await res.json().catch(() => null) : null;
    if (body && typeof body.count === 'number') setCount(body.count);
  }, [department]);

  useEffect(() => {
    loadCount();
    const timer = setInterval(loadCount, REFRESH_MS);
    return () => clearInterval(timer);
  }, [loadCount]);

  const choose = (next: 'board' | 'completed') => {
    setTab(next);
    try {
      const url = new URL(window.location.href);
      if (next === 'completed') url.searchParams.set('tab', 'completed');
      else url.searchParams.delete('tab');
      window.history.replaceState(null, '', url.toString());
    } catch {}
  };

  const tabClass = (active: boolean) =>
    `flex items-center gap-2 pb-2.5 pt-1 border-b-2 text-[13px] font-semibold transition ${active ? 'border-brand-600 text-neutral-900' : 'border-transparent text-neutral-500 hover:text-neutral-900'}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-6 border-b border-neutral-200" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'board'} onClick={() => choose('board')} className={tabClass(tab === 'board')}>
          Floor Board
        </button>
        <button type="button" role="tab" aria-selected={tab === 'completed'} onClick={() => choose('completed')} className={tabClass(tab === 'completed')}>
          Completed
          <span className={`text-[11px] min-w-5 px-1.5 rounded-full tabular-nums text-center ${tab === 'completed' ? 'bg-brand-50 text-brand-700' : 'bg-neutral-100 text-neutral-500'}`}>
            {count ?? '…'}
          </span>
        </button>
      </div>
      {tab === 'board' ? children : <IssuedChallansPanel department={department} onCount={setCount} />}
    </div>
  );
}

const EMPTY_FILTERS = { q: '', toDepartment: '', from: '', to: '', status: '', fabric: '', style: '', sort: 'latest' };

export function IssuedChallansPanel({ department, onCount }: { department: string; onCount?: (n: number) => void }) {
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [sheetProgramId, setSheetProgramId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ department, page: String(page), pageSize: String(PAGE_SIZE) });
      for (const [k, v] of Object.entries(applied)) if (v.trim()) params.set(k, v.trim());
      const res = await fetch(`/api/challans/issued?${params.toString()}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not load the issued challans.');
      setData(body);
      if (typeof body.count === 'number') onCount?.(body.count);
      if (body.page && body.page !== page) setPage(body.page);
    } catch (e: any) {
      setError(e.message || 'Could not load the issued challans.');
    } finally {
      setLoading(false);
    }
  }, [department, page, applied, onCount]);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const apply = (e?: React.FormEvent) => {
    e?.preventDefault();
    setPage(1);
    setApplied({ ...draft });
  };
  const reset = () => {
    setDraft(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setPage(1);
  };

  const input = 'h-9 px-2.5 border border-neutral-300 rounded-lg text-xs text-neutral-900 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 w-full';
  const label = 'block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1';
  const rows: any[] = data?.data || [];
  const counts = data?.receivingCounts;
  const cell = 'py-2 px-3 align-top';
  const itemCell = 'py-2 px-3 align-top whitespace-nowrap';

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <p className="text-xs text-neutral-600">
          Every challan issued by this department, as soon as it is issued.{' '}
          {counts && (
            <span className="text-neutral-500">
              Pending receipt {counts.PENDING} · Partially received {counts.PARTIALLY_RECEIVED} · Received {counts.RECEIVED}
            </span>
          )}
        </p>
        <button type="button" onClick={load} disabled={loading} className="self-start md:self-auto inline-flex items-center gap-1.5 h-8 px-3 bg-white hover:bg-neutral-50 text-neutral-700 rounded-lg text-xs font-semibold ring-1 ring-neutral-300">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <form onSubmit={apply} className="bg-white p-3.5 rounded-xl border border-neutral-200 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={draft.q}
              onChange={(e) => setDraft({ ...draft, q: e.target.value })}
              placeholder="Search Challan No., Design No., Production Serial or Client"
              aria-label="Search"
              className={`${input} pl-8`}
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="h-9 px-4 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold">Apply</button>
            <button type="button" onClick={reset} className="h-9 px-3 bg-white hover:bg-neutral-50 text-neutral-700 rounded-lg text-xs font-semibold ring-1 ring-neutral-300">Reset</button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          <div>
            <label className={label} htmlFor="ic-to">Receiving dept.</label>
            <select id="ic-to" value={draft.toDepartment} onChange={(e) => setDraft({ ...draft, toDepartment: e.target.value })} className={input}>
              <option value="">All</option>
              {DEPARTMENTS.filter((d) => d.code !== department).map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="ic-from">Issued from</label>
            <input id="ic-from" type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} className={input} />
          </div>
          <div>
            <label className={label} htmlFor="ic-until">Issued to</label>
            <input id="ic-until" type="date" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} className={input} />
          </div>
          <div>
            <label className={label} htmlFor="ic-status">Receiving status</label>
            <select id="ic-status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} className={input}>
              <option value="">All</option>
              <option value="PENDING">Pending Receipt</option>
              <option value="PARTIALLY_RECEIVED">Partially Received</option>
              <option value="RECEIVED">Received</option>
            </select>
          </div>
          <div>
            <label className={label} htmlFor="ic-fabric">Fabric name</label>
            <input id="ic-fabric" value={draft.fabric} onChange={(e) => setDraft({ ...draft, fabric: e.target.value })} className={input} />
          </div>
          <div>
            <label className={label} htmlFor="ic-style">Top / Bottom</label>
            <select id="ic-style" value={draft.style} onChange={(e) => setDraft({ ...draft, style: e.target.value })} className={input}>
              <option value="">All</option>
              {['TOP', 'BOTTOM', 'DUPATTA', 'OTHERS'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="ic-sort">Sort</label>
            <select
              id="ic-sort"
              value={draft.sort}
              onChange={(e) => {
                const next = { ...draft, sort: e.target.value };
                setDraft(next);
                setApplied((a) => ({ ...a, sort: next.sort }));
              }}
              className={input}
            >
              <option value="latest">Latest issued</option>
              <option value="oldest">Oldest issued</option>
            </select>
          </div>
        </div>
      </form>

      {error && (
        <div role="alert" className="px-3 py-2.5 rounded-lg bg-danger-50 border border-danger-200 text-xs text-danger-800 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button type="button" onClick={load} className="font-bold underline">Retry</button>
        </div>
      )}
      {notice && (
        <div role="status" className="px-3 py-2.5 rounded-lg bg-accent-50 border border-accent-300 text-xs font-semibold text-neutral-900 flex items-center justify-between gap-2">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className={`w-full text-left text-xs ${loading && data ? 'opacity-60' : ''}`}>
            <thead className="bg-neutral-50 text-[10px] font-bold uppercase tracking-wider text-neutral-500 border-b border-neutral-200">
              <tr>
                {['S.No.', 'Challan No.', 'Issue Date & Time', 'From', 'To', 'Production Sheet', 'Design No.', 'Serial No.', 'Client', 'Style', 'Fabric', 'Colour', 'Shade', 'Width', 'Issued Qty', 'Unit', 'Received', 'Issued By', 'Receiving Status', 'Action'].map((h) => (
                  <th key={h} className={`py-2.5 px-3 whitespace-nowrap ${h === 'Issued Qty' || h === 'Received' ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            {rows.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={20} className="px-4 py-12 text-center text-neutral-500">
                    {loading ? 'Loading…' : 'No issued challans found.'}
                  </td>
                </tr>
              </tbody>
            ) : (
              rows.map((c, index) => {
                const items: any[] = c.items.length ? c.items : [null];
                const span = items.length;
                return (
                  <tbody key={c.id} className="border-b border-neutral-200 last:border-b-0 hover:bg-neutral-50/60">
                    {items.map((it, k) => (
                      <tr key={it?.id || k} className={k > 0 ? 'border-t border-dashed border-neutral-100' : ''}>
                        {k === 0 && (
                          <>
                            <td rowSpan={span} className={`${cell} text-neutral-500 tabular-nums`}>{(data.page - 1) * data.pageSize + index + 1}</td>
                            <td rowSpan={span} className={cell}>
                              <button type="button" onClick={() => setDetailId(c.id)} className="font-mono font-bold text-brand-800 hover:underline whitespace-nowrap">{c.challanNumber}</button>
                            </td>
                            <td rowSpan={span} className={`${cell} whitespace-nowrap`}>{dateTime(c.issuedAt)}</td>
                            <td rowSpan={span} className={`${cell} whitespace-nowrap`}>{c.fromDepartmentName}</td>
                            <td rowSpan={span} className={`${cell} whitespace-nowrap font-semibold`}>{c.toDepartmentName}</td>
                            <td rowSpan={span} className={`${cell} whitespace-nowrap font-mono text-[11px]`}>{c.program?.programNumber || '—'}</td>
                            <td rowSpan={span} className={`${cell} whitespace-nowrap font-semibold`}>{c.program?.designNumber || '—'}</td>
                            <td rowSpan={span} className={`${cell} whitespace-nowrap`}>{c.program?.serialNumber || '—'}</td>
                            <td rowSpan={span} className={`${cell} whitespace-nowrap`}>{c.program?.clientName || '—'}</td>
                          </>
                        )}
                        <td className={itemCell}>{it?.style || '—'}</td>
                        <td className="py-2 px-3 align-top min-w-[10rem]">
                          <span className="font-semibold text-neutral-900">{it?.fabricName || '—'}</span>
                          {it?.fabricCode && it.fabricCode !== it.fabricName && <span className="block text-[10px] text-neutral-500 font-mono">{it.fabricCode}</span>}
                        </td>
                        <td className={itemCell}>{it?.colour || '—'}</td>
                        <td className={itemCell}>{it?.shade || '—'}</td>
                        <td className={itemCell}>{it?.width || '—'}</td>
                        <td className={`${itemCell} text-right font-bold tabular-nums`}>{it ? qty(it.quantity) : '—'}</td>
                        <td className={itemCell}>{it?.unit || '—'}</td>
                        <td className={`${itemCell} text-right tabular-nums text-neutral-600`}>{it ? qty(it.received) : '—'}</td>
                        {k === 0 && (
                          <>
                            <td rowSpan={span} className={`${cell} whitespace-nowrap`}>{c.issuedBy || '—'}</td>
                            <td rowSpan={span} className={cell}>
                              <ReceivingBadge status={c.receivingStatus} label={c.receivingLabel} />
                              {span > 1 && <span className="block mt-1 text-[10px] text-neutral-500 whitespace-nowrap">{totalsText(c.receivedTotals)} of {totalsText(c.issuedTotals)}</span>}
                            </td>
                            <td rowSpan={span} className={cell}>
                              <div className="flex items-center gap-1">
                                <button type="button" onClick={() => setDetailId(c.id)} title="View details" aria-label={`View ${c.challanNumber}`} className="p-1.5 rounded-md text-brand-700 hover:bg-brand-50"><Eye className="w-3.5 h-3.5" /></button>
                                {!['CANCELLED', 'REJECTED'].includes(String(c.status || '').toUpperCase()) && (
                                  <Link href={`/challans/${c.id}?edit=1`} title="Edit challan" aria-label={`Edit ${c.challanNumber}`} className="p-1.5 rounded-md text-neutral-600 hover:bg-neutral-100"><Pencil className="w-3.5 h-3.5" /></Link>
                                )}
                                <button type="button" onClick={() => printIssued(c)} title="Print" aria-label={`Print ${c.challanNumber}`} className="p-1.5 rounded-md text-neutral-600 hover:bg-neutral-100"><Printer className="w-3.5 h-3.5" /></button>
                                <button type="button" onClick={() => printIssued(c)} title="Download" aria-label={`Download PDF of ${c.challanNumber}`} className="p-1.5 rounded-md text-neutral-600 hover:bg-neutral-100"><FileText className="w-3.5 h-3.5" /></button>
                                {/* The issuing department deletes its own challan until it is received (the dialog says why otherwise). */}
                                <DeleteRecordButton
                                  target={{ kind: 'CHALLAN', id: c.id, label: c.challanNumber }}
                                  onDeleted={(m) => {
                                    setNotice(m);
                                    load();
                                  }}
                                />
                                {c.program?.id && (
                                  <button type="button" onClick={() => setSheetProgramId(c.program.id)} title="View Production Sheet" className="px-1.5 py-1 rounded-md text-[10px] font-semibold text-neutral-600 hover:bg-neutral-100 whitespace-nowrap">Sheet</button>
                                )}
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                );
              })
            )}
          </table>
        </div>
        {data && (
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-neutral-100 text-xs text-neutral-600">
            <span>{data.total === 0 ? 'No challans' : `${(data.page - 1) * data.pageSize + 1}–${Math.min(data.page * data.pageSize, data.total)} of ${data.total}`}</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setPage(page - 1)} disabled={page <= 1} className="p-1.5 rounded-md ring-1 ring-neutral-300 disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="w-4 h-4" /></button>
              <span className="px-2 font-semibold">{data.page} / {data.pages}</span>
              <button type="button" onClick={() => setPage(page + 1)} disabled={page >= data.pages} className="p-1.5 rounded-md ring-1 ring-neutral-300 disabled:opacity-40" aria-label="Next page"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {detailId && <IssuedChallanDetail id={detailId} onClose={() => setDetailId(null)} onSheet={setSheetProgramId} />}
      {sheetProgramId && <ProductionSheetPrintModal program={{ id: sheetProgramId }} isOpen onClose={() => setSheetProgramId(null)} />}
    </div>
  );
}

function Facts({ items }: { items: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2.5">
      {items.map(([l, v]) => (
        <div key={l}>
          <dt className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{l}</dt>
          <dd className="text-xs font-semibold text-neutral-900 mt-0.5 break-words">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

function IssuedChallanDetail({ id, onClose, onSheet }: { id: string; onClose: () => void; onSheet: (programId: string) => void }) {
  const [c, setC] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/challans/issued/${encodeURIComponent(id)}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Could not load the challan.');
        if (live) setC(body.data);
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const section = 'text-[11px] font-bold uppercase tracking-wider text-brand-800 mb-2';
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-neutral-900/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="bg-white rounded-xl shadow-2xl border border-neutral-200 w-full max-w-5xl my-auto">
        <div className="px-5 py-3.5 border-b border-neutral-200 bg-neutral-50 flex items-start justify-between gap-3 rounded-t-xl">
          <div>
            <h3 className="font-bold text-sm text-neutral-900">Challan {c?.challanNumber || ''}</h3>
            {c && <p className="text-[11px] text-neutral-500 mt-0.5">{c.fromDepartmentName} → {c.toDepartmentName} · {dateTime(c.issuedAt)}</p>}
          </div>
          <div className="flex items-center gap-1.5">
            {c && (
              <>
                <button type="button" onClick={() => printIssued(c)} className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-semibold ring-1 ring-neutral-300 bg-white hover:bg-neutral-50"><Printer className="w-3.5 h-3.5" /> Print</button>
                <button type="button" onClick={() => printIssued(c)} title="Choose Save as PDF in the print dialog" className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-semibold ring-1 ring-neutral-300 bg-white hover:bg-neutral-50"><FileText className="w-3.5 h-3.5" /> PDF</button>
                {c.program?.id && <button type="button" onClick={() => onSheet(c.program.id)} className="h-8 px-2.5 rounded-lg text-xs font-semibold ring-1 ring-neutral-300 bg-white hover:bg-neutral-50">Production Sheet</button>}
              </>
            )}
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-200" aria-label="Close"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="p-5">
          {error ? (
            <p className="text-xs text-danger-700">{error}</p>
          ) : !c ? (
            <p className="text-xs text-neutral-500">Loading…</p>
          ) : (
            <div className="space-y-5">
              <section>
                <h4 className={section}>Challan information</h4>
                <Facts items={[
                  ['Challan number', <span key="n" className="font-mono">{c.challanNumber}</span>],
                  ['Challan type', String(c.challanType || '—').replace(/_/g, ' ')],
                  ['Issue date & time', dateTime(c.issuedAt)],
                  ['Current status', String(c.status).replace(/_/g, ' ')],
                  ['Issuing department', c.fromDepartmentName],
                  ['Receiving department', c.toDepartmentName],
                  ['Issued by', c.issuedBy],
                  ['Receiving status', <ReceivingBadge key="r" status={c.receivingStatus} label={c.receivingLabel} />],
                ]} />
                {c.remarks && <p className="mt-2 text-xs text-neutral-600"><span className="font-semibold">Remarks:</span> {c.remarks}</p>}
              </section>
              <section>
                <h4 className={section}>Production information</h4>
                <Facts items={[
                  ['Production Sheet', c.program?.programNumber],
                  ['Design number', c.program?.designNumber],
                  ['Top / Bottom', c.styles?.length ? c.styles.join(', ') : '—'],
                  ['Production serial', c.program?.serialNumber],
                  ['Client', c.program?.clientName],
                  ['Style name', c.program?.mainStyle],
                  ['Order no.', c.program?.orderNumber],
                ]} />
              </section>
              <section>
                <h4 className={section}>Fabric &amp; receiving information</h4>
                <div className="border border-neutral-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-50 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                      <tr>
                        {['Fabric', 'Code', 'Style', 'Colour', 'Shade', 'Width', 'Quantity', 'Received', 'Pending', 'Received at', 'Received by', 'Receiving remarks', 'Item remarks'].map((h) => (
                          <th key={h} className={`py-2 px-3 whitespace-nowrap ${['Quantity', 'Received', 'Pending'].includes(h) ? 'text-right' : ''}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {c.items.length === 0 ? (
                        <tr><td colSpan={13} className="px-3 py-6 text-center text-neutral-500">No lines on this challan.</td></tr>
                      ) : (
                        c.items.map((i: any) => (
                          <tr key={i.id}>
                            <td className="py-2 px-3 font-semibold min-w-[10rem]">{i.fabricName}</td>
                            <td className="py-2 px-3 font-mono text-[10px] whitespace-nowrap">{i.fabricCode || '—'}</td>
                            <td className="py-2 px-3 whitespace-nowrap">{[i.style, i.styleRef].filter(Boolean).join(' · ') || '—'}</td>
                            <td className="py-2 px-3 whitespace-nowrap">{i.colour || '—'}{i.requiredColour ? <span className="block text-[10px] text-neutral-500">Dye to: {i.requiredColour}</span> : null}</td>
                            <td className="py-2 px-3 whitespace-nowrap">{i.shade || '—'}</td>
                            <td className="py-2 px-3 whitespace-nowrap">{i.width || '—'}</td>
                            <td className="py-2 px-3 text-right font-bold tabular-nums whitespace-nowrap">{qty(i.quantity)} {i.unit}</td>
                            <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap">{qty(i.received)} {i.unit}</td>
                            <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap">{qty(i.pending)} {i.unit}</td>
                            <td className="py-2 px-3 whitespace-nowrap">{dateTime(i.receivedAt)}</td>
                            <td className="py-2 px-3 whitespace-nowrap">{i.receivedBy || '—'}</td>
                            <td className="py-2 px-3 min-w-[8rem]">{i.receiptRemarks || '—'}</td>
                            <td className="py-2 px-3 min-w-[8rem]">{i.remarks || '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="mt-1.5 text-[11px] text-neutral-500">Issued {totalsText(c.issuedTotals)} · Received {totalsText(c.receivedTotals)}</p>
              </section>
              <section>
                <h4 className={section}>Movement history</h4>
                <ol className="border border-neutral-200 rounded-lg divide-y divide-neutral-100">
                  {c.history.length === 0 ? (
                    <li className="px-3 py-6 text-center text-xs text-neutral-500">No movement recorded.</li>
                  ) : (
                    c.history.map((e: any, k: number) => (
                      <li key={k} className="px-3 py-2 grid grid-cols-1 md:grid-cols-[10rem_14rem_1fr_9rem] gap-1 md:gap-3 text-xs">
                        <span className="text-neutral-500 whitespace-nowrap">{dateTime(e.at)}</span>
                        <span className="font-semibold text-neutral-900">{e.action}</span>
                        <span className="text-neutral-700">{e.detail || '—'}{e.reference ? <span className="ml-1 font-mono text-[10px] text-neutral-500">{e.reference}</span> : null}</span>
                        <span className="text-neutral-500 md:text-right">{e.by || ''}</span>
                      </li>
                    ))
                  )}
                </ol>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
