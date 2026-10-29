import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import { requireDepartment } from '@/lib/auth/department-access';
import {
  checkFabricStoreAvailability,
  updateFabricStoreAvailability,
} from '@/lib/fabric-availability';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'STORE', 'PROGRAMMING');
  if (!authUser) return authResponse;
  try {
    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('programId');
    const requestedUnit = searchParams.get('unit')?.toUpperCase();
    const unitOverride = requestedUnit === 'PCS' || requestedUnit === 'MTR' ? requestedUnit : undefined;

    if (programId) {
      const status = await checkFabricStoreAvailability(programId, unitOverride);
      return NextResponse.json({ success: true, data: status });
    }

    // If no programId provided, return availability for all active programs
    const activePrograms = await prisma.program.findMany({
      where: {
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
      select: {
        id: true,
        programNumber: true,
        programSerialNo: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const results = await Promise.all(
      activePrograms.map((p) => checkFabricStoreAvailability(p.id))
    );

    return NextResponse.json({
      success: true,
      count: results.length,
      data: results,
    });
  } catch (error: any) {
    console.error('Error checking fabric store availability:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check fabric availability' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'STORE');
  if (!authUser) return authResponse;
  try {
    const body = await request.json();
    const { programId, isAvailable, remarks } = body;

    if (!programId) {
      return NextResponse.json(
        { error: 'programId is required' },
        { status: 400 }
      );
    }

    if (typeof isAvailable !== 'boolean') {
      return NextResponse.json(
        { error: 'isAvailable (boolean) is required' },
        { status: 400 }
      );
    }

    const updated = await updateFabricStoreAvailability(
      programId,
      isAvailable,
      authUser.fullName,
      remarks
    );

    return NextResponse.json({
      success: true,
      data: updated,
      message: isAvailable
        ? `Fabric verified available in store. Production sheet ${updated.programSerialNo} is now cleared to move to ${updated.destinationDepartment}.`
        : `Fabric marked unavailable. Production sheet ${updated.programSerialNo} is now held at Fabric Store.`,
    });
  } catch (error: any) {
    console.error('Error updating fabric store availability:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update fabric availability' },
      { status: 500 }
    );
  }
}
