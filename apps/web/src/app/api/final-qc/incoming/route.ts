import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { getFinalQCActor } from '@/lib/final-qc-auth';

export const dynamic = 'force-dynamic';

const FINAL_QC_DEPTS = ['FINAL_QC'];

export async function GET(request: Request) {
  try {
    const auth = await getFinalQCActor(request);
    if (!auth.actor) return auth.response;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const whereClause: any = {
      toDepartment: { in: FINAL_QC_DEPTS },
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

    const challans = await prisma.challan.findMany({
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
        events: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: challans,
    });
  } catch (error: any) {
    console.error('Error fetching incoming Final QC challans:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch incoming challans' },
      { status: 500 }
    );
  }
}
