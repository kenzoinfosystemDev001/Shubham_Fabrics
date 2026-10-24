import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'QC2');
  if (!authUser) return authResponse;
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { notes } = body;

    const challan = await prisma.challan.findUnique({
      where: { id },
      include: {
        program: true,
        items: true,
      },
    });

    if (!challan) {
      return NextResponse.json({ error: 'Challan not found.' }, { status: 404 });
    }

    if (challan.toDepartment !== 'QC2') {
      return NextResponse.json(
        { error: `Challan ${challan.challanNumber} is addressed to ${challan.toDepartment}, not QC2.` },
        { status: 400 }
      );
    }

    // Duplicate receiving check
    if (challan.status !== 'ISSUED') {
      return NextResponse.json(
        {
          error: `Cannot receive Challan ${challan.challanNumber}. Current status is '${challan.status}'. It has already been received or processed.`,
        },
        { status: 400 }
      );
    }

    // Resolve authenticated actor
    const actorUser = { id: authUser.id, fullName: authUser.fullName, username: authUser.username };
    const actorId = actorUser?.id || '';

    const totalQty = challan.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
    const uom = challan.items[0]?.uom || 'PCS';

    // Atomic update
    const updatedChallan = await prisma.$transaction(async (tx) => {
      const updated = await tx.challan.update({
        where: { id },
        data: {
          status: 'RECEIVED',
          receivedById: actorId,
          receivedDate: new Date(),
          remarks: notes
            ? `${challan.remarks ? challan.remarks + ' | ' : ''}Received at QC2: ${notes}`
            : challan.remarks,
        },
        include: {
          program: true,
          items: true,
          issuedBy: { select: { fullName: true, username: true } },
          receivedBy: { select: { fullName: true, username: true } },
        },
      });

      // Record audit event
      await tx.challanEvent.create({
        data: {
          challanId: id,
          action: 'RECEIVED',
          fromStatus: 'ISSUED',
          toStatus: 'RECEIVED',
          notes: notes || `Challan acknowledged & physical handover accepted at QC2. Total: ${totalQty} ${uom}`,
          actorId: actorId,
        },
      });

      return updated;
    });

    return NextResponse.json({
      success: true,
      message: `Challan ${updatedChallan.challanNumber} received successfully at QC2.`,
      data: updatedChallan,
    });
  } catch (error: any) {
    console.error('Error receiving QC2 challan:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to receive QC2 challan' },
      { status: 500 }
    );
  }
}
