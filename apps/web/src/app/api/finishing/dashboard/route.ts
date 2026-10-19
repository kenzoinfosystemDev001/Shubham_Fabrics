import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Incoming Challans to Finishing (from Stitching or upstream)
    const incomingChallans = await prisma.challan.findMany({
      where: {
        toDepartment: { in: ['FINISHING', 'FINISH', 'TRIMMING'] },
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

    // 2. Outgoing Challans issued from Finishing (to downstream department, e.g. Button Attachment or Packing)
    const outgoingChallans = await prisma.challan.findMany({
      where: {
        fromDepartment: { in: ['FINISHING', 'FINISH', 'TRIMMING'] },
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
        issuedBy: { select: { fullName: true, username: true } },
        receivedBy: { select: { fullName: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    // 3. Production transactions recorded by Finishing
    const finishingTransactions = await prisma.productionTransaction.findMany({
      where: {
        departmentCode: { in: ['FINISHING', 'FINISH', 'TRIMMING'] },
      },
      include: {
        operator: { select: { fullName: true, username: true } },
        program: { select: { programNumber: true, designNumber: true, wilcomDesignNumber: true, styleCode: true } },
        challan: { select: { challanNumber: true } },
      },
      orderBy: { recordedAt: 'desc' },
      take: 30,
    });

    // 4. Calculate KPI Metrics
    let awaitingReceiptCount = 0;
    let awaitingReceiptPcs = 0;

    let inQueueCount = 0;
    let inQueuePcs = 0;

    let inProgressCount = 0;
    let inProgressPcs = 0;

    let completedCount = 0;
    let completedPcs = 0;

    let readyForHandoverCount = 0;
    let readyForHandoverPcs = 0;

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
          inQueueCount++;
          inQueuePcs += pcs;
          break;
        case 'IN_PROCESS':
          inProgressCount++;
          inProgressPcs += pcs;
          break;
        case 'COMPLETED':
          completedCount++;
          completedPcs += pcs;
          break;
        case 'READY_FOR_HANDOVER':
        case 'READY_FOR_DISPATCH':
          readyForHandoverCount++;
          readyForHandoverPcs += pcs;
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

    // Output metrics from transactions
    let totalInputPcs = 0;
    let totalGoodPcs = 0;
    let totalReworkPcs = 0;
    let totalRejectPcs = 0;

    finishingTransactions.forEach((tx) => {
      totalInputPcs += Number(tx.inputQuantity) || 0;
      totalGoodPcs += Number(tx.goodQuantity) || 0;
      totalReworkPcs += Number(tx.reworkQuantity) || 0;
      totalRejectPcs += Number(tx.rejectQuantity) || 0;
    });

    const efficiencyRate =
      totalInputPcs > 0
        ? ((totalGoodPcs / totalInputPcs) * 100).toFixed(1)
        : '100.0';

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          awaitingReceiptCount,
          awaitingReceiptPcs,
          inQueueCount,
          inQueuePcs,
          inProgressCount,
          inProgressPcs,
          completedCount,
          completedPcs,
          readyForHandoverCount,
          readyForHandoverPcs,
          handedOverCount,
          handedOverPcs,
          onHoldCount,
          onHoldPcs,
          totalIncomingChallans: incomingChallans.length,
          totalOutgoingChallans: outgoingChallans.length,
          totalInputPcs,
          totalGoodPcs,
          totalReworkPcs,
          totalRejectPcs,
          efficiencyRate,
        },
        incomingChallans,
        outgoingChallans,
        recentTransactions: finishingTransactions,
      },
    });
  } catch (error: any) {
    console.error('Error fetching Finishing dashboard:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load Finishing dashboard data' },
      { status: 500 }
    );
  }
}
