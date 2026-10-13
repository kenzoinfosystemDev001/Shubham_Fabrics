import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Fetch incoming challans to Thread Cutting (primarily from Embroidery)
    const incomingChallans = await prisma.challan.findMany({
      where: {
        toDepartment: 'THREAD_CUTTING',
      },
      include: {
        parentChallan: {
          select: {
            id: true,
            challanNumber: true,
            fromDepartment: true,
            toDepartment: true,
            status: true,
            remarks: true,
          },
        },
        program: {
          select: {
            id: true,
            programNumber: true,
            programSerialNo: true,
            clientName: true,
            buyerName: true,
            mainStyle: true,
            wilcomDesignNumber: true,
            embroideryDesign: true,
            fabricColor: true,
            targetQuantity: true,
            priority: true,
          },
        },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });

    // 2. Fetch outgoing challans from Thread Cutting (towards QC2)
    const outgoingChallans = await prisma.challan.findMany({
      where: {
        fromDepartment: 'THREAD_CUTTING',
      },
      include: {
        program: {
          select: {
            id: true,
            programNumber: true,
            programSerialNo: true,
            clientName: true,
            buyerName: true,
            mainStyle: true,
            wilcomDesignNumber: true,
          },
        },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });

    // 3. Fetch active programs
    const activePrograms = await prisma.program.findMany({
      select: {
        id: true,
        programNumber: true,
        programSerialNo: true,
        clientName: true,
        buyerName: true,
        mainStyle: true,
        wilcomDesignNumber: true,
        fabricColor: true,
        targetQuantity: true,
        status: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const pendingCount = incomingChallans.filter(
      (c) => c.status === 'ISSUED' || c.status === 'DRAFT'
    ).length;
    const inProcessCount = incomingChallans.filter(
      (c) => c.status === 'RECEIVED' || c.status === 'IN_PROGRESS'
    ).length;
    const readyForQc2 = incomingChallans.filter(
      (c) => c.status === 'COMPLETED'
    ).length;

    const totalPiecesIn = incomingChallans.reduce((acc, c) => {
      const p = (c.items || []).reduce(
        (sub, it) => sub + (Number(it.quantity) || 0),
        0
      );
      return acc + p;
    }, 0);

    const outgoingQc2Challans = outgoingChallans.filter(
      (c) => c.toDepartment === 'QC2'
    );
    const defectReturnChallans = outgoingChallans.filter(
      (c) => c.toDepartment === 'STORE' || c.challanType === 'DEFECT_RETURN'
    );

    const totalPiecesOut = outgoingQc2Challans.reduce((acc, c) => {
      const p = (c.items || []).reduce(
        (sub, it) => sub + (Number(it.quantity) || 0),
        0
      );
      return acc + p;
    }, 0);

    const totalDefectivePieces = defectReturnChallans.reduce((acc, c) => {
      const p = (c.items || []).reduce(
        (sub, it) => sub + (Number(it.quantity) || 0),
        0
      );
      return acc + p;
    }, 0);

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalIncoming: incomingChallans.length,
          pendingAcceptance: pendingCount,
          inProgressTrimming: inProcessCount,
          readyForQc2,
          totalOutgoingQc2: outgoingQc2Challans.length,
          totalDefectReturns: defectReturnChallans.length,
          totalPiecesIn,
          totalPiecesOut,
          totalDefectivePieces,
        },
        incomingChallans,
        outgoingChallans: outgoingQc2Challans,
        defectReturnChallans,
        programs: activePrograms,
      },
    });
  } catch (err: any) {
    console.error('Error in thread-cutting dashboard API:', err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to load Thread Cutting dashboard data',
      },
      { status: 500 }
    );
  }
}
