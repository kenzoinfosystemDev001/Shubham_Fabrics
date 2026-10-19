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
  Upload,
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
  ComponentSheetData
} from '@/lib/download-production-sheet';
import { WilcomDesignModal } from '@/components/wilcom/WilcomDesignModal';
import { WilcomPrintModal } from '@/components/wilcom/WilcomPrintModal';
import { 
  WilcomEntry, 
  printWilcomForm, 
  downloadWilcomFormHtml 
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

const CATEGORY_META: Record<GarmentCategory, {
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
    label: 'OTHER Production Sheet',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-900',
    accentBorder: 'border-amber-700',
    subHeader: 'OTHER:-',
  },
};

export default function CreateProductionSheetPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<any | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [createdProgramId, setCreatedProgramId] = useState<string | null>(null);

  // Common / Shared Order Header Fields
  const [designNumber, setDesignNumber] = useState('');
  const [sheetDate, setSheetDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [programSerialNo, setProgramSerialNo] = useState('');
  const [serialNoCounter, setSerialNoCounter] = useState('');
  const [fabricName, setFabricName] = useState('');
  const [fabricWidth, setFabricWidth] = useState('');

  // Four Garment Components: TOP, BOTTOM, DUPATTA, OTHER
  // Starts clean with NO dummy data
  const [components, setComponents] = useState<Record<GarmentCategory, ComponentState>>({
    TOP: {
      enabled: true,
      styleName: '',
      pattern: '',
      fabricName: '',
      fabricWidth: '',
      subStyles: DEFAULT_SUB_STYLES.map((s) => ({ ...s, average: '' })),
      productionGrid: [{ id: 'top-row-1', color: '', pcs: '', mtr: '', subStyle: '', size: '', sizes: {} }],
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
      productionGrid: [{ id: 'bottom-row-1', color: '', pcs: '', mtr: '', subStyle: '', size: '', sizes: {} }],
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
      productionGrid: [{ id: 'dupatta-row-1', color: '', pcs: '', mtr: '', subStyle: '', size: '', sizes: {} }],
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
      productionGrid: [{ id: 'other-row-1', color: '', pcs: '', mtr: '', subStyle: '', size: '', sizes: {} }],
      swatchColorOverrides: {},
      noteText: '',
      remarksText: '',
      signatureName: '',
    },
  });

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
    const pieces = getTotalPieces(cat);
    const avg = getTotalMtrAverage(cat);
    return Math.round(pieces * avg * 100) / 100;
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
    (['TOP', 'BOTTOM', 'DUPATTA'] as GarmentCategory[]).forEach((cat) => {
      if (components[cat].enabled) {
        sum += getTotalPieces(cat);
      }
    });
    return sum;
  }, [components]);

  const overallFabricMeters = useMemo(() => {
    let sum = 0;
    (['TOP', 'BOTTOM', 'DUPATTA'] as GarmentCategory[]).forEach((cat) => {
      if (components[cat].enabled) {
        sum += getTotalFabricMeters(cat);
      }
    });
    return Math.round(sum * 100) / 100;
  }, [components]);

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

  // Handle Category Change from Sheet Dropdown (where TOP / BOTTOM / DUPATTA is selected)
  const handleCategoryDropdownChange = (newCat: GarmentCategory) => {
    if (newCat === selectedCategory) return;
    const oldCat = selectedCategory;
    setSelectedCategory(newCat);

    // Transfer/update component states
    setComponents((prev) => {
      const currentData = prev[oldCat];
      const targetData = prev[newCat];

      const hasEnteredStyle = Boolean(currentData.styleName.trim());
      const hasEnteredFabric = Boolean(currentData.fabricName.trim() || currentData.fabricWidth.trim());
      const hasEnteredNotes = Boolean(currentData.noteText.trim());
      const hasCustomGrid = currentData.productionGrid.some((r) => r.color || r.pcs || r.mtr);

      const defaultSubStylesForNew = getDefaultSubStylesForCategory(newCat).map((s) => ({ ...s, average: '' }));
      const targetHasValues = targetData.subStyles.some((s) => s.average !== '');
      const nextSubStyles = targetHasValues ? targetData.subStyles : defaultSubStylesForNew;

      return {
        ...prev,
        [newCat]: {
          ...targetData,
          enabled: true,
          styleName: hasEnteredStyle && !targetData.styleName.trim() ? currentData.styleName : targetData.styleName,
          fabricName: hasEnteredFabric && !targetData.fabricName.trim() ? currentData.fabricName : targetData.fabricName,
          fabricWidth: hasEnteredFabric && !targetData.fabricWidth.trim() ? currentData.fabricWidth : targetData.fabricWidth,
          noteText: hasEnteredNotes && !targetData.noteText.trim() ? currentData.noteText : targetData.noteText,
          productionGrid: hasCustomGrid && targetData.productionGrid.length <= 1 && !targetData.productionGrid[0]?.color
            ? currentData.productionGrid
            : targetData.productionGrid,
          subStyles: nextSubStyles,
        },
        [oldCat]: {
          ...currentData,
          enabled: false,
        },
      };
    });

    setForwardedComponents([newCat]);
  };

  // Component SubStyle Changes
  const handleSubStyleAverageChange = (cat: GarmentCategory, index: number, newAverage: number | string) => {
    const updatedSubStyles = [...components[cat].subStyles];
    updatedSubStyles[index] = { ...updatedSubStyles[index], average: newAverage };

    const newTotal = Math.round(
      updatedSubStyles.reduce((acc, it) => acc + (Number(it.average) || 0), 0) * 100
    ) / 100;

    const updatedGrid = components[cat].productionGrid.map((row) => ({
      ...row,
      mtr: row.pcs !== '' && Number(row.pcs) > 0 ? Math.round(Number(row.pcs) * newTotal * 100) / 100 : '',
    }));

    setComponents((prev) => ({
      ...prev,
      [cat]: {
        ...prev[cat],
        subStyles: updatedSubStyles,
        productionGrid: updatedGrid,
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

    const newTotal = Math.round(
      updatedSubStyles.reduce((acc, it) => acc + (Number(it.average) || 0), 0) * 100
    ) / 100;

    const updatedGrid = components[cat].productionGrid.map((row) => {
      const nextSizes = { ...row.sizes };
      delete nextSizes[removedName];
      return {
        ...row,
        mtr: row.pcs !== '' && Number(row.pcs) > 0 ? Math.round(Number(row.pcs) * newTotal * 100) / 100 : '',
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
      const numPcs = Number(value);
      target.pcs = value;
      target.mtr = value !== '' && Number.isFinite(numPcs) && numPcs > 0 && totalAvg > 0 ? Math.round(numPcs * totalAvg * 100) / 100 : target.mtr;
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
    target.sizes = { ...target.sizes, [subStyleName]: sizeVal };
    updatedGrid[rowIndex] = target;

    setComponents((prev) => ({
      ...prev,
      [cat]: {
        ...prev[cat],
        productionGrid: updatedGrid,
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

    const enabledCats = (['TOP', 'BOTTOM', 'DUPATTA'] as GarmentCategory[]).filter((c) => components[c].enabled);
    if (enabledCats.length === 0) {
      setError('Please enable at least one Production Sheet (TOP, BOTTOM, or DUPATTA).');
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Verify pieces in enabled components
    for (const cat of enabledCats) {
      const pcs = getTotalPieces(cat);
      if (pcs <= 0) {
        setError(`Please enter at least one color row with positive PCS quantity for ${cat} Production Sheet.`);
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
      const componentsPayload: Record<GarmentCategory, ComponentSheetData> = {
        TOP: {
          enabled: components.TOP.enabled,
          forwarded: forwardedComponents.includes('TOP'),
          category: 'TOP',
          styleName: components.TOP.styleName.trim(),
          pattern: (components.TOP.pattern || '').trim(),
          fabricName: components.TOP.fabricName.trim() || fabricName.trim(),
          fabricWidth: components.TOP.fabricWidth.trim() || fabricWidth.trim(),
          subStyles: components.TOP.subStyles,
          productionGrid: components.TOP.productionGrid,
          swatches: getDisplaySwatches('TOP'),
          note: components.TOP.noteText.trim(),
          remarks: components.TOP.remarksText.trim(),
          totalMtrAverage: getTotalMtrAverage('TOP'),
          totalPieces: getTotalPieces('TOP'),
          totalFabricMeters: getTotalFabricMeters('TOP'),
        },
        BOTTOM: {
          enabled: components.BOTTOM.enabled,
          forwarded: forwardedComponents.includes('BOTTOM'),
          category: 'BOTTOM',
          styleName: components.BOTTOM.styleName.trim(),
          pattern: (components.BOTTOM.pattern || '').trim(),
          fabricName: components.BOTTOM.fabricName.trim() || fabricName.trim(),
          fabricWidth: components.BOTTOM.fabricWidth.trim() || fabricWidth.trim(),
          subStyles: components.BOTTOM.subStyles,
          productionGrid: components.BOTTOM.productionGrid,
          swatches: getDisplaySwatches('BOTTOM'),
          note: components.BOTTOM.noteText.trim(),
          remarks: components.BOTTOM.remarksText.trim(),
          totalMtrAverage: getTotalMtrAverage('BOTTOM'),
          totalPieces: getTotalPieces('BOTTOM'),
          totalFabricMeters: getTotalFabricMeters('BOTTOM'),
        },
        DUPATTA: {
          enabled: components.DUPATTA.enabled,
          forwarded: forwardedComponents.includes('DUPATTA'),
          category: 'DUPATTA',
          styleName: components.DUPATTA.styleName.trim(),
          pattern: (components.DUPATTA.pattern || '').trim(),
          fabricName: components.DUPATTA.fabricName.trim() || fabricName.trim(),
          fabricWidth: components.DUPATTA.fabricWidth.trim() || fabricWidth.trim(),
          subStyles: components.DUPATTA.subStyles,
          productionGrid: components.DUPATTA.productionGrid,
          swatches: getDisplaySwatches('DUPATTA'),
          note: components.DUPATTA.noteText.trim(),
          remarks: components.DUPATTA.remarksText.trim(),
          totalMtrAverage: getTotalMtrAverage('DUPATTA'),
          totalPieces: getTotalPieces('DUPATTA'),
          totalFabricMeters: getTotalFabricMeters('DUPATTA'),
        },
        OTHER: {
          enabled: components.OTHER.enabled,
          forwarded: forwardedComponents.includes('OTHER'),
          category: 'OTHER',
          styleName: components.OTHER.styleName.trim(),
          pattern: (components.OTHER.pattern || '').trim(),
          fabricName: components.OTHER.fabricName.trim() || fabricName.trim(),
          fabricWidth: components.OTHER.fabricWidth.trim() || fabricWidth.trim(),
          subStyles: components.OTHER.subStyles,
          productionGrid: components.OTHER.productionGrid,
          swatches: getDisplaySwatches('OTHER'),
          note: components.OTHER.noteText.trim(),
          remarks: components.OTHER.remarksText.trim(),
          totalMtrAverage: getTotalMtrAverage('OTHER'),
          totalPieces: getTotalPieces('OTHER'),
          totalFabricMeters: getTotalFabricMeters('OTHER'),
        },
      };

      const primaryCat: GarmentCategory = selectedCategory;
      const primary = components[primaryCat];
      const primaryAvg = getTotalMtrAverage(primaryCat);
      const primaryPieces = getTotalPieces(primaryCat);

      const payload: any = {
        id: createdProgramId || undefined,
        programNumber: programSerialNo.trim() || undefined,
        programSerialNo: programSerialNo.trim(),
        designNumber: designNumber.trim(),
        topName: primary.styleName.trim() || designNumber.trim(),
        mainStyle: primary.styleName.trim() || designNumber.trim(),
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
        wilcomEntries: wilcomEntries,
        wilcomDesignNumber: wilcomEntries[0]?.wilcomDesignNumber || '',
        wilcomDesignPhoto: wilcomEntries[0]?.photoUrl || '',
      };

      const result = await api.createProductionSheet(payload);
      if (result?.id) {
        setCreatedProgramId(result.id);
      }
      setSuccess(result);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save Production Sheets.');
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
              <span>Production Sheet &amp; Wilcom Management</span>
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
          <div className="p-5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 space-y-3 shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-bold">
                Production Sheets Saved Successfully &middot; Serial #{success.programSerialNo || success.programNumber}
              </h3>
            </div>
            <p className="text-xs text-emerald-800 leading-relaxed font-sans">
              Status is marked as <strong className="font-bold">{success.status}</strong>. Forwarded sheets: <strong className="font-bold">{forwardedComponents.join(', ')}</strong>. Wilcom designs attached: <strong className="font-bold">{wilcomEntries.length}</strong>.
            </p>
            <div className="pt-1 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => printProductionSheet(success, 'ALL')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded shadow-2xs transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print All Forwarded Sheets (A4)</span>
              </button>

              <button
                type="button"
                onClick={() => printWilcomForm(success)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded shadow-2xs transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Print Wilcom Form (A4)</span>
              </button>

              <button
                type="button"
                onClick={() => downloadProductionSheetHtml(success, 'ALL')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded shadow-2xs transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Sheets (.html)</span>
              </button>

              <button
                type="button"
                onClick={() => downloadWilcomFormHtml(success)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-black text-white text-xs font-bold rounded shadow-2xs transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Wilcom (.html)</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPrintModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-300 text-emerald-900 text-xs font-bold rounded hover:bg-emerald-100/50 transition cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview Documents</span>
              </button>

              <Link
                href={`/programs/${success.id}`}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded hover:bg-slate-50 transition"
              >
                <span>View Details</span>
                <ExternalLink className="w-3 h-3" />
              </Link>

              <Link
                href={`/my-work/issue-challan?programId=${success.id}`}
                className="px-3.5 py-1.5 bg-[#163767] hover:bg-[#0F264A] text-white text-xs font-bold rounded shadow-2xs transition"
              >
                Issue Challan →
              </Link>
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
                className={`text-[10px] font-black px-2.5 py-0.5 rounded border ${CATEGORY_META[selectedCategory].badgeBg} ${CATEGORY_META[selectedCategory].badgeText} border-black/20`}
              >
                {selectedCategory}
              </span>
            </div>
          </div>

          {(() => {
            const cat = selectedCategory;
            const comp = components[cat];
            const meta = CATEGORY_META[cat];
            const catAvg = getTotalMtrAverage(cat);
            const catPieces = getTotalPieces(cat);
            const catMeters = getTotalFabricMeters(cat);
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
                      {meta.label}
                    </span>

                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded bg-white border border-black/20 text-black">
                      {catPieces} PCS &middot; {catMeters.toFixed(2)} MTR
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
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
                      {cat} PRODUCTION SHEET
                    </div>

                    {/* TOP META ROW: DESIGN NUMBER, WILCOM, STYLE, PATTERN, SERIAL NO, DATE, DELIVERY DATE */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left: DESIGN NUMBER, WILCOM, STYLE & PATTERN */}
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

                        {/* WILCOM OPTION BELOW DESIGN NO. */}
                        <div>
                          <label className="block text-[11px] font-black uppercase tracking-wider text-purple-950 mb-1">
                            WILCOM - (CLICK AND OPEN SHEET):
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setWilcomCategory(cat);
                              setShowWilcomModal(true);
                            }}
                            className="w-full border-[1.5px] border-purple-800 bg-purple-50 hover:bg-purple-100 text-purple-950 px-3 py-1.5 h-10 font-black text-xs uppercase tracking-wider flex items-center justify-between transition cursor-pointer shadow-2xs"
                          >
                            <span className="flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-purple-700" />
                              <span>WILCOM ({cat})</span>
                            </span>
                            {wilcomEntries.filter((e) => e.category === cat).length > 0 ? (
                              <span className="px-2 py-0.5 rounded bg-purple-800 text-white font-mono text-[11px]">
                                № {wilcomEntries.filter((e) => e.category === cat).map((e) => e.wilcomDesignNumber).join(', ')}
                              </span>
                            ) : (
                              <span className="text-[11px] text-purple-700 font-semibold normal-case">
                                + Click &amp; Open Sheet
                              </span>
                            )}
                          </button>
                        </div>

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
                                <option value="OTHER">OTHER</option>
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
                      <div>
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
                          onFocus={(e) => e.target.select()}
                          placeholder="e.g. Cotton Viscose..."
                          className="w-full border-[1.5px] border-black px-3 py-1.5 h-10 font-bold text-xs bg-white text-black focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-2xs"
                        />
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
                              <th rowSpan={2} className="border-[1.5px] border-black p-1 font-black text-xs tracking-wider uppercase w-36">
                                <div>SUB STYLE</div>
                                <div className="text-[9px] font-normal text-slate-500 normal-case">(manual fill)</div>
                              </th>
                              <th rowSpan={2} className="border-[1.5px] border-black p-1 font-black text-xs tracking-wider uppercase w-28">
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
                            {comp.productionGrid.map((row, rIdx) => (
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

                                {/* SUB STYLE (manual fill) */}
                                <td className="border-[1.5px] border-black p-0.5">
                                  <input
                                    type="text"
                                    value={row.subStyle || ''}
                                    onChange={(e) => handleGridRowChange(cat, rIdx, 'subStyle', e.target.value)}
                                    onFocus={(e) => e.target.select()}
                                    placeholder=""
                                    className="w-full px-2 py-1 text-center font-bold text-xs text-black border-none focus:outline-none focus:bg-blue-50"
                                  />
                                </td>

                                {/* SIZE CELL */}
                                <td className="border-[1.5px] border-black p-0.5">
                                  <input
                                    type="text"
                                    value={row.size ?? (row.sizes?.['SIZE'] || '')}
                                    onChange={(e) => handleGridRowChange(cat, rIdx, 'size', e.target.value)}
                                    onFocus={(e) => e.target.select()}
                                    placeholder=""
                                    className="w-full px-2 py-1 text-center font-bold text-xs text-black border-none focus:outline-none focus:bg-blue-50"
                                  />
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
                            ))}
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
                              <td colSpan={3} className="border-[1.5px] border-black p-1.5 text-right text-[10px] text-slate-500 italic">
                                {catAvg > 0 ? `Fabric consumption @ ${catAvg.toFixed(2)} Mtr/Pc` : ''}
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
        defaultStyleName={components[wilcomCategory]?.styleName || ''}
      />

      {/* PRINT & DOWNLOAD MODALS */}
      <ProductionSheetPrintModal
        program={success}
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
      />

      <WilcomPrintModal
        program={success}
        isOpen={showWilcomPrintModal}
        onClose={() => setShowWilcomPrintModal(false)}
      />
    </div>
  );
}
