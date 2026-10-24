'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Send,
  FileText,
  Printer,
  Download,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Eye,
  ArrowLeft,
  Plus,
  Trash2,
  Calendar,
  Building2,
  Hash,
  Sparkles,
  Lock,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  PackagePlus,
  Check,
} from 'lucide-react';
import {
  downloadProductionSheetHtml,
  printProductionSheet,
} from '@/lib/download-production-sheet';
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';
import { getChallanNumberError } from '@/components/challan/ChallanNumberInput';

import {
  ColorFabricMeasurementTable,
  ChallanItemData,
  createBlankChallanItem,
  DepartmentInOutTracking,
} from '@/components/ColorFabricMeasurementTable';

interface FabricStoreIssueChallanViewProps {
  fixedTarget?: 'DYEING' | 'EMBROIDERY';
}

export function FabricStoreIssueChallanView({ fixedTarget }: FabricStoreIssueChallanViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProgramId = searchParams?.get('programId');
  const queryTo = searchParams?.get('to')?.toUpperCase();

  const destinationDepartment: 'DYEING' | 'EMBROIDERY' =
    fixedTarget ||
    (queryTo === 'EMBROIDERY' ? 'EMBROIDERY' : 'DYEING');

  const challanContext = destinationDepartment === 'DYEING' ? 'STORE_DYEING' : 'STORE_EMBROIDERY';

  // Loading & base data
  const [loading, setLoading] = useState(true);
  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>(preselectedProgramId || '');

  // Form Fields
  const [challanNumber, setChallanNumber] = useState('');
  const [challanDate, setChallanDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [sourceDept] = useState('Fabric Store');
  const [destDept] = useState(destinationDepartment === 'DYEING' ? 'Dyeing' : 'Embroidery');
  const [priority, setPriority] = useState('NORMAL');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [designNumber, setDesignNumber] = useState('');
  const [serialNumber, setSerialNumber] = useState('');

  // In / Out Tracking across departments
  const [storeTracking, setStoreTracking] = useState<DepartmentInOutTracking>({
    fabricIn: 0,
    fabricOut: 0,
    fabricUnit: 'MTR',
    defectivePieces: 0,
    defectiveShelfLocation: 'DEF-SHELF-STORE (Fabric Store Quarantined Shelf)',
    defectReason: '',
    detectedFromDept: 'PROGRAMMING',
    detectedFromChallanId: null,
    detectedFromChallanNumber: null,
  });

  // Reusable Color / Fabric / Measurement items (Default blank)
  const [items, setItems] = useState<ChallanItemData[]>(() => [createBlankChallanItem(challanContext)]);

  // Store Incharge (Name / Contact)
  const [storeInchargeName, setStoreInchargeName] = useState('Fabric Store Incharge');
  const [storeInchargeContact, setStoreInchargeContact] = useState('');

  // UI States
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [challanNumberError, setChallanNumberError] = useState<string | null>(null);
  // Per-line balance preview from the same matching the challan API uses (fabric + colour + unit).
  const [lineStock, setLineStock] = useState<Record<string, { available: number; requestedTotal: number; unit: string; sufficient: boolean; matchedStock: boolean; itemName: string; color: string }>>({});
  const [showSheetModal, setShowSheetModal] = useState(false);
  const [issuedChallan, setIssuedChallan] = useState<any>(null);

  // Fabric Store Stock Availability Gate State
  const [fabricAvailability, setFabricAvailability] = useState<any | null>(null);
  const [availabilityUnit, setAvailabilityUnit] = useState<'MTR' | 'PCS'>('MTR');
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [updatingAvailability, setUpdatingAvailability] = useState(false);

  const loadAvailability = async (progId: string, unit?: 'MTR' | 'PCS') => {
    if (!progId) return;
    try {
      setCheckingAvailability(true);
      const params = new URLSearchParams({ programId: progId });
      if (unit) params.set('unit', unit);
      const res = await fetch(`/api/fabric-store/check-availability?${params.toString()}`);
      const json = await res.json();
      if (res.ok && json.data) {
        setFabricAvailability(json.data);
      }
    } catch (err) {
      console.error('Failed to load fabric availability:', err);
    } finally {
      setCheckingAvailability(false);
    }
  };

  const handleToggleAvailability = async (isAvailable: boolean) => {
    if (!selectedProgramId) return;
    try {
      setUpdatingAvailability(true);
      const res = await fetch('/api/fabric-store/check-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programId: selectedProgramId,
          isAvailable,
          actorName: storeInchargeName || 'Fabric Store Incharge',
        }),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        setFabricAvailability(json.data);
        if (isAvailable) setError('');
      } else {
        setError(json.error || 'Failed to update fabric availability');
      }
    } catch (err: any) {
      setError(err.message || 'Error updating availability');
    } finally {
      setUpdatingAvailability(false);
    }
  };

  // Load Programs (the challan number is always entered manually)
  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      const progRes = await fetch('/api/programs');
      const progData = await progRes.json();

      let progList: any[] = Array.isArray(progData) ? progData : [];

      if (destinationDepartment === 'DYEING') {
        progList = [...progList].sort((a, b) => {
          if (a.fabricDyeingRequired === b.fabricDyeingRequired) return 0;
          return a.fabricDyeingRequired ? -1 : 1;
        });
      }

      setPrograms(progList);

      if (typeof window !== 'undefined') {
        try {
          const savedUser = localStorage.getItem('subham_mes_user');
          if (savedUser) {
            const parsed = JSON.parse(savedUser);
            if (parsed.fullName) setStoreInchargeName(parsed.fullName);
            if (parsed.phone || parsed.contact) setStoreInchargeContact(parsed.phone || parsed.contact);
          }
        } catch {}
      }

      const targetProg = preselectedProgramId
        ? progList.find((p) => p.id === preselectedProgramId)
        : progList[0];

      if (targetProg) {
        handleProgramSelect(targetProg);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load initial data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [preselectedProgramId, destinationDepartment]);

  // Synchronize form reference fields when a Production Sheet / Serial Number is selected
  // All business entry fields remain blank as per Master Prompt rules
  const handleProgramSelect = (prog: any) => {
    if (!prog) return;
    setSelectedProgramId(prog.id);
    setSerialNumber(prog.programSerialNo || prog.programNumber || '');
    setDesignNumber(prog.designNumber || prog.wilcomDesignNumber || prog.styleCode || '');
    setPriority(prog.priority || 'NORMAL');

    // The challan delivery date is the department's actual deadline, so it is entered by the
    // Store Incharge rather than copied from the sheet (whose date may be a system default).
    setDeliveryDate('');

    const targetQ = Number(prog.targetQuantity || prog.fabricIssuedToDyeing || 0);
    const initialUnit: 'MTR' | 'PCS' = prog.quantityMeasurement === 'PCS' ? 'PCS' : 'MTR';
    setAvailabilityUnit(initialUnit);
    setItems((currentItems) => currentItems.map((item) => ({ ...item, unit: initialUnit })));
    setStoreTracking((prev) => ({
      ...prev,
      fabricIn: targetQ,
      fabricOut: Math.max(0, targetQ - prev.defectivePieces),
      fabricUnit: initialUnit,
      detectedFromDept: 'PROGRAMMING',
    }));

    // Trigger Fabric Store stock verification
    loadAvailability(prog.id, initialUnit);
  };

  const handleItemsChange = (nextItems: ChallanItemData[]) => {
    setItems(nextItems);
    const selectedRow = nextItems.find(
      (item) => Number(item.measurement) > 0 || item.fabric.trim() || item.color.trim()
    ) || nextItems[0];
    const nextUnit = selectedRow?.unit || 'MTR';
    if (selectedProgramId && nextUnit !== availabilityUnit) {
      setAvailabilityUnit(nextUnit);
      loadAvailability(selectedProgramId, nextUnit);
    }
  };

  const selectedProgram = programs.find((p) => p.id === selectedProgramId);

  useEffect(() => {
    const lines = items
      .filter((item) => item.fabric.trim() && Number(item.measurement) > 0)
      .map((item) => ({
        id: item.id,
        fabric: item.fabric.trim(),
        color: item.color.trim(),
        unit: item.unit,
        quantity: Number(item.measurement),
        fabricProcessingStatus: destinationDepartment === 'EMBROIDERY' ? 'Undyed' : undefined,
      }));
    if (lines.length === 0) {
      setLineStock({});
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/fabric-store/stock-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ toDepartment: destinationDepartment, lines }),
        });
        const json = await res.json();
        if (!active || !res.ok || !Array.isArray(json.data)) return;
        const next: typeof lineStock = {};
        lines.forEach((line, index) => {
          next[line.id] = json.data[index];
        });
        setLineStock(next);
      } catch (err) {
        console.error('Failed to check line stock:', err);
      }
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [items, destinationDepartment]);

  const rowHints: Record<string, React.ReactNode> = Object.fromEntries(
    Object.entries(lineStock).map(([id, stock]) => [
      id,
      !stock.matchedStock ? (
        <span className="font-semibold text-rose-700">No inward stock for this fabric / colour in {stock.unit}</span>
      ) : stock.sufficient ? (
        <span className="font-semibold text-emerald-700">Available: {stock.available} {stock.unit}</span>
      ) : (
        <span className="font-semibold text-rose-700">
          Only {stock.available} {stock.unit} available ({stock.requestedTotal} {stock.unit} requested)
        </span>
      ),
    ])
  );
  const hasStockShortage = Object.values(lineStock).some((stock) => !stock.sufficient);
  // The Store Incharge can hold a production sheet; quantities are checked per line.
  const isStoreHold = fabricAvailability?.statusLabel === 'OUT_OF_STOCK';

  // Submit Challan Store to Dyeing
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProgram) {
      setError('Please select a Serial Number / Production Sheet.');
      return;
    }

    const numberError = getChallanNumberError(challanNumber);
    if (numberError) {
      setChallanNumberError(numberError);
      setError(numberError);
      return;
    }
    setChallanNumberError(null);

    // Only measured rows represent material moving out of the store.
    const rowsWithDetails = items.filter((it) => it.fabric.trim() || it.color.trim() || String(it.measurement).trim());
    if (rowsWithDetails.some((item) => !Number.isFinite(Number(item.measurement)) || Number(item.measurement) <= 0)) {
      setError('Enter a positive measurement for every challan item.');
      return;
    }
    const validItems = rowsWithDetails.filter((item) => Number(item.measurement) > 0);

    if (validItems.length === 0) {
      setError('Please enter at least one item in the Color / Fabric / Measurement table.');
      return;
    }
    if (destinationDepartment === 'DYEING') {
      const missingColorIndex = validItems.findIndex((item) => !String(item.requiredDyeColor || '').trim());
      if (missingColorIndex >= 0) {
        setError(`Item #${missingColorIndex + 1}: enter the Required Dye Color (the colour the fabric must be dyed to).`);
        return;
      }
      const overIndex = validItems.findIndex((item) =>
        String(item.requiredDyeQuantity ?? '').trim() !== '' && Number(item.requiredDyeQuantity) > Number(item.measurement)
      );
      if (overIndex >= 0) {
        setError(`Item #${overIndex + 1}: Required Qty to Dye cannot be more than the fabric quantity issued.`);
        return;
      }
    }

    // Each line keeps its own unit (MTR or PCS); meters and pieces are never added together.
    const issueUnits = Array.from(new Set(validItems.map((item) => (item.unit === 'PCS' ? 'PCS' : 'MTR'))));
    const isMixedUnits = issueUnits.length > 1;
    const issueUnit: 'MTR' | 'PCS' = issueUnits[0] as 'MTR' | 'PCS';
    const issueQuantity = validItems.reduce((sum, item) => sum + Number(item.measurement), 0);
    const quantityByUnit = issueUnits
      .map((unit) => `${validItems.filter((item) => (item.unit === 'PCS' ? 'PCS' : 'MTR') === unit).reduce((sum, item) => sum + Number(item.measurement), 0)} ${unit}`)
      .join(' + ');
    if (isStoreHold) {
      setError(
        `Fabric (${fabricAvailability.fabricName || 'fabric'}) is marked Out of Stock (Hold) by the Fabric Store. Production sheet cannot move to ${destDept} until the hold is released.`
      );
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }
    if (hasStockShortage) {
      setError('One or more items exceed the available Fabric Store stock for that fabric, colour and unit. Adjust the quantities or record the inward stock first.');
      return;
    }
    const trackingMatchesUnit = !isMixedUnits && storeTracking.fabricUnit === issueUnit;
    const challanDefectiveQuantity = trackingMatchesUnit ? storeTracking.defectivePieces : 0;
    const challanFabricIn = issueQuantity + challanDefectiveQuantity;

    try {
      setSubmitting(true);
      setError('');

      // Map ColorFabricMeasurementTable items to ChallanItem database schema
      const challanItems = validItems.map((item) => ({
        itemDescription: `${item.fabric || 'Fabric'} — ${item.color || 'Standard'}`,
        unitType: 'ROLL',
        quantity: Number(item.measurement),
        uom: item.unit === 'PCS' ? 'PCS' : 'MTR',
        // Must match the Inward Stock fabric name so the right stock is deducted.
        fabricCode: item.fabric.trim(),
        // Current fabric colour and the required dyeing colour are stored separately.
        colour: item.color || null,
        requiredDyeColor: destinationDepartment === 'DYEING' ? String(item.requiredDyeColor || '').trim() || null : null,
        requiredDyeQuantity: destinationDepartment === 'DYEING' && String(item.requiredDyeQuantity ?? '').trim() !== ''
          ? Number(item.requiredDyeQuantity)
          : null,
        fabricProcessingStatus: destinationDepartment === 'EMBROIDERY' ? 'Undyed' : undefined,
        rollNumber: item.rollNumber || null,
        remarks: item.remarks || null,
      }));

      const inchargeInfo = [
        storeInchargeName ? `Store Incharge: ${storeInchargeName}` : null,
        storeInchargeContact ? `Contact: ${storeInchargeContact}` : null,
        designNumber ? `Design #: ${designNumber}` : null,
        isMixedUnits
          ? `Accounting: Out to ${destinationDepartment}: ${quantityByUnit}`
          : `Accounting: In: ${challanFabricIn} ${issueUnit} | Defective Cut: ${challanDefectiveQuantity} ${issueUnit} (${storeTracking.defectiveShelfLocation}) | Out to ${destinationDepartment}: ${issueQuantity} ${issueUnit}`,
      ]
        .filter(Boolean)
        .join(' · ');

      const payload = {
        challanNumber: challanNumber.trim(),
        challanType: destinationDepartment === 'DYEING' ? 'STORE_TO_DYEING' : 'STORE_TO_EMBROIDERY',
        programId: selectedProgram.id,
        fromDepartment: 'STORE',
        toDepartment: destinationDepartment,
        priority: priority || 'NORMAL',
        issuedDate: challanDate,
        deliveryDate: deliveryDate || null,
        ...(isMixedUnits
          ? {}
          : {
              fabricIn: challanFabricIn,
              defectivePieces: challanDefectiveQuantity,
              defectiveShelfLocation: storeTracking.defectiveShelfLocation,
              defectReason: storeTracking.defectReason,
              fabricOut: issueQuantity,
              fabricUnit: issueUnit,
            }),
        detectedFromDepartment: storeTracking.detectedFromDept || 'PROGRAMMING',
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
        throw new Error(data.error || `Failed to dispatch challan to ${destDept}`);
      }

      setIssuedChallan({
        ...data,
        program: selectedProgram,
        destinationDepartment,
        storeInchargeName,
        storeInchargeContact,
        tableItems: validItems,
      });
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err: any) {
      setError(err.message || 'Error submitting challan');
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setIssuedChallan(null);
    setError('');
    setChallanNumber('');
    setChallanNumberError(null);
    setItems([createBlankChallanItem(challanContext)]);
    loadData();
  };

  return (
    <div className="min-h-screen bg-ink-50 pb-24">
      {/* TOP NAVIGATION / HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-8 py-3.5 shadow-2xs">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/fabric-store"
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition"
              title="Back to Fabric Store"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700">
                  FABRIC STORE
                </span>
                <span className="text-slate-300">/</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  MY WORK
                </span>
              </div>
              <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Send className="w-4 h-4 text-indigo-600" />
                <span>Challan Store to {destDept}</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {selectedProgram && (
              <button
                type="button"
                onClick={() => setShowSheetModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 rounded-lg text-xs font-bold transition shadow-2xs"
              >
                <FileText className="w-3.5 h-3.5 text-teal-700" />
                <span>Show Production Sheet</span>
              </button>
            )}
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <main className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
        {/* ERROR NOTIFICATION */}
        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* ============================================================== */}
        {/* SUCCESS CONFIRMATION STATE                                     */}
        {/* ============================================================== */}
        {issuedChallan ? (
          <div className="bg-white border border-emerald-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 block">
                  CHALLAN DISPATCHED &amp; SYNCED
                </span>
                <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                  Challan {issuedChallan.challanNumber} Dispatched to {issuedChallan.destinationDepartment === 'DYEING' ? 'Dyeing' : 'Embroidery'} Department
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  The Production Sheet and Challan items have been transferred to the {destDept} department worklist.
                </p>
              </div>
            </div>

            {/* SUMMARY GRID */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 p-4 bg-slate-50 border border-slate-200/80 rounded-xl text-xs">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Challan Number</span>
                <strong className="font-mono text-slate-900 text-sm">{issuedChallan.challanNumber}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Serial Number</span>
                <strong className="font-mono text-teal-800 text-sm">
                  {issuedChallan.program?.programSerialNo || issuedChallan.program?.programNumber || '—'}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Design Number</span>
                <strong className="text-slate-900">{designNumber || '—'}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Priority</span>
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 uppercase">
                  {priority}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Source</span>
                <strong className="text-slate-900">{sourceDept}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Destination</span>
                <strong className="text-slate-900">{destDept}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Store Incharge</span>
                <strong className="text-slate-900">{storeInchargeName || '—'}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Contact</span>
                <span className="text-slate-700">{storeInchargeContact || '—'}</span>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100">
              <Link
                href={`/challans/${issuedChallan.id}`}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold rounded-lg shadow-xs transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>View &amp; Print Challan Slip</span>
              </Link>
              <button
                type="button"
                onClick={() => printProductionSheet(issuedChallan.program)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Production Sheet</span>
              </button>
              <button
                type="button"
                onClick={() => downloadProductionSheetHtml(issuedChallan.program)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xs transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download HTML</span>
              </button>
              <Link
                href={destinationDepartment === 'DYEING' ? '/dyeing/my-work' : '/embroidery/my-work'}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-50 hover:bg-teal-100 border border-teal-300 text-teal-900 text-xs font-bold rounded-lg transition"
              >
                <Eye className="w-3.5 h-3.5 text-teal-700" />
                <span>View in {destDept} Worklist →</span>
              </Link>
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1.5 px-4 py-2 bg-lavender-700 hover:bg-lavender-800 text-white text-xs font-bold rounded-lg shadow-xs transition ml-auto"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Issue Another Challan</span>
              </button>
            </div>
          </div>
        ) : (
          /* ============================================================== */
          /* FORM: (Challan Store to Dyeing)                                */
          /* Exact field layout specified in handwritten sketch             */
          /* ============================================================== */
          <form onSubmit={handleSubmit} className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
            {/* CARD TITLE & "Show Production sheet" BUTTON */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-xl font-bold font-serif text-slate-900">
                  (Challan Store to {destDept})
                </h2>
                <span className="text-xs text-slate-500">
                  Dispatch production lots and master traveler from Fabric Store to Dyeing department
                </span>
              </div>

              {selectedProgram ? (
                <button
                  type="button"
                  onClick={() => setShowSheetModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
                >
                  <FileText className="w-4 h-4" />
                  <span>Show Production sheet</span>
                </button>
              ) : (
                <span className="text-xs text-slate-400 italic">
                  Select Serial Number to preview Production Sheet
                </span>
              )}
            </div>

            {/* ============================================================== */}
            {/* MANDATORY GATE: FABRIC STORE STOCK AVAILABILITY               */}
            {/* "If fabric is available in store then only sheet moves"       */}
            {/* ============================================================== */}
            {selectedProgram && (
              <div
                className={`p-4 rounded-xl border transition-all ${
                  checkingAvailability
                    ? 'bg-slate-50 border-slate-200 text-slate-600'
                    : fabricAvailability?.isAvailable
                    ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 shadow-2xs'
                    : 'bg-rose-50/90 border-rose-300 text-rose-950 shadow-2xs'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        checkingAvailability
                          ? 'bg-slate-200 text-slate-700'
                          : fabricAvailability?.isAvailable
                          ? 'bg-lavender-600 text-white'
                          : 'bg-rose-600 text-white'
                      }`}
                    >
                      {checkingAvailability ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : fabricAvailability?.isAvailable ? (
                        <ShieldCheck className="w-5 h-5" />
                      ) : (
                        <ShieldAlert className="w-5 h-5" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-white/80 border border-current/20">
                          FABRIC STORE GATEWAY
                        </span>
                        {fabricAvailability?.isAvailable ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                            <Check className="w-3 h-3 text-emerald-600" />
                            Fabric Available in Store — Cleared for {destDept} Handoff
                          </span>
                        ) : isStoreHold ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full">
                            <Lock className="w-3 h-3 text-rose-600" />
                            On Hold at Fabric Store — Movement Blocked
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            Sheet fabric not found in stock — each item is checked against its own fabric / colour / unit
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-semibold mt-1">
                        {fabricAvailability?.message ||
                          (checkingAvailability
                            ? 'Checking real-time Fabric Store inventory…'
                            : 'Fabric status check complete.')}
                      </p>

                      <div className="flex items-center gap-3 text-[11px] text-slate-600 mt-1 flex-wrap font-mono">
                        <span>Fabric: <strong>{fabricAvailability?.fabricName || selectedProgram.fabricName || '—'}</strong></span>
                        <span>·</span>
                        <span>Color: <strong>{fabricAvailability?.fabricColor || selectedProgram.fabricColor || 'Natural'}</strong></span>
                        <span>·</span>
                        <span>Store Stock: <strong className={(fabricAvailability?.totalStoreStockMeters > 0 || fabricAvailability?.totalStoreStockPcs > 0) ? 'text-emerald-700' : 'text-rose-700'}>
                          {fabricAvailability?.totalStoreStockMeters ?? 0} MTR / {fabricAvailability?.totalStoreStockPcs ?? 0} PCS
                        </strong></span>
                        <span>·</span>
                        <span>Rolls: <strong>{fabricAvailability?.rollCount ?? 0}</strong></span>
                        <span>·</span>
                        <span>Inward Records: <strong>{fabricAvailability?.inwardEntriesCount ?? 0}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* GATE ACTION CONTROLS */}
                  <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
                    <Link
                      href="/fabric-store/inventory/inward"
                      target="_blank"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold transition shadow-2xs"
                      title="Open Fabric Store Inward form to add incoming fabric stock"
                    >
                      <PackagePlus className="w-3.5 h-3.5 text-teal-700" />
                      <span>Inward Stock</span>
                    </Link>

                    {fabricAvailability?.isAvailable ? (
                      <button
                        type="button"
                        disabled={updatingAvailability}
                        onClick={() => handleToggleAvailability(false)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
                        title="Mark fabric out of stock and put production sheet on hold"
                      >
                        <Lock className="w-3.5 h-3.5 text-rose-600" />
                        <span>{updatingAvailability ? 'Saving…' : 'Mark Out of Stock (Hold)'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={updatingAvailability}
                        onClick={() => handleToggleAvailability(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-lavender-600 hover:bg-lavender-700 text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
                        title="Fabric Store Incharge confirms fabric physical presence in store"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{updatingAvailability ? 'Verifying…' : 'Confirm Fabric in Store'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* LINE BY LINE FORM FIELDS */}
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
                    onChange={(e) => {
                      setChallanNumber(e.target.value);
                      setChallanNumberError(null);
                    }}
                    required
                    maxLength={64}
                    autoComplete="off"
                    placeholder="Enter challan number"
                    aria-invalid={Boolean(challanNumberError)}
                    className={`w-full text-xs font-mono font-bold text-slate-900 border rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-lavender-600 focus:border-transparent transition placeholder:font-normal placeholder:text-slate-400 ${challanNumberError ? 'border-rose-500' : 'border-slate-300'}`}
                  />
                  {challanNumberError && (
                    <p role="alert" className="mt-1 text-[11px] font-semibold text-rose-600">{challanNumberError}</p>
                  )}
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
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-lavender-600 focus:border-transparent transition"
                  />
                </div>
              </div>

              {/* 3. SOURCE (Fabric store) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                <label className="text-xs font-bold text-slate-700 sm:text-right sm:pr-4">
                  Source (Fabric store)
                </label>
                <div className="sm:col-span-2 max-w-lg">
                  <div className="w-full text-xs font-semibold text-slate-800 border border-slate-200 rounded-lg px-3 py-2 bg-slate-100 flex items-center justify-between">
                    <span>{sourceDept}</span>
                    <span className="text-[10px] font-bold text-teal-800 bg-teal-100 px-2 py-0.5 rounded uppercase">
                      STORE
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. DESTINATION (Dyeing) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                <label className="text-xs font-bold text-slate-700 sm:text-right sm:pr-4">
                  Destination (Dyeing)
                </label>
                <div className="sm:col-span-2 max-w-lg">
                  <div className="w-full text-xs font-semibold text-slate-800 border border-slate-200 rounded-lg px-3 py-2 bg-slate-100 flex items-center justify-between">
                    <span>{destDept}</span>
                    <span className="text-[10px] font-bold text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded uppercase">
                      DYEING
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
                    className="w-full text-xs font-semibold border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-lavender-600 focus:border-transparent transition cursor-pointer"
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
                  Delivery Date
                </label>
                <div className="sm:col-span-2 max-w-lg">
                  <input
                    type="date"
                    value={deliveryDate}
                    min={challanDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-lavender-600 focus:border-transparent transition"
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
                    className="w-full text-xs font-mono font-medium text-slate-900 border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-lavender-600 focus:border-transparent transition"
                  />
                </div>
              </div>

              {/* 8. SERIAL NUMBER (Production Sheet Selector) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                <label className="text-xs font-bold text-slate-700 sm:text-right sm:pr-4">
                  Serial Number <span className="text-rose-500">*</span>
                </label>
                <div className="sm:col-span-2 max-w-lg">
                  <select
                    value={selectedProgramId}
                    onChange={(e) => {
                      const prog = programs.find((p) => p.id === e.target.value);
                      if (prog) handleProgramSelect(prog);
                    }}
                    required
                    className="w-full text-xs font-mono font-bold text-slate-900 border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-lavender-600 focus:border-transparent transition cursor-pointer"
                  >
                    <option value="">Select Production Sheet Serial Number</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.programSerialNo || p.programNumber} — {p.clientName || p.buyerName || 'Buyer'} ({p.mainStyle || p.styleCode || 'Style'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 9. COLOR / FABRIC / MEASUREMENT (Universal Challan Item Component with In/Cut/Out Tracking) */}
              <div className="pt-3 border-t border-slate-200">
                <ColorFabricMeasurementTable
                  items={items}
                  onChange={handleItemsChange}
                  context={challanContext}
                  programId={selectedProgram?.id}
                  currentDepartment="STORE"
                  tracking={storeTracking}
                  onTrackingChange={setStoreTracking}
                  showInOutController={false}
                  rowHints={rowHints}
                />
              </div>

              {/* 10. STORE INCHARGE (Name / Contact) */}
              <div className="pt-3 border-t border-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                  <label className="text-xs font-bold text-slate-700 sm:text-right sm:pr-4">
                    Store Incharge (Name / Contact)
                  </label>
                  <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg">
                    <input
                      type="text"
                      value={storeInchargeName}
                      onChange={(e) => setStoreInchargeName(e.target.value)}
                      placeholder=""
                      className="w-full text-xs font-medium border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-lavender-600 focus:border-transparent transition"
                    />
                    <input
                      type="text"
                      value={storeInchargeContact}
                      onChange={(e) => setStoreInchargeContact(e.target.value)}
                      placeholder=""
                      className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-lavender-600 focus:border-transparent transition"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 11. SUBMIT BUTTON */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-4 flex-wrap">
              <div className="text-xs">
                {isStoreHold || hasStockShortage ? (
                  <span className="text-rose-700 font-bold flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg">
                    <Lock className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      {isStoreHold
                        ? `Handoff locked: production sheet is on hold at Fabric Store.`
                        : `Handoff locked: an item exceeds the available stock for its fabric, colour and unit.`}
                    </span>
                  </span>
                ) : fabricAvailability?.isAvailable ? (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Fabric verified in store. Cleared for dispatch to {destDept}.</span>
                  </span>
                ) : (
                  <span className="text-slate-500 italic">Select program to verify store stock</span>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || isStoreHold || hasStockShortage}
                className={`inline-flex items-center gap-2 px-7 py-3 text-white text-xs font-bold rounded-xl shadow-xs transition ${
                  isStoreHold || hasStockShortage
                    ? 'bg-slate-400 cursor-not-allowed opacity-60'
                    : 'bg-teal-700 hover:bg-teal-800 cursor-pointer'
                }`}
              >
                {submitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-teal-200" />
                ) : isStoreHold || hasStockShortage ? (
                  <Lock className="w-4 h-4" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>
                  {submitting
                    ? 'Submitting Challan...'
                    : isStoreHold || hasStockShortage
                    ? `Movement Blocked — Insufficient Stock / Hold`
                    : `Submit Challan to ${destDept}`}
                </span>
              </button>
            </div>
          </form>
        )}

        {/* ============================================================== */}
        {/* MODAL: MASTER PRODUCTION SHEET TRAVELER                       */}
        {/* ============================================================== */}
        <ProductionSheetPrintModal
          program={selectedProgram}
          isOpen={showSheetModal}
          onClose={() => setShowSheetModal(false)}
        />
      </main>
    </div>
  );
}
