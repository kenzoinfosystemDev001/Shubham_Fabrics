'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Layers,
  ShieldCheck,
  Search,
  CheckCircle2,
  RefreshCw,
  FileText,
  Eye,
  Printer,
  Sparkles,
  ArrowRight,
  Warehouse,
  Droplet,
  Clock,
  PackageCheck,
  X,
  Send,
  AlertCircle,
  Barcode as BarcodeIcon,
  Download
} from 'lucide-react';
import { downloadBarcodeStickerPng } from '@/lib/barcode';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';
import { 
  downloadProductionSheetHtml, 
  printProductionSheet 
} from '@/lib/download-production-sheet';
import { 
  downloadChallanHtml, 
  printChallan 
} from '@/lib/download-challan';
import { DocumentActionButtons } from '@/components/common/DocumentActionButtons';

export default function EmbroideryIncomingChallansPage() {
  const [loading, setLoading] = useState(true);
  const [challans, setChallans] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'STORE' | 'DYEING'>('STORE');
  const [search, setSearch] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [inspectModalChallan, setInspectModalChallan] = useState<any | null>(null);
  const [selectedSheetModal, setSelectedSheetModal] = useState<any | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [inspectionRemark, setInspectionRemark] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/embroidery/dashboard');
      const json = await res.json();
      if (json.data?.challans) {
        setChallans(json.data.challans);
      }
    } catch (err) {
      console.error('Failed to load embroidery incoming challans:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePassAndReceive = async (challan: any) => {
    try {
      setInspecting(true);
      const res = await fetch(`/api/challans/${challan.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'RECEIVED',
          notes: inspectionRemark || 'Incoming inspection passed by Embroidery Incharge. Accepted onto floor.',
        }),
      });

      if (res.ok) {
        setActionSuccess(`Challan ${challan.challanNumber} inspection PASSED & accepted onto Embroidery floor!`);
        setInspectModalChallan(null);
        setInspectionRemark('');
        loadData();
        setTimeout(() => setActionSuccess(null), 4500);
      } else {
        alert('Failed to update challan status. Please try again.');
      }
    } catch (err: any) {
      console.error(err);
      alert('Error updating status: ' + err.message);
    } finally {
      setInspecting(false);
    }
  };

  const handleRejectToDefectiveShelf = async (challan: any) => {
    if (!confirm(`Are you sure you want to REJECT Challan ${challan.challanNumber} to Fabric Store Defective Shelf?`)) {
      return;
    }
    try {
      setInspecting(true);
      const res = await fetch(`/api/challans/${challan.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'REJECTED',
          notes: inspectionRemark || 'REJECTED at Embroidery Incoming Gate -> Moved to Fabric Store Defective Shelf.',
        }),
      });

      if (res.ok) {
        setActionSuccess(`Challan ${challan.challanNumber} REJECTED and dispatched to Fabric Store Defective Shelf.`);
        setInspectModalChallan(null);
        setInspectionRemark('');
        loadData();
        setTimeout(() => setActionSuccess(null), 4500);
      } else {
        alert('Failed to update challan status. Please try again.');
      }
    } catch (err: any) {
      console.error(err);
      alert('Error updating status: ' + err.message);
    } finally {
      setInspecting(false);
    }
  };

  // Filter based on selected route tab
  const storeChallans = challans.filter(
    (c) => c.fromDepartment === 'STORE' || c.fromDepartment === 'FABRIC_STORE'
  );
  const dyeingQc1Challans = challans.filter(
    (c) => c.fromDepartment === 'DYEING' || c.fromDepartment === 'QC1'
  );

  const currentList = activeTab === 'STORE' ? storeChallans : dyeingQc1Challans;

  const filteredChallans = currentList.filter((c) => {
    const q = search.toLowerCase();
    const chNum = (c.challanNumber || '').toLowerCase();
    const progNum = (c.program?.programNumber || '').toLowerCase();
    const serial = (c.program?.programSerialNo || '').toLowerCase();
    const style = (c.program?.mainStyle || '').toLowerCase();
    const buyer = (c.program?.buyerName || c.program?.clientName || '').toLowerCase();
    const wilcom = (c.program?.wilcomDesignNumber || '').toLowerCase();

    return (
      chNum.includes(q) ||
      progNum.includes(q) ||
      serial.includes(q) ||
      style.includes(q) ||
      buyer.includes(q) ||
      wilcom.includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* HEADER WITH REAL DB BACKGROUND */}
      <header
        className="bg-white border-b border-neutral-200 sticky top-0 z-30 px-4 sm:px-8 py-4 shadow-md text-neutral-900"
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-600 block drop-shadow-sm">
              SHUBHAM FABRICS MES · EMBROIDERY DEPARTMENT
            </span>
            <h1 className="text-xl font-bold text-neutral-900 flex items-center gap-2.5 drop-shadow-sm">
              <Layers className="w-5 h-5 text-brand-600" />
              <span>Checking of Incoming Challans</span>
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <Link
              href="/embroidery/my-work"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Create Challan to Thread Cutting</span>
            </Link>

            <Link
              href="/embroidery"
              className="px-3 py-2 bg-neutral-50 hover:bg-neutral-100 text-neutral-700 text-xs font-semibold rounded-lg border border-neutral-200 transition"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* TOAST SUCCESS ALERT */}
      {actionSuccess && (
        <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-4">
          <div className="p-3.5 bg-accent-50 border border-accent-300 rounded-xl text-accent-800 text-xs font-semibold flex items-center gap-2 shadow-xs">
            <CheckCircle2 className="w-5 h-5 text-accent-700 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {/* TOP TAB SELECTOR: (1) FROM FABRIC STORE (UNDYED) & (2) FROM DYEING DEPT */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-2 shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('STORE')}
              className={`flex items-center justify-between p-3.5 rounded-xl border transition text-left ${
                activeTab === 'STORE'
                  ? 'bg-brand-50/80 border-brand-500 text-brand-900 shadow-xs'
                  : 'bg-neutral-50/60 border-neutral-200 text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${
                    activeTab === 'STORE'
                      ? 'bg-brand-600 text-white'
                      : 'bg-neutral-200 text-neutral-700'
                  }`}
                >
                  ①
                </div>
                <div>
                  <span className="text-xs font-bold block uppercase tracking-wide">
                    From Fabric Store (No Dyeing Required)
                  </span>
                  <p className="text-[11px] text-neutral-500">
                    Pre-dyed / mill-finished fabric routed from Fabric Store
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold font-mono px-2.5 py-1 rounded-full bg-brand-100 text-brand-800">
                {storeChallans.length} Challans
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('DYEING')}
              className={`flex items-center justify-between p-3.5 rounded-xl border transition text-left ${
                activeTab === 'DYEING'
                  ? 'bg-brand-50/80 border-brand-500 text-brand-900 shadow-xs'
                  : 'bg-neutral-50/60 border-neutral-200 text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${
                    activeTab === 'DYEING'
                      ? 'bg-brand-600 text-white'
                      : 'bg-neutral-200 text-neutral-700'
                  }`}
                >
                  ②
                </div>
                <div>
                  <span className="text-xs font-bold block uppercase tracking-wide">
                    From QC 1 (Post-Dyeing Passed)
                  </span>
                  <p className="text-[11px] text-neutral-500">
                    Dyed fabric inspected, approved, and released by QC 1 Gate
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold font-mono px-2.5 py-1 rounded-full bg-brand-100 text-brand-800">
                {dyeingQc1Challans.length} Challans
              </span>
            </button>
          </div>
        </div>

        {/* SEARCH & CONTROLS */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-96">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Challan #, Serial #, Design, Style..."
              className="w-full pl-9 pr-3.5 py-2 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-2xs"
            />
            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
          </div>

          <div className="text-xs text-neutral-500 font-medium">
            Showing <strong className="text-neutral-900">{filteredChallans.length}</strong> incoming challans
          </div>
        </div>

        {/* CHALLAN LIST */}
        {loading ? (
          <div className="bg-white border border-neutral-200 rounded-xl p-12 text-center text-neutral-500 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-brand-600 mb-2" />
            Loading incoming embroidery challans from database...
          </div>
        ) : filteredChallans.length === 0 ? (
          <div className="bg-white border border-neutral-200 rounded-2xl p-12 text-center text-neutral-500 space-y-2">
            <PackageCheck className="w-10 h-10 mx-auto text-neutral-700" />
            <h3 className="text-sm font-bold text-neutral-900">No incoming challans found</h3>
            <p className="text-xs text-neutral-500 max-w-md mx-auto">
              There are no incoming challans matching the selected route{' '}
              {activeTab === 'STORE' ? 'from Fabric Store' : 'from Dyeing Department'}.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredChallans.map((ch) => {
              const isStore = ch.fromDepartment === 'STORE' || ch.fromDepartment === 'FABRIC_STORE';
              const totalMeters = (ch.items || []).reduce(
                (sum: number, it: any) => sum + (Number(it.quantity) || 0),
                0
              );

              return (
                <div
                  key={ch.id}
                  className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs hover:border-neutral-300 transition space-y-4"
                >
                  {/* TOP ROW: CHALLAN #, ROUTE BADGE, DATES & STATUS */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-bold text-neutral-900 bg-neutral-100 px-2.5 py-1 rounded-lg border border-neutral-200">
                        {ch.challanNumber}
                      </span>

                      {isStore ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-100 text-brand-900 font-bold text-xs">
                          <Warehouse className="w-3.5 h-3.5 text-brand-700" />
                          <span>Route ①: Fabric Store (Undyed)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent-100 text-accent-800 font-bold text-xs">
                          <ShieldCheck className="w-3.5 h-3.5 text-accent-800" />
                          <span>Route ②: Dyeing Dept (QC1 PASS Gate)</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-neutral-500 flex items-center gap-1 font-mono">
                        <Clock className="w-3.5 h-3.5 text-neutral-500" />
                        {new Date(ch.createdAt).toLocaleDateString('en-GB')}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                          ch.status === 'RECEIVED'
                            ? 'bg-accent-100 text-accent-800'
                            : ch.status === 'IN_PROGRESS'
                            ? 'bg-brand-100 text-brand-800'
                            : ch.status === 'COMPLETED'
                            ? 'bg-neutral-100 text-neutral-900'
                            : 'bg-accent-100 text-accent-800'
                        }`}
                      >
                        {ch.status}
                      </span>
                    </div>
                  </div>

                  {/* MIDDLE GRID: PROGRAM & FABRIC ATTRIBUTES */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                    <div>
                      <span className="text-neutral-500 text-[10px] uppercase font-bold block">
                        Master Sheet Serial #
                      </span>
                      <strong className="text-neutral-900 font-mono">
                        {ch.program?.programSerialNo || ch.program?.programNumber || '—'}
                      </strong>
                    </div>

                    <div>
                      <span className="text-neutral-500 text-[10px] uppercase font-bold block">
                        Wilcom Design #
                      </span>
                      <strong className="text-brand-700 font-mono">
                        {ch.program?.wilcomDesignNumber || 'WILCOM-STD'}
                      </strong>
                    </div>

                    <div>
                      <span className="text-neutral-500 text-[10px] uppercase font-bold block">
                        Buyer & Style
                      </span>
                      <span className="text-neutral-900 font-semibold truncate block">
                        {ch.program?.clientName || ch.program?.buyerName || 'Standard Buyer'} /{' '}
                        {ch.program?.mainStyle || 'Style-01'}
                      </span>
                    </div>

                    <div>
                      <span className="text-neutral-500 text-[10px] uppercase font-bold block">
                        Fabric Condition
                      </span>
                      <span className="text-neutral-900 font-medium">
                        {isStore ? 'Undyed / Greige Kora' : 'Dyed & QC1 Approved'}
                      </span>
                    </div>

                    <div>
                      <span className="text-neutral-500 text-[10px] uppercase font-bold block">
                        Total Quantity
                      </span>
                      <span className="font-mono font-bold text-neutral-900">
                        {totalMeters > 0 ? `${totalMeters} MTR` : `${(ch.items || []).length} Rolls`}
                      </span>
                    </div>
                  </div>

                  {/* ITEMS TABLE PREVIEW */}
                  <div className="bg-neutral-50 border border-neutral-200/80 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-100/80 text-neutral-500 font-bold text-[10px] uppercase border-b border-neutral-200">
                        <tr>
                          <th className="py-2 px-3">Item Description</th>
                          <th className="py-2 px-3">Color / Shade</th>
                          <th className="py-2 px-3">Roll / Lot #</th>
                          <th className="py-2 px-3 text-right">Quantity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {(ch.items || []).map((it: any, idx: number) => (
                          <tr key={idx} className="hover:bg-white/80 transition">
                            <td className="py-2 px-3 text-neutral-900 font-medium">
                              {it.itemDescription || 'Kora Fabric Roll'}
                            </td>
                            <td className="py-2 px-3 text-neutral-600">
                              {it.colour || (isStore ? 'Undyed' : 'Dyed Standard')}
                            </td>
                            <td className="py-2 px-3 font-mono text-neutral-500">
                              {it.rollNumber || it.lotNumber || `ROLL-${idx + 1}`}
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-neutral-900 text-right">
                              {it.quantity} {it.uom || 'MTR'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* ACTIONS: CHECKING, ACCEPTING, VIEWING */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setInspectModalChallan(ch);
                          setInspectionRemark('');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Checking of Incoming Challan &amp; PASS</span>
                      </button>

                      {/* COMPLETE DOCUMENT ACTIONS: PRODUCTION SHEET, CHALLAN & WILCOM */}
                      <DocumentActionButtons program={ch.program} challan={ch} size="sm" />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          const totalQty = (ch.items || []).reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
                          downloadBarcodeStickerPng({
                            challanNumber: ch.challanNumber,
                            designNumber: ch.program?.designNumber || ch.program?.designName || ch.program?.wilcomDesignNumber || ch.program?.mainStyle || 'STANDARD DESIGN',
                            departmentName: 'EMBROIDERY',
                            fromDepartment: ch.fromDepartment,
                            toDepartment: ch.toDepartment,
                            programSerialNo: ch.program?.programSerialNo || ch.program?.programNumber || '—',
                            clientName: ch.program?.clientName || ch.program?.buyerName || 'Standard Client',
                            mainStyle: ch.program?.mainStyle || 'Style',
                            totalQuantity: totalQty,
                            uom: ch.items?.[0]?.uom || 'MTR',
                            date: new Date(ch.createdAt).toLocaleDateString('en-IN')
                          });
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent-50 hover:bg-accent-100 text-accent-800 border border-accent-300 rounded-lg text-xs font-bold transition cursor-pointer"
                        title="Download standalone barcode sticker with Design Number as PNG"
                      >
                        <BarcodeIcon className="w-3.5 h-3.5 text-accent-800" />
                        <span>Barcode PNG</span>
                      </button>

                      <Link
                        href={`/challans/${ch.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Details</span>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* INSPECTION CHECK MODAL ("Checking of Incoming Challans -> PASS") */}
      {inspectModalChallan && (
        <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden space-y-4 p-6 my-8">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 block">
                  Embroidery Receiving Station
                </span>
                <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-brand-600" />
                  <span>Checking of Incoming Challan: {inspectModalChallan.challanNumber}</span>
                </h3>
              </div>
              <button
                onClick={() => setInspectModalChallan(null)}
                className="p-1 rounded-lg text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-neutral-500 text-[10px] block">Source Dept</span>
                  <strong className="text-neutral-900">
                    {inspectModalChallan.fromDepartment === 'STORE'
                      ? 'Fabric Store (Undyed)'
                      : 'Dyeing Dept (QC1 Gate)'}
                  </strong>
                </div>
                <div>
                  <span className="text-neutral-500 text-[10px] block">Master Sheet Serial</span>
                  <strong className="font-mono text-neutral-900">
                    {inspectModalChallan.program?.programSerialNo || '—'}
                  </strong>
                </div>
                <div>
                  <span className="text-neutral-500 text-[10px] block">Wilcom Design #</span>
                  <strong className="font-mono text-brand-700">
                    {inspectModalChallan.program?.wilcomDesignNumber || 'WILCOM-STD'}
                  </strong>
                </div>
                <div>
                  <span className="text-neutral-500 text-[10px] block">Total Items/Rolls</span>
                  <strong className="font-mono text-neutral-900">
                    {(inspectModalChallan.items || []).length} Rolls
                  </strong>
                </div>
              </div>

              {/* CHECKLIST */}
              <div className="space-y-2 border border-neutral-200 rounded-xl p-3 bg-white">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-600 block">
                  Physical Verification Points
                </span>
                <label className="flex items-center gap-2 cursor-pointer text-neutral-700">
                  <input type="checkbox" defaultChecked className="rounded border-neutral-300 text-brand-600 focus:ring-brand-500" />
                  <span>Verified physical roll count matches Challan quantity.</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-neutral-700">
                  <input type="checkbox" defaultChecked className="rounded border-neutral-300 text-brand-600 focus:ring-brand-500" />
                  <span>Verified fabric condition (Undyed Greige or Passed Dyed fabric intact).</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-neutral-700">
                  <input type="checkbox" defaultChecked className="rounded border-neutral-300 text-brand-600 focus:ring-brand-500" />
                  <span>Wilcom stitching frame &amp; design parameters matched with Production Sheet.</span>
                </label>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                  Embroidery Incharge Remark
                </label>
                <input
                  type="text"
                  value={inspectionRemark}
                  onChange={(e) => setInspectionRemark(e.target.value)}
                  placeholder=""
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-neutral-200">
              <button
                type="button"
                onClick={() => setInspectModalChallan(null)}
                className="px-4 py-2 border border-neutral-300 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={inspecting}
                onClick={() => handleRejectToDefectiveShelf(inspectModalChallan)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-danger-50 hover:bg-danger-100 text-danger-700 border border-danger-300 rounded-lg text-xs font-semibold transition"
              >
                <AlertCircle className="w-4 h-4 text-danger-600" />
                <span>REJECT to Defective Shelf</span>
              </button>
              <button
                type="button"
                disabled={inspecting}
                onClick={() => handlePassAndReceive(inspectModalChallan)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{inspecting ? 'Updating...' : 'PASS & Accept into Embroidery Floor'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL ACCOMPANYING PRODUCTION SHEET PREVIEW & PRINT MODAL */}
      {selectedSheetModal && (
        <ProductionSheetPrintModal
          program={selectedSheetModal}
          isOpen={Boolean(selectedSheetModal)}
          onClose={() => setSelectedSheetModal(null)}
        />
      )}
    </div>
  );
}
