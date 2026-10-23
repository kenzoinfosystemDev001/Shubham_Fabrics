'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Printer,
  Download,
  Eye,
  ExternalLink,
  Plus,
  Trash2,
  Layers,
  Sparkles,
  Image as ImageIcon,
  Edit3,
  Check,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';
import { api } from '@/lib/api';
import { getCurrentUser, canViewClientCode, canViewClientName } from '@/lib/rbac';
import { ProductionSheetPrintModal } from '@/components/production-sheet/ProductionSheetPrintModal';
import { 
  downloadProductionSheetHtml, 
  printProductionSheet,
  DEFAULT_SUB_STYLES,
  DEFAULT_BOTTOM_SUB_STYLES,
  DEFAULT_DUPATTA_SUB_STYLES,
  getDefaultSubStylesForCategory,
  SubStyleAverage,
  ProductionGridItem,
  SWATCH_CLIP_PATH,
  getSwatchColorHex,
  SwatchItem,
  GarmentCategory,
  ComponentSheetData,
  calculateSizeExpressionTotal,
  formatSizeExpressionTotal,
  calculateProductionMeasurementTotal
} from '@/lib/download-production-sheet';
import { WilcomDesignModal } from '@/components/wilcom/WilcomDesignModal';
import { WilcomPrintModal } from '@/components/wilcom/WilcomPrintModal';
import { 
  WilcomEntry, 
  printWilcomForm, 
  downloadWilcomFormHtml,
  extractRootWilcomPhoto
} from '@/lib/download-wilcom';

interface ComponentState {
  enabled: boolean;
  styleName: string;
  pattern: string;
  fabricName: string;
  fabricWidth: string;
  subStyles: SubStyleAverage[];
  productionGrid: ProductionGridItem[];
  swatchColorOverrides: Record<string, string>;
  noteText: string;
  remarksText: string;
  signatureName: string;
}

interface AvailableFabricStock {
  itemName: string;
  balance: number;
  unit: string;
  fabricType: string;
}

function calculateSizeTotal(expression?: string): number | null {
  return calculateSizeExpressionTotal(expression);
}

function formatSizeTotal(total: number): string {
  return formatSizeExpressionTotal(total);
}

const CATEGORY_META: Record<string, {
  label: string;
  badgeBg: string;
  badgeText: string;
  accentBorder: string;
  subHeader: string;
}> = {
  TOP: {
    label: 'TOP Production Sheet',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-900',
    accentBorder: 'border-blue-700',
    subHeader: 'TOP:-',
  },
  BOTTOM: {
    label: 'BOTTOM Production Sheet',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-900',
    accentBorder: 'border-emerald-900',
    subHeader: 'BOTTOM:-',
  },
  DUPATTA: {
    label: 'DUPATTA Production Sheet',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-900',
    accentBorder: 'border-purple-800',
    subHeader: 'DUPATTA:-',
  },
  OTHER: {
    label: 'INPUT Production Sheet',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-900',
    accentBorder: 'border-amber-700',
    subHeader: 'OTHER:-',
  },
};

const COMMON_GARMENT_SUB_STYLES = [
  'FRONT',
  'BACK',
  'SLEEVE',
  'COLLAR',
  'CUFF',
  'YOKE',
  'POCKET',
  'BORDER',
  'LACE',
  'BELT',
  'DAMAN',
  'GALA / NECK',
  'DUPATTA BODY',
  'PALLU',
  'BOTTOM WAIST',
  'PANTS LEG',
  'INNER LINING',
  'PATTI',
  'HOOD',
  'FLAP',
];

const BUILT_IN_CATEGORIES: GarmentCategory[] = ['TOP', 'BOTTOM', 'DUPATTA', 'OTHER'];

function isCustomCategory(category: GarmentCategory): boolean {
  return !BUILT_IN_CATEGORIES.includes(category);
}

function getCategoryMeta(category: GarmentCategory) {
  return CATEGORY_META[category] || CATEGORY_META.OTHER;
}

function createComponentState(category: GarmentCategory, rowId: string): ComponentState {
  return {
    enabled: true,
    styleName: '',
    pattern: '',
    fabricName: '',
    fabricWidth: '',
    subStyles: getDefaultSubStylesForCategory(category).map((style) => ({ ...style, average: '' })),
    productionGrid: [{ id: rowId, color: '', pcs: '', mtr: '', subStyle: '', subStyles: [], size: '', sizes: {} }],
    swatchColorOverrides: {},
    noteText: '',
    remarksText: '',
    signatureName: '',
  };
}

function hasComponentInput(component: ComponentState): boolean {
  return Boolean(
    component.styleName.trim() ||
    component.pattern.trim() ||
    component.fabricName.trim() ||
    component.fabricWidth.trim() ||
    component.noteText.trim() ||
    component.remarksText.trim() ||
    component.subStyles.some((style) => style.average !== '') ||
    component.productionGrid.some((row) => row.color.trim() || Number(row.pcs) > 0 || Number(row.mtr) > 0)
  );
}

interface SubStyleMultiSelectCellProps {
  cat: GarmentCategory;
  rIdx: number;
  row: ProductionGridItem;
  compSubStyles: SubStyleAverage[];
  isPickerOpen: boolean;
  onOpenPicker: () => void;
  onClosePicker: () => void;
  onToggleSubStyle: (subStyleName: string) => void;
  onSetSubStyles: (subStyles: string[]) => void;
  onApplyAll: () => void;
  onSubStyleTextChange: (text: string) => void;
  customSubStyleInput: string;
  setCustomSubStyleInput: (val: string) => void;
  canApplyAll: boolean;
}

function SubStyleMultiSelectCell({
  cat,
  rIdx,
  row,
  compSubStyles,
  isPickerOpen,
  onOpenPicker,
  onClosePicker,
  onToggleSubStyle,
  onSetSubStyles,
  onApplyAll,
  onSubStyleTextChange,
  customSubStyleInput,
  setCustomSubStyleInput,
  canApplyAll,
}: SubStyleMultiSelectCellProps) {
  let rowSubStyles = Array.isArray(row.subStyles) ? row.subStyles : [];
  if (rowSubStyles.length === 0 && row.subStyle) {
    rowSubStyles = String(row.subStyle)
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
  }

  return (
    <div className="relative w-full flex items-center justify-center p-0.5 min-h-[30px]">
      <div className="flex flex-wrap items-center justify-center gap-1 w-full">
        {rowSubStyles.map((sub, sIdx) => (
          <span
            key={sIdx}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-blue-100 border border-blue-300 text-blue-950 shadow-2xs select-none"
          >
            <span>{sub}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSubStyle(sub);
              }}
              className="text-blue-800 hover:text-rose-600 transition p-0.5 rounded cursor-pointer"
              title="Remove this sub style"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}

        <button
          type="button"
          onClick={onOpenPicker}
          className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold text-blue-700 hover:text-blue-950 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition cursor-pointer shadow-2xs"
          title="Select or add sub styles"
        >
          <Plus className="w-2.5 h-2.5" />
        </button>
      </div>

      {isPickerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[0.5px]"
            onClick={onClosePicker}
          />
          <div
            className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50 w-72 bg-white rounded-lg shadow-2xl border-2 border-black p-3 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
              <div>
                <span className="text-[11px] font-black uppercase text-slate-900 block">
                  Sub Styles &middot; Row #{rIdx + 1}
                </span>
                <span className="text-[10px] text-blue-800 font-bold">
                  {rowSubStyles.length} selected
                </span>
              </div>
              <button
                type="button"
                onClick={onClosePicker}
                className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-1 mb-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const allNames = compSubStyles.map((s) => s.name);
                    onSetSubStyles(allNames);
                  }}
                  className="text-[9px] font-bold text-blue-700 hover:bg-blue-50 border border-blue-300 px-1.5 py-0.5 rounded cursor-pointer transition"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => onSetSubStyles([])}
                  className="text-[9px] font-bold text-slate-600 hover:bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded cursor-pointer transition"
                >
                  Clear
                </button>
              </div>
              {canApplyAll && (
                <button
                  type="button"
                  onClick={onApplyAll}
                  className="text-[9px] font-bold text-purple-700 hover:bg-purple-50 border border-purple-300 px-1.5 py-0.5 rounded cursor-pointer transition"
                  title="Copy selected sub styles to all color rows in this grid"
                >
                  Apply to All Rows
                </button>
              )}
            </div>

            <div className="max-h-40 overflow-y-auto space-y-1 mb-2 pr-1 border border-slate-100 rounded p-1 bg-slate-50/50">
              {compSubStyles.map((sub, sIdx) => {
                const isChecked = rowSubStyles.includes(sub.name.toUpperCase());
                return (
                  <label
                    key={sIdx}
                    className={`flex items-center justify-between px-2 py-1 rounded text-xs cursor-pointer select-none transition ${
                      isChecked
                        ? 'bg-blue-100 text-blue-950 font-bold border border-blue-300'
                        : 'hover:bg-slate-100 text-slate-700 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onToggleSubStyle(sub.name)}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                      />
                      <span>{sub.name}</span>
                    </div>
                    {sub.average && Number(sub.average) > 0 && (
                      <span className="text-[10px] text-slate-500 font-mono">
                        {Number(sub.average).toFixed(2)}m
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-200">
              <div className="text-[10px] font-bold text-slate-600 mb-1 uppercase">
                Custom Part
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={customSubStyleInput}
                  onChange={(e) => setCustomSubStyleInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (customSubStyleInput.trim()) {
                        onToggleSubStyle(customSubStyleInput);
                        setCustomSubStyleInput('');
                      }
                    }
                  }}
                  placeholder="e.g. POCKET"
                  className="flex-1 px-2 py-1 text-xs uppercase font-bold border border-slate-300 rounded focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customSubStyleInput.trim()) {
                      onToggleSubStyle(customSubStyleInput);
                      setCustomSubStyleInput('');
                    }
                  }}
                  className="px-2 py-1 bg-[#163767] hover:bg-[#0F264A] text-white text-xs font-bold rounded cursor-pointer transition"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="pt-2 mt-2 border-t border-slate-200">
              <div className="text-[10px] font-bold text-slate-600 mb-1 uppercase">
                Manual Text Edit
              </div>
              <input
                type="text"
                value={row.subStyle || ''}
                onChange={(e) => onSubStyleTextChange(e.target.value)}
                placeholder="Comma-separated: FRONT, SLEEVE"
                className="w-full px-2 py-1 text-xs uppercase font-bold border border-slate-300 rounded focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center justify-end">
              <button
                type="button"
                onClick={onClosePicker}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded cursor-pointer transition shadow-2xs"
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface BatchSubStylesModalProps {
  cat: GarmentCategory;
  existingSubStyles: SubStyleAverage[];
  selectedPresets: string[];
  onTogglePreset: (part: string) => void;
  customInput: string;
  onCustomInputChange: (val: string) => void;
  onClose: () => void;
  onAdd: (subStyles: string[]) => void;
}

function BatchSubStylesModal({
  cat,
  existingSubStyles,
  selectedPresets,
  onTogglePreset,
  customInput,
  onCustomInputChange,
  onClose,
  onAdd,
}: BatchSubStylesModalProps) {
  const existingSet = new Set(existingSubStyles.map((s) => s.name.toUpperCase()));

  const handleConfirm = () => {
    const customParts = customInput
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const combined = Array.from(new Set([...selectedPresets, ...customParts]));
    if (combined.length > 0) {
      onAdd(combined);
    }
    onClose();
  };

  const totalCount = selectedPresets.length + customInput.split(',').filter((s) => s.trim()).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl border-2 border-black max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="font-black text-sm uppercase text-slate-900">
              Add Multiple Sub Styles &middot; {cat}
            </h3>
            <p className="text-xs text-slate-500">
              Select common garment components or enter custom names
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-bold text-slate-700 uppercase">
            Quick Preset Parts
          </span>
          <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto p-1.5 border border-slate-200 rounded-lg bg-slate-50">
            {COMMON_GARMENT_SUB_STYLES.map((part) => {
              const isSelected = selectedPresets.includes(part);
              const isAlreadyAdded = existingSet.has(part);

              return (
                <button
                  key={part}
                  type="button"
                  disabled={isAlreadyAdded}
                  onClick={() => onTogglePreset(part)}
                  className={`px-2 py-1 rounded text-xs font-bold uppercase transition flex items-center gap-1 cursor-pointer ${
                    isAlreadyAdded
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                      : isSelected
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3" />}
                  <span>{part}</span>
                  {isAlreadyAdded && <span className="text-[9px]">(added)</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700 uppercase block">
            Or Enter Custom Sub Styles (Comma-Separated)
          </label>
          <textarea
            rows={2}
            value={customInput}
            onChange={(e) => onCustomInputChange(e.target.value)}
            placeholder="e.g. FRONT YOKE, BACK YOKE, INNER POCKET"
            className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs uppercase font-bold focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded cursor-pointer transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={totalCount === 0}
            className="px-4 py-1.5 bg-[#163767] hover:bg-[#0F264A] disabled:opacity-50 text-white text-xs font-bold rounded cursor-pointer transition shadow-xs"
          >
            Add to Average Table ({totalCount})
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CreateProductionSheetPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<any | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [createdProgramId, setCreatedProgramId] = useState<string | null>(null);
  // Sub-style Multi-select Picker State
  const [activeSubStylePicker, setActiveSubStylePicker] = useState<{
    cat: GarmentCategory;
    rowIndex: number;
  } | null>(null);
  const [customSubStyleInput, setCustomSubStyleInput] = useState('');

  // Batch Sub-styles Modal State (for AVERAGE section)
  const [showBatchSubStylesModal, setShowBatchSubStylesModal] = useState<GarmentCategory | null>(null);
  const [batchSubStylesInput, setBatchSubStylesInput] = useState('');
  const [selectedBatchPresets, setSelectedBatchPresets] = useState<string[]>([]);


  // Common / Shared Order Header Fields
  const [designNumber, setDesignNumber] = useState('');
  const [sheetDate, setSheetDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [programSerialNo, setProgramSerialNo] = useState('');
  const [serialNoCounter, setSerialNoCounter] = useState('');
  const [fabricName, setFabricName] = useState('');
  const [fabricWidth, setFabricWidth] = useState('');
  const [availableFabricStocks, setAvailableFabricStocks] = useState<AvailableFabricStock[]>([]);
  const [fabricStocksLoaded, setFabricStocksLoaded] = useState(false);
  const [loadingFabricStocks, setLoadingFabricStocks] = useState(false);
  const [activeFabricPicker, setActiveFabricPicker] = useState<GarmentCategory | null>(null);

  // OTHER is the internal category for user-named production sheets.
  // Starts clean with NO dummy data
  const [components, setComponents] = useState<Record<GarmentCategory, ComponentState>>({
    TOP: {
      enabled: true,
      styleName: '',
      pattern: '',
      fabricName: '',
      fabricWidth: '',
      subStyles: DEFAULT_SUB_STYLES.map((s) => ({ ...s, average: '' })),
      productionGrid: [{ id: 'top-row-1', color: '', pcs: '', mtr: '', subStyle: '', subStyles: [], size: '', sizes: {} }],
      swatchColorOverrides: {},
      noteText: '',
      remarksText: '',
      signatureName: '',
    },
    BOTTOM: {
      enabled: false,
      styleName: '',
      pattern: '',
      fabricName: '',
      fabricWidth: '',
      subStyles: DEFAULT_BOTTOM_SUB_STYLES.map((s) => ({ ...s, average: '' })),
      productionGrid: [{ id: 'bottom-row-1', color: '', pcs: '', mtr: '', subStyle: '', subStyles: [], size: '', sizes: {} }],
      swatchColorOverrides: {},
      noteText: '',
      remarksText: '',
      signatureName: '',
    },
    DUPATTA: {
      enabled: false,
      styleName: '',
      pattern: '',
      fabricName: '',
      fabricWidth: '',
      subStyles: DEFAULT_DUPATTA_SUB_STYLES.map((s) => ({ ...s, average: '' })),
      productionGrid: [{ id: 'dupatta-row-1', color: '', pcs: '', mtr: '', subStyle: '', subStyles: [], size: '', sizes: {} }],
      swatchColorOverrides: {},
      noteText: '',
      remarksText: '',
      signatureName: '',
    },
    OTHER: {
      enabled: false,
      styleName: '',
      pattern: '',
      fabricName: '',
      fabricWidth: '',
      subStyles: DEFAULT_SUB_STYLES.map((s) => ({ ...s, average: '' })),
      productionGrid: [{ id: 'other-row-1', color: '', pcs: '', mtr: '', subStyle: '', subStyles: [], size: '', sizes: {} }],
      swatchColorOverrides: {},
      noteText: '',
      remarksText: '',
      signatureName: '',
    },
  });
  const componentCategories = Object.keys(components) as GarmentCategory[];

  // Forwarding Selection State: select which sheets to forward to the next department
  const [forwardedComponents, setForwardedComponents] = useState<GarmentCategory[]>(['TOP']);
  const [selectedCategory, setSelectedCategory] = useState<GarmentCategory>('TOP');

  // Wilcom Form Stage Management State
  const [wilcomEntries, setWilcomEntries] = useState<WilcomEntry[]>([]);
  const [wilcomCategory, setWilcomCategory] = useState<GarmentCategory>('TOP');
  const [showWilcomModal, setShowWilcomModal] = useState(false);
  const [showWilcomPrintModal, setShowWilcomPrintModal] = useState(false);

  // MES Routing & Commercial Fields
  const [clientName, setClientName] = useState('');
  const [clientCode, setClientCode] = useState('');
  const [clientPriority, setClientPriority] = useState('NORMAL');
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    setCurrentUser(getCurrentUser());
  }, []);

  const [deliveryDate, setDeliveryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [fabricDyeingRequired, setFabricDyeingRequired] = useState(false);
  const [fabricColorAvailable, setFabricColorAvailable] = useState('IN_STOCK');

  // Live Fabric Store Availability State
  const [fabricAvailability, setFabricAvailability] = useState<{
    availableMeters: number;
    requiredMeters: number;
    matchingRollCount: number;
    sufficient: boolean;
  } | null>(null);
  const [checkingFabricAvailability, setCheckingFabricAvailability] = useState(false);
  const [fabricAvailabilityError, setFabricAvailabilityError] = useState<string | null>(null);

  // Component Helper Functions
  const getTotalMtrAverage = (cat: GarmentCategory): number => {
    const sum = components[cat].subStyles.reduce((acc, it) => acc + (Number(it.average) || 0), 0);
    return Math.round(sum * 100) / 100;
  };

  const getTotalPieces = (cat: GarmentCategory): number => {
    return components[cat].productionGrid.reduce((acc, row) => acc + (Number(row.pcs) || 0), 0);
  };

  const getTotalFabricMeters = (cat: GarmentCategory): number => {
    const sum = components[cat].productionGrid.reduce((acc, row) => acc + (Number(row.mtr) || 0), 0);
    return Math.round(sum * 100) / 100;
  };

  const getDisplaySwatches = (cat: GarmentCategory): SwatchItem[] => {
    const result: SwatchItem[] = [];
    const seen = new Set<string>();
    const overrides = components[cat].swatchColorOverrides;

    components[cat].productionGrid.forEach((row) => {
      const trimmed = (row.color || '').trim();
      if (trimmed && !seen.has(trimmed.toLowerCase())) {
        seen.add(trimmed.toLowerCase());
        const hex = overrides[trimmed] || getSwatchColorHex(trimmed);
        result.push({
          id: `swatch-${cat}-${trimmed}`,
          name: trimmed,
          color: hex,
        });
      }
    });

    return result;
  };

  // Overall totals across enabled components
  const overallTotalPieces = useMemo(() => {
    let sum = 0;
    componentCategories.forEach((cat) => {
      if (components[cat].enabled) {
        sum += getTotalPieces(cat);
      }
    });
    return sum;
  }, [components, componentCategories]);

  const overallFabricMeters = useMemo(() => {
    let sum = 0;
    componentCategories.forEach((cat) => {
      if (components[cat].enabled) {
        sum += getTotalFabricMeters(cat);
      }
    });
    return Math.round(sum * 100) / 100;
  }, [components, componentCategories]);

  const loadAvailableFabricStocks = async () => {
    if (loadingFabricStocks) return;
    setLoadingFabricStocks(true);
    try {
      const response = await fetch('/api/fabric-store/total-stock');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load Fabric Store stock');
      setAvailableFabricStocks(
        (Array.isArray(result.data) ? result.data : [])
          .filter((item: any) => Number(item.balance) > 0)
          .map((item: any) => ({
            itemName: String(item.itemName || ''),
            balance: Number(item.balance) || 0,
            unit: String(item.unit || 'MTR'),
            fabricType: String(item.fabricType || ''),
          }))
          .filter((item: AvailableFabricStock) => item.itemName)
      );
      setFabricStocksLoaded(true);
    } catch (stockError) {
      console.error('Failed to load available Fabric Store stock:', stockError);
    } finally {
      setLoadingFabricStocks(false);
    }
  };

  const handleAddCustomStyle = () => {
    const newCategory = `CUSTOM_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const topIsBlank = !hasComponentInput(components.TOP);
    setComponents((prev) => ({
      ...prev,
      ...(topIsBlank ? { TOP: { ...prev.TOP, enabled: false } } : {}),
      [newCategory]: createComponentState(newCategory, `${newCategory.toLowerCase()}-row-1`),
    }));
    setSelectedCategory(newCategory);
    setForwardedComponents((prev) => [
      ...(topIsBlank ? prev.filter((category) => category !== 'TOP') : prev),
      newCategory,
    ]);
  };

  // Handle Component Enable/Disable
  const handleToggleComponent = (cat: GarmentCategory) => {
    const willEnable = !components[cat].enabled;
    setComponents((prev) => ({
      ...prev,
      [cat]: {
        ...prev[cat],
        enabled: willEnable,
      },
    }));

    if (willEnable) {
      if (!forwardedComponents.includes(cat)) {
        setForwardedComponents((prev) => [...prev, cat]);
      }
    } else {
      setForwardedComponents((prev) => prev.filter((c) => c !== cat));
    }
  };

  // Handle Forwarding Selection
  const handleToggleForwarding = (cat: GarmentCategory) => {
    if (forwardedComponents.includes(cat)) {
      if (forwardedComponents.length === 1) {
        alert('At least one Production Sheet must be selected for forwarding.');
        return;
      }
      setForwardedComponents((prev) => prev.filter((c) => c !== cat));
    } else {
      if (!components[cat].enabled) {
        // Auto-enable if user selects for forwarding
        setComponents((prev) => ({
          ...prev,
          [cat]: { ...prev[cat], enabled: true },
        }));
      }
      setForwardedComponents((prev) => [...prev, cat]);
    }
  };

  // Selecting a sheet should not disable or overwrite the other component sheets.
  const handleCategoryDropdownChange = (newCat: GarmentCategory) => {
    if (newCat === selectedCategory) return;
    const oldCategoryIsBlank =
      !isCustomCategory(selectedCategory) &&
      !hasComponentInput(components[selectedCategory]);
    setSelectedCategory(newCat);
    setComponents((prev) => ({
      ...prev,
      ...(oldCategoryIsBlank
        ? { [selectedCategory]: { ...prev[selectedCategory], enabled: false } }
        : {}),
      [newCat]: { ...prev[newCat], enabled: true },
    }));
    setForwardedComponents((prev) => [
      ...(oldCategoryIsBlank ? prev.filter((category) => category !== selectedCategory) : prev),
      ...(prev.includes(newCat) ? [] : [newCat]),
    ]);
  };

  // Component SubStyle Changes
  const handleSubStyleAverageChange = (cat: GarmentCategory, index: number, newAverage: number | string) => {
    const updatedSubStyles = [...components[cat].subStyles];
    updatedSubStyles[index] = { ...updatedSubStyles[index], average: newAverage };

    setComponents((prev) => ({
      ...prev,
      [cat]: {
        ...prev[cat],
        subStyles: updatedSubStyles,
      },
    }));
  };

  const handleSubStyleNameChange = (cat: GarmentCategory, index: number, newName: string) => {
    const oldName = components[cat].subStyles[index].name;
    const cleanName = newName.toUpperCase();
    const updatedSubStyles = [...components[cat].subStyles];
    updatedSubStyles[index] = { ...updatedSubStyles[index], name: cleanName };

    const updatedGrid = components[cat].productionGrid.map((row) => {
      const nextSizes = { ...row.sizes };
      if (oldName && oldName in nextSizes) {
        nextSizes[cleanName] = nextSizes[oldName];
        delete nextSizes[oldName];
      } else if (cleanName) {
        nextSizes[cleanName] = '';
      }
      return { ...row, sizes: nextSizes };
    });

    setComponents((prev) => ({
      ...prev,
      [cat]: {
        ...prev[cat],
        subStyles: updatedSubStyles,
        productionGrid: updatedGrid,
      },
    }));
  };

  const handleAddSubStyle = (cat: GarmentCategory) => {
    const nextNum = components[cat].subStyles.length + 1;
    const newName = `PART-${nextNum}`;
    const updatedSubStyles = [...components[cat].subStyles, { name: newName, average: '' }];

    setComponents((prev) => ({
      ...prev,
      [cat]: {
        ...prev[cat],
        subStyles: updatedSubStyles,
      },
    }));
  };

  const handleRemoveSubStyle = (cat: GarmentCategory, indexToRemove: number) => {
    if (components[cat].subStyles.length <= 1) {
      alert('At least one sub-style component is required.');
      return;
    }
    const removedName = components[cat].subStyles[indexToRemove].name;
    const updatedSubStyles = components[cat].subStyles.filter((_, idx) => idx !== indexToRemove);

    const updatedGrid = components[cat].productionGrid.map((row) => {
      const nextSizes = { ...row.sizes };
      delete nextSizes[removedName];
      return {
        ...row,
        sizes: nextSizes,
      };
    });

    setComponents((prev) => ({
      ...prev,
      [cat]: {
        ...prev[cat],
        subStyles: updatedSubStyles,
        productionGrid: updatedGrid,
      },
    }));
  };

  // Component Grid Operations
  const handleGridRowChange = (cat: GarmentCategory, index: number, field: 'color' | 'pcs' | 'mtr' | 'subStyle' | 'size', value: any) => {
    const totalAvg = getTotalMtrAverage(cat);
    const updatedGrid = [...components[cat].productionGrid];
    const target = { ...updatedGrid[index] };

    if (field === 'pcs') {
      target.pcs = value;
    } else if (field === 'mtr') {
      target.mtr = value;
    } else if (field === 'subStyle') {
      target.subStyle = value;
    } else if (field === 'size') {
      target.size = value;
      target.sizes = { ...target.sizes, SIZE: value };
    } else {
      (target as any)[field] = value;
    }

    updatedGrid[index] = target;

    setComponents((prev) => ({
      ...prev,
      [cat]: {
        ...prev[cat],
        productionGrid: updatedGrid,
      },
    }));
  };

    const handleGridSizeChange = (cat: GarmentCategory, rowIndex: number, subStyleName: string, sizeVal: string) => {
    const updatedGrid = [...components[cat].productionGrid];
    const target = { ...updatedGrid[rowIndex] };
    const nextSizes = { ...target.sizes, [subStyleName]: sizeVal };
    target.sizes = nextSizes;

    const rowSubs = Array.isArray(target.subStyles) && target.subStyles.length > 0
      ? target.subStyles
      : target.subStyle ? target.subStyle.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) : [];

    if (rowSubs.length > 1) {
      target.size = rowSubs
        .map((s) => (nextSizes[s] ? `${s}: ${nextSizes[s]}` : ''))
        .filter(Boolean)
        .join(', ');
    } else {
      target.size = sizeVal;
    }

    updatedGrid[rowIndex] = target;

    setComponents((prev) => ({
      ...prev,
      [cat]: {
        ...prev[cat],
        productionGrid: updatedGrid,
      },
    }));
  };

  const handleGridRowSubStylesToggle = (cat: GarmentCategory, index: number, subStyleName: string) => {
    const updatedGrid = [...components[cat].productionGrid];
    const target = { ...updatedGrid[index] };
    const cleanName = subStyleName.trim().toUpperCase();
    if (!cleanName) return;

    let current = Array.isArray(target.subStyles) ? [...target.subStyles] : [];
    if (current.length === 0 && target.subStyle) {
      current = String(target.subStyle).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    }

    if (current.includes(cleanName)) {
      current = current.filter((s) => s !== cleanName);
    } else {
      current.push(cleanName);
    }

    target.subStyles = current;
    target.subStyle = current.join(', ');

    // Synchronize sizes
    const nextSizes = { ...target.sizes };
    if (!nextSizes[cleanName]) {
      nextSizes[cleanName] = current.length === 1 && target.size ? target.size : '';
    }
    target.sizes = nextSizes;
    if (current.length > 1) {
      target.size = current.map((s) => (nextSizes[s] ? `${s}: ${nextSizes[s]}` : '')).filter(Boolean).join(', ');
    } else if (current.length === 1) {
      target.size = nextSizes[current[0]] || target.size || '';
    }

    updatedGrid[index] = target;

    setComponents((prev) => ({
      ...prev,
      [cat]: {
        ...prev[cat],
        productionGrid: updatedGrid,
      },
    }));
  };

  const handleGridRowSubStylesSet = (cat: GarmentCategory, index: number, newSubStyles: string[]) => {
    const updatedGrid = [...components[cat].productionGrid];
    const target = { ...updatedGrid[index] };
    const cleanList = Array.from(new Set(newSubStyles.map((s) => s.trim().toUpperCase()).filter(Boolean)));
    target.subStyles = cleanList;
    target.subStyle = cleanList.join(', ');

    const nextSizes = { ...target.sizes };
    cleanList.forEach((s) => {
      if (nextSizes[s] === undefined) nextSizes[s] = '';
    });
    target.sizes = nextSizes;
    if (cleanList.length > 1) {
      target.size = cleanList.map((s) => (nextSizes[s] ? `${s}: ${nextSizes[s]}` : '')).filter(Boolean).join(', ');
    } else if (cleanList.length === 1) {
      target.size = nextSizes[cleanList[0]] || target.size || '';
    }

    updatedGrid[index] = target;

    setComponents((prev) => ({
      ...prev,
      [cat]: {
        ...prev[cat],
        productionGrid: updatedGrid,
      },
    }));
  };

  const handleApplySubStylesToAllRows = (cat: GarmentCategory, sourceIndex: number) => {
    const sourceRow = components[cat].productionGrid[sourceIndex];
    if (!sourceRow) return;
    let currentSubStyles = Array.isArray(sourceRow.subStyles) ? [...sourceRow.subStyles] : [];
    if (currentSubStyles.length === 0 && sourceRow.subStyle) {
      currentSubStyles = String(sourceRow.subStyle).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    }
    const currentSubStyle = currentSubStyles.join(', ');
    const sourceSizes = sourceRow.sizes ? { ...sourceRow.sizes } : {};

    const updatedGrid = components[cat].productionGrid.map((row) => ({
      ...row,
      subStyles: [...currentSubStyles],
      subStyle: currentSubStyle,
      sizes: { ...sourceSizes },
      size: sourceRow.size || '',
    }));

    setComponents((prev) => ({
      ...prev,
      [cat]: {
        ...prev[cat],
        productionGrid: updatedGrid,
      },
    }));
  };

  const handleAddMultipleSubStyles = (cat: GarmentCategory, names: string[]) => {
    const cleanNames = names.map((n) => n.trim().toUpperCase()).filter(Boolean);
    if (cleanNames.length === 0) return;

    const existingNames = new Set(components[cat].subStyles.map((s) => s.name.toUpperCase()));
    const newItems: SubStyleAverage[] = [];
    for (const name of cleanNames) {
      if (!existingNames.has(name)) {
        newItems.push({ name, average: '' });
        existingNames.add(name);
      }
    }

    if (newItems.length === 0) return;

    setComponents((prev) => ({
      ...prev,
      [cat]: {
        ...prev[cat],
        subStyles: [...prev[cat].subStyles, ...newItems],
      },
    }));
  };

  const handleAddGridRow = (cat: GarmentCategory, presetColor?: string) => {
    const initialSizes: Record<string, string> = {};
    for (const sub of components[cat].subStyles) {
      initialSizes[sub.name] = '';
    }
    const newRow: ProductionGridItem = {
      id: `${cat.toLowerCase()}-row-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      color: presetColor || '',
      pcs: '',
      mtr: '',
      subStyle: '',
      subStyles: [],
      size: '',
      sizes: initialSizes,
    };

    setComponents((prev) => ({
      ...prev,
      [cat]: {
        ...prev[cat],
        productionGrid: [...prev[cat].productionGrid, newRow],
      },
    }));
  };

  const handleRemoveGridRow = (cat: GarmentCategory, indexToRemove: number) => {
    if (components[cat].productionGrid.length <= 1) {
      alert('At least one color production row is required.');
      return;
    }

    setComponents((prev) => ({
      ...prev,
      [cat]: {
        ...prev[cat],
        productionGrid: prev[cat].productionGrid.filter((_, idx) => idx !== indexToRemove),
      },
    }));
  };

  const handleUpdateSwatchColor = (cat: GarmentCategory, swatchName: string, newHex: string) => {
    setComponents((prev) => ({
      ...prev,
      [cat]: {
        ...prev[cat],
        swatchColorOverrides: {
          ...prev[cat].swatchColorOverrides,
          [swatchName]: newHex,
        },
      },
    }));
  };

  // Real-time fabric availability check
  useEffect(() => {
    const trimmedFabric = (fabricName || components.TOP.fabricName).trim();
    setFabricAvailability(null);
    setFabricAvailabilityError(null);

    const primaryColor = components.TOP.productionGrid[0]?.color || '';
    const topAvg = getTotalMtrAverage('TOP');

    if (!trimmedFabric || overallFabricMeters <= 0 || overallTotalPieces <= 0) {
      setCheckingFabricAvailability(false);
      return;
    }

    let active = true;
    setCheckingFabricAvailability(true);
    const timeout = window.setTimeout(() => {
      api.getFabricAvailability({
        fabricName: trimmedFabric,
        fabricColor: primaryColor,
        fabricAverage: topAvg > 0 ? topAvg : 1.25,
        productionQuantity: overallTotalPieces,
      })
        .then((availability) => {
          if (active) setFabricAvailability(availability);
        })
        .catch((err: Error) => {
          if (active) setFabricAvailabilityError(err.message || 'Unable to check stock.');
        })
        .finally(() => {
          if (active) setCheckingFabricAvailability(false);
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [fabricName, components, overallTotalPieces, overallFabricMeters]);

  // Form Submission
  const handleSubmit = async (targetStatus: 'DRAFT' | 'IN_PROGRESS' | 'READY_FOR_ISSUE') => {
    setError(null);
    setSuccess(null);

    if (!designNumber.trim()) {
      setError('Design No. is required.');
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const enabledCats = componentCategories.filter((c) => components[c].enabled);
    if (enabledCats.length === 0) {
      setError('Please enable at least one Production Sheet.');
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Verify pieces in enabled components
    for (const cat of enabledCats) {
      if ((cat === 'OTHER' || isCustomCategory(cat)) && !components[cat].styleName.trim()) {
        setError(`Enter a name for the ${cat === 'OTHER' ? 'custom' : 'style'} Production Sheet.`);
        if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const pcs = getTotalPieces(cat);
      if (pcs <= 0) {
        const categoryName = cat === 'OTHER' || isCustomCategory(cat) ? components[cat].styleName.trim() : cat;
        setError(`Please enter at least one color row with positive PCS quantity for ${categoryName} Production Sheet.`);
        if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    // Verify forwarded components
    if (forwardedComponents.length === 0) {
      setError('Please select at least one Production Sheet to forward to the next department.');
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    for (const fCat of forwardedComponents) {
      if (!components[fCat].enabled) {
        setError(`Cannot forward ${fCat} Production Sheet because it is not enabled.`);
        if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    setLoading(true);
    try {
        const componentsPayload = componentCategories.reduce<Record<string, ComponentSheetData>>((payload, cat) => {
          const component = components[cat];
          payload[cat] = {
            enabled: component.enabled,
            forwarded: forwardedComponents.includes(cat),
            category: cat,
            styleName: component.styleName.trim(),
            pattern: (component.pattern || '').trim(),
            fabricName: component.fabricName.trim() || fabricName.trim(),
            fabricWidth: component.fabricWidth.trim() || fabricWidth.trim(),
            subStyles: component.subStyles,
            productionGrid: component.productionGrid,
            swatches: getDisplaySwatches(cat),
            note: component.noteText.trim(),
            remarks: component.remarksText.trim(),
            totalMtrAverage: getTotalMtrAverage(cat),
            totalPieces: getTotalPieces(cat),
            totalFabricMeters: getTotalFabricMeters(cat),
          };
          return payload;
        }, {});

      const primaryCat: GarmentCategory = selectedCategory;
      const primary = components[primaryCat];
      const primaryAvg = getTotalMtrAverage(primaryCat);
      const primaryPieces = getTotalPieces(primaryCat);

      const wilcomEntriesToSubmit = wilcomEntries.map((entry) => ({
        ...entry,
        photoUrl: entry.photoUrl || '',
      }));
      const payload: any = {
        id: createdProgramId || undefined,
        programNumber: programSerialNo.trim() || undefined,
        programSerialNo: programSerialNo.trim(),
        designNumber: designNumber.trim(),
        topName: primary.styleName.trim() || primaryCat,
        mainStyle: primary.styleName.trim() || primaryCat,
        primaryCategory: primaryCat,
        pattern: (primary.pattern || '').trim(),
        startDate: sheetDate,
        deliveryDate: deliveryDate,
        clientName: clientName.trim(),
        clientCode: canViewClientCode(currentUser) ? clientCode.trim() : undefined,
        clientPriority: clientPriority,
        serialNoCounter: serialNoCounter.trim() || '000',
        fabricName: (primary.fabricName.trim() || fabricName.trim()),
        fabric: (primary.fabricName.trim() || fabricName.trim()),
        fabricWidth: (primary.fabricWidth.trim() || fabricWidth.trim()),
        fabricAverage: primaryAvg > 0 ? primaryAvg : 1.25,
        subStylesWithAverages: primary.subStyles,
        subStyles: primary.subStyles.map((s) => s.name),
        subStyle: primary.subStyles.map((s) => s.name).join(', '),
        productionGrid: primary.productionGrid,
        colorQuantity: primaryPieces > 0 ? primaryPieces : 1,
        targetQuantity: overallTotalPieces > 0 ? overallTotalPieces : primaryPieces,
        swatches: getDisplaySwatches(primaryCat).map((s) => ({ name: s.name, color: s.color })),
        note: primary.noteText.trim(),
        remarks: (primary.remarksText || primary.noteText).trim(),
        comments: (primary.remarksText || primary.noteText).trim(),
        fabricDyeingRequired: Boolean(fabricDyeingRequired),
        fabricColorAvailable: fabricColorAvailable,
        status: targetStatus,
        components: componentsPayload,
        forwardedComponents: forwardedComponents,
        wilcomEntries: wilcomEntriesToSubmit,
        wilcomDesignNumber: wilcomEntriesToSubmit.find((e) => e.wilcomDesignNumber)?.wilcomDesignNumber || wilcomEntriesToSubmit[0]?.wilcomDesignNumber || '',
        wilcomDesignPhoto: wilcomEntriesToSubmit.find((e) => e.photoUrl)?.photoUrl || '',
      };

      const result = await api.createProductionSheet(payload);
      const resultWilcomEntries = Array.isArray(result?.wilcomEntries) ? result.wilcomEntries : [];
      const persistedWilcomPhoto =
        resultWilcomEntries.find((entry: any) => entry?.photoUrl)?.photoUrl ||
        result?.wilcomDesignPhoto;
      if (result?.id) {
        setCreatedProgramId(result.id);
      }
      if (payload.wilcomDesignPhoto && !persistedWilcomPhoto) {
        throw new Error('The production sheet was saved, but the Wilcom photo was not confirmed by the server. Please retry saving before leaving this page.');
      }
      const activePhoto = persistedWilcomPhoto || payload.wilcomDesignPhoto;
      const enrichedResult = {
        ...result,
        wilcomEntries: resultWilcomEntries.length > 0 ? resultWilcomEntries : wilcomEntriesToSubmit,
        wilcomDesignPhoto: activePhoto,
      };
      setSuccess(enrichedResult);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err: any) {
      const rawMsg = err.message || '';
      const displayMsg = rawMsg.toLowerCase().includes('abort') || rawMsg.toLowerCase().includes('timeout')
        ? 'Request timed out while saving. Please check your connection and try again.'
        : rawMsg || 'Failed to save Production Sheets.';
      setError(displayMsg);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] pl-0 md:pl-64 pb-24">
      {/* TOP STICKY BAR */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/my-work"
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A66E22] block">
              SHUBHAM FABRICS &middot; PROGRAMMING DEPARTMENT
            </span>
            <h1 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span>Production Sheet Management</span>
              {designNumber && (
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
                  {designNumber}
                </span>
              )}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => handleSubmit('DRAFT')}
            disabled={loading}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded border border-slate-300 shadow-2xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-500" /> : null}
            <span>{loading ? 'Saving...' : 'Save Draft'}</span>
          </button>
          <button
            type="button"
            onClick={() => handleSubmit('READY_FOR_ISSUE')}
            disabled={loading}
            className="px-4 py-1.5 bg-[#163767] hover:bg-[#0F264A] disabled:opacity-50 text-white text-xs font-bold rounded shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{loading ? 'Submitting...' : 'Complete & Submit Ready'}</span>
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
        
        {/* Error Banner */}
        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Modal / Banner */}
        {success && (
          <div className="p-5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 space-y-3.5 shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-bold">
                Production Sheet Submitted Successfully
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* 1. Production Sheet Actions */}
              <button
                type="button"
                onClick={() => setShowPrintModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded shadow-2xs transition cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Production Sheet</span>
              </button>

              <button
                type="button"
                onClick={() => downloadProductionSheetHtml(success, 'ALL')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded shadow-2xs transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Production Sheet</span>
              </button>

              <button
                type="button"
                onClick={() => printProductionSheet(success, 'ALL')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-black text-white text-xs font-bold rounded shadow-2xs transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Production Sheet</span>
              </button>

              {/* 2. Wilcom Sheet Actions */}
              <button
                type="button"
                onClick={() => setShowWilcomPrintModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded shadow-2xs transition cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Wilcom Sheet</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const activePhoto = wilcomEntries.find((e) => e.photoUrl)?.photoUrl || wilcomEntries[0]?.photoUrl || success?.wilcomDesignPhoto;
                  const progToDownload = {
                    ...success,
                    wilcomEntries: wilcomEntries.length > 0 ? wilcomEntries : success?.wilcomEntries,
                    wilcomDesignPhoto: activePhoto || success?.wilcomDesignPhoto,
                  };
                  void downloadWilcomFormHtml(progToDownload, 'ALL');
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold rounded shadow-2xs transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Wilcom Sheet</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const activePhoto = wilcomEntries.find((e) => e.photoUrl)?.photoUrl || wilcomEntries[0]?.photoUrl || success?.wilcomDesignPhoto;
                  const progToPrint = {
                    ...success,
                    wilcomEntries: wilcomEntries.length > 0 ? wilcomEntries : success?.wilcomEntries,
                    wilcomDesignPhoto: activePhoto || success?.wilcomDesignPhoto,
                  };
                  printWilcomForm(progToPrint, 'ALL');
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-900 hover:bg-purple-950 text-white text-xs font-bold rounded shadow-2xs transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Wilcom Sheet</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* GARMENT COMPONENT PRODUCTION SHEETS                                       */}
        {/* ========================================================================= */}
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-[#A66E22] block">
                STAGE 1 &middot; PRODUCTION SHEET MANAGEMENT
              </span>
              <h2 className="text-base font-black text-slate-900 uppercase">
                Garment Component Production Sheet
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Active Category:</span>
              <span
                className={`text-[10px] font-black px-2.5 py-0.5 rounded border ${getCategoryMeta(selectedCategory).badgeBg} ${getCategoryMeta(selectedCategory).badgeText} border-black/20`}
              >
                {selectedCategory === 'OTHER' || isCustomCategory(selectedCategory)
                  ? components[selectedCategory].styleName.trim() || 'New Style'
                  : selectedCategory}
              </span>
              <button
                type="button"
                onClick={handleAddCustomStyle}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#163767] hover:bg-[#0F264A] text-white text-[10px] font-bold rounded transition cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                Add Style
              </button>
            </div>
          </div>

          {(() => {
            const cat = selectedCategory;
            const comp = components[cat];
            const meta = getCategoryMeta(cat);
            const categoryDisplayName =
              cat === 'OTHER' || isCustomCategory(cat) ? comp.styleName.trim() || 'New Style' : cat;
            const catAvg = getTotalMtrAverage(cat);
            const catPieces = getTotalPieces(cat);
            const catMeters = getTotalFabricMeters(cat);
            const catMeasurementTotal = calculateProductionMeasurementTotal(comp.productionGrid);
            const catSwatches = getDisplaySwatches(cat);
            const isForwarded = forwardedComponents.includes(cat);

            return (
              <div 
                className="bg-white border-2 border-black rounded-md shadow-xs transition-all overflow-hidden"
              >
                {/* COMPONENT HEADER BAR */}
                <div 
                  className={`px-5 py-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${meta.badgeBg} border-black`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-black uppercase tracking-wider ${meta.badgeText}`}>
                      {cat === 'OTHER' || isCustomCategory(cat)
                        ? `${categoryDisplayName} Production Sheet`
                        : meta.label}
                    </span>


                  </div>

                  <div className="flex items-center gap-3">
                    {isCustomCategory(cat) && (
                      <button
                        type="button"
                        onClick={() => {
                          setComponents((prev) => {
                            const next = { ...prev };
                            delete next[cat];
                            return next;
                          });
                          setForwardedComponents((prev) => prev.filter((category) => category !== cat));
                          setSelectedCategory('TOP');
                          setWilcomEntries((prev) => prev.filter((entry) => entry.category !== cat));
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-rose-700 border border-rose-200 hover:bg-rose-50 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remove Style
                      </button>
                    )}
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold select-none">
                      <input
                        type="checkbox"
                        checked={isForwarded}
                        onChange={() => handleToggleForwarding(cat)}
                        className="w-3.5 h-3.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className={isForwarded ? 'text-emerald-950 font-black' : 'text-slate-600'}>
                        {isForwarded ? '✓ Included for Forwarding' : 'Forward Later'}
                      </span>
                    </label>
                  </div>
                </div>

                {/* EXPANDED PRODUCTION SHEET FORM (MATCHING PHYSICAL SPEC SHEET) */}
                <div className="p-6 sm:p-8 space-y-5 text-black font-sans">
                    {/* SHEET BANNER TITLE */}
                    <div className="text-center font-black text-2xl sm:text-3xl tracking-[0.25em] uppercase text-black select-none border-b border-black/10 pb-2">
                      {categoryDisplayName} PRODUCTION SHEET
                    </div>

                    {/* TOP META ROW: DESIGN NUMBER, STYLE, PATTERN, SERIAL NO, DATE, DELIVERY DATE */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left: DESIGN NUMBER, STYLE & PATTERN */}
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-1">
                            DESIGN NUMBER:
                          </label>
                          <input
                            type="text"
                            value={designNumber}
                            onChange={(e) => setDesignNumber(e.target.value)}
                            onFocus={(e) => e.target.select()}
                            placeholder="Enter Design Number..."
                            className="w-full border-[1.5px] border-black px-3 py-1.5 h-10 font-bold text-xs bg-white text-black focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-2xs"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setWilcomCategory(cat);
                            setShowWilcomModal(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-900 text-[10px] font-bold border border-purple-200 rounded transition cursor-pointer"
                          title={`Manage Wilcom specifications for ${categoryDisplayName}`}
                        >
                          <Sparkles className="w-3 h-3" />
                          Manage Wilcom
                        </button>

                        {/* STYLE & PATTERN (SIDE-BY-SIDE EQUAL BOXES) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-1">
                              STYLE:
                            </label>
                            <div className="relative">
                              <select
                                value={cat}
                                onChange={(e) => handleCategoryDropdownChange(e.target.value as GarmentCategory)}
                                aria-label="Component Category"
                                className="w-full appearance-none font-black text-xs tracking-wider uppercase bg-white text-black border-[1.5px] border-black pl-3 pr-8 py-1.5 h-10 focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer shadow-2xs"
                              >
                                <option value="TOP">TOP</option>
                                <option value="BOTTOM">BOTTOM</option>
                                <option value="DUPATTA">DUPATTA</option>
                                {componentCategories
                                  .filter((category) => category === 'OTHER' || isCustomCategory(category))
                                  .map((category) => (
                                    <option key={category} value={category}>
                                      {components[category].styleName.trim() || 'New Style'}
                                    </option>
                                  ))}
                              </select>
                              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-black">
                                <ChevronDown className="w-4 h-4 stroke-[2.5]" />
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-1">
                              PATTERN:
                            </label>
                            <input
                              type="text"
                              value={comp.pattern || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setComponents((prev) => ({
                                  ...prev,
                                  [cat]: { ...prev[cat], pattern: val },
                                }));
                              }}
                              onFocus={(e) => e.target.select()}
                              placeholder="Fill pattern manually..."
                              className="w-full border-[1.5px] border-black px-3 py-1.5 h-10 font-bold text-xs bg-white text-black focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-2xs"
                            />
                          </div>
                        </div>
                        {(cat === 'OTHER' || isCustomCategory(cat)) && (
                          <div>
                            <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-1">
                              PRODUCTION SHEET NAME:
                            </label>
                            <input
                              type="text"
                              required
                              value={comp.styleName}
                              onChange={(e) => {
                                const value = e.target.value;
                                setComponents((prev) => ({
                                  ...prev,
                                  [cat]: { ...prev[cat], styleName: value },
                                }));
                              }}
                              placeholder="Enter a production sheet name"
                              className="w-full border-[1.5px] border-black px-3 py-1.5 h-10 font-bold text-xs bg-white text-black focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-2xs"
                            />
                          </div>
                        )}
                      </div>

                      {/* Right: SERIAL NO, DATE, DELIVERY DATE */}
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-1">
                            SERIAL NO.
                          </label>
                          <input
                            type="text"
                            value={programSerialNo ? `${programSerialNo}${cat === 'TOP' ? '' : `-${cat}`}` : ''}
                            onChange={(e) => setProgramSerialNo(e.target.value.replace(new RegExp(`-${cat}$`, 'i'), ''))}
                            onFocus={(e) => e.target.select()}
                            placeholder="e.g. 101"
                            className="w-full border-[1.5px] border-black px-3 py-1.5 h-10 font-black text-center text-xs bg-white text-black focus:outline-none focus:ring-1 focus:ring-blue-600 font-mono shadow-2xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-1">
                            DATE:
                          </label>
                          <input
                            type="date"
                            value={sheetDate}
                            onChange={(e) => setSheetDate(e.target.value)}
                            className="w-full border-[1.5px] border-black px-3 py-1.5 h-10 font-bold text-xs bg-white text-black focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-2xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-1">
                            DELIVERY DATE:
                          </label>
                          <input
                            type="date"
                            value={deliveryDate}
                            onChange={(e) => setDeliveryDate(e.target.value)}
                            className="w-full border-[1.5px] border-black px-3 py-1.5 h-10 font-bold text-xs bg-white text-black focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-2xs"
                          />
                        </div>
                      </div>
                    </div>

                    {/* THREE EQUAL SIZED BOXES: CLIENT NAME, PRIORITY, IS DYEING REQUIRED */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                      {/* CLIENT NAME */}
                      <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-1">
                          CLIENT NAME
                        </label>
                        {canViewClientName(currentUser) ? (
                          <input
                            type="text"
                            value={clientName}
                            onChange={(e) => setClientName(e.target.value)}
                            onFocus={(e) => e.target.select()}
                            placeholder="Client Name..."
                            className="w-full border-[1.5px] border-black px-3 py-1.5 h-10 font-bold text-xs bg-white text-black focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-2xs"
                          />
                        ) : (
                          <div className="w-full border-[1.5px] border-black px-3 py-1.5 h-10 font-bold text-xs bg-slate-100 text-slate-400 flex items-center justify-between shadow-2xs">
                            <span>••••••••</span>
                            <span className="text-[10px] text-slate-400 font-normal">Restricted</span>
                          </div>
                        )}
                      </div>

                      {/* PRIORITY */}
                      <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-1">
                          PRIORITY
                        </label>
                        <div className="relative">
                          <select
                            value={clientPriority}
                            onChange={(e) => setClientPriority(e.target.value)}
                            className="w-full appearance-none border-[1.5px] border-black pl-3 pr-8 py-1.5 h-10 font-bold text-xs bg-white text-black focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer shadow-2xs"
                          >
                            <option value="LOW">LOW</option>
                            <option value="NORMAL">NORMAL</option>
                            <option value="HIGH">HIGH (Expedited)</option>
                            <option value="URGENT">URGENT (Top Floor)</option>
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-black">
                            <ChevronDown className="w-4 h-4 stroke-[2.5]" />
                          </div>
                        </div>
                      </div>

                      {/* IS DYEING REQUIRED */}
                      <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-1">
                          IS DYEING REQUIRED?
                        </label>
                        <div className="relative">
                          <select
                            value={fabricDyeingRequired ? 'YES' : 'NO'}
                            onChange={(e) => setFabricDyeingRequired(e.target.value === 'YES')}
                            className="w-full appearance-none border-[1.5px] border-black pl-3 pr-8 py-1.5 h-10 font-bold text-xs bg-white text-black focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer shadow-2xs"
                          >
                            <option value="NO">NO (Pre-Dyed)</option>
                            <option value="YES">YES (Kora)</option>
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-black">
                            <ChevronDown className="w-4 h-4 stroke-[2.5]" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* FABRIC & WIDTH (UNIFORM BOX SIZE) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                      <div className="relative">
                        <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-1">
                          FABRIC:
                        </label>
                        <input
                          type="text"
                          value={comp.fabricName || fabricName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setComponents((prev) => ({
                              ...prev,
                              [cat]: { ...prev[cat], fabricName: val },
                            }));
                          }}
                          onFocus={(e) => {
                            e.target.select();
                            setActiveFabricPicker(cat);
                            void loadAvailableFabricStocks();
                          }}
                          onBlur={() => {
                            window.setTimeout(() => {
                              setActiveFabricPicker((current) => current === cat ? null : current);
                            }, 120);
                          }}
                          placeholder="e.g. Cotton Viscose..."
                          className="w-full border-[1.5px] border-black px-3 py-1.5 h-10 font-bold text-xs bg-white text-black focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-2xs"
                        />
                        {activeFabricPicker === cat && (
                          <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-56 overflow-y-auto rounded border border-slate-300 bg-white shadow-lg">
                            <div className="sticky top-0 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                              Fabric available in Store
                            </div>
                            {loadingFabricStocks ? (
                              <div className="px-3 py-3 text-xs text-slate-500">Loading available fabrics...</div>
                            ) : (() => {
                              const query = String(comp.fabricName || fabricName || '').trim().toLowerCase();
                              const matchingStocks = availableFabricStocks.filter((stock) =>
                                !query || stock.itemName.toLowerCase().includes(query)
                              );
                              return matchingStocks.length > 0 ? matchingStocks.map((stock) => (
                                <button
                                  key={`${stock.itemName}-${stock.fabricType}-${stock.unit}`}
                                  type="button"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => {
                                    setComponents((prev) => ({
                                      ...prev,
                                      [cat]: { ...prev[cat], fabricName: stock.itemName },
                                    }));
                                    setActiveFabricPicker(null);
                                  }}
                                  className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left hover:bg-blue-50"
                                >
                                  <span className="truncate text-xs font-semibold text-slate-800">{stock.itemName}</span>
                                  <span className="shrink-0 text-[11px] font-bold text-emerald-700">
                                    {stock.balance.toLocaleString('en-IN', { maximumFractionDigits: 2 })} {stock.unit} available
                                  </span>
                                </button>
                              )) : (
                                <div className="px-3 py-3 text-xs text-slate-500">
                                  {fabricStocksLoaded ? 'No matching fabric in stock.' : 'No fabrics available.'}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-1">
                          WIDTH:
                        </label>
                        <input
                          type="text"
                          value={comp.fabricWidth || fabricWidth}
                          onChange={(e) => {
                            const val = e.target.value;
                            setComponents((prev) => ({
                              ...prev,
                              [cat]: { ...prev[cat], fabricWidth: val },
                            }));
                          }}
                          onFocus={(e) => e.target.select()}
                          placeholder="e.g. 58 inches..."
                          className="w-full border-[1.5px] border-black px-3 py-1.5 h-10 font-bold text-xs bg-white text-black focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-2xs"
                        />
                      </div>
                    </div>

                    {/* AVERAGE SECTION (SUB STYLES & CONSUMPTION) */}
                    <div className="pt-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-black text-xs uppercase tracking-wider">AVERAGE</span>
                        <button
                          type="button"
                          onClick={() => handleAddSubStyle(cat)}
                          className="text-[10px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Sub Style</span>
                        </button>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse border-[1.5px] border-black text-center text-xs">
                          <thead>
                            <tr className="bg-white">
                              {comp.subStyles.map((sub, sIdx) => (
                                <th key={sIdx} className="border-[1.5px] border-black p-1.5 font-black text-[11px] tracking-wider uppercase relative">
                                  <div className="flex items-center justify-center gap-1">
                                    <input
                                      type="text"
                                      value={sub.name}
                                      onChange={(e) => handleSubStyleNameChange(cat, sIdx, e.target.value)}
                                      onFocus={(e) => e.target.select()}
                                      placeholder=""
                                      className="font-black text-[11px] text-center w-full uppercase bg-transparent border-none focus:outline-none focus:bg-blue-50"
                                    />
                                    {comp.subStyles.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveSubStyle(cat, sIdx)}
                                        className="text-slate-300 hover:text-rose-600 transition p-0.5 cursor-pointer"
                                        title={`Remove ${sub.name}`}
                                      >
                                        &times;
                                      </button>
                                    )}
                                  </div>
                                </th>
                              ))}
                              <th className="border-[1.5px] border-black p-1.5 font-black text-[11px] tracking-wider uppercase bg-slate-50 w-24">
                                TOTAL MTR
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="h-8 font-bold text-xs">
                              {comp.subStyles.map((sub, sIdx) => (
                                <td key={sIdx} className="border-[1.5px] border-black p-1">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={sub.average}
                                    onChange={(e) => handleSubStyleAverageChange(cat, sIdx, e.target.value)}
                                    onFocus={(e) => e.target.select()}
                                    placeholder=""
                                    className="w-full text-center font-bold text-xs py-1 px-1 border-none focus:outline-none focus:bg-blue-50/60"
                                  />
                                </td>
                              ))}
                              <td className="border-[1.5px] border-black p-1 font-black text-sm bg-slate-50 text-blue-950">
                                {catAvg > 0 ? catAvg.toFixed(2) : ''}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* PRODUCTION BREAKDOWN GRID */}
                    <div className="pt-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-black text-xs uppercase tracking-wider">
                          PRODUCTION BREAKDOWN GRID ({comp.productionGrid.length} COLOR LOTS)
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleAddGridRow(cat)}
                            className="text-[10px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add Item / Color Row</span>
                          </button>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse border-[1.5px] border-black text-center text-xs">
                          <thead>
                            <tr className="bg-white">
                              <th rowSpan={2} className="border-[1.5px] border-black p-1 font-black text-xs tracking-wider uppercase w-36">
                                COLOR
                              </th>
                              <th colSpan={2} className="border-[1.5px] border-black p-1 font-black text-xs tracking-wider uppercase">
                                QTY
                              </th>
                              <th rowSpan={2} className="border-[1.5px] border-black p-1 font-black text-xs tracking-wider uppercase w-48">
                                SUB STYLE
                              </th>
                              <th rowSpan={2} className="border-[1.5px] border-black p-1 font-black text-xs tracking-wider uppercase w-36">
                                SIZE
                              </th>
                              <th rowSpan={2} className="border-[1.5px] border-black p-1 font-bold text-[10px] w-8">
                                &nbsp;
                              </th>
                            </tr>
                            <tr className="bg-white">
                              <th className="border-[1.5px] border-black p-1 font-black text-[11px] w-24">MTR</th>
                              <th className="border-[1.5px] border-black p-1 font-black text-[11px] w-20">PCS</th>
                            </tr>
                          </thead>
                          <tbody>
                            {comp.productionGrid.map((row, rIdx) => {
                              const rowSubStyles = Array.isArray(row.subStyles) && row.subStyles.length > 0
                                ? row.subStyles
                                : row.subStyle
                                  ? row.subStyle.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
                                  : [];
                              const rowSizeExpression = row.size ?? (rowSubStyles[0] ? row.sizes?.[rowSubStyles[0]] : '') ?? (row.sizes?.['SIZE'] || '');
                              const rowSubStyleTotals = rowSubStyles.map((sub) => calculateSizeTotal(row.sizes?.[sub]));
                              const rowSizeTotal = rowSubStyleTotals.length > 1 &&
                                rowSubStyles.every((sub) => String(row.sizes?.[sub] || '').trim()) &&
                                rowSubStyleTotals.every((total) => total !== null)
                                ? rowSubStyleTotals.reduce((sum, total) => sum + (total || 0), 0)
                                : null;

                              return (
                              <tr key={row.id || rIdx} className="h-8">
                                {/* COLOR */}
                                <td className="border-[1.5px] border-black p-0.5">
                                  <input
                                    type="text"
                                    value={row.color}
                                    onChange={(e) => handleGridRowChange(cat, rIdx, 'color', e.target.value)}
                                    onFocus={(e) => e.target.select()}
                                    placeholder=""
                                    className="w-full px-2 py-1 font-bold text-xs text-black border-none focus:outline-none focus:bg-blue-50"
                                  />
                                </td>

                                {/* MTR */}
                                <td className="border-[1.5px] border-black p-0.5 font-bold text-center text-xs bg-slate-50/50">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={row.mtr}
                                    onChange={(e) => handleGridRowChange(cat, rIdx, 'mtr', e.target.value)}
                                    onFocus={(e) => e.target.select()}
                                    placeholder=""
                                    className="w-full px-1 py-1 font-bold text-center text-xs text-black border-none focus:outline-none focus:bg-blue-50 bg-transparent"
                                  />
                                </td>

                                {/* PCS */}
                                <td className="border-[1.5px] border-black p-0.5">
                                  <input
                                    type="number"
                                    min="0"
                                    value={row.pcs}
                                    onChange={(e) => handleGridRowChange(cat, rIdx, 'pcs', e.target.value)}
                                    onFocus={(e) => e.target.select()}
                                    placeholder=""
                                    className="w-full px-1 py-1 font-bold text-center text-xs text-black border-none focus:outline-none focus:bg-blue-50"
                                  />
                                </td>

                                {/* SUB STYLE (multi-select / chips) */}
                                <td className="border-[1.5px] border-black p-0.5 relative">
                                  <SubStyleMultiSelectCell
                                    cat={cat}
                                    rIdx={rIdx}
                                    row={row}
                                    compSubStyles={comp.subStyles}
                                    isPickerOpen={activeSubStylePicker?.cat === cat && activeSubStylePicker?.rowIndex === rIdx}
                                    onOpenPicker={() => {
                                      setActiveSubStylePicker({ cat, rowIndex: rIdx });
                                      setCustomSubStyleInput('');
                                    }}
                                    onClosePicker={() => setActiveSubStylePicker(null)}
                                    onToggleSubStyle={(sub) => handleGridRowSubStylesToggle(cat, rIdx, sub)}
                                    onSetSubStyles={(subs) => handleGridRowSubStylesSet(cat, rIdx, subs)}
                                    onApplyAll={() => handleApplySubStylesToAllRows(cat, rIdx)}
                                    onSubStyleTextChange={(txt) => handleGridRowChange(cat, rIdx, 'subStyle', txt)}
                                    customSubStyleInput={customSubStyleInput}
                                    setCustomSubStyleInput={setCustomSubStyleInput}
                                    canApplyAll={comp.productionGrid.length > 1}
                                  />
                                </td>

                                {/* SIZE CELL (Per-SubStyle Inputs) */}
                                <td className="border-[1.5px] border-black p-0.5 align-middle">
                                  {rowSubStyles.length > 1 ? (
                                    <div className="flex flex-col gap-1 p-1">
                                      {rowSubStyles.map((sub) => (
                                        <div
                                          key={sub}
                                          className="flex items-center gap-1 bg-white border border-slate-300 rounded px-1.5 py-0.5 shadow-2xs"
                                        >
                                          <span className="text-[10px] font-black uppercase text-blue-900 bg-blue-50 border border-blue-200 px-1 py-0.5 rounded shrink-0">
                                            {sub}
                                          </span>
                                          <input
                                            type="text"
                                            value={row.sizes?.[sub] || ''}
                                            onChange={(e) => handleGridSizeChange(cat, rIdx, sub, e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                            placeholder="1 + 3 + 0.5"
                                            className="min-w-0 flex-1 text-center font-bold text-xs text-black border-none focus:outline-none uppercase bg-transparent"
                                          />
                                          {calculateSizeTotal(row.sizes?.[sub]) !== null && (
                                            <span className="shrink-0 border-l border-slate-200 pl-1.5 text-[10px] font-black text-emerald-700">
                                              {formatSizeTotal(calculateSizeTotal(row.sizes?.[sub])!)}
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                      {rowSizeTotal !== null && (
                                        <div className="text-right text-[10px] font-black text-emerald-800">
                                          TOTAL {formatSizeTotal(rowSizeTotal)}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1 px-1">
                                      <input
                                        type="text"
                                        value={rowSizeExpression}
                                        onChange={(e) => rowSubStyles[0]
                                          ? handleGridSizeChange(cat, rIdx, rowSubStyles[0], e.target.value)
                                          : handleGridRowChange(cat, rIdx, 'size', e.target.value)}
                                        onFocus={(e) => e.target.select()}
                                        placeholder="1 + 3 + 0.5"
                                        className="min-w-0 flex-1 px-1 py-1 text-center font-bold text-xs text-black border-none focus:outline-none focus:bg-blue-50 uppercase"
                                      />
                                      {calculateSizeTotal(rowSizeExpression) !== null && (
                                        <span className="shrink-0 border-l border-slate-200 pl-1.5 text-[10px] font-black text-emerald-700">
                                          {formatSizeTotal(calculateSizeTotal(rowSizeExpression)!)}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </td>

                                {/* REMOVE ROW */}
                                <td className="border-[1.5px] border-black p-0.5">
                                  {comp.productionGrid.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveGridRow(cat, rIdx)}
                                      className="text-slate-300 hover:text-rose-600 transition p-1 cursor-pointer"
                                      title="Remove color row"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                            })}
                          </tbody>

                          <tfoot>
                            <tr className="bg-slate-100 font-bold border-t-[1.5px] border-black text-xs">
                              <td className="border-[1.5px] border-black p-1.5 text-right font-black uppercase text-[10px]">
                                {cat} TOTALS:
                              </td>
                              <td className="border-[1.5px] border-black p-1.5 text-center font-black text-sm text-emerald-800">
                                {catMeters > 0 ? catMeters.toFixed(2) : ''}
                              </td>
                              <td className="border-[1.5px] border-black p-1.5 text-center font-black text-sm text-[#163767]">
                                {catPieces > 0 ? catPieces : ''}
                              </td>
                              <td colSpan={3} className="border-[1.5px] border-black p-1.5 text-right text-[10px]">
                                <span className="font-black text-slate-800 not-italic">
                                  TOTAL MEASUREMENT: {catMeasurementTotal !== null ? formatSizeTotal(catMeasurementTotal) : '—'}
                                </span>
                                {catAvg > 0 && (
                                  <span className="ml-3 text-slate-500 italic">
                                    Fabric consumption @ {catAvg.toFixed(2)} Mtr/Pc
                                  </span>
                                )}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>

                    {/* FOOTER: NOTE, REMARKS, SWATCHES, SIGNATURE */}
                    <div className="space-y-4 pt-3 border-t border-black/10">
                      {/* NOTE & REMARKS side-by-side */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="font-black text-xs tracking-wider uppercase block mb-1">
                            NOTE:-
                          </label>
                          <textarea
                            rows={2}
                            value={comp.noteText}
                            onChange={(e) => {
                              const val = e.target.value;
                              setComponents((prev) => ({
                                ...prev,
                                [cat]: { ...prev[cat], noteText: val },
                              }));
                            }}
                            placeholder=""
                            className="w-full px-2.5 py-1.5 border-[1.5px] border-black text-xs font-sans text-black focus:outline-none focus:ring-1 focus:ring-blue-600 resize-none bg-white"
                          />
                        </div>

                        <div>
                          <label className="font-black text-xs tracking-wider uppercase block mb-1">
                            REMARKS:-
                          </label>
                          <textarea
                            rows={2}
                            value={comp.remarksText}
                            onChange={(e) => {
                              const val = e.target.value;
                              setComponents((prev) => ({
                                ...prev,
                                [cat]: { ...prev[cat], remarksText: val },
                              }));
                            }}
                            placeholder=""
                            className="w-full px-2.5 py-1.5 border-[1.5px] border-black text-xs font-sans text-black focus:outline-none focus:ring-1 focus:ring-blue-600 resize-none bg-white"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row justify-between items-end gap-6 pt-2">
                        {/* Left: SWATCH SAMPLES */}
                        <div className="w-full sm:w-3/5 space-y-2">
                          <label className="font-black text-xs tracking-wider uppercase text-[#163767] block mb-2">
                            COLOR SWATCHES:
                          </label>

                          <div className="flex flex-wrap items-center gap-3 p-2.5 bg-slate-50/70 border border-slate-200 rounded-lg min-h-[64px]">
                            {catSwatches.length > 0 ? (
                              catSwatches.map((swatch) => (
                                <div key={swatch.id} className="group relative flex flex-col items-center gap-1">
                                  <label
                                    className="relative w-11 h-11 cursor-pointer transition-transform hover:scale-105 active:scale-95 shadow-2xs block"
                                    style={{
                                      backgroundColor: swatch.color,
                                      clipPath: SWATCH_CLIP_PATH,
                                    }}
                                    title={`Click to pick shade for "${swatch.name}"`}
                                  >
                                    <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-[2px] bg-slate-800 shadow-2xs pointer-events-none" />
                                    <input
                                      type="color"
                                      value={swatch.color.startsWith('#') ? swatch.color : '#CBD5E1'}
                                      onChange={(e) => handleUpdateSwatchColor(cat, swatch.name, e.target.value)}
                                      className="sr-only"
                                    />
                                  </label>
                                  <span className="text-[8.5px] font-bold text-slate-800 truncate max-w-[65px] text-center">
                                    {swatch.name}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <div className="flex items-center gap-3">
                                {[1, 2, 3, 4].map((i) => (
                                  <div key={i} className="flex flex-col items-center gap-1">
                                    <div className="w-11 h-11 border-[1.5px] border-dashed border-slate-400 bg-white relative flex items-center justify-center rounded-xs shadow-2xs">
                                      <span className="w-3.5 h-[2px] bg-slate-400 opacity-60" />
                                    </div>
                                    <span className="text-[8px] font-bold text-slate-400">Attach Swatch</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right: SIGNATURE */}
                        <div className="w-full sm:w-1/3 text-center space-y-2">
                          <div className="font-black text-xs tracking-wider uppercase">
                            SIGNATURE
                          </div>
                          <input
                            type="text"
                            value={comp.signatureName}
                            onChange={(e) => {
                              const val = e.target.value;
                              setComponents((prev) => ({
                                ...prev,
                                [cat]: { ...prev[cat], signatureName: val },
                              }));
                            }}
                            onFocus={(e) => e.target.select()}
                            placeholder=""
                            className="w-full h-10 text-center font-bold text-xs border-[1.5px] border-black bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 px-3"
                          />
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              );
            })()}
        </section>


        {/* BOTTOM ACTION BUTTONS */}
        <div className="pt-2 flex items-center justify-end gap-3">
          <Link
            href="/my-work"
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded shadow-2xs hover:bg-slate-50 transition"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={() => handleSubmit('DRAFT')}
            disabled={loading}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded border border-slate-300 shadow-2xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-500" /> : null}
            <span>{loading ? 'Saving...' : 'Save as Draft'}</span>
          </button>
          <button
            type="button"
            onClick={() => handleSubmit('READY_FOR_ISSUE')}
            disabled={loading}
            className="px-6 py-2 bg-[#163767] hover:bg-[#0F264A] disabled:opacity-50 text-white text-xs font-bold rounded shadow-xs transition flex items-center gap-2 cursor-pointer"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{loading ? 'Submitting Ready for Issue...' : 'Complete & Submit Ready for Issue'}</span>
          </button>
        </div>

      </main>

      {/* WILCOM SPECIFICATIONS MODAL / SHEET */}
      <WilcomDesignModal
        isOpen={showWilcomModal}
        onClose={() => setShowWilcomModal(false)}
        wilcomEntries={wilcomEntries}
        onSaveEntries={setWilcomEntries}
        activeCategory={wilcomCategory}
        defaultStyleName={components[wilcomCategory]?.styleName}
      />

      {/* PRINT & DOWNLOAD MODALS */}
      <ProductionSheetPrintModal
        program={success}
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        initialTab={selectedCategory}
      />

      <WilcomPrintModal
        program={success}
        isOpen={showWilcomPrintModal}
        onClose={() => setShowWilcomPrintModal(false)}
        initialCategory={wilcomCategory}
        onViewSheet={() => {
          setShowWilcomPrintModal(false);
          setShowPrintModal(true);
        }}
        onProgramUpdate={(updated) => {
          setSuccess((prev: any) => ({ ...prev, ...updated }));
          if (Array.isArray(updated?.wilcomEntries) && updated.wilcomEntries.length > 0) {
            setWilcomEntries(updated.wilcomEntries);
          }
        }}
      />
    </div>
  );
}
