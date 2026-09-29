import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateDispatchOrderInput } from '@subham/validation';
import { DispatchStatus, CartonStatus, DepartmentCode, StockLedgerEntryType } from '@subham/types';

@Injectable()
export class DispatchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates an approved dispatch order and consumes Finished Goods inventory from the ledger.
   */
  async createDispatchOrder(data: CreateDispatchOrderInput, actorId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.dispatchOrder.findUnique({
          where: { dispatchNumber: data.dispatchNumber },
        });
        if (existing) {
          throw new BadRequestException(`Dispatch order '${data.dispatchNumber}' already exists.`);
        }

        // 1. Fetch and validate cartons
        const cartons = await tx.carton.findMany({
          where: { id: { in: data.cartonIds } },
          include: { program: true },
        });

        if (cartons.length !== data.cartonIds.length) {
          throw new NotFoundException('One or more cartons specified in dispatch order not found.');
        }

        // Validate that every carton is available in FG store
        for (const c of cartons) {
          if (c.status === CartonStatus.DISPATCHED) {
            throw new BadRequestException(
              `Carton '${c.cartonNumber}' has already been dispatched! Double-dispatch prevented.`,
            );
          }
        }

        const totalCartons = cartons.length;
        const totalQuantity = cartons.reduce((sum, c) => sum + c.quantity, 0);
        const totalWeightKg = cartons.reduce((sum, c) => sum + (c.grossWeightKg || 0), 0);

        // 2. Create Dispatch Order record
        const dispatch = await tx.dispatchOrder.create({
          data: {
            dispatchNumber: data.dispatchNumber,
            customerId: data.customerId || null,
            orderNumber: data.orderNumber,
            invoiceNumber: data.invoiceNumber || null,
            transporterName: data.transporterName,
            vehicleNumber: data.vehicleNumber,
            lrNumber: data.lrNumber || null,
            destination: data.destination,
            totalCartons,
            totalQuantity,
            totalWeightKg,
            status: DispatchStatus.DISPATCHED,
            approvedById: actorId,
            dispatchedById: actorId,
            dispatchedAt: new Date(),
            notes: data.notes || null,
            cartons: {
              create: cartons.map((c) => ({
                cartonId: c.id,
              })),
            },
          },
          include: {
            cartons: { include: { carton: true } },
            customer: true,
            approvedBy: { select: { username: true, fullName: true } },
            dispatchedBy: { select: { username: true, fullName: true } },
          },
        });

        // 3. Mark cartons as DISPATCHED
        for (const c of cartons) {
          await tx.carton.update({
            where: { id: c.id },
            data: { status: CartonStatus.DISPATCHED },
          });

          // 4. Consume from Finished Goods Stock Ledger
          const lastEntry = await tx.stockLedgerEntry.findFirst({
            where: {
              departmentCode: DepartmentCode.FINISHED_GOODS,
              itemCode: c.program.styleCode,
            },
            orderBy: { createdAt: 'desc' },
          });
          const currentFgBalance = lastEntry ? lastEntry.balanceAfter : 0;
          const newFgBalance = currentFgBalance - c.quantity;

          await tx.stockLedgerEntry.create({
            data: {
              entryType: StockLedgerEntryType.CONSUMPTION,
              departmentCode: DepartmentCode.FINISHED_GOODS,
              itemCode: c.program.styleCode,
              itemName: `${c.program.designName} (${c.size}/${c.colour})`,
              lotNumber: c.cartonNumber,
              colour: c.colour,
              location: `${c.locationRack || 'FG'}/${c.locationShelf || 'SHELF'}`,
              quantity: -c.quantity,
              weightKg: c.netWeightKg,
              uom: 'PCS',
              referenceType: 'DISPATCH',
              referenceId: dispatch.id,
              programId: c.programId,
              actorId,
              balanceAfter: newFgBalance,
              notes: `Dispatched to ${data.destination} via ${data.transporterName} (LR: ${data.lrNumber || 'N/A'})`,
            },
          });
        }

        // 5. Audit Log
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'DISPATCH_COMPLETED_AND_FG_CONSUMED',
            entity: 'DispatchOrder',
            entityId: dispatch.id,
            afterState: JSON.stringify({
              dispatchNumber: dispatch.dispatchNumber,
              cartonsCount: totalCartons,
              totalQuantity,
              transporter: dispatch.transporterName,
              vehicle: dispatch.vehicleNumber,
            }),
          },
        });

        return dispatch;
      },
      { maxWait: 15000, timeout: 60000 },
    );
  }

  async getDispatchOrders(params?: { status?: string; search?: string; limit?: number }) {
    const where: any = {};
    if (params?.status) where.status = params.status;
    if (params?.search) {
      where.OR = [
        { dispatchNumber: { contains: params.search, mode: 'insensitive' } },
        { orderNumber: { contains: params.search, mode: 'insensitive' } },
        { invoiceNumber: { contains: params.search, mode: 'insensitive' } },
        { transporterName: { contains: params.search, mode: 'insensitive' } },
        { vehicleNumber: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.dispatchOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params?.limit || 100,
      include: {
        customer: true,
        cartons: { include: { carton: true } },
        dispatchedBy: { select: { username: true, fullName: true } },
      },
    });
  }

  async getDispatchOrder(id: string) {
    const dispatch = await this.prisma.dispatchOrder.findFirst({
      where: {
        OR: [{ id }, { dispatchNumber: id }],
      },
      include: {
        customer: true,
        cartons: { include: { carton: { include: { program: true, bundles: { include: { bundle: true } } } } } },
        approvedBy: { select: { username: true, fullName: true } },
        dispatchedBy: { select: { username: true, fullName: true } },
      },
    });

    if (!dispatch) {
      throw new NotFoundException(`Dispatch order '${id}' not found`);
    }

    return dispatch;
  }
}
