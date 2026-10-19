import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filterType = searchParams.get('type'); // "KORA" | "DYED" | "ALL"
    const search = searchParams.get('search');

    // 1. Fetch all Inward entries
    const inwardEntries = await (prisma as any).fabricInward.findMany({
      orderBy: { receivingDate: 'desc' },
    });

    // 2. Fetch all Challans from Store
    const storeChallans = await prisma.challan.findMany({
      where: { fromDepartment: 'STORE' },
      include: {
        program: {
          select: {
            fabricName: true,
            designNumber: true,
            fabricDyeingRequired: true,
          },
        },
        items: true,
      },
    });

    // 3. Fetch all manual Outward records
    const manualOutwards = await (prisma as any).fabricOutward.findMany();

    // 4. Fetch defective count in Store Shelf
    const defectiveRecords = await prisma.defectRecord.findMany({
      where: {
        departmentCode: 'STORE',
        status: 'OPEN',
      },
      select: { quantity: true },
    });
    const defectiveTotal = defectiveRecords.reduce((sum, d) => sum + (Number(d.quantity) || 0), 0);

    // Build item-wise aggregates
    // Key: `${itemName}___${type}___${unit}`
    const map = new Map<string, {
      itemName: string;
      fabricType: 'KORA' | 'DYED';
      unit: string;
      totalInward: number;
      totalOutward: number;
      balance: number;
      inwardCount: number;
      outwardCount: number;
      lastActivity: Date;
    }>();

    // Accumulate Inward
    for (const inw of inwardEntries) {
      const type: 'KORA' | 'DYED' = inw.entryType === 'KORA' ? 'KORA' : 'DYED';
      const unit = inw.unit || 'MTR';
      const key = `${inw.itemName.toLowerCase().trim()}___${type}___${unit}`;

      const existing = map.get(key) || {
        itemName: inw.itemName.trim(),
        fabricType: type,
        unit,
        totalInward: 0,
        totalOutward: 0,
        balance: 0,
        inwardCount: 0,
        outwardCount: 0,
        lastActivity: inw.receivingDate || inw.createdAt,
      };

      existing.totalInward += Number(inw.billQty) || 0;
      existing.inwardCount += 1;
      if (new Date(inw.receivingDate).getTime() > new Date(existing.lastActivity).getTime()) {
        existing.lastActivity = inw.receivingDate;
      }
      map.set(key, existing);
    }

    // Accumulate Outward from Challans
    for (const ch of storeChallans) {
      const isDyeing = ch.toDepartment === 'DYEING';
      const type: 'KORA' | 'DYED' = isDyeing ? 'KORA' : 'DYED';
      const unit = ch.fabricUnit || ch.items?.[0]?.uom || 'MTR';
      const itemName =
        ch.items?.[0]?.itemDescription ||
        ch.program?.fabricName ||
        (type === 'KORA' ? 'Grey / Kora Fabric' : 'Processed Fabric');

      const itemsQty = ch.items?.reduce((s, it) => s + (Number(it.quantity) || 0), 0) || 0;
      const issueQty = ch.fabricOut ?? (itemsQty > 0 ? itemsQty : ch.fabricIn ?? 0);

      const key = `${itemName.toLowerCase().trim()}___${type}___${unit}`;
      const existing = map.get(key) || {
        itemName: itemName.trim(),
        fabricType: type,
        unit,
        totalInward: 0,
        totalOutward: 0,
        balance: 0,
        inwardCount: 0,
        outwardCount: 0,
        lastActivity: ch.issuedDate || ch.createdAt,
      };

      existing.totalOutward += Number(issueQty) || 0;
      existing.outwardCount += 1;
      if (new Date(ch.createdAt).getTime() > new Date(existing.lastActivity).getTime()) {
        existing.lastActivity = ch.createdAt;
      }
      map.set(key, existing);
    }

    // Accumulate Outward from Manual records
    for (const outw of manualOutwards) {
      const type: 'KORA' | 'DYED' = outw.fabricType === 'KORA' ? 'KORA' : 'DYED';
      const unit = outw.unit || 'MTR';
      const itemName = outw.itemName || 'Fabric Material';
      const key = `${itemName.toLowerCase().trim()}___${type}___${unit}`;

      const existing = map.get(key) || {
        itemName: itemName.trim(),
        fabricType: type,
        unit,
        totalInward: 0,
        totalOutward: 0,
        balance: 0,
        inwardCount: 0,
        outwardCount: 0,
        lastActivity: outw.date || outw.createdAt,
      };

      existing.totalOutward += Number(outw.issueQty) || 0;
      existing.outwardCount += 1;
      if (new Date(outw.date).getTime() > new Date(existing.lastActivity).getTime()) {
        existing.lastActivity = outw.date;
      }
      map.set(key, existing);
    }

    // Calculate balances
    let items = Array.from(map.values()).map((it, idx) => ({
      sNo: idx + 1,
      ...it,
      balance: Math.max(0, it.totalInward - it.totalOutward),
      status: it.totalInward - it.totalOutward > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
    }));

    // Filter by type if provided
    if (filterType && filterType !== 'ALL') {
      items = items.filter((it) => it.fabricType === filterType);
    }

    // Filter by search query
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((it) => it.itemName.toLowerCase().includes(q));
    }

    // High level summary
    const allItems = Array.from(map.values());
    const koraItems = allItems.filter((i) => i.fabricType === 'KORA');
    const dyedItems = allItems.filter((i) => i.fabricType === 'DYED');

    const summary = {
      overall: {
        totalInwardMeters: allItems.filter((i) => i.unit === 'MTR').reduce((s, i) => s + i.totalInward, 0),
        totalOutwardMeters: allItems.filter((i) => i.unit === 'MTR').reduce((s, i) => s + i.totalOutward, 0),
        availableBalanceMeters: allItems.filter((i) => i.unit === 'MTR').reduce((s, i) => s + Math.max(0, i.totalInward - i.totalOutward), 0),
        itemCount: allItems.length,
      },
      kora: {
        totalInwardMeters: koraItems.filter((i) => i.unit === 'MTR').reduce((s, i) => s + i.totalInward, 0),
        totalOutwardMeters: koraItems.filter((i) => i.unit === 'MTR').reduce((s, i) => s + i.totalOutward, 0),
        availableBalanceMeters: koraItems.filter((i) => i.unit === 'MTR').reduce((s, i) => s + Math.max(0, i.totalInward - i.totalOutward), 0),
        itemCount: koraItems.length,
      },
      dyed: {
        totalInwardMeters: dyedItems.filter((i) => i.unit === 'MTR').reduce((s, i) => s + i.totalInward, 0),
        totalOutwardMeters: dyedItems.filter((i) => i.unit === 'MTR').reduce((s, i) => s + i.totalOutward, 0),
        availableBalanceMeters: dyedItems.filter((i) => i.unit === 'MTR').reduce((s, i) => s + Math.max(0, i.totalInward - i.totalOutward), 0),
        itemCount: dyedItems.length,
      },
      defectiveStockPcs: defectiveTotal,
    };

    return NextResponse.json({
      data: items,
      summary,
    });
  } catch (error: any) {
    console.error('Error fetching total fabric stock:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch total stock' }, { status: 500 });
  }
}
