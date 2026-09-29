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
    });

    return inspection;
  }

  async getInspections(params?: { challanId?: string; programId?: string }) {
    const where: any = {};
    if (params?.challanId) where.challanId = params.challanId;
    if (params?.programId) where.programId = params.programId;

    return this.prisma.qualityInspection.findMany({
      where,
      include: {
        defects: true,
        inspector: { select: { username: true, fullName: true } },
        challan: { select: { challanNumber: true, fromDepartment: true, toDepartment: true } },
      },
      orderBy: { inspectedAt: 'desc' },
    });
  }
}
