import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const transactions = await prisma.productionTransaction.findMany({
      where: {
        departmentCode: { in: ['STEAM_PRESS', 'STEAM_PRESSING', 'PRESSING'] },
      },
      include: {
        operator: { select: { id: true, fullName: true, username: true } },
        program: {
          select: {
            id: true,
            programNumber: true,
            styleCode: true,
            clientName: true,
            designNumber: true,
            fabricName: true,
          },
        },
        challan: {
          select: {
            id: true,
            challanNumber: true,
          },
        },
      },
      orderBy: { recordedAt: 'desc' },
      take: 200,
    });

    const defects = await prisma.defectRecord.findMany({
      where: {
        departmentCode: { in: ['STEAM_PRESS', 'STEAM_PRESSING', 'PRESSING'] },
      },
      include: {
        program: { select: { programNumber: true, styleCode: true } },
        challan: { select: { challanNumber: true } },
        detectedBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Style-wise metrics
    const styleWiseMetrics: Record<
      string,
      { styleCode: string; totalInput: number; totalGood: number; totalRework: number; totalReject: number }
    > = {};

    transactions.forEach((tx) => {
      const style = tx.program?.styleCode || 'Standard';
      if (!styleWiseMetrics[style]) {
        styleWiseMetrics[style] = {
          styleCode: style,
          totalInput: 0,
          totalGood: 0,
          totalRework: 0,
          totalReject: 0,
        };
      }
      styleWiseMetrics[style].totalInput += Number(tx.inputQuantity) || 0;
      styleWiseMetrics[style].totalGood += Number(tx.goodQuantity) || 0;
      styleWiseMetrics[style].totalRework += Number(tx.reworkQuantity) || 0;
      styleWiseMetrics[style].totalReject += Number(tx.rejectQuantity) || 0;
    });

    // Defect categorization
    const defectDistribution: Record<string, number> = {};
    defects.forEach((d) => {
      const reason = d.reason || d.defectCode || 'Other Pressing Defect';
      defectDistribution[reason] = (defectDistribution[reason] || 0) + (d.quantity || 1);
    });

    return NextResponse.json({
      success: true,
      data: {
        transactions,
        defects,
        styleWiseMetrics: Object.values(styleWiseMetrics),
        defectDistribution,
      },
    });
  } catch (error: any) {
    console.error('Error fetching Steam Press reports:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch Steam Press reports' },
      { status: 500 }
    );
  }
}
