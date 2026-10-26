// Fabric Store stock rules: stock buckets per fabric, type, colour and unit, issue resolution,
// and ledger reconciliation. Pure, no database or framework imports, so
// scripts/test-production-fixes.mjs can run them with node:test.
//
// Meters (MTR) and pieces (PCS) are separate stock. Nothing here converts or adds one to the other.

export const STOCK_UNITS = Object.freeze(['MTR', 'PCS']);
const EPSILON = 1e-6;

export function cleanFabricName(name) {
  if (!name) return '';
  return String(name)
    .split('—')[0]
    .split('-')[0]
    .split('(')[0]
    .trim();
}

/** @returns {'UNDYED' | 'DYED'} */
export function normalizeFabricStockType(entryType) {
  const type = String(entryType || '').toUpperCase();
  return type === 'KORA' || type === 'UNDYED' ? 'UNDYED' : 'DYED';
}

/** @returns {'UNDYED' | 'DYED'} */
export function getChallanItemFabricType(item, toDepartment) {
  const status = item?.remarks?.match(/\bStatus:\s*(Undyed|Dyed)\b/i)?.[1]?.toUpperCase();
  if (status === 'UNDYED' || status === 'DYED') return status;

  const colour = item?.colour?.trim().toUpperCase();
  if (colour === 'KORA' || colour === 'UNDYED') return 'UNDYED';
  if (colour === 'DYED') return 'DYED';

  return String(toDepartment || '').toUpperCase().includes('DYE') ? 'UNDYED' : 'DYED';
}

export function isFabricStoreDepartment(department) {
  const normalized = String(department || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return normalized === 'STORE' || normalized === 'FABRIC' || normalized.endsWith('FABRICSTORE');
}

/** "mtr", "meters", "m" -> "MTR"; "pcs", "pieces", "pc" -> "PCS"; anything else -> null. */
export function normalizeStockUnit(raw) {
  const unit = String(raw || '').trim().toUpperCase().replace(/[^A-Z]/g, '');
  if (['MTR', 'MTRS', 'M', 'METER', 'METERS', 'METRE', 'METRES'].includes(unit)) return 'MTR';
  if (['PCS', 'PC', 'PIECE', 'PIECES'].includes(unit)) return 'PCS';
  return null;
}

export function fabricNameKey(name) {
  const clean = cleanFabricName(name) || String(name || '').trim();
  return clean.replace(/\s+/g, ' ').toLowerCase();
}

/** Blank colour is its own bucket: stock recorded without a colour. */
export function colourKey(colour) {
  return String(colour || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function stockKey({ fabric, type, colour, unit }) {
  return [fabricNameKey(fabric), normalizeFabricStockType(type), colourKey(colour), unit].join('|');
}

export function roundQty(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}

/**
 * Quantities kept per unit ({ MTR, PCS }); meters and pieces are never added together. A unit that is
 * neither (e.g. an old "ROLL" line) keeps its own key rather than being counted as meters or pieces.
 */
/** @returns {Record<string, number>} */
export function unitTotals() {
  return { MTR: 0, PCS: 0 };
}

/**
 * @param {Record<string, number>} totals
 * @param {unknown} unit
 * @param {unknown} quantity
 * @returns {Record<string, number>}
 */
export function addToUnitTotals(totals, unit, quantity) {
  const key = normalizeStockUnit(unit) || String(unit || '').trim().toUpperCase() || 'MTR';
  totals[key] = roundQty((totals[key] || 0) + (Number(quantity) || 0));
  return totals;
}

/**
 * Totals of challan lines per unit. `single` is the one unit and its quantity when every line uses the
 * same unit (null for a mixed challan), so screens can keep a plain "Total: 120 MTR" where it applies.
 * @param {Array<{ quantity?: unknown, uom?: unknown }> | null | undefined} items
 * @param {string} [fallbackUnit]
 * @returns {{ totals: Record<string, number>, single: { quantity: number, unit: string } | null, label: string }}
 */
export function lineTotals(items, fallbackUnit = 'MTR') {
  const totals = {};
  for (const item of items || []) addToUnitTotals(totals, item?.uom || fallbackUnit, item?.quantity);
  const units = Object.keys(totals);
  const single = units.length <= 1 ? { quantity: totals[units[0]] || 0, unit: units[0] || fallbackUnit } : null;
  return { totals, single, label: formatUnitTotals(totals) };
}

/** "120.5 MTR · 45 PCS"; units with nothing are left out; "0" when there is nothing at all. */
/** @param {Record<string, number> | null | undefined} totals */
export function formatUnitTotals(totals, empty = '0') {
  const parts = Object.entries(totals || {})
    .filter(([, q]) => Math.abs(Number(q) || 0) > 0)
    .map(([unit, q]) => `${roundQty(q).toLocaleString('en-IN', { maximumFractionDigits: 3 })} ${unit}`);
  return parts.length ? parts.join(' · ') : empty;
}

// ---------------------------------------------------------------------------
// Stock book
// ---------------------------------------------------------------------------

export function createStockBook() {
  return { buckets: new Map() };
}

function ensureBucket(book, { fabric, type, colour, unit }, key = stockKey({ fabric, type, colour, unit })) {
  let bucket = book.buckets.get(key);
  if (!bucket) {
    bucket = {
      key,
      itemName: cleanFabricName(fabric) || String(fabric || '').trim() || 'Fabric Material',
      fabricType: normalizeFabricStockType(type),
      colour: String(colour || '').trim() || null,
      unit,
      totalInward: 0,
      totalOutward: 0,
      inwardCount: 0,
      outwardCount: 0,
      hasInward: false,
      lastActivity: null,
    };
    book.buckets.set(key, bucket);
  }
  return bucket;
}

function touch(bucket, date) {
  if (!date) return;
  const time = new Date(date).getTime();
  if (Number.isNaN(time)) return;
  if (!bucket.lastActivity || time > new Date(bucket.lastActivity).getTime()) bucket.lastActivity = date;
}

/** Adds a received quantity. Lines with a unit other than MTR / PCS are ignored. */
export function addInward(book, line) {
  const unit = normalizeStockUnit(line.unit || 'MTR');
  const quantity = Number(line.quantity) || 0;
  if (!unit || quantity <= 0) return null;
  const bucket = ensureBucket(book, { ...line, unit });
  bucket.totalInward = roundQty(bucket.totalInward + quantity);
  bucket.inwardCount += 1;
  bucket.hasInward = true;
  touch(bucket, line.date);
  return bucket.key;
}

/**
 * Applies a signed movement to an exact bucket key (ledger entries). Negative quantities are
 * issues; positive ones reverse earlier issues.
 */
export function applyMovement(book, key, line, signedQuantity) {
  const quantity = Number(signedQuantity) || 0;
  if (Math.abs(quantity) < EPSILON) return;
  const [, type, , unit] = key.split('|');
  const bucket = ensureBucket(book, { ...line, type, unit }, key);
  bucket.totalOutward = roundQty(bucket.totalOutward - quantity);
  if (quantity < 0) bucket.outwardCount += 1;
  touch(bucket, line.date);
}

/**
 * An outward document recorded before the ledger existed: it is matched to a bucket with the
 * issue rules, or kept in its own bucket when nothing matches (so it is never silently dropped).
 */
export function addLegacyOutward(book, line) {
  const quantity = Number(line.quantity) || 0;
  const unit = normalizeStockUnit(line.unit || 'MTR');
  if (quantity <= 0 || !unit) return null;
  const resolved = resolveIssueBucket(book, { ...line, unit });
  const key = resolved.ok ? resolved.key : stockKey({ ...line, unit });
  applyMovement(book, key, line, -quantity);
  return key;
}

export function bucketBalance(book, key) {
  const bucket = book.buckets.get(key);
  return bucket ? roundQty(bucket.totalInward - bucket.totalOutward) : 0;
}

/**
 * Which bucket an issued line draws from.
 * - The unit must match exactly; meters never satisfy pieces or the reverse.
 * - Fabric: exact name first, otherwise one unambiguous partial match among received fabrics.
 * - Type: the line's type (UNDYED / DYED) when such stock exists, otherwise the other type.
 * - Colour: the line's colour when that colour was received; otherwise stock received without a
 *   colour (entries recorded before colour tracking); a blank line colour may use the only
 *   coloured bucket when there is exactly one.
 * @returns {{ ok: true, key: string } | { ok: false, error: string }}
 */
export function resolveIssueBucket(book, line) {
  const unit = normalizeStockUnit(line.unit);
  const fabricLabel = cleanFabricName(line.fabric) || String(line.fabric || '').trim();
  if (!unit) return { ok: false, error: `Unit for "${fabricLabel || 'fabric'}" must be MTR or PCS.` };
  const wantedName = fabricNameKey(line.fabric);
  if (!wantedName) return { ok: false, error: 'Fabric name is required for every challan line.' };

  const received = Array.from(book.buckets.values()).filter((b) => b.hasInward && b.unit === unit);
  const nameOf = (bucket) => bucket.key.split('|')[0];
  let sameName = received.filter((b) => nameOf(b) === wantedName);
  if (sameName.length === 0) {
    const partial = received.filter((b) => nameOf(b).includes(wantedName) || wantedName.includes(nameOf(b)));
    const names = new Set(partial.map(nameOf));
    if (names.size > 1) {
      return {
        ok: false,
        error: `"${fabricLabel}" matches more than one fabric in stock (${Array.from(names).join(', ')}). Use the exact fabric name.`,
      };
    }
    sameName = partial;
  }
  if (sameName.length === 0) {
    return { ok: false, error: `No ${unit} stock of "${fabricLabel}" has been received in Fabric Store.` };
  }

  const wantedType = normalizeFabricStockType(line.type);
  const sameType = sameName.filter((b) => b.fabricType === wantedType);
  const typed = sameType.length > 0 ? sameType : sameName;

  const wantedColour = colourKey(line.colour);
  const colourOf = (bucket) => bucket.key.split('|')[2];
  const exact = typed.find((b) => colourOf(b) === wantedColour);
  if (exact) return { ok: true, key: exact.key };
  const uncoloured = typed.find((b) => colourOf(b) === '');
  if (uncoloured) return { ok: true, key: uncoloured.key };
  if (!wantedColour && typed.length === 1) return { ok: true, key: typed[0].key };
  if (!wantedColour) {
    return { ok: false, error: `Select the colour of "${fabricLabel}" to issue; it is stocked in several colours.` };
  }
  return {
    ok: false,
    error: `No ${unit} stock of "${fabricLabel}" in colour "${String(line.colour).trim()}". Stocked colours: ${typed
      .map((b) => b.colour || 'unspecified')
      .join(', ')}.`,
  };
}

/**
 * Resolves every line of an issue to its bucket and checks the balance, summing lines that draw
 * from the same bucket.
 * @returns {{ ok: boolean, movements: Map<string, number>, allocations: Array<{ index: number, key: string, quantity: number }>, errors: string[] }}
 */
export function planIssue(book, lines) {
  const movements = new Map();
  const allocations = [];
  const errors = [];
  lines.forEach((line, index) => {
    const quantity = Number(line.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      errors.push(`Line ${index + 1}: quantity must be a positive number.`);
      return;
    }
    const resolved = resolveIssueBucket(book, line);
    if (!resolved.ok) {
      errors.push(`Line ${index + 1}: ${resolved.error}`);
      return;
    }
    allocations.push({ index, key: resolved.key, quantity: roundQty(quantity) });
    movements.set(resolved.key, roundQty((movements.get(resolved.key) || 0) - quantity));
  });
  for (const [key, movement] of movements) {
    const available = bucketBalance(book, key);
    if (available + movement < -EPSILON) {
      const bucket = book.buckets.get(key);
      const label = [bucket.itemName, bucket.colour].filter(Boolean).join(' / ');
      errors.push(
        `Insufficient stock of ${label} (${bucket.fabricType}): ${roundQty(-movement)} ${bucket.unit} requested, ${Math.max(0, available)} ${bucket.unit} available.`,
      );
    }
  }
  return { ok: errors.length === 0, movements, allocations, errors };
}

// ---------------------------------------------------------------------------
// Ledger reconciliation
// ---------------------------------------------------------------------------

/**
 * Ledger rows a document still needs: the difference between what it should contribute now
 * (`desired`, signed per bucket) and what the ledger already holds for it (`posted`). Running it
 * again after posting yields nothing, so retries and double submits cannot double-post.
 * @param {Map<string, number> | Record<string, number>} desired
 * @param {Map<string, number> | Record<string, number>} posted
 * @returns {Array<{ key: string, delta: number }>}
 */
export function planLedgerAdjustments(desired, posted) {
  const want = desired instanceof Map ? desired : new Map(Object.entries(desired || {}));
  const have = posted instanceof Map ? posted : new Map(Object.entries(posted || {}));
  const keys = Array.from(new Set([...want.keys(), ...have.keys()])).sort();
  const adjustments = [];
  for (const key of keys) {
    const delta = roundQty((want.get(key) || 0) - (have.get(key) || 0));
    if (Math.abs(delta) >= EPSILON) adjustments.push({ key, delta });
  }
  return adjustments;
}

/**
 * Balances after a document change, given balances without that document (`baseBalances`).
 * A bucket the change reduces must not end below zero.
 * @returns {{ balances: Map<string, number>, violations: Array<{ key: string, balance: number }> }}
 */
export function checkDocumentBalances(baseBalances, desired, adjustments) {
  const base = baseBalances instanceof Map ? baseBalances : new Map(Object.entries(baseBalances || {}));
  const want = desired instanceof Map ? desired : new Map(Object.entries(desired || {}));
  const balances = new Map();
  const violations = [];
  for (const { key, delta } of adjustments) {
    const balance = roundQty((base.get(key) || 0) + (want.get(key) || 0));
    balances.set(key, balance);
    if (delta < 0 && balance < -EPSILON) violations.push({ key, balance });
  }
  return { balances, violations };
}

/** Ledger idempotency key for the n-th posting of a document to one bucket. */
export function ledgerIdempotencyKey(referenceType, referenceId, key, revision) {
  return `${referenceType}:${referenceId}:${key}:r${revision}`;
}

// ---------------------------------------------------------------------------
// Documents -> stock lines
// ---------------------------------------------------------------------------

/** Stock lines a Fabric Store challan issues (its items, or the challan totals when it has none). */
export function challanStockLines(challan) {
  const items = Array.isArray(challan.items) ? challan.items : [];
  const challanUnit = challan.fabricUnit || items[0]?.uom || 'MTR';
  if (items.length > 0) {
    return items
      .map((item) => ({
        itemId: item.id,
        fabric:
          item.fabricCode ||
          cleanFabricName(item.itemDescription) ||
          challan.program?.fabricName ||
          'Fabric Material',
        type: getChallanItemFabricType(item, challan.toDepartment),
        colour: item.colour || null,
        unit: item.uom || challanUnit,
        quantity: Number(item.quantity) || 0,
      }))
      .filter((line) => line.quantity > 0);
  }
  const quantity = Number(challan.fabricOut ?? challan.fabricIn ?? 0);
  if (quantity <= 0) return [];
  const isDyeing = String(challan.toDepartment || '').toUpperCase().includes('DYE');
  return [
    {
      itemId: null,
      fabric: challan.program?.fabricName || (isDyeing ? 'Grey / Undyed Fabric' : 'Processed Fabric'),
      type: isDyeing ? 'UNDYED' : 'DYED',
      colour: null,
      unit: challanUnit,
      quantity,
    },
  ];
}

/** Separate meter and piece totals; never summed together. */
export function summarizeBuckets(buckets) {
  const list = Array.from(buckets);
  const sum = (unit, pick) =>
    roundQty(list.filter((b) => b.unit === unit).reduce((total, b) => total + pick(b), 0));
  const available = (b) => Math.max(0, b.totalInward - b.totalOutward);
  return {
    totalInwardMeters: sum('MTR', (b) => b.totalInward),
    totalOutwardMeters: sum('MTR', (b) => b.totalOutward),
    availableBalanceMeters: sum('MTR', available),
    totalInwardPcs: sum('PCS', (b) => b.totalInward),
    totalOutwardPcs: sum('PCS', (b) => b.totalOutward),
    availableBalancePcs: sum('PCS', available),
    itemCount: list.length,
  };
}
