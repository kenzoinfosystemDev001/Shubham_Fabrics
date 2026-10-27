import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';
import {
  FabricStockError,
  STOCK_TRANSACTION_OPTIONS,
  fabricStockErrorBody,
  syncInwardStock,
} from '@/lib/fabric-stock-ledger';
import { FIELD_LABELS, inwardLineDetails } from '@/lib/stock-import-rules.mjs';
import { apiErrorResponse } from '@/lib/api-errors';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'STORE');
  if (!authUser) return authResponse;
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
    const { details, problems } = inwardLineDetails(body);
    if (problems.length) {
      const names = problems.map((field) => FIELD_LABELS[field as keyof typeof FIELD_LABELS]).join(', ');
      return NextResponse.json({ error: `${names} must be a number of zero or more (tax at most 100)` }, { status: 400 });
    }

    // The ledger posts only the difference; a reduction below what was already issued is refused.
    const data = await prisma.$transaction(async (tx) => {
      const row = await tx.fabricInward.update({
      where: { id },
      data: {
        entryType: entryType === 'KORA' ? 'UNDYED' : entryType,
        itemName,
        billNo,
        billDate,
        receivingDate,
        billQty,
        unit,
        colour: body.colour ? String(body.colour).trim() : null,
        supplierName: body.supplierName ? String(body.supplierName).trim() : null,
        billerStateCity: body.billerStateCity ? String(body.billerStateCity).trim() : null,
        ...details,
        remarks: body.remarks ? String(body.remarks).trim() : null,
      },
      });
      await syncInwardStock(tx, id, authUser.id);
      return row;
    }, STOCK_TRANSACTION_OPTIONS);

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    if (error instanceof FabricStockError) {
      return NextResponse.json(fabricStockErrorBody(error), { status: 400 });
    }
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Inward record not found' }, { status: 404 });
    }
    return apiErrorResponse(error, error.message || 'Failed to update inward stock', 'Error updating inward fabric stock:');
  }
}
