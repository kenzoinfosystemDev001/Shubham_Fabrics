import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let user = null;
    try {
      user = await prisma.user.findFirst({
        where: { username: 'programmer' },
        include: {
          userRoles: {
            include: { role: true },
          },
        },
      });
    } catch (e) {
      console.warn('DB lookup failed in auth/me:', e);
    }

    if (!user) {
      return NextResponse.json({
        id: 'b88c0139-8ce6-4d87-8aff-421eb2ef6365',
        username: 'programmer',
        fullName: 'Programming Incharge',
        role: 'PROGRAMMING_INCHARGE',
        departmentCode: 'PROGRAMMING',
      });
    }

    return NextResponse.json({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.userRoles[0]?.role.code || 'PROGRAMMER',
      roles: user.userRoles.map((ur) => ur.role.code),
      departmentCode: user.departmentCode || 'PROGRAMMING',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
