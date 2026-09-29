import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const departments = await this.prisma.department.findMany({
      orderBy: { sequenceOrder: 'asc' },
    });

    // Compute live metrics for each department
    const metrics = await Promise.all(
      departments.map(async (dept) => {
        const [incomingCount, wipCount, completedCount, assignedUsers] = await Promise.all([
          this.prisma.challan.count({
            where: {
              toDepartment: dept.code,
              status: { in: ['ISSUED', 'SUBMITTED'] },
            },
          }),
          this.prisma.challan.count({
            where: {
              toDepartment: dept.code,
              status: { in: ['RECEIVED', 'IN_PROCESS', 'REWORK'] },
            },
          }),
          this.prisma.challan.count({
            where: {
              fromDepartment: dept.code,
              status: { in: ['COMPLETED', 'HANDED_OVER', 'CLOSED'] },
            },
          }),
          this.prisma.user.findMany({
            where: { departmentCode: dept.code, isActive: true },
            select: {
              id: true,
              username: true,
              fullName: true,
              userRoles: { include: { role: true } },
            },
          }),
        ]);

        return {
          ...dept,
          incomingCount,
          wipCount,
          completedCount,
          assignedUsers: assignedUsers.map((u) => ({
            id: u.id,
            username: u.username,
            fullName: u.fullName,
            role: u.userRoles?.[0]?.role?.code || 'USER',
          })),
        };
      }),
    );

    return metrics;
  }
}
