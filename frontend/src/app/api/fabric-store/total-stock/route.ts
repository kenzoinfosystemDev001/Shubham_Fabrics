import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import { requireDepartment } from '@/lib/auth/department-access';
import { cleanFabricName, normalizeFabricStockType } from '@/lib/fabric-stock';
import {
  FabricStockError,
  STOCK_TRANSACTION_OPTIONS,
  fabricStockErrorBody,
  isChallanMirror,
  loadStockBook,
  removeStockBucket,
} from '@/lib/fabric-stock-ledger';
import { challanStockLines, roundQty, summarizeBuckets } from '@/lib/fabric-stock-rules.mjs';
import { addTotals, totalsByUnit, unitOf } from '@/lib/challan-units.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'STORE', 'PROGRAMMING');
  if (!authUser) return authResponse;
  try {
    const { searchParams } = new URL(request.url);
    const filterType = searchParams.get('type')?.toUpperCase(); // "UNDYED" | "KORA" | "DYED" | "ALL"
    const search = searchParams.get('search');

    // 1. Stock per fabric, type, colour and unit (meters and pieces are separate buckets).
    const { book, storeChallans, manualOutwards } = await loadStockBook(prisma);

    // 4. Fetch Store shelf defect records and defective-return challans.
    const defectiveRecords = await prisma.defectRecord.findMany({
      where: {
        departmentCode: 'STORE',
        status: 'OPEN',
      },
      select: { quantity: true, uom: true, challanId: true, challan: { select: { defectiveUnit: true, fabricUnit: true } } },
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
        defectiveUnit: true,
        items: {
          select: { quantity: true, uom: true },
        },
      },
    });

    const returnChallanIds = new Set(defectiveReturnChallans.map((challan) => challan.id));
    const defectiveStockByUnit: Record<string, number> = {};
    for (const record of defectiveRecords) {
      if (record.challanId && returnChallanIds.has(record.challanId)) continue;
      // Older records have no unit; they take their challan's unit. When nothing records it, the
      // quantity is reported under UNKNOWN for review rather than guessed as pieces.
      const unit = unitOf(record.uom) || unitOf(record.challan?.defectiveUnit) || unitOf(record.challan?.fabricUnit) || 'UNKNOWN';
      addTotals(defectiveStockByUnit, { [unit]: Number(record.quantity) || 0 });
    }
    for (const challan of defectiveReturnChallans) {
      // The header defect is in defectiveUnit (older rows: fabricUnit); otherwise each line in its own unit.
      const unit = unitOf(challan.defectiveUnit) || unitOf(challan.fabricUnit);
      addTotals(
        defectiveStockByUnit,
        Number(challan.defectivePieces) > 0 ? { [unit || 'UNKNOWN']: Number(challan.defectivePieces) } : totalsByUnit(challan.items, challan.fabricUnit),
      );
    }
    const defectiveTotal = defectiveStockByUnit.PCS || 0;

    // 2. Dated outward register: active Fabric Store challans and manual outward rows.
    const outwardHistory: Array<Record<string, any>> = [];
    const challanNumbers = new Set(storeChallans.map((challan) => challan.challanNumber.trim().toLowerCase()));
    for (const ch of storeChallans) {
      if (['DRAFT', 'CANCELLED'].includes(ch.status)) continue;
      for (const line of challanStockLines(ch)) {
        outwardHistory.push({
          id: `challan-${ch.id}-${line.itemId || outwardHistory.length}`,
          date: ch.issuedDate || ch.createdAt,
          challanNumber: ch.challanNumber,
          sourceDepartment: ch.fromDepartment,
          destination: ch.toDepartment,
          itemName: cleanFabricName(line.fabric) || line.fabric,
          colour: line.colour,
          quantity: line.quantity,
          unit: String(line.unit).toUpperCase(),
          fabricType: line.type,
        });
      }
    }
    for (const outw of manualOutwards) {
      if (isChallanMirror(outw, challanNumbers) || !(Number(outw.issueQty) > 0)) continue;
      outwardHistory.push({
        id: `manual-${outw.id}`,
        date: outw.date || outw.createdAt,
        challanNumber: outw.challanNumber || '—',
        sourceDepartment: 'STORE',
        destination: outw.destination || '—',
        itemName: cleanFabricName(outw.itemName) || outw.itemName,
        colour: outw.colour,
        quantity: Number(outw.issueQty),
        unit: String(outw.unit).toUpperCase(),
        fabricType: normalizeFabricStockType(outw.fabricType),
      });
    }

    // 3. Final balances, one row per bucket; never combined across units.
    const buckets = Array.from(book.buckets.values()).sort((a, b) =>
      a.itemName.localeCompare(b.itemName) || a.unit.localeCompare(b.unit) || String(a.colour || '').localeCompare(String(b.colour || '')),
    );
    let items = buckets.map((it, idx) => {
      const balance = roundQty(it.totalInward - it.totalOutward);
      return {
        sNo: idx + 1,
        key: it.key,
        itemName: it.itemName,
        fabricType: it.fabricType,
        colour: it.colour,
        unit: it.unit,
        totalInward: it.totalInward,
        totalOutward: it.totalOutward,
        balance: Math.max(0, balance),
        shortfall: balance < 0 ? roundQty(-balance) : 0,
        inwardCount: it.inwardCount,
        outwardCount: it.outwardCount,
        lastActivity: it.lastActivity,
        status: balance > 0 ? ('IN_STOCK' as const) : ('OUT_OF_STOCK' as const),
      };
    });

    // Filter by type if provided (support both UNDYED and KORA)
    if (filterType && filterType !== 'ALL') {
      const normalizedFilter = (filterType === 'KORA' || filterType === 'UNDYED') ? 'UNDYED' : filterType;
      items = items.filter((it) => it.fabricType === normalizedFilter);
    }

    // Filter by search query
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((it) => it.itemName.toLowerCase().includes(q) || String(it.colour || '').toLowerCase().includes(q));
    }

    // High level summary
    const allItems = Array.from(book.buckets.values());
    const undyedItems = allItems.filter((i) => i.fabricType === 'UNDYED');
    const dyedItems = allItems.filter((i) => i.fabricType === 'DYED');
    const summary = {
      overall: summarizeBuckets(allItems),
      undyed: summarizeBuckets(undyedItems),
      kora: summarizeBuckets(undyedItems), // backwards-compatibility alias for undyed
      dyed: summarizeBuckets(dyedItems),
      defectiveStockPcs: defectiveTotal,
      defectiveStockByUnit,
    };

    const normalizedSearch = search?.trim().toLowerCase();
    const filteredOutwardHistory = outwardHistory
      .filter((row) => !filterType || filterType === 'ALL' || row.fabricType === ((filterType === 'KORA') ? 'UNDYED' : filterType))
      .filter((row) => !normalizedSearch || [row.itemName, row.colour, row.challanNumber, row.destination, row.sourceDepartment]
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

// DELETE /api/fabric-store/total-stock?key=<bucket key> - removes the current stock of one item.
export async function DELETE(request: Request) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'STORE');
  if (!authUser) return authResponse;
  try {
    const key = new URL(request.url).searchParams.get('key');
    if (!key) return NextResponse.json({ error: 'Choose the stock item to remove.' }, { status: 400 });
    const result = await prisma.$transaction(
      (tx) => removeStockBucket(tx, key, { id: authUser.id, name: authUser.fullName || authUser.username }),
      STOCK_TRANSACTION_OPTIONS,
    );
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof FabricStockError) {
      return NextResponse.json(fabricStockErrorBody(error), { status: 400 });
    }
    console.error('Error removing fabric stock:', error);
    return NextResponse.json({ error: error.message || 'Failed to remove stock' }, { status: 500 });
  }
}
