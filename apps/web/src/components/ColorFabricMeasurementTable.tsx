'use client';

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  AlertCircle, 
  RefreshCw, 
  CheckCircle2, 
  ShieldAlert,
  Layers
} from 'lucide-react';

export interface ChallanItemData {
  id: string;
  color: string;
  fabric: string;
  measurement: string | number;
  unit: 'MTR' | 'PCS';
  // Department-specific attributes
  requiredDyeColor?: string;
  requiredDyeQuantity?: string | number;
  actualDyedColor?: string;
  fabricProcessingStatus?: 'Dyed' | 'Undyed';
  colorCode?: string;
  width?: string;
  rollNumber?: string;
  remarks?: string;
}

export type ChallanContext =
  | 'PROGRAMMING_STORE'
  | 'STORE_DYEING'
  | 'STORE_EMBROIDERY'
  | 'DYEING_QC1'
  | 'QC1_EMBROIDERY'
  | 'EMBROIDERY_THREAD_CUTTING'
  | 'GENERIC';

const FABRIC_TRACKING_DEPARTMENTS = new Set([
  'DYEING',
  'QC1',
  'DYEING_QC',
  'EMBROIDERY',
  'THREAD_CUTTING',
  'QC2',
  'WASHING',
  'QC3',
  'QCWASHING',
  'QC_WASHING',
  'RECUTTING',
  'STITCHING',
  'ASSEMBLY',
  'FINISHING',
  'STEAM_PRESS',
  'FINAL_CHECK',
  'PACKING',
]);

export interface DepartmentInOutTracking {
  fabricIn: number;
  fabricOut: number;
  fabricUnit: 'MTR' | 'PCS';
  defectivePieces: number;
  defectiveShelfLocation: string;
  defectReason: string;
  detectedFromDept?: string | null;
  detectedFromChallanId?: string | null;
  detectedFromChallanNumber?: string | null;
}

export interface ColorFabricMeasurementTableProps {
  items: ChallanItemData[];
  onChange: (items: ChallanItemData[]) => void;
  context?: ChallanContext;
  readOnly?: boolean;
  errors?: Record<string, string>;
  // Dynamic Department In/Out Tracking props
  programId?: string;
  currentDepartment?: string;
  tracking?: Partial<DepartmentInOutTracking>;
  onTrackingChange?: (tracking: DepartmentInOutTracking) => void;
  showInOutController?: boolean;
  trackingOnly?: boolean;
  onSyncToItems?: (fabricOut: number, fabricUnit: 'MTR' | 'PCS') => void;
}

export function createBlankChallanItem(context?: ChallanContext): ChallanItemData {
  const item: ChallanItemData = {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    color: '',
    fabric: '',
    measurement: '',
    unit: 'MTR',
  };

  if (context === 'STORE_DYEING') {
    item.requiredDyeColor = '';
    item.requiredDyeQuantity = '';
  } else if (context === 'STORE_EMBROIDERY') {
    item.fabricProcessingStatus = 'Undyed';
  } else if (context === 'QC1_EMBROIDERY') {
    item.fabricProcessingStatus = 'Dyed';
  }

  return item;
}

export function getDeptDefaultShelf(dept?: string): string {
  if (!dept) return 'DEF-SHELF-STORE (Fabric Store Quarantined Shelf)';
  const d = dept.toUpperCase();
  if (d.includes('QC1') || d.includes('DYEING QC') || d.includes('DYE QC'))
    return 'DEF-SHELF-QC1 (Dyeing QC Defective Shelf)';
  if (d.includes('DYE')) return 'DEF-SHELF-DYEING (Dyeing Station Defective Shelf)';
  if (d.includes('EMB')) return 'DEF-SHELF-EMBROIDERY (Embroidery Station Defective Shelf)';
  if (d.includes('QC2') || d.includes('THREAD CUT QC') || d.includes('THREAD CUTTING QC'))
    return 'DEF-SHELF-QC2 (Thread Cut QC Defective Shelf)';
  if (d.includes('THREAD') || d.includes('CUTTING') || d.includes('THC'))
    return 'DEF-SHELF-THREAD-CUTTING (Thread Cutting Trimming Shelf)';
  if (d.includes('QC3') || d.includes('WASHING QC') || d.includes('WASH QC'))
    return 'DEF-SHELF-QC3 (Washing QC Defective Shelf)';
  if (d.includes('FINAL') || d.includes('FINAL_CHECK') || d.includes('FINAL CHECK'))
    return 'DEF-SHELF-FINAL-CHECK (Final check Defective Shelf)';
  return 'DEF-SHELF-STORE (Fabric Store Quarantined Shelf)';
}

export function createDepartmentInOutTracking(
  currentDepartment?: string,
  values: Partial<DepartmentInOutTracking> = {}
): DepartmentInOutTracking {
  const fabricIn = Math.max(0, Number(values.fabricIn) || 0);
  const defectivePieces = Math.max(0, Math.min(fabricIn, Number(values.defectivePieces) || 0));
  const fabricUnit = values.fabricUnit || 'PCS';

  return {
    fabricIn,
    fabricOut: values.fabricOut ?? Math.max(0, fabricIn - defectivePieces),
    fabricUnit,
    defectivePieces,
    defectiveShelfLocation: values.defectiveShelfLocation || getDeptDefaultShelf(currentDepartment),
    defectReason: values.defectReason || 'Broken Stitch / Needle Holes',
    detectedFromDept: values.detectedFromDept ?? null,
    detectedFromChallanId: values.detectedFromChallanId ?? null,
    detectedFromChallanNumber: values.detectedFromChallanNumber ?? null,
  };
}

export function ColorFabricMeasurementTable({
  items,
  onChange,
  context = 'GENERIC',
  readOnly = false,
  errors = {},
  programId,
  currentDepartment,
  tracking: externalTracking,
  onTrackingChange,
  showInOutController = true,
  trackingOnly = false,
  onSyncToItems,
}: ColorFabricMeasurementTableProps) {
  // Local In/Out Tracking State
  const sumOfItems = items.reduce(
    (sum, it) => sum + (Number(it.measurement) || 0),
    0
  );
  const defaultUnit = items[0]?.unit || 'MTR';

  const [fabricIn, setFabricIn] = useState<number>(() => {
    if (externalTracking?.fabricIn !== undefined) return externalTracking.fabricIn;
    return sumOfItems > 0 ? sumOfItems : 0;
  });

  const [fabricUnit, setFabricUnit] = useState<'MTR' | 'PCS'>(() => {
    return externalTracking?.fabricUnit || defaultUnit;
  });

  const [defectivePieces, setDefectivePieces] = useState<number>(() => {
    return externalTracking?.defectivePieces || 0;
  });

  const [defectiveShelfLocation, setDefectiveShelfLocation] = useState<string>(() => {
    return externalTracking?.defectiveShelfLocation || getDeptDefaultShelf(currentDepartment);
  });

  const [defectReason, setDefectReason] = useState<string>(() => {
    return externalTracking?.defectReason || 'Broken Stitch / Needle Holes';
  });

  const [detectedFromDept, setDetectedFromDept] = useState<string | null>(() => {
    return externalTracking?.detectedFromDept || null;
  });

  const [detectedFromChallanNumber, setDetectedFromChallanNumber] = useState<string | null>(() => {
    return externalTracking?.detectedFromChallanNumber || null;
  });

  const [detectedFromChallanId, setDetectedFromChallanId] = useState<string | null>(() => {
    return externalTracking?.detectedFromChallanId || null;
  });

  const [autoDetecting, setAutoDetecting] = useState(false);
  const [autoDetectMessage, setAutoDetectMessage] = useState<string | null>(null);
  const normalizedDepartment = (currentDepartment || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  const trackingControllerVisible =
    showInOutController &&
    FABRIC_TRACKING_DEPARTMENTS.has(normalizedDepartment);

  // Derived Fabric Out = In - Defective
  const fabricOut = Math.max(0, Number((fabricIn - defectivePieces).toFixed(2)));

  // Emit tracking changes upward
  useEffect(() => {
    if (trackingControllerVisible && onTrackingChange) {
      onTrackingChange({
        fabricIn,
        fabricOut,
        fabricUnit,
        defectivePieces,
        defectiveShelfLocation,
        defectReason,
        detectedFromDept,
        detectedFromChallanId,
        detectedFromChallanNumber,
      });
    }
  }, [
    fabricIn,
    fabricOut,
    fabricUnit,
    defectivePieces,
    defectiveShelfLocation,
    defectReason,
    detectedFromDept,
    detectedFromChallanId,
    detectedFromChallanNumber,
    trackingControllerVisible,
  ]);

  // Sync external tracking changes if passed
  useEffect(() => {
    if (externalTracking) {
      if (externalTracking.fabricIn !== undefined && externalTracking.fabricIn !== fabricIn) {
        setFabricIn(externalTracking.fabricIn);
      }
      if (externalTracking.fabricUnit && externalTracking.fabricUnit !== fabricUnit) {
        setFabricUnit(externalTracking.fabricUnit);
      }
      if (externalTracking.defectivePieces !== undefined && externalTracking.defectivePieces !== defectivePieces) {
        setDefectivePieces(externalTracking.defectivePieces);
      }
      if (externalTracking.defectiveShelfLocation && externalTracking.defectiveShelfLocation !== defectiveShelfLocation) {
        setDefectiveShelfLocation(externalTracking.defectiveShelfLocation);
      }
      if (externalTracking.defectReason && externalTracking.defectReason !== defectReason) {
        setDefectReason(externalTracking.defectReason);
      }
      if (externalTracking.detectedFromDept !== undefined) {
        setDetectedFromDept(externalTracking.detectedFromDept);
      }
      if (externalTracking.detectedFromChallanNumber !== undefined) {
        setDetectedFromChallanNumber(externalTracking.detectedFromChallanNumber);
      }
      if (externalTracking.detectedFromChallanId !== undefined) {
        setDetectedFromChallanId(externalTracking.detectedFromChallanId);
      }
    }
  }, [externalTracking]);

  // Automatic detection when programId or department changes
  const runAutoDetection = async (progId?: string, dept?: string) => {
    const targetProg = progId || programId;
    const targetDept = dept || currentDepartment;
    if (!targetProg) return;

    try {
      setAutoDetecting(true);
      setAutoDetectMessage(null);
      const url = `/api/challans/auto-detect?programId=${encodeURIComponent(targetProg)}&department=${encodeURIComponent(targetDept || '')}`;
      const res = await fetch(url);
      const json = await res.json();

      if (json.success && json.data) {
        const d = json.data;
        if (d.detectedFabricIn > 0 || d.detectedFromDepartment) {
          setFabricIn(Number(d.detectedFabricIn) || 0);
          if (d.detectedUnit) setFabricUnit(d.detectedUnit);
          setDetectedFromDept(d.detectedFromDepartment);
          setDetectedFromChallanId(d.detectedFromChallanId);
          setDetectedFromChallanNumber(d.detectedFromChallanNumber);

          setAutoDetectMessage(
            `Auto-detected ${d.detectedFabricIn} ${d.detectedUnit || 'MTR'} from ${d.detectedFromDepartment || 'predecessor'}${d.detectedFromChallanNumber ? ` (${d.detectedFromChallanNumber})` : ''}!`
          );

          // Update items measurement if only 1 item exists with empty or default measurement
          if (items.length === 1 && (!items[0].measurement || items[0].measurement === '0' || Number(items[0].measurement) === 0)) {
            const updated = [...items];
            updated[0] = {
              ...updated[0],
              measurement: d.detectedFabricIn,
              unit: d.detectedUnit || 'MTR',
            };
            onChange(updated);
          }
        }
      }
    } catch (err) {
      console.error('Auto detection error:', err);
    } finally {
      setAutoDetecting(false);
    }
  };

  useEffect(() => {
    if (trackingControllerVisible && programId && !externalTracking?.fabricIn) {
      runAutoDetection(programId, currentDepartment);
    }
  }, [trackingControllerVisible, programId, currentDepartment]);

  // Sync fabricOut to first item measurement or distribute
  const handleSyncToItems = () => {
    if (readOnly) return;
    onSyncToItems?.(fabricOut, fabricUnit);
    if (items.length === 0) return;
    const updated = [...items];
    if (updated.length === 1) {
      updated[0] = { ...updated[0], measurement: fabricOut, unit: fabricUnit };
    }
    onChange(updated);
  };

  const handleAddItem = () => {
    if (readOnly) return;
    onChange([...items, createBlankChallanItem(context)]);
  };

  const handleAddColorMeasurement = (index: number) => {
    if (readOnly) return;
    const sourceItem = items[index];
    const colorItem = {
      ...createBlankChallanItem(context),
      fabric: sourceItem.fabric,
      width: sourceItem.width,
      colorCode: sourceItem.colorCode,
    };
    onChange([
      ...items.slice(0, index + 1),
      colorItem,
      ...items.slice(index + 1),
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (readOnly) return;
    if (items.length <= 1) {
      alert('A challan must contain at least one item.');
      return;
    }
    onChange(items.filter((_, i) => i !== index));
  };

  const handleFieldChange = (index: number, field: keyof ChallanItemData, value: any) => {
    if (readOnly) return;
    const updated = items.map((item, i) => (i === index ? { ...item, [field]: value } : item));
    onChange(updated);
  };

  const showRequiredDyeColor = context === 'STORE_DYEING' || context === 'DYEING_QC1';
  const showRequiredDyeQty = context === 'STORE_DYEING';
  const showActualDyedColor = context === 'DYEING_QC1';
  const showProcessingStatus =
    context === 'STORE_EMBROIDERY' ||
    context === 'QC1_EMBROIDERY' ||
    context === 'EMBROIDERY_THREAD_CUTTING';

  return (
    <div className="space-y-4">
      {/* 1. DEPARTMENT FABRIC / PIECE TRACKING CONTROLLER */}
      {trackingControllerVisible && (
        <div className="bg-slate-900 text-white rounded-xl p-4 border border-slate-700/60 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Fabric Tracking
              </span>
              {detectedFromDept && (
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  {detectedFromDept}
                </span>
              )}
            </div>

            {programId && !readOnly && (
              <button
                type="button"
                onClick={() => runAutoDetection()}
                disabled={autoDetecting}
                className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded border border-slate-700 transition cursor-pointer"
                title="Sync from previous department"
              >
                <RefreshCw className={`w-3 h-3 ${autoDetecting ? 'animate-spin text-amber-400' : ''}`} />
                <span>{autoDetecting ? 'Syncing...' : 'Sync'}</span>
              </button>
            )}
          </div>

          {autoDetectMessage && (
            <div className="px-2.5 py-1 bg-emerald-950/60 border border-emerald-500/30 rounded text-xs text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
              <span>{autoDetectMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* IN */}
            <div className="bg-slate-800/90 border border-slate-700/70 rounded-lg p-3 space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                In
              </div>
              <div className="flex items-center gap-2">
                {readOnly ? (
                  <div className="text-xl font-mono font-bold text-white py-1">
                    {fabricIn} <span className="text-xs text-slate-400 font-normal">{fabricUnit}</span>
                  </div>
                ) : (
                  <>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={fabricIn}
                      onChange={(e) => setFabricIn(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm font-mono font-bold text-white focus:outline-none focus:border-slate-400"
                      placeholder="0"
                    />
                    <select
                      value={fabricUnit}
                      onChange={(e) => setFabricUnit(e.target.value as 'MTR' | 'PCS')}
                      className="px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs font-bold text-slate-200 focus:outline-none cursor-pointer"
                    >
                      <option value="MTR">MTR</option>
                      <option value="PCS">PCS</option>
                    </select>
                  </>
                )}
              </div>
            </div>

            {/* DEFECTIVE */}
            <div className="bg-slate-800/90 border border-slate-700/70 rounded-lg p-3 space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
                Defective
              </div>
              <div className="flex items-center gap-2">
                {readOnly ? (
                  <div className="text-xl font-mono font-bold text-rose-300 py-1">
                    {defectivePieces} <span className="text-xs text-rose-400 font-normal">{fabricUnit}</span>
                  </div>
                ) : (
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max={fabricIn}
                    value={defectivePieces}
                    onChange={(e) => setDefectivePieces(Math.max(0, Math.min(fabricIn, parseFloat(e.target.value) || 0)))}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm font-mono font-bold text-rose-300 focus:outline-none focus:border-rose-400"
                    placeholder="0"
                  />
                )}
              </div>

              {defectivePieces > 0 && !readOnly && (
                <div className="space-y-1.5 pt-1">
                  <select
                    value={defectReason}
                    onChange={(e) => setDefectReason(e.target.value)}
                    className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-rose-200 focus:outline-none cursor-pointer"
                  >
                    <option value="Broken Stitch / Needle Holes">Broken Stitch / Needle Holes</option>
                    <option value="Fabric Stain / Oil Marks">Fabric Stain / Oil Marks</option>
                    <option value="Shade Variation / Uneven Dyeing">Shade Variation / Uneven Dyeing</option>
                    <option value="Selvage / Border Chew / Knife Cut">Selvage / Border Chew / Knife Cut</option>
                    <option value="Weaving Slub / Fabric Tear">Weaving Slub / Fabric Tear</option>
                    <option value="Thread Drop / Tension Knot">Thread Drop / Tension Knot</option>
                    <option value="Other Defectiveness">Other Process Defect</option>
                  </select>

                  <select
                    value={defectiveShelfLocation}
                    onChange={(e) => setDefectiveShelfLocation(e.target.value)}
                    className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-amber-300 focus:outline-none cursor-pointer"
                  >
                    {currentDepartment && (
                      <option value={getDeptDefaultShelf(currentDepartment)}>
                        {getDeptDefaultShelf(currentDepartment)} (Dept Shelf)
                      </option>
                    )}
                    <option value="DEF-SHELF-CENTRAL (Fabric Store Master Defective Shelf)">
                      DEF-SHELF-CENTRAL (Store Master)
                    </option>
                    <option value="DEF-SHELF-STORE (Fabric Store Quarantined Shelf)">
                      DEF-SHELF-STORE (Quarantine)
                    </option>
                    <option value="DEF-SHELF-DYEING (Dyeing Station Defective Shelf)">
                      DEF-SHELF-DYEING (Dyeing)
                    </option>
                    <option value="DEF-SHELF-QC1 (Dyeing QC Defective Shelf)">
                      DEF-SHELF-QC1 (QC1)
                    </option>
                    <option value="DEF-SHELF-EMBROIDERY (Embroidery Station Defective Shelf)">
                      DEF-SHELF-EMBROIDERY (Embroidery)
                    </option>
                    <option value="DEF-SHELF-THREAD-CUTTING (Thread Cutting Trimming Shelf)">
                      DEF-SHELF-THREAD-CUTTING (Thread Cut)
                    </option>
                    <option value="DEF-SHELF-QC2 (Thread Cut QC Defective Shelf)">
                      DEF-SHELF-QC2 (QC2)
                    </option>
                    <option value="DEF-SHELF-QC3 (Washing QC Defective Shelf)">
                      DEF-SHELF-QC3 (QC3)
                    </option>
                    <option value="DEF-SHELF-FINAL-CHECK (Final check Defective Shelf)">
                      DEF-SHELF-FINAL-CHECK (Final Check)
                    </option>
                  </select>
                </div>
              )}
            </div>

            {/* OUT */}
            <div className="bg-slate-800/90 border border-slate-700/70 rounded-lg p-3 space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                Out
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="text-xl font-mono font-bold text-emerald-300 py-1">
                  {fabricOut} <span className="text-xs text-emerald-400 font-normal">{fabricUnit}</span>
                </div>

                {!readOnly && (
                  <button
                    type="button"
                    onClick={handleSyncToItems}
                    className="px-2 py-1 bg-emerald-700 hover:bg-emerald-600 text-white text-[10px] font-bold rounded transition cursor-pointer"
                    title="Populate table items"
                  >
                    Sync to Items
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`space-y-4 ${trackingOnly ? 'hidden' : ''}`}>
      {/* 2. HEADER SECTION WITH TITLE AND ADD ITEM BUTTON */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
              COLOR / FABRIC / MEASUREMENT SPECIFICATIONS
            </span>
            <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
              {items.length} {items.length === 1 ? 'Item' : 'Items'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Specify color, fabric composition, exact measurement, and unit (meters or pieces).
          </p>
        </div>

        {!readOnly && (
          <button
            type="button"
            onClick={handleAddItem}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs transition shrink-0 self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Item</span>
          </button>
        )}
      </div>

      {/* 3. ITEMS TABLE */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                <th className="py-2.5 px-3 min-w-[140px]">
                  Fabric Name / Spec <span className="text-rose-500">*</span>
                </th>
                <th className="py-2.5 px-3 min-w-[120px]">
                  {context === 'STORE_DYEING' ? 'Base / Current Color' : 'Color / Shade'}{' '}
                  <span className="text-rose-500">*</span>
                </th>
                {showRequiredDyeColor && (
                  <th className="py-2.5 px-3 min-w-[120px]">
                    Required Dye Color <span className="text-rose-500">*</span>
                  </th>
                )}
                {showActualDyedColor && (
                  <th className="py-2.5 px-3 min-w-[120px]">
                    Actual Dyed Color <span className="text-rose-500">*</span>
                  </th>
                )}
                {showProcessingStatus && (
                  <th className="py-2.5 px-3 w-28">Status</th>
                )}
                <th className="py-2.5 px-3 w-32">
                  {context === 'QC1_EMBROIDERY'
                    ? 'Passed Measurement'
                    : context === 'STORE_DYEING'
                    ? 'Fabric Qty Issued'
                    : 'Measurement / Qty'}{' '}
                  <span className="text-rose-500">*</span>
                </th>
                {showRequiredDyeQty && (
                  <th className="py-2.5 px-3 w-32">
                    Required Qty to Dye <span className="text-rose-500">*</span>
                  </th>
                )}
                <th className="py-2.5 px-3 w-24">
                  Unit <span className="text-rose-500">*</span>
                </th>
                <th className="py-2.5 px-3 min-w-[130px]">Remarks / Roll #</th>
                {!readOnly && (
                  <th className="py-2.5 px-3 w-12 text-center">Action</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, idx) => {
                const itemError = errors[`item_${idx}`];
                return (
                  <tr key={item.id || idx} className="hover:bg-slate-50/60 transition">
                    <td className="py-2 px-3 text-center text-slate-400 font-mono font-bold">
                      {idx + 1}
                    </td>

                    {/* FABRIC */}
                    <td className="py-2 px-3">
                      {readOnly ? (
                        <span className="font-semibold text-slate-900">{item.fabric || '—'}</span>
                      ) : (
                        <input
                          type="text"
                          required
                          value={item.fabric}
                          onChange={(e) => handleFieldChange(idx, 'fabric', e.target.value)}
                          onFocus={(e) => e.target.select()}
                          placeholder=""
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition"
                        />
                      )}
                    </td>

                    {/* COLOR */}
                    <td className="py-2 px-3">
                      {readOnly ? (
                        <span className="text-slate-800">{item.color || '—'}</span>
                      ) : (
                        <div className="space-y-1.5">
                          <input
                            type="text"
                            required
                            value={item.color}
                            onChange={(e) => handleFieldChange(idx, 'color', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            placeholder=""
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddColorMeasurement(idx)}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 hover:text-slate-900 transition cursor-pointer whitespace-nowrap"
                            title="Add another color with its own measurement"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add Color &amp; Measurement</span>
                          </button>
                        </div>
                      )}
                    </td>

                    {/* REQUIRED DYE COLOR (Dyeing / QC1) */}
                    {showRequiredDyeColor && (
                      <td className="py-2 px-3">
                        {readOnly ? (
                          <span className="font-semibold text-purple-900">{item.requiredDyeColor || '—'}</span>
                        ) : (
                          <input
                            type="text"
                            required
                            value={item.requiredDyeColor || ''}
                            onChange={(e) => handleFieldChange(idx, 'requiredDyeColor', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            placeholder=""
                            className="w-full px-2.5 py-1.5 bg-white border border-purple-300 rounded-lg text-xs font-semibold text-purple-950 focus:outline-none focus:ring-1 focus:ring-purple-600 transition"
                          />
                        )}
                      </td>
                    )}

                    {/* ACTUAL DYED COLOR (Dyeing to QC1) */}
                    {showActualDyedColor && (
                      <td className="py-2 px-3">
                        {readOnly ? (
                          <span className="font-semibold text-slate-900">{item.actualDyedColor || '—'}</span>
                        ) : (
                          <input
                            type="text"
                            required
                            value={item.actualDyedColor || ''}
                            onChange={(e) => handleFieldChange(idx, 'actualDyedColor', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            placeholder=""
                            className="w-full px-2.5 py-1.5 bg-white border border-purple-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-600 transition"
                          />
                        )}
                      </td>
                    )}

                    {/* PROCESSING STATUS (Undyed / Dyed) */}
                    {showProcessingStatus && (
                      <td className="py-2 px-3">
                        {readOnly || context === 'STORE_EMBROIDERY' || context === 'QC1_EMBROIDERY' ? (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                              item.fabricProcessingStatus === 'Undyed'
                                ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                : 'bg-purple-100 text-purple-900 border border-purple-200'
                            }`}
                          >
                            {item.fabricProcessingStatus || (context === 'STORE_EMBROIDERY' ? 'Undyed' : 'Dyed')}
                          </span>
                        ) : (
                          <select
                            value={item.fabricProcessingStatus || 'Dyed'}
                            onChange={(e) =>
                              handleFieldChange(idx, 'fabricProcessingStatus', e.target.value as 'Dyed' | 'Undyed')
                            }
                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 transition cursor-pointer"
                          >
                            <option value="Dyed">Dyed</option>
                            <option value="Undyed">Undyed</option>
                          </select>
                        )}
                      </td>
                    )}

                    {/* MEASUREMENT / QUANTITY */}
                    <td className="py-2 px-3">
                      {readOnly ? (
                        <span className="font-mono font-bold text-slate-900">{item.measurement || '0'}</span>
                      ) : (
                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          required
                          value={item.measurement}
                          onChange={(e) => handleFieldChange(idx, 'measurement', e.target.value)}
                          onFocus={(e) => e.target.select()}
                          placeholder="0.00"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition"
                        />
                      )}
                    </td>

                    {/* REQUIRED DYE QUANTITY (Store to Dyeing) */}
                    {showRequiredDyeQty && (
                      <td className="py-2 px-3">
                        {readOnly ? (
                          <span className="font-mono font-bold text-purple-900">{item.requiredDyeQuantity || item.measurement || '0'}</span>
                        ) : (
                          <input
                            type="number"
                            step="any"
                            min="0.01"
                            required
                            value={item.requiredDyeQuantity || ''}
                            onChange={(e) => handleFieldChange(idx, 'requiredDyeQuantity', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            placeholder="0.00"
                            className="w-full px-2.5 py-1.5 bg-white border border-purple-300 rounded-lg text-xs font-mono font-bold text-purple-950 focus:outline-none focus:ring-1 focus:ring-purple-600 transition"
                          />
                        )}
                      </td>
                    )}

                    {/* UNIT (MTR or PCS strictly) */}
                    <td className="py-2 px-3">
                      {readOnly ? (
                        <span className="font-bold text-slate-700">{item.unit || 'MTR'}</span>
                      ) : (
                        <select
                          value={item.unit || 'MTR'}
                          onChange={(e) => handleFieldChange(idx, 'unit', e.target.value as 'MTR' | 'PCS')}
                          className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 transition cursor-pointer"
                        >
                          <option value="MTR">MTR (Meters)</option>
                          <option value="PCS">PCS (Pieces)</option>
                        </select>
                      )}
                    </td>

                    {/* REMARKS */}
                    <td className="py-2 px-3">
                      {readOnly ? (
                        <span className="text-slate-600">{item.remarks || '—'}</span>
                      ) : (
                        <input
                          type="text"
                          value={item.remarks || ''}
                          onChange={(e) => handleFieldChange(idx, 'remarks', e.target.value)}
                          onFocus={(e) => e.target.select()}
                          placeholder=""
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-900 transition"
                        />
                      )}
                    </td>

                    {/* ACTION: REMOVE */}
                    {!readOnly && (
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </div>
      </div>
    </div>
  );
}
