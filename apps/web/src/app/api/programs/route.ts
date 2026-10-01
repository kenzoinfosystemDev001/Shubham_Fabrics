import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { programNumber: { contains: search, mode: 'insensitive' } },
        { buyerName: { contains: search, mode: 'insensitive' } },
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { styleCode: { contains: search, mode: 'insensitive' } },
        { designName: { contains: search, mode: 'insensitive' } },
        { clientName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const programs = await prisma.program.findMany({
      where,
      include: {
        customer: true,
        design: true,
        createdBy: { select: { id: true, username: true, fullName: true } },
        approvedBy: { select: { id: true, username: true, fullName: true } },
        fabrics: true,
        sizes: true,
        colours: true,
        routes: {
          include: {
            steps: { orderBy: { sequenceOrder: 'asc' } },
          },
        },
        _count: { select: { challans: true, productionLogs: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const mapped = programs.map((p) => ({
      ...p,
      buyer: p.clientName || p.buyerName,
      buyerName: p.clientName || p.buyerName,
      sizeMatrix: p.sizes,
      colorMatrix: p.colours,
      routeSteps: p.routes?.[0]?.steps || [],
    }));

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error('Error fetching programs:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch programs' }, { status: 500 });
  }
}
