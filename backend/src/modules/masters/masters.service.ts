import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class MastersService {
  constructor(private readonly prisma: PrismaService) {}

  // Helper for audit logging
  private async logAudit(actorId: string, action: string, entity: string, entityId: string, before?: any, after?: any) {
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action,
        entity,
        entityId,
        beforeState: before ? JSON.stringify(before) : null,
        afterState: after ? JSON.stringify(after) : null,
      },
    });
  }

  // ==========================================
  // 1. SUPPLIERS
  // ==========================================
  async getSuppliers(params?: { search?: string; isActive?: boolean }) {
    const where: any = {};
    if (params?.isActive !== undefined) where.isActive = params.isActive;
    if (params?.search) {
      where.OR = [
        { code: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
        { contactPerson: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.supplier.findMany({ where, orderBy: { name: 'asc' } });
  }

  async createSupplier(data: any, actorId: string) {
    const existing = await this.prisma.supplier.findUnique({ where: { code: data.code } });
    if (existing) throw new BadRequestException(`Supplier code '${data.code}' already exists`);

    const created = await this.prisma.supplier.create({ data });
    await this.logAudit(actorId, 'MASTER_CREATED', 'Supplier', created.id, null, created);
    return created;
  }

  async updateSupplier(id: string, data: any, actorId: string) {
    const existing = await this.prisma.supplier.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Supplier '${id}' not found`);

    const updated = await this.prisma.supplier.update({ where: { id }, data });
    await this.logAudit(actorId, 'MASTER_UPDATED', 'Supplier', id, existing, updated);
    return updated;
  }

  // ==========================================
  // 2. CUSTOMERS
  // ==========================================
  async getCustomers(params?: { search?: string; isActive?: boolean }) {
    const where: any = {};
    if (params?.isActive !== undefined) where.isActive = params.isActive;
    if (params?.search) {
      where.OR = [
        { code: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.customer.findMany({ where, orderBy: { name: 'asc' } });
  }

  async createCustomer(data: any, actorId: string) {
    const existing = await this.prisma.customer.findUnique({ where: { code: data.code } });
    if (existing) throw new BadRequestException(`Customer code '${data.code}' already exists`);

    const created = await this.prisma.customer.create({ data });
    await this.logAudit(actorId, 'MASTER_CREATED', 'Customer', created.id, null, created);
    return created;
  }

  async updateCustomer(id: string, data: any, actorId: string) {
    const existing = await this.prisma.customer.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Customer '${id}' not found`);

    const updated = await this.prisma.customer.update({ where: { id }, data });
    await this.logAudit(actorId, 'MASTER_UPDATED', 'Customer', id, existing, updated);
    return updated;
  }

  // ==========================================
  // 3. FABRICS
  // ==========================================
  async getFabrics(params?: { search?: string; isActive?: boolean }) {
    const where: any = {};
    if (params?.isActive !== undefined) where.isActive = params.isActive;
    if (params?.search) {
      where.OR = [
        { code: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
        { fabricType: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.fabric.findMany({
      where,
      include: { supplier: { select: { code: true, name: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createFabric(data: any, actorId: string) {
    const existing = await this.prisma.fabric.findUnique({ where: { code: data.code } });
    if (existing) throw new BadRequestException(`Fabric code '${data.code}' already exists`);

    const created = await this.prisma.fabric.create({ data });
    await this.logAudit(actorId, 'MASTER_CREATED', 'Fabric', created.id, null, created);
    return created;
  }

  async updateFabric(id: string, data: any, actorId: string) {
    const existing = await this.prisma.fabric.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Fabric '${id}' not found`);

    const updated = await this.prisma.fabric.update({ where: { id }, data });
    await this.logAudit(actorId, 'MASTER_UPDATED', 'Fabric', id, existing, updated);
    return updated;
  }

  // ==========================================
  // 4. TRIMS
  // ==========================================
  async getTrims(params?: { category?: string; search?: string }) {
    const where: any = {};
    if (params?.category) where.trimCategory = params.category;
    if (params?.search) {
      where.OR = [
        { code: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.trim.findMany({
      where,
      include: { supplier: { select: { code: true, name: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createTrim(data: any, actorId: string) {
    const existing = await this.prisma.trim.findUnique({ where: { code: data.code } });
    if (existing) throw new BadRequestException(`Trim code '${data.code}' already exists`);

    const created = await this.prisma.trim.create({ data });
    await this.logAudit(actorId, 'MASTER_CREATED', 'Trim', created.id, null, created);
    return created;
  }

  // ==========================================
  // 5. DESIGNS
  // ==========================================
  async getDesigns(params?: { search?: string }) {
    const where: any = {};
    if (params?.search) {
      where.OR = [
        { code: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
        { patternNumber: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.design.findMany({
      where,
      include: { customer: { select: { code: true, name: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createDesign(data: any, actorId: string) {
    const existing = await this.prisma.design.findUnique({ where: { code: data.code } });
    if (existing) throw new BadRequestException(`Design code '${data.code}' already exists`);

    const created = await this.prisma.design.create({ data });
    await this.logAudit(actorId, 'MASTER_CREATED', 'Design', created.id, null, created);
    return created;
  }

  // ==========================================
  // 6. COLOURS & SIZES
  // ==========================================
  async getColours() {
    return this.prisma.colour.findMany({ orderBy: { name: 'asc' } });
  }

  async createColour(data: any, actorId: string) {
    const existing = await this.prisma.colour.findUnique({ where: { code: data.code } });
    if (existing) throw new BadRequestException(`Colour code '${data.code}' already exists`);

    const created = await this.prisma.colour.create({ data });
    await this.logAudit(actorId, 'MASTER_CREATED', 'Colour', created.id, null, created);
    return created;
  }

  async getSizes() {
    return this.prisma.size.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async createSize(data: any, actorId: string) {
    const existing = await this.prisma.size.findUnique({ where: { code: data.code } });
    if (existing) throw new BadRequestException(`Size code '${data.code}' already exists`);

    const created = await this.prisma.size.create({ data });
    await this.logAudit(actorId, 'MASTER_CREATED', 'Size', created.id, null, created);
    return created;
  }

  // ==========================================
  // 7. DEPARTMENTS, WORK CENTERS & MACHINES
  // ==========================================
  async getDepartments() {
    return this.prisma.department.findMany({
      include: { workCenters: { include: { machines: true } } },
      orderBy: { sequenceOrder: 'asc' },
    });
  }

  async createDepartment(data: any, actorId: string) {
    const existing = await this.prisma.department.findUnique({ where: { code: data.code } });
    if (existing) throw new BadRequestException(`Department code '${data.code}' already exists`);

    const created = await this.prisma.department.create({ data });
    await this.logAudit(actorId, 'MASTER_CREATED', 'Department', created.id, null, created);
    return created;
  }

  async getWorkCenters() {
    return this.prisma.workCenter.findMany({
      include: { department: true, machines: true },
      orderBy: { code: 'asc' },
    });
  }

  async createWorkCenter(data: any, actorId: string) {
    const existing = await this.prisma.workCenter.findUnique({ where: { code: data.code } });
    if (existing) throw new BadRequestException(`WorkCenter code '${data.code}' already exists`);

    const created = await this.prisma.workCenter.create({ data });
    await this.logAudit(actorId, 'MASTER_CREATED', 'WorkCenter', created.id, null, created);
    return created;
  }

  async getMachines() {
    return this.prisma.machine.findMany({
      include: { workCenter: { include: { department: true } } },
      orderBy: { code: 'asc' },
    });
  }

  async createMachine(data: any, actorId: string) {
    const existing = await this.prisma.machine.findUnique({ where: { code: data.code } });
    if (existing) throw new BadRequestException(`Machine code '${data.code}' already exists`);

    const created = await this.prisma.machine.create({ data });
    await this.logAudit(actorId, 'MASTER_CREATED', 'Machine', created.id, null, created);
    return created;
  }

  async getShifts() {
    return this.prisma.shift.findMany({ orderBy: { code: 'asc' } });
  }

  // ==========================================
  // 8. OPERATIONS & DEFECT CODES
  // ==========================================
  async getOperations() {
    return this.prisma.operation.findMany({
      include: { department: true },
      orderBy: { code: 'asc' },
    });
  }

  async createOperation(data: any, actorId: string) {
    const existing = await this.prisma.operation.findUnique({ where: { code: data.code } });
    if (existing) throw new BadRequestException(`Operation code '${data.code}' already exists`);

    const created = await this.prisma.operation.create({ data });
    await this.logAudit(actorId, 'MASTER_CREATED', 'Operation', created.id, null, created);
    return created;
  }

  async getDefectCodes() {
    return this.prisma.defectCode.findMany({
      include: { department: true },
      orderBy: { category: 'asc' },
    });
  }

  async createDefectCode(data: any, actorId: string) {
    const existing = await this.prisma.defectCode.findUnique({ where: { code: data.code } });
    if (existing) throw new BadRequestException(`Defect code '${data.code}' already exists`);

    const created = await this.prisma.defectCode.create({ data });
    await this.logAudit(actorId, 'MASTER_CREATED', 'DefectCode', created.id, null, created);
    return created;
  }

  // ==========================================
  // 9. ROLES & PERMISSIONS
  // ==========================================
  async getRoles() {
    return this.prisma.role.findMany({
      include: {
        rolePerms: { include: { permission: true } },
        _count: { select: { userRoles: true } },
      },
      orderBy: { code: 'asc' },
    });
  }

  async getPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { resource: 'asc' }, { action: 'asc' }],
    });
  }

  async assignUserRole(userId: string, roleId: string, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');

    const assignment = await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: {},
      create: { userId, roleId },
    });

    await this.logAudit(actorId, 'USER_ROLE_ASSIGNED', 'UserRole', assignment.id, null, {
      username: user.username,
      role: role.code,
    });

    return assignment;
  }
}
