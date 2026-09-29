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
        { programNumber: { contains: params.search, mode: 'insensitive' } },
        { buyerName: { contains: params.search, mode: 'insensitive' } },
        { orderNumber: { contains: params.search, mode: 'insensitive' } },
        { styleCode: { contains: params.search, mode: 'insensitive' } },
        { designName: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const programs = await this.prisma.program.findMany({
      where,
      include: {
        customer: true,
        design: true,
        createdBy: { select: { id: true, username: true, fullName: true } },
        approvedBy: { select: { id: true, username: true, fullName: true } },
        fabrics: true,
        sizes: true,
        colours: true,
        routes: {
          include: {
            steps: { orderBy: { sequenceOrder: 'asc' } },
          },
        },
        _count: { select: { challans: true, productionLogs: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Provide friendly aliases for UI compatibility
    return programs.map((p) => ({
      ...p,
      buyer: p.buyerName,
      sizeMatrix: p.sizes,
      colorMatrix: p.colours,
      routeSteps: p.routes?.[0]?.steps || [],
    }));
  }

  async findOne(id: string) {
    const p = await this.prisma.program.findUnique({
      where: { id },
      include: {
        customer: true,
        design: true,
        createdBy: { select: { id: true, username: true, fullName: true } },
        approvedBy: { select: { id: true, username: true, fullName: true } },
        fabrics: true,
        specifications: true,
        sizes: true,
        colours: true,
        bomItems: {
          include: { supplier: true },
        },
        routes: {
          include: {
            steps: {
              include: { operation: true },
              orderBy: { sequenceOrder: 'asc' },
            },
          },
        },
        challans: {
          include: {
            items: true,
            fromDeptRel: true,
            toDeptRel: true,
            createdBy: { select: { username: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        productionLogs: {
          include: {
            operator: { select: { username: true, fullName: true } },
          },
          orderBy: { recordedAt: 'desc' },
        },
      },
    });

    if (!p) {
      throw new NotFoundException(`Program with ID '${id}' not found`);
    }

    return {
      ...p,
      buyer: p.buyerName,
      measurements: p.specifications,
      sizeMatrix: p.sizes,
      colorMatrix: p.colours,
      routeSteps: p.routes?.[0]?.steps || [],
    };
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
          customerId: data.customerId || null,
          buyerName: data.buyerName,
          orderNumber: data.orderNumber,
          designId: data.designId || null,
          designName: data.designName,
          styleCode: data.styleCode,
          productCategory: data.productCategory,
          targetQuantity: data.targetQuantity,
          deliveryDate: new Date(data.deliveryDate),
          priority: data.priority,
          status: ProgramStatus.DRAFT,
          remarks: data.remarks || null,
          createdById: actorId,

          fabrics: {
            create: data.fabrics.map((f) => ({
              fabricId: f.fabricId || null,
              fabricCode: f.fabricCode,
              fabricName: f.fabricName,
              composition: f.composition,
              widthInInches: f.widthInInches,
              gsm: f.gsm,
              colourId: f.colourId || null,
              colour: f.colour,
              shade: f.shade || null,
              requiredQuantity: f.requiredQuantity,
              tolerancePercentage: f.tolerancePercentage,
              wastagePercentage: f.wastagePercentage,
            })),
          },

          specifications: {
            create: data.measurements.map((m) => ({
              sizeId: m.sizeId || null,
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
              toleranceMm: m.toleranceMm || 5.0,
            })),
          },

          sizes: {
            create: data.sizeMatrix.map((s) => ({
              sizeId: s.sizeId || null,
              size: s.size,
              targetQuantity: s.targetQuantity,
            })),
          },

          colours: {
            create: data.colorMatrix.map((c) => ({
              colourId: c.colourId || null,
              colorCode: c.colorCode,
              colorName: c.colorName,
              shade: c.shade || null,
              targetQuantity: c.targetQuantity,
            })),
          },

          bomItems: {
            create: data.bomItems.map((b) => ({
              itemId: b.itemId || null,
              itemCode: b.itemCode,
              itemName: b.itemName,
              category: b.category,
              requiredQuantityPerPiece: b.requiredQuantityPerPiece,
              uom: b.uom,
              wastagePercentage: b.wastagePercentage,
              totalRequiredQuantity: b.totalRequiredQuantity,
              supplierId: b.supplierId || null,
            })),
          },

          routes: {
            create: [
              {
                routeName: 'Configured Shop Floor Route',
                steps: {
                  create: data.routeSteps.map((r) => ({
                    sequenceOrder: r.sequenceOrder,
                    departmentCode: r.departmentCode,
                    operationId: r.operationId || null,
                    isMandatory: r.isMandatory ?? true,
                    requiresQCGate: r.requiresQCGate ?? false,
                    expectedDurationMinutes: r.expectedDurationMinutes || 45.0,
                    inputType: r.inputType || 'CUT_PANEL',
                    outputType: r.outputType || 'PIECE',
                    reworkAllowed: r.reworkAllowed ?? true,
                    skipAllowed: r.skipAllowed ?? false,
                    isParallel: r.isParallel ?? false,
                  })),
                },
              },
            ],
          },
        },
        include: {
          fabrics: true,
          specifications: true,
          sizes: true,
          colours: true,
          bomItems: true,
          routes: { include: { steps: true } },
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
    }, { maxWait: 15000, timeout: 60000 });

    return program;
  }

  async updateStatus(id: string, newStatus: ProgramStatus, actorId: string) {
    const program = await this.findOne(id);

    // Validate legal transition
    const validTransitions: Record<string, string[]> = {
      [ProgramStatus.DRAFT]: [ProgramStatus.SUBMITTED, ProgramStatus.CANCELLED],
      [ProgramStatus.SUBMITTED]: [ProgramStatus.APPROVED, ProgramStatus.DRAFT, ProgramStatus.CANCELLED],
      [ProgramStatus.APPROVED]: [ProgramStatus.IN_PRODUCTION, ProgramStatus.ON_HOLD, ProgramStatus.CANCELLED],
      [ProgramStatus.IN_PRODUCTION]: [ProgramStatus.COMPLETED, ProgramStatus.ON_HOLD, ProgramStatus.CANCELLED],
      [ProgramStatus.ON_HOLD]: [ProgramStatus.IN_PRODUCTION, ProgramStatus.APPROVED, ProgramStatus.CANCELLED],
    };

    const allowed = validTransitions[program.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition Program from '${program.status}' to '${newStatus}'. Allowed: [${allowed.join(', ')}]`,
      );
    }

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
    }, { maxWait: 15000, timeout: 60000 });

    return updated;
  }
}
