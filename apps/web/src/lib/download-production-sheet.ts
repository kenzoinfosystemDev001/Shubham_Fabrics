/**
 * Production Sheet Generator & Downloader
 * Shubham Fabrics India Pvt. Ltd. MES - Programming Department
 *
 * Implements the authentic factory floor traveler specification sheet
 * layout (Production Sheet format) with sub-style averages and multi-color breakdown grid.
 */
import { getCurrentUser, canViewClientCode } from '@/lib/rbac';
import { loadProgramDocument } from '@/lib/program-document';

export interface SubStyleAverage {
  name: string;
  average: number | string;
}

export interface ProductionGridItem {
  id?: string;
  color: string;
  pcs: number | string;
  mtr: number | string;
  subStyle?: string;
  subStyles?: string[];
  size?: string;
  sizes?: Record<string, string>;
}

export function calculateSizeExpressionTotal(expression?: unknown): number | null {
  const value = String(expression || '').trim();
  if (!value || !/^(?:\d+(?:\.\d*)?|\.\d+)(?:\s*\+\s*(?:\d+(?:\.\d*)?|\.\d+))*$/.test(value)) {
    return null;
  }

  const total = value.split('+').reduce((sum, part) => sum + Number(part.trim()), 0);
  return Number.isFinite(total) ? total : null;
}

export function formatSizeExpressionTotal(total: number): string {
  return Number(total.toFixed(2)).toString();
}

export function calculateProductionMeasurementTotal(items: ProductionGridItem[]): number | null {
  let total = 0;
  let hasMeasurement = false;

  for (const row of items) {
    const subStyles = Array.isArray(row.subStyles) && row.subStyles.length > 0
      ? row.subStyles
      : row.subStyle
        ? String(row.subStyle).split(',').map((style) => style.trim()).filter(Boolean)
        : [];
    const expressions = subStyles.length > 0
      ? subStyles.map((style) => row.sizes?.[style] || '').filter((value) => String(value).trim())
      : [];
    if (expressions.length === 0 && String(row.size || row.sizes?.SIZE || '').trim()) {
      expressions.push(row.size || row.sizes?.SIZE || '');
    }

    if (expressions.length === 0) continue;

    let rowTotal = 0;
    for (const expression of expressions) {
      const expressionTotal = calculateSizeExpressionTotal(expression);
      if (expressionTotal === null) return null;
      rowTotal += expressionTotal;
    }

    total += rowTotal;
    hasMeasurement = true;
  }

  return hasMeasurement ? Math.round(total * 100) / 100 : null;
}

export interface SwatchItem {
  id?: string;
  name: string;
  color: string;
  isCustom?: boolean;
}

export const SWATCH_CLIP_PATH = 'polygon(0% 4%, 4% 0%, 8% 4%, 12% 0%, 16% 4%, 20% 0%, 24% 4%, 28% 0%, 32% 4%, 36% 0%, 40% 4%, 44% 0%, 48% 4%, 52% 0%, 56% 4%, 60% 0%, 64% 4%, 68% 0%, 72% 4%, 76% 0%, 80% 4%, 84% 0%, 88% 4%, 92% 0%, 96% 4%, 100% 0%, 96% 4%, 100% 8%, 96% 12%, 100% 16%, 96% 20%, 100% 24%, 96% 28%, 100% 32%, 96% 36%, 100% 40%, 96% 44%, 100% 48%, 96% 52%, 100% 56%, 96% 60%, 100% 64%, 96% 68%, 100% 72%, 96% 76%, 100% 80%, 96% 84%, 100% 88%, 96% 92%, 100% 96%, 96% 100%, 100% 96%, 96% 100%, 92% 96%, 88% 100%, 84% 96%, 80% 100%, 76% 96%, 72% 100%, 68% 96%, 64% 100%, 60% 96%, 56% 100%, 52% 96%, 48% 100%, 44% 96%, 40% 100%, 36% 96%, 32% 100%, 28% 96%, 24% 100%, 20% 96%, 16% 100%, 12% 96%, 8% 100%, 4% 96%, 0% 100%, 4% 96%, 0% 92%, 4% 88%, 0% 84%, 4% 80%, 0% 76%, 4% 72%, 0% 68%, 4% 64%, 0% 60%, 4% 56%, 0% 52%, 4% 48%, 0% 44%, 4% 40%, 0% 36%, 4% 32%, 0% 28%, 4% 24%, 0% 20%, 4% 16%, 0% 12%, 4% 8%, 0% 4%)';

export const FABRIC_COLOR_PALETTE: Record<string, string> = {
  camel: '#D4BAA1',
  khaki: '#C3B091',
  beige: '#D9C5B2',
  cream: '#FFFDD0',
  ivory: '#FFFFF0',
  white: '#F8FAFC',
  offwhite: '#FAF9F6',
  'off-white': '#FAF9F6',
  black: '#18181B',
  grey: '#6B7280',
  gray: '#6B7280',
  charcoal: '#374151',
  brown: '#5C4033',
  chocolate: '#3D2314',
  tan: '#D2B48C',
  fawn: '#C8A97E',
  navy: '#1E2530',
  'dark navy': '#161E2E',
  'navy blue': '#1E3A8A',
  blue: '#2563EB',
  'royal blue': '#1D4ED8',
  'sky blue': '#7DD3FC',
  cyan: '#06B6D4',
  teal: '#0D9488',
  turquoise: '#14B8A6',
  indigo: '#4338CA',
  sage: '#9BB19D',
  'dusty sage': '#9BB19D',
  'sage green': '#94A684',
  olive: '#888448',
  'olive mustard': '#857F43',
  'olive green': '#556B2F',
  green: '#15803D',
  'bottle green': '#0F4D2A',
  'dark green': '#0B3D20',
  mint: '#A7F3D0',
  emerald: '#059669',
  pista: '#A2C579',
  mehndi: '#606C38',
  red: '#DC2626',
  maroon: '#6B1124',
  wine: '#5B172B',
  burgundy: '#5B172B',
  pink: '#F472B6',
  'baby pink': '#FBCFE8',
  'dusty rose': '#C98B96',
  peach: '#FDBA74',
  coral: '#FB7185',
  magenta: '#BE185D',
  purple: '#7E22CE',
  violet: '#6D28D9',
  lavender: '#C084FC',
  plum: '#4A154B',
  yellow: '#EAB308',
  mustard: '#CA8A04',
  gold: '#D97706',
  orange: '#EA580C',
  rust: '#B45309',
  copper: '#B87333',
  lemon: '#FEF08A',
};

export function getSwatchColorHex(name?: string, fallback?: string): string {
  if (!name || !name.trim()) return fallback || '#CBD5E1';
  const clean = name.trim().toLowerCase();
  if (FABRIC_COLOR_PALETTE[clean]) return FABRIC_COLOR_PALETTE[clean];

  for (const [key, hex] of Object.entries(FABRIC_COLOR_PALETTE)) {
    if (clean.includes(key) || key.includes(clean)) {
      return hex;
    }
  }

  if (fallback) return fallback;

  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 40%, 55%)`;
}

export type GarmentCategory = 'TOP' | 'BOTTOM' | 'DUPATTA' | 'OTHER' | (string & {});

function escapeHtmlText(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&#39;';
    }
  });
}

export interface ComponentSheetData {
  enabled: boolean;
  forwarded: boolean;
  category: GarmentCategory;
  styleName: string;
  pattern?: string;
  fabricName: string;
  fabricWidth: string;
  subStyles: SubStyleAverage[];
  productionGrid: ProductionGridItem[];
  swatches?: SwatchItem[];
  note?: string;
  remarks?: string;
  totalMtrAverage?: number;
  totalPieces?: number;
  totalFabricMeters?: number;
}

export const DEFAULT_SUB_STYLES: SubStyleAverage[] = [
  { name: 'FRONT', average: '' },
  { name: 'BACK', average: '' },
  { name: 'SLEAVE', average: '' },
  { name: 'COLLAR', average: '' },
  { name: 'GHERA', average: '' },
  { name: 'PATTI', average: '' },
];

export const DEFAULT_BOTTOM_SUB_STYLES: SubStyleAverage[] = [
  { name: 'FRONT', average: '' },
  { name: 'BACK', average: '' },
  { name: 'BELT', average: '' },
  { name: 'POCKET', average: '' },
  { name: 'BOTTOM', average: '' },
  { name: 'PATTI', average: '' },
];

export const DEFAULT_DUPATTA_SUB_STYLES: SubStyleAverage[] = [
  { name: 'BODY', average: '' },
  { name: 'PALLU', average: '' },
  { name: 'BORDER', average: '' },
  { name: 'CORNER', average: '' },
  { name: 'LACE', average: '' },
  { name: 'TASSEL', average: '' },
];

export function getDefaultSubStylesForCategory(category: GarmentCategory): SubStyleAverage[] {
  if (category === 'BOTTOM') return DEFAULT_BOTTOM_SUB_STYLES.map(s => ({ ...s }));
  if (category === 'DUPATTA') return DEFAULT_DUPATTA_SUB_STYLES.map(s => ({ ...s }));
  return DEFAULT_SUB_STYLES.map(s => ({ ...s }));
}

export function extractSubStylesAndGrid(program: any, category: GarmentCategory = 'TOP'): {
  subStylesWithAverages: SubStyleAverage[];
  productionGrid: ProductionGridItem[];
  swatches: SwatchItem[];
  topName: string;
  pattern: string;
  serialNoCounter: string;
  noteText: string;
  remarksText: string;
  totalMtrAverage: number;
  clientCode?: string;
  fabricName: string;
  fabricWidth: string;
  category: GarmentCategory;
  allComponents?: Record<GarmentCategory, ComponentSheetData>;
  forwardedComponents: string[];
  isEnabled: boolean;
  isForwarded: boolean;
} {
  let subStylesWithAverages: SubStyleAverage[] = [];
  let productionGrid: ProductionGridItem[] = [];
  let swatches: SwatchItem[] = [];
  let topName = program.topName || program.mainStyle || program.styleCode || '';
  let pattern = program.pattern || '';
  let serialNoCounter = program.serialNoCounter || '';
  let noteText = program.note || program.comments || '';
  let remarksText = program.remarks || '';
  let clientCode = program.clientCode || '';
  let fabricName = program.fabricName || program.fabric || (program.fabrics?.[0]?.fabricName) || '';
  let fabricWidth = program.fabricWidth || (program.fabricWidthInches ? `${program.fabricWidthInches}"` : '') || '';
  let allComponents: Record<string, ComponentSheetData> | undefined;
  let forwardedComponents: string[] = ['TOP'];
  let isEnabled = true;
  let isForwarded = true;

  if (program.metadataJson) {
    try {
      const meta = typeof program.metadataJson === 'string' ? JSON.parse(program.metadataJson) : program.metadataJson;
      if (meta?.components) {
        allComponents = meta.components;
      }
      if (Array.isArray(meta?.forwardedComponents)) {
        forwardedComponents = meta.forwardedComponents;
      }
      if (meta?.clientCode) clientCode = meta.clientCode;
      if (meta?.serialNoCounter) serialNoCounter = meta.serialNoCounter;

      const comp = meta?.components?.[category];
      if (comp) {
        isEnabled = comp.enabled !== false;
        isForwarded = comp.forwarded !== false || forwardedComponents.includes(category);
        if (comp.styleName) topName = comp.styleName;
        if (comp.pattern) pattern = comp.pattern;
        if (comp.fabricName) fabricName = comp.fabricName;
        if (comp.fabricWidth) fabricWidth = comp.fabricWidth;
        if (Array.isArray(comp.subStyles) && comp.subStyles.length > 0) {
          subStylesWithAverages = comp.subStyles;
        }
        if (Array.isArray(comp.productionGrid) && comp.productionGrid.length > 0) {
          productionGrid = comp.productionGrid;
        }
        if (Array.isArray(comp.swatches) && comp.swatches.length > 0) {
          swatches = comp.swatches;
        }
        if (comp.note) noteText = comp.note;
        if (comp.remarks) remarksText = comp.remarks;
      } else {
        // Fallback for single sheet legacy metadata
        if (Array.isArray(meta?.subStylesWithAverages) && meta.subStylesWithAverages.length > 0) {
          subStylesWithAverages = meta.subStylesWithAverages;
        }
        if (Array.isArray(meta?.productionGrid) && meta.productionGrid.length > 0) {
          productionGrid = meta.productionGrid;
        }
        if (Array.isArray(meta?.swatches) && meta.swatches.length > 0) {
          swatches = meta.swatches;
        }
        if (meta?.topName) topName = meta.topName;
        if (meta?.note) noteText = meta.note;
      }
    } catch {}
  }

  // Fallback for subStylesWithAverages if not found
  if (subStylesWithAverages.length === 0) {
    let rawSubStyles: string[] = Array.isArray(program.subStyles) ? program.subStyles : [];
    if (rawSubStyles.length === 0 && program.subStyle) {
      rawSubStyles = String(program.subStyle).split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (rawSubStyles.length > 0) {
      const defaultAvg = Number(program.fabricAverage) ? Number(program.fabricAverage) / rawSubStyles.length : 0.25;
      subStylesWithAverages = rawSubStyles.map((s) => ({
        name: s.toUpperCase(),
        average: Math.round(defaultAvg * 100) / 100,
      }));
    } else {
      subStylesWithAverages = getDefaultSubStylesForCategory(category);
    }
  }

  // Calculate sum of averages
  const totalMtrAverage = Math.round(
    subStylesWithAverages.reduce((acc, it) => acc + (Number(it.average) || 0), 0) * 100
  ) / 100;

  // Fallback for productionGrid from program.items or colours
  if (productionGrid.length === 0) {
    let programItems: any[] = Array.isArray(program.items) ? program.items : [];
    if (programItems.length === 0 && program.metadataJson) {
      try {
        const meta = typeof program.metadataJson === 'string' ? JSON.parse(program.metadataJson) : program.metadataJson;
        if (Array.isArray(meta?.items)) programItems = meta.items;
      } catch {}
    }

    if (programItems.length > 0) {
      productionGrid = programItems.map((it, idx) => {
        const pcs = Number(it.measurement) || 0;
        const mtr = it.mtr !== undefined && it.mtr !== '' ? it.mtr : '';
        const sizes: Record<string, string> = {};
        for (const sub of subStylesWithAverages) {
          sizes[sub.name] = it.fabricWidth || 'Free';
        }
        return {
          id: `row-${idx}`,
          color: String(it.color || `Color ${idx + 1}`),
          pcs: pcs || '',
          mtr: mtr || '',
          sizes,
        };
      });
    } else if (Array.isArray(program.colours) && program.colours.length > 0) {
      productionGrid = program.colours.map((c: any, idx: number) => {
        const pcs = Number(c.targetQuantity) || 0;
        const mtr = c.mtr !== undefined && c.mtr !== '' ? c.mtr : '';
        const sizes: Record<string, string> = {};
        return {
          id: `row-${idx}`,
          color: String(c.colorName || `Color ${idx + 1}`),
          pcs: pcs || '',
          mtr: mtr || '',
          sizes,
        };
      });
    }
  }

  // Derive swatches dynamically from productionGrid colors
  if (swatches.length === 0 && productionGrid.length > 0) {
    const uniqueColors = Array.from(
      new Set(
        productionGrid
          .map((r) => (r.color || '').trim())
          .filter(Boolean)
      )
    );
    swatches = uniqueColors.map((colorName) => ({
      name: colorName,
      color: getSwatchColorHex(colorName),
    }));
  }

  return {
    subStylesWithAverages,
    productionGrid,
    swatches,
    topName,
    pattern,
    serialNoCounter,
    noteText,
    remarksText,
    totalMtrAverage,
    clientCode,
    fabricName,
    fabricWidth,
    category,
    allComponents,
    forwardedComponents,
    isEnabled,
    isForwarded,
  };
}

export function generateProductionSheetHtml(program: any, category: GarmentCategory | 'ALL' = 'TOP'): string {
  const currentUser = typeof window !== 'undefined' ? getCurrentUser() : null;
  const canSeeClientCode = canViewClientCode(currentUser) && Boolean(program.clientCode);

  const serialNo = program.programSerialNo || program.programNumber || '';
  const designNo = program.designNumber || program.designName || '';
  const dateVal = program.startDate || program.programDate 
    ? new Date(program.startDate || program.programDate).toLocaleDateString('en-GB') 
    : new Date().toLocaleDateString('en-GB');

  let meta: any = null;
  if (program.metadataJson) {
    try {
      meta = typeof program.metadataJson === 'string' ? JSON.parse(program.metadataJson) : program.metadataJson;
    } catch {}
  }

  let targetCategories: GarmentCategory[] = [];
  if (category === 'ALL') {
    if (Array.isArray(meta?.forwardedComponents) && meta.forwardedComponents.length > 0) {
      targetCategories = meta.forwardedComponents;
    } else if (meta?.components) {
      targetCategories = Object.keys(meta.components).filter(
        (c) => meta.components[c]?.enabled !== false
      );
    }
    if (targetCategories.length === 0) {
      targetCategories = ['TOP'];
    }
  } else {
    targetCategories = [category];
  }

  const categoryName = category === 'TOP' || category === 'BOTTOM' || category === 'DUPATTA'
    ? category
    : extractSubStylesAndGrid(program, category).topName.trim() || 'INPUT';
  const categoryLabel = category === 'ALL' ? 'All Forwarded Components' : categoryName;
  const safeCategoryLabel = escapeHtmlText(categoryLabel);
  const safeFilenameCategory = categoryLabel.replace(/[^a-z0-9_-]+/gi, '_');

  const renderSingleSheet = (activeCategory: GarmentCategory) => {
    const {
      subStylesWithAverages,
      productionGrid,
      swatches,
      topName,
      pattern,
      noteText,
      remarksText,
      totalMtrAverage,
      fabricName,
      fabricWidth,
    } = extractSubStylesAndGrid(program, activeCategory);
    const totalMtr = productionGrid.reduce((sum, row) => sum + (Number(row.mtr) || 0), 0);
    const totalPcs = productionGrid.reduce((sum, row) => sum + (Number(row.pcs) || 0), 0);
    const totalMeasurement = calculateProductionMeasurementTotal(productionGrid);
    const activeCategoryName = activeCategory === 'TOP' || activeCategory === 'BOTTOM' || activeCategory === 'DUPATTA'
      ? activeCategory
      : topName.trim() || 'INPUT';
    const safeActiveCategoryName = escapeHtmlText(activeCategoryName);

    // Generate 14 rows total (matching the paper sheet grid)
    const TOTAL_GRID_ROWS = 14;
    const gridRows: {
      color: string;
      pcs: string | number;
      mtr: string | number;
      subStyle?: string;
      subStyles?: string[];
      size?: string;
      sizes: Record<string, string>;
    }[] = [];

    for (let i = 0; i < TOTAL_GRID_ROWS; i++) {
      if (i < productionGrid.length) {
        const item = productionGrid[i];
        let itemSubStyles = Array.isArray(item.subStyles) ? item.subStyles : [];
        if (itemSubStyles.length === 0 && item.subStyle) {
          itemSubStyles = String(item.subStyle).split(',').map((s) => s.trim()).filter(Boolean);
        }
        const itemSubStyleStr = itemSubStyles.length > 0 ? itemSubStyles.join(', ') : (item.subStyle || '');

        gridRows.push({
          color: item.color || '',
          pcs: item.pcs !== undefined ? item.pcs : '',
          mtr: item.mtr !== undefined ? item.mtr : '',
          subStyle: itemSubStyleStr,
          subStyles: itemSubStyles,
          size: item.size || item.sizes?.['SIZE'] || '',
          sizes: item.sizes || {},
        });
      } else {
        gridRows.push({
          color: '',
          pcs: '',
          mtr: '',
          subStyle: '',
          subStyles: [],
          size: '',
          sizes: {},
        });
      }
    }

    const deliveryDateVal = program.deliveryDate
      ? new Date(program.deliveryDate).toLocaleDateString('en-GB')
      : '';
    const priorityVal = program.clientPriority || program.priority || 'NORMAL';
    const dyeingVal = program.fabricDyeingRequired ? 'YES (Kora)' : 'NO (Pre-Dyed)';
    return `
    <div class="sheet-wrapper">
      <div>
        <!-- TITLE -->
        <div class="header-title">PRODUCTION SHEET &mdash; ${safeActiveCategoryName}</div>

        <!-- HEADER META: DESIGN NO, STYLE, PATTERN, DATE, SERIAL NO, DELIVERY DATE -->
        <div class="top-meta-row">
          <div class="meta-col-left">
            <div class="field-row">
              <span class="label-bold">DESIGN NUMBER:</span>
              <div class="box-input">${designNo}</div>
            </div>
            <div class="field-row" style="margin-top: 6px;">
              <span class="label-bold">STYLE:</span>
              <div class="box-input" style="width: 90px; text-transform: uppercase;">${safeActiveCategoryName}</div>
              <span class="label-bold" style="margin-left: 10px;">PATTERN:</span>
              <div class="box-input" style="flex: 1;">${pattern || '-'}</div>
            </div>
          </div>

          <div class="meta-col-right">
            <div class="field-row-right">
              <span class="label-bold">SERIAL NO.</span>
              <div class="box-serial">${serialNo}</div>
            </div>
            <div class="field-row-right" style="margin-top: 6px;">
              <span class="label-bold">DATE:</span>
              <div class="box-input">${dateVal}</div>
            </div>
            <div class="field-row-right" style="margin-top: 6px;">
              <span class="label-bold">DELIVERY DATE:</span>
              <div class="box-input">${deliveryDateVal || '-'}</div>
            </div>
          </div>
        </div>

        <!-- THREE UNIFORM SUMMARY BOXES: CLIENT NAME, PRIORITY, IS DYEING REQUIRED -->
        <div class="summary-boxes-row">
          <div class="summary-box">
            <div class="summary-box-label">CLIENT NAME</div>
            <div class="summary-box-value">${canSeeClientCode ? (program.clientName || 'Standard Client') : 'Confidential'}</div>
          </div>
          <div class="summary-box">
            <div class="summary-box-label">PRIORITY</div>
            <div class="summary-box-value">${priorityVal}</div>
          </div>
          <div class="summary-box">
            <div class="summary-box-label">IS DYEING REQUIRED?</div>
            <div class="summary-box-value">${dyeingVal}</div>
          </div>
        </div>

        <!-- FABRIC & WIDTH BOX -->
        <div class="fabric-section">
          <table class="fabric-table">
            <tr>
              <td class="fabric-label">FABRIC</td>
              <td class="fabric-value">${fabricName}</td>
            </tr>
            <tr>
              <td class="fabric-label">WIDTH</td>
              <td class="fabric-value">${fabricWidth}</td>
            </tr>
          </table>
        </div>

        <!-- AVERAGE TABLE (SUB STYLES & AVERAGES) -->
        <div class="average-heading">AVERAGE</div>
        <table class="average-table">
          <thead>
            <tr>
              ${subStylesWithAverages.map((s) => `<th>${s.name}</th>`).join('')}
              <th>TOTAL MTR</th>
            </tr>
          </thead>
          <tbody>
            <tr class="average-val-row">
              ${subStylesWithAverages.map((s) => `<td>${s.average ? Number(s.average).toFixed(2) : ''}</td>`).join('')}
              <td style="font-weight: 900;">${totalMtrAverage > 0 ? totalMtrAverage.toFixed(2) : ''}</td>
            </tr>
            <tr class="average-empty-row">
              ${subStylesWithAverages.map(() => `<td></td>`).join('')}
              <td></td>
            </tr>
          </tbody>
        </table>

        <!-- PRODUCTION BREAKDOWN GRID -->
        <div class="average-heading" style="margin-top: 10px;">PRODUCTION BREAKDOWN</div>
        <table class="production-grid">
          <thead>
            <tr>
              <th rowspan="2" class="col-color-header">COLOR</th>
              <th colspan="2">QTY</th>
              <th rowspan="2" style="width: 25%;">SUB STYLE</th>
              <th rowspan="2" style="width: 15%;">SIZE</th>
            </tr>
            <tr>
              <th class="col-qty-mtr">MTR</th>
              <th class="col-qty-pcs">PCS</th>
            </tr>
          </thead>
          <tbody>
            ${gridRows.map((row) => `
              <tr class="grid-data-row">
                <td class="cell-color">${row.color}</td>
                <td class="cell-number">${row.mtr !== '' && row.mtr !== undefined ? row.mtr : ''}</td>
                <td class="cell-number">${row.pcs !== '' && row.pcs !== undefined ? row.pcs : ''}</td>
                <td class="cell-substyle">${row.subStyle || ''}</td>
                <td class="cell-size">
                  ${row.subStyles && row.subStyles.length > 1 && row.sizes ? row.subStyles.map(s => row.sizes[s] ? `${s}: ${row.sizes[s]}` : '').filter(Boolean).join('<br>') || row.size || '' : row.size || (row.subStyles?.[0] ? row.sizes?.[row.subStyles[0]] : '') || row.sizes?.['SIZE'] || ''}
                  ${calculateProductionMeasurementTotal([row]) !== null ? `<div class="size-total">TOTAL ${formatSizeExpressionTotal(calculateProductionMeasurementTotal([row])!)}</div>` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr class="grid-total-row">
              <td class="cell-color">${safeActiveCategoryName} TOTALS:</td>
              <td class="cell-number">${totalMtr > 0 ? totalMtr.toFixed(2) : ''}</td>
              <td class="cell-number">${totalPcs > 0 ? totalPcs : ''}</td>
              <td colspan="2" class="grid-total-details">
                <span>TOTAL MEASUREMENT: ${totalMeasurement !== null ? formatSizeExpressionTotal(totalMeasurement) : '—'}</span>
                ${totalMtrAverage > 0 ? `<span>Fabric consumption @ ${totalMtrAverage.toFixed(2)} Mtr/Pc</span>` : ''}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- FOOTER: NOTE, REMARKS, SWATCHES, SIGNATURE -->
      <div class="footer-block">
        <div class="footer-left">
          <div style="display: flex; gap: 10px; margin-bottom: 8px;">
            <div style="flex: 1; border: 1.5px solid #000; padding: 4px 6px; min-height: 40px; box-sizing: border-box;">
              <div class="note-heading">NOTE:-</div>
              <div class="note-content">${noteText || ''}</div>
            </div>
            <div style="flex: 1; border: 1.5px solid #000; padding: 4px 6px; min-height: 40px; box-sizing: border-box;">
              <div class="note-heading">REMARKS:-</div>
              <div class="note-content">${remarksText || ''}</div>
            </div>
          </div>

          <!-- COLOR SWATCHES -->
          <div class="swatches-section">
            <div class="swatches-title">COLOR SWATCHES:</div>
            <div class="swatches-row">
              ${swatches.length > 0
                ? swatches.map((s) => `
                  <div class="swatch-card">
                    <div class="fabric-swatch" style="background-color: ${s.color || '#e2e8f0'};">
                      <span class="swatch-staple"></span>
                    </div>
                    ${s.name ? `<span class="swatch-name" title="${s.name}">${s.name}</span>` : ''}
                  </div>
                `).join('')
                : `
                  <div class="swatch-card">
                    <div class="swatch-empty-box"><span class="swatch-staple"></span></div>
                    <span class="swatch-name">Attach Swatch</span>
                  </div>
                  <div class="swatch-card">
                    <div class="swatch-empty-box"><span class="swatch-staple"></span></div>
                    <span class="swatch-name">Attach Swatch</span>
                  </div>
                  <div class="swatch-card">
                    <div class="swatch-empty-box"><span class="swatch-staple"></span></div>
                    <span class="swatch-name">Attach Swatch</span>
                  </div>
                  <div class="swatch-card">
                    <div class="swatch-empty-box"><span class="swatch-staple"></span></div>
                    <span class="swatch-name">Attach Swatch</span>
                  </div>
                `
              }
            </div>
          </div>
        </div>

        <div class="footer-right">
          <div class="signature-title">SIGNATURE</div>
          <div class="signature-line"></div>
        </div>
      </div>

    </div>
    `;
  };



  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Production Sheet (${safeCategoryLabel}) - ${serialNo}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 10mm 8mm 10mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      background-color: #f1f5f9;
      color: #000000;
      font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
      font-size: 11px;
      line-height: 1.2;
      padding: 16px;
    }
    .no-print-bar {
      max-width: 210mm;
      margin: 0 auto 12px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #111827;
      color: #ffffff;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 12px;
    }
    .btn {
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 700;
      border: none;
      transition: opacity 0.15s;
    }
    .btn-primary {
      background: #2563eb;
      color: #ffffff;
    }
    .btn-outline {
      background: #374151;
      color: #ffffff;
    }
    .btn:hover {
      opacity: 0.9;
    }

    /* AUTHENTIC SPEC SHEET CONTAINER */
    .sheet-wrapper {
      max-width: 200mm;
      min-height: 280mm;
      margin: 0 auto;
      background: #ffffff;
      border: 2px solid #000000;
      padding: 16px 20px;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    /* TOP HEADER: PRODUCTION SHEET (IN PLACE OF JBBJ) */
    .header-title {
      text-align: center;
      font-size: 22px;
      font-weight: 900;
      letter-spacing: 0.25em;
      margin-bottom: 8px;
      text-transform: uppercase;
      border-bottom: 1.5px solid #000000;
      padding-bottom: 4px;
    }

    .top-meta-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }

    .meta-col-left {
      width: 48%;
    }
    .meta-col-right {
      width: 42%;
      text-align: right;
    }

    .field-row {
      display: flex;
      align-items: center;
      margin-bottom: 8px;
    }
    .field-row-right {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      margin-bottom: 8px;
    }

    .label-bold {
      font-weight: 900;
      font-size: 13px;
      letter-spacing: 0.04em;
      margin-right: 8px;
      white-space: nowrap;
    }

    .box-input {
      border: 1.5px solid #000000;
      height: 30px;
      width: 140px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 700;
      font-family: inherit;
      padding: 0 6px;
      background: #ffffff;
    }

    .box-serial {
      border: 1.5px solid #000000;
      height: 30px;
      width: 110px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      font-weight: 900;
      background: #ffffff;
      letter-spacing: 0.05em;
    }

    .line-underline {
      border-bottom: 1.5px solid #000000;
      min-width: 190px;
      flex: 1;
      height: 22px;
      font-weight: 700;
      font-size: 13px;
      padding-left: 6px;
      display: flex;
      align-items: flex-end;
    }

    /* SUMMARY BOXES (3 UNIFORM BOXES) */
    .summary-boxes-row {
      display: flex;
      gap: 10px;
      margin-bottom: 12px;
    }
    .summary-box {
      flex: 1;
      border: 1.5px solid #000000;
      padding: 6px 10px;
      background: #ffffff;
      min-height: 48px;
      box-sizing: border-box;
    }
    .summary-box-label {
      font-size: 9px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 3px;
      color: #000000;
    }
    .summary-box-value {
      font-size: 11px;
      font-weight: 800;
      color: #000000;
    }

    /* FABRIC & WIDTH BOX */
    .fabric-section {
      margin-bottom: 14px;
    }

    .fabric-table {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #000000;
    }
    .fabric-table td {
      border: 1.5px solid #000000;
      padding: 6px 10px;
      font-size: 12px;
    }
    .fabric-label {
      width: 110px;
      font-weight: 900;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .fabric-value {
      font-weight: 700;
    }

    /* AVERAGE SUB-STYLES TABLE */
    .average-heading {
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
      text-transform: uppercase;
    }

    .average-table {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #000000;
      margin-bottom: 14px;
      text-align: center;
    }
    .average-table th, .average-table td {
      border: 1.5px solid #000000;
      padding: 5px 4px;
      font-size: 11px;
    }
    .average-table th {
      font-weight: 900;
      background: #ffffff;
      letter-spacing: 0.04em;
    }
    .average-val-row td {
      height: 24px;
      font-weight: 700;
      font-size: 12px;
    }
    .average-empty-row td {
      height: 22px;
    }

    /* MAIN COLOR & SIZE BREAKDOWN TABLE */
    .production-grid {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #000000;
      margin-bottom: 14px;
      text-align: center;
    }
    .production-grid th, .production-grid td {
      border: 1.5px solid #000000;
      padding: 3.5px 3px;
      font-size: 11px;
    }
    .production-grid th {
      font-weight: 900;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      background: #ffffff;
    }

    .col-color-header {
      width: 15%;
      font-size: 13px;
      font-weight: 900;
    }
    .col-qty-pcs {
      width: 9%;
      font-weight: 900;
    }
    .col-qty-mtr {
      width: 10%;
      font-weight: 900;
    }

    .grid-data-row {
      height: 25px;
    }
    .grid-data-row td {
      height: 25px;
      font-weight: 700;
    }
    .cell-color {
      text-align: left;
      padding-left: 8px !important;
      font-weight: 800 !important;
    }
    .cell-number {
      font-family: inherit;
    }
    .cell-substyle {
      font-weight: 700;
      text-transform: uppercase;
      font-size: 10px;
    }
    .cell-size {
      font-weight: 800;
      font-size: 11px;
    }
    .size-total {
      color: #047857;
      font-size: 9px;
      font-weight: 900;
      margin-top: 2px;
    }
    .grid-total-row td {
      height: 28px;
      border: 1.5px solid #000000;
      padding: 3.5px 3px;
      background: #f1f5f9;
      font-weight: 900;
    }
    .grid-total-details {
      text-align: right;
    }
    .grid-total-details span + span {
      margin-left: 12px;
      color: #475569;
      font-size: 9px;
      font-style: italic;
    }

    /* FOOTER SECTION: NOTE, SWATCHES, SIGNATURE */
    .footer-block {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-top: 6px;
    }

    .footer-left {
      width: 60%;
    }
    .note-heading {
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.04em;
      margin-bottom: 8px;
    }
    .note-content {
      font-size: 11px;
      color: #1f2937;
      margin-bottom: 10px;
      min-height: 18px;
    }

    /* COLOR SWATCH SAMPLES */
    .swatches-section {
      margin-top: 8px;
    }
    .swatches-title {
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.04em;
      color: #1e3a8a;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .swatches-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: flex-start;
    }
    .swatch-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
    }
    .fabric-swatch {
      width: 44px;
      height: 44px;
      position: relative;
      clip-path: polygon(0% 4%, 4% 0%, 8% 4%, 12% 0%, 16% 4%, 20% 0%, 24% 4%, 28% 0%, 32% 4%, 36% 0%, 40% 4%, 44% 0%, 48% 4%, 52% 0%, 56% 4%, 60% 0%, 64% 4%, 68% 0%, 72% 4%, 76% 0%, 80% 4%, 84% 0%, 88% 4%, 92% 0%, 96% 4%, 100% 0%, 96% 4%, 100% 8%, 96% 12%, 100% 16%, 96% 20%, 100% 24%, 96% 28%, 100% 32%, 96% 36%, 100% 40%, 96% 44%, 100% 48%, 96% 52%, 100% 56%, 96% 60%, 100% 64%, 96% 68%, 100% 72%, 96% 76%, 100% 80%, 96% 84%, 100% 88%, 96% 92%, 100% 96%, 96% 100%, 100% 96%, 96% 100%, 92% 96%, 88% 100%, 84% 96%, 80% 100%, 76% 96%, 72% 100%, 68% 96%, 64% 100%, 60% 96%, 56% 100%, 52% 96%, 48% 100%, 44% 96%, 40% 100%, 36% 96%, 32% 100%, 28% 96%, 24% 100%, 20% 96%, 16% 100%, 12% 96%, 8% 100%, 4% 96%, 0% 100%, 4% 96%, 0% 92%, 4% 88%, 0% 84%, 4% 80%, 0% 76%, 4% 72%, 0% 68%, 4% 64%, 0% 60%, 4% 56%, 0% 52%, 4% 48%, 0% 44%, 4% 40%, 0% 36%, 4% 32%, 0% 28%, 4% 24%, 0% 20%, 4% 16%, 0% 12%, 4% 8%, 0% 4%);
      box-shadow: 0 1px 2px rgba(0,0,0,0.12);
    }
    .swatch-staple {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 14px;
      height: 2px;
      background-color: #334155;
      border-radius: 1px;
      box-shadow: 0 1px 1px rgba(0,0,0,0.4);
    }
    .swatch-empty-box {
      width: 44px;
      height: 44px;
      border: 1.5px dashed #64748b;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #f8fafc;
    }
    .swatch-name {
      font-size: 8.5px;
      font-weight: 700;
      color: #334155;
      text-align: center;
      max-width: 55px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .footer-right {
      width: 32%;
      text-align: center;
    }
    .signature-title {
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 0.05em;
      margin-bottom: 24px;
    }
    .signature-line {
      border-bottom: 1.5px solid #000000;
      width: 100%;
      margin: 0 auto 4px auto;
    }

    /* PRINT RULES */
    @media print {
      body {
        background: transparent;
        padding: 0;
      }
      .no-print-bar {
        display: none !important;
      }
      .sheet-wrapper {
        border: 2px solid #000000 !important;
        margin: 0 0 20px 0;
        padding: 14px 18px;
        width: 100%;
        max-width: 100%;
        min-height: 285mm;
        box-shadow: none;
        page-break-after: always;
        break-after: page;
      }
      .sheet-wrapper:last-child {
        page-break-after: auto;
        break-after: auto;
        margin-bottom: 0;
      }
    }
  </style>
</head>
<body>

  <!-- Top Action Bar for interactive browser preview -->
  <div class="no-print-bar">
    <div>
      <strong>Production Sheet &middot; ${safeCategoryLabel}</strong> &middot; Serial No. ${serialNo}
    </div>
    <div style="display: flex; gap: 8px;">
      <button class="btn btn-primary" onclick="window.print()">
        🖨️ Print ${safeCategoryLabel} Sheet (A4)
      </button>
      <button class="btn btn-primary" style="background: #059669;" onclick="window.downloadSelf()">
        💾 Download ${safeCategoryLabel} Sheet
      </button>
      <button class="btn btn-outline" onclick="window.close()">
        ✕ Close
      </button>
    </div>
  </div>

  ${targetCategories.map((cat) => renderSingleSheet(cat)).join('\n')}

  <script>
    window.downloadSelf = function() {
      var blob = new Blob([document.documentElement.outerHTML], { type: 'text/html;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'Production_Sheet_${safeFilenameCategory}_${serialNo}.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
    };
  </script>
</body>
</html>`;
}

/**
 * Download Production Sheet as an offline HTML file
 */
export async function downloadProductionSheetHtml(program: any, category: GarmentCategory | 'ALL' = 'TOP') {
  try {
    const completeProgram = await loadProgramDocument(program);
    const html = generateProductionSheetHtml(completeProgram, category);
    const serialNo = completeProgram.programSerialNo || completeProgram.programNumber || 'PRG-SHEET';
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Production_Sheet_${category}_${serialNo}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The production sheet could not be downloaded.';
    window.alert(`Production sheet download failed: ${message}`);
  }
}

/**
 * Open print window for the Production Sheet
 */
export function printProductionSheet(program: any, category: GarmentCategory | 'ALL' = 'TOP') {
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    void (async () => {
      try {
        const completeProgram = await loadProgramDocument(program);
        printWindow.document.open();
        printWindow.document.write(generateProductionSheetHtml(completeProgram, category));
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
      } catch (error) {
        printWindow.close();
        const message = error instanceof Error ? error.message : 'Failed to print production sheet.';
        window.alert(`Production sheet print failed: ${message}`);
      }
    })();
  } else {
    void downloadProductionSheetHtml(program, category);
  }
}

/**
 * Wilcom Form Re-exports (Backwards Compatibility)
 * Dedicated Wilcom implementation now resides in @/lib/download-wilcom.
 */
export {
  generateWilcomFormHtml,
  downloadWilcomFormHtml,
  printWilcomForm,
} from './download-wilcom';
