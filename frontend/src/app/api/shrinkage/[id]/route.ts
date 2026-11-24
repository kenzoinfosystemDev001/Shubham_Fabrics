import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import { requireDepartment } from '@/lib/auth/department-access';
import { SHRINKAGE_NOT_SET_UP, ShrinkageError, shrinkageTableExists, updateShrinkageRecord } from '@/lib/shrinkage-server';

export const dynamic = 'force-dynamic';

// PUT /api/shrinkage/:id { shrinkageQty, shrinkageUnit, remarks }   Dyeing QC only
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireDepartment(request, 'QC1');
  if (!user) return response;
  try {
    if (!(await shrinkageTableExists())) return NextResponse.json({ error: SHRINKAGE_NOT_SET_UP }, { status: 503 });
    const { id } = await params;
    const body = await request.json();
    await updateShrinkageRecord(id, {
      shrinkageQty: body?.shrinkageQty,
      shrinkageUnit: body?.shrinkageUnit,
      remarks: body?.remarks,
      userId: user.id,
    });
    await prisma.auditLog.create({
      data: {
        action: 'SHRINKAGE_UPDATED',
        entity: 'ShrinkageRecord',
        entityId: id,
        actor: { connect: { id: user.id } },
        afterState: JSON.stringify({ shrinkageQty: body?.shrinkageQty, shrinkageUnit: body?.shrinkageUnit, remarks: body?.remarks || null }),
      },
    });
    return NextResponse.json({ message: 'Shrinkage updated.' });
  } catch (error: any) {
    if (error instanceof ShrinkageError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error updating shrinkage:', error);
    return NextResponse.json({ error: error.message || 'Failed to update shrinkage.' }, { status: 500 });
  }
}
