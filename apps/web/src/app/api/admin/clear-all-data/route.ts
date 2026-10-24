import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { auditAdminAction, readReason, reasonRequiredResponse, requireAdmin } from '@/lib/admin-auth';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.actor) return auth.response;
  const body = await request.json().catch(() => ({}));
  // Irreversible bulk wipe: the admin must type the confirmation phrase and give a reason.
  if (String(body?.confirm || '').trim() !== 'CLEAR ALL FACTORY DATA') {
    return NextResponse.json({ error: 'Type "CLEAR ALL FACTORY DATA" to confirm.', field: 'confirm' }, { status: 400 });
  }
  const reason = readReason(body);
  if (!reason) return reasonRequiredResponse();
  try {
    await prisma.$transaction(
      async (tx) => {
        // 1. Release all fabric store rolls & clear inventory dependencies
        await tx.fabricStockLedger.deleteMany({});
        await tx.fabricStoreRoll.deleteMany({});
        await tx.fabricRoll.deleteMany({});
        await tx.fabricBatch.deleteMany({});

        // 2. Clear junction tables and child dependencies
        await tx.cartonBundle.deleteMany({});
        await tx.bundle.deleteMany({});
        await tx.carton.deleteMany({});

        // 3. Clear Production, Quality, Defects, Ledgers
        await tx.productionTransaction.deleteMany({});
        await tx.defectLog.deleteMany({});
        await tx.qualityInspectionParameter.deleteMany({});
        await tx.qualityInspection.deleteMany({});
        await tx.defectRecord.deleteMany({});
        await tx.reworkTransaction.deleteMany({});
        await tx.recutRequest.deleteMany({});
        await tx.stockLedgerEntry.deleteMany({});

        // 4. Clear Dyeing Orders
        // Deadline alerts reference challans and programs; clear them with the data they describe.
        await tx.deadlineAlertDismissal.deleteMany({});
        await tx.deadlineAlert.deleteMany({});
        await tx.dyeingOrder.deleteMany({});

        // 5. Clear Challans & Events (break genealogy first)
        await tx.challan.updateMany({ data: { parentChallanId: null } });
        await tx.challanItem.deleteMany({});
        await tx.challanEvent.deleteMany({});
        await tx.challan.deleteMany({});

        // 6. Clear Programs & Specifications
        await tx.programRouteStep.deleteMany({});
        await tx.programRoute.deleteMany({});
        await tx.programBOM.deleteMany({});
        await tx.programSpecification.deleteMany({});
        await tx.programSize.deleteMany({});
        await tx.programColour.deleteMany({});
        await tx.programFabric.deleteMany({});
        await tx.program.deleteMany({});

        // 7. Clear Attachments & Audit Logs
        await tx.attachment.deleteMany({});

        // 8. Ensure Core RBAC Users & Departments are intact
        const hashedPin = await bcrypt.hash('1234', 10);

        const departments = [
          { code: 'ADMIN', name: 'Administration', sequenceOrder: 0 },
          { code: 'PROGRAMMING', name: 'Programming Department', sequenceOrder: 1 },
          { code: 'STORE', name: 'Fabric Store Department', sequenceOrder: 2 },
          { code: 'DYEING', name: 'Dyeing Department', sequenceOrder: 3 },
          { code: 'DYEING_QC', name: 'Dyeing QC', sequenceOrder: 4 },
          { code: 'EMBROIDERY', name: 'Embroidery Department', sequenceOrder: 5 },
          { code: 'THREAD_CUTTING', name: 'Thread Cutting Department', sequenceOrder: 6 },
          { code: 'THREADCUT_QC', name: 'Threadcut QC', sequenceOrder: 7 },
          { code: 'WASHING', name: 'Washing Department', sequenceOrder: 8 },
          { code: 'WASHING_QC', name: 'Washing QC', sequenceOrder: 9 },
          { code: 'RECUTTING', name: 'Recutting Department', sequenceOrder: 10 },
          { code: 'STITCHING', name: 'Stitching & Assembly', sequenceOrder: 11 },
          { code: 'FINISHING', name: 'Finishing Department', sequenceOrder: 12 },
          { code: 'STEAM_PRESS', name: 'Steam Press Department', sequenceOrder: 13 },
          { code: 'FINAL_QC', name: 'Final QC', sequenceOrder: 14 },
          { code: 'PACKING', name: 'Packing Department', sequenceOrder: 15 },
          { code: 'DISPATCH', name: 'Dispatch Department', sequenceOrder: 16 },
        ];

        for (const d of departments) {
          await tx.department.upsert({
            where: { code: d.code },
            update: { name: d.name, sequenceOrder: d.sequenceOrder },
            create: d,
          });
        }

        const roles = [
          { code: 'ADMIN', name: 'System Administrator' },
          { code: 'PROGRAMMING_INCHARGE', name: 'Programming Incharge' },
          { code: 'FABRIC_STORE', name: 'Fabric Store Incharge' },
          { code: 'DYEING_INCHARGE', name: 'Dyeing Incharge' },
        ];

        for (const r of roles) {
          await tx.role.upsert({
            where: { code: r.code },
            update: { name: r.name },
            create: { code: r.code, name: r.name, isSystem: true },
          });
        }

        const coreUsers = [
          { username: 'admin', fullName: 'System Administrator', email: 'admin@subhamfabrics.com', role: 'ADMIN', dept: 'ADMIN' },
          { username: 'program', fullName: 'Programming Department', email: 'programming@subhamfabrics.com', role: 'PROGRAMMING_INCHARGE', dept: 'PROGRAMMING' },
          { username: 'store', fullName: 'Fabric Store Department', email: 'store@subhamfabrics.com', role: 'FABRIC_STORE', dept: 'STORE' },
          { username: 'dyeing', fullName: 'Dyeing Incharge', email: 'dyeing@subhamfabrics.com', role: 'DYEING_INCHARGE', dept: 'DYEING' },
        ];

        for (const u of coreUsers) {
          const existing = await tx.user.findFirst({ where: { username: u.username } });
          if (!existing) {
            const created = await tx.user.create({
              data: {
                username: u.username,
                fullName: u.fullName,
                email: u.email,
                passwordHash: hashedPin,
                departmentCode: u.dept,
                isActive: true,
              },
            });
            const role = await tx.role.findFirst({ where: { code: u.role } });
            if (role) {
              await tx.userRole.create({
                data: { userId: created.id, roleId: role.id },
              });
            }
          } else {
            await tx.user.update({
              where: { id: existing.id },
              data: {
                passwordHash: hashedPin,
                departmentCode: u.dept,
                isActive: true,
              },
            });
          }
        }

        await auditAdminAction(request, auth.actor.id, 'FACTORY_DATA_CLEARED', 'System', 'FACTORY_DATA_CLEARED', { after: { reason } }, tx);
      },
      { maxWait: 20000, timeout: 60000 }
    );

    return NextResponse.json({
      success: true,
      message: 'All factory data successfully cleared. Database is now in a pristine initial state ready for production.',
    });
  } catch (error: any) {
    console.error('Error clearing factory data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to clear factory data' },
      { status: 500 }
    );
  }
}
