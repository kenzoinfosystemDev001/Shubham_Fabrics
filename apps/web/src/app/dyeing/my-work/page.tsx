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
  AlertTriangle,
  Archive,
  Boxes,
} from 'lucide-react';
import { DepartmentStockView } from '@/components/DepartmentStockView';
import {
  downloadProductionSheetHtml,
  printProductionSheet,
} from '@/lib/download-production-sheet';
import {
  downloadChallanHtml,
  printChallan,
} from '@/lib/download-challan';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';
import { DocumentActionButtons } from '@/components/common/DocumentActionButtons';
import { ChallanNumberField, newSubmissionKey } from '@/components/challan/ChallanNumberField';
import { DyeingInstructions } from '@/components/dyeing/DyeingInstructions';
import { TransferDocuments } from '@/components/common/TransferDocuments';
import {
  ColorFabricMeasurementTable,
  ChallanItemData,
  createBlankChallanItem,
  DepartmentInOutTracking,
} from '@/components/ColorFabricMeasurementTable';

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
    items?: any[];
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

  // Navigation Tabs: 'incoming' | 'create-challan' | 'stock' | 'defective-shelf'
  const [activeTab, setActiveTab] = useState<'incoming' | 'create-challan' | 'stock' | 'defective-shelf'>(initialTab);

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
  const [challanNumberError, setChallanNumberError] = useState<string | null>(null);
  const [submissionKey, setSubmissionKey] = useState(newSubmissionKey);
  const [challanDate, setChallanDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [sourceDept] = useState('Dyeing Department');
  const [destDept] = useState('QC1');
  const [priority, setPriority] = useState('NORMAL');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [designNumber, setDesignNumber] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  
  // Reusable Color / Fabric / Measurement table items (Blank by default)
  const [items, setItems] = useState<ChallanItemData[]>(() => [createBlankChallanItem('DYEING_QC1')]);

  // In / Out Tracking across departments
  const [dyeingTracking, setDyeingTracking] = useState<DepartmentInOutTracking>({
    fabricIn: 0,
    fabricOut: 0,
    fabricUnit: 'MTR',
    defectivePieces: 0,
    defectiveShelfLocation: 'DEF-SHELF-DYEING (Dyeing Station Defective Shelf)',
    defectReason: 'Shade Variation / Uneven Dyeing',
    detectedFromDept: 'STORE',
    detectedFromChallanId: null,
    detectedFromChallanNumber: null,
  });
  const [dyeingDefects, setDyeingDefects] = useState<any[]>([]);

  const [dyeingInchargeName, setDyeingInchargeName] = useState('Dyeing Incharge');
  const [dyeingInchargeContact, setDyeingInchargeContact] = useState('');

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
  const [receivingOrderId, setReceivingOrderId] = useState<string | null>(null);
  const [receiveSuccessMsg, setReceiveSuccessMsg] = useState<string | null>(null);

  // Receive Inbound Material at Dyeing Department
  const handleReceiveInboundMaterial = async (order: DyeingOrder) => {
    const challanId = order.inboundChallanId || order.inboundChallan?.id;
    if (!challanId) {
      alert('Inbound Challan ID not found for this dyeing order.');
      return;
    }
    try {
      setReceivingOrderId(order.id);
      const res = await fetch(`/api/challans/${challanId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'RECEIVED',
          notes: `Material accepted at Dyeing department from Fabric Store. Floor stock updated.`,
          fabricIn: order.requiredQuantity,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to receive inbound material');
      }
      setReceiveSuccessMsg(`Material for ${order.orderNumber} received successfully! Dyeing floor stock updated.`);
      setTimeout(() => setReceiveSuccessMsg(null), 4500);
      await fetchOrders();
    } catch (err: any) {
      alert(err.message || 'Error receiving material');
    } finally {
      setReceivingOrderId(null);
    }
  };

  // Each new challan starts with a blank number typed by the Dyeing incharge.
  const resetChallanNumber = () => {
    setChallanNumber('');
    setChallanNumberError(null);
    setSubmissionKey(newSubmissionKey());
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

      // Fetch Dyeing Defective Shelf Records
      const defRes = await fetch('/api/defective-shelves?department=DYEING');
      const defJson = await defRes.json();
      if (defJson.success && defJson.data?.challans) {
        setDyeingDefects(defJson.data.challans);
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
    resetChallanNumber();
  }, [statusFilter, priorityFilter]);

  // Synchronize form reference fields when an order / production sheet is selected
  // All business entry fields remain blank as per Master Prompt rules
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

    const inQty = Number(order.dyedQuantity || order.requiredQuantity || 0);
    setDyeingTracking((prev) => ({
      ...prev,
      fabricIn: inQty,
      fabricOut: Math.max(0, inQty - prev.defectivePieces),
      fabricUnit: order.uom === 'PCS' ? 'PCS' : 'MTR',
      detectedFromDept: 'STORE',
      detectedFromChallanId: order.inboundChallanId || null,
    }));
  };

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  // Switch to Create Challan tab with a specific order pre-loaded
  const handleStartCreateChallan = (order: DyeingOrder) => {
    selectOrderForForm(order);
    resetChallanNumber();
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
      setChallanNumberError('Challan Number is required.');
      setFormError('Enter the Challan Number.');
      return;
    }
    setChallanNumberError(null);

    // Validate ColorFabricMeasurementTable items
    const validItems = items.filter(
      (it) => it.fabric.trim() || it.color.trim() || parseFloat(String(it.measurement)) > 0
    );

    if (validItems.length === 0) {
      setFormError('Please enter at least one item in the Color / Fabric / Measurement table.');
      return;
    }
    if (new Set(validItems.map((item) => item.unit)).size > 1) {
      setFormError('Use the same unit for every quantity in one challan.');
      return;
    }

    try {
      setSubmittingChallan(true);
      setFormError('');

      const inchargeInfo = [
        dyeingInchargeName ? `Dyeing Incharge: ${dyeingInchargeName}` : null,
        dyeingInchargeContact ? `Contact: ${dyeingInchargeContact}` : null,
        designNumber ? `Design #: ${designNumber}` : null,
      ]
        .filter(Boolean)
        .join(' · ');

      const challanItems = validItems.map((item) => ({
        itemDescription: `${item.fabric || selectedOrder.fabricName || 'Fabric'} — ${item.actualDyedColor || item.color || 'Dyed'}`,
        unitType: 'ROLL',
        quantity: parseFloat(String(item.measurement)) || 1,
        uom: item.unit || selectedOrder.uom || 'MTR',
        fabricCode: item.fabric || selectedOrder.fabricName || 'FABRIC',
        colour: item.color || null,
        requiredDyeColor: item.requiredDyeColor || null,
        actualDyedColor: item.actualDyedColor || null,
        rollNumber: item.rollNumber || null,
        remarks: item.remarks || null,
      }));

      const payload = {
        idempotencyKey: submissionKey,
        challanNumber: challanNumber.trim(),
        challanType: 'DYEING_TO_QC1',
        programId: selectedOrder.programId,
        parentChallanId: selectedOrder.inboundChallanId || dyeingTracking.detectedFromChallanId || null,
        fromDepartment: 'DYEING',
        toDepartment: 'QC1',
        priority: priority || 'NORMAL',
        issuedDate: challanDate,
        fabricIn: dyeingTracking.fabricIn,
        defectivePieces: dyeingTracking.defectivePieces,
        defectiveShelfLocation: dyeingTracking.defectiveShelfLocation,
        defectReason: dyeingTracking.defectReason,
        fabricOut: dyeingTracking.fabricOut,
        fabricUnit: validItems[0]?.unit || dyeingTracking.fabricUnit,
        detectedFromDepartment: dyeingTracking.detectedFromDept || 'STORE',
        detectedFromChallanId: dyeingTracking.detectedFromChallanId,
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
        if (data.field === 'challanNumber') setChallanNumberError(data.error);
        throw new Error(data.error || 'Failed to dispatch Challan to QC1');
      }

      setCreatedChallanSuccess({
        ...data,
        order: selectedOrder,
        dyeingInchargeName,
        dyeingInchargeContact,
        tableItems: validItems,
      });
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      // Refresh orders list
      fetchOrders();
    } catch (err: any) {
      setFormError(err.message || 'Error dispatching challan to QC1');
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      setSubmittingChallan(false);
    }
  };

  // Open Update Progress Modal
  const openUpdateModal = (order: DyeingOrder) => {
    setSelectedOrderForUpdate(order);
    setUpdateForm({
      dyedQuantity: order.dyedQuantity,
      dyedColor: order.dyedColor || '',
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
    <div className="min-h-screen bg-neutral-50 pb-24">
      {/* TOP HEADER */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-30 px-4 sm:px-8 py-3.5 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700">
                DYEING DEPARTMENT
              </span>
              <span className="text-neutral-700">/</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                MY WORK
              </span>
            </div>
            <h1 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
              <Droplet className="w-5 h-5 text-brand-600" />
              <span>Dyeing Department Operational Workspace</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchOrders();
                resetChallanNumber();
              }}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-semibold transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <Link
              href="/dyeing"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-900 border border-brand-200 rounded-lg text-xs font-bold transition"
            >
              <Layers className="w-3.5 h-3.5 text-brand-700" />
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
        <div className="flex items-center gap-2 border-b border-neutral-200 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('incoming')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'incoming'
                ? 'bg-brand-700 text-white shadow-xs'
                : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Incoming Challans ({orders.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('create-challan');
              resetChallanNumber();
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'create-challan'
                ? 'bg-brand-700 text-white shadow-xs'
                : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>Create challan to QC1 (Quality Check 1)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('stock')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'stock'
                ? 'bg-brand-700 text-white shadow-xs'
                : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Dyeing Stock &amp; Balance</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('defective-shelf')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'defective-shelf'
                ? 'bg-danger-700 text-white shadow-xs'
                : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-danger-600" />
            <span>Defective Shelf (DEF-SHELF-DYEING) ({dyeingDefects.length})</span>
          </button>
        </div>

        {error && (
          <div className="p-3.5 bg-danger-50 border border-danger-200 rounded-xl flex items-center gap-3 text-danger-900 text-xs">
            <AlertCircle className="w-4 h-4 text-danger-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 1: INCOMING CHALLANS (RECEIVED FROM FABRIC STORE)           */}
        {/* ============================================================== */}
        {activeTab === 'incoming' && (
          <div className="space-y-4">
            {receiveSuccessMsg && (
              <div className="p-3.5 bg-accent-50 border border-accent-300 rounded-xl flex items-center gap-3 text-accent-800 text-xs font-semibold shadow-xs animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-accent-700 shrink-0" />
                <span>{receiveSuccessMsg}</span>
              </div>
            )}

            {/* SEARCH & FILTERS */}
            <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by Serial #, Program #, Fabric, Color, Client..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-neutral-300 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="flex items-center gap-1.5 bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5">
                  <Filter className="w-3.5 h-3.5 text-neutral-500" />
                  <span className="text-[11px] font-bold text-neutral-500">Status:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-neutral-900 focus:outline-hidden cursor-pointer"
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

                <div className="flex items-center gap-1.5 bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5">
                  <span className="text-[11px] font-bold text-neutral-500">Priority:</span>
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-neutral-900 focus:outline-hidden cursor-pointer"
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
            <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden">
              <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-brand-700" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900">
                    Incoming Fabric Store Challans &middot; Real Shop Floor Lots ({orders.length})
                  </h3>
                </div>
                <span className="text-[11px] text-neutral-500 font-mono">
                  From Fabric Store → Dyeing
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-100/80 text-neutral-700 font-bold border-b border-neutral-200 uppercase tracking-wider text-[10px]">
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
                  <tbody className="divide-y divide-neutral-100">
                    {loading && orders.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-neutral-500 font-mono animate-pulse">
                          Reading production records from database...
                        </td>
                      </tr>
                    ) : orders.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-16 text-center">
                          <div className="max-w-md mx-auto space-y-2">
                            <FileText className="w-10 h-10 text-neutral-700 mx-auto" />
                            <h4 className="text-sm font-bold text-neutral-900">No Inward Challans Found</h4>
                            <p className="text-xs text-neutral-500">
                              Issue a challan from Fabric Store to Dyeing to receive lots here.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      orders.flatMap((order) => [
                        <tr key={order.id} className="hover:bg-neutral-50/80 transition group">
                          {/* SHEET & CHALLAN */}
                          <td className="py-3.5 px-4">
                            <div className="font-mono font-bold text-neutral-900 flex items-center gap-1.5">
                              <span>{order.program?.programSerialNo || order.orderNumber}</span>
                              {order.priority === 'HIGH' && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-danger-100 text-danger-800">
                                  HIGH
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-neutral-500 font-mono">
                              Prog: {order.program?.programNumber || '—'}
                            </div>
                            {order.inboundChallan && (
                              <div className="text-[10px] text-brand-700 font-mono flex items-center gap-1 mt-0.5">
                                <span>Ch: {order.inboundChallan.challanNumber}</span>
                              </div>
                            )}
                          </td>

                          {/* CLIENT & STYLE */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-neutral-900 truncate max-w-[140px]">
                              {order.program?.clientName || order.program?.buyerName || 'Standard Client'}
                            </div>
                            <div className="text-[10px] text-neutral-500 truncate max-w-[140px]">
                              {order.program?.mainStyle || order.program?.styleCode || '—'}
                            </div>
                          </td>

                          {/* FABRIC */}
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-neutral-900">{order.fabricName}</div>
                            {order.fabricType && (
                              <div className="text-[10px] text-neutral-500">{order.fabricType}</div>
                            )}
                          </td>

                          {/* COLOR */}
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-neutral-900">{order.targetColor}</div>
                            {order.dyedColor && (
                              <div className="text-[10px] text-brand-700 font-semibold">Dyed: {order.dyedColor}</div>
                            )}
                          </td>

                          {/* REQUIRED */}
                          <td className="py-3.5 px-4 text-right font-mono font-semibold text-neutral-900">
                            {order.requiredQuantity} {order.uom}
                          </td>

                          {/* DYED */}
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-brand-800">
                            {order.dyedQuantity} {order.uom}
                          </td>

                          {/* UNDYED */}
                          <td className="py-3.5 px-4 text-right font-mono text-accent-800 font-semibold">
                            {order.undyedQuantity} {order.uom}
                          </td>

                          {/* STATUS */}
                          <td className="py-3.5 px-4 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              order.status === 'RECEIVED'
                                ? 'bg-brand-100 text-brand-800'
                                : order.status === 'IN_DYEING'
                                ? 'bg-brand-100 text-brand-800'
                                : order.status === 'DYED'
                                ? 'bg-brand-100 text-brand-800'
                                : 'bg-accent-100 text-accent-800'
                            }`}>
                              {order.status}
                            </span>
                          </td>

                          {/* ACTIONS */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {/* RECEIVE INBOUND MATERIAL (IF ISSUED OR AWAITING RECEIPT) */}
                              {order.inboundChallan?.id && order.inboundChallan?.status !== 'RECEIVED' && (
                                <button
                                  type="button"
                                  disabled={receivingOrderId === order.id}
                                  onClick={() => handleReceiveInboundMaterial(order)}
                                  title="Receive Material into Dyeing Floor Stock"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-accent-400 hover:bg-accent-500 text-neutral-900 rounded text-xs font-bold transition shadow-xs cursor-pointer"
                                >
                                  {receivingOrderId === order.id ? (
                                    <>
                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                      <span>Receiving...</span>
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>Receive</span>
                                    </>
                                  )}
                                </button>
                              )}

                              {/* DOCUMENTS OF THE RECEIVED CHALLAN: PRODUCTION SHEET, CHALLAN & WILCOM */}
                              {order.inboundChallanId || order.inboundChallan?.id ? (
                                <TransferDocuments challanId={order.inboundChallanId || order.inboundChallan?.id} size="xs" />
                              ) : (
                                <DocumentActionButtons program={order.program} size="xs" />
                              )}

                              {/* RECORD DYEING PROGRESS */}
                              <button
                                type="button"
                                onClick={() => openUpdateModal(order)}
                                title="Record Dyeing Progress & Quantities"
                                className="p-1.5 text-brand-600 hover:text-brand-900 hover:bg-brand-50 rounded-md transition cursor-pointer"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>

                              {/* ISSUE TO QC1 */}
                              <button
                                type="button"
                                onClick={() => handleStartCreateChallan(order)}
                                title="Create Challan to QC1 (Quality Check 1)"
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-700 hover:bg-brand-800 text-white rounded text-xs font-bold transition shadow-2xs cursor-pointer"
                              >
                                <Send className="w-3 h-3" />
                                <span>To QC1</span>
                              </button>
                            </div>
                          </td>
                        </tr>,
                        <tr key={`${order.id}-instructions`} className="bg-neutral-50/60">
                          <td colSpan={9} className="px-4 pb-3 pt-0">
                            <DyeingInstructions
                              challan={order.inboundChallan}
                              program={order.program}
                              dyedColor={order.dyedColor}
                            />
                          </td>
                        </tr>,
                      ])
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
              <div className="p-3.5 bg-danger-50 border border-danger-200 rounded-xl text-xs text-danger-800 flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-danger-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* SUCCESS CONFIRMATION IF DISPATCHED */}
            {createdChallanSuccess ? (
              <div className="bg-white border border-accent-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-accent-100 text-accent-800 rounded-xl flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-700 block">
                      CHALLAN DISPATCHED TO DYEING QC
                    </span>
                    <h2 className="text-xl font-bold text-neutral-900 mt-0.5">
                      Challan {createdChallanSuccess.challanNumber} Dispatched to Dyeing QC
                    </h2>
                    <p className="text-xs text-neutral-600 mt-1">
                      Material and master traveler sheet have been routed to the Dyeing QC inspection workstation.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 p-4 bg-neutral-50 border border-neutral-200 rounded-xl text-xs">
                  <div>
                    <span className="text-neutral-500 block text-[10px] uppercase font-semibold">Challan Number</span>
                    <strong className="font-mono text-neutral-900 text-sm">{createdChallanSuccess.challanNumber}</strong>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[10px] uppercase font-semibold">Destination</span>
                    <strong className="text-neutral-900">QC1 (Quality Check 1)</strong>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[10px] uppercase font-semibold">State</span>
                    <span className="font-bold text-brand-800">{createdChallanSuccess.dyedOrUndyed}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[10px] uppercase font-semibold">Quantity</span>
                    <strong className="font-mono text-neutral-900 text-sm">{createdChallanSuccess.qty} {createdChallanSuccess.tableItems?.[0]?.unit || 'MTR'}</strong>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-neutral-100">
                  <Link
                    href={`/challans/${createdChallanSuccess.id}`}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-700 hover:bg-brand-800 text-white text-xs font-bold rounded-lg shadow-xs transition"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>View &amp; Print Slip</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => printProductionSheet(createdChallanSuccess.order?.program)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 text-xs font-semibold rounded-lg transition"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Production Sheet</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadProductionSheetHtml(createdChallanSuccess.order?.program)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download HTML</span>
                  </button>
                  <Link
                    href="/qc1/my-work"
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-accent-50 hover:bg-accent-100 border border-accent-300 text-accent-800 text-xs font-bold rounded-lg transition"
                  >
                    <Eye className="w-3.5 h-3.5 text-accent-800" />
                    <span>View in QC1 Worklist →</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setCreatedChallanSuccess(null);
                      resetChallanNumber();
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white text-xs font-bold rounded-lg shadow-xs transition ml-auto"
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
                className="bg-white border border-neutral-200/90 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6"
              >
                {/* FORM TITLE & "Show production sheet" BUTTON */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 pb-4">
                  <div>
                    <h2 className="text-xl font-bold font-serif text-neutral-900">
                      Dyeing Dept &rarr; QC1
                    </h2>
                    <span className="text-xs text-neutral-500">
                      Dispatch processed fabric lot from Dyeing to Quality Check 1
                    </span>
                  </div>

                  {selectedOrder?.program ? (
                    <button
                      type="button"
                      onClick={() => setSelectedOrderForSheet(selectedOrder)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-xl text-xs font-bold shadow-xs transition"
                      title="Show Production Sheet (view, print and downloadable)"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Show production sheet</span>
                    </button>
                  ) : (
                    <span className="text-xs text-neutral-500 italic">
                      Select Serial Number to view Production Sheet
                    </span>
                  )}
                </div>

                {/* FORM FIELDS - LINE BY LINE (NO NUMBERING, NO PLACEHOLDER EXAMPLES) */}
                <div className="space-y-4">
                  {/* 1. CHALLAN NUMBER */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                    <label className="text-xs font-bold text-neutral-700 sm:text-right sm:pr-4">
                      Challan Number <span className="text-danger-600">*</span>
                    </label>
                    <div className="sm:col-span-2 max-w-lg">
                      <ChallanNumberField
                        label="Challan Number"
                        hideLabel
                        value={challanNumber}
                        onChange={(value) => {
                          setChallanNumber(value);
                          setChallanNumberError(null);
                        }}
                        error={challanNumberError}
                      />
                    </div>
                  </div>

                  {/* 2. CHALLAN DATE */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                    <label className="text-xs font-bold text-neutral-700 sm:text-right sm:pr-4">
                      Challan Date <span className="text-danger-600">*</span>
                    </label>
                    <div className="sm:col-span-2 max-w-lg">
                      <input
                        type="date"
                        value={challanDate}
                        onChange={(e) => setChallanDate(e.target.value)}
                        required
                        className="w-full text-xs border border-neutral-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                      />
                    </div>
                  </div>

                  {/* 3. SOURCE - (Dyeing dept) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                    <label className="text-xs font-bold text-neutral-700 sm:text-right sm:pr-4">
                      Source - (Dyeing dept)
                    </label>
                    <div className="sm:col-span-2 max-w-lg">
                      <div className="w-full text-xs font-semibold text-neutral-900 border border-neutral-200 rounded-lg px-3 py-2 bg-neutral-100 flex items-center justify-between">
                        <span>{sourceDept}</span>
                        <span className="text-[10px] font-bold text-brand-800 bg-brand-100 px-2 py-0.5 rounded uppercase">
                          DYEING
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 4. DESTINATION (QC1) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                    <label className="text-xs font-bold text-neutral-700 sm:text-right sm:pr-4">
                      Destination (QC1)
                    </label>
                    <div className="sm:col-span-2 max-w-lg">
                      <div className="w-full text-xs font-semibold text-neutral-900 border border-neutral-200 rounded-lg px-3 py-2 bg-neutral-100 flex items-center justify-between">
                        <span>{destDept} (Quality Check 1)</span>
                        <span className="text-[10px] font-bold text-accent-800 bg-accent-100 px-2 py-0.5 rounded uppercase">
                          QC1
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 5. PRIORITY */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                    <label className="text-xs font-bold text-neutral-700 sm:text-right sm:pr-4">
                      Priority
                    </label>
                    <div className="sm:col-span-2 max-w-lg">
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                        className="w-full text-xs font-semibold border border-neutral-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-transparent transition cursor-pointer"
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
                    <label className="text-xs font-bold text-neutral-700 sm:text-right sm:pr-4">
                      Delivery date
                    </label>
                    <div className="sm:col-span-2 max-w-lg">
                      <input
                        type="date"
                        value={deliveryDate}
                        onChange={(e) => setDeliveryDate(e.target.value)}
                        className="w-full text-xs border border-neutral-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                      />
                    </div>
                  </div>

                  {/* 7. DESIGN NUMBER */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                    <label className="text-xs font-bold text-neutral-700 sm:text-right sm:pr-4">
                      Design Number
                    </label>
                    <div className="sm:col-span-2 max-w-lg">
                      <input
                        type="text"
                        value={designNumber}
                        onChange={(e) => setDesignNumber(e.target.value)}
                        className="w-full text-xs font-mono font-medium text-neutral-900 border border-neutral-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                      />
                    </div>
                  </div>

                  {/* 8. SERIAL NUMBER (Selection of Inward Production Sheet) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                    <label className="text-xs font-bold text-neutral-700 sm:text-right sm:pr-4">
                      Serial Number <span className="text-danger-600">*</span>
                    </label>
                    <div className="sm:col-span-2 max-w-lg">
                      <select
                        value={selectedOrderId}
                        onChange={(e) => {
                          const ord = orders.find((o) => o.id === e.target.value);
                          if (ord) selectOrderForForm(ord);
                        }}
                        required
                        className="w-full text-xs font-mono font-bold text-neutral-900 border border-neutral-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-transparent transition cursor-pointer"
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

                  {/* 9. COLOR / FABRIC / MEASUREMENT (Universal Item Component with In/Cut/Out Tracking) */}
                  <div className="pt-3 border-t border-neutral-200">
                    <ColorFabricMeasurementTable
                      items={items}
                      onChange={setItems}
                      context="DYEING_QC1"
                      programId={selectedOrder?.programId}
                      currentDepartment="DYEING"
                      tracking={dyeingTracking}
                      onTrackingChange={setDyeingTracking}
                      showInOutController={true}
                    />
                  </div>

                  {/* 12. DYEING INCHARGE (Name / Contact) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 pt-2 border-t border-neutral-100">
                    <label className="text-xs font-bold text-neutral-700 sm:text-right sm:pr-4">
                      Dyeing Incharge (Name / Contact)
                    </label>
                    <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg">
                      <input
                        type="text"
                        value={dyeingInchargeName}
                        onChange={(e) => setDyeingInchargeName(e.target.value)}
                        placeholder=""
                        className="w-full text-xs font-medium border border-neutral-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                      />
                      <input
                        type="text"
                        value={dyeingInchargeContact}
                        onChange={(e) => setDyeingInchargeContact(e.target.value)}
                        placeholder=""
                        className="w-full text-xs font-mono border border-neutral-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                      />
                    </div>
                  </div>
                </div>

                {/* SUBMIT BUTTON */}
                <div className="pt-4 border-t border-neutral-200 flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={submittingChallan}
                    className="inline-flex items-center gap-2 px-7 py-3 bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
                  >
                    {submittingChallan ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-brand-800" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>{submittingChallan ? 'Dispatching to QC1...' : 'Submit Challan to QC1'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: DYEING DEFECTIVE SHELF (DEF-SHELF-DYEING)               */}
        {/* ============================================================== */}
        {activeTab === 'defective-shelf' && (
          <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-neutral-200 gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-danger-600 block">
                  DEPARTMENT ISOLATION SHELF
                </span>
                <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                  <Archive className="w-5 h-5 text-danger-600" />
                  <span>Dyeing Defective Shelf (DEF-SHELF-DYEING)</span>
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Segregated rolls, cuts, and patches rejected during dyeing. Automatically recorded in the Fabric Store Master Defective Shelf (DEF-SHELF-CENTRAL).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500 font-mono">
                  Shelf Code: <strong className="text-danger-700 bg-danger-50 px-2.5 py-1 rounded border border-danger-200">DEF-SHELF-DYEING</strong>
                </span>
              </div>
            </div>

            {/* STAT CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-danger-50/70 border border-danger-200 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-danger-800">
                  Total Dyeing Defective Cut
                </span>
                <div className="text-2xl font-mono font-bold text-danger-900">
                  {dyeingDefects.reduce((acc, c) => acc + (Number(c.defectivePieces) || 0), 0)} MTR / PCS
                </div>
                <span className="text-[10px] text-danger-600">
                  Quarantined from QC1 handover
                </span>
              </div>

              <div className="p-4 bg-brand-50/70 border border-brand-200 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-800">
                  Fabric Store Master Sync
                </span>
                <div className="text-base font-bold text-brand-900 flex items-center gap-1.5 mt-1">
                  <CheckCircle2 className="w-4 h-4 text-accent-700" />
                  <span>Auto-Synced with Central Store</span>
                </div>
                <span className="text-[10px] text-brand-700">
                  Visible in Fabric Store DEF-SHELF-CENTRAL
                </span>
              </div>

              <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                  Logged Incidents
                </span>
                <div className="text-2xl font-mono font-bold text-neutral-900">
                  {dyeingDefects.length} Incidents
                </div>
                <span className="text-[10px] text-neutral-500">
                  Audited zero-loss accounting
                </span>
              </div>
            </div>

            {/* DEFECT LIST TABLE */}
            {dyeingDefects.length === 0 ? (
              <div className="p-16 text-center space-y-3 border border-dashed border-neutral-200 rounded-xl">
                <CheckCircle2 className="w-12 h-12 text-accent-700 mx-auto" />
                <p className="text-sm font-semibold text-neutral-900">Dyeing Defective Shelf is Clean</p>
                <p className="text-xs text-neutral-500 max-w-md mx-auto">
                  No defective fabric cuts or dyeing rejections are currently logged on DEF-SHELF-DYEING.
                </p>
              </div>
            ) : (
              <div className="border border-neutral-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 text-neutral-600 font-semibold border-b border-neutral-200 uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Challan #</th>
                      <th className="py-2.5 px-3">Sheet / Style</th>
                      <th className="py-2.5 px-3 text-center">Defective Volume</th>
                      <th className="py-2.5 px-3">Station Defective Shelf</th>
                      <th className="py-2.5 px-3">Defect Reason</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3 text-right">Audit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {dyeingDefects.map((ch) => (
                      <tr key={ch.id} className="hover:bg-danger-50/30 transition">
                        <td className="py-3 px-3 font-mono font-bold text-neutral-900">
                          {ch.challanNumber}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-semibold text-neutral-900 block">
                            {ch.program?.mainStyle || ch.program?.clientName || 'General Style'}
                          </span>
                          <span className="text-[10px] font-mono text-brand-700">
                            Sheet: {ch.program?.programSerialNo || ch.program?.programNumber || '—'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-danger-700 text-sm">
                          {ch.defectivePieces || 0} {ch.fabricUnit || 'MTR'}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-danger-100 text-danger-800 border border-danger-200">
                            {ch.defectiveShelfLocation || 'DEF-SHELF-DYEING'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-neutral-700 max-w-xs">
                          <div className="font-semibold text-[11px]">{ch.defectReason || 'Shade Variation'}</div>
                          <p className="truncate text-[10px] text-neutral-500">{ch.remarks || '—'}</p>
                        </td>
                        <td className="py-3 px-3 text-neutral-600 font-mono text-[11px]">
                          {new Date(ch.createdAt).toLocaleDateString('en-GB')}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <DocumentActionButtons program={ch.program} challan={ch} size="xs" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: DYEING DEPARTMENT STOCK VIEW                            */}
        {/* ============================================================== */}
        {activeTab === 'stock' && (
          <DepartmentStockView
            department="DYEING"
            createChallanUrl="/dyeing/my-work?tab=create-challan"
          />
        )}

        {/* ============================================================== */}
        {/* MODAL 1: VIEW PRODUCTION SHEET (VIEW, PRINT, DOWNLOADABLE)     */}
        {/* ============================================================== */}
        <ProductionSheetPrintModal
          program={selectedOrderForSheet?.program}
          isOpen={!!selectedOrderForSheet}
          onClose={() => setSelectedOrderForSheet(null)}
        />

        {/* ============================================================== */}
        {/* MODAL 2: UPDATE DYEING PROGRESS                                */}
        {/* ============================================================== */}
        {selectedOrderForUpdate && (
          <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-brand-600" />
                  <h3 className="text-sm font-bold text-neutral-900">
                    Record Dyeing Progress
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOrderForUpdate(null)}
                  className="p-1 text-neutral-500 hover:text-neutral-700 rounded-md"
                >
                  ✕
                </button>
              </div>

              {updateError && (
                <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-xs text-danger-800">
                  {updateError}
                </div>
              )}

              <form onSubmit={handleUpdateSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">
                    Dyed Quantity ({selectedOrderForUpdate.uom})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={updateForm.dyedQuantity}
                    onChange={(e) => setUpdateForm({ ...updateForm, dyedQuantity: parseFloat(e.target.value) || 0 })}
                    className="w-full font-mono text-xs border border-neutral-300 rounded-lg px-3 py-2 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-neutral-700 mb-1">
                    Actual Dyed Shade
                  </label>
                  <input
                    type="text"
                    placeholder={`Required: ${selectedOrderForUpdate.targetColor}`}
                    value={updateForm.dyedColor}
                    onChange={(e) => setUpdateForm({ ...updateForm, dyedColor: e.target.value })}
                    className="w-full text-xs border border-neutral-300 rounded-lg px-3 py-2 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-neutral-700 mb-1">
                    Color Code
                  </label>
                  <input
                    type="text"
                    value={updateForm.colorCode}
                    onChange={(e) => setUpdateForm({ ...updateForm, colorCode: e.target.value })}
                    className="w-full font-mono text-xs border border-neutral-300 rounded-lg px-3 py-2 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-neutral-700 mb-1">
                    Status
                  </label>
                  <select
                    value={updateForm.status}
                    onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}
                    className="w-full text-xs border border-neutral-300 rounded-lg px-3 py-2 bg-white font-semibold"
                  >
                    <option value="IN_DYEING">IN_DYEING</option>
                    <option value="PARTIALLY_DYED">PARTIALLY_DYED</option>
                    <option value="DYED">DYED</option>
                    <option value="READY_FOR_QC1">READY_FOR_QC1</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-neutral-700 mb-1">
                    Machine Number
                  </label>
                  <input
                    type="text"
                    value={updateForm.machineNumber}
                    onChange={(e) => setUpdateForm({ ...updateForm, machineNumber: e.target.value })}
                    className="w-full text-xs border border-neutral-300 rounded-lg px-3 py-2 bg-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={() => setSelectedOrderForUpdate(null)}
                    className="px-3 py-1.5 border border-neutral-300 rounded-lg text-xs font-semibold hover:bg-neutral-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updating}
                    className="px-4 py-1.5 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-xs font-bold transition"
                  >
                    {updating ? 'Saving...' : 'Save Progress'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {selectedOrderForSheet?.program && (
          <ProductionSheetPrintModal
            program={selectedOrderForSheet.program}
            isOpen={Boolean(selectedOrderForSheet)}
            onClose={() => setSelectedOrderForSheet(null)}
          />
        )}
      </main>
    </div>
  );
}
