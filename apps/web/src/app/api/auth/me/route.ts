import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const cookieStore = await cookies();
    const cookieToken = cookieStore.get('subham_mes_token')?.value || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim() || cookieToken;

    let userId: string | null = null;
    if (token && token.startsWith('mes_jwt_')) {
      const parts = token.split('_');
      // Format: mes_jwt_<userId>_<timestamp>
      if (parts.length >= 3) {
        userId = parts[2];
      }
    }

    let user = null;
    if (userId) {
      try {
        user = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            userRoles: {
              include: { role: true },
            },
          },
        });
      } catch (e) {
        console.warn('DB lookup by id failed in auth/me:', e);
      }
    }

    // Fallback: check cookie dept or username
    if (!user) {
      const cookieDept = cookieStore.get('subham_mes_dept')?.value || '';
      if (cookieDept) {
        user = await prisma.user.findFirst({
          where: { departmentCode: cookieDept },
          include: {
            userRoles: {
              include: { role: true },
            },
          },
        });
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const roleCodes = user.userRoles.map((ur: any) => ur.role.code.toUpperCase());
    const role = roleCodes[0] || 'USER';

    return NextResponse.json({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: role,
      roles: roleCodes,
      departmentCode: user.departmentCode,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
