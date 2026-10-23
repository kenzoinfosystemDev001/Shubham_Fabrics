import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { getPackingActor } from '@/lib/packing-auth';

export const dynamic = 'force-dynamic';

const PACKING_DEPTS = ['PACKING', 'PACK', 'FOLDING'];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getPackingActor(request);
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
          where: { departmentCode: { in: PACKING_DEPTS } },
          orderBy: { recordedAt: 'desc' },
          include: {
            operator: { select: { id: true, fullName: true, username: true } },
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Packing job not found' }, { status: 404 });
    }

    // Get cartons created under this packing challan
    const cartons = await prisma.carton.findMany({
      where: { packingChallanId: job.id },
      orderBy: { createdAt: 'desc' },
    });

    const totalReceived = Number(job.fabricIn ?? job.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0));
    const alreadyPacked = cartons.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0);
    const remainingToPack = Math.max(0, totalReceived - alreadyPacked);

    return NextResponse.json({
      success: true,
      data: {
        ...job,
        cartons,
        totalReceived,
        alreadyPacked,
        remainingToPack,
      },
    });
  } catch (error: any) {
    console.error('Error fetching Packing job details:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch Packing job details' },
      { status: 500 }
    );
  }
}
