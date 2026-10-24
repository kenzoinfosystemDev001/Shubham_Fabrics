import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { parseDateRange, parsePage, requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

// GET /api/admin/stock-movements?q=&type=RECEIPT|ISSUE|ADJUSTMENT&unit=MTR|PCS&color=&from=&to=&page=
// The Fabric Store stock ledger: every receipt, issue and reversal with its balance afterwards.
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.actor) return auth.response;
  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip } = parsePage(searchParams);
    const and: any[] = [];
    const q = searchParams.get('q')?.trim();
    if (q) {
      and.push({ OR: [
        { itemName: { contains: q, mode: 'insensitive' } },
        { itemCode: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
        { referenceId: q },
      ] });
    }
    const type = searchParams.get('type')?.trim().toUpperCase();
    if (type) and.push({ entryType: type });
    const unit = searchParams.get('unit')?.trim().toUpperCase();
    if (unit) and.push({ uom: unit });
    const color = searchParams.get('color')?.trim();
    if (color) and.push({ colour: { contains: color, mode: 'insensitive' } });
    const created = parseDateRange(searchParams);
    if (created) and.push({ createdAt: created });
    const where = and.length > 0 ? { AND: and } : {};

    const [total, rows] = await Promise.all([
      prisma.stockLedgerEntry.count({ where }),
      prisma.stockLedgerEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          actor: { select: { fullName: true } },
          program: { select: { id: true, programSerialNo: true, programNumber: true } },
        },
      }),
    ]);

    return NextResponse.json({ success: true, data: rows, page, pageSize, total });
  } catch (error: any) {
    console.error('Error loading stock movements:', error);
    return NextResponse.json({ error: 'Failed to load stock movements' }, { status: 500 });
  }
}
