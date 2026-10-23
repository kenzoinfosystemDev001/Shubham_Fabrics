import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { getPackingActor } from '@/lib/packing-auth';

export const dynamic = 'force-dynamic';

const PACKING_DEPTS = ['PACKING', 'PACK', 'FOLDING'];

export async function GET(request: Request) {
  try {
    const auth = await getPackingActor(request);
    if (!auth.actor) return auth.response;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const whereClause: any = {
      toDepartment: { in: PACKING_DEPTS },
      status: {
        in: ['RECEIVED', 'IN_PROCESS', 'COMPLETED', 'ON_HOLD'],
      },
    };

    if (status && status !== 'ALL') {
      whereClause.status = status;
    }

    if (search) {
      whereClause.OR = [
        { challanNumber: { contains: search, mode: 'insensitive' } },
        { program: { programNumber: { contains: search, mode: 'insensitive' } } },
        { program: { styleCode: { contains: search, mode: 'insensitive' } } },
        { program: { clientName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const jobs = await prisma.challan.findMany({
      where: whereClause,
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
            fabricColor: true,
            targetQuantity: true,
            quantityMeasurement: true,
            sizes: true,
            colours: true,
          },
        },
        items: true,
        issuedBy: { select: { id: true, fullName: true, username: true } },
        receivedBy: { select: { id: true, fullName: true, username: true } },
        productionLogs: {
          where: { departmentCode: { in: PACKING_DEPTS } },
          orderBy: { recordedAt: 'desc' },
          include: {
            operator: { select: { id: true, fullName: true, username: true } },
          },
        },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: [
        { priority: 'desc' },
        { receivedDate: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    // Also enrich with cartons count and total pieces packed for each job
    const enrichedJobs = await Promise.all(
      jobs.map(async (job) => {
        const cartons = await prisma.carton.findMany({
          where: { packingChallanId: job.id },
          select: { id: true, cartonNumber: true, quantity: true, size: true, colour: true, status: true },
        });

        const totalPacked = cartons.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0);
        const totalReceived = Number(job.fabricIn ?? job.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0));
        const remainingToPack = Math.max(0, totalReceived - totalPacked);

        return {
          ...job,
          cartonsCount: cartons.length,
          totalPacked,
          remainingToPack,
          cartons,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: enrichedJobs,
    });
  } catch (error: any) {
    console.error('Error fetching Packing queue:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch Packing queue' },
      { status: 500 }
    );
  }
}
