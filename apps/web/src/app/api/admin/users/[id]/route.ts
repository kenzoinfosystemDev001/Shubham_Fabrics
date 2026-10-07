import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    // Try deleting cascade or deactivate
    try {
      await prisma.userRole.deleteMany({ where: { userId: id } });
      await prisma.user.delete({ where: { id } });
    } catch {
      // If referenced in audit or transactions, deactivate instead
      await prisma.user.update({
        where: { id },
        data: { isActive: false },
      });
    }

    return NextResponse.json({
      success: true,
      message: `User ${user.username} deleted / deactivated successfully.`,
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
  try {
    const { id } = await params;
    const body = await request.json();

    const dataToUpdate: any = {};
    if (body.fullName !== undefined) dataToUpdate.fullName = body.fullName.trim();
    if (body.departmentCode !== undefined) dataToUpdate.departmentCode = body.departmentCode.trim().toUpperCase();
    if (body.isActive !== undefined) dataToUpdate.isActive = Boolean(body.isActive);

    if (body.pin) {
      dataToUpdate.passwordHash = await bcrypt.hash(body.pin.trim(), 10);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
    });

    if (body.roleCode) {
      const role = await prisma.role.findFirst({ where: { code: body.roleCode } });
      if (role) {
        await prisma.userRole.deleteMany({ where: { userId: id } });
        await prisma.userRole.create({
          data: { userId: id, roleId: role.id },
        });
      }
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
