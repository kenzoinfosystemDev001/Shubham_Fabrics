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
  FabricStatusBadge,
  Notice,
  PageHeader,
  Panel,
  THEAD,
  WorkStatusBadge,
  fetchJson,
  fmtDate,
  fmtQty,
} from '@/components/workflow/WorkflowUi';
import { availableToProcess, readyToTransfer, receivedBasis } from '@/lib/work-items.mjs';
import { departmentName, workPath, type WorkflowView } from '@/lib/workflow-views';
import { GarmentTag } from '@/components/recutting/RecuttingUi';

type StockDepartment = React.ComponentProps<typeof DepartmentStockView>['department'];

// Received by the department and not yet fully transferred.
const HELD = 'RECEIVED,IN_PROGRESS,COMPLETED,READY_FOR_TRANSFER,PARTIALLY_TRANSFERRED';
type Tab = 'fabric' | 'stock' | 'defective';
const FABRIC_FILTERS = [
  { id: '', label: 'All' },
  { id: 'DYED', label: 'Dyed' },
  { id: 'UNDYED', label: 'Undyed' },
];

function ReceivedContent({ flow, only }: { flow: WorkflowView; only?: 'defective' }) {
  const noun = flow.garments ? 'Received Garments' : flow.qc || flow.material ? 'Received Material' : 'Received Fabric';
  const params = useSearchParams();
  const initial = params.get('view');
  const [tab, setTab] = useState<Tab>(only || ((initial === 'stock' && !flow.noStockTab) || initial === 'defective' ? (initial as Tab) : 'fabric'));
  const [records, setRecords] = useState<any[]>([]);
  const [fabricStatus, setFabricStatus] = useState(params.get('fabricStatus') || '');
  const [items, setItems] = useState<any[]>([]);
  const [defects, setDefects] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === 'fabric') {
        const q = new URLSearchParams({ status: params.get('status') || HELD });
        if (fabricStatus) q.set('fabricStatus', fabricStatus);
        if (search.trim()) q.set('search', search.trim());
        const body = await fetchJson(`${flow.api}/items?${q}`);
        setItems(body.data || []);
      } else if (tab === 'defective') {
        const body = await fetchJson(`/api/defective-shelves?department=${flow.code}`);
        setDefects(body.data?.challans || []);
        // Defects recorded during production (DefectRecord), e.g. Stitching / Finishing / Steam Press.
        setRecords(body.data?.defectRecords || []);
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
  }, [tab, fabricStatus]);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'fabric', label: noun },
    ...(flow.noStockTab ? [] : [{ id: 'stock' as Tab, label: 'Department Stock' }]),
    // Departments with their own Defective Shelf page don't repeat it here.
    ...(flow.defectivePage ? [] : [{ id: 'defective' as Tab, label: 'Defective Shelf' }]),
  ];

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <PageHeader title={only ? 'Department Defective Shelf' : noun} loading={loading} onRefresh={tab === 'stock' ? undefined : load}>
        <div role="tablist" className={`inline-flex p-0.5 bg-neutral-100 rounded-lg ${only || tabs.length < 2 ? 'hidden' : ''}`}>
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
            title={`${flow.garments ? 'Garments' : flow.qc || flow.material ? 'Material' : 'Fabric'} in ${flow.label}`}
            count={items.length}
            actions={
              <>
                <div role="tablist" className="inline-flex p-0.5 bg-neutral-100 rounded-lg">
                  {FABRIC_FILTERS.map((f) => (
                    <button
                      key={f.id || 'all'}
                      role="tab"
                      aria-selected={fabricStatus === f.id}
                      onClick={() => setFabricStatus(f.id)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                        fabricStatus === f.id ? 'bg-white text-brand-800 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
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
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Sheet, challan, fabric or colour"
                    aria-label="Search received fabric"
                    className={`${FIELD} pl-9 md:w-72`}
                  />
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
                    <th className="py-3 px-3">Design / Serial</th>
                    <th className="py-3 px-3">Fabric</th>
                    <th className="py-3 px-3">Colour</th>
                    <th className="py-3 px-3">Dyed / Undyed</th>
                    <th className="py-3 px-3 text-right">Received</th>
                    <th className="py-3 px-3 text-right">{flow.qc ? 'Uninspected' : flow.allocation ? 'Unallocated' : 'To Process'}</th>
                    <th className="py-3 px-3 text-right">{flow.qc ? 'Passed' : flow.allocation ? 'Allocated' : 'Ready'}</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Deadline</th>
                    <th className="py-3 px-3"><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {!loading && items.length === 0 && <EmptyRow colSpan={12} text={`No received ${flow.garments ? 'garments' : flow.qc || flow.material ? 'material' : 'fabric'} waiting in ${flow.label}`} />}
                  {items.map((i) => (
                    <tr key={i.id} className="hover:bg-neutral-50/60">
                      <td className="py-3 px-4">
                        <Link href={`/programs/${i.program?.id}`} className="font-mono text-xs font-semibold text-neutral-900 hover:underline">
                          {i.program?.programNumber || '—'}
                        </Link>
                        <span className="block font-mono text-[11px] text-neutral-500">{i.itemNumber}</span>
                      </td>
                      <td className="py-3 px-3">
                        {i.inboundChallan ? (
                          <Link href={`/challans/${i.inboundChallan.id}`} className="font-mono text-xs text-brand-800 hover:underline">
                            {i.inboundChallan.challanNumber}
                          </Link>
                        ) : (
                          '—'
                        )}
                        <span className="block text-[11px] text-neutral-500">
                          {departmentName(i.sourceDepartment)} · {fmtDate(i.receivedAt)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-xs text-neutral-700">
                        {i.program?.designNumber || i.program?.wilcomDesignNumber || '—'}
                        <span className="block font-mono text-[11px] text-neutral-500">{i.program?.programSerialNo || '—'}</span>
                      </td>
                      <td className="py-3 px-3 font-semibold text-neutral-900">{i.fabricName}<GarmentTag item={i} /></td>
                      <td className="py-3 px-3 text-neutral-700">{i.colour || '—'}</td>
                      <td className="py-3 px-3"><FabricStatusBadge status={i.fabricProcessingStatus} /></td>
                      <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">
                        {fmtQty(receivedBasis(i), i.uom)}
                        {i.receiptRemarks && <span className="block text-[11px] text-danger-700">{i.receiptRemarks}</span>}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(availableToProcess(i), i.uom)}</td>
                      <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{fmtQty(readyToTransfer(i), i.uom)}</td>
                      <td className="py-3 px-3"><WorkStatusBadge status={i.status} next={flow.next} qc={Boolean(flow.qc)} dispatch={flow.dispatchWords} /></td>
                      <td className="py-3 px-3 text-xs whitespace-nowrap"><DeadlineText program={i.program} /></td>
                      <td className="py-3 px-3 text-right">
                        <Link
                          href={`${workPath(flow)}?itemId=${i.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900 whitespace-nowrap"
                        >
                          <span>{flow.qc ? 'Inspect' : flow.allocation ? 'Allocate' : i.status === 'RECEIVED' ? 'Start' : 'Continue'}</span>
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

        {tab === 'stock' && !flow.noStockTab && <DepartmentStockView department={flow.code as StockDepartment} title={`${flow.label} Department Stock`} />}

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
                        <Link href={`/challans/${d.id}`} className="hover:underline">{d.challanNumber}</Link>
                      </td>
                      <td className="py-3 px-3 text-xs text-neutral-600">{fmtDate(d.issuedDate || d.createdAt)}</td>
                      <td className="py-3 px-3 font-mono text-xs">{d.program?.programSerialNo || d.program?.programNumber || '—'}</td>
                      <td className="py-3 px-3 text-right tabular-nums font-semibold text-danger-700">{fmtQty(d.defectivePieces, d.fabricUnit)}</td>
                      <td className="py-3 px-3 text-neutral-700">{d.defectReason || '—'}</td>
                      <td className="py-3 px-3 text-xs text-neutral-600">{d.defectiveShelfLocation || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {tab === 'defective' && (
          <Panel title="Defects Recorded in Production" count={records.length}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className={THEAD}>
                  <tr>
                    <th className="py-3 px-4">Defect</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Production Sheet</th>
                    <th className="py-3 px-3">Challan</th>
                    <th className="py-3 px-3">Item</th>
                    <th className="py-3 px-3 text-right">Quantity</th>
                    <th className="py-3 px-3">Reason</th>
                    <th className="py-3 px-3">Recorded by</th>
                    <th className="py-3 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {!loading && records.length === 0 && <EmptyRow colSpan={9} text="No defects recorded" />}
                  {records.map((r) => (
                    <tr key={r.id} className="hover:bg-neutral-50/60 align-top">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-neutral-900">{r.defectCode}</td>
                      <td className="py-3 px-3 text-xs text-neutral-600 whitespace-nowrap">{fmtDate(r.createdAt || r.detectedAt, true)}</td>
                      <td className="py-3 px-3 font-mono text-xs">{r.program?.programSerialNo || r.program?.programNumber || '—'}</td>
                      <td className="py-3 px-3 font-mono text-xs text-brand-800">
                        {r.challan ? <Link href={`/challans/${r.challan.id}`} className="hover:underline">{r.challan.challanNumber}</Link> : '—'}
                      </td>
                      <td className="py-3 px-3 text-xs text-neutral-700">
                        {r.itemDescription || '—'}
                        {r.resolutionNotes && <span className="block text-[11px] text-neutral-500">{r.resolutionNotes}</span>}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums font-semibold text-danger-700">{r.quantity}</td>
                      <td className="py-3 px-3 text-neutral-700">{r.reason || '—'}</td>
                      <td className="py-3 px-3 text-xs text-neutral-600">{r.detectedBy?.fullName || '—'}</td>
                      <td className="py-3 px-3 text-xs">{String(r.status || '').replace(/_/g, ' ')}</td>
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

export function WorkReceived({ flow, only }: { flow: WorkflowView; only?: 'defective' }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <ReceivedContent flow={flow} only={only} />
    </Suspense>
  );
}
