import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { auditAdminAction, readReason, reasonRequiredResponse, requireAdmin } from '@/lib/admin-auth';
import { MES_DEPARTMENTS } from '@/lib/departments';

export const dynamic = 'force-dynamic';

// PATCH /api/admin/departments/:code  { name?, isActive?, inchargeUserId? (null clears), reason }
// Deactivating only stops new challans to or from the department; its history and references stay.
export async function PATCH(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.actor) return auth.response;
  try {
    const { code: rawCode } = await params;
    const code = rawCode.toUpperCase();
    const approved = MES_DEPARTMENTS.find((d) => d.code === code);
    if (!approved) return NextResponse.json({ error: 'Unknown department.' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const reason = readReason(body);
    if (!reason) return reasonRequiredResponse();

    const data: { name?: string; isActive?: boolean; inchargeUserId?: string | null } = {};
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (name.length < 2 || name.length > 80) return NextResponse.json({ error: 'Department name must be 2–80 characters.', field: 'name' }, { status: 400 });
      data.name = name;
    }
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
    if (body.inchargeUserId !== undefined) {
      if (body.inchargeUserId === null || body.inchargeUserId === '') {
        data.inchargeUserId = null;
      } else {
        const user = await prisma.user.findUnique({ where: { id: String(body.inchargeUserId) }, select: { id: true, isActive: true, departmentCode: true } });
        if (!user || !user.isActive) return NextResponse.json({ error: 'The incharge must be an active user.', field: 'inchargeUserId' }, { status: 400 });
        if (user.departmentCode !== code && user.departmentCode !== 'ADMIN') {
          return NextResponse.json({ error: 'Assign the user to this department before making them its incharge.', field: 'inchargeUserId' }, { status: 400 });
        }
        data.inchargeUserId = user.id;
      }
    }
    if (Object.keys(data).length === 0) return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });

    const before = await prisma.department.findUnique({ where: { code }, select: { name: true, isActive: true, inchargeUserId: true } });
    const updated = await prisma.$transaction(async (tx) => {
      const dept = await tx.department.upsert({
        where: { code },
        update: data,
        create: { code, name: data.name || approved.name, sequenceOrder: MES_DEPARTMENTS.indexOf(approved) + 1, ...data },
        select: { code: true, name: true, isActive: true, inchargeUserId: true },
      });
      await auditAdminAction(request, auth.actor.id, 'DEPARTMENT_UPDATED', 'Department', code, { before, after: { ...dept, reason } }, tx);
      return dept;
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Error updating department:', error);
    return NextResponse.json({ error: 'Failed to update department' }, { status: 500 });
  }
}
