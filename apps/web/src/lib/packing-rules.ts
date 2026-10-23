export class PackingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PackingValidationError';
  }
}

export function parseWholeNumber(value: unknown, label: string): number {
  const num = typeof value === 'string' ? Number(value.trim()) : Number(value);
  if (!Number.isFinite(num) || !Number.isSafeInteger(num) || num < 0) {
    throw new PackingValidationError(`${label} must be a valid non-negative whole integer.`);
  }
  return num;
}

export function calculateRemainingToPack(
  receivedQuantity: number,
  previouslyPacked: number
): number {
  const r = parseWholeNumber(receivedQuantity, 'Received quantity');
  const p = parseWholeNumber(previouslyPacked, 'Previously packed quantity');
  return Math.max(0, r - p);
}

export interface PackingCartonInput {
  cartonNumber?: string;
  size: string;
  colour: string;
  quantity: number;
  grossWeightKg?: number;
  netWeightKg?: number;
  locationRack?: string;
  locationShelf?: string;
  barcode?: string;
}

export function validatePackingOperation(params: {
  eligibleQuantity: number;
  packingQuantity: number;
  previouslyPacked?: number;
  cartons?: PackingCartonInput[];
}): {
  isValid: boolean;
  totalPacked: number;
  remainingQuantity: number;
  error?: string;
} {
  try {
    const eligible = parseWholeNumber(params.eligibleQuantity, 'Eligible quantity');
    const packing = parseWholeNumber(params.packingQuantity, 'Packing quantity');
    const prev = parseWholeNumber(params.previouslyPacked ?? 0, 'Previously packed quantity');

    if (packing <= 0) {
      return {
        isValid: false,
        totalPacked: prev,
        remainingQuantity: eligible - prev,
        error: 'Packing quantity must be greater than zero.',
      };
    }

    const availableToPack = Math.max(0, eligible - prev);

    if (packing > availableToPack) {
      return {
        isValid: false,
        totalPacked: prev,
        remainingQuantity: availableToPack,
        error: `Cannot pack ${packing} pieces. Only ${availableToPack} pieces are available to pack (Received: ${eligible}, Already Packed: ${prev}).`,
      };
    }

    if (params.cartons && params.cartons.length > 0) {
      const cartonPieces = params.cartons.reduce((sum, c) => {
        const q = parseWholeNumber(c.quantity, 'Carton piece count');
        if (q <= 0) {
          throw new PackingValidationError('Each carton must contain at least 1 piece.');
        }
        return sum + q;
      }, 0);

      if (cartonPieces !== packing) {
        return {
          isValid: false,
          totalPacked: prev,
          remainingQuantity: availableToPack,
          error: `Carton piece total (${cartonPieces}) does not match declared packing quantity (${packing}).`,
        };
      }
    }

    const newTotalPacked = prev + packing;
    const remaining = eligible - newTotalPacked;

    return {
      isValid: true,
      totalPacked: newTotalPacked,
      remainingQuantity: remaining,
    };
  } catch (err: any) {
    return {
      isValid: false,
      totalPacked: 0,
      remainingQuantity: 0,
      error: err.message || 'Validation error during packing calculation.',
    };
  }
}
