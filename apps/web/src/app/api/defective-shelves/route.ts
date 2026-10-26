import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { addToUnitTotals, unitTotals } from '@/lib/fabric-stock';

export const dynamic = 'force-dynamic';

const DEPARTMENT_SHELF_MAP: Record<string, { code: string; name: string; deptName: string }> = {
  STORE: {
    code: 'DEF-SHELF-STORE',
    name: 'Raw Fabric Store Quarantined Shelf',
    deptName: 'Fabric Store',
  },
  DYEING: {
    code: 'DEF-SHELF-DYEING',
    name: 'Dyeing Station Defective Shelf',
    deptName: 'Dyeing Department',
  },
  QC1: {
    code: 'DEF-SHELF-QC1',
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
  QC2: {
    code: 'DEF-SHELF-QC2',
    name: 'Threadcut QC Defective Shelf',
    deptName: 'Threadcut QC',
  },
  QC3: {
    code: 'DEF-SHELF-QC3',
    name: 'Washing QC Defective Shelf',
    deptName: 'Washing QC',
  },
  FINAL_CHECK: {
    code: 'DEF-SHELF-FINAL-CHECK',
    name: 'Final check Defective Shelf',
    deptName: 'Final check',
  },
  CENTRAL: {
    code: 'DEF-SHELF-CENTRAL',
    name: 'Fabric Store Master Central Defective Shelf',
    deptName: 'Fabric Store (Central Hub)',
  },
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentParam = searchParams.get('department')?.toUpperCase() || 'ALL';
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
    const defectWhere: any = {};
    if (departmentParam !== 'ALL') {
      defectWhere.departmentCode = { contains: departmentParam, mode: 'insensitive' };
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
          },
        },
        challan: {
          select: {
            id: true,
            challanNumber: true,
            fromDepartment: true,
            toDepartment: true,
            defectiveShelfLocation: true,
            defectReason: true,
            fabricUnit: true,
          },
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
    const rolls = await prisma.fabricStoreRoll.findMany({
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
    });

    // 4. Calculate Factory-Wide & Department Breakdown Metrics
    const allDefectChallans = await prisma.challan.findMany({
      where: {
        OR: [
          { defectivePieces: { gt: 0 } },
          { challanType: 'DEFECT_RETURN' },
        ],
      },
      select: {
        id: true,
        challanNumber: true,
        fromDepartment: true,
        toDepartment: true,
        defectivePieces: true,
        fabricUnit: true,
        defectiveShelfLocation: true,
        defectReason: true,
        createdAt: true,
        items: {
          select: { quantity: true },
        },
      },
    });

    const normalizeDeptKey = (deptStr?: string | null): string => {
      if (!deptStr) return 'STORE';
      const up = deptStr.toUpperCase();
      if (up.includes('QC1') || up.includes('DYEING QC') || up.includes('DYE QC')) return 'QC1';
      if (up.includes('DYE')) return 'DYEING';
      if (up.includes('EMB')) return 'EMBROIDERY';
      if (up.includes('QC2') || up.includes('THREAD CUT QC') || up.includes('THREAD CUTTING QC')) return 'QC2';
      if (up.includes('THREAD') || up.includes('CUTTING') || up.includes('THC')) return 'THREAD_CUTTING';
      if (up.includes('QC3') || up.includes('WASHING QC') || up.includes('WASH QC')) return 'QC3';
      if (up.includes('FINAL') || up.includes('FINAL_CHECK') || up.includes('FINAL CHECK')) return 'FINAL_CHECK';
      return 'STORE';
    };

    const departmentStats: Record<string, {
      shelfCode: string;
      shelfName: string;
      totalPieces: number;
      totalIncidents: number;
      quantitiesByUnit: Record<string, number>;
    }> = {
      STORE: { shelfCode: 'DEF-SHELF-STORE', shelfName: 'Raw Fabric Store Quarantined Shelf', totalPieces: 0, totalIncidents: 0, quantitiesByUnit: {} },
      DYEING: { shelfCode: 'DEF-SHELF-DYEING', shelfName: 'Dyeing Station Defective Shelf', totalPieces: 0, totalIncidents: 0, quantitiesByUnit: {} },
      QC1: { shelfCode: 'DEF-SHELF-QC1', shelfName: 'Dyeing QC Defective Shelf', totalPieces: 0, totalIncidents: 0, quantitiesByUnit: {} },
      EMBROIDERY: { shelfCode: 'DEF-SHELF-EMBROIDERY', shelfName: 'Embroidery Station Defective Shelf', totalPieces: 0, totalIncidents: 0, quantitiesByUnit: {} },
      THREAD_CUTTING: { shelfCode: 'DEF-SHELF-THREAD-CUTTING', shelfName: 'Thread Cutting Trimming & Snip Shelf', totalPieces: 0, totalIncidents: 0, quantitiesByUnit: {} },
      QC2: { shelfCode: 'DEF-SHELF-QC2', shelfName: 'Threadcut QC Defective Shelf', totalPieces: 0, totalIncidents: 0, quantitiesByUnit: {} },
      QC3: { shelfCode: 'DEF-SHELF-QC3', shelfName: 'Washing QC Defective Shelf', totalPieces: 0, totalIncidents: 0, quantitiesByUnit: {} },
      FINAL_CHECK: { shelfCode: 'DEF-SHELF-FINAL-CHECK', shelfName: 'Final check Defective Shelf', totalPieces: 0, totalIncidents: 0, quantitiesByUnit: {} },
    };

    const addDepartmentDefect = (department: string, quantity: number, unit: string) => {
      const stats = departmentStats[department];
      if (!stats) return;
      stats.totalPieces += quantity;
      stats.totalIncidents += 1;
      stats.quantitiesByUnit[unit] = (stats.quantitiesByUnit[unit] || 0) + quantity;
    };

    let factoryTotalDefectivePieces = 0;
    // Factory totals per unit: meters and pieces are never added together.
    const factoryTotalsByUnit = unitTotals();

    for (const ch of allDefectChallans) {
      const pcs = ch.defectivePieces || ch.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
      const dKey = normalizeDeptKey(ch.fromDepartment);
      const quantity = Number(pcs) || 0;
      const unit = (ch.fabricUnit || 'PCS').toUpperCase();
      addDepartmentDefect(dKey, quantity, unit);
      const shelfLocation = (ch.defectiveShelfLocation || '').toUpperCase();
      if (
        dKey !== 'STORE' &&
        ch.toDepartment?.toUpperCase() === 'STORE' &&
        shelfLocation.includes('DEF-SHELF-STORE') &&
        departmentStats.STORE
      ) {
        addDepartmentDefect('STORE', quantity, unit);
      }
      factoryTotalDefectivePieces += quantity;
      addToUnitTotals(factoryTotalsByUnit, unit, quantity);
    }

    const quarantinedByUnit = rolls.reduce((totals, r) => addToUnitTotals(totals, r.unit, Number(r.length) || 0), unitTotals());
    const totalQuarantinedMeters = quarantinedByUnit.MTR || 0;

    return NextResponse.json({
      success: true,
      data: {
        filterDepartment: departmentParam,
        filterShelf: shelfParam || null,
        challans,
        defectRecords,
        defectedRolls: rolls,
        summary: {
          factoryTotalDefectivePieces,
          factoryTotalQuarantinedMeters: Number(totalQuarantinedMeters.toFixed(2)),
          factoryTotalsByUnit,
          quarantinedByUnit,
          totalDefectedRolls: rolls.length,
          totalIncidents: allDefectChallans.length + rolls.length,
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
