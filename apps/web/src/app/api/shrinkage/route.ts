import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import { requireDepartment } from '@/lib/auth/department-access';
import {
  SHRINKAGE_NOT_SET_UP,
  ShrinkageError,
  listShrinkage,
  saveShrinkageForLine,
  shrinkageTableExists,
} from '@/lib/shrinkage-server';

export const dynamic = 'force-dynamic';

// GET  /api/shrinkage?search=&design=&serial=&from=&to=   Dyeing QC and Fabric Store (read)
// POST /api/shrinkage { challanItemId, shrinkageQty, shrinkageUnit, remarks }   Dyeing QC only
export async function GET(request: Request) {
  const { user, response } = await requireDepartment(request, 'QC1', 'STORE');
  if (!user) return response;
  try {
    if (!(await shrinkageTableExists())) return NextResponse.json({ data: [], setupRequired: SHRINKAGE_NOT_SET_UP });
    const params = new URL(request.url).searchParams;
    const data = await listShrinkage({
      search: params.get('search') || undefined,
      design: params.get('design') || undefined,
      serial: params.get('serial') || undefined,
      from: params.get('from') || undefined,
      to: params.get('to') || undefined,
    });
    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error loading shrinkage records:', error);
    return NextResponse.json({ error: error.message || 'Failed to load shrinkage records.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { user, response } = await requireDepartment(request, 'QC1');
  if (!user) return response;
  try {
    if (!(await shrinkageTableExists())) return NextResponse.json({ error: SHRINKAGE_NOT_SET_UP }, { status: 503 });
    const body = await request.json();
    const challanItemId = String(body?.challanItemId || '');
    if (!challanItemId) return NextResponse.json({ error: 'Choose the fabric line.' }, { status: 400 });
    await saveShrinkageForLine(prisma, {
      challanItemId,
      shrinkageQty: body.shrinkageQty,
      shrinkageUnit: body.shrinkageUnit,
      remarks: body.remarks,
      userId: user.id,
      source: 'MANUAL',
      mode: 'create',
    });
    await prisma.auditLog.create({
      data: {
        action: 'SHRINKAGE_CREATED',
        entity: 'ShrinkageRecord',
        entityId: challanItemId,
        actor: { connect: { id: user.id } },
        afterState: JSON.stringify({ challanItemId, shrinkageQty: body.shrinkageQty, shrinkageUnit: body.shrinkageUnit, remarks: body.remarks || null }),
      },
    });
    return NextResponse.json({ message: 'Shrinkage saved.' }, { status: 201 });
  } catch (error: any) {
    if (error instanceof ShrinkageError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error saving shrinkage:', error);
    return NextResponse.json({ error: error.message || 'Failed to save shrinkage.' }, { status: 500 });
  }
}
