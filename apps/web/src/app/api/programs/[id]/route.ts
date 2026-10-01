import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const program = await prisma.program.findUnique({
      where: { id },
      include: {
        customer: true,
        design: true,
        createdBy: { select: { id: true, username: true, fullName: true } },
        approvedBy: { select: { id: true, username: true, fullName: true } },
        fabrics: true,
        sizes: true,
        colours: true,
        challans: {
          include: {
            items: true,
            fromDeptRel: true,
            toDeptRel: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    return NextResponse.json(program);
  } catch (error: any) {
    console.error('Error fetching program:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch program' }, { status: 500 });
  }
}
