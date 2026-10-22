import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

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
        { billNo: { contains: search, mode: 'insensitive' } },
        { supplierName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const inwardList = await (prisma as any).fabricInward.findMany({
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

// POST /api/fabric-store/inward - record new fabric arrival in store
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      entryType,
      itemName,
      billNo,
      billDate,
      receivingDate,
      billQty,
      unit = 'MTR',
      supplierName,
      remarks,
    } = body;

    if (!entryType || !itemName || !billNo || !billDate || !receivingDate || billQty === undefined) {
      return NextResponse.json(
        { error: 'entryType, itemName, billNo, billDate, receivingDate, and billQty are required' },
        { status: 400 }
      );
    }

    const qty = parseFloat(billQty);
    if (isNaN(qty) || qty <= 0) {
      return NextResponse.json({ error: 'billQty must be a positive number' }, { status: 400 });
    }

    const normalizedType =
      String(entryType).toUpperCase() === 'KORA' || String(entryType).toUpperCase() === 'UNDYED'
        ? 'UNDYED'
        : 'DYED';

    const inward = await (prisma as any).fabricInward.create({
      data: {
        entryType: normalizedType,
        itemName: String(itemName).trim(),
        billNo: String(billNo).trim(),
        billDate: new Date(billDate),
        receivingDate: new Date(receivingDate),
        billQty: qty,
        unit: unit.toUpperCase() === 'PCS' ? 'PCS' : 'MTR',
        supplierName: supplierName ? String(supplierName).trim() : null,
        remarks: remarks ? String(remarks).trim() : null,
      },
    });

    return NextResponse.json({ success: true, data: inward }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating inward fabric stock:', error);
    return NextResponse.json({ error: error.message || 'Failed to create inward stock' }, { status: 500 });
  }
}
