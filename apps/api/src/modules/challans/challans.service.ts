import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateChallanInput } from '@subham/validation';
import { ChallanStatus, DepartmentCode, UserRole, UserSession, CHALLAN_TRANSITIONS } from '@subham/types';

type Actor = UserSession & { roles?: string[] };

// Roles allowed to act on any department's challans.
const PLANT_WIDE_ROLES: string[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.PRODUCTION_MANAGER];
const QC_ROLES: string[] = [
  UserRole.QC_INSPECTOR,
  UserRole.WASHING_QC_INSPECTOR,
  UserRole.FINAL_QC_INSPECTOR,
  UserRole.FINAL_QC_SUPERVISOR,
];
// Statuses set by the dispatching department; everything else belongs to the receiver.
const SENDER_STATUSES: string[] = [ChallanStatus.DRAFT, ChallanStatus.SUBMITTED, ChallanStatus.ISSUED];
const QC_DECISION_STATUSES: string[] = [ChallanStatus.QC_APPROVED, ChallanStatus.REWORK, ChallanStatus.REJECTED];
const BALANCE_TOLERANCE = 0.001;
const MAX_GENEALOGY_DEPTH = 100;

@Injectable()
export class ChallansService {
  constructor(private readonly prisma: PrismaService) {}

  async generateNextChallanNumber(deptCode: DepartmentCode | string): Promise<string> {
    const year = new Date().getFullYear();
    const normalizedCode = deptCode === 'PROGRAMMING' || deptCode === DepartmentCode.PROGRAMMING ? 'PRG' : deptCode;
    const prefix = `CH-${normalizedCode}-${year}-`;
    // Use the highest existing sequence (zero-padded, so lexical order works), not a row count,
    // so deleted rows or gaps can't produce a number that already exists.
    const last = await this.prisma.challan.findFirst({
      where: { challanNumber: { startsWith: prefix } },
      orderBy: { challanNumber: 'desc' },
      select: { challanNumber: true },
    });
    const lastSeq = last ? parseInt(last.challanNumber.slice(prefix.length), 10) || 0 : 0;
    return `${prefix}${String(lastSeq + 1).padStart(5, '0')}`;
  }

  async findAll(params?: {
    fromDepartment?: string;
    toDepartment?: string;
    department?: string;
    status?: string;
    programId?: string;
  }) {
    const where: any = {};
    if (params?.department) {
      where.OR = [
        { fromDepartment: params.department },
        { toDepartment: params.department },
      ];
    }
    if (params?.fromDepartment) where.fromDepartment = params.fromDepartment;
    if (params?.toDepartment) where.toDepartment = params.toDepartment;
    if (params?.status) where.status = params.status;
    if (params?.programId) where.programId = params.programId;

    const challans = await this.prisma.challan.findMany({
      where,
      include: {
        program: true,
        fromDeptRel: true,
        toDeptRel: true,
        createdBy: { select: { id: true, username: true, fullName: true } },
        issuedBy: { select: { id: true, username: true, fullName: true } },
        receivedBy: { select: { id: true, username: true, fullName: true } },
        approvedBy: { select: { id: true, username: true, fullName: true } },
        items: true,
        _count: { select: { productionLogs: true, inspections: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return challans.map((ch) => ({
      ...ch,
      program: ch.program
        ? {
            ...ch.program,
            buyer: ch.program.buyerName,
          }
        : null,
    }));
  }

  async findOne(id: string) {
    const challan = await this.prisma.challan.findUnique({
      where: { id },
      include: {
        program: {
          include: {
            fabrics: true,
            routes: {
              include: {
                steps: { orderBy: { sequenceOrder: 'asc' } },
              },
            },
          },
        },
        fromDeptRel: true,
        toDeptRel: true,
        parentChallan: {
          include: {
            items: true,
            fromDeptRel: true,
            toDeptRel: true,
          },
        },
        childChallans: {
          include: {
            items: true,
            fromDeptRel: true,
            toDeptRel: true,
          },
        },
        items: true,
        createdBy: { select: { id: true, username: true, fullName: true } },
        issuedBy: { select: { id: true, username: true, fullName: true } },
        receivedBy: { select: { id: true, username: true, fullName: true } },
        approvedBy: { select: { id: true, username: true, fullName: true } },
        productionLogs: {
          include: {
            operator: { select: { username: true, fullName: true } },
          },
          orderBy: { recordedAt: 'desc' },
        },
        inspections: {
          include: {
            defects: true,
            inspector: { select: { username: true, fullName: true } },
          },
          orderBy: { inspectedAt: 'desc' },
        },
        events: {
          include: {
            actor: { select: { id: true, username: true, fullName: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!challan) {
      throw new NotFoundException(`Challan with ID '${id}' not found`);
    }

    return challan;
  }

  async create(data: CreateChallanInput, actor: Actor) {
    this.assertDepartmentAccess(actor, data.fromDepartment, 'create challans from');

    const program = await this.prisma.program.findUnique({
      where: { id: data.programId },
    });
    if (!program) {
      throw new NotFoundException(`Program '${data.programId}' not found`);
    }

    // The challan number is entered manually; never replace it with a generated one.
    const challanNumber = data.challanNumber.trim();
    const existing = await this.prisma.challan.findFirst({
      where: { challanNumber: { equals: challanNumber, mode: 'insensitive' } },
      select: { challanNumber: true },
    });
    if (existing) {
      throw new ConflictException(`Challan Number '${existing.challanNumber}' already exists. Enter a different challan number.`);
    }
    try {
      return await this.createWithNumber(data, challanNumber, actor.id);
    } catch (err) {
      // P2002 = unique constraint violation (challanNumber) from a concurrent submit
      if ((err as { code?: string })?.code === 'P2002') {
        throw new ConflictException(`Challan Number '${challanNumber}' already exists. Enter a different challan number.`);
      }
      throw err;
    }
  }

  private async createWithNumber(data: CreateChallanInput, challanNumber: string, actorId: string) {
    const challan = await this.prisma.$transaction(async (tx) => {
      const created = await tx.challan.create({
        data: {
          challanNumber,
          challanType: data.challanType,
          programId: data.programId,
          parentChallanId: data.parentChallanId || null,
          fromDepartment: data.fromDepartment,
          toDepartment: data.toDepartment,
          status: ChallanStatus.DRAFT,
          priority: data.priority,
          remarks: data.remarks || null,
          createdById: actorId,

          items: {
            create: data.items.map((it) => ({
              itemDescription: it.itemDescription,
              fabricCode: it.fabricCode || null,
              colour: it.colour || null,
              shade: it.shade || null,
              size: it.size || null,
              unitType: it.unitType,
              rollNumber: it.rollNumber || null,
              lotNumber: it.lotNumber || null,
              bundleNumber: it.bundleNumber || null,
              barcode: it.barcode || null,
              quantity: it.quantity,
              grossWeightKg: it.grossWeightKg || null,
              netWeightKg: it.netWeightKg || null,
              uom: it.uom,
              remarks: it.remarks || null,
              sourceLotId: it.sourceLotId || null,
              sourceRollId: it.sourceRollId || null,
              sourceBundleId: it.sourceBundleId || null,
            })),
          },
        },
        include: {
          items: true,
          fromDeptRel: true,
          toDeptRel: true,
        },
      });

      // Record Challan Creation Event
      await tx.challanEvent.create({
        data: {
          challanId: created.id,
          fromStatus: 'NONE',
          toStatus: ChallanStatus.DRAFT,
          action: 'CREATE',
          actorId,
          notes: 'Challan created in DRAFT status',
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'CHALLAN_CREATED',
          entity: 'Challan',
          entityId: created.id,
          afterState: JSON.stringify({
            challanNumber: created.challanNumber,
            from: created.fromDepartment,
            to: created.toDepartment,
            itemCount: data.items.length,
          }),
        },
      });

      return created;
    }, { maxWait: 15000, timeout: 60000 });

    return challan;
  }

  async transitionStatus(
    id: string,
    newStatus: ChallanStatus,
    actor: Actor,
    notes?: string,
  ) {
    const actorId = actor.id;
    const challan = await this.findOne(id);

    // Idempotent: If already in target status, return current challan
    if (challan.status === newStatus) {
      return challan;
    }

    let allowed = CHALLAN_TRANSITIONS[challan.status] || [];
    if (challan.status === ChallanStatus.ON_HOLD) {
      // A held challan may only resume to where it was held from (or be cancelled).
      const preHold = this.getPreHoldStatus(challan);
      allowed = allowed.filter((st) => st === ChallanStatus.CANCELLED || !preHold || st === preHold);
    }
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Illegal transition from '${challan.status}' to '${newStatus}'. Allowed transitions: [${allowed.join(', ')}]`,
      );
    }

    this.assertTransitionAccess(actor, challan, newStatus);

    if (
      challan.status === ChallanStatus.COMPLETED &&
      (newStatus === ChallanStatus.HANDED_OVER || newStatus === ChallanStatus.CLOSED) &&
      this.requiresQcGate(challan)
    ) {
      throw new BadRequestException(
        `Department '${challan.toDepartment}' requires a QC gate. Move the challan to QC_PENDING and get QC approval before '${newStatus}'.`,
      );
    }

    if (newStatus === ChallanStatus.COMPLETED) {
      this.assertProductionBalanced(challan);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updateData: any = { status: newStatus };
      if (notes) updateData.remarks = `${challan.remarks ? challan.remarks + ' | ' : ''}${notes}`;

      if (newStatus === ChallanStatus.ISSUED) {
        updateData.issuedById = actorId;
        updateData.issuedDate = new Date();
      } else if (newStatus === ChallanStatus.RECEIVED) {
        updateData.receivedById = actorId;
        updateData.receivedDate = new Date();
      } else if (newStatus === ChallanStatus.COMPLETED) {
        updateData.completedDate = new Date();
      } else if (newStatus === ChallanStatus.QC_APPROVED) {
        updateData.approvedById = actorId;
      }

      // Compare-and-set on the status we validated against, so two concurrent actions
      // can't both apply on top of the same starting state.
      const { count } = await tx.challan.updateMany({
        where: { id, status: challan.status },
        data: updateData,
      });
      if (count === 0) {
        throw new ConflictException(
          `Challan '${challan.challanNumber}' was changed by another user. Refresh and try again.`,
        );
      }
      const res = await tx.challan.findUniqueOrThrow({ where: { id } });

      // Record immutable Challan Event
      await tx.challanEvent.create({
        data: {
          challanId: id,
          fromStatus: challan.status,
          toStatus: newStatus,
          action: `TRANSITION_TO_${newStatus}`,
          actorId,
          notes: notes || null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: `CHALLAN_${newStatus}`,
          entity: 'Challan',
          entityId: id,
          beforeState: JSON.stringify({ status: challan.status }),
          afterState: JSON.stringify({ status: newStatus, notes }),
        },
      });

      return res;
    }, { maxWait: 15000, timeout: 60000 });

    return updated;
  }

  /**
   * Action-Driven State Engine:
   * Maps factory operations (Submit, Issue, Receive, Start, Complete, Hold, Resume, QC, Handover, Close, Cancel)
   * to strictly validated state transitions.
   */
  async executeAction(
    id: string,
    action: string,
    actor: Actor,
    payload?: { reason?: string; notes?: string; metadata?: any },
  ) {
    const actionToStatusMap: Record<string, ChallanStatus> = {
      SUBMIT: ChallanStatus.SUBMITTED,
      ISSUE: ChallanStatus.ISSUED,
      RECEIVE: ChallanStatus.RECEIVED,
      START: ChallanStatus.IN_PROCESS,
      COMPLETE: ChallanStatus.COMPLETED,
      QC: ChallanStatus.QC_PENDING,
      HANDOVER: ChallanStatus.HANDED_OVER,
      CLOSE: ChallanStatus.CLOSED,
      HOLD: ChallanStatus.ON_HOLD,
      CANCEL: ChallanStatus.CANCELLED,
      APPROVE: ChallanStatus.QC_APPROVED,
      REWORK: ChallanStatus.REWORK,
      REJECT: ChallanStatus.REJECTED,
    };

    let targetStatus: ChallanStatus | undefined = actionToStatusMap[action];
    if (action === 'RESUME') {
      // Resume returns to the status the challan was held from, not always IN_PROCESS.
      const challan = await this.findOne(id);
      if (challan.status !== ChallanStatus.ON_HOLD) {
        throw new BadRequestException(`Challan is not on hold (current status '${challan.status}')`);
      }
      targetStatus = (this.getPreHoldStatus(challan) as ChallanStatus) || ChallanStatus.IN_PROCESS;
    }
    if (!targetStatus) {
      throw new BadRequestException(
        `Unrecognized factory action '${action}'. Allowed: [${[...Object.keys(actionToStatusMap), 'RESUME'].join(', ')}]`,
      );
    }

    return this.transitionStatus(id, targetStatus, actor, payload?.notes || payload?.reason);
  }

  async getGenealogy(id: string) {
    const root = await this.findOne(id);
    const ancestors: any[] = [];
    const visited = new Set<string>([root.id]);
    let current = root;

    while (current.parentChallanId) {
      // Guard against corrupted parent links forming a cycle.
      if (visited.has(current.parentChallanId) || visited.size > MAX_GENEALOGY_DEPTH) break;
      visited.add(current.parentChallanId);
      const parent = await this.prisma.challan.findUnique({
        where: { id: current.parentChallanId },
        include: {
          items: true,
          fromDeptRel: true,
          toDeptRel: true,
        },
      });
      if (!parent) break;
      ancestors.unshift(parent);
      current = parent as any;
    }

    const descendants = await this.prisma.challan.findMany({
      where: { parentChallanId: id },
      include: {
        items: true,
        fromDeptRel: true,
        toDeptRel: true,
      },
    });

    return {
      currentChallan: root,
      ancestors,
      descendants,
    };
  }
  private getPreHoldStatus(challan: { events?: { toStatus: string; fromStatus: string }[] }): string | null {
    // findOne loads events newest-first
    const holdEvent = challan.events?.find((e) => e.toStatus === ChallanStatus.ON_HOLD);
    return holdEvent?.fromStatus ?? null;
  }

  private requiresQcGate(challan: any): boolean {
    const routes: any[] = challan.program?.routes || [];
    const route = routes.find((r) => r.isDefault) || routes[0];
    const step = route?.steps?.find((st: any) => st.departmentCode === challan.toDepartment);
    return Boolean(step?.requiresQCGate);
  }

  /** SOP-03: Input = Good + Rework + Reject + Waste + Balance, with reason codes. */
  private assertProductionBalanced(challan: any) {
    const logs: any[] = challan.productionLogs || [];
    for (const log of logs) {
      const accounted =
        log.goodQuantity + log.reworkQuantity + log.rejectQuantity + log.wasteQuantity + log.balanceQuantity;
      if (Math.abs(log.inputQuantity - accounted) > BALANCE_TOLERANCE) {
        throw new UnprocessableEntityException(
          `Production entry ${log.id} is unbalanced: input ${log.inputQuantity} vs accounted ${accounted}.`,
        );
      }
      if (log.reworkQuantity > 0 && !log.reworkReason) {
        throw new UnprocessableEntityException(`Production entry ${log.id} has rework without a reason code.`);
      }
      if (log.rejectQuantity > 0 && !log.rejectReason) {
        throw new UnprocessableEntityException(`Production entry ${log.id} has rejects without a reason code.`);
      }
    }
    const issuedQty = (challan.items || []).reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0), 0);
    const loggedInput = logs.reduce((sum, l) => sum + l.inputQuantity, 0);
    if (issuedQty > 0 && loggedInput - issuedQty > BALANCE_TOLERANCE) {
      throw new UnprocessableEntityException(
        `Production input ${loggedInput} exceeds challan quantity ${issuedQty}.`,
      );
    }
  }

  private actorRoles(actor: Actor): string[] {
    return [actor.role, ...(actor.roles || [])];
  }

  private assertDepartmentAccess(actor: Actor, department: string, verb: string) {
    if (this.actorRoles(actor).some((r) => PLANT_WIDE_ROLES.includes(r))) return;
    if (actor.departmentCode === department) return;
    throw new ForbiddenException(`You are not allowed to ${verb} department '${department}'.`);
  }

  private assertTransitionAccess(actor: Actor, challan: any, newStatus: string) {
    if (this.actorRoles(actor).some((r) => PLANT_WIDE_ROLES.includes(r))) return;
    if (challan.status === ChallanStatus.QC_PENDING && QC_DECISION_STATUSES.includes(newStatus)) {
      if (this.actorRoles(actor).some((r) => QC_ROLES.includes(r))) return;
      if (actor.departmentCode === challan.toDepartment) return;
      throw new ForbiddenException('Only QC inspectors or the receiving department can record a QC decision.');
    }
    // Pre-dispatch steps (and cancelling before dispatch) belong to the sender; the rest to the receiver.
    const senderOwned =
      SENDER_STATUSES.includes(newStatus) ||
      (newStatus === ChallanStatus.CANCELLED && SENDER_STATUSES.includes(challan.status));
    const department = senderOwned ? challan.fromDepartment : challan.toDepartment;
    this.assertDepartmentAccess(actor, department, `move challans to '${newStatus}' for`);
  }
}
