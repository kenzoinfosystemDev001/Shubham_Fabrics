import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const job = await prisma.challan.findUnique({
      where: { id },
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
          include: {
            items: true,
            issuedBy: { select: { fullName: true, username: true } },
          },
        },
        childChallans: {
          include: {
            items: true,
            issuedBy: { select: { fullName: true, username: true } },
          },
        },
        issuedBy: { select: { fullName: true, username: true } },
        receivedBy: { select: { fullName: true, username: true } },
        productionLogs: {
          where: {
            departmentCode: { in: ['RECUTTING', 'RE-CUTTING'] },
          },
          include: {
            operator: { select: { fullName: true, username: true } },
          },
          orderBy: { recordedAt: 'desc' },
        },
        events: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Recutting job not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: job,
    });
  } catch (error: any) {
    console.error('Error fetching Recutting job detail:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch job details' },
      { status: 500 }
    );
  }
}
