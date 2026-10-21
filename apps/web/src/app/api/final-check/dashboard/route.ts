import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const FINAL_CHECK_DEPTS = ['FINAL_CHECK', 'FINAL CHECK', 'FINAL_QC', 'FINAL-CHECK'];

    const incomingChallans = await prisma.challan.findMany({
      where: {
        toDepartment: { in: FINAL_CHECK_DEPTS },
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

    const outgoingChallans = await prisma.challan.findMany({
      where: {
        fromDepartment: { in: FINAL_CHECK_DEPTS },
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

    const finalCheckTransactions = await prisma.productionTransaction.findMany({
      where: {
        departmentCode: { in: FINAL_CHECK_DEPTS },
      },
      include: {
        operator: { select: { fullName: true, username: true } },
        program: { select: { programNumber: true, designNumber: true, wilcomDesignNumber: true, styleCode: true } },
        challan: { select: { challanNumber: true } },
      },
      orderBy: { recordedAt: 'desc' },
      take: 30,
    });

    let awaitingReceiptCount = 0, awaitingReceiptPcs = 0;
    let inQueueCount = 0, inQueuePcs = 0;
    let inProgressCount = 0, inProgressPcs = 0;
    let completedCount = 0, completedPcs = 0;
    let readyForHandoverCount = 0, readyForHandoverPcs = 0;
    let handedOverCount = 0, handedOverPcs = 0;
    let onHoldCount = 0, onHoldPcs = 0;

    incomingChallans.forEach((ch) => {
      const pcs = ch.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      switch (ch.status) {
        case 'ISSUED': awaitingReceiptCount++; awaitingReceiptPcs += pcs; break;
        case 'RECEIVED': inQueueCount++; inQueuePcs += pcs; break;
        case 'IN_PROCESS': inProgressCount++; inProgressPcs += pcs; break;
        case 'COMPLETED': completedCount++; completedPcs += pcs; break;
        case 'READY_FOR_HANDOVER':
        case 'READY_FOR_DISPATCH': readyForHandoverCount++; readyForHandoverPcs += pcs; break;
        case 'HANDED_OVER': handedOverCount++; handedOverPcs += pcs; break;
        case 'ON_HOLD': onHoldCount++; onHoldPcs += pcs; break;
      }
    });

    let totalInputPcs = 0, totalAcceptedPcs = 0, totalReworkPcs = 0, totalRejectPcs = 0;

    finalCheckTransactions.forEach((tx) => {
      totalInputPcs += Number(tx.inputQuantity) || 0;
      totalAcceptedPcs += Number(tx.goodQuantity) || 0;
      totalReworkPcs += Number(tx.reworkQuantity) || 0;
      totalRejectPcs += Number(tx.rejectQuantity) || 0;
    });

    const firstPassYield = totalInputPcs > 0
      ? ((totalAcceptedPcs / totalInputPcs) * 100).toFixed(1)
      : '100.0';

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          awaitingReceiptCount, awaitingReceiptPcs,
          inQueueCount, inQueuePcs,
          inProgressCount, inProgressPcs,
          completedCount, completedPcs,
          readyForHandoverCount, readyForHandoverPcs,
          handedOverCount, handedOverPcs,
          onHoldCount, onHoldPcs,
          totalIncomingChallans: incomingChallans.length,
          totalOutgoingChallans: outgoingChallans.length,
          totalInputPcs, totalAcceptedPcs, totalReworkPcs, totalRejectPcs,
          firstPassYield,
        },
        incomingChallans,
        outgoingChallans,
        recentTransactions: finalCheckTransactions,
      },
    });
  } catch (error: any) {
    console.error('Error fetching Final QC dashboard:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load Final QC dashboard data' },
      { status: 500 }
    );
  }
}
