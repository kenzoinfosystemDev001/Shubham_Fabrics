import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import { requireUser } from '@/lib/auth/require-user';

import { STOCK_REFERENCE, STORE_STOCK_DEPARTMENT } from '@/lib/fabric-stock-ledger';

export const dynamic = 'force-dynamic';

/** The phrase the admin types on the Admin page; without it nothing is deleted. */
const CONFIRM_PHRASE = 'DELETE ALL';

/**
 * Deletes every production sheet and everything that belongs to one (challans, dyeing orders,
 * department work, production logs, bundles/cartons, defects, rework/recut requests, alerts).
 * Admin only, and only with the typed confirmation phrase.
 *
 * Fabric Store stock is kept: inward stock, GRN batches and rolls, and the roll ledger stay. Records
 * that merely point at a sheet are unlinked; rolls issued to a sheet go back into stock, and the
 * stock that deleted challans took out of the store returns to it (as with deleting all challans).
 */
export async function DELETE(request: Request) {
  const { user: authUser, response: authResponse } = await requireUser(request, { admin: true });
  if (!authUser) return authResponse;
  const body = await request.json().catch(() => null);
  if (body?.confirm !== CONFIRM_PHRASE) {
    return NextResponse.json({ error: `Type "${CONFIRM_PHRASE}" to confirm deleting every production sheet.` }, { status: 400 });
  }
  try {
    const [programCount, challanCount] = await Promise.all([prisma.program.count(), prisma.challan.count()]);

    await prisma.$transaction(
      async (tx) => {
        // 1. Stock records keep their stock and lose only the link to a sheet.
        await tx.fabricStoreRoll.updateMany({
          where: { programIssuedToId: { not: null } },
          data: { programIssuedToId: null, status: 'IN_STOCK' },
        });
        await tx.fabricBatch.updateMany({ where: { programId: { not: null } }, data: { programId: null } });
        await tx.fabricRoll.updateMany({ where: { programId: { not: null } }, data: { programId: null } });

        // 2. Stock postings made by challans or for a sheet go with them; store stock returns.
        await tx.stockLedgerEntry.deleteMany({
          where: {
            OR: [
              { programId: { not: null } },
              { departmentCode: STORE_STOCK_DEPARTMENT, referenceType: STOCK_REFERENCE.CHALLAN },
            ],
          },
        });
        await tx.deadlineAlert.deleteMany({
          where: { OR: [{ programId: { not: null } }, { challanId: { not: null } }] },
        });

        // 3. Break challan links so challans can be removed in any order.
        await tx.challan.updateMany({ data: { parentChallanId: null } });
        await tx.dyeingOrder.updateMany({ data: { inboundChallanId: null, qc1ChallanId: null } });

        // 4. Production, quality and packing records of the sheets.
        await tx.dispatchCarton.deleteMany({});
        await tx.cartonBundle.deleteMany({});
        await tx.recutRequest.deleteMany({});
        await tx.reworkTransaction.deleteMany({});
        await tx.defectRecord.deleteMany({});
        await tx.bundle.deleteMany({});
        await tx.carton.deleteMany({});
        await tx.productionTransaction.deleteMany({});
        await tx.defectLog.deleteMany({});
        await tx.qualityInspectionParameter.deleteMany({});
        await tx.qualityInspection.deleteMany({});

        // 5. Department work items and dyeing orders (their allocations, transfers and inspections cascade).
        await tx.departmentWorkItem.deleteMany({});
        await tx.dyeingOrder.deleteMany({});

        // 6. Challans with their lines and events.
        await tx.challanItem.deleteMany({});
        await tx.challanEvent.deleteMany({});
        await tx.challan.deleteMany({});

        // 7. The sheets' own details, then the sheets.
        await tx.programRouteStep.deleteMany({});
        await tx.programRoute.deleteMany({});
        await tx.programBOM.deleteMany({});
        await tx.programSpecification.deleteMany({});
        await tx.programSize.deleteMany({});
        await tx.programColour.deleteMany({});
        await tx.programFabric.deleteMany({});
        await tx.auditLog.deleteMany({
          where: { entity: { in: ['Program', 'DyeingOrder', 'Challan'] } },
        });
        await tx.program.deleteMany({});

        // Who wiped the production sheets and when.
        await tx.auditLog.create({
          data: {
            actorId: authUser.id,
            action: 'ALL_PRODUCTION_SHEETS_DELETED',
            entity: 'System',
            entityId: 'programs',
            beforeState: JSON.stringify({ programCount, challanCount }),
            afterState: JSON.stringify({ programCount: 0, challanCount: 0 }),
          },
        });
      },
      { maxWait: 20000, timeout: 60000 }
    );

    return NextResponse.json({
      success: true,
      message: 'All production sheets and their challans and production records were permanently deleted. Fabric Store stock was kept.',
    });
  } catch (error: any) {
    console.error('Error deleting all programs:', error);
    return NextResponse.json(
      { error: 'Nothing was deleted: the production sheets could not be removed. ' + (error.message || '') },
      { status: 500 }
    );
  }
}
