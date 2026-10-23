import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { getPackingActor } from '@/lib/packing-auth';
import { parseWholeNumber, validatePackingOperation } from '@/lib/packing-rules';

export const dynamic = 'force-dynamic';

const PACKING_DEPTS = ['PACKING', 'PACK', 'FOLDING'];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getPackingActor(request);
    if (!auth.actor) return auth.response;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    // 1. Fetch Challan & Linked Production Sheet
    const challan = await prisma.challan.findUnique({
      where: { id },
      include: {
        program: {
          include: {
            sizes: true,
            colours: true,
          },
        },
        items: true,
      },
    });

    if (!challan) {
      return NextResponse.json({ error: 'Packing job not found' }, { status: 404 });
    }

    if (!PACKING_DEPTS.includes(challan.toDepartment.toUpperCase())) {
      return NextResponse.json(
        { error: `This Challan is designated for '${challan.toDepartment}', not Packing Department.` },
        { status: 400 }
      );
    }

    if (!['RECEIVED', 'IN_PROCESS'].includes(challan.status)) {
      return NextResponse.json(
        { error: `Job must be in 'RECEIVED' or 'IN_PROCESS' status to pack. Current status: '${challan.status}'.` },
        { status: 400 }
      );
    }

    const actorId = auth.actor.id;

    // 2. Compute current quantities and outstanding balance
    const totalReceived = Number(
      challan.fabricIn ?? challan.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0)
    );

    // Sum cartons already packed for this challan
    const existingCartons = await prisma.carton.findMany({
      where: { packingChallanId: challan.id },
      select: { quantity: true },
    });
    const previouslyPacked = existingCartons.reduce((s, c) => s + (Number(c.quantity) || 0), 0);

    // Parse input packing quantity
    let packingQuantity: number;
    try {
      packingQuantity = parseWholeNumber(body.packingQuantity, 'Packing piece quantity');
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Invalid packing quantity.' }, { status: 400 });
    }

    // Default cartons if not supplied: 1 carton holding the entire packing quantity
    let rawCartons = body.cartons;
    if (!Array.isArray(rawCartons) || rawCartons.length === 0) {
      rawCartons = [
        {
          size: body.size || challan.program?.sizes?.[0]?.size || 'Standard',
          colour: body.colour || body.color || challan.program?.fabricColor || 'Standard',
          quantity: packingQuantity,
          locationRack: body.locationRack || 'FG-MAIN',
          locationShelf: body.locationShelf || 'SHELF-1',
          grossWeightKg: body.grossWeightKg ? Number(body.grossWeightKg) : undefined,
          netWeightKg: body.netWeightKg ? Number(body.netWeightKg) : undefined,
        },
      ];
    }

    // Validate operation rules
    const validation = validatePackingOperation({
      eligibleQuantity: totalReceived,
      packingQuantity,
      previouslyPacked,
      cartons: rawCartons,
    });

    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const remainingToPack = validation.remainingQuantity;
    const isJobCompleted = remainingToPack === 0;
    const nextStatus = isJobCompleted ? 'COMPLETED' : 'IN_PROCESS';

    // 3. ATOMIC TRANSACTION:
    // Create Cartons + ProductionTransaction + InventoryStock (FG) + StockLedgerEntry + Challan Status
    const result = await prisma.$transaction(async (tx) => {
      // Idempotency check: verify challan status has not been altered concurrently
      const claim = await tx.challan.updateMany({
        where: { id: challan.id, status: challan.status },
        data: {
          status: nextStatus,
          fabricOut: previouslyPacked + packingQuantity,
          remarks: body.notes
            ? `${challan.remarks ? challan.remarks + ' | ' : ''}Packed ${packingQuantity} pcs: ${body.notes}`
            : challan.remarks,
        },
      });

      if (claim.count !== 1) {
        throw new Error('Packing job status changed concurrently. Please refresh.');
      }

      // A. Create Cartons
      const createdCartons = [];
      const now = new Date();
      const datePrefix = now.toISOString().slice(0, 10).replace(/-/g, '');

      for (let i = 0; i < rawCartons.length; i++) {
        const cInput = rawCartons[i];
        const cartonQty = parseWholeNumber(cInput.quantity, `Carton #${i + 1} piece count`);
        const cartonNumber =
          cInput.cartonNumber ||
          `CTN-${datePrefix}-${Date.now().toString().slice(-4)}-${String(i + 1).padStart(2, '0')}`;
        const barcode =
          cInput.barcode ||
          `BC-CTN-${Date.now().toString().slice(-6)}-${crypto.randomUUID().slice(0, 4)}`;

        const carton = await tx.carton.create({
          data: {
            cartonNumber,
            programId: challan.programId,
            packingChallanId: challan.id,
            size: String(cInput.size || 'Standard'),
            colour: String(cInput.colour || challan.program?.fabricColor || 'Standard'),
            quantity: cartonQty,
            grossWeightKg: cInput.grossWeightKg ? Number(cInput.grossWeightKg) : null,
            netWeightKg: cInput.netWeightKg ? Number(cInput.netWeightKg) : null,
            status: 'IN_FG_STORE',
            locationRack: cInput.locationRack || 'FG-MAIN',
            locationShelf: cInput.locationShelf || 'SHELF-1',
            barcode,
          },
        });
        createdCartons.push(carton);

        // B. Update Finished Goods Inventory Balance (InventoryStock)
        const stockIdentifier = `${challan.program?.styleCode || challan.program?.programNumber || 'GARMENT'}-${carton.size}-${carton.colour}`;
        const fgStock = await tx.inventoryStock.upsert({
          where: {
            departmentCode_identifier: {
              departmentCode: 'FINISHED_GOODS',
              identifier: stockIdentifier,
            },
          },
          create: {
            departmentCode: 'FINISHED_GOODS',
            itemType: 'FINISHED_GARMENT',
            identifier: stockIdentifier,
            description: `${challan.program?.styleCode || 'Finished Garment'} (${carton.size}/${carton.colour}) - FG Warehouse`,
            currentQuantity: cartonQty,
            uom: 'PCS',
            programId: challan.programId,
            lastChallanId: challan.id,
          },
          update: {
            currentQuantity: { increment: cartonQty },
            lastChallanId: challan.id,
          },
        });

        // C. Record Immutable Stock Movement (StockLedgerEntry)
        await tx.stockLedgerEntry.create({
          data: {
            entryType: 'RECEIPT',
            departmentCode: 'FINISHED_GOODS',
            itemCode: challan.program?.styleCode || challan.program?.programNumber || 'GARMENT',
            itemName: `${challan.program?.styleCode || 'Finished Garment'} - Packed FG Entry`,
            batchNumber: challan.program?.programNumber,
            colour: carton.colour,
            location: `${carton.locationRack || 'FG'}-${carton.locationShelf || 'MAIN'}`,
            quantity: cartonQty, // positive for receipt
            uom: 'PCS',
            referenceType: 'PRODUCTION',
            referenceId: challan.id,
            programId: challan.programId,
            actorId: actorId,
            balanceAfter: fgStock.currentQuantity,
            notes: `Packed into Carton ${carton.cartonNumber} from Challan ${challan.challanNumber}`,
          },
        });
      }

      // D. Record ProductionTransaction for quantitative accounting
      const transaction = await tx.productionTransaction.create({
        data: {
          programId: challan.programId,
          challanId: challan.id,
          departmentCode: 'PACKING',
          operationName: 'GARMENT_PACKING_AND_FG_UPDATE',
          operatorId: actorId,
          inputQuantity: totalReceived - previouslyPacked,
          goodQuantity: packingQuantity,
          reworkQuantity: 0,
          rejectQuantity: 0,
          wasteQuantity: 0,
          balanceQuantity: remainingToPack,
          unitOfMeasure: 'PCS',
          recordedAt: new Date(),
          notes: body.notes || `Packed ${packingQuantity} garments into ${createdCartons.length} cartons. Stock posted to Finished Goods Warehouse.`,
        },
      });

      // E. Write Challan Audit Event
      await tx.challanEvent.create({
        data: {
          challanId: challan.id,
          action: isJobCompleted ? 'PACKING_COMPLETED' : 'PACKING_IN_PROGRESS',
          fromStatus: challan.status,
          toStatus: nextStatus,
          actorId: actorId,
          notes: `Packed ${packingQuantity} garments into ${createdCartons.length} cartons. Posted to FG Warehouse stock. Remaining to pack: ${remainingToPack} pcs.`,
        },
      });

      return {
        cartons: createdCartons,
        transaction,
        status: nextStatus,
        totalPacked: previouslyPacked + packingQuantity,
        remainingToPack,
      };
    });

    return NextResponse.json({
      success: true,
      message: `Successfully packed ${packingQuantity} garments into ${result.cartons.length} cartons. Finished Goods stock updated.`,
      data: result,
    });
  } catch (error: any) {
    console.error('Error executing Packing transaction:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to complete packing transaction' },
      { status: 500 }
    );
  }
}
