import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';
import { formatTotals, totalsByUnit, unitOf } from '@/lib/challan-units.mjs';

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
      const latestInspection = c.inspections[0];
      // Every line keeps its unit: received, inspected and outcome quantities are per unit (an
      // inspection writes one production log per unit, at the same moment).
      const sentByUnit = totalsByUnit(c.items, c.fabricUnit);
      const unitList = Object.keys(sentByUnit).length ? Object.keys(sentByUnit) : [unitOf(primaryItem?.uom) || unitOf(c.program?.quantityMeasurement) || 'MTR'];
      const latestAt = c.productionLogs[0]?.recordedAt?.getTime();
      const latestLogs = c.productionLogs.filter((l) => l.recordedAt?.getTime() === latestAt);
      const logFor = (unit: string) => latestLogs.find((l) => (unitOf(l.unitOfMeasure) || unitList[0]) === unit);
      const units = unitList.map((unit) => {
        const log = logFor(unit);
        const sent = sentByUnit[unit] || 0;
        const inspected = log ? log.inputQuantity : unitList.length === 1 ? latestInspection?.sampleSize || 0 : 0;
        return {
          unit,
          sent,
          inspected,
          pending: Math.max(0, sent - inspected),
          passed: log ? log.goodQuantity : 0,
          failed: log ? log.rejectQuantity : 0,
          rework: log ? log.reworkQuantity : 0,
          hold: log ? log.balanceQuantity : 0,
        };
      });
      // Single-unit fields kept for existing screens: the first unit's figures (the only one for most challans).
      const first = units[0];
      const totalSentQuantity = first.sent;
      const inspectedQty = first.inspected;
      const pendingInspectionQty = first.pending;
      const latestProdLog = logFor(first.unit);
      const sumOf = (key: 'sent' | 'pending' | 'inspected') => formatTotals(Object.fromEntries(units.map((u) => [u.unit, u[key]])));

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
        uom: first.unit,
        units,
        sentText: sumOf('sent'),
        pendingText: sumOf('pending'),
        inspectedText: sumOf('inspected'),
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
