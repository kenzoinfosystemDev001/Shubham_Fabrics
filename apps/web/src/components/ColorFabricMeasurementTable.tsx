'use client';

import React, { useState, useEffect } from 'react';
import { averageText, formatTotals, unitQuantityText } from '@/lib/challan-units.mjs';
import { QuantityUnitField } from '@/components/challan/AverageField';
import { 
  Plus, 
  Trash2, 
  AlertCircle, 
  RefreshCw, 
  CheckCircle2, 
  ShieldAlert,
  Layers,
  CopyPlus
} from 'lucide-react';

// Shared input style for the items table; dye-specific fields add a light lavender tint.
const FIELD_BASE =
  'w-full h-9 px-3 border rounded-lg text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition';
const FIELD = `${FIELD_BASE} bg-white border-neutral-200 hover:border-neutral-300`;
const DYE_FIELD = `${FIELD_BASE} bg-brand-50/60 border-brand-200 hover:border-brand-300`;
const REQUIRED = <span className="text-danger-500 ml-0.5" aria-hidden="true">*</span>;

export interface ChallanItemData {
  id: string;
  color: string;
  fabric: string;
  measurement: string | number;
  /** '' until the user picks MTR or PCS; new lines never default to a unit. */
  unit: 'MTR' | 'PCS' | '';
  // Department-specific attributes
  requiredDyeColor?: string;
  requiredDyeQuantity?: string | number;
  actualDyedColor?: string;
  fabricProcessingStatus?: 'Dyed' | 'Undyed';
  colorCode?: string;
  width?: string;
  rollNumber?: string;
  /** Optional Average entered with the entry (saved on the challan line). */
  average?: string | number;
  /** Unit of the Average; required once an Average is entered, never pre-selected. */
  averageUnit?: 'MTR' | 'PCS' | '';
  /** Unit quantity entered with the entry (saved on the challan line), with its own unit, never pre-selected. */
  unitQuantity?: string | number;
  unitQuantityUnit?: 'MTR' | 'PCS' | '';
  remarks?: string;
  /** Screen only (never saved): lines of the same fabric card. Lines without it group by fabric name. */
  group?: string;
  /** Screen only (never saved): entries of the same colour within a card. Lines without it group by colour name. */
  colourGroup?: string;
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
    unit: '',
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
    return 'DEF-SHELF-QC2 (Threadcut QC Defective Shelf)';
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
  // Local In/Out Tracking State. The tracking panel is in one unit; only lines in that unit count
  // towards it (meters and pieces are never added together).
  const defaultUnit = items.find((it) => it.unit)?.unit || 'MTR';
  const sumOfItems = items.reduce(
    (sum, it) => sum + (it.unit === defaultUnit ? Number(it.measurement) || 0 : 0),
    0
  );

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
        // A predecessor with MTR and PCS lines has no single "in" quantity: the panel takes the
        // quantity in its own unit from detectedTotals; nothing is converted.
        const detectedIn = d.detectedUnit ? Number(d.detectedFabricIn) || 0 : Number(d.detectedTotals?.[fabricUnit]) || 0;
        if (detectedIn > 0 || d.detectedFromDepartment) {
          setFabricIn(detectedIn);
          if (d.detectedUnit) setFabricUnit(d.detectedUnit);
          setDetectedFromDept(d.detectedFromDepartment);
          setDetectedFromChallanId(d.detectedFromChallanId);
          setDetectedFromChallanNumber(d.detectedFromChallanNumber);

          setAutoDetectMessage(
            `Auto-detected ${d.detectedUnit ? `${d.detectedFabricIn} ${d.detectedUnit}` : formatTotals(d.detectedTotals || {})} from ${d.detectedFromDepartment || 'predecessor'}${d.detectedFromChallanNumber ? ` (${d.detectedFromChallanNumber})` : ''}!`
          );

          // Update items measurement if only 1 item exists with empty or default measurement (single-unit predecessor only)
          if (d.detectedUnit && items.length === 1 && (!items[0].measurement || items[0].measurement === '0' || Number(items[0].measurement) === 0)) {
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

  // Fabric cards: one fabric, any number of colours, each colour any number of entries (quantity, unit,
  // remarks / roll #). The saved data stays one line per entry; a line's fabric and colour place it in
  // its card and colour group, so reopening a challan rebuilds the same hierarchy.
  const cardKeyOf = (item: ChallanItemData) =>
    item.group || (item.fabric.trim() ? `fabric:${item.fabric.trim().toLowerCase()}` : item.id);
  const cards: Array<{ key: string; lines: Array<{ item: ChallanItemData; index: number }> }> = [];
  items.forEach((item, index) => {
    const key = cardKeyOf(item);
    let card = cards.find((c) => c.key === key);
    if (!card) {
      card = { key, lines: [] };
      cards.push(card);
    }
    card.lines.push({ item, index });
  });
  const newCardKey = () => `fabric-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  // Every edit pins the card key on its lines, so renaming a fabric never splits its colours apart.
  const replaceCard = (cardIndex: number, lines: ChallanItemData[]) =>
    onChange(cards.flatMap((c, i) => (i === cardIndex ? lines : c.lines.map((l) => l.item))));
  const pinned = (cardIndex: number) => cards[cardIndex].lines.map((l) => ({ ...l.item, group: cards[cardIndex].key }));

  const handleAddItem = () => {
    if (readOnly) return;
    const newItem = createBlankChallanItem(context);
    newItem.group = newCardKey();
    onChange([...items, newItem]);
  };

  const handleFabricNameChange = (cardIndex: number, value: string) => {
    if (readOnly) return;
    replaceCard(cardIndex, pinned(cardIndex).map((item) => ({ ...item, fabric: value })));
  };

  // Width belongs to the fabric: every line of this fabric card takes it (other fabrics keep their own).
  const handleFabricWidthChange = (cardIndex: number, value: string) => {
    if (readOnly) return;
    replaceCard(cardIndex, pinned(cardIndex).map((item) => ({ ...item, width: value })));
  };

  const colourKeyOf = (item: ChallanItemData) =>
    item.colourGroup || (item.color.trim() ? `colour:${item.color.trim().toLowerCase()}` : item.id);
  const colourGroupsOf = (lines: Array<{ item: ChallanItemData; index: number }>) => {
    const groups: Array<{ key: string; entries: Array<{ item: ChallanItemData; index: number }> }> = [];
    for (const line of lines) {
      const key = colourKeyOf(line.item);
      let group = groups.find((g) => g.key === key);
      if (!group) {
        group = { key, entries: [] };
        groups.push(group);
      }
      group.entries.push(line);
    }
    return groups;
  };
  const newColourKey = () => `colour-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  /** The card's lines with card and colour keys pinned, so renaming a colour never splits its entries. */
  const pinnedWithColours = (cardIndex: number) =>
    pinned(cardIndex).map((item) => ({ ...item, colourGroup: colourKeyOf(item) }));

  const handleAddColour = (cardIndex: number) => {
    if (readOnly) return;
    const lines = pinnedWithColours(cardIndex);
    const last = lines[lines.length - 1];
    replaceCard(cardIndex, [
      ...lines,
      {
        ...createBlankChallanItem(context),
        group: cards[cardIndex].key,
        colourGroup: newColourKey(),
        fabric: last.fabric,
        width: last.width,
        colorCode: last.colorCode,
      },
    ]);
  };

  /** A new blank entry (quantity, unit, remarks) under one colour; the unit is never copied. */
  const handleAddEntry = (cardIndex: number, colourKey: string) => {
    if (readOnly) return;
    const lines = pinnedWithColours(cardIndex);
    const lastAt = lines.map((l) => l.colourGroup).lastIndexOf(colourKey);
    const source = lines[lastAt];
    const entry: ChallanItemData = {
      ...createBlankChallanItem(context),
      group: cards[cardIndex].key,
      colourGroup: colourKey,
      fabric: source.fabric,
      width: source.width,
      colorCode: source.colorCode,
      color: source.color,
      requiredDyeColor: source.requiredDyeColor,
      actualDyedColor: source.actualDyedColor,
      fabricProcessingStatus: source.fabricProcessingStatus,
    };
    replaceCard(cardIndex, [...lines.slice(0, lastAt + 1), entry, ...lines.slice(lastAt + 1)]);
  };

  /** Colour-level fields (colour, dye colour, status) are shared by every entry of that colour. */
  const handleColourFieldChange = (cardIndex: number, colourKey: string, field: keyof ChallanItemData, value: any) => {
    if (readOnly) return;
    replaceCard(
      cardIndex,
      pinnedWithColours(cardIndex).map((item) => (item.colourGroup === colourKey ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveColour = (cardIndex: number, colourKey: string) => {
    if (readOnly) return;
    const lines = pinnedWithColours(cardIndex);
    const remaining = lines.filter((item) => item.colourGroup !== colourKey);
    if (remaining.length === 0) {
      handleRemoveFabric(cardIndex);
      return;
    }
    const removed = lines.length - remaining.length;
    if (removed > 1 && !confirm(`Remove this colour and its ${removed} entries?`)) return;
    replaceCard(cardIndex, remaining);
  };

  const handleRemoveItem = (index: number) => {
    if (readOnly) return;
    if (items.length <= 1) {
      alert('A challan must contain at least one item.');
      return;
    }
    onChange(items.filter((_, i) => i !== index));
  };

  const handleRemoveFabric = (cardIndex: number) => {
    if (readOnly) return;
    if (cards.length <= 1) {
      alert('A challan must contain at least one fabric.');
      return;
    }
    const lines = cards[cardIndex].lines;
    if (lines.length > 1 && !confirm(`Remove this fabric and its ${lines.length} colours?`)) return;
    onChange(cards.filter((_, i) => i !== cardIndex).flatMap((c) => c.lines.map((l) => l.item)));
  };

  /** "120 MTR · 40 PCS" for a card (units are never added together). */
  const cardTotal = (lines: Array<{ item: ChallanItemData }>) => {
    const totals: Record<string, number> = {};
    for (const { item } of lines) {
      if (item.unit) totals[item.unit] = (totals[item.unit] || 0) + (Number(item.measurement) || 0);
    }
    return Object.entries(totals)
      .filter(([, q]) => q > 0)
      .map(([u, q]) => `${Number(q.toFixed(2)).toLocaleString('en-IN')} ${u}`)
      .join(' · ');
  };

  const handleFieldChange = (index: number, field: keyof ChallanItemData, value: any) => {
    if (readOnly) return;
    const updated = items.map((item, i) => (i === index ? { ...item, [field]: value } : item));
    onChange(updated);
    // Each line keeps its own unit; the tracking panel follows only when every line shares it.
    if (field === 'unit' && updated.every((item) => item.unit === value)) {
      setFabricUnit(value as 'MTR' | 'PCS');
    }
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
        <div className="bg-brand-50 text-neutral-900 rounded-xl p-4 border border-brand-200 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-900">
                Fabric Tracking
              </span>
              {detectedFromDept && (
                <span className="text-[10px] font-mono text-accent-700 bg-accent-400/10 px-1.5 py-0.5 rounded border border-accent-500/20">
                  {detectedFromDept}
                </span>
              )}
            </div>

            {programId && !readOnly && (
              <button
                type="button"
                onClick={() => runAutoDetection()}
                disabled={autoDetecting}
                className="inline-flex items-center gap-1.5 px-2 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-medium rounded border border-neutral-200 transition cursor-pointer"
                title="Sync from previous department"
              >
                <RefreshCw className={`w-3 h-3 ${autoDetecting ? 'animate-spin text-accent-700' : ''}`} />
                <span>{autoDetecting ? 'Syncing...' : 'Sync'}</span>
              </button>
            )}
          </div>

          {autoDetectMessage && (
            <div className="px-2.5 py-1 bg-accent-50 border border-accent-500/30 rounded text-xs text-accent-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-accent-700" />
              <span>{autoDetectMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* IN */}
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                In
              </div>
              <div className="flex items-center gap-2">
                {readOnly ? (
                  <div className="text-xl font-mono font-bold text-neutral-900 py-1">
                    {fabricIn} <span className="text-xs text-neutral-500 font-normal">{fabricUnit}</span>
                  </div>
                ) : (
                  <>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={fabricIn || ''}
                      onChange={(e) => setFabricIn(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full px-2.5 py-1.5 bg-white border border-neutral-300 rounded text-sm font-mono font-bold text-neutral-900 focus:outline-none focus:border-brand-500"
                      placeholder="0"
                    />
                    <select
                      value={fabricUnit}
                      onChange={(e) => setFabricUnit(e.target.value as 'MTR' | 'PCS')}
                      className="px-2 py-1.5 bg-white border border-neutral-200 rounded text-xs font-bold text-neutral-900 focus:outline-none cursor-pointer"
                    >
                      <option value="MTR">MTR</option>
                      <option value="PCS">PCS</option>
                    </select>
                  </>
                )}
              </div>
            </div>

            {/* DEFECTIVE */}
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-danger-600">
                Defective
              </div>
              <div className="flex items-center gap-2">
                {readOnly ? (
                  <div className="text-xl font-mono font-bold text-danger-600 py-1">
                    {defectivePieces} <span className="text-xs text-danger-600 font-normal">{fabricUnit}</span>
                  </div>
                ) : (
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max={fabricIn}
                    value={defectivePieces || ''}
                    onChange={(e) => setDefectivePieces(Math.max(0, Math.min(fabricIn, parseFloat(e.target.value) || 0)))}
                    className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 rounded text-sm font-mono font-bold text-danger-600 focus:outline-none focus:border-danger-500"
                    placeholder="0"
                  />
                )}
              </div>

              {defectivePieces > 0 && !readOnly && (
                <div className="space-y-1.5 pt-1">
                  <select
                    value={defectReason}
                    onChange={(e) => setDefectReason(e.target.value)}
                    className="w-full px-2 py-1 bg-white border border-neutral-200 rounded text-xs text-danger-800 focus:outline-none cursor-pointer"
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
                    className="w-full px-2 py-1 bg-white border border-neutral-200 rounded text-xs font-mono text-accent-700 focus:outline-none cursor-pointer"
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
                      DEF-SHELF-QC1 (Dyeing QC)
                    </option>
                    <option value="DEF-SHELF-EMBROIDERY (Embroidery Station Defective Shelf)">
                      DEF-SHELF-EMBROIDERY (Embroidery)
                    </option>
                    <option value="DEF-SHELF-THREAD-CUTTING (Thread Cutting Trimming Shelf)">
                      DEF-SHELF-THREAD-CUTTING (Thread Cut)
                    </option>
                    <option value="DEF-SHELF-QC2 (Threadcut QC Defective Shelf)">
                      DEF-SHELF-QC2 (Threadcut QC)
                    </option>
                    <option value="DEF-SHELF-QC3 (Washing QC Defective Shelf)">
                      DEF-SHELF-QC3 (Washing QC)
                    </option>
                    <option value="DEF-SHELF-FINAL-CHECK (Final check Defective Shelf)">
                      DEF-SHELF-FINAL-CHECK (Final Check)
                    </option>
                  </select>
                </div>
              )}
            </div>

            {/* OUT */}
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-700">
                Out
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="text-xl font-mono font-bold text-neutral-900 py-1">
                  {fabricOut} <span className="text-xs text-accent-700 font-normal">{fabricUnit}</span>
                </div>

                {!readOnly && (
                  <button
                    type="button"
                    onClick={handleSyncToItems}
                    className="px-2 py-1 bg-accent-500 hover:bg-accent-600 text-neutral-900 text-[10px] font-bold rounded transition cursor-pointer"
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

      <div className={`space-y-3 ${trackingOnly ? 'hidden' : ''}`}>
      {/* 2. HEADER: TITLE, COUNTS, ADD FABRIC */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-neutral-900">Items</h3>
          <span className="text-[11px] font-semibold tabular-nums bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">
            {cards.length} {cards.length === 1 ? 'fabric' : 'fabrics'} · {items.length} {items.length === 1 ? 'colour' : 'colours'}
          </span>
        </div>

        {!readOnly && (
          <button
            type="button"
            onClick={handleAddItem}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-brand-50 text-brand-800 border border-brand-300 text-xs font-semibold rounded-lg transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add fabric</span>
          </button>
        )}
      </div>

      {/* 3. ONE CARD PER FABRIC, ITS COLOURS INSIDE */}
      {cards.map((card, cardIndex) => {
        const first = card.lines[0].item;
        const total = cardTotal(card.lines);
        const colourGroups = colourGroupsOf(card.lines);
        return (
          <div key={card.key} className="border border-neutral-200 rounded-xl bg-white shadow-xs overflow-hidden">
            {/* Fabric heading */}
            <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-200 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-lg bg-brand-50 border border-brand-100 text-[11px] font-bold text-brand-800 tabular-nums">
                {cardIndex + 1}
              </span>
              <div className="flex-1 min-w-[200px]">
                {readOnly ? (
                  <span className="text-sm font-bold text-neutral-900">{first.fabric || '—'}</span>
                ) : (
                  <label className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 shrink-0">
                      Fabric{REQUIRED}
                    </span>
                    <input
                      type="text"
                      required
                      aria-label={`Fabric ${cardIndex + 1}`}
                      value={first.fabric}
                      onChange={(e) => handleFabricNameChange(cardIndex, e.target.value)}
                      onFocus={(e) => e.target.select()}
                      placeholder="Fabric name"
                      className={`${FIELD} font-semibold max-w-md`}
                    />
                  </label>
                )}
              </div>
              {/* This fabric's own width, saved on each of its lines (never one width for the whole challan). */}
              {readOnly ? (
                <span className="text-xs text-neutral-600">
                  Width: <span className="font-semibold text-neutral-900">{first.width || '—'}</span>
                </span>
              ) : (
                <label className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 shrink-0">Width</span>
                  <input
                    type="text"
                    aria-label={`Width of fabric ${cardIndex + 1}`}
                    value={first.width || ''}
                    onChange={(e) => handleFabricWidthChange(cardIndex, e.target.value)}
                    maxLength={40}
                    placeholder="e.g. 44 Inch"
                    className={`${FIELD} w-32`}
                  />
                </label>
              )}
              <span className="text-xs text-neutral-500 tabular-nums">
                {colourGroups.length} {colourGroups.length === 1 ? 'colour' : 'colours'}
                {card.lines.length !== colourGroups.length && ` · ${card.lines.length} entries`}
                {total ? <span className="font-semibold text-neutral-800"> · {total}</span> : null}
              </span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleRemoveFabric(cardIndex)}
                  className="p-2 text-neutral-400 hover:text-danger-600 rounded-lg hover:bg-danger-50 transition cursor-pointer"
                  title="Remove this fabric"
                  aria-label={`Remove fabric ${cardIndex + 1}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Colours of this fabric: each colour its own entries table */}
            <div className="divide-y divide-neutral-200">
              {colourGroups.map((colourGroup, colourIndex) => {
                const colour = colourGroup.entries[0].item;
                const colourTotal = cardTotal(colourGroup.entries);
                return (
                  <div key={colourGroup.key}>
                    {/* Colour heading: colour-level fields, shared by its entries */}
                    <div className="px-4 py-2.5 flex flex-wrap items-center gap-3 bg-white">
                      <span className="text-xs font-semibold text-neutral-400 tabular-nums w-6">{colourIndex + 1}</span>
                      <label className="flex items-center gap-2 min-w-[180px] flex-1 max-w-xs">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 shrink-0">
                          {context === 'STORE_DYEING' ? 'Base color' : 'Color'}
                          {REQUIRED}
                        </span>
                        {readOnly ? (
                          <span className="text-sm font-semibold text-neutral-900">{colour.color || '—'}</span>
                        ) : (
                          <input
                            type="text"
                            required
                            aria-label={`Colour ${colourIndex + 1} of fabric ${cardIndex + 1}`}
                            value={colour.color}
                            onChange={(e) => handleColourFieldChange(cardIndex, colourGroup.key, 'color', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className={`${FIELD} font-semibold`}
                          />
                        )}
                      </label>

                      {showRequiredDyeColor && (
                        <label className="flex items-center gap-2 min-w-[180px] flex-1 max-w-xs">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 shrink-0">
                            Dye color{REQUIRED}
                          </span>
                          {readOnly ? (
                            <span className="text-sm font-semibold text-brand-900">{colour.requiredDyeColor || '—'}</span>
                          ) : (
                            <input
                              type="text"
                              required
                              aria-label="Dye color"
                              value={colour.requiredDyeColor || ''}
                              onChange={(e) => handleColourFieldChange(cardIndex, colourGroup.key, 'requiredDyeColor', e.target.value)}
                              onFocus={(e) => e.target.select()}
                              className={DYE_FIELD}
                            />
                          )}
                        </label>
                      )}

                      {showActualDyedColor && (
                        <label className="flex items-center gap-2 min-w-[180px] flex-1 max-w-xs">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 shrink-0">
                            Dyed color{REQUIRED}
                          </span>
                          {readOnly ? (
                            <span className="text-sm font-semibold text-neutral-900">{colour.actualDyedColor || '—'}</span>
                          ) : (
                            <input
                              type="text"
                              required
                              aria-label="Dyed color"
                              value={colour.actualDyedColor || ''}
                              onChange={(e) => handleColourFieldChange(cardIndex, colourGroup.key, 'actualDyedColor', e.target.value)}
                              onFocus={(e) => e.target.select()}
                              className={DYE_FIELD}
                            />
                          )}
                        </label>
                      )}

                      {showProcessingStatus && (
                        readOnly || context === 'STORE_EMBROIDERY' || context === 'QC1_EMBROIDERY' ? (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                              colour.fabricProcessingStatus === 'Undyed'
                                ? 'bg-accent-100 text-accent-800 border border-accent-200'
                                : 'bg-brand-100 text-brand-900 border border-brand-200'
                            }`}
                          >
                            {colour.fabricProcessingStatus || (context === 'STORE_EMBROIDERY' ? 'Undyed' : 'Dyed')}
                          </span>
                        ) : (
                          <select
                            aria-label="Status"
                            value={colour.fabricProcessingStatus || 'Dyed'}
                            onChange={(e) => handleColourFieldChange(cardIndex, colourGroup.key, 'fabricProcessingStatus', e.target.value as 'Dyed' | 'Undyed')}
                            className={`${FIELD} cursor-pointer w-28`}
                          >
                            <option value="Dyed">Dyed</option>
                            <option value="Undyed">Undyed</option>
                          </select>
                        )
                      )}

                      <span className="ml-auto text-xs text-neutral-500 tabular-nums">
                        {colourGroup.entries.length} {colourGroup.entries.length === 1 ? 'entry' : 'entries'}
                        {colourTotal ? <span className="font-semibold text-neutral-800"> · {colourTotal}</span> : null}
                      </span>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => handleRemoveColour(cardIndex, colourGroup.key)}
                          className="p-2 text-neutral-400 hover:text-danger-600 rounded-lg hover:bg-danger-50 transition cursor-pointer"
                          title="Remove this colour"
                          aria-label={`Remove colour ${colourIndex + 1} of fabric ${cardIndex + 1}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Entries of this colour */}
                    <div className="overflow-x-auto px-4 pb-2">
                      <table className="w-full table-fixed text-left text-sm border-collapse border border-neutral-200 rounded-lg min-w-[900px]">
                        <thead className="bg-neutral-50 border-b border-neutral-200 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 whitespace-nowrap">
                          <tr>
                            <th className="py-2.5 pl-3 pr-2 w-56">
                              {context === 'QC1_EMBROIDERY' ? 'Passed qty' : context === 'STORE_DYEING' ? 'Qty issued' : 'Size'}
                              {REQUIRED}
                            </th>
                            {showRequiredDyeQty && (
                              <th className="py-2.5 px-2 w-36">
                                Qty to dye{REQUIRED}
                              </th>
                            )}
                            <th className="py-2.5 px-2 w-56">Average</th>
                            <th className="py-2.5 px-2 w-56">Unit{REQUIRED}</th>
                            <th className="py-2.5 px-2">Remarks</th>
                            {!readOnly && (
                              <th className="py-2.5 pl-2 pr-3 w-14">
                                <span className="sr-only">Remove</span>
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                          {colourGroup.entries.map(({ item, index: idx }, entryIndex) => (
                            <tr key={item.id || idx} className="hover:bg-neutral-50/60 transition">
                              {/* SIZE: the line quantity with its MTR / PCS (the unit stock and forwarding use) */}
                              <td className="py-2 pl-3 pr-2">
                                {readOnly ? (
                                  <span className="block font-semibold tabular-nums text-neutral-900">
                                    {item.measurement || '0'}
                                    {item.unit ? <span className="ml-1 text-xs font-medium text-neutral-500">{item.unit}</span> : null}
                                  </span>
                                ) : (
                                  <QuantityUnitField
                                    label="Size"
                                    value={String(item.measurement ?? '')}
                                    unit={item.unit}
                                    onValue={(v) => handleFieldChange(idx, 'measurement', v)}
                                    onUnit={(u) => handleFieldChange(idx, 'unit', u)}
                                    required
                                    min="0.01"
                                    inputClassName={`${FIELD} font-semibold`}
                                  />
                                )}
                              </td>

                              {/* REQUIRED DYE QUANTITY (Store to Dyeing) */}
                              {showRequiredDyeQty && (
                                <td className="py-2 px-2">
                                  {readOnly ? (
                                    <span className="block font-semibold tabular-nums text-brand-900">
                                      {item.requiredDyeQuantity || item.measurement || '0'}
                                    </span>
                                  ) : (
                                    <input
                                      type="number"
                                      step="any"
                                      min="0.01"
                                      required
                                      aria-label="Qty to dye"
                                      value={item.requiredDyeQuantity || ''}
                                      onChange={(e) => handleFieldChange(idx, 'requiredDyeQuantity', e.target.value)}
                                      onFocus={(e) => e.target.select()}
                                      className={`${DYE_FIELD} tabular-nums font-semibold`}
                                    />
                                  )}
                                </td>
                              )}

                              {/* AVERAGE, with its own MTR / PCS */}
                              <td className="py-2 px-2">
                                {readOnly ? (
                                  <span className="block tabular-nums text-neutral-700">{averageText(item)}</span>
                                ) : (
                                  <QuantityUnitField
                                    label="Average"
                                    value={String(item.average ?? '')}
                                    unit={item.averageUnit || ''}
                                    onValue={(v) => handleFieldChange(idx, 'average', v)}
                                    onUnit={(u) => handleFieldChange(idx, 'averageUnit', u)}
                                    inputClassName={FIELD}
                                  />
                                )}
                              </td>

                              {/* UNIT: a quantity with its own MTR / PCS (never pre-selected) */}
                              <td className="py-2 px-2">
                                {readOnly ? (
                                  <span className="block tabular-nums text-neutral-700">{unitQuantityText({ unitQuantity: item.unitQuantity, unitQuantityUom: item.unitQuantityUnit })}</span>
                                ) : (
                                  <QuantityUnitField
                                    label="Unit quantity"
                                    value={String(item.unitQuantity ?? '')}
                                    unit={item.unitQuantityUnit || ''}
                                    onValue={(v) => handleFieldChange(idx, 'unitQuantity', v)}
                                    onUnit={(u) => handleFieldChange(idx, 'unitQuantityUnit', u)}
                                    required
                                    inputClassName={FIELD}
                                  />
                                )}
                              </td>

                              {/* REMARKS */}
                              <td className="py-2 px-2">
                                {readOnly ? (
                                  <span className="text-neutral-600">{item.remarks || '—'}</span>
                                ) : (
                                  <input
                                    type="text"
                                    aria-label="Remarks"
                                    value={item.remarks || ''}
                                    onChange={(e) => handleFieldChange(idx, 'remarks', e.target.value)}
                                    onFocus={(e) => e.target.select()}
                                    className={FIELD}
                                  />
                                )}
                              </td>

                              {/* REMOVE THIS ENTRY */}
                              {!readOnly && (
                                <td className="py-2 pl-2 pr-3">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItem(idx)}
                                    className="p-2 text-neutral-400 hover:text-danger-600 rounded-lg hover:bg-danger-50 transition cursor-pointer"
                                    title="Remove this entry"
                                    aria-label={`Remove entry ${entryIndex + 1} of colour ${colourIndex + 1}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => handleAddEntry(cardIndex, colourGroup.key)}
                          className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-brand-700 hover:bg-brand-50 transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add entry{colour.color.trim() ? ` to ${colour.color.trim()}` : ''}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {!readOnly && (
              <div className="px-4 py-2.5 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => handleAddColour(cardIndex)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-brand-700 hover:bg-brand-50 transition cursor-pointer"
                >
                  <CopyPlus className="w-3.5 h-3.5" />
                  <span>Add colour{first.fabric.trim() ? ` to ${first.fabric.trim()}` : ''}</span>
                </button>
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}
