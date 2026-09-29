import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { QualityInspectionInput } from '@subham/validation';
import { ChallanStatus, QualityStatus } from '@subham/types';

@Injectable()
export class QualityService {
  constructor(private readonly prisma: PrismaService) {}

  async recordInspection(data: QualityInspectionInput, inspectorId: string) {
    const challan = await this.prisma.challan.findUnique({
      where: { id: data.challanId },
    });
    if (!challan) {
      throw new NotFoundException(`Challan '${data.challanId}' not found`);
    }

    const totalDefects = (data.defects || []).reduce((acc, d) => acc + d.count, 0);

    const inspection = await this.prisma.$transaction(async (tx) => {
      const created = await tx.qualityInspection.create({
        data: {
          challanId: data.challanId,
          programId: data.programId,
          departmentCode: data.departmentCode,
          inspectorId,
          sampleSize: data.sampleSize,
          status: data.status,
          notes: data.notes || null,
          defects: {
            create: (data.defects || []).map((d) => ({
              defectType: d.defectType,
              count: d.count,
              severity: d.severity,
            })),
          },
        },
        include: {
          defects: true,
          inspector: { select: { username: true, fullName: true } },
        },
      });

      // Update Challan status based on QC result
      let newChallanStatus: ChallanStatus = ChallanStatus.QC_APPROVED;
      if (data.status === QualityStatus.FAILED) {
        newChallanStatus = ChallanStatus.REWORK;
      }

      await tx.challan.update({
        where: { id: challan.id },
        data: { status: newChallanStatus },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          actorId: inspectorId,
          action: data.status === QualityStatus.PASSED ? 'QC_PASSED' : 'QC_FAILED',
          entity: 'QualityInspection',
          entityId: created.id,
          afterState: JSON.stringify({
            status: data.status,
            totalDefects,
            challanNumber: challan.challanNumber,
          }),
        },
      });

      return created;
    }, { maxWait: 15000, timeout: 60000 });

    return inspection;
  }

  async recordComprehensiveInspection(data: any, inspectorId: string) {
    const challan = await this.prisma.challan.findUnique({
      where: { id: data.challanId },
    });
    if (!challan) {
      throw new NotFoundException(`Challan '${data.challanId}' not found`);
    }

    const totalDefects = (data.defects || []).reduce((acc: number, d: any) => acc + d.count, 0);

    return this.prisma.$transaction(
      async (tx) => {
        const created = await tx.qualityInspection.create({
          data: {
            challanId: data.challanId,
            programId: data.programId,
            departmentCode: data.departmentCode,
            inspectorId,
            sampleSize: data.sampleSize,
            status: data.overallStatus,
            notes: data.notes || null,
            parameters: {
              create: (data.parameters || []).map((p: any) => ({
                parameterName: p.parameterName,
                expectedValue: p.expectedValue || null,
                measuredValue: p.measuredValue,
                tolerance: p.tolerance || null,
                uom: p.uom || null,
                status: p.status,
                comments: p.comments || null,
              })),
            },
            defects: {
              create: (data.defects || []).map((d: any) => ({
                defectType: d.defectType,
                count: d.count,
                severity: d.severity,
              })),
            },
          },
          include: {
            parameters: true,
            defects: true,
            inspector: { select: { username: true, fullName: true } },
          },
        });

        // Determine next challan status from overall QC result
        let nextStatus: ChallanStatus = ChallanStatus.QC_APPROVED;
        if (data.overallStatus === 'REWORK') {
          nextStatus = ChallanStatus.REWORK;
        } else if (data.overallStatus === 'HOLD') {
          nextStatus = ChallanStatus.ON_HOLD;
        } else if (data.overallStatus === 'REJECT') {
          nextStatus = ChallanStatus.REJECTED;
        }

        await tx.challan.update({
          where: { id: challan.id },
          data: {
            status: nextStatus,
            approvedById: nextStatus === ChallanStatus.QC_APPROVED ? inspectorId : undefined,
          },
        });

        // Record Challan Event
        await tx.challanEvent.create({
          data: {
            challanId: challan.id,
            fromStatus: challan.status,
            toStatus: nextStatus,
            action: `QC_${data.overallStatus}`,
            actorId: inspectorId,
            notes: `Inspection completed: ${data.overallStatus}. Total defects: ${totalDefects}.`,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: inspectorId,
            action: `QC_INSPECTION_${data.overallStatus}`,
            entity: 'QualityInspection',
            entityId: created.id,
            afterState: JSON.stringify({
              challanNumber: challan.challanNumber,
              status: data.overallStatus,
              parametersCount: (data.parameters || []).length,
              defectsCount: totalDefects,
            }),
          },
        });

        return created;
      },
      { maxWait: 15000, timeout: 60000 },
    );
  }

  async getInspections(params?: { challanId?: string; programId?: string }) {
    const where: any = {};
    if (params?.challanId) where.challanId = params.challanId;
    if (params?.programId) where.programId = params.programId;

    return this.prisma.qualityInspection.findMany({
      where,
      include: {
        parameters: true,
        defects: true,
        inspector: { select: { username: true, fullName: true } },
        challan: { select: { challanNumber: true, fromDepartment: true, toDepartment: true } },
      },
      orderBy: { inspectedAt: 'desc' },
    });
  }
}
