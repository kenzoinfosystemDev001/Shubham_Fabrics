import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'EMBROIDERY');
  if (!authUser) return authResponse;
  try {
    // 1. Fetch incoming/active embroidery challans
    const challans = await prisma.challan.findMany({
      where: {
        toDepartment: 'EMBROIDERY',
      },
      include: {
        parentChallan: {
          select: {
            id: true,
            challanNumber: true,
            challanType: true,
            fromDepartment: true,
            toDepartment: true,
            status: true,
            remarks: true,
          },
        },
        program: {
          select: {
            id: true,
            programNumber: true,
            programSerialNo: true,
            clientName: true,
            buyerName: true,
            mainStyle: true,
            wilcomDesignNumber: true,
            wilcomDesignPhoto: true,
            embroideryDesign: true,
            embroideryDesignSize: true,
            fabricColor: true,
            targetQuantity: true,
            priority: true,
          },
        },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // 2. Fetch programs with embroidery specifications
    const embroideryPrograms = await prisma.program.findMany({
      where: {
        OR: [
          { embroideryDesign: { not: null } },
          { wilcomDesignNumber: { not: null } },
        ],
      },
      select: {
        id: true,
        programNumber: true,
        programSerialNo: true,
        clientName: true,
        buyerName: true,
        mainStyle: true,
        wilcomDesignNumber: true,
        wilcomDesignPhoto: true,
        embroideryDesign: true,
        embroideryDesignSize: true,
        fabricColor: true,
        targetQuantity: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });

    const pendingCount = challans.filter(c => c.status === 'ISSUED' || c.status === 'DRAFT').length;
    const inProcessCount = challans.filter(c => c.status === 'RECEIVED' || c.status === 'IN_PROGRESS').length;
    const completedCount = challans.filter(c => c.status === 'COMPLETED').length;

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalChallans: challans.length,
          pendingTransfer: pendingCount,
          activeInStitch: inProcessCount,
          completed: completedCount,
          activeWilcomDesigns: embroideryPrograms.length,
        },
        challans,
        programs: embroideryPrograms,
      },
    });
  } catch (err: any) {
    console.error('Error in embroidery dashboard API:', err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to load embroidery dashboard',
        data: {
          stats: {
            totalChallans: 0,
            pendingTransfer: 0,
            activeInStitch: 0,
            completed: 0,
            activeWilcomDesigns: 0,
          },
          challans: [],
          programs: [],
        },
      },
      { status: 500 }
    );
  }
}
