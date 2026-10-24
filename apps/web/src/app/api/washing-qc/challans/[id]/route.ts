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
            createdBy: { select: { fullName: true, username: true } },
          },
        },
        items: true,
        parentChallan: {
          include: {
            items: true,
          },
        },
        childChallans: {
          include: {
            items: true,
          },
        },
        issuedBy: {
          select: { id: true, fullName: true, username: true },
        },
        receivedBy: {
          select: { id: true, fullName: true, username: true },
        },
        inspections: {
          include: {
            inspector: { select: { id: true, fullName: true, username: true } },
            parameters: true,
            defects: true,
          },
          orderBy: { inspectedAt: 'desc' },
        },
        events: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!challan) {
      return NextResponse.json({ error: 'Challan not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: challan,
    });
  } catch (error: any) {
    console.error('Error fetching Washing QC challan details:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch challan details' },
      { status: 500 }
    );
  }
}
