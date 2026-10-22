import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { getFinalCheckActor } from '@/lib/final-check-auth';

export const dynamic = 'force-dynamic';

const FINAL_CHECK_DEPTS = ['FINAL_CHECK', 'FINAL CHECK', 'FINAL_QC', 'FINAL-CHECK'];

export async function GET(request: Request) {
  try {
    const auth = await getFinalCheckActor(request);
    if (!auth.actor) return auth.response;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const whereClause: any = {
      toDepartment: { in: FINAL_CHECK_DEPTS },
      status: {
        in: [
          'ISSUED',
          'RECEIVED',
          'IN_PROCESS',
          'QC_PENDING',
          'REWORK',
          'QC_APPROVED',
          'QC_REJECTED',
          'REWORK_REQUESTED',
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
          where: { departmentCode: { in: FINAL_CHECK_DEPTS } },
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
    console.error('Error fetching Final QC queue:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch Final QC queue' },
      { status: 500 }
    );
  }
}
