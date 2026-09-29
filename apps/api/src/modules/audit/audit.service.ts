import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params?: {
    entity?: string;
    entityId?: string;
    actorId?: string;
    action?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};
    if (params?.entity) where.entity = params.entity;
    if (params?.entityId) where.entityId = params.entityId;
    if (params?.actorId) where.actorId = params.actorId;
    if (params?.action) where.action = params.action;

    const limit = Math.min(params?.limit || 50, 200);
    const offset = params?.offset || 0;

    const [total, records] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: {
          actor: { select: { id: true, username: true, fullName: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
    ]);

    return { total, limit, offset, records };
  }
}
