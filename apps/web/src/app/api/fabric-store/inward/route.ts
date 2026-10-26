import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';
import {
  FabricStockError,
  STOCK_TRANSACTION_OPTIONS,
  fabricStockErrorBody,
  syncInwardStock,
} from '@/lib/fabric-stock-ledger';
import { normalizeStockUnit } from '@/lib/fabric-stock';

export const dynamic = 'force-dynamic';

// GET /api/fabric-store/inward - list all inward fabric stock entries
export async function GET(request: Request) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'STORE');
  if (!authUser) return authResponse;
  try {
    const { searchParams } = new URL(request.url);
    const rawType = searchParams.get('entryType')?.toUpperCase();
    const search = searchParams.get('search');

    const where: any = {};
    if (rawType && rawType !== 'ALL') {
      if (rawType === 'UNDYED' || rawType === 'KORA') {
        where.entryType = { in: ['UNDYED', 'KORA'] };
      } else {
        where.entryType = rawType;
      }
    }
    if (search) {
      where.OR = [
        { itemName: { contains: search, mode: 'insensitive' } },
        { billNo: { contains: search, mode: 'insensitive' } },
        { colour: { contains: search, mode: 'insensitive' } },
        { supplierName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const inwardList = await prisma.fabricInward.findMany({
      where,
      orderBy: [{ receivingDate: 'desc' }, { createdAt: 'desc' }],
    });

    const summary = {
      totalEntries: inwardList.length,
      totalMeters: inwardList
        .filter((item: any) => item.unit === 'MTR')
        .reduce((sum: number, item: any) => sum + (Number(item.billQty) || 0), 0),
      totalPcs: inwardList
        .filter((item: any) => item.unit === 'PCS')
        .reduce((sum: number, item: any) => sum + (Number(item.billQty) || 0), 0),
      undyedMeters: inwardList
        .filter((item: any) => (item.entryType === 'UNDYED' || item.entryType === 'KORA') && item.unit === 'MTR')
        .reduce((sum: number, item: any) => sum + (Number(item.billQty) || 0), 0),
      koraMeters: inwardList
        .filter((item: any) => (item.entryType === 'UNDYED' || item.entryType === 'KORA') && item.unit === 'MTR')
        .reduce((sum: number, item: any) => sum + (Number(item.billQty) || 0), 0),
      dyedMeters: inwardList
        .filter((item: any) => item.entryType === 'DYED' && item.unit === 'MTR')
        .reduce((sum: number, item: any) => sum + (Number(item.billQty) || 0), 0),
    };

    return NextResponse.json({
      data: inwardList,
      summary,
    });
  } catch (error: any) {
    console.error('Error fetching inward stock:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch inward stock' }, { status: 500 });
  }
}

// POST /api/fabric-store/inward - record a fabric arrival. One bill may carry several lines,
// each with its own fabric, colour, quantity and unit (MTR or PCS, never converted).
export async function POST(request: Request) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'STORE');
  if (!authUser) return authResponse;
  try {
    const body = await request.json();
    const { entryType, billNo, billDate, receivingDate, supplierName, remarks } = body;

    if (!entryType || !billNo || !billDate || !receivingDate) {
      return NextResponse.json(
        { error: 'entryType, billNo, billDate and receivingDate are required' },
        { status: 400 }
      );
    }

    const normalizedEntryType = String(entryType).toUpperCase();
    if (!['UNDYED', 'KORA', 'DYED'].includes(normalizedEntryType)) {
      return NextResponse.json({ error: 'entryType must be UNDYED, KORA, or DYED' }, { status: 400 });
    }
    const normalizedType = normalizedEntryType === 'DYED' ? 'DYED' : 'UNDYED';

    const parsedBillDate = new Date(billDate);
    const parsedReceivingDate = new Date(receivingDate);
    if (Number.isNaN(parsedBillDate.getTime()) || Number.isNaN(parsedReceivingDate.getTime())) {
      return NextResponse.json({ error: 'Bill date and receiving date must be valid dates' }, { status: 400 });
    }

    // Older clients send one line as top-level fields.
    const rawLines: any[] = Array.isArray(body.lines)
      ? body.lines
      : [{ itemName: body.itemName, colour: body.colour, billQty: body.billQty, unit: body.unit ?? 'MTR' }];
    if (rawLines.length === 0) {
      return NextResponse.json({ error: 'Add at least one fabric line' }, { status: 400 });
    }

    const lines: Array<{ itemName: string; colour: string | null; billQty: number; unit: string }> = [];
    for (const [index, line] of rawLines.entries()) {
      const itemName = String(line?.itemName || '').trim();
      const qty = Number(line?.billQty);
      const unit = normalizeStockUnit(line?.unit ?? 'MTR');
      if (!itemName) {
        return NextResponse.json({ error: `Line ${index + 1}: item name is required` }, { status: 400 });
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        return NextResponse.json({ error: `Line ${index + 1}: quantity must be a positive number` }, { status: 400 });
      }
      if (!unit) {
        return NextResponse.json({ error: `Line ${index + 1}: unit must be MTR or PCS` }, { status: 400 });
      }
      lines.push({ itemName, colour: String(line?.colour || '').trim() || null, billQty: qty, unit });
    }

    const created = await prisma.$transaction(async (tx) => {
      const rows = [];
      for (const line of lines) {
        const inward = await tx.fabricInward.create({
          data: {
            entryType: normalizedType,
            itemName: line.itemName,
            colour: line.colour,
            billNo: String(billNo).trim(),
            billDate: parsedBillDate,
            receivingDate: parsedReceivingDate,
            billQty: line.billQty,
            unit: line.unit,
            supplierName: supplierName ? String(supplierName).trim() : null,
            remarks: remarks ? String(remarks).trim() : null,
          },
        });
        await syncInwardStock(tx, inward.id, authUser.id);
        rows.push(inward);
      }
      return rows;
    }, STOCK_TRANSACTION_OPTIONS);

    return NextResponse.json({ success: true, data: created.length === 1 ? created[0] : created, lines: created }, { status: 201 });
  } catch (error: any) {
    if (error instanceof FabricStockError) {
      return NextResponse.json(fabricStockErrorBody(error), { status: 400 });
    }
    console.error('Error creating inward fabric stock:', error);
    return NextResponse.json({ error: error.message || 'Failed to create inward stock' }, { status: 500 });
  }
}
