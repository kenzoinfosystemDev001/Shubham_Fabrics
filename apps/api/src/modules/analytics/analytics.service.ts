import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Production Analytics: Throughput, efficiency, cycle time, department breakdown
   */
  async getProductionAnalytics(startDate?: Date, endDate?: Date) {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    const [productions, programs] = await Promise.all([
      this.prisma.productionTransaction.findMany({
        where: { recordedAt: { gte: start, lte: end } },
        include: { program: true, operator: true },
        orderBy: { recordedAt: 'asc' },
      }),
      this.prisma.program.findMany({
        where: { status: { in: ['IN_PRODUCTION', 'COMPLETED', 'APPROVED'] } },
      }),
    ]);

    let totalInput = 0;
    let totalGood = 0;
    let totalRework = 0;
    let totalReject = 0;
    let totalWaste = 0;

    const departmentOutput: Record<string, { good: number; reject: number; waste: number }> = {};
    const dailyOutput: Record<string, number> = {};
    const operatorOutput: Record<string, { name: string; pieces: number }> = {};

    for (const p of productions) {
      totalInput += p.inputQuantity;
      totalGood += p.goodQuantity;
      totalRework += p.reworkQuantity;
      totalReject += p.rejectQuantity;
      totalWaste += p.wasteQuantity;

      // By Department
      const dept = p.departmentCode || 'UNKNOWN';
      if (!departmentOutput[dept]) {
        departmentOutput[dept] = { good: 0, reject: 0, waste: 0 };
      }
      departmentOutput[dept].good += p.goodQuantity;
      departmentOutput[dept].reject += p.rejectQuantity;
      departmentOutput[dept].waste += p.wasteQuantity;

      // By Day
      const dayKey = p.recordedAt.toISOString().split('T')[0];
      dailyOutput[dayKey] = (dailyOutput[dayKey] || 0) + p.goodQuantity;

      // By Operator
      if (p.operator) {
        if (!operatorOutput[p.operator.id]) {
          operatorOutput[p.operator.id] = { name: p.operator.fullName, pieces: 0 };
        }
        operatorOutput[p.operator.id].pieces += p.goodQuantity;
      }
    }

    const overallEfficiency = totalInput > 0 ? Number(((totalGood / totalInput) * 100).toFixed(2)) : 100;
    const rejectRate = totalInput > 0 ? Number(((totalReject / totalInput) * 100).toFixed(2)) : 0;
    const reworkRate = totalInput > 0 ? Number(((totalRework / totalInput) * 100).toFixed(2)) : 0;
    const wasteRate = totalInput > 0 ? Number(((totalWaste / totalInput) * 100).toFixed(2)) : 0;

    return {
      summary: {
        totalInput,
        totalGood,
        totalRework,
        totalReject,
        totalWaste,
        overallEfficiency,
        rejectRate,
        reworkRate,
        wasteRate,
      },
      departmentOutput,
      dailyOutput,
      topOperators: Object.values(operatorOutput).sort((a, b) => b.pieces - a.pieces).slice(0, 10),
      activeProgramsCount: programs.length,
    };
  }

  /**
   * Quality Analytics: Pareto analysis, First Pass Yield (FPY), defect rates
   */
  async getQualityAnalytics() {
    const [defects, inspections] = await Promise.all([
      this.prisma.defectRecord.findMany({
        include: { program: true, bundle: true },
      }),
      this.prisma.qualityInspection.findMany({
        include: { parameters: true },
      }),
    ]);

    const totalInspected = inspections.length;
    const passedInspections = inspections.filter((i) => i.status === 'PASSED').length;
    const failedInspections = inspections.filter((i) => i.status === 'FAILED').length;
    const firstPassYield = totalInspected > 0 ? Number(((passedInspections / totalInspected) * 100).toFixed(2)) : 100;

    // Defect breakdown & Pareto chart (80/20)
    const defectCounts: Record<string, { code: string; reason: string; count: number; quantity: number }> = {};
    const defectsByDept: Record<string, number> = {};
    const defectsBySeverity: Record<string, number> = { MINOR: 0, MAJOR: 0, CRITICAL: 0 };

    let totalDefectiveUnits = 0;

    for (const d of defects) {
      totalDefectiveUnits += d.quantity;

      if (!defectCounts[d.defectCode]) {
        defectCounts[d.defectCode] = {
          code: d.defectCode,
          reason: d.reason || d.itemDescription,
          count: 0,
          quantity: 0,
        };
      }
      defectCounts[d.defectCode].count += 1;
      defectCounts[d.defectCode].quantity += d.quantity;

      defectsByDept[d.departmentCode] = (defectsByDept[d.departmentCode] || 0) + d.quantity;

      if (defectsBySeverity[d.severity] !== undefined) {
        defectsBySeverity[d.severity] += d.quantity;
      }
    }

    const sortedDefects = Object.values(defectCounts).sort((a, b) => b.quantity - a.quantity);
    let cumulativeSum = 0;
    const paretoAnalysis = sortedDefects.map((item) => {
      cumulativeSum += item.quantity;
      const cumulativePercentage = totalDefectiveUnits > 0
        ? Number(((cumulativeSum / totalDefectiveUnits) * 100).toFixed(1))
        : 100;
      return {
        ...item,
        percentage: totalDefectiveUnits > 0 ? Number(((item.quantity / totalDefectiveUnits) * 100).toFixed(1)) : 0,
        cumulativePercentage,
      };
    });

    return {
      firstPassYield,
      totalInspections: totalInspected,
      passedInspections,
      failedInspections,
      totalDefectiveUnits,
      paretoAnalysis,
      defectsByDepartment: defectsByDept,
      defectsBySeverity,
    };
  }

  /**
   * Material Analytics: Planned vs actual consumption, variance, roll utilization, abnormal flags
   */
  async getMaterialAnalytics() {
    const [rolls, stockEntries, programs] = await Promise.all([
      this.prisma.fabricRoll.findMany(),
      this.prisma.stockLedgerEntry.findMany({
        where: { referenceType: { in: ['CHALLAN', 'PRODUCTION'] } },
      }),
      this.prisma.program.findMany({
        include: { fabrics: true },
      }),
    ]);

    let totalRollWeightReceived = 0;
    let totalRollWeightCurrent = 0;

    for (const r of rolls) {
      totalRollWeightReceived += r.initialWeightKg;
      totalRollWeightCurrent += r.currentWeightKg;
    }

    const totalWeightConsumed = totalRollWeightReceived - totalRollWeightCurrent;
    const overallRollUtilization = totalRollWeightReceived > 0
      ? Number(((totalWeightConsumed / totalRollWeightReceived) * 100).toFixed(2))
      : 0;

    const programVariance: any[] = [];
    for (const prog of programs) {
      const plannedFabricKg = prog.fabrics.reduce((sum, f) => sum + (f.requiredQuantity || 0), 0);
      const actualEntries = stockEntries.filter((e) => e.programId === prog.id && e.quantity < 0);
      const actualConsumedKg = actualEntries.reduce((sum, e) => sum + Math.abs(e.weightKg || e.quantity), 0);

      const varianceKg = actualConsumedKg - plannedFabricKg;
      const variancePct = plannedFabricKg > 0 ? Number(((varianceKg / plannedFabricKg) * 100).toFixed(2)) : 0;
      const isAbnormal = Math.abs(variancePct) > 5.0;

      programVariance.push({
        programId: prog.id,
        programNumber: prog.programNumber,
        plannedKg: plannedFabricKg,
        actualKg: actualConsumedKg,
        varianceKg: Number(varianceKg.toFixed(2)),
        variancePct,
        isAbnormal,
      });
    }

    return {
      rollsSummary: {
        totalRolls: rolls.length,
        totalInitialWeightKg: Number(totalRollWeightReceived.toFixed(2)),
        totalCurrentWeightKg: Number(totalRollWeightCurrent.toFixed(2)),
        totalConsumedKg: Number(totalWeightConsumed.toFixed(2)),
        utilizationPercentage: overallRollUtilization,
      },
      programVariance,
    };
  }

  /**
   * Delivery Control: Throughput calculation, remaining duration, risk determination
   */
  async getDeliveryControl() {
    const programs = await this.prisma.program.findMany({
      where: { status: { in: ['APPROVED', 'IN_PRODUCTION'] } },
      include: {
        customer: true,
        challans: { include: { productionLogs: true } },
      },
    });

    const deliveryReport = programs.map((prog) => {
      let completedPieces = 0;
      let firstTxDate: Date | null = null;
      let lastTxDate: Date | null = null;

      for (const ch of prog.challans) {
        for (const pt of ch.productionLogs) {
          if (ch.challanType.includes('PACKING') || ch.challanType.includes('FG')) {
            completedPieces += pt.goodQuantity;
          }
          if (!firstTxDate || pt.recordedAt < firstTxDate) firstTxDate = pt.recordedAt;
          if (!lastTxDate || pt.recordedAt > lastTxDate) lastTxDate = pt.recordedAt;
        }
      }

      const targetQuantity = prog.targetQuantity || 1;
      const remainingPieces = Math.max(0, targetQuantity - completedPieces);

      let dailyThroughput = 0;
      if (firstTxDate && lastTxDate && lastTxDate.getTime() > firstTxDate.getTime()) {
        const daysRunning = Math.max(1, (lastTxDate.getTime() - firstTxDate.getTime()) / (1000 * 3600 * 24));
        dailyThroughput = Number((completedPieces / daysRunning).toFixed(1));
      } else if (completedPieces > 0) {
        dailyThroughput = completedPieces;
      }

      const daysNeeded = dailyThroughput > 0 ? Math.ceil(remainingPieces / dailyThroughput) : 14;
      const projectedCompletion = new Date(Date.now() + daysNeeded * 24 * 3600 * 1000);

      const targetDate = prog.deliveryDate ? new Date(prog.deliveryDate) : null;
      let riskStatus = 'ON_TRACK';
      let riskReason = 'Production tracking on pace';

      if (targetDate) {
        const msRemaining = targetDate.getTime() - Date.now();
        const daysUntilTarget = msRemaining / (1000 * 3600 * 24);

        if (daysUntilTarget < 0 && remainingPieces > 0) {
          riskStatus = 'OVERDUE';
          riskReason = `Target date was ${targetDate.toISOString().split('T')[0]}, still ${remainingPieces} units remaining`;
        } else if (projectedCompletion > targetDate) {
          riskStatus = 'AT_RISK';
          riskReason = `Projected completion (${projectedCompletion.toISOString().split('T')[0]}) exceeds target date (${targetDate.toISOString().split('T')[0]})`;
        }
      }

      return {
        programId: prog.id,
        programNumber: prog.programNumber,
        customerName: prog.customer?.name || prog.buyerName || 'Standard Client',
        targetQuantity,
        completedPieces,
        remainingPieces,
        dailyThroughput,
        targetDeliveryDate: prog.deliveryDate?.toISOString(),
        projectedCompletionDate: projectedCompletion.toISOString(),
        riskStatus,
        riskReason,
      };
    });

    return deliveryReport;
  }

  /**
   * Real Production Bottleneck Detection
   */
  async getBottlenecks() {
    const events = await this.prisma.challanEvent.findMany({
      include: {
        challan: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const challanTimelines: Record<string, { challan: any; events: any[] }> = {};
    for (const ev of events) {
      if (!challanTimelines[ev.challanId]) {
        challanTimelines[ev.challanId] = { challan: ev.challan, events: [] };
      }
      challanTimelines[ev.challanId].events.push(ev);
    }

    const departmentMetrics: Record<string, {
      queueTimesMin: number[];
      processingTimesMin: number[];
    }> = {};

    for (const { challan, events: cEvents } of Object.values(challanTimelines)) {
      const deptCode = challan.toDepartment || challan.fromDepartment || 'PLANT';

      if (!departmentMetrics[deptCode]) {
        departmentMetrics[deptCode] = {
          queueTimesMin: [],
          processingTimesMin: [],
        };
      }

      let issueTime: Date | null = null;
      let receiveTime: Date | null = null;
      let startTime: Date | null = null;
      let completeTime: Date | null = null;

      for (const ev of cEvents) {
        if (ev.action === 'ISSUE') issueTime = ev.createdAt;
        if (ev.action === 'RECEIVE') receiveTime = ev.createdAt;
        if (ev.action === 'START') startTime = ev.createdAt;
        if (ev.action === 'COMPLETE') completeTime = ev.createdAt;
      }

      if (issueTime && receiveTime) {
        const queueMin = (receiveTime.getTime() - issueTime.getTime()) / (1000 * 60);
        if (queueMin >= 0) departmentMetrics[deptCode].queueTimesMin.push(queueMin);
      }

      if (startTime && completeTime) {
        const procMin = (completeTime.getTime() - startTime.getTime()) / (1000 * 60);
        if (procMin >= 0) departmentMetrics[deptCode].processingTimesMin.push(procMin);
      }
    }

    const bottlenecks: any[] = [];
    for (const [dept, metrics] of Object.entries(departmentMetrics)) {
      const avgQueue = metrics.queueTimesMin.length > 0
        ? Number((metrics.queueTimesMin.reduce((a, b) => a + b, 0) / metrics.queueTimesMin.length).toFixed(1))
        : 0;
      const avgProc = metrics.processingTimesMin.length > 0
        ? Number((metrics.processingTimesMin.reduce((a, b) => a + b, 0) / metrics.processingTimesMin.length).toFixed(1))
        : 0;

      const totalCycleTimeMin = avgQueue + avgProc;

      bottlenecks.push({
        department: dept,
        avgQueueMinutes: avgQueue,
        avgProcessingMinutes: avgProc,
        totalCycleTimeMinutes: totalCycleTimeMin,
        sampleSize: metrics.queueTimesMin.length + metrics.processingTimesMin.length,
      });
    }

    bottlenecks.sort((a, b) => b.totalCycleTimeMinutes - a.totalCycleTimeMinutes);

    return {
      primaryBottleneckDepartment: bottlenecks.length > 0 ? bottlenecks[0].department : 'NONE',
      departmentMetrics: bottlenecks,
    };
  }
}
