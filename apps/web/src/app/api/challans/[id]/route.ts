import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const challan = await prisma.challan.findUnique({
      where: { id },
      include: {
        program: true,
        items: true,
        fromDeptRel: true,
        toDeptRel: true,
        createdBy: { select: { id: true, username: true, fullName: true } },
        issuedBy: { select: { id: true, username: true, fullName: true } },
      },
    });

    if (!challan) {
      return NextResponse.json({ error: 'Challan not found' }, { status: 404 });
    }

    return NextResponse.json(challan);
  } catch (error: any) {
    console.error('Error fetching challan:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch challan' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const challan = await prisma.challan.findUnique({
      where: { id },
      select: { id: true, challanNumber: true },
    });

    if (!challan) {
      return NextResponse.json({ error: 'Challan not found' }, { status: 404 });
    }

    // Cascade delete all dependencies safely in transaction
    await prisma.$transaction(
      async (tx) => {
        // 1. Unlink any child challans that reference this challan as parent
        await tx.challan.updateMany({
          where: { parentChallanId: id },
          data: { parentChallanId: null },
        });

        // 2. Unlink or clean up DyeingOrder references
        await tx.dyeingOrder.updateMany({
          where: { inboundChallanId: id },
          data: { inboundChallanId: null },
        });
        await tx.dyeingOrder.updateMany({
          where: { qc1ChallanId: id },
          data: { qc1ChallanId: null },
        });

        // 3. Delete production transactions referencing this challan
        await tx.productionTransaction.deleteMany({
          where: { challanId: id },
        });

        // 4. Delete quality inspections
        await tx.qualityInspection.deleteMany({
          where: { challanId: id },
        });

        // 5. Delete defect records
        await tx.defectRecord.deleteMany({
          where: { challanId: id },
        });

        // 6. Delete bundles
        await tx.bundle.deleteMany({
          where: { challanId: id },
        });

        // 7. Delete challan items & events
        await tx.challanItem.deleteMany({
          where: { challanId: id },
        });
        await tx.challanEvent.deleteMany({
          where: { challanId: id },
        });

        // 8. Delete audit logs associated with this challan
        await tx.auditLog.deleteMany({
          where: {
            OR: [
              { entityId: id },
              { entity: 'Challan', entityId: id },
            ],
          },
        });

        // 9. Permanently delete the challan record from PostgreSQL
        await tx.challan.delete({
          where: { id },
        });
      },
      { maxWait: 15000, timeout: 30000 }
    );

    return NextResponse.json({
      success: true,
      message: `Challan ${challan.challanNumber} permanently deleted from database.`,
    });
  } catch (error: any) {
    console.error('Error permanently deleting challan:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to permanently delete challan' },
      { status: 500 }
    );
  }
}
