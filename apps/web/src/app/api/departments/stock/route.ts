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

    // STORE balance is reported in MTR; rolls received in PCS must not be added to meters.
    const storeAvailableMeters = storeRolls.reduce(
      (sum, r) => sum + (r.batch?.unit === 'PCS' ? 0 : Number(r.length) || 0),
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
      QC1: {
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
      QC2: {
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
      QC3: {
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
      FINAL_CHECK: {
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

      const itemsQty = ch.items.reduce(
        (s, it) => s + (Number(it.quantity) || 0),
        0
      );

      const inQty = Number(ch.fabricIn) || itemsQty || Number(ch.program?.targetQuantity) || 0;
      const defQty = Number(ch.defectivePieces) || 0;
      const outQty = Number(ch.fabricOut) || Math.max(0, inQty - defQty);

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
          deptStats[toD].totalReceived += inQty;
          deptStats[toD].activeBatches += 1;
        } else {
          // Status is ISSUED / IN_TRANSIT / SUBMITTED -> awaiting receive
          deptStats[toD].pendingInTransit += inQty;
          deptStats[toD].pendingBatches += 1;
        }

        // Add to inventory items list
        deptStats[toD].inventoryItems.push({
          id: ch.id,
          challanNumber: ch.challanNumber,
          programId: ch.programId,
          programSerialNo: ch.program?.programSerialNo || ch.program?.programNumber || 'N/A',
          clientName: ch.program?.clientName || ch.program?.buyerName || 'Standard Client',
          style: ch.program?.mainStyle || ch.program?.wilcomDesignNumber || 'Main Style',
          fabricDescription: ch.program?.fabricName || ch.items[0]?.itemDescription || 'Fabric Lot',
          color: ch.program?.fabricColor || ch.items[0]?.colour || 'Standard',
          quantityIn: inQty,
          quantityOut: outQty,
          defectiveQuantity: defQty,
          balanceOnHand: isReceived ? Math.max(0, inQty - defQty) : 0,
          uom: ch.fabricUnit || (DEPT_CONFIG[toD]?.defaultUnit) || 'MTR',
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
        deptStats[fromD].totalDispatched += outQty;
        deptStats[fromD].totalDefective += defQty;
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
