import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

const INCOMING_STATUSES = ['ISSUED', 'SUBMITTED'];
const WIP_STATUSES = ['RECEIVED', 'IN_PROCESS', 'REWORK'];
const COMPLETED_STATUSES = ['COMPLETED', 'HANDED_OVER', 'CLOSED'];

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    // One grouped query per metric instead of four queries per department.
    const [departments, challanCounts, users] = await Promise.all([
      this.prisma.department.findMany({ orderBy: { sequenceOrder: 'asc' } }),
      this.prisma.challan.groupBy({
        by: ['toDepartment', 'status'],
        where: { status: { in: [...INCOMING_STATUSES, ...WIP_STATUSES, ...COMPLETED_STATUSES] } },
        _count: { _all: true },
      }),
      this.prisma.user.findMany({
        where: { isActive: true, departmentCode: { not: null } },
        select: {
          id: true,
          username: true,
          fullName: true,
          departmentCode: true,
          userRoles: { include: { role: true } },
        },
      }),
    ]);

    // Counts are keyed by the receiving department: it is the one that holds the work and completes it.
    const countFor = (dept: string, statuses: string[]) =>
      challanCounts
        .filter((c) => c.toDepartment === dept && statuses.includes(c.status))
        .reduce((sum, c) => sum + c._count._all, 0);

    return departments.map((dept) => ({
      ...dept,
      incomingCount: countFor(dept.code, INCOMING_STATUSES),
      wipCount: countFor(dept.code, WIP_STATUSES),
      completedCount: countFor(dept.code, COMPLETED_STATUSES),
      assignedUsers: users
        .filter((u) => u.departmentCode === dept.code)
        .map((u) => ({
          id: u.id,
          username: u.username,
          fullName: u.fullName,
          role: u.userRoles?.[0]?.role?.code || 'USER',
        })),
    }));
  }
}
