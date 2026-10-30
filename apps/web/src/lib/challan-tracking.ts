interface DepartmentTrackingBody {
  fabricIn?: number | string | null;
  fabricUnit?: string | null;
  defectivePieces?: number | string | null;
  defectiveShelfLocation?: string | null;
  defectReason?: string | null;
  detectedFromChallanId?: string | null;
  detectedFromDepartment?: string | null;
  detectedFromDept?: string | null;
}

export function buildDepartmentTrackingData(
  body: DepartmentTrackingBody,
  outgoingQuantity: number,
  incomingFallback: number,
  parentChallanId: string,
  parentDepartment: string | null
) {
  const fabricIn = body.fabricIn == null ? incomingFallback : Number(body.fabricIn);
  const defectivePieces = body.defectivePieces == null ? 0 : Number(body.defectivePieces);
  // Never assumed: a missing unit fails the MTR/PCS check below.
  const fabricUnit = body.fabricUnit || '';

  if (!Number.isFinite(fabricIn) || fabricIn < 0) {
    return { error: 'Fabric in quantity must be a non-negative number.' } as const;
  }
  if (!Number.isFinite(defectivePieces) || defectivePieces < 0 || defectivePieces > fabricIn) {
    return { error: 'Defective quantity must be between zero and the fabric in quantity.' } as const;
  }
  if (fabricUnit !== 'MTR' && fabricUnit !== 'PCS') {
    return { error: 'Select MTR or PCS for the fabric quantity.' } as const;
  }
  if (outgoingQuantity + defectivePieces > fabricIn) {
    return { error: 'Outgoing quantity plus defective quantity cannot exceed the fabric in quantity.' } as const;
  }

  return {
    data: {
      fabricIn,
      fabricOut: outgoingQuantity,
      fabricUnit,
      defectiveUnit: defectivePieces > 0 ? fabricUnit : null,
      defectivePieces,
      defectiveShelfLocation: body.defectiveShelfLocation || null,
      defectReason: body.defectReason || null,
      detectedFromChallanId: body.detectedFromChallanId || parentChallanId,
      detectedFromDepartment:
        body.detectedFromDepartment || body.detectedFromDept || parentDepartment,
    },
  } as const;
}
