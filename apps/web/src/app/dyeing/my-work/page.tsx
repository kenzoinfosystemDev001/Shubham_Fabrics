'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
  Printer,
  Download,
  Plus,
  Phone,
  Hash,
} from 'lucide-react';
import {
  downloadProductionSheetHtml,
  printProductionSheet,
} from '@/lib/download-production-sheet';

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
    fabricWidth?: string | null;
    fabricWidthInches?: number | null;
    fabricColor?: string | null;
    fabricAverage?: number | null;
    fabricAverageType?: string | null;
    designNumber?: string | null;
    wilcomDesignNumber?: string | null;
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
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'create-challan' ? 'create-challan' : 'incoming';
  const preselectedProgramId = searchParams.get('programId');

  // Navigation Tabs: 'incoming' (Incoming Challans) | 'create-challan' (Create challan to QC1)
  const [activeTab, setActiveTab] = useState<'incoming' | 'create-challan'>(initialTab);

  // Data state
  const [orders, setOrders] = useState<DyeingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  // Modal state
  const [selectedOrderForSheet, setSelectedOrderForSheet] = useState<DyeingOrder | null>(null);
  const [selectedOrderForUpdate, setSelectedOrderForUpdate] = useState<DyeingOrder | null>(null);

  // ==============================================================
  // FORM STATE: Dyeing Dept -> QC1 (as specified in handwritten sketch)
  // ==============================================================
  const [challanNumber, setChallanNumber] = useState('');
  const [challanDate, setChallanDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [sourceDept] = useState('Dyeing Department');
  const [destDept] = useState('QC1');
  const [priority, setPriority] = useState('NORMAL');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [designNumber, setDesignNumber] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [dyedOrUndyed, setDyedOrUndyed] = useState<'DYED' | 'UNDYED'>('DYED');
  const [colour, setColour] = useState('');
  const [colorCode, setColorCode] = useState('');
  const [width, setWidth] = useState('');
  const [avgConsumption, setAvgConsumption] = useState('');
  const [inboundQuantity, setInboundQuantity] = useState('');
  const [uom, setUom] = useState('MTR');
  const [shrinkageMeters, setShrinkageMeters] = useState('');
  const [quantityToSend, setQuantityToSend] = useState('');
  const [dyeingInchargeName, setDyeingInchargeName] = useState('Dyeing Incharge');
  const [dyeingInchargeContact, setDyeingInchargeContact] = useState('');

  const handleInboundQuantityChange = (val: string) => {
    setInboundQuantity(val);
    const inQty = parseFloat(val);
    const shrink = parseFloat(shrinkageMeters);
    if (!isNaN(inQty)) {
      if (!isNaN(shrink) && shrink >= 0) {
        setQuantityToSend(String(Math.max(0, Math.round((inQty - shrink) * 100) / 100)));
      } else {
        setQuantityToSend(val);
      }
    } else {
      setQuantityToSend('');
    }
  };

  const handleShrinkageChange = (val: string) => {
    setShrinkageMeters(val);
    const base = parseFloat(inboundQuantity) || (selectedOrder ? (selectedOrder.dyedQuantity > 0 ? selectedOrder.dyedQuantity : selectedOrder.requiredQuantity) : 0);
    const shrink = parseFloat(val);
    if (!isNaN(shrink) && shrink >= 0 && base > 0) {
      setQuantityToSend(String(Math.max(0, Math.round((base - shrink) * 100) / 100)));
    } else if (!val && base > 0) {
      setQuantityToSend(String(base));
    }
  };

  // Submit states
  const [submittingChallan, setSubmittingChallan] = useState(false);
  const [formError, setFormError] = useState('');
  const [createdChallanSuccess, setCreatedChallanSuccess] = useState<any>(null);

  // Update Dyeing progress modal form state
  const [updateForm, setUpdateForm] = useState({
    dyedQuantity: 0,
    dyedColor: '',
    colorCode: '',
    status: 'IN_DYEING',
    machineNumber: '',
    batchNumber: '',
    processRemarks: '',
  });
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Fetch Next Challan Number for Dyeing -> QC1
  const loadNextChallanNumber = async () => {
    try {
      const res = await fetch('/api/challans/next-number?department=DYEING');
      const data = await res.json();
      if (data?.nextNumber) {
        setChallanNumber(data.nextNumber);
      }
    } catch (e) {
      console.warn('Failed to fetch next dyeing challan number', e);
    }
  };

  // Fetch Orders
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
      const list: DyeingOrder[] = json.data || [];
      setOrders(list);

      // Read current logged in user
      if (typeof window !== 'undefined') {
        try {
          const savedUser = localStorage.getItem('subham_mes_user');
          if (savedUser) {
            const parsed = JSON.parse(savedUser);
            if (parsed.fullName) setDyeingInchargeName(parsed.fullName);
            if (parsed.phone || parsed.contact) setDyeingInchargeContact(parsed.phone || parsed.contact);
          }
        } catch {}
      }

      // Pre-select order if query param supplied or select first
      if (list.length > 0) {
        const target = preselectedProgramId
          ? list.find((o) => o.programId === preselectedProgramId || o.id === preselectedProgramId)
          : list[0];
        if (target && !selectedOrderId) {
          selectOrderForForm(target);
        }
      }
    } catch (err: any) {
      console.error('Error fetching dyeing orders:', err);
      setError(err.message || 'Error communicating with database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    loadNextChallanNumber();
  }, [statusFilter, priorityFilter]);

  // Synchronize form fields when an order / production sheet is selected
  const selectOrderForForm = (order: DyeingOrder) => {
    setSelectedOrderId(order.id);
    const prog = order.program;
    setDesignNumber(prog?.designNumber || prog?.wilcomDesignNumber || prog?.styleCode || '');
    setPriority(order.priority || prog?.priority || 'NORMAL');

    if (prog?.deliveryDate) {
      setDeliveryDate(new Date(prog.deliveryDate).toISOString().split('T')[0]);
    } else {
      setDeliveryDate('');
    }

    setDyedOrUndyed(order.dyedQuantity > 0 ? 'DYED' : 'UNDYED');
    setColour(order.dyedColor || order.targetColor || prog?.fabricColor || '');
    setColorCode(order.colorCode || '');
    setWidth(prog?.fabricWidth || (prog?.fabricWidthInches ? `${prog.fabricWidthInches}"` : '') || '');
    setAvgConsumption(prog?.fabricAverage ? `${prog.fabricAverage}` : '');
    setInboundQuantity(String(order.requiredQuantity || ''));
    setUom(order.uom || 'MTR');
    setShrinkageMeters('');

    const availableQty = Math.max(0, (order.dyedQuantity || order.requiredQuantity) - order.sentToQc1Quantity);
    setQuantityToSend(String(availableQty || order.requiredQuantity || ''));
  };

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  // Switch to Create Challan tab with a specific order pre-loaded
  const handleStartCreateChallan = (order: DyeingOrder) => {
    selectOrderForForm(order);
    loadNextChallanNumber();
    setActiveTab('create-challan');
    setFormError('');
    setCreatedChallanSuccess(null);
  };

  // Submit Challan to QC1
  const handleSubmitQC1Challan = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedOrder) {
      setFormError('Please select a Serial Number / Production Sheet from the dropdown.');
      return;
    }

    if (!challanNumber.trim()) {
      setFormError('Please provide a Challan Number.');
      return;
    }

    const qty = parseFloat(quantityToSend);
    if (isNaN(qty) || qty <= 0) {
      setFormError('Please enter a valid positive quantity (Meters) to send to QC1.');
      return;
    }

    try {
      setSubmittingChallan(true);
      setFormError('');

      const inchargeInfo = [
        dyeingInchargeName ? `Dyeing Incharge: ${dyeingInchargeName}` : null,
        dyeingInchargeContact ? `Contact: ${dyeingInchargeContact}` : null,
        shrinkageMeters ? `Shrinkage: ${shrinkageMeters} ${uom} (Inbound: ${inboundQuantity || selectedOrder.requiredQuantity} ${uom}, Net: ${qty} ${uom})` : null,
        `Status: ${dyedOrUndyed}`,
        colorCode ? `Color Code: ${colorCode}` : null,
        width ? `Width/Size: ${width}` : null,
        avgConsumption ? `Avg: ${avgConsumption}` : null,
      ]
        .filter(Boolean)
        .join(' · ');

      const challanItems = [
        {
          itemDescription: `${selectedOrder.fabricName} (${dyedOrUndyed}) - ${colour || 'Standard'}`,
          unitType: 'ROLL',
          quantity: qty,
          uom: uom || selectedOrder.uom || 'MTR',
          fabricCode: selectedOrder.fabricName || 'FABRIC',
          colour: colour || null,
          remarks: [
            shrinkageMeters ? `Shrinkage: ${shrinkageMeters} ${uom} (Inbound: ${inboundQuantity || selectedOrder.requiredQuantity} ${uom})` : null,
            `Process: ${dyedOrUndyed}`,
            colorCode ? `Code: ${colorCode}` : null,
            width ? `Width/Size: ${width}` : null,
            avgConsumption ? `Avg: ${avgConsumption}` : null,
          ]
            .filter(Boolean)
            .join(' | '),
        },
      ];

      const payload = {
        challanNumber: challanNumber.trim(),
        challanType: 'DYEING_TO_QC1',
        programId: selectedOrder.programId,
        fromDepartment: 'DYEING',
        toDepartment: 'QC1',
        priority: priority || 'NORMAL',
        issuedDate: challanDate,
        remarks: inchargeInfo,
        items: challanItems,
      };

      const res = await fetch('/api/challans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to dispatch Challan to QC1');
      }

      setCreatedChallanSuccess({
        ...data,
        order: selectedOrder,
        dyedOrUndyed,
        colour,
        colorCode,
        width,
        avgConsumption,
        qty,
        dyeingInchargeName,
        dyeingInchargeContact,
      });

      // Refresh orders list
      fetchOrders();
    } catch (err: any) {
      setFormError(err.message || 'Error dispatching challan to QC1');
    } finally {
      setSubmittingChallan(false);
    }
  };

  // Open Update Progress Modal
  const openUpdateModal = (order: DyeingOrder) => {
    setSelectedOrderForUpdate(order);
    setUpdateForm({
      dyedQuantity: order.dyedQuantity,
      dyedColor: order.dyedColor || order.targetColor,
      colorCode: order.colorCode || '',
      status: order.status,
      machineNumber: order.machineNumber || '',
      batchNumber: order.batchNumber || '',
      processRemarks: order.processRemarks || '',
    });
    setUpdateError(null);
  };

  // Submit Update Progress
  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForUpdate) return;

    try {
      setUpdating(true);
      setUpdateError(null);

      const res = await fetch(`/api/dyeing/orders/${selectedOrderForUpdate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateForm),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to update dyeing order');
      }

      setSelectedOrderForUpdate(null);
      await fetchOrders();
    } catch (err: any) {
      setUpdateError(err.message || 'Error updating order');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] pb-24">
      {/* TOP HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-8 py-3.5 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">
                DYEING DEPARTMENT
              </span>
              <span className="text-slate-300">/</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                MY WORK
              </span>
            </div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Droplet className="w-5 h-5 text-purple-600" />
              <span>Dyeing Department Operational Workspace</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchOrders();
                loadNextChallanNumber();
              }}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <Link
              href="/dyeing"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 rounded-lg text-xs font-bold transition"
            >
              <Layers className="w-3.5 h-3.5 text-purple-700" />
              <span>Dashboard</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {/* ============================================================== */}
        {/* NAVIGATION TABS: Incoming Challans | Create Challan to QC1    */}
        {/* Matches Image 1 layout: My Work -> Incoming Challans / QC1     */}
        {/* ============================================================== */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('incoming')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'incoming'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Incoming Challans ({orders.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('create-challan');
              loadNextChallanNumber();
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'create-challan'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>Create challan to QC1 (Quality Check 1)</span>
          </button>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-900 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 1: INCOMING CHALLANS (RECEIVED FROM FABRIC STORE)           */}
        {/* ============================================================== */}
        {activeTab === 'incoming' && (
          <div className="space-y-4">
            {/* SEARCH & FILTERS */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by Serial #, Program #, Fabric, Color, Client..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-purple-600 focus:border-transparent"
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
                    <option value="HIGH">High</option>
                    <option value="NORMAL">Normal</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
              </div>
            </div>

            {/* INCOMING CHALLANS RECORDS TABLE */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-purple-700" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Incoming Fabric Store Challans &middot; Real Shop Floor Lots ({orders.length})
                  </h3>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">
                  From Fabric Store → Dyeing
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Sheet &amp; Challan #</th>
                      <th className="py-3 px-4">Client / Style</th>
                      <th className="py-3 px-4">Fabric</th>
                      <th className="py-3 px-4">Color Req / Dyed</th>
                      <th className="py-3 px-4 text-right">Required</th>
                      <th className="py-3 px-4 text-right">Dyed</th>
                      <th className="py-3 px-4 text-right">Undyed Rem.</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading && orders.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-400 font-mono animate-pulse">
                          Reading production records from database...
                        </td>
                      </tr>
                    ) : orders.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-16 text-center">
                          <div className="max-w-md mx-auto space-y-2">
                            <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                            <h4 className="text-sm font-bold text-slate-800">No Inward Challans Found</h4>
                            <p className="text-xs text-slate-500">
                              Issue a challan from Fabric Store to Dyeing to receive lots here.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      orders.map((order) => (
                        <tr key={order.id} className="hover:bg-slate-50/80 transition group">
                          {/* SHEET & CHALLAN */}
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
                              <div className="text-[10px] text-purple-700 font-mono flex items-center gap-1 mt-0.5">
                                <span>Ch: {order.inboundChallan.challanNumber}</span>
                              </div>
                            )}
                          </td>

                          {/* CLIENT & STYLE */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900 truncate max-w-[140px]">
                              {order.program?.clientName || order.program?.buyerName || 'Standard Client'}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate max-w-[140px]">
                              {order.program?.mainStyle || order.program?.styleCode || '—'}
                            </div>
                          </td>

                          {/* FABRIC */}
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-slate-800">{order.fabricName}</div>
                            {order.fabricType && (
                              <div className="text-[10px] text-slate-500">{order.fabricType}</div>
                            )}
                          </td>

                          {/* COLOR */}
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-slate-800">{order.targetColor}</div>
                            {order.dyedColor && (
                              <div className="text-[10px] text-purple-700 font-semibold">Dyed: {order.dyedColor}</div>
                            )}
                          </td>

                          {/* REQUIRED */}
                          <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-900">
                            {order.requiredQuantity} {order.uom}
                          </td>

                          {/* DYED */}
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-purple-800">
                            {order.dyedQuantity} {order.uom}
                          </td>

                          {/* UNDYED */}
                          <td className="py-3.5 px-4 text-right font-mono text-amber-700 font-semibold">
                            {order.undyedQuantity} {order.uom}
                          </td>

                          {/* STATUS */}
                          <td className="py-3.5 px-4 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              order.status === 'RECEIVED'
                                ? 'bg-blue-100 text-blue-800'
                                : order.status === 'IN_DYEING'
                                ? 'bg-indigo-100 text-indigo-800'
                                : order.status === 'DYED'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {order.status}
                            </span>
                          </td>

                          {/* ACTIONS */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* VIEW PRODUCTION SHEET */}
                              <button
                                type="button"
                                onClick={() => setSelectedOrderForSheet(order)}
                                title="Show Production Sheet (View, Print & Download)"
                                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {/* RECORD DYEING PROGRESS */}
                              <button
                                type="button"
                                onClick={() => openUpdateModal(order)}
                                title="Record Dyeing Progress & Quantities"
                                className="p-1.5 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-md transition"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>

                              {/* ISSUE TO QC1 */}
                              <button
                                type="button"
                                onClick={() => handleStartCreateChallan(order)}
                                title="Create Challan to QC1 (Quality Check 1)"
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-700 hover:bg-purple-800 text-white rounded text-xs font-bold transition shadow-2xs"
                              >
                                <Send className="w-3 h-3" />
                                <span>To QC1</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: CREATE CHALLAN TO QC1 (QUALITY CHECK 1)                 */}
        {/* Form: Dyeing Dept -> QC1 (as specified in handwritten sketch)   */}
        {/* ============================================================== */}
        {activeTab === 'create-challan' && (
          <div className="space-y-6">
            {formError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* SUCCESS CONFIRMATION IF DISPATCHED */}
            {createdChallanSuccess ? (
              <div className="bg-white border border-emerald-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 block">
                      CHALLAN DISPATCHED TO QC1
                    </span>
                    <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                      Challan {createdChallanSuccess.challanNumber} Dispatched to QC1 (Quality Check 1)
                    </h2>
                    <p className="text-xs text-slate-600 mt-1">
                      Material and master traveler sheet have been routed to the QC1 inspection workstation.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Challan Number</span>
                    <strong className="font-mono text-slate-900 text-sm">{createdChallanSuccess.challanNumber}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Destination</span>
                    <strong className="text-slate-900">QC1 (Quality Check 1)</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">State</span>
                    <span className="font-bold text-purple-800">{createdChallanSuccess.dyedOrUndyed}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Quantity</span>
                    <strong className="font-mono text-slate-900 text-sm">{createdChallanSuccess.qty} MTR</strong>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100">
                  <Link
                    href={`/challans/${createdChallanSuccess.id}`}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-lg shadow-xs transition"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>View &amp; Print Slip</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => printProductionSheet(createdChallanSuccess.order?.program)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Production Sheet</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadProductionSheetHtml(createdChallanSuccess.order?.program)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xs transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download HTML</span>
                  </button>
                  <Link
                    href="/qc1/my-work"
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold rounded-lg transition"
                  >
                    <Eye className="w-3.5 h-3.5 text-emerald-700" />
                    <span>View in QC1 Worklist →</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setCreatedChallanSuccess(null);
                      loadNextChallanNumber();
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-lg shadow-xs transition ml-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Another QC1 Challan</span>
                  </button>
                </div>
              </div>
            ) : (
              /* THE DYEING DEPT -> QC1 FORM */
              <form
                onSubmit={handleSubmitQC1Challan}
                className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6"
              >
                {/* FORM TITLE & "Show production sheet" BUTTON */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                  <div>
                    <h2 className="text-xl font-bold font-serif text-slate-900">
                      Dyeing Dept &rarr; QC1
                    </h2>
                    <span className="text-xs text-slate-500">
                      Dispatch processed fabric lot from Dyeing to Quality Check 1
                    </span>
                  </div>

                  {selectedOrder?.program ? (
                    <button
                      type="button"
                      onClick={() => setSelectedOrderForSheet(selectedOrder)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shadow-xs transition"
                      title="Show Production Sheet (view, print and downloadable)"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Show production sheet</span>
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400 italic">
                      Select Serial Number to view Production Sheet
                    </span>
                  )}
                </div>

                {/* FORM FIELDS - LINE BY LINE (NO NUMBERING, NO PLACEHOLDER EXAMPLES) */}
                <div className="space-y-4">
                  {/* 1. CHALLAN NUMBER */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                    <label className="text-xs font-bold text-slate-700 sm:text-right sm:pr-4">
                      Challan Number <span className="text-rose-500">*</span>
                    </label>
                    <div className="sm:col-span-2 max-w-lg">
                      <input
                        type="text"
                        value={challanNumber}
                        onChange={(e) => setChallanNumber(e.target.value)}
                        required
                        className="w-full text-xs font-mono font-bold text-slate-900 border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-600 focus:border-transparent transition"
                      />
                    </div>
                  </div>

                  {/* 2. CHALLAN DATE */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                    <label className="text-xs font-bold text-slate-700 sm:text-right sm:pr-4">
                      Challan Date <span className="text-rose-500">*</span>
                    </label>
                    <div className="sm:col-span-2 max-w-lg">
                      <input
                        type="date"
                        value={challanDate}
                        onChange={(e) => setChallanDate(e.target.value)}
                        required
                        className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-600 focus:border-transparent transition"
                      />
                    </div>
                  </div>

                  {/* 3. SOURCE - (Dyeing dept) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                    <label className="text-xs font-bold text-slate-700 sm:text-right sm:pr-4">
                      Source - (Dyeing dept)
                    </label>
                    <div className="sm:col-span-2 max-w-lg">
                      <div className="w-full text-xs font-semibold text-slate-800 border border-slate-200 rounded-lg px-3 py-2 bg-slate-100 flex items-center justify-between">
                        <span>{sourceDept}</span>
                        <span className="text-[10px] font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded uppercase">
                          DYEING
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 4. DESTINATION (QC1) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                    <label className="text-xs font-bold text-slate-700 sm:text-right sm:pr-4">
                      Destination (QC1)
                    </label>
                    <div className="sm:col-span-2 max-w-lg">
                      <div className="w-full text-xs font-semibold text-slate-800 border border-slate-200 rounded-lg px-3 py-2 bg-slate-100 flex items-center justify-between">
                        <span>{destDept} (Quality Check 1)</span>
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded uppercase">
                          QC1
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 5. PRIORITY */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                    <label className="text-xs font-bold text-slate-700 sm:text-right sm:pr-4">
                      Priority
                    </label>
                    <div className="sm:col-span-2 max-w-lg">
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                        className="w-full text-xs font-semibold border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-600 focus:border-transparent transition cursor-pointer"
                      >
                        <option value="NORMAL">NORMAL</option>
                        <option value="HIGH">HIGH</option>
                        <option value="URGENT">URGENT</option>
                        <option value="LOW">LOW</option>
                      </select>
                    </div>
                  </div>

                  {/* 6. DELIVERY DATE */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                    <label className="text-xs font-bold text-slate-700 sm:text-right sm:pr-4">
                      Delivery date
                    </label>
                    <div className="sm:col-span-2 max-w-lg">
                      <input
                        type="date"
                        value={deliveryDate}
                        onChange={(e) => setDeliveryDate(e.target.value)}
                        className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-600 focus:border-transparent transition"
                      />
                    </div>
                  </div>

                  {/* 7. DESIGN NUMBER */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                    <label className="text-xs font-bold text-slate-700 sm:text-right sm:pr-4">
                      Design Number
                    </label>
                    <div className="sm:col-span-2 max-w-lg">
                      <input
                        type="text"
                        value={designNumber}
                        onChange={(e) => setDesignNumber(e.target.value)}
                        className="w-full text-xs font-mono font-medium text-slate-900 border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-600 focus:border-transparent transition"
                      />
                    </div>
                  </div>

                  {/* 8. SERIAL NUMBER (Selection of Inward Production Sheet) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                    <label className="text-xs font-bold text-slate-700 sm:text-right sm:pr-4">
                      Serial Number <span className="text-rose-500">*</span>
                    </label>
                    <div className="sm:col-span-2 max-w-lg">
                      <select
                        value={selectedOrderId}
                        onChange={(e) => {
                          const ord = orders.find((o) => o.id === e.target.value);
                          if (ord) selectOrderForForm(ord);
                        }}
                        required
                        className="w-full text-xs font-mono font-bold text-slate-900 border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-600 focus:border-transparent transition cursor-pointer"
                      >
                        <option value="">Select Serial Number / Production Sheet</option>
                        {orders.map((ord) => (
                          <option key={ord.id} value={ord.id}>
                            {ord.program?.programSerialNo || ord.orderNumber} — {ord.program?.clientName || 'Client'} ({ord.fabricName} &middot; {ord.targetColor})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 9. DYED OR UNDYED (Drop down) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                    <label className="text-xs font-bold text-slate-700 sm:text-right sm:pr-4">
                      Dyed or Undyed (Drop down) <span className="text-rose-500">*</span>
                    </label>
                    <div className="sm:col-span-2 max-w-lg">
                      <select
                        value={dyedOrUndyed}
                        onChange={(e) => setDyedOrUndyed(e.target.value as 'DYED' | 'UNDYED')}
                        className="w-full text-xs font-bold border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-600 focus:border-transparent transition cursor-pointer"
                      >
                        <option value="DYED">DYED</option>
                        <option value="UNDYED">UNDYED</option>
                      </select>
                    </div>
                  </div>

                  {/* 10. COLOUR (if dyed) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                    <label className="text-xs font-bold text-slate-700 sm:text-right sm:pr-4">
                      Colour (if dyed)
                    </label>
                    <div className="sm:col-span-2 max-w-lg">
                      <input
                        type="text"
                        value={colour}
                        onChange={(e) => setColour(e.target.value)}
                        disabled={dyedOrUndyed === 'UNDYED'}
                        className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white disabled:bg-slate-100 disabled:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-purple-600 focus:border-transparent transition"
                      />
                    </div>
                  </div>

                  {/* 11. COLOUR CODE / WIDTH / AVG. */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                    <label className="text-xs font-bold text-slate-700 sm:text-right sm:pr-4">
                      Colour code / Width / Avg.
                    </label>
                    <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-2 max-w-lg">
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase font-medium">Colour Code</span>
                        <input
                          type="text"
                          value={colorCode}
                          onChange={(e) => setColorCode(e.target.value)}
                          className="w-full text-xs font-mono border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-600 focus:border-transparent transition"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase font-medium">Width</span>
                        <input
                          type="text"
                          value={width}
                          onChange={(e) => setWidth(e.target.value)}
                          className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-600 focus:border-transparent transition"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase font-medium">Avg.</span>
                        <input
                          type="text"
                          value={avgConsumption}
                          onChange={(e) => setAvgConsumption(e.target.value)}
                          className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-600 focus:border-transparent transition"
                        />
                      </div>
                    </div>
                  </div>

                  {/* ACTUAL INBOUND MEASUREMENT & UOM */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                    <label className="text-xs font-bold text-slate-700 sm:text-right sm:pr-4">
                      Inbound Measurement
                    </label>
                    <div className="sm:col-span-2 max-w-lg grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={inboundQuantity}
                          onChange={(e) => handleInboundQuantityChange(e.target.value)}
                          placeholder=""
                          className="w-full text-xs font-mono font-bold text-slate-900 border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-600 focus:border-transparent transition"
                        />
                      </div>
                      <div>
                        <select
                          value={uom}
                          onChange={(e) => setUom(e.target.value)}
                          className="w-full text-xs font-semibold border border-slate-300 rounded-lg px-2.5 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-600 focus:border-transparent transition cursor-pointer"
                        >
                          <option value="MTR">MTR</option>
                          <option value="KG">KG</option>
                          <option value="YDS">YDS</option>
                          <option value="PCS">PCS</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* SHRINKAGE LOSS */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                    <label className="text-xs font-bold text-slate-700 sm:text-right sm:pr-4">
                      Shrinkage ({uom})
                    </label>
                    <div className="sm:col-span-2 max-w-lg">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={shrinkageMeters}
                        onChange={(e) => handleShrinkageChange(e.target.value)}
                        placeholder=""
                        className="w-full text-xs font-mono font-bold text-amber-700 border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-600 focus:border-transparent transition"
                      />
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Process shrinkage after dyeing. Automatically decreases the net meters dispatched to QC1 and next department.
                      </p>
                    </div>
                  </div>

                  {/* NET QUANTITY TO SEND TO QC1 */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                    <label className="text-xs font-bold text-slate-700 sm:text-right sm:pr-4">
                      Net Measurement to QC1 ({uom}) <span className="text-rose-500">*</span>
                    </label>
                    <div className="sm:col-span-2 max-w-lg">
                      <input
                        type="number"
                        step="any"
                        value={quantityToSend}
                        onChange={(e) => setQuantityToSend(e.target.value)}
                        required
                        placeholder=""
                        className="w-full text-xs font-mono font-bold text-slate-900 border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-600 focus:border-transparent transition"
                      />
                    </div>
                  </div>

                  {/* 12. DYEING INCHARGE (Name / Contact) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 pt-2 border-t border-slate-100">
                    <label className="text-xs font-bold text-slate-700 sm:text-right sm:pr-4">
                      Dyeing Incharge (Name / Contact)
                    </label>
                    <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg">
                      <input
                        type="text"
                        value={dyeingInchargeName}
                        onChange={(e) => setDyeingInchargeName(e.target.value)}
                        placeholder="Name"
                        className="w-full text-xs font-medium border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-600 focus:border-transparent transition"
                      />
                      <input
                        type="text"
                        value={dyeingInchargeContact}
                        onChange={(e) => setDyeingInchargeContact(e.target.value)}
                        placeholder="Contact Number"
                        className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-600 focus:border-transparent transition"
                      />
                    </div>
                  </div>
                </div>

                {/* SUBMIT BUTTON */}
                <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Submitting will dispatch the Challan and linked Production Sheet to QC1 (Quality Check 1).
                  </span>

                  <button
                    type="submit"
                    disabled={submittingChallan || !selectedOrder}
                    className="inline-flex items-center gap-2 px-7 py-3 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition"
                  >
                    <Send className="w-4 h-4" />
                    <span>{submittingChallan ? 'Submitting...' : 'Submit'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* MODAL 1: VIEW PRODUCTION SHEET (VIEW, PRINT, DOWNLOADABLE)     */}
        {/* ============================================================== */}
        {selectedOrderForSheet && selectedOrderForSheet.program && (
          <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b pb-3 border-slate-200">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-700" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Production Sheet Traveler &middot; {selectedOrderForSheet.program.programSerialNo || selectedOrderForSheet.program.programNumber}
                    </h3>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => printProductionSheet(selectedOrderForSheet.program)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadProductionSheetHtml(selectedOrderForSheet.program)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedOrderForSheet(null)}
                    className="p-1 text-slate-400 hover:text-slate-700 text-lg font-bold ml-2"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* MODAL SHEET CONTENT */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3.5 text-xs">
                <div className="flex justify-between items-start border-b-2 border-slate-800 pb-2.5">
                  <div>
                    <h2 className="text-base font-black text-slate-900">
                      SHUBHAM FABRICS INDIA PVT. LTD.
                    </h2>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">
                      Production Sheet Master
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-sm font-bold text-purple-800 block">
                      {selectedOrderForSheet.program.programSerialNo || selectedOrderForSheet.program.programNumber}
                    </span>
                    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-800">
                      {selectedOrderForSheet.program.status || 'ACTIVE'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="p-2 bg-slate-50 rounded">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Buyer / Client</span>
                    <strong className="text-slate-900">{selectedOrderForSheet.program.clientName || selectedOrderForSheet.program.buyerName || '—'}</strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Main Style</span>
                    <strong className="text-slate-900">{selectedOrderForSheet.program.mainStyle || selectedOrderForSheet.program.styleCode || '—'}</strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Design #</span>
                    <strong className="font-mono text-purple-900">{selectedOrderForSheet.program.designNumber || selectedOrderForSheet.program.wilcomDesignNumber || '—'}</strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Fabric Quality</span>
                    <strong className="text-slate-900">{selectedOrderForSheet.fabricName || '—'}</strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Fabric Color</span>
                    <strong className="text-slate-900">{selectedOrderForSheet.targetColor || '—'}</strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Required Qty</span>
                    <strong className="font-mono text-slate-900">{selectedOrderForSheet.requiredQuantity} {selectedOrderForSheet.uom}</strong>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedOrderForSheet(null)}
                  className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODAL 2: UPDATE DYEING PROGRESS                                */}
        {/* ============================================================== */}
        {selectedOrderForUpdate && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-purple-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Record Dyeing Progress
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOrderForUpdate(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
                >
                  ✕
                </button>
              </div>

              {updateError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                  {updateError}
                </div>
              )}

              <form onSubmit={handleUpdateSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Dyed Quantity ({selectedOrderForUpdate.uom})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={updateForm.dyedQuantity}
                    onChange={(e) => setUpdateForm({ ...updateForm, dyedQuantity: parseFloat(e.target.value) || 0 })}
                    className="w-full font-mono text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Dyed Color
                  </label>
                  <input
                    type="text"
                    value={updateForm.dyedColor}
                    onChange={(e) => setUpdateForm({ ...updateForm, dyedColor: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Color Code
                  </label>
                  <input
                    type="text"
                    value={updateForm.colorCode}
                    onChange={(e) => setUpdateForm({ ...updateForm, colorCode: e.target.value })}
                    className="w-full font-mono text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    value={updateForm.status}
                    onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white font-semibold"
                  >
                    <option value="IN_DYEING">IN_DYEING</option>
                    <option value="PARTIALLY_DYED">PARTIALLY_DYED</option>
                    <option value="DYED">DYED</option>
                    <option value="READY_FOR_QC1">READY_FOR_QC1</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Machine Number
                  </label>
                  <input
                    type="text"
                    value={updateForm.machineNumber}
                    onChange={(e) => setUpdateForm({ ...updateForm, machineNumber: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedOrderForUpdate(null)}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updating}
                    className="px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold transition"
                  >
                    {updating ? 'Saving...' : 'Save Progress'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
