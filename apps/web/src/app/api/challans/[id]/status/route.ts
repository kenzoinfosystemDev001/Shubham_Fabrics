import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, notes } = body;

    const data: any = {};
    if (status) {
      data.status = status;
      if (status === 'RECEIVED') {
        data.receivedDate = new Date();
      } else if (status === 'COMPLETED') {
        data.completedDate = new Date();
      }
    }
    if (notes) {
      data.remarks = notes;
    }

    const updated = await prisma.challan.update({
      where: { id },
      data,
      include: {
        program: true,
        items: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating challan status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update challan status' },
      { status: 500 }
    );
  }
}
