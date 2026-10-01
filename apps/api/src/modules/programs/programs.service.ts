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
      [ProgramStatus.DRAFT]: [ProgramStatus.IN_PROGRESS, ProgramStatus.READY_FOR_ISSUE, ProgramStatus.SUBMITTED, ProgramStatus.CANCELLED],
      [ProgramStatus.IN_PROGRESS]: [ProgramStatus.READY_FOR_ISSUE, ProgramStatus.DRAFT, ProgramStatus.CANCELLED],
      [ProgramStatus.READY_FOR_ISSUE]: [ProgramStatus.ISSUED, ProgramStatus.IN_PROGRESS, ProgramStatus.CANCELLED],
      [ProgramStatus.ISSUED]: [ProgramStatus.IN_PRODUCTION, ProgramStatus.COMPLETED, ProgramStatus.ON_HOLD],
      [ProgramStatus.SUBMITTED]: [ProgramStatus.APPROVED, ProgramStatus.DRAFT, ProgramStatus.CANCELLED],
      [ProgramStatus.APPROVED]: [ProgramStatus.IN_PRODUCTION, ProgramStatus.READY_FOR_ISSUE, ProgramStatus.ON_HOLD, ProgramStatus.CANCELLED],
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
      if (newStatus === ProgramStatus.APPROVED || newStatus === ProgramStatus.ISSUED) {
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
          action: newStatus === ProgramStatus.ISSUED ? 'PRODUCTION_SHEET_ISSUED' : (newStatus === ProgramStatus.APPROVED ? 'PROGRAM_APPROVED' : 'PROGRAM_STATUS_CHANGED'),
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

  async generateNextProgramNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PRG-${year}-`;
    const count = await this.prisma.program.count({
      where: { programNumber: { startsWith: prefix } },
    });
    const nextSeq = String(count + 1).padStart(5, '0');
    return `${prefix}${nextSeq}`;
  }

  async createProductionSheet(data: any, actorId: string) {
    const programNumber = data.programNumber || data.programSerialNo || await this.generateNextProgramNumber();
    const existing = await this.prisma.program.findUnique({
      where: { programNumber },
    });
    if (existing) {
      throw new BadRequestException(`Production Sheet / Program number '${programNumber}' already exists`);
    }

    const startDate = data.startDate || data.programStartDate ? new Date(data.startDate || data.programStartDate) : new Date();
    const deliveryDate = data.deliveryDate || data.clientDeliveryDate ? new Date(data.deliveryDate || data.clientDeliveryDate) : new Date(Date.now() + 14 * 86400000);
    const prodDesignDate = data.productionDesignDate ? new Date(data.productionDesignDate) : null;
    const prodEndDate = data.productionEndDate ? new Date(data.productionEndDate) : null;

    const targetQty = Number(data.targetQuantity || data.colorQuantity || 1);

    const program = await this.prisma.$transaction(async (tx) => {
      const created = await tx.program.create({
        data: {
          programNumber,
          programSerialNo: data.programSerialNo || programNumber,
          programDate: startDate,
          startDate,
          deliveryDate,
          designNumber: data.designNumber || data.programDesignNo || 'DSG-001',
          clientName: data.clientName || data.buyerName || 'Standard Client',
          buyerName: data.clientName || data.buyerName || 'Standard Client',
          clientPriority: data.clientPriority || data.priority || 'NORMAL',
          priority: data.clientPriority || data.priority || 'NORMAL',
          orderNumber: data.orderNumber || `ORD-${programNumber}`,
          designName: data.embroideryDesign || data.designName || 'Standard Embroidery',
          styleCode: data.mainStyle || data.styleCode || 'STYLE-01',
          productCategory: data.productCategory || 'GARMENT',
          targetQuantity: targetQty,
          status: data.status || ProgramStatus.DRAFT,
          remarks: data.comments || data.remarks || null,
          createdById: actorId,

          // Style Info
          mainStyle: data.mainStyle || null,
          subStyle: data.subStyle || null,
          pattern: data.pattern || null,
          baseDesignType: data.baseDesignType || null,
          baseDesignPhoto: data.baseDesignPhoto || null,

          // Design Info
          wilcomDesignNumber: data.wilcomDesignNumber || null,
          wilcomDesignPhoto: data.wilcomDesignPhoto || null,
          embroideryDesign: data.embroideryDesign || null,
          embroideryDesignSize: data.embroideryDesignSize || null,

          // Fabric Info
          fabricName: data.fabricName || data.fabric || null,
          fabricType: data.fabricType || null,
          fabricWidth: data.fabricWidth || null,
          fabricWidthInches: data.fabricWidthInches ? parseFloat(data.fabricWidthInches) : null,
          fabricColor: data.fabricColor || null,
          fabricColorAvailable: data.fabricColorAvailable || null,
          fabricAverage: data.fabricAverage ? parseFloat(data.fabricAverage) : null,
          fabricAverageType: data.fabricAverageType || null,
          fabricAverageMeasurement: data.fabricAverageMeasurement || null,

          // Dyeing Info
          fabricDyeingRequired: Boolean(data.fabricDyeingRequired),
          fabricIssuedToDyeing: data.fabricIssuedToDyeing ? parseFloat(data.fabricIssuedToDyeing) : null,
          fabricSentToDyeing: data.fabricSentToDyeing ? parseFloat(data.fabricSentToDyeing) : null,

          // Quantity Info
          colorQuantity: data.colorQuantity ? parseInt(data.colorQuantity, 10) : targetQty,
          quantityMeasurement: data.quantityMeasurement || data.programQtyMeasurement || 'PCS',
          specialMaterial: data.specialMaterial || null,
          specialMaterialQuantity: data.specialMaterialQuantity ? String(data.specialMaterialQuantity) : null,

          // Production Dates
          productionDesignDate: prodDesignDate,
          productionEndDate: prodEndDate,

          // Rejection & Remarks
          piecesRejection: data.piecesRejection ? parseInt(data.piecesRejection, 10) : 0,
          rejectionReason: data.rejectionReason || null,
          comments: data.comments || null,
          metadataJson: data.metadataJson ? JSON.stringify(data.metadataJson) : null,

          fabrics: {
            create: [
              {
                fabricCode: data.fabricName ? data.fabricName.replace(/\s+/g, '-').toUpperCase().slice(0, 30) : 'FAB-001',
                fabricName: data.fabricName || 'Cotton Base',
                composition: data.fabricType || '100% Cotton',
                widthInInches: data.fabricWidthInches ? parseFloat(data.fabricWidthInches) : 58.0,
                gsm: 180.0,
                colour: data.fabricColor || 'Natural',
                shade: 'Standard',
                requiredQuantity: targetQty * (data.fabricAverage ? parseFloat(data.fabricAverage) : 1.2),
                tolerancePercentage: 5.0,
                wastagePercentage: 3.0,
              },
            ],
          },
          colours: {
            create: [
              {
                colorCode: data.fabricColor ? data.fabricColor.substring(0, 3).toUpperCase() : 'CLR',
                colorName: data.fabricColor || 'Natural',
                targetQuantity: targetQty,
              },
            ],
          },
          sizes: {
            create: [
              {
                size: 'FREE',
                targetQuantity: targetQty,
              },
            ],
          },
        },
        include: {
          fabrics: true,
          colours: true,
          sizes: true,
          createdBy: { select: { id: true, username: true, fullName: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'PRODUCTION_SHEET_CREATED',
          entity: 'Program',
          entityId: created.id,
          afterState: JSON.stringify({
            programNumber: created.programNumber,
            programSerialNo: created.programSerialNo,
            clientName: created.clientName,
            status: created.status,
          }),
        },
      });

      return created;
    }, { maxWait: 15000, timeout: 60000 });

    return program;
  }

  async updateProductionSheet(id: string, data: any, actorId: string) {
    const existing = await this.findOne(id);
    if (existing.status === ProgramStatus.ISSUED) {
      throw new BadRequestException('Production Sheet has already been ISSUED and cannot be silently edited. Please contact administrator.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updateData: any = {};
      const fields = [
        'programSerialNo', 'clientName', 'clientPriority', 'mainStyle', 'subStyle',
        'pattern', 'baseDesignType', 'baseDesignPhoto', 'wilcomDesignNumber',
        'wilcomDesignPhoto', 'embroideryDesign', 'embroideryDesignSize', 'fabricName',
        'fabricType', 'fabricWidth', 'fabricColor', 'fabricColorAvailable',
        'fabricAverageType', 'fabricAverageMeasurement', 'fabricDyeingRequired',
        'quantityMeasurement', 'specialMaterial', 'specialMaterialQuantity',
        'rejectionReason', 'comments', 'status'
      ];

      for (const f of fields) {
        if (data[f] !== undefined) updateData[f] = data[f];
      }

      if (data.clientName) updateData.buyerName = data.clientName;
      if (data.clientPriority) updateData.priority = data.clientPriority;
      if (data.mainStyle) updateData.styleCode = data.mainStyle;
      if (data.embroideryDesign) updateData.designName = data.embroideryDesign;
      if (data.fabricWidthInches !== undefined) updateData.fabricWidthInches = parseFloat(data.fabricWidthInches);
      if (data.fabricAverage !== undefined) updateData.fabricAverage = parseFloat(data.fabricAverage);
      if (data.fabricIssuedToDyeing !== undefined) updateData.fabricIssuedToDyeing = parseFloat(data.fabricIssuedToDyeing);
      if (data.fabricSentToDyeing !== undefined) updateData.fabricSentToDyeing = parseFloat(data.fabricSentToDyeing);
      if (data.colorQuantity !== undefined) updateData.colorQuantity = parseInt(data.colorQuantity, 10);
      if (data.targetQuantity !== undefined) updateData.targetQuantity = parseInt(data.targetQuantity, 10);
      if (data.piecesRejection !== undefined) updateData.piecesRejection = parseInt(data.piecesRejection, 10);
      if (data.deliveryDate) updateData.deliveryDate = new Date(data.deliveryDate);
      if (data.startDate) updateData.startDate = new Date(data.startDate);
      if (data.productionDesignDate) updateData.productionDesignDate = new Date(data.productionDesignDate);
      if (data.productionEndDate) updateData.productionEndDate = new Date(data.productionEndDate);
      if (data.metadataJson) updateData.metadataJson = JSON.stringify(data.metadataJson);

      const res = await tx.program.update({
        where: { id },
        data: updateData,
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'PRODUCTION_SHEET_UPDATED',
          entity: 'Program',
          entityId: id,
          afterState: JSON.stringify(updateData),
        },
      });

      return res;
    }, { maxWait: 15000, timeout: 60000 });

    return updated;
  }
}
