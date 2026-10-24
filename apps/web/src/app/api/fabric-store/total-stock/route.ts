import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { loadFabricStockLedger } from '@/lib/fabric-stock-ledger';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filterType = searchParams.get('type')?.toUpperCase(); // "UNDYED" | "KORA" | "DYED" | "ALL"
    const search = searchParams.get('search');

    // 1. Inward minus Fabric Store challans and manual outward, per fabric + type + colour + unit.
    const ledger = await loadFabricStockLedger();

    // 2. Fetch Store shelf defect records and defective-return challans.
    const defectiveRecords = await prisma.defectRecord.findMany({
      where: {
        departmentCode: 'STORE',
        status: 'OPEN',
      },
      select: { quantity: true, challanId: true },
    });
    const defectiveReturnChallans = await prisma.challan.findMany({
      where: {
        toDepartment: 'STORE',
        defectivePieces: { gt: 0 },
        defectiveShelfLocation: { contains: 'DEF-SHELF-STORE', mode: 'insensitive' },
      },
      select: {
        id: true,
        defectivePieces: true,
        fabricUnit: true,
        items: {
          select: { quantity: true, uom: true },
        },
      },
    });

    const returnChallanIds = new Set(defectiveReturnChallans.map((challan) => challan.id));
    const defectiveStockByUnit: Record<string, number> = {};
    for (const record of defectiveRecords) {
      if (record.challanId && returnChallanIds.has(record.challanId)) continue;
      defectiveStockByUnit.PCS = (defectiveStockByUnit.PCS || 0) + (Number(record.quantity) || 0);
    }
    for (const challan of defectiveReturnChallans) {
      const quantity = Number(challan.defectivePieces) ||
        challan.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      const unit = (challan.fabricUnit || challan.items[0]?.uom || 'PCS').toUpperCase();
      defectiveStockByUnit[unit] = (defectiveStockByUnit[unit] || 0) + quantity;
    }
    const defectiveTotal = defectiveStockByUnit.PCS || 0;

    const allItems = Array.from(ledger.rows.values()).sort((a, b) =>
      a.itemName.localeCompare(b.itemName) || a.color.localeCompare(b.color) || a.unit.localeCompare(b.unit)
    );

    // 3. Calculate final balances (meters and pieces stay separate rows)
    let items = allItems.map((it, idx) => ({
      sNo: idx + 1,
      itemName: it.itemName,
      fabricType: it.fabricType,
      color: it.color,
      unit: it.unit,
      totalInward: it.totalInward,
      totalOutward: it.totalOutward,
      balance: Math.max(0, it.rawBalance),
      inwardCount: it.inwardCount,
      outwardCount: it.outwardCount,
      lastActivity: it.lastActivity,
      status: it.rawBalance > 0 ? ('IN_STOCK' as const) : ('OUT_OF_STOCK' as const),
    }));

    // Filter by type if provided (support both UNDYED and KORA)
    if (filterType && filterType !== 'ALL') {
      const normalizedFilter = (filterType === 'KORA' || filterType === 'UNDYED') ? 'UNDYED' : filterType;
      items = items.filter((it) => it.fabricType === normalizedFilter);
    }

    // Filter by search query
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((it) => it.itemName.toLowerCase().includes(q) || it.color.toLowerCase().includes(q));
    }

    // High level summary
    const undyedItems = allItems.filter((i) => i.fabricType === 'UNDYED');
    const dyedItems = allItems.filter((i) => i.fabricType === 'DYED');

    const summarizeItems = (stockItems: typeof allItems) => ({
      totalInwardMeters: stockItems.filter((i) => i.unit === 'MTR').reduce((s, i) => s + i.totalInward, 0),
      totalOutwardMeters: stockItems.filter((i) => i.unit === 'MTR').reduce((s, i) => s + i.totalOutward, 0),
      availableBalanceMeters: stockItems.filter((i) => i.unit === 'MTR').reduce((s, i) => s + Math.max(0, i.rawBalance), 0),
      totalInwardPcs: stockItems.filter((i) => i.unit === 'PCS').reduce((s, i) => s + i.totalInward, 0),
      totalOutwardPcs: stockItems.filter((i) => i.unit === 'PCS').reduce((s, i) => s + i.totalOutward, 0),
      availableBalancePcs: stockItems.filter((i) => i.unit === 'PCS').reduce((s, i) => s + Math.max(0, i.rawBalance), 0),
      itemCount: stockItems.length,
    });

    const summary = {
      overall: summarizeItems(allItems),
      undyed: summarizeItems(undyedItems),
      kora: summarizeItems(undyedItems), // backwards-compatibility alias for undyed
      dyed: summarizeItems(dyedItems),
      defectiveStockPcs: defectiveTotal,
      defectiveStockByUnit,
    };

    const normalizedSearch = search?.trim().toLowerCase();
    const filteredOutwardHistory = ledger.outwardHistory
      .filter((row) => !filterType || filterType === 'ALL' || row.fabricType === ((filterType === 'KORA') ? 'UNDYED' : filterType))
      .filter((row) => !normalizedSearch || [row.itemName, row.color, row.challanNumber, row.destination, row.sourceDepartment]
        .some((value) => String(value || '').toLowerCase().includes(normalizedSearch)))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      data: items,
      summary,
      outwardHistory: filteredOutwardHistory,
    });
  } catch (error: any) {
    console.error('Error fetching total fabric stock:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch total stock' }, { status: 500 });
  }
}
