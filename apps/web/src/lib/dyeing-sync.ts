import { prisma } from '@shubham/database';
import { mapChallanItemsToDyeingLines } from '@/lib/dyeing-instructions.mjs';

// Challans count as sent to Dyeing once issued; drafts and cancelled challans never create work.
const INBOUND_STATUSES = ['ISSUED', 'IN_TRANSIT', 'RECEIVED', 'QC_APPROVED'];

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'P2002';
}

async function nextOrderSequence(year: number): Promise<number> {
  const latest = await prisma.dyeingOrder.findFirst({
    where: { orderNumber: { startsWith: `DYE-${year}-` } },
    orderBy: { orderNumber: 'desc' },
    select: { orderNumber: true },
  });
  const last = latest ? parseInt(latest.orderNumber.split('-').pop() || '', 10) : 0;
  return Number.isNaN(last) ? 1 : last + 1;
}

/**
 * Creates DyeingOrders for challans issued to Dyeing that have none yet: one order per challan
 * line, each keeping its own fabric, colours, quantity and unit. New orders start as
 * AWAITING_RECEIPT; nothing counts as received until Dyeing records the actual quantity.
 * Challans that already have orders (including ones created before per-line tracking) are skipped.
 */
export async function syncInboundChallansToDyeingOrders() {
  try {
    const challans = await prisma.challan.findMany({
      where: {
        toDepartment: { equals: 'DYEING', mode: 'insensitive' },
        status: { in: INBOUND_STATUSES },
        dyeingInboundOrders: { none: {} },
      },
      include: {
        program: {
          select: { id: true, programNumber: true, programSerialNo: true, fabricName: true, fabricType: true, priority: true },
        },
        items: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (challans.length === 0) return [];

    const incharge = await prisma.user.findFirst({
      where: {
        isActive: true,
        OR: [{ departmentCode: 'DYEING' }, { userRoles: { some: { role: { code: 'DYEING_INCHARGE' } } } }],
      },
      select: { id: true, fullName: true, username: true },
    });
    const year = new Date().getFullYear();
    const created: any[] = [];

    for (const challan of challans) {
      const lines = mapChallanItemsToDyeingLines(challan);
      if (!challan.programId || lines.length === 0) continue;
      const isRework = challan.challanType === 'REWORK_RETURN';

      // A concurrent request may take the same order numbers; retry with fresh ones.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          let seq = await nextOrderSequence(year);
          const orders = await prisma.$transaction(async (tx) => {
            const rows = [];
            for (const line of lines) {
              const expected = line.requiredQuantity ?? line.quantity;
              rows.push(
                await tx.dyeingOrder.create({
                  data: {
                    orderNumber: `DYE-${year}-${String(seq++).padStart(4, '0')}`,
                    programId: challan.programId,
                    inboundChallanId: challan.id,
                    inboundChallanItemId: line.itemId,
                    status: 'AWAITING_RECEIPT',
                    priority: challan.priority || challan.program?.priority || 'NORMAL',
                    fabricName: line.fabric,
                    fabricType: line.fabricType,
                    // Colour to achieve; rework returns re-dye to the colour they came back with.
                    targetColor: line.requiredColour || (isRework ? line.currentColour || '' : ''),
                    colorCode: line.currentShade,
                    requiredQuantity: expected,
                    dyedQuantity: 0,
                    undyedQuantity: 0,
                    readyForQc1Quantity: 0,
                    sentToQc1Quantity: 0,
                    uom: line.unit,
                    inchargeId: incharge?.id ?? null,
                    inchargeName: incharge?.fullName || incharge?.username || null,
                    processRemarks: isRework
                      ? `Dyeing QC rework return on challan ${challan.challanNumber}${challan.remarks ? `: ${challan.remarks}` : ''}`
                      : null,
                  },
                }),
              );
            }
            await tx.program.update({ where: { id: challan.programId }, data: { status: 'IN_PRODUCTION' } });
            return rows;
          });
          created.push(...orders);
          break;
        } catch (error) {
          if (!isUniqueViolation(error)) {
            console.error(`Could not create Dyeing work for challan ${challan.challanNumber}:`, error);
            break;
          }
          // Another request created this challan's orders or took the numbers; check and retry.
          const exists = await prisma.dyeingOrder.findFirst({ where: { inboundChallanId: challan.id }, select: { id: true } });
          if (exists) break;
        }
      }
    }
    return created;
  } catch (error) {
    console.error('Error syncing inbound challans to Dyeing:', error);
    return [];
  }
}
