export type FabricStockType = 'UNDYED' | 'DYED';

export function cleanFabricName(name: string | null | undefined): string {
  if (!name) return '';
  // Only a spaced separator starts a suffix; hyphens inside codes ("PC-30", "RY-60") are part of the name.
  return name
    .split('—')[0]
    .split(/\s+-\s+/)[0]
    .split('(')[0]
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeFabricStockType(entryType: string | null | undefined): FabricStockType {
  return entryType?.toUpperCase() === 'KORA' || entryType?.toUpperCase() === 'UNDYED'
    ? 'UNDYED'
    : 'DYED';
}

export function getChallanItemFabricType(
  item: { colour?: string | null; remarks?: string | null },
  toDepartment: string
): FabricStockType {
  const status = item.remarks?.match(/\bStatus:\s*(Undyed|Dyed)\b/i)?.[1]?.toUpperCase();
  if (status === 'UNDYED' || status === 'DYED') return status;

  const colour = item.colour?.trim().toUpperCase();
  if (colour === 'KORA' || colour === 'UNDYED') return 'UNDYED';
  if (colour === 'DYED') return 'DYED';

  return toDepartment.toUpperCase().includes('DYE') ? 'UNDYED' : 'DYED';
}

export function isFabricStoreDepartment(department: string): boolean {
  const normalized = department.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return normalized === 'STORE' || normalized === 'FABRIC' || normalized.endsWith('FABRICSTORE');
}

// ============================================================================
// Fabric Store stock ledger
// Balances are derived from Inward entries minus Fabric Store challan items and
// manual outward records. Meters and pieces are never converted or combined:
// every balance is kept per fabric + stock type + colour + unit.
// ============================================================================

export type FabricStockUnit = 'MTR' | 'PCS';

export function normalizeStockUnit(unit: string | null | undefined): string {
  return String(unit || 'MTR').trim().toUpperCase();
}

export function normalizeStockColor(color: string | null | undefined): string {
  return String(color || '').trim();
}

export function fabricStockKey(name: string, type: FabricStockType, color: string, unit: string): string {
  return `${cleanFabricName(name).toLowerCase()}___${type}___${normalizeStockColor(color).toLowerCase()}___${normalizeStockUnit(unit)}`;
}

function parseStockKey(key: string) {
  const [name, type, color, unit] = key.split('___');
  return { name, type, color, unit };
}

export interface FabricStockRow {
  itemName: string;
  fabricType: FabricStockType;
  color: string;
  unit: string;
  totalInward: number;
  totalOutward: number;
  /** Signed balance; negative only when historical outward exceeded recorded inward. */
  rawBalance: number;
  inwardCount: number;
  outwardCount: number;
  lastActivity: Date;
}

export interface FabricStockOutwardRow {
  id: string;
  date: Date;
  challanNumber: string;
  sourceDepartment: string;
  destination: string;
  itemName: string;
  color: string;
  quantity: number;
  unit: string;
  fabricType: FabricStockType;
}

export interface FabricInwardRecord {
  entryType: string;
  itemName: string;
  color?: string | null;
  billQty: number | string;
  unit?: string | null;
  receivingDate?: Date | string | null;
  createdAt?: Date | string | null;
}

export interface FabricStoreChallanRecord {
  id: string;
  challanNumber: string;
  fromDepartment: string;
  toDepartment: string;
  fabricUnit?: string | null;
  fabricOut?: number | null;
  fabricIn?: number | null;
  issuedDate?: Date | string | null;
  createdAt: Date | string;
  program?: { fabricName?: string | null } | null;
  items: Array<{
    id?: string;
    itemDescription?: string | null;
    fabricCode?: string | null;
    colour?: string | null;
    remarks?: string | null;
    quantity: number | string;
    uom?: string | null;
  }>;
}

export interface FabricManualOutwardRecord {
  id: string;
  challanId?: string | null;
  challanNumber?: string | null;
  fabricType?: string | null;
  itemName?: string | null;
  color?: string | null;
  issueQty: number | string;
  unit?: string | null;
  destination?: string | null;
  date?: Date | string | null;
  createdAt?: Date | string | null;
}

export interface FabricStockLine {
  name: string;
  type: FabricStockType;
  color: string;
  unit: string;
}

export interface FabricStockLedger {
  rows: Map<string, FabricStockRow>;
  outwardHistory: FabricStockOutwardRow[];
  /** Resolves which stock row an outgoing line draws from (without mutating the ledger). */
  resolveKey: (line: FabricStockLine) => string;
  /** Lower-cased numbers of the Fabric Store challans counted as outward (manual rows with these numbers are mirrors). */
  countedChallanNumbers: Set<string>;
}

/** The stock line a Fabric Store challan item draws from. Shared by the ledger and issue validation. */
export function challanItemStockLine(
  item: { fabricCode?: string | null; itemDescription?: string | null; colour?: string | null; remarks?: string | null; uom?: string | null },
  toDepartment: string,
  challanUnit?: string | null,
  programFabricName?: string | null
): FabricStockLine {
  return {
    name: item.fabricCode || cleanFabricName(item.itemDescription) || programFabricName || 'Fabric Material',
    type: getChallanItemFabricType(item, toDepartment),
    color: normalizeStockColor(item.colour),
    unit: normalizeStockUnit(item.uom || challanUnit),
  };
}

const toDate = (value: Date | string | null | undefined, fallback: Date | string): Date =>
  new Date(value || fallback);

/**
 * Stock is matched deterministically: exact fabric name + stock type + unit, and then
 * exact colour. A fabric+type+unit with any inward entry recorded without a colour
 * (entered before colour tracking) is kept as one pooled balance for all colours, since
 * those entries cannot be attributed to a colour. Adding stock can only merge balances,
 * never move a past deduction onto a different row.
 */
export function buildFabricStockLedger(input: {
  inwardEntries: FabricInwardRecord[];
  storeChallans: FabricStoreChallanRecord[];
  manualOutwards: FabricManualOutwardRecord[];
}): FabricStockLedger {
  const rows = new Map<string, FabricStockRow>();
  const outwardHistory: FabricStockOutwardRow[] = [];

  const groupOf = (name: string, type: FabricStockType, unit: string) =>
    `${cleanFabricName(name).toLowerCase()}___${type}___${normalizeStockUnit(unit)}`;
  const pooledGroups = new Set(
    input.inwardEntries
      .filter((inw) => !normalizeStockColor(inw.color))
      .map((inw) => groupOf(inw.itemName, normalizeFabricStockType(inw.entryType), normalizeStockUnit(inw.unit)))
  );
  const resolveKey = (line: FabricStockLine): string => {
    const pooled = pooledGroups.has(groupOf(line.name, line.type, line.unit));
    return fabricStockKey(line.name, line.type, pooled ? '' : line.color, line.unit);
  };

  for (const inw of input.inwardEntries) {
    const type = normalizeFabricStockType(inw.entryType);
    const unit = normalizeStockUnit(inw.unit);
    const cleanName = cleanFabricName(inw.itemName) || String(inw.itemName || '').trim();
    const key = resolveKey({ name: cleanName, type, color: normalizeStockColor(inw.color), unit });
    const activity = toDate(inw.receivingDate, inw.createdAt || new Date());
    const existing = rows.get(key) || {
      itemName: cleanName,
      fabricType: type,
      color: parseStockKey(key).color ? normalizeStockColor(inw.color) : '',
      unit,
      totalInward: 0,
      totalOutward: 0,
      rawBalance: 0,
      inwardCount: 0,
      outwardCount: 0,
      lastActivity: activity,
    };
    existing.totalInward += Number(inw.billQty) || 0;
    existing.inwardCount += 1;
    if (activity.getTime() > existing.lastActivity.getTime()) existing.lastActivity = activity;
    rows.set(key, existing);
  }

  const addOutward = (line: FabricStockLine, quantity: number, date: Date, history: Omit<FabricStockOutwardRow, 'color' | 'unit' | 'fabricType' | 'quantity' | 'date'>) => {
    const key = resolveKey(line);
    const existing = rows.get(key) || {
      itemName: cleanFabricName(line.name) || line.name.trim(),
      fabricType: line.type,
      color: parseStockKey(key).color ? normalizeStockColor(line.color) : '',
      unit: normalizeStockUnit(line.unit),
      totalInward: 0,
      totalOutward: 0,
      rawBalance: 0,
      inwardCount: 0,
      outwardCount: 0,
      lastActivity: date,
    };
    existing.totalOutward += quantity;
    existing.outwardCount += 1;
    if (date.getTime() > existing.lastActivity.getTime()) existing.lastActivity = date;
    rows.set(key, existing);
    outwardHistory.push({
      ...history,
      date,
      quantity,
      color: normalizeStockColor(line.color),
      unit: normalizeStockUnit(line.unit),
      fabricType: line.type,
    });
  };

  const challanNumbers = new Set<string>();
  for (const ch of input.storeChallans) {
    challanNumbers.add(String(ch.challanNumber || '').trim().toLowerCase());
    const isDyeing = ch.toDepartment.toUpperCase().includes('DYE');
    const challanType: FabricStockType = isDyeing ? 'UNDYED' : 'DYED';
    const challanDate = toDate(ch.issuedDate, ch.createdAt);

    if (ch.items.length > 0) {
      for (const it of ch.items) {
        const qty = Number(it.quantity) || 0;
        if (qty <= 0) continue;
        const line = challanItemStockLine(it, ch.toDepartment, ch.fabricUnit, ch.program?.fabricName);
        const rawName = line.name;
        addOutward(
          line,
          qty,
          challanDate,
          {
            id: `challan-${ch.id}-${it.id || outwardHistory.length}`,
            challanNumber: ch.challanNumber,
            sourceDepartment: ch.fromDepartment,
            destination: ch.toDepartment,
            itemName: cleanFabricName(it.itemDescription) || rawName,
          }
        );
      }
    } else {
      const rawName = ch.program?.fabricName || (isDyeing ? 'Grey / Undyed Fabric' : 'Processed Fabric');
      const qty = Number(ch.fabricOut ?? ch.fabricIn ?? 0);
      if (qty > 0) {
        addOutward(
          { name: rawName, type: challanType, color: '', unit: normalizeStockUnit(ch.fabricUnit) },
          qty,
          challanDate,
          {
            id: `challan-${ch.id}`,
            challanNumber: ch.challanNumber,
            sourceDepartment: ch.fromDepartment,
            destination: ch.toDepartment,
            itemName: cleanFabricName(rawName) || rawName,
          }
        );
      }
    }
  }

  for (const outw of input.manualOutwards) {
    // Manual rows that mirror an issued challan were already counted above.
    if (outw.challanId || (outw.challanNumber && challanNumbers.has(String(outw.challanNumber).trim().toLowerCase()))) continue;
    const qty = Number(outw.issueQty) || 0;
    if (qty <= 0) continue;
    const rawName = outw.itemName || 'Fabric Material';
    addOutward(
      { name: rawName, type: normalizeFabricStockType(outw.fabricType), color: normalizeStockColor(outw.color), unit: normalizeStockUnit(outw.unit) },
      qty,
      toDate(outw.date, outw.createdAt || new Date()),
      {
        id: `manual-${outw.id}`,
        challanNumber: outw.challanNumber || '—',
        sourceDepartment: 'STORE',
        destination: outw.destination || '—',
        itemName: cleanFabricName(rawName) || rawName,
      }
    );
  }

  for (const row of rows.values()) {
    row.rawBalance = Math.round((row.totalInward - row.totalOutward) * 1000) / 1000;
  }

  return { rows, outwardHistory, resolveKey, countedChallanNumbers: challanNumbers };
}

export interface FabricStockRequest extends FabricStockLine {
  quantity: number;
  label?: string;
}

export interface FabricStockShortage {
  itemName: string;
  color: string;
  unit: string;
  fabricType: FabricStockType;
  requested: number;
  available: number;
}

/**
 * Checks requested challan lines against current balances. Lines drawing from
 * the same stock row are summed first, so two colours of one fabric cannot
 * each pass while jointly exceeding stock.
 */
export function findFabricStockShortages(ledger: FabricStockLedger, requests: FabricStockRequest[]): FabricStockShortage[] {
  const requestedByKey = new Map<string, { line: FabricStockRequest; quantity: number }>();
  for (const request of requests) {
    const quantity = Number(request.quantity) || 0;
    if (quantity <= 0) continue;
    const key = ledger.resolveKey(request);
    const current = requestedByKey.get(key);
    requestedByKey.set(key, { line: current?.line || request, quantity: (current?.quantity || 0) + quantity });
  }

  const shortages: FabricStockShortage[] = [];
  for (const [key, { line, quantity }] of requestedByKey) {
    const row = ledger.rows.get(key);
    const available = Math.max(0, row?.rawBalance ?? 0);
    if (quantity > available + 1e-9) {
      shortages.push({
        itemName: row?.itemName || cleanFabricName(line.name) || line.name,
        color: row ? row.color : normalizeStockColor(line.color),
        unit: normalizeStockUnit(line.unit),
        fabricType: row?.fabricType || line.type,
        requested: Math.round(quantity * 1000) / 1000,
        available: Math.round(available * 1000) / 1000,
      });
    }
  }
  return shortages;
}

export function describeFabricStockShortages(shortages: FabricStockShortage[]): string {
  return shortages
    .map((s) => `${s.itemName}${s.color ? ` / ${s.color}` : ''} (${s.fabricType === 'UNDYED' ? 'Undyed' : 'Dyed'}): requested ${s.requested} ${s.unit}, available ${s.available} ${s.unit}`)
    .join('; ');
}
