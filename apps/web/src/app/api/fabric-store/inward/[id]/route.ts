import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'A valid inward record is required' }, { status: 400 });
    }

    const entryType = String(body.entryType || '').toUpperCase();
    const itemName = String(body.itemName || '').trim();
    const billNo = String(body.billNo || '').trim();
    const billDate = new Date(body.billDate);
    const receivingDate = new Date(body.receivingDate);
    const billQty = Number(body.billQty);
    const unit = String(body.unit || 'MTR').toUpperCase();

    if (!itemName || !billNo || !body.billDate || !body.receivingDate) {
      return NextResponse.json(
        { error: 'Item name, bill number, bill date, and receiving date are required' },
        { status: 400 }
      );
    }

    if (!['UNDYED', 'KORA', 'DYED'].includes(entryType)) {
      return NextResponse.json({ error: 'entryType must be UNDYED, KORA, or DYED' }, { status: 400 });
    }
    if (Number.isNaN(billDate.getTime()) || Number.isNaN(receivingDate.getTime())) {
      return NextResponse.json({ error: 'Bill date and receiving date must be valid dates' }, { status: 400 });
    }
    if (!Number.isFinite(billQty) || billQty <= 0) {
      return NextResponse.json({ error: 'billQty must be a positive number' }, { status: 400 });
    }
    if (!['MTR', 'PCS'].includes(unit)) {
      return NextResponse.json({ error: 'unit must be MTR or PCS' }, { status: 400 });
    }

    const data = await (prisma as any).fabricInward.update({
      where: { id },
      data: {
        entryType: entryType === 'KORA' ? 'UNDYED' : entryType,
        itemName,
        billNo,
        billDate,
        receivingDate,
        billQty,
        unit,
        supplierName: body.supplierName ? String(body.supplierName).trim() : null,
        remarks: body.remarks ? String(body.remarks).trim() : null,
      },
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Inward record not found' }, { status: 404 });
    }
    console.error('Error updating inward fabric stock:', error);
    return NextResponse.json({ error: error.message || 'Failed to update inward stock' }, { status: 500 });
  }
}
