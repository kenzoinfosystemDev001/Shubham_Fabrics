import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Challan numbers are entered manually by the issuing department, so the system
 * no longer suggests or pre-fills them. Kept only to give older clients a clear answer.
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Challan numbers are entered manually. Automatic challan numbers are no longer issued.', nextNumber: null },
    { status: 410 }
  );
}
