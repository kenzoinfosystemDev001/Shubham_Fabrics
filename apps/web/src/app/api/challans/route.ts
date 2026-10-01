import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');
    const fromDepartment = searchParams.get('fromDepartment');
    const toDepartment = searchParams.get('toDepartment');
    const status = searchParams.get('status');
    const programId = searchParams.get('programId');

    const where: any = {};
    if (department) {
      where.OR = [
        { fromDepartment: department },
        { toDepartment: department },
      ];
    }
    if (fromDepartment) where.fromDepartment = fromDepartment;
    if (toDepartment) where.toDepartment = toDepartment;
    if (status) where.status = status;
    if (programId) where.programId = programId;

    const challans = await prisma.challan.findMany({
      where,
      include: {
        program: {
          select: {
            id: true,
            programNumber: true,
            programSerialNo: true,
            buyerName: true,
            clientName: true,
            styleCode: true,
            orderNumber: true,
            designName: true,
          },
        },
        fromDeptRel: true,
        toDeptRel: true,
        createdBy: { select: { id: true, username: true, fullName: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(challans);
  } catch (error: any) {
    console.error('Error fetching challans:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch challans' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Default operator
    let programmer = await prisma.user.findFirst({
      where: { username: 'programmer' },
    });
    if (!programmer) programmer = await prisma.user.findFirst();
    const actorId = programmer?.id || 'd1719f83-f62d-4858-9cf6-cc4b119b7bfd';

    let challanNumber = body.challanNumber;
    if (!challanNumber) {
      const year = new Date().getFullYear();
      const deptCode = body.fromDepartment === 'PROGRAMMING' ? 'PRG' : (body.fromDepartment || 'PRG');
      const prefix = `CH-${deptCode}-${year}-`;
      const count = await prisma.challan.count({
        where: { challanNumber: { startsWith: prefix } },
      });
      challanNumber = `${prefix}${String(count + 1).padStart(5, '0')}`;
    }

    const created = await prisma.$transaction(async (tx) => {
      const challan = await tx.challan.create({
        data: {
          challanNumber,
          challanType: body.challanType || 'INTERNAL_TRANSFER',
          programId: body.programId,
          fromDepartment: body.fromDepartment || 'PROGRAMMING',
          toDepartment: body.toDepartment || 'STORE',
          status: body.status || 'ISSUED',
          createdById: actorId,
          issuedById: actorId,
          remarks: [
            body.remarks,
            body.vehicleNumber ? `Vehicle: ${body.vehicleNumber}` : null,
            body.driverName ? `Driver: ${body.driverName}` : null,
          ].filter(Boolean).join(' | ') || null,
        },
      });

      if (body.items && Array.isArray(body.items) && body.items.length > 0) {
        for (const item of body.items) {
          await tx.challanItem.create({
            data: {
              challanId: challan.id,
              itemDescription: item.itemDescription || item.description || 'Fabric Material Batch',
              unitType: item.unitType || 'ROLL',
              quantity: Number(item.quantity || 1),
              uom: item.uom || 'MTR',
              remarks: item.remarks || null,
            },
          });
        }
      }

      // If linked to program, update status to ISSUED
      if (body.programId) {
        await tx.program.update({
          where: { id: body.programId },
          data: { status: 'ISSUED' },
        });
      }

      return challan;
    });

    const fullChallan = await prisma.challan.findUnique({
      where: { id: created.id },
      include: {
        program: true,
        items: true,
        createdBy: { select: { id: true, username: true, fullName: true } },
      },
    });

    return NextResponse.json(fullChallan, { status: 201 });
  } catch (error: any) {
    console.error('Error creating challan:', error);
    return NextResponse.json({ error: error.message || 'Failed to create challan' }, { status: 500 });
  }
}
