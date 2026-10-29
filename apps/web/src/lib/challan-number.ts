import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';

/**
 * Challan numbers are entered manually by the issuing department.
 * The server never generates or rewrites them; it only validates that the
 * number is present and not already used by another challan (the Challan
 * table enforces global uniqueness on challanNumber).
 */

export const CHALLAN_NUMBER_MAX_LENGTH = 64;

type ChallanLookup = Pick<typeof prisma, 'challan'>;

export type ChallanNumberCheck =
  | { ok: true; challanNumber: string }
  | { ok: false; status: 400 | 409; error: string };

export function normalizeChallanNumber(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  return String(raw).trim();
}

export async function validateManualChallanNumber(
  raw: unknown,
  label = 'Challan Number',
  db: ChallanLookup = prisma
): Promise<ChallanNumberCheck> {
  const challanNumber = normalizeChallanNumber(raw);
  if (!challanNumber) {
    return { ok: false, status: 400, error: `${label} is required. Enter the challan number manually.` };
  }
  if (challanNumber.length > CHALLAN_NUMBER_MAX_LENGTH) {
    return {
      ok: false,
      status: 400,
      error: `${label} must be ${CHALLAN_NUMBER_MAX_LENGTH} characters or fewer.`,
    };
  }

  // Case-insensitive so "ch-101" cannot be issued next to "CH-101".
  const existing = await db.challan.findFirst({
    where: { challanNumber: { equals: challanNumber, mode: 'insensitive' } },
    select: { challanNumber: true },
  });
  if (existing) {
    return {
      ok: false,
      status: 409,
      error: `${label} "${existing.challanNumber}" already exists. Enter a different challan number.`,
    };
  }

  return { ok: true, challanNumber };
}

/** Validates several numbers issued by one action (e.g. QC pass + rework challans). */
export async function validateManualChallanNumbers(
  entries: Array<{ value: unknown; label: string }>,
  db: ChallanLookup = prisma
): Promise<{ ok: true; challanNumbers: string[] } | { ok: false; status: 400 | 409; error: string }> {
  const challanNumbers: string[] = [];
  for (const entry of entries) {
    const check = await validateManualChallanNumber(entry.value, entry.label, db);
    if (!check.ok) return check;
    if (challanNumbers.some((n) => n.toLowerCase() === check.challanNumber.toLowerCase())) {
      return { ok: false, status: 400, error: `${entry.label} must be different from the other challan number entered.` };
    }
    challanNumbers.push(check.challanNumber);
  }
  return { ok: true, challanNumbers };
}

export function challanNumberErrorResponse(check: { status: 400 | 409; error: string }) {
  return NextResponse.json(
    { error: check.error, field: 'challanNumber', code: check.status === 409 ? 'DUPLICATE_CHALLAN_NUMBER' : 'CHALLAN_NUMBER_REQUIRED' },
    { status: check.status }
  );
}

/** True when a Prisma unique-constraint error was raised by Challan.challanNumber (concurrent submit). */
export function isDuplicateChallanNumberError(error: unknown): boolean {
  const err = error as { code?: string; meta?: { target?: unknown } } | null;
  if (!err || err.code !== 'P2002') return false;
  const target = err.meta?.target;
  return Array.isArray(target)
    ? target.some((t) => String(t).includes('challanNumber'))
    : String(target ?? '').includes('challanNumber');
}

export function duplicateChallanNumberResponse(challanNumber?: string) {
  return challanNumberErrorResponse({
    status: 409,
    error: `Challan Number${challanNumber ? ` "${challanNumber}"` : ''} already exists. It may have just been submitted — check the challan list before retrying.`,
  });
}
