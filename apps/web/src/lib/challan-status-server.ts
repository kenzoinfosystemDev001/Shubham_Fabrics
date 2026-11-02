import { prisma } from '@shubham/database';
import { userBelongsToDepartment } from '@/lib/auth/department-access';
import type { AuthenticatedUser } from '@/lib/auth/require-user';
import { checkGenericStatusChange } from '@/lib/challan-transitions.mjs';
import { workflowIssuing, workflowReceiving } from '@/lib/work-items-server';

/**
 * Whether a status change requested through the generic challan routes is allowed (see
 * lib/challan-transitions.mjs). A challan is engine-managed when a department screen tracks its quantities:
 * its route belongs to a department workflow, or work items, transfers or dyeing orders point at it.
 */
export async function checkChallanStatusChange(
  challan: { id: string; status: string; fromDepartment: string; toDepartment: string; challanType: string },
  to: unknown,
  user: AuthenticatedUser,
) {
  if (to === undefined || to === null || to === '') return { ok: true as const };
  const linked = await prisma.challan.findUnique({
    where: { id: challan.id },
    select: {
      _count: {
        select: { workItemsInbound: true, workTransfers: true, dyeingInboundOrders: true, dyeingQc1Orders: true, dyeingQcTransfers: true },
      },
    },
  });
  const engineManaged =
    Boolean(workflowReceiving(challan) || workflowIssuing(challan.fromDepartment, challan.toDepartment)) ||
    Object.values(linked?._count ?? {}).some((n) => n > 0);
  return checkGenericStatusChange(challan.status, String(to), {
    engineManaged,
    isSender: userBelongsToDepartment(user, challan.fromDepartment),
    isReceiver: userBelongsToDepartment(user, challan.toDepartment),
    isAdmin: user.isAdmin,
  });
}
