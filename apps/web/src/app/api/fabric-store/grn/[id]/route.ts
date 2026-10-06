import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

// GET /api/fabric-store/grn/[id]
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const grn = await prisma.materialReceipt.findUnique({
      where: { id: params.id },
      include: {
        batch: true,
        receivedBy: { select: { fullName: true, username: true } },
        items: {
          include: {
            roll: {
              include: {
                location: { select: { locationCode: true, locationName: true } },
                qcInspections: {
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!grn) {
      return NextResponse.json({ error: 'GRN not found' }, { status: 404 });
    }

    return NextResponse.json({ data: grn });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
