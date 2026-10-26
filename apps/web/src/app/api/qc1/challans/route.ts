import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'QC1');
  if (!authUser) return authResponse;
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const search = searchParams.get('search');

    const where: any = {
      toDepartment: 'QC1',
    };

    if (status && status !== 'ALL') {
      if (status === 'RECEIVED') {
        where.status = { in: ['ISSUED', 'RECEIVED'] };
      } else {
        where.status = status;
      }
    }

    if (priority && priority !== 'ALL') {
      where.priority = priority;
    }

    if (search) {
      where.OR = [
        { challanNumber: { contains: search, mode: 'insensitive' } },
        {
          program: {
            OR: [
              { programNumber: { contains: search, mode: 'insensitive' } },
              { programSerialNo: { contains: search, mode: 'insensitive' } },
              { clientName: { contains: search, mode: 'insensitive' } },
              { buyerName: { contains: search, mode: 'insensitive' } },
              { styleCode: { contains: search, mode: 'insensitive' } },
              { fabricName: { contains: search, mode: 'insensitive' } },
              { wilcomDesignNumber: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
        {
          items: {
            some: {
              OR: [
                { itemDescription: { contains: search, mode: 'insensitive' } },
                { colour: { contains: search, mode: 'insensitive' } },
                { fabricCode: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    const challans = await prisma.challan.findMany({
      where,
      include: {
        program: {
          include: {
            fabrics: true,
            colours: true,
            createdBy: { select: { fullName: true, username: true } },
          },
        },
        items: true,
        parentChallan: {
          select: {
            id: true,
            challanNumber: true,
            fromDepartment: true,
            toDepartment: true,
            issuedDate: true,
          },
        },
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
            parameters: true,
          },
          orderBy: { inspectedAt: 'desc' },
        },
        productionLogs: {
          where: {
            departmentCode: 'QC1',
          },
          orderBy: { recordedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = challans.map((c) => {
      const primaryItem = c.items[0];
      const totalSentQuantity = c.items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
      const latestInspection = c.inspections[0];
      const latestProdLog = c.productionLogs[0];
      const inspectedQty = latestProdLog ? latestProdLog.inputQuantity : (latestInspection?.sampleSize || 0);
      const pendingInspectionQty = Math.max(0, totalSentQuantity - inspectedQty);

      return {
        id: c.id,
        challanNumber: c.challanNumber,
        challanType: c.challanType,
        parentChallanId: c.parentChallanId,
        parentChallanNumber: c.parentChallan?.challanNumber || null,
        fromDepartment: c.fromDepartment,
        toDepartment: c.toDepartment,
        status: c.status,
        priority: c.priority,
        issuedDate: c.issuedDate,
        receivedDate: c.receivedDate,
        completedDate: c.completedDate,
        createdAt: c.createdAt,
        remarks: c.remarks,
        dyeingIncharge: c.issuedBy?.fullName || c.issuedBy?.username || 'Dyeing Incharge',
        receivedBy: c.receivedBy?.fullName || c.receivedBy?.username || null,
        programId: c.programId,
        productionSheetNumber: c.program?.programSerialNo || c.program?.programNumber || '—',
        programNumber: c.program?.programNumber || '—',
        wilcomDesignNumber: c.program?.wilcomDesignNumber || null,
        clientName: c.program?.clientName || c.program?.buyerName || 'Standard Client',
        fabric: primaryItem?.itemDescription || c.program?.fabricName || 'Dyed Fabric',
        fabricType: primaryItem?.fabricCode || c.program?.fabricType || null,
        color: primaryItem?.colour || c.program?.fabricColor || 'Standard',
        totalSentQuantity,
        inspectedQuantity: inspectedQty,
        pendingInspectionQuantity: pendingInspectionQty,
        passedQuantity: latestProdLog ? latestProdLog.goodQuantity : 0,
        failedQuantity: latestProdLog ? latestProdLog.rejectQuantity : 0,
        reworkQuantity: latestProdLog ? latestProdLog.reworkQuantity : 0,
        holdQuantity: latestProdLog ? latestProdLog.balanceQuantity : 0,
        uom: primaryItem?.uom || c.program?.quantityMeasurement || 'MTR',
        deliveryDate: c.program?.deliveryDate || null,
        items: c.items,
        program: c.program,
        latestInspection,
        inspectionHistory: c.inspections,
      };
    });

    return NextResponse.json({ data: formatted });
  } catch (error: any) {
    console.error('Error fetching QC1 challans:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch QC1 challans' },
      { status: 500 }
    );
  }
}
