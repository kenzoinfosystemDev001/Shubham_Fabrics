'use client';

import React, { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { BTN_PRIMARY, BTN_QUIET, EmptyRow, FIELD, Notice, Panel, THEAD, fetchJson, fmtDate } from '@/components/workflow/WorkflowUi';
import { INVENTORY_STATUS_LABEL } from '@/lib/inventory.mjs';
import { API, CategorySelect, DesignCell, GarmentCell, GarmentImage, InventoryStatusBadge, Pager, RecordDrawer, SendForPackingDialog, pcs } from '@/components/inventory/InventoryUi';
import { CATEGORY_LABEL } from '@/lib/recutting.mjs';

export type RecordsMode = 'received' | 'stock' | 'packing';

const STATUS_FILTERS = ['READY', 'SENT', 'PARTIAL', 'PACKED'] as const;
const EMPTY = { search: '', category: '', status: '', from: '', to: '', sort: 'received_desc' };

/**
 * Received finished-garment records with filters and server-side pages. The columns follow the
 * screen: received garments, the full inventory, or packing management.
 */
export function RecordsBrowser({ mode, title, focusId }: { mode: RecordsMode; title: string; focusId?: string | null }) {
  const [filters, setFilters] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{ data: any[]; total: number; pageSize: number }>({ data: [], total: 0, pageSize: 25 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(focusId || null);
  const [sending, setSending] = useState<any | null>(null);

  const load = async (f = filters, p = page) => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ page: String(p), pageSize: '25' });
      Object.entries(f).forEach(([k, v]) => v && q.set(k, v));
      if (mode === 'packing' && !f.status) q.set('status', 'OPEN');
      const body = await fetchJson(`${API}/items?${q}`);
      setResult({ data: body.data || [], total: body.total || 0, pageSize: body.pageSize || 25 });
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

  const set = (k: keyof typeof EMPTY) => (v: string) => setFilters({ ...filters, [k]: v });
  const apply = (e?: React.FormEvent) => {
    e?.preventDefault();
    setPage(1);
    load(filters, 1);
  };
  const reload = () => load();
  const columns = mode === 'received' ? 9 : mode === 'stock' ? 11 : 10;

  return (
    <div className="space-y-4">
      {error && <Notice kind="error" onClose={() => setError(null)}>{error}</Notice>}
      {notice && <Notice kind="success" onClose={() => setNotice(null)}>{notice}</Notice>}
      <form onSubmit={apply} className="bg-white border border-neutral-200 rounded-2xl shadow-xs p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <label className="block col-span-2">
          <span className="text-xs font-semibold text-neutral-600">Design, serial or challan</span>
          <input value={filters.search} onChange={(e) => set('search')(e.target.value)} className={`${FIELD} mt-1`} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-neutral-600">Category</span>
          <CategorySelect value={filters.category} onChange={set('category')} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-neutral-600">{mode === 'packing' ? 'Packing status' : 'Status'}</span>
          <select value={filters.status} onChange={(e) => set('status')(e.target.value)} className={`${FIELD} mt-1`}>
            <option value="">{mode === 'packing' ? 'Still to pack' : 'Any'}</option>
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>{INVENTORY_STATUS_LABEL[s]}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-neutral-600">Received from</span>
          <input type="date" value={filters.from} onChange={(e) => set('from')(e.target.value)} className={`${FIELD} mt-1`} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-neutral-600">Received to</span>
          <input type="date" value={filters.to} onChange={(e) => set('to')(e.target.value)} className={`${FIELD} mt-1`} />
        </label>
        {mode === 'stock' && (
          <label className="block">
            <span className="text-xs font-semibold text-neutral-600">Sort by</span>
            <select value={filters.sort} onChange={(e) => set('sort')(e.target.value)} className={`${FIELD} mt-1`}>
              <option value="received_desc">Newest received</option>
              <option value="received_asc">Oldest received</option>
              <option value="design">Design number</option>
              <option value="available">Most available</option>
              <option value="remaining">Most still to pack</option>
            </select>
          </label>
        )}
        <div className="flex items-end gap-2">
          <button type="submit" className={`${BTN_PRIMARY} flex-1`}>Apply</button>
          <button
            type="button"
            onClick={() => {
              setFilters(EMPTY);
              setPage(1);
              load(EMPTY, 1);
            }}
            className={BTN_QUIET}
          >
            Reset
          </button>
        </div>
      </form>

      <Panel title={title} count={result.total}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className={THEAD}>
              <tr>
                <th className="py-3 px-4">Image</th>
                <th className="py-3 px-3">Design</th>
                <th className="py-3 px-3">{mode === 'stock' ? 'Garment' : 'Category'}</th>
                {mode !== 'packing' && <th className="py-3 px-3 text-right">Received</th>}
                <th className="py-3 px-3 text-right">Available</th>
                {mode === 'received' && (
                  <>
                    <th className="py-3 px-3">Receiving Challan</th>
                    <th className="py-3 px-3">Received On</th>
                  </>
                )}
                {mode !== 'received' && (
                  <>
                    <th className="py-3 px-3 text-right">{mode === 'packing' ? 'Allocated' : 'In Packing'}</th>
                    <th className="py-3 px-3 text-right">Packed</th>
                    <th className="py-3 px-3 text-right">Remaining</th>
                  </>
                )}
                <th className="py-3 px-3">{mode === 'packing' ? 'Packing Status' : 'Status'}</th>
                {mode === 'stock' && <th className="py-3 px-3">Last Activity</th>}
                {mode === 'packing' && <th className="py-3 px-3">Latest Packing</th>}
                <th className="py-3 px-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {!loading && result.data.length === 0 && <EmptyRow colSpan={columns} text="No finished garments match these filters" />}
              {result.data.map((r) => (
                <tr key={r.id} className="hover:bg-neutral-50/60 align-top">
                  <td className="py-2.5 px-4"><GarmentImage image={r.image} alt={r.garment} /></td>
                  <td className="py-2.5 px-3"><DesignCell program={r.program} /></td>
                  <td className="py-2.5 px-3">
                    {mode === 'stock' ? (
                      <GarmentCell record={r} />
                    ) : (
                      <span className="text-xs">
                        <span className="font-semibold">{r.garmentCategory ? CATEGORY_LABEL[r.garmentCategory as keyof typeof CATEGORY_LABEL] : 'Garment'}</span>
                        <span className="block text-neutral-500">{[r.styleRef, r.colour].filter(Boolean).join(' · ') || '—'}</span>
                      </span>
                    )}
                  </td>
                  {mode !== 'packing' && <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{pcs(r.stock.received)}</td>}
                  <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap font-semibold">{pcs(r.stock.available)}</td>
                  {mode === 'received' && (
                    <>
                      <td className="py-2.5 px-3 font-mono text-xs text-brand-800">{r.inboundChallan?.challanNumber || '—'}</td>
                      <td className="py-2.5 px-3 text-xs text-neutral-600 whitespace-nowrap">{fmtDate(r.receivedAt)}</td>
                    </>
                  )}
                  {mode !== 'received' && (
                    <>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{pcs(mode === 'packing' ? r.stock.sent : r.stock.inPacking)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{pcs(r.stock.packed)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{pcs(r.stock.remaining)}</td>
                    </>
                  )}
                  <td className="py-2.5 px-3"><InventoryStatusBadge status={r.status} /></td>
                  {mode === 'stock' && <td className="py-2.5 px-3 text-xs text-neutral-600 whitespace-nowrap">{fmtDate(r.lastActivityAt, true)}</td>}
                  {mode === 'packing' && <td className="py-2.5 px-3 text-xs text-neutral-600 whitespace-nowrap">{fmtDate(r.latestPackingDate)}</td>}
                  <td className="py-2.5 px-3">
                    <div className="flex justify-end gap-1.5">
                      {mode !== 'received' && r.stock.available > 0 && (
                        <button type="button" onClick={() => setSending(r)} className={BTN_PRIMARY}>
                          <Send className="w-3.5 h-3.5" />
                          <span>Send for Packing</span>
                        </button>
                      )}
                      <button type="button" onClick={() => setOpenId(r.id)} className={BTN_QUIET}>View Details</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager
          page={page}
          pageSize={result.pageSize}
          total={result.total}
          onPage={(p) => {
            setPage(p);
            load(filters, p);
          }}
        />
      </Panel>

      {openId && <RecordDrawer id={openId} onClose={() => setOpenId(null)} onChanged={reload} />}
      {sending && (
        <SendForPackingDialog
          record={sending}
          onClose={() => setSending(null)}
          onDone={(message) => {
            setNotice(message);
            setSending(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
