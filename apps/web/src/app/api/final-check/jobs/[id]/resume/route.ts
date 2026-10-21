import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const challan = await prisma.challan.findUnique({ where: { id }, include: { items: true } });
    if (!challan) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    if (challan.status !== 'ON_HOLD') {
      return NextResponse.json({ error: `Job is not ON_HOLD. Current status: '${challan.status}'.` }, { status: 400 });
    }

    let actorId = body.actorId;
    if (!actorId) {
      const fcUser = await prisma.user.findFirst({ where: { OR: [{ username: 'finalcheck' }, { departmentCode: 'FINAL_CHECK' }] }, select: { id: true } });
      actorId = fcUser?.id ?? (await prisma.user.findFirst({ select: { id: true } }))?.id;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const ch = await tx.challan.update({
        where: { id },
        data: { status: 'IN_PROCESS' },
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

    return NextResponse.json({ success: true, message: 'Job resumed from hold', data: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to resume job' }, { status: 500 });
  }
}
