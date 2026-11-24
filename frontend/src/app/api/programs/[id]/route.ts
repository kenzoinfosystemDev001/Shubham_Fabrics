import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import { getSessionUser } from '@/lib/auth/require-user';
import { requireDepartment } from '@/lib/auth/department-access';
import { programSheetInclude, shapeProgramSheet } from '@/lib/program-sheet';
import { assignWilcomSheets, wilcomEntriesForSheet, wilcomSheetError } from '@/lib/wilcom-sheets';

import { FabricStockError, fabricStockErrorBody } from '@/lib/fabric-stock-ledger';
import { errorResponse } from '@/lib/work-items-server';
import { deleteProgramAsAdmin } from '@/lib/admin-delete-server';
import { writeAuditLog } from '@/lib/audit-log';

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

/**
 * DELETE { reason } (preview: GET /api/admin/programs/:id/delete-impact): a sheet no challan has used yet can be deleted by Programming (e.g. a mistaken draft). Once
 * challans exist, only an administrator can delete it, with a reason: its challan lines go first with everything built
 * on them (onward challans, department lines, QC, HOLD, packing), all rolled back (lib/admin-delete-server.ts), then
 * the sheet and its own records. Lines of other sheets on shared challans are kept.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'PROGRAMMING');
  if (!authUser) return authResponse;
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const program = await prisma.program.findUnique({
      where: { id },
      select: { id: true, programNumber: true, programSerialNo: true, status: true, _count: { select: { challans: true } } },
    });
    if (!program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }
    const label = program.programSerialNo || program.programNumber;

    // The sheet's own records (everything not reached through its challans), then the sheet itself.
    const removeSheetRecords = async (tx: any) => {
      // Fabric store rolls issued to this sheet go back into stock.
      await tx.fabricStoreRoll.updateMany({
        where: { programIssuedToId: id },
        data: { programIssuedToId: null, status: 'IN_STOCK' },
      });

      await tx.departmentWorkItem.deleteMany({ where: { programId: id } });
      await tx.dyeingOrder.deleteMany({ where: { programId: id } });
      await tx.productionTransaction.deleteMany({ where: { programId: id } });
      await tx.reworkTransaction.deleteMany({ where: { programId: id } });
      await tx.recutRequest.deleteMany({ where: { programId: id } });
      await tx.stockLedgerEntry.deleteMany({ where: { programId: id } });
      await tx.defectRecord.deleteMany({ where: { programId: id } });
      // Deadline alerts raised for the sheet (they point at it, so they would stop the delete).
      const alerts = await tx.deadlineAlert.findMany({ where: { programId: id }, select: { id: true } });
      if (alerts.length > 0) {
        const alertIds = alerts.map((a: { id: string }) => a.id);
        await tx.deadlineAlertDismissal.deleteMany({ where: { alertId: { in: alertIds } } });
        await tx.deadlineAlert.deleteMany({ where: { id: { in: alertIds } } });
      }

      // Bundles, cartons, fabric rolls, fabric batches (clear cartonBundle first)
      const progBundles = await tx.bundle.findMany({ where: { programId: id }, select: { id: true } });
      if (progBundles.length > 0) {
        await tx.cartonBundle.deleteMany({ where: { bundleId: { in: progBundles.map((b: { id: string }) => b.id) } } });
      }
      const progCartons = await tx.carton.findMany({ where: { programId: id }, select: { id: true } });
      if (progCartons.length > 0) {
        await tx.cartonBundle.deleteMany({ where: { cartonId: { in: progCartons.map((c: { id: string }) => c.id) } } });
      }
      await tx.bundle.deleteMany({ where: { programId: id } });
      await tx.carton.deleteMany({ where: { programId: id } });
      await tx.fabricRoll.deleteMany({ where: { programId: id } });
      await tx.fabricBatch.deleteMany({ where: { programId: id } });

      // Routes & steps
      const routes = await tx.programRoute.findMany({ where: { programId: id }, select: { id: true } });
      if (routes.length > 0) {
        const routeIds = routes.map((r: { id: string }) => r.id);
        await tx.programRouteStep.deleteMany({ where: { programRouteId: { in: routeIds } } });
        await tx.programRoute.deleteMany({ where: { id: { in: routeIds } } });
      }

      // BOM, specifications, sizes, colours, fabrics. Wilcom designs live in the sheet's metadata and go with it.
      await tx.programBOM.deleteMany({ where: { programId: id } });
      await tx.programSpecification.deleteMany({ where: { programId: id } });
      await tx.programSize.deleteMany({ where: { programId: id } });
      await tx.programColour.deleteMany({ where: { programId: id } });
      await tx.programFabric.deleteMany({ where: { programId: id } });

      await tx.program.delete({ where: { id } });
    };

    if (program._count.challans > 0 || authUser.isAdmin) {
      if (!authUser.isAdmin) {
        return NextResponse.json(
          { error: `Production Sheet ${label} already has ${program._count.challans} challan(s). Only an administrator can delete it.` },
          { status: 403 },
        );
      }
      await deleteProgramAsAdmin(id, body?.reason, authUser, removeSheetRecords);
    } else {
      // Programming deleting an unused sheet: no challans, so nothing else to roll back.
      await prisma.$transaction(
        async (tx) => {
          await removeSheetRecords(tx);
          await writeAuditLog(tx, {
            actorId: authUser.id,
            action: 'PROGRAM_DELETED',
            entity: 'Program',
            entityId: id,
            before: { programNumber: program.programNumber, programSerialNo: program.programSerialNo, status: program.status, challanCount: 0, reason: typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) || null : null },
          });
        },
        { maxWait: 15000, timeout: 30000 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Production Sheet ${label} permanently deleted.`,
    });
  } catch (error: any) {
    if (error instanceof FabricStockError) return NextResponse.json(fabricStockErrorBody(error), { status: 409 });
    return errorResponse(error, 'Failed to delete the Production Sheet.');
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
