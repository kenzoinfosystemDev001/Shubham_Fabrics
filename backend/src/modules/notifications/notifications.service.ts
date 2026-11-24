import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getNotifications(isRead?: boolean, limit = 50) {
    return this.prisma.notification.findMany({
      where: isRead !== undefined ? { isRead } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async markAsRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead() {
    return this.prisma.notification.updateMany({
      where: { isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Scans live database conditions to automatically raise operational alerts
   */
  async scanAndGenerateAlerts() {
    const [
      pendingChallans,
      failedInspections,
      openDefects,
      overduePrograms,
    ] = await Promise.all([
      this.prisma.challan.findMany({
        where: { status: { in: ['SUBMITTED', 'ISSUED'] } },
        include: { program: true, items: true },
      }),
      this.prisma.qualityInspection.findMany({
        where: { status: 'FAILED' },
        include: { challan: true },
      }),
      this.prisma.defectRecord.findMany({
        where: { status: 'OPEN' },
        include: { program: true },
      }),
      this.prisma.program.findMany({
        where: {
          status: 'IN_PRODUCTION',
          deliveryDate: { lte: new Date(Date.now() + 3 * 24 * 3600 * 1000) },
        },
      }),
    ]);

    const generatedAlerts: any[] = [];

    // 1. Pending Challans
    for (const c of pendingChallans) {
      const qty = c.items.reduce((s, i) => s + i.quantity, 0);
      const alert = await this.prisma.notification.create({
        data: {
          title: `Challan Handoff Pending: ${c.challanNumber}`,
          message: `Challan ${c.challanNumber} (${qty} units) awaiting receipt in ${c.toDepartment}.`,
          category: 'CHALLAN_PENDING',
          severity: 'WARNING',
          entityType: 'CHALLAN',
          entityId: c.id,
        },
      });
      generatedAlerts.push(alert);
    }

    // 2. Failed QC Inspections
    for (const qc of failedInspections) {
      const alert = await this.prisma.notification.create({
        data: {
          title: `QC Inspection Failed: ${qc.id.substring(0, 8)}`,
          message: `Inspection on Challan ${qc.challan?.challanNumber || qc.challanId} failed quality standards. Production hold placed.`,
          category: 'QC_FAILED',
          severity: 'CRITICAL',
          entityType: 'INSPECTION',
          entityId: qc.id,
        },
      });
      generatedAlerts.push(alert);
    }

    // 3. Open Defects
    for (const d of openDefects) {
      const alert = await this.prisma.notification.create({
        data: {
          title: `Defect Detected: ${d.defectCode}`,
          message: `${d.quantity} units logged with ${d.reason} in ${d.departmentCode}. Rework required.`,
          category: 'REWORK_PENDING',
          severity: d.severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
          entityType: 'DEFECT',
          entityId: d.id,
        },
      });
      generatedAlerts.push(alert);
    }

    // 4. Overdue or Imminent Programs
    for (const p of overduePrograms) {
      const alert = await this.prisma.notification.create({
        data: {
          title: `Delivery Risk: Program ${p.programNumber}`,
          message: `Target delivery date is ${p.deliveryDate?.toISOString().split('T')[0]}. Immediate attention required.`,
          category: 'PROGRAM_RISK',
          severity: 'CRITICAL',
          entityType: 'PROGRAM',
          entityId: p.id,
        },
      });
      generatedAlerts.push(alert);
    }

    return {
      message: `Diagnostic scan complete. ${generatedAlerts.length} operational alerts recorded.`,
      alertsCount: generatedAlerts.length,
      alerts: generatedAlerts,
    };
  }
}
