import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateCartonInput } from '@subham/validation';
import { CartonStatus, BundleStatus, DepartmentCode, StockLedgerEntryType } from '@subham/types';

@Injectable()
export class PackingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Pack garments from completed bundles into shipping cartons
   * and automatically inward into Finished Goods (FG) store ledger.
   */
  async packCarton(data: CreateCartonInput, actorId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.carton.findUnique({
          where: { cartonNumber: data.cartonNumber },
        });
        if (existing) {
          throw new BadRequestException(`Carton '${data.cartonNumber}' already exists.`);
        }

        const program = await tx.program.findUnique({
          where: { id: data.programId },
        });
        if (!program) {
          throw new NotFoundException(`Program '${data.programId}' not found.`);
        }

        const barcode = `BC-${data.cartonNumber}`;

        // 1. Create Carton record
        const carton = await tx.carton.create({
          data: {
            cartonNumber: data.cartonNumber,
            programId: data.programId,
            packingChallanId: data.packingChallanId || null,
            size: data.size,
            colour: data.colour,
            quantity: data.quantity,
            grossWeightKg: data.grossWeightKg || null,
            netWeightKg: data.netWeightKg || null,
            status: CartonStatus.IN_FG_STORE,
            locationRack: data.locationRack || 'FG-RACK-01',
            locationShelf: data.locationShelf || 'SHELF-A',
            barcode,
            bundles: {
              create: data.bundleIds.map((bId) => ({
                bundleId: bId,
                quantity: Math.floor(data.quantity / data.bundleIds.length),
              })),
            },
          },
          include: {
            bundles: { include: { bundle: true } },
            program: { select: { programNumber: true, buyerName: true, styleCode: true } },
          },
        });

        // 2. Mark bundles as PACKED
        for (const bId of data.bundleIds) {
          await tx.bundle.update({
            where: { id: bId },
            data: {
              status: BundleStatus.PACKED,
              currentDepartment: DepartmentCode.FINISHED_GOODS,
            },
          });
        }

        // 3. Inward to Finished Goods Stock Ledger
        const lastEntry = await tx.stockLedgerEntry.findFirst({
          where: {
            departmentCode: DepartmentCode.FINISHED_GOODS,
            itemCode: program.styleCode,
          },
          orderBy: { createdAt: 'desc' },
        });
        const currentFgBalance = lastEntry ? lastEntry.balanceAfter : 0;
        const newFgBalance = currentFgBalance + data.quantity;

        await tx.stockLedgerEntry.create({
          data: {
            entryType: StockLedgerEntryType.RECEIPT,
            departmentCode: DepartmentCode.FINISHED_GOODS,
            itemCode: program.styleCode,
            itemName: `${program.designName} (${data.size}/${data.colour})`,
            lotNumber: carton.cartonNumber,
            colour: data.colour,
            location: `${carton.locationRack}/${carton.locationShelf}`,
            quantity: data.quantity,
            weightKg: data.netWeightKg,
            uom: 'PCS',
            referenceType: 'CARTON',
            referenceId: carton.id,
            programId: program.id,
            actorId,
            balanceAfter: newFgBalance,
            notes: `Packed into carton ${carton.cartonNumber}`,
          },
        });

        // 4. Record Audit Log
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'CARTON_PACKED_AND_STORED_IN_FG',
            entity: 'Carton',
            entityId: carton.id,
            afterState: JSON.stringify({
              cartonNumber: carton.cartonNumber,
              quantity: carton.quantity,
              location: `${carton.locationRack}/${carton.locationShelf}`,
              bundlesCount: data.bundleIds.length,
            }),
          },
        });

        return carton;
      },
      { maxWait: 15000, timeout: 60000 },
    );
  }

  async getCartons(params?: {
    programId?: string;
    status?: string;
    size?: string;
    colour?: string;
    search?: string;
    limit?: number;
  }) {
    const where: any = {};
    if (params?.programId) where.programId = params.programId;
    if (params?.status) where.status = params.status;
    if (params?.size) where.size = params.size;
    if (params?.colour) where.colour = params.colour;
    if (params?.search) {
      where.OR = [
        { cartonNumber: { contains: params.search, mode: 'insensitive' } },
        { barcode: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.carton.findMany({
      where,
      orderBy: { cartonNumber: 'asc' },
      take: params?.limit || 200,
      include: {
        program: { select: { programNumber: true, buyerName: true, styleCode: true, designName: true } },
        bundles: { include: { bundle: true } },
      },
    });
  }

  async getCarton(id: string) {
    const carton = await this.prisma.carton.findFirst({
      where: {
        OR: [{ id }, { cartonNumber: id }, { barcode: id }],
      },
      include: {
        program: true,
        bundles: { include: { bundle: true } },
        dispatchCartons: { include: { dispatch: true } },
      },
    });

    if (!carton) {
      throw new NotFoundException(`Carton '${id}' not found`);
    }

    return carton;
  }
}
