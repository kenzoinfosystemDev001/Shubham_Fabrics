import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function DELETE() {
  try {
    await prisma.$transaction(
      async (tx) => {
        // 1. Break genealogy hierarchy (child -> parent)
        await tx.challan.updateMany({
          data: { parentChallanId: null },
        });

        // 2. Unlink Challans from Dyeing Orders
        await tx.dyeingOrder.updateMany({
          data: { inboundChallanId: null, qc1ChallanId: null },
        });

        // 3. Delete production logs referencing challans
        await tx.productionTransaction.deleteMany({});

        // 4. Delete quality inspections, defects, bundles
        await tx.qualityInspection.deleteMany({});
        await tx.defectRecord.deleteMany({});
        await tx.bundle.deleteMany({});

        // 5. Delete challan line items and tracking events
        await tx.challanItem.deleteMany({});
        await tx.challanEvent.deleteMany({});

        // 6. Delete challan audit logs
        await tx.auditLog.deleteMany({
          where: { entity: 'Challan' },
        });

        // 7. Permanently delete ALL Challans from PostgreSQL
        await tx.challan.deleteMany({});
      },
      { maxWait: 20000, timeout: 60000 }
    );

    return NextResponse.json({
      success: true,
      message: 'All factory challans and movement records permanently deleted from the database.',
    });
  } catch (error: any) {
    console.error('Error deleting all challans:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete all challans' },
      { status: 500 }
    );
  }
}
