import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { loadStockBook } from '@/lib/fabric-stock-ledger';
import { addToUnitTotals, normalizeStockUnit, unitTotals, type UnitTotals } from '@/lib/fabric-stock';
import { roundQty } from '@/lib/fabric-stock-rules.mjs';

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

    // 2. Fabric Store stock: the same per-unit balances as Total Stock (inward entries less Fabric Store
    //    challans and manual outward), plus QC-passed rolls in stock, each in its own unit.
    const [{ book }, storeRolls] = await Promise.all([
      loadStockBook(prisma),
      prisma.fabricStoreRoll.findMany({
        where: { status: 'IN_STOCK', qcStatus: 'PASSED' },
        select: { length: true, unit: true },
      }),
    ]);

    // 3. Per-department balances. Every quantity is kept per unit (MTR / PCS); never added together.
    type Totals = UnitTotals;
    interface DeptStat {
      totalReceived: Totals;
      pendingInTransit: Totals;
      pendingBatches: number;
      totalDispatched: Totals;
      totalDefective: Totals;
      activeWip: number;
      currentStockOnHand: Totals;
      unit: 'MTR' | 'PCS';
      activeBatches: number;
      inventoryItems: any[];
    }
    const newStat = (code: string): DeptStat => ({
      totalReceived: unitTotals(),
      pendingInTransit: unitTotals(),
      pendingBatches: 0,
      totalDispatched: unitTotals(),
      totalDefective: unitTotals(),
      activeWip: 0,
      currentStockOnHand: unitTotals(),
      unit: DEPT_CONFIG[code].defaultUnit,
      activeBatches: 0,
      inventoryItems: [],
    });
    const deptStats: Record<string, DeptStat> = Object.fromEntries(Object.keys(DEPT_CONFIG).map((code) => [code, newStat(code)]));

    const store = deptStats.STORE;
    for (const bucket of book.buckets.values()) {
      addToUnitTotals(store.totalReceived, bucket.unit, bucket.totalInward);
      addToUnitTotals(store.totalDispatched, bucket.unit, bucket.totalOutward);
      addToUnitTotals(store.currentStockOnHand, bucket.unit, Math.max(0, bucket.totalInward - bucket.totalOutward));
    }
    for (const roll of storeRolls) {
      addToUnitTotals(store.totalReceived, roll.unit, Number(roll.length) || 0);
      addToUnitTotals(store.currentStockOnHand, roll.unit, Number(roll.length) || 0);
    }
    store.activeWip = storeRolls.length;

    const RECEIVED_STATUSES = [
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
    ];

    // Challan transactions: each challan's lines are counted in their own unit.
    for (const ch of inboundChallans) {
      const fromD = normalizeDept(ch.fromDepartment);
      const toD = normalizeDept(ch.toDepartment);
      const challanUnit = normalizeStockUnit(ch.fabricUnit) || DEPT_CONFIG[toD]?.defaultUnit || 'MTR';

      const inByUnit = unitTotals();
      if (ch.items.length > 0) {
        for (const it of ch.items) addToUnitTotals(inByUnit, normalizeStockUnit(it.uom) || challanUnit, Number(it.quantity) || 0);
      } else {
        addToUnitTotals(inByUnit, challanUnit, Number(ch.fabricIn) || Number(ch.program?.targetQuantity) || 0);
      }
      // Defective quantity is recorded in the challan's unit; the rest of a unit goes on.
      const defByUnit = addToUnitTotals(unitTotals(), challanUnit, Number(ch.defectivePieces) || 0);
      const units = Object.keys(inByUnit).filter((u) => inByUnit[u] > 0 || defByUnit[u] > 0);
      const outByUnit = unitTotals();
      for (const u of units) {
        const out = units.length === 1 && Number(ch.fabricOut) > 0 ? Number(ch.fabricOut) : Math.max(0, (inByUnit[u] || 0) - (defByUnit[u] || 0));
        addToUnitTotals(outByUnit, u, out);
      }

      const isReceived = RECEIVED_STATUSES.includes(ch.status);

      // Inflow to the destination department
      const dest = deptStats[toD];
      if (dest) {
        for (const u of units) addToUnitTotals(isReceived ? dest.totalReceived : dest.pendingInTransit, u, inByUnit[u] || 0);
        if (isReceived) dest.activeBatches += 1;
        else dest.pendingBatches += 1;

        // One stock row per challan and unit
        for (const u of units) {
          dest.inventoryItems.push({
            id: ch.id,
            challanNumber: ch.challanNumber,
            programId: ch.programId,
            programSerialNo: ch.program?.programSerialNo || ch.program?.programNumber || 'N/A',
            clientName: ch.program?.clientName || ch.program?.buyerName || 'Standard Client',
            style: ch.program?.mainStyle || ch.program?.wilcomDesignNumber || 'Main Style',
            fabricDescription: ch.program?.fabricName || ch.items[0]?.itemDescription || 'Fabric Lot',
            color: ch.program?.fabricColor || ch.items[0]?.colour || 'Standard',
            quantityIn: inByUnit[u] || 0,
            quantityOut: outByUnit[u] || 0,
            defectiveQuantity: defByUnit[u] || 0,
            balanceOnHand: isReceived ? Math.max(0, (inByUnit[u] || 0) - (defByUnit[u] || 0)) : 0,
            uom: u,
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
      }

      // Outflow from the source department (the Fabric Store's own issues are already in its stock book)
      const source = deptStats[fromD];
      if (source && fromD !== 'STORE') {
        for (const u of units) {
          addToUnitTotals(source.totalDispatched, u, outByUnit[u] || 0);
          addToUnitTotals(source.totalDefective, u, defByUnit[u] || 0);
        }
      }
    }

    // Net on hand per unit for each department (the Fabric Store's was set from its stock book)
    for (const [key, stat] of Object.entries(deptStats)) {
      if (key !== 'STORE') {
        for (const u of new Set([...Object.keys(stat.totalReceived), ...Object.keys(stat.totalDispatched), ...Object.keys(stat.totalDefective)])) {
          stat.currentStockOnHand[u] = Math.max(0, roundQty((stat.totalReceived[u] || 0) - (stat.totalDispatched[u] || 0) - (stat.totalDefective[u] || 0)));
        }
        stat.activeWip = stat.inventoryItems.filter((i) => i.isReceived && i.status !== 'COMPLETED').length;
      }
    }

    const selectedStats = filterDept !== 'ALL' && deptStats[filterDept] ? deptStats[filterDept] : deptStats.DYEING;

    return NextResponse.json({
      success: true,
      data: {
        department: filterDept,
        departmentConfig: DEPT_CONFIG[filterDept] || DEPT_CONFIG.DYEING,
        summary: {
          totalReceived: selectedStats.totalReceived,
          pendingInTransit: selectedStats.pendingInTransit,
          pendingBatches: selectedStats.pendingBatches,
          totalDispatched: selectedStats.totalDispatched,
          totalDefective: selectedStats.totalDefective,
          currentStockOnHand: selectedStats.currentStockOnHand,
          activeWip: selectedStats.activeWip,
          activeBatches: selectedStats.activeBatches,
          unit: selectedStats.unit,
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
