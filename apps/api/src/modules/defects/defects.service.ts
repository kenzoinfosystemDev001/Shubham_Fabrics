import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import {
  CreateDefectRecordInput,
  CreateReworkTransactionInput,
  CreateRecutRequestInput,
} from '@subham/validation';
import { DefectStatus, ReworkStatus, RecutStatus, BundleStatus, DepartmentCode } from '@subham/types';

@Injectable()
export class DefectsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Central Defect Logging
   */
  async createDefect(data: CreateDefectRecordInput, actorId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const program = await tx.program.findUnique({ where: { id: data.programId } });
        if (!program) {
          throw new NotFoundException(`Program '${data.programId}' not found.`);
        }

        const defect = await tx.defectRecord.create({
          data: {
            defectCode: data.defectCode,
            programId: data.programId,
            challanId: data.challanId || null,
            departmentCode: data.departmentCode,
            bundleId: data.bundleId || null,
            itemDescription: data.itemDescription,
            severity: data.severity,
            quantity: data.quantity,
            reason: data.reason,
            detectedById: actorId,
            status: DefectStatus.OPEN,
          },
          include: {
            detectedBy: { select: { username: true, fullName: true } },
            program: { select: { programNumber: true, styleCode: true } },
            bundle: true,
          },
        });

        // If associated with a bundle, update bundle status to REWORK
        if (data.bundleId) {
          await tx.bundle.update({
            where: { id: data.bundleId },
            data: { status: BundleStatus.REWORK },
          });
        }

        await tx.auditLog.create({
          data: {
            actorId,
            action: 'DEFECT_LOGGED',
            entity: 'DefectRecord',
            entityId: defect.id,
            afterState: JSON.stringify({
              code: defect.defectCode,
              severity: defect.severity,
              quantity: defect.quantity,
              department: defect.departmentCode,
            }),
          },
        });

        return defect;
      },
      { maxWait: 15000, timeout: 60000 },
    );
  }

  /**
   * Update Defect Status (OPEN -> UNDER_REVIEW -> REWORK/RECUT/SCRAP/RELEASED/CLOSED)
   */
  async updateDefectStatus(
    id: string,
    status: DefectStatus,
    resolutionNotes: string | undefined,
    actorId: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const defect = await tx.defectRecord.findUnique({ where: { id } });
        if (!defect) {
          throw new NotFoundException(`Defect '${id}' not found`);
        }

        const updated = await tx.defectRecord.update({
          where: { id },
          data: {
            status,
            resolutionNotes: resolutionNotes || defect.resolutionNotes,
            resolvedAt: status === DefectStatus.CLOSED || status === DefectStatus.RELEASED ? new Date() : undefined,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId,
            action: `DEFECT_${status}`,
            entity: 'DefectRecord',
            entityId: id,
            beforeState: JSON.stringify({ status: defect.status }),
            afterState: JSON.stringify({ status, resolutionNotes }),
          },
        });

        return updated;
      },
      { maxWait: 15000, timeout: 60000 },
    );
  }

  /**
   * Real Rework Transaction (Not a status hack)
   */
  async createReworkTransaction(data: CreateReworkTransactionInput, actorId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const defect = await tx.defectRecord.findUnique({
          where: { id: data.defectId },
          include: { bundle: true },
        });
        if (!defect) {
          throw new NotFoundException(`Defect '${data.defectId}' not found.`);
        }

        const rework = await tx.reworkTransaction.create({
          data: {
            defectId: data.defectId,
            programId: data.programId,
            sourceTransactionId: data.sourceTransactionId || null,
            departmentCode: data.departmentCode,
            operationName: data.operationName,
            operatorId: data.operatorId,
            inputQuantity: data.inputQuantity,
            outputGoodQuantity: data.outputGoodQuantity,
            outputRejectQuantity: data.outputRejectQuantity,
            status: ReworkStatus.COMPLETED,
            notes: data.notes || null,
            completedAt: new Date(),
          },
        });

        // If all or partial output is good, update defect and restore bundle status
        if (data.outputGoodQuantity > 0) {
          await tx.defectRecord.update({
            where: { id: defect.id },
            data: {
              status: DefectStatus.RELEASED,
              resolutionNotes: `Rework successful: ${data.outputGoodQuantity} recovered, ${data.outputRejectQuantity} rejected.`,
              resolvedAt: new Date(),
            },
          });

          if (defect.bundleId) {
            await tx.bundle.update({
              where: { id: defect.bundleId },
              data: {
                status: BundleStatus.COMPLETED,
                remainingQuantity: data.outputGoodQuantity,
              },
            });
          }
        } else {
          // All rejected/scrapped
          await tx.defectRecord.update({
            where: { id: defect.id },
            data: {
              status: DefectStatus.SCRAP,
              resolutionNotes: `Rework failed: All ${data.inputQuantity} pieces scrapped.`,
              resolvedAt: new Date(),
            },
          });
        }

        await tx.auditLog.create({
          data: {
            actorId,
            action: 'REWORK_COMPLETED',
            entity: 'ReworkTransaction',
            entityId: rework.id,
            afterState: JSON.stringify({
              input: data.inputQuantity,
              good: data.outputGoodQuantity,
              reject: data.outputRejectQuantity,
              defectId: data.defectId,
            }),
          },
        });

        return rework;
      },
      { maxWait: 15000, timeout: 60000 },
    );
  }

  /**
   * Re-cutting Exception Workflow (Never overwrites original records)
   */
  async createRecutRequest(data: CreateRecutRequestInput, actorId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.recutRequest.findUnique({
          where: { recutNumber: data.recutNumber },
        });
        if (existing) {
          throw new BadRequestException(`Recut request '${data.recutNumber}' already exists.`);
        }

        const recut = await tx.recutRequest.create({
          data: {
            recutNumber: data.recutNumber,
            programId: data.programId,
            defectId: data.defectId,
            originalBundleId: data.originalBundleId || null,
            size: data.size,
            colour: data.colour,
            requestedQuantity: data.requestedQuantity,
            reason: data.reason,
            requestedById: actorId,
            status: RecutStatus.REQUESTED,
            notes: data.notes || null,
          },
          include: {
            requestedBy: { select: { username: true, fullName: true } },
            defect: true,
          },
        });

        // Update defect status to RECUT
        await tx.defectRecord.update({
          where: { id: data.defectId },
          data: { status: DefectStatus.RECUT },
        });

        await tx.auditLog.create({
          data: {
            actorId,
            action: 'RECUT_REQUESTED',
            entity: 'RecutRequest',
            entityId: recut.id,
            afterState: JSON.stringify({
              recutNumber: recut.recutNumber,
              quantity: recut.requestedQuantity,
              size: recut.size,
              colour: recut.colour,
            }),
          },
        });

        return recut;
      },
      { maxWait: 15000, timeout: 60000 },
    );
  }

  /**
   * Approve Re-cut Request & Auto-Generate Replacement Bundle
   */
  async approveRecutRequest(id: string, actorId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const recut = await tx.recutRequest.findUnique({
          where: { id },
          include: { originalBundle: true },
        });
        if (!recut) {
          throw new NotFoundException(`Recut request '${id}' not found.`);
        }
        if (recut.status !== RecutStatus.REQUESTED) {
          throw new BadRequestException(`Recut request is not in REQUESTED status (current: ${recut.status}).`);
        }

        // Generate Replacement Bundle
        const replacementBundleNumber = `BND-RECUT-${recut.recutNumber.replace('REC-', '')}`;
        const replacementBundle = await tx.bundle.create({
          data: {
            bundleNumber: replacementBundleNumber,
            programId: recut.programId,
            size: recut.size,
            colour: recut.colour,
            quantity: recut.requestedQuantity,
            remainingQuantity: recut.requestedQuantity,
            currentDepartment: DepartmentCode.CUTTING,
            status: BundleStatus.CREATED,
            barcode: `BC-${replacementBundleNumber}`,
          },
        });

        // Update Recut record
        const updatedRecut = await tx.recutRequest.update({
          where: { id },
          data: {
            status: RecutStatus.COMPLETED,
            approvedById: actorId,
            replacementBundleId: replacementBundle.id,
          },
          include: {
            replacementBundle: true,
            approvedBy: { select: { username: true, fullName: true } },
          },
        });

        await tx.auditLog.create({
          data: {
            actorId,
            action: 'RECUT_APPROVED_AND_REPLACED',
            entity: 'RecutRequest',
            entityId: id,
            afterState: JSON.stringify({
              recutNumber: recut.recutNumber,
              replacementBundle: replacementBundleNumber,
            }),
          },
        });

        return updatedRecut;
      },
      { maxWait: 15000, timeout: 60000 },
    );
  }

  async getDefects(params?: { programId?: string; departmentCode?: string; status?: string }) {
    const where: any = {};
    if (params?.programId) where.programId = params.programId;
    if (params?.departmentCode) where.departmentCode = params.departmentCode;
    if (params?.status) where.status = params.status;

    return this.prisma.defectRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        detectedBy: { select: { username: true, fullName: true } },
        reworks: true,
        recutRequests: true,
        bundle: true,
      },
    });
  }

  async getReworks(params?: { programId?: string; departmentCode?: string }) {
    const where: any = {};
    if (params?.programId) where.programId = params.programId;
    if (params?.departmentCode) where.departmentCode = params.departmentCode;

    return this.prisma.reworkTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        defect: true,
        operator: { select: { username: true, fullName: true } },
      },
    });
  }

  async getRecutRequests(params?: { programId?: string; status?: string }) {
    const where: any = {};
    if (params?.programId) where.programId = params.programId;
    if (params?.status) where.status = params.status;

    return this.prisma.recutRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        defect: true,
        originalBundle: true,
        replacementBundle: true,
        requestedBy: { select: { username: true, fullName: true } },
        approvedBy: { select: { username: true, fullName: true } },
      },
    });
  }
}
