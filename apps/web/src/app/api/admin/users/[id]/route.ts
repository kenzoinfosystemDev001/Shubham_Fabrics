import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import bcrypt from 'bcryptjs';
import { normalizeRoleCode } from '@subham/types';
import { auditAdminAction, requireAdmin } from '@/lib/admin-auth';
import { checkAccountChange, validatePin, type AccountSnapshot } from '@/lib/admin-users';
import { ACCOUNT_DEPARTMENT_CODES } from '@/lib/departments';
import { ADMIN_USER_SELECT, formatAdminUser } from '@/lib/admin-users-db';

export const dynamic = 'force-dynamic';

async function loadAccounts(): Promise<AccountSnapshot[]> {
  const users = await prisma.user.findMany({
    select: { id: true, isActive: true, departmentCode: true, userRoles: { select: { role: { select: { code: true } } } } },
  });
  return users.map((u) => ({
    id: u.id,
    isActive: u.isActive,
    departmentCode: u.departmentCode,
    roles: u.userRoles.map((ur) => normalizeRoleCode(ur.role.code)),
  }));
}

// PATCH /api/admin/users/:id  { fullName?, email?, departmentCode?, roleCodes?, isActive?, pin? }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.actor) return auth.response;
  try {
    const { id } = await params;
    const body = await request.json();
    const accounts = await loadAccounts();
    const target = accounts.find((a) => a.id === id);
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const before = await prisma.user.findUnique({ where: { id }, select: ADMIN_USER_SELECT });

    const data: Record<string, unknown> = {};
    if (body.fullName !== undefined) {
      const fullName = String(body.fullName).trim();
      if (!fullName) return NextResponse.json({ error: 'Full name is required.', field: 'fullName' }, { status: 400 });
      data.fullName = fullName;
    }
    if (body.email !== undefined) {
      const email = String(body.email).trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: 'Enter a valid email address.', field: 'email' }, { status: 400 });
      data.email = email;
    }
    let departmentCode: string | undefined;
    if (body.departmentCode !== undefined) {
      departmentCode = String(body.departmentCode).trim().toUpperCase();
      if (!ACCOUNT_DEPARTMENT_CODES.includes(departmentCode)) return NextResponse.json({ error: 'Select a valid department.', field: 'departmentCode' }, { status: 400 });
      data.departmentCode = departmentCode;
    }
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

    let roleCodes: string[] | undefined;
    let roleIds: string[] = [];
    if (body.roleCodes !== undefined) {
      roleCodes = Array.from(new Set((Array.isArray(body.roleCodes) ? body.roleCodes : []).map((r: unknown) => String(r).trim().toUpperCase()).filter(Boolean))) as string[];
      if (roleCodes.length === 0) return NextResponse.json({ error: 'Assign at least one role.', field: 'roleCodes' }, { status: 400 });
      const roles = await prisma.role.findMany({ where: { code: { in: roleCodes } }, select: { id: true, code: true } });
      const missing = roleCodes.filter((code) => !roles.some((r) => r.code === code));
      if (missing.length > 0) return NextResponse.json({ error: `Unknown role: ${missing.join(', ')}.`, field: 'roleCodes' }, { status: 400 });
      if (roleCodes.includes('SUPER_ADMIN') && !target.roles.includes('SUPER_ADMIN') && !auth.actor.roles.includes('SUPER_ADMIN')) {
        return NextResponse.json({ error: 'Only a Super Admin can grant the Super Admin role.' }, { status: 403 });
      }
      roleIds = roles.map((r) => r.id);
    }
    if (body.pin !== undefined && body.pin !== '') {
      const pinError = validatePin(body.pin);
      if (pinError) return NextResponse.json({ error: pinError, field: 'pin' }, { status: 400 });
      data.passwordHash = await bcrypt.hash(String(body.pin), 10);
    }

    const blocked = checkAccountChange(
      { id: auth.actor.id, roles: auth.actor.roles },
      target,
      { isActive: data.isActive as boolean | undefined, departmentCode, roles: roleCodes, resetsPin: Boolean(data.passwordHash) },
      accounts
    );
    if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });

    const updated = await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) await tx.user.update({ where: { id }, data });
      if (roleCodes) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.createMany({ data: roleIds.map((roleId) => ({ userId: id, roleId })) });
      }
      const after = await tx.user.findUnique({ where: { id }, select: ADMIN_USER_SELECT });
      await auditAdminAction(request, auth.actor.id, data.passwordHash ? 'USER_UPDATED_PIN_RESET' : 'USER_UPDATED', 'User', id, {
        before: before && formatAdminUser(before),
        after: after && { ...formatAdminUser(after), pinReset: Boolean(data.passwordHash) },
      }, tx);
      return after;
    });

    return NextResponse.json({ success: true, user: updated && formatAdminUser(updated) });
  } catch (error: any) {
    if (error?.code === 'P2002') return NextResponse.json({ error: 'That email is already used by another user.', field: 'email' }, { status: 409 });
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

// DELETE /api/admin/users/:id — accounts are deactivated, never erased, so their history stays attributable.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.actor) return auth.response;
  try {
    const { id } = await params;
    const accounts = await loadAccounts();
    const target = accounts.find((a) => a.id === id);
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const blocked = checkAccountChange({ id: auth.actor.id, roles: auth.actor.roles }, target, { isActive: false }, accounts);
    if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });

    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { isActive: false } });
      await auditAdminAction(request, auth.actor.id, 'USER_DEACTIVATED', 'User', id, { before: { isActive: target.isActive }, after: { isActive: false } }, tx);
    });
    return NextResponse.json({ success: true, message: 'User deactivated. Their records and history are kept.' });
  } catch (error: any) {
    console.error('Error deactivating user:', error);
    return NextResponse.json({ error: 'Failed to deactivate user' }, { status: 500 });
  }
}
