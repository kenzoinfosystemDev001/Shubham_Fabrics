import { prisma } from '@subham/database';
import { cleanFabricName } from '@/lib/fabric-stock';
import { loadFabricStockLedger } from '@/lib/fabric-stock-ledger';

export interface FabricAvailabilityStatus {
  programId: string;
  programNumber: string;
  programSerialNo: string;
  clientName?: string | null;
  designNumber?: string | null;
  styleCode?: string | null;
  fabricName: string;
  fabricColor: string;
  fabricDyeingRequired: boolean;
  destinationDepartment: 'DYEING' | 'EMBROIDERY';
  requiredMeters: number;
  requiredPieces: number;
  requiredUnit: 'MTR' | 'PCS';
  requiredQuantity: number;

  // Stock sources in store
  inwardStockMeters: number;
  inwardStockPcs: number;
  inwardEntriesCount: number;
  rollStockMeters: number;
  rollCount: number;
  totalStoreStockMeters: number;
  totalStoreStockPcs: number;

  // Verification & program flags
  fabricColorAvailable: string;
  fabricStoreVerified: boolean;
  fabricStoreVerifiedAt?: string | null;
  fabricStoreVerifiedBy?: string | null;

  // Final Decision
  isAvailable: boolean;
  canMoveToNextDepartment: boolean;
  statusLabel: 'AVAILABLE' | 'OUT_OF_STOCK' | 'AWAITING_INWARD';
  message: string;
}

/**
 * Checks if the fabric required for a production sheet / program is available in the Fabric Store.
 * Rule: The production sheet can ONLY move to the next department (Dyeing / Embroidery)
 * if fabric is available in the store.
 */
export async function checkFabricStoreAvailability(
  programIdOrNumber: string,
  unitOverride?: 'MTR' | 'PCS'
): Promise<FabricAvailabilityStatus> {
  const program = await prisma.program.findFirst({
    where: {
      OR: [
        { id: programIdOrNumber },
        { programNumber: programIdOrNumber },
        { programSerialNo: programIdOrNumber },
      ],
    },
    include: {
      fabricStoreRolls: {
        where: {
          status: 'IN_STOCK',
        },
      },
    },
  });

  if (!program) {
    return {
      programId: programIdOrNumber,
      programNumber: programIdOrNumber,
      programSerialNo: programIdOrNumber,
      fabricName: 'Unknown',
      fabricColor: 'Unknown',
      fabricDyeingRequired: false,
      destinationDepartment: 'EMBROIDERY',
      requiredMeters: 0,
      requiredPieces: 0,
      requiredUnit: 'MTR',
      requiredQuantity: 0,
      inwardStockMeters: 0,
      inwardStockPcs: 0,
      inwardEntriesCount: 0,
      rollStockMeters: 0,
      rollCount: 0,
      totalStoreStockMeters: 0,
      totalStoreStockPcs: 0,
      fabricColorAvailable: 'OUT_OF_STOCK',
      fabricStoreVerified: false,
      isAvailable: false,
      canMoveToNextDepartment: false,
      statusLabel: 'OUT_OF_STOCK',
      message: 'Program record not found in system.',
    };
  }

  const fabricName = (program.fabricName || '').trim();
  const fabricColor = (program.fabricColor || '').trim();
  const isDyeingRequired = Boolean(program.fabricDyeingRequired);
  const destDept: 'DYEING' | 'EMBROIDERY' = isDyeingRequired ? 'DYEING' : 'EMBROIDERY';

  // Calculate required meters
  const targetPcs = Number(program.colorQuantity || program.targetQuantity || 0);
  const avg = Number(program.fabricAverage || 1.0);
  const requiredMeters = Math.round(targetPcs * (avg > 0 ? avg : 1.0) * 100) / 100;
  const requiredUnit: 'MTR' | 'PCS' = unitOverride ||
    (String(program.quantityMeasurement || '').toUpperCase() === 'PCS' ? 'PCS' : 'MTR');
  const requiredQuantity = requiredUnit === 'PCS' ? targetPcs : requiredMeters;

  // 1. Check FabricStoreRoll inventory
  // Rolls specifically assigned to this program OR matching fabric description
  const matchingRolls = await prisma.fabricStoreRoll.findMany({
    where: {
      status: 'IN_STOCK',
      OR: [
        { programIssuedToId: program.id },
        ...(fabricName
          ? [
              {
                batch: {
                  is: {
                    fabricDescription: { contains: fabricName, mode: 'insensitive' as const },
                  },
                },
              },
            ]
          : []),
      ],
    },
    select: {
      id: true,
      length: true,
      rollNumber: true,
    },
  });

  const rollStockMeters = matchingRolls.reduce(
    (sum, r) => sum + (Number(r.length) || 0),
    0
  );

  // 2. Fabric Store inward balance from the shared stock ledger (all programs' issues deducted).
  let inwardStockMeters = 0;
  let inwardStockPcs = 0;
  let inwardEntriesCount = 0;
  let matchingInwardEntryCount = 0;

  try {
    const ledger = await loadFabricStockLedger();
    const wanted = cleanFabricName(fabricName).toLowerCase();
    const matchingRows = Array.from(ledger.rows.values()).filter((row) => {
      if (!wanted) return true;
      const name = row.itemName.toLowerCase();
      return name.includes(wanted) || wanted.includes(name);
    });
    for (const row of matchingRows) {
      inwardEntriesCount += row.inwardCount;
      if (row.unit === requiredUnit) matchingInwardEntryCount += row.inwardCount;
      if (row.unit === 'MTR') inwardStockMeters += Math.max(0, row.rawBalance);
      else if (row.unit === 'PCS') inwardStockPcs += Math.max(0, row.rawBalance);
    }
  } catch (err) {
    console.warn('Error reading FabricInward balance:', err);
  }

  const totalStoreStockMeters = Math.round((rollStockMeters + inwardStockMeters) * 100) / 100;
  const totalStoreStockPcs = Math.round(inwardStockPcs * 100) / 100;
  const availableStock = requiredUnit === 'PCS' ? totalStoreStockPcs : totalStoreStockMeters;

  // 3. Parse Metadata for Store Incharge verification
  let meta: any = {};
  try {
    if (program.metadataJson) {
      meta = typeof program.metadataJson === 'string'
        ? JSON.parse(program.metadataJson)
        : program.metadataJson;
    }
  } catch {}

  const fabricStoreVerified = Boolean(meta?.fabricStoreVerified);
  const fabricColorAvailable = (program.fabricColorAvailable || 'AWAITING_RECEIPT').toUpperCase();

  // 4. Decision Logic:
  // If explicitly marked OUT_OF_STOCK or NO, it is BLOCKED.
  // Otherwise, it is available if:
  // - Physical stock > 0 in store (inward or rolls), OR
  // - Verified by Store Incharge (fabricStoreVerified = true), OR
  // - Explicitly marked IN_STOCK / AVAILABLE by Store with physical or verified receipt
  let isAvailable = false;
  let statusLabel: 'AVAILABLE' | 'OUT_OF_STOCK' | 'AWAITING_INWARD' = 'AWAITING_INWARD';
  let message = '';

  const isExplicitlyOutOfStock =
    fabricColorAvailable === 'OUT_OF_STOCK' ||
    fabricColorAvailable === 'NO' ||
    fabricColorAvailable === 'UNAVAILABLE' ||
    fabricColorAvailable === 'NOT_AVAILABLE';

  if (isExplicitlyOutOfStock) {
    isAvailable = false;
    statusLabel = 'OUT_OF_STOCK';
    message = `Fabric (${fabricName || 'Required Fabric'}) is marked OUT OF STOCK in Fabric Store. Production sheet cannot move to ${destDept} until fabric arrives.`;
  } else if (availableStock > 0) {
    isAvailable = true;
    statusLabel = 'AVAILABLE';
    message = `Fabric (${fabricName}) is IN STOCK in Fabric Store (${availableStock} ${requiredUnit} available). Production sheet is cleared to move to ${destDept}.`;
  } else if (fabricStoreVerified || fabricColorAvailable === 'VERIFIED_IN_STORE') {
    isAvailable = true;
    statusLabel = 'AVAILABLE';
    message = `Fabric availability verified by Fabric Store Incharge. Production sheet is cleared to move to ${destDept}.`;
  } else if (
    fabricColorAvailable === 'IN_STOCK' &&
    ((requiredUnit === 'MTR' && matchingRolls.length > 0) || matchingInwardEntryCount > 0)
  ) {
    isAvailable = true;
    statusLabel = 'AVAILABLE';
    message = `Fabric is available in Fabric Store. Production sheet is cleared to move to ${destDept}.`;
  } else {
    isAvailable = false;
    statusLabel = 'AWAITING_INWARD';
    message = `Fabric (${fabricName || 'fabric'}) is unavailable in Fabric Store (0 ${requiredUnit} on hand). Production sheet cannot move to ${destDept} until fabric is received and available in store.`;
  }

  return {
    programId: program.id,
    programNumber: program.programNumber,
    programSerialNo: program.programSerialNo || program.programNumber,
    clientName: program.clientName || program.buyerName || null,
    designNumber: program.designNumber || program.wilcomDesignNumber || null,
    styleCode: program.styleCode || null,
    fabricName: fabricName || 'Standard Fabric',
    fabricColor: fabricColor || 'Natural',
    fabricDyeingRequired: isDyeingRequired,
    destinationDepartment: destDept,
    requiredMeters,
    requiredPieces: targetPcs,
    requiredUnit,
    requiredQuantity,
    inwardStockMeters,
    inwardStockPcs,
    inwardEntriesCount,
    rollStockMeters,
    rollCount: matchingRolls.length,
    totalStoreStockMeters,
    totalStoreStockPcs,
    fabricColorAvailable: program.fabricColorAvailable || 'AWAITING_RECEIPT',
    fabricStoreVerified,
    fabricStoreVerifiedAt: meta?.fabricStoreVerifiedAt || null,
    fabricStoreVerifiedBy: meta?.fabricStoreVerifiedBy || null,
    isAvailable,
    canMoveToNextDepartment: isAvailable,
    statusLabel,
    message,
  };
}

/**
 * Updates fabric store verification status for a program.
 * Allows Fabric Store Incharge to mark fabric available or out of stock.
 */
export async function updateFabricStoreAvailability(
  programIdOrNumber: string,
  isAvailable: boolean,
  actorName: string = 'Fabric Store Incharge',
  remarks?: string
): Promise<FabricAvailabilityStatus> {
  const program = await prisma.program.findFirst({
    where: {
      OR: [
        { id: programIdOrNumber },
        { programNumber: programIdOrNumber },
        { programSerialNo: programIdOrNumber },
      ],
    },
    select: {
      id: true,
      metadataJson: true,
    },
  });

  if (!program) {
    throw new Error(`Program ${programIdOrNumber} not found.`);
  }

  let meta: any = {};
  try {
    if (program.metadataJson) {
      meta = typeof program.metadataJson === 'string'
        ? JSON.parse(program.metadataJson)
        : program.metadataJson;
    }
  } catch {}

  meta.fabricStoreVerified = isAvailable;
  meta.fabricStoreVerifiedAt = new Date().toISOString();
  meta.fabricStoreVerifiedBy = actorName;
  if (remarks) {
    meta.fabricStoreRemarks = remarks;
  }

  await prisma.program.update({
    where: { id: program.id },
    data: {
      fabricColorAvailable: isAvailable ? 'IN_STOCK' : 'OUT_OF_STOCK',
      metadataJson: JSON.stringify(meta),
    },
  });

  return checkFabricStoreAvailability(program.id);
}
