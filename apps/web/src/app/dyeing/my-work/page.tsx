'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FileText,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Edit3,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Layers,
  Calendar,
  User,
  Droplet,
  ExternalLink,
  X,
  Truck,
  Printer
} from 'lucide-react';

interface DyeingOrder {
  id: string;
  orderNumber: string;
  programId: string;
  inboundChallanId: string | null;
  qc1ChallanId: string | null;
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
  inchargeId: string | null;
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
    fabricType?: string | null;
    fabricColor?: string | null;
    targetQuantity?: number | null;
    deliveryDate?: string | null;
    priority?: string | null;
    status?: string | null;
    quantityMeasurement?: string | null;
    wilcomDesignPhoto?: string | null;
    baseDesignPhoto?: string | null;
    specifications?: any[];
    colours?: any[];
  };
  inboundChallan?: {
    id: string;
    challanNumber: string;
    fromDepartment: string;
    toDepartment: string;
    status: string;
    issuedDate: string;
    remarks?: string | null;
  };
  qc1Challan?: {
    id: string;
    challanNumber: string;
    fromDepartment: string;
    toDepartment: string;
    status: string;
    issuedDate: string;
  };
}

export default function DyeingMyWorkPage() {
  const [orders, setOrders] = useState<DyeingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  // Modal states
  const [selectedOrderForSheet, setSelectedOrderForSheet] = useState<DyeingOrder | null>(null);
  const [selectedOrderForUpdate, setSelectedOrderForUpdate] = useState<DyeingOrder | null>(null);
  const [selectedOrderForChallan, setSelectedOrderForChallan] = useState<DyeingOrder | null>(null);

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

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (priorityFilter !== 'ALL') params.set('priority', priorityFilter);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/dyeing/orders?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to fetch Dyeing work orders');
      }
      const json = await res.json();
      setOrders(json.data || []);
    } catch (err: any) {
      console.error('Error fetching dyeing orders:', err);
      setError(err.message || 'Error communicating with database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter, priorityFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrders();
  };

  // Open Update Modal
  const openUpdateModal = (order: DyeingOrder) => {
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

  // Submit Update
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
      await fetchOrders();
    } catch (err: any) {
      setUpdateError(err.message || 'Error saving update');
    } finally {
      setUpdating(false);
    }
  };

  // Open Issue Challan Modal
  const openChallanModal = (order: DyeingOrder) => {
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

  // Submit Challan
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

      await fetchOrders();
    } catch (err: any) {
      setChallanError(err.message || 'Error issuing Challan');
    } finally {
      setIssuingChallan(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
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
                Dispatch Challan <span className="font-mono font-bold">{issuedSuccessChallan.challanNumber}</span> has been transactionally generated and dispatched.
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

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
              Department Operations
            </span>
            <span className="text-xs text-slate-400">· Real Production Data</span>
          </div>
          <h1 className="text-2xl font-bold font-serif text-slate-900 mt-1">
            Dyeing Operational Worklist
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Production Sheets &amp; lots dispatched from Fabric Store. Record exact dyed quantities, track remaining undyed yardage, and issue verified Challans to QC1.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchOrders()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Sheet #, Program #, Fabric, Color, Client, Incharge..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-[#163767] focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[11px] font-bold text-slate-500">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="RECEIVED">Received</option>
                <option value="IN_DYEING">In Dyeing</option>
                <option value="PARTIALLY_DYED">Partially Dyed</option>
                <option value="DYED">Dyed</option>
                <option value="READY_FOR_QC1">Ready for QC1</option>
                <option value="SENT_TO_QC1">Sent to QC1</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <span className="text-[11px] font-bold text-slate-500">Priority:</span>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">All Priorities</option>
                <option value="HIGH">High Priority</option>
                <option value="NORMAL">Normal</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            <button
              type="submit"
              className="px-4 py-2 bg-[#163767] hover:bg-[#0F264A] text-white text-xs font-semibold rounded-lg shadow-xs transition"
            >
              Search
            </button>
          </div>
        </form>
      </div>

      {/* ERROR STATE */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-900 text-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <div>
            <span className="font-bold">Error loading work orders:</span> {error}
          </div>
        </div>
      )}

      {/* PRODUCTION RECORDS TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#163767]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Fabric Store Received Workorders ({orders.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            Ordered by: Inward Date (Newest first)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/75 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Sheet &amp; Program #</th>
                <th className="py-3 px-4">Client / Style</th>
                <th className="py-3 px-4">Fabric &amp; Type</th>
                <th className="py-3 px-4">Color Req / Dyed</th>
                <th className="py-3 px-4 text-right">Required</th>
                <th className="py-3 px-4 text-right">Dyed</th>
                <th className="py-3 px-4 text-right">Undyed Rem.</th>
                <th className="py-3 px-4 text-right">QC1 Sent</th>
                <th className="py-3 px-4">Incharge</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && orders.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400 font-mono animate-pulse">
                    Connecting to database and reading production work orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center">
                    <div className="max-w-md mx-auto space-y-2">
                      <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                      <h4 className="text-sm font-bold text-slate-800">No Production Sheets Found</h4>
                      <p className="text-xs text-slate-500">
                        There are currently no active dyeing production sheets matching your filter. Inbound challans issued to Dyeing from Fabric Store will automatically populate here.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const availableForQc = Math.max(0, order.dyedQuantity - order.sentToQc1Quantity);
                  const canIssueChallan = order.dyedQuantity > 0 && availableForQc > 0;

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition group">
                      {/* SHEET & PROGRAM */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{order.program?.programSerialNo || order.orderNumber}</span>
                          {order.priority === 'HIGH' && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-800">
                              HIGH
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Prog: {order.program?.programNumber || '—'}
                        </div>
                        {order.inboundChallan && (
                          <div className="text-[10px] text-blue-700 font-mono flex items-center gap-1 mt-0.5">
                            <span>Challan: {order.inboundChallan.challanNumber}</span>
                          </div>
                        )}
                      </td>

                      {/* CLIENT & STYLE */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 truncate max-w-[140px]">
                          {order.program?.clientName || order.program?.buyerName || 'Standard Client'}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[140px]">
                          {order.program?.styleCode || order.program?.mainStyle || 'General Lot'}
                        </div>
                      </td>

                      {/* FABRIC */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800 truncate max-w-[130px]">
                          {order.fabricName}
                        </div>
                        {order.fabricType && (
                          <div className="text-[10px] text-slate-500">{order.fabricType}</div>
                        )}
                      </td>

                      {/* COLOR REQUIREMENT */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-slate-300 flex-shrink-0"
                            style={{
                              backgroundColor:
                                order.colorCode ||
                                (order.dyedColor?.toLowerCase() === 'black' ? '#000000' :
                                 order.dyedColor?.toLowerCase() === 'white' ? '#FFFFFF' :
                                 order.dyedColor?.toLowerCase() === 'red' ? '#DC2626' :
                                 order.dyedColor?.toLowerCase() === 'blue' ? '#2563EB' :
                                 order.dyedColor?.toLowerCase() === 'green' ? '#16A34A' :
                                 order.dyedColor?.toLowerCase() === 'yellow' ? '#CA8A04' :
                                 order.dyedColor?.toLowerCase() === 'grey' || order.dyedColor?.toLowerCase() === 'gray' ? '#6B7280' :
                                 order.dyedColor?.toLowerCase() === 'orange' ? '#EA580C' :
                                 order.dyedColor?.toLowerCase() === 'pink' ? '#EC4899' :
                                 order.dyedColor?.toLowerCase() === 'purple' ? '#9333EA' : '#CBD5E1')
                            }}
                          />
                          <span className="font-semibold text-slate-900">{order.targetColor}</span>
                        </div>
                        {order.dyedColor && order.dyedColor !== order.targetColor && (
                          <div className="text-[10px] text-emerald-700 font-medium">
                            Dyed as: {order.dyedColor}
                          </div>
                        )}
                      </td>

                      {/* REQUIRED QUANTITY */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        {order.requiredQuantity} <span className="text-[10px] font-normal text-slate-500">{order.uom}</span>
                      </td>

                      {/* QUANTITY DYED */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700 bg-emerald-50/30">
                        {order.dyedQuantity} <span className="text-[10px] font-normal text-slate-500">{order.uom}</span>
                      </td>

                      {/* QUANTITY UNDYED */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-700 bg-amber-50/30">
                        {order.undyedQuantity} <span className="text-[10px] font-normal text-slate-500">{order.uom}</span>
                      </td>

                      {/* SENT TO QC1 */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-blue-700 bg-blue-50/30">
                        {order.sentToQc1Quantity} <span className="text-[10px] font-normal text-slate-500">{order.uom}</span>
                      </td>

                      {/* INCHARGE */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900 truncate max-w-[120px]">
                          {order.inchargeName || 'Dyeing Incharge'}
                        </div>
                        {order.machineNumber && (
                          <div className="text-[10px] text-slate-500">M/C: {order.machineNumber}</div>
                        )}
                      </td>

                      {/* STATUS BADGE */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded text-[10px] font-bold tracking-wider uppercase ${
                            order.status === 'RECEIVED'
                              ? 'bg-slate-100 text-slate-700 border border-slate-300'
                              : order.status === 'IN_DYEING'
                              ? 'bg-blue-100 text-blue-900 border border-blue-200'
                              : order.status === 'PARTIALLY_DYED'
                              ? 'bg-amber-100 text-amber-900 border border-amber-200'
                              : order.status === 'DYED'
                              ? 'bg-teal-100 text-teal-900 border border-teal-200'
                              : order.status === 'READY_FOR_QC1'
                              ? 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                              : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                          }`}
                        >
                          {order.status.replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* ACTIONS */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* VIEW PRODUCTION SHEET */}
                          <button
                            onClick={() => setSelectedOrderForSheet(order)}
                            title="View Master Production Sheet"
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* UPDATE DYEING */}
                          <button
                            onClick={() => openUpdateModal(order)}
                            title="Record Dyeing Progress & Quantities"
                            className="p-1.5 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-md transition"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* ISSUE CHALLAN TO QC1 */}
                          <button
                            onClick={() => openChallanModal(order)}
                            disabled={!canIssueChallan}
                            title={
                              canIssueChallan
                                ? `Issue Challan to QC1 (${availableForQc} ${order.uom} available)`
                                : 'Record dyed quantity first before issuing Challan to QC1'
                            }
                            className={`p-1.5 rounded-md transition ${
                              canIssueChallan
                                ? 'text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 cursor-pointer'
                                : 'text-slate-300 cursor-not-allowed'
                            }`}
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODAL 1: VIEW MASTER PRODUCTION SHEET                         */}
      {/* ============================================================== */}
      {selectedOrderForSheet && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* MODAL HEADER */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-[#163767]" />
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#A66E22] block">
                    Master Manufacturing Document
                  </span>
                  <h3 className="text-base font-bold font-mono text-slate-900">
                    Production Sheet: {selectedOrderForSheet.program?.programSerialNo || selectedOrderForSheet.program?.programNumber || selectedOrderForSheet.orderNumber}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrderForSheet(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* MODAL CONTENT: 8 STRUCTURED SECTIONS */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
              {/* SECTION 1: PRODUCTION INFORMATION */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="w-2 h-2 rounded-full bg-[#163767]" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    1. Production Information
                  </h4>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Sheet Serial No</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {selectedOrderForSheet.program?.programSerialNo || selectedOrderForSheet.orderNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Program File No</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {selectedOrderForSheet.program?.programNumber || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Client Name</span>
                    <span className="font-semibold text-slate-900">
                      {selectedOrderForSheet.program?.clientName || 'Standard Client'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Buyer Name</span>
                    <span className="font-semibold text-slate-900">
                      {selectedOrderForSheet.program?.buyerName || 'Standard Buyer'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Style Code</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {selectedOrderForSheet.program?.styleCode || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Priority</span>
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      selectedOrderForSheet.priority === 'HIGH' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-800'
                    }`}>
                      {selectedOrderForSheet.priority || 'NORMAL'}
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION 2: FABRIC INFORMATION */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="w-2 h-2 rounded-full bg-[#163767]" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    2. Fabric Information
                  </h4>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Fabric Designation</span>
                    <span className="font-bold text-slate-900 text-sm">{selectedOrderForSheet.fabricName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Fabric Type</span>
                    <span className="font-semibold text-slate-900">
                      {selectedOrderForSheet.fabricType || selectedOrderForSheet.program?.fabricType || 'Standard Woven'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Unit of Measurement</span>
                    <span className="font-mono font-bold text-slate-900">{selectedOrderForSheet.uom}</span>
                  </div>
                </div>
              </div>

              {/* SECTION 3: DYEING REQUIREMENT */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="w-2 h-2 rounded-full bg-[#163767]" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    3. Dyeing Requirement
                  </h4>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-slate-800">
                    {selectedOrderForSheet.processRemarks || 'Process fabric as per production shade card and specification requirements.'}
                  </p>
                  <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-1">
                    <span>Machine Assignment: <strong className="text-slate-800">{selectedOrderForSheet.machineNumber || 'Pending Allocation'}</strong></span>
                    <span>Batch No: <strong className="text-slate-800">{selectedOrderForSheet.batchNumber || 'Auto Batch'}</strong></span>
                  </div>
                </div>
              </div>

              {/* SECTION 4: QUANTITY REQUIREMENT */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="w-2 h-2 rounded-full bg-[#163767]" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    4. Quantity Requirement &amp; Reconciliation
                  </h4>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-white border border-slate-200 rounded-lg">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Required Total</span>
                    <span className="text-lg font-bold font-mono text-slate-900">{selectedOrderForSheet.requiredQuantity}</span>
                    <span className="text-[10px] text-slate-500 block">{selectedOrderForSheet.uom}</span>
                  </div>
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase block">Total Dyed</span>
                    <span className="text-lg font-bold font-mono text-emerald-900">{selectedOrderForSheet.dyedQuantity}</span>
                    <span className="text-[10px] text-emerald-700 block">{selectedOrderForSheet.uom}</span>
                  </div>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <span className="text-[10px] font-bold text-amber-800 uppercase block">Remaining Undyed</span>
                    <span className="text-lg font-bold font-mono text-amber-900">{selectedOrderForSheet.undyedQuantity}</span>
                    <span className="text-[10px] text-amber-700 block">{selectedOrderForSheet.uom}</span>
                  </div>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <span className="text-[10px] font-bold text-blue-800 uppercase block">Dispatched to QC1</span>
                    <span className="text-lg font-bold font-mono text-blue-900">{selectedOrderForSheet.sentToQc1Quantity}</span>
                    <span className="text-[10px] text-blue-700 block">{selectedOrderForSheet.uom}</span>
                  </div>
                </div>
              </div>

              {/* SECTION 5: COLOR REQUIREMENT */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="w-2 h-2 rounded-full bg-[#163767]" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    5. Color Requirement
                  </h4>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-white border border-slate-200 rounded-lg flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full border border-slate-300 shadow-xs flex-shrink-0 bg-slate-200" />
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Target Color</span>
                      <span className="font-bold text-slate-900 text-sm">{selectedOrderForSheet.targetColor}</span>
                    </div>
                  </div>
                  <div className="p-3 bg-white border border-slate-200 rounded-lg flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full border border-slate-300 shadow-xs flex-shrink-0 bg-emerald-100 flex items-center justify-center text-emerald-800 font-bold text-[10px]">
                      OK
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Actual Dyed Color</span>
                      <span className="font-bold text-slate-900 text-sm">
                        {selectedOrderForSheet.dyedColor || 'Not yet recorded'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 6: DELIVERY INFORMATION */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="w-2 h-2 rounded-full bg-[#163767]" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    6. Delivery Information
                  </h4>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Delivery Target Date</span>
                    <span className="font-semibold text-slate-900">
                      {selectedOrderForSheet.program?.deliveryDate
                        ? new Date(selectedOrderForSheet.program.deliveryDate).toLocaleDateString()
                        : 'Standard Schedule'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Received at Dyeing</span>
                    <span className="font-semibold text-slate-900">
                      {new Date(selectedOrderForSheet.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Current Workflow Turn</span>
                    <span className="font-semibold text-blue-900">Dyeing Processing Gate</span>
                  </div>
                </div>
              </div>

              {/* SECTION 7: SOURCE / CHALLAN INFORMATION */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="w-2 h-2 rounded-full bg-[#163767]" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    7. Source / Challan Traceability
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Inbound Gate (Fabric Store)</span>
                    <div className="font-mono font-bold text-slate-900">
                      {selectedOrderForSheet.inboundChallan?.challanNumber || 'Direct Transfer'}
                    </div>
                    {selectedOrderForSheet.inboundChallan?.issuedDate && (
                      <div className="text-[10px] text-slate-500">
                        Issued: {new Date(selectedOrderForSheet.inboundChallan.issuedDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Outbound Gate (QC1 Challan)</span>
                    <div className="font-mono font-bold text-slate-900">
                      {selectedOrderForSheet.qc1Challan?.challanNumber ? (
                        <Link
                          href={`/challans/${selectedOrderForSheet.qc1Challan.id}`}
                          className="text-blue-700 hover:underline inline-flex items-center gap-1"
                        >
                          <span>{selectedOrderForSheet.qc1Challan.challanNumber}</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      ) : (
                        <span className="text-slate-400 font-normal">Pending Dispatch</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 8: STATUS & WORKFLOW PROGRESS */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="w-2 h-2 rounded-full bg-[#163767]" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    8. Department Status &amp; Responsibility
                  </h4>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Current Status</span>
                    <span className="font-bold text-blue-900">{selectedOrderForSheet.status.replace(/_/g, ' ')}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Dyeing Incharge</span>
                    <span className="font-semibold text-slate-900">{selectedOrderForSheet.inchargeName || 'Dyeing Incharge'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Last Updated</span>
                    <span className="font-semibold text-slate-900">{new Date(selectedOrderForSheet.updatedAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* MODAL FOOTER */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedOrderForSheet(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 transition"
              >
                Close View
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const ord = selectedOrderForSheet;
                    setSelectedOrderForSheet(null);
                    openUpdateModal(ord);
                  }}
                  className="px-4 py-2 bg-[#163767] hover:bg-[#0F264A] text-white rounded-lg text-xs font-semibold transition inline-flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Record Dyeing Work</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: UPDATE DYEING WORK                                    */}
      {/* ============================================================== */}
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

      {/* ============================================================== */}
      {/* MODAL 3: ISSUE CHALLAN TO QC1                                  */}
      {/* ============================================================== */}
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
