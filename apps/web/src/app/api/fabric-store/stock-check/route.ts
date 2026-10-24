import { NextResponse } from 'next/server';
import { challanItemStockLine } from '@/lib/fabric-stock';
import { loadFabricStockLedger } from '@/lib/fabric-stock-ledger';

export const dynamic = 'force-dynamic';

// POST /api/fabric-store/stock-check
// Read-only preview of the balance each draft challan line would draw from, using the
// same fabric + type + colour + unit matching the challan API applies when issuing.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const toDepartment = String(body.toDepartment || '').toUpperCase();
    const lines: any[] = Array.isArray(body.lines) ? body.lines : [];
    if (!toDepartment) {
      return NextResponse.json({ error: 'toDepartment is required' }, { status: 400 });
    }

    const ledger = await loadFabricStockLedger();
    const resolved = lines.map((line) => {
      const stockLine = challanItemStockLine(
        {
          fabricCode: String(line.fabric || '').trim() || null,
          colour: String(line.color || '').trim() || null,
          uom: String(line.unit || 'MTR').toUpperCase(),
          remarks: line.fabricProcessingStatus ? `Status: ${line.fabricProcessingStatus}` : null,
        },
        toDepartment
      );
      return { stockLine, key: ledger.resolveKey(stockLine), quantity: Number(line.quantity) || 0 };
    });

    const requestedByKey = new Map<string, number>();
    for (const r of resolved) requestedByKey.set(r.key, (requestedByKey.get(r.key) || 0) + Math.max(0, r.quantity));

    return NextResponse.json({
      success: true,
      data: resolved.map((r) => {
        const row = ledger.rows.get(r.key);
        const available = Math.max(0, row?.rawBalance ?? 0);
        const requestedTotal = requestedByKey.get(r.key) || 0;
        return {
          itemName: row?.itemName || r.stockLine.name,
          color: row ? row.color : r.stockLine.color,
          unit: r.stockLine.unit,
          fabricType: r.stockLine.type,
          matchedStock: Boolean(row && row.inwardCount > 0),
          available,
          requestedTotal,
          sufficient: requestedTotal <= available + 1e-9,
        };
      }),
    });
  } catch (error: any) {
    console.error('Error checking Fabric Store line stock:', error);
    return NextResponse.json({ error: error.message || 'Failed to check stock' }, { status: 500 });
  }
}
