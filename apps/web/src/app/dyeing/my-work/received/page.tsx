'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, Search } from 'lucide-react';
import { DepartmentStockView } from '@/components/DepartmentStockView';
import {
  DeadlineText,
  EmptyRow,
  FIELD,
  Notice,
  PageHeader,
  Panel,
  StatusBadge,
  THEAD,
  baseColour,
  fetchJson,
  fmtDate,
  fmtQty,
} from '@/components/dyeing/DyeingUi';
import { availableForQc, receivedBasis, remainingToDye } from '@/lib/dyeing-workflow.mjs';
import { formatTotals, totalsByUnit, unitOf } from '@/lib/challan-units.mjs';

// Received by Dyeing and not yet fully transferred to QC.
const IN_DYEING = 'RECEIVED,IN_DYEING,PARTIALLY_DYED,DYED,READY_FOR_QC1,PARTIALLY_SENT_TO_QC1';
type Tab = 'fabric' | 'stock' | 'defective';

function ReceivedFabricContent() {
  const params = useSearchParams();
  const initial = params.get('view');
  const [tab, setTab] = useState<Tab>(initial === 'stock' || initial === 'defective' ? initial : 'fabric');
  const [orders, setOrders] = useState<any[]>([]);
  const [defects, setDefects] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === 'fabric') {
        const q = new URLSearchParams({ status: params.get('status') || IN_DYEING });
        if (search.trim()) q.set('search', search.trim());
        const body = await fetchJson(`/api/dyeing/orders?${q}`);
        setOrders(body.data || []);
      } else if (tab === 'defective') {
        const body = await fetchJson('/api/defective-shelves?department=DYEING');
        setDefects(body.data?.challans || []);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'fabric', label: 'Received Fabric' },
    { id: 'stock', label: 'Department Stock' },
    { id: 'defective', label: 'Defective Shelf' },
  ];

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <PageHeader title="Received Fabric" loading={loading} onRefresh={tab === 'stock' ? undefined : load}>
        <div role="tablist" className="inline-flex p-0.5 bg-neutral-100 rounded-lg">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                tab === t.id ? 'bg-white text-brand-800 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </PageHeader>

      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {error && <Notice kind="error" onClose={() => setError(null)}>{error}</Notice>}

        {tab === 'fabric' && (
          <Panel
            title="Fabric in Dyeing"
            count={orders.length}
            actions={
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  load();
                }}
                className="relative"
              >
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Sheet, challan, fabric or colour"
                  aria-label="Search received fabric"
                  className={`${FIELD} pl-9 md:w-72`}
                />
              </form>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className={THEAD}>
                  <tr>
                    <th className="py-3 px-4">Production Sheet</th>
                    <th className="py-3 px-3">Incoming Challan</th>
                    <th className="py-3 px-3">Design / Serial</th>
                    <th className="py-3 px-3">Fabric</th>
                    <th className="py-3 px-3">Fabric Colour</th>
                    <th className="py-3 px-3">Required Dye Colour</th>
                    <th className="py-3 px-3 text-right">Received</th>
                    <th className="py-3 px-3 text-right">To Dye</th>
                    <th className="py-3 px-3 text-right">Ready for QC</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Deadline</th>
                    <th className="py-3 px-3">
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {!loading && orders.length === 0 && <EmptyRow colSpan={12} text="No received fabric waiting in Dyeing" />}
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-neutral-50/60">
                      <td className="py-3 px-4">
                        <Link href={`/programs/${o.program?.id}`} className="font-mono text-xs font-semibold text-neutral-900 hover:underline">
                          {o.program?.programNumber || '—'}
                        </Link>
                        <span className="block font-mono text-[11px] text-neutral-500">{o.orderNumber}</span>
                      </td>
                      <td className="py-3 px-3">
                        {o.inboundChallan ? (
                          <Link href={`/challans/${o.inboundChallan.id}`} className="font-mono text-xs text-brand-800 hover:underline">
                            {o.inboundChallan.challanNumber}
                          </Link>
                        ) : (
                          '—'
                        )}
                        <span className="block text-[11px] text-neutral-500">{fmtDate(o.receivedAt)}</span>
                      </td>
                      <td className="py-3 px-3 text-xs text-neutral-700">
                        {o.program?.designNumber || o.program?.wilcomDesignNumber || '—'}
                        <span className="block font-mono text-[11px] text-neutral-500">{o.program?.programSerialNo || '—'}</span>
                      </td>
                      <td className="py-3 px-3 font-semibold text-neutral-900">{o.fabricName}</td>
                      <td className="py-3 px-3 text-neutral-700">{baseColour(o) || '—'}</td>
                      <td className="py-3 px-3 font-semibold text-brand-900">{o.targetColor || '—'}</td>
                      <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">
                        {fmtQty(receivedBasis(o), o.uom)}
                        {o.receiptRemarks && <span className="block text-[11px] text-danger-700">{o.receiptRemarks}</span>}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(remainingToDye(o), o.uom)}</td>
                      <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(availableForQc(o), o.uom)}</td>
                      <td className="py-3 px-3"><StatusBadge status={o.status} /></td>
                      <td className="py-3 px-3 text-xs whitespace-nowrap"><DeadlineText program={o.program} /></td>
                      <td className="py-3 px-3 text-right">
                        <Link
                          href={`/dyeing/my-work/process?orderId=${o.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900 whitespace-nowrap"
                        >
                          <span>{o.status === 'RECEIVED' ? 'Start' : 'Continue'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {tab === 'stock' && <DepartmentStockView department="DYEING" title="Dyeing Department Stock" />}

        {tab === 'defective' && (
          <Panel title="Defective Shelf" count={defects.length}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className={THEAD}>
                  <tr>
                    <th className="py-3 px-4">Challan</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Production Sheet</th>
                    <th className="py-3 px-3 text-right">Defective</th>
                    <th className="py-3 px-3">Reason</th>
                    <th className="py-3 px-3">Shelf</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {!loading && defects.length === 0 && <EmptyRow colSpan={6} text="No defective fabric recorded" />}
                  {defects.map((d) => (
                    <tr key={d.id} className="hover:bg-neutral-50/60">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-brand-800">
                        <Link href={`/challans/${d.id}`} className="hover:underline">
                          {d.challanNumber}
                        </Link>
                      </td>
                      <td className="py-3 px-3 text-xs text-neutral-600">{fmtDate(d.issuedDate || d.createdAt)}</td>
                      <td className="py-3 px-3 font-mono text-xs">{d.program?.programSerialNo || d.program?.programNumber || '—'}</td>
                      <td className="py-3 px-3 text-right tabular-nums font-semibold text-danger-700">{Number(d.defectivePieces) > 0 ? fmtQty(d.defectivePieces, unitOf(d.defectiveUnit) || unitOf(d.fabricUnit) || 'PCS') : formatTotals(totalsByUnit(d.items || [], d.fabricUnit))}</td>
                      <td className="py-3 px-3 text-neutral-700">{d.defectReason || '—'}</td>
                      <td className="py-3 px-3 text-xs text-neutral-600">{d.defectiveShelfLocation || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </main>
    </div>
  );
}

export default function DyeingReceivedFabricPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <ReceivedFabricContent />
    </Suspense>
  );
}
