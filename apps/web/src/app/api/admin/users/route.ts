import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import bcrypt from 'bcryptjs';
import { requireUser } from '@/lib/auth/require-user';
import { validatePin } from '@/lib/auth/pin';
import { DELETED_USER_USERNAME } from '@/lib/auth/delete-user';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { user: authUser, response: authResponse } = await requireUser(request, { admin: true });
  if (!authUser) return authResponse;
  try {
    const users = await prisma.user.findMany({
      // "Deleted User" only stands in on records of removed users; it is not an account to manage.
      where: { username: { not: DELETED_USER_USERNAME } },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        departmentCode: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
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
  const { user: authUser, response: authResponse } = await requireUser(request, { admin: true });
  if (!authUser) return authResponse;
  try {
    const body = await request.json();
    const username = (body.username || '').trim().toLowerCase();
    const fullName = (body.fullName || '').trim();
    const pin = String(body.pin || body.password || '').trim();
    const departmentCode = (body.departmentCode || 'PROGRAMMING').trim().toUpperCase();
    const email = (body.email || `${username}@subhamfabrics.com`).trim().toLowerCase();

    if (!username || !fullName) {
      return NextResponse.json(
        { error: 'Username and Full Name are required.' },
        { status: 400 }
      );
    }

    const pinError = validatePin(pin);
    if (pinError) {
      return NextResponse.json({ error: pinError }, { status: 400 });
    }

    if (username === DELETED_USER_USERNAME) {
      return NextResponse.json({ error: `The username "${DELETED_USER_USERNAME}" is reserved.` }, { status: 400 });
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

    // Create user. Access comes from the department; users have no roles.
    const newUser = await prisma.user.create({
      data: {
        username,
        fullName,
        email,
        passwordHash,
        departmentCode,
        isActive: true,
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
