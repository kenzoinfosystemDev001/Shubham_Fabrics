import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import { MIXED_UNIT, addTotals, challanTotalsByUnit, unitOf } from '@/lib/challan-units.mjs';

type Totals = Record<string, number>;
const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export const dynamic = 'force-dynamic';

const DEPT_CONFIG: Record<
  string,
  { name: string; defaultUnit: 'MTR' | 'PCS'; shelfCode: string; shelfName: string }
> = {
  STORE: {
    name: 'Raw Fabric Store',
    defaultUnit: 'MTR',
    shelfCode: 'DEF-SHELF-STORE',
    shelfName: 'Raw Fabric Store Quarantined Shelf',
  },
  DYEING: {
    name: 'Dyeing Department',
    defaultUnit: 'MTR',
    shelfCode: 'DEF-SHELF-DYEING',
    shelfName: 'Dyeing Station Defective Shelf',
  },
  QC1: {
    name: 'Dyeing QC',
    defaultUnit: 'MTR',
    shelfCode: 'DEF-SHELF-QC1',
    shelfName: 'Dyeing QC Defective Shelf',
  },
  EMBROIDERY: {
    name: 'Embroidery Department',
    defaultUnit: 'PCS',
    shelfCode: 'DEF-SHELF-EMBROIDERY',
    shelfName: 'Embroidery Station Defective Shelf',
  },
  THREAD_CUTTING: {
    name: 'Thread Cutting Department',
    defaultUnit: 'PCS',
    shelfCode: 'DEF-SHELF-THREAD-CUTTING',
    shelfName: 'Thread Cutting Trimming & Snip Shelf',
  },
  QC2: {
    name: 'Threadcut QC',
    defaultUnit: 'PCS',
    shelfCode: 'DEF-SHELF-QC2',
    shelfName: 'Threadcut QC Defective Shelf',
  },
  WASHING: {
    name: 'Washing Department',
    defaultUnit: 'PCS',
    shelfCode: 'DEF-SHELF-WASHING',
    shelfName: 'Washing Station Defective Shelf',
  },
  QC3: {
    name: 'Washing QC',
    defaultUnit: 'PCS',
    shelfCode: 'DEF-SHELF-QC3',
    shelfName: 'Washing QC Defective Shelf',
  },
  FINAL_CHECK: {
    name: 'Final check',
    defaultUnit: 'PCS',
    shelfCode: 'DEF-SHELF-FINAL-CHECK',
    shelfName: 'Final check Defective Shelf',
  },
  PROGRAMMING: {
    name: 'Programming Department',
    defaultUnit: 'PCS',
    shelfCode: 'DEF-SHELF-CENTRAL',
    shelfName: 'Central Master Defective Registry',
  },
};

const normalizeDept = (dept?: string | null): string => {
  if (!dept) return 'STORE';
  const up = dept.toUpperCase().trim();
  if (up.includes('PROG')) return 'PROGRAMMING';
  if (up.includes('STORE') || up.includes('STR')) return 'STORE';
  if (up.includes('QC1') || up.includes('DYEING QC') || up.includes('DYE QC')) return 'QC1';
  if (up.includes('DYE')) return 'DYEING';
  if (up.includes('EMB')) return 'EMBROIDERY';
  if (up.includes('QC2') || up.includes('THREAD CUT QC') || up.includes('THREAD CUTTING QC')) return 'QC2';
  if (up.includes('THREAD') || up.includes('CUTTING') || up.includes('THC')) return 'THREAD_CUTTING';
  if (up.includes('QC3') || up.includes('WASHING QC') || up.includes('WASH QC')) return 'QC3';
  if (up.includes('WASH')) return 'WASHING';
  if (up.includes('FINAL') || up.includes('FINAL_CHECK') || up.includes('FINAL CHECK')) return 'FINAL_CHECK';
  return up;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawDept = searchParams.get('department')?.toUpperCase() || 'ALL';
    const filterDept = rawDept !== 'ALL' ? normalizeDept(rawDept) : 'ALL';

    // 1. Fetch Inbound Challans (Stock entering departments)
    const inboundChallans = await prisma.challan.findMany({
      where: {
        status: {
          in: [
            'ISSUED',
            'IN_TRANSIT',
            'SUBMITTED',
            'RECEIVED',
            'UNDER_INSPECTION',
            'IN_PROCESS',
            'IN_PROGRESS',
            'IN_DYEING',
            'PARTIALLY_DYED',
            'DYED',
            'READY_FOR_QC1',
            'QC_APPROVED',
            'COMPLETED',
          ],
        },
      },
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
            targetQuantity: true,
            quantityMeasurement: true,
          },
        },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 400,
    });

    // 2. Fetch Fabric Store Raw Rolls Stock (for Store specific balance)
    const storeRolls = await prisma.fabricStoreRoll.findMany({
      where: {
        status: 'IN_STOCK',
        qcStatus: 'PASSED',
      },
      include: {
        batch: {
          select: {
            batchNumber: true,
            fabricType: true,
            fabricDescription: true,
            colorName: true,
            unit: true,
          },
        },
      },
    });

    // Rolls in stock per unit: a roll is in its batch's unit (MTR or PCS); the two are never added.
    const storeRollsByUnit: Totals = {};
    for (const r of storeRolls) addTotals(storeRollsByUnit, { [unitOf(r.batch?.unit) || 'MTR']: Number(r.length) || 0 });

    // 3. Compute Per-Department Stock Balances. Every quantity is kept per unit (MTR / PCS); the
    // single-number fields are the department's main unit only (`unit`), kept for older readers.
    const emptyStat = (unit: 'MTR' | 'PCS', received: Totals = {}, activeWip = 0) => ({
      totalReceived: 0,
      pendingInTransit: 0,
      pendingBatches: 0,
      totalDispatched: 0,
      totalDefective: 0,
      activeWip,
      currentStockOnHand: 0,
      unit,
      activeBatches: 0,
      inventoryItems: [] as any[],
      byUnit: {
        totalReceived: { ...received } as Totals,
        pendingInTransit: {} as Totals,
        totalDispatched: {} as Totals,
        totalDefective: {} as Totals,
        currentStockOnHand: {} as Totals,
      },
    });
    const deptStats: Record<string, ReturnType<typeof emptyStat>> = Object.fromEntries(
      Object.entries(DEPT_CONFIG).map(([key, cfg]) => [
        key,
        key === 'STORE' ? emptyStat(cfg.defaultUnit, storeRollsByUnit, storeRolls.length) : emptyStat(cfg.defaultUnit),
      ])
    );

    const minus = (a: Totals, b: Totals): Totals =>
      Object.fromEntries(Object.entries(a).map(([u, q]) => [u, round2(Math.max(0, q - (b[u] || 0)))]));

    // Calculate Inflows and Outflows based on Challan transactions
    for (const ch of inboundChallans) {
      const fromD = normalizeDept(ch.fromDepartment);
      const toD = normalizeDept(ch.toDepartment);

      // A challan's header quantities hold one unit; a MIXED challan (lines in both units) has none,
      // so its quantities come from its lines, each in its own unit.
      const headerUnit = unitOf(ch.fabricUnit);
      const itemTotals = challanTotalsByUnit({ items: ch.items, fabricUnit: ch.fabricUnit });
      const programUnit = unitOf(ch.program?.quantityMeasurement) || 'PCS';
      const inTotals: Totals =
        headerUnit && Number(ch.fabricIn) > 0
          ? { [headerUnit]: Number(ch.fabricIn) }
          : Object.keys(itemTotals).length > 0
          ? itemTotals
          : Number(ch.program?.targetQuantity) > 0
          ? { [programUnit]: Number(ch.program?.targetQuantity) }
          : {};
      const defectUnit = unitOf(ch.defectiveUnit) || headerUnit;
      const defTotals: Totals = Number(ch.defectivePieces) > 0 && defectUnit ? { [defectUnit]: Number(ch.defectivePieces) } : {};
      const outTotals: Totals =
        headerUnit && Number(ch.fabricOut) > 0
          ? { [headerUnit]: Number(ch.fabricOut) }
          : ch.fabricUnit === MIXED_UNIT
          ? itemTotals
          : minus(inTotals, defTotals);

      // Determine whether destination department has officially RECEIVED the material
      const isReceived = [
        'RECEIVED',
        'UNDER_INSPECTION',
        'IN_PROCESS',
        'IN_PROGRESS',
        'IN_DYEING',
        'PARTIALLY_DYED',
        'DYED',
        'READY_FOR_QC1',
        'QC_APPROVED',
        'COMPLETED',
      ].includes(ch.status);

      // Inflow to destination department
      if (deptStats[toD]) {
        if (isReceived) {
          addTotals(deptStats[toD].byUnit.totalReceived, inTotals);
          deptStats[toD].activeBatches += 1;
        } else {
          // Status is ISSUED / IN_TRANSIT / SUBMITTED -> awaiting receive
          addTotals(deptStats[toD].byUnit.pendingInTransit, inTotals);
          deptStats[toD].pendingBatches += 1;
        }

        const rowUnits = Array.from(new Set([...Object.keys(inTotals), ...Object.keys(defTotals), ...Object.keys(outTotals)]));
        const rowUnit = rowUnits.length === 1 ? rowUnits[0] : rowUnits.length > 1 ? MIXED_UNIT : headerUnit || DEPT_CONFIG[toD]?.defaultUnit || 'MTR';
        const single = (t: Totals) => (rowUnit === MIXED_UNIT ? null : t[rowUnit] || 0);
        const balanceTotals = isReceived ? minus(inTotals, defTotals) : {};

        // Add to inventory items list. Quantities are per unit (`...ByUnit`); the single numbers are
        // set only when the lot is in one unit.
        deptStats[toD].inventoryItems.push({
          id: ch.id,
          challanNumber: ch.challanNumber,
          programId: ch.programId,
          programSerialNo: ch.program?.programSerialNo || ch.program?.programNumber || 'N/A',
          clientName: ch.program?.clientName || ch.program?.buyerName || 'Standard Client',
          style: ch.program?.mainStyle || ch.program?.wilcomDesignNumber || 'Main Style',
          fabricDescription: ch.program?.fabricName || ch.items[0]?.itemDescription || 'Fabric Lot',
          color: ch.program?.fabricColor || ch.items[0]?.colour || 'Standard',
          quantityIn: single(inTotals),
          quantityOut: single(outTotals),
          defectiveQuantity: single(defTotals),
          balanceOnHand: single(balanceTotals),
          quantityInByUnit: inTotals,
          quantityOutByUnit: outTotals,
          defectiveByUnit: defTotals,
          balanceByUnit: balanceTotals,
          uom: rowUnit,
          fromDepartment: fromD,
          toDepartment: toD,
          status: isReceived ? ch.status : 'IN_TRANSIT',
          originalStatus: ch.status,
          isReceived,
          receivedDate: ch.receivedDate,
          date: ch.issuedDate || ch.createdAt,
          remarks: ch.remarks,
        });
      }

      // Outflow from source department:
      // Once issued/dispatched downstream, source department stock is reduced
      if (deptStats[fromD]) {
        addTotals(deptStats[fromD].byUnit.totalDispatched, outTotals);
        addTotals(deptStats[fromD].byUnit.totalDefective, defTotals);
      }
    }

    // Compute Net On Hand for each department, per unit
    for (const [key, stat] of Object.entries(deptStats)) {
      const b = stat.byUnit;
      if (key === 'STORE') {
        // Store has warehouse rolls minus issues, unit by unit (PCS issues never reduce meter rolls)
        b.currentStockOnHand = minus(storeRollsByUnit, b.totalDispatched);
      } else {
        const units = new Set([...Object.keys(b.totalReceived), ...Object.keys(b.totalDispatched), ...Object.keys(b.totalDefective)]);
        b.currentStockOnHand = Object.fromEntries(
          Array.from(units).map((u) => [u, round2(Math.max(0, (b.totalReceived[u] || 0) - (b.totalDispatched[u] || 0) - (b.totalDefective[u] || 0)))])
        );
      }
      stat.totalReceived = round2(b.totalReceived[stat.unit] || 0);
      stat.pendingInTransit = round2(b.pendingInTransit[stat.unit] || 0);
      stat.totalDispatched = round2(b.totalDispatched[stat.unit] || 0);
      stat.totalDefective = round2(b.totalDefective[stat.unit] || 0);
      stat.currentStockOnHand = round2(b.currentStockOnHand[stat.unit] || 0);
      stat.activeWip = Math.max(
        0,
        stat.inventoryItems.filter((i) => i.isReceived && i.status !== 'COMPLETED').length
      );
    }

    // Prepare response data
    const selectedStats =
      filterDept !== 'ALL' && deptStats[filterDept]
        ? deptStats[filterDept]
        : deptStats.DYEING;

    return NextResponse.json({
      success: true,
      data: {
        department: filterDept,
        departmentConfig: DEPT_CONFIG[filterDept] || DEPT_CONFIG.DYEING,
        summary: {
          // Single numbers are in `unit` only; byUnit holds every unit separately.
          totalReceived: selectedStats.totalReceived,
          pendingInTransit: selectedStats.pendingInTransit,
          pendingBatches: selectedStats.pendingBatches,
          totalDispatched: selectedStats.totalDispatched,
          totalDefective: selectedStats.totalDefective,
          currentStockOnHand: selectedStats.currentStockOnHand,
          activeWip: selectedStats.activeWip,
          activeBatches: selectedStats.activeBatches,
          unit: selectedStats.unit,
          byUnit: selectedStats.byUnit,
          shelfCode: DEPT_CONFIG[filterDept]?.shelfCode || 'DEF-SHELF-CENTRAL',
          shelfName: DEPT_CONFIG[filterDept]?.shelfName || 'Department Defective Shelf',
        },
        inventory: selectedStats.inventoryItems,
        allDepartments: deptStats,
        departmentMap: DEPT_CONFIG,
      },
    });
  } catch (error: any) {
    console.error('Department stock API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch department stock' },
      { status: 500 }
    );
  }
}
