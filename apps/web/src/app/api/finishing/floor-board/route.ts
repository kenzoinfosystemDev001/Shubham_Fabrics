import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const challans = await prisma.challan.findMany({
      where: {
        toDepartment: { in: ['FINISHING', 'FINISH', 'TRIMMING'] },
      },
      include: {
        program: {
          select: {
            id: true,
            programNumber: true,
            styleCode: true,
            clientName: true,
            designNumber: true,
            wilcomDesignNumber: true,
            targetQuantity: true,
          },
        },
        items: true,
        issuedBy: { select: { fullName: true, username: true } },
        receivedBy: { select: { fullName: true, username: true } },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const lanes = {
      INCOMING: [] as any[],
      IN_FINISHING: [] as any[],
      INSPECTION: [] as any[],
      READY_FOR_DISPATCH: [] as any[],
    };

    challans.forEach((ch) => {
      const totalPcs = ch.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
      const card = {
        id: ch.id,
        challanNumber: ch.challanNumber,
        status: ch.status,
        priority: ch.priority,
        programNumber: ch.program?.programNumber || 'N/A',
        styleCode: ch.program?.styleCode || 'Standard',
        clientName: ch.program?.clientName || 'Confidential',
        designNumber: ch.program?.designNumber || ch.program?.wilcomDesignNumber || '-',
        totalPieces: totalPcs,
        goodPieces: ch.fabricOut || 0,
        remarks: ch.remarks,
        createdAt: ch.createdAt,
        updatedAt: ch.updatedAt,
      };

      if (ch.status === 'ISSUED') {
        lanes.INCOMING.push(card);
      } else if (ch.status === 'RECEIVED' || ch.status === 'IN_PROCESS' || ch.status === 'ON_HOLD') {
        lanes.IN_FINISHING.push(card);
      } else if (ch.status === 'COMPLETED') {
        lanes.INSPECTION.push(card);
      } else if (
        ch.status === 'READY_FOR_HANDOVER' ||
        ch.status === 'READY_FOR_DISPATCH' ||
        ch.status === 'HANDED_OVER'
      ) {
        lanes.READY_FOR_DISPATCH.push(card);
      } else {
        lanes.IN_FINISHING.push(card);
      }
    });

    return NextResponse.json({
      success: true,
      data: lanes,
    });
  } catch (error: any) {
    console.error('Error fetching Finishing floor board:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load Finishing floor board' },
      { status: 500 }
    );
  }
}
