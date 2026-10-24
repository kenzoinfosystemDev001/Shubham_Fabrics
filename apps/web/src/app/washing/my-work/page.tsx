'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Waves,
  Search,
  Filter,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Layers,
  Calendar,
  User,
  X,
  Printer,
  Download,
  Barcode,
  Thermometer,
  Wind,
  PackageCheck,
  Archive,
  TrendingDown,
  Kanban,
  FileText
} from 'lucide-react';
import { DocumentActionButtons } from '@/components/common/DocumentActionButtons';
import { TransferDocuments } from '@/components/common/TransferDocuments';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';
import { downloadProductionSheetHtml, printProductionSheet } from '@/lib/download-production-sheet';
import BarcodeStickerCard from '@/components/BarcodeStickerCard';
import { ChallanNumberField, newSubmissionKey } from '@/components/challan/ChallanNumberField';

interface WashingChallan {
  id: string;
  challanNumber: string;
  challanType: string;
  fromDepartment: string;
  toDepartment: string;
  status: string;
  priority: string;
  issuedDate: string | null;
  receivedDate: string | null;
  programId: string;
  fabricIn: number | null;
  fabricOut: number | null;
  fabricUnit: string | null;
  defectivePieces: number | null;
  defectiveShelfLocation: string | null;
  defectReason: string | null;
  remarks?: string | null;
  program?: {
    id: string;
    programNumber: string;
    programSerialNo?: string;
    clientName: string;
    buyerName?: string;
    styleCode: string;
    mainStyle?: string;
    fabricName?: string;
    fabricType?: string;
    fabricColor?: string;
    targetQuantity?: number;
    deliveryDate?: string;
    priority?: string;
    quantityMeasurement?: string;
    wilcomDesignNumber?: string;
  };
  items: Array<{
    id: string;
    itemDescription: string;
    fabricCode?: string;
    colour?: string;
    shade?: string;
    size?: string;
    quantity: number;
    uom: string;
    barcode?: string;
    remarks?: string;
  }>;
  productionLogs?: Array<{
    id: string;
    operationName: string;
    machineId?: string;
    inputQuantity: number;
    goodQuantity: number;
    rejectQuantity: number;
    notes?: string;
    recordedAt: string;
  }>;
}

export default function WashingWorkCenter() {
  const searchParams = useSearchParams();
  const highlightChallanId = searchParams.get('challanId');

  // Navigation Tabs: WASH_TERMINAL, ISSUE_HANDOVER, DEFECTED_SHELF, PRODUCTION_SHEETS
  const [activeTab, setActiveTab] = useState<'WASH_TERMINAL' | 'ISSUE_HANDOVER' | 'DEFECTED_SHELF' | 'PRODUCTION_SHEETS'>(
    'WASH_TERMINAL'
  );

  const [challans, setChallans] = useState<WashingChallan[]>([]);
  const [dispatchedChallans, setDispatchedChallans] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [toastMessage, setToastHandover] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals State
  const [selectedChallanForWash, setSelectedChallanForWash] = useState<WashingChallan | null>(null);
  const [selectedChallanForView, setSelectedChallanForView] = useState<WashingChallan | null>(null);
  const [selectedSheetForView, setSelectedSheetForView] = useState<any | null>(null);
  const [handoverChallanModal, setHandoverChallanModal] = useState<any | null>(null);
  // Handover to QC Washing waits for the challan number typed by the Washing incharge.
  const [handoverDraft, setHandoverDraft] = useState<{
    challan: WashingChallan;
    challanNumber: string;
    error: string | null;
    submissionKey: string;
    submitting: boolean;
  } | null>(null);
  const [submittingWash, setSubmittingWash] = useState(false);

  // Washing Processing Terminal Form State (All Mandatory Fields)
  const [washForm, setWashForm] = useState({
    pieceIn: '',
    pieceOut: '',
    washingBarcode: '',
    washRecipe: 'BIO_POLISH_SOFT_WASH',
    machineId: 'WASH-DRUM-01',
    waterTemp: '40°C Warm',
    durationMinutes: '45',
    liquorRatio: '1:8',
    dryingMethod: 'Tumble Dry (60°C)',
    defectivePieces: '0',
    defectReason: '',
    handFeelRemarks: 'Soft hand-feel verified, zero fabric pills, color fast',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/washing/dashboard');
      if (!res.ok) {
        throw new Error('Failed to load Washing data');
      }
      const json = await res.json();
      const list = json.data?.incomingChallans || [];
      setChallans(list);
      setDispatchedChallans(json.data?.dispatchedChallans || []);
      setTransactions(json.data?.washingTransactions || []);

      if (highlightChallanId) {
        const match = list.find((c: WashingChallan) => c.id === highlightChallanId);
        if (match) {
          handleOpenWashModal(match);
        }
      }
    } catch (err: any) {
      console.error('Failed to load Washing work:', err);
      setError(err.message || 'Error connecting to server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('subham_mes_user');
      if (savedUser) {
        try {
          setCurrentUser(JSON.parse(savedUser));
        } catch {}
      }
    }
    loadData();
  }, [highlightChallanId]);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'PRODUCTION_SHEETS') {
      setActiveTab('PRODUCTION_SHEETS');
    } else if (tabParam === 'HANDOVER') {
      setActiveTab('ISSUE_HANDOVER');
    }
  }, [searchParams]);

  // Handle Receive Challan into Washing
  const handleReceiveChallan = async (challan: WashingChallan) => {
    try {
      const res = await fetch(`/api/washing/challans/${challan.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverId: currentUser?.id,
          notes: 'Received into Washing Department. Ready for Drum loading.',
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to receive challan');
      }

      setToastHandover(`Challan ${challan.challanNumber} received successfully at Washing!`);
      setTimeout(() => setToastHandover(null), 5000);
      loadData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  // Open Wash Processing Modal
  const handleOpenWashModal = async (challan: WashingChallan) => {
    if (challan.status === 'ISSUED') {
      await handleReceiveChallan(challan);
    }

    const defaultIn =
      challan.fabricIn ||
      challan.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);

    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const existingBarcode = challan.items?.[0]?.barcode || `WB-${year}-${randomSuffix}`;

    setSelectedChallanForWash(challan);
    setWashForm({
      pieceIn: String(defaultIn),
      pieceOut: String(defaultIn), // default assume 100% yield initially
      washingBarcode: existingBarcode,
      washRecipe: 'BIO_POLISH_SOFT_WASH',
      machineId: 'WASH-DRUM-01',
      waterTemp: '40°C Warm',
      durationMinutes: '45',
      liquorRatio: '1:8',
      dryingMethod: 'Tumble Dry (60°C)',
      defectivePieces: '0',
      defectReason: '',
      handFeelRemarks: 'Soft hand-feel verified, zero fabric pills, color fast',
    });
  };

  // Submit Wash Run
  const handleSubmitWashRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChallanForWash) return;

    const pIn = Number(washForm.pieceIn);
    const pOut = Number(washForm.pieceOut);
    const pDef = Number(washForm.defectivePieces || 0);

    if (isNaN(pIn) || pIn <= 0) {
      alert('Piece In must be a positive number greater than 0.');
      return;
    }
    if (isNaN(pOut) || pOut < 0) {
      alert('Piece Out must be 0 or greater.');
      return;
    }
    if (pOut > pIn) {
      alert(`Piece Out (${pOut}) cannot be greater than Piece In (${pIn}).`);
      return;
    }
    if (!washForm.washingBarcode.trim()) {
      alert('Washing Barcode is mandatory.');
      return;
    }
    if (!washForm.machineId.trim()) {
      alert('Machine/Drum ID is mandatory.');
      return;
    }

    try {
      setSubmittingWash(true);
      const res = await fetch('/api/washing/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challanId: selectedChallanForWash.id,
          pieceIn: pIn,
          pieceOut: pOut,
          washingBarcode: washForm.washingBarcode.trim(),
          washRecipe: washForm.washRecipe,
          machineId: washForm.machineId,
          waterTemp: washForm.waterTemp,
          durationMinutes: Number(washForm.durationMinutes) || 45,
          liquorRatio: washForm.liquorRatio,
          dryingMethod: washForm.dryingMethod,
          defectivePieces: pDef,
          defectReason: washForm.defectReason,
          handFeelRemarks: washForm.handFeelRemarks,
          operatorId: currentUser?.id,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to submit wash run');
      }

      setToastHandover(
        `Washing cycle completed! In=${pIn} PCS, Out=${pOut} PCS, Barcode=${washForm.washingBarcode}. Ready for Handover.`
      );
      setTimeout(() => setToastHandover(null), 6000);
      setSelectedChallanForWash(null);
      loadData();
    } catch (err: any) {
      console.error(err);
      alert('Error: ' + err.message);
    } finally {
      setSubmittingWash(false);
    }
  };

  // Issue Handover Challan to QC Washing: ask for the challan number first.
  const handleIssueToFinishing = (challan: WashingChallan) => {
    setHandoverDraft({ challan, challanNumber: '', error: null, submissionKey: newSubmissionKey(), submitting: false });
  };

  const confirmIssueToQcWashing = async () => {
    if (!handoverDraft) return;
    const { challan, submissionKey } = handoverDraft;
    const challanNumber = handoverDraft.challanNumber.trim();
    if (!challanNumber) {
      setHandoverDraft({ ...handoverDraft, error: 'Challan Number is required.' });
      return;
    }
    setHandoverDraft({ ...handoverDraft, error: null, submitting: true });
    try {
      const goodQty = challan.fabricOut ?? challan.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
      const barcode = challan.items?.[0]?.barcode || `WB-${new Date().getFullYear()}-0001`;

      const res = await fetch('/api/challans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: submissionKey,
          challanNumber,
          challanType: 'REGULAR',
          programId: challan.programId,
          fromDepartment: 'WASHING',
          toDepartment: 'QC3',
          fabricIn: challan.fabricIn ?? goodQty + (challan.defectivePieces || 0),
          fabricOut: goodQty,
          fabricUnit: challan.fabricUnit || 'PCS',
          defectivePieces: challan.defectivePieces || 0,
          defectiveShelfLocation: challan.defectiveShelfLocation,
          defectReason: challan.defectReason,
          detectedFromDepartment: challan.fromDepartment,
          detectedFromChallanId: challan.id,
          priority: challan.priority || 'NORMAL',
          remarks: `Washed pieces handover to QC Washing Department for inspection & verification. Barcode: ${barcode}`,
          items: [
            {
              itemDescription: `${challan.program?.fabricName || 'Garment Pieces'} - Washed & Dried`,
              fabricCode: 'PIECE',
              colour: challan.program?.fabricColor || 'Standard',
              quantity: goodQty,
              uom: 'PCS',
              barcode: barcode,
              remarks: `Washing completed. Ready for QC Washing inspection & verification.`,
            },
          ],
        }),
      });

      const data = await res.json();
      if (res.ok) {
        // Also update original challan status to COMPLETED
        await fetch(`/api/challans/${challan.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'COMPLETED' }),
        }).catch(() => {});

        setHandoverDraft(null);
        setHandoverChallanModal(data);
        setToastHandover(`Challan ${data.challanNumber} issued to QC Washing Department successfully!`);
        loadData();
      } else {
        setHandoverDraft((draft) => draft && { ...draft, submitting: false, error: data.error || 'Failed to issue challan to QC Washing' });
      }
    } catch (err: any) {
      setHandoverDraft((draft) => draft && { ...draft, submitting: false, error: err.message || 'Failed to issue challan to QC Washing' });
    }
  };

  // Filtered Challans
  const filteredChallans = useMemo(() => {
    return challans.filter((c) => {
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'PENDING' && ['ISSUED', 'RECEIVED'].includes(c.status)) ||
        (statusFilter === 'IN_PROCESS' && c.status === 'IN_PROCESS') ||
        (statusFilter === 'APPROVED' && (c.status === 'QC_APPROVED' || c.status === 'COMPLETED'));

      const matchesSearch =
        !searchTerm ||
        c.challanNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.program?.programNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.program?.programSerialNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.program?.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.program?.styleCode?.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesStatus && matchesSearch;
    });
  }, [challans, statusFilter, searchTerm]);

  // Unique Production Sheets List for Tab 4
  const productionProgramsList = useMemo(() => {
    const map = new Map<string, any>();
    for (const c of challans) {
      if (c.program && !map.has(c.program.id)) {
        map.set(c.program.id, c.program);
      }
    }
    return Array.from(map.values());
  }, [challans]);

  return (
    <div className="min-h-screen bg-neutral-50 pb-16">
      {/* HEADER */}
      <header
        className="bg-white border-b border-neutral-200 sticky top-0 z-30 px-4 sm:px-8 py-4 shadow-md text-neutral-900"
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-600 block drop-shadow-sm">
              SHUBHAM FABRICS MES · WASHING & DRYING WORKSTATION
            </span>
            <h1 className="text-xl font-bold text-neutral-900 flex items-center gap-2.5 drop-shadow-sm">
              <Waves className="w-5 h-5 text-brand-600" />
              <span>Washing Operations Control Terminal</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-lg bg-neutral-50 hover:bg-neutral-200 text-neutral-900 transition border border-neutral-200 flex items-center gap-1.5 text-xs font-semibold shadow-xs"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-600' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <Link
              href="/washing/floor-board"
              className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 rounded-lg text-xs font-semibold border border-neutral-200 transition flex items-center gap-1.5"
            >
              <Kanban className="w-4 h-4 text-brand-600" />
              <span>Floor Board</span>
            </Link>

            <Link
              href="/programs"
              className="px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4" />
              <span>All Production Sheets</span>
            </Link>
          </div>
        </div>
      </header>

      {/* TOAST MESSAGE */}
      {toastMessage && (
        <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-4">
          <div className="bg-accent-50 border border-accent-300 text-accent-800 rounded-xl p-3.5 shadow-sm flex items-center justify-between text-xs font-semibold animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-accent-700" />
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastHandover(null)} className="text-accent-800 hover:text-accent-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        {/* TABS NAVIGATION */}
        <div className="flex items-center gap-2 border-b border-neutral-200 pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('WASH_TERMINAL')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeTab === 'WASH_TERMINAL'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
            }`}
          >
            <Waves className="w-4 h-4" />
            <span>Washing Terminal & Lots</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'WASH_TERMINAL' ? 'bg-brand-700 text-white' : 'bg-neutral-100 text-neutral-700'
              }`}
            >
              {challans.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('ISSUE_HANDOVER')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeTab === 'ISSUE_HANDOVER'
                ? 'bg-accent-400 text-neutral-900 shadow-xs'
                : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
            }`}
          >
            <PackageCheck className="w-4 h-4" />
            <span>Handover to QC Washing</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'ISSUE_HANDOVER' ? 'bg-accent-500 text-neutral-900' : 'bg-neutral-100 text-neutral-700'
              }`}
            >
              {dispatchedChallans.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('DEFECTED_SHELF')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeTab === 'DEFECTED_SHELF'
                ? 'bg-danger-600 text-white shadow-xs'
                : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
            }`}
          >
            <Archive className="w-4 h-4" />
            <span>Defected / Quarantine Log</span>
          </button>

          <button
            onClick={() => setActiveTab('PRODUCTION_SHEETS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeTab === 'PRODUCTION_SHEETS'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Production Sheets Traveler</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'PRODUCTION_SHEETS' ? 'bg-brand-700 text-white' : 'bg-neutral-100 text-neutral-700'
              }`}
            >
              {productionProgramsList.length}
            </span>
          </button>
        </div>

        {/* TAB 1: WASHING TERMINAL & INCOMING LOTS */}
        {activeTab === 'WASH_TERMINAL' && (
          <div className="space-y-4">
            {/* SEARCH & FILTERS BAR */}
            <div className="bg-white p-4 rounded-xl border border-neutral-200 flex flex-col md:flex-row items-center justify-between gap-3 shadow-2xs">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Search by challan, sheet #, client, or style..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <Filter className="w-4 h-4 text-neutral-500" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-medium focus:outline-hidden"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending Washing</option>
                  <option value="IN_PROCESS">In Drum / Washing</option>
                  <option value="APPROVED">Washed & Ready</option>
                </select>
              </div>
            </div>

            {/* LOTS TABLE */}
            <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-neutral-50/80 border-b border-neutral-200 text-neutral-600 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Challan #</th>
                      <th className="py-3 px-4">Program / Sheet #</th>
                      <th className="py-3 px-4">Client / Style</th>
                      <th className="py-3 px-4 text-right">Piece In</th>
                      <th className="py-3 px-4 text-right">Piece Out</th>
                      <th className="py-3 px-4">Washing Barcode</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-neutral-500">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-brand-600 mb-2" />
                          <span>Loading Washing lots...</span>
                        </td>
                      </tr>
                    ) : filteredChallans.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-neutral-500">
                          <Waves className="w-8 h-8 mx-auto text-neutral-700 mb-2" />
                          <span>No washing lots found matching criteria.</span>
                        </td>
                      </tr>
                    ) : (
                      filteredChallans.map((c) => {
                        const pIn =
                          c.fabricIn ||
                          c.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
                        const pOut = c.fabricOut || '—';
                        const barcode = c.items?.[0]?.barcode || '—';

                        const isPending = ['ISSUED', 'RECEIVED'].includes(c.status);
                        const isApproved = ['QC_APPROVED', 'WASH_COMPLETED'].includes(c.status);

                        return (
                          <tr key={c.id} className="hover:bg-brand-50/20 transition">
                            <td className="py-3 px-4 font-mono font-bold text-neutral-900">
                              {c.challanNumber}
                            </td>
                            <td className="py-3 px-4 font-mono font-semibold text-brand-700">
                              {c.program?.programSerialNo || c.program?.programNumber || '—'}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-semibold text-neutral-900 block truncate max-w-[160px]">
                                {c.program?.clientName || 'Standard Client'}
                              </span>
                              <span className="text-[10px] text-neutral-500 block truncate max-w-[160px]">
                                {c.program?.mainStyle || c.program?.styleCode || 'General Lot'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-neutral-900">
                              {pIn} PCS
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-accent-800">
                              {pOut !== '—' ? `${pOut} PCS` : '—'}
                            </td>
                            <td className="py-3 px-4 font-mono text-[11px] text-neutral-700">
                              {barcode !== '—' ? (
                                <span className="bg-neutral-100 px-1.5 py-0.5 rounded font-bold text-neutral-900">
                                  {barcode}
                                </span>
                              ) : (
                                <span className="text-neutral-500 italic">Not Tagged</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                                  isApproved
                                    ? 'bg-accent-100 text-accent-800'
                                    : isPending
                                    ? 'bg-brand-100 text-brand-800'
                                    : 'bg-neutral-100 text-neutral-900'
                                }`}
                              >
                                {c.status}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-col gap-1.5 items-center">
                                <TransferDocuments challan={c} size="xs" />

                                {/* WORKFLOW ACTIONS */}
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {/* PROCESS WASH RUN BUTTON */}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenWashModal(c)}
                                    className="px-2.5 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded text-[11px] font-semibold flex items-center gap-1 transition shadow-2xs"
                                  >
                                    <Waves className="w-3 h-3" />
                                    <span>Wash Run</span>
                                  </button>

                                  {/* HANDOVER TO QC WASHING BUTTON (if approved) */}
                                  {isApproved && (
                                    <button
                                      type="button"
                                      onClick={() => handleIssueToFinishing(c)}
                                      className="px-2 py-1 bg-accent-400 hover:bg-accent-500 text-neutral-900 rounded text-[11px] font-semibold flex items-center gap-1 transition shadow-2xs"
                                      title="Issue Handover Challan to QC Washing"
                                    >
                                      <PackageCheck className="w-3 h-3" />
                                      <span>To QC Washing</span>
                                    </button>
                                  )}
                                </div>
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
          </div>
        )}

        {/* TAB 2: ISSUE HANDOVER CHALLAN TO FINISHING */}
        {activeTab === 'ISSUE_HANDOVER' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <PackageCheck className="w-5 h-5 text-accent-700" />
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900">
                      Dispatched Challans to QC Washing Department
                    </h3>
                    <p className="text-xs text-neutral-500">
                      Washed and barcode-tagged lots transferred to QC Washing for verification & quality check
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-neutral-700 bg-neutral-100 px-2 py-1 rounded">
                  {dispatchedChallans.length} Handed Over
                </span>
              </div>

              {dispatchedChallans.length === 0 ? (
                <div className="py-12 text-center text-neutral-500">
                  <PackageCheck className="w-8 h-8 mx-auto text-neutral-700 mb-2" />
                  <p className="text-xs font-medium">No outgoing handover challans issued yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-neutral-100 pt-2">
                  {dispatchedChallans.map((c) => {
                    const qty = c.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
                    const barcode = c.items?.[0]?.barcode || '—';
                    return (
                      <div key={c.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-neutral-900">{c.challanNumber}</span>
                            <span className="text-accent-800 font-semibold bg-accent-50 px-1.5 py-0.2 rounded text-[10px]">
                              To: {c.toDepartment}
                            </span>
                            <span className="font-mono font-bold text-neutral-700 bg-neutral-100 px-1.5 py-0.2 rounded text-[10px]">
                              Tag: {barcode}
                            </span>
                          </div>
                          <div className="text-neutral-600">
                            <span>{c.program?.clientName || 'Standard Client'}</span>
                            {' · '}
                            <span className="font-mono">
                              Sheet #{c.program?.programSerialNo || c.program?.programNumber || '—'}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                          <span className="font-mono font-bold text-accent-800 text-sm">{qty} PCS</span>
                          
                          {/* ACTIONS */}
                          <DocumentActionButtons
                            challan={c}
                            program={c.program}
                            size="xs"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: DEFECTED / QUARANTINE LOG */}
        {activeTab === 'DEFECTED_SHELF' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-danger-200 p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-danger-100">
                <div className="flex items-center gap-2">
                  <Archive className="w-5 h-5 text-danger-600" />
                  <div>
                    <h3 className="text-sm font-bold text-danger-900">
                      Washing Defected Pieces & Quarantine Log (DEF-SHELF-01)
                    </h3>
                    <p className="text-xs text-neutral-500">
                      Track shrinkage deviations, color bleeding, torn pieces, or fabric damage during wash
                    </p>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-neutral-100 pt-2">
                {challans.filter((c) => (c.defectivePieces || 0) > 0).length === 0 ? (
                  <div className="py-12 text-center text-neutral-500">
                    <CheckCircle2 className="w-8 h-8 mx-auto text-accent-700 mb-2" />
                    <p className="text-xs font-medium">Zero defective pieces quarantined from washing.</p>
                  </div>
                ) : (
                  challans
                    .filter((c) => (c.defectivePieces || 0) > 0)
                    .map((c) => (
                      <div key={c.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-neutral-900">{c.challanNumber}</span>
                            <span className="font-mono font-bold text-danger-700 bg-danger-50 px-1.5 py-0.2 rounded text-[10px]">
                              DEF-SHELF-01
                            </span>
                          </div>
                          <p className="text-neutral-600 font-medium">
                            {c.defectReason || 'Shrinkage & Wash Defect'}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-danger-700 text-sm">
                            {c.defectivePieces} PCS Defective
                          </span>
                          <DocumentActionButtons
                            challan={c}
                            program={c.program}
                            size="xs"
                          />
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PRODUCTION SHEETS TRAVELER */}
        {activeTab === 'PRODUCTION_SHEETS' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-brand-600" />
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900">
                      Master Production Sheets (Travelers)
                    </h3>
                    <p className="text-xs text-neutral-500">
                      Direct view and printable production sheets for Washing & Drying Specifications
                    </p>
                  </div>
                </div>
                <Link
                  href="/programs"
                  className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  All Sheets →
                </Link>
              </div>

              <div className="divide-y divide-neutral-100 pt-2">
                {productionProgramsList.length === 0 ? (
                  <div className="py-12 text-center text-neutral-500">
                    <FileText className="w-8 h-8 mx-auto text-neutral-700 mb-2" />
                    <p className="text-xs font-medium">No production programs linked to incoming challans yet.</p>
                  </div>
                ) : (
                  productionProgramsList.map((prog: any) => (
                    <div key={prog.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-neutral-900 text-sm">
                            {prog.programSerialNo || prog.programNumber}
                          </span>
                          <span className="font-semibold text-brand-700 bg-brand-50 px-2 py-0.2 rounded text-[10px]">
                            {prog.clientName || 'Standard Client'}
                          </span>
                        </div>
                        <div className="text-neutral-600 text-[11px] mt-0.5">
                          <span>Style: {prog.mainStyle || prog.styleCode || 'General'}</span>
                          {prog.fabricName && <span> · Fabric: {prog.fabricName}</span>}
                          {prog.fabricColor && <span> · Color: {prog.fabricColor}</span>}
                        </div>
                      </div>

                      <DocumentActionButtons
                        program={prog}
                        size="sm"
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* WASHING PROCESSING TERMINAL MODAL (ALL MANDATORY FIELDS) */}
      {selectedChallanForWash && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/70 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl p-6 shadow-2xl border border-neutral-200 text-neutral-900 space-y-4 my-auto">
            {/* MODAL HEADER */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center text-brand-700">
                  <Waves className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    Washing Cycle Terminal · Challan #{selectedChallanForWash.challanNumber}
                  </h3>
                  <p className="text-xs text-neutral-500 font-mono">
                    Program: {selectedChallanForWash.program?.programSerialNo || selectedChallanForWash.program?.programNumber || '—'} · {selectedChallanForWash.program?.clientName}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {selectedChallanForWash.program && (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectedSheetForView(selectedChallanForWash.program)}
                      className="px-2.5 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-xs transition"
                      title="View Official Production Sheet"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>View Sheet</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadProductionSheetHtml(selectedChallanForWash.program)}
                      className="px-2 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 rounded text-xs font-semibold flex items-center gap-1 transition"
                      title="Download Production Sheet HTML"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => printProductionSheet(selectedChallanForWash.program)}
                      className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded text-xs font-semibold flex items-center gap-1 transition"
                      title="Print Production Sheet Traveler"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print</span>
                    </button>
                  </>
                )}
                <button
                  onClick={() => setSelectedChallanForWash(null)}
                  className="p-1 rounded text-neutral-500 hover:text-neutral-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* FORM */}
            <form onSubmit={handleSubmitWashRun} className="space-y-4">
              {/* ROW 1: MANDATORY PIECE IN & PIECE OUT & CALCULATED SHRINKAGE */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-neutral-50 rounded-xl border border-neutral-200">
                <div>
                  <label className="block text-xs font-bold text-neutral-900 mb-1">
                    Piece In (Mandatory) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={washForm.pieceIn}
                    onChange={(e) => setWashForm({ ...washForm, pieceIn: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg text-xs font-mono font-bold focus:ring-2 focus:ring-brand-500"
                    placeholder="e.g. 500"
                  />
                  <span className="text-[10px] text-neutral-500 mt-0.5 block">Received into washer</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-accent-800 mb-1">
                    Piece Out (Mandatory) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={washForm.pieceOut}
                    onChange={(e) => {
                      const pO = e.target.value;
                      const pI = Number(washForm.pieceIn) || 0;
                      const diff = Math.max(0, pI - Number(pO));
                      setWashForm({
                        ...washForm,
                        pieceOut: pO,
                        defectivePieces: String(diff),
                      });
                    }}
                    className="w-full px-3 py-2 bg-white border border-accent-300 rounded-lg text-xs font-mono font-bold text-accent-800 focus:ring-2 focus:ring-brand-500/40"
                    placeholder="e.g. 490"
                  />
                  <span className="text-[10px] text-accent-700 mt-0.5 block">Good pieces washed</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-accent-800 mb-1">
                    Shrinkage Loss %
                  </label>
                  <div className="px-3 py-2 bg-accent-50 border border-accent-200 rounded-lg text-xs font-mono font-bold text-accent-800">
                    {Number(washForm.pieceIn) > 0
                      ? `${(
                          ((Number(washForm.pieceIn) - Number(washForm.pieceOut || 0)) /
                            Number(washForm.pieceIn)) *
                          100
                        ).toFixed(2)} %`
                      : '0.00 %'}
                  </div>
                  <span className="text-[10px] text-accent-800 mt-0.5 block">
                    {Math.max(0, Number(washForm.pieceIn) - Number(washForm.pieceOut || 0))} PCS Difference
                  </span>
                </div>
              </div>

              {/* ROW 2: MANDATORY WASHING BARCODE & DRUM ID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-900 mb-1">
                    Washing Barcode (Mandatory) *
                  </label>
                  <div className="relative">
                    <Barcode className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input
                      type="text"
                      required
                      value={washForm.washingBarcode}
                      onChange={(e) => setWashForm({ ...washForm, washingBarcode: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-neutral-300 rounded-lg text-xs font-mono font-bold focus:ring-2 focus:ring-brand-500"
                      placeholder="e.g. WB-2026-0042"
                    />
                  </div>
                  <span className="text-[10px] text-neutral-500 mt-0.5 block">Unique lot sticker barcode</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-900 mb-1">
                    Machine / Drum ID (Mandatory) *
                  </label>
                  <select
                    value={washForm.machineId}
                    onChange={(e) => setWashForm({ ...washForm, machineId: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="WASH-DRUM-01">WASH-DRUM-01 (100 KG Capacity)</option>
                    <option value="WASH-DRUM-02">WASH-DRUM-02 (150 KG Capacity)</option>
                    <option value="WASHER-HEAVY-03">WASHER-HEAVY-03 (250 KG Capacity)</option>
                    <option value="SAMPLE-WASHER-01">SAMPLE-WASHER-01 (25 KG Sample)</option>
                  </select>
                </div>
              </div>

              {/* ROW 3: WASH RECIPE & DRYING METHOD */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-900 mb-1">
                    Wash Recipe / Treatment *
                  </label>
                  <select
                    value={washForm.washRecipe}
                    onChange={(e) => setWashForm({ ...washForm, washRecipe: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="BIO_POLISH_SOFT_WASH">Bio-Polish & Enzyme Soft Wash</option>
                    <option value="SILICON_SOFTENER_WASH">Silicon Softener Premium Wash</option>
                    <option value="ENZYME_STONE_WASH">Enzyme Stone Wash (Vintage)</option>
                    <option value="BLEACH_VINTAGE_WASH">Bleach & Acid Fade Wash</option>
                    <option value="NORMAL_HOT_WASH">Normal Hot Wash & De-sizing</option>
                    <option value="COLD_RINSE_FIX">Cold Water Rinse & Color Fix</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-900 mb-1">
                    Drying Method & Temperature
                  </label>
                  <select
                    value={washForm.dryingMethod}
                    onChange={(e) => setWashForm({ ...washForm, dryingMethod: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="Tumble Dry (60°C)">Tumble Dry (60°C Medium Heat)</option>
                    <option value="Tumble Dry (80°C High)">Tumble Dry (80°C High Shrinkage Lock)</option>
                    <option value="Low Heat Tumble Dry">Low Heat Delicate Dry (40°C)</option>
                    <option value="Line Air Dry">Natural Line Air Dry</option>
                    <option value="Steam Tunnel Dry">Steam Tunnel De-wrinkling</option>
                  </select>
                </div>
              </div>

              {/* ROW 4: TEMPERATURE, DURATION & LIQUOR RATIO */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-900 mb-1">
                    Water Temp
                  </label>
                  <select
                    value={washForm.waterTemp}
                    onChange={(e) => setWashForm({ ...washForm, waterTemp: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg text-xs font-medium"
                  >
                    <option value="Ambient Cold (25°C)">Ambient Cold (25°C)</option>
                    <option value="40°C Warm">40°C Warm (Recommended)</option>
                    <option value="60°C Hot">60°C Hot (Enzyme)</option>
                    <option value="80°C Boil">80°C Extreme Boil</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-900 mb-1">
                    Wash Duration (Mins)
                  </label>
                  <input
                    type="number"
                    min="5"
                    value={washForm.durationMinutes}
                    onChange={(e) => setWashForm({ ...washForm, durationMinutes: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg text-xs font-mono font-medium"
                    placeholder="45"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-900 mb-1">
                    Liquor Ratio
                  </label>
                  <select
                    value={washForm.liquorRatio}
                    onChange={(e) => setWashForm({ ...washForm, liquorRatio: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg text-xs font-medium"
                  >
                    <option value="1:5">1:5 (Low Liquor)</option>
                    <option value="1:8">1:8 (Standard)</option>
                    <option value="1:10">1:10 (Deep Soak)</option>
                    <option value="1:12">1:12 (High Wash)</option>
                  </select>
                </div>
              </div>

              {/* ROW 5: DEFECT / REMARKS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-danger-800 mb-1">
                    Quarantine / Defective Pieces (DEF-SHELF-01)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={washForm.defectivePieces}
                    onChange={(e) => setWashForm({ ...washForm, defectivePieces: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-danger-300 rounded-lg text-xs font-mono font-bold text-danger-700"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-900 mb-1">
                    Defect Reason (if any)
                  </label>
                  <input
                    type="text"
                    value={washForm.defectReason}
                    onChange={(e) => setWashForm({ ...washForm, defectReason: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg text-xs"
                    placeholder="e.g. Color bleeding, fraying, shrinkage deviation"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-900 mb-1">
                  Hand-Feel & Quality Inspection Remarks
                </label>
                <input
                  type="text"
                  value={washForm.handFeelRemarks}
                  onChange={(e) => setWashForm({ ...washForm, handFeelRemarks: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg text-xs"
                  placeholder="e.g. Soft hand-feel verified, zero fabric pills, color fast"
                />
              </div>

              {/* BARCODE STICKER CARD PREVIEW */}
              {washForm.washingBarcode && (
                <div className="pt-2">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                    Live Barcode Sticker Preview (For Bundle Tagging)
                  </span>
                  <BarcodeStickerCard
                    params={{
                      challanNumber: selectedChallanForWash.challanNumber,
                      designNumber: washForm.washingBarcode,
                      departmentName: 'Washing Department Lot Tag',
                      fromDepartment: selectedChallanForWash.fromDepartment || 'QC2',
                      toDepartment: 'WASHING',
                      programSerialNo:
                        selectedChallanForWash.program?.programSerialNo ||
                        selectedChallanForWash.program?.programNumber,
                      clientName: selectedChallanForWash.program?.clientName,
                      mainStyle:
                        selectedChallanForWash.program?.mainStyle ||
                        selectedChallanForWash.program?.styleCode,
                      totalQuantity: Number(washForm.pieceOut) || 0,
                      uom: 'PCS',
                    }}
                    title="Washing Lot Barcode Tag"
                  />
                </div>
              )}

              {/* ACTION BUTTONS */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setSelectedChallanForWash(null)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold text-xs rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingWash}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-lg shadow-sm transition flex items-center gap-1.5"
                >
                  {submittingWash ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Wash Record...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Complete Wash & Approve</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HANDOVER SUCCESS MODAL WITH BARCODE TAG */}
      {handoverDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 p-3">
          <div className="bg-white rounded-xl border border-neutral-300 shadow-2xl w-full max-w-sm p-4 space-y-3">
            <div>
              <h3 className="text-sm font-bold text-neutral-900">Issue challan to QC Washing</h3>
              <p className="text-[11px] text-neutral-500">
                Source challan {handoverDraft.challan.challanNumber} ·{' '}
                {handoverDraft.challan.fabricOut ?? handoverDraft.challan.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0)} PCS
              </p>
            </div>
            <ChallanNumberField
              value={handoverDraft.challanNumber}
              onChange={(value) => setHandoverDraft({ ...handoverDraft, challanNumber: value, error: null })}
              error={handoverDraft.error}
              disabled={handoverDraft.submitting}
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setHandoverDraft(null)}
                disabled={handoverDraft.submitting}
                className="px-3 py-1.5 border border-neutral-300 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmIssueToQcWashing}
                disabled={handoverDraft.submitting}
                className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold disabled:opacity-50"
              >
                {handoverDraft.submitting ? 'Issuing...' : 'Issue Challan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {handoverChallanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/70 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl border border-neutral-200 text-neutral-900 space-y-4 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-accent-100 flex items-center justify-center text-accent-800">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    Handover Challan Dispatched to Finishing!
                  </h3>
                  <p className="text-xs text-neutral-500 font-mono">
                    {handoverChallanModal.challanNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setHandoverChallanModal(null)}
                className="p-1 rounded text-neutral-500 hover:text-neutral-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-accent-50/60 p-3 rounded-xl border border-accent-100 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-neutral-600">From Department:</span>
                  <span className="font-semibold text-neutral-900">WASHING DEPARTMENT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">To Department:</span>
                  <span className="font-bold text-accent-800">FINISHING DEPARTMENT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Pieces Dispatched:</span>
                  <span className="font-mono font-bold text-neutral-900">
                    {handoverChallanModal.items?.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0) || '—'} PCS
                  </span>
                </div>
              </div>

              {/* BARCODE STICKER TAG */}
              <BarcodeStickerCard
                params={{
                  challanNumber: handoverChallanModal.challanNumber,
                  designNumber: handoverChallanModal.items?.[0]?.barcode || handoverChallanModal.challanNumber,
                  departmentName: 'Washing Handover to Finishing',
                  fromDepartment: 'WASHING',
                  toDepartment: 'FINISHING',
                  programSerialNo: handoverChallanModal.program?.programSerialNo,
                  clientName: handoverChallanModal.program?.clientName,
                  totalQuantity: handoverChallanModal.items?.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0) || 0,
                  uom: 'PCS',
                }}
                title="Finishing Handover Barcode Tag"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200">
              <button
                onClick={() => setHandoverChallanModal(null)}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold text-xs rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRODUCTION SHEET PRINT / TRAVELER MODAL */}
      {selectedSheetForView && (
        <ProductionSheetPrintModal
          program={selectedSheetForView}
          isOpen={!!selectedSheetForView}
          onClose={() => setSelectedSheetForView(null)}
        />
      )}
    </div>
  );
}
