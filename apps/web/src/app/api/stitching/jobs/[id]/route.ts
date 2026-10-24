import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'STITCHING');
  if (!authUser) return authResponse;
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
        issuedBy: { select: { id: true, fullName: true, username: true } },
        receivedBy: { select: { id: true, fullName: true, username: true } },
        events: {
          orderBy: { createdAt: 'desc' },
          include: {
            actor: { select: { id: true, fullName: true, username: true } },
          },
        },
        productionLogs: {
          where: { departmentCode: { in: ['STITCHING', 'STITCH', 'ASSEMBLY'] } },
          orderBy: { recordedAt: 'desc' },
          include: {
            operator: { select: { id: true, fullName: true, username: true } },
          },
        },
        defects: {
          where: { departmentCode: { in: ['STITCHING', 'STITCH', 'ASSEMBLY'] } },
          orderBy: { createdAt: 'desc' },
          include: {
            detectedBy: { select: { id: true, fullName: true, username: true } },
          },
        },
        childChallans: {
          include: {
            items: true,
            receivedBy: { select: { fullName: true, username: true } },
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Stitching job not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: job,
    });
  } catch (error: any) {
    console.error('Error fetching Stitching job details:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch Stitching job details' },
      { status: 500 }
    );
  }
}
