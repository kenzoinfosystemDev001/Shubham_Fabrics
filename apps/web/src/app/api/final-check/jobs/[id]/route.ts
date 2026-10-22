import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { getFinalCheckActor } from '@/lib/final-check-auth';

export const dynamic = 'force-dynamic';

const FINAL_CHECK_DEPTS = ['FINAL_CHECK', 'FINAL CHECK', 'FINAL_QC', 'FINAL-CHECK'];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getFinalCheckActor(request);
    if (!auth.actor) return auth.response;

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
          where: { departmentCode: { in: FINAL_CHECK_DEPTS } },
          orderBy: { recordedAt: 'desc' },
          include: {
            operator: { select: { id: true, fullName: true, username: true } },
          },
        },
        defects: {
          where: { departmentCode: { in: FINAL_CHECK_DEPTS } },
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
      return NextResponse.json({ error: 'Final QC job not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: job,
    });
  } catch (error: any) {
    console.error('Error fetching Final QC job details:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch Final QC job details' },
      { status: 500 }
    );
  }
}
