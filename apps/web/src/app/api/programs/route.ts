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
    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { programNumber: { contains: term, mode: 'insensitive' } },
        { programSerialNo: { contains: term, mode: 'insensitive' } },
        { buyerName: { contains: term, mode: 'insensitive' } },
        { clientName: { contains: term, mode: 'insensitive' } },
        { orderNumber: { contains: term, mode: 'insensitive' } },
        { styleCode: { contains: term, mode: 'insensitive' } },
        { mainStyle: { contains: term, mode: 'insensitive' } },
        { designName: { contains: term, mode: 'insensitive' } },
        { designNumber: { contains: term, mode: 'insensitive' } },
        { wilcomDesignNumber: { contains: term, mode: 'insensitive' } },
        { fabricName: { contains: term, mode: 'insensitive' } },
        { fabricColor: { contains: term, mode: 'insensitive' } },
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
        challans: {
          select: {
            id: true,
            challanNumber: true,
            challanType: true,
            fromDepartment: true,
            toDepartment: true,
            status: true,
            priority: true,
            issuedDate: true,
            receivedDate: true,
            remarks: true,
            items: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        routes: {
          include: {
            steps: { orderBy: { sequenceOrder: 'asc' } },
          },
        },
        _count: { select: { challans: true, productionLogs: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const mapped = programs.map((p: any) => ({
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
