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
import { ProductionSheetPrintModal } from '@/components/ProductionSheetPrintModal';
import { 
  downloadProductionSheetHtml, 
  printProductionSheet,
  downloadWilcomFormHtml,
  printWilcomForm,
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
  WilcomEntry,
  ComponentSheetData
} from '@/lib/download-production-sheet';

interface ComponentState {
  enabled: boolean;
  styleName: string;
  fabricName: string;
  fabricWidth: string;
  subStyles: SubStyleAverage[];
  productionGrid: ProductionGridItem[];
  swatchColorOverrides: Record<string, string>;
  noteText: string;
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

  // Three Garment Components: TOP, BOTTOM, DUPATTA
  // Starts clean with NO dummy data
  const [components, setComponents] = useState<Record<GarmentCategory, ComponentState>>({
    TOP: {
      enabled: true,
      styleName: '',
      fabricName: '',
      fabricWidth: '',
      subStyles: DEFAULT_SUB_STYLES.map((s) => ({ ...s, average: '' })),
      productionGrid: [{ id: 'top-row-1', color: '', pcs: '', mtr: '', sizes: {} }],
      swatchColorOverrides: {},
      noteText: '',
      signatureName: '',
    },
    BOTTOM: {
      enabled: false,
      styleName: '',
      fabricName: '',
      fabricWidth: '',
      subStyles: DEFAULT_BOTTOM_SUB_STYLES.map((s) => ({ ...s, average: '' })),
      productionGrid: [{ id: 'bottom-row-1', color: '', pcs: '', mtr: '', sizes: {} }],
      swatchColorOverrides: {},
      noteText: '',
      signatureName: '',
    },
    DUPATTA: {
      enabled: false,
      styleName: '',
      fabricName: '',
      fabricWidth: '',
      subStyles: DEFAULT_DUPATTA_SUB_STYLES.map((s) => ({ ...s, average: '' })),
      productionGrid: [{ id: 'dupatta-row-1', color: '', pcs: '', mtr: '', sizes: {} }],
      swatchColorOverrides: {},
      noteText: '',
      signatureName: '',
    },
  });

  // Forwarding Selection State: select which sheets to forward to the next department
  const [forwardedComponents, setForwardedComponents] = useState<GarmentCategory[]>(['TOP']);
  const [selectedCategory, setSelectedCategory] = useState<GarmentCategory>('TOP');

  // Wilcom Form Stage Management State
  const [wilcomEntries, setWilcomEntries] = useState<WilcomEntry[]>([]);
  const [wilcomCategory, setWilcomCategory] = useState<GarmentCategory>('TOP');
  const [wilcomStyleName, setWilcomStyleName] = useState('');
  const [wilcomDesignNumber, setWilcomDesignNumber] = useState('');
  const [wilcomPhotoUrl, setWilcomPhotoUrl] = useState('');
  const [wilcomRemarks, setWilcomRemarks] = useState('');
  const [editingWilcomId, setEditingWilcomId] = useState<string | null>(null);
  const [showWilcomModal, setShowWilcomModal] = useState(false);

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
  const handleGridRowChange = (cat: GarmentCategory, index: number, field: 'color' | 'pcs' | 'mtr', value: any) => {
    const totalAvg = getTotalMtrAverage(cat);
    const updatedGrid = [...components[cat].productionGrid];
    const target = { ...updatedGrid[index] };

    if (field === 'pcs') {
      const numPcs = Number(value);
      target.pcs = value;
      target.mtr = value !== '' && Number.isFinite(numPcs) && numPcs > 0 ? Math.round(numPcs * totalAvg * 100) / 100 : '';
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

  // Wilcom Photo Upload Handler
  const handleWilcomPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Photo must be less than 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setWilcomPhotoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveWilcomEntry = () => {
    if (!wilcomDesignNumber.trim()) {
      alert('Please enter a Wilcom Design Number.');
      return;
    }

    if (editingWilcomId) {
      setWilcomEntries((prev) =>
        prev.map((entry) =>
          entry.id === editingWilcomId
            ? {
                ...entry,
                category: wilcomCategory,
                styleName: wilcomStyleName.trim(),
                wilcomDesignNumber: wilcomDesignNumber.trim(),
                photoUrl: wilcomPhotoUrl,
                remarks: wilcomRemarks.trim(),
              }
            : entry
        )
      );
      setEditingWilcomId(null);
    } else {
      const newEntry: WilcomEntry = {
        id: `wilcom-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        category: wilcomCategory,
        styleName: wilcomStyleName.trim() || `${wilcomCategory} Embroidery Design`,
        wilcomDesignNumber: wilcomDesignNumber.trim(),
        photoUrl: wilcomPhotoUrl,
        remarks: wilcomRemarks.trim(),
        createdAt: new Date().toISOString(),
      };
      setWilcomEntries((prev) => [...prev, newEntry]);
    }

    setWilcomStyleName('');
    setWilcomDesignNumber('');
    setWilcomPhotoUrl('');
    setWilcomRemarks('');
  };

  const handleEditWilcomEntry = (entry: WilcomEntry) => {
    setEditingWilcomId(entry.id);
    setWilcomCategory(entry.category);
    setWilcomStyleName(entry.styleName || '');
    setWilcomDesignNumber(entry.wilcomDesignNumber || '');
    setWilcomPhotoUrl(entry.photoUrl || '');
    setWilcomRemarks(entry.remarks || '');
  };

  const handleDeleteWilcomEntry = (id: string) => {
    if (confirm('Are you sure you want to remove this Wilcom design entry?')) {
      setWilcomEntries((prev) => prev.filter((e) => e.id !== id));
      if (editingWilcomId === id) {
        setEditingWilcomId(null);
        setWilcomStyleName('');
        setWilcomDesignNumber('');
        setWilcomPhotoUrl('');
        setWilcomRemarks('');
      }
    }
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
          fabricName: components.TOP.fabricName.trim() || fabricName.trim(),
          fabricWidth: components.TOP.fabricWidth.trim() || fabricWidth.trim(),
          subStyles: components.TOP.subStyles,
          productionGrid: components.TOP.productionGrid,
          swatches: getDisplaySwatches('TOP'),
          note: components.TOP.noteText.trim(),
          totalMtrAverage: getTotalMtrAverage('TOP'),
          totalPieces: getTotalPieces('TOP'),
          totalFabricMeters: getTotalFabricMeters('TOP'),
        },
        BOTTOM: {
          enabled: components.BOTTOM.enabled,
          forwarded: forwardedComponents.includes('BOTTOM'),
          category: 'BOTTOM',
          styleName: components.BOTTOM.styleName.trim(),
          fabricName: components.BOTTOM.fabricName.trim() || fabricName.trim(),
          fabricWidth: components.BOTTOM.fabricWidth.trim() || fabricWidth.trim(),
          subStyles: components.BOTTOM.subStyles,
          productionGrid: components.BOTTOM.productionGrid,
          swatches: getDisplaySwatches('BOTTOM'),
          note: components.BOTTOM.noteText.trim(),
          totalMtrAverage: getTotalMtrAverage('BOTTOM'),
          totalPieces: getTotalPieces('BOTTOM'),
          totalFabricMeters: getTotalFabricMeters('BOTTOM'),
        },
        DUPATTA: {
          enabled: components.DUPATTA.enabled,
          forwarded: forwardedComponents.includes('DUPATTA'),
          category: 'DUPATTA',
          styleName: components.DUPATTA.styleName.trim(),
          fabricName: components.DUPATTA.fabricName.trim() || fabricName.trim(),
          fabricWidth: components.DUPATTA.fabricWidth.trim() || fabricWidth.trim(),
          subStyles: components.DUPATTA.subStyles,
          productionGrid: components.DUPATTA.productionGrid,
          swatches: getDisplaySwatches('DUPATTA'),
          note: components.DUPATTA.noteText.trim(),
          totalMtrAverage: getTotalMtrAverage('DUPATTA'),
          totalPieces: getTotalPieces('DUPATTA'),
          totalFabricMeters: getTotalFabricMeters('DUPATTA'),
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
        comments: primary.noteText.trim(),
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

                    {/* TOP META ROW: DESIGN NO., [CAT]:-, DATE, SERIAL NO. */}
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                      {/* Left: DESIGN NO. & [COMPONENT]:- */}
                      <div className="w-full sm:w-1/2 space-y-3">
                        <div className="flex items-center gap-2">
                          <label className="font-black text-xs tracking-wider uppercase whitespace-nowrap min-w-[90px]">
                            DESIGN NO.
                          </label>
                          <input
                            type="text"
                            value={designNumber}
                            onChange={(e) => setDesignNumber(e.target.value)}
                            onFocus={(e) => e.target.select()}
                            placeholder=""
                            className="border-[1.5px] border-black px-3 py-1 h-8 w-44 font-bold text-xs bg-white text-black focus:outline-none focus:ring-1 focus:ring-blue-600"
                          />
                        </div>

                        {/* WILCOM OPTION BELOW DESIGN NO. */}
                        <div className="flex items-center gap-2">
                          <label className="font-black text-xs tracking-wider uppercase whitespace-nowrap min-w-[90px] text-purple-950">
                            WILCOM
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setWilcomCategory(cat);
                              if (!wilcomStyleName && comp.styleName) {
                                setWilcomStyleName(comp.styleName);
                              }
                              setShowWilcomModal(true);
                            }}
                            className="border-[1.5px] border-purple-800 bg-purple-50 hover:bg-purple-100 text-purple-950 px-3 py-1 h-8 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-purple-700" />
                            <span>WILCOM ({cat})</span>
                            {wilcomEntries.filter((e) => e.category === cat).length > 0 ? (
                              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-purple-800 text-white">
                                {wilcomEntries.filter((e) => e.category === cat).length}
                              </span>
                            ) : (
                              <span className="text-[10px] text-purple-700 font-semibold normal-case">
                                + Open Sheet
                              </span>
                            )}
                          </button>
                          {wilcomEntries.filter((e) => e.category === cat).length > 0 && (
                            <span
                              className="text-[11px] font-mono text-purple-900 font-black truncate max-w-[200px]"
                              title={wilcomEntries.filter((e) => e.category === cat).map((e) => e.wilcomDesignNumber).join(', ')}
                            >
                              № {wilcomEntries.filter((e) => e.category === cat).map((e) => e.wilcomDesignNumber).join(', ')}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="relative">
                              <select
                                value={cat}
                                onChange={(e) => handleCategoryDropdownChange(e.target.value as GarmentCategory)}
                                aria-label="Component Category"
                                className="appearance-none font-black text-xs tracking-wider uppercase bg-white text-black border-[1.5px] border-black pl-2.5 pr-7 py-1 h-8 focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer shadow-2xs"
                              >
                                <option value="TOP">TOP</option>
                                <option value="BOTTOM">BOTTOM</option>
                                <option value="DUPATTA">DUPATTA</option>
                              </select>
                              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-black">
                                <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
                              </div>
                            </div>
                            <span className="font-black text-xs tracking-wider select-none">:-</span>
                          </div>
                          <input
                            type="text"
                            value={comp.styleName}
                            onChange={(e) => {
                              const val = e.target.value;
                              setComponents((prev) => ({
                                ...prev,
                                [cat]: { ...prev[cat], styleName: val },
                              }));
                            }}
                            onFocus={(e) => e.target.select()}
                            placeholder=""
                            className="border-b-[1.5px] border-black border-t-0 border-l-0 border-r-0 px-2 py-1 h-8 flex-1 font-bold text-xs bg-transparent text-black focus:outline-none focus:border-blue-600 rounded-none"
                          />
                        </div>
                      </div>

                      {/* Right: DATE & SERIAL NO */}
                      <div className="w-full sm:w-1/2 space-y-3 flex flex-col items-start sm:items-end">
                        <div className="flex items-center gap-2">
                          <label className="font-black text-xs tracking-wider uppercase whitespace-nowrap min-w-[75px] text-left sm:text-right">
                            DATE:
                          </label>
                          <input
                            type="date"
                            value={sheetDate}
                            onChange={(e) => setSheetDate(e.target.value)}
                            className="border-[1.5px] border-black px-3 py-1 h-8 w-44 font-bold text-xs bg-white text-black focus:outline-none focus:ring-1 focus:ring-blue-600"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="font-black text-xs tracking-wider uppercase whitespace-nowrap min-w-[75px] text-left sm:text-right">
                            SERIAL NO.
                          </label>
                          <input
                            type="text"
                            value={programSerialNo ? `${programSerialNo}${cat === 'TOP' ? '' : `-${cat}`}` : ''}
                            onChange={(e) => setProgramSerialNo(e.target.value.replace(new RegExp(`-${cat}$`, 'i'), ''))}
                            onFocus={(e) => e.target.select()}
                            placeholder=""
                            className="border-[1.5px] border-black px-3 py-1 h-8 w-36 font-black text-center text-xs bg-white text-black focus:outline-none focus:ring-1 focus:ring-blue-600 font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    {/* FACTORY ROUTING & INVENTORY CLEARANCE */}
                    <div className="pt-2">
                      <div className="border-[1.5px] border-black p-4 bg-slate-50/50 space-y-3">
                        <div className="flex items-center justify-between border-b border-black/15 pb-2">
                          <h3 className="font-black text-xs uppercase tracking-wider text-black flex items-center gap-1.5 select-none">
                            <Layers className="w-3.5 h-3.5 text-blue-800" />
                            <span>FACTORY ROUTING &amp; INVENTORY CLEARANCE</span>
                          </h3>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            Order Routing &middot; {cat} Sheet
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
                          {/* Client / Buyer Name - Only visible to Admin and Programming */}
                          {canViewClientName(currentUser) && (
                            <div>
                              <label className="block text-[10px] font-black uppercase tracking-wider text-black mb-1">
                                CLIENT / BUYER NAME
                              </label>
                              <input
                                type="text"
                                value={clientName}
                                onChange={(e) => setClientName(e.target.value)}
                                onFocus={(e) => e.target.select()}
                                placeholder="e.g. Standard Client"
                                className="w-full px-2.5 py-1.5 border-[1.5px] border-black text-xs font-bold text-black bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-2xs"
                              />
                            </div>
                          )}

                          {/* Delivery Target Date */}
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-wider text-black mb-1">
                              DELIVERY TARGET DATE
                            </label>
                            <input
                              type="date"
                              value={deliveryDate}
                              onChange={(e) => setDeliveryDate(e.target.value)}
                              className="w-full px-2.5 py-1.5 border-[1.5px] border-black text-xs font-bold text-black bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-2xs"
                            />
                          </div>

                          {/* Order Priority */}
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-wider text-black mb-1">
                              ORDER PRIORITY
                            </label>
                            <select
                              value={clientPriority}
                              onChange={(e) => setClientPriority(e.target.value)}
                              className="w-full px-2.5 py-1.5 border-[1.5px] border-black text-xs font-bold text-black bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer shadow-2xs"
                            >
                              <option value="LOW">LOW</option>
                              <option value="NORMAL">NORMAL</option>
                              <option value="HIGH">HIGH (Expedited)</option>
                              <option value="URGENT">URGENT (Top Floor)</option>
                            </select>
                          </div>

                          {/* Dyeing Required */}
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-wider text-black mb-1">
                              IS DYEING REQUIRED? *
                            </label>
                            <select
                              value={fabricDyeingRequired ? 'YES' : 'NO'}
                              onChange={(e) => setFabricDyeingRequired(e.target.value === 'YES')}
                              className="w-full px-2.5 py-1.5 border-[1.5px] border-black text-xs font-bold text-black bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer shadow-2xs"
                            >
                              <option value="NO">NO (Pre-Dyed)</option>
                              <option value="YES">YES (Kora)</option>
                            </select>
                          </div>

                          {/* Fabric Color Availability */}
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-wider text-black mb-1">
                              FABRIC COLOR AVAILABILITY
                            </label>
                            <select
                              value={fabricColorAvailable}
                              onChange={(e) => setFabricColorAvailable(e.target.value)}
                              className="w-full px-2.5 py-1.5 border-[1.5px] border-black text-xs font-bold text-black bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer shadow-2xs"
                            >
                              <option value="IN_STOCK">IN STOCK</option>
                              <option value="PROCUREMENT_PENDING">PROCUREMENT PENDING</option>
                              <option value="DYEING_REQUIRED">DYEING REQUIRED</option>
                            </select>
                          </div>
                        </div>

                        {/* Store Stock Availability Clearance Bar */}
                        <div className="flex items-center justify-between p-2.5 border-[1.5px] border-black bg-white text-xs">
                          <span className="font-black text-black uppercase tracking-wider text-[11px]">
                            Fabric Store Stock Clearance:
                          </span>
                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-400 uppercase tracking-wider">
                            Movement Allowed
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* FABRIC & WIDTH TABLE */}
                    <div className="pt-1">
                      <table className="w-full border-collapse border-[1.5px] border-black text-xs">
                        <tbody>
                          <tr>
                            <td className="border-[1.5px] border-black px-3 py-1.5 font-black uppercase w-28 bg-white select-none">
                              FABRIC
                            </td>
                            <td className="border-[1.5px] border-black p-1">
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
                                placeholder=""
                                className="w-full px-2 py-1 font-bold text-xs text-black border-none focus:outline-none focus:bg-blue-50/50"
                              />
                            </td>
                          </tr>
                          <tr>
                            <td className="border-[1.5px] border-black px-3 py-1.5 font-black uppercase w-28 bg-white select-none">
                              WIDTH
                            </td>
                            <td className="border-[1.5px] border-black p-1">
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
                                placeholder=""
                                className="w-full px-2 py-1 font-bold text-xs text-black border-none focus:outline-none focus:bg-blue-50/50"
                              />
                            </td>
                          </tr>
                        </tbody>
                      </table>
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
                            <span>Add Color Row</span>
                          </button>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse border-[1.5px] border-black text-center text-xs">
                          <thead>
                            <tr className="bg-white">
                              <th rowSpan={2} className="border-[1.5px] border-black p-1 font-black text-xs tracking-wider uppercase w-32">
                                COLOR
                              </th>
                              <th colSpan={2} className="border-[1.5px] border-black p-1 font-black text-xs tracking-wider uppercase">
                                QTY
                              </th>
                              <th colSpan={comp.subStyles.length} className="border-[1.5px] border-black p-1 font-black text-xs tracking-wider uppercase">
                                SIZE
                              </th>
                              <th rowSpan={2} className="border-[1.5px] border-black p-1 font-bold text-[10px] w-8">
                                &nbsp;
                              </th>
                            </tr>
                            <tr className="bg-white">
                              <th className="border-[1.5px] border-black p-1 font-black text-[11px] w-16">PCS</th>
                              <th className="border-[1.5px] border-black p-1 font-black text-[11px] w-16">MTR</th>
                              {comp.subStyles.map((sub, sIdx) => (
                                <th key={sIdx} className="border-[1.5px] border-black p-1 font-black text-[11px] uppercase">
                                  {sub.name}
                                </th>
                              ))}
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

                                {/* SIZE CELLS */}
                                {comp.subStyles.map((sub, sIdx) => (
                                  <td key={sIdx} className="border-[1.5px] border-black p-0.5">
                                    <input
                                      type="text"
                                      value={row.sizes?.[sub.name] || ''}
                                      onChange={(e) => handleGridSizeChange(cat, rIdx, sub.name, e.target.value)}
                                      onFocus={(e) => e.target.select()}
                                      placeholder=""
                                      className="w-full px-1 py-1 text-center font-medium text-xs text-black border-none focus:outline-none focus:bg-blue-50"
                                    />
                                  </td>
                                ))}

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
                              <td className="border-[1.5px] border-black p-1.5 text-center font-black text-sm text-[#163767]">
                                {catPieces > 0 ? catPieces : ''}
                              </td>
                              <td className="border-[1.5px] border-black p-1.5 text-center font-black text-sm text-emerald-800">
                                {catMeters > 0 ? catMeters.toFixed(2) : ''}
                              </td>
                              <td colSpan={comp.subStyles.length + 1} className="border-[1.5px] border-black p-1.5 text-right text-[10px] text-slate-500 italic">
                                {catAvg > 0 ? `Fabric consumption @ ${catAvg.toFixed(2)} Mtr/Pc` : ''}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* QUICK COLOR CHIPS */}
                      <div className="pt-2 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-black uppercase text-slate-500 mr-1 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-600" />
                          <span>Quick Add Color:</span>
                        </span>
                        {['Camel', 'Dusty Sage', 'Olive Green', 'Dark Navy', 'Maroon', 'Bottle Green', 'White', 'Black'].map((clr) => (
                          <button
                            key={clr}
                            type="button"
                            onClick={() => handleAddGridRow(cat, clr)}
                            className="text-[10px] font-bold px-2 py-0.5 rounded border border-slate-300 bg-white hover:border-blue-500 hover:text-blue-900 transition cursor-pointer"
                          >
                            + {clr}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* FOOTER: NOTE, SWATCHES, SIGNATURE */}
                    <div className="flex flex-col sm:flex-row justify-between items-end gap-6 pt-3 border-t border-black/10">
                      {/* Left: NOTE & SWATCH SAMPLES */}
                      <div className="w-full sm:w-3/5 space-y-3">
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
                            className="w-full px-2.5 py-1.5 border-[1.5px] border-black text-xs font-sans text-black focus:outline-none focus:ring-1 focus:ring-blue-600 resize-none"
                          />
                        </div>

                        {/* SWATCH SAMPLES */}
                        <div className="pt-2">
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
                      </div>

                      {/* Right: SIGNATURE */}
                      <div className="w-full sm:w-1/3 text-center space-y-3">
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
                          className="w-full text-center font-bold text-xs border-none focus:outline-none focus:bg-blue-50/50 py-1"
                        />
                        <div className="border-b-[1.5px] border-black w-full mx-auto" />
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
      {showWilcomModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowWilcomModal(false);
          }}
        >
          <div className="bg-white border-2 border-purple-300 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* MODAL HEADER */}
            <div className="px-6 py-4 bg-purple-50/90 border-b border-purple-200 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-700 text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-700">
                      STAGE 2 &middot; WILCOM FORM MANAGEMENT
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-200 text-purple-900 uppercase">
                      {wilcomCategory} SHEET
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 uppercase">
                    Wilcom Embroidery Design Specifications
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-purple-200 text-xs font-bold text-slate-600">
                  <span>Total Entries:</span>
                  <span className="font-black text-purple-700 font-mono">{wilcomEntries.length}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWilcomModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* MODAL BODY (SCROLLABLE) */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* WILCOM ENTRY CREATION / EDITING FORM */}
              <div className="p-4 sm:p-5 bg-purple-50/40 border border-purple-200 rounded-xl space-y-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wide text-purple-950 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span>{editingWilcomId ? 'Edit Wilcom Design Entry' : '+ Add Wilcom Design Entry'}</span>
                  </h3>
                  {editingWilcomId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingWilcomId(null);
                        setWilcomStyleName('');
                        setWilcomDesignNumber('');
                        setWilcomPhotoUrl('');
                        setWilcomRemarks('');
                      }}
                      className="text-xs text-rose-600 font-bold hover:underline cursor-pointer"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  {/* Garment Category */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                      Garment Category *
                    </label>
                    <select
                      value={wilcomCategory}
                      onChange={(e) => setWilcomCategory(e.target.value as GarmentCategory)}
                      className="w-full px-3 py-1.5 border border-purple-300 rounded font-bold text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-700"
                    >
                      <option value="TOP">TOP</option>
                      <option value="BOTTOM">BOTTOM</option>
                      <option value="DUPATTA">DUPATTA</option>
                    </select>
                  </div>

                  {/* Style Name or Style Details */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                      Style Name or Details *
                    </label>
                    <input
                      type="text"
                      value={wilcomStyleName}
                      onChange={(e) => setWilcomStyleName(e.target.value)}
                      placeholder=""
                      className="w-full px-3 py-1.5 border border-purple-300 rounded text-xs font-bold text-slate-900 bg-white focus:outline-none focus:ring-1 focus:ring-purple-700"
                    />
                  </div>

                  {/* Wilcom Design Number */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                      Wilcom Design Number *
                    </label>
                    <input
                      type="text"
                      value={wilcomDesignNumber}
                      onChange={(e) => setWilcomDesignNumber(e.target.value)}
                      placeholder=""
                      className="w-full px-3 py-1.5 border border-purple-300 rounded text-xs font-mono font-bold text-slate-900 bg-white focus:outline-none focus:ring-1 focus:ring-purple-700 uppercase"
                    />
                  </div>
                </div>

                {/* Photo Upload & Preview + Remarks */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs items-start">
                  {/* Photo Upload */}
                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold uppercase text-slate-700">
                      Design Photo / Reference Upload
                    </label>
                    <div className="flex items-center gap-3">
                      <label className="px-3.5 py-2 bg-white border border-purple-300 hover:border-purple-600 rounded text-xs font-bold text-purple-900 flex items-center gap-2 cursor-pointer shadow-2xs transition">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Choose Image File</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleWilcomPhotoChange}
                          className="sr-only"
                        />
                      </label>

                      {wilcomPhotoUrl && (
                        <button
                          type="button"
                          onClick={() => setWilcomPhotoUrl('')}
                          className="text-xs text-rose-600 font-bold hover:underline cursor-pointer"
                        >
                          Remove Photo
                        </button>
                      )}
                    </div>

                    {/* Thumbnail Preview */}
                    {wilcomPhotoUrl && (
                      <div className="w-24 h-24 border border-purple-300 rounded-md overflow-hidden bg-white relative shadow-2xs mt-2">
                        <img
                          src={wilcomPhotoUrl}
                          alt="Wilcom preview"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}
                  </div>

                  {/* Remarks */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                      Embroidery Remarks / Notes
                    </label>
                    <textarea
                      rows={3}
                      value={wilcomRemarks}
                      onChange={(e) => setWilcomRemarks(e.target.value)}
                      placeholder=""
                      className="w-full px-3 py-2 border border-purple-300 rounded text-xs font-sans text-slate-900 bg-white focus:outline-none focus:ring-1 focus:ring-purple-700 resize-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleSaveWilcomEntry}
                    className="px-4 py-2 bg-purple-800 hover:bg-purple-900 text-white rounded text-xs font-bold shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{editingWilcomId ? 'Update Wilcom Entry' : '+ Add Wilcom Design'}</span>
                  </button>
                </div>
              </div>

              {/* LIST OF CREATED WILCOM ENTRIES */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Attached Wilcom Design Entries ({wilcomEntries.length})
                  </h3>
                  {wilcomEntries.length > 0 && (
                    <span className="text-[11px] font-medium text-slate-500">
                      Categorized per production component
                    </span>
                  )}
                </div>

                {wilcomEntries.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {wilcomEntries.map((entry, idx) => (
                      <div
                        key={entry.id || idx}
                        className={`p-4 bg-white border rounded-xl shadow-2xs hover:shadow-xs transition space-y-3 ${
                          entry.category === wilcomCategory ? 'border-purple-300 ring-1 ring-purple-200' : 'border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded text-white ${
                                entry.category === 'TOP'
                                  ? 'bg-blue-600'
                                  : entry.category === 'BOTTOM'
                                    ? 'bg-emerald-600'
                                    : 'bg-purple-600'
                              }`}
                            >
                              {entry.category}
                            </span>
                            <span className="text-xs font-bold text-slate-900">
                              {entry.styleName || 'Garment Style'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditWilcomEntry(entry)}
                              className="p-1 text-slate-400 hover:text-blue-700 rounded transition cursor-pointer"
                              title="Edit Entry"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteWilcomEntry(entry.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                              title="Delete Entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          {/* Photo Thumbnail */}
                          <div className="w-20 h-20 shrink-0 border border-slate-200 rounded-md bg-slate-50 flex items-center justify-center overflow-hidden">
                            {entry.photoUrl ? (
                              <img
                                src={entry.photoUrl}
                                alt={entry.wilcomDesignNumber}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <ImageIcon className="w-6 h-6 text-slate-300" />
                            )}
                          </div>

                          {/* Details */}
                          <div className="space-y-1 text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400 text-[11px] font-bold">WILCOM NO:</span>
                              <span className="font-mono font-black text-slate-900 text-sm">
                                {entry.wilcomDesignNumber}
                              </span>
                            </div>
                            {entry.remarks && (
                              <div className="text-slate-600 text-[11px] line-clamp-2">
                                {entry.remarks}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 text-slate-500 text-xs">
                    <span>No Wilcom designs added yet</span>
                  </div>
                )}
              </div>
            </div>

            {/* MODAL FOOTER */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500 font-bold">
                {wilcomEntries.length} {wilcomEntries.length === 1 ? 'entry' : 'entries'} currently attached
              </span>
              <button
                type="button"
                onClick={() => setShowWilcomModal(false)}
                className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
              >
                Done / Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT & DOWNLOAD MODAL */}
      <ProductionSheetPrintModal
        program={success}
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
      />
    </div>
  );
}
