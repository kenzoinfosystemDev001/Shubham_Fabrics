import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import bcrypt from 'bcryptjs';
import { requireUser } from '@/lib/auth/require-user';
import { validatePin } from '@/lib/auth/pin';
import { DELETED_USER_USERNAME, deleteUserPermanently } from '@/lib/auth/delete-user';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, response: authResponse } = await requireUser(request, { admin: true });
  if (!authUser) return authResponse;
  try {
    const { id } = await params;
    if (id === authUser.id) {
      return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Protect root admin from deletion
    if (user.username === 'admin') {
      return NextResponse.json(
        { error: 'Cannot delete the primary System Administrator account.' },
        { status: 400 }
      );
    }

    if (user.username === DELETED_USER_USERNAME) {
      return NextResponse.json({ error: 'The Deleted User account cannot be removed.' }, { status: 400 });
    }

    // The user and its roles are deleted from the database; records naming the user now name "Deleted User".
    const { movedRecords } = await deleteUserPermanently(id);

    return NextResponse.json({
      success: true,
      message: movedRecords > 0
        ? `User ${user.username} deleted. ${movedRecords} earlier record(s) now show "Deleted User".`
        : `User ${user.username} deleted.`,
    });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete user' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, response: authResponse } = await requireUser(request, { admin: true });
  if (!authUser) return authResponse;
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.user.findUnique({ where: { id }, select: { id: true, username: true } });
    if (!existing) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }
    if (existing.username === DELETED_USER_USERNAME) {
      return NextResponse.json({ error: 'The Deleted User account cannot be changed.' }, { status: 400 });
    }

    const roleCode = typeof body.roleCode === 'string' ? body.roleCode.trim().toUpperCase() : '';
    const departmentCode =
      typeof body.departmentCode === 'string' ? body.departmentCode.trim().toUpperCase() : undefined;

    // An administrator cannot lock themselves out of the admin console.
    if (id === authUser.id) {
      if (body.isActive === false) {
        return NextResponse.json({ error: 'You cannot deactivate your own account.' }, { status: 400 });
      }
      if ((roleCode && !['ADMIN', 'SUPER_ADMIN'].includes(roleCode)) || (departmentCode && departmentCode !== 'ADMIN')) {
        return NextResponse.json({ error: 'You cannot remove administrator access from your own account.' }, { status: 400 });
      }
    }

    const dataToUpdate: any = {};
    if (body.fullName !== undefined) {
      const fullName = String(body.fullName).trim();
      if (!fullName) {
        return NextResponse.json({ error: 'Full name cannot be empty.' }, { status: 400 });
      }
      dataToUpdate.fullName = fullName;
    }
    if (departmentCode) dataToUpdate.departmentCode = departmentCode;
    if (body.isActive !== undefined) dataToUpdate.isActive = Boolean(body.isActive);

    if (body.pin) {
      const pinError = validatePin(body.pin);
      if (pinError) {
        return NextResponse.json({ error: pinError }, { status: 400 });
      }
      dataToUpdate.passwordHash = await bcrypt.hash(body.pin.trim(), 10);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
      // Never send the password hash back to the browser.
      select: { id: true, username: true, fullName: true, email: true, departmentCode: true, isActive: true },
    });

    if (roleCode) {
      const role = await prisma.role.upsert({
        where: { code: roleCode },
        update: {},
        create: { code: roleCode, name: roleCode.replace(/_/g, ' '), isSystem: false },
      });
      await prisma.$transaction([
        prisma.userRole.deleteMany({ where: { userId: id } }),
        prisma.userRole.create({ data: { userId: id, roleId: role.id } }),
      ]);
    }

    return NextResponse.json({
      success: true,
      user: updated,
    });
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update user' },
      { status: 500 }
    );
  }
}
