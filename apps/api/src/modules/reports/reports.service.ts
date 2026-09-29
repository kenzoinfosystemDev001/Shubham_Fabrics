import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private jsonToCsv(items: any[]): string {
    if (!items || items.length === 0) return '';
    const headers = Object.keys(items[0]);
    const csvRows = [headers.join(',')];

    for (const row of items) {
      const values = headers.map((header) => {
        let val = row[header];
        if (val === null || val === undefined) val = '';
        if (typeof val === 'object') val = JSON.stringify(val);
        const escaped = String(val).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\r\n');
  }

  async exportReport(reportType: string, format = 'csv') {
    let data: any[] = [];

    switch (reportType.toLowerCase()) {
      case 'production': {
        const rows = await this.prisma.productionTransaction.findMany({
          include: { program: true, challan: true, operator: true },
          orderBy: { recordedAt: 'desc' },
          take: 500,
        });
        data = rows.map((r) => ({
          TransactionId: r.id,
          Date: r.recordedAt.toISOString(),
          ProgramNumber: r.program?.programNumber,
          ChallanNumber: r.challan?.challanNumber,
          Department: r.departmentCode,
          Operation: r.operationName,
          InputQty: r.inputQuantity,
          GoodQty: r.goodQuantity,
          ReworkQty: r.reworkQuantity,
          RejectQty: r.rejectQuantity,
          WasteQty: r.wasteQuantity,
          BalanceQty: r.balanceQuantity,
          Operator: r.operator?.fullName,
        }));
        break;
      }

      case 'programs': {
        const rows = await this.prisma.program.findMany({
          include: { customer: true },
          orderBy: { createdAt: 'desc' },
        });
        data = rows.map((p) => ({
          ProgramId: p.id,
          ProgramNumber: p.programNumber,
          DesignName: p.designName,
          Customer: p.customer?.name || p.buyerName,
          TargetQuantity: p.targetQuantity,
          Status: p.status,
          DeliveryDate: p.deliveryDate?.toISOString(),
          CreatedAt: p.createdAt.toISOString(),
        }));
        break;
      }

      case 'stock-ledger': {
        const rows = await this.prisma.stockLedgerEntry.findMany({
          orderBy: { createdAt: 'desc' },
          take: 500,
        });
        data = rows.map((e) => ({
          EntryId: e.id,
          Date: e.createdAt.toISOString(),
          EntryType: e.entryType,
          Department: e.departmentCode,
          ItemCode: e.itemCode,
          ItemName: e.itemName,
          Lot: e.lotNumber || '',
          Roll: e.rollNumber || '',
          Quantity: e.quantity,
          BalanceAfter: e.balanceAfter,
          UOM: e.uom,
          ReferenceType: e.referenceType,
        }));
        break;
      }

      case 'quality': {
        const rows = await this.prisma.qualityInspection.findMany({
          include: { challan: true, inspector: true, parameters: true },
          orderBy: { inspectedAt: 'desc' },
        });
        data = rows.map((q) => ({
          InspectionId: q.id,
          Date: q.inspectedAt.toISOString(),
          ProgramId: q.programId,
          ChallanNumber: q.challan?.challanNumber,
          Department: q.departmentCode,
          Status: q.status,
          SampleSize: q.sampleSize,
          Inspector: q.inspector?.fullName,
        }));
        break;
      }

      case 'defects': {
        const rows = await this.prisma.defectRecord.findMany({
          include: { program: true, bundle: true, detectedBy: true },
          orderBy: { createdAt: 'desc' },
        });
        data = rows.map((d) => ({
          DefectId: d.id,
          DefectCode: d.defectCode,
          Date: d.createdAt.toISOString(),
          Program: d.program.programNumber,
          Department: d.departmentCode,
          Bundle: d.bundle?.bundleNumber,
          Quantity: d.quantity,
          Severity: d.severity,
          Status: d.status,
          Reason: d.reason,
          DetectedBy: d.detectedBy?.fullName,
        }));
        break;
      }

      case 'dispatch': {
        const rows = await this.prisma.dispatchOrder.findMany({
          include: { customer: true },
          orderBy: { createdAt: 'desc' },
        });
        data = rows.map((d) => ({
          DispatchId: d.id,
          DispatchNumber: d.dispatchNumber,
          Date: d.dispatchedAt ? d.dispatchedAt.toISOString() : d.createdAt.toISOString(),
          Customer: d.customer?.name,
          Destination: d.destination,
          Transporter: d.transporterName,
          LRNumber: d.lrNumber,
          TotalCartons: d.totalCartons,
          TotalQuantity: d.totalQuantity,
          Status: d.status,
        }));
        break;
      }

      default:
        throw new BadRequestException(
          `Unknown report type: "${reportType}". Available types: production, programs, stock-ledger, quality, defects, dispatch.`,
        );
    }

    if (format === 'csv') {
      return {
        contentType: 'text/csv',
        filename: `${reportType}-report-${new Date().toISOString().split('T')[0]}.csv`,
        content: this.jsonToCsv(data),
      };
    }

    return {
      contentType: 'application/json',
      filename: `${reportType}-report-${new Date().toISOString().split('T')[0]}.json`,
      content: data,
    };
  }
}
