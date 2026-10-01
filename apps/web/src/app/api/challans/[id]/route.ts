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
        program: true,
        items: true,
        fromDeptRel: true,
        toDeptRel: true,
        createdBy: { select: { id: true, username: true, fullName: true } },
        issuedBy: { select: { id: true, username: true, fullName: true } },
      },
    });

    if (!challan) {
      return NextResponse.json({ error: 'Challan not found' }, { status: 404 });
    }

    return NextResponse.json(challan);
  } catch (error: any) {
    console.error('Error fetching challan:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch challan' }, { status: 500 });
  }
}
