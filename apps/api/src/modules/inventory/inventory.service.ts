import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateStockLedgerEntryInput, RegisterFabricRollInput } from '@subham/validation';
import { StockLedgerEntryType, DepartmentCode, FabricRollStatus } from '@subham/types';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Core Ledger Transaction:
   * Every stock mutation (RECEIPT, ISSUE, RETURN, CONSUMPTION, ADJUSTMENT)
   * must pass through this method. Directly manipulating stock is prohibited.
   */
  async recordLedgerEntry(data: CreateStockLedgerEntryInput, actorId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        // 1. Compute current stock balance for the department and item
        const lastEntry = await tx.stockLedgerEntry.findFirst({
          where: {
            departmentCode: data.departmentCode,
            itemCode: data.itemCode,
          },
          orderBy: { createdAt: 'desc' },
        });

        const currentBalance = lastEntry ? lastEntry.balanceAfter : 0;
        const newBalance = currentBalance + data.quantity;

        // 2. Strict Invariant: Prevent negative stock
        if (newBalance < 0) {
          throw new BadRequestException(
            `Negative stock violation! Department '${data.departmentCode}' currently has ${currentBalance} ${data.uom} of '${data.itemCode}'. Requested deduction of ${Math.abs(data.quantity)} ${data.uom} results in ${newBalance} ${data.uom}.`,
          );
        }

        // 3. Create the immutable ledger record
        const createdEntry = await tx.stockLedgerEntry.create({
          data: {
            entryType: data.entryType,
            departmentCode: data.departmentCode,
            itemCode: data.itemCode,
            itemName: data.itemName,
            batchNumber: data.batchNumber || null,
            lotNumber: data.lotNumber || null,
            rollNumber: data.rollNumber || null,
            colour: data.colour || null,
            shade: data.shade || null,
            location: data.location || null,
            quantity: data.quantity,
            weightKg: data.weightKg || null,
            uom: data.uom,
            referenceType: data.referenceType,
            referenceId: data.referenceId || null,
            programId: data.programId || null,
            actorId,
            balanceAfter: newBalance,
            notes: data.notes || null,
          },
        });

        // 4. Update the quick-lookup aggregate inventory stock cache
        await tx.inventoryStock.upsert({
          where: {
            departmentCode_identifier: {
              departmentCode: data.departmentCode,
              identifier: data.rollNumber || data.itemCode,
            },
          },
          create: {
            departmentCode: data.departmentCode,
            itemType: data.itemCode.startsWith('FAB-') ? 'FABRIC' : 'TRIM',
            identifier: data.rollNumber || data.itemCode,
            description: `${data.itemName} (${data.colour || 'STD'})`,
            currentQuantity: newBalance,
            uom: data.uom,
            programId: data.programId || null,
            lastChallanId: data.referenceType === 'CHALLAN' ? data.referenceId : null,
          },
          update: {
            currentQuantity: newBalance,
            lastChallanId: data.referenceType === 'CHALLAN' ? data.referenceId : undefined,
          },
        });

        // 5. Append-only audit record
        await tx.auditLog.create({
          data: {
            actorId,
            action: `STOCK_${data.entryType}`,
            entity: 'StockLedgerEntry',
            entityId: createdEntry.id,
            afterState: JSON.stringify({
              itemCode: data.itemCode,
              department: data.departmentCode,
              delta: data.quantity,
              balanceAfter: newBalance,
              referenceType: data.referenceType,
              referenceId: data.referenceId,
            }),
          },
        });

        return createdEntry;
      },
      { maxWait: 15000, timeout: 60000 },
    );
  }

  /**
   * Register Fabric Roll in Store upon supplier delivery / inward challan
   */
  async registerFabricRoll(data: RegisterFabricRollInput, actorId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.fabricRoll.findUnique({
          where: { rollNumber: data.rollNumber },
        });
        if (existing) {
          throw new BadRequestException(`Fabric roll '${data.rollNumber}' already exists in registry.`);
        }

        const roll = await tx.fabricRoll.create({
          data: {
            rollNumber: data.rollNumber,
            lotNumber: data.lotNumber || null,
            fabricCode: data.fabricCode,
            fabricName: data.fabricName,
            colour: data.colour,
            shade: data.shade || null,
            initialLengthMtr: data.initialLengthMtr,
            currentLengthMtr: data.initialLengthMtr,
            initialWeightKg: data.initialWeightKg,
            currentWeightKg: data.initialWeightKg,
            status: FabricRollStatus.RECEIVED,
            location: data.location || 'STORE-RACK-01',
            programId: data.programId || null,
            supplierId: data.supplierId || null,
          },
        });

        // Inward into Store ledger
        const lastEntry = await tx.stockLedgerEntry.findFirst({
          where: {
            departmentCode: DepartmentCode.STORE,
            itemCode: data.fabricCode,
          },
          orderBy: { createdAt: 'desc' },
        });

        const balanceAfter = (lastEntry ? lastEntry.balanceAfter : 0) + data.initialLengthMtr;

        await tx.stockLedgerEntry.create({
          data: {
            entryType: StockLedgerEntryType.RECEIPT,
            departmentCode: DepartmentCode.STORE,
            itemCode: data.fabricCode,
            itemName: data.fabricName,
            lotNumber: data.lotNumber || null,
            rollNumber: data.rollNumber,
            colour: data.colour,
            shade: data.shade || null,
            location: data.location || 'STORE-RACK-01',
            quantity: data.initialLengthMtr,
            weightKg: data.initialWeightKg,
            uom: 'MTR',
            referenceType: 'INITIAL',
            programId: data.programId || null,
            actorId,
            balanceAfter,
            notes: `Inward roll ${data.rollNumber}`,
          },
        });

        return roll;
      },
      { maxWait: 15000, timeout: 60000 },
    );
  }

  /**
   * Issue Fabric Roll from Store to Production Department (e.g. DYEING or CUTTING)
   */
  async issueFabricRoll(
    rollNumber: string,
    targetDepartment: DepartmentCode,
    challanId: string,
    actorId: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const roll = await tx.fabricRoll.findUnique({
          where: { rollNumber },
        });
        if (!roll) {
          throw new NotFoundException(`Fabric roll '${rollNumber}' not found.`);
        }
        if (roll.status === FabricRollStatus.ISSUED || roll.status === FabricRollStatus.DEPLETED) {
          throw new BadRequestException(
            `Fabric roll '${rollNumber}' cannot be issued. Current status: ${roll.status}`,
          );
        }

        // Deduct from Store
        const lastStoreEntry = await tx.stockLedgerEntry.findFirst({
          where: { departmentCode: DepartmentCode.STORE, itemCode: roll.fabricCode },
          orderBy: { createdAt: 'desc' },
        });
        const storeBalance = lastStoreEntry ? lastStoreEntry.balanceAfter : 0;
        if (storeBalance < roll.currentLengthMtr) {
          throw new BadRequestException(
            `Insufficient Store stock for roll issue. Available: ${storeBalance} MTR, Required: ${roll.currentLengthMtr} MTR.`,
          );
        }

        await tx.stockLedgerEntry.create({
          data: {
            entryType: StockLedgerEntryType.ISSUE,
            departmentCode: DepartmentCode.STORE,
            itemCode: roll.fabricCode,
            itemName: roll.fabricName,
            rollNumber: roll.rollNumber,
            quantity: -roll.currentLengthMtr,
            weightKg: roll.currentWeightKg,
            uom: 'MTR',
            referenceType: 'CHALLAN',
            referenceId: challanId,
            programId: roll.programId,
            actorId,
            balanceAfter: storeBalance - roll.currentLengthMtr,
            notes: `Issued to ${targetDepartment}`,
          },
        });

        // Add to Destination Department
        const lastDestEntry = await tx.stockLedgerEntry.findFirst({
          where: { departmentCode: targetDepartment, itemCode: roll.fabricCode },
          orderBy: { createdAt: 'desc' },
        });
        const destBalance = (lastDestEntry ? lastDestEntry.balanceAfter : 0) + roll.currentLengthMtr;

        await tx.stockLedgerEntry.create({
          data: {
            entryType: StockLedgerEntryType.RECEIPT,
            departmentCode: targetDepartment,
            itemCode: roll.fabricCode,
            itemName: roll.fabricName,
            rollNumber: roll.rollNumber,
            quantity: roll.currentLengthMtr,
            weightKg: roll.currentWeightKg,
            uom: 'MTR',
            referenceType: 'CHALLAN',
            referenceId: challanId,
            programId: roll.programId,
            actorId,
            balanceAfter: destBalance,
            notes: `Received from STORE`,
          },
        });

        // Update roll status
        return tx.fabricRoll.update({
          where: { id: roll.id },
          data: {
            status: FabricRollStatus.ISSUED,
            location: targetDepartment,
          },
        });
      },
      { maxWait: 15000, timeout: 60000 },
    );
  }

  async getLedgerEntries(params?: {
    departmentCode?: string;
    itemCode?: string;
    programId?: string;
    rollNumber?: string;
    limit?: number;
  }) {
    const where: any = {};
    if (params?.departmentCode) where.departmentCode = params.departmentCode;
    if (params?.itemCode) where.itemCode = params.itemCode;
    if (params?.programId) where.programId = params.programId;
    if (params?.rollNumber) where.rollNumber = params.rollNumber;

    return this.prisma.stockLedgerEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params?.limit || 100,
      include: {
        actor: { select: { username: true, fullName: true } },
      },
    });
  }

  async getStockSummary(departmentCode?: string) {
    const where: any = {};
    if (departmentCode) where.departmentCode = departmentCode;

    return this.prisma.inventoryStock.findMany({
      where,
      orderBy: [{ departmentCode: 'asc' }, { itemType: 'asc' }],
    });
  }

  async getFabricRolls(params?: { programId?: string; status?: string }) {
    const where: any = {};
    if (params?.programId) where.programId = params.programId;
    if (params?.status) where.status = params.status;

    return this.prisma.fabricRoll.findMany({
      where,
      orderBy: { rollNumber: 'asc' },
      include: {
        program: { select: { programNumber: true, buyerName: true, styleCode: true } },
      },
    });
  }
}
