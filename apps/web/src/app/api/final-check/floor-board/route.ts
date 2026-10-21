import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

const FINAL_CHECK_DEPTS = ['FINAL_CHECK', 'FINAL CHECK', 'FINAL_QC', 'FINAL-CHECK'];

export async function GET() {
  try {
    const allJobs = await prisma.challan.findMany({
      where: {
        toDepartment: { in: FINAL_CHECK_DEPTS },
        status: { in: ['ISSUED', 'RECEIVED', 'IN_PROCESS', 'COMPLETED', 'READY_FOR_HANDOVER', 'ON_HOLD', 'HANDED_OVER'] },
      },
      include: {
        program: {
          select: {
            programNumber: true,
            programSerialNo: true,
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
        productionLogs: {
          where: { departmentCode: { in: FINAL_CHECK_DEPTS } },
          orderBy: { recordedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const lanes = {
      PENDING: allJobs.filter((j) => j.status === 'ISSUED'),
      IN_INSPECTION: allJobs.filter((j) => ['RECEIVED', 'IN_PROCESS'].includes(j.status)),
      COMPLETED: allJobs.filter((j) => ['COMPLETED', 'READY_FOR_HANDOVER', 'READY_FOR_DISPATCH'].includes(j.status)),
      HANDED_OVER: allJobs.filter((j) => j.status === 'HANDED_OVER'),
    };

    return NextResponse.json({
      success: true,
      data: {
        lanes,
        totalJobs: allJobs.length,
        onHoldCount: allJobs.filter((j) => j.status === 'ON_HOLD').length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching Final QC floor board:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch Final QC floor board' },
      { status: 500 }
    );
  }
}
