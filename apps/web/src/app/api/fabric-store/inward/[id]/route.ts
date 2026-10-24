import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { findNewlyNegativeRows, loadFabricStockLedger, lockFabricStoreStock, recordStockMovements, resolveStockActorId } from '@/lib/fabric-stock-ledger';
import { normalizeFabricStockType } from '@/lib/fabric-stock';

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

    const color = String(body.color || '').trim() || null;
    const normalizedType = entryType === 'KORA' ? 'UNDYED' : entryType;
    const actorId = await resolveStockActorId(request);

    const data = await prisma.$transaction(async (tx) => {
      await lockFabricStoreStock(tx);
      const previous = await tx.fabricInward.findUnique({ where: { id } });
      if (!previous) throw Object.assign(new Error('Inward record not found'), { code: 'P2025' });
      const ledgerBefore = await loadFabricStockLedger(tx);

      const updated = await tx.fabricInward.update({
        where: { id },
        data: {
          entryType: normalizedType,
          itemName,
          color,
          billNo,
          billDate,
          receivingDate,
          billQty,
          unit,
          supplierName: body.supplierName ? String(body.supplierName).trim() : null,
          remarks: body.remarks ? String(body.remarks).trim() : null,
        },
      });

      // Editing an inward entry must not leave already-issued challans without stock.
      const ledgerAfter = await loadFabricStockLedger(tx);
      const negativeRows = findNewlyNegativeRows(ledgerBefore, ledgerAfter);
      if (negativeRows.length > 0) {
        const detail = negativeRows
          .map((row) => `${row.itemName}${row.color ? ` / ${row.color}` : ''}: ${row.totalOutward} ${row.unit} already issued, only ${row.totalInward} ${row.unit} would remain inward`)
          .join('; ');
        throw Object.assign(new Error(`This change would make stock negative. ${detail}`), { code: 'STOCK_NEGATIVE' });
      }

      if (actorId) {
        const prevLine = { name: previous.itemName, type: normalizeFabricStockType(previous.entryType), color: previous.color || '', unit: previous.unit };
        const nextLine = { name: updated.itemName, type: normalizeFabricStockType(updated.entryType), color: updated.color || '', unit: updated.unit };
        await recordStockMovements(tx, ledgerAfter, actorId, [
          { entryType: 'ADJUSTMENT', line: prevLine, quantity: -previous.billQty, referenceType: 'FABRIC_INWARD_EDIT', referenceId: id, notes: `Reversed before edit (Bill ${previous.billNo})` },
          { entryType: 'ADJUSTMENT', line: nextLine, quantity: updated.billQty, referenceType: 'FABRIC_INWARD_EDIT', referenceId: id, notes: `Re-applied after edit (Bill ${updated.billNo})` },
        ]);
      }
      return updated;
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    if (error.code === 'STOCK_NEGATIVE') {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Inward record not found' }, { status: 404 });
    }
    console.error('Error updating inward fabric stock:', error);
    return NextResponse.json({ error: error.message || 'Failed to update inward stock' }, { status: 500 });
  }
}
