import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'QC2');
  if (!authUser) return authResponse;
  try {
    const { id } = await params;

    const challan = await prisma.challan.findUnique({
      where: { id },
      include: {
        program: {
          include: {
            fabrics: true,
            colours: true,
            sizes: true,
            specifications: true,
            bomItems: true,
            createdBy: { select: { fullName: true, username: true } },
            approvedBy: { select: { fullName: true, username: true } },
          },
        },
        items: true,
        parentChallan: {
          include: {
            items: true,
            issuedBy: { select: { fullName: true, username: true } },
          },
        },
        issuedBy: {
          select: { id: true, fullName: true, username: true, email: true },
        },
        receivedBy: {
          select: { id: true, fullName: true, username: true, email: true },
        },
        inspections: {
          include: {
            inspector: { select: { id: true, fullName: true, username: true } },
            defects: true,
            parameters: true,
          },
          orderBy: { inspectedAt: 'desc' },
        },
        productionLogs: {
          where: { departmentCode: 'QC2' },
          include: {
            operator: { select: { fullName: true, username: true } },
          },
          orderBy: { recordedAt: 'desc' },
        },
        events: {
          include: {
            actor: { select: { fullName: true, username: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!challan) {
      return NextResponse.json({ error: 'Challan not found' }, { status: 404 });
    }

    if (challan.toDepartment !== 'QC2') {
      return NextResponse.json(
        { error: `Challan ${challan.challanNumber} is not routed to QC2.` },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: challan });
  } catch (error: any) {
    console.error('Error fetching QC2 challan details:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch QC2 challan details' },
      { status: 500 }
    );
  }
}
