import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import bcrypt from 'bcryptjs';
import { requireUser } from '@/lib/auth/require-user';
import { validatePin } from '@/lib/auth/pin';
import { DELETED_USER_USERNAME } from '@/lib/auth/delete-user';
import { findPinConflict, isUsernameUniqueError, USERNAME_MIGRATION_MESSAGE } from '@/lib/auth/account-resolution';

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
    const requestedEmail = String(body.email || '').trim().toLowerCase();

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
    if (username === 'admin' && departmentCode !== 'ADMIN') {
      return NextResponse.json({ error: 'The username "admin" is reserved for administrators.' }, { status: 400 });
    }

    // A username may be shared by several incharges (and reused after a delete); the PIN tells them apart
    // at sign-in, so it must differ from every account the same login could reach.
    const conflict = await findPinConflict(pin, { username, departmentCode });
    if (conflict) {
      return NextResponse.json(
        {
          error: `"${conflict.fullName}" (${conflict.username}) already uses this PIN on the same login. Choose a different PIN.`,
        },
        { status: 400 }
      );
    }

    // Email stays unique: an explicit one must be free; the default gets a suffix when shared usernames collide.
    let email = requestedEmail;
    if (email) {
      if (await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } })) {
        return NextResponse.json({ error: `Email "${email}" is already used by another account.` }, { status: 400 });
      }
    } else {
      const slug = username.replace(/[^a-z0-9._-]+/g, '.').replace(/^\.+|\.+$/g, '') || 'user';
      email = `${slug}@subhamfabrics.com`;
      for (let n = 2; await prisma.user.findFirst({ where: { email } }); n++) {
        email = `${slug}.${n}@subhamfabrics.com`;
      }
    }

    const passwordHash = await bcrypt.hash(pin, 10);

    // Department and user are created together or not at all. Access comes from the department; users have no roles.
    const newUser = await prisma.$transaction(async (tx) => {
      await tx.department.upsert({
        where: { code: departmentCode },
        update: {},
        create: {
          code: departmentCode,
          name: departmentCode.replace(/_/g, ' '),
          sequenceOrder: 5,
        },
      });
      return tx.user.create({
        data: {
          username,
          fullName,
          email,
          passwordHash,
          departmentCode,
          isActive: true,
        },
      });
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
    if (isUsernameUniqueError(error)) {
      return NextResponse.json({ error: USERNAME_MIGRATION_MESSAGE }, { status: 409 });
    }
    console.error('Error creating admin user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create user' },
      { status: 500 }
    );
  }
}
