import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import {
  cleanFabricName,
  getChallanItemFabricType,
  isFabricStoreDepartment,
  normalizeFabricStockType,
} from '@/lib/fabric-stock';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filterType = searchParams.get('type')?.toUpperCase(); // "UNDYED" | "KORA" | "DYED" | "ALL"
    const search = searchParams.get('search');

    // 1. Fetch all Inward entries
    const inwardEntries = await (prisma as any).fabricInward.findMany({
      orderBy: { receivingDate: 'desc' },
    });

    // 2. Fetch all Outward Challans (dispatches from Fabric Store to Dyeing, Embroidery, or other units)
    // NOTE: We exclude challans where toDepartment = STORE (those are incoming to store, not outward dispatches)
    const storeChallans = (await prisma.challan.findMany({
      where: {
        NOT: { toDepartment: { equals: 'STORE', mode: 'insensitive' } },
        OR: [
          { fromDepartment: { contains: 'STORE', mode: 'insensitive' } },
          { fromDepartment: { equals: 'FABRIC', mode: 'insensitive' } },
        ],
      },
      include: {
        program: {
          select: {
            id: true,
            fabricName: true,
            designNumber: true,
            programSerialNo: true,
            programNumber: true,
            fabricDyeingRequired: true,
            fabricAverage: true,
            targetQuantity: true,
          },
        },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    })).filter((challan) => isFabricStoreDepartment(challan.fromDepartment));

    // 3. Fetch all manual Outward records
    const manualOutwards = await (prisma as any).fabricOutward.findMany({
      orderBy: { date: 'desc' },
    });

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
    // Key format: `${cleanName.toLowerCase()}___${fabricType}___${unit}`
    const map = new Map<string, {
      itemName: string;
      fabricType: 'UNDYED' | 'DYED';
      unit: string;
      totalInward: number;
      totalOutward: number;
      balance: number;
      inwardCount: number;
      outwardCount: number;
      lastActivity: Date;
    }>();

    // 1. Accumulate Inward entries (establishes inward stock)
    for (const inw of inwardEntries) {
      const type = normalizeFabricStockType(inw.entryType);
      const unit = inw.unit || 'MTR';
      const cleanName = cleanFabricName(inw.itemName) || inw.itemName.trim();
      const key = `${cleanName.toLowerCase()}___${type}___${unit}`;

      const existing = map.get(key) || {
        itemName: cleanName,
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

    // Matcher function to map any outgoing item back to the exact inward inventory row
    const resolveMatchingKey = (rawName: string, targetType: 'UNDYED' | 'DYED', targetUnit: string) => {
      const clean = cleanFabricName(rawName).toLowerCase();
      if (!clean) return null;

      // 1. Exact key match
      const exactKey = `${clean}___${targetType}___${targetUnit}`;
      if (map.has(exactKey)) return exactKey;

      const candidates = Array.from(map.keys()).filter((key) => key.endsWith(`___${targetUnit}`));
      const exactNameCandidates = candidates.filter((key) => key.split('___')[0] === clean);
      const exactTypeCandidate = exactNameCandidates.find((key) => key.split('___')[1] === targetType);
      if (exactTypeCandidate) return exactTypeCandidate;
      if (exactNameCandidates.length === 1) return exactNameCandidates[0];

      const similarCandidates = candidates.filter((key) => {
        const candidateName = key.split('___')[0];
        return candidateName.includes(clean) || clean.includes(candidateName);
      });
      const similarTypeCandidates = similarCandidates.filter((key) => key.split('___')[1] === targetType);
      if (similarTypeCandidates.length === 1) return similarTypeCandidates[0];
      if (similarCandidates.length === 1) return similarCandidates[0];

      // 6. If no match in existing inward, return new exactKey
      return exactKey;
    };

    // 2. Accumulate Outward from Challans
    for (const ch of storeChallans) {
      const isDyeing = ch.toDepartment.toUpperCase().includes('DYE');
      const challanType: 'UNDYED' | 'DYED' = isDyeing ? 'UNDYED' : 'DYED';
      const challanDate = ch.issuedDate || ch.createdAt;

      if (Array.isArray(ch.items) && ch.items.length > 0) {
        for (const it of ch.items) {
          const itemType = getChallanItemFabricType(it, ch.toDepartment);

          const rawName = it.fabricCode || cleanFabricName(it.itemDescription) || ch.program?.fabricName || 'Fabric Material';
          const itemUnit = it.uom || ch.fabricUnit || 'MTR';
          const qty = Number(it.quantity) || (ch.fabricOut ? Number(ch.fabricOut) / ch.items.length : 0);

          if (qty <= 0) continue;

          const matchedKey = resolveMatchingKey(rawName, itemType, itemUnit) || `${cleanFabricName(rawName).toLowerCase()}___${itemType}___${itemUnit}`;
          const existing = map.get(matchedKey) || {
            itemName: cleanFabricName(rawName) || rawName.trim(),
            fabricType: itemType,
            unit: itemUnit,
            totalInward: 0,
            totalOutward: 0,
            balance: 0,
            inwardCount: 0,
            outwardCount: 0,
            lastActivity: challanDate,
          };

          existing.totalOutward += qty;
          existing.outwardCount += 1;
          if (new Date(challanDate).getTime() > new Date(existing.lastActivity).getTime()) {
            existing.lastActivity = challanDate;
          }
          map.set(matchedKey, existing);
        }
      } else {
        const rawName = ch.program?.fabricName || (isDyeing ? 'Grey / Undyed Fabric' : 'Processed Fabric');
        const unit = ch.fabricUnit || 'MTR';
        const issueQty = Number(ch.fabricOut ?? ch.fabricIn ?? 0);

        if (issueQty > 0) {
          const matchedKey = resolveMatchingKey(rawName, challanType, unit) || `${cleanFabricName(rawName).toLowerCase()}___${challanType}___${unit}`;
          const existing = map.get(matchedKey) || {
            itemName: cleanFabricName(rawName) || rawName.trim(),
            fabricType: challanType,
            unit,
            totalInward: 0,
            totalOutward: 0,
            balance: 0,
            inwardCount: 0,
            outwardCount: 0,
            lastActivity: challanDate,
          };

          existing.totalOutward += issueQty;
          existing.outwardCount += 1;
          if (new Date(challanDate).getTime() > new Date(existing.lastActivity).getTime()) {
            existing.lastActivity = challanDate;
          }
          map.set(matchedKey, existing);
        }
      }
    }

    // 3. Accumulate Outward from Manual records
    for (const outw of manualOutwards) {
      const type = normalizeFabricStockType(outw.fabricType);
      const unit = outw.unit || 'MTR';
      const rawName = outw.itemName || 'Fabric Material';
      const issueQty = Number(outw.issueQty) || 0;
      const actDate = outw.date || outw.createdAt;

      if (issueQty <= 0) continue;

      const matchedKey = resolveMatchingKey(rawName, type, unit) || `${cleanFabricName(rawName).toLowerCase()}___${type}___${unit}`;
      const existing = map.get(matchedKey) || {
        itemName: cleanFabricName(rawName) || rawName.trim(),
        fabricType: type,
        unit,
        totalInward: 0,
        totalOutward: 0,
        balance: 0,
        inwardCount: 0,
        outwardCount: 0,
        lastActivity: actDate,
      };

      existing.totalOutward += issueQty;
      existing.outwardCount += 1;
      if (new Date(actDate).getTime() > new Date(existing.lastActivity).getTime()) {
        existing.lastActivity = actDate;
      }
      map.set(matchedKey, existing);
    }

    // 4. Calculate final balances
    let items = Array.from(map.values()).map((it, idx) => ({
      sNo: idx + 1,
      ...it,
      balance: Math.max(0, it.totalInward - it.totalOutward),
      status: it.totalInward - it.totalOutward > 0 ? ('IN_STOCK' as const) : ('OUT_OF_STOCK' as const),
    }));

    // Filter by type if provided (support both UNDYED and KORA)
    if (filterType && filterType !== 'ALL') {
      const normalizedFilter = (filterType === 'KORA' || filterType === 'UNDYED') ? 'UNDYED' : filterType;
      items = items.filter((it) => it.fabricType === normalizedFilter);
    }

    // Filter by search query
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((it) => it.itemName.toLowerCase().includes(q));
    }

    // High level summary
    const allItems = Array.from(map.values());
    const undyedItems = allItems.filter((i) => i.fabricType === 'UNDYED');
    const dyedItems = allItems.filter((i) => i.fabricType === 'DYED');

    const summarizeItems = (stockItems: typeof allItems) => ({
      totalInwardMeters: stockItems.filter((i) => i.unit === 'MTR').reduce((s, i) => s + i.totalInward, 0),
      totalOutwardMeters: stockItems.filter((i) => i.unit === 'MTR').reduce((s, i) => s + i.totalOutward, 0),
      availableBalanceMeters: stockItems.filter((i) => i.unit === 'MTR').reduce((s, i) => s + Math.max(0, i.totalInward - i.totalOutward), 0),
      totalInwardPcs: stockItems.filter((i) => i.unit === 'PCS').reduce((s, i) => s + i.totalInward, 0),
      totalOutwardPcs: stockItems.filter((i) => i.unit === 'PCS').reduce((s, i) => s + i.totalOutward, 0),
      availableBalancePcs: stockItems.filter((i) => i.unit === 'PCS').reduce((s, i) => s + Math.max(0, i.totalInward - i.totalOutward), 0),
      itemCount: stockItems.length,
    });

    const summary = {
      overall: summarizeItems(allItems),
      undyed: summarizeItems(undyedItems),
      kora: summarizeItems(undyedItems), // backwards-compatibility alias for undyed
      dyed: summarizeItems(dyedItems),
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
