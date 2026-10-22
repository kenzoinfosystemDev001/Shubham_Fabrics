import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { getFinalCheckActor } from '@/lib/final-check-auth';

export const dynamic = 'force-dynamic';
const FINAL_CHECK_DEPTS = ['FINAL_CHECK', 'FINAL CHECK', 'FINAL_QC', 'FINAL-CHECK'];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getFinalCheckActor(request);
    if (!auth.actor) return auth.response;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const challan = await prisma.challan.findUnique({ where: { id }, include: { items: true } });
    if (!challan) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    if (!FINAL_CHECK_DEPTS.includes(challan.toDepartment.toUpperCase())) {
      return NextResponse.json({ error: 'This challan is not routed to Final QC.' }, { status: 400 });
    }

    if (challan.status !== 'ON_HOLD') {
      return NextResponse.json({ error: `Job is not ON_HOLD. Current status: '${challan.status}'.` }, { status: 400 });
    }

    const actorId = auth.actor.id;

    const updated = await prisma.$transaction(async (tx) => {
      const claim = await tx.challan.updateMany({
        where: { id, status: 'ON_HOLD' },
        data: { status: 'IN_PROCESS' },
      });
      if (claim.count !== 1) return null;

      const ch = await tx.challan.findUniqueOrThrow({
        where: { id },
        include: { program: true, items: true },
      });
      await tx.challanEvent.create({
        data: {
          challanId: id,
          action: 'STATUS_CHANGED',
          fromStatus: 'ON_HOLD',
          toStatus: 'IN_PROCESS',
          actorId,
          notes: `Final QC job resumed from hold. ${body.notes || ''}`,
        },
      });
      return ch;
    });

    if (!updated) {
      return NextResponse.json(
        { error: 'This job was changed by another user. Refresh and try again.' },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true, message: 'Job resumed from hold', data: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to resume job' }, { status: 500 });
  }
}
