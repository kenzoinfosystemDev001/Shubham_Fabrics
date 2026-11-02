import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import { getSessionUser } from '@/lib/auth/require-user';
import { requireDepartment } from '@/lib/auth/department-access';
import { programSheetInclude, shapeProgramSheet } from '@/lib/program-sheet';
import { assignWilcomSheets, wilcomEntriesForSheet, wilcomSheetError } from '@/lib/wilcom-sheets';

import { syncChallanStock } from '@/lib/fabric-stock-ledger';

export const dynamic = 'force-dynamic';

/**
 * A legacy TOP design (or one with no category), saved before designs carried their sheetId, is the only one
 * that shares the root Wilcom photo; a design linked to its sheet shows only its own artwork.
 */
function isTopWilcomEntry(entry: any): boolean {
  return !entry?.sheetId && String(entry?.category || 'TOP').trim().toUpperCase() === 'TOP';
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const programInclude = programSheetInclude;

    let program = await prisma.program.findUnique({
      where: { id },
      include: programInclude,
    }).catch(() => null);

    if (!program) {
      program = await prisma.program.findUnique({
        where: { programNumber: id },
        include: programInclude,
      }).catch(() => null);
    }

    if (!program) {
      // A serial number can repeat across sheets: it opens a sheet only when exactly one sheet has it.
      const matches = await prisma.program.findMany({
        where: { programSerialNo: id },
        select: { id: true },
        take: 2,
      }).catch(() => []);
      if (matches.length === 1) {
        program = await prisma.program.findUnique({
          where: { id: matches[0].id },
          include: programInclude,
        }).catch(() => null);
      }
    }

    if (!program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const sessionUser = await getSessionUser(request);
    return NextResponse.json(shapeProgramSheet(program, sessionUser));
  } catch (error: any) {
    console.error('Error fetching program:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch program' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'PROGRAMMING');
  if (!authUser) return authResponse;
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

        // Fabric Store stock issued on these challans goes back to the store.
        for (const challanId of challanIds) {
          await syncChallanStock(tx, challanId, authUser.id, { removed: true });
        }

        if (challanIds.length > 0) {
          // Unlink parentChallanId on any child challans
          await tx.challan.updateMany({
            where: { parentChallanId: { in: challanIds } },
            data: { parentChallanId: null },
          });

          // Department work items (and their transfers) belong to these challans/this program.
          await tx.departmentWorkItem.deleteMany({
            where: { OR: [{ programId: id }, { inboundChallanId: { in: challanIds } }] },
          });

          // Unlink DyeingOrder references to these challans, clearing only the link that points at one
          await tx.dyeingOrder.updateMany({
            where: { inboundChallanId: { in: challanIds } },
            data: { inboundChallanId: null },
          });
          await tx.dyeingOrder.updateMany({
            where: { qc1ChallanId: { in: challanIds } },
            data: { qc1ChallanId: null },
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

        // 3. Delete department work items and DyeingOrders for this program
        await tx.departmentWorkItem.deleteMany({ where: { programId: id } });
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'PROGRAMMING');
  if (!authUser) return authResponse;
  try {
    const { id } = await params;
    const body = await request.json();

    let prog = await prisma.program.findUnique({
      where: { id },
      select: { id: true, metadataJson: true },
    }).catch(() => null);

    if (!prog) {
      // Only the unique program number identifies a sheet to change; a serial number can repeat across sheets.
      prog = await prisma.program.findUnique({
        where: { programNumber: id },
        select: { id: true, metadataJson: true },
      }).catch(() => null);
    }

    if (!prog) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    let meta: any = {};
    if (prog.metadataJson) {
      try {
        meta = typeof prog.metadataJson === 'string' ? JSON.parse(prog.metadataJson) : prog.metadataJson;
      } catch {}
    }

    const updateData: any = {};
    let resolvedPhoto: string | null = null;

    if (body.wilcomDesignPhoto) {
      resolvedPhoto = body.wilcomDesignPhoto;
    }

    if (Array.isArray(body.wilcomEntries)) {
      // Each design stays linked to its own Production Sheet of this program (lib/wilcom-sheets).
      const sheetComponents = meta.components && typeof meta.components === 'object' ? meta.components : null;
      const previousRootPhoto = typeof meta.wilcomDesignPhoto === 'string' ? meta.wilcomDesignPhoto : '';
      const entries = assignWilcomSheets<any>(
        body.wilcomEntries
          .filter((e: any) => e && typeof e === 'object')
          // Only a legacy TOP design (no sheetId) borrows the program's earlier root photo.
          .map((e: any) => ({ ...e, photoUrl: e.photoUrl || (isTopWilcomEntry(e) ? previousRootPhoto : '') || undefined })),
        sheetComponents,
      );
      const wilcomError = wilcomSheetError(entries, sheetComponents);
      if (wilcomError) {
        return NextResponse.json({ error: wilcomError }, { status: 400 });
      }
      if (!resolvedPhoto) {
        resolvedPhoto =
          wilcomEntriesForSheet(entries, 'TOP', sheetComponents).find((e: any) => e.photoUrl)?.photoUrl ||
          entries.find((e: any) => e.photoUrl)?.photoUrl ||
          null;
      }
      meta.wilcomEntries = entries;
    } else if (body.wilcomDesignPhoto) {
      if (Array.isArray(meta.wilcomEntries) && meta.wilcomEntries.length > 0) {
        meta.wilcomEntries = meta.wilcomEntries.map((e: any) => ({
          ...e,
          photoUrl: e.photoUrl || (isTopWilcomEntry(e) ? body.wilcomDesignPhoto : undefined),
        }));
      } else {
        meta.wilcomEntries = [
          {
            id: 'wilcom-auto-1',
            category: 'TOP',
            styleName: body.styleName || 'Primary Top Style',
            wilcomDesignNumber: body.wilcomDesignNumber || 'WLC-01',
            photoUrl: body.wilcomDesignPhoto,
          },
        ];
      }
    }

    if (!resolvedPhoto && meta.wilcomDesignPhoto) {
      resolvedPhoto = meta.wilcomDesignPhoto;
    }

    if (resolvedPhoto) {
      updateData.wilcomDesignPhoto = resolvedPhoto;
      meta.wilcomDesignPhoto = resolvedPhoto;
    } else if (body.wilcomDesignPhoto === null) {
      updateData.wilcomDesignPhoto = null;
      meta.wilcomDesignPhoto = null;
    }

    if (body.baseDesignPhoto !== undefined) {
      updateData.baseDesignPhoto = body.baseDesignPhoto;
      meta.baseDesignPhoto = body.baseDesignPhoto;
    }
    if (body.wilcomDesignNumber !== undefined) {
      updateData.wilcomDesignNumber = body.wilcomDesignNumber;
      meta.wilcomDesignNumber = body.wilcomDesignNumber;
    }

    updateData.metadataJson = JSON.stringify(meta);

    const updated = await prisma.program.update({
      where: { id: prog.id },
      data: updateData,
    });

    return NextResponse.json({
      ...updated,
      wilcomEntries: meta.wilcomEntries || [],
      wilcomDesignPhoto: resolvedPhoto || updated.wilcomDesignPhoto,
    });
  } catch (error: any) {
    console.error('Error updating program:', error);
    return NextResponse.json({ error: error.message || 'Failed to update program' }, { status: 500 });
  }
}
