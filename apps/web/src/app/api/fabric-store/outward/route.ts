import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import {
  cleanFabricName,
  getChallanItemFabricType,
  isFabricStoreDepartment,
  normalizeFabricStockType,
} from '@/lib/fabric-stock';

export const dynamic = 'force-dynamic';

// GET /api/fabric-store/outward - list all outward fabric stock entries (auto from challans + manual)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawFilter = searchParams.get('fabricType')?.toUpperCase(); // "UNDYED" | "KORA" | "DYED" | "ALL"
    const fabricType = (rawFilter === 'KORA' || rawFilter === 'UNDYED') ? 'UNDYED' : rawFilter;
    const search = searchParams.get('search');

    // 1. Fetch Inward entries for verified origin tracing
    const inwardEntries = await (prisma as any).fabricInward.findMany({
      orderBy: { receivingDate: 'desc' },
    });

    // Helper to find verified matching Inward record
    const findMatchedInward = (rawName: string, targetType: 'UNDYED' | 'DYED', targetUnit: string) => {
      const clean = cleanFabricName(rawName).toLowerCase();
      if (!clean || inwardEntries.length === 0) return null;

      // Exact clean name + type + unit
      const sameUnitEntries = inwardEntries.filter(
        (inw: any) => (inw.unit || 'MTR').toUpperCase() === targetUnit.toUpperCase()
      );
      const exactNameEntries = sameUnitEntries.filter(
        (inw: any) => cleanFabricName(inw.itemName).toLowerCase() === clean
      );
      const exactTypeMatch = exactNameEntries.find(
        (inw: any) => normalizeFabricStockType(inw.entryType) === targetType
      );
      if (exactTypeMatch) return exactTypeMatch;
      if (exactNameEntries.length > 0 && new Set(exactNameEntries.map((inw: any) => normalizeFabricStockType(inw.entryType))).size === 1) {
        return exactNameEntries[0];
      }

      const similarEntries = sameUnitEntries.filter((inw: any) => {
        const inwardName = cleanFabricName(inw.itemName).toLowerCase();
        return inwardName.includes(clean) || clean.includes(inwardName);
      });
      const similarTypeMatch = similarEntries.filter(
        (inw: any) => normalizeFabricStockType(inw.entryType) === targetType
      );
      if (similarTypeMatch.length === 1) return similarTypeMatch[0];
      if (similarEntries.length === 1) return similarEntries[0];
      return null;
    };

    // 2. Fetch all Challans issued from Fabric Store (to Dyeing, Embroidery, etc.)
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
            programNumber: true,
            designNumber: true,
            styleCode: true,
            mainStyle: true,
            clientName: true,
            buyerName: true,
            orderNumber: true,
            fabricName: true,
            fabricAverage: true,
            fabricDyeingRequired: true,
            targetQuantity: true,
          },
        },
        items: true,
        createdBy: {
          select: { fullName: true, username: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })).filter((challan) => isFabricStoreDepartment(challan.fromDepartment));

    // 3. Fetch any manual outward records
    const manualOutward = await (prisma as any).fabricOutward.findMany({
      orderBy: { date: 'desc' },
    });

    // Transform Challans to Outward entries
    const challanOutward: any[] = [];

    for (const ch of storeChallans) {
      const isDyeing = ch.toDepartment.toUpperCase().includes('DYE');
      const defaultType: 'UNDYED' | 'DYED' = isDyeing ? 'UNDYED' : 'DYED';
      const avg = ch.program?.fabricAverage ? Number(ch.program.fabricAverage) : null;
      const orderName =
        ch.program?.clientName ||
        ch.program?.buyerName ||
        ch.program?.orderNumber ||
        'Standard Order';

      if (ch.items && ch.items.length > 0) {
        ch.items.forEach((it, idx) => {
          const itemType = getChallanItemFabricType(it, ch.toDepartment);

          const rawName = it.fabricCode || cleanFabricName(it.itemDescription) || ch.program?.fabricName || 'Fabric Material';
          const unit = it.uom || ch.fabricUnit || 'MTR';
          const issueQty = Number(it.quantity) || (ch.fabricOut ? Number(ch.fabricOut) / ch.items.length : 0);

          if (issueQty <= 0) return;

          const issuePcs =
            avg && avg > 0 && issueQty > 0
              ? Math.round(issueQty / avg)
              : ch.program?.targetQuantity || null;

          const matched = findMatchedInward(rawName, itemType, unit);
          const verifiedDetails = matched
            ? `Inward: Bill #${matched.billNo}${matched.supplierName ? ` • ${matched.supplierName}` : ''}${matched.receivingDate ? ` (${new Date(matched.receivingDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })})` : ''}`
            : 'No matching inward record';

          challanOutward.push({
            id: `ch-${ch.id}-${it.id || idx}`,
            source: 'CHALLAN',
            date: ch.issuedDate || ch.createdAt,
            challanNumber: ch.challanNumber,
            challanId: ch.id,
            designNumber: ch.program?.designNumber || ch.program?.programNumber || '—',
            itemName: cleanFabricName(it.itemDescription) || rawName,
            issueQty: Number(issueQty),
            unit,
            avgPerPcs: avg,
            issuePcsQty: issuePcs,
            byOrderName: orderName,
            remarks: ch.remarks || `Issued to ${ch.toDepartment}`,
            destination: ch.toDepartment,
            fabricType: itemType,
            status: ch.status,
            verifiedInwardDetails: verifiedDetails,
            inwardVerified: !!matched,
            inwardBillNo: matched?.billNo || null,
            inwardSupplier: matched?.supplierName || null,
          });
        });
      } else {
        const rawName = ch.program?.fabricName || (isDyeing ? 'Grey / Undyed Fabric' : 'Processed Fabric');
        const unit = ch.fabricUnit || 'MTR';
        const issueQty = Number(ch.fabricOut ?? ch.fabricIn ?? 0);

        if (issueQty > 0) {
          const issuePcs =
            avg && avg > 0 && issueQty > 0
              ? Math.round(issueQty / avg)
              : ch.program?.targetQuantity || null;

          const matched = findMatchedInward(rawName, defaultType, unit);
          const verifiedDetails = matched
            ? `Inward: Bill #${matched.billNo}${matched.supplierName ? ` • ${matched.supplierName}` : ''}${matched.receivingDate ? ` (${new Date(matched.receivingDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })})` : ''}`
            : 'No matching inward record';

          challanOutward.push({
            id: `ch-${ch.id}`,
            source: 'CHALLAN',
            date: ch.issuedDate || ch.createdAt,
            challanNumber: ch.challanNumber,
            challanId: ch.id,
            designNumber: ch.program?.designNumber || ch.program?.programNumber || '—',
            itemName: cleanFabricName(rawName) || rawName,
            issueQty: Number(issueQty),
            unit,
            avgPerPcs: avg,
            issuePcsQty: issuePcs,
            byOrderName: orderName,
            remarks: ch.remarks || `Issued to ${ch.toDepartment}`,
            destination: ch.toDepartment,
            fabricType: defaultType,
            status: ch.status,
            verifiedInwardDetails: verifiedDetails,
            inwardVerified: !!matched,
            inwardBillNo: matched?.billNo || null,
            inwardSupplier: matched?.supplierName || null,
          });
        }
      }
    }

    // Format manual outward
    const manualMapped = manualOutward.map((item: any) => {
      const type = normalizeFabricStockType(item.fabricType);
      const unit = item.unit || 'MTR';
      const matched = findMatchedInward(item.itemName, type, unit);
      const verifiedDetails = matched
        ? `Inward: Bill #${matched.billNo}${matched.supplierName ? ` • ${matched.supplierName}` : ''}`
        : 'Manual Outward Dispatch';

      return {
        id: item.id,
        source: 'MANUAL',
        date: item.date,
        challanNumber: item.challanNumber || '—',
        challanId: item.challanId || null,
        designNumber: item.designNumber || '—',
        itemName: cleanFabricName(item.itemName) || item.itemName,
        issueQty: Number(item.issueQty),
        unit,
        avgPerPcs: item.avgPerPcs ? Number(item.avgPerPcs) : null,
        issuePcsQty: item.issuePcsQty ? Number(item.issuePcsQty) : null,
        byOrderName: item.byOrderName || '—',
        remarks: item.remarks || '—',
        destination: item.destination || 'OUTWARD',
        fabricType: type,
        status: 'ISSUED',
        verifiedInwardDetails: verifiedDetails,
        inwardVerified: !!matched,
        inwardBillNo: matched?.billNo || null,
        inwardSupplier: matched?.supplierName || null,
      };
    });

    // Combine and sort by date descending
    let combined = [...challanOutward, ...manualMapped].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Apply filters
    if (fabricType && fabricType !== 'ALL') {
      combined = combined.filter((it) => it.fabricType === fabricType);
    }

    if (search) {
      const q = search.toLowerCase();
      combined = combined.filter(
        (it) =>
          it.challanNumber?.toLowerCase().includes(q) ||
          it.designNumber?.toLowerCase().includes(q) ||
          it.itemName?.toLowerCase().includes(q) ||
          it.byOrderName?.toLowerCase().includes(q) ||
          it.destination?.toLowerCase().includes(q) ||
          it.verifiedInwardDetails?.toLowerCase().includes(q)
      );
    }

    // Add 1-based sequential sNo
    combined = combined.map((entry, index) => ({
      ...entry,
      sNo: index + 1,
    }));

    const summary = {
      totalEntries: combined.length,
      totalMeters: combined
        .filter((it) => it.unit === 'MTR')
        .reduce((s, it) => s + (Number(it.issueQty) || 0), 0),
      totalPcs: combined
        .filter((it) => it.unit === 'PCS')
        .reduce((s, it) => s + (Number(it.issueQty) || 0), 0),
      undyedMeters: combined
        .filter((it) => it.fabricType === 'UNDYED' && it.unit === 'MTR')
        .reduce((s, it) => s + (Number(it.issueQty) || 0), 0),
      koraMeters: combined
        .filter((it) => it.fabricType === 'UNDYED' && it.unit === 'MTR')
        .reduce((s, it) => s + (Number(it.issueQty) || 0), 0),
      dyedMeters: combined
        .filter((it) => it.fabricType === 'DYED' && it.unit === 'MTR')
        .reduce((s, it) => s + (Number(it.issueQty) || 0), 0),
    };

    return NextResponse.json({
      data: combined,
      summary,
    });
  } catch (error: any) {
    console.error('Error fetching outward stock:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch outward stock' }, { status: 500 });
  }
}

// POST /api/fabric-store/outward - manually record outward fabric issue
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      date = new Date(),
      challanNumber,
      designNumber,
      itemName,
      issueQty,
      unit = 'MTR',
      avgPerPcs,
      issuePcsQty,
      byOrderName,
      remarks,
      destination = 'OTHER',
      fabricType = 'DYED',
    } = body;

    if (!itemName || issueQty === undefined) {
      return NextResponse.json({ error: 'itemName and issueQty are required' }, { status: 400 });
    }

    const qty = parseFloat(issueQty);
    if (isNaN(qty) || qty <= 0) {
      return NextResponse.json({ error: 'issueQty must be a positive number' }, { status: 400 });
    }

    const normalizedType = (fabricType === 'KORA' || fabricType === 'UNDYED') ? 'UNDYED' : 'DYED';

    const outward = await (prisma as any).fabricOutward.create({
      data: {
        date: new Date(date),
        challanNumber: challanNumber ? String(challanNumber).trim() : null,
        designNumber: designNumber ? String(designNumber).trim() : null,
        itemName: String(itemName).trim(),
        issueQty: qty,
        unit: unit.toUpperCase() === 'PCS' ? 'PCS' : 'MTR',
        avgPerPcs: avgPerPcs ? parseFloat(avgPerPcs) : null,
        issuePcsQty: issuePcsQty ? parseFloat(issuePcsQty) : null,
        byOrderName: byOrderName ? String(byOrderName).trim() : null,
        remarks: remarks ? String(remarks).trim() : null,
        destination: String(destination).toUpperCase(),
        fabricType: normalizedType,
      },
    });

    return NextResponse.json({ success: true, data: outward }, { status: 201 });
  } catch (error: any) {
    console.error('Error recording outward fabric issue:', error);
    return NextResponse.json({ error: error.message || 'Failed to record outward stock' }, { status: 500 });
  }
}
