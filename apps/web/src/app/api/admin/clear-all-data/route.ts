import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function POST() {
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
        await tx.auditLog.deleteMany({});

        // 8. Ensure Core RBAC Users & Departments are intact
        const hashedPin = await bcrypt.hash('1234', 10);

        const departments = [
          { code: 'ADMIN', name: 'Administration', sequenceOrder: 0 },
          { code: 'PROGRAMMING', name: 'Programming Department', sequenceOrder: 1 },
          { code: 'STORE', name: 'Fabric Store Department', sequenceOrder: 2 },
          { code: 'DYEING', name: 'Dyeing Department', sequenceOrder: 3 },
          { code: 'EMBROIDERY', name: 'Embroidery Department', sequenceOrder: 4 },
          { code: 'QC1', name: 'Quality Control 1', sequenceOrder: 5 },
          { code: 'FINISHING', name: 'Finishing & Packing', sequenceOrder: 6 },
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
