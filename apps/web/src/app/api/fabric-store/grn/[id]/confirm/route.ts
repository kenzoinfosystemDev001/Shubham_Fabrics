import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

// PATCH /api/fabric-store/grn/[id]/confirm
export async function PATCH(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const grn = await prisma.materialReceipt.findUnique({
      where: { id: params.id },
      include: { _count: { select: { items: true } } },
    });

    if (!grn) {
      return NextResponse.json({ error: 'GRN not found' }, { status: 404 });
    }

    // Business rule 1: GRN can only be confirmed if all rolls have been entered
    if (grn._count.items === 0) {
      return NextResponse.json(
        { error: 'Cannot confirm GRN with no roll entries' },
        { status: 422 }
      );
    }

    if (grn.status !== 'DRAFT') {
      return NextResponse.json(
        { error: `GRN is already ${grn.status} — cannot re-confirm` },
        { status: 422 }
      );
    }

    // Confirm GRN and move to QC_PENDING
    const updated = await prisma.materialReceipt.update({
      where: { id: params.id },
      data: { status: 'QC_PENDING' },
    });

    return NextResponse.json({ data: updated, message: 'GRN confirmed — rolls queued for QC' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
