import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/api-errors';

/** Program fields every Dyeing screen shows (Production Sheet, design, serial, deadline). */
export const DYEING_PROGRAM_SELECT = {
  id: true,
  programNumber: true,
  programSerialNo: true,
  designNumber: true,
  wilcomDesignNumber: true,
  clientName: true,
  buyerName: true,
  styleCode: true,
  mainStyle: true,
  fabricName: true,
  fabricColor: true,
  deliveryDate: true,
  priority: true,
  status: true,
  quantityMeasurement: true,
} as const;

export const USER_NAME_SELECT = { id: true, fullName: true, username: true } as const;

/** Everything the Dyeing screens need about one order, including its QC transfers. */
export const DYEING_ORDER_INCLUDE = {
  program: { select: DYEING_PROGRAM_SELECT },
  inboundChallan: {
    select: {
      id: true,
      challanNumber: true,
      challanType: true,
      fromDepartment: true,
      toDepartment: true,
      status: true,
      priority: true,
      issuedDate: true,
      receivedDate: true,
      remarks: true,
      // Base (current) colour of each line, before dyeing.
      items: { select: { id: true, colour: true, shade: true, width: true } },
    },
  },
  qcTransfers: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      challan: { select: { id: true, challanNumber: true, status: true, issuedDate: true } },
      createdBy: { select: USER_NAME_SELECT },
    },
  },
  receivedBy: { select: USER_NAME_SELECT },
  colorReviewedBy: { select: USER_NAME_SELECT },
  incharge: { select: USER_NAME_SELECT },
};

/** Thrown inside a transaction to abort it with a specific HTTP response. */
export class DyeingRequestError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = 'DyeingRequestError';
  }
}

/** Request errors keep their message; database setup problems explain themselves (see api-errors). */
export function dyeingErrorResponse(error: unknown, fallback: string) {
  if (error instanceof DyeingRequestError) return NextResponse.json({ error: error.message }, { status: error.status });
  return apiErrorResponse(error, fallback);
}

export function parseOptionalDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export const TX_OPTIONS = { maxWait: 15000, timeout: 30000 };
