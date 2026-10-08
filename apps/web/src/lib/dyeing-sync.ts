import { prisma } from '@subham/database';

/**
 * Automatically sync incoming Fabric Store challans to DyeingOrders
 * Maintains strict traceability back to the original Production Sheet and Inbound Challan.
 */
export async function syncInboundChallansToDyeingOrders() {
  try {
    const inboundChallans = await prisma.challan.findMany({
      where: {
        toDepartment: 'DYEING',
        status: { in: ['ISSUED', 'RECEIVED', 'QC_APPROVED', 'SUBMITTED', 'DRAFT'] },
      },
      include: {
        program: {
          select: {
            id: true,
            programNumber: true,
            programSerialNo: true,
            fabricName: true,
            fabricType: true,
            fabricColor: true,
            priority: true,
            targetQuantity: true,
            quantityMeasurement: true,
            fabricSentToDyeing: true,
            fabricIssuedToDyeing: true,
          },
        },
        items: true,
      },
    });

    for (const challan of inboundChallans) {
      if (!challan.programId) continue;

      // Check if a DyeingOrder already references this inbound challan
      const existing = await prisma.dyeingOrder.findFirst({
        where: { inboundChallanId: challan.id },
      });

      if (!existing) {
        // Compute required quantity from challan items (or fallback to program target quantity)
        const totalItemsQty = challan.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
        const requiredQty = totalItemsQty > 0
          ? totalItemsQty
          : Number(challan.program?.fabricIssuedToDyeing || challan.program?.fabricSentToDyeing || challan.program?.targetQuantity || 100);

        const primaryItem = challan.items[0];
        const uom = primaryItem?.uom || challan.program?.quantityMeasurement || 'MTR';
        const fabricName = primaryItem?.fabricCode || challan.program?.fabricName || 'Fabric';
        const fabricType = challan.program?.fabricType || null;
        const targetColor = primaryItem?.colour || challan.program?.fabricColor || 'Standard';

        const year = new Date().getFullYear();
        const count = await prisma.dyeingOrder.count();
        const orderNumber = `DYE-${year}-${String(count + 1).padStart(4, '0')}`;

        // Find Dyeing Incharge user if available
        const dyeingUser = await prisma.user.findFirst({
          where: {
            OR: [
              { username: 'dyeing' },
              { departmentCode: 'DYEING' },
            ],
          },
          select: { id: true, fullName: true, username: true },
        });

        await prisma.dyeingOrder.create({
          data: {
            orderNumber,
            programId: challan.programId,
            inboundChallanId: challan.id,
            status: 'RECEIVED',
            priority: challan.priority || challan.program?.priority || 'NORMAL',
            fabricName,
            fabricType,
            targetColor,
            requiredQuantity: requiredQty,
            dyedQuantity: 0,
            undyedQuantity: requiredQty,
            readyForQc1Quantity: 0,
            sentToQc1Quantity: 0,
            uom,
            inchargeId: dyeingUser?.id || null,
            inchargeName: dyeingUser?.fullName || dyeingUser?.username || 'Dyeing Incharge',
            processRemarks: `Received on Fabric Store Challan ${challan.challanNumber}`,
          },
        });
      }
    }
  } catch (err) {
    console.error('Error auto-syncing inbound challans to Dyeing:', err);
  }
}
