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

    if (!['RECEIVED', 'IN_PROCESS'].includes(challan.status)) {
      return NextResponse.json({ error: `Cannot place on hold from status '${challan.status}'.` }, { status: 400 });
    }

    const actorId = auth.actor.id;

    const updated = await prisma.$transaction(async (tx) => {
      const claim = await tx.challan.updateMany({
        where: { id, status: { in: ['RECEIVED', 'IN_PROCESS'] } },
        data: { status: 'ON_HOLD' },
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
          fromStatus: challan.status,
          toStatus: 'ON_HOLD',
          actorId,
          notes: `Final QC job placed on hold. Reason: ${body.reason || 'Supervisor hold requested.'}`,
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

    return NextResponse.json({ success: true, message: 'Job placed on hold', data: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to hold job' }, { status: 500 });
  }
}
