
import { prisma } from '@subham/database';
import { dyeingOrderLine } from '@/lib/dyeing-instructions';

/**
 * Automatically sync incoming Fabric Store challans to DyeingOrders.
 * Maintains traceability to the original Production Sheet and Inbound Challan.
 */
export async function syncInboundChallansToDyeingOrders() {
  try {
    // 1. Fetch challans addressed to the Dyeing Department (not Dyeing QC).
    const inboundChallans = await prisma.challan.findMany({
      where: {
        toDepartment: { equals: 'DYEING', mode: 'insensitive' },
        status: {
          in: [
            'ISSUED',
            'RECEIVED',
            'QC_APPROVED',
            'SUBMITTED',
            'DRAFT',
            'IN_TRANSIT',
          ],
        },
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

    // 2. Find the Dyeing Incharge, if available.
    const dyeingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: 'dyeing' },
          { departmentCode: 'DYEING' },
          {
            userRoles: {
              some: {
                role: { code: 'DYEING_INCHARGE' },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        fullName: true,
        username: true,
      },
    });

    const year = new Date().getFullYear();

    const nextOrderNumber = async () => {
      const latestOrder = await prisma.dyeingOrder.findFirst({
        where: { orderNumber: { startsWith: `DYE-${year}-` } },
        orderBy: { orderNumber: 'desc' },
        select: { orderNumber: true },
      });
      let nextSeq = 1;
      if (latestOrder?.orderNumber) {
        const parsed = parseInt(latestOrder.orderNumber.split('-').pop() || '', 10);
        if (!Number.isNaN(parsed) && parsed >= nextSeq) nextSeq = parsed + 1;
      }
      let orderNumber = `DYE-${year}-${String(nextSeq).padStart(4, '0')}`;
      while (await prisma.dyeingOrder.findUnique({ where: { orderNumber } })) {
        nextSeq++;
        orderNumber = `DYE-${year}-${String(nextSeq).padStart(4, '0')}`;
      }
      return orderNumber;
    };

    // 3. Process each inbound challan. Every challan line becomes its own Dyeing Order so
    // each required colour keeps its own quantity and unit (never merged into one total).
    for (const challan of inboundChallans) {
      if (!challan.programId) continue;

      try {
        const existingOrders = await prisma.dyeingOrder.findMany({
          where: { inboundChallanId: challan.id },
          select: { inboundChallanItemId: true },
        });
        // Orders created before per-line sync are left exactly as they were.
        if (existingOrders.some((order) => !order.inboundChallanItemId)) continue;
        const syncedItemIds = new Set(existingOrders.map((order) => order.inboundChallanItemId));

        // Rework returns from Dyeing QC carry the colour the fabric was originally meant to be.
        let reworkTargetColor: string | null = null;
        if (challan.challanType === 'REWORK_RETURN' && challan.parentChallanId) {
          const originalOrder = await prisma.dyeingOrder.findFirst({
            where: { dyeingQcChallanId: challan.parentChallanId },
            select: { targetColor: true },
          });
          reworkTargetColor = originalOrder?.targetColor || null;
        }

        const lines: Array<(typeof challan.items)[number] | null> = challan.items.length > 0
          ? challan.items
          : [null];
        let createdForChallan = 0;

        for (const [lineIndex, item] of lines.entries()) {
          if (item && syncedItemIds.has(item.id)) continue;
          if (!item && existingOrders.length > 0) continue;

          const line = dyeingOrderLine(item, challan, reworkTargetColor);

          // Retry on an order-number collision; a line that already has an order is skipped.
          let createdOrder = null;
          for (let attempt = 0; attempt < 3 && !createdOrder; attempt++) {
            try {
              createdOrder = await prisma.dyeingOrder.create({
                data: {
                  orderNumber: await nextOrderNumber(),
                  programId: challan.programId,
                  inboundChallanId: challan.id,
                  inboundChallanItemId: line.inboundChallanItemId,
                  status: 'RECEIVED',
                  priority:
                    challan.priority ||
                    challan.program?.priority ||
                    'NORMAL',
                  fabricName: line.fabricName,
                  fabricType: challan.program?.fabricType || null,
                  currentColor: line.currentColor,
                  targetColor: line.targetColor,
                  requiredQuantity: line.requiredQuantity,
                  dyedQuantity: 0,
                  undyedQuantity: line.requiredQuantity,
                  readyForDyeingQcQuantity: 0,
                  sentToDyeingQcQuantity: 0,
                  uom: line.uom,
                  inchargeId: dyeingUser?.id || null,
                  inchargeName:
                    dyeingUser?.fullName ||
                    dyeingUser?.username ||
                    'Dyeing Incharge',
                  processRemarks:
                    challan.challanType === 'REWORK_RETURN'
                      ? `Dyeing QC Rework Return: ${challan.challanNumber} (${challan.remarks ||
                      'Shade/Dyeing correction required'
                      })`
                      : `Received from ${challan.fromDepartment || 'Fabric Store'
                      } on Challan ${challan.challanNumber}${lines.length > 1 ? ` (line ${lineIndex + 1} of ${lines.length})` : ''}`,
                },
              });
            } catch (createErr: any) {
              if (createErr?.code !== 'P2002') throw createErr;
              const target = String(createErr?.meta?.target ?? '');
              if (target.includes('inboundChallanItemId')) break;
            }
          }

          if (createdOrder) {
            createdForChallan++;
            syncedOrders.push(createdOrder);
          }
        }

        // 4. Update the related production program once per challan.
        if (createdForChallan > 0) {
          const units = new Set(challan.items.map((item) => item.uom));
          const sentQty = challan.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
          try {
            await prisma.program.update({
              where: { id: challan.programId },
              data: {
                // A single total is only meaningful when every line uses the same unit.
                ...(units.size === 1 && sentQty > 0 ? { fabricSentToDyeing: sentQty } : {}),
                status: 'IN_PRODUCTION',
              },
            });
          } catch (programErr) {
            console.error(
              `Could not update program ${challan.programId} after syncing challan ${challan.challanNumber} to Dyeing:`,
              programErr,
            );
          }
        }
      } catch (challanErr) {
        console.error(
          `Error syncing challan ${challan.challanNumber} (${challan.id}) to Dyeing:`,
          challanErr,
        );
      }
    }

    return syncedOrders;
  } catch (err) {
    console.error(
      'Error auto-syncing inbound challans to Dyeing:',
      err,
    );

    return [];
  }
}