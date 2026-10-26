import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'STORE');
  if (!authUser) return authResponse;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalRolls,
      rollsInStock,
      rollsIssued,
      incomingChallansCount,
      incomingChallans,
      recentIssues,
    ] = await Promise.all([
      prisma.fabricStoreRoll.count(),
      prisma.fabricStoreRoll.count({ where: { status: 'IN_STOCK' } }),
      prisma.fabricStoreRoll.count({ where: { status: 'ISSUED' } }),
      prisma.challan.count({ where: { toDepartment: 'STORE' } }),
      prisma.challan.findMany({
        take: 8,
        where: { toDepartment: 'STORE' },
        orderBy: { createdAt: 'desc' },
        include: {
          program: {
            select: {
              id: true,
              programNumber: true,
              programSerialNo: true,
              buyerName: true,
              clientName: true,
              styleCode: true,
              mainStyle: true,
              fabricName: true,
              fabricColor: true,
              fabricDyeingRequired: true,
              colorQuantity: true,
              targetQuantity: true,
            },
          },
          fromDeptRel: true,
          items: true,
        },
      }),
      prisma.fabricStockLedger.findMany({
        take: 5,
        where: { transactionType: 'ISSUE' },
        orderBy: { transactedAt: 'desc' },
        include: {
          roll: { select: { rollNumber: true } },
          batch: { select: { batchNumber: true, fabricDescription: true, unit: true } },
          transactedBy: { select: { fullName: true } },
        },
      }),
    ]);

    return NextResponse.json({
      data: {
        kpis: {
          totalRolls,
          rollsInStock,
          rollsIssued,
          incomingChallansCount,
        },
        incomingChallans,
        recentIssues,
      },
    });
  } catch (error: any) {
    console.error('Fabric store dashboard error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
