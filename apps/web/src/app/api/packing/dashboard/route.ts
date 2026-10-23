import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { getPackingActor } from '@/lib/packing-auth';

export const dynamic = 'force-dynamic';

const PACKING_DEPTS = ['PACKING', 'PACK', 'FOLDING'];

export async function GET(request: Request) {
  try {
    const auth = await getPackingActor(request);
    if (!auth.actor) return auth.response;

    // 1. Incoming challans from Final QC (or upstream)
    const incomingChallans = await prisma.challan.findMany({
      where: {
        toDepartment: { in: PACKING_DEPTS },
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

    // 2. Cartons packed in Packing / FG Store
    const recentCartons = await prisma.carton.findMany({
      include: {
        program: {
          select: {
            programNumber: true,
            styleCode: true,
            clientName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // 3. Finished Goods Inventory Stock Balances
    const fgStockBalances = await prisma.inventoryStock.findMany({
      where: {
        departmentCode: 'FINISHED_GOODS',
      },
      orderBy: { updatedAt: 'desc' },
      take: 30,
    });

    // 4. Recent Packing Production Transactions
    const packingTransactions = await prisma.productionTransaction.findMany({
      where: {
        departmentCode: { in: PACKING_DEPTS },
      },
      include: {
        operator: { select: { fullName: true, username: true } },
        program: {
          select: {
            programNumber: true,
            designNumber: true,
            wilcomDesignNumber: true,
            styleCode: true,
          },
        },
        challan: { select: { challanNumber: true } },
      },
      orderBy: { recordedAt: 'desc' },
      take: 30,
    });

    // 5. Calculate Metrics
    let awaitingInwardCount = 0;
    let awaitingInwardPcs = 0;

    let readyToPackCount = 0;
    let readyToPackPcs = 0;

    let inProgressCount = 0;
    let inProgressPcs = 0;

    let completedCount = 0;
    let completedPcs = 0;

    let onHoldCount = 0;
    let onHoldPcs = 0;

    incomingChallans.forEach((ch) => {
      const pcs = ch.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      switch (ch.status) {
        case 'ISSUED':
          awaitingInwardCount++;
          awaitingInwardPcs += pcs;
          break;
        case 'RECEIVED':
          readyToPackCount++;
          readyToPackPcs += pcs;
          break;
        case 'IN_PROCESS':
          inProgressCount++;
          inProgressPcs += pcs;
          break;
        case 'COMPLETED':
        case 'READY_FOR_HANDOVER':
        case 'READY_FOR_DISPATCH':
          completedCount++;
          completedPcs += pcs;
          break;
        case 'ON_HOLD':
          onHoldCount++;
          onHoldPcs += pcs;
          break;
        default:
          break;
      }
    });

    // Finished Goods stock total
    const totalFgStockPcs = fgStockBalances.reduce(
      (sum, stock) => sum + (Number(stock.currentQuantity) || 0),
      0
    );

    // Total Cartons in warehouse
    const totalCartonsCount = await prisma.carton.count();

    // Total Packed Pieces from transactions
    let totalPackedPcs = 0;
    packingTransactions.forEach((tx) => {
      totalPackedPcs += Number(tx.goodQuantity) || 0;
    });

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          awaitingInwardCount,
          awaitingInwardPcs,
          readyToPackCount,
          readyToPackPcs,
          inProgressCount,
          inProgressPcs,
          completedCount,
          completedPcs,
          onHoldCount,
          onHoldPcs,
          totalIncomingChallans: incomingChallans.length,
          totalCartonsCount,
          totalFgStockPcs,
          totalPackedPcs,
        },
        incomingChallans,
        recentCartons,
        fgStockBalances,
        recentTransactions: packingTransactions,
      },
    });
  } catch (error: any) {
    console.error('Error fetching Packing dashboard:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load Packing dashboard data' },
      { status: 500 }
    );
  }
}
