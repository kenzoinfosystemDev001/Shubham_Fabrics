import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'RECUTTING');
  if (!authUser) return authResponse;
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'ALL';
    const priority = searchParams.get('priority');
    const search = searchParams.get('search');

    const where: any = {
      toDepartment: { in: ['RECUTTING', 'RE-CUTTING', 'CUTTING_RECUT'] },
    };

    if (status && status !== 'ALL') {
      where.status = status;
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
              { designNumber: { contains: search, mode: 'insensitive' } },
              { wilcomDesignNumber: { contains: search, mode: 'insensitive' } },
              { fabricName: { contains: search, mode: 'insensitive' } },
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
            sizes: true,
            specifications: true,
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
            status: true,
            issuedDate: true,
          },
        },
        issuedBy: {
          select: { id: true, fullName: true, username: true },
        },
        receivedBy: {
          select: { id: true, fullName: true, username: true },
        },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      count: challans.length,
      data: challans,
    });
  } catch (error: any) {
    console.error('Error fetching Recutting incoming challans:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch incoming challans' },
      { status: 500 }
    );
  }
}
