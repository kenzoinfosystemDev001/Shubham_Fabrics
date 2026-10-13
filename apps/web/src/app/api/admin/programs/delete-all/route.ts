import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function DELETE() {
  try {
    await prisma.$transaction(
      async (tx) => {
        // 1. Release all fabric store rolls attached to any program
        await tx.fabricStoreRoll.updateMany({
          data: { programIssuedToId: null, status: 'IN_STOCK' },
        });

        // 2. Unlink all parent challans to prevent self-referential foreign key constraint errors
        await tx.challan.updateMany({
          data: { parentChallanId: null },
        });

        // 3. Clear DyeingOrder references to challans
        await tx.dyeingOrder.updateMany({
          data: { inboundChallanId: null, qc1ChallanId: null },
        });

        // 4. Delete all production and inspection logs that reference challans or programs
        await tx.fabricStockLedger.deleteMany({});
        await tx.cartonBundle.deleteMany({});
        await tx.bundle.deleteMany({});
        await tx.carton.deleteMany({});
        await tx.productionTransaction.deleteMany({});
        await tx.defectLog.deleteMany({});
        await tx.qualityInspectionParameter.deleteMany({});
        await tx.qualityInspection.deleteMany({});
        await tx.defectRecord.deleteMany({});
        await tx.fabricRoll.deleteMany({});
        await tx.fabricBatch.deleteMany({});
        await tx.reworkTransaction.deleteMany({});
        await tx.recutRequest.deleteMany({});
        await tx.stockLedgerEntry.deleteMany({});

        // 5. Delete all Dyeing Orders
        await tx.dyeingOrder.deleteMany({});

        // 6. Delete all Challan Items, Events, and Challans
        await tx.challanItem.deleteMany({});
        await tx.challanEvent.deleteMany({});
        await tx.challan.deleteMany({});

        // 7. Delete all Program routes, steps, BOMs, specifications, sizes, colours, fabrics
        await tx.programRouteStep.deleteMany({});
        await tx.programRoute.deleteMany({});
        await tx.programBOM.deleteMany({});
        await tx.programSpecification.deleteMany({});
        await tx.programSize.deleteMany({});
        await tx.programColour.deleteMany({});
        await tx.programFabric.deleteMany({});

        // 8. Delete program-related audit logs
        await tx.auditLog.deleteMany({
          where: { entity: { in: ['Program', 'DyeingOrder', 'Challan'] } },
        });

        // 9. Permanently delete ALL programs from PostgreSQL
        await tx.program.deleteMany({});
      },
      { maxWait: 20000, timeout: 60000 }
    );

    return NextResponse.json({
      success: true,
      message: 'All production sheets and associated manufacturing records permanently deleted from the database.',
    });
  } catch (error: any) {
    console.error('Error deleting all programs:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete all programs' },
      { status: 500 }
    );
  }
}
