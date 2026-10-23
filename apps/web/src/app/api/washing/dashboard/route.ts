import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'WASHING');
  if (!authUser) return authResponse;
  try {
    // 1. Fetch all Challans dispatched to Washing
    const incomingChallans = await prisma.challan.findMany({
      where: {
        toDepartment: 'WASHING',
      },
      include: {
        program: {
          include: {
            fabrics: true,
            colours: true,
            sizes: true,
            specifications: true,
          },
        },
        items: true,
        issuedBy: {
          select: {
            id: true,
            fullName: true,
            username: true,
          },
        },
        receivedBy: {
          select: {
            id: true,
            fullName: true,
            username: true,
          },
        },
        productionLogs: {
          where: {
            departmentCode: 'WASHING',
          },
          orderBy: { recordedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 2. Fetch all Handover Challans dispatched FROM Washing to Finishing/Store
    const dispatchedChallans = await prisma.challan.findMany({
      where: {
        fromDepartment: 'WASHING',
      },
      include: {
        program: {
          include: {
            fabrics: true,
            colours: true,
            sizes: true,
            specifications: true,
          },
        },
        items: true,
        issuedBy: {
          select: {
            id: true,
            fullName: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    // 3. Fetch Washing Production Transactions
    const washingTransactions = await prisma.productionTransaction.findMany({
      where: {
        departmentCode: 'WASHING',
      },
      include: {
        operator: {
          select: {
            id: true,
            fullName: true,
            username: true,
          },
        },
        program: {
          select: {
            id: true,
            programNumber: true,
            programSerialNo: true,
            clientName: true,
            styleCode: true,
          },
        },
      },
      orderBy: { recordedAt: 'desc' },
      take: 50,
    });

    // 4. Calculate Aggregate Metrics
    let totalPieceIn = 0;
    let totalPieceOut = 0;
    let totalDefectivePieces = 0;
    let activeWashingLots = 0;
    let readyForDispatchLots = 0;
    let completedLots = 0;

    for (const c of incomingChallans) {
      const pIn = c.fabricIn || c.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
      totalPieceIn += pIn;

      if (c.fabricOut) {
        totalPieceOut += c.fabricOut;
      }
      if (c.defectivePieces) {
        totalDefectivePieces += c.defectivePieces;
      }

      if (['ISSUED', 'RECEIVED'].includes(c.status)) {
        // Pending washing
      } else if (c.status === 'IN_PROCESS' || c.status === 'UNDER_INSPECTION') {
        activeWashingLots++;
      } else if (c.status === 'QC_APPROVED' || c.status === 'WASH_COMPLETED') {
        readyForDispatchLots++;
      } else if (c.status === 'COMPLETED') {
        completedLots++;
      }
    }

    // Shrinkage / loss percentage
    const shrinkageRatePercent =
      totalPieceIn > 0 && totalPieceOut > 0
        ? Math.max(0, (((totalPieceIn - totalPieceOut) / totalPieceIn) * 100)).toFixed(2)
        : '0.00';

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalIncomingChallans: incomingChallans.length,
          totalPieceIn,
          totalPieceOut,
          totalDefectivePieces,
          activeWashingLots,
          readyForDispatchLots,
          completedLots,
          dispatchedChallansCount: dispatchedChallans.length,
          shrinkageRatePercent,
        },
        incomingChallans,
        dispatchedChallans,
        washingTransactions,
      },
    });
  } catch (error: any) {
    console.error('Error fetching Washing dashboard data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch Washing dashboard data' },
      { status: 500 }
    );
  }
}
