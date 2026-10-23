import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'WASHING');
  if (!authUser) return authResponse;
  try {
    const body = await request.json();
    const {
      challanId,
      pieceIn,
      pieceOut,
      washingBarcode,
      washRecipe,
      machineId,
      waterTemp,
      durationMinutes,
      liquorRatio,
      dryingMethod,
      defectivePieces,
      defectReason,
      handFeelRemarks,
      operatorId,
    } = body;

    // 1. Mandatory Validations
    if (!challanId) {
      return NextResponse.json({ error: 'Challan ID is required.' }, { status: 400 });
    }

    const pIn = Number(pieceIn);
    const pOut = Number(pieceOut);

    if (isNaN(pIn) || pIn <= 0) {
      return NextResponse.json({ error: 'Piece In must be a positive number greater than 0.' }, { status: 400 });
    }

    if (isNaN(pOut) || pOut < 0) {
      return NextResponse.json({ error: 'Piece Out must be 0 or a positive number.' }, { status: 400 });
    }

    if (pOut > pIn) {
      return NextResponse.json(
        { error: `Piece Out (${pOut}) cannot be greater than Piece In (${pIn}).` },
        { status: 400 }
      );
    }

    if (!washingBarcode || !washingBarcode.trim()) {
      return NextResponse.json({ error: 'Washing Barcode is mandatory.' }, { status: 400 });
    }

    if (!washRecipe || !washRecipe.trim()) {
      return NextResponse.json({ error: 'Wash Recipe is mandatory.' }, { status: 400 });
    }

    if (!machineId || !machineId.trim()) {
      return NextResponse.json({ error: 'Machine/Drum ID is mandatory.' }, { status: 400 });
    }

    // 2. Fetch Challan
    const challan = await prisma.challan.findUnique({
      where: { id: challanId },
      include: {
        program: true,
        items: true,
      },
    });

    if (!challan) {
      return NextResponse.json({ error: 'Challan not found.' }, { status: 404 });
    }

    if (challan.toDepartment !== 'WASHING') {
      return NextResponse.json(
        { error: `Challan ${challan.challanNumber} is not designated for Washing Department.` },
        { status: 400 }
      );
    }

    // 3. Loss & Shrinkage calculation
    const lossPieces = pIn - pOut;
    const defPieces = defectivePieces !== undefined ? Number(defectivePieces) : lossPieces;
    const shrinkageRate = (((pIn - pOut) / pIn) * 100).toFixed(2);

    // 4. Resolve Actor / Operator
    const actorUser = { id: authUser.id, fullName: authUser.fullName, username: authUser.username };

    // 5. Update Challan & Items in Transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update Challan
      const updatedChallan = await tx.challan.update({
        where: { id: challanId },
        data: {
          status: 'QC_APPROVED', // Ready for Handover to Finishing
          fabricIn: pIn,
          fabricOut: pOut,
          fabricUnit: 'PCS',
          defectivePieces: defPieces,
          defectiveShelfLocation: defPieces > 0 ? 'DEF-SHELF-01' : null,
          defectReason: defectReason || (defPieces > 0 ? `Shrinkage & Wash Defect (${defPieces} pcs)` : null),
        },
      });

      // Update Barcode on Challan Items
      if (challan.items.length > 0) {
        await tx.challanItem.updateMany({
          where: { challanId },
          data: {
            barcode: washingBarcode.trim(),
            quantity: pOut,
            remarks: `Washed: ${washRecipe} | Drum: ${machineId} | Barcode: ${washingBarcode.trim()} | Shrinkage: ${shrinkageRate}%`,
          },
        });
      }

      // Record Production Transaction
      const productionLog = await tx.productionTransaction.create({
        data: {
          programId: challan.programId,
          challanId: challan.id,
          departmentCode: 'WASHING',
          operationName: washRecipe.trim(),
          machineId: machineId.trim(),
          operatorId: actorUser!.id,
          inputQuantity: pIn,
          goodQuantity: pOut,
          rejectQuantity: defPieces,
          wasteQuantity: Math.max(0, lossPieces - defPieces),
          balanceQuantity: 0,
          unitOfMeasure: 'PCS',
          notes: JSON.stringify({
            washingBarcode: washingBarcode.trim(),
            washRecipe: washRecipe.trim(),
            machineId: machineId.trim(),
            waterTemp: waterTemp || 'Ambient',
            durationMinutes: durationMinutes || 40,
            liquorRatio: liquorRatio || '1:8',
            dryingMethod: dryingMethod || 'Tumble Dry',
            shrinkageRate: `${shrinkageRate}%`,
            handFeelRemarks: handFeelRemarks || 'Standard Soft Hand-Feel Verified',
          }),
        },
      });

      // Record Challan Event
      await tx.challanEvent.create({
        data: {
          challanId: challan.id,
          action: 'COMPLETE',
          fromStatus: challan.status,
          toStatus: 'QC_APPROVED',
          actorId: actorUser!.id,
          notes: `Wash completed: In=${pIn} PCS, Out=${pOut} PCS, Barcode=${washingBarcode}, Recipe=${washRecipe}, Machine=${machineId}, Shrinkage=${shrinkageRate}%`,
        },
      });

      return { updatedChallan, productionLog };
    });

    return NextResponse.json({
      success: true,
      data: {
        challan: result.updatedChallan,
        productionLog: result.productionLog,
        metrics: {
          pieceIn: pIn,
          pieceOut: pOut,
          defectivePieces: defPieces,
          shrinkageRate: `${shrinkageRate}%`,
          washingBarcode: washingBarcode.trim(),
        },
      },
    });
  } catch (error: any) {
    console.error('Error processing wash run:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process wash run' },
      { status: 500 }
    );
  }
}
