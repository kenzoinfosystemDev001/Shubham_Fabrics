import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        departmentCode: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        userRoles: {
          select: {
            role: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = users.map((u) => ({
      id: u.id,
      username: u.username,
      fullName: u.fullName,
      email: u.email,
      departmentCode: u.departmentCode || 'STORE',
      isActive: u.isActive,
      createdAt: u.createdAt,
      role: u.userRoles?.[0]?.role?.code || 'USER',
      roleName: u.userRoles?.[0]?.role?.name || 'Standard User',
    }));

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error('Error fetching admin users:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = (body.username || '').trim().toLowerCase();
    const fullName = (body.fullName || '').trim();
    const pin = (body.pin || body.password || '1234').trim();
    const departmentCode = (body.departmentCode || 'PROGRAMMING').trim().toUpperCase();
    const roleCode = (body.roleCode || (departmentCode === 'ADMIN' ? 'ADMIN' : departmentCode === 'STORE' ? 'FABRIC_STORE' : 'PROGRAMMING_INCHARGE')).trim();
    const email = (body.email || `${username}@subhamfabrics.com`).trim().toLowerCase();

    if (!username || !fullName) {
      return NextResponse.json(
        { error: 'Username and Full Name are required.' },
        { status: 400 }
      );
    }

    // Check if username already exists
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `User with username "${username}" or email "${email}" already exists.` },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(pin, 10);

    // Ensure role exists
    let role = await prisma.role.findFirst({ where: { code: roleCode } });
    if (!role) {
      role = await prisma.role.create({
        data: {
          code: roleCode,
          name: roleCode.replace(/_/g, ' '),
          description: `Custom ${roleCode} role`,
          isSystem: false,
        },
      });
    }

    // Ensure department exists
    await prisma.department.upsert({
      where: { code: departmentCode },
      update: {},
      create: {
        code: departmentCode,
        name: departmentCode.replace(/_/g, ' '),
        sequenceOrder: 5,
      },
    });

    // Create user
    const newUser = await prisma.user.create({
      data: {
        username,
        fullName,
        email,
        passwordHash,
        departmentCode,
        isActive: true,
        userRoles: {
          create: {
            roleId: role.id,
          },
        },
      },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        username: newUser.username,
        fullName: newUser.fullName,
        email: newUser.email,
        departmentCode: newUser.departmentCode,
        role: newUser.userRoles?.[0]?.role?.code,
        isActive: newUser.isActive,
      },
    });
  } catch (error: any) {
    console.error('Error creating admin user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create user' },
      { status: 500 }
    );
  }
}
