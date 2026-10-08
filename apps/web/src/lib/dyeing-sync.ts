import { prisma } from '@subham/database';

/**
 * Automatically sync incoming Fabric Store challans to DyeingOrders
 * Maintains strict traceability back to the original Production Sheet and Inbound Challan.
 */
export async function syncInboundChallansToDyeingOrders() {
  try {
    // 1. Fetch all challans addressed to Dyeing Department
    const inboundChallans = await prisma.challan.findMany({
      where: {
        OR: [
          { toDepartment: 'DYEING' },
          { toDepartment: { equals: 'DYEING', mode: 'insensitive' } },
          { toDepartment: { contains: 'DYE', mode: 'insensitive' } },
        ],
        status: { in: ['ISSUED', 'RECEIVED', 'QC_APPROVED', 'SUBMITTED', 'DRAFT', 'IN_TRANSIT'] },
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
      orderBy: { createdAt: 'asc' },
    });

    const syncedOrders: any[] = [];

    // 2. Find Dyeing Incharge user if available
    const dyeingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: 'dyeing' },
          { departmentCode: 'DYEING' },
          { userRoles: { some: { role: { code: 'DYEING_INCHARGE' } } } },
        ],
      },
      select: { id: true, fullName: true, username: true },
    });

    const year = new Date().getFullYear();

    for (const challan of inboundChallans) {
      if (!challan.programId) continue;

      try {
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
          const fabricName = primaryItem?.fabricCode || primaryItem?.itemDescription || challan.program?.fabricName || 'Cotton Fabric';
          const fabricType = challan.program?.fabricType || null;
          const targetColor = primaryItem?.colour || primaryItem?.shade || challan.program?.fabricColor || 'Standard';

          // Safe, collision-free orderNumber generation
          const latestOrder = await prisma.dyeingOrder.findFirst({
            where: { orderNumber: { startsWith: `DYE-${year}-` } },
            orderBy: { orderNumber: 'desc' },
            select: { orderNumber: true },
          });

          let nextSeq = 1;
          if (latestOrder?.orderNumber) {
            const parts = latestOrder.orderNumber.split('-');
            const lastPart = parts[parts.length - 1];
            const parsed = parseInt(lastPart, 10);
            if (!isNaN(parsed) && parsed >= nextSeq) {
              nextSeq = parsed + 1;
            }
          }

          let orderNumber = `DYE-${year}-${String(nextSeq).padStart(4, '0')}`;
          while (await prisma.dyeingOrder.findUnique({ where: { orderNumber } })) {
            nextSeq++;
            orderNumber = `DYE-${year}-${String(nextSeq).padStart(4, '0')}`;
          }

          const createdOrder = await prisma.dyeingOrder.create({
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
              processRemarks: `Received from ${challan.fromDepartment || 'Fabric Store'} on Challan ${challan.challanNumber}`,
            },
          });

          // Also update program status & quantity if needed
          try {
            await prisma.program.update({
              where: { id: challan.programId },
              data: {
                fabricSentToDyeing: requiredQty,
                status: 'IN_PRODUCTION',
              },
            });
          } catch {}

          syncedOrders.push(createdOrder);
        }
      } catch (challanErr) {
        console.error(`Error syncing challan ${challan.challanNumber} (${challan.id}) to Dyeing:`, challanErr);
      }
    }

    return syncedOrders;
  } catch (err) {
    console.error('Error auto-syncing inbound challans to Dyeing:', err);
    return [];
  }
}
