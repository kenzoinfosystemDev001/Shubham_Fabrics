import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

// GET /api/admin/roles — every role, its stored permissions and the users who hold it.
// Roles are assigned to users through PATCH /api/admin/users/:id.
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.actor) return auth.response;
  try {
    const roles = await prisma.role.findMany({
      orderBy: [{ isSystem: 'desc' }, { code: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isSystem: true,
        rolePerms: { select: { permission: { select: { module: true, resource: true, action: true, description: true } } } },
        userRoles: { select: { user: { select: { id: true, fullName: true, username: true, isActive: true, departmentCode: true } } } },
      },
    });
    return NextResponse.json({
      success: true,
      data: roles.map((role) => ({
        id: role.id,
        code: role.code,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        protected: role.code === 'SUPER_ADMIN',
        permissions: role.rolePerms.map((rp) => rp.permission).sort((a, b) => `${a.module}${a.resource}${a.action}`.localeCompare(`${b.module}${b.resource}${b.action}`)),
        users: role.userRoles.map((ur) => ur.user),
      })),
    });
  } catch (error: any) {
    console.error('Error loading roles:', error);
    return NextResponse.json({ error: 'Failed to load roles' }, { status: 500 });
  }
}
