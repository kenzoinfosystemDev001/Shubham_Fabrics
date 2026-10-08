'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Kanban,
  RefreshCw,
  Clock,
  Layers,
  CheckCircle2,
  AlertCircle,
  Eye,
  Edit3,
  Send,
  Droplet,
  ExternalLink,
  X,
  FileText,
  Printer
} from 'lucide-react';

interface FloorOrder {
  id: string;
  orderNumber: string;
  programId: string;
  status: 'RECEIVED' | 'IN_DYEING' | 'PARTIALLY_DYED' | 'DYED' | 'READY_FOR_QC1' | 'SENT_TO_QC1';
  priority: string;
  fabricName: string;
  fabricType: string | null;
  targetColor: string;
  dyedColor: string | null;
  colorCode: string | null;
  requiredQuantity: number;
  dyedQuantity: number;
  undyedQuantity: number;
  readyForQc1Quantity: number;
  sentToQc1Quantity: number;
  uom: string;
  inchargeName: string | null;
  batchNumber: string | null;
  machineNumber: string | null;
  processRemarks: string | null;
  createdAt: string;
  updatedAt: string;
  program?: {
    id: string;
    programNumber: string;
    programSerialNo?: string | null;
    clientName?: string | null;
    buyerName?: string | null;
    styleCode?: string | null;
    mainStyle?: string | null;
    fabricName?: string | null;
    fabricColor?: string | null;
    targetQuantity?: number | null;
    deliveryDate?: string | null;
    priority?: string | null;
  };
  inboundChallan?: {
    id: string;
    challanNumber: string;
    status: string;
    issuedDate: string;
  };
  qc1Challan?: {
    id: string;
    challanNumber: string;
    status: string;
    issuedDate: string;
  };
}

interface LanesData {
  RECEIVED: FloorOrder[];
  IN_DYEING: FloorOrder[];
  PARTIALLY_DYED: FloorOrder[];
  DYED: FloorOrder[];
  READY_FOR_QC1: FloorOrder[];
  SENT_TO_QC1: FloorOrder[];
}

const LANES_CONFIG: {
  key: keyof LanesData;
  label: string;
  badgeBg: string;
  badgeText: string;
  borderTop: string;
  description: string;
}[] = [
  {
    key: 'RECEIVED',
    label: '1. Received',
    badgeBg: 'bg-slate-200',
    badgeText: 'text-slate-800',
    borderTop: 'border-t-slate-400',
    description: 'Inward from Fabric Store awaiting processing',
  },
  {
    key: 'IN_DYEING',
    label: '2. In Dyeing',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-800',
    borderTop: 'border-t-blue-600',
    description: 'Active inside dyeing machines & vats',
  },
  {
    key: 'PARTIALLY_DYED',
    label: '3. Partially Dyed',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-800',
    borderTop: 'border-t-amber-500',
    description: 'Batch in progress; balance remaining',
  },
  {
    key: 'DYED',
    label: '4. Fully Dyed',
    badgeBg: 'bg-teal-100',
    badgeText: 'text-teal-800',
    borderTop: 'border-t-teal-600',
    description: 'Target dyed; drying & finishing stage',
  },
  {
    key: 'READY_FOR_QC1',
    label: '5. Ready for QC1',
    badgeBg: 'bg-indigo-100',
    badgeText: 'text-indigo-800',
    borderTop: 'border-t-indigo-600',
    description: 'Batch inspected & staged for dispatch',
  },
  {
    key: 'SENT_TO_QC1',
    label: '6. Sent to QC1',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
    borderTop: 'border-t-emerald-600',
    description: 'Dispatched with verified QC1 Challan',
  },
];

export default function DyeingFloorBoardPage() {
  const [lanes, setLanes] = useState<LanesData>({
    RECEIVED: [],
    IN_DYEING: [],
    PARTIALLY_DYED: [],
    DYED: [],
    READY_FOR_QC1: [],
    SENT_TO_QC1: [],
  });
  const [totalOrders, setTotalOrders] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [selectedOrderForUpdate, setSelectedOrderForUpdate] = useState<FloorOrder | null>(null);
  const [selectedOrderForChallan, setSelectedOrderForChallan] = useState<FloorOrder | null>(null);

  // Update Form State
  const [updateForm, setUpdateForm] = useState({
    dyedQuantity: 0,
    dyedColor: '',
    colorCode: '',
    status: 'IN_DYEING',
    inchargeName: '',
    machineNumber: '',
    batchNumber: '',
    processRemarks: '',
  });
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Issue Challan Form State
  const [challanForm, setChallanForm] = useState({
    quantityToSend: 0,
    color: '',
    remarks: '',
    vehicleNumber: '',
    driverName: '',
  });
  const [issuingChallan, setIssuingChallan] = useState(false);
  const [challanError, setChallanError] = useState<string | null>(null);
  const [issuedSuccessChallan, setIssuedSuccessChallan] = useState<{ id: string; challanNumber: string } | null>(null);

  const fetchFloorBoard = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/dyeing/floor-board');
      if (!res.ok) throw new Error('Failed to load floor board data');
      const json = await res.json();
      setLanes(json.data.lanes);
      setTotalOrders(json.data.totalOrders);
    } catch (err: any) {
      console.error('Error fetching floor board:', err);
      setError(err.message || 'Error communicating with database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFloorBoard();
  }, []);

  const openUpdateModal = (order: FloorOrder) => {
    setSelectedOrderForUpdate(order);
    setUpdateForm({
      dyedQuantity: order.dyedQuantity,
      dyedColor: order.dyedColor || order.targetColor || '',
      colorCode: order.colorCode || '',
      status: order.status === 'RECEIVED' ? 'IN_DYEING' : order.status,
      inchargeName: order.inchargeName || 'Dyeing Incharge',
      machineNumber: order.machineNumber || '',
      batchNumber: order.batchNumber || '',
      processRemarks: order.processRemarks || '',
    });
    setUpdateError(null);
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForUpdate) return;
    try {
      setUpdating(true);
      setUpdateError(null);

      const payload = {
        dyedQuantity: Number(updateForm.dyedQuantity),
        dyedColor: updateForm.dyedColor,
        colorCode: updateForm.colorCode,
        status: updateForm.status,
        inchargeName: updateForm.inchargeName,
        machineNumber: updateForm.machineNumber,
        batchNumber: updateForm.batchNumber,
        processRemarks: updateForm.processRemarks,
      };

      const res = await fetch(`/api/dyeing/orders/${selectedOrderForUpdate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Failed to update dyeing progress');
      }

      setSelectedOrderForUpdate(null);
      await fetchFloorBoard();
    } catch (err: any) {
      setUpdateError(err.message || 'Error saving update');
    } finally {
      setUpdating(false);
    }
  };

  const openChallanModal = (order: FloorOrder) => {
    setSelectedOrderForChallan(order);
    const available = Math.max(0, order.dyedQuantity - order.sentToQc1Quantity);
    setChallanForm({
      quantityToSend: available,
      color: order.dyedColor || order.targetColor || '',
      remarks: `Dyeing completed lot for QC inspection. Ref: ${order.orderNumber}`,
      vehicleNumber: '',
      driverName: '',
    });
    setChallanError(null);
    setIssuedSuccessChallan(null);
  };

  const handleChallanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForChallan) return;
    try {
      setIssuingChallan(true);
      setChallanError(null);

      const qty = Number(challanForm.quantityToSend);
      if (isNaN(qty) || qty <= 0) {
        throw new Error('Please enter a valid positive quantity to send.');
      }

      const available = Math.max(0, selectedOrderForChallan.dyedQuantity - selectedOrderForChallan.sentToQc1Quantity);
      if (qty > available) {
        throw new Error(`Cannot dispatch ${qty} ${selectedOrderForChallan.uom}. Only ${available} ${selectedOrderForChallan.uom} available.`);
      }

      const res = await fetch(`/api/dyeing/orders/${selectedOrderForChallan.id}/issue-qc1-challan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantityToSend: qty,
          color: challanForm.color,
          remarks: challanForm.remarks,
          vehicleNumber: challanForm.vehicleNumber,
          driverName: challanForm.driverName,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Failed to issue Challan to QC1');
      }

      setIssuedSuccessChallan({
        id: resJson.data.challan.id,
        challanNumber: resJson.data.challan.challanNumber,
      });

      await fetchFloorBoard();
    } catch (err: any) {
      setChallanError(err.message || 'Error issuing Challan');
    } finally {
      setIssuingChallan(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-16">
      {/* SUCCESS BANNER WHEN CHALLAN ISSUED */}
      {issuedSuccessChallan && (
        <div className="p-4 bg-emerald-50 border-2 border-emerald-500 rounded-xl flex items-center justify-between shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-emerald-950">
                Challan Successfully Issued to QC1!
              </h4>
              <p className="text-xs text-emerald-700">
                Dispatch Challan <span className="font-mono font-bold">{issuedSuccessChallan.challanNumber}</span> has been dispatched to QC1.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/challans/${issuedSuccessChallan.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow-xs transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>View &amp; Print Slip</span>
            </Link>
            <button
              onClick={() => setIssuedSuccessChallan(null)}
              className="p-1.5 text-emerald-700 hover:bg-emerald-100 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
              MES Shop Floor Board
            </span>
            <span className="text-xs text-slate-400">· Real-time Stage Tracking</span>
          </div>
          <h1 className="text-2xl font-bold font-serif text-slate-900 mt-1">
            Dyeing Floor Kanban
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Visualize the live flow of material lots across 6 physical stages: Received → In Dyeing → Partially Dyed → Fully Dyed → Ready for QC1 → Sent to QC1.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            Total Active Orders: {totalOrders}
          </div>
          <button
            onClick={() => fetchFloorBoard()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Board</span>
          </button>
        </div>
      </div>

      {/* ERROR BANNER */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-900 text-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <span>Error loading floor board: {error}</span>
        </div>
      )}

      {/* KANBAN SWIMLANES GRID (6 COLUMNS) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-start">
        {LANES_CONFIG.map((lane) => {
          const ordersInLane = lanes[lane.key] || [];

          return (
            <div
              key={lane.key}
              className={`bg-slate-100/90 rounded-xl border border-slate-200 border-t-4 ${lane.borderTop} flex flex-col min-h-[580px] shadow-xs`}
            >
              {/* LANE HEADER */}
              <div className="p-3 border-b border-slate-200/80 bg-white/70 rounded-t-lg">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xs font-bold text-slate-900">{lane.label}</h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${lane.badgeBg} ${lane.badgeText}`}
                  >
                    {ordersInLane.length}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  {lane.description}
                </p>
              </div>

              {/* LANE CARDS CONTAINER */}
              <div className="p-2 space-y-2.5 flex-1 overflow-y-auto max-h-[70vh]">
                {ordersInLane.length === 0 ? (
                  <div className="h-32 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center p-3 text-center">
                    <span className="text-[11px] text-slate-400 font-mono">
                      No lots in this stage
                    </span>
                  </div>
                ) : (
                  ordersInLane.map((order) => {
                    const availableForQc = Math.max(0, order.dyedQuantity - order.sentToQc1Quantity);
                    const canIssue = order.dyedQuantity > 0 && availableForQc > 0;

                    return (
                      <div
                        key={order.id}
                        className="bg-white rounded-lg p-3 border border-slate-200 hover:border-[#163767]/50 shadow-xs hover:shadow-sm transition space-y-2"
                      >
                        {/* TOP: ORDER # & PRIORITY */}
                        <div className="flex items-start justify-between gap-1">
                          <div>
                            <span className="font-mono font-bold text-xs text-slate-900 block">
                              {order.program?.programSerialNo || order.orderNumber}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 block">
                              {order.program?.programNumber || order.orderNumber}
                            </span>
                          </div>
                          {order.priority === 'HIGH' && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800">
                              HIGH
                            </span>
                          )}
                        </div>

                        {/* CLIENT & STYLE */}
                        <div className="text-[11px] text-slate-700 leading-tight">
                          <span className="font-semibold block truncate">
                            {order.program?.clientName || order.program?.buyerName || 'Standard Client'}
                          </span>
                          <span className="text-[10px] text-slate-500 block truncate">
                            {order.program?.styleCode || 'General Lot'}
                          </span>
                        </div>

                        {/* FABRIC & COLOR */}
                        <div className="bg-slate-50 p-2 rounded border border-slate-100 text-[11px] space-y-1">
                          <div className="font-semibold text-slate-900 truncate">
                            {order.fabricName}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px]">
                            <span
                              className="w-2.5 h-2.5 rounded-full border border-slate-300 flex-shrink-0"
                              style={{
                                backgroundColor:
                                  order.colorCode ||
                                  (order.dyedColor?.toLowerCase() === 'black' ? '#000' :
                                   order.dyedColor?.toLowerCase() === 'white' ? '#fff' :
                                   order.dyedColor?.toLowerCase() === 'red' ? '#DC2626' :
                                   order.dyedColor?.toLowerCase() === 'blue' ? '#2563EB' :
                                   order.dyedColor?.toLowerCase() === 'green' ? '#16A34A' : '#94A3B8')
                              }}
                            />
                            <span className="text-slate-600 font-medium truncate">
                              {order.dyedColor || order.targetColor}
                            </span>
                          </div>
                        </div>

                        {/* QUANTITY PILLS */}
                        <div className="grid grid-cols-2 gap-1 text-[10px] font-mono text-center">
                          <div className="bg-slate-100 rounded px-1.5 py-0.5">
                            <span className="text-slate-400 block text-[8px] uppercase">Req</span>
                            <span className="font-bold text-slate-800">{order.requiredQuantity}</span>
                          </div>
                          <div className="bg-emerald-50 rounded px-1.5 py-0.5">
                            <span className="text-emerald-700 block text-[8px] uppercase">Dyed</span>
                            <span className="font-bold text-emerald-800">{order.dyedQuantity}</span>
                          </div>
                          <div className="bg-amber-50 rounded px-1.5 py-0.5">
                            <span className="text-amber-700 block text-[8px] uppercase">Undyed</span>
                            <span className="font-bold text-amber-800">{order.undyedQuantity}</span>
                          </div>
                          <div className="bg-blue-50 rounded px-1.5 py-0.5">
                            <span className="text-blue-700 block text-[8px] uppercase">Sent QC</span>
                            <span className="font-bold text-blue-800">{order.sentToQc1Quantity}</span>
                          </div>
                        </div>

                        {/* INBOUND / OUTBOUND CHALLAN LINKS */}
                        {order.qc1Challan && (
                          <div className="text-[10px] text-emerald-700 font-mono flex items-center justify-between border-t border-slate-100 pt-1">
                            <span>QC1 Slip:</span>
                            <Link
                              href={`/challans/${order.qc1Challan.id}`}
                              className="font-bold hover:underline inline-flex items-center gap-0.5"
                            >
                              <span>{order.qc1Challan.challanNumber}</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </Link>
                          </div>
                        )}

                        {/* CARD ACTION BUTTONS */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                          <button
                            onClick={() => openUpdateModal(order)}
                            className="flex-1 py-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold transition flex items-center justify-center gap-1"
                          >
                            <Edit3 className="w-3 h-3 text-[#163767]" />
                            <span>Update</span>
                          </button>

                          {canIssue && (
                            <button
                              onClick={() => openChallanModal(order)}
                              title={`Send to QC1 (${availableForQc} ${order.uom} available)`}
                              className="py-1 px-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-[10px] font-bold transition flex items-center justify-center gap-1 shadow-xs"
                            >
                              <Send className="w-3 h-3" />
                              <span>QC1</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* UPDATE MODAL */}
      {selectedOrderForUpdate && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <form onSubmit={handleUpdateSubmit}>
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <Edit3 className="w-5 h-5 text-[#163767]" />
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Record Dyeing Work Progress
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">
                      Order: {selectedOrderForUpdate.orderNumber} · {selectedOrderForUpdate.fabricName}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOrderForUpdate(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                {updateError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{updateError}</span>
                  </div>
                )}

                {/* QUANTITY RECONCILIATION SUMMARY BOX */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-3 gap-3 text-center">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Required Total</span>
                    <span className="font-mono font-bold text-slate-900 text-base">
                      {selectedOrderForUpdate.requiredQuantity}
                    </span>
                    <span className="text-[10px] text-slate-400 block">{selectedOrderForUpdate.uom}</span>
                  </div>
                  <div className="border-x border-slate-200 px-2">
                    <span className="text-[10px] text-amber-700 font-bold uppercase block">Remaining Undyed</span>
                    <span className="font-mono font-bold text-amber-800 text-base">
                      {Math.max(0, selectedOrderForUpdate.requiredQuantity - Number(updateForm.dyedQuantity || 0))}
                    </span>
                    <span className="text-[10px] text-slate-400 block">{selectedOrderForUpdate.uom}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-blue-700 font-bold uppercase block">Ready for QC1</span>
                    <span className="font-mono font-bold text-blue-800 text-base">
                      {Math.max(0, Number(updateForm.dyedQuantity || 0) - selectedOrderForUpdate.sentToQc1Quantity)}
                    </span>
                    <span className="text-[10px] text-slate-400 block">{selectedOrderForUpdate.uom}</span>
                  </div>
                </div>

                {/* FORM INPUTS */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                      Dyed Quantity ({selectedOrderForUpdate.uom}) *
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      required
                      value={updateForm.dyedQuantity}
                      onChange={(e) => setUpdateForm({ ...updateForm, dyedQuantity: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#163767]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                      Dyed Color *
                    </label>
                    <input
                      type="text"
                      required
                      value={updateForm.dyedColor}
                      onChange={(e) => setUpdateForm({ ...updateForm, dyedColor: e.target.value })}
                      placeholder={`e.g. ${selectedOrderForUpdate.targetColor}`}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#163767]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                      Dyeing Incharge
                    </label>
                    <input
                      type="text"
                      value={updateForm.inchargeName}
                      onChange={(e) => setUpdateForm({ ...updateForm, inchargeName: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#163767]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                      Workflow Status
                    </label>
                    <select
                      value={updateForm.status}
                      onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#163767]"
                    >
                      <option value="IN_DYEING">IN DYEING</option>
                      <option value="PARTIALLY_DYED">PARTIALLY DYED</option>
                      <option value="DYED">DYED</option>
                      <option value="READY_FOR_QC1">READY FOR QC1</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                      Machine Number
                    </label>
                    <input
                      type="text"
                      value={updateForm.machineNumber}
                      onChange={(e) => setUpdateForm({ ...updateForm, machineNumber: e.target.value })}
                      placeholder="e.g. M/C-02"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#163767]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                      Batch / Lot Number
                    </label>
                    <input
                      type="text"
                      value={updateForm.batchNumber}
                      onChange={(e) => setUpdateForm({ ...updateForm, batchNumber: e.target.value })}
                      placeholder="e.g. LOT-A12"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#163767]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                    Process Remarks / Observation
                  </label>
                  <textarea
                    rows={2}
                    value={updateForm.processRemarks}
                    onChange={(e) => setUpdateForm({ ...updateForm, processRemarks: e.target.value })}
                    placeholder="Enter temperature, shade verification notes, or instructions..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#163767]"
                  />
                </div>
              </div>

              <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedOrderForUpdate(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-5 py-2 bg-[#163767] hover:bg-[#0F264A] text-white rounded-lg text-xs font-semibold transition disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {updating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Save Production Progress</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ISSUE CHALLAN MODAL */}
      {selectedOrderForChallan && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <form onSubmit={handleChallanSubmit}>
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                    <Send className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Issue Material Challan to QC1
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">
                      Order: {selectedOrderForChallan.orderNumber} · {selectedOrderForChallan.fabricName}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOrderForChallan(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                {challanError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{challanError}</span>
                  </div>
                )}

                {/* TRANSFER SUMMARY */}
                <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-blue-900">Transfer Route:</span>
                    <span className="font-mono font-bold text-blue-950 bg-white px-2 py-0.5 rounded border border-blue-200">
                      DYEING → QC1
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-blue-200/60">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Dyed Total</span>
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        {selectedOrderForChallan.dyedQuantity} {selectedOrderForChallan.uom}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Already Sent</span>
                      <span className="font-mono font-bold text-slate-600 text-sm">
                        {selectedOrderForChallan.sentToQc1Quantity} {selectedOrderForChallan.uom}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-700 font-bold block uppercase">Available Now</span>
                      <span className="font-mono font-bold text-emerald-800 text-sm">
                        {Math.max(0, selectedOrderForChallan.dyedQuantity - selectedOrderForChallan.sentToQc1Quantity)} {selectedOrderForChallan.uom}
                      </span>
                    </div>
                  </div>
                </div>

                {/* QUANTITY TO SEND INPUT */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold uppercase text-slate-700">
                      Dispatch Quantity ({selectedOrderForChallan.uom}) *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const avail = Math.max(0, selectedOrderForChallan.dyedQuantity - selectedOrderForChallan.sentToQc1Quantity);
                        setChallanForm({ ...challanForm, quantityToSend: avail });
                      }}
                      className="text-[11px] font-bold text-[#163767] hover:underline"
                    >
                      Fill Max Available ({Math.max(0, selectedOrderForChallan.dyedQuantity - selectedOrderForChallan.sentToQc1Quantity)} {selectedOrderForChallan.uom})
                    </button>
                  </div>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    max={Math.max(0, selectedOrderForChallan.dyedQuantity - selectedOrderForChallan.sentToQc1Quantity)}
                    required
                    value={challanForm.quantityToSend}
                    onChange={(e) => setChallanForm({ ...challanForm, quantityToSend: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-base text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                {/* COLOR & LOGISTICS */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                      Dyed Color
                    </label>
                    <input
                      type="text"
                      value={challanForm.color}
                      onChange={(e) => setChallanForm({ ...challanForm, color: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#163767]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                      Vehicle / Cart No. (Optional)
                    </label>
                    <input
                      type="text"
                      value={challanForm.vehicleNumber}
                      onChange={(e) => setChallanForm({ ...challanForm, vehicleNumber: e.target.value })}
                      placeholder="e.g. Trolley-04"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#163767]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                    Dispatch Remarks &amp; QC Instructions
                  </label>
                  <textarea
                    rows={2}
                    value={challanForm.remarks}
                    onChange={(e) => setChallanForm({ ...challanForm, remarks: e.target.value })}
                    placeholder="Enter dispatch notes, shade verification remarks for QC1..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#163767]"
                  />
                </div>
              </div>

              <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedOrderForChallan(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={issuingChallan}
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50 inline-flex items-center gap-1.5 shadow-xs"
                >
                  {issuingChallan ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Generate &amp; Issue Challan to QC1</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
