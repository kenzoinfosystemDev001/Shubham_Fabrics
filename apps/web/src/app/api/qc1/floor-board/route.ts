import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'QC1');
  if (!authUser) return authResponse;
  try {
    const challans = await prisma.challan.findMany({
      where: {
        toDepartment: 'QC1',
      },
      include: {
        program: {
          select: {
            id: true,
            programNumber: true,
            programSerialNo: true,
            clientName: true,
            buyerName: true,
            styleCode: true,
            fabricName: true,
            fabricType: true,
            fabricColor: true,
            deliveryDate: true,
            priority: true,
            wilcomDesignNumber: true,
          },
        },
        items: true,
        issuedBy: {
          select: {
            id: true,
            fullName: true,
            username: true,
          },
        },
        receivedBy: {
          select: {
            id: true,
            fullName: true,
            username: true,
          },
        },
        inspections: {
          include: {
            inspector: {
              select: {
                id: true,
                fullName: true,
                username: true,
              },
            },
            defects: true,
          },
          orderBy: { inspectedAt: 'desc' },
          take: 1,
        },
        productionLogs: {
          where: {
            departmentCode: 'QC1',
          },
          orderBy: { recordedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const items = challans.map((c) => {
      const primaryItem = c.items[0];
      const totalQty = c.items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
      const latestInspection = c.inspections[0];
      const latestProdLog = c.productionLogs[0];

      return {
        id: c.id,
        challanNumber: c.challanNumber,
        programId: c.programId,
        productionSheetNumber: c.program?.programSerialNo || c.program?.programNumber || '—',
        programNumber: c.program?.programNumber || '—',
        wilcomDesignNumber: c.program?.wilcomDesignNumber || null,
        clientName: c.program?.clientName || c.program?.buyerName || 'Standard Client',
        fabric: primaryItem?.itemDescription || c.program?.fabricName || 'Fabric',
        fabricType: primaryItem?.fabricCode || c.program?.fabricType || null,
        color: primaryItem?.colour || c.program?.fabricColor || 'Standard',
        quantity: totalQty,
        quantityInspected: latestProdLog ? latestProdLog.inputQuantity : (latestInspection?.sampleSize || 0),
        quantityPassed: latestProdLog ? latestProdLog.goodQuantity : 0,
        quantityFailed: latestProdLog ? latestProdLog.rejectQuantity : 0,
        quantityRework: latestProdLog ? latestProdLog.reworkQuantity : 0,
        quantityHold: latestProdLog ? latestProdLog.balanceQuantity : 0,
        uom: primaryItem?.uom || 'MTR',
        priority: c.priority || 'NORMAL',
        status: c.status,
        issuedDate: c.issuedDate,
        receivedDate: c.receivedDate,
        dyeingIncharge: c.issuedBy?.fullName || c.issuedBy?.username || 'Dyeing Floor',
        inspector: latestInspection?.inspector?.fullName || latestInspection?.inspector?.username || null,
        deliveryDate: c.program?.deliveryDate || null,
        barcode: primaryItem?.barcode || c.challanNumber,
        remarks: c.remarks,
        inspectionNotes: latestInspection?.notes || latestProdLog?.notes || null,
      };
    });

    // Group into strict columns as required by prompt Section 28:
    // RECEIVED | UNDER INSPECTION | PASS | FAIL | REWORK | HOLD
    const columns = {
      RECEIVED: items.filter((it) => it.status === 'ISSUED' || it.status === 'RECEIVED'),
      UNDER_INSPECTION: items.filter((it) => it.status === 'UNDER_INSPECTION'),
      PASS: items.filter((it) => it.status === 'QC_APPROVED'),
      FAIL: items.filter((it) => it.status === 'QC_REJECTED'),
      REWORK: items.filter((it) => it.status === 'REWORK_REQUESTED'),
      HOLD: items.filter((it) => it.status === 'ON_HOLD'),
    };

    return NextResponse.json({
      data: {
        columns,
        totalItems: items.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching QC1 floorboard data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch QC1 floorboard data.' },
      { status: 500 }
    );
  }
}
