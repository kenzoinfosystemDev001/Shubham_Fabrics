import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import { requireUser } from '@/lib/auth/require-user';

import { STOCK_REFERENCE, STORE_STOCK_DEPARTMENT } from '@/lib/fabric-stock-ledger';

export const dynamic = 'force-dynamic';

/** The phrase the admin types on the Admin page; without it nothing is deleted. */
const CONFIRM_PHRASE = 'DELETE ALL';

/**
 * Deletes every challan. Admin only, and only with the typed confirmation phrase (unlike the
 * production-sheet and full-data wipes, this one is not behind ALLOW_DESTRUCTIVE_ADMIN_ACTIONS).
 */
export async function DELETE(request: Request) {
  const { user: authUser, response: authResponse } = await requireUser(request, { admin: true });
  if (!authUser) return authResponse;
  const body = await request.json().catch(() => null);
  if (body?.confirm !== CONFIRM_PHRASE) {
    return NextResponse.json({ error: `Type "${CONFIRM_PHRASE}" to confirm deleting every challan.` }, { status: 400 });
  }
  try {
    const challanCount = await prisma.challan.count();
    await prisma.$transaction(
      async (tx) => {
        // 1. Break genealogy hierarchy (child -> parent)
        await tx.challan.updateMany({
          data: { parentChallanId: null },
        });

        // 2. Department work items are derived from challans: remove them with the challans.
        await tx.departmentWorkItem.deleteMany({});

        // Unlink Challans from Dyeing Orders
        await tx.dyeingOrder.updateMany({
          data: { inboundChallanId: null, qc1ChallanId: null },
        });

        // 3. Delete production logs referencing challans
        await tx.productionTransaction.deleteMany({});

        // 4. Delete quality inspections, defects, bundles
        await tx.cartonBundle.deleteMany({});
        await tx.bundle.deleteMany({});
        await tx.defectLog.deleteMany({});
        await tx.qualityInspectionParameter.deleteMany({});
        await tx.qualityInspection.deleteMany({});
        await tx.defectRecord.deleteMany({});

        // 5. Delete challan line items and tracking events
        await tx.challanItem.deleteMany({});
        await tx.challanEvent.deleteMany({});

        // 6. Delete challan audit logs
        await tx.auditLog.deleteMany({
          where: { entity: 'Challan' },
        });

        // Fabric Store ledger postings of the deleted challans; their stock returns to the store.
        await tx.stockLedgerEntry.deleteMany({
          where: { departmentCode: STORE_STOCK_DEPARTMENT, referenceType: STOCK_REFERENCE.CHALLAN },
        });

        // 7. Permanently delete ALL Challans from PostgreSQL
        await tx.challan.deleteMany({});

        // Who wiped the challans and when (kept: only 'Challan' entries were cleared above).
        await tx.auditLog.create({
          data: {
            actorId: authUser.id,
            action: 'ALL_CHALLANS_DELETED',
            entity: 'System',
            entityId: 'challans',
            beforeState: JSON.stringify({ challanCount }),
            afterState: JSON.stringify({ challanCount: 0 }),
          },
        });
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
