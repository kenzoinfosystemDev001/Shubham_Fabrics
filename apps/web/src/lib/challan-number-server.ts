import { NextResponse } from 'next/server';
import type { Prisma, PrismaClient } from '@subham/database';
import {
  duplicateChallanNumberMessage,
  validateChallanNumber,
  validateChallanNumberSet,
} from '@/lib/challan-number.mjs';

type Db = PrismaClient | Prisma.TransactionClient;

/** A rejected challan number. Routes turn it into a 400 (invalid) or 409 (duplicate) response. */
export class ChallanNumberError extends Error {
  constructor(message: string, readonly status: 400 | 409, readonly field = 'challanNumber') {
    super(message);
    this.name = 'ChallanNumberError';
  }
}

/** The typed number, validated; throws ChallanNumberError when it is empty or unprintable. */
export function requireChallanNumber(raw: unknown, label = 'Challan Number', field = 'challanNumber'): string {
  const result = validateChallanNumber(raw, label);
  if (!result.ok) throw new ChallanNumberError(result.error, 400, field);
  return result.value;
}

/** Several typed numbers created by one request; all required and distinct. */
export function requireChallanNumberSet(
  entries: Array<{ field: string; label: string; value: unknown }>,
): Record<string, string> {
  const result = validateChallanNumberSet(entries);
  if (!result.ok) throw new ChallanNumberError(result.error, 400, result.field);
  return result.values;
}

/**
 * Rejects numbers already used by any challan, ignoring letter case. The unique index on
 * Challan.challanNumber still guards the race between two concurrent requests.
 */
export async function assertChallanNumbersAvailable(
  db: Db,
  values: Array<{ value: string; field?: string }>,
): Promise<void> {
  for (const { value, field } of values) {
    const existing = await db.challan.findFirst({
      where: { challanNumber: { equals: value, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) throw new ChallanNumberError(duplicateChallanNumberMessage(value), 409, field);
  }
}

export function isDuplicateChallanNumberError(error: unknown): boolean {
  const err = error as { code?: string; meta?: { target?: unknown } } | null;
  if (err?.code !== 'P2002') return false;
  const target = err.meta?.target;
  return Array.isArray(target)
    ? target.includes('challanNumber')
    : String(target || '').includes('challanNumber');
}

/** JSON response for challan-number failures, or null when `error` is something else. */
export function challanNumberErrorResponse(error: unknown, attempted?: string): NextResponse | null {
  if (error instanceof ChallanNumberError) {
    return NextResponse.json({ error: error.message, field: error.field }, { status: error.status });
  }
  if (isDuplicateChallanNumberError(error)) {
    return NextResponse.json(
      {
        error: attempted
          ? duplicateChallanNumberMessage(attempted)
          : 'That Challan Number is already used by another challan. Enter a different number.',
        field: 'challanNumber',
      },
      { status: 409 },
    );
  }
  return null;
}
