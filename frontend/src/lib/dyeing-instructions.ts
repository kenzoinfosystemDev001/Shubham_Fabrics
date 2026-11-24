/** Shown when an inbound line carries no separately stored dyeing colour (older challans). */
export const NOT_SPECIFIED_DYE_COLOR = 'Not specified on challan';

export interface InboundChallanLine {
  id: string;
  fabricCode?: string | null;
  itemDescription?: string | null;
  colour?: string | null;
  requiredDyeColor?: string | null;
  requiredDyeQuantity?: number | null;
  quantity: number;
  uom: string;
}

export interface DyeingOrderLine {
  inboundChallanItemId: string | null;
  fabricName: string;
  currentColor: string | null;
  targetColor: string;
  requiredQuantity: number;
  uom: string;
}

/**
 * Maps one incoming challan line to the dyeing work it represents. The required dyeing
 * colour is the instruction; the current fabric shade is kept separately and is never
 * used in its place. A line without a stored instruction is marked as such, not guessed.
 */
export function dyeingOrderLine(
  item: InboundChallanLine | null,
  challan: {
    fabricUnit?: string | null;
    program?: {
      fabricName?: string | null;
      quantityMeasurement?: string | null;
      fabricIssuedToDyeing?: number | null;
      fabricSentToDyeing?: number | null;
      targetQuantity?: number | null;
    } | null;
  },
  reworkTargetColor: string | null = null
): DyeingOrderLine {
  const issuedQty = Number(item?.quantity) || 0;
  const requiredQuantity = item
    ? Number(item.requiredDyeQuantity ?? issuedQty) || issuedQty
    : Number(
      challan.program?.fabricIssuedToDyeing ||
      challan.program?.fabricSentToDyeing ||
      challan.program?.targetQuantity ||
      0,
    );

  return {
    inboundChallanItemId: item?.id || null,
    fabricName: item?.fabricCode || item?.itemDescription || challan.program?.fabricName || 'Fabric',
    currentColor: item?.colour || null,
    targetColor: item?.requiredDyeColor || reworkTargetColor || NOT_SPECIFIED_DYE_COLOR,
    requiredQuantity,
    uom: item?.uom || challan.fabricUnit || challan.program?.quantityMeasurement || 'MTR',
  };
}
