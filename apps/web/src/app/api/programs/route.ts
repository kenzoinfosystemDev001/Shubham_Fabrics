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

    // Role/department access restriction: ONLY Programming and Admin can see clientCode
    const cookieHeader = request.headers.get('cookie') || '';
    const deptHeader = request.headers.get('x-user-department') || '';
    const roleHeader = request.headers.get('x-user-role') || '';

    const isAuthorized = 
      deptHeader.toUpperCase() === 'ADMIN' ||
      deptHeader.toUpperCase() === 'PROGRAMMING' ||
      roleHeader.toUpperCase() === 'ADMIN' ||
      roleHeader.toUpperCase() === 'SUPER_ADMIN' ||
      roleHeader.toUpperCase() === 'PROGRAMMER' ||
      roleHeader.toUpperCase() === 'PROGRAMMING_INCHARGE' ||
      cookieHeader.includes('subham_mes_dept=ADMIN') ||
      cookieHeader.includes('subham_mes_dept=PROGRAMMING') ||
      cookieHeader.includes('subham_mes_role=ADMIN') ||
      cookieHeader.includes('subham_mes_role=SUPER_ADMIN') ||
      cookieHeader.includes('subham_mes_role=PROGRAMMER');

    const mapped = programs.map((p: any) => {
      let items: any[] = [];
      let subStyles: string[] = [];
      let subStylesWithAverages: any[] = [];
      let productionGrid: any[] = [];
      let topName = '';
      let serialNoCounter = '000';
      let note = '';
      let clientCode = '';

      try {
        if (p.metadataJson) {
          const parsed = JSON.parse(p.metadataJson);
          if (Array.isArray(parsed.items)) items = parsed.items;
          if (Array.isArray(parsed.subStyles)) subStyles = parsed.subStyles;
          if (Array.isArray(parsed.subStylesWithAverages)) subStylesWithAverages = parsed.subStylesWithAverages;
          if (Array.isArray(parsed.productionGrid)) productionGrid = parsed.productionGrid;
          if (parsed.topName) topName = parsed.topName;
          if (parsed.serialNoCounter) serialNoCounter = parsed.serialNoCounter;
          if (parsed.note) note = parsed.note;
          if (parsed.clientCode) clientCode = parsed.clientCode;
        }
      } catch {}

      if (subStyles.length === 0 && p.subStyle) {
        subStyles = p.subStyle.split(',').map((s: string) => s.trim()).filter(Boolean);
      }

      return {
        ...p,
        buyer: p.clientName || p.buyerName,
        buyerName: p.clientName || p.buyerName,
        sizeMatrix: p.sizes,
        colorMatrix: p.colours,
        routeSteps: p.routes?.[0]?.steps || [],
        items,
        subStyles,
        subStylesWithAverages,
        productionGrid,
        topName: topName || p.mainStyle || p.styleCode,
        serialNoCounter,
        note: note || p.comments || p.remarks || '',
        clientCode: isAuthorized ? clientCode : null,
      };
    });

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error('Error fetching programs:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch programs' }, { status: 500 });
  }
}
