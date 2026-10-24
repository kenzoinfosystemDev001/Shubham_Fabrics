import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import bcrypt from 'bcryptjs';
import { auditAdminAction, requireAdmin } from '@/lib/admin-auth';
import { validatePin } from '@/lib/admin-users';
import { ACCOUNT_DEPARTMENT_CODES } from '@/lib/departments';
import { ADMIN_USER_SELECT, formatAdminUser } from '@/lib/admin-users-db';

export const dynamic = 'force-dynamic';

// GET /api/admin/users?search=&department=&role=&status=ACTIVE|INACTIVE
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.actor) return auth.response;
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim();
    const department = searchParams.get('department')?.trim().toUpperCase();
    const role = searchParams.get('role')?.trim().toUpperCase();
    const status = searchParams.get('status')?.trim().toUpperCase();

    const where: any = {};
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (department) where.departmentCode = department;
    if (role) where.userRoles = { some: { role: { code: role } } };
    if (status === 'ACTIVE') where.isActive = true;
    if (status === 'INACTIVE') where.isActive = false;

    const users = await prisma.user.findMany({ where, select: ADMIN_USER_SELECT, orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }] });
    return NextResponse.json(users.map(formatAdminUser));
  } catch (error: any) {
    console.error('Error fetching admin users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

// POST /api/admin/users  { username, fullName, email?, departmentCode, roleCodes[] | roleCode, pin }
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.actor) return auth.response;
  try {
    const body = await request.json();
    const username = String(body.username || '').trim().toLowerCase();
    const fullName = String(body.fullName || '').trim();
    const departmentCode = String(body.departmentCode || '').trim().toUpperCase();
    const roleCodes: string[] = Array.from(new Set(
      (Array.isArray(body.roleCodes) ? body.roleCodes : body.roleCode ? [body.roleCode] : [])
        .map((r: unknown) => String(r).trim().toUpperCase())
        .filter(Boolean)
    ));
    const email = String(body.email || '').trim().toLowerCase() || `${username}@subhamfabrics.com`;

    if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
      return NextResponse.json({ error: 'Username must be 3–40 characters: letters, numbers, dot, dash or underscore.', field: 'username' }, { status: 400 });
    }
    if (!fullName) return NextResponse.json({ error: 'Full name is required.', field: 'fullName' }, { status: 400 });
    if (!ACCOUNT_DEPARTMENT_CODES.includes(departmentCode)) {
      return NextResponse.json({ error: 'Select a valid department.', field: 'departmentCode' }, { status: 400 });
    }
    if (roleCodes.length === 0) return NextResponse.json({ error: 'Assign at least one role.', field: 'roleCodes' }, { status: 400 });
    const pinError = validatePin(body.pin);
    if (pinError) return NextResponse.json({ error: pinError, field: 'pin' }, { status: 400 });

    const roles = await prisma.role.findMany({ where: { code: { in: roleCodes } }, select: { id: true, code: true } });
    const missing = roleCodes.filter((code) => !roles.some((r) => r.code === code));
    if (missing.length > 0) {
      return NextResponse.json({ error: `Unknown role: ${missing.join(', ')}. Create the role first.`, field: 'roleCodes' }, { status: 400 });
    }
    // Only a Super Admin can grant Super Admin.
    if (roleCodes.includes('SUPER_ADMIN') && !auth.actor.roles.includes('SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Only a Super Admin can grant the Super Admin role.' }, { status: 403 });
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ username: { equals: username, mode: 'insensitive' } }, { email: { equals: email, mode: 'insensitive' } }] },
      select: { id: true },
    });
    if (existing) return NextResponse.json({ error: `A user with username "${username}" or email "${email}" already exists.` }, { status: 409 });

    const passwordHash = await bcrypt.hash(String(body.pin), 10);
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username,
          fullName,
          email,
          passwordHash,
          departmentCode,
          isActive: true,
          userRoles: { create: roles.map((r) => ({ roleId: r.id })) },
        },
        select: ADMIN_USER_SELECT,
      });
      await auditAdminAction(request, auth.actor.id, 'USER_CREATED', 'User', user.id, {
        after: { username, fullName, email, departmentCode, roles: roleCodes },
      }, tx);
      return user;
    });

    return NextResponse.json({ success: true, user: formatAdminUser(created) }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') return NextResponse.json({ error: 'Username or email already exists.' }, { status: 409 });
    console.error('Error creating admin user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
