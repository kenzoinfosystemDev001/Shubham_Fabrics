import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const program = await prisma.program.findUnique({
      where: { id },
      include: {
        customer: true,
        design: true,
        createdBy: { select: { id: true, username: true, fullName: true } },
        approvedBy: { select: { id: true, username: true, fullName: true } },
        fabrics: true,
        sizes: true,
        colours: true,
        challans: {
          include: {
            items: true,
            fromDeptRel: true,
            toDeptRel: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    return NextResponse.json(program);
  } catch (error: any) {
    console.error('Error fetching program:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch program' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify program exists
    const program = await prisma.program.findUnique({
      where: { id },
      select: { id: true, programNumber: true, programSerialNo: true },
    });

    if (!program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    // Cascade deletion safely inside a transaction to resolve all foreign key constraints
    await prisma.$transaction(
      async (tx) => {
        // 1. Release fabric store rolls attached to this program
        await tx.fabricStoreRoll.updateMany({
          where: { programIssuedToId: id },
          data: { programIssuedToId: null, status: 'IN_STOCK' },
        });

        // 2. Identify all challans associated with this program
        const challans = await tx.challan.findMany({
          where: { programId: id },
          select: { id: true },
        });
        const challanIds = challans.map((c) => c.id);

        if (challanIds.length > 0) {
          // Unlink parentChallanId on any child challans
          await tx.challan.updateMany({
            where: { parentChallanId: { in: challanIds } },
            data: { parentChallanId: null },
          });

          // Unlink DyeingOrder references to these challans
          await tx.dyeingOrder.updateMany({
            where: {
              OR: [
                { inboundChallanId: { in: challanIds } },
                { qc1ChallanId: { in: challanIds } },
              ],
            },
            data: { inboundChallanId: null, qc1ChallanId: null },
          });

          // Delete production transactions linked to these challans
          await tx.productionTransaction.deleteMany({
            where: { challanId: { in: challanIds } },
          });

          // Delete quality inspections on these challans (clean up children first)
          const chInspections = await tx.qualityInspection.findMany({
            where: { challanId: { in: challanIds } },
            select: { id: true },
          });
          const chInspIds = chInspections.map((i) => i.id);
          if (chInspIds.length > 0) {
            await tx.defectLog.deleteMany({
              where: { inspectionId: { in: chInspIds } },
            });
            await tx.qualityInspectionParameter.deleteMany({
              where: { inspectionId: { in: chInspIds } },
            });
          }
          await tx.qualityInspection.deleteMany({
            where: { challanId: { in: challanIds } },
          });

          // Delete defect records on these challans
          await tx.defectRecord.deleteMany({
            where: { challanId: { in: challanIds } },
          });

          // Delete bundles on these challans (clear cartonBundle first)
          const challanBundles = await tx.bundle.findMany({
            where: { challanId: { in: challanIds } },
            select: { id: true },
          });
          const chBundleIds = challanBundles.map((b) => b.id);
          if (chBundleIds.length > 0) {
            await tx.cartonBundle.deleteMany({
              where: { bundleId: { in: chBundleIds } },
            });
          }
          await tx.bundle.deleteMany({
            where: { challanId: { in: challanIds } },
          });

          // Delete challan items & events
          await tx.challanItem.deleteMany({
            where: { challanId: { in: challanIds } },
          });
          await tx.challanEvent.deleteMany({
            where: { challanId: { in: challanIds } },
          });

          // Delete the challans
          await tx.challan.deleteMany({
            where: { id: { in: challanIds } },
          });
        }

        // 3. Delete DyeingOrders for this program
        await tx.dyeingOrder.deleteMany({
          where: { programId: id },
        });

        // 4. Delete any remaining ProductionTransactions for this program
        await tx.productionTransaction.deleteMany({
          where: { programId: id },
        });

        // 5. Delete rework transactions & recut requests
        await tx.reworkTransaction.deleteMany({
          where: { programId: id },
        });
        await tx.recutRequest.deleteMany({
          where: { programId: id },
        });

        // 6. Delete stock ledger entries & defect records
        await tx.stockLedgerEntry.deleteMany({
          where: { programId: id },
        });
        await tx.defectRecord.deleteMany({
          where: { programId: id },
        });

        // 7. Delete bundles, cartons, fabric rolls, fabric batches (clear cartonBundle first)
        const progBundles = await tx.bundle.findMany({
          where: { programId: id },
          select: { id: true },
        });
        const pBundleIds = progBundles.map((b) => b.id);
        if (pBundleIds.length > 0) {
          await tx.cartonBundle.deleteMany({
            where: { bundleId: { in: pBundleIds } },
          });
        }
        const progCartons = await tx.carton.findMany({
          where: { programId: id },
          select: { id: true },
        });
        const pCartonIds = progCartons.map((c) => c.id);
        if (pCartonIds.length > 0) {
          await tx.cartonBundle.deleteMany({
            where: { cartonId: { in: pCartonIds } },
          });
        }
        await tx.bundle.deleteMany({
          where: { programId: id },
        });
        await tx.carton.deleteMany({
          where: { programId: id },
        });
        await tx.fabricRoll.deleteMany({
          where: { programId: id },
        });
        await tx.fabricBatch.deleteMany({
          where: { programId: id },
        });

        // 8. Delete routes & steps
        const routes = await tx.programRoute.findMany({
          where: { programId: id },
          select: { id: true },
        });
        const routeIds = routes.map((r) => r.id);
        if (routeIds.length > 0) {
          await tx.programRouteStep.deleteMany({
            where: { programRouteId: { in: routeIds } },
          });
          await tx.programRoute.deleteMany({
            where: { id: { in: routeIds } },
          });
        }

        // 9. Delete BOM, specifications, sizes, colours, fabrics
        await tx.programBOM.deleteMany({ where: { programId: id } });
        await tx.programSpecification.deleteMany({ where: { programId: id } });
        await tx.programSize.deleteMany({ where: { programId: id } });
        await tx.programColour.deleteMany({ where: { programId: id } });
        await tx.programFabric.deleteMany({ where: { programId: id } });

        // 10. Delete audit logs associated with this program
        await tx.auditLog.deleteMany({
          where: {
            OR: [
              { entityId: id },
              { entity: 'Program', entityId: id },
            ],
          },
        });

        // 11. Finally, permanently delete the program itself
        await tx.program.delete({ where: { id } });
      },
      { maxWait: 15000, timeout: 30000 }
    );

    return NextResponse.json({
      success: true,
      message: `Production Sheet ${program.programSerialNo || program.programNumber} permanently removed from database.`,
    });
  } catch (error: any) {
    console.error('Error deleting program:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to permanently remove program' },
      { status: 500 }
    );
  }
}
