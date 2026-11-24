import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import { requireDepartment } from '@/lib/auth/department-access';

export const dynamic = 'force-dynamic';

// GET /api/fabric-store/locations
export async function GET(request: Request) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'STORE');
  if (!authUser) return authResponse;
  try {
    const locations = await prisma.inventoryLocation.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { rolls: true } },
      },
      orderBy: { locationCode: 'asc' },
    });
    return NextResponse.json({ data: locations });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/fabric-store/locations
export async function POST(request: Request) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'STORE');
  if (!authUser) return authResponse;
  try {
    const body = await request.json();
    const { locationCode, locationName, locationType } = body;

    if (!locationCode || !locationName) {
      return NextResponse.json({ error: 'locationCode and locationName are required' }, { status: 400 });
    }

    const location = await prisma.inventoryLocation.create({
      data: {
        locationCode: locationCode.toUpperCase(),
        locationName,
        locationType: locationType || 'RACK',
      },
    });

    return NextResponse.json({ data: location }, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Location code already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
