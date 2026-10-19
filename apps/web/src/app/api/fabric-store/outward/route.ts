import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

// GET /api/fabric-store/outward - list all outward fabric stock entries (auto from challans + manual)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fabricType = searchParams.get('fabricType'); // "KORA" | "DYED" | "ALL"
    const search = searchParams.get('search');

    // 1. Fetch all Challans issued from Fabric Store
    const storeChallans = await prisma.challan.findMany({
      where: {
        fromDepartment: 'STORE',
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
    });

    // 2. Fetch any manual outward records
    const manualOutward = await (prisma as any).fabricOutward.findMany({
      orderBy: { date: 'desc' },
    });

    // Transform Challans to Outward entries
    const challanOutward = storeChallans.map((ch, idx) => {
      const isDyeing = ch.toDepartment === 'DYEING';
      const type = isDyeing ? 'KORA' : 'DYED';
      const itemDesc =
        ch.items && ch.items.length > 0
          ? ch.items.map((it) => it.itemDescription).filter(Boolean).join(', ')
          : ch.program?.fabricName || 'Fabric Material';

      const itemsQty = ch.items?.reduce((s, it) => s + (Number(it.quantity) || 0), 0) || 0;
      const issueQty = ch.fabricOut ?? (itemsQty > 0 ? itemsQty : ch.fabricIn ?? 0);
      const avg = ch.program?.fabricAverage ? Number(ch.program.fabricAverage) : null;
      const issuePcs =
        avg && avg > 0 && issueQty > 0
          ? Math.round(issueQty / avg)
          : ch.program?.targetQuantity || null;

      const orderName =
        ch.program?.clientName ||
        ch.program?.buyerName ||
        ch.program?.orderNumber ||
        'Standard Order';

      return {
        id: `ch-${ch.id}`,
        source: 'CHALLAN',
        date: ch.issuedDate || ch.createdAt,
        challanNumber: ch.challanNumber,
        challanId: ch.id,
        designNumber: ch.program?.designNumber || ch.program?.programNumber || '—',
        itemName: itemDesc,
        issueQty: Number(issueQty),
        unit: ch.fabricUnit || ch.items?.[0]?.uom || 'MTR',
        avgPerPcs: avg,
        issuePcsQty: issuePcs,
        byOrderName: orderName,
        remarks: ch.remarks || `Issued to ${ch.toDepartment}`,
        destination: ch.toDepartment,
        fabricType: type,
        status: ch.status,
      };
    });

    // Format manual outward
    const manualMapped = manualOutward.map((item: any) => ({
      id: item.id,
      source: 'MANUAL',
      date: item.date,
      challanNumber: item.challanNumber || '—',
      challanId: item.challanId || null,
      designNumber: item.designNumber || '—',
      itemName: item.itemName,
      issueQty: Number(item.issueQty),
      unit: item.unit || 'MTR',
      avgPerPcs: item.avgPerPcs ? Number(item.avgPerPcs) : null,
      issuePcsQty: item.issuePcsQty ? Number(item.issuePcsQty) : null,
      byOrderName: item.byOrderName || '—',
      remarks: item.remarks || '—',
      destination: item.destination || 'OUTWARD',
      fabricType: item.fabricType || 'DYED',
      status: 'ISSUED',
    }));

    // Combine and sort by date descending
    let combined = [...challanOutward, ...manualMapped].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Add 1-based sequential sNo
    combined = combined.map((entry, index) => ({
      ...entry,
      sNo: index + 1,
    }));

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
          it.destination?.toLowerCase().includes(q)
      );
    }

    const summary = {
      totalEntries: combined.length,
      totalMeters: combined
        .filter((it) => it.unit === 'MTR')
        .reduce((s, it) => s + (Number(it.issueQty) || 0), 0),
      totalPcs: combined
        .filter((it) => it.unit === 'PCS')
        .reduce((s, it) => s + (Number(it.issueQty) || 0), 0),
      koraMeters: combined
        .filter((it) => it.fabricType === 'KORA' && it.unit === 'MTR')
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
        fabricType: String(fabricType).toUpperCase(),
      },
    });

    return NextResponse.json({ success: true, data: outward }, { status: 201 });
  } catch (error: any) {
    console.error('Error recording outward fabric issue:', error);
    return NextResponse.json({ error: error.message || 'Failed to record outward stock' }, { status: 500 });
  }
}
