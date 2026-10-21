import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const whereClause: any = {
      toDepartment: { in: ['STEAM_PRESS', 'STEAM_PRESSING', 'PRESSING'] },
      status: {
        in: [
          'RECEIVED',
          'IN_PROCESS',
          'COMPLETED',
          'READY_FOR_HANDOVER',
          'READY_FOR_DISPATCH',
          'ON_HOLD',
        ],
      },
    };

    if (status && status !== 'ALL') {
      whereClause.status = status;
    }

    if (search) {
      whereClause.OR = [
        { challanNumber: { contains: search, mode: 'insensitive' } },
        { program: { programNumber: { contains: search, mode: 'insensitive' } } },
        { program: { styleCode: { contains: search, mode: 'insensitive' } } },
        { program: { clientName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const jobs = await prisma.challan.findMany({
      where: whereClause,
      include: {
        program: {
          select: {
            id: true,
            programNumber: true,
            programSerialNo: true,
            clientName: true,
            buyerName: true,
            styleCode: true,
            designNumber: true,
            wilcomDesignNumber: true,
            fabricName: true,
            fabricColor: true,
            targetQuantity: true,
            quantityMeasurement: true,
          },
        },
        items: true,
        issuedBy: { select: { id: true, fullName: true, username: true } },
        receivedBy: { select: { id: true, fullName: true, username: true } },
        productionLogs: {
          where: { departmentCode: { in: ['STEAM_PRESS', 'STEAM_PRESSING', 'PRESSING'] } },
          orderBy: { recordedAt: 'desc' },
          include: {
            operator: { select: { id: true, fullName: true, username: true } },
          },
        },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: [
        { priority: 'desc' },
        { receivedDate: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({
      success: true,
      data: jobs,
    });
  } catch (error: any) {
    console.error('Error fetching Steam Press queue:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch Steam Press queue' },
      { status: 500 }
    );
  }
}
