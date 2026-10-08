import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

import { syncInboundChallansToDyeingOrders } from '@/lib/dyeing-sync';

// GET /api/dyeing/orders
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const search = searchParams.get('search');
    const programId = searchParams.get('programId');

    // Auto-sync any fresh inbound challans from Fabric Store
    await syncInboundChallansToDyeingOrders();

    const where: any = {};
    if (status && status !== 'ALL') where.status = status;
    if (priority && priority !== 'ALL') where.priority = priority;
    if (programId) where.programId = programId;

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { fabricName: { contains: search, mode: 'insensitive' } },
        { targetColor: { contains: search, mode: 'insensitive' } },
        { dyedColor: { contains: search, mode: 'insensitive' } },
        { inchargeName: { contains: search, mode: 'insensitive' } },
        {
          program: {
            OR: [
              { programNumber: { contains: search, mode: 'insensitive' } },
              { programSerialNo: { contains: search, mode: 'insensitive' } },
              { clientName: { contains: search, mode: 'insensitive' } },
              { buyerName: { contains: search, mode: 'insensitive' } },
              { styleCode: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const orders = await prisma.dyeingOrder.findMany({
      where,
      include: {
        program: {
          select: {
            id: true,
            programNumber: true,
            programSerialNo: true,
            clientName: true,
            buyerName: true,
            styleCode: true,
            mainStyle: true,
            fabricName: true,
            fabricType: true,
            fabricColor: true,
            targetQuantity: true,
            deliveryDate: true,
            priority: true,
            status: true,
            quantityMeasurement: true,
            wilcomDesignPhoto: true,
            baseDesignPhoto: true,
          },
        },
        inboundChallan: {
          select: {
            id: true,
            challanNumber: true,
            fromDepartment: true,
            toDepartment: true,
            status: true,
            priority: true,
            issuedDate: true,
            remarks: true,
            items: true,
          },
        },
        qc1Challan: {
          select: {
            id: true,
            challanNumber: true,
            fromDepartment: true,
            toDepartment: true,
            status: true,
            issuedDate: true,
            items: true,
          },
        },
        incharge: {
          select: {
            id: true,
            fullName: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: orders });
  } catch (error: any) {
    console.error('Error fetching dyeing orders:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch dyeing orders' }, { status: 500 });
  }
}
