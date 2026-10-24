import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { loadFabricStockLedger, lockFabricStoreStock, recordStockMovements, resolveStockActorId } from '@/lib/fabric-stock-ledger';
import { normalizeFabricStockType } from '@/lib/fabric-stock';

export const dynamic = 'force-dynamic';

// GET /api/fabric-store/inward - list all inward fabric stock entries
export async function GET(request: Request) {
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
        { color: { contains: search, mode: 'insensitive' } },
        { billNo: { contains: search, mode: 'insensitive' } },
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
      undyedPcs: inwardList
        .filter((item: any) => (item.entryType === 'UNDYED' || item.entryType === 'KORA') && item.unit === 'PCS')
        .reduce((sum: number, item: any) => sum + (Number(item.billQty) || 0), 0),
      dyedPcs: inwardList
        .filter((item: any) => item.entryType === 'DYED' && item.unit === 'PCS')
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

// POST /api/fabric-store/inward - record new fabric arrival in store.
// Accepts either a single line (legacy body) or `items: [...]` so one bill can
// carry several fabrics / colours / units. Every line keeps its own unit.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { billNo, billDate, receivingDate, supplierName, remarks } = body;

    const rawLines: any[] = Array.isArray(body.items) && body.items.length > 0
      ? body.items
      : [{ entryType: body.entryType, itemName: body.itemName, color: body.color, billQty: body.billQty, unit: body.unit, remarks }];

    if (!billNo || !billDate || !receivingDate) {
      return NextResponse.json(
        { error: 'billNo, billDate, and receivingDate are required' },
        { status: 400 }
      );
    }
    const parsedBillDate = new Date(billDate);
    const parsedReceivingDate = new Date(receivingDate);
    if (Number.isNaN(parsedBillDate.getTime()) || Number.isNaN(parsedReceivingDate.getTime())) {
      return NextResponse.json({ error: 'Bill date and receiving date must be valid dates' }, { status: 400 });
    }

    const lines: Array<{ entryType: 'UNDYED' | 'DYED'; itemName: string; color: string | null; billQty: number; unit: 'MTR' | 'PCS'; remarks: string | null }> = [];
    for (const [index, line] of rawLines.entries()) {
      const label = rawLines.length > 1 ? `Line ${index + 1}: ` : '';
      const entryType = String(line?.entryType ?? body.entryType ?? '').toUpperCase();
      const itemName = String(line?.itemName || '').trim();
      if (!entryType || !itemName || line?.billQty === undefined || line?.billQty === '') {
        return NextResponse.json(
          { error: `${label}entryType, itemName, and billQty are required` },
          { status: 400 }
        );
      }
      const qty = parseFloat(line.billQty);
      if (isNaN(qty) || qty <= 0) {
        return NextResponse.json({ error: `${label}billQty must be a positive number` }, { status: 400 });
      }
      const normalizedUnit = String(line.unit || 'MTR').toUpperCase();
      if (!['MTR', 'PCS'].includes(normalizedUnit)) {
        return NextResponse.json({ error: `${label}unit must be MTR or PCS` }, { status: 400 });
      }
      if (!['UNDYED', 'KORA', 'DYED'].includes(entryType)) {
        return NextResponse.json({ error: `${label}entryType must be UNDYED, KORA, or DYED` }, { status: 400 });
      }
      lines.push({
        entryType: entryType === 'KORA' || entryType === 'UNDYED' ? 'UNDYED' : 'DYED',
        itemName,
        color: String(line.color || '').trim() || null,
        billQty: qty,
        unit: normalizedUnit as 'MTR' | 'PCS',
        remarks: line.remarks ? String(line.remarks).trim() : remarks ? String(remarks).trim() : null,
      });
    }

    const actorId = await resolveStockActorId(request);

    const created = await prisma.$transaction(async (tx) => {
      await lockFabricStoreStock(tx);
      const rows = [];
      for (const line of lines) {
        rows.push(await tx.fabricInward.create({
          data: {
            ...line,
            billNo: String(billNo).trim(),
            billDate: parsedBillDate,
            receivingDate: parsedReceivingDate,
            supplierName: supplierName ? String(supplierName).trim() : null,
          },
        }));
      }
      if (actorId) {
        const ledgerAfter = await loadFabricStockLedger(tx);
        await recordStockMovements(tx, ledgerAfter, actorId, rows.map((row) => ({
          entryType: 'RECEIPT' as const,
          line: { name: row.itemName, type: normalizeFabricStockType(row.entryType), color: row.color || '', unit: row.unit },
          quantity: row.billQty,
          referenceType: 'FABRIC_INWARD',
          referenceId: row.id,
          notes: `Bill ${row.billNo}`,
        })));
      }
      return rows;
    });

    return NextResponse.json(
      { success: true, data: created.length === 1 ? created[0] : created, items: created },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating inward fabric stock:', error);
    return NextResponse.json({ error: error.message || 'Failed to create inward stock' }, { status: 500 });
  }
}
