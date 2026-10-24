import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'RECUTTING');
  if (!authUser) return authResponse;
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const challan = await prisma.challan.findUnique({
      where: { id },
      include: { program: true },
    });

    if (!challan) {
      return NextResponse.json({ error: 'Recutting job not found' }, { status: 404 });
    }

    const verificationPassed = body.passed !== false;
    const nextStatus = verificationPassed ? 'READY_FOR_STITCHING' : 'ON_HOLD';

    const actorId = authUser.id;

    const updated = await prisma.$transaction(async (tx) => {
      const ch = await tx.challan.update({
        where: { id },
        data: {
          status: nextStatus,
          remarks: body.remarks
            ? `${challan.remarks ? challan.remarks + ' | ' : ''}Verification: ${body.remarks}`
            : challan.remarks,
        },
      });

      await tx.challanEvent.create({
        data: {
          challanId: id,
          action: verificationPassed ? 'QC_PASSED' : 'QC_FAILED',
          fromStatus: challan.status,
          toStatus: nextStatus,
          actorId: actorId,
          notes: body.remarks || (verificationPassed
            ? 'Pre-stitching panel verification passed: Cutting seam allowances & motif placement approved.'
            : 'Pre-stitching verification held: Panel re-trimming or review required.'),
        },
      });

      return ch;
    });

    return NextResponse.json({
      success: true,
      message: `Job ${updated.challanNumber} verification recorded: ${nextStatus}`,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error verifying Recutting job:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify recutting job' },
      { status: 500 }
    );
  }
}
