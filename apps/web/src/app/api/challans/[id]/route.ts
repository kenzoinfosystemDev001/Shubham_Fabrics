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
        parentChallan: {
          select: {
            id: true,
            challanNumber: true,
            challanType: true,
            fromDepartment: true,
            toDepartment: true,
            status: true,
            issuedDate: true,
            remarks: true,
            fabricIn: true,
            fabricOut: true,
            fabricUnit: true,
            defectivePieces: true,
            defectiveShelfLocation: true,
            defectReason: true,
            items: true,
          },
        },
        childChallans: {
          select: {
            id: true,
            challanNumber: true,
            challanType: true,
            fromDepartment: true,
            toDepartment: true,
            status: true,
            issuedDate: true,
            remarks: true,
            fabricIn: true,
            fabricOut: true,
            fabricUnit: true,
            defectivePieces: true,
            defectiveShelfLocation: true,
            defectReason: true,
            items: true,
          },
        },
        defects: true,
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

        // 4. Delete quality inspections (clean up children first)
        const chInspections = await tx.qualityInspection.findMany({
          where: { challanId: id },
          select: { id: true },
        });
        const chInspectionIds = chInspections.map((i) => i.id);
        if (chInspectionIds.length > 0) {
          await tx.defectLog.deleteMany({
            where: { inspectionId: { in: chInspectionIds } },
          });
          await tx.qualityInspectionParameter.deleteMany({
            where: { inspectionId: { in: chInspectionIds } },
          });
        }
        await tx.qualityInspection.deleteMany({
          where: { challanId: id },
        });

        // 5. Delete defect records
        await tx.defectRecord.deleteMany({
          where: { challanId: id },
        });

        // 6. Delete bundles (clear cartonBundle first)
        const chBundles = await tx.bundle.findMany({
          where: { challanId: id },
          select: { id: true },
        });
        const chBundleIds = chBundles.map((b) => b.id);
        if (chBundleIds.length > 0) {
          await tx.cartonBundle.deleteMany({
            where: { bundleId: { in: chBundleIds } },
          });
        }
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      status,
      remarks,
      toDepartment,
      fromDepartment,
      fabricIn,
      fabricOut,
      fabricUnit,
      defectivePieces,
      defectiveShelfLocation,
      defectReason,
    } = body;

    const updateData: any = {};
    if (status) {
      updateData.status = status;
      if (status === 'RECEIVED') {
        updateData.receivedDate = new Date();
      } else if (status === 'COMPLETED') {
        updateData.completedDate = new Date();
      }
    }
    if (remarks !== undefined) updateData.remarks = remarks;
    if (toDepartment) updateData.toDepartment = toDepartment;
    if (fromDepartment) updateData.fromDepartment = fromDepartment;

    if (fabricIn !== undefined && fabricIn !== null) updateData.fabricIn = Number(fabricIn);
    if (fabricUnit !== undefined) updateData.fabricUnit = fabricUnit;
    if (defectivePieces !== undefined && defectivePieces !== null) {
      updateData.defectivePieces = Number(defectivePieces);
      if (Number(defectivePieces) > 0) {
        const upDept = (fromDepartment || '').toUpperCase();
        let defaultDeptShelf = 'DEF-SHELF-STORE (Fabric Store Quarantined Shelf)';
        if (upDept.includes('QC1') || upDept.includes('DYEING QC') || upDept.includes('DYE QC'))
          defaultDeptShelf = 'DEF-SHELF-QC1 (Dyeing QC Defective Shelf)';
        else if (upDept.includes('DYE')) defaultDeptShelf = 'DEF-SHELF-DYEING (Dyeing Station Defective Shelf)';
        else if (upDept.includes('EMB')) defaultDeptShelf = 'DEF-SHELF-EMBROIDERY (Embroidery Station Defective Shelf)';
        else if (upDept.includes('QC2') || upDept.includes('THREAD CUT QC') || upDept.includes('THREAD CUTTING QC'))
          defaultDeptShelf = 'DEF-SHELF-QC2 (Thread Cut QC Defective Shelf)';
        else if (upDept.includes('THREAD') || upDept.includes('CUTTING') || upDept.includes('THC'))
          defaultDeptShelf = 'DEF-SHELF-THREAD-CUTTING (Thread Cutting Trimming Shelf)';
        else if (upDept.includes('QC3') || upDept.includes('WASHING QC') || upDept.includes('WASH QC'))
          defaultDeptShelf = 'DEF-SHELF-QC3 (Washing QC Defective Shelf)';
        else if (upDept.includes('FINAL') || upDept.includes('FINAL_CHECK') || upDept.includes('FINAL CHECK'))
          defaultDeptShelf = 'DEF-SHELF-FINAL-CHECK (Final check Defective Shelf)';

        updateData.defectiveShelfLocation =
          defectiveShelfLocation || defaultDeptShelf;
        updateData.defectReason = defectReason || 'Quality Defect / Trimming Rejection';
      }
    }
    if (fabricOut !== undefined && fabricOut !== null) {
      updateData.fabricOut = Number(fabricOut);
    } else if (updateData.fabricIn !== undefined && updateData.defectivePieces !== undefined) {
      updateData.fabricOut = Math.max(0, updateData.fabricIn - updateData.defectivePieces);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const ch = await tx.challan.update({
        where: { id },
        data: updateData,
        include: {
          program: true,
          items: true,
          fromDeptRel: true,
          toDeptRel: true,
        },
      });

      // If defective pieces were cut, ensure DefectRecord exists or is logged
      if (updateData.defectivePieces && updateData.defectivePieces > 0) {
        const actor = await tx.user.findFirst({ select: { id: true } });
        if (actor) {
          try {
            await tx.defectRecord.create({
              data: {
                defectCode: `DEF-${ch.fromDepartment}-${Date.now().toString().slice(-4)}`,
                programId: ch.programId,
                challanId: ch.id,
                departmentCode: ch.fromDepartment,
                itemDescription: `Defective pieces cut in ${ch.fromDepartment} — Stored in ${updateData.defectiveShelfLocation || 'DEF-SHELF-01'}`,
                severity: 'MAJOR',
                quantity: Math.max(1, Math.round(updateData.defectivePieces)),
                reason: updateData.defectReason || 'Quality Defect / Segregation',
                detectedById: actor.id,
                status: 'OPEN',
                resolutionNotes: `Defective ${updateData.defectivePieces} ${updateData.fabricUnit || ch.fabricUnit || 'PCS'} cut to ${updateData.defectiveShelfLocation || 'DEF-SHELF-01'}. Leftover ${updateData.fabricOut || ch.fabricOut} sent forward.`,
              },
            });
          } catch (e) {
            console.warn('Defect record log error:', e);
          }
        }
      }

      return ch;
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating challan:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update challan' },
      { status: 500 }
    );
  }
}

