import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const search = searchParams.get('search');

    const where: any = {
      toDepartment: 'QC2',
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
          },
          orderBy: { inspectedAt: 'desc' },
          take: 1,
        },
        productionLogs: {
          where: {
            departmentCode: 'QC2',
          },
          orderBy: { recordedAt: 'desc' },
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
    console.error('Error fetching QC2 challans:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch QC2 challans' },
      { status: 500 }
    );
  }
}
