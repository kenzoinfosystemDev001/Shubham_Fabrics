import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

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
  DYEING_QC: {
    name: 'Dyeing QC',
    defaultUnit: 'MTR',
    shelfCode: 'DEF-SHELF-DYEING-QC',
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
  THREADCUT_QC: {
    name: 'Threadcut QC',
    defaultUnit: 'PCS',
    shelfCode: 'DEF-SHELF-THREADCUT-QC',
    shelfName: 'Threadcut QC Defective Shelf',
  },
  WASHING: {
    name: 'Washing Department',
    defaultUnit: 'PCS',
    shelfCode: 'DEF-SHELF-WASHING',
    shelfName: 'Washing Station Defective Shelf',
  },
  WASHING_QC: {
    name: 'Washing QC',
    defaultUnit: 'PCS',
    shelfCode: 'DEF-SHELF-WASHING-QC',
    shelfName: 'Washing QC Defective Shelf',
  },
  FINAL_QC: {
    name: 'Final QC',
    defaultUnit: 'PCS',
    shelfCode: 'DEF-SHELF-FINAL-QC',
    shelfName: 'Final QC Defective Shelf',
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
  if (up.includes('DYEING_QC') || up.includes('DYEING QC') || up.includes('DYE QC')) return 'DYEING_QC';
  if (up.includes('DYE')) return 'DYEING';
  if (up.includes('EMB')) return 'EMBROIDERY';
  if (up.includes('THREADCUT_QC') || up.includes('THREAD CUT QC') || up.includes('THREADCUT QC') || up.includes('THREAD CUTTING QC')) return 'THREADCUT_QC';
  if (up.includes('THREAD') || up.includes('CUTTING') || up.includes('THC')) return 'THREAD_CUTTING';
  if (up.includes('WASHING_QC') || up.includes('WASHING QC') || up.includes('WASH QC')) return 'WASHING_QC';
  if (up.includes('WASH')) return 'WASHING';
  if (up.includes('FINAL')) return 'FINAL_QC';
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
            'READY_FOR_DYEING_QC',
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
          },
        },
      },
    });

    const storeAvailableMeters = storeRolls.reduce(
      (sum, r) => sum + (Number(r.length) || 0),
      0
    );

    // 3. Compute Per-Department Stock Balances
    const deptStats: Record<
      string,
      {
        totalReceived: number;
        pendingInTransit: number;
        pendingBatches: number;
        totalDispatched: number;
        totalDefective: number;
        activeWip: number;
        currentStockOnHand: number;
        unit: 'MTR' | 'PCS';
        activeBatches: number;
        inventoryItems: any[];
      }
    > = {
      STORE: {
        totalReceived: Number(storeAvailableMeters.toFixed(2)),
        pendingInTransit: 0,
        pendingBatches: 0,
        totalDispatched: 0,
        totalDefective: 0,
        activeWip: storeRolls.length,
        currentStockOnHand: Number(storeAvailableMeters.toFixed(2)),
        unit: 'MTR',
        activeBatches: 0,
        inventoryItems: [],
      },
      DYEING: {
        totalReceived: 0,
        pendingInTransit: 0,
        pendingBatches: 0,
        totalDispatched: 0,
        totalDefective: 0,
        activeWip: 0,
        currentStockOnHand: 0,
        unit: 'MTR',
        activeBatches: 0,
        inventoryItems: [],
      },
      DYEING_QC: {
        totalReceived: 0,
        pendingInTransit: 0,
        pendingBatches: 0,
        totalDispatched: 0,
        totalDefective: 0,
        activeWip: 0,
        currentStockOnHand: 0,
        unit: 'MTR',
        activeBatches: 0,
        inventoryItems: [],
      },
      EMBROIDERY: {
        totalReceived: 0,
        pendingInTransit: 0,
        pendingBatches: 0,
        totalDispatched: 0,
        totalDefective: 0,
        activeWip: 0,
        currentStockOnHand: 0,
        unit: 'PCS',
        activeBatches: 0,
        inventoryItems: [],
      },
      THREAD_CUTTING: {
        totalReceived: 0,
        pendingInTransit: 0,
        pendingBatches: 0,
        totalDispatched: 0,
        totalDefective: 0,
        activeWip: 0,
        currentStockOnHand: 0,
        unit: 'PCS',
        activeBatches: 0,
        inventoryItems: [],
      },
      THREADCUT_QC: {
        totalReceived: 0,
        pendingInTransit: 0,
        pendingBatches: 0,
        totalDispatched: 0,
        totalDefective: 0,
        activeWip: 0,
        currentStockOnHand: 0,
        unit: 'PCS',
        activeBatches: 0,
        inventoryItems: [],
      },
      WASHING: {
        totalReceived: 0,
        pendingInTransit: 0,
        pendingBatches: 0,
        totalDispatched: 0,
        totalDefective: 0,
        activeWip: 0,
        currentStockOnHand: 0,
        unit: 'PCS',
        activeBatches: 0,
        inventoryItems: [],
      },
      WASHING_QC: {
        totalReceived: 0,
        pendingInTransit: 0,
        pendingBatches: 0,
        totalDispatched: 0,
        totalDefective: 0,
        activeWip: 0,
        currentStockOnHand: 0,
        unit: 'PCS',
        activeBatches: 0,
        inventoryItems: [],
      },
      FINAL_QC: {
        totalReceived: 0,
        pendingInTransit: 0,
        pendingBatches: 0,
        totalDispatched: 0,
        totalDefective: 0,
        activeWip: 0,
        currentStockOnHand: 0,
        unit: 'PCS',
        activeBatches: 0,
        inventoryItems: [],
      },
      PROGRAMMING: {
        totalReceived: 0,
        pendingInTransit: 0,
        pendingBatches: 0,
        totalDispatched: 0,
        totalDefective: 0,
        activeWip: 0,
        currentStockOnHand: 0,
        unit: 'PCS',
        activeBatches: 0,
        inventoryItems: [],
      },
    };

    // Calculate Inflows and Outflows based on Challan transactions
    for (const ch of inboundChallans) {
      const fromD = normalizeDept(ch.fromDepartment);
      const toD = normalizeDept(ch.toDepartment);

      // A challan that mixes MTR and PCS lines is accounted per unit, never as one total.
      const unitGroups: Array<{ unit: string | null; items: typeof ch.items }> = ch.fabricUnit === 'MIXED'
        ? Array.from(new Set(ch.items.map((it) => it.uom))).map((unit) => ({ unit, items: ch.items.filter((it) => it.uom === unit) }))
        : [{ unit: null, items: ch.items }];
      let outQtyTotal = 0;
      let defQtyTotal = 0;

      for (const group of unitGroups) {
        const itemsQty = group.items.reduce(
          (s, it) => s + (Number(it.quantity) || 0),
          0
        );

        const inQty = group.unit ? itemsQty : Number(ch.fabricIn) || itemsQty || Number(ch.program?.targetQuantity) || 0;
        const defQty = group.unit ? 0 : Number(ch.defectivePieces) || 0;
        const outQty = group.unit ? itemsQty : Number(ch.fabricOut) || Math.max(0, inQty - defQty);
        outQtyTotal += outQty;
        defQtyTotal += defQty;
        // Determine whether destination department has officially RECEIVED the material
        const isReceived = [
          'RECEIVED',
          'UNDER_INSPECTION',
          'IN_PROCESS',
          'IN_PROGRESS',
          'IN_DYEING',
          'PARTIALLY_DYED',
          'DYED',
          'READY_FOR_DYEING_QC',
          'QC_APPROVED',
          'COMPLETED',
        ].includes(ch.status);

        // Inflow to destination department
        if (deptStats[toD]) {
          if (isReceived) {
            deptStats[toD].totalReceived += inQty;
            deptStats[toD].activeBatches += 1;
          } else {
            // Status is ISSUED / IN_TRANSIT / SUBMITTED -> awaiting receive
            deptStats[toD].pendingInTransit += inQty;
            deptStats[toD].pendingBatches += 1;
          }

          // Add to inventory items list
          deptStats[toD].inventoryItems.push({
            id: group.unit ? `${ch.id}-${group.unit}` : ch.id,
            challanNumber: ch.challanNumber,
            programId: ch.programId,
            programSerialNo: ch.program?.programSerialNo || ch.program?.programNumber || 'N/A',
            clientName: ch.program?.clientName || ch.program?.buyerName || 'Standard Client',
            style: ch.program?.mainStyle || ch.program?.wilcomDesignNumber || 'Main Style',
            fabricDescription: ch.program?.fabricName || group.items[0]?.itemDescription || 'Fabric Lot',
            color: ch.program?.fabricColor || group.items[0]?.colour || 'Standard',
            quantityIn: inQty,
            quantityOut: outQty,
            defectiveQuantity: defQty,
            balanceOnHand: isReceived ? Math.max(0, inQty - defQty) : 0,
            uom: group.unit || ch.fabricUnit || (DEPT_CONFIG[toD]?.defaultUnit) || 'MTR',
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

      // Outflow from source department:
      // Once issued/dispatched downstream, source department stock is reduced
      if (deptStats[fromD]) {
        deptStats[fromD].totalDispatched += outQtyTotal;
        deptStats[fromD].totalDefective += defQtyTotal;
      }
    }

    // Compute Net On Hand for each department
    for (const [key, stat] of Object.entries(deptStats)) {
      if (key === 'STORE') {
        // Store has warehouse rolls minus issues
        stat.currentStockOnHand = Number(
          Math.max(0, storeAvailableMeters - stat.totalDispatched).toFixed(2)
        );
      } else {
        stat.currentStockOnHand = Number(
          Math.max(0, stat.totalReceived - stat.totalDispatched - stat.totalDefective).toFixed(2)
        );
      }
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
          totalReceived: Number(selectedStats.totalReceived.toFixed(2)),
          pendingInTransit: Number(selectedStats.pendingInTransit.toFixed(2)),
          pendingBatches: selectedStats.pendingBatches,
          totalDispatched: Number(selectedStats.totalDispatched.toFixed(2)),
          totalDefective: Number(selectedStats.totalDefective.toFixed(2)),
          currentStockOnHand: Number(selectedStats.currentStockOnHand.toFixed(2)),
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
