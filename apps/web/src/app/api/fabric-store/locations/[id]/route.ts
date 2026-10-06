import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

// PATCH /api/fabric-store/locations/[id]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { locationCode, locationName, locationType, isActive } = body;

    const location = await prisma.inventoryLocation.update({
      where: { id },
      data: {
        ...(locationCode && { locationCode: locationCode.toUpperCase() }),
        ...(locationName && { locationName }),
        ...(locationType && { locationType }),
        ...(typeof isActive === 'boolean' && { isActive }),
      },
    });

    return NextResponse.json({ data: location });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/fabric-store/locations/[id] → soft delete
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.inventoryLocation.update({
      where: { id },
      data: { isActive: false },
    });
    return NextResponse.json({ message: 'Location deactivated' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
