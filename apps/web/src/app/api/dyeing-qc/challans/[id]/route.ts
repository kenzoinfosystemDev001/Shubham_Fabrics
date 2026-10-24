import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
          where: { departmentCode: 'DYEING_QC' },
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

    if (challan.toDepartment !== 'DYEING_QC') {
      return NextResponse.json(
        { error: `Challan ${challan.challanNumber} is not routed to Dyeing QC.` },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: challan });
  } catch (error: any) {
    console.error('Error fetching Dyeing QC challan details:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch Dyeing QC challan details' },
      { status: 500 }
    );
  }
}
