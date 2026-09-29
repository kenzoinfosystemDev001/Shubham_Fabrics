import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateBundleInput } from '@subham/validation';
import { BundleStatus, DepartmentCode } from '@subham/types';

@Injectable()
export class BundlesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates production bundles from lay cutting
   */
  async createBundles(bundlesData: CreateBundleInput[], actorId: string) {
    if (!bundlesData || bundlesData.length === 0) {
      throw new BadRequestException('At least one bundle must be specified.');
    }

    return this.prisma.$transaction(
      async (tx) => {
        const createdBundles: any[] = [];

        for (const data of bundlesData) {
          const existing = await tx.bundle.findUnique({
            where: { bundleNumber: data.bundleNumber },
          });
          if (existing) {
            throw new BadRequestException(`Bundle '${data.bundleNumber}' already exists.`);
          }

          const barcode = `BC-${data.bundleNumber}`;

          const bundle = await tx.bundle.create({
            data: {
              bundleNumber: data.bundleNumber,
              programId: data.programId,
              challanId: data.challanId || null,
              rollId: data.rollId || null,
              rollNumber: data.rollNumber || null,
              layNumber: data.layNumber || null,
              markerNumber: data.markerNumber || null,
              patternNumber: data.patternNumber || null,
              size: data.size,
              colour: data.colour,
              shade: data.shade || null,
              quantity: data.quantity,
              remainingQuantity: data.quantity,
              currentDepartment: data.currentDepartment || DepartmentCode.CUTTING,
              status: BundleStatus.CREATED,
              barcode,
            },
          });

          // Audit Log
          await tx.auditLog.create({
            data: {
              actorId,
              action: 'BUNDLE_CREATED',
              entity: 'Bundle',
              entityId: bundle.id,
              afterState: JSON.stringify({
                bundleNumber: bundle.bundleNumber,
                size: bundle.size,
                colour: bundle.colour,
                quantity: bundle.quantity,
                roll: bundle.rollNumber,
              }),
            },
          });

          createdBundles.push(bundle);
        }

        return createdBundles;
      },
      { maxWait: 15000, timeout: 60000 },
    );
  }

  async findAll(params?: {
    programId?: string;
    currentDepartment?: string;
    status?: string;
    size?: string;
    search?: string;
    limit?: number;
  }) {
    const where: any = {};
    if (params?.programId) where.programId = params.programId;
    if (params?.currentDepartment) where.currentDepartment = params.currentDepartment;
    if (params?.status) where.status = params.status;
    if (params?.size) where.size = params.size;
    if (params?.search) {
      where.OR = [
        { bundleNumber: { contains: params.search, mode: 'insensitive' } },
        { barcode: { contains: params.search, mode: 'insensitive' } },
        { rollNumber: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.bundle.findMany({
      where,
      orderBy: { bundleNumber: 'asc' },
      take: params?.limit || 200,
      include: {
        program: { select: { programNumber: true, buyerName: true, styleCode: true } },
        defects: true,
      },
    });
  }

  async findOne(id: string) {
    const bundle = await this.prisma.bundle.findFirst({
      where: {
        OR: [{ id }, { bundleNumber: id }, { barcode: id }],
      },
      include: {
        program: true,
        roll: true,
        challan: true,
        defects: {
          include: {
            detectedBy: { select: { username: true, fullName: true } },
            reworks: true,
          },
        },
        cartonItems: {
          include: {
            carton: true,
          },
        },
        recutRequests: true,
      },
    });

    if (!bundle) {
      throw new NotFoundException(`Bundle '${id}' not found`);
    }

    return bundle;
  }

  async updateDepartment(
    id: string,
    departmentCode: DepartmentCode,
    status: BundleStatus,
    actorId: string,
  ) {
    const bundle = await this.findOne(id);

    return this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.bundle.update({
          where: { id: bundle.id },
          data: {
            currentDepartment: departmentCode,
            status,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId,
            action: 'BUNDLE_DEPARTMENT_TRANSFERRED',
            entity: 'Bundle',
            entityId: bundle.id,
            beforeState: JSON.stringify({ dept: bundle.currentDepartment, status: bundle.status }),
            afterState: JSON.stringify({ dept: departmentCode, status }),
          },
        });

        return updated;
      },
      { maxWait: 15000, timeout: 60000 },
    );
  }
}
