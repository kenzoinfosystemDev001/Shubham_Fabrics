import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'FINISHING');
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
          where: { departmentCode: { in: ['FINISHING', 'FINISH', 'TRIMMING'] } },
          orderBy: { recordedAt: 'desc' },
          include: {
            operator: { select: { id: true, fullName: true, username: true } },
          },
        },
        defects: {
          where: { departmentCode: { in: ['FINISHING', 'FINISH', 'TRIMMING'] } },
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
      return NextResponse.json({ error: 'Finishing job not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: job,
    });
  } catch (error: any) {
    console.error('Error fetching Finishing job details:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch Finishing job details' },
      { status: 500 }
    );
  }
}
