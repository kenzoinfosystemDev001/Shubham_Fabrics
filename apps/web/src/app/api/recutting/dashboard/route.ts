import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Incoming Challans from QC Washing (QC3)
    const incomingChallans = await prisma.challan.findMany({
      where: {
        toDepartment: { in: ['RECUTTING', 'RE-CUTTING', 'CUTTING_RECUT'] },
      },
      include: {
        program: {
          select: {
            id: true,
            programNumber: true,
            programSerialNo: true,
            clientName: true,
            buyerName: true,
            styleCode: true,
            designNumber: true,
            wilcomDesignNumber: true,
            fabricName: true,
            targetQuantity: true,
            quantityMeasurement: true,
          },
        },
        items: true,
        issuedBy: { select: { fullName: true, username: true } },
        receivedBy: { select: { fullName: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // 2. Handover Challans issued from Recutting to Stitching
    const outgoingChallans = await prisma.challan.findMany({
      where: {
        fromDepartment: { in: ['RECUTTING', 'RE-CUTTING'] },
        toDepartment: 'STITCHING',
      },
      include: {
        program: {
          select: {
            programNumber: true,
            programSerialNo: true,
            clientName: true,
            styleCode: true,
            designNumber: true,
            wilcomDesignNumber: true,
          },
        },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // 3. Production transactions recorded by Recutting
    const recuttingTransactions = await prisma.productionTransaction.findMany({
      where: {
        departmentCode: { in: ['RECUTTING', 'RE-CUTTING'] },
      },
      include: {
        operator: { select: { fullName: true, username: true } },
        program: { select: { programNumber: true, designNumber: true, wilcomDesignNumber: true } },
        challan: { select: { challanNumber: true } },
      },
      orderBy: { recordedAt: 'desc' },
      take: 30,
    });

    // 4. Calculate KPI Metrics
    let awaitingReceiptCount = 0;
    let awaitingReceiptPcs = 0;

    let inCuttingQueueCount = 0;
    let inCuttingQueuePcs = 0;

    let inProgressCount = 0;
    let inProgressPcs = 0;

    let completedVerificationCount = 0;
    let completedVerificationPcs = 0;

    let readyForStitchingCount = 0;
    let readyForStitchingPcs = 0;

    let handedOverCount = 0;
    let handedOverPcs = 0;

    let onHoldCount = 0;
    let onHoldPcs = 0;

    incomingChallans.forEach((ch) => {
      const pcs = ch.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      switch (ch.status) {
        case 'ISSUED':
          awaitingReceiptCount++;
          awaitingReceiptPcs += pcs;
          break;
        case 'RECEIVED':
          inCuttingQueueCount++;
          inCuttingQueuePcs += pcs;
          break;
        case 'IN_PROCESS':
          inProgressCount++;
          inProgressPcs += pcs;
          break;
        case 'COMPLETED':
          completedVerificationCount++;
          completedVerificationPcs += pcs;
          break;
        case 'READY_FOR_STITCHING':
          readyForStitchingCount++;
          readyForStitchingPcs += pcs;
          break;
        case 'HANDED_OVER':
          handedOverCount++;
          handedOverPcs += pcs;
          break;
        case 'ON_HOLD':
          onHoldCount++;
          onHoldPcs += pcs;
          break;
        default:
          break;
      }
    });

    // Total cut production metrics from transactions
    let totalProcessedPcs = 0;
    let totalGoodCutPcs = 0;
    let totalRetrimPcs = 0;
    let totalRejectPcs = 0;

    recuttingTransactions.forEach((tx) => {
      totalProcessedPcs += Number(tx.inputQuantity) || 0;
      totalGoodCutPcs += Number(tx.goodQuantity) || 0;
      totalRetrimPcs += Number(tx.reworkQuantity) || 0;
      totalRejectPcs += Number(tx.rejectQuantity) || 0;
    });

    const accuracyRate =
      totalProcessedPcs > 0
        ? ((totalGoodCutPcs / totalProcessedPcs) * 100).toFixed(1)
        : '100.0';

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          awaitingReceiptCount,
          awaitingReceiptPcs,
          inCuttingQueueCount,
          inCuttingQueuePcs,
          inProgressCount,
          inProgressPcs,
          completedVerificationCount,
          completedVerificationPcs,
          readyForStitchingCount,
          readyForStitchingPcs,
          handedOverCount,
          handedOverPcs,
          onHoldCount,
          onHoldPcs,
          totalIncomingChallans: incomingChallans.length,
          totalOutgoingChallans: outgoingChallans.length,
          totalProcessedPcs,
          totalGoodCutPcs,
          totalRetrimPcs,
          totalRejectPcs,
          accuracyRate,
        },
        incomingChallans,
        outgoingChallans,
        recentTransactions: recuttingTransactions,
      },
    });
  } catch (error: any) {
    console.error('Error fetching Recutting dashboard:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load Recutting dashboard data' },
      { status: 500 }
    );
  }
}
