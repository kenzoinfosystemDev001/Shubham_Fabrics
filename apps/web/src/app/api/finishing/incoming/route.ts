import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'FINISHING');
  if (!authUser) return authResponse;
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const whereClause: any = {
      toDepartment: { in: ['FINISHING', 'FINISH', 'TRIMMING'] },
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
    console.error('Error fetching incoming Finishing challans:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch incoming challans' },
      { status: 500 }
    );
  }
}
