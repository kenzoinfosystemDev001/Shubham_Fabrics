import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { auditAdminAction, readReason, reasonRequiredResponse, requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function DELETE(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.actor) return auth.response;
  const body = await request.json().catch(() => ({}));
  // Irreversible bulk wipe: the admin must type the confirmation phrase and give a reason.
  if (String(body?.confirm || '').trim() !== 'DELETE ALL CHALLANS') {
    return NextResponse.json({ error: 'Type "DELETE ALL CHALLANS" to confirm.', field: 'confirm' }, { status: 400 });
  }
  const reason = readReason(body);
  if (!reason) return reasonRequiredResponse();
  try {
    await prisma.$transaction(
      async (tx) => {
        // 1. Break genealogy hierarchy (child -> parent)
        await tx.challan.updateMany({
          data: { parentChallanId: null },
        });

        // 2. Unlink Challans from Dyeing Orders
        await tx.dyeingOrder.updateMany({
          data: { inboundChallanId: null, dyeingQcChallanId: null },
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
        // Deadline alerts reference challans and programs; clear them with the data they describe.
        await tx.deadlineAlertDismissal.deleteMany({});
        await tx.deadlineAlert.deleteMany({});
        await tx.challanItem.deleteMany({});
        await tx.challanEvent.deleteMany({});


        // 7. Permanently delete ALL Challans from PostgreSQL
        await tx.challan.deleteMany({});

        await auditAdminAction(request, auth.actor.id, 'ALL_CHALLANS_DELETED', 'System', 'ALL_CHALLANS_DELETED', { after: { reason } }, tx);
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
