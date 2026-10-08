import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { syncInboundChallansToDyeingOrders } from '@/lib/dyeing-sync';

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

    // 1. Resolve Actor ID reliably
    let user = await prisma.user.findFirst({
      where: { OR: [{ username: 'programmer' }, { username: 'admin' }, { username: 'jitender' }] },
      select: { id: true },
      orderBy: { username: 'asc' },
    });
    if (!user) {
      user = await prisma.user.findFirst({ select: { id: true } });
    }
    if (!user) {
      user = await prisma.user.create({
        data: {
          username: 'programmer',
          email: 'programmer@subhamfabrics.com',
          fullName: 'Programming Incharge',
          passwordHash: 'dummy',
          departmentCode: 'PROGRAMMING',
        },
        select: { id: true },
      });
    }
    const actorId = user.id;

    // 2. Resolve Program ID reliably
    let resolvedProgramId = body.programId;
    if (resolvedProgramId) {
      const prog = await prisma.program.findFirst({
        where: {
          OR: [
            { id: resolvedProgramId },
            { programNumber: resolvedProgramId },
            { programSerialNo: resolvedProgramId },
          ],
        },
        select: { id: true },
      });
      if (prog) {
        resolvedProgramId = prog.id;
      } else {
        // Fallback to first available program if passed an invalid id
        const firstProg = await prisma.program.findFirst({ select: { id: true } });
        if (firstProg) resolvedProgramId = firstProg.id;
      }
    } else {
      const firstProg = await prisma.program.findFirst({ select: { id: true } });
      if (firstProg) resolvedProgramId = firstProg.id;
    }

    if (!resolvedProgramId) {
      return NextResponse.json(
        { error: 'Cannot issue challan without an active Program in the database.' },
        { status: 400 }
      );
    }

    // 3. Ensure fromDepartment and toDepartment exist in Department table (Foreign Key safety)
    const fromDept = (body.fromDepartment || 'PROGRAMMING').toUpperCase();
    const toDept = (body.toDepartment || 'STORE').toUpperCase();

    await prisma.department.upsert({
      where: { code: fromDept },
      update: {},
      create: {
        code: fromDept,
        name: fromDept === 'PROGRAMMING' ? 'Programming Department' : `${fromDept} Department`,
        sequenceOrder: fromDept === 'PROGRAMMING' ? 0 : 99,
        description: `${fromDept} MES Department`,
      },
    });

    await prisma.department.upsert({
      where: { code: toDept },
      update: {},
      create: {
        code: toDept,
        name: toDept === 'STORE' ? 'Raw Material & Fabric Store' : `${toDept} Department`,
        sequenceOrder: toDept === 'STORE' ? 1 : 99,
        description: `${toDept} MES Department`,
      },
    });

    // 4. Resolve Unique Challan Number
    const year = new Date().getFullYear();
    const deptPrefixCode = fromDept === 'PROGRAMMING' ? 'PRG' : fromDept;
    const prefix = `CH-${deptPrefixCode}-${year}-`;

    let challanNumber = body.challanNumber;
    if (!challanNumber) {
      const count = await prisma.challan.count({
        where: { challanNumber: { startsWith: prefix } },
      });
      challanNumber = `${prefix}${String(count + 1).padStart(5, '0')}`;
    }

    // Collision check to prevent unique constraint crash
    const existingChallan = await prisma.challan.findUnique({
      where: { challanNumber },
      select: { id: true },
    });
    if (existingChallan) {
      challanNumber = `${prefix}${Date.now().toString().slice(-5)}`;
    }

    // 5. Transactional Challan Creation
    const created = await prisma.$transaction(async (tx) => {
      const challan = await tx.challan.create({
        data: {
          challanNumber,
          challanType: body.challanType || 'INTER_DEPARTMENT',
          programId: resolvedProgramId,
          fromDepartment: fromDept,
          toDepartment: toDept,
          status: body.status || 'ISSUED',
          priority: body.priority || 'NORMAL',
          createdById: actorId,
          issuedById: actorId,
          issuedDate: new Date(),
          remarks: [
            body.remarks,
            body.vehicleNumber ? `Vehicle: ${body.vehicleNumber}` : null,
            body.driverName ? `Driver: ${body.driverName}` : null,
          ].filter(Boolean).join(' | ') || null,
        },
      });

      // Prepare items
      const rawItems = (Array.isArray(body.items) && body.items.length > 0)
        ? body.items
        : [
            {
              itemDescription: body.itemDescription || 'Production Material Lot',
              unitType: 'ROLL',
              quantity: Number(body.quantity || 1),
              uom: body.uom || 'PCS',
              remarks: body.remarks || null,
            },
          ];

      for (const item of rawItems) {
        await tx.challanItem.create({
          data: {
            challanId: challan.id,
            itemDescription: item.itemDescription || item.description || 'Production Material Lot',
            unitType: item.unitType || 'ROLL',
            quantity: Number(item.quantity || 1),
            uom: item.uom || 'PCS',
            fabricCode: item.fabricCode || null,
            colour: item.colour || null,
            shade: item.shade || null,
            size: item.size || null,
            remarks: item.remarks || null,
          },
        });
      }

      // Update linked program status to ISSUED
      try {
        await tx.program.update({
          where: { id: resolvedProgramId },
          data: { status: 'ISSUED' },
        });
      } catch (progErr) {
        console.warn('Program status update skipped:', progErr);
      }

      return challan;
    });

    // If dispatched to Dyeing, immediately sync to DyeingOrders
    if (toDept === 'DYEING' || toDept.includes('DYE')) {
      try {
        await syncInboundChallansToDyeingOrders();
      } catch (syncErr) {
        console.warn('Auto-sync to Dyeing notification:', syncErr);
      }
    }

    const fullChallan = await prisma.challan.findUnique({
      where: { id: created.id },
      include: {
        program: true,
        items: true,
        createdBy: { select: { id: true, username: true, fullName: true } },
        dyeingInboundOrders: true,
      },
    });

    return NextResponse.json(fullChallan, { status: 201 });
  } catch (error: any) {
    console.error('Error creating challan:', error);
    return NextResponse.json({ error: error.message || 'Failed to create challan' }, { status: 500 });
  }
}
