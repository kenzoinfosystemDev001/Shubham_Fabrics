import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'RECUTTING');
  if (!authUser) return authResponse;
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    // 1. Fetch Production Transactions for RECUTTING
    const transactions = await prisma.productionTransaction.findMany({
      where: {
        departmentCode: { in: ['RECUTTING', 'RE-CUTTING'] },
        ...(Object.keys(dateFilter).length > 0 ? { recordedAt: dateFilter } : {}),
      },
      include: {
        operator: { select: { id: true, fullName: true, username: true } },
        program: {
          select: {
            id: true,
            programNumber: true,
            designNumber: true,
            wilcomDesignNumber: true,
            clientName: true,
            styleCode: true,
            fabricName: true,
          },
        },
        challan: { select: { id: true, challanNumber: true, status: true } },
      },
      orderBy: { recordedAt: 'desc' },
      take: 200,
    });

    // 2. Fetch Defect Records logged during recutting
    const defectRecords = await prisma.defectRecord.findMany({
      where: {
        ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
      },
      include: {
        challan: { select: { challanNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // 3. Compute Aggregates
    let totalInput = 0;
    let totalGood = 0;
    let totalRework = 0;
    let totalReject = 0;

    const operatorMap: Record<string, {
      name: string;
      username: string;
      totalInput: number;
      totalGood: number;
      totalRework: number;
      totalReject: number;
      jobsCompleted: number;
    }> = {};

    const designMap: Record<string, {
      designNumber: string;
      wilcomDesignNumber: string;
      clientName: string;
      totalInput: number;
      totalGood: number;
      totalScrap: number;
    }> = {};

    transactions.forEach((tx) => {
      const input = Number(tx.inputQuantity) || 0;
      const good = Number(tx.goodQuantity) || 0;
      const rework = Number(tx.reworkQuantity) || 0;
      const reject = Number(tx.rejectQuantity) || 0;

      totalInput += input;
      totalGood += good;
      totalRework += rework;
      totalReject += reject;

      // Operator aggregation
      const opKey = tx.operator?.username || 'unknown';
      if (!operatorMap[opKey]) {
        operatorMap[opKey] = {
          name: tx.operator?.fullName || opKey,
          username: opKey,
          totalInput: 0,
          totalGood: 0,
          totalRework: 0,
          totalReject: 0,
          jobsCompleted: 0,
        };
      }
      operatorMap[opKey].totalInput += input;
      operatorMap[opKey].totalGood += good;
      operatorMap[opKey].totalRework += rework;
      operatorMap[opKey].totalReject += reject;
      operatorMap[opKey].jobsCompleted += 1;

      // Design aggregation
      const dKey = tx.program?.designNumber || tx.program?.wilcomDesignNumber || 'Unknown Design';
      if (!designMap[dKey]) {
        designMap[dKey] = {
          designNumber: tx.program?.designNumber || 'N/A',
          wilcomDesignNumber: tx.program?.wilcomDesignNumber || 'N/A',
          clientName: tx.program?.clientName || 'N/A',
          totalInput: 0,
          totalGood: 0,
          totalScrap: 0,
        };
      }
      designMap[dKey].totalInput += input;
      designMap[dKey].totalGood += good;
      designMap[dKey].totalScrap += reject;
    });

    const overallAccuracy = totalInput > 0 ? ((totalGood / totalInput) * 100).toFixed(1) : '100.0';
    const rejectRate = totalInput > 0 ? ((totalReject / totalInput) * 100).toFixed(1) : '0.0';

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalInput,
          totalGood,
          totalRework,
          totalReject,
          overallAccuracy: Number(overallAccuracy),
          rejectRate: Number(rejectRate),
          totalTransactions: transactions.length,
        },
        operatorPerformance: Object.values(operatorMap),
        designPerformance: Object.values(designMap),
        recentTransactions: transactions,
        defectRecords,
      },
    });
  } catch (error: any) {
    console.error('Error fetching Recutting reports:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch Recutting reports data' },
      { status: 500 }
    );
  }
}
