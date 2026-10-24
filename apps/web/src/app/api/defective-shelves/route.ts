import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import {
  canViewCentralShelf,
  DEFECTIVE_SHELF_DEPARTMENTS,
  DEFECTIVE_SHELF_INFO,
  getDefectiveShelfActor,
  isProgrammingActor,
  isShelfDepartment,
} from '@/lib/defective-shelf';

export const dynamic = 'force-dynamic';

const DEPARTMENT_SHELF_MAP: Record<string, { code: string; name: string; deptName: string }> = {
  DYEING: {
    code: 'DEF-SHELF-DYEING',
    name: 'Dyeing Station Defective Shelf',
    deptName: 'Dyeing Department',
  },
  DYEING_QC: {
    code: 'DEF-SHELF-DYEING-QC',
    name: 'Dyeing QC Defective Shelf',
    deptName: 'Dyeing QC',
  },
  EMBROIDERY: {
    code: 'DEF-SHELF-EMBROIDERY',
    name: 'Embroidery Station Defective Shelf',
    deptName: 'Embroidery Department',
  },
  THREAD_CUTTING: {
    code: 'DEF-SHELF-THREAD-CUTTING',
    name: 'Thread Cutting Trimming & Snip Shelf',
    deptName: 'Thread Cutting Department',
  },
  THREADCUT_QC: {
    code: 'DEF-SHELF-THREADCUT-QC',
    name: 'Threadcut QC Defective Shelf',
    deptName: 'Threadcut QC',
  },
  WASHING_QC: {
    code: 'DEF-SHELF-WASHING-QC',
    name: 'Washing QC Defective Shelf',
    deptName: 'Washing QC',
  },
  FINAL_QC: {
    code: 'DEF-SHELF-FINAL-QC',
    name: 'Final QC Defective Shelf',
    deptName: 'Final QC',
  },
  WASHING: { code: DEFECTIVE_SHELF_INFO.WASHING.code, name: `${DEFECTIVE_SHELF_INFO.WASHING.name} Defective Shelf`, deptName: 'Washing Department' },
  RECUTTING: { code: DEFECTIVE_SHELF_INFO.RECUTTING.code, name: `${DEFECTIVE_SHELF_INFO.RECUTTING.name} Defective Shelf`, deptName: 'Recutting Department' },
  STITCHING: { code: DEFECTIVE_SHELF_INFO.STITCHING.code, name: `${DEFECTIVE_SHELF_INFO.STITCHING.name} Defective Shelf`, deptName: 'Stitching Department' },
  FINISHING: { code: DEFECTIVE_SHELF_INFO.FINISHING.code, name: `${DEFECTIVE_SHELF_INFO.FINISHING.name} Defective Shelf`, deptName: 'Finishing Department' },
  STEAM_PRESS: { code: DEFECTIVE_SHELF_INFO.STEAM_PRESS.code, name: `${DEFECTIVE_SHELF_INFO.STEAM_PRESS.name} Defective Shelf`, deptName: 'Steam Press Department' },
  PACKING: { code: DEFECTIVE_SHELF_INFO.PACKING.code, name: `${DEFECTIVE_SHELF_INFO.PACKING.name} Defective Shelf`, deptName: 'Packing Department' },
};

export async function GET(request: Request) {
  try {
    const auth = await getDefectiveShelfActor(request);
    if (!auth.actor) return auth.response;
    if (isProgrammingActor(auth.actor)) {
      return NextResponse.json({ error: 'Programming Department cannot access defective shelf dashboards.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const canViewCentral = canViewCentralShelf(auth.actor);
    const requestedDepartment = searchParams.get('department')?.toUpperCase();
    if (!canViewCentral && !isShelfDepartment(auth.actor.departmentCode)) {
      return NextResponse.json({ error: 'Department defective shelf access is required.' }, { status: 403 });
    }
    if (!canViewCentral && requestedDepartment && requestedDepartment !== auth.actor.departmentCode) {
      return NextResponse.json({ error: 'You can only view your department defective shelf.' }, { status: 403 });
    }
    const departmentParam = canViewCentral
      ? (requestedDepartment && requestedDepartment !== 'ALL' && isShelfDepartment(requestedDepartment) ? requestedDepartment : 'ALL')
      : auth.actor.departmentCode!;
    const shelfParam = searchParams.get('shelf');

    // 1. Fetch Challans with defective pieces
    const challanWhere: any = {
      OR: [
        { defectivePieces: { gt: 0 } },
        { challanType: 'DEFECT_RETURN' },
      ],
    };

    if (departmentParam !== 'ALL') {
      challanWhere.AND = [
        {
          OR: [
            { fromDepartment: { contains: departmentParam, mode: 'insensitive' } },
            { defectiveShelfLocation: { contains: departmentParam, mode: 'insensitive' } },
          ],
        },
      ];
    }

    if (shelfParam) {
      challanWhere.defectiveShelfLocation = { contains: shelfParam, mode: 'insensitive' };
    }

    const challans = await prisma.challan.findMany({
      where: challanWhere,
      include: {
        program: {
          select: {
            id: true,
            programNumber: true,
            programSerialNo: true,
            clientName: true,
            buyerName: true,
            mainStyle: true,
            wilcomDesignNumber: true,
            fabricName: true,
            fabricColor: true,
          },
        },
        items: true,
        defects: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    // 2. Fetch DefectRecords directly from table
    const defectWhere: any = { shelfRemovedAt: null, status: { not: 'REWORK' } };
    if (departmentParam === 'ALL') {
      defectWhere.departmentCode = { in: [...DEFECTIVE_SHELF_DEPARTMENTS, 'WASHING_QC'] };
    } else {
      defectWhere.departmentCode = departmentParam === 'WASHING_QC'
        ? { in: ['WASHING_QC'] }
        : departmentParam;
    }

    const defectRecords = await prisma.defectRecord.findMany({
      where: defectWhere,
      include: {
        program: {
          select: {
            id: true,
            programNumber: true,
            programSerialNo: true,
            clientName: true,
            buyerName: true,
            mainStyle: true,
            wilcomDesignNumber: true,
            fabricName: true,
            fabricType: true,
            fabricColor: true,
          },
        },
        challan: {
          include: { items: { take: 1 } },
        },
        detectedBy: {
          select: {
            id: true,
            fullName: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    // 3. Fetch Fabric Store Defected / Quarantined Rolls
    const rolls = canViewCentral ? await prisma.fabricStoreRoll.findMany({
      where: {
        OR: [
          { status: 'QC_HOLD' },
          { status: 'QC_REJECTED' },
          { qcStatus: 'ON_HOLD' },
          { qcStatus: 'FAILED' },
        ],
      },
      include: {
        batch: {
          select: {
            batchNumber: true,
            fabricType: true,
            fabricDescription: true,
            colorName: true,
          },
        },
        location: {
          select: {
            locationCode: true,
            locationName: true,
          },
        },
      },
      orderBy: { rollNumber: 'asc' },
    }) : [];

    // 4. Calculate Factory-Wide & Department Breakdown Metrics
    const shelfDepartmentCodes = [...DEFECTIVE_SHELF_DEPARTMENTS, 'WASHING_QC'];
    const legacyChallanWhere: any = {
      OR: [
        { defectivePieces: { gt: 0 } },
        { challanType: { in: ['DEFECT_RETURN', 'DEFECTIVE_RETURN'] } },
      ],
    };
    if (departmentParam === 'ALL') {
      legacyChallanWhere.AND = [{ fromDepartment: { in: shelfDepartmentCodes } }];
    } else {
      legacyChallanWhere.AND = [{ fromDepartment: { in: departmentParam === 'WASHING_QC' ? ['WASHING_QC'] : [departmentParam] } }];
    }
    const allDefectChallans = await prisma.challan.findMany({
      where: legacyChallanWhere,
      select: {
        id: true,
        parentChallanId: true,
        challanNumber: true,
        challanType: true,
        fromDepartment: true,
        toDepartment: true,
        defectivePieces: true,
        fabricUnit: true,
        defectiveShelfLocation: true,
        defectReason: true,
        createdAt: true,
        program: {
          select: {
            id: true,
            programNumber: true,
            programSerialNo: true,
            mainStyle: true,
            fabricName: true,
            fabricType: true,
            fabricColor: true,
          },
        },
        createdBy: { select: { fullName: true, username: true } },
        items: {
          take: 1,
          select: { quantity: true, uom: true, colour: true, fabricCode: true, itemDescription: true },
        },
      },
    });

    const normalizeDeptKey = (deptStr?: string | null): string => {
      if (!deptStr) return 'STORE';
      const up = deptStr.toUpperCase();
      if (up.includes('WASHING_QC') || up.includes('WASHING QC')) return 'WASHING_QC';
      if (up.includes('DYEING_QC') || up.includes('DYEING QC') || up.includes('DYE QC')) return 'DYEING_QC';
      if (up.includes('DYE')) return 'DYEING';
      if (up.includes('EMB')) return 'EMBROIDERY';
      if (up.includes('THREADCUT_QC') || up.includes('THREAD CUT QC') || up.includes('THREAD CUTTING QC')) return 'THREADCUT_QC';
      if (up.includes('RECUT')) return 'RECUTTING';
      if (up.includes('THREAD') || up.includes('CUTTING') || up.includes('THC')) return 'THREAD_CUTTING';
      if (up.includes('WASH')) return 'WASHING';
      if (up.includes('STITCH')) return 'STITCHING';
      if (up.includes('FINISH')) return 'FINISHING';
      if (up.includes('STEAM') || up.includes('PRESS')) return 'STEAM_PRESS';
      if (up.includes('PACK')) return 'PACKING';
      if (up.includes('FINAL')) return 'FINAL_QC';
      return 'STORE';
    };

    const departmentStats: Record<string, {
      shelfCode: string;
      shelfName: string;
      totalPieces: number;
      totalIncidents: number;
      quantitiesByUnit: Record<string, number>;
    }> = {
      DYEING: { shelfCode: 'DEF-SHELF-DYEING', shelfName: 'Dyeing Station Defective Shelf', totalPieces: 0, totalIncidents: 0, quantitiesByUnit: {} },
      DYEING_QC: { shelfCode: 'DEF-SHELF-DYEING-QC', shelfName: 'Dyeing QC Defective Shelf', totalPieces: 0, totalIncidents: 0, quantitiesByUnit: {} },
      EMBROIDERY: { shelfCode: 'DEF-SHELF-EMBROIDERY', shelfName: 'Embroidery Station Defective Shelf', totalPieces: 0, totalIncidents: 0, quantitiesByUnit: {} },
      THREAD_CUTTING: { shelfCode: 'DEF-SHELF-THREAD-CUTTING', shelfName: 'Thread Cutting Trimming & Snip Shelf', totalPieces: 0, totalIncidents: 0, quantitiesByUnit: {} },
      THREADCUT_QC: { shelfCode: 'DEF-SHELF-THREADCUT-QC', shelfName: 'Threadcut QC Defective Shelf', totalPieces: 0, totalIncidents: 0, quantitiesByUnit: {} },
      WASHING_QC: { shelfCode: 'DEF-SHELF-WASHING-QC', shelfName: 'Washing QC Defective Shelf', totalPieces: 0, totalIncidents: 0, quantitiesByUnit: {} },
      FINAL_QC: { shelfCode: 'DEF-SHELF-FINAL-QC', shelfName: 'Final QC Defective Shelf', totalPieces: 0, totalIncidents: 0, quantitiesByUnit: {} },
      WASHING: { shelfCode: DEFECTIVE_SHELF_INFO.WASHING.code, shelfName: 'Washing Station Defective Shelf', totalPieces: 0, totalIncidents: 0, quantitiesByUnit: {} },
      RECUTTING: { shelfCode: DEFECTIVE_SHELF_INFO.RECUTTING.code, shelfName: 'Recutting Defective Shelf', totalPieces: 0, totalIncidents: 0, quantitiesByUnit: {} },
      STITCHING: { shelfCode: DEFECTIVE_SHELF_INFO.STITCHING.code, shelfName: 'Stitching Defective Shelf', totalPieces: 0, totalIncidents: 0, quantitiesByUnit: {} },
      FINISHING: { shelfCode: DEFECTIVE_SHELF_INFO.FINISHING.code, shelfName: 'Finishing Defective Shelf', totalPieces: 0, totalIncidents: 0, quantitiesByUnit: {} },
      STEAM_PRESS: { shelfCode: DEFECTIVE_SHELF_INFO.STEAM_PRESS.code, shelfName: 'Steam Press Defective Shelf', totalPieces: 0, totalIncidents: 0, quantitiesByUnit: {} },
      PACKING: { shelfCode: DEFECTIVE_SHELF_INFO.PACKING.code, shelfName: 'Packing Defective Shelf', totalPieces: 0, totalIncidents: 0, quantitiesByUnit: {} },
    };

    const allCanonicalChallanLinks = await prisma.defectRecord.findMany({
      where: {
        departmentCode: departmentParam === 'ALL'
          ? { in: shelfDepartmentCodes }
          : departmentParam === 'WASHING_QC'
            ? { in: ['WASHING_QC'] }
            : departmentParam,
        challanId: { not: null },
        status: { not: 'REWORK' },
      },
      select: { challanId: true },
    });
    const directChallanIds = new Set([
      ...defectRecords.map((record) => record.challanId),
      ...allCanonicalChallanLinks.map((record) => record.challanId),
    ].filter(Boolean));
    const normalizedDefectRecords = [
      ...defectRecords.map((record: any) => ({
        ...record,
        departmentCode: normalizeDeptKey(record.departmentCode),
        productionSheetNumber: record.productionSheetNumber || record.program?.programSerialNo || record.program?.programNumber,
        quantityUnit: record.challan?.fabricUnit || record.challan?.items?.[0]?.uom || record.quantityUnit || 'PCS',
        color: record.color || record.challan?.items?.[0]?.colour || record.program?.fabricColor || null,
        fabricType: record.fabricType || record.program?.fabricType || record.program?.fabricName || null,
        shelfCode: record.shelfCode || DEFECTIVE_SHELF_INFO[normalizeDeptKey(record.departmentCode) as keyof typeof DEFECTIVE_SHELF_INFO]?.code || null,
        reason: record.reason,
        responsibleIncharge: record.responsibleIncharge || record.detectedBy?.fullName || null,
        challan: record.challan ? {
          ...record.challan,
          items: record.challan.items,
        } : null,
      })),
      ...allDefectChallans.flatMap((challan: any) => {
        const departmentCode = normalizeDeptKey(challan.fromDepartment);
        if (!isShelfDepartment(departmentCode) || directChallanIds.has(challan.id) || (challan.parentChallanId && directChallanIds.has(challan.parentChallanId))) return [];
        const quantity = Number(challan.defectivePieces) || challan.items.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0);
        if (quantity <= 0) return [];
        return [{
          id: `CHALLAN-${challan.id}`,
          defectCode: challan.challanNumber,
          programId: challan.program?.id,
          program: challan.program,
          productionSheetNumber: challan.program?.programSerialNo || challan.program?.programNumber,
          challanId: challan.id,
          challan: { id: challan.id, challanNumber: challan.challanNumber, fabricUnit: challan.fabricUnit, items: challan.items },
          departmentCode,
          shelfCode: challan.defectiveShelfLocation?.split(' ')[0] || DEFECTIVE_SHELF_INFO[departmentCode].code,
          color: challan.items?.[0]?.colour || challan.program?.fabricColor || null,
          fabricType: challan.program?.fabricType || challan.program?.fabricName || null,
          quantityUnit: challan.fabricUnit || challan.items?.[0]?.uom || 'PCS',
          responsibleIncharge: challan.createdBy?.fullName || null,
          itemDescription: challan.items?.[0]?.itemDescription || 'Department defect recorded on challan',
          quantity,
          reason: challan.defectReason || 'Reason recorded on the original defective challan',
          detectedBy: challan.createdBy ? { fullName: challan.createdBy.fullName, username: challan.createdBy.username } : null,
          status: 'OPEN',
          createdAt: challan.createdAt,
        }];
      }),
    ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

    const addDepartmentDefect = (department: string, quantity: number, unit: string) => {
      const stats = departmentStats[department];
      if (!stats) return;
      stats.totalPieces += quantity;
      stats.totalIncidents += 1;
      stats.quantitiesByUnit[unit] = (stats.quantitiesByUnit[unit] || 0) + quantity;
    };

    let factoryTotalDefectivePieces = 0;

    for (const record of normalizedDefectRecords) {
      const department = String(record.departmentCode || '').toUpperCase();
      const quantity = Number(record.quantity) || 0;
      const unit = String(record.quantityUnit || 'PCS').toUpperCase();
      addDepartmentDefect(department, quantity, unit);
      factoryTotalDefectivePieces += quantity;
    }

    const totalQuarantinedMeters = rolls.reduce(
      (sum, r) => sum + (Number(r.length) || 0),
      0
    );

    return NextResponse.json({
      success: true,
      data: {
        filterDepartment: departmentParam,
        filterShelf: shelfParam || null,
        challans,
        defectRecords: normalizedDefectRecords,
        defectedRolls: rolls,
        summary: {
          factoryTotalDefectivePieces,
          factoryTotalQuarantinedMeters: Number(totalQuarantinedMeters.toFixed(2)),
          totalDefectedRolls: rolls.length,
          totalIncidents: normalizedDefectRecords.length + rolls.length,
          departmentStats,
          allShelves: DEPARTMENT_SHELF_MAP,
        },
      },
    });
  } catch (error: any) {
    console.error('Defective shelves error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch defective shelves' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getDefectiveShelfActor(request);
    if (!auth.actor) return auth.response;
    if (isProgrammingActor(auth.actor)) {
      return NextResponse.json({ error: 'Programming Department cannot create defective shelf entries.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const departmentCode = auth.actor.isAdmin
      ? String(body.departmentCode || '').toUpperCase()
      : String(auth.actor.departmentCode || '').toUpperCase();
    if (!isShelfDepartment(departmentCode)) {
      return NextResponse.json({ error: 'Only departments from Dyeing through Packing can create defective shelf entries.' }, { status: 403 });
    }
    if (!String(body.reason || '').trim()) {
      return NextResponse.json({ error: 'Reason for defect is required.' }, { status: 400 });
    }

    const quantity = Number(body.quantity);
    const quantityUnit = String(body.quantityUnit || '').toUpperCase();
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ error: 'Defective quantity must be greater than zero.' }, { status: 400 });
    }
    if (!['MTR', 'PCS'].includes(quantityUnit)) {
      return NextResponse.json({ error: 'Quantity unit must be MTR or PCS.' }, { status: 400 });
    }

    const sheetNumber = String(body.productionSheetNumber || '').trim();
    if (!sheetNumber) {
      return NextResponse.json({ error: 'Production Sheet Number / Serial Number is required.' }, { status: 400 });
    }
    const program = await prisma.program.findFirst({
      where: { OR: [{ id: sheetNumber }, { programSerialNo: sheetNumber }, { programNumber: sheetNumber }] },
      select: {
        id: true,
        programNumber: true,
        programSerialNo: true,
        styleCode: true,
        fabricName: true,
        fabricType: true,
        fabricColor: true,
      },
    });
    if (!program) {
      return NextResponse.json({ error: `Production Sheet '${sheetNumber}' was not found.` }, { status: 404 });
    }

    const challanReference = String(body.challanReference || '').trim();
    const challan = challanReference
      ? await prisma.challan.findFirst({
          where: { OR: [{ id: challanReference }, { challanNumber: challanReference }] },
          select: { id: true, programId: true, challanNumber: true },
        })
      : null;
    if (challanReference && !challan) {
      return NextResponse.json({ error: `Challan '${challanReference}' was not found.` }, { status: 404 });
    }
    if (challan && challan.programId !== program.id) {
      return NextResponse.json({ error: 'The challan does not belong to the selected production sheet.' }, { status: 400 });
    }

    const reason = String(body.reason).trim();
    const color = String(body.color || '').trim() || program.fabricColor || '';
    const fabricType = String(body.fabricType || '').trim() || program.fabricType || program.fabricName || '';
    if (!color) return NextResponse.json({ error: 'Color is required for a defective shelf entry.' }, { status: 400 });
    if (!fabricType) return NextResponse.json({ error: 'Fabric type is required for a defective shelf entry.' }, { status: 400 });
    const shelfCode = DEFECTIVE_SHELF_INFO[departmentCode].code;
    const defect = await prisma.$transaction(async (tx) => {
      const created = await tx.defectRecord.create({
        data: {
          defectCode: `DEF-${departmentCode}-${Date.now().toString().slice(-6)}-${crypto.randomUUID().slice(0, 6)}`,
          programId: program.id,
          productionSheetNumber: program.programSerialNo || program.programNumber,
          challanId: challan?.id || null,
          departmentCode,
          shelfCode,
          color,
          fabricType,
          quantityUnit,
          responsibleIncharge: auth.actor.fullName,
          itemDescription: String(body.itemDescription || '').trim() || `${program.styleCode} - ${DEFECTIVE_SHELF_INFO[departmentCode].name} defect`,
          severity: String(body.severity || 'MAJOR').toUpperCase(),
          quantity,
          reason,
          detectedById: auth.actor.id,
          status: 'OPEN',
        },
        include: {
          program: { select: { programNumber: true, programSerialNo: true, styleCode: true, fabricName: true, fabricType: true, fabricColor: true } },
          challan: { select: { id: true, challanNumber: true } },
          detectedBy: { select: { id: true, fullName: true, username: true } },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: auth.actor!.id,
          action: 'DEFECT_SHELF_ENTRY_CREATED',
          entity: 'DefectRecord',
          entityId: created.id,
          afterState: JSON.stringify({
            departmentCode,
            shelfCode,
            quantity,
            quantityUnit,
            reason,
            color: created.color,
            fabricType: created.fabricType,
            challanId: created.challanId,
          }),
        },
      });
      return created;
    });

    return NextResponse.json({ success: true, data: defect }, { status: 201 });
  } catch (error: any) {
    console.error('Create defective shelf entry error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create defective shelf entry.' }, { status: 500 });
  }
}
