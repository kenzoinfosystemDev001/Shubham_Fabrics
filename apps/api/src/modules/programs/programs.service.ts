import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateProgramInput } from '@subham/validation';
import { ProgramStatus } from '@subham/types';

@Injectable()
export class ProgramsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params?: { status?: string; search?: string }) {
    const where: any = {};
    if (params?.status) {
      where.status = params.status;
    }
    if (params?.search) {
      where.OR = [
        { programNumber: { contains: params.search } },
        { buyer: { contains: params.search } },
        { orderNumber: { contains: params.search } },
        { styleCode: { contains: params.search } },
        { designName: { contains: params.search } },
      ];
    }

    return this.prisma.program.findMany({
      where,
      include: {
        createdBy: { select: { id: true, username: true, fullName: true } },
        approvedBy: { select: { id: true, username: true, fullName: true } },
        fabrics: true,
        sizeMatrix: true,
        colorMatrix: true,
        routeSteps: { orderBy: { sequenceOrder: 'asc' } },
        _count: { select: { challans: true, productionRecords: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const program = await this.prisma.program.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, username: true, fullName: true } },
        approvedBy: { select: { id: true, username: true, fullName: true } },
        fabrics: true,
        measurements: true,
        sizeMatrix: true,
        colorMatrix: true,
        bomItems: true,
        routeSteps: { orderBy: { sequenceOrder: 'asc' } },
        challans: {
          include: {
            items: true,
            fromDeptRel: true,
            toDeptRel: true,
            createdBy: { select: { username: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        productionRecords: {
          include: {
            operator: { select: { username: true, fullName: true } },
          },
          orderBy: { recordedAt: 'desc' },
        },
      },
    });

    if (!program) {
      throw new NotFoundException(`Program with ID '${id}' not found`);
    }

    return program;
  }

  async create(data: CreateProgramInput, actorId: string) {
    const existing = await this.prisma.program.findUnique({
      where: { programNumber: data.programNumber },
    });
    if (existing) {
      throw new BadRequestException(`Program number '${data.programNumber}' already exists`);
    }

    const program = await this.prisma.$transaction(async (tx) => {
      const created = await tx.program.create({
        data: {
          programNumber: data.programNumber,
          programDate: new Date(data.programDate),
          buyer: data.buyer,
          orderNumber: data.orderNumber,
          designNumber: data.designNumber,
          designName: data.designName,
          designVersion: data.designVersion || 'v1.0',
          patternNumber: data.patternNumber,
          styleCode: data.styleCode,
          productCategory: data.productCategory,
          description: data.description,
          referenceImageUrl: data.referenceImageUrl || null,
          technicalDrawingUrl: data.technicalDrawingUrl || null,
          specificationSheetUrl: data.specificationSheetUrl || null,
          targetQuantity: data.targetQuantity,
          deliveryDate: new Date(data.deliveryDate),
          priority: data.priority,
          status: ProgramStatus.DRAFT,
          createdById: actorId,

          fabrics: {
            create: data.fabrics.map((f) => ({
              fabricCode: f.fabricCode,
              fabricName: f.fabricName,
              fabricType: f.fabricType,
              composition: f.composition,
              widthInInches: f.widthInInches,
              gsm: f.gsm,
              colour: f.colour,
              shade: f.shade,
              requiredQuantity: f.requiredQuantity,
              tolerancePercentage: f.tolerancePercentage,
              supplier: f.supplier,
            })),
          },

          measurements: {
            create: data.measurements.map((m) => ({
              size: m.size,
              length: m.length,
              chest: m.chest,
              waist: m.waist,
              shoulder: m.shoulder,
              sleeveLength: m.sleeveLength,
              armhole: m.armhole,
              neck: m.neck,
              bottom: m.bottom,
              otherSpecs: m.otherSpecs ? JSON.stringify(m.otherSpecs) : null,
            })),
          },

          sizeMatrix: {
            create: data.sizeMatrix.map((s) => ({
              size: s.size,
              targetQuantity: s.targetQuantity,
            })),
          },

          colorMatrix: {
            create: data.colorMatrix.map((c) => ({
              colorCode: c.colorCode,
              colorName: c.colorName,
              pantoneReference: c.pantoneReference || null,
              shade: c.shade,
              targetQuantity: c.targetQuantity,
            })),
          },

          bomItems: {
            create: data.bomItems.map((b) => ({
              itemCode: b.itemCode,
              itemName: b.itemName,
              category: b.category,
              requiredQuantityPerPiece: b.requiredQuantityPerPiece,
              uom: b.uom,
              wastagePercentage: b.wastagePercentage,
              totalRequiredQuantity: b.totalRequiredQuantity,
              supplier: b.supplier || null,
            })),
          },

          routeSteps: {
            create: data.routeSteps.map((r) => ({
              sequenceOrder: r.sequenceOrder,
              departmentCode: r.departmentCode,
              standardCycleTimeMinutes: r.standardCycleTimeMinutes || null,
              isMandatory: r.isMandatory ?? true,
              requiresQCGate: r.requiresQCGate ?? false,
            })),
          },
        },
        include: {
          fabrics: true,
          measurements: true,
          sizeMatrix: true,
          colorMatrix: true,
          bomItems: true,
          routeSteps: { orderBy: { sequenceOrder: 'asc' } },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'PROGRAM_CREATED',
          entity: 'Program',
          entityId: created.id,
          afterState: JSON.stringify({
            programNumber: created.programNumber,
            targetQuantity: created.targetQuantity,
            styleCode: created.styleCode,
          }),
        },
      });

      return created;
    });

    return program;
  }

  async updateStatus(id: string, newStatus: ProgramStatus, actorId: string) {
    const program = await this.findOne(id);

    const updated = await this.prisma.$transaction(async (tx) => {
      const dataToUpdate: any = { status: newStatus };
      if (newStatus === ProgramStatus.APPROVED) {
        dataToUpdate.approvedById = actorId;
        dataToUpdate.approvedAt = new Date();
      }

      const res = await tx.program.update({
        where: { id },
        data: dataToUpdate,
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: newStatus === ProgramStatus.APPROVED ? 'PROGRAM_APPROVED' : 'PROGRAM_STATUS_CHANGED',
          entity: 'Program',
          entityId: id,
          beforeState: JSON.stringify({ status: program.status }),
          afterState: JSON.stringify({ status: newStatus }),
        },
      });

      return res;
    });

    return updated;
  }
}
