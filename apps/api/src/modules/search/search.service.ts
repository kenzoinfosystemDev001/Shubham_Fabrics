import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Unified global search across all core MES entities
   */
  async search(query: string) {
    const q = query.trim();
    if (!q) return { results: [] };

    const [programs, challans, rolls, bundles, cartons, dispatches, defects] =
      await Promise.all([
        this.prisma.program.findMany({
          where: {
            OR: [
              { programNumber: { contains: q, mode: 'insensitive' } },
              { designName: { contains: q, mode: 'insensitive' } },
              { styleCode: { contains: q, mode: 'insensitive' } },
            ],
          },
          take: 5,
        }),
        this.prisma.challan.findMany({
          where: {
            challanNumber: { contains: q, mode: 'insensitive' },
          },
          take: 5,
        }),
        this.prisma.fabricRoll.findMany({
          where: {
            OR: [
              { rollNumber: { contains: q, mode: 'insensitive' } },
              { lotNumber: { contains: q, mode: 'insensitive' } },
            ],
          },
          take: 5,
        }),
        this.prisma.bundle.findMany({
          where: {
            OR: [
              { bundleNumber: { contains: q, mode: 'insensitive' } },
              { barcode: { contains: q, mode: 'insensitive' } },
            ],
          },
          take: 5,
        }),
        this.prisma.carton.findMany({
          where: {
            OR: [
              { cartonNumber: { contains: q, mode: 'insensitive' } },
              { barcode: { contains: q, mode: 'insensitive' } },
            ],
          },
          take: 5,
        }),
        this.prisma.dispatchOrder.findMany({
          where: {
            OR: [
              { dispatchNumber: { contains: q, mode: 'insensitive' } },
              { lrNumber: { contains: q, mode: 'insensitive' } },
              { orderNumber: { contains: q, mode: 'insensitive' } },
            ],
          },
          take: 5,
        }),
        this.prisma.defectRecord.findMany({
          where: {
            OR: [
              { defectCode: { contains: q, mode: 'insensitive' } },
              { reason: { contains: q, mode: 'insensitive' } },
            ],
          },
          take: 5,
        }),
      ]);

    const results: any[] = [];
    programs.forEach((p) =>
      results.push({ type: 'PROGRAM', id: p.id, title: p.programNumber, subtitle: p.designName, status: p.status }),
    );
    challans.forEach((c) =>
      results.push({
        type: 'CHALLAN',
        id: c.id,
        title: c.challanNumber,
        subtitle: `${c.fromDepartment} → ${c.toDepartment}`,
        status: c.status,
      }),
    );
    rolls.forEach((r) =>
      results.push({ type: 'FABRIC_ROLL', id: r.id, title: r.rollNumber, subtitle: `${r.fabricName} (Lot ${r.lotNumber})`, status: r.status }),
    );
    bundles.forEach((b) =>
      results.push({ type: 'BUNDLE', id: b.id, title: b.bundleNumber, subtitle: `Size: ${b.size}, Color: ${b.colour}`, status: b.status, barcode: b.barcode }),
    );
    cartons.forEach((ct) =>
      results.push({ type: 'CARTON', id: ct.id, title: ct.cartonNumber, subtitle: `${ct.quantity} pcs (${ct.size} / ${ct.colour})`, status: ct.status, barcode: ct.barcode }),
    );
    dispatches.forEach((d) =>
      results.push({ type: 'DISPATCH', id: d.id, title: d.dispatchNumber, subtitle: `LR: ${d.lrNumber || 'N/A'}, Dest: ${d.destination}`, status: d.status }),
    );
    defects.forEach((df) =>
      results.push({ type: 'DEFECT', id: df.id, title: df.defectCode, subtitle: `${df.quantity} pcs - ${df.reason}`, status: df.status }),
    );

    return { query: q, total: results.length, results };
  }

  /**
   * Barcode genealogy resolver
   */
  async resolveBarcode(barcode: string) {
    const code = barcode.trim();

    // 1. Check Bundle
    const bundle = await this.prisma.bundle.findFirst({
      where: { OR: [{ barcode: code }, { bundleNumber: code }] },
      include: {
        program: { include: { customer: true } },
        roll: true,
        challan: true,
        cartonItems: { include: { carton: { include: { dispatchCartons: { include: { dispatch: true } } } } } },
        defects: { include: { reworks: true, recutRequests: true } },
      },
    });

    if (bundle) {
      const carton = bundle.cartonItems[0]?.carton;
      const dispatch = carton?.dispatchCartons[0]?.dispatch;

      return {
        entityType: 'BUNDLE',
        entity: bundle,
        genealogy: {
          program: { id: bundle.program.id, number: bundle.program.programNumber, style: bundle.program.designName },
          roll: bundle.roll ? { id: bundle.roll.id, number: bundle.roll.rollNumber, lot: bundle.roll.lotNumber } : null,
          challan: bundle.challan ? { id: bundle.challan.id, number: bundle.challan.challanNumber } : null,
          bundle: { id: bundle.id, number: bundle.bundleNumber, barcode: bundle.barcode, size: bundle.size, colour: bundle.colour, quantity: bundle.quantity },
          carton: carton ? { id: carton.id, number: carton.cartonNumber, rack: carton.locationRack, shelf: carton.locationShelf } : null,
          dispatch: dispatch ? { id: dispatch.id, number: dispatch.dispatchNumber, lrNumber: dispatch.lrNumber, status: dispatch.status } : null,
          defects: bundle.defects,
        },
      };
    }

    // 2. Check Roll
    const roll = await this.prisma.fabricRoll.findFirst({
      where: { rollNumber: code },
      include: { program: true, supplier: true, bundles: true },
    });

    if (roll) {
      return {
        entityType: 'FABRIC_ROLL',
        entity: roll,
        genealogy: {
          program: roll.program ? { id: roll.program.id, number: roll.program.programNumber } : null,
          supplier: roll.supplier ? { id: roll.supplier.id, name: roll.supplier.name } : null,
          roll: { id: roll.id, number: roll.rollNumber, lot: roll.lotNumber, initialKg: roll.initialWeightKg, currentKg: roll.currentWeightKg },
          bundlesGeneratedCount: roll.bundles.length,
          bundles: roll.bundles.slice(0, 10).map((b) => ({ id: b.id, number: b.bundleNumber, barcode: b.barcode })),
        },
      };
    }

    // 3. Check Carton
    const carton = await this.prisma.carton.findFirst({
      where: { OR: [{ barcode: code }, { cartonNumber: code }] },
      include: {
        program: true,
        bundles: { include: { bundle: true } },
        dispatchCartons: { include: { dispatch: true } },
      },
    });

    if (carton) {
      const dispatch = carton.dispatchCartons[0]?.dispatch;
      return {
        entityType: 'CARTON',
        entity: carton,
        genealogy: {
          program: { id: carton.program.id, number: carton.program.programNumber },
          carton: { id: carton.id, number: carton.cartonNumber, quantity: carton.quantity, status: carton.status, location: `${carton.locationRack || ''}-${carton.locationShelf || ''}` },
          bundles: carton.bundles.map((cb) => ({ id: cb.bundle.id, number: cb.bundle.bundleNumber, size: cb.bundle.size, qty: cb.quantity })),
          dispatch: dispatch ? { id: dispatch.id, number: dispatch.dispatchNumber, lr: dispatch.lrNumber } : null,
        },
      };
    }

    // 4. Check Challan
    const challan = await this.prisma.challan.findFirst({
      where: { challanNumber: code },
      include: { program: true, items: true, events: true },
    });

    if (challan) {
      return {
        entityType: 'CHALLAN',
        entity: challan,
        genealogy: {
          program: { id: challan.program.id, number: challan.program.programNumber },
          challan: {
            id: challan.id,
            number: challan.challanNumber,
            from: challan.fromDepartment,
            to: challan.toDepartment,
            quantity: challan.items.reduce((s, i) => s + i.quantity, 0),
            status: challan.status,
          },
          eventsCount: challan.events.length,
        },
      };
    }

    throw new NotFoundException(`No MES entity found matching identifier or barcode: "${code}"`);
  }
}
